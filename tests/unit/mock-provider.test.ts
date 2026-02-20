import { describe, it, expect, beforeEach } from "vitest";
import { MockProvider, resetMockData } from "@/lib/providers/frappe/mock-provider";
import { mockCases, mockArtifacts, mockEmployees } from "@/lib/providers/frappe/mock-data";

describe("MockProvider", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockData();
    provider = new MockProvider();
  });

  describe("authenticate", () => {
    it("returns session for valid Administrator credentials", async () => {
      const session = await provider.authenticate("Administrator", "admin");
      expect(session.user).toBe("Administrator");
      expect(session.full_name).toBe("Admin User");
      expect(session.roles).toContain("System Manager");
      expect(session.roles).toContain("HR Manager");
    });

    it("returns session for valid HR user credentials", async () => {
      const session = await provider.authenticate("hr@testcorp.com", "admin");
      expect(session.user).toBe("hr@testcorp.com");
      expect(session.full_name).toBe("HR Manager");
      expect(session.roles).toContain("HR Manager");
    });

    it("throws for invalid credentials", async () => {
      await expect(provider.authenticate("bad", "credentials")).rejects.toThrow("Invalid credentials");
    });
  });

  describe("getDashboardStats", () => {
    it("returns expected KPI structure", async () => {
      const stats = await provider.getDashboardStats();
      expect(stats.kpis).toBeDefined();
      expect(typeof stats.kpis.pending_scan).toBe("number");
      expect(typeof stats.kpis.critical_gaps).toBe("number");
      expect(typeof stats.kpis.oauth_grants_7d).toBe("number");
      expect(typeof stats.kpis.oauth_grants_30d).toBe("number");
      expect(typeof stats.kpis.post_offboard_logins_7d).toBe("number");
      expect(typeof stats.kpis.post_offboard_logins_30d).toBe("number");
      expect(typeof stats.kpis.total_cases).toBe("number");
      expect(typeof stats.kpis.total_findings).toBe("number");
      expect(typeof stats.kpis.total_findings).toBe("number");
      expect(Array.isArray(stats.top_oauth_apps)).toBe(true);
      expect(Array.isArray(stats.risky_cases)).toBe(true);
    });

    it("returns total_cases matching listCases length", async () => {
      const stats = await provider.getDashboardStats();
      const cases = await provider.listCases();
      expect(stats.kpis.total_cases).toBe(cases.length);
    });
  });

  describe("listCases", () => {
    it("returns all mock cases", async () => {
      const cases = await provider.listCases();
      expect(cases.length).toBe(mockCases.length);
      expect(cases.every((c) => c.name.startsWith("OBC-"))).toBe(true);
    });
  });

  describe("getCaseDetail", () => {
    it("returns case detail for valid case name", async () => {
      const validCase = mockCases[0];
      const detail = await provider.getCaseDetail(validCase.name);
      expect(detail.case).toBeDefined();
      expect(detail.case.name).toBe(validCase.name);
      expect(detail.artifacts).toBeDefined();
      expect(detail.artifacts.tokens).toBeDefined();
      expect(detail.artifacts.asps).toBeDefined();
      expect(detail.artifacts.login_events).toBeDefined();
      expect(detail.artifacts.other).toBeDefined();
      expect(detail.findings).toBeDefined();
      expect(detail.audit_logs).toBeDefined();
    });

    it("throws for invalid case name", async () => {
      await expect(provider.getCaseDetail("INVALID-CASE")).rejects.toThrow("Case not found");
    });
  });

  describe("createCase", () => {
    it("creates new case and increases list", async () => {
      const before = await provider.listCases();
      const newCase = await provider.createCase({
        primary_email: "new@testcorp.com",
        employee_name: "New User",
        event_type: "Offboard",
      });
      expect(newCase.name).toMatch(/^OBC-MOCK-\d+$/);
      expect(newCase.status).toBe("Draft");
      expect(newCase.primary_email).toBe("new@testcorp.com");

      const after = await provider.listCases();
      expect(after.length).toBe(before.length + 1);
      expect(after[0].name).toBe(newCase.name);
    });
  });

  describe("createCaseFromEmployee", () => {
    it("creates case from valid employee", async () => {
      const emp = mockEmployees.find((e) => e.case_count! > 0);
      if (!emp) throw new Error("No employee with case_count");

      const newCase = await provider.createCaseFromEmployee(emp.employee_id);
      expect(newCase.employee).toBe(emp.employee_id);
      expect(newCase.employee_name).toBe(emp.employee_name);
      expect(newCase.primary_email).toBe(emp.company_email);
    });

    it("throws for invalid employee", async () => {
      await expect(provider.createCaseFromEmployee("HR-EMP-99999")).rejects.toThrow("Employee not found");
    });
  });

  describe("triggerScan", () => {
    it("scans case and updates status", async () => {
      const caseWithGaps = mockCases.find((c) => c.status === "Gaps Found");
      if (!caseWithGaps) throw new Error("No case with Gaps Found");

      const result = await provider.triggerScan(caseWithGaps.name);
      expect(result.status).toBe("success");
      expect(result.message).toContain("Scan completed");

      const detail = await provider.getCaseDetail(caseWithGaps.name);
      expect(["Gaps Found", "All Clear"]).toContain(detail.case.status);
    });
  });

  describe("systemScan", () => {
    it("promotes hidden artifacts and creates findings", async () => {
      const hiddenBefore = mockArtifacts.filter((a) => a.status === "Hidden");
      const findingsBefore = (await provider.listFindings()).length;

      const result = await provider.systemScan();
      expect(result.status).toBe("success");
      expect(result.message).toContain("System scan");

      const findingsAfter = (await provider.listFindings()).length;
      expect(findingsAfter).toBeGreaterThanOrEqual(findingsBefore);
      if (hiddenBefore.length > 0) {
        expect(findingsAfter).toBeGreaterThan(findingsBefore);
      }
    });
  });

  describe("executeRemediation", () => {
    it("full_bundle remediates all case artifacts and findings", async () => {
      const caseName = "OBC-2025-00001";
      const result = await provider.executeRemediation(caseName, "full_bundle");
      expect(result.status).toBe("success");
      expect(result.action).toBe("full_bundle");
      expect(typeof result.artifacts_remediated).toBe("number");
      expect(typeof result.findings_closed).toBe("number");

      const detail = await provider.getCaseDetail(caseName);
      expect(detail.case.status).toBe("Remediated");
    });

    it("revoke_token revokes OAuth tokens", async () => {
      const caseName = "OBC-2025-00001";
      const result = await provider.executeRemediation(caseName, "revoke_token");
      expect(result.status).toBe("success");
      expect(result.action).toBe("revoke_token");
    });

    it("delete_asp deletes ASPs", async () => {
      const caseName = "OBC-2025-00002";
      const result = await provider.executeRemediation(caseName, "delete_asp");
      expect(result.status).toBe("success");
      expect(result.action).toBe("delete_asp");
    });

    it("sign_out acknowledges login events", async () => {
      const caseName = "OBC-2025-00003";
      const result = await provider.executeRemediation(caseName, "sign_out");
      expect(result.status).toBe("success");
      expect(result.action).toBe("sign_out");
    });

    it("throws for unknown action", async () => {
      await expect(provider.executeRemediation("OBC-2025-00001", "invalid_action")).rejects.toThrow(
        "Unknown action"
      );
    });
  });

  describe("bulkRemediate", () => {
    it("remediates multiple artifacts", async () => {
      const caseName = "OBC-2025-00001";
      const artifacts = (await provider.listArtifacts({ case: caseName, status: "Active" })).slice(0, 2);
      const names = artifacts.map((a) => a.name);

      const result = await provider.bulkRemediate(caseName, names);
      expect(result.status).toBe("success");
      expect(typeof result.revoked).toBe("number");
      expect(typeof result.deleted).toBe("number");
    });
  });

  describe("listArtifacts", () => {
    it("returns all artifacts without filters", async () => {
      const result = await provider.listArtifacts();
      expect(result.length).toBe(mockArtifacts.length);
    });

    it("filters by case when provided", async () => {
      const result = await provider.listArtifacts({ case: "OBC-2025-00001" });
      expect(result.every((a) => a.case === "OBC-2025-00001")).toBe(true);
    });

    it("filters by status when provided", async () => {
      const result = await provider.listArtifacts({ status: "Active" });
      expect(result.every((a) => a.status === "Active")).toBe(true);
    });

    it("filters by artifact_type when provided", async () => {
      const result = await provider.listArtifacts({ artifact_type: "OAuthToken" });
      expect(result.every((a) => a.artifact_type === "OAuthToken")).toBe(true);
    });
  });

  describe("listFindings", () => {
    it("returns findings without filters", async () => {
      const result = await provider.listFindings();
      expect(result.length).toBeGreaterThan(0);
    });

    it("filters by case when provided", async () => {
      const result = await provider.listFindings({ case: "OBC-2025-00001" });
      expect(result.every((f) => f.case === "OBC-2025-00001")).toBe(true);
    });

    it("filters by severity when provided", async () => {
      const result = await provider.listFindings({ severity: "Critical" });
      expect(result.every((f) => f.severity === "Critical")).toBe(true);
    });
  });

  describe("getEmployeeList", () => {
    it("returns expected employees (with cases or Left)", async () => {
      const result = await provider.getEmployeeList();
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((e) => e.employee_id.startsWith("HR-EMP-"))).toBe(true);
    });
  });

  describe("getEmployeeDetail", () => {
    it("returns detail for valid employee", async () => {
      const emp = mockEmployees[0];
      const detail = await provider.getEmployeeDetail(emp.employee_id);
      expect(detail.employee.id).toBe(emp.employee_id);
      expect(detail.employee.name).toBe(emp.employee_name);
      expect(detail.employee.email).toBe(emp.company_email);
      expect(Array.isArray(detail.cases)).toBe(true);
      expect(Array.isArray(detail.artifacts)).toBe(true);
      expect(Array.isArray(detail.findings)).toBe(true);
      expect(detail.summary).toBeDefined();
    });

    it("throws for invalid employee", async () => {
      await expect(provider.getEmployeeDetail("HR-EMP-99999")).rejects.toThrow("Employee not found");
    });
  });

  describe("getAllActiveOAuthApps", () => {
    it("returns grouped apps", async () => {
      const result = await provider.getAllActiveOAuthApps();
      expect(Array.isArray(result)).toBe(true);
      result.forEach((app) => {
        expect(app.client_id).toBeDefined();
        expect(app.app_display_name).toBeDefined();
        expect(typeof app.grant_count).toBe("number");
      });
    });
  });

  describe("getAppDetail", () => {
    it("returns app with users and scopes", async () => {
      const apps = await provider.getAllActiveOAuthApps();
      if (apps.length === 0) return;

      const detail = await provider.getAppDetail(apps[0].client_id);
      expect(detail.client_id).toBe(apps[0].client_id);
      expect(detail.app_name).toBeDefined();
      expect(typeof detail.total_grants).toBe("number");
      expect(typeof detail.active_grants).toBe("number");
      expect(Array.isArray(detail.scopes)).toBe(true);
      expect(Array.isArray(detail.users)).toBe(true);
    });
  });

  describe("globalAppRemoval", () => {
    it("revokes all grants for app", async () => {
      const apps = await provider.getAllActiveOAuthApps();
      const clientId = apps.find((a) => a.grant_count! > 0)?.client_id;
      if (!clientId) return;

      const result = await provider.globalAppRemoval(clientId, "Test App");
      expect(result.status).toBe("success");
      expect(typeof result.revoked).toBe("number");
    });
  });

  describe("revokeAppForUsers", () => {
    it("revokes selected users", async () => {
      const apps = await provider.getAllActiveOAuthApps();
      const clientId = apps[0]?.client_id;
      if (!clientId) return;

      const detail = await provider.getAppDetail(clientId);
      const activeArtifacts = detail.users.filter((u) => u.status === "Active").map((u) => u.artifact_name);
      if (activeArtifacts.length === 0) return;

      const result = await provider.revokeAppForUsers(clientId, activeArtifacts.slice(0, 1));
      expect(result.status).toBe("success");
    });
  });

  describe("restoreAppForUsers", () => {
    it("restores revoked users", async () => {
      const revokedArtifact = mockArtifacts.find((a) => a.status === "Revoked" && a.artifact_type === "OAuthToken");
      if (!revokedArtifact) return;

      const result = await provider.restoreAppForUsers(revokedArtifact.client_id!, [
        revokedArtifact.name,
      ]);
      expect(result.status).toBe("success");

      const art = (await provider.listArtifacts()).find((a) => a.name === revokedArtifact.name);
      expect(art?.status).toBe("Active");
    });
  });

  describe("updateUserScopes", () => {
    it("adds and removes scopes", async () => {
      const art = mockArtifacts.find((a) => a.status === "Active" && a.artifact_type === "OAuthToken");
      if (!art) return;

      const oldScopes: string[] = JSON.parse(art.scopes_json || "[]");
      const newScopes = oldScopes.length > 0 ? [oldScopes[0]] : ["https://example.com/new-scope"];
      const result = await provider.updateUserScopes(art.name, newScopes);
      expect(typeof result.added).toBe("number");
      expect(typeof result.removed).toBe("number");
    });

    it("revokes if scopes empty", async () => {
      const art = mockArtifacts.find((a) => a.status === "Active" && a.artifact_type === "OAuthToken");
      if (!art) return;

      await provider.updateUserScopes(art.name, []);
      const updated = await provider.getArtifact(art.name);
      expect(updated.status).toBe("Revoked");
    });
  });

  describe("listAuditLogs", () => {
    it("returns audit entries", async () => {
      const result = await provider.listAuditLogs();
      expect(Array.isArray(result)).toBe(true);
      result.forEach((entry) => {
        expect(entry.name).toBeDefined();
        expect(entry.action_type).toBeDefined();
        expect(entry.timestamp).toBeDefined();
      });
    });
  });

  describe("getSettings / updateSettings", () => {
    it("reads settings", async () => {
      const settings = await provider.getSettings();
      expect(settings.auto_scan_on_offboard).toBeDefined();
      expect(settings.background_scan_interval).toBeDefined();
      expect(settings.notification_email).toBeDefined();
    });

    it("updates settings", async () => {
      const updated = await provider.updateSettings({
        notification_email: "updated@test.com",
      });
      expect(updated.notification_email).toBe("updated@test.com");
    });
  });

  describe("chat", () => {
    it("returns contextual reply for case keywords", async () => {
      const result = await provider.chat("How many cases do we have?");
      expect(result.reply).toContain("case");
      expect(Array.isArray(result.sources)).toBe(true);
      expect(result.sources.length).toBeGreaterThan(0);
    });

    it("returns contextual reply for artifact keywords", async () => {
      const result = await provider.chat("Tell me about OAuth tokens");
      expect(result.reply).toContain("artifact");
    });

    it("returns contextual reply for finding keywords", async () => {
      const result = await provider.chat("What critical findings exist?");
      expect(result.reply).toContain("finding");
    });

    it("returns generic reply for unrelated message", async () => {
      const result = await provider.chat("Hello");
      expect(result.reply).toContain("OGM system");
    });
  });
});
