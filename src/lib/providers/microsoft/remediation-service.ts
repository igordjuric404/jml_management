/**
 * Microsoft 365 Remediation Service.
 *
 * Business-logic layer that orchestrates Microsoft Graph API calls for
 * access remediation. Maps JML remediation actions to concrete Graph operations.
 *
 * All methods are safe to call even when Microsoft is not configured —
 * they return a "skipped" result in that case. This lets the rest of the
 * codebase call them unconditionally.
 */

import { MicrosoftGraphClient, GraphApiError } from "./graph-client";
import { getMicrosoftConfig } from "./config";
import type { RemediationActionResult, MSGraphOAuth2PermissionGrant } from "./types";

let _instance: MicrosoftRemediationService | null = null;

export function getMicrosoftRemediationService(): MicrosoftRemediationService {
  if (_instance) return _instance;
  _instance = new MicrosoftRemediationService();
  return _instance;
}

export function resetMicrosoftRemediationService(): void {
  _instance = null;
}

export class MicrosoftRemediationService {
  private graphClient: MicrosoftGraphClient | null = null;

  constructor(graphClient?: MicrosoftGraphClient) {
    if (graphClient) {
      this.graphClient = graphClient;
      return;
    }
    const config = getMicrosoftConfig();
    if (config) {
      this.graphClient = new MicrosoftGraphClient(config);
    }
  }

  get isConfigured(): boolean {
    return this.graphClient !== null;
  }

  // ── Token/Grant Revocation ───────────────────────────────

  /**
   * Revoke a specific OAuth2 permission grant by its Graph API ID.
   */
  async revokeOAuthGrant(
    userPrincipalName: string,
    grantId: string,
  ): Promise<RemediationActionResult> {
    if (!this.graphClient) {
      return this.skippedResult("revokeOAuthGrant", userPrincipalName);
    }

    try {
      await this.graphClient.deleteOAuthGrant(grantId);
      return this.successResult("revokeOAuthGrant", userPrincipalName, {
        grantId,
      });
    } catch (error) {
      return this.errorResult("revokeOAuthGrant", userPrincipalName, error);
    }
  }

  /**
   * Revoke all OAuth2 permission grants for a user.
   * Resolves the user's Graph ID from their UPN, fetches all grants, and deletes each.
   */
  async revokeAllOAuthGrants(
    userPrincipalName: string,
  ): Promise<RemediationActionResult> {
    if (!this.graphClient) {
      return this.skippedResult("revokeAllOAuthGrants", userPrincipalName);
    }

    try {
      const user = await this.graphClient.getUser(userPrincipalName);
      if (!user) {
        return this.errorResult(
          "revokeAllOAuthGrants",
          userPrincipalName,
          new Error(`User not found in Azure AD: ${userPrincipalName}`),
        );
      }

      const grants = await this.graphClient.listUserOAuthGrants(user.id);
      const results: Array<{ grantId: string; success: boolean; error?: string }> = [];

      for (const grant of grants) {
        try {
          await this.graphClient.deleteOAuthGrant(grant.id);
          results.push({ grantId: grant.id, success: true });
        } catch (error) {
          results.push({
            grantId: grant.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return this.successResult("revokeAllOAuthGrants", userPrincipalName, {
        totalGrants: grants.length,
        revoked: succeeded,
        failed,
        details: results,
      });
    } catch (error) {
      return this.errorResult("revokeAllOAuthGrants", userPrincipalName, error);
    }
  }

  /**
   * Revoke OAuth grants for a specific client app (by clientId/appId).
   * Finds grants where the clientId matches the target service principal.
   */
  async revokeOAuthGrantsForApp(
    userPrincipalName: string,
    clientId: string,
  ): Promise<RemediationActionResult> {
    if (!this.graphClient) {
      return this.skippedResult("revokeOAuthGrantsForApp", userPrincipalName);
    }

    try {
      const user = await this.graphClient.getUser(userPrincipalName);
      if (!user) {
        return this.errorResult(
          "revokeOAuthGrantsForApp",
          userPrincipalName,
          new Error(`User not found in Azure AD: ${userPrincipalName}`),
        );
      }

      const sp = await this.graphClient.getServicePrincipal(clientId);

      const allGrants = await this.graphClient.listUserOAuthGrants(user.id);
      const matchingGrants = allGrants.filter(
        (g) => g.clientId === (sp?.id ?? clientId),
      );

      let revoked = 0;
      for (const grant of matchingGrants) {
        await this.graphClient.deleteOAuthGrant(grant.id);
        revoked++;
      }

      return this.successResult("revokeOAuthGrantsForApp", userPrincipalName, {
        clientId,
        servicePrincipalId: sp?.id,
        matchingGrants: matchingGrants.length,
        revoked,
      });
    } catch (error) {
      return this.errorResult(
        "revokeOAuthGrantsForApp",
        userPrincipalName,
        error,
      );
    }
  }

  // ── Session Revocation ───────────────────────────────────

  /**
   * Revoke all sign-in sessions for a user.
   * Forces re-authentication on all devices and applications.
   */
  async revokeSignInSessions(
    userPrincipalName: string,
  ): Promise<RemediationActionResult> {
    if (!this.graphClient) {
      return this.skippedResult("revokeSignInSessions", userPrincipalName);
    }

    try {
      const success =
        await this.graphClient.revokeSignInSessions(userPrincipalName);
      return this.successResult("revokeSignInSessions", userPrincipalName, {
        sessionsRevoked: success,
      });
    } catch (error) {
      return this.errorResult(
        "revokeSignInSessions",
        userPrincipalName,
        error,
      );
    }
  }

  // ── Full Remediation Bundle ──────────────────────────────

  /**
   * Execute full remediation: revoke all OAuth grants + revoke all sessions.
   * This is the equivalent of the Frappe "full_bundle" action.
   */
  async fullRemediation(
    userPrincipalName: string,
  ): Promise<RemediationActionResult> {
    if (!this.graphClient) {
      return this.skippedResult("fullRemediation", userPrincipalName);
    }

    try {
      const grantResult = await this.revokeAllOAuthGrants(userPrincipalName);
      const sessionResult =
        await this.revokeSignInSessions(userPrincipalName);

      return this.successResult("fullRemediation", userPrincipalName, {
        grants: grantResult.details,
        sessions: sessionResult.details,
        grantsSuccess: grantResult.success,
        sessionsSuccess: sessionResult.success,
      });
    } catch (error) {
      return this.errorResult("fullRemediation", userPrincipalName, error);
    }
  }

  // ── Scope Management ─────────────────────────────────────

  /**
   * Update scopes on an existing OAuth2 permission grant.
   * If newScopes is empty, deletes the grant entirely.
   */
  async updateGrantScopes(
    grantId: string,
    userPrincipalName: string,
    newScopes: string[],
  ): Promise<RemediationActionResult> {
    if (!this.graphClient) {
      return this.skippedResult("updateGrantScopes", userPrincipalName);
    }

    try {
      if (newScopes.length === 0) {
        await this.graphClient.deleteOAuthGrant(grantId);
        return this.successResult("updateGrantScopes", userPrincipalName, {
          grantId,
          action: "deleted",
          reason: "empty scopes",
        });
      }

      await this.graphClient.updateOAuthGrantScopes(
        grantId,
        newScopes.join(" "),
      );
      return this.successResult("updateGrantScopes", userPrincipalName, {
        grantId,
        action: "updated",
        newScopes,
      });
    } catch (error) {
      return this.errorResult("updateGrantScopes", userPrincipalName, error);
    }
  }

  // ── Discovery / Read Operations ──────────────────────────

  /**
   * Get all OAuth2 permission grants for a user (for scanning/discovery).
   */
  async getUserOAuthGrants(
    userPrincipalName: string,
  ): Promise<MSGraphOAuth2PermissionGrant[]> {
    if (!this.graphClient) return [];

    const user = await this.graphClient.getUser(userPrincipalName);
    if (!user) return [];

    return this.graphClient.listUserOAuthGrants(user.id);
  }

  /**
   * Check if a user's account is disabled in Azure AD.
   */
  async isUserDisabled(userPrincipalName: string): Promise<boolean | null> {
    if (!this.graphClient) return null;

    const user = await this.graphClient.getUser(userPrincipalName);
    if (!user) return null;

    return !user.accountEnabled;
  }

  // ── Result Builders ──────────────────────────────────────

  private successResult(
    action: string,
    userPrincipalName: string,
    details: Record<string, unknown>,
  ): RemediationActionResult {
    return {
      success: true,
      action,
      userPrincipalName,
      details,
      timestamp: new Date().toISOString(),
    };
  }

  private errorResult(
    action: string,
    userPrincipalName: string,
    error: unknown,
  ): RemediationActionResult {
    const msg = error instanceof Error ? error.message : String(error);
    const isPermissionError =
      error instanceof GraphApiError &&
      (error.statusCode === 403 || error.graphCode === "Authorization_RequestDenied");

    return {
      success: false,
      action,
      userPrincipalName,
      details: {
        isPermissionError,
        statusCode:
          error instanceof GraphApiError ? error.statusCode : undefined,
      },
      error: msg,
      timestamp: new Date().toISOString(),
    };
  }

  private skippedResult(
    action: string,
    userPrincipalName: string,
  ): RemediationActionResult {
    return {
      success: true,
      action,
      userPrincipalName,
      details: { skipped: true, reason: "Microsoft 365 not configured" },
      timestamp: new Date().toISOString(),
    };
  }
}
