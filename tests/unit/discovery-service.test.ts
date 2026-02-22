import { describe, it, expect, vi, beforeEach } from "vitest";
import { MicrosoftDiscoveryService } from "@/lib/providers/microsoft/discovery-service";
import type { MicrosoftGraphClient } from "@/lib/providers/microsoft/graph-client";

function createMockGraphClient() {
  return {
    getUser: vi.fn(),
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

describe("MicrosoftDiscoveryService", () => {
  let mockClient: ReturnType<typeof createMockGraphClient>;
  let discovery: MicrosoftDiscoveryService;

  beforeEach(() => {
    mockClient = createMockGraphClient();
    discovery = new MicrosoftDiscoveryService(
      mockClient as unknown as MicrosoftGraphClient,
    );
  });

  it("reports isConfigured when graph client is provided", () => {
    expect(discovery.isConfigured).toBe(true);
  });

  it("reports not configured when no client", () => {
    const d = new MicrosoftDiscoveryService(undefined);
    expect(d.isConfigured).toBe(false);
  });

  describe("discoverUserAccess", () => {
    it("returns error when user not found", async () => {
      mockClient.getUser.mockResolvedValue(null);

      const result = await discovery.discoverUserAccess("unknown@test.com");
      expect(result.user).toBeNull();
      expect(result.error).toContain("User not found");
      expect(result.artifacts).toHaveLength(0);
    });

    it("discovers OAuth grants as artifacts", async () => {
      mockClient.getUser.mockResolvedValue({
        id: "user-001",
        displayName: "Test User",
        userPrincipalName: "test@test.com",
        accountEnabled: true,
      });

      mockClient.listUserOAuthGrants.mockResolvedValue([
        {
          id: "grant-1",
          clientId: "sp-teams",
          resourceId: "res-1",
          scope: "Chat.ReadWrite Files.Read",
          consentType: "Principal",
          principalId: "user-001",
        },
      ]);

      mockClient.getServicePrincipal.mockResolvedValue({
        id: "sp-teams",
        appId: "teams-app-id",
        displayName: "Microsoft Teams",
      });

      const result = await discovery.discoverUserAccess("test@test.com", "case-001");

      expect(result.user?.displayName).toBe("Test User");
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].app_display_name).toBe("Microsoft Teams");
      expect(result.artifacts[0].artifact_type).toBe("OAuthToken");
      expect(result.artifacts[0].status).toBe("Active");
      expect(result.artifacts[0].case).toBe("case-001");

      const scopes = JSON.parse(result.artifacts[0].scopes_json || "[]");
      expect(scopes).toContain("Chat.ReadWrite");
      expect(scopes).toContain("Files.Read");
    });

    it("discovers app role assignments as artifacts", async () => {
      mockClient.getUser.mockResolvedValue({
        id: "user-001",
        displayName: "Test User",
        userPrincipalName: "test@test.com",
        accountEnabled: true,
      });

      mockClient.listUserAppRoleAssignments.mockResolvedValue([
        {
          id: "role-1",
          appRoleId: "role-read",
          principalDisplayName: "Test User",
          principalId: "user-001",
          principalType: "User",
          resourceDisplayName: "My App",
          resourceId: "res-app",
          createdDateTime: "2024-01-01T00:00:00Z",
        },
      ]);

      const result = await discovery.discoverUserAccess("test@test.com");

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].app_display_name).toBe("My App");
      expect(result.artifacts[0].name).toContain("ms-role-");
    });

    it("generates findings for disabled user with active grants", async () => {
      mockClient.getUser.mockResolvedValue({
        id: "user-001",
        displayName: "Disabled User",
        userPrincipalName: "disabled@test.com",
        accountEnabled: false,
      });

      mockClient.listUserOAuthGrants.mockResolvedValue([
        {
          id: "grant-1",
          clientId: "sp-1",
          resourceId: "res-1",
          scope: "Mail.ReadWrite",
          consentType: "Principal",
        },
      ]);

      const result = await discovery.discoverUserAccess("disabled@test.com", "case-002");

      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings.some((f) => f.finding_type === "LingeringOAuthGrant")).toBe(true);
    });

    it("generates critical finding for high-risk scopes", async () => {
      mockClient.getUser.mockResolvedValue({
        id: "user-001",
        displayName: "Risky User",
        userPrincipalName: "risky@test.com",
        accountEnabled: true,
      });

      mockClient.listUserOAuthGrants.mockResolvedValue([
        {
          id: "grant-1",
          clientId: "sp-1",
          resourceId: "res-1",
          scope: "Mail.ReadWrite Mail.Send Files.ReadWrite.All",
          consentType: "Principal",
        },
      ]);

      const result = await discovery.discoverUserAccess("risky@test.com");

      const criticalFinding = result.findings.find((f) => f.severity === "Critical");
      expect(criticalFinding).toBeDefined();
    });

    it("assesses risk level correctly", async () => {
      mockClient.getUser.mockResolvedValue({
        id: "user-001",
        displayName: "Test",
        userPrincipalName: "test@test.com",
        accountEnabled: true,
      });

      mockClient.listUserOAuthGrants.mockResolvedValue([
        {
          id: "g1",
          clientId: "sp-1",
          resourceId: "r1",
          scope: "User.Read openid profile",
          consentType: "Principal",
        },
        {
          id: "g2",
          clientId: "sp-2",
          resourceId: "r2",
          scope: "Files.ReadWrite.All Directory.ReadWrite.All",
          consentType: "Principal",
        },
      ]);

      const result = await discovery.discoverUserAccess("test@test.com");

      const lowRisk = result.artifacts.find((a) => a.name === "ms-grant-g1");
      const highRisk = result.artifacts.find((a) => a.name === "ms-grant-g2");
      expect(lowRisk?.risk_level).toBe("Low");
      expect(highRisk?.risk_level).toBe("High");
    });

    it("handles Graph API failures gracefully", async () => {
      mockClient.getUser.mockResolvedValue({
        id: "user-001",
        displayName: "Test",
        userPrincipalName: "test@test.com",
        accountEnabled: true,
      });
      mockClient.listUserOAuthGrants.mockRejectedValue(new Error("Permission denied"));
      mockClient.listUserAppRoleAssignments.mockRejectedValue(new Error("Permission denied"));

      const result = await discovery.discoverUserAccess("test@test.com");
      expect(result.artifacts).toHaveLength(0);
      expect(result.user).toBeDefined();
    });
  });

  describe("hasActiveAccess", () => {
    it("returns true when user has grants", async () => {
      mockClient.getUser.mockResolvedValue({ id: "user-001" });
      mockClient.listUserOAuthGrants.mockResolvedValue([{ id: "g1" }]);

      expect(await discovery.hasActiveAccess("test@test.com")).toBe(true);
    });

    it("returns false when user has no access", async () => {
      mockClient.getUser.mockResolvedValue({ id: "user-001" });
      expect(await discovery.hasActiveAccess("test@test.com")).toBe(false);
    });

    it("returns false when not configured", async () => {
      const d = new MicrosoftDiscoveryService(undefined);
      expect(await d.hasActiveAccess("test@test.com")).toBe(false);
    });
  });
});
