import { describe, it, expect, vi, beforeEach } from "vitest";
import { MicrosoftEnhancedProvider } from "@/lib/providers/microsoft/enhanced-provider";
import { MicrosoftRemediationService } from "@/lib/providers/microsoft/remediation-service";
import type { HrProvider } from "@/lib/providers/interface";

function createMockProvider(): { [K in keyof HrProvider]: ReturnType<typeof vi.fn> } {
  return {
    name: "mock-inner" as unknown as ReturnType<typeof vi.fn>,
    authenticate: vi.fn(),
    logout: vi.fn(),
    getSession: vi.fn(),
    getDashboardStats: vi.fn(),
    getStatistics: vi.fn(),
    listCases: vi.fn(),
    getCaseDetail: vi.fn(),
    createCase: vi.fn(),
    createCaseFromEmployee: vi.fn(),
    updateCase: vi.fn(),
    triggerScan: vi.fn(),
    systemScan: vi.fn(),
    getScanHistory: vi.fn(),
    executeRemediation: vi.fn(),
    bulkRemediate: vi.fn(),
    remediateArtifacts: vi.fn(),
    runScheduledRemediationNow: vi.fn(),
    listArtifacts: vi.fn(),
    getArtifact: vi.fn(),
    listFindings: vi.fn(),
    getFinding: vi.fn(),
    remediateFinding: vi.fn(),
    getEmployeeList: vi.fn(),
    getEmployeeDetail: vi.fn(),
    revokeEmployeeAccess: vi.fn(),
    getAllActiveOAuthApps: vi.fn(),
    getAppDetail: vi.fn(),
    globalAppRemoval: vi.fn(),
    revokeAppForUsers: vi.fn(),
    restoreAppForUsers: vi.fn(),
    updateUserScopes: vi.fn(),
    listAuditLogs: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    chat: vi.fn(),
  };
}

function createMockMs() {
  const mock = {
    _isConfigured: true,
    get isConfigured() { return this._isConfigured; },
    set isConfigured(v: boolean) { this._isConfigured = v; },
    revokeOAuthGrant: vi.fn().mockResolvedValue({ success: true, action: "revokeOAuthGrant", details: {} }),
    revokeAllOAuthGrants: vi.fn().mockResolvedValue({ success: true, action: "revokeAllOAuthGrants", details: {} }),
    revokeOAuthGrantsForApp: vi.fn().mockResolvedValue({ success: true, action: "revokeOAuthGrantsForApp", details: {} }),
    revokeSignInSessions: vi.fn().mockResolvedValue({ success: true, action: "revokeSignInSessions", details: {} }),
    fullRemediation: vi.fn().mockResolvedValue({ success: true, action: "fullRemediation", details: {} }),
    updateGrantScopes: vi.fn().mockResolvedValue({ success: true, action: "updateGrantScopes", details: {} }),
    getUserOAuthGrants: vi.fn().mockResolvedValue([]),
    isUserDisabled: vi.fn().mockResolvedValue(false),
  };
  return mock;
}

describe("MicrosoftEnhancedProvider", () => {
  let mockInner: ReturnType<typeof createMockProvider>;
  let mockMs: ReturnType<typeof createMockMs>;
  let provider: MicrosoftEnhancedProvider;

  beforeEach(() => {
    mockInner = createMockProvider();
    mockMs = createMockMs();
    provider = new MicrosoftEnhancedProvider(
      mockInner as unknown as HrProvider,
      mockMs as unknown as MicrosoftRemediationService,
    );
  });

  describe("pass-through operations", () => {
    it("delegates getDashboardStats to inner provider", async () => {
      const mockStats = { kpis: {}, top_oauth_apps: [], risky_cases: [] };
      mockInner.getDashboardStats.mockResolvedValueOnce(mockStats);

      const result = await provider.getDashboardStats();
      expect(result).toBe(mockStats);
      expect(mockInner.getDashboardStats).toHaveBeenCalledOnce();
    });

    it("delegates listCases to inner provider", async () => {
      mockInner.listCases.mockResolvedValueOnce([]);
      await provider.listCases();
      expect(mockInner.listCases).toHaveBeenCalledOnce();
    });

    it("delegates authenticate to inner provider", async () => {
      mockInner.authenticate.mockResolvedValueOnce({ user: "admin", full_name: "Admin", roles: [] });
      await provider.authenticate("admin", "pass");
      expect(mockInner.authenticate).toHaveBeenCalledWith("admin", "pass");
    });
  });

  describe("executeRemediation", () => {
    const caseDetail = {
      case: { name: "OBC-001", primary_email: "user@test.com" },
      artifacts: { tokens: [], asps: [], login_events: [], other: [], total: 0 },
      findings: [],
      audit_logs: [],
    };

    beforeEach(() => {
      mockInner.getCaseDetail.mockResolvedValue(caseDetail);
      mockInner.executeRemediation.mockResolvedValue({ status: "success" });
    });

    it("calls MS Graph fullRemediation then inner provider for full_bundle", async () => {
      await provider.executeRemediation("OBC-001", "full_bundle");

      expect(mockMs.fullRemediation).toHaveBeenCalledWith("user@test.com");
      expect(mockInner.executeRemediation).toHaveBeenCalledWith("OBC-001", "full_bundle", undefined);
    });

    it("calls MS Graph revokeAllOAuthGrants for revoke_token", async () => {
      await provider.executeRemediation("OBC-001", "revoke_token");

      expect(mockMs.revokeAllOAuthGrants).toHaveBeenCalledWith("user@test.com");
      expect(mockInner.executeRemediation).toHaveBeenCalledWith("OBC-001", "revoke_token", undefined);
    });

    it("calls MS Graph revokeOAuthGrantsForApp for revoke_token with client_id", async () => {
      await provider.executeRemediation("OBC-001", "revoke_token", { client_id: "app-123" });

      expect(mockMs.revokeOAuthGrantsForApp).toHaveBeenCalledWith("user@test.com", "app-123");
    });

    it("calls MS Graph revokeSignInSessions for sign_out", async () => {
      await provider.executeRemediation("OBC-001", "sign_out");

      expect(mockMs.revokeSignInSessions).toHaveBeenCalledWith("user@test.com");
    });

    it("still calls inner provider even if MS Graph fails", async () => {
      mockMs.fullRemediation.mockRejectedValueOnce(new Error("Graph error"));

      const result = await provider.executeRemediation("OBC-001", "full_bundle");

      expect(result).toEqual({ status: "success" });
      expect(mockInner.executeRemediation).toHaveBeenCalled();
    });

    it("skips MS Graph when not configured", async () => {
      mockMs.isConfigured = false;

      await provider.executeRemediation("OBC-001", "full_bundle");

      expect(mockMs.fullRemediation).not.toHaveBeenCalled();
      expect(mockInner.executeRemediation).toHaveBeenCalled();
    });
  });

  describe("revokeEmployeeAccess", () => {
    beforeEach(() => {
      mockInner.getEmployeeDetail.mockResolvedValue({
        employee: { email: "emp@test.com" },
        summary: {},
      });
      mockInner.revokeEmployeeAccess.mockResolvedValue({ status: "success" });
    });

    it("calls MS Graph fullRemediation for scope='all'", async () => {
      await provider.revokeEmployeeAccess("EMP-001", "all");

      expect(mockMs.fullRemediation).toHaveBeenCalledWith("emp@test.com");
      expect(mockInner.revokeEmployeeAccess).toHaveBeenCalledWith("EMP-001", "all");
    });

    it("calls MS Graph revokeAllOAuthGrants for scope='tokens'", async () => {
      await provider.revokeEmployeeAccess("EMP-001", "tokens");

      expect(mockMs.revokeAllOAuthGrants).toHaveBeenCalledWith("emp@test.com");
    });

    it("calls MS Graph revokeSignInSessions for scope='sign_out'", async () => {
      await provider.revokeEmployeeAccess("EMP-001", "sign_out");

      expect(mockMs.revokeSignInSessions).toHaveBeenCalledWith("emp@test.com");
    });
  });

  describe("globalAppRemoval", () => {
    it("revokes grants for all active users of the app", async () => {
      mockInner.getAppDetail.mockResolvedValue({
        users: [
          { email: "user1@test.com", status: "Active" },
          { email: "user2@test.com", status: "Active" },
          { email: "user3@test.com", status: "Revoked" },
        ],
      });
      mockInner.globalAppRemoval.mockResolvedValue({ status: "success" });

      await provider.globalAppRemoval("client-123", "MyApp");

      expect(mockMs.revokeOAuthGrantsForApp).toHaveBeenCalledTimes(2);
      expect(mockMs.revokeOAuthGrantsForApp).toHaveBeenCalledWith("user1@test.com", "client-123");
      expect(mockMs.revokeOAuthGrantsForApp).toHaveBeenCalledWith("user2@test.com", "client-123");
      expect(mockInner.globalAppRemoval).toHaveBeenCalledWith("client-123", "MyApp");
    });
  });

  describe("revokeAppForUsers", () => {
    it("revokes grants per artifact's subject email", async () => {
      mockInner.getArtifact
        .mockResolvedValueOnce({ subject_email: "u1@test.com", artifact_type: "OAuthToken" })
        .mockResolvedValueOnce({ subject_email: "u2@test.com", artifact_type: "OAuthToken" });
      mockInner.revokeAppForUsers.mockResolvedValue({ status: "success" });

      await provider.revokeAppForUsers("client-123", ["ART-1", "ART-2"]);

      expect(mockMs.revokeOAuthGrantsForApp).toHaveBeenCalledTimes(2);
      expect(mockInner.revokeAppForUsers).toHaveBeenCalledWith("client-123", ["ART-1", "ART-2"]);
    });
  });

  describe("runScheduledRemediationNow", () => {
    it("calls fullRemediation before inner provider", async () => {
      mockInner.getCaseDetail.mockResolvedValue({
        case: { primary_email: "user@test.com" },
      });
      mockInner.runScheduledRemediationNow.mockResolvedValue({ status: "success" });

      await provider.runScheduledRemediationNow("OBC-001");

      expect(mockMs.fullRemediation).toHaveBeenCalledWith("user@test.com");
      expect(mockInner.runScheduledRemediationNow).toHaveBeenCalledWith("OBC-001");
    });
  });

  describe("remediateFinding", () => {
    it("calls revokeAllOAuthGrants for LingeringOAuthGrant finding", async () => {
      mockInner.getFinding.mockResolvedValue({
        name: "FND-1",
        case: "OBC-001",
        finding_type: "LingeringOAuthGrant",
      });
      mockInner.getCaseDetail.mockResolvedValue({
        case: { primary_email: "user@test.com" },
      });
      mockInner.remediateFinding.mockResolvedValue({ status: "success" });

      await provider.remediateFinding("FND-1");

      expect(mockMs.revokeAllOAuthGrants).toHaveBeenCalledWith("user@test.com");
      expect(mockInner.remediateFinding).toHaveBeenCalledWith("FND-1");
    });

    it("calls revokeSignInSessions for PostOffboardLogin finding", async () => {
      mockInner.getFinding.mockResolvedValue({
        name: "FND-2",
        case: "OBC-001",
        finding_type: "PostOffboardLogin",
      });
      mockInner.getCaseDetail.mockResolvedValue({
        case: { primary_email: "user@test.com" },
      });
      mockInner.remediateFinding.mockResolvedValue({ status: "success" });

      await provider.remediateFinding("FND-2");

      expect(mockMs.revokeSignInSessions).toHaveBeenCalledWith("user@test.com");
    });
  });
});
