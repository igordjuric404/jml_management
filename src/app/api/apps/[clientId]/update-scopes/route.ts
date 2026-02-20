import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const provider = getProvider();
    const data = await provider.updateUserScopes(body.artifact_name, body.scopes);
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
