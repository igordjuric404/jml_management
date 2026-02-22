/**
 * End-to-end integration test for the Microsoft 365 enhanced remediation flow.
 *
 * Validates the full pipeline: MicrosoftEnhancedProvider wraps a stubbed inner
 * provider, calls MicrosoftRemediationService (with mocked Graph client),
 * then delegates to the inner provider for DB updates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MicrosoftEnhancedProvider } from "@/lib/providers/microsoft/enhanced-provider";
import { MicrosoftRemediationService } from "@/lib/providers/microsoft/remediation-service";
import type { MicrosoftGraphClient } from "@/lib/providers/microsoft/graph-client";
import type { HrProvider } from "@/lib/providers/interface";

function createMockGraphClient() {
  return {
    getUser: vi.fn().mockResolvedValue({
      id: "azure-user-id-001",
      displayName: "Test User",
      userPrincipalName: "test@sarmateam.onmicrosoft.com",
      accountEnabled: false,
    }),
    listUsers: vi.fn().mockResolvedValue([]),
    listUserOAuthGrants: vi.fn().mockResolvedValue([
      { id: "graph-grant-1", clientId: "sp-google-drive", scope: "Files.ReadWrite", consentType: "Principal" },
      { id: "graph-grant-2", clientId: "sp-github", scope: "repo user", consentType: "Principal" },
    ]),
    deleteOAuthGrant: vi.fn().mockResolvedValue(undefined),
    updateOAuthGrantScopes: vi.fn().mockResolvedValue(undefined),
    listUserAppRoleAssignments: vi.fn().mockResolvedValue([]),
    deleteAppRoleAssignment: vi.fn().mockResolvedValue(undefined),
    revokeSignInSessions: vi.fn().mockResolvedValue(true),
    listSignIns: vi.fn().mockResolvedValue([]),
    getServicePrincipal: vi.fn().mockResolvedValue(null),
    getUserLicenseDetails: vi.fn().mockResolvedValue([]),
  };
}

function createStubProvider(): HrProvider {
  return {
    name: "stub",
    authenticate: vi.fn().mockResolvedValue({ user: "admin", full_name: "Admin", roles: ["System Manager"] }),
    logout: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(null),
    getDashboardStats: vi.fn().mockResolvedValue({ kpis: { total_cases: 1, pending_scan: 0, critical_gaps: 0, oauth_grants: 0, post_offboard_logins: 0 }, top_oauth_apps: [], risky_cases: [] }),
    getStatistics: vi.fn().mockResolvedValue({ total_employees: 1, total_cases: 1 }),
    listCases: vi.fn().mockResolvedValue([{ name: "OBC-001", employee_name: "Test User", primary_email: "test@sarmateam.onmicrosoft.com", status: "Gaps Found" }]),
    getCaseDetail: vi.fn().mockResolvedValue({
      case: { name: "OBC-001", employee_name: "Test User", primary_email: "test@sarmateam.onmicrosoft.com", status: "Gaps Found" },
      artifacts: { tokens: [{ name: "ART-001", status: "Active", artifact_type: "OAuthToken", client_id: "sp-google-drive" }], asps: [], login_events: [] },
      findings: [],
    }),
    createCase: vi.fn().mockResolvedValue({ name: "OBC-002" }),
    createCaseFromEmployee: vi.fn().mockResolvedValue({ name: "OBC-003" }),
    updateCase: vi.fn().mockResolvedValue({ name: "OBC-001" }),
    triggerScan: vi.fn().mockResolvedValue({ status: "success", message: "Scan completed" }),
    systemScan: vi.fn().mockResolvedValue({ status: "success", message: "System scan completed" }),
    getScanHistory: vi.fn().mockResolvedValue([]),
    executeRemediation: vi.fn().mockResolvedValue({ status: "success", action: "full_bundle", revoked: 2 }),
    bulkRemediate: vi.fn().mockResolvedValue({ status: "success", artifacts_remediated: 1 }),
    remediateArtifacts: vi.fn().mockResolvedValue({ status: "success", artifacts_remediated: 1 }),
    runScheduledRemediationNow: vi.fn().mockResolvedValue({ status: "success" }),
    listArtifacts: vi.fn().mockResolvedValue([]),
    getArtifact: vi.fn().mockResolvedValue({ name: "ART-001", artifact_type: "OAuthToken", client_id: "sp-google-drive", subject_email: "test@sarmateam.onmicrosoft.com", status: "Active" }),
    listFindings: vi.fn().mockResolvedValue([]),
    getFinding: vi.fn().mockResolvedValue({ name: "FND-001", finding_type: "LingeringOAuthGrant", case: "OBC-001" }),
    remediateFinding: vi.fn().mockResolvedValue({ status: "success" }),
    getEmployeeList: vi.fn().mockResolvedValue([{ employee_id: "EMP-001", employee_name: "Test User", company_email: "test@sarmateam.onmicrosoft.com", emp_status: "Left" }]),
    getEmployeeDetail: vi.fn().mockResolvedValue({ employee: { employee_id: "EMP-001", employee_name: "Test User", email: "test@sarmateam.onmicrosoft.com" }, cases: [], artifacts: [] }),
    revokeEmployeeAccess: vi.fn().mockResolvedValue({ status: "success", revoked: 1 }),
    getAllActiveOAuthApps: vi.fn().mockResolvedValue([]),
    getAppDetail: vi.fn().mockResolvedValue({ app: { client_id: "sp-google-drive" }, users: [{ email: "test@sarmateam.onmicrosoft.com", status: "Active" }] }),
    globalAppRemoval: vi.fn().mockResolvedValue({ status: "success" }),
    revokeAppForUsers: vi.fn().mockResolvedValue({ status: "success" }),
    restoreAppForUsers: vi.fn().mockResolvedValue({ status: "success" }),
    updateUserScopes: vi.fn().mockResolvedValue({ removed: 0, added: 0 }),
    listAuditLogs: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({}),
    updateSettings: vi.fn().mockResolvedValue({}),
    chat: vi.fn().mockResolvedValue({ reply: "", sources: [] }),
  } as unknown as HrProvider;
}

describe("Microsoft 365 E2E Remediation Flow", () => {
  let mockGraphClient: ReturnType<typeof createMockGraphClient>;
  let msService: MicrosoftRemediationService;
  let stubProvider: HrProvider;
  let enhancedProvider: MicrosoftEnhancedProvider;

  beforeEach(() => {
    mockGraphClient = createMockGraphClient();
    msService = new MicrosoftRemediationService(
      mockGraphClient as unknown as MicrosoftGraphClient,
    );
    stubProvider = createStubProvider();
    enhancedProvider = new MicrosoftEnhancedProvider(stubProvider, msService);
  });

  describe("full_bundle remediation", () => {
    it("revokes Graph API grants + sessions THEN delegates to inner provider", async () => {
      const result = await enhancedProvider.executeRemediation("OBC-001", "full_bundle");

      expect(result.status).toBe("success");
      expect(result.action).toBe("full_bundle");

      expect(mockGraphClient.getUser).toHaveBeenCalledWith("test@sarmateam.onmicrosoft.com");
      expect(mockGraphClient.listUserOAuthGrants).toHaveBeenCalledWith("azure-user-id-001");
      expect(mockGraphClient.deleteOAuthGrant).toHaveBeenCalledTimes(2);
      expect(mockGraphClient.revokeSignInSessions).toHaveBeenCalledWith("test@sarmateam.onmicrosoft.com");

      expect(stubProvider.executeRemediation).toHaveBeenCalledWith("OBC-001", "full_bundle", undefined);
    });
  });

  describe("revoke_token remediation", () => {
    it("revokes Graph grants then delegates to inner provider", async () => {
      const result = await enhancedProvider.executeRemediation("OBC-001", "revoke_token");

      expect(result.status).toBe("success");
      expect(mockGraphClient.getUser).toHaveBeenCalled();
      expect(mockGraphClient.deleteOAuthGrant).toHaveBeenCalledTimes(2);
      expect(mockGraphClient.revokeSignInSessions).not.toHaveBeenCalled();
    });
  });

  describe("sign_out remediation", () => {
    it("revokes sessions via Graph then delegates", async () => {
      const result = await enhancedProvider.executeRemediation("OBC-001", "sign_out");

      expect(result.status).toBe("success");
      expect(mockGraphClient.revokeSignInSessions).toHaveBeenCalledWith("test@sarmateam.onmicrosoft.com");
      expect(mockGraphClient.deleteOAuthGrant).not.toHaveBeenCalled();
    });
  });

  describe("employee access revocation", () => {
    it("calls Graph fullRemediation for scope=all", async () => {
      const result = await enhancedProvider.revokeEmployeeAccess("EMP-001", "all");

      expect(result.status).toBe("success");
      expect(mockGraphClient.getUser).toHaveBeenCalled();
      expect(mockGraphClient.deleteOAuthGrant).toHaveBeenCalled();
      expect(mockGraphClient.revokeSignInSessions).toHaveBeenCalled();
    });
  });

  describe("graceful degradation", () => {
    it("proceeds with inner provider remediation if Graph API call fails", async () => {
      mockGraphClient.getUser.mockRejectedValue(new Error("Graph API timeout"));

      const result = await enhancedProvider.executeRemediation("OBC-001", "full_bundle");

      expect(result.status).toBe("success");
      expect(stubProvider.executeRemediation).toHaveBeenCalled();
    });

    it("works without MS configuration", async () => {
      const saved = {
        tid: process.env.MICROSOFT_TENANT_ID,
        cid: process.env.MICROSOFT_CLIENT_ID,
        cs: process.env.MICROSOFT_CLIENT_SECRET,
      };
      delete process.env.MICROSOFT_TENANT_ID;
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;

      try {
        const unconfiguredMs = new MicrosoftRemediationService();
        const unconfiguredProvider = new MicrosoftEnhancedProvider(stubProvider, unconfiguredMs);

        const result = await unconfiguredProvider.executeRemediation("OBC-001", "full_bundle");

        expect(result.status).toBe("success");
        expect(mockGraphClient.getUser).not.toHaveBeenCalled();
      } finally {
        process.env.MICROSOFT_TENANT_ID = saved.tid;
        process.env.MICROSOFT_CLIENT_ID = saved.cid;
        process.env.MICROSOFT_CLIENT_SECRET = saved.cs;
      }
    });
  });

  describe("pass-through operations", () => {
    it("delegates getDashboardStats to inner provider", async () => {
      const stats = await enhancedProvider.getDashboardStats();
      expect(stats.kpis).toBeDefined();
      expect(stubProvider.getDashboardStats).toHaveBeenCalled();
    });

    it("delegates listCases to inner provider", async () => {
      const cases = await enhancedProvider.listCases();
      expect(cases.length).toBe(1);
      expect(stubProvider.listCases).toHaveBeenCalled();
    });

    it("delegates getEmployeeList to inner provider", async () => {
      const employees = await enhancedProvider.getEmployeeList();
      expect(employees.length).toBe(1);
      expect(stubProvider.getEmployeeList).toHaveBeenCalled();
    });
  });
});
