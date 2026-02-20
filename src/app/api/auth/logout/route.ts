import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ status: "success" });
  const cookieOpts = sessionCookieOptions();
  response.cookies.set(cookieOpts.name, "", { ...cookieOpts, maxAge: 0 });
  return response;
}
