/**
 * Check Microsoft 365 app activity using usage reports and mailbox probes.
 * These APIs detect first-party app usage that doesn't appear in OAuth grants.
 *
 * Usage: npx tsx scripts/check-m365-activity.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

const credential = new ClientSecretCredential(
  process.env.MICROSOFT_TENANT_ID!,
  process.env.MICROSOFT_CLIENT_ID!,
  process.env.MICROSOFT_CLIENT_SECRET!,
);
const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["https://graph.microsoft.com/.default"],
});
const graphClient = Client.initWithMiddleware({ authProvider });

const USERS = [
  { name: "Angelina Jolie", upn: "angelinajolie@Sarmateam.onmicrosoft.com" },
  { name: "Devid Bentley", upn: "devidbentley@Sarmateam.onmicrosoft.com" },
  { name: "John Wick", upn: "johnwick@Sarmateam.onmicrosoft.com" },
  { name: "Dimitrije Miljkovic", upn: "revokeit@Sarmateam.onmicrosoft.com" },
];

async function checkMailbox(upn: string): Promise<string> {
  try {
    const messages = await graphClient
      .api(`/users/${upn}/messages`)
      .top(5)
      .select("subject,receivedDateTime,from")
      .orderby("receivedDateTime desc")
      .get();
    const msgs = messages.value || [];
    if (msgs.length === 0) return "Mailbox exists but empty";
    return `${msgs.length} recent message(s), latest: "${msgs[0].subject}" (${msgs[0].receivedDateTime})`;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("MailboxNotEnabledForRESTAPI")) return "Mailbox not enabled for REST";
    if (msg.includes("ResourceNotFound")) return "No mailbox";
    return `Error: ${msg.slice(0, 100)}`;
  }
}

async function checkOneDrive(upn: string): Promise<string> {
  try {
    const drive = await graphClient.api(`/users/${upn}/drive`).select("id,quota").get();
    const used = drive?.quota?.used || 0;
    const total = drive?.quota?.total || 0;
    return `Drive exists (${(used / 1024 / 1024).toFixed(1)} MB used of ${(total / 1024 / 1024 / 1024).toFixed(1)} GB)`;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("ResourceNotFound")) return "No OneDrive provisioned";
    return `Error: ${msg.slice(0, 100)}`;
  }
}

async function checkTeamsPresence(upn: string): Promise<string> {
  try {
    const user = await graphClient.api(`/users/${upn}`).select("id").get();
    const presence = await graphClient.api(`/users/${user.id}/presence`).get();
    return `Presence: ${presence.availability} (${presence.activity})`;
  } catch (err) {
    return `Cannot check: ${(err as Error).message.slice(0, 80)}`;
  }
}

async function checkCalendar(upn: string): Promise<string> {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const events = await graphClient
      .api(`/users/${upn}/calendarView`)
      .query({
        startDateTime: weekAgo.toISOString(),
        endDateTime: now.toISOString(),
      })
      .top(5)
      .select("subject,start,end")
      .get();
    const evts = events.value || [];
    if (evts.length === 0) return "No calendar events in last 7 days";
    return `${evts.length} event(s), latest: "${evts[0].subject}"`;
  } catch (err) {
    return `Error: ${(err as Error).message.slice(0, 80)}`;
  }
}

async function checkUsageReports(): Promise<void> {
  console.log("\n── USAGE REPORTS (last 7 days) ──\n");

  const reports = [
    { name: "Email Activity", endpoint: "/reports/getEmailActivityUserDetail(period='D7')" },
    { name: "Teams Activity", endpoint: "/reports/getTeamsUserActivityUserDetail(period='D7')" },
    { name: "SharePoint Activity", endpoint: "/reports/getSharePointActivityUserDetail(period='D7')" },
    { name: "OneDrive Activity", endpoint: "/reports/getOneDriveActivityUserDetail(period='D7')" },
    { name: "Active Users", endpoint: "/reports/getOffice365ActiveUserDetail(period='D7')" },
  ];

  for (const report of reports) {
    console.log(`  ${report.name}:`);
    try {
      const response = await graphClient.api(report.endpoint).get();
      const text = typeof response === "string" ? response : JSON.stringify(response);
      const lines = text.split("\n").filter((l: string) => l.trim());
      if (lines.length <= 1) {
        console.log("    → No activity data");
      } else {
        for (const line of lines.slice(0, 10)) {
          console.log(`    ${line.slice(0, 200)}`);
        }
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("Reports.Read.All")) {
        console.log("    → Missing Reports.Read.All permission");
      } else {
        console.log(`    → Error: ${msg.slice(0, 150)}`);
      }
    }
    console.log("");
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  M365 APP ACTIVITY CHECK — DETECT FIRST-PARTY APP USAGE");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const user of USERS) {
    console.log(`── ${user.name} (${user.upn}) ──\n`);

    const [mailbox, onedrive, calendar, teams] = await Promise.all([
      checkMailbox(user.upn),
      checkOneDrive(user.upn),
      checkCalendar(user.upn),
      checkTeamsPresence(user.upn),
    ]);

    console.log(`  Outlook (Mailbox): ${mailbox}`);
    console.log(`  OneDrive/SharePoint: ${onedrive}`);
    console.log(`  Calendar: ${calendar}`);
    console.log(`  Teams: ${teams}`);
    console.log("");
  }

  await checkUsageReports();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
