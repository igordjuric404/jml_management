import { NextRequest, NextResponse } from "next/server";
import { chat as knowledgeChat } from "@/lib/chatbot";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message as string;
    const apiKey = process.env.OPENROUTER_API_KEY || undefined;

    const data = await knowledgeChat(message, { apiKey });
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: msg }, { status: 500 });
  }
}
