import { describe, it, expect } from "vitest";
import {
  mockEmployees,
  mockCases,
  mockArtifacts,
  mockFindings,
  mockAuditLogs,
  mockSettings,
} from "@/lib/providers/frappe/mock-data";
const VALID_ARTIFACT_TYPES = ["OAuthToken", "ASP", "LoginEvent", "AdminMFA", "DWDChange"] as const;
const VALID_ARTIFACT_STATUSES = ["Active", "Hidden", "Revoked", "Deleted", "Acknowledged"] as const;
const VALID_FINDING_TYPES = [
  "LingeringOAuthGrant",
  "LingeringASP",
  "PostOffboardLogin",
  "PostOffboardSuspiciousLogin",
  "AdminMFAWeak",
  "DWDHighRisk",
  "OffboardingNotEnforced",
] as const;
const VALID_SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
const VALID_CASE_STATUSES = [
  "Draft",
  "Scheduled",
  "All Clear",
  "Gaps Found",
  "Remediated",
  "Closed",
] as const;
const VALID_EVENT_TYPES = ["Offboard", "Security Review", "Manual Check"] as const;
const CASE_NAME_REGEX = /^OBC-\d{4}-\d{5}$/;
const ARTIFACT_NAME_REGEX = /^ART-\d{4}-\d{5}$/;
const FINDING_NAME_REGEX = /^FND-\d{4}-\d{5}$/;
const EMPLOYEE_ID_REGEX = /^HR-EMP-\d{5}$/;

describe("Mock Data Integrity", () => {
  const employeeIds = new Set(mockEmployees.map((e) => e.employee_id));
  const caseNames = new Set(mockCases.map((c) => c.name));

  describe("cases reference valid employees", () => {
    it("all cases reference valid employees", () => {
      mockCases.forEach((c) => {
        expect(employeeIds.has(c.employee)).toBe(true);
      });
    });
  });

  describe("artifacts reference valid cases or empty for hidden", () => {
    it("artifacts with case reference valid cases", () => {
      mockArtifacts.forEach((a) => {
        if (a.case) {
          expect(caseNames.has(a.case) || a.status === "Hidden").toBe(true);
        }
      });
    });

    it("hidden artifacts may have empty case", () => {
      const hidden = mockArtifacts.filter((a) => a.status === "Hidden");
      expect(hidden.length).toBeGreaterThan(0);
      hidden.forEach((a) => {
        expect(a.case === "" || caseNames.has(a.case)).toBe(true);
      });
    });
  });

  describe("findings reference valid cases", () => {
    it("all findings reference valid cases", () => {
      mockFindings.forEach((f) => {
        expect(caseNames.has(f.case)).toBe(true);
      });
    });
  });

  describe("scenario coverage A-J", () => {
    const scenarioNotes = mockCases.map((c) => (c.notes || "").toLowerCase());
    it("scenario A exists", () => {
      expect(scenarioNotes.some((n) => n.includes("scenario a"))).toBe(true);
    });
    it("scenario B exists", () => {
      expect(scenarioNotes.some((n) => n.includes("scenario b"))).toBe(true);
    });
    it("scenario C exists", () => {
      expect(scenarioNotes.some((n) => n.includes("scenario c"))).toBe(true);
    });
    it("scenario D exists", () => {
      expect(scenarioNotes.some((n) => n.includes("scenario d"))).toBe(true);
    });
    it("scenario E exists", () => {
      expect(scenarioNotes.some((n) => n.includes("scenario e"))).toBe(true);
    });
    it("scenario F exists", () => {
      expect(scenarioNotes.some((n) => n.includes("scenario f"))).toBe(true);
    });
    it("scenario G exists", () => {
      expect(scenarioNotes.some((n) => n.includes("scenario g"))).toBe(true);
    });
    it("scenario H exists", () => {
      expect(scenarioNotes.some((n) => n.includes("scenario h"))).toBe(true);
    });
    it("scenario I exists", () => {
      expect(scenarioNotes.some((n) => n.includes("scenario i"))).toBe(true);
    });
    it("scenario J exists", () => {
      expect(scenarioNotes.some((n) => n.includes("scenario j"))).toBe(true);
    });
  });

  describe("hidden artifacts exist for system scan testing", () => {
    it("has hidden artifacts", () => {
      const hidden = mockArtifacts.filter((a) => a.status === "Hidden");
      expect(hidden.length).toBeGreaterThan(0);
    });
  });

  describe("revoked artifacts exist for restore testing", () => {
    it("has revoked artifacts", () => {
      const revoked = mockArtifacts.filter((a) => a.status === "Revoked");
      expect(revoked.length).toBeGreaterThan(0);
    });
  });

  describe("active employees with no cases exist", () => {
    it("has active employees with case_count 0", () => {
      const activeNoCases = mockEmployees.filter((e) => e.emp_status === "Active" && (e.case_count ?? 0) === 0);
      expect(activeNoCases.length).toBeGreaterThan(0);
    });
  });

  describe("employee IDs follow HR-EMP-NNNNN format", () => {
    it("all employee IDs match format", () => {
      mockEmployees.forEach((e) => {
        expect(e.employee_id).toMatch(EMPLOYEE_ID_REGEX);
      });
    });
  });

  describe("case names follow OBC-YYYY-NNNNN format", () => {
    it("all case names match format", () => {
      mockCases.forEach((c) => {
        expect(c.name).toMatch(CASE_NAME_REGEX);
      });
    });
  });

  describe("artifact names follow ART-YYYY-NNNNN format", () => {
    it("all artifact names match format", () => {
      mockArtifacts.forEach((a) => {
        expect(a.name).toMatch(ARTIFACT_NAME_REGEX);
      });
    });
  });

  describe("finding names follow FND-YYYY-NNNNN format", () => {
    it("all finding names match format", () => {
      mockFindings.forEach((f) => {
        expect(f.name).toMatch(FINDING_NAME_REGEX);
      });
    });
  });

  describe("all artifact types are valid", () => {
    it("every artifact has valid artifact_type", () => {
      mockArtifacts.forEach((a) => {
        expect(VALID_ARTIFACT_TYPES).toContain(a.artifact_type);
      });
    });
  });

  describe("all artifact statuses are valid", () => {
    it("every artifact has valid status", () => {
      mockArtifacts.forEach((a) => {
        expect(VALID_ARTIFACT_STATUSES).toContain(a.status);
      });
    });
  });

  describe("all finding types are valid", () => {
    it("every finding has valid finding_type", () => {
      mockFindings.forEach((f) => {
        expect(VALID_FINDING_TYPES).toContain(f.finding_type);
      });
    });
  });

  describe("all severities are valid", () => {
    it("every finding has valid severity", () => {
      mockFindings.forEach((f) => {
        expect(VALID_SEVERITIES).toContain(f.severity);
      });
    });
  });

  describe("cases have valid status and event_type", () => {
    it("every case has valid status", () => {
      mockCases.forEach((c) => {
        expect(VALID_CASE_STATUSES).toContain(c.status as (typeof VALID_CASE_STATUSES)[number]);
      });
    });
    it("every case has valid event_type", () => {
      mockCases.forEach((c) => {
        expect(VALID_EVENT_TYPES).toContain(c.event_type);
      });
    });
  });

  describe("settings interval options", () => {
    it("background_scan_interval is valid", () => {
      expect(typeof mockSettings.background_scan_interval).toBe("string");
      expect(mockSettings.background_scan_interval.length).toBeGreaterThan(0);
    });
    it("remediation_check_interval is valid", () => {
      expect(typeof mockSettings.remediation_check_interval).toBe("string");
      expect(mockSettings.remediation_check_interval.length).toBeGreaterThan(0);
    });
  });

  describe("audit logs structure", () => {
    it("audit logs have required fields", () => {
      mockAuditLogs.forEach((log) => {
        expect(log.name).toBeDefined();
        expect(log.action_type).toBeDefined();
        expect(log.target_email).toBeDefined();
        expect(log.timestamp).toBeDefined();
      });
    });
  });
});
