import { NextRequest, NextResponse } from "next/server";
import { sendFindingAlert, type FindingAlert } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body: { alert: FindingAlert; recipientEmail?: string } = await req.json();
    const success = await sendFindingAlert(body.alert, body.recipientEmail);
    return NextResponse.json({
      status: "success",
      data: { sent: success },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
