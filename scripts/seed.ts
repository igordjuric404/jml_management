/**
 * Test data seeder — equivalent to repopulate.py from the Frappe app.
 *
 * This script resets the mock data to its initial state. When running
 * against a live Frappe instance, it calls the repopulate endpoint.
 *
 * Usage:
 *   npx tsx scripts/seed.ts           # Reset mock data
 *   npx tsx scripts/seed.ts --frappe   # Repopulate via Frappe API
 */

import { resetMockData } from "../src/lib/providers/frappe/mock-provider";

async function seedMock() {
  console.log("Resetting mock data to initial state...");
  resetMockData();
  console.log("Mock data reset complete.");
  console.log("  - 18 employees (10 offboarded + 8 active)");
  console.log("  - 10 offboarding cases (scenarios A-J)");
  console.log("  - 25 access artifacts (including hidden + revoked)");
  console.log("  - 16 findings (including 1 closed)");
  console.log("  - 8 audit log entries");
  console.log("  - OGM settings initialized");
}

async function seedFrappe() {
  const frappeUrl = process.env.FRAPPE_URL || "http://localhost:8000";
  const apiKey = process.env.FRAPPE_API_KEY;
  const apiSecret = process.env.FRAPPE_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("FRAPPE_API_KEY and FRAPPE_API_SECRET are required for Frappe seeding.");
    console.error("Set them in .env.local or export them as environment variables.");
    process.exit(1);
  }

  console.log(`Repopulating test data on Frappe at ${frappeUrl}...`);

  const res = await fetch(`${frappeUrl}/api/method/oauth_gap_monitor.repopulate.run`, {
    method: "POST",
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.error(`Frappe repopulate failed: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  console.log("Frappe repopulate complete.");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--frappe")) {
    await seedFrappe();
  } else {
    await seedMock();
  }
}

main().catch(console.error);
