import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-guard";
import { getProvider } from "@/lib/providers";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;
    const provider = getProvider();
    const data = await provider.getAllActiveOAuthApps();
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
