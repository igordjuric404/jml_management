/**
 * Enhanced Provider that augments any HrProvider with real Microsoft 365 enforcement.
 *
 * Pattern: For remediation actions, calls Microsoft Graph API first to enforce
 * the action in the real identity provider, then delegates to the underlying
 * provider (Frappe) to update the system of record.
 *
 * For non-remediation operations, delegates directly to the underlying provider.
 * If Microsoft is not configured, the underlying provider is used as-is.
 */

import type { HrProvider, AuthSession } from "@/lib/providers/interface";
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
import {
  MicrosoftRemediationService,
  getMicrosoftRemediationService,
} from "./remediation-service";

export class MicrosoftEnhancedProvider implements HrProvider {
  readonly name: string;
  private inner: HrProvider;
  private ms: MicrosoftRemediationService;

  constructor(inner: HrProvider, ms?: MicrosoftRemediationService) {
    this.inner = inner;
    this.ms = ms ?? getMicrosoftRemediationService();
    this.name = `${inner.name}+microsoft`;
  }

  // ── Pass-through operations ──────────────────────────────

  authenticate(u: string, p: string): Promise<AuthSession> {
    return this.inner.authenticate(u, p);
  }

  logout(): Promise<void> {
    return this.inner.logout();
  }

  getSession(): Promise<AuthSession | null> {
    return this.inner.getSession();
  }

  getDashboardStats(): Promise<DashboardStats> {
    return this.inner.getDashboardStats();
  }

  getStatistics(): Promise<Statistics> {
    return this.inner.getStatistics();
  }

  listCases(f?: Record<string, unknown>): Promise<OffboardingCase[]> {
    return this.inner.listCases(f);
  }

  getCaseDetail(n: string): Promise<CaseDetail> {
    return this.inner.getCaseDetail(n);
  }

  createCase(d: Partial<OffboardingCase>): Promise<OffboardingCase> {
    return this.inner.createCase(d);
  }

  createCaseFromEmployee(id: string): Promise<OffboardingCase> {
    return this.inner.createCaseFromEmployee(id);
  }

  updateCase(
    n: string,
    d: Partial<OffboardingCase>,
  ): Promise<OffboardingCase> {
    return this.inner.updateCase(n, d);
  }

  triggerScan(n: string): Promise<{ status: string; message: string }> {
    return this.inner.triggerScan(n);
  }

  systemScan(): Promise<{ status: string; message: string }> {
    return this.inner.systemScan();
  }

  getScanHistory(): Promise<ScanHistoryEntry[]> {
    return this.inner.getScanHistory();
  }

  listArtifacts(f?: Record<string, unknown>): Promise<AccessArtifact[]> {
    return this.inner.listArtifacts(f);
  }

  getArtifact(n: string): Promise<AccessArtifact> {
    return this.inner.getArtifact(n);
  }

  listFindings(f?: Record<string, unknown>): Promise<Finding[]> {
    return this.inner.listFindings(f);
  }

  getFinding(n: string): Promise<Finding> {
    return this.inner.getFinding(n);
  }

  getEmployeeList(): Promise<Employee[]> {
    return this.inner.getEmployeeList();
  }

  getEmployeeDetail(id: string): Promise<EmployeeDetail> {
    return this.inner.getEmployeeDetail(id);
  }

  getAllActiveOAuthApps(): Promise<OAuthAppSummary[]> {
    return this.inner.getAllActiveOAuthApps();
  }

  getAppDetail(c: string): Promise<AppDetail> {
    return this.inner.getAppDetail(c);
  }

  listAuditLogs(f?: Record<string, unknown>): Promise<UnifiedAuditLogEntry[]> {
    return this.inner.listAuditLogs(f);
  }

  getSettings(): Promise<OGMSettings> {
    return this.inner.getSettings();
  }

  updateSettings(s: Partial<OGMSettings>): Promise<OGMSettings> {
    return this.inner.updateSettings(s);
  }

  chat(
    m: string,
  ): Promise<{ reply: string; sources: { title: string; url: string }[] }> {
    return this.inner.chat(m);
  }

  // ── Enhanced remediation operations ──────────────────────

  async executeRemediation(
    caseName: string,
    action: string,
    kwargs?: Record<string, unknown>,
  ): Promise<RemediationResult> {
    const email = await this.resolveEmailForCase(caseName);

    if (email && this.ms.isConfigured) {
      await this.enforceMicrosoftRemediation(email, action, kwargs);
    }

    return this.inner.executeRemediation(caseName, action, kwargs);
  }

  async bulkRemediate(
    caseName: string,
    artifactNames: string[],
  ): Promise<RemediationResult> {
    const email = await this.resolveEmailForCase(caseName);

    if (email && this.ms.isConfigured) {
      await this.enforceBulkMicrosoftRemediation(email, caseName, artifactNames);
    }

    return this.inner.bulkRemediate(caseName, artifactNames);
  }

  async remediateArtifacts(docnames: string[]): Promise<RemediationResult> {
    if (this.ms.isConfigured) {
      await this.enforceArtifactRemediation(docnames);
    }

    return this.inner.remediateArtifacts(docnames);
  }

  async runScheduledRemediationNow(
    caseName: string,
  ): Promise<RemediationResult> {
    const email = await this.resolveEmailForCase(caseName);

    if (email && this.ms.isConfigured) {
      await this.ms.fullRemediation(email);
    }

    return this.inner.runScheduledRemediationNow(caseName);
  }

  async remediateFinding(name: string): Promise<RemediationResult> {
    if (this.ms.isConfigured) {
      try {
        const finding = await this.inner.getFinding(name);
        const caseDetail = await this.inner.getCaseDetail(finding.case);
        const email = caseDetail.case.primary_email;

        if (email) {
          const actionMap: Record<string, () => Promise<unknown>> = {
            LingeringOAuthGrant: () => this.ms.revokeAllOAuthGrants(email),
            PostOffboardLogin: () => this.ms.revokeSignInSessions(email),
            PostOffboardSuspiciousLogin: () =>
              this.ms.revokeSignInSessions(email),
          };
          const handler = actionMap[finding.finding_type];
          if (handler) await handler();
        }
      } catch {
        // Non-blocking: proceed with Frappe remediation even if MS Graph fails
      }
    }

    return this.inner.remediateFinding(name);
  }

  async revokeEmployeeAccess(
    employeeId: string,
    scope: string,
  ): Promise<RemediationResult> {
    if (this.ms.isConfigured) {
      try {
        const detail = await this.inner.getEmployeeDetail(employeeId);
        const email = detail.employee.email;

        if (email) {
          if (scope === "all" || scope === "full_bundle") {
            await this.ms.fullRemediation(email);
          } else if (scope === "tokens") {
            await this.ms.revokeAllOAuthGrants(email);
          } else if (scope === "sign_out") {
            await this.ms.revokeSignInSessions(email);
          }
        }
      } catch {
        // Non-blocking
      }
    }

    return this.inner.revokeEmployeeAccess(employeeId, scope);
  }

  async globalAppRemoval(
    clientId: string,
    appName: string,
  ): Promise<RemediationResult> {
    if (this.ms.isConfigured) {
      try {
        const appDetail = await this.inner.getAppDetail(clientId);
        for (const user of appDetail.users) {
          if (user.status === "Active") {
            await this.ms.revokeOAuthGrantsForApp(user.email, clientId);
          }
        }
      } catch {
        // Non-blocking
      }
    }

    return this.inner.globalAppRemoval(clientId, appName);
  }

  async revokeAppForUsers(
    clientId: string,
    artifactNames: string[],
  ): Promise<RemediationResult> {
    if (this.ms.isConfigured) {
      try {
        for (const name of artifactNames) {
          const artifact = await this.inner.getArtifact(name);
          if (artifact.subject_email) {
            await this.ms.revokeOAuthGrantsForApp(
              artifact.subject_email,
              clientId,
            );
          }
        }
      } catch {
        // Non-blocking
      }
    }

    return this.inner.revokeAppForUsers(clientId, artifactNames);
  }

  async restoreAppForUsers(
    clientId: string,
    artifactNames: string[],
  ): Promise<RemediationResult> {
    return this.inner.restoreAppForUsers(clientId, artifactNames);
  }

  async updateUserScopes(
    artifactName: string,
    scopes: string[],
  ): Promise<{ removed: number; added: number }> {
    return this.inner.updateUserScopes(artifactName, scopes);
  }

  // ── Internal helpers ─────────────────────────────────────

  private async resolveEmailForCase(caseName: string): Promise<string | null> {
    try {
      const detail = await this.inner.getCaseDetail(caseName);
      return detail.case.primary_email || null;
    } catch {
      return null;
    }
  }

  private async enforceMicrosoftRemediation(
    email: string,
    action: string,
    kwargs?: Record<string, unknown>,
  ): Promise<void> {
    try {
      switch (action) {
        case "full_bundle":
          await this.ms.fullRemediation(email);
          break;
        case "revoke_token":
          if (kwargs?.client_id) {
            await this.ms.revokeOAuthGrantsForApp(
              email,
              kwargs.client_id as string,
            );
          } else {
            await this.ms.revokeAllOAuthGrants(email);
          }
          break;
        case "sign_out":
          await this.ms.revokeSignInSessions(email);
          break;
        case "delete_asp":
          break;
      }
    } catch {
      // Non-blocking: MS Graph failure should not prevent Frappe remediation
    }
  }

  private async enforceBulkMicrosoftRemediation(
    email: string,
    _caseName: string,
    artifactNames: string[],
  ): Promise<void> {
    try {
      for (const name of artifactNames) {
        try {
          const artifact = await this.inner.getArtifact(name);
          if (
            artifact.artifact_type === "OAuthToken" &&
            artifact.client_id
          ) {
            await this.ms.revokeOAuthGrantsForApp(email, artifact.client_id);
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Non-blocking
    }
  }

  private async enforceArtifactRemediation(
    docnames: string[],
  ): Promise<void> {
    for (const name of docnames) {
      try {
        const artifact = await this.inner.getArtifact(name);
        if (!artifact.subject_email) continue;

        if (
          artifact.artifact_type === "OAuthToken" &&
          artifact.client_id
        ) {
          await this.ms.revokeOAuthGrantsForApp(
            artifact.subject_email,
            artifact.client_id,
          );
        } else if (artifact.artifact_type === "LoginEvent") {
          await this.ms.revokeSignInSessions(artifact.subject_email);
        }
      } catch {
        continue;
      }
    }
  }
}
