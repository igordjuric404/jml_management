import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET() {
  try {
    const provider = getProvider();
    const data = await provider.getScanHistory();
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
