import { cookies } from "next/headers";

const SESSION_COOKIE = "jml_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

export interface SessionData {
  user: string;
  full_name: string;
  roles: string[];
  frappe_cookies?: string;
}

export async function getServerSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie?.value) return null;

  try {
    const decoded = Buffer.from(sessionCookie.value, "base64").toString("utf-8");
    return JSON.parse(decoded) as SessionData;
  } catch {
    return null;
  }
}

export function encodeSession(data: SessionData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  };
}

export function hasRole(session: SessionData, role: string): boolean {
  return session.roles.includes(role);
}

export function hasAnyRole(session: SessionData, roles: string[]): boolean {
  return roles.some(r => session.roles.includes(r));
}
