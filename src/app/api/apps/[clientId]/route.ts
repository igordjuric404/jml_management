import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const provider = getProvider();
    const data = await provider.getAppDetail(clientId);
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
