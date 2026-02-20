/**
 * Email notification utility using Resend.
 * Sends alerts when high/critical findings are discovered.
 */

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDER_EMAIL = process.env.NOTIFICATION_SENDER_EMAIL || "onboarding@resend.dev";
const DEFAULT_RECIPIENT = process.env.NOTIFICATION_RECIPIENT_EMAIL || "igordjuric404@gmail.com";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!RESEND_API_KEY) {
    console.log("[email] RESEND_API_KEY not set, email disabled");
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

export interface FindingAlert {
  findingName: string;
  severity: string;
  findingType: string;
  summary: string;
  caseName: string;
  employeeEmail: string;
}

export async function sendFindingAlert(
  alert: FindingAlert,
  recipientEmail?: string
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email] Would send alert for ${alert.findingName} (${alert.severity}) to ${recipientEmail || DEFAULT_RECIPIENT}`);
    return false;
  }

  const to = recipientEmail || DEFAULT_RECIPIENT;
  const severityEmoji = alert.severity === "Critical" ? "🔴" : "🟠";

  try {
    const { error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to: [to],
      subject: `${severityEmoji} [OGM] ${alert.severity} Finding: ${alert.findingType} — ${alert.findingName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${alert.severity === "Critical" ? "#dc2626" : "#ea580c"}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">${alert.severity} Security Finding Detected</h2>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 140px;">Finding</td>
                <td style="padding: 8px 0; font-weight: 600;">${alert.findingName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Type</td>
                <td style="padding: 8px 0;">${alert.findingType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Severity</td>
                <td style="padding: 8px 0;">
                  <span style="background: ${alert.severity === "Critical" ? "#dc2626" : "#ea580c"}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                    ${alert.severity}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Case</td>
                <td style="padding: 8px 0;">${alert.caseName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Employee</td>
                <td style="padding: 8px 0;">${alert.employeeEmail}</td>
              </tr>
            </table>
            <div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 6px;">
              <p style="margin: 0; font-size: 14px; color: #374151;">${alert.summary}</p>
            </div>
            <p style="margin-top: 16px; font-size: 13px; color: #9ca3af;">
              This is an automated notification from the OAuth Gap Monitor (OGM).
              Review and remediate this finding in the JML Management dashboard.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error(`[email] Failed to send alert: ${error.message}`);
      return false;
    }

    console.log(`[email] Alert sent for ${alert.findingName} to ${to}`);
    return true;
  } catch (err) {
    console.error(`[email] Error sending alert:`, err);
    return false;
  }
}

export async function sendBatchFindingAlerts(
  alerts: FindingAlert[],
  recipientEmail?: string
): Promise<number> {
  let sent = 0;
  for (const alert of alerts) {
    const success = await sendFindingAlert(alert, recipientEmail);
    if (success) sent++;
  }
  return sent;
}
