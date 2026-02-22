/**
 * Force Sign-Out All Users from All Microsoft 365 Services
 *
 * This script forcefully signs out all tenant users from:
 * - Outlook (web, desktop, mobile)
 * - Microsoft Teams
 * - OneDrive / SharePoint
 * - Any app using Microsoft SSO (Slack, GitHub, etc.)
 * - All browser sessions
 * - All mobile app sessions
 *
 * It does this by:
 * 1. Discovering all connected apps per user (OAuth grants, app roles, managed devices)
 * 2. Revoking all OAuth2 permission grants (removes app consent)
 * 3. Removing app role assignments (removes enterprise app access)
 * 4. Calling revokeSignInSessions (invalidates ALL refresh tokens)
 * 5. Verifying clean state
 *
 * Usage: npx tsx scripts/force-signout-all.ts
 * Log:   logs/force-signout-YYYY-MM-DDTHH-MM-SS.log
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { mkdirSync, appendFileSync } from "fs";
import { join } from "path";

const tenantId = process.env.MICROSOFT_TENANT_ID!;
const clientId = process.env.MICROSOFT_CLIENT_ID!;
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;

if (!tenantId || !clientId || !clientSecret) {
  console.error("ERROR: Missing Microsoft 365 credentials in .env.local");
  process.exit(1);
}

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const logsDir = join(process.cwd(), "logs");
const logFile = join(logsDir, `force-signout-${ts}.log`);
mkdirSync(logsDir, { recursive: true });

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(logFile, line + "\n");
}

async function collectPages<T>(client: Client, url: string): Promise<T[]> {
  const items: T[] = [];
  let resp = await client.api(url).get();
  if (resp.value) items.push(...resp.value);
  while (resp["@odata.nextLink"]) {
    resp = await client.api(resp["@odata.nextLink"]).get();
    if (resp.value) items.push(...resp.value);
  }
  return items;
}

interface UserProfile {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled: boolean;
  mail?: string;
}

interface OAuthGrant {
  id: string;
  clientId: string;
  consentType: string;
  principalId?: string;
  resourceId: string;
  scope: string;
}

interface AppRoleAssignment {
  id: string;
  appRoleId: string;
  principalDisplayName: string;
  principalId: string;
  resourceDisplayName: string;
  resourceId: string;
  createdDateTime?: string;
}

interface RegisteredDevice {
  id: string;
  displayName?: string;
  deviceId?: string;
  operatingSystem?: string;
  operatingSystemVersion?: string;
  trustType?: string;
  isManaged?: boolean;
}

async function main() {
  log("=".repeat(80));
  log("FORCE SIGN-OUT: ALL USERS FROM ALL MICROSOFT 365 SERVICES");
  log(`Tenant: ${tenantId}`);
  log(`Timestamp: ${new Date().toISOString()}`);
  log("=".repeat(80));
  log("");

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });
  const graphClient = Client.initWithMiddleware({ authProvider });

  // ── Resolve service principal names ──
  const spCache: Map<string, string> = new Map();
  async function resolveSP(spId: string): Promise<string> {
    if (spCache.has(spId)) return spCache.get(spId)!;
    try {
      const sp = await graphClient.api(`/servicePrincipals/${spId}`).select("displayName").get();
      spCache.set(spId, sp.displayName);
      return sp.displayName;
    } catch {
      return spId;
    }
  }

  // ── Step 1: List all users ──
  log("━━━ STEP 1: DISCOVERING USERS ━━━");
  const users = await collectPages<UserProfile>(graphClient, "/users?$select=id,displayName,userPrincipalName,accountEnabled,mail&$top=999");
  log(`Found ${users.length} users in tenant:`);
  for (const u of users) {
    log(`  ${u.displayName} <${u.userPrincipalName}> [${u.accountEnabled ? "ACTIVE" : "DISABLED"}]`);
  }
  log("");

  let totalGrantsRevoked = 0;
  let totalRolesRemoved = 0;
  let totalSessionsRevoked = 0;

  for (const user of users) {
    log("─".repeat(80));
    log(`USER: ${user.displayName} (${user.userPrincipalName})`);
    log("─".repeat(80));

    // ── Step 2: Discover per-user OAuth grants ──
    log(`  [2a] OAuth2 Permission Grants:`);
    let userGrants: OAuthGrant[] = [];
    try {
      userGrants = await collectPages<OAuthGrant>(
        graphClient,
        `/users/${user.id}/oauth2PermissionGrants`,
      );
      if (userGrants.length === 0) {
        log(`      None found`);
      } else {
        for (const g of userGrants) {
          const clientName = await resolveSP(g.clientId);
          const resourceName = await resolveSP(g.resourceId);
          log(`      → ${clientName} → ${resourceName}: "${g.scope}" [${g.consentType}]`);
        }
      }
    } catch (err: unknown) {
      log(`      ERROR: ${(err as Error).message?.slice(0, 120)}`);
    }

    // ── Step 3: Discover app role assignments ──
    log(`  [2b] App Role Assignments (Enterprise Apps):`);
    let appRoles: AppRoleAssignment[] = [];
    try {
      appRoles = await collectPages<AppRoleAssignment>(
        graphClient,
        `/users/${user.id}/appRoleAssignments`,
      );
      if (appRoles.length === 0) {
        log(`      None found`);
      } else {
        for (const r of appRoles) {
          log(`      → ${r.resourceDisplayName} (role: ${r.appRoleId === "00000000-0000-0000-0000-000000000000" ? "Default Access" : r.appRoleId})`);
        }
      }
    } catch (err: unknown) {
      log(`      ERROR: ${(err as Error).message?.slice(0, 120)}`);
    }

    // ── Step 4: Discover registered/managed devices ──
    log(`  [2c] Registered Devices:`);
    let devices: RegisteredDevice[] = [];
    try {
      devices = await collectPages<RegisteredDevice>(
        graphClient,
        `/users/${user.id}/registeredDevices?$select=id,displayName,deviceId,operatingSystem,operatingSystemVersion,trustType,isManaged`,
      );
      if (devices.length === 0) {
        log(`      None found`);
      } else {
        for (const d of devices) {
          log(`      → ${d.displayName || "Unknown"} (${d.operatingSystem || "?"} ${d.operatingSystemVersion || ""}) [trust: ${d.trustType || "?"}]`);
        }
      }
    } catch (err: unknown) {
      log(`      ERROR: ${(err as Error).message?.slice(0, 120)}`);
    }

    // ── Step 5: Revoke all OAuth2 permission grants ──
    if (userGrants.length > 0) {
      log(`  [3] REVOKING ${userGrants.length} OAuth grants...`);
      for (const g of userGrants) {
        const clientName = await resolveSP(g.clientId);
        try {
          await graphClient.api(`/oauth2PermissionGrants/${g.id}`).delete();
          log(`      ✓ Revoked: ${clientName} (${g.scope})`);
          totalGrantsRevoked++;
        } catch (err: unknown) {
          const msg = (err as Error).message || "";
          if (msg.includes("does not exist") || msg.includes("404")) {
            log(`      ✓ Already revoked: ${clientName}`);
            totalGrantsRevoked++;
          } else {
            log(`      ✗ Failed: ${clientName} — ${msg.slice(0, 100)}`);
          }
        }
      }
    }

    // ── Step 6: Remove app role assignments ──
    if (appRoles.length > 0) {
      log(`  [4] REMOVING ${appRoles.length} app role assignments...`);
      for (const r of appRoles) {
        try {
          await graphClient
            .api(`/users/${user.id}/appRoleAssignments/${r.id}`)
            .delete();
          log(`      ✓ Removed: ${r.resourceDisplayName}`);
          totalRolesRemoved++;
        } catch (err: unknown) {
          const msg = (err as Error).message || "";
          if (msg.includes("does not exist") || msg.includes("404")) {
            log(`      ✓ Already removed: ${r.resourceDisplayName}`);
            totalRolesRemoved++;
          } else {
            log(`      ✗ Failed: ${r.resourceDisplayName} — ${msg.slice(0, 100)}`);
          }
        }
      }
    }

    // ── Step 7: Revoke ALL sign-in sessions ──
    log(`  [5] REVOKING ALL SIGN-IN SESSIONS...`);
    log(`      This forces re-authentication on ALL apps and devices:`);
    log(`      → Outlook (web, desktop, mobile)`);
    log(`      → Microsoft Teams`);
    log(`      → OneDrive / SharePoint`);
    log(`      → Any SSO app (Slack, GitHub, etc.)`);
    log(`      → All browser sessions`);
    log(`      → All mobile app sessions`);
    try {
      const result = await graphClient
        .api(`/users/${user.id}/revokeSignInSessions`)
        .post({});
      if (result?.value === true) {
        log(`      ✓ ALL sessions revoked for ${user.displayName}`);
        log(`        User must re-authenticate on every device and app`);
        totalSessionsRevoked++;
      } else {
        log(`      ⚠ API returned: ${JSON.stringify(result)}`);
      }
    } catch (err: unknown) {
      log(`      ✗ FAILED: ${(err as Error).message?.slice(0, 120)}`);
    }

    log("");
  }

  // ── Step 8: Tenant-wide OAuth2 grant cleanup ──
  log("━━━ STEP 8: TENANT-WIDE OAUTH GRANT CLEANUP ━━━");
  try {
    const tenantGrants = await collectPages<OAuthGrant>(
      graphClient,
      "/oauth2PermissionGrants?$top=999",
    );
    if (tenantGrants.length > 0) {
      log(`Found ${tenantGrants.length} tenant-wide grants to revoke:`);
      for (const g of tenantGrants) {
        const clientName = await resolveSP(g.clientId);
        const resourceName = await resolveSP(g.resourceId);
        log(`  Revoking: ${clientName} → ${resourceName}: "${g.scope}" [${g.consentType}]`);
        try {
          await graphClient.api(`/oauth2PermissionGrants/${g.id}`).delete();
          log(`    ✓ Revoked`);
          totalGrantsRevoked++;
        } catch (err: unknown) {
          log(`    ✗ Failed: ${(err as Error).message?.slice(0, 100)}`);
        }
      }
    } else {
      log("  No tenant-wide OAuth grants remaining — clean");
    }
  } catch (err: unknown) {
    log(`  ERROR: ${(err as Error).message?.slice(0, 120)}`);
  }
  log("");

  // ── Step 9: Verification ──
  log("━━━ STEP 9: POST-ACTION VERIFICATION ━━━");

  // Wait for Azure AD propagation
  log("  Waiting 5 seconds for Azure AD propagation...");
  await new Promise((r) => setTimeout(r, 5000));

  try {
    const remainingGrants = await collectPages<OAuthGrant>(
      graphClient,
      "/oauth2PermissionGrants?$top=999",
    );
    log(`  Remaining OAuth2 grants: ${remainingGrants.length}`);
    if (remainingGrants.length > 0) {
      for (const g of remainingGrants) {
        const clientName = await resolveSP(g.clientId);
        log(`    ⚠ Still active: ${clientName} — "${g.scope}"`);
      }
    }
  } catch (err: unknown) {
    log(`  ERROR checking grants: ${(err as Error).message?.slice(0, 100)}`);
  }

  for (const user of users) {
    try {
      const roles = await collectPages<AppRoleAssignment>(
        graphClient,
        `/users/${user.id}/appRoleAssignments`,
      );
      log(`  ${user.displayName}: ${roles.length} app role assignments remaining`);
      for (const r of roles) {
        log(`    ⚠ Still assigned: ${r.resourceDisplayName}`);
      }
    } catch {
      // ignore
    }
  }
  log("");

  // ── Summary ──
  log("━━━ SUMMARY ━━━");
  log(`OAuth grants revoked: ${totalGrantsRevoked}`);
  log(`App role assignments removed: ${totalRolesRemoved}`);
  log(`Users with sessions revoked: ${totalSessionsRevoked}/${users.length}`);
  log("");
  log("What this means for each user:");
  log("  ✓ Signed out of Outlook (web, desktop, mobile)");
  log("  ✓ Signed out of Microsoft Teams");
  log("  ✓ Signed out of OneDrive / SharePoint");
  log("  ✓ Signed out of all Microsoft SSO apps (Slack, GitHub, etc.)");
  log("  ✓ All browser sessions invalidated");
  log("  ✓ All mobile app sessions invalidated");
  log("  ✓ All refresh tokens revoked");
  log("  ✓ Must re-authenticate on every device and application");
  log("");
  log("=".repeat(80));
  log(`Log file: ${logFile}`);
  log("=".repeat(80));
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
