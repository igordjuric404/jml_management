import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const body = await req.json();
    const provider = getProvider();
    const data = await provider.revokeAppForUsers(clientId, body.artifact_names);
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
