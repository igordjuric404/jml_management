import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-guard";
import { getProvider } from "@/lib/providers";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;
    const provider = getProvider();
    const stats = await provider.getDashboardStats();
    return NextResponse.json({ status: "success", data: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch dashboard";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
