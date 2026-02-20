/**
 * Provider abstraction layer.
 *
 * Frappe is the first implementation. The interface is designed so that
 * additional HR systems (Google Workspace, Microsoft 365) can be added
 * later without changing the core business logic.
 */

import type {
  OffboardingCase,
  AccessArtifact,
  Finding,
  UnifiedAuditLogEntry,
  Employee,
  OGMSettings,
  DashboardStats,
  CaseDetail,
  AppDetail,
  EmployeeDetail,
  ScanHistoryEntry,
  Statistics,
  RemediationResult,
  OAuthAppSummary,
} from "@/lib/dto/types";

export interface HrProvider {
  readonly name: string;

  // Authentication
  authenticate(username: string, password: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getSession(): Promise<AuthSession | null>;

  // Dashboard
  getDashboardStats(): Promise<DashboardStats>;
  getStatistics(): Promise<Statistics>;

  // Offboarding Cases
  listCases(filters?: Record<string, unknown>): Promise<OffboardingCase[]>;
  getCaseDetail(caseName: string): Promise<CaseDetail>;
  createCase(data: Partial<OffboardingCase>): Promise<OffboardingCase>;
  createCaseFromEmployee(employeeId: string): Promise<OffboardingCase>;
  updateCase(caseName: string, data: Partial<OffboardingCase>): Promise<OffboardingCase>;

  // Scanning
  triggerScan(caseName: string): Promise<{ status: string; message: string }>;
  systemScan(): Promise<{ status: string; message: string }>;
  getScanHistory(): Promise<ScanHistoryEntry[]>;

  // Remediation
  executeRemediation(caseName: string, action: string, kwargs?: Record<string, unknown>): Promise<RemediationResult>;
  bulkRemediate(caseName: string, artifactNames: string[]): Promise<RemediationResult>;
  remediateArtifacts(docnames: string[]): Promise<RemediationResult>;
  runScheduledRemediationNow(caseName: string): Promise<RemediationResult>;

  // Access Artifacts
  listArtifacts(filters?: Record<string, unknown>): Promise<AccessArtifact[]>;
  getArtifact(name: string): Promise<AccessArtifact>;

  // Findings
  listFindings(filters?: Record<string, unknown>): Promise<Finding[]>;
  getFinding(name: string): Promise<Finding>;
  remediateFinding(name: string): Promise<RemediationResult>;

  // Employees
  getEmployeeList(): Promise<Employee[]>;
  getEmployeeDetail(employeeId: string): Promise<EmployeeDetail>;
  revokeEmployeeAccess(employeeId: string, scope: string): Promise<RemediationResult>;

  // OAuth Apps
  getAllActiveOAuthApps(): Promise<OAuthAppSummary[]>;
  getAppDetail(clientId: string): Promise<AppDetail>;
  globalAppRemoval(clientId: string, appName: string): Promise<RemediationResult>;
  revokeAppForUsers(clientId: string, artifactNames: string[]): Promise<RemediationResult>;
  restoreAppForUsers(clientId: string, artifactNames: string[]): Promise<RemediationResult>;
  updateUserScopes(artifactName: string, scopes: string[]): Promise<{ removed: number; added: number }>;

  // Audit Log
  listAuditLogs(filters?: Record<string, unknown>): Promise<UnifiedAuditLogEntry[]>;

  // Settings
  getSettings(): Promise<OGMSettings>;
  updateSettings(settings: Partial<OGMSettings>): Promise<OGMSettings>;

  // Chat
  chat(message: string): Promise<{ reply: string; sources: { title: string; url: string }[] }>;
}

export interface AuthSession {
  user: string;
  full_name: string;
  roles: string[];
  api_key?: string;
  api_secret?: string;
  sid?: string;
}

export type ProviderType = "frappe" | "google" | "microsoft";

export function getProvider(type: ProviderType = "frappe"): HrProvider {
  switch (type) {
    case "frappe": {
      const { FrappeProvider } = require("@/lib/providers/frappe/provider");
      return new FrappeProvider();
    }
    case "google":
      throw new Error("Google Workspace provider not yet implemented. See docs for enablement steps.");
    case "microsoft":
      throw new Error("Microsoft 365 provider not yet implemented. See docs for enablement steps.");
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
