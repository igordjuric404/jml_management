/**
 * Microsoft 365 configuration management.
 *
 * Reads Azure AD app credentials from environment variables.
 * Required API permissions (Application type):
 *   - User.Read.All
 *   - AuditLog.Read.All
 *   - Application.Read.All
 *   - Directory.Read.All
 *   - DelegatedPermissionGrant.ReadWrite.All (for revoking OAuth grants)
 *   - User.RevokeSessions.All (for revoking sign-in sessions)
 */

import type { GraphClientConfig } from "./types";

export function getMicrosoftConfig(): GraphClientConfig | null {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return null;
  }

  return { tenantId, clientId, clientSecret };
}

export function isMicrosoftConfigured(): boolean {
  return getMicrosoftConfig() !== null;
}

export const REQUIRED_GRAPH_PERMISSIONS = [
  "User.Read.All",
  "AuditLog.Read.All",
  "Application.Read.All",
  "Directory.Read.All",
  "DelegatedPermissionGrant.ReadWrite.All",
] as const;

export const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
export const GRAPH_API_BETA = "https://graph.microsoft.com/beta";

/**
 * Validate and log Microsoft 365 configuration status.
 * Call once during app startup to surface misconfiguration early.
 */
export function validateMicrosoftConfig(): {
  configured: boolean;
  missing: string[];
} {
  const required: Array<[string, string | undefined]> = [
    ["MICROSOFT_TENANT_ID", process.env.MICROSOFT_TENANT_ID],
    ["MICROSOFT_CLIENT_ID", process.env.MICROSOFT_CLIENT_ID],
    ["MICROSOFT_CLIENT_SECRET", process.env.MICROSOFT_CLIENT_SECRET],
  ];

  const missing = required
    .filter(([, v]) => !v)
    .map(([name]) => name);

  return {
    configured: missing.length === 0,
    missing,
  };
}
