import { NextRequest, NextResponse } from "next/server";
import { sendFindingAlert, sendRemediationAlert, type FindingAlert, type RemediationAlert } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType: string = body.eventType || "finding";

    if (eventType === "remediation") {
      const alert: RemediationAlert = {
        caseName: body.caseName,
        employeeEmail: body.employeeEmail,
        employeeName: body.employeeName || body.employeeEmail,
        revokedCount: body.revokedCount ?? 0,
        closedFindingsCount: body.closedFindingsCount ?? 0,
        remainingActive: body.remainingActive ?? 0,
      };
      const success = await sendRemediationAlert(alert, body.recipientEmail);
      return NextResponse.json({ status: "success", data: { sent: success } });
    }

    const alert: FindingAlert = body.alert ?? {
      findingName: body.findingName,
      severity: body.severity,
      findingType: body.findingType,
      summary: body.summary,
      caseName: body.caseName,
      employeeEmail: body.employeeEmail,
    };
    const success = await sendFindingAlert(alert, body.recipientEmail);
    return NextResponse.json({ status: "success", data: { sent: success } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
