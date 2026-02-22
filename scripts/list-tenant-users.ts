/**
 * List all users in the Microsoft 365 tenant to find correct UPNs.
 *
 * Usage: npx tsx scripts/list-tenant-users.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { MicrosoftGraphClient } from "../src/lib/providers/microsoft/graph-client";

async function main() {
  const graphClient = new MicrosoftGraphClient({
    tenantId: process.env.MICROSOFT_TENANT_ID!,
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  });

  console.log("=== All Azure AD Users ===\n");
  const users = await graphClient.listUsers();

  for (const user of users) {
    console.log(`  ${user.displayName}`);
    console.log(`    UPN: ${user.userPrincipalName}`);
    console.log(`    Mail: ${user.mail || "(none)"}`);
    console.log(`    Enabled: ${user.accountEnabled}`);
    console.log(`    Department: ${user.department || "(none)"}`);
    console.log("");
  }

  console.log(`Total: ${users.length} users`);
}

main().catch(console.error);
