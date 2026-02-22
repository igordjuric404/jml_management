/**
 * TypeScript types for Microsoft Graph API responses.
 *
 * These map directly to the Microsoft Graph REST API v1.0 schemas.
 * @see https://learn.microsoft.com/en-us/graph/api/overview
 */

export interface MSGraphUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
  accountEnabled: boolean;
  createdDateTime?: string;
  department?: string;
  jobTitle?: string;
  officeLocation?: string;
  signInActivity?: {
    lastSignInDateTime?: string;
    lastNonInteractiveSignInDateTime?: string;
  };
}

export interface MSGraphOAuth2PermissionGrant {
  id: string;
  clientId: string;
  consentType: "AllPrincipals" | "Principal";
  principalId?: string;
  resourceId: string;
  scope: string;
  startTime?: string;
  expiryTime?: string;
}

export interface MSGraphAppRoleAssignment {
  id: string;
  appRoleId: string;
  principalDisplayName: string;
  principalId: string;
  principalType: string;
  resourceDisplayName: string;
  resourceId: string;
  createdDateTime?: string;
}

export interface MSGraphSignIn {
  id: string;
  userPrincipalName: string;
  userDisplayName: string;
  appDisplayName: string;
  appId: string;
  ipAddress: string;
  clientAppUsed?: string;
  createdDateTime: string;
  status: {
    errorCode: number;
    failureReason?: string;
    additionalDetails?: string;
  };
  location?: {
    city?: string;
    state?: string;
    countryOrRegion?: string;
  };
  isInteractive?: boolean;
  riskDetail?: string;
  riskLevelAggregated?: string;
  riskState?: string;
}

export interface MSGraphServicePrincipal {
  id: string;
  appId: string;
  displayName: string;
  appRoles?: Array<{
    id: string;
    displayName: string;
    value: string;
  }>;
  oauth2PermissionScopes?: Array<{
    id: string;
    value: string;
    type: string;
    adminConsentDisplayName?: string;
  }>;
}

export interface MSGraphPagedResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

export interface MSGraphError {
  error: {
    code: string;
    message: string;
    innerError?: {
      "request-id"?: string;
      date?: string;
      "client-request-id"?: string;
    };
  };
}

export interface GraphClientConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface RemediationActionResult {
  success: boolean;
  action: string;
  userPrincipalName: string;
  details: Record<string, unknown>;
  error?: string;
  timestamp: string;
}
