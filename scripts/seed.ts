/**
 * Test data seeder — calls the Frappe repopulate endpoint.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 */

async function seedFrappe() {
  const frappeUrl = process.env.FRAPPE_URL || process.env.NEXT_PUBLIC_FRAPPE_URL || "http://localhost:8000";
  const apiKey = process.env.FRAPPE_API_KEY;
  const apiSecret = process.env.FRAPPE_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("FRAPPE_API_KEY and FRAPPE_API_SECRET are required.");
    console.error("Set them in .env.local or export them.");
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

seedFrappe().catch(console.error);
