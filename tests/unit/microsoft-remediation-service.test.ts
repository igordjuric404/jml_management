import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MicrosoftRemediationService } from "@/lib/providers/microsoft/remediation-service";
import type { MicrosoftGraphClient } from "@/lib/providers/microsoft/graph-client";

function createMockGraphClient(): {
  [K in keyof MicrosoftGraphClient]: ReturnType<typeof vi.fn>;
} {
  return {
    getUser: vi.fn(),
    listUsers: vi.fn(),
    listUserOAuthGrants: vi.fn(),
    deleteOAuthGrant: vi.fn(),
    updateOAuthGrantScopes: vi.fn(),
    listUserAppRoleAssignments: vi.fn(),
    deleteAppRoleAssignment: vi.fn(),
    revokeSignInSessions: vi.fn(),
    listSignIns: vi.fn(),
    getServicePrincipal: vi.fn(),
    getUserLicenseDetails: vi.fn().mockResolvedValue([]),
  };
}

describe("MicrosoftRemediationService", () => {
  let mockClient: ReturnType<typeof createMockGraphClient>;
  let service: MicrosoftRemediationService;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    mockClient = createMockGraphClient();
    service = new MicrosoftRemediationService(
      mockClient as unknown as MicrosoftGraphClient,
    );
  });

  describe("isConfigured", () => {
    it("returns true when client is provided", () => {
      expect(service.isConfigured).toBe(true);
    });

    it("returns false when no client or config available", () => {
      savedEnv.MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID;
      savedEnv.MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
      savedEnv.MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
      delete process.env.MICROSOFT_TENANT_ID;
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;

      const unconfigured = new MicrosoftRemediationService();
      expect(unconfigured.isConfigured).toBe(false);

      process.env.MICROSOFT_TENANT_ID = savedEnv.MICROSOFT_TENANT_ID;
      process.env.MICROSOFT_CLIENT_ID = savedEnv.MICROSOFT_CLIENT_ID;
      process.env.MICROSOFT_CLIENT_SECRET = savedEnv.MICROSOFT_CLIENT_SECRET;
    });
  });

  describe("when not configured", () => {
    let unconfiguredService: MicrosoftRemediationService;

    beforeEach(() => {
      savedEnv.MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID;
      savedEnv.MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
      savedEnv.MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
      delete process.env.MICROSOFT_TENANT_ID;
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;
      unconfiguredService = new MicrosoftRemediationService();
    });

    afterEach(() => {
      process.env.MICROSOFT_TENANT_ID = savedEnv.MICROSOFT_TENANT_ID;
      process.env.MICROSOFT_CLIENT_ID = savedEnv.MICROSOFT_CLIENT_ID;
      process.env.MICROSOFT_CLIENT_SECRET = savedEnv.MICROSOFT_CLIENT_SECRET;
    });

    it("revokeOAuthGrant returns skipped result", async () => {
      const result = await unconfiguredService.revokeOAuthGrant(
        "user@test.com",
        "grant-1",
      );
      expect(result.success).toBe(true);
      expect(result.details.skipped).toBe(true);
      expect(result.details.reason).toBe("Microsoft 365 not configured");
    });

    it("revokeAllOAuthGrants returns skipped result", async () => {
      const result = await unconfiguredService.revokeAllOAuthGrants("user@test.com");
      expect(result.success).toBe(true);
      expect(result.details.skipped).toBe(true);
    });

    it("revokeSignInSessions returns skipped result", async () => {
      const result = await unconfiguredService.revokeSignInSessions("user@test.com");
      expect(result.success).toBe(true);
      expect(result.details.skipped).toBe(true);
    });

    it("fullRemediation returns skipped result", async () => {
      const result = await unconfiguredService.fullRemediation("user@test.com");
      expect(result.success).toBe(true);
      expect(result.details.skipped).toBe(true);
    });

    it("getUserOAuthGrants returns empty array", async () => {
      const grants = await unconfiguredService.getUserOAuthGrants("user@test.com");
      expect(grants).toEqual([]);
    });

    it("isUserDisabled returns null", async () => {
      const result = await unconfiguredService.isUserDisabled("user@test.com");
      expect(result).toBeNull();
    });
  });

  describe("revokeOAuthGrant", () => {
    it("deletes the grant via Graph API", async () => {
      mockClient.deleteOAuthGrant.mockResolvedValueOnce(undefined);

      const result = await service.revokeOAuthGrant("user@test.com", "grant-123");

      expect(result.success).toBe(true);
      expect(result.action).toBe("revokeOAuthGrant");
      expect(result.details.grantId).toBe("grant-123");
      expect(mockClient.deleteOAuthGrant).toHaveBeenCalledWith("grant-123");
    });

    it("returns error result on failure", async () => {
      mockClient.deleteOAuthGrant.mockRejectedValueOnce(
        new Error("Access denied"),
      );

      const result = await service.revokeOAuthGrant("user@test.com", "grant-123");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });
  });

  describe("revokeAllOAuthGrants", () => {
    it("revokes all grants for a user", async () => {
      mockClient.getUser.mockResolvedValueOnce({
        id: "user-id-123",
        userPrincipalName: "user@test.com",
      });
      mockClient.listUserOAuthGrants.mockResolvedValueOnce([
        { id: "grant-1", clientId: "app-1", scope: "User.Read" },
        { id: "grant-2", clientId: "app-2", scope: "Mail.Read" },
      ]);
      mockClient.deleteOAuthGrant.mockResolvedValue(undefined);

      const result = await service.revokeAllOAuthGrants("user@test.com");

      expect(result.success).toBe(true);
      expect(result.details.totalGrants).toBe(2);
      expect(result.details.revoked).toBe(2);
      expect(result.details.failed).toBe(0);
      expect(mockClient.deleteOAuthGrant).toHaveBeenCalledTimes(2);
    });

    it("returns error when user not found", async () => {
      mockClient.getUser.mockResolvedValueOnce(null);

      const result = await service.revokeAllOAuthGrants("unknown@test.com");
      expect(result.success).toBe(false);
      expect(result.error).toContain("User not found");
    });

    it("handles partial failures gracefully", async () => {
      mockClient.getUser.mockResolvedValueOnce({ id: "user-id-123" });
      mockClient.listUserOAuthGrants.mockResolvedValueOnce([
        { id: "grant-1" },
        { id: "grant-2" },
      ]);
      mockClient.deleteOAuthGrant
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Timeout"));

      const result = await service.revokeAllOAuthGrants("user@test.com");

      expect(result.success).toBe(true);
      expect(result.details.revoked).toBe(1);
      expect(result.details.failed).toBe(1);
    });
  });

  describe("revokeOAuthGrantsForApp", () => {
    it("revokes grants matching a specific app", async () => {
      mockClient.getUser.mockResolvedValueOnce({ id: "user-id-123" });
      mockClient.getServicePrincipal.mockResolvedValueOnce({
        id: "sp-id-456",
        appId: "app-client-id",
      });
      mockClient.listUserOAuthGrants.mockResolvedValueOnce([
        { id: "grant-1", clientId: "sp-id-456", scope: "User.Read" },
        { id: "grant-2", clientId: "other-sp", scope: "Mail.Read" },
      ]);
      mockClient.deleteOAuthGrant.mockResolvedValue(undefined);

      const result = await service.revokeOAuthGrantsForApp(
        "user@test.com",
        "app-client-id",
      );

      expect(result.success).toBe(true);
      expect(result.details.matchingGrants).toBe(1);
      expect(result.details.revoked).toBe(1);
      expect(mockClient.deleteOAuthGrant).toHaveBeenCalledTimes(1);
      expect(mockClient.deleteOAuthGrant).toHaveBeenCalledWith("grant-1");
    });
  });

  describe("revokeSignInSessions", () => {
    it("revokes sessions via Graph API", async () => {
      mockClient.revokeSignInSessions.mockResolvedValueOnce(true);

      const result = await service.revokeSignInSessions("user@test.com");

      expect(result.success).toBe(true);
      expect(result.details.sessionsRevoked).toBe(true);
    });

    it("returns error on failure", async () => {
      mockClient.revokeSignInSessions.mockRejectedValueOnce(
        new Error("Insufficient privileges"),
      );

      const result = await service.revokeSignInSessions("user@test.com");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient privileges");
    });
  });

  describe("fullRemediation", () => {
    it("revokes all grants AND sessions", async () => {
      mockClient.getUser.mockResolvedValueOnce({ id: "user-id-123" });
      mockClient.listUserOAuthGrants.mockResolvedValueOnce([
        { id: "grant-1", clientId: "app-1", scope: "User.Read" },
      ]);
      mockClient.deleteOAuthGrant.mockResolvedValue(undefined);
      mockClient.revokeSignInSessions.mockResolvedValueOnce(true);

      const result = await service.fullRemediation("user@test.com");

      expect(result.success).toBe(true);
      expect(result.details.grantsSuccess).toBe(true);
      expect(result.details.sessionsSuccess).toBe(true);
    });
  });

  describe("updateGrantScopes", () => {
    it("updates scopes on an existing grant", async () => {
      mockClient.updateOAuthGrantScopes.mockResolvedValueOnce(undefined);

      const result = await service.updateGrantScopes(
        "grant-123",
        "user@test.com",
        ["User.Read", "Mail.Read"],
      );

      expect(result.success).toBe(true);
      expect(result.details.action).toBe("updated");
      expect(mockClient.updateOAuthGrantScopes).toHaveBeenCalledWith(
        "grant-123",
        "User.Read Mail.Read",
      );
    });

    it("deletes the grant when scopes are empty", async () => {
      mockClient.deleteOAuthGrant.mockResolvedValueOnce(undefined);

      const result = await service.updateGrantScopes(
        "grant-123",
        "user@test.com",
        [],
      );

      expect(result.success).toBe(true);
      expect(result.details.action).toBe("deleted");
      expect(mockClient.deleteOAuthGrant).toHaveBeenCalledWith("grant-123");
    });
  });

  describe("getUserOAuthGrants", () => {
    it("returns grants for a known user", async () => {
      mockClient.getUser.mockResolvedValueOnce({ id: "user-id-123" });
      mockClient.listUserOAuthGrants.mockResolvedValueOnce([
        { id: "grant-1", clientId: "app-1", scope: "User.Read" },
      ]);

      const grants = await service.getUserOAuthGrants("user@test.com");
      expect(grants).toHaveLength(1);
    });

    it("returns empty for unknown user", async () => {
      mockClient.getUser.mockResolvedValueOnce(null);

      const grants = await service.getUserOAuthGrants("unknown@test.com");
      expect(grants).toEqual([]);
    });
  });

  describe("isUserDisabled", () => {
    it("returns true when account is disabled", async () => {
      mockClient.getUser.mockResolvedValueOnce({
        id: "user-id-123",
        accountEnabled: false,
      });

      const result = await service.isUserDisabled("user@test.com");
      expect(result).toBe(true);
    });

    it("returns false when account is enabled", async () => {
      mockClient.getUser.mockResolvedValueOnce({
        id: "user-id-123",
        accountEnabled: true,
      });

      const result = await service.isUserDisabled("user@test.com");
      expect(result).toBe(false);
    });

    it("returns null when user not found", async () => {
      mockClient.getUser.mockResolvedValueOnce(null);

      const result = await service.isUserDisabled("unknown@test.com");
      expect(result).toBeNull();
    });
  });
});
