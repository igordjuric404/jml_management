/**
 * Live validation script for Microsoft Graph API connectivity.
 *
 * Usage: npx tsx scripts/validate-microsoft.ts
 *
 * Tests real connectivity against Azure AD and reports:
 * 1. Credential authentication (client credentials flow)
 * 2. User listing
 * 3. OAuth2 permission grants
 * 4. Sign-in log access
 * 5. Service principals
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

const tenantId = process.env.MICROSOFT_TENANT_ID!;
const clientId = process.env.MICROSOFT_CLIENT_ID!;
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;

if (!tenantId || !clientId || !clientSecret) {
  console.error("ERROR: Missing MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, or MICROSOFT_CLIENT_SECRET in .env.local");
  process.exit(1);
}

console.log("=== Microsoft Graph API Live Validation ===\n");
console.log(`Tenant: ${tenantId.slice(0, 8)}...`);
console.log(`Client: ${clientId.slice(0, 8)}...`);
console.log(`Secret: ${clientSecret.slice(0, 4)}...[${clientSecret.length} chars]`);
console.log("");

let passed = 0;
let failed = 0;

async function main() {
  console.log("[1/5] Authenticating with Azure AD (client credentials)...");
  let graphClient: Client;
  try {
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ["https://graph.microsoft.com/.default"],
    });
    graphClient = Client.initWithMiddleware({ authProvider });

    const me = await graphClient.api("/organization").select("id,displayName").get();
    const org = me.value?.[0];
    console.log(`  ✓ Authenticated to: ${org?.displayName || "Unknown"} (${org?.id?.slice(0, 8)}...)`);
    passed++;
    console.log("");
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    console.error(`  ✗ Authentication FAILED: ${msg.slice(0, 200)}`);
    failed++;

    if (msg.includes("AADSTS7000215")) {
      console.error("\n  ⚠  You provided the Secret ID, not the Secret Value.");
      console.error("  Go to Azure Portal → App registrations → Certificates & secrets");
      console.error("  → Create a new client secret → Copy the VALUE (not the ID).");
    }
    console.log("\n=== Cannot continue without valid credentials ===");
    process.exit(1);
  }

  console.log("[2/5] Listing tenant users...");
  try {
    const users = await graphClient!
      .api("/users")
      .select("id,displayName,userPrincipalName,mail,accountEnabled")
      .top(50)
      .get();
    const userList = users.value || [];
    console.log(`  ✓ Found ${userList.length} users:`);
    for (const u of userList) {
      const status = u.accountEnabled ? "Enabled" : "Disabled";
      console.log(`    - ${u.displayName} (${u.userPrincipalName}) [${status}]`);
    }
    passed++;
    console.log("");
  } catch (err: unknown) {
    console.error(`  ✗ User listing FAILED: ${(err as Error).message?.slice(0, 150)}`);
    console.log("    Required permission: User.Read.All (Application)");
    failed++;
    console.log("");
  }

  console.log("[3/5] Listing OAuth2 permission grants...");
  try {
    const grants = await graphClient!
      .api("/oauth2PermissionGrants")
      .top(20)
      .get();
    const grantList = grants.value || [];
    console.log(`  ✓ Found ${grantList.length} OAuth2 permission grants`);
    for (const g of grantList.slice(0, 5)) {
      console.log(`    - Grant ${g.id?.slice(0, 12)}... → scope: "${(g.scope || "").substring(0, 50)}"`);
    }
    passed++;
    console.log("");
  } catch (err: unknown) {
    console.error(`  ✗ OAuth2 grants listing FAILED: ${(err as Error).message?.slice(0, 150)}`);
    console.log("    Required permission: DelegatedPermissionGrant.ReadWrite.All (Application)");
    failed++;
    console.log("");
  }

  console.log("[4/5] Testing audit log access (sign-ins)...");
  try {
    const signIns = await graphClient!
      .api("/auditLogs/signIns")
      .top(5)
      .get();
    const signInList = signIns.value || [];
    console.log(`  ✓ Found ${signInList.length} recent sign-in entries`);
    for (const s of signInList) {
      console.log(`    - ${s.userDisplayName || "?"} via ${s.appDisplayName || "?"} at ${s.createdDateTime}`);
    }
    passed++;
    console.log("");
  } catch (err: unknown) {
    console.error(`  ✗ Sign-in log access FAILED: ${(err as Error).message?.slice(0, 150)}`);
    console.log("    Required permission: AuditLog.Read.All (Application)");
    failed++;
    console.log("");
  }

  console.log("[5/5] Listing service principals...");
  try {
    const sps = await graphClient!
      .api("/servicePrincipals")
      .select("id,appId,displayName")
      .top(10)
      .get();
    const spList = sps.value || [];
    console.log(`  ✓ Found ${spList.length} service principals`);
    for (const sp of spList.slice(0, 3)) {
      console.log(`    - ${sp.displayName}`);
    }
    passed++;
    console.log("");
  } catch (err: unknown) {
    console.error(`  ✗ Service principal listing FAILED: ${(err as Error).message?.slice(0, 150)}`);
    console.log("    Required permission: Application.Read.All (Application)");
    failed++;
    console.log("");
  }

  console.log("=== Results ===");
  console.log(`  Passed: ${passed}/5`);
  console.log(`  Failed: ${failed}/5`);
  if (failed === 0) {
    console.log("\n  ✓ All checks passed — Microsoft 365 integration is ready for production!");
  } else {
    console.log("\n  ⚠  Some checks failed. Grant missing API permissions in Azure Portal:");
    console.log("  App registrations → Your app → API permissions → Add → Microsoft Graph → Application");
    console.log("  Then click 'Grant admin consent for [org]'");
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
