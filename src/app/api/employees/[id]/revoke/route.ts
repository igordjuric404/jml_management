import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { requireManager } from "@/lib/auth/api-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireManager();
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json();
    const provider = getProvider();
    const data = await provider.revokeEmployeeAccess(id, body.scope);
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
