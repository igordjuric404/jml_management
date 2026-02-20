import { describe, it, expect } from "vitest";
import { mockCases, mockArtifacts, mockFindings, mockSettings } from "@/lib/providers/frappe/mock-data";

const OFFBOARDING_CASE_STATUS_OPTIONS = [
  "Draft",
  "Scheduled",
  "All Clear",
  "Gaps Found",
  "Remediated",
  "Closed",
] as const;

const OFFBOARDING_CASE_EVENT_TYPE_OPTIONS = [
  "Offboard",
  "Security Review",
  "Manual Check",
] as const;

const ACCESS_ARTIFACT_TYPE_OPTIONS = [
  "OAuthToken",
  "ASP",
  "LoginEvent",
  "AdminMFA",
  "DWDChange",
] as const;

const ACCESS_ARTIFACT_STATUS_OPTIONS = [
  "Active",
  "Hidden",
  "Revoked",
  "Deleted",
  "Acknowledged",
] as const;

const FINDING_TYPE_OPTIONS = [
  "LingeringOAuthGrant",
  "LingeringASP",
  "PostOffboardLogin",
  "PostOffboardSuspiciousLogin",
  "AdminMFAWeak",
  "DWDHighRisk",
  "OffboardingNotEnforced",
] as const;

const FINDING_SEVERITY_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;

const SETTINGS_INTERVAL_OPTIONS = [
  "Every Hour",
  "Every 30 Minutes",
  "Every 15 Minutes",
  "Every 5 Minutes",
  "Every Day",
  "Every Week",
] as const;

describe("Mock data matches Frappe doctype schemas", () => {
  describe("Offboarding Case fields", () => {
    it("all status values are valid options", () => {
      mockCases.forEach((c) => {
        expect(OFFBOARDING_CASE_STATUS_OPTIONS).toContain(c.status as (typeof OFFBOARDING_CASE_STATUS_OPTIONS)[number]);
      });
    });

    it("all event_type values are valid options", () => {
      mockCases.forEach((c) => {
        expect(OFFBOARDING_CASE_EVENT_TYPE_OPTIONS).toContain(c.event_type);
      });
    });
  });

  describe("Access Artifact fields", () => {
    it("all artifact_type values are valid options", () => {
      mockArtifacts.forEach((a) => {
        expect(ACCESS_ARTIFACT_TYPE_OPTIONS).toContain(a.artifact_type);
      });
    });

    it("all status values are valid options", () => {
      mockArtifacts.forEach((a) => {
        expect(ACCESS_ARTIFACT_STATUS_OPTIONS).toContain(a.status);
      });
    });
  });

  describe("Finding fields", () => {
    it("all finding_type values are valid options", () => {
      mockFindings.forEach((f) => {
        expect(FINDING_TYPE_OPTIONS).toContain(f.finding_type);
      });
    });

    it("all severity values are valid options", () => {
      mockFindings.forEach((f) => {
        expect(FINDING_SEVERITY_OPTIONS).toContain(f.severity);
      });
    });
  });

  describe("OGM Settings fields", () => {
    it("background_scan_interval is a valid option", () => {
      expect(SETTINGS_INTERVAL_OPTIONS).toContain(
        mockSettings.background_scan_interval as (typeof SETTINGS_INTERVAL_OPTIONS)[number]
      );
    });

    it("remediation_check_interval is a valid option", () => {
      expect(SETTINGS_INTERVAL_OPTIONS).toContain(
        mockSettings.remediation_check_interval as (typeof SETTINGS_INTERVAL_OPTIONS)[number]
      );
    });
  });
});
