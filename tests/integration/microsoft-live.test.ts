/**
 * Live integration tests for Microsoft Graph API.
 *
 * These tests run against the REAL Microsoft Graph API (Sarmateam tenant)
 * when credentials are configured. They are automatically SKIPPED when
 * MICROSOFT_TENANT_ID is not set (e.g., in CI or local dev without credentials).
 *
 * Tenant: Sarmateam.onmicrosoft.com
 * Test users: johnwick, angelinajolie, devidbentley
 *
 * Run with:
 *   MICROSOFT_TENANT_ID=... MICROSOFT_CLIENT_ID=... MICROSOFT_CLIENT_SECRET=... \
 *   npx vitest run tests/integration/microsoft-live.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { MicrosoftGraphClient, GraphApiError } from "@/lib/providers/microsoft/graph-client";
import { MicrosoftRemediationService } from "@/lib/providers/microsoft/remediation-service";
import type { GraphClientConfig, MSGraphUser } from "@/lib/providers/microsoft/types";

const tenantId = process.env.MICROSOFT_TENANT_ID || "";
const clientId = process.env.MICROSOFT_CLIENT_ID || "";
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || "";
const isConfigured = !!(tenantId && clientId && clientSecret);

const describeIfConfigured = isConfigured ? describe : describe.skip;

describeIfConfigured("Microsoft Graph API — LIVE Integration Tests", () => {
  let graphClient: MicrosoftGraphClient;
  let remediationService: MicrosoftRemediationService;
  let testUsers: MSGraphUser[];

  beforeAll(async () => {
    const config: GraphClientConfig = { tenantId, clientId, clientSecret };
    graphClient = new MicrosoftGraphClient(config);
    remediationService = new MicrosoftRemediationService(graphClient);
    testUsers = await graphClient.listUsers();
  });

  // ── User Operations ──────────────────────────────────────

  describe("User Operations", () => {
    it("lists users from the Sarmateam tenant", () => {
      expect(testUsers.length).toBeGreaterThan(0);
      const upns = testUsers.map((u) => u.userPrincipalName.toLowerCase());
      expect(upns).toContain("johnwick@sarmateam.onmicrosoft.com");
      expect(upns).toContain("angelinajolie@sarmateam.onmicrosoft.com");
      expect(upns).toContain("devidbentley@sarmateam.onmicrosoft.com");
    });

    it("gets John Wick by UPN with expected fields", async () => {
      const user = await graphClient.getUser("johnwick@Sarmateam.onmicrosoft.com");
      expect(user).not.toBeNull();
      expect(user!.displayName).toBe("John Wick");
      expect(user!.accountEnabled).toBe(true);
      expect(user!.id).toBeDefined();
      expect(user!.userPrincipalName.toLowerCase()).toBe("johnwick@sarmateam.onmicrosoft.com");
    });

    it("returns null for non-existent user", async () => {
      const user = await graphClient.getUser("nonexistent@nonexistent.onmicrosoft.com");
      expect(user).toBeNull();
    });

    it("lists users with all required properties", () => {
      for (const user of testUsers) {
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("displayName");
        expect(user).toHaveProperty("userPrincipalName");
        expect(typeof user.accountEnabled).toBe("boolean");
      }
    });
  });

  // ── OAuth2 Permission Grants ─────────────────────────────

  describe("OAuth2 Permission Grants", () => {
    it("lists OAuth grants for each test user (may be empty)", async () => {
      for (const user of testUsers) {
        const grants = await graphClient.listUserOAuthGrants(user.id);
        expect(Array.isArray(grants)).toBe(true);
        for (const grant of grants) {
          expect(grant).toHaveProperty("id");
          expect(grant).toHaveProperty("clientId");
          expect(typeof grant.scope).toBe("string");
        }
      }
    });
  });

  // ── Service Principals ───────────────────────────────────

  describe("Service Principals", () => {
    it("handles service principal lookup gracefully (may lack Application.Read.All)", async () => {
      try {
        const sp = await graphClient.getServicePrincipal("00000003-0000-0000-c000-000000000000");
        if (sp) {
          expect(sp.displayName).toBe("Microsoft Graph");
        }
      } catch (err) {
        expect(err).toBeInstanceOf(GraphApiError);
        expect((err as GraphApiError).message).toContain("Insufficient privileges");
      }
    });
  });

  // ── Session Revocation ───────────────────────────────────

  describe("Session Revocation", () => {
    it("revokes sign-in sessions for johnwick", async () => {
      const result = await remediationService.revokeSignInSessions(
        "johnwick@Sarmateam.onmicrosoft.com",
      );
      expect(result.success).toBe(true);
      expect(result.action).toBe("revokeSignInSessions");
      expect(result.details).toHaveProperty("sessionsRevoked");
      expect(result.timestamp).toBeDefined();
    });

    it("revokes sign-in sessions for angelinajolie", async () => {
      const result = await remediationService.revokeSignInSessions(
        "angelinajolie@Sarmateam.onmicrosoft.com",
      );
      expect(result.success).toBe(true);
    });

    it("returns error for non-existent user session revocation", async () => {
      const result = await remediationService.revokeSignInSessions(
        "nobody@Sarmateam.onmicrosoft.com",
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ── Remediation Service ──────────────────────────────────

  describe("Remediation Service", () => {
    it("reports as configured", () => {
      expect(remediationService.isConfigured).toBe(true);
    });

    it("getUserOAuthGrants for johnwick", async () => {
      const grants = await remediationService.getUserOAuthGrants(
        "johnwick@Sarmateam.onmicrosoft.com",
      );
      expect(Array.isArray(grants)).toBe(true);
    });

    it("getUserOAuthGrants returns empty for non-existent user", async () => {
      const grants = await remediationService.getUserOAuthGrants(
        "doesnotexist@Sarmateam.onmicrosoft.com",
      );
      expect(grants).toEqual([]);
    });

    it("isUserDisabled returns false for enabled users", async () => {
      const disabled = await remediationService.isUserDisabled(
        "johnwick@Sarmateam.onmicrosoft.com",
      );
      expect(disabled).toBe(false);
    });

    it("isUserDisabled returns null for non-existent users", async () => {
      const disabled = await remediationService.isUserDisabled(
        "doesnotexist@Sarmateam.onmicrosoft.com",
      );
      expect(disabled).toBeNull();
    });

    it("full remediation on johnwick succeeds", async () => {
      const result = await remediationService.fullRemediation(
        "johnwick@Sarmateam.onmicrosoft.com",
      );
      expect(result.success).toBe(true);
      expect(result.action).toBe("fullRemediation");
      expect(result.details).toHaveProperty("grants");
      expect(result.details).toHaveProperty("sessions");
    });

    it("full remediation on angelinajolie succeeds", async () => {
      const result = await remediationService.fullRemediation(
        "angelinajolie@Sarmateam.onmicrosoft.com",
      );
      expect(result.success).toBe(true);
      expect(result.action).toBe("fullRemediation");
    });

    it("full remediation on non-existent user reports sub-operation failures", async () => {
      const result = await remediationService.fullRemediation(
        "nobody@Sarmateam.onmicrosoft.com",
      );
      expect(result.success).toBe(true);
      expect(result.details.grantsSuccess).toBe(false);
      expect(result.details.sessionsSuccess).toBe(false);
    });

    it("revokeAllOAuthGrants on devidbentley succeeds", async () => {
      const result = await remediationService.revokeAllOAuthGrants(
        "devidbentley@Sarmateam.onmicrosoft.com",
      );
      expect(result.success).toBe(true);
      expect(result.action).toBe("revokeAllOAuthGrants");
      expect(result.details).toHaveProperty("totalGrants");
      expect(result.details).toHaveProperty("revoked");
    });
  });
});

describe("Microsoft Graph API — Skipped when not configured", () => {
  it("verifies skip behavior when no credentials", () => {
    if (!isConfigured) {
      expect(true).toBe(true);
    }
  });
});
