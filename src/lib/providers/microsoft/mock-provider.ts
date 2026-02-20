/**
 * Microsoft 365 mock provider.
 *
 * This provider simulates Microsoft Graph API responses for development.
 * When real API tokens become available, replace with actual Graph SDK calls.
 *
 * ## How to enable later:
 *
 * 1. Register an application in Azure AD (Entra ID)
 * 2. Grant the following API permissions (Application type):
 *    - User.Read.All — Read all users
 *    - AuditLog.Read.All — Read audit logs
 *    - Application.Read.All — Read app registrations
 *    - Directory.Read.All — Read directory data
 * 3. Create a client secret or certificate
 * 4. Set environment variables:
 *    - MICROSOFT_TENANT_ID
 *    - MICROSOFT_CLIENT_ID
 *    - MICROSOFT_CLIENT_SECRET
 * 5. Replace this mock with a real MicrosoftProvider class that uses
 *    @microsoft/microsoft-graph-client
 *
 * ## API Endpoints that would be used:
 *
 * - /users — List directory users
 * - /users/{id}/oauth2PermissionGrants — OAuth consent grants
 * - /users/{id}/appRoleAssignments — App role assignments
 * - /auditLogs/signIns — Sign-in logs
 * - /auditLogs/directoryAudits — Directory audit logs
 * - /users/{id}/revokeSignInSessions — Revoke all sessions
 * - /oauth2PermissionGrants/{id} — Delete/update consent grants
 */

export interface M365User {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled: boolean;
  createdDateTime: string;
  lastSignInDateTime: string;
  department: string;
  jobTitle: string;
}

export interface M365OAuthGrant {
  id: string;
  clientId: string;
  resourceId: string;
  scope: string;
  principalId: string;
  consentType: "Principal" | "AllPrincipals";
}

export interface M365SignIn {
  id: string;
  userPrincipalName: string;
  appDisplayName: string;
  ipAddress: string;
  createdDateTime: string;
  status: { errorCode: number; failureReason: string };
  location: { city: string; countryOrRegion: string };
}

export const mockM365Users: M365User[] = [
  {
    id: "user-001",
    displayName: "Alice Johnson",
    userPrincipalName: "alice.johnson@testcorp.com",
    accountEnabled: false,
    createdDateTime: "2020-03-15T00:00:00Z",
    lastSignInDateTime: "2025-12-01T00:00:00Z",
    department: "Engineering",
    jobTitle: "Senior Developer",
  },
  {
    id: "user-002",
    displayName: "Bob Smith",
    userPrincipalName: "bob.smith@testcorp.com",
    accountEnabled: false,
    createdDateTime: "2019-06-01T00:00:00Z",
    lastSignInDateTime: "2025-11-15T00:00:00Z",
    department: "Marketing",
    jobTitle: "Marketing Manager",
  },
];

export const mockM365Grants: M365OAuthGrant[] = [
  {
    id: "grant-001",
    clientId: "app-teams-001",
    resourceId: "resource-graph",
    scope: "Calendars.Read Mail.Read",
    principalId: "user-001",
    consentType: "Principal",
  },
  {
    id: "grant-002",
    clientId: "app-sharepoint-001",
    resourceId: "resource-graph",
    scope: "Files.ReadWrite Sites.Read.All",
    principalId: "user-001",
    consentType: "Principal",
  },
];

export const mockM365SignIns: M365SignIn[] = [
  {
    id: "signin-001",
    userPrincipalName: "alice.johnson@testcorp.com",
    appDisplayName: "Microsoft Teams",
    ipAddress: "203.0.113.50",
    createdDateTime: "2025-12-05T14:30:00Z",
    status: { errorCode: 0, failureReason: "" },
    location: { city: "New York", countryOrRegion: "US" },
  },
];

/**
 * Simulate Microsoft Graph API calls.
 * These functions mimic what a real Microsoft provider would do.
 */
export class MicrosoftMockClient {
  async listUsers(): Promise<M365User[]> {
    return mockM365Users;
  }

  async getUser(id: string): Promise<M365User | undefined> {
    return mockM365Users.find((u) => u.id === id || u.userPrincipalName === id);
  }

  async listOAuthGrants(userId: string): Promise<M365OAuthGrant[]> {
    return mockM365Grants.filter((g) => g.principalId === userId);
  }

  async deleteOAuthGrant(grantId: string): Promise<void> {
    const idx = mockM365Grants.findIndex((g) => g.id === grantId);
    if (idx >= 0) mockM365Grants.splice(idx, 1);
  }

  async listSignIns(userPrincipalName: string): Promise<M365SignIn[]> {
    return mockM365SignIns.filter((s) => s.userPrincipalName === userPrincipalName);
  }

  async revokeSignInSessions(_userId: string): Promise<void> {
    // In real implementation, calls /users/{id}/revokeSignInSessions
  }
}
