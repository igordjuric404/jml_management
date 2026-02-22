/**
 * Microsoft Graph API client.
 *
 * Production-ready client using Azure AD client credentials flow.
 * Handles token acquisition, request execution, pagination, and error handling.
 */

import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import type {
  GraphClientConfig,
  MSGraphUser,
  MSGraphOAuth2PermissionGrant,
  MSGraphAppRoleAssignment,
  MSGraphSignIn,
  MSGraphServicePrincipal,
  MSGraphPagedResponse,
} from "./types";

export class MicrosoftGraphClient {
  private client: Client;
  private config: GraphClientConfig;

  constructor(config: GraphClientConfig) {
    this.config = config;

    const credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret,
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ["https://graph.microsoft.com/.default"],
    });

    this.client = Client.initWithMiddleware({
      authProvider,
      debugLogging: process.env.NODE_ENV === "development",
    });
  }

  // ── User Operations ──────────────────────────────────────

  async getUser(userIdOrUpn: string): Promise<MSGraphUser | null> {
    try {
      const user = await this.client
        .api(`/users/${encodeURIComponent(userIdOrUpn)}`)
        .select(
          "id,displayName,userPrincipalName,mail,accountEnabled,createdDateTime,department,jobTitle",
        )
        .get();
      return user as MSGraphUser;
    } catch (error: unknown) {
      if (isGraphNotFoundError(error)) return null;
      throw this.wrapError("getUser", error);
    }
  }

  async listUsers(filter?: string): Promise<MSGraphUser[]> {
    try {
      const request = this.client
        .api("/users")
        .select(
          "id,displayName,userPrincipalName,mail,accountEnabled,createdDateTime,department,jobTitle",
        )
        .top(999);

      if (filter) {
        request.filter(filter);
      }

      return await this.collectPages<MSGraphUser>(request);
    } catch (error: unknown) {
      throw this.wrapError("listUsers", error);
    }
  }

  // ── OAuth2 Permission Grants ─────────────────────────────

  async listUserOAuthGrants(
    userId: string,
  ): Promise<MSGraphOAuth2PermissionGrant[]> {
    try {
      return await this.collectPages<MSGraphOAuth2PermissionGrant>(
        this.client.api(`/users/${encodeURIComponent(userId)}/oauth2PermissionGrants`),
      );
    } catch (error: unknown) {
      throw this.wrapError("listUserOAuthGrants", error);
    }
  }

  async deleteOAuthGrant(grantId: string): Promise<void> {
    try {
      await this.client
        .api(`/oauth2PermissionGrants/${encodeURIComponent(grantId)}`)
        .delete();
    } catch (error: unknown) {
      if (isGraphNotFoundError(error)) return;
      throw this.wrapError("deleteOAuthGrant", error);
    }
  }

  async updateOAuthGrantScopes(
    grantId: string,
    newScopes: string,
  ): Promise<void> {
    try {
      await this.client
        .api(`/oauth2PermissionGrants/${encodeURIComponent(grantId)}`)
        .patch({ scope: newScopes });
    } catch (error: unknown) {
      throw this.wrapError("updateOAuthGrantScopes", error);
    }
  }

  // ── App Role Assignments ─────────────────────────────────

  async listUserAppRoleAssignments(
    userId: string,
  ): Promise<MSGraphAppRoleAssignment[]> {
    try {
      return await this.collectPages<MSGraphAppRoleAssignment>(
        this.client.api(`/users/${encodeURIComponent(userId)}/appRoleAssignments`),
      );
    } catch (error: unknown) {
      throw this.wrapError("listUserAppRoleAssignments", error);
    }
  }

  async deleteAppRoleAssignment(
    userId: string,
    assignmentId: string,
  ): Promise<void> {
    try {
      await this.client
        .api(
          `/users/${encodeURIComponent(userId)}/appRoleAssignments/${encodeURIComponent(assignmentId)}`,
        )
        .delete();
    } catch (error: unknown) {
      if (isGraphNotFoundError(error)) return;
      throw this.wrapError("deleteAppRoleAssignment", error);
    }
  }

  // ── Session Management ───────────────────────────────────

  async revokeSignInSessions(userId: string): Promise<boolean> {
    try {
      const result = await this.client
        .api(`/users/${encodeURIComponent(userId)}/revokeSignInSessions`)
        .post({});
      return result?.value === true;
    } catch (error: unknown) {
      throw this.wrapError("revokeSignInSessions", error);
    }
  }

  // ── Sign-In Logs ─────────────────────────────────────────

  async listSignIns(
    userPrincipalName: string,
    options?: { top?: number; daysBack?: number },
  ): Promise<MSGraphSignIn[]> {
    const top = options?.top ?? 50;
    const daysBack = options?.daysBack ?? 30;
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();

    try {
      return await this.collectPages<MSGraphSignIn>(
        this.client
          .api("/auditLogs/signIns")
          .filter(
            `userPrincipalName eq '${userPrincipalName}' and createdDateTime ge ${since}`,
          )
          .top(top)
          .orderby("createdDateTime desc"),
      );
    } catch (error: unknown) {
      throw this.wrapError("listSignIns", error);
    }
  }

  // ── License Details ────────────────────────────────────────

  async getUserLicenseDetails(
    userIdOrUpn: string,
  ): Promise<Array<{ skuId: string; skuPartNumber: string; servicePlans: Array<{ servicePlanName: string; provisioningStatus: string }> }>> {
    try {
      const result = await this.client
        .api(`/users/${encodeURIComponent(userIdOrUpn)}/licenseDetails`)
        .get();
      return result.value || [];
    } catch (error: unknown) {
      if (isGraphNotFoundError(error)) return [];
      throw this.wrapError("getUserLicenseDetails", error);
    }
  }

  // ── Service Principals ───────────────────────────────────

  async getServicePrincipal(
    appIdOrObjectId: string,
  ): Promise<MSGraphServicePrincipal | null> {
    try {
      const results: MSGraphPagedResponse<MSGraphServicePrincipal> =
        await this.client
          .api("/servicePrincipals")
          .filter(`appId eq '${appIdOrObjectId}'`)
          .select("id,appId,displayName,appRoles,oauth2PermissionScopes")
          .top(1)
          .get();
      return results.value?.[0] ?? null;
    } catch (error: unknown) {
      throw this.wrapError("getServicePrincipal", error);
    }
  }

  // ── Pagination Helper ────────────────────────────────────

  private async collectPages<T>(request: ReturnType<Client["api"]>): Promise<T[]> {
    const items: T[] = [];
    let response = await request.get();

    if (Array.isArray(response?.value)) {
      items.push(...response.value);
    } else if (Array.isArray(response)) {
      items.push(...response);
    }

    while (response?.["@odata.nextLink"]) {
      response = await this.client.api(response["@odata.nextLink"]).get();
      if (Array.isArray(response?.value)) {
        items.push(...response.value);
      }
    }

    return items;
  }

  // ── Error Handling ───────────────────────────────────────

  private wrapError(operation: string, error: unknown): Error {
    const msg = error instanceof Error ? error.message : String(error);
    const code = (error as { statusCode?: number })?.statusCode;
    const graphCode = (error as { code?: string })?.code;

    return new GraphApiError(
      `Microsoft Graph API error in ${operation}: ${msg}`,
      operation,
      code,
      graphCode,
    );
  }
}

export class GraphApiError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly statusCode?: number,
    public readonly graphCode?: string,
  ) {
    super(message);
    this.name = "GraphApiError";
  }
}

function isGraphNotFoundError(error: unknown): boolean {
  return (
    (error as { statusCode?: number })?.statusCode === 404 ||
    (error as { code?: string })?.code === "Request_ResourceNotFound"
  );
}
