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
  "Draft", "Scheduled", "All Clear", "Gaps Found", "Remediated", "Closed",
] as const;
const VALID_EVENT_TYPES = ["Offboard", "Security Review", "Manual Check"] as const;

describe("Mock Data Integrity", () => {
  const employeeIds = new Set(mockEmployees.map((e) => e.employee_id));
  const caseNames = new Set(mockCases.map((c) => c.name));

  describe("referential integrity", () => {
    it("all cases reference valid employees", () => {
      mockCases.forEach((c) => {
        expect(employeeIds.has(c.employee)).toBe(true);
      });
    });

    it("artifacts with case reference valid cases", () => {
      mockArtifacts.forEach((a) => {
        if (a.case) {
          expect(caseNames.has(a.case)).toBe(true);
        }
      });
    });

    it("all findings reference valid cases", () => {
      mockFindings.forEach((f) => {
        expect(caseNames.has(f.case)).toBe(true);
      });
    });
  });

  describe("employee coverage", () => {
    it("has active employees with no cases", () => {
      const activeNoCases = mockEmployees.filter(
        (e) => e.emp_status === "Active" && (e.case_count ?? 0) === 0
      );
      expect(activeNoCases.length).toBeGreaterThan(0);
    });

    it("has left employees with cases and findings", () => {
      const leftWithCases = mockEmployees.filter(
        (e) => e.emp_status === "Left" && (e.case_count ?? 0) > 0
      );
      expect(leftWithCases.length).toBeGreaterThan(0);
    });

    it("has active employees with artifacts (for offboarding testing)", () => {
      const activeWithArtifacts = mockEmployees.filter(
        (e) => e.emp_status === "Active" && (e.active_artifacts ?? 0) > 0
      );
      expect(activeWithArtifacts.length).toBeGreaterThan(0);
    });
  });

  describe("artifact types and statuses", () => {
    it("every artifact has valid artifact_type", () => {
      mockArtifacts.forEach((a) => {
        expect(VALID_ARTIFACT_TYPES).toContain(a.artifact_type);
      });
    });

    it("every artifact has valid status", () => {
      mockArtifacts.forEach((a) => {
        expect(VALID_ARTIFACT_STATUSES).toContain(a.status);
      });
    });

    it("has login event artifacts for post-offboard testing", () => {
      const loginEvents = mockArtifacts.filter((a) => a.artifact_type === "LoginEvent");
      expect(loginEvents.length).toBeGreaterThan(0);
    });

    it("has ASP artifacts", () => {
      const asps = mockArtifacts.filter((a) => a.artifact_type === "ASP");
      expect(asps.length).toBeGreaterThan(0);
    });
  });

  describe("finding types and severities", () => {
    it("every finding has valid finding_type", () => {
      mockFindings.forEach((f) => {
        expect(VALID_FINDING_TYPES).toContain(f.finding_type);
      });
    });

    it("every finding has valid severity", () => {
      mockFindings.forEach((f) => {
        expect(VALID_SEVERITIES).toContain(f.severity);
      });
    });

    it("has post-offboard login findings", () => {
      const postLogins = mockFindings.filter((f) => f.finding_type === "PostOffboardLogin");
      expect(postLogins.length).toBeGreaterThan(0);
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

  describe("settings", () => {
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

  describe("data sizes", () => {
    it("has reasonable number of employees", () => {
      expect(mockEmployees.length).toBeGreaterThanOrEqual(10);
    });
    it("has cases for left employees", () => {
      expect(mockCases.length).toBeGreaterThanOrEqual(3);
    });
    it("has artifacts covering multiple types", () => {
      expect(mockArtifacts.length).toBeGreaterThanOrEqual(15);
    });
    it("has findings for all cases", () => {
      expect(mockFindings.length).toBeGreaterThanOrEqual(5);
    });
  });
});
