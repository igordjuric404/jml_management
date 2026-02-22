/**
 * Setup Microsoft 365 test users in Frappe (EMPLOYEES ONLY).
 *
 * Frappe is only the HR source of truth for Employee records.
 * All other data (cases, artifacts, findings) lives in the JML app.
 * Access artifacts come live from Microsoft Graph API — never hardcoded.
 *
 * Steps:
 * 1. Clean up old Frappe data (findings, artifacts, cases, employees)
 * 2. Create Employee records for MS365 tenant users
 *
 * CRITICAL: Never touches Dimitrije Miljkovic's Azure AD account.
 *   He IS created as an Employee record (read-only reference), marked Active.
 *
 * Usage: npx tsx scripts/setup-ms365-users.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const FRAPPE_URL = process.env.FRAPPE_URL || process.env.NEXT_PUBLIC_FRAPPE_URL || "http://localhost:8000";
const API_KEY = process.env.FRAPPE_API_KEY;
const API_SECRET = process.env.FRAPPE_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error("FRAPPE_API_KEY and FRAPPE_API_SECRET required in .env.local");
  process.exit(1);
}

const headers = {
  Authorization: `token ${API_KEY}:${API_SECRET}`,
  "Content-Type": "application/json",
};

async function frappeGet<T>(doctype: string): Promise<T[]> {
  const res = await fetch(
    `${FRAPPE_URL}/api/resource/${encodeURIComponent(doctype)}?limit_page_length=0`,
    { headers },
  );
  if (!res.ok) throw new Error(`GET ${doctype}: ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

async function frappeDelete(doctype: string, name: string): Promise<void> {
  const res = await fetch(
    `${FRAPPE_URL}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    { method: "DELETE", headers },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE ${doctype}/${name}: ${res.status}`);
  }
}

async function frappeCreate<T>(doctype: string, data: Record<string, unknown>): Promise<T> {
  const res = await fetch(
    `${FRAPPE_URL}/api/resource/${encodeURIComponent(doctype)}`,
    { method: "POST", headers, body: JSON.stringify(data) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CREATE ${doctype}: ${res.status} — ${text}`);
  }
  const json = await res.json();
  return json.data;
}

async function deleteAll(doctype: string): Promise<void> {
  const items = await frappeGet<{ name: string }>(doctype);
  console.log(`  Deleting ${items.length} ${doctype} records...`);
  for (const item of items) {
    await frappeDelete(doctype, item.name);
  }
}

async function main() {
  console.log("=== Setup Microsoft 365 Test Users in Frappe ===");
  console.log(`Frappe: ${FRAPPE_URL}`);
  console.log("NOTE: Frappe stores ONLY Employee records.");
  console.log("      Cases, findings, artifacts → JML app (local SQLite)");
  console.log("      Access artifacts → LIVE from Microsoft Graph API\n");

  // ── Step 1: Clean up old Frappe data ──
  console.log("── Step 1: Cleaning old Frappe data ──");
  for (const dt of ["Finding", "Access Artifact", "Unified Audit Log Entry", "Offboarding Case"]) {
    try {
      await deleteAll(dt);
    } catch (err) {
      console.warn(`  WARN: Could not clean ${dt}: ${(err as Error).message}`);
    }
  }

  const existingEmployees = await frappeGet<{ name: string }>("Employee");
  console.log(`  Deleting ${existingEmployees.length} old Employee records...`);
  for (const emp of existingEmployees) {
    await frappeDelete("Employee", emp.name);
  }

  // ── Step 2: Create Employee records only ──
  console.log("\n── Step 2: Creating Employee records ──");

  const ms365Users = [
    {
      first_name: "Angelina",
      last_name: "Jolie",
      company_email: "angelinajolie@Sarmateam.onmicrosoft.com",
      status: "Active",
      date_of_joining: "2024-03-15",
      gender: "Female",
      date_of_birth: "1990-06-04",
      department: "Marketing",
      designation: "Marketing Manager",
    },
    {
      first_name: "Devid",
      last_name: "Bentley",
      company_email: "devidbentley@Sarmateam.onmicrosoft.com",
      status: "Active",
      date_of_joining: "2024-01-10",
      gender: "Male",
      date_of_birth: "1988-11-20",
      department: "Engineering",
      designation: "Software Developer",
    },
    {
      first_name: "John",
      last_name: "Wick",
      company_email: "johnwick@Sarmateam.onmicrosoft.com",
      status: "Active",
      date_of_joining: "2023-09-01",
      gender: "Male",
      date_of_birth: "1985-09-02",
      department: "Security",
      designation: "Analyst",
    },
    {
      first_name: "Dimitrije",
      last_name: "Miljkovic",
      company_email: "revokeit@Sarmateam.onmicrosoft.com",
      status: "Active",
      date_of_joining: "2023-01-01",
      gender: "Male",
      date_of_birth: "1992-03-15",
      department: "IT",
      designation: "Engineer",
    },
  ];

  for (const user of ms365Users) {
    try {
      const emp = await frappeCreate<{ name: string; employee_name: string }>("Employee", {
        naming_series: "HR-EMP-MS-",
        company: "HUB201",
        create_user_permission: 0,
        ...user,
      });
      console.log(`  Created: ${emp.name} — ${emp.employee_name} (${user.company_email}) [${user.status}]`);
    } catch (err) {
      console.error(`  ERROR: ${user.first_name} ${user.last_name}: ${(err as Error).message}`);
    }
  }

  console.log("\n=== Setup Complete ===");
  console.log("  Frappe now has 4 Employee records (all Active)");
  console.log("  No artifacts, cases, or findings in Frappe");
  console.log("  Run a system scan from the JML app to discover real Microsoft 365 artifacts");
  console.log("  → The scan queries Graph API live and stores findings in local SQLite");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
