import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { encodeSession, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { status: "error", error: "Username and password required" },
        { status: 400 }
      );
    }

    const provider = getProvider();
    const session = await provider.authenticate(username, password);

    const encoded = encodeSession({
      user: session.user,
      full_name: session.full_name,
      roles: session.roles,
    });

    const response = NextResponse.json({
      status: "success",
      user: session.user,
      full_name: session.full_name,
    });

    const cookieOpts = sessionCookieOptions();
    response.cookies.set(cookieOpts.name, encoded, cookieOpts);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 401 }
    );
  }
}
