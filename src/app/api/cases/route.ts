import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireManager } from "@/lib/auth/api-guard";
import { getProvider } from "@/lib/providers";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;
    const provider = getProvider();
    const data = await provider.listCases();
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireManager();
    if (!auth.authorized) return auth.response;
    const body = await req.json();
    const provider = getProvider();
    const data = await provider.createCase(body);
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
