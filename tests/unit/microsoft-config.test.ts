import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMicrosoftConfig, isMicrosoftConfigured } from "@/lib/providers/microsoft/config";

describe("Microsoft Config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getMicrosoftConfig", () => {
    it("returns config when all env vars are set", () => {
      process.env.MICROSOFT_TENANT_ID = "tenant-123";
      process.env.MICROSOFT_CLIENT_ID = "client-456";
      process.env.MICROSOFT_CLIENT_SECRET = "secret-789";

      const config = getMicrosoftConfig();
      expect(config).toEqual({
        tenantId: "tenant-123",
        clientId: "client-456",
        clientSecret: "secret-789",
      });
    });

    it("returns null when tenant ID is missing", () => {
      process.env.MICROSOFT_TENANT_ID = "";
      process.env.MICROSOFT_CLIENT_ID = "client-456";
      process.env.MICROSOFT_CLIENT_SECRET = "secret-789";

      expect(getMicrosoftConfig()).toBeNull();
    });

    it("returns null when client ID is missing", () => {
      process.env.MICROSOFT_TENANT_ID = "tenant-123";
      process.env.MICROSOFT_CLIENT_ID = "";
      process.env.MICROSOFT_CLIENT_SECRET = "secret-789";

      expect(getMicrosoftConfig()).toBeNull();
    });

    it("returns null when client secret is missing", () => {
      process.env.MICROSOFT_TENANT_ID = "tenant-123";
      process.env.MICROSOFT_CLIENT_ID = "client-456";
      process.env.MICROSOFT_CLIENT_SECRET = "";

      expect(getMicrosoftConfig()).toBeNull();
    });

    it("returns null when no env vars are set", () => {
      delete process.env.MICROSOFT_TENANT_ID;
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;

      expect(getMicrosoftConfig()).toBeNull();
    });
  });

  describe("isMicrosoftConfigured", () => {
    it("returns true when all env vars are set", () => {
      process.env.MICROSOFT_TENANT_ID = "tenant-123";
      process.env.MICROSOFT_CLIENT_ID = "client-456";
      process.env.MICROSOFT_CLIENT_SECRET = "secret-789";

      expect(isMicrosoftConfigured()).toBe(true);
    });

    it("returns false when config is incomplete", () => {
      delete process.env.MICROSOFT_TENANT_ID;
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;

      expect(isMicrosoftConfigured()).toBe(false);
    });
  });
});
