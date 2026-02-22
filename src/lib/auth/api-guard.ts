/**
 * API route authorization guard.
 *
 * Provides helper functions that API routes use to enforce authentication
 * and role-based access before processing requests.
 */

import { NextResponse } from "next/server";
import { getServerSession, hasAnyRole, type SessionData } from "./session";

export type AuthResult =
  | { authorized: true; session: SessionData }
  | { authorized: false; response: NextResponse };

/**
 * Require an authenticated session. Returns 401 if not authenticated.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession();
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { status: "error", error: "Authentication required" },
        { status: 401 },
      ),
    };
  }
  return { authorized: true, session };
}

/**
 * Require an authenticated session with at least one of the specified roles.
 * Returns 401 if not authenticated, 403 if authenticated but missing required roles.
 */
export async function requireRole(...roles: string[]): Promise<AuthResult> {
  const session = await getServerSession();
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { status: "error", error: "Authentication required" },
        { status: 401 },
      ),
    };
  }

  if (!hasAnyRole(session, roles)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          status: "error",
          error: `Insufficient permissions. Required: ${roles.join(" or ")}`,
        },
        { status: 403 },
      ),
    };
  }

  return { authorized: true, session };
}

const ADMIN_ROLES = ["System Manager", "Administrator"];
const MANAGER_ROLES = ["System Manager", "Administrator", "HR Manager"];
const READ_ROLES = [
  "System Manager",
  "Administrator",
  "HR Manager",
  "HR User",
];

export async function requireAdmin(): Promise<AuthResult> {
  return requireRole(...ADMIN_ROLES);
}

export async function requireManager(): Promise<AuthResult> {
  return requireRole(...MANAGER_ROLES);
}

export async function requireReadAccess(): Promise<AuthResult> {
  return requireRole(...READ_ROLES);
}
