/**
 * Unified Provider — combines three data sources:
 *
 * 1. Frappe → Employee records only (HR source of truth)
 * 2. Microsoft Graph API → Real OAuth grants, app roles (live queries)
 * 3. Local SQLite → Cases, findings, audit logs, settings
 *
 * Access artifacts are NEVER stored locally — they are always fetched
 * live from Microsoft Graph API, ensuring the UI shows the real state.
 */

import type { HrProvider, AuthSession } from "./interface";
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
import { frappeGetList, frappeLogin, setFrappeCookies } from "./frappe/client";
import {
  MicrosoftDiscoveryService,
  getMicrosoftDiscoveryService,
} from "./microsoft/discovery-service";
import {
  MicrosoftRemediationService,
  getMicrosoftRemediationService,
} from "./microsoft/remediation-service";
import { getLocalStore, LocalStore } from "@/lib/store/local-store";

export class UnifiedProvider implements HrProvider {
  readonly name = "unified";
  private discovery: MicrosoftDiscoveryService;
  private remediation: MicrosoftRemediationService;
  private store: LocalStore;

  constructor(
    discovery?: MicrosoftDiscoveryService,
    remediation?: MicrosoftRemediationService,
    store?: LocalStore,
  ) {
    this.discovery = discovery ?? getMicrosoftDiscoveryService();
    this.remediation = remediation ?? getMicrosoftRemediationService();
    this.store = store ?? getLocalStore();
  }

  // ── Authentication (via Frappe) ───────────────────────────

  async authenticate(username: string, password: string): Promise<AuthSession> {
    const result = await frappeLogin(username, password);
    setFrappeCookies(result.cookies);
    return {
      user: typeof result.user === "string" && result.user !== "Logged In"
        ? result.user : username,
      full_name: result.full_name || username,
      roles: ["System Manager"],
    };
  }

  async logout(): Promise<void> {
    setFrappeCookies("");
  }

  async getSession(): Promise<AuthSession | null> {
    return null;
  }

  // ── Dashboard ─────────────────────────────────────────────

  async getDashboardStats(): Promise<DashboardStats> {
    const [cases, findings, employees] = await Promise.all([
      this.store.listCases(),
      this.store.listFindings(),
      this.getEmployeeList(),
    ]);

    const leftEmails = employees
      .filter((e) => e.emp_status === "Left")
      .map((e) => e.company_email);

    let totalArtifacts = 0;
    const appCounts = new Map<string, { name: string; count: number }>();

    for (const email of leftEmails) {
      try {
        const disc = await this.discovery.discoverUserAccess(email);
        totalArtifacts += disc.artifacts.length;
        for (const a of disc.artifacts) {
          const key = a.client_id || a.app_display_name || "unknown";
          const existing = appCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            appCounts.set(key, { name: a.app_display_name || key, count: 1 });
          }
        }
      } catch {
        // skip users that fail
      }
    }

    const openFindings = findings.filter((f) => !f.closed_at);
    const criticalFindings = openFindings.filter((f) => f.severity === "Critical" || f.severity === "High");

    const topApps: OAuthAppSummary[] = [...appCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([clientId, info]) => ({
        client_id: clientId,
        app_display_name: info.name,
        grant_count: info.count,
      }));

    const riskyCases = cases
      .filter((c) => c.status === "Gaps Found" || c.status === "Draft")
      .slice(0, 10)
      .map((c) => {
        const caseFindings = openFindings.filter((f) => f.case === c.name);
        return {
          case_name: c.name,
          primary_email: c.primary_email,
          employee_name: c.employee_name,
          status: c.status,
          effective_date: c.effective_date,
          finding_count: caseFindings.length,
          critical_count: caseFindings.filter((f) => f.severity === "Critical").length,
        };
      });

    return {
      kpis: {
        pending_scan: cases.filter((c) => c.status === "Draft").length,
        critical_gaps: criticalFindings.length,
        oauth_grants: totalArtifacts,
        post_offboard_logins: 0,
        total_cases: cases.length,
        total_findings: openFindings.length,
        total_artifacts: totalArtifacts,
      },
      top_oauth_apps: topApps,
      risky_cases: riskyCases,
    };
  }

  async getStatistics(): Promise<Statistics> {
    return {
      mean_time_to_enforce_hours: null,
      top_apps_by_exposure: [],
      scope_heatmap: [],
      residual_access_trend: [],
    };
  }

  // ── Cases (local SQLite) ──────────────────────────────────

  async listCases(filters?: Record<string, unknown>): Promise<OffboardingCase[]> {
    return this.store.listCases(filters);
  }

  async getCaseDetail(caseName: string): Promise<CaseDetail> {
    const caseData = await this.store.getCase(caseName);
    if (!caseData) throw new Error(`Case not found: ${caseName}`);

    const email = caseData.primary_email;

    const [disc, findings, auditLogs] = await Promise.all([
      this.discovery.discoverUserAccess(email, caseName),
      this.store.findingsForCase(caseName),
      this.store.listAuditLogs({ target_email: email }),
    ]);

    const tokens = disc.artifacts.filter((a) => a.artifact_type === "OAuthToken");
    const asps = disc.artifacts.filter((a) => a.artifact_type === "ASP");
    const loginEvents = disc.artifacts.filter((a) => a.artifact_type === "LoginEvent");
    const other = disc.artifacts.filter(
      (a) => !["OAuthToken", "ASP", "LoginEvent"].includes(a.artifact_type),
    );

    return {
      case: caseData,
      artifacts: {
        tokens,
        asps,
        login_events: loginEvents,
        other,
        total: disc.artifacts.length,
      },
      findings,
      audit_logs: auditLogs,
    };
  }

  async createCase(data: Partial<OffboardingCase>): Promise<OffboardingCase> {
    return this.store.createCase(data);
  }

  async createCaseFromEmployee(employeeId: string): Promise<OffboardingCase> {
    const detail = await this.getEmployeeDetail(employeeId);
    return this.store.createCase({
      employee: employeeId,
      employee_name: detail.employee.name,
      primary_email: detail.employee.email,
      event_type: "Offboard",
      status: "Draft",
    });
  }

  async updateCase(caseName: string, data: Partial<OffboardingCase>): Promise<OffboardingCase> {
    return this.store.updateCase(caseName, data);
  }

  // ── Scanning (live Graph API discovery) ───────────────────

  async triggerScan(caseName: string): Promise<{ status: string; message: string }> {
    const caseData = await this.store.getCase(caseName);
    if (!caseData) throw new Error(`Case not found: ${caseName}`);

    const disc = await this.discovery.discoverUserAccess(caseData.primary_email, caseName);

    if (disc.error) {
      return { status: "error", message: disc.error };
    }

    for (const finding of disc.findings) {
      await this.store.createFinding({
        caseId: caseName,
        findingType: finding.finding_type,
        severity: finding.severity,
        summary: finding.summary,
        subjectEmail: caseData.primary_email,
        recommendedAction: finding.recommended_action,
      });
    }

    const newStatus = disc.artifacts.length > 0 ? "Gaps Found" : "All Clear";
    await this.store.updateCase(caseName, { status: newStatus });

    await this.store.logAction({
      caseId: caseName,
      actorUser: "system",
      actionType: "ScanCompleted",
      targetEmail: caseData.primary_email,
      result: `Found ${disc.artifacts.length} artifacts, ${disc.findings.length} findings`,
    });

    return {
      status: "success",
      message: `Scan completed: ${disc.artifacts.length} live Microsoft 365 artifacts found, ${disc.findings.length} findings generated`,
    };
  }

  async systemScan(): Promise<{ status: string; message: string }> {
    const employees = await this.getEmployeeList();
    const leftEmployees = employees.filter((e) => e.emp_status === "Left");
    let totalArtifacts = 0;
    let totalFindings = 0;

    for (const emp of leftEmployees) {
      let caseData = await this.store.findCaseByEmail(emp.company_email);
      if (!caseData) {
        caseData = await this.store.createCase({
          employee: emp.employee_id,
          employee_name: emp.employee_name,
          primary_email: emp.company_email,
          event_type: "Offboard",
          status: "Draft",
        });
      }

      const disc = await this.discovery.discoverUserAccess(emp.company_email, caseData.name);
      totalArtifacts += disc.artifacts.length;

      for (const finding of disc.findings) {
        await this.store.createFinding({
          caseId: caseData.name,
          findingType: finding.finding_type,
          severity: finding.severity,
          summary: finding.summary,
          subjectEmail: emp.company_email,
          recommendedAction: finding.recommended_action,
        });
        totalFindings++;
      }

      const newStatus = disc.artifacts.length > 0 ? "Gaps Found" : "All Clear";
      await this.store.updateCase(caseData.name, { status: newStatus });
    }

    return {
      status: "success",
      message: `System scan completed: ${leftEmployees.length} offboarded employees checked, ${totalArtifacts} live artifacts found, ${totalFindings} findings`,
    };
  }

  async getScanHistory(): Promise<ScanHistoryEntry[]> {
    const logs = await this.store.listAuditLogs({ action_type: "ScanCompleted" });
    return logs.map((l, i) => ({
      scan_id: l.name,
      case: "",
      target_email: l.target_email,
      trigger: "manual" as const,
      actor: l.actor_user,
      started_at: l.timestamp,
      result: l.result,
      active_artifacts: 0,
    }));
  }

  // ── Remediation (Graph API + local update) ────────────────

  async executeRemediation(
    caseName: string,
    action: string,
    kwargs?: Record<string, unknown>,
  ): Promise<RemediationResult> {
    const caseData = await this.store.getCase(caseName);
    if (!caseData) throw new Error(`Case not found: ${caseName}`);

    const email = caseData.primary_email;
    let result: RemediationResult;

    if (action === "full_bundle") {
      const msResult = await this.remediation.fullRemediation(email);
      result = {
        status: msResult.success ? "success" : "error",
        action: "full_bundle",
        revoked: msResult.details.grantsRevoked as number || 0,
      };
    } else if (action === "revoke_token") {
      if (kwargs?.client_id) {
        await this.remediation.revokeOAuthGrantsForApp(email, kwargs.client_id as string);
      } else {
        await this.remediation.revokeAllOAuthGrants(email);
      }
      result = { status: "success", action: "revoke_token" };
    } else if (action === "sign_out") {
      await this.remediation.revokeSignInSessions(email);
      result = { status: "success", action: "sign_out" };
    } else {
      result = { status: "success", action };
    }

    const disc = await this.discovery.discoverUserAccess(email, caseName);
    const newStatus = disc.artifacts.length === 0 ? "Remediated" : "Gaps Found";
    await this.store.updateCase(caseName, { status: newStatus });

    await this.store.logAction({
      caseId: caseName,
      actorUser: "admin",
      actionType: `Remediation:${action}`,
      targetEmail: email,
      result: JSON.stringify(result),
    });

    return {
      ...result,
      case_status: {
        active_artifacts: disc.artifacts.length,
        open_findings: (await this.store.findingsForCase(caseName)).filter((f) => !f.closed_at).length,
        new_status: newStatus,
      },
    };
  }

  async bulkRemediate(caseName: string, artifactNames: string[]): Promise<RemediationResult> {
    return this.executeRemediation(caseName, "full_bundle");
  }

  async remediateArtifacts(docnames: string[]): Promise<RemediationResult> {
    return { status: "success", artifacts_remediated: docnames.length };
  }

  async runScheduledRemediationNow(caseName: string): Promise<RemediationResult> {
    return this.executeRemediation(caseName, "full_bundle");
  }

  // ── Access Artifacts (LIVE from Graph API) ────────────────

  async listArtifacts(filters?: Record<string, unknown>): Promise<AccessArtifact[]> {
    const employees = await this.getEmployeeList();
    const leftEmployees = employees.filter((e) => e.emp_status === "Left");
    const allArtifacts: AccessArtifact[] = [];

    for (const emp of leftEmployees) {
      try {
        const disc = await this.discovery.discoverUserAccess(emp.company_email);
        allArtifacts.push(...disc.artifacts);
      } catch {
        // skip
      }
    }

    return allArtifacts;
  }

  async getArtifact(name: string): Promise<AccessArtifact> {
    throw new Error(`Artifacts are live from Graph API. Use discoverUserAccess() instead. (${name})`);
  }

  // ── Findings (local SQLite) ───────────────────────────────

  async listFindings(filters?: Record<string, unknown>): Promise<Finding[]> {
    return this.store.listFindings(filters);
  }

  async getFinding(name: string): Promise<Finding> {
    const f = await this.store.getFinding(name);
    if (!f) throw new Error(`Finding not found: ${name}`);
    return f;
  }

  async remediateFinding(name: string): Promise<RemediationResult> {
    const finding = await this.store.getFinding(name);
    if (!finding) throw new Error(`Finding not found: ${name}`);

    await this.store.closeFinding(name);
    return { status: "success", findings_closed: 1 };
  }

  // ── Employees (Frappe only) ───────────────────────────────

  async getEmployeeList(): Promise<Employee[]> {
    const frappeEmployees = await frappeGetList<Record<string, string>>("Employee", {
      fields: [
        "name", "employee_name", "company_email", "status",
        "department", "designation", "date_of_joining", "relieving_date", "company",
      ],
      order_by: "modified desc",
      limit_page_length: 0,
    });

    const allCases = await this.store.listCases();
    const caseCountByEmail = new Map<string, number>();
    for (const c of allCases) {
      caseCountByEmail.set(c.primary_email, (caseCountByEmail.get(c.primary_email) || 0) + 1);
    }

    return frappeEmployees.map((fe) => ({
      employee_id: fe.name,
      employee_name: fe.employee_name || "",
      company_email: fe.company_email || "",
      emp_status: this.mapEmployeeStatus(fe.status),
      date_of_joining: fe.date_of_joining || undefined,
      relieving_date: fe.relieving_date || undefined,
      department: fe.department || undefined,
      designation: fe.designation || undefined,
      company: fe.company || undefined,
      case_count: caseCountByEmail.get(fe.company_email) || 0,
      active_artifacts: 0,
      open_findings: 0,
    }));
  }

  async getEmployeeDetail(employeeId: string): Promise<EmployeeDetail> {
    const [frappeEmp] = await frappeGetList<Record<string, string>>("Employee", {
      filters: { name: employeeId },
      fields: [
        "name", "employee_name", "company_email", "status",
        "department", "designation", "date_of_joining", "relieving_date", "company",
      ],
      limit_page_length: 1,
    });

    if (!frappeEmp) throw new Error(`Employee not found: ${employeeId}`);

    const email = frappeEmp.company_email;
    const [disc, cases, findings] = await Promise.all([
      this.discovery.discoverUserAccess(email),
      this.store.listCases({ primary_email: email }),
      this.store.listFindings(),
    ]);

    const empFindings = findings.filter((f) => {
      const c = cases.find((c) => c.name === f.case);
      return c && c.primary_email === email;
    });

    const apps = disc.artifacts.map((a) => ({
      app_name: a.app_display_name || "Unknown",
      client_id: a.client_id || "",
      status: a.status,
      risk_level: a.risk_level,
      artifact_name: a.name,
    }));

    return {
      employee: {
        id: frappeEmp.name,
        name: frappeEmp.employee_name,
        email,
        status: this.mapEmployeeStatus(frappeEmp.status),
        date_of_joining: frappeEmp.date_of_joining || undefined,
        relieving_date: frappeEmp.relieving_date || undefined,
        department: frappeEmp.department || undefined,
        designation: frappeEmp.designation || undefined,
        company: frappeEmp.company || undefined,
      },
      cases,
      artifacts: disc.artifacts,
      findings: empFindings,
      apps,
      summary: {
        total_cases: cases.length,
        active_artifacts: disc.artifacts.length,
        open_findings: empFindings.filter((f) => !f.closed_at).length,
        apps_used: apps.length,
      },
    };
  }

  async revokeEmployeeAccess(employeeId: string, scope: string): Promise<RemediationResult> {
    const detail = await this.getEmployeeDetail(employeeId);
    const email = detail.employee.email;

    if (scope === "all" || scope === "full_bundle") {
      const result = await this.remediation.fullRemediation(email);
      await this.store.logAction({
        actorUser: "admin",
        actionType: "RevokeEmployeeAccess",
        targetEmail: email,
        result: JSON.stringify(result),
        remediationType: scope,
      });
      return { status: result.success ? "success" : "error", action: scope };
    } else if (scope === "tokens") {
      await this.remediation.revokeAllOAuthGrants(email);
      return { status: "success", action: "tokens" };
    } else if (scope === "sign_out") {
      await this.remediation.revokeSignInSessions(email);
      return { status: "success", action: "sign_out" };
    }

    return { status: "error", action: scope };
  }

  // ── OAuth Apps (aggregated from Graph API) ────────────────

  async getAllActiveOAuthApps(): Promise<OAuthAppSummary[]> {
    const employees = await this.getEmployeeList();
    const leftEmails = employees.filter((e) => e.emp_status === "Left").map((e) => e.company_email);
    const appMap = new Map<string, OAuthAppSummary>();

    for (const email of leftEmails) {
      try {
        const disc = await this.discovery.discoverUserAccess(email);
        for (const a of disc.artifacts) {
          const key = a.client_id || a.app_display_name || "unknown";
          const existing = appMap.get(key);
          if (existing) {
            existing.grant_count++;
          } else {
            appMap.set(key, {
              client_id: key,
              app_display_name: a.app_display_name || key,
              grant_count: 1,
            });
          }
        }
      } catch {
        // skip
      }
    }

    return [...appMap.values()].sort((a, b) => b.grant_count - a.grant_count);
  }

  async getAppDetail(clientId: string): Promise<AppDetail> {
    const employees = await this.getEmployeeList();
    const leftEmails = employees.filter((e) => e.emp_status === "Left").map((e) => e.company_email);
    const users: AppDetail["users"] = [];
    const allScopes = new Set<string>();

    for (const email of leftEmails) {
      try {
        const disc = await this.discovery.discoverUserAccess(email);
        const matching = disc.artifacts.filter((a) => a.client_id === clientId);
        for (const a of matching) {
          const scopes = JSON.parse(a.scopes_json || "[]") as string[];
          scopes.forEach((s) => allScopes.add(s));
          users.push({
            email,
            status: a.status,
            risk_level: a.risk_level,
            case: a.case,
            artifact_name: a.name,
            granted: a.creation || "",
            scopes: scopes.map((s) => ({ scope: s, full: s, level: s.includes("Write") ? "write" : "read" })),
            raw_scopes: scopes,
          });
        }
      } catch {
        // skip
      }
    }

    return {
      client_id: clientId,
      app_name: users[0]?.artifact_name ? "App" : clientId,
      total_grants: users.length,
      active_grants: users.filter((u) => u.status === "Active").length,
      revoked_grants: 0,
      cases_affected: [...new Set(users.map((u) => u.case))],
      scopes: [...allScopes],
      users,
    };
  }

  async globalAppRemoval(clientId: string, appName: string): Promise<RemediationResult> {
    const detail = await this.getAppDetail(clientId);
    let revoked = 0;
    for (const user of detail.users) {
      if (user.status === "Active") {
        try {
          await this.remediation.revokeOAuthGrantsForApp(user.email, clientId);
          revoked++;
        } catch { /* continue */ }
      }
    }
    return { status: "success", revoked };
  }

  async revokeAppForUsers(clientId: string, artifactNames: string[]): Promise<RemediationResult> {
    return this.globalAppRemoval(clientId, "");
  }

  async restoreAppForUsers(clientId: string, artifactNames: string[]): Promise<RemediationResult> {
    return { status: "error", action: "restore not supported for Microsoft 365" };
  }

  async updateUserScopes(artifactName: string, scopes: string[]): Promise<{ removed: number; added: number }> {
    return { removed: 0, added: 0 };
  }

  // ── Audit Log (local SQLite) ──────────────────────────────

  async listAuditLogs(filters?: Record<string, unknown>): Promise<UnifiedAuditLogEntry[]> {
    return this.store.listAuditLogs(filters);
  }

  // ── Settings (local SQLite) ───────────────────────────────

  async getSettings(): Promise<OGMSettings> {
    return this.store.getSettings();
  }

  async updateSettings(settings: Partial<OGMSettings>): Promise<OGMSettings> {
    return this.store.updateSettings(settings);
  }

  // ── Chat ──────────────────────────────────────────────────

  async chat(message: string): Promise<{ reply: string; sources: { title: string; url: string }[] }> {
    return { reply: "Chat not yet implemented with unified provider.", sources: [] };
  }

  // ── Helpers ───────────────────────────────────────────────

  private mapEmployeeStatus(frappeStatus: string): Employee["emp_status"] {
    if (frappeStatus === "Left") return "Left";
    if (frappeStatus === "Suspended") return "Suspended";
    return "Active";
  }
}
