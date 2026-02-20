import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as casesRoute from "@/app/api/cases/route";
import * as caseDetailRoute from "@/app/api/cases/[id]/route";
import * as caseScanRoute from "@/app/api/cases/[id]/scan/route";
import * as caseRemediateRoute from "@/app/api/cases/[id]/remediate/route";
import { MockProvider, resetMockData } from "@/lib/providers/frappe/mock-provider";
import { vi } from "vitest";

vi.mock("@/lib/providers", () => ({
  getProvider: vi.fn(),
  resetProvider: vi.fn(),
}));

describe("Cases API integration", () => {
  beforeEach(async () => {
    resetMockData();
    const { getProvider } = await import("@/lib/providers");
    vi.mocked(getProvider).mockReturnValue(new MockProvider());
  });

  describe("GET /api/cases", () => {
    it("returns list of cases", async () => {
      const res = await casesRoute.GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("success");
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
    });
  });

  describe("POST /api/cases", () => {
    it("creates case", async () => {
      const req = new NextRequest("http://localhost/api/cases", {
        method: "POST",
        body: JSON.stringify({
          primary_email: "newuser@testcorp.com",
          employee_name: "New User",
          event_type: "Offboard",
        }),
      });

      const res = await casesRoute.POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.data).toBeDefined();
      expect(json.data.name).toMatch(/^OBC-/);
      expect(json.data.primary_email).toBe("newuser@testcorp.com");
    });
  });

  describe("GET /api/cases/[id]", () => {
    it("returns case detail for valid id", async () => {
      const caseId = "OBC-2025-00001";
      const res = await caseDetailRoute.GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: caseId }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.data.case).toBeDefined();
      expect(json.data.case.name).toBe(caseId);
      expect(json.data.artifacts).toBeDefined();
      expect(json.data.findings).toBeDefined();
    });

    it("returns error for invalid id", async () => {
      const res = await caseDetailRoute.GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: "INVALID" }) }
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.status).toBe("error");
    });
  });

  describe("POST /api/cases/[id]/scan", () => {
    it("triggers scan", async () => {
      const caseId = "OBC-2025-00001";
      const res = await caseScanRoute.POST(
        {} as NextRequest,
        { params: Promise.resolve({ id: caseId }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.data.status).toBe("success");
      expect(json.data.message).toContain("Scan completed");
    });
  });

  describe("POST /api/cases/[id]/remediate", () => {
    it("executes remediation", async () => {
      const caseId = "OBC-2025-00001";
      const req = new NextRequest("http://localhost/api/cases/OBC-2025-00001/remediate", {
        method: "POST",
        body: JSON.stringify({ action: "full_bundle" }),
      });

      const res = await caseRemediateRoute.POST(req, {
        params: Promise.resolve({ id: caseId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("success");
      expect(json.data.status).toBe("success");
      expect(json.data.action).toBe("full_bundle");
    });
  });
});
