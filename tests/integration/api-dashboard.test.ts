import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as dashboardRoute from "@/app/api/dashboard/route";
import { MockProvider, resetMockData } from "@/lib/providers/frappe/mock-provider";
import { vi } from "vitest";

vi.mock("@/lib/providers", () => ({
  getProvider: vi.fn(),
  resetProvider: vi.fn(),
}));

describe("Dashboard API integration", () => {
  beforeEach(async () => {
    resetMockData();
    const { getProvider } = await import("@/lib/providers");
    vi.mocked(getProvider).mockReturnValue(new MockProvider());
  });

  it("GET /api/dashboard returns expected structure", async () => {
    const req = new NextRequest("http://localhost/api/dashboard");
    const res = await dashboardRoute.GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("success");
    expect(json.data).toBeDefined();
    expect(json.data.kpis).toBeDefined();
    expect(typeof json.data.kpis.pending_scan).toBe("number");
    expect(typeof json.data.kpis.total_cases).toBe("number");
    expect(Array.isArray(json.data.top_oauth_apps)).toBe(true);
    expect(Array.isArray(json.data.risky_cases)).toBe(true);
  });
});
