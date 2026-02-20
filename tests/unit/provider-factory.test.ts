import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getProvider, resetProvider } from "@/lib/providers";
import { MockProvider } from "@/lib/providers/frappe/mock-provider";

describe("Provider factory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetProvider();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getProvider", () => {
    it("returns MockProvider when NEXT_PUBLIC_USE_MOCK=true", () => {
      process.env.NEXT_PUBLIC_USE_MOCK = "true";
      process.env.NODE_ENV = "production";
      process.env.FRAPPE_API_KEY = "some-key";

      const provider = getProvider();
      expect(provider).toBeInstanceOf(MockProvider);
      expect(provider.name).toBe("mock");
    });

    it("returns MockProvider in development when FRAPPE_API_KEY is missing", () => {
      process.env.NEXT_PUBLIC_USE_MOCK = "false";
      process.env.NODE_ENV = "development";
      delete process.env.FRAPPE_API_KEY;

      const provider = getProvider();
      expect(provider).toBeInstanceOf(MockProvider);
    });
  });

  describe("resetProvider", () => {
    it("clears the singleton", () => {
      process.env.NEXT_PUBLIC_USE_MOCK = "true";
      const first = getProvider();
      resetProvider();
      const second = getProvider();
      expect(first).not.toBe(second);
      expect(second).toBeInstanceOf(MockProvider);
    });
  });
});
