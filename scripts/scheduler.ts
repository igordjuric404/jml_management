/**
 * Background job scheduler — equivalent to Frappe scheduler_events.
 *
 * Runs scheduled tasks at configured intervals:
 *   - System scan (configurable: every 15min to daily)
 *   - Remediation check (every 5min to hourly)
 *   - Daily case scan
 *   - Notification reminders
 *
 * Usage:
 *   npx tsx scripts/scheduler.ts          # Run scheduler loop
 *   npx tsx scripts/scheduler.ts --once   # Run all tasks once and exit
 */

import { getProvider } from "../src/lib/providers";
import { sendFindingAlert } from "../src/lib/email";

const INTERVAL_MS: Record<string, number> = {
  "Every 5 Minutes": 5 * 60 * 1000,
  "Every 15 Minutes": 15 * 60 * 1000,
  "Every 30 Minutes": 30 * 60 * 1000,
  "Every Hour": 60 * 60 * 1000,
  "Every 6 Hours": 6 * 60 * 60 * 1000,
  Daily: 24 * 60 * 60 * 1000,
};

const lastRun: Record<string, number> = {};

function shouldRun(taskKey: string, intervalMs: number): boolean {
  const now = Date.now();
  const last = lastRun[taskKey] || 0;
  if (now - last >= intervalMs) {
    lastRun[taskKey] = now;
    return true;
  }
  return false;
}

async function runBackgroundScan() {
  const provider = getProvider();
  const settings = await provider.getSettings();

  if (!settings.background_scan_enabled) return;

  const interval = INTERVAL_MS[settings.background_scan_interval] || INTERVAL_MS["Every Hour"];

  if (shouldRun("background_scan", interval)) {
    console.log(`[${new Date().toISOString()}] Running background system scan...`);
    try {
      const result = await provider.systemScan();
      console.log(`  Result: ${result.message}`);
    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  }
}

async function checkScheduledRemediations() {
  const provider = getProvider();
  const settings = await provider.getSettings();
  const interval = INTERVAL_MS[settings.remediation_check_interval] || INTERVAL_MS["Every 5 Minutes"];

  if (shouldRun("remediation_check", interval)) {
    console.log(`[${new Date().toISOString()}] Checking scheduled remediations...`);
    try {
      const cases = await provider.listCases();
      const now = new Date();

      for (const c of cases) {
        if (c.status !== "Scheduled" || !c.scheduled_remediation_date) continue;
        const scheduledDate = new Date(c.scheduled_remediation_date);
        if (scheduledDate <= now) {
          console.log(`  Executing scheduled remediation for ${c.name} (${c.primary_email})...`);
          await provider.executeRemediation(c.name, "full_bundle");
          console.log(`  ${c.name} remediated.`);
        }
      }
    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  }
}

async function dailyScanPendingCases() {
  if (!shouldRun("daily_scan", 24 * 60 * 60 * 1000)) return;

  const provider = getProvider();
  console.log(`[${new Date().toISOString()}] Running daily scan of pending cases...`);

  try {
    const cases = await provider.listCases();
    const pending = cases.filter(c => ["Draft", "Scheduled"].includes(c.status));

    for (const c of pending) {
      console.log(`  Scanning ${c.name}...`);
      await provider.triggerScan(c.name);
    }
    console.log(`  Scanned ${pending.length} pending case(s).`);
  } catch (error) {
    console.error(`  Error: ${error}`);
  }
}

async function sendNotifications() {
  if (!shouldRun("notifications", 24 * 60 * 60 * 1000)) return;

  const provider = getProvider();
  const settings = await provider.getSettings();

  if (!settings.notify_on_new_findings && !settings.notify_on_remediation) return;

  console.log(`[${new Date().toISOString()}] Checking notification triggers...`);

  try {
    const cases = await provider.listCases();
    const now = new Date();

    for (const c of cases) {
      if (c.status !== "Scheduled" || !c.scheduled_remediation_date) continue;

      const scheduled = new Date(c.scheduled_remediation_date);
      const daysUntil = (scheduled.getTime() - now.getTime()) / (86400 * 1000);

      if (daysUntil <= 7 && daysUntil > 6 && !c.notify_user_1w) {
        console.log(`  [7-day reminder] ${c.name}: ${c.primary_email}`);
        if (settings.notification_email) {
          await sendFindingAlert({
            findingName: `${c.name}-7d-reminder`,
            severity: "High",
            findingType: "ScheduledRemediation",
            summary: `Scheduled remediation for ${c.employee_name} (${c.primary_email}) is due in 7 days.`,
            caseName: c.name,
            employeeEmail: c.primary_email,
          }, settings.notification_email).catch(err => console.error(`    Email error: ${err}`));
        }
      }

      if (daysUntil <= 1 && daysUntil > 0 && !c.notify_user_1d) {
        console.log(`  [1-day reminder] ${c.name}: ${c.primary_email}`);
        if (settings.notification_email) {
          await sendFindingAlert({
            findingName: `${c.name}-1d-reminder`,
            severity: "Critical",
            findingType: "ScheduledRemediation",
            summary: `Scheduled remediation for ${c.employee_name} (${c.primary_email}) is due tomorrow!`,
            caseName: c.name,
            employeeEmail: c.primary_email,
          }, settings.notification_email).catch(err => console.error(`    Email error: ${err}`));
        }
      }
    }
  } catch (error) {
    console.error(`  Error: ${error}`);
  }
}

async function runOnce() {
  console.log("Running all scheduled tasks once...\n");
  lastRun["background_scan"] = 0;
  lastRun["remediation_check"] = 0;
  lastRun["daily_scan"] = 0;
  lastRun["notifications"] = 0;

  await runBackgroundScan();
  await checkScheduledRemediations();
  await dailyScanPendingCases();
  await sendNotifications();

  console.log("\nDone.");
}

async function runLoop() {
  console.log("Starting JML scheduler...");
  console.log("Tasks: background_scan, remediation_check, daily_scan, notifications");
  console.log("Press Ctrl+C to stop.\n");

  const tick = async () => {
    await runBackgroundScan();
    await checkScheduledRemediations();
    await dailyScanPendingCases();
    await sendNotifications();
  };

  await tick();

  setInterval(tick, 60 * 1000);
}

const args = process.argv.slice(2);
if (args.includes("--once")) {
  runOnce().catch(console.error);
} else {
  runLoop().catch(console.error);
}
