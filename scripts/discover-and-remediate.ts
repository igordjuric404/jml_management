/**
 * Microsoft 365 OAuth Discovery & Remediation Script
 *
 * Scans all tenant users for OAuth2 permission grants, app role assignments,
 * and sign-in sessions. Optionally revokes discovered grants and sessions.
 *
 * Usage:
 *   npx tsx scripts/discover-and-remediate.ts              # Discovery only (dry run)
 *   npx tsx scripts/discover-and-remediate.ts --revoke      # Discovery + revocation
 *
 * Output: logs/ms365-remediation-YYYY-MM-DDTHH-MM-SS.log
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { writeFileSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";

const tenantId = process.env.MICROSOFT_TENANT_ID!;
const clientId = process.env.MICROSOFT_CLIENT_ID!;
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;

if (!tenantId || !clientId || !clientSecret) {
  console.error("ERROR: Missing Microsoft 365 credentials in .env.local");
  process.exit(1);
}

const shouldRevoke = process.argv.includes("--revoke");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const logsDir = join(process.cwd(), "logs");
const logFile = join(logsDir, `ms365-remediation-${timestamp}.log`);

mkdirSync(logsDir, { recursive: true });

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(logFile, line + "\n");
}

interface UserInfo {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled: boolean;
}

interface OAuthGrant {
  id: string;
  clientId: string;
  consentType: string;
  principalId?: string;
  resourceId: string;
  scope: string;
  startTime?: string;
  expiryTime?: string;
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

interface ServicePrincipal {
  id: string;
  appId: string;
  displayName: string;
}

async function main() {
  log("=".repeat(80));
  log("MICROSOFT 365 OAUTH DISCOVERY & REMEDIATION");
  log(`Mode: ${shouldRevoke ? "REVOKE (live)" : "DISCOVERY ONLY (dry run)"}`);
  log(`Tenant: ${tenantId}`);
  log(`Timestamp: ${new Date().toISOString()}`);
  log("=".repeat(80));
  log("");

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });
  const graphClient = Client.initWithMiddleware({ authProvider });

  // ── Phase 1: Discover Users ──────────────────────────────
  log("── PHASE 1: USER DISCOVERY ──");
  let users: UserInfo[] = [];
  try {
    const resp = await graphClient
      .api("/users")
      .select("id,displayName,userPrincipalName,accountEnabled")
      .top(999)
      .get();
    users = resp.value || [];
    log(`Found ${users.length} users:`);
    for (const u of users) {
      log(`  - ${u.displayName} (${u.userPrincipalName}) [${u.accountEnabled ? "Enabled" : "DISABLED"}]`);
    }
  } catch (err: unknown) {
    log(`ERROR listing users: ${(err as Error).message}`);
    process.exit(1);
  }
  log("");

  // ── Phase 2: Discover OAuth2 Permission Grants (tenant-wide) ──
  log("── PHASE 2: TENANT-WIDE OAUTH2 PERMISSION GRANTS ──");
  let allGrants: OAuthGrant[] = [];
  try {
    let resp = await graphClient.api("/oauth2PermissionGrants").top(999).get();
    allGrants = resp.value || [];
    while (resp["@odata.nextLink"]) {
      resp = await graphClient.api(resp["@odata.nextLink"]).get();
      allGrants.push(...(resp.value || []));
    }
    log(`Found ${allGrants.length} tenant-wide OAuth2 permission grants:`);
    for (const g of allGrants) {
      log(`  - Grant ID: ${g.id}`);
      log(`    Client (SP): ${g.clientId}`);
      log(`    Consent Type: ${g.consentType}`);
      log(`    Principal: ${g.principalId || "N/A (admin consent)"}`);
      log(`    Resource: ${g.resourceId}`);
      log(`    Scopes: "${g.scope}"`);
      log(`    Start: ${g.startTime || "N/A"}, Expiry: ${g.expiryTime || "N/A"}`);
    }
  } catch (err: unknown) {
    log(`ERROR listing tenant OAuth grants: ${(err as Error).message}`);
  }
  log("");

  // ── Phase 3: Per-User OAuth Grants ──
  log("── PHASE 3: PER-USER OAUTH GRANTS ──");
  const userGrantMap: Map<string, OAuthGrant[]> = new Map();
  for (const user of users) {
    try {
      let resp = await graphClient
        .api(`/users/${user.id}/oauth2PermissionGrants`)
        .get();
      const grants: OAuthGrant[] = resp.value || [];
      while (resp["@odata.nextLink"]) {
        resp = await graphClient.api(resp["@odata.nextLink"]).get();
        grants.push(...(resp.value || []));
      }
      userGrantMap.set(user.id, grants);

      if (grants.length > 0) {
        log(`User: ${user.displayName} (${user.userPrincipalName}) — ${grants.length} grants:`);
        for (const g of grants) {
          log(`    - Grant ${g.id}: client=${g.clientId}, scope="${g.scope}", consent=${g.consentType}`);
        }
      } else {
        log(`User: ${user.displayName} (${user.userPrincipalName}) — 0 grants`);
      }
    } catch (err: unknown) {
      log(`  ERROR for ${user.userPrincipalName}: ${(err as Error).message}`);
    }
  }
  log("");

  // ── Phase 4: Per-User App Role Assignments ──
  log("── PHASE 4: PER-USER APP ROLE ASSIGNMENTS ──");
  const userAppRoles: Map<string, AppRoleAssignment[]> = new Map();
  for (const user of users) {
    try {
      const resp = await graphClient
        .api(`/users/${user.id}/appRoleAssignments`)
        .get();
      const roles: AppRoleAssignment[] = resp.value || [];
      userAppRoles.set(user.id, roles);

      if (roles.length > 0) {
        log(`User: ${user.displayName} — ${roles.length} app role assignments:`);
        for (const r of roles) {
          log(`    - ${r.resourceDisplayName} (role: ${r.appRoleId}), created: ${r.createdDateTime || "N/A"}`);
        }
      } else {
        log(`User: ${user.displayName} — 0 app role assignments`);
      }
    } catch (err: unknown) {
      log(`  ERROR for ${user.userPrincipalName}: ${(err as Error).message}`);
    }
  }
  log("");

  // ── Phase 5: Service Principal Resolution ──
  log("── PHASE 5: RESOLVING SERVICE PRINCIPALS ──");
  const spIds = new Set<string>();
  for (const g of allGrants) {
    spIds.add(g.clientId);
    spIds.add(g.resourceId);
  }

  const spMap: Map<string, ServicePrincipal> = new Map();
  for (const spId of spIds) {
    try {
      const sp = await graphClient
        .api(`/servicePrincipals/${spId}`)
        .select("id,appId,displayName")
        .get();
      spMap.set(spId, sp);
      log(`  SP ${spId} → ${sp.displayName} (appId: ${sp.appId})`);
    } catch (err: unknown) {
      log(`  SP ${spId} → FAILED to resolve: ${(err as Error).message?.slice(0, 80)}`);
    }
  }
  log("");

  // ── Summary ──
  log("── FINDINGS SUMMARY ──");
  const totalGrants = allGrants.length;
  const usersWithGrants = [...userGrantMap.entries()].filter(([, g]) => g.length > 0);
  const totalAppRoles = [...userAppRoles.values()].reduce((sum, r) => sum + r.length, 0);

  log(`Total users: ${users.length}`);
  log(`Total tenant-wide OAuth2 grants: ${totalGrants}`);
  log(`Users with OAuth grants: ${usersWithGrants.length}`);
  log(`Total app role assignments: ${totalAppRoles}`);
  log("");

  for (const [userId, grants] of usersWithGrants) {
    const user = users.find((u) => u.id === userId)!;
    log(`  ${user.displayName} (${user.userPrincipalName}):`);
    for (const g of grants) {
      const clientName = spMap.get(g.clientId)?.displayName || g.clientId;
      const resourceName = spMap.get(g.resourceId)?.displayName || g.resourceId;
      log(`    → ${clientName} → ${resourceName}: "${g.scope}" [${g.consentType}]`);
    }
  }
  log("");

  // ── Phase 6: Revocation (if --revoke) ──
  if (shouldRevoke && totalGrants > 0) {
    log("── PHASE 6: REVOKING OAUTH GRANTS ──");
    let revokedCount = 0;
    let failedCount = 0;

    for (const grant of allGrants) {
      const clientName = spMap.get(grant.clientId)?.displayName || grant.clientId;
      const principalUser = users.find((u) => u.id === grant.principalId);
      const principalName = principalUser
        ? `${principalUser.displayName} (${principalUser.userPrincipalName})`
        : grant.principalId || "admin consent";

      log(`  Revoking grant ${grant.id}:`);
      log(`    Client: ${clientName}`);
      log(`    Principal: ${principalName}`);
      log(`    Scopes: "${grant.scope}"`);

      try {
        await graphClient
          .api(`/oauth2PermissionGrants/${grant.id}`)
          .delete();
        log(`    ✓ REVOKED successfully`);
        revokedCount++;
      } catch (err: unknown) {
        const msg = (err as Error).message || String(err);
        if (msg.includes("does not exist") || msg.includes("404")) {
          log(`    ✓ Already revoked (not found)`);
          revokedCount++;
        } else {
          log(`    ✗ FAILED: ${msg.slice(0, 150)}`);
          failedCount++;
        }
      }
    }

    log("");
    log(`Revocation complete: ${revokedCount} revoked, ${failedCount} failed`);
    log("");

    // Revoke sign-in sessions for all users
    log("── PHASE 7: REVOKING SIGN-IN SESSIONS ──");
    for (const user of users) {
      log(`  Revoking sessions for ${user.displayName} (${user.userPrincipalName})...`);
      try {
        const result = await graphClient
          .api(`/users/${user.id}/revokeSignInSessions`)
          .post({});
        log(`    ✓ Sessions revoked: ${result?.value}`);
      } catch (err: unknown) {
        log(`    ✗ FAILED: ${(err as Error).message?.slice(0, 100)}`);
      }
    }
    log("");
  } else if (!shouldRevoke && totalGrants > 0) {
    log("── DRY RUN — No changes made ──");
    log(`Run with --revoke to revoke ${totalGrants} grants and all sign-in sessions.`);
    log("");
  } else {
    log("No OAuth grants found to revoke.");
    log("");
  }

  // ── Post-revocation verification ──
  if (shouldRevoke && totalGrants > 0) {
    log("── PHASE 8: POST-REVOCATION VERIFICATION ──");
    try {
      const resp = await graphClient.api("/oauth2PermissionGrants").top(999).get();
      const remaining = resp.value?.length || 0;
      log(`Remaining OAuth2 grants after revocation: ${remaining}`);
      if (remaining > 0) {
        for (const g of resp.value) {
          const clientName = spMap.get(g.clientId)?.displayName || g.clientId;
          log(`  ⚠ Still active: ${g.id} → ${clientName} (${g.scope})`);
        }
      } else {
        log("  ✓ All OAuth2 grants successfully revoked — tenant is clean");
      }
    } catch (err: unknown) {
      log(`  ERROR verifying: ${(err as Error).message}`);
    }
    log("");
  }

  log("=".repeat(80));
  log(`Log file: ${logFile}`);
  log("=".repeat(80));
}

main().catch((err) => {
  log(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
