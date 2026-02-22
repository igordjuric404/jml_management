import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/store/local-store", () => ({
  getLocalStore: () => ({}),
  LocalStore: vi.fn(),
}));

import { getProvider, resetProvider } from "@/lib/providers";

describe("Provider factory", () => {
  beforeEach(() => {
    resetProvider();
  });

  afterEach(() => {
    resetProvider();
  });

  it("returns UnifiedProvider", () => {
    const provider = getProvider();
    expect(provider.name).toBe("unified");
  });

  it("returns the same singleton on repeated calls", () => {
    const first = getProvider();
    const second = getProvider();
    expect(first).toBe(second);
  });

  it("resets the singleton", () => {
    const first = getProvider();
    resetProvider();
    const second = getProvider();
    expect(first).not.toBe(second);
    expect(second.name).toBe("unified");
  });
});
