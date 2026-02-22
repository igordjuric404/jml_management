import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockPost, mockDelete, mockPatch, mockSelect, mockFilter, mockTop, mockOrderby, mockApiObj } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const mockDelete = vi.fn();
  const mockPatch = vi.fn();
  const mockSelect = vi.fn();
  const mockFilter = vi.fn();
  const mockTop = vi.fn();
  const mockOrderby = vi.fn();

  const chainable: Record<string, ReturnType<typeof vi.fn>> = {
    get: mockGet,
    post: mockPost,
    delete: mockDelete,
    patch: mockPatch,
    select: mockSelect,
    filter: mockFilter,
    top: mockTop,
    orderby: mockOrderby,
  };

  mockSelect.mockReturnValue(chainable);
  mockFilter.mockReturnValue(chainable);
  mockTop.mockReturnValue(chainable);
  mockOrderby.mockReturnValue(chainable);

  const mockApiObj = {
    api: vi.fn().mockReturnValue(chainable),
  };

  return { mockGet, mockPost, mockDelete, mockPatch, mockSelect, mockFilter, mockTop, mockOrderby, mockApiObj };
});

vi.mock("@azure/identity", () => {
  class MockClientSecretCredential {
    getToken() {
      return Promise.resolve({ token: "mock-token", expiresOnTimestamp: Date.now() + 3600000 });
    }
  }
  return { ClientSecretCredential: MockClientSecretCredential };
});

vi.mock("@microsoft/microsoft-graph-client", () => ({
  Client: {
    initWithMiddleware: vi.fn().mockReturnValue(mockApiObj),
  },
}));

vi.mock("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials", () => {
  class MockTokenCredentialAuthenticationProvider {
    constructor() {}
  }
  return { TokenCredentialAuthenticationProvider: MockTokenCredentialAuthenticationProvider };
});

import { MicrosoftGraphClient, GraphApiError } from "@/lib/providers/microsoft/graph-client";
import type { GraphClientConfig } from "@/lib/providers/microsoft/types";

const testConfig: GraphClientConfig = {
  tenantId: "test-tenant-id",
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
};

describe("MicrosoftGraphClient", () => {
  let client: MicrosoftGraphClient;

  beforeEach(() => {
    vi.clearAllMocks();
    const chainable: Record<string, ReturnType<typeof vi.fn>> = {
      get: mockGet,
      post: mockPost,
      delete: mockDelete,
      patch: mockPatch,
      select: mockSelect,
      filter: mockFilter,
      top: mockTop,
      orderby: mockOrderby,
    };
    mockSelect.mockReturnValue(chainable);
    mockFilter.mockReturnValue(chainable);
    mockTop.mockReturnValue(chainable);
    mockOrderby.mockReturnValue(chainable);
    mockApiObj.api.mockReturnValue(chainable);
    client = new MicrosoftGraphClient(testConfig);
  });

  describe("constructor", () => {
    it("creates a client with valid config", () => {
      expect(client).toBeDefined();
    });
  });

  describe("getUser", () => {
    it("returns user when found", async () => {
      const mockUser = {
        id: "user-123",
        displayName: "Test User",
        userPrincipalName: "test@example.com",
        accountEnabled: true,
      };
      mockGet.mockResolvedValueOnce(mockUser);

      const user = await client.getUser("test@example.com");
      expect(user).toEqual(mockUser);
      expect(mockApiObj.api).toHaveBeenCalledWith("/users/test%40example.com");
    });

    it("returns null when user not found (404)", async () => {
      mockGet.mockRejectedValueOnce({ statusCode: 404, code: "Request_ResourceNotFound" });

      const user = await client.getUser("nonexistent@example.com");
      expect(user).toBeNull();
    });

    it("throws GraphApiError on other errors", async () => {
      mockGet.mockRejectedValueOnce(new Error("Network failure"));

      await expect(client.getUser("test@example.com")).rejects.toThrow(GraphApiError);
    });
  });

  describe("listUsers", () => {
    it("returns all users", async () => {
      const mockUsers = [
        { id: "1", displayName: "User 1", userPrincipalName: "u1@example.com" },
        { id: "2", displayName: "User 2", userPrincipalName: "u2@example.com" },
      ];
      mockGet.mockResolvedValueOnce({ value: mockUsers });

      const users = await client.listUsers();
      expect(users).toHaveLength(2);
      expect(users[0].displayName).toBe("User 1");
    });

    it("handles pagination", async () => {
      mockGet
        .mockResolvedValueOnce({
          value: [{ id: "1", displayName: "User 1" }],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/users?$skiptoken=abc",
        })
        .mockResolvedValueOnce({
          value: [{ id: "2", displayName: "User 2" }],
        });

      const users = await client.listUsers();
      expect(users).toHaveLength(2);
    });

    it("applies filter when provided", async () => {
      mockGet.mockResolvedValueOnce({ value: [] });

      await client.listUsers("accountEnabled eq false");
      expect(mockFilter).toHaveBeenCalledWith("accountEnabled eq false");
    });
  });

  describe("listUserOAuthGrants", () => {
    it("returns OAuth grants for a user", async () => {
      const mockGrants = [
        { id: "grant-1", clientId: "app-1", scope: "User.Read", consentType: "Principal" },
        { id: "grant-2", clientId: "app-2", scope: "Mail.Read", consentType: "Principal" },
      ];
      mockGet.mockResolvedValueOnce({ value: mockGrants });

      const grants = await client.listUserOAuthGrants("user-123");
      expect(grants).toHaveLength(2);
      expect(mockApiObj.api).toHaveBeenCalledWith("/users/user-123/oauth2PermissionGrants");
    });
  });

  describe("deleteOAuthGrant", () => {
    it("deletes a grant successfully", async () => {
      mockDelete.mockResolvedValueOnce(undefined);

      await expect(client.deleteOAuthGrant("grant-123")).resolves.toBeUndefined();
      expect(mockApiObj.api).toHaveBeenCalledWith("/oauth2PermissionGrants/grant-123");
    });

    it("ignores 404 errors (already deleted)", async () => {
      mockDelete.mockRejectedValueOnce({ statusCode: 404 });

      await expect(client.deleteOAuthGrant("grant-123")).resolves.toBeUndefined();
    });

    it("throws on other errors", async () => {
      mockDelete.mockRejectedValueOnce(new Error("Forbidden"));

      await expect(client.deleteOAuthGrant("grant-123")).rejects.toThrow(GraphApiError);
    });
  });

  describe("updateOAuthGrantScopes", () => {
    it("updates scopes on a grant", async () => {
      mockPatch.mockResolvedValueOnce(undefined);

      await client.updateOAuthGrantScopes("grant-123", "User.Read Mail.Read");
      expect(mockPatch).toHaveBeenCalledWith({ scope: "User.Read Mail.Read" });
    });
  });

  describe("revokeSignInSessions", () => {
    it("revokes sessions and returns true", async () => {
      mockPost.mockResolvedValueOnce({ value: true });

      const result = await client.revokeSignInSessions("user-123");
      expect(result).toBe(true);
      expect(mockApiObj.api).toHaveBeenCalledWith("/users/user-123/revokeSignInSessions");
    });

    it("throws on failure", async () => {
      mockPost.mockRejectedValueOnce(new Error("Forbidden"));

      await expect(client.revokeSignInSessions("user-123")).rejects.toThrow(GraphApiError);
    });
  });

  describe("listSignIns", () => {
    it("returns sign-in logs for a user", async () => {
      const mockSignIns = [
        {
          id: "sign-1",
          userPrincipalName: "test@example.com",
          appDisplayName: "Teams",
          ipAddress: "1.2.3.4",
          createdDateTime: "2026-01-01T00:00:00Z",
          status: { errorCode: 0 },
        },
      ];
      mockGet.mockResolvedValueOnce({ value: mockSignIns });

      const signIns = await client.listSignIns("test@example.com");
      expect(signIns).toHaveLength(1);
      expect(signIns[0].appDisplayName).toBe("Teams");
    });
  });

  describe("getServicePrincipal", () => {
    it("returns service principal when found", async () => {
      const mockSP = { id: "sp-1", appId: "app-id", displayName: "My App" };
      mockGet.mockResolvedValueOnce({ value: [mockSP] });

      const sp = await client.getServicePrincipal("app-id");
      expect(sp?.displayName).toBe("My App");
    });

    it("returns null when not found", async () => {
      mockGet.mockResolvedValueOnce({ value: [] });

      const sp = await client.getServicePrincipal("nonexistent");
      expect(sp).toBeNull();
    });
  });

  describe("deleteAppRoleAssignment", () => {
    it("deletes an app role assignment", async () => {
      mockDelete.mockResolvedValueOnce(undefined);

      await expect(
        client.deleteAppRoleAssignment("user-123", "assignment-456"),
      ).resolves.toBeUndefined();
    });

    it("ignores 404 on already-deleted assignments", async () => {
      mockDelete.mockRejectedValueOnce({ statusCode: 404 });

      await expect(
        client.deleteAppRoleAssignment("user-123", "assignment-456"),
      ).resolves.toBeUndefined();
    });
  });
});

describe("GraphApiError", () => {
  it("captures operation and status code", () => {
    const err = new GraphApiError("test error", "getUser", 403, "Authorization_RequestDenied");
    expect(err.name).toBe("GraphApiError");
    expect(err.operation).toBe("getUser");
    expect(err.statusCode).toBe(403);
    expect(err.graphCode).toBe("Authorization_RequestDenied");
    expect(err.message).toBe("test error");
  });
});
