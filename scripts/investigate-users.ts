/**
 * Deep investigation of all tenant users.
 * Queries Microsoft Graph API directly for:
 * - User account status
 * - OAuth2 permission grants (delegated)
 * - App role assignments (application)
 * - Tenant-wide OAuth2 grants (AllPrincipals)
 * - Service principal resolution
 *
 * Usage: npx tsx scripts/investigate-users.ts
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
const client = Client.initWithMiddleware({ authProvider });

async function collectPages<T>(request: ReturnType<typeof client.api>): Promise<T[]> {
  const items: T[] = [];
  let response = await request.get();
  if (Array.isArray(response?.value)) items.push(...response.value);
  while (response?.["@odata.nextLink"]) {
    response = await client.api(response["@odata.nextLink"]).get();
    if (Array.isArray(response?.value)) items.push(...response.value);
  }
  return items;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  MICROSOFT 365 USER INVESTIGATION — DIRECT GRAPH API QUERIES");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ── 1. List ALL users ──
  console.log("── 1. ALL USERS IN TENANT ──\n");
  const users = await collectPages<Record<string, unknown>>(
    client.api("/users").select("id,displayName,userPrincipalName,mail,accountEnabled,createdDateTime,department,jobTitle")
  );

  for (const u of users) {
    console.log(`  ${u.displayName}`);
    console.log(`    ID:      ${u.id}`);
    console.log(`    UPN:     ${u.userPrincipalName}`);
    console.log(`    Mail:    ${u.mail || "(none)"}`);
    console.log(`    Enabled: ${u.accountEnabled}`);
    console.log(`    Created: ${u.createdDateTime}`);
    console.log("");
  }

  // ── 2. Per-user OAuth2 grants ──
  console.log("\n── 2. PER-USER OAUTH2 PERMISSION GRANTS ──\n");
  for (const u of users) {
    const upn = u.userPrincipalName as string;
    const userId = u.id as string;

    console.log(`  ${u.displayName} (${upn}):`);
    try {
      const grants = await collectPages<Record<string, unknown>>(
        client.api(`/users/${userId}/oauth2PermissionGrants`)
      );

      if (grants.length === 0) {
        console.log("    → No per-user OAuth2 permission grants found");
      } else {
        for (const g of grants) {
          console.log(`    Grant ID: ${g.id}`);
          console.log(`      ClientId (SP): ${g.clientId}`);
          console.log(`      ResourceId:    ${g.resourceId}`);
          console.log(`      ConsentType:   ${g.consentType}`);
          console.log(`      Scope:         "${g.scope}"`);
          console.log(`      PrincipalId:   ${g.principalId}`);
        }
      }
    } catch (err) {
      console.log(`    → ERROR: ${(err as Error).message}`);
    }
    console.log("");
  }

  // ── 3. Per-user App Role Assignments ──
  console.log("\n── 3. PER-USER APP ROLE ASSIGNMENTS ──\n");
  for (const u of users) {
    const upn = u.userPrincipalName as string;
    const userId = u.id as string;

    console.log(`  ${u.displayName} (${upn}):`);
    try {
      const roles = await collectPages<Record<string, unknown>>(
        client.api(`/users/${userId}/appRoleAssignments`)
      );

      if (roles.length === 0) {
        console.log("    → No app role assignments found");
      } else {
        for (const r of roles) {
          console.log(`    Assignment ID: ${r.id}`);
          console.log(`      ResourceDisplayName: ${r.resourceDisplayName}`);
          console.log(`      ResourceId:          ${r.resourceId}`);
          console.log(`      AppRoleId:           ${r.appRoleId}`);
          console.log(`      CreatedDateTime:     ${r.createdDateTime}`);
        }
      }
    } catch (err) {
      console.log(`    → ERROR: ${(err as Error).message}`);
    }
    console.log("");
  }

  // ── 4. Tenant-wide OAuth2 grants (AllPrincipals) ──
  console.log("\n── 4. TENANT-WIDE OAUTH2 PERMISSION GRANTS (AllPrincipals) ──\n");
  try {
    const tenantGrants = await collectPages<Record<string, unknown>>(
      client.api("/oauth2PermissionGrants")
    );

    if (tenantGrants.length === 0) {
      console.log("  → No tenant-wide OAuth2 permission grants found");
    } else {
      for (const g of tenantGrants) {
        console.log(`  Grant ID:    ${g.id}`);
        console.log(`    ClientId:    ${g.clientId}`);
        console.log(`    ResourceId:  ${g.resourceId}`);
        console.log(`    ConsentType: ${g.consentType}`);
        console.log(`    PrincipalId: ${g.principalId || "(tenant-wide)"}`);
        console.log(`    Scope:       "${g.scope}"`);
        console.log("");
      }
    }
  } catch (err) {
    console.log(`  → ERROR: ${(err as Error).message}`);
  }

  // ── 5. Service Principals (Enterprise Apps) ──
  console.log("\n── 5. SERVICE PRINCIPALS (ENTERPRISE APPS) ──\n");
  try {
    const sps = await collectPages<Record<string, unknown>>(
      client.api("/servicePrincipals")
        .select("id,appId,displayName,servicePrincipalType,accountEnabled")
        .top(100)
    );

    for (const sp of sps) {
      console.log(`  ${sp.displayName}`);
      console.log(`    ObjectId: ${sp.id}`);
      console.log(`    AppId:    ${sp.appId}`);
      console.log(`    Type:     ${sp.servicePrincipalType}`);
      console.log(`    Enabled:  ${sp.accountEnabled}`);
      console.log("");
    }

    console.log(`  Total service principals: ${sps.length}`);
  } catch (err) {
    console.log(`  → ERROR: ${(err as Error).message}`);
  }

  // ── 6. Summary and analysis ──
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log("Why test users may have no OAuth grants:");
  console.log("  1. OAuth2PermissionGrants are CONSENT records — they only exist");
  console.log("     when a user explicitly consents to an app's delegated permissions.");
  console.log("  2. Being 'logged into' an app via SSO does NOT create a per-user");
  console.log("     OAuth2PermissionGrant if the admin already granted tenant-wide");
  console.log("     consent (AllPrincipals grants).");
  console.log("  3. App Role Assignments are different from OAuth grants.");
  console.log("     They represent enterprise app assignments, not delegated consent.");
  console.log("  4. If users only sign into apps via Azure AD SSO but never grant");
  console.log("     individual consent, their per-user oauth2PermissionGrants will be empty.");
  console.log("  5. To create per-user grants, users must:");
  console.log("     a) Access an app that requires delegated permissions, AND");
  console.log("     b) Explicitly consent (the 'accept permissions' popup)");
  console.log("     c) OR admin consent must be done on behalf of specific users");
  console.log("");
  console.log("What the discovery service picks up for Dimitrije:");
  console.log("  - App Role Assignments (not OAuth grants). These are REAL — they");
  console.log("    exist because Dimitrije was assigned to enterprise apps (RevokeIt,");
  console.log("    Google Workspace) in Azure AD.");
  console.log("  - These are NOT mocked. They come from /users/{id}/appRoleAssignments");
  console.log("    which is a live Graph API call.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
