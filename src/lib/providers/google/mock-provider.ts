/**
 * Google Workspace mock provider.
 *
 * This provider simulates Google Workspace API responses for development.
 * When real API tokens become available, replace with actual Google Admin SDK calls.
 *
 * ## How to enable later:
 *
 * 1. Create a GCP project and enable the Admin SDK API
 * 2. Create a Service Account with domain-wide delegation
 * 3. Grant the service account the following scopes:
 *    - https://www.googleapis.com/auth/admin.directory.user
 *    - https://www.googleapis.com/auth/admin.directory.user.security
 *    - https://www.googleapis.com/auth/admin.reports.audit.readonly
 * 4. Set environment variables:
 *    - GOOGLE_SERVICE_ACCOUNT_KEY (JSON key file path)
 *    - GOOGLE_ADMIN_EMAIL (delegated admin email)
 *    - GOOGLE_DOMAIN (e.g., testcorp.com)
 * 5. Replace this mock with a real GoogleProvider class that uses
 *    the @googleapis/admin package
 *
 * ## API Endpoints that would be used:
 *
 * - directory.users.list — List domain users
 * - directory.tokens.list — List OAuth tokens for a user
 * - directory.tokens.delete — Revoke a specific OAuth token
 * - directory.asps.list — List ASPs for a user
 * - directory.asps.delete — Delete an ASP
 * - directory.users.signOut — Sign out all sessions
 * - reports.activities.list — Audit log (login events, admin changes)
 */

export interface GoogleToken {
  clientId: string;
  displayText: string;
  nativeApp: boolean;
  scopes: string[];
  userKey: string;
}

export interface GoogleASP {
  codeId: number;
  name: string;
  creationTime: string;
  lastTimeUsed: string;
  userKey: string;
}

export interface GoogleUser {
  primaryEmail: string;
  name: { fullName: string };
  suspended: boolean;
  isAdmin: boolean;
  creationTime: string;
  lastLoginTime: string;
  orgUnitPath: string;
}

export const mockGoogleTokens: GoogleToken[] = [
  {
    clientId: "client-google-drive-001",
    displayText: "Google Drive",
    nativeApp: false,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
    ],
    userKey: "alice.johnson@testcorp.com",
  },
  {
    clientId: "client-slack-001",
    displayText: "Slack",
    nativeApp: false,
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    userKey: "alice.johnson@testcorp.com",
  },
  {
    clientId: "client-zoom-001",
    displayText: "Zoom",
    nativeApp: false,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    userKey: "grace.lee@testcorp.com",
  },
];

export const mockGoogleASPs: GoogleASP[] = [
  {
    codeId: 1001,
    name: "Thunderbird Mail",
    creationTime: "2024-06-15T10:00:00Z",
    lastTimeUsed: "2025-11-10T08:30:00Z",
    userKey: "bob.smith@testcorp.com",
  },
  {
    codeId: 1002,
    name: "Outlook Desktop",
    creationTime: "2024-08-20T14:00:00Z",
    lastTimeUsed: "2025-11-12T09:00:00Z",
    userKey: "bob.smith@testcorp.com",
  },
];

export const mockGoogleUsers: GoogleUser[] = [
  {
    primaryEmail: "alice.johnson@testcorp.com",
    name: { fullName: "Alice Johnson" },
    suspended: true,
    isAdmin: false,
    creationTime: "2020-03-15T00:00:00Z",
    lastLoginTime: "2025-12-01T00:00:00Z",
    orgUnitPath: "/Engineering",
  },
  {
    primaryEmail: "bob.smith@testcorp.com",
    name: { fullName: "Bob Smith" },
    suspended: true,
    isAdmin: false,
    creationTime: "2019-06-01T00:00:00Z",
    lastLoginTime: "2025-11-15T00:00:00Z",
    orgUnitPath: "/Marketing",
  },
  {
    primaryEmail: "diana.prince@testcorp.com",
    name: { fullName: "Diana Prince" },
    suspended: false,
    isAdmin: true,
    creationTime: "2018-09-01T00:00:00Z",
    lastLoginTime: "2025-12-10T00:00:00Z",
    orgUnitPath: "/IT",
  },
];

/**
 * Simulate Google Admin SDK calls.
 * These functions mimic what a real Google provider would do.
 */
export class GoogleMockClient {
  async listUsers(domain: string): Promise<GoogleUser[]> {
    return mockGoogleUsers.filter((u) => u.primaryEmail.endsWith(`@${domain}`));
  }

  async listTokens(userKey: string): Promise<GoogleToken[]> {
    return mockGoogleTokens.filter((t) => t.userKey === userKey);
  }

  async deleteToken(userKey: string, clientId: string): Promise<void> {
    const idx = mockGoogleTokens.findIndex(
      (t) => t.userKey === userKey && t.clientId === clientId
    );
    if (idx >= 0) mockGoogleTokens.splice(idx, 1);
  }

  async listASPs(userKey: string): Promise<GoogleASP[]> {
    return mockGoogleASPs.filter((a) => a.userKey === userKey);
  }

  async deleteASP(userKey: string, codeId: number): Promise<void> {
    const idx = mockGoogleASPs.findIndex(
      (a) => a.userKey === userKey && a.codeId === codeId
    );
    if (idx >= 0) mockGoogleASPs.splice(idx, 1);
  }

  async signOutUser(_userKey: string): Promise<void> {
    // In real implementation, calls directory.users.signOut
  }
}
