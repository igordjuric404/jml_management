/**
 * Test the Microsoft 365 Discovery Service against live Graph API.
 * Discovers real OAuth grants and app role assignments for test users.
 *
 * Usage: npx tsx scripts/test-discovery.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { MicrosoftDiscoveryService } from "../src/lib/providers/microsoft/discovery-service";
import { MicrosoftGraphClient } from "../src/lib/providers/microsoft/graph-client";

const TENANT_ID = process.env.MICROSOFT_TENANT_ID!;
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error("Microsoft 365 credentials not configured.");
  process.exit(1);
}

const TEST_USERS = [
  "angelinajolie@Sarmateam.onmicrosoft.com",
  "devidbentley@Sarmateam.onmicrosoft.com",
  "johnwick@Sarmateam.onmicrosoft.com",
  "revokeit@Sarmateam.onmicrosoft.com",
];

const SKIP_USER = "revokeit@Sarmateam.onmicrosoft.com";

async function main() {
  console.log("=== Microsoft 365 Discovery Service — Live Test ===\n");

  const graphClient = new MicrosoftGraphClient({
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  });

  const discovery = new MicrosoftDiscoveryService(graphClient);
  console.log(`Configured: ${discovery.isConfigured}\n`);

  for (const email of TEST_USERS) {
    console.log(`\n── ${email} ──`);

    if (email === SKIP_USER) {
      console.log("  ⚠ Dimitrije — discovery only, no remediation");
    }

    try {
      const result = await discovery.discoverUserAccess(email, "test-case-001");

      if (result.error) {
        console.log(`  Error: ${result.error}`);
        continue;
      }

      console.log(`  Azure AD user: ${result.user?.displayName} (enabled: ${result.user?.accountEnabled})`);
      console.log(`  OAuth grants (raw): ${result.raw.oauthGrants.length}`);
      console.log(`  App role assignments (raw): ${result.raw.appRoleAssignments.length}`);
      console.log(`  Total artifacts: ${result.artifacts.length}`);
      console.log(`  Findings: ${result.findings.length}`);

      if (result.artifacts.length > 0) {
        console.log("  Artifacts:");
        for (const a of result.artifacts) {
          const scopes = JSON.parse(a.scopes_json || "[]");
          console.log(`    [${a.risk_level}] ${a.app_display_name} — ${scopes.join(", ")}`);
        }
      }

      if (result.findings.length > 0) {
        console.log("  Findings:");
        for (const f of result.findings) {
          console.log(`    [${f.severity}] ${f.summary}`);
        }
      }
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message}`);
    }
  }

  console.log("\n=== Discovery Test Complete ===");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
