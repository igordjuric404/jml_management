import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getProvider, resetProvider } from "@/lib/providers";

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
    it("always returns FallbackProvider", () => {
      const provider = getProvider();
      expect(provider.name).toBe("fallback");
    });

    it("returns FallbackProvider even without FRAPPE_API_KEY", () => {
      delete process.env.FRAPPE_API_KEY;
      const provider = getProvider();
      expect(provider.name).toBe("fallback");
    });
  });

  describe("resetProvider", () => {
    it("clears the singleton", () => {
      const first = getProvider();
      resetProvider();
      const second = getProvider();
      expect(first).not.toBe(second);
      expect(second.name).toBe("fallback");
    });
  });
});
