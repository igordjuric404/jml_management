/**
 * Investigate why Outlook/Teams/SharePoint/Copilot logins don't appear as grants.
 *
 * Checks:
 * 1. Sign-in logs for each user (proof they actually signed in)
 * 2. Service principals for the specific apps
 * 3. ALL OAuth2PermissionGrants in the tenant (not just per-user)
 * 4. Per-user oauth2PermissionGrants with expanded details
 * 5. App role assignments
 * 6. Registered devices / managed devices
 * 7. Direct Graph API raw responses (no abstraction layer)
 *
 * Usage: npx tsx scripts/investigate-missing-grants.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

const TENANT_ID = process.env.MICROSOFT_TENANT_ID!;
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;

const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["https://graph.microsoft.com/.default"],
});
const graphClient = Client.initWithMiddleware({ authProvider });

const USERS = [
  { name: "Angelina Jolie", upn: "angelinajolie@Sarmateam.onmicrosoft.com", apps: "Outlook, Teams" },
  { name: "John Wick", upn: "johnwick@Sarmateam.onmicrosoft.com", apps: "SharePoint" },
  { name: "Devid Bentley", upn: "devidbentley@Sarmateam.onmicrosoft.com", apps: "Copilot" },
];

const FIRST_PARTY_APP_IDS: Record<string, string> = {
  "Microsoft Teams": "1fec8e78-bce4-4aaf-ab1b-5451cc387264",
  "Microsoft Teams Web Client": "5e3ce6c0-2b1f-4285-8d4b-75ee78787346",
  "Microsoft Outlook": "d3590ed6-52b3-4102-aeff-aad2292ab01c",
  "Outlook Mobile": "27922004-5251-4030-b22d-91ecd9a37ea4",
  "Office 365 Exchange Online": "00000002-0000-0ff1-ce00-000000000000",
  "Office 365 SharePoint Online": "00000003-0000-0ff1-ce00-000000000000",
  "Microsoft Office": "d3590ed6-52b3-4102-aeff-aad2292ab01c",
  "Microsoft 365 Copilot": "fb8d773d-7ef4-4c62-924a-96a410483b50",
  "Microsoft Copilot": "b94bb246-b02d-4894-84b5-8e28e2e4baec",
};

async function collectPages<T>(request: ReturnType<typeof graphClient.api>): Promise<T[]> {
  const items: T[] = [];
  let response = await request.get();
  if (Array.isArray(response?.value)) items.push(...response.value);
  while (response?.["@odata.nextLink"]) {
    response = await graphClient.api(response["@odata.nextLink"]).get();
    if (Array.isArray(response?.value)) items.push(...response.value);
  }
  return items;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  INVESTIGATING MISSING GRANTS — WHY SIGN-INS DON'T SHOW AS GRANTS");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // ── 1. Check sign-in logs ──
  console.log("── 1. SIGN-IN LOGS (last 7 days) ──\n");
  for (const user of USERS) {
    console.log(`  ${user.name} (${user.upn}) — expected: ${user.apps}`);
    try {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const signIns = await collectPages<Record<string, unknown>>(
        graphClient
          .api("/auditLogs/signIns")
          .filter(`userPrincipalName eq '${user.upn}' and createdDateTime ge ${since}`)
          .top(50)
          .orderby("createdDateTime desc")
      );

      if (signIns.length === 0) {
        console.log("    → NO sign-in records found in the last 7 days");
        console.log("    → This means the user either hasn't signed in, or");
        console.log("      AuditLog.Read.All permission is missing / Azure AD P1 license needed");
      } else {
        console.log(`    → Found ${signIns.length} sign-in record(s):`);
        for (const s of signIns.slice(0, 10)) {
          const status = s.status as Record<string, unknown>;
          console.log(`      ${s.createdDateTime} | ${s.appDisplayName} | ${s.clientAppUsed || "N/A"} | Error: ${status?.errorCode || 0} ${status?.failureReason || "Success"}`);
        }
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("AuditLog") || msg.includes("Premium") || msg.includes("license")) {
        console.log("    → CANNOT read sign-in logs: requires Azure AD Premium P1 license");
      } else {
        console.log(`    → ERROR reading sign-in logs: ${msg}`);
      }
    }
    console.log("");
  }

  // ── 2. ALL tenant OAuth2PermissionGrants (raw dump) ──
  console.log("\n── 2. ALL OAUTH2 PERMISSION GRANTS IN TENANT (raw) ──\n");
  try {
    const allGrants = await collectPages<Record<string, unknown>>(
      graphClient.api("/oauth2PermissionGrants").top(999)
    );

    if (allGrants.length === 0) {
      console.log("  → ZERO grants in the entire tenant");
      console.log("  → This confirms: no user has consented to any app individually");
      console.log("  → And no admin has granted tenant-wide consent for any app");
    } else {
      console.log(`  → ${allGrants.length} grant(s) found:`);
      for (const g of allGrants) {
        console.log(`    Grant: ${g.id}`);
        console.log(`      clientId:    ${g.clientId}`);
        console.log(`      consentType: ${g.consentType}`);
        console.log(`      principalId: ${g.principalId || "(tenant-wide)"}`);
        console.log(`      scope:       "${g.scope}"`);
      }
    }
  } catch (err) {
    console.log(`  → ERROR: ${(err as Error).message}`);
  }

  // ── 3. Per-user OAuth2 grants with full details ──
  console.log("\n── 3. PER-USER OAUTH2 GRANTS (detailed) ──\n");
  for (const user of USERS) {
    console.log(`  ${user.name}:`);
    try {
      const u = await graphClient.api(`/users/${user.upn}`).select("id").get();
      const userId = u.id;

      const grants = await collectPages<Record<string, unknown>>(
        graphClient.api(`/users/${userId}/oauth2PermissionGrants`)
      );
      console.log(`    oauth2PermissionGrants: ${grants.length}`);
      for (const g of grants) {
        console.log(`      ${JSON.stringify(g)}`);
      }

      const roles = await collectPages<Record<string, unknown>>(
        graphClient.api(`/users/${userId}/appRoleAssignments`)
      );
      console.log(`    appRoleAssignments: ${roles.length}`);
      for (const r of roles) {
        console.log(`      ${r.resourceDisplayName} (${r.resourceId}) role=${r.appRoleId}`);
      }
    } catch (err) {
      console.log(`    ERROR: ${(err as Error).message}`);
    }
    console.log("");
  }

  // ── 4. Check service principals for the expected apps ──
  console.log("\n── 4. SERVICE PRINCIPALS FOR EXPECTED APPS ──\n");
  for (const [appName, appId] of Object.entries(FIRST_PARTY_APP_IDS)) {
    try {
      const result = await graphClient
        .api("/servicePrincipals")
        .filter(`appId eq '${appId}'`)
        .select("id,appId,displayName,servicePrincipalType,accountEnabled")
        .top(1)
        .get();

      const sp = result.value?.[0];
      if (sp) {
        console.log(`  ✓ ${appName} (appId: ${appId})`);
        console.log(`    SP ObjectId: ${sp.id}, Type: ${sp.servicePrincipalType}, Enabled: ${sp.accountEnabled}`);
      } else {
        console.log(`  ✗ ${appName} (appId: ${appId}) — NOT registered in tenant`);
      }
    } catch (err) {
      console.log(`  ? ${appName} — ERROR: ${(err as Error).message}`);
    }
  }

  // ── 5. Check mailbox existence (Exchange Online) ──
  console.log("\n\n── 5. MAILBOX / LICENSE CHECK ──\n");
  for (const user of USERS) {
    console.log(`  ${user.name}:`);
    try {
      const licenseDetail = await graphClient
        .api(`/users/${user.upn}/licenseDetails`)
        .get();

      const licenses = licenseDetail.value || [];
      if (licenses.length === 0) {
        console.log("    → NO licenses assigned");
        console.log("    → Without a Microsoft 365 license, the user CANNOT access");
        console.log("      Outlook, Teams, SharePoint, or Copilot");
      } else {
        console.log(`    → ${licenses.length} license(s):`);
        for (const lic of licenses) {
          console.log(`      ${lic.skuPartNumber} (${lic.skuId})`);
          const enabledPlans = (lic.servicePlans || [])
            .filter((p: Record<string, string>) => p.provisioningStatus === "Success")
            .map((p: Record<string, string>) => p.servicePlanName);
          if (enabledPlans.length > 0) {
            console.log(`        Enabled plans: ${enabledPlans.join(", ")}`);
          }
        }
      }
    } catch (err) {
      console.log(`    → ERROR: ${(err as Error).message}`);
    }
    console.log("");
  }

  // ── Analysis ──
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  ROOT CAUSE ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════════════\n");
  console.log("Microsoft first-party apps (Outlook, Teams, SharePoint, Copilot)");
  console.log("behave differently from third-party apps regarding OAuth grants:\n");
  console.log("1. First-party M365 apps use IMPLICIT pre-consented access.");
  console.log("   When a user signs into Teams or Outlook with their org account,");
  console.log("   Microsoft does NOT create an OAuth2PermissionGrant record.");
  console.log("   The access is governed by the user's M365 license, not OAuth consent.\n");
  console.log("2. OAuth2PermissionGrants only appear for THIRD-PARTY apps that use");
  console.log("   delegated permissions and require explicit user consent.\n");
  console.log("3. To detect first-party app usage, you need:");
  console.log("   a) Sign-in logs (requires Azure AD Premium P1)");
  console.log("   b) Microsoft 365 usage reports (mailboxActivity, teamsActivity)");
  console.log("   c) Mail/Calendar/Drive API calls to check if data exists\n");
  console.log("4. App Role Assignments only exist when users are EXPLICITLY");
  console.log("   assigned to enterprise apps in Azure Portal > Enterprise Apps.\n");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
