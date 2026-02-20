import { describe, it, expect } from "vitest";
import {
  encodeSession,
  decodeSession,
  sessionCookieOptions,
  hasRole,
  hasAnyRole,
  type SessionData,
} from "@/lib/auth/session";

describe("Auth utilities", () => {
  const sampleSession: SessionData = {
    user: "admin@test.com",
    full_name: "Admin User",
    roles: ["System Manager", "HR Manager"],
  };

  describe("encodeSession / decode roundtrip", () => {
    it("encodes and decodes session correctly", () => {
      const encoded = encodeSession(sampleSession);
      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = decodeSession(encoded);
      expect(decoded.user).toBe(sampleSession.user);
      expect(decoded.full_name).toBe(sampleSession.full_name);
      expect(decoded.roles).toEqual(sampleSession.roles);
    });

    it("roundtrip preserves optional frappe_cookies", () => {
      const sessionWithCookies: SessionData = {
        ...sampleSession,
        frappe_cookies: "sid=abc123",
      };
      const encoded = encodeSession(sessionWithCookies);
      const decoded = decodeSession(encoded);
      expect(decoded.frappe_cookies).toBe("sid=abc123");
    });
  });

  describe("hasRole", () => {
    it("returns true when session has the role", () => {
      expect(hasRole(sampleSession, "System Manager")).toBe(true);
      expect(hasRole(sampleSession, "HR Manager")).toBe(true);
    });

    it("returns false when session does not have the role", () => {
      expect(hasRole(sampleSession, "Guest")).toBe(false);
      expect(hasRole(sampleSession, "NonExistent")).toBe(false);
    });
  });

  describe("hasAnyRole", () => {
    it("returns true when session has at least one of the roles", () => {
      expect(hasAnyRole(sampleSession, ["Guest", "System Manager"])).toBe(true);
      expect(hasAnyRole(sampleSession, ["HR Manager"])).toBe(true);
    });

    it("returns false when session has none of the roles", () => {
      expect(hasAnyRole(sampleSession, ["Guest", "Customer"])).toBe(false);
      expect(hasAnyRole(sampleSession, [])).toBe(false);
    });
  });

  describe("sessionCookieOptions", () => {
    it("returns correct structure", () => {
      const options = sessionCookieOptions();
      expect(options.name).toBe("jml_session");
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("lax");
      expect(options.maxAge).toBe(60 * 60 * 24);
      expect(options.path).toBe("/");
      expect(typeof options.secure).toBe("boolean");
    });
  });
});
