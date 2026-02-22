import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockCookieGet(...args),
  }),
}));

import { requireAuth, requireRole, requireAdmin, requireManager, requireReadAccess } from "@/lib/auth/api-guard";
import { encodeSession, type SessionData } from "@/lib/auth/session";

function sessionCookie(data: SessionData): string {
  return encodeSession(data);
}

describe("API Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireAuth", () => {
    it("returns authorized=true when session exists", async () => {
      const session: SessionData = { user: "admin", full_name: "Admin", roles: ["System Manager"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireAuth();
      expect(result.authorized).toBe(true);
      if (result.authorized) {
        expect(result.session.user).toBe("admin");
      }
    });

    it("returns 401 when no session cookie", async () => {
      mockCookieGet.mockReturnValue(undefined);

      const result = await requireAuth();
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.response.status).toBe(401);
      }
    });

    it("returns 401 when cookie is empty", async () => {
      mockCookieGet.mockReturnValue({ value: "" });

      const result = await requireAuth();
      expect(result.authorized).toBe(false);
    });
  });

  describe("requireRole", () => {
    it("returns authorized when user has the required role", async () => {
      const session: SessionData = { user: "admin", full_name: "Admin", roles: ["System Manager"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireRole("System Manager");
      expect(result.authorized).toBe(true);
    });

    it("returns authorized when user has one of multiple required roles", async () => {
      const session: SessionData = { user: "hr", full_name: "HR", roles: ["HR Manager"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireRole("System Manager", "HR Manager");
      expect(result.authorized).toBe(true);
    });

    it("returns 403 when user lacks required role", async () => {
      const session: SessionData = { user: "reader", full_name: "Reader", roles: ["HR User"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireRole("System Manager");
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.response.status).toBe(403);
      }
    });

    it("returns 401 when not authenticated", async () => {
      mockCookieGet.mockReturnValue(undefined);

      const result = await requireRole("System Manager");
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.response.status).toBe(401);
      }
    });
  });

  describe("requireAdmin", () => {
    it("allows System Manager", async () => {
      const session: SessionData = { user: "admin", full_name: "Admin", roles: ["System Manager"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireAdmin();
      expect(result.authorized).toBe(true);
    });

    it("rejects HR Manager", async () => {
      const session: SessionData = { user: "hr", full_name: "HR", roles: ["HR Manager"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireAdmin();
      expect(result.authorized).toBe(false);
    });
  });

  describe("requireManager", () => {
    it("allows System Manager", async () => {
      const session: SessionData = { user: "admin", full_name: "Admin", roles: ["System Manager"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireManager();
      expect(result.authorized).toBe(true);
    });

    it("allows HR Manager", async () => {
      const session: SessionData = { user: "hr", full_name: "HR", roles: ["HR Manager"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireManager();
      expect(result.authorized).toBe(true);
    });

    it("rejects HR User", async () => {
      const session: SessionData = { user: "user", full_name: "User", roles: ["HR User"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireManager();
      expect(result.authorized).toBe(false);
    });
  });

  describe("requireReadAccess", () => {
    it("allows HR User for read access", async () => {
      const session: SessionData = { user: "user", full_name: "User", roles: ["HR User"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireReadAccess();
      expect(result.authorized).toBe(true);
    });

    it("rejects users with no recognized roles", async () => {
      const session: SessionData = { user: "guest", full_name: "Guest", roles: ["Guest"] };
      mockCookieGet.mockReturnValue({ value: sessionCookie(session) });

      const result = await requireReadAccess();
      expect(result.authorized).toBe(false);
    });
  });
});
