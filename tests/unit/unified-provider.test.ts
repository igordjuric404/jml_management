import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/providers/frappe/client", () => ({
  frappeGetList: vi.fn(),
  frappeLogin: vi.fn(),
  setFrappeCookies: vi.fn(),
  frappeCall: vi.fn(),
  frappeGetDoc: vi.fn(),
}));

import { UnifiedProvider } from "@/lib/providers/unified-provider";
import { MicrosoftDiscoveryService } from "@/lib/providers/microsoft/discovery-service";
import { MicrosoftRemediationService } from "@/lib/providers/microsoft/remediation-service";
import { LocalStore } from "@/lib/store/local-store";
import { frappeGetList } from "@/lib/providers/frappe/client";
import type { MicrosoftGraphClient } from "@/lib/providers/microsoft/graph-client";

function createMockGraphClient() {
  return {
    getUser: vi.fn().mockResolvedValue({
      id: "user-001",
      displayName: "Test User",
      userPrincipalName: "test@test.com",
      accountEnabled: true,
    }),
    listUsers: vi.fn().mockResolvedValue([]),
    listUserOAuthGrants: vi.fn().mockResolvedValue([]),
    listUserAppRoleAssignments: vi.fn().mockResolvedValue([]),
    deleteOAuthGrant: vi.fn().mockResolvedValue(undefined),
    updateOAuthGrantScopes: vi.fn().mockResolvedValue(undefined),
    deleteAppRoleAssignment: vi.fn().mockResolvedValue(undefined),
    revokeSignInSessions: vi.fn().mockResolvedValue(true),
    listSignIns: vi.fn().mockResolvedValue([]),
    getServicePrincipal: vi.fn().mockResolvedValue(null),
    getUserLicenseDetails: vi.fn().mockResolvedValue([]),
  };
}

function createMockStore(): LocalStore {
  return {
    listCases: vi.fn().mockResolvedValue([]),
    getCase: vi.fn().mockResolvedValue({
      name: "case-001",
      employee: "EMP-001",
      employee_name: "Test User",
      primary_email: "test@test.com",
      event_type: "Offboard",
      effective_date: "2026-01-01",
      status: "Gaps Found",
      notify_user_1w: false,
      notify_user_1d: false,
    }),
    createCase: vi.fn().mockResolvedValue({
      name: "case-new",
      employee: "EMP-002",
      employee_name: "New User",
      primary_email: "new@test.com",
      event_type: "Offboard",
      status: "Draft",
      effective_date: "",
      notify_user_1w: false,
      notify_user_1d: false,
    }),
    updateCase: vi.fn().mockResolvedValue({
      name: "case-001",
      employee: "EMP-001",
      employee_name: "Test User",
      primary_email: "test@test.com",
      event_type: "Offboard",
      status: "Remediated",
      effective_date: "2026-01-01",
      notify_user_1w: false,
      notify_user_1d: false,
    }),
    findCaseByEmail: vi.fn().mockResolvedValue(null),
    listFindings: vi.fn().mockResolvedValue([]),
    getFinding: vi.fn().mockResolvedValue(null),
    createFinding: vi.fn().mockResolvedValue({ name: "fnd-001" }),
    closeFinding: vi.fn().mockResolvedValue({ name: "fnd-001" }),
    findingsForCase: vi.fn().mockResolvedValue([]),
    listAuditLogs: vi.fn().mockResolvedValue([]),
    logAction: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({
      auto_scan_on_offboard: false,
      auto_remediate_on_offboard: false,
      background_scan_enabled: false,
      auto_create_case_on_leave: true,
      background_scan_interval: "daily",
      remediation_check_interval: "6h",
      notify_on_new_findings: true,
      notify_on_remediation: true,
      default_remediation_action: "full_bundle",
    }),
    updateSettings: vi.fn().mockResolvedValue({}),
  } as unknown as LocalStore;
}

describe("UnifiedProvider", () => {
  let mockGraphClient: ReturnType<typeof createMockGraphClient>;
  let mockStore: LocalStore;
  let provider: UnifiedProvider;

  beforeEach(() => {
    mockGraphClient = createMockGraphClient();
    mockStore = createMockStore();

    const discovery = new MicrosoftDiscoveryService(
      mockGraphClient as unknown as MicrosoftGraphClient,
    );
    const remediation = new MicrosoftRemediationService(
      mockGraphClient as unknown as MicrosoftGraphClient,
    );

    provider = new UnifiedProvider(discovery, remediation, mockStore);
  });

  it("has name 'unified'", () => {
    expect(provider.name).toBe("unified");
  });

  describe("employees from Frappe", () => {
    it("reads employees from Frappe and enriches with case counts", async () => {
      vi.mocked(frappeGetList).mockResolvedValue([
        {
          name: "EMP-001",
          employee_name: "Angelina Jolie",
          company_email: "angelina@test.com",
          status: "Left",
          department: "Marketing",
        },
      ]);

      const employees = await provider.getEmployeeList();

      expect(employees).toHaveLength(1);
      expect(employees[0].employee_name).toBe("Angelina Jolie");
      expect(employees[0].emp_status).toBe("Left");
      expect(frappeGetList).toHaveBeenCalledWith("Employee", expect.any(Object));
    });
  });

  describe("cases from local store", () => {
    it("lists cases from SQLite", async () => {
      await provider.listCases();
      expect(mockStore.listCases).toHaveBeenCalled();
    });

    it("creates cases in SQLite", async () => {
      const result = await provider.createCase({ employee_name: "New" });
      expect(mockStore.createCase).toHaveBeenCalled();
      expect(result.name).toBe("case-new");
    });
  });

  describe("artifacts from Graph API (live)", () => {
    it("getCaseDetail returns live artifacts from Graph API", async () => {
      mockGraphClient.listUserOAuthGrants.mockResolvedValue([
        {
          id: "grant-1",
          clientId: "sp-1",
          resourceId: "res-1",
          scope: "Mail.ReadWrite",
          consentType: "Principal",
        },
      ]);

      const detail = await provider.getCaseDetail("case-001");

      expect(detail.case.name).toBe("case-001");
      expect(detail.artifacts.tokens).toHaveLength(1);
      expect(detail.artifacts.tokens[0].app_display_name).toBeDefined();
      expect(detail.artifacts.total).toBe(1);
    });
  });

  describe("scanning queries Graph API", () => {
    it("triggerScan discovers real artifacts and stores findings", async () => {
      mockGraphClient.listUserOAuthGrants.mockResolvedValue([
        {
          id: "grant-1",
          clientId: "sp-1",
          resourceId: "res-1",
          scope: "Files.ReadWrite.All",
          consentType: "Principal",
        },
      ]);

      const result = await provider.triggerScan("case-001");

      expect(result.status).toBe("success");
      expect(result.message).toContain("1 live Microsoft 365 artifacts found");
      expect(mockGraphClient.getUser).toHaveBeenCalledWith("test@test.com");
      expect(mockStore.updateCase).toHaveBeenCalled();
      expect(mockStore.logAction).toHaveBeenCalled();
    });
  });

  describe("remediation uses Graph API", () => {
    it("full_bundle calls Graph API to revoke grants and sessions", async () => {
      mockGraphClient.getUser.mockResolvedValue({
        id: "user-001",
        displayName: "Test",
        userPrincipalName: "test@test.com",
        accountEnabled: true,
      });

      const result = await provider.executeRemediation("case-001", "full_bundle");

      expect(result.status).toBe("success");
      expect(result.action).toBe("full_bundle");
      expect(mockGraphClient.revokeSignInSessions).toHaveBeenCalled();
      expect(mockStore.updateCase).toHaveBeenCalled();
      expect(mockStore.logAction).toHaveBeenCalled();
    });
  });

  describe("settings from local store", () => {
    it("reads settings from SQLite", async () => {
      const settings = await provider.getSettings();
      expect(settings.auto_create_case_on_leave).toBe(true);
      expect(mockStore.getSettings).toHaveBeenCalled();
    });
  });
});
