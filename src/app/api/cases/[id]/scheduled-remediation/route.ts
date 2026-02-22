import { NextRequest, NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/api-guard";
import { getProvider } from "@/lib/providers";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireManager();
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    const provider = getProvider();
    const data = await provider.runScheduledRemediationNow(id);
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
