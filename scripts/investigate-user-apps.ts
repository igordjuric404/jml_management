/**
 * Investigate what apps users are actually connected to in the tenant.
 *
 * Checks:
 * 1. All enterprise applications (service principals) in the tenant
 * 2. Which apps have user assignments
 * 3. All consent records (delegated + application)
 * 4. User sign-in activity (if available)
 * 5. User's registered authentication methods
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

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const logsDir = join(process.cwd(), "logs");
const logFile = join(logsDir, `investigation-${ts}.log`);
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

const SKIP_USER = "revokeit@sarmateam.onmicrosoft.com";

async function main() {
  log("=".repeat(80));
  log("INVESTIGATION: WHY ARE THERE NO PER-USER OAUTH GRANTS?");
  log(`Tenant: ${tenantId}`);
  log("=".repeat(80));
  log("");

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });
  const gc = Client.initWithMiddleware({ authProvider });

  // ── 1. List ALL enterprise applications (service principals) ──
  log("━━━ 1. ALL ENTERPRISE APPLICATIONS IN TENANT ━━━");
  const sps = await collectPages<Record<string, unknown>>(
    gc,
    "/servicePrincipals?$select=id,appId,displayName,servicePrincipalType,accountEnabled,appOwnerOrganizationId,loginUrl,replyUrls,tags&$top=999",
  );
  log(`Total service principals: ${sps.length}`);
  log("");

  const thirdPartyApps: typeof sps = [];
  const msApps: typeof sps = [];

  for (const sp of sps) {
    const tags = (sp.tags as string[]) || [];
    const isGalleryOrCustom = tags.includes("WindowsAzureActiveDirectoryIntegratedApp") ||
      tags.includes("WindowsAzureActiveDirectoryGalleryApplicationNonPrimaryV1") ||
      tags.includes("WindowsAzureActiveDirectoryCustomSingleSignOnApplication");

    if (isGalleryOrCustom) {
      thirdPartyApps.push(sp);
    } else {
      msApps.push(sp);
    }
  }

  log(`Third-party / custom enterprise apps: ${thirdPartyApps.length}`);
  for (const sp of thirdPartyApps) {
    log(`  → ${sp.displayName} (appId: ${(sp.appId as string)?.slice(0, 16)}...) [${sp.accountEnabled ? "Enabled" : "DISABLED"}]`);
    log(`    Type: ${sp.servicePrincipalType}`);
    log(`    Tags: ${((sp.tags as string[]) || []).join(", ")}`);
    if (sp.loginUrl) log(`    Login URL: ${sp.loginUrl}`);
    const urls = (sp.replyUrls as string[]) || [];
    if (urls.length > 0) log(`    Reply URLs: ${urls.slice(0, 3).join(", ")}${urls.length > 3 ? ` (+${urls.length - 3} more)` : ""}`);
  }
  log("");

  log(`Microsoft / system service principals: ${msApps.length}`);
  for (const sp of msApps) {
    log(`  → ${sp.displayName}`);
  }
  log("");

  // ── 2. Check app role assignments for each third-party app ──
  log("━━━ 2. USER ASSIGNMENTS FOR THIRD-PARTY APPS ━━━");
  for (const sp of thirdPartyApps) {
    try {
      const assignments = await collectPages<Record<string, unknown>>(
        gc,
        `/servicePrincipals/${sp.id}/appRoleAssignedTo?$top=999`,
      );
      if (assignments.length > 0) {
        log(`  ${sp.displayName}: ${assignments.length} user(s) assigned`);
        for (const a of assignments) {
          log(`    → ${a.principalDisplayName} (${a.principalType}) — role: ${a.appRoleId === "00000000-0000-0000-0000-000000000000" ? "Default Access" : a.appRoleId}`);
        }
      } else {
        log(`  ${sp.displayName}: No users assigned`);
      }
    } catch (err: unknown) {
      log(`  ${sp.displayName}: ERROR — ${(err as Error).message?.slice(0, 100)}`);
    }
  }
  log("");

  // ── 3. Check ALL oauth2PermissionGrants (all types) ──
  log("━━━ 3. ALL OAUTH2 PERMISSION GRANTS (DETAILED) ━━━");
  try {
    const grants = await collectPages<Record<string, unknown>>(
      gc,
      "/oauth2PermissionGrants?$top=999",
    );
    log(`Total grants: ${grants.length}`);
    for (const g of grants) {
      const clientSp = sps.find((s) => s.id === g.clientId);
      const resourceSp = sps.find((s) => s.id === g.resourceId);
      log(`  Grant ${(g.id as string)?.slice(0, 20)}...`);
      log(`    Client: ${clientSp?.displayName || g.clientId} → Resource: ${resourceSp?.displayName || g.resourceId}`);
      log(`    Consent: ${g.consentType}, Principal: ${g.principalId || "ALL"}`);
      log(`    Scopes: "${g.scope}"`);
    }
    if (grants.length === 0) {
      log("  (None — this is why per-user grants are empty)");
    }
  } catch (err: unknown) {
    log(`  ERROR: ${(err as Error).message?.slice(0, 120)}`);
  }
  log("");

  // ── 4. Per-user: check sign-in activity + detailed profile ──
  log("━━━ 4. PER-USER SIGN-IN ACTIVITY & PROFILE ━━━");
  let users: Record<string, unknown>[] = [];
  try {
    users = await collectPages<Record<string, unknown>>(
      gc,
      "/users?$select=id,displayName,userPrincipalName,accountEnabled,signInActivity,lastPasswordChangeDateTime,createdDateTime&$top=999",
    );
  } catch {
    log("  signInActivity requires Premium — falling back without it");
    users = await collectPages<Record<string, unknown>>(
      gc,
      "/users?$select=id,displayName,userPrincipalName,accountEnabled,createdDateTime&$top=999",
    );
  }

  for (const user of users) {
    const upn = (user.userPrincipalName as string || "").toLowerCase();
    if (upn === SKIP_USER.toLowerCase()) {
      log(`  ${user.displayName}: SKIPPED (protected account)`);
      continue;
    }

    log(`  ${user.displayName} (${user.userPrincipalName}):`);
    log(`    Created: ${user.createdDateTime || "?"}`);
    log(`    Last password change: ${user.lastPasswordChangeDateTime || "N/A"}`);

    const activity = user.signInActivity as Record<string, unknown> | undefined;
    if (activity) {
      log(`    Last interactive sign-in: ${activity.lastSignInDateTime || "N/A"}`);
      log(`    Last non-interactive sign-in: ${activity.lastNonInteractiveSignInDateTime || "N/A"}`);
    } else {
      log(`    Sign-in activity: Not available (requires Azure AD Premium P1)`);
    }
  }
  log("");

  // ── 5. Try sign-in logs (may fail without Premium) ──
  log("━━━ 5. RECENT SIGN-IN LOGS (REQUIRES PREMIUM) ━━━");
  try {
    const signIns = await gc.api("/auditLogs/signIns").top(20).orderby("createdDateTime desc").get();
    const entries = signIns.value || [];
    log(`Found ${entries.length} recent sign-in entries:`);
    for (const s of entries) {
      log(`  ${s.userDisplayName} → ${s.appDisplayName} at ${s.createdDateTime} from ${s.ipAddress} [${s.status?.errorCode === 0 ? "Success" : `Error: ${s.status?.failureReason}`}]`);
    }
  } catch (err: unknown) {
    log(`  Not available: ${(err as Error).message?.slice(0, 120)}`);
  }
  log("");

  // ── 6. Explanation ──
  log("━━━ ANALYSIS: WHY NO PER-USER OAUTH GRANTS? ━━━");
  log("");
  log("OAuth2 permission grants in Microsoft Graph represent CONSENT RECORDS, not");
  log("active sessions. They are created when:");
  log("  1. A user consents to an app requesting delegated permissions");
  log("  2. An admin grants tenant-wide consent (AllPrincipals)");
  log("");
  log("There are several reasons why test users may show 0 grants:");
  log("");
  log("  A) ADMIN CONSENT WAS USED: If Slack/other apps were added as enterprise");
  log("     apps with admin consent, the consent record is at the tenant level");
  log("     (consentType=AllPrincipals), not per-user. These were the 2 grants we");
  log("     revoked earlier (RevokeIt + Google Workspace → Microsoft Graph).");
  log("");
  log("  B) APPS NOT USING MICROSOFT SSO: If Angelina logged into Slack with a");
  log("     Slack-native username/password (not 'Sign in with Microsoft'), there");
  log("     would be NO Microsoft OAuth grant. The session lives entirely within");
  log("     Slack's own auth system, NOT in Azure AD.");
  log("");
  log("  C) SSO VIA SAML, NOT OAUTH: Enterprise apps can use SAML-based SSO");
  log("     instead of OAuth. SAML sessions don't create OAuth2 permission grants.");
  log("     They would appear in sign-in logs (requires Premium) but not in grants.");
  log("");
  log("  D) THE TENANT IS NEW: If users haven't actually signed into any third-party");
  log("     apps through Microsoft SSO yet, there would be no consent records.");
  log("");
  log("TO VERIFY: Check if Angelina is using 'Sign in with Microsoft' for Slack,");
  log("or if she has a separate Slack account with its own credentials.");
  log("If she uses Microsoft SSO, the sign-in would show up in audit logs (Premium).");
  log("");
  log("WHAT revokeSignInSessions DOES:");
  log("  - Invalidates ALL Microsoft-issued refresh tokens");
  log("  - Forces re-auth on apps using Microsoft SSO (Outlook, Teams, SSO apps)");
  log("  - Does NOT affect apps where the user has a separate password (e.g. Slack");
  log("    with Slack-native credentials, Gmail, etc.)");
  log("");

  log("=".repeat(80));
  log(`Log file: ${logFile}`);
  log("=".repeat(80));
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
