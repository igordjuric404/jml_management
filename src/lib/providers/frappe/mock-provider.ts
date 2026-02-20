/**
 * Mock provider — serves test data when Frappe is unavailable.
 * Replicates the same behavior as the Frappe provider but against in-memory data.
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
  mockEmployees,
  mockCases,
  mockArtifacts,
  mockFindings,
  mockAuditLogs,
  mockSettings,
} from "./mock-data";
import { sendFindingAlert } from "@/lib/email";

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

let cases = clone(mockCases);
let artifacts = clone(mockArtifacts);
let findings = clone(mockFindings);
let auditLogs = clone(mockAuditLogs);
let settings = clone(mockSettings);

export function resetMockData() {
  cases = clone(mockCases);
  artifacts = clone(mockArtifacts);
  findings = clone(mockFindings);
  auditLogs = clone(mockAuditLogs);
  settings = clone(mockSettings);
}

function logAction(actionType: string, targetEmail: string, data?: Record<string, unknown>) {
  auditLogs.unshift({
    name: `AUD-MOCK-${Date.now()}`,
    actor_user: "Administrator",
    action_type: actionType,
    target_email: targetEmail,
    result: "Success",
    request_json: JSON.stringify(data || {}),
    timestamp: new Date().toISOString(),
    creation: new Date().toISOString(),
  });
}

export class MockProvider implements HrProvider {
  readonly name = "mock";

  async authenticate(username: string, password: string): Promise<AuthSession> {
    if (username === "Administrator" && password === "admin") {
      return { user: "Administrator", full_name: "Admin User", roles: ["System Manager", "HR Manager"] };
    }
    if (username === "hr@testcorp.com" && password === "admin") {
      return { user: "hr@testcorp.com", full_name: "HR Manager", roles: ["HR Manager"] };
    }
    throw new Error("Invalid credentials. Use Administrator/admin or hr@testcorp.com/admin");
  }

  async logout(): Promise<void> {}

  async getSession(): Promise<AuthSession | null> {
    return { user: "Administrator", full_name: "Admin User", roles: ["System Manager", "HR Manager"] };
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const now = Date.now();
    const sevenDays = 7 * 86400000;
    const thirtyDays = 30 * 86400000;

    const pendingScan = cases.filter(c => ["Draft", "Scheduled"].includes(c.status)).length;
    const criticalFindings = findings.filter(f => f.severity === "Critical" && !f.closed_at);
    const criticalCaseNames = new Set(criticalFindings.map(f => f.case));

    const activeTokens7d = artifacts.filter(a =>
      a.artifact_type === "OAuthToken" && a.status === "Active" &&
      a.creation && (now - new Date(a.creation).getTime()) < sevenDays
    );
    const activeTokens30d = artifacts.filter(a =>
      a.artifact_type === "OAuthToken" && a.status === "Active" &&
      a.creation && (now - new Date(a.creation).getTime()) < thirtyDays
    );

    const loginFindings7d = findings.filter(f =>
      ["PostOffboardLogin", "PostOffboardSuspiciousLogin"].includes(f.finding_type) &&
      f.creation && (now - new Date(f.creation).getTime()) < sevenDays
    );

    const topApps = this._getTopApps();

    const riskyCases: DashboardStats["risky_cases"] = cases
      .filter(c => !["Closed", "Remediated"].includes(c.status))
      .map(c => {
        const caseFindings = findings.filter(f => f.case === c.name);
        return {
          case_name: c.name,
          primary_email: c.primary_email,
          employee_name: c.employee_name,
          status: c.status,
          effective_date: c.effective_date,
          finding_count: caseFindings.length,
          critical_count: caseFindings.filter(f => f.severity === "Critical").length,
        };
      })
      .sort((a, b) => b.critical_count - a.critical_count || b.finding_count - a.finding_count)
      .slice(0, 10);

    return {
      kpis: {
        pending_scan: pendingScan,
        critical_gaps: criticalCaseNames.size,
        oauth_grants_7d: activeTokens7d.length,
        oauth_grants_30d: activeTokens30d.length,
        post_offboard_logins_7d: loginFindings7d.length,
        post_offboard_logins_30d: loginFindings7d.length,
        total_cases: cases.length,
        total_findings: findings.length,
        total_artifacts: artifacts.length,
      },
      top_oauth_apps: topApps,
      risky_cases: riskyCases,
    };
  }

  async getStatistics(): Promise<Statistics> {
    return {
      mean_time_to_enforce_hours: 48.5,
      top_apps_by_exposure: this._getTopApps(),
      scope_heatmap: [
        { scope: "googleapis.com/auth/drive", count: 8 },
        { scope: "googleapis.com/auth/gmail", count: 5 },
        { scope: "googleapis.com/auth/calendar", count: 4 },
        { scope: "googleapis.com/auth/admin", count: 3 },
      ],
      residual_access_trend: [
        { week: "202548", finding_count: 2 },
        { week: "202549", finding_count: 4 },
        { week: "202550", finding_count: 3 },
        { week: "202551", finding_count: 5 },
      ],
    };
  }

  async listCases(): Promise<OffboardingCase[]> {
    return clone(cases);
  }

  async getCaseDetail(caseName: string): Promise<CaseDetail> {
    const c = cases.find(c => c.name === caseName);
    if (!c) throw new Error(`Case not found: ${caseName}`);

    const caseArtifacts = artifacts.filter(a => a.case === caseName && a.status !== "Hidden");
    const caseFindings = findings.filter(f => f.case === caseName);
    const caseLogs = auditLogs.filter(l => l.target_email === c.primary_email);

    return {
      case: clone(c),
      artifacts: {
        tokens: caseArtifacts.filter(a => a.artifact_type === "OAuthToken"),
        asps: caseArtifacts.filter(a => a.artifact_type === "ASP"),
        login_events: caseArtifacts.filter(a => a.artifact_type === "LoginEvent"),
        other: caseArtifacts.filter(a => !["OAuthToken", "ASP", "LoginEvent"].includes(a.artifact_type)),
        total: caseArtifacts.length,
      },
      findings: caseFindings,
      audit_logs: caseLogs,
    };
  }

  async createCase(data: Partial<OffboardingCase>): Promise<OffboardingCase> {
    const newCase: OffboardingCase = {
      name: `OBC-MOCK-${Date.now()}`,
      employee: data.employee || "",
      employee_name: data.employee_name || "",
      primary_email: data.primary_email || "",
      event_type: data.event_type || "Offboard",
      effective_date: data.effective_date || new Date().toISOString(),
      status: "Draft",
      notify_user_1w: false,
      notify_user_1d: false,
      notes: data.notes,
      creation: new Date().toISOString(),
    };
    cases.unshift(newCase);
    logAction("CaseCreated", newCase.primary_email, { case: newCase.name });
    return clone(newCase);
  }

  async createCaseFromEmployee(employeeId: string): Promise<OffboardingCase> {
    const emp = mockEmployees.find(e => e.employee_id === employeeId);
    if (!emp) throw new Error(`Employee not found: ${employeeId}`);
    return this.createCase({
      employee: employeeId,
      employee_name: emp.employee_name,
      primary_email: emp.company_email,
      event_type: "Offboard",
    });
  }

  async updateCase(caseName: string, data: Partial<OffboardingCase>): Promise<OffboardingCase> {
    const idx = cases.findIndex(c => c.name === caseName);
    if (idx === -1) throw new Error(`Case not found: ${caseName}`);
    cases[idx] = { ...cases[idx], ...data };
    return clone(cases[idx]);
  }

  async triggerScan(caseName: string): Promise<{ status: string; message: string }> {
    const c = cases.find(c => c.name === caseName);
    if (!c) throw new Error(`Case not found: ${caseName}`);

    logAction("ScanStarted", c.primary_email, { case: caseName });

    const activeArt = artifacts.filter(a => a.case === caseName && a.status === "Active").length;
    const openFind = findings.filter(f => f.case === caseName && !f.closed_at).length;

    c.status = (activeArt > 0 || openFind > 0) ? "Gaps Found" : "All Clear";

    logAction("ScanFinished", c.primary_email, {
      case: caseName, active_artifacts: activeArt,
      open_findings: openFind, new_status: c.status,
    });

    return { status: "success", message: `Scan completed for ${c.primary_email}` };
  }

  async systemScan(): Promise<{ status: string; message: string }> {
    logAction("ScanStarted", "SYSTEM", { scan_type: "system_scan" });

    const hidden = artifacts.filter(a => a.status === "Hidden");
    let discoveries = 0;

    for (const art of hidden) {
      let caseForEmail = cases.find(c =>
        c.primary_email === art.subject_email && !["Closed"].includes(c.status)
      );
      if (!caseForEmail) {
        const emp = mockEmployees.find(e => e.company_email === art.subject_email);
        caseForEmail = {
          name: `OBC-MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          employee: emp?.employee_id || "",
          employee_name: emp?.employee_name || "",
          primary_email: art.subject_email,
          event_type: "Offboard",
          effective_date: new Date().toISOString(),
          status: "Gaps Found",
          notify_user_1w: false,
          notify_user_1d: false,
          creation: new Date().toISOString(),
        };
        cases.push(caseForEmail);
      }

      art.status = "Active";
      art.case = caseForEmail.name;
      caseForEmail.status = "Gaps Found";

      const findingType = {
        OAuthToken: "LingeringOAuthGrant" as const,
        ASP: "LingeringASP" as const,
        LoginEvent: "PostOffboardLogin" as const,
        AdminMFA: "AdminMFAWeak" as const,
        DWDChange: "DWDHighRisk" as const,
      }[art.artifact_type] || "LingeringOAuthGrant" as const;

      findings.push({
        name: `FND-MOCK-${Date.now()}-${discoveries}`,
        case: caseForEmail.name,
        finding_type: findingType,
        severity: (art.risk_level as "Low" | "Medium" | "High" | "Critical") || "Medium",
        summary: `${art.app_display_name || "Unknown"} discovered during system scan for ${art.subject_email}.`,
        recommended_action: "Review and remediate.",
        creation: new Date().toISOString(),
      });
      discoveries++;
    }

    logAction("ScanFinished", "SYSTEM", { scan_type: "system_scan", discoveries });

    if (settings.notify_on_new_findings && discoveries > 0) {
      const criticalFindings = findings.filter(
        f => !f.closed_at && (f.severity === "Critical" || f.severity === "High")
      ).slice(-discoveries);
      for (const f of criticalFindings) {
        const c = cases.find(c2 => c2.name === f.case);
        sendFindingAlert({
          findingName: f.name,
          severity: f.severity,
          findingType: f.finding_type,
          summary: f.summary,
          caseName: f.case,
          employeeEmail: c?.primary_email || "unknown",
        }, settings.notification_email || undefined).catch(() => {});
      }
    }

    return { status: "success", message: `System scan found ${discoveries} new issue(s).` };
  }

  async getScanHistory(): Promise<ScanHistoryEntry[]> {
    const scanLogs = auditLogs.filter(l =>
      ["ScanStarted", "ScanFinished"].includes(l.action_type)
    );
    const scanEntries: ScanHistoryEntry[] = [];

    for (const log of scanLogs) {
      if (log.action_type !== "ScanStarted") continue;
      const req = JSON.parse(log.request_json || "{}");
      const finished = scanLogs.find(l =>
        l.action_type === "ScanFinished" && l.target_email === log.target_email
      );
      const finishedData = finished ? JSON.parse(finished.request_json || "{}") : {};

      scanEntries.push({
        scan_id: log.name,
        case: req.case || "",
        target_email: log.target_email,
        trigger: log.actor_user?.includes("Scheduler") ? "automatic" : "manual",
        actor: log.actor_user,
        started_at: log.timestamp,
        result: finished ? "Completed" : "Pending",
        new_status: finishedData.new_status || "",
        active_artifacts: finishedData.active_artifacts || 0,
        open_findings: finishedData.open_findings,
        findings_link: req.case ? `/findings?case=${req.case}` : "",
      });
    }
    return scanEntries;
  }

  async executeRemediation(caseName: string, action: string): Promise<RemediationResult> {
    const c = cases.find(c => c.name === caseName);
    if (!c) throw new Error(`Case not found: ${caseName}`);

    logAction("RemediationStarted", c.primary_email, { case: caseName, action });

    if (action === "full_bundle") {
      const caseArtifacts = artifacts.filter(a => a.case === caseName && a.status === "Active");
      for (const art of caseArtifacts) {
        art.status = art.artifact_type === "ASP" ? "Deleted" : "Revoked";
      }
      const caseFindings = findings.filter(f => f.case === caseName && !f.closed_at);
      for (const f of caseFindings) {
        f.closed_at = new Date().toISOString();
      }
      c.status = "Remediated";
      logAction("RemediationCompleted", c.primary_email, { case: caseName, action, artifacts_remediated: caseArtifacts.length });
      return { status: "success", action, artifacts_remediated: caseArtifacts.length, findings_closed: caseFindings.length };
    }

    if (action === "revoke_token") {
      const tokens = artifacts.filter(a => a.case === caseName && a.artifact_type === "OAuthToken" && a.status === "Active");
      for (const t of tokens) t.status = "Revoked";
      this._closeFindingsForCase(caseName, ["LingeringOAuthGrant"]);
      this._rescanCase(caseName);
      return { status: "success", action, revoked: tokens.length };
    }

    if (action === "delete_asp") {
      const asps = artifacts.filter(a => a.case === caseName && a.artifact_type === "ASP" && a.status === "Active");
      for (const a of asps) a.status = "Deleted";
      this._closeFindingsForCase(caseName, ["LingeringASP"]);
      this._rescanCase(caseName);
      return { status: "success", action, deleted: asps.length };
    }

    if (action === "sign_out") {
      const logins = artifacts.filter(a => a.case === caseName && a.artifact_type === "LoginEvent" && a.status === "Active");
      for (const l of logins) l.status = "Acknowledged";
      this._closeFindingsForCase(caseName, ["PostOffboardLogin", "PostOffboardSuspiciousLogin"]);
      this._rescanCase(caseName);
      return { status: "success", action };
    }

    throw new Error(`Unknown action: ${action}`);
  }

  async bulkRemediate(caseName: string, artifactNames: string[]): Promise<RemediationResult> {
    let revoked = 0, deleted = 0;
    for (const name of artifactNames) {
      const art = artifacts.find(a => a.name === name);
      if (!art) continue;
      if (art.artifact_type === "OAuthToken") { art.status = "Revoked"; revoked++; }
      else if (art.artifact_type === "ASP") { art.status = "Deleted"; deleted++; }
    }
    this._rescanCase(caseName);
    return { status: "success", revoked, deleted };
  }

  async remediateArtifacts(docnames: string[]): Promise<RemediationResult> {
    let revoked = 0, deleted = 0;
    const casesAffected = new Set<string>();
    for (const name of docnames) {
      const art = artifacts.find(a => a.name === name);
      if (!art || art.status !== "Active") continue;
      if (art.artifact_type === "OAuthToken") { art.status = "Revoked"; revoked++; }
      else if (art.artifact_type === "ASP") { art.status = "Deleted"; deleted++; }
      else { art.status = "Acknowledged"; }
      if (art.case) casesAffected.add(art.case);
    }
    for (const cn of casesAffected) this._rescanCase(cn);
    return { status: "success", revoked, deleted };
  }

  async runScheduledRemediationNow(caseName: string): Promise<RemediationResult> {
    return this.executeRemediation(caseName, "full_bundle");
  }

  async listArtifacts(filters?: Record<string, unknown>): Promise<AccessArtifact[]> {
    let result = clone(artifacts);
    if (filters) {
      if (filters.status) result = result.filter(a => a.status === filters.status);
      if (filters.case) result = result.filter(a => a.case === filters.case);
      if (filters.artifact_type) result = result.filter(a => a.artifact_type === filters.artifact_type);
    }
    return result;
  }

  async getArtifact(name: string): Promise<AccessArtifact> {
    const art = artifacts.find(a => a.name === name);
    if (!art) throw new Error(`Artifact not found: ${name}`);
    return clone(art);
  }

  async listFindings(filters?: Record<string, unknown>): Promise<Finding[]> {
    let result = clone(findings);
    if (filters) {
      if (filters.case) result = result.filter(f => f.case === filters.case);
      if (filters.severity) result = result.filter(f => f.severity === filters.severity);
      if (filters.finding_type) result = result.filter(f => f.finding_type === filters.finding_type);
    }
    return result;
  }

  async getFinding(name: string): Promise<Finding> {
    const f = findings.find(f => f.name === name);
    if (!f) throw new Error(`Finding not found: ${name}`);
    return clone(f);
  }

  async remediateFinding(name: string): Promise<RemediationResult> {
    const f = findings.find(f => f.name === name);
    if (!f) throw new Error(`Finding not found: ${name}`);
    if (f.closed_at) throw new Error(`Finding already closed: ${name}`);

    f.closed_at = new Date().toISOString();

    const relatedArtifacts = artifacts.filter(a => a.case === f.case && a.status === "Active");
    const typeMap: Record<string, string[]> = {
      LingeringOAuthGrant: ["OAuthToken"],
      LingeringASP: ["ASP"],
      PostOffboardLogin: ["LoginEvent"],
      PostOffboardSuspiciousLogin: ["LoginEvent"],
      AdminMFAWeak: ["AdminMFA"],
      DWDHighRisk: ["DWDChange"],
    };
    const targetTypes = typeMap[f.finding_type] || [];
    let remediated = 0;
    for (const a of relatedArtifacts) {
      if (targetTypes.includes(a.artifact_type)) {
        a.status = a.artifact_type === "ASP" ? "Deleted" : "Revoked";
        remediated++;
      }
    }

    logAction("RemediationCompleted", f.case, { finding: name, artifacts_remediated: remediated });
    this._rescanCase(f.case);

    return { status: "success", artifacts_remediated: remediated, findings_closed: 1 };
  }

  async getEmployeeList(): Promise<Employee[]> {
    return clone(mockEmployees)
      .map(e => {
        const empCases = cases.filter(c => c.employee === e.employee_id);
        const caseNames = empCases.map(c => c.name);
        const caseArtifacts = artifacts.filter(a => caseNames.includes(a.case));
        const emailArtifacts = artifacts.filter(a => a.subject_email === e.company_email && !a.case);
        const allArtifacts = [...caseArtifacts, ...emailArtifacts];
        const empFindings = findings.filter(f => caseNames.includes(f.case));
        return {
          ...e,
          case_count: empCases.length,
          active_artifacts: allArtifacts.filter(a => a.status === "Active").length,
          open_findings: empFindings.filter(f => !f.closed_at).length,
        };
      });
  }

  async getEmployeeDetail(employeeId: string): Promise<EmployeeDetail> {
    const emp = mockEmployees.find(e => e.employee_id === employeeId);
    if (!emp) throw new Error(`Employee not found: ${employeeId}`);

    const empCases = cases.filter(c => c.employee === employeeId);
    const caseNames = empCases.map(c => c.name);
    const caseArtifacts = artifacts.filter(a => caseNames.includes(a.case));
    const emailArtifacts = artifacts.filter(a => a.subject_email === emp.company_email && !a.case);
    const empArtifacts = [...caseArtifacts, ...emailArtifacts];
    const empFindings = findings.filter(f => caseNames.includes(f.case));

    const apps: Record<string, { app_name: string; client_id: string; status: string; risk_level?: string; artifact_name: string }> = {};
    for (const a of empArtifacts) {
      if (a.artifact_type === "OAuthToken" && a.app_display_name) {
        const key = a.client_id || a.app_display_name;
        if (!apps[key]) {
          apps[key] = { app_name: a.app_display_name, client_id: a.client_id || "", status: a.status, risk_level: a.risk_level, artifact_name: a.name };
        }
      }
    }

    return {
      employee: {
        id: emp.employee_id,
        name: emp.employee_name,
        email: emp.company_email,
        status: emp.emp_status,
        date_of_joining: emp.date_of_joining,
        relieving_date: emp.relieving_date,
        department: emp.department,
        designation: emp.designation,
        company: emp.company,
      },
      cases: empCases,
      artifacts: empArtifacts,
      findings: empFindings,
      apps: Object.values(apps),
      summary: {
        total_cases: empCases.length,
        active_artifacts: empArtifacts.filter(a => a.status === "Active").length,
        open_findings: empFindings.filter(f => !f.closed_at).length,
        apps_used: Object.keys(apps).length,
      },
    };
  }

  async revokeEmployeeAccess(employeeId: string, scope: string): Promise<RemediationResult> {
    const empCases = cases.filter(c =>
      c.employee === employeeId && !["Closed", "Remediated"].includes(c.status)
    );
    let totalArtifacts = 0, totalFindings = 0;
    for (const c of empCases) {
      const res = await this.executeRemediation(c.name, scope === "tokens" ? "revoke_token" : scope === "asps" ? "delete_asp" : "full_bundle");
      totalArtifacts += res.artifacts_remediated || res.revoked || res.deleted || 0;
      totalFindings += res.findings_closed || 0;
    }
    return { status: "success", artifacts_remediated: totalArtifacts, findings_closed: totalFindings };
  }

  async getAllActiveOAuthApps(): Promise<OAuthAppSummary[]> {
    const appMap: Record<string, OAuthAppSummary> = {};
    for (const a of artifacts) {
      if (a.artifact_type !== "OAuthToken" || a.status !== "Active" || !a.client_id) continue;
      if (!appMap[a.client_id]) {
        appMap[a.client_id] = {
          client_id: a.client_id,
          app_display_name: a.app_display_name || "Unknown",
          grant_count: 0,
          user_count: 0,
          case_count: 0,
        };
      }
      appMap[a.client_id].grant_count!++;
    }
    for (const clientId of Object.keys(appMap)) {
      const arts = artifacts.filter(a => a.client_id === clientId && a.status === "Active");
      appMap[clientId].user_count = new Set(arts.map(a => a.subject_email)).size;
      appMap[clientId].case_count = new Set(arts.map(a => a.case).filter(Boolean)).size;
    }
    return Object.values(appMap).sort((a, b) => b.grant_count - a.grant_count);
  }

  async getAppDetail(clientId: string): Promise<AppDetail> {
    const appArtifacts = artifacts.filter(a => a.client_id === clientId && a.artifact_type === "OAuthToken");
    const appName = appArtifacts[0]?.app_display_name || clientId;
    const scopeSet = new Set<string>();
    const users = appArtifacts.map(a => {
      const rawScopes: string[] = JSON.parse(a.scopes_json || "[]");
      rawScopes.forEach(s => { const parts = s.split("/"); scopeSet.add(parts[parts.length - 1] || s); });
      return {
        email: a.subject_email,
        status: a.status,
        risk_level: a.risk_level,
        case: a.case || "",
        artifact_name: a.name,
        granted: a.creation || "",
        scopes: rawScopes.map(s => {
          const parts = s.split("/");
          const name = parts[parts.length - 1] || s;
          return { scope: name, full: s, level: /send|modify|compose|write|admin|manage/i.test(name) ? "write" as const : "read" as const };
        }),
        raw_scopes: rawScopes,
      };
    });

    return {
      client_id: clientId,
      app_name: appName,
      total_grants: appArtifacts.length,
      active_grants: appArtifacts.filter(a => a.status === "Active").length,
      revoked_grants: appArtifacts.filter(a => a.status === "Revoked").length,
      cases_affected: [...new Set(appArtifacts.map(a => a.case).filter(Boolean))],
      scopes: [...scopeSet].sort(),
      users,
    };
  }

  async globalAppRemoval(clientId: string, appName: string): Promise<RemediationResult> {
    const toRevoke = artifacts.filter(a => a.client_id === clientId && a.status === "Active" && a.artifact_type === "OAuthToken");
    const casesAffected = new Set<string>();
    for (const a of toRevoke) {
      a.status = "Revoked";
      if (a.case) casesAffected.add(a.case);
    }
    for (const cn of casesAffected) this._rescanCase(cn);
    logAction("GlobalAppRemoval", "", { client_id: clientId, app_name: appName, revoked: toRevoke.length });
    return { status: "success", revoked: toRevoke.length };
  }

  async revokeAppForUsers(clientId: string, artifactNames: string[]): Promise<RemediationResult> {
    let revoked = 0;
    const casesAffected = new Set<string>();
    for (const name of artifactNames) {
      const art = artifacts.find(a => a.name === name);
      if (art && art.status === "Active" && art.artifact_type === "OAuthToken") {
        art.status = "Revoked";
        revoked++;
        if (art.case) casesAffected.add(art.case);
      }
    }
    for (const cn of casesAffected) this._rescanCase(cn);
    return { status: "success", revoked };
  }

  async restoreAppForUsers(clientId: string, artifactNames: string[]): Promise<RemediationResult> {
    let restored = 0;
    const casesAffected = new Set<string>();
    for (const name of artifactNames) {
      const art = artifacts.find(a => a.name === name);
      if (art && art.status === "Revoked" && art.artifact_type === "OAuthToken") {
        art.status = "Active";
        restored++;
        if (art.case) casesAffected.add(art.case);
      }
    }
    for (const cn of casesAffected) this._rescanCase(cn);
    return { status: "success", artifacts_remediated: restored };
  }

  async updateUserScopes(artifactName: string, scopes: string[]): Promise<{ removed: number; added: number }> {
    const art = artifacts.find(a => a.name === artifactName);
    if (!art) throw new Error(`Artifact not found: ${artifactName}`);

    const oldScopes: string[] = JSON.parse(art.scopes_json || "[]");
    art.scopes_json = JSON.stringify(scopes);

    if (!scopes.length && art.status === "Active") art.status = "Revoked";
    else if (scopes.length && art.status === "Revoked") art.status = "Active";

    const removed = oldScopes.filter(s => !scopes.includes(s)).length;
    const added = scopes.filter(s => !oldScopes.includes(s)).length;

    if (art.case) this._rescanCase(art.case);
    return { removed, added };
  }

  async listAuditLogs(): Promise<UnifiedAuditLogEntry[]> {
    return clone(auditLogs);
  }

  async getSettings(): Promise<OGMSettings> {
    return clone(settings);
  }

  async updateSettings(newSettings: Partial<OGMSettings>): Promise<OGMSettings> {
    settings = { ...settings, ...newSettings };
    return clone(settings);
  }

  async chat(message: string): Promise<{ reply: string; sources: { title: string; url: string }[] }> {
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes("audit log") || lowerMsg.includes("audit") || lowerMsg.includes("log")) {
      const recentLogs = auditLogs.slice(0, 5);
      const logSummary = recentLogs.map(l => `- ${l.action_type} by ${l.actor_user} for ${l.target_email} (${l.result})`).join("\n");
      return {
        reply: `Audit logs record every scan, remediation, and admin action. There are ${auditLogs.length} entries.\n\nRecent:\n${logSummary}\n\nView the full audit log →`,
        sources: [{ title: "View Audit Log →", url: "/audit-log" }],
      };
    }

    if (lowerMsg.includes("employee") || lowerMsg.includes("staff") || lowerMsg.includes("people") || lowerMsg.includes("who")) {
      const leftEmps = mockEmployees.filter(e => e.emp_status === "Left");
      const activeEmps = mockEmployees.filter(e => e.emp_status === "Active");
      const empsWithCases = cases.map(c => c.employee);
      const withIssues = mockEmployees.filter(e => empsWithCases.includes(e.employee_id));
      return {
        reply: `${mockEmployees.length} employees: ${activeEmps.length} active, ${leftEmps.length} left.\n${withIssues.length} have offboarding cases.\n\nTop concerns:\n${leftEmps.slice(0, 5).map(e => `- ${e.employee_name} (${e.company_email})`).join("\n")}`,
        sources: [
          { title: "View All Employees →", url: "/employees" },
          ...leftEmps.slice(0, 3).map(e => ({ title: e.employee_name, url: `/employees?employee=${encodeURIComponent(e.employee_id)}` })),
        ],
      };
    }

    if (lowerMsg.includes("remediat") || lowerMsg.includes("fix") || lowerMsg.includes("revoke") || lowerMsg.includes("resolve")) {
      const remediatedCases = cases.filter(c => c.status === "Remediated");
      const gapsCases = cases.filter(c => c.status === "Gaps Found");
      return {
        reply: `Remediation revokes access and closes findings.\n\n**Full Bundle**: revoke tokens → delete ASPs → sign out → close findings.\n\n${remediatedCases.length} cases remediated, ${gapsCases.length} still have gaps.`,
        sources: [
          { title: "View Cases →", url: "/cases" },
          ...gapsCases.slice(0, 3).map(c => ({ title: `${c.employee_name} (${c.status})`, url: `/cases/${c.name}` })),
        ],
      };
    }

    if (lowerMsg.includes("setting") || lowerMsg.includes("config") || lowerMsg.includes("interval") || lowerMsg.includes("schedul")) {
      return {
        reply: `Current settings:\n- Auto scan on offboard: ${settings.auto_scan_on_offboard ? "ON" : "OFF"}\n- Auto remediate: ${settings.auto_remediate_on_offboard ? "ON" : "OFF"}\n- Background scan: ${settings.background_scan_enabled ? "ON" : "OFF"} (${settings.background_scan_interval})\n- Notifications: ${settings.notify_on_new_findings ? "ON" : "OFF"} → ${settings.notification_email || "not set"}`,
        sources: [{ title: "Open Settings →", url: "/settings" }],
      };
    }

    if (lowerMsg.includes("scan") || lowerMsg.includes("discover")) {
      const scanLogs = auditLogs.filter(l => l.action_type === "ScanFinished");
      return {
        reply: `Scans discover lingering access (tokens, ASPs, logins) for offboarded employees.\n\n- **System scan**: checks all hidden artifacts\n- **Case scan**: scans one employee\n- **Background**: runs every ${settings.background_scan_interval}\n\n${scanLogs.length} completed scans so far. Run a system scan from the dashboard.`,
        sources: [
          { title: "Scan History →", url: "/scan-history" },
          { title: "Run System Scan →", url: "/dashboard" },
        ],
      };
    }

    if (lowerMsg.includes("case") || lowerMsg.includes("offboard")) {
      const statusCounts = cases.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const statusSummary = Object.entries(statusCounts).map(([s, c]) => `${s}: ${c}`).join(", ");
      const gapCases = cases.filter(c => c.status === "Gaps Found");
      return {
        reply: `${cases.length} offboarding cases.\n\nBreakdown: ${statusSummary}\n\nCases needing attention:\n${gapCases.slice(0, 5).map(c => `- ${c.employee_name}: ${c.status}`).join("\n")}`,
        sources: [
          { title: "View All Cases →", url: "/cases" },
          ...gapCases.slice(0, 3).map(c => ({ title: c.employee_name, url: `/cases/${c.name}` })),
        ],
      };
    }

    if (lowerMsg.includes("where") && (lowerMsg.includes("artifact") || lowerMsg.includes("token") || lowerMsg.includes("oauth") || lowerMsg.includes("asp") || lowerMsg.includes("access"))) {
      const active = artifacts.filter(a => a.status === "Active");
      const byCase = active.reduce((acc, a) => {
        const key = a.case || "Unlinked";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const caseSummary = Object.entries(byCase).slice(0, 5).map(([c, n]) => {
        const cs = cases.find(x => x.name === c);
        return `- ${cs ? cs.employee_name : c}: ${n} artifact(s)`;
      }).join("\n");
      return {
        reply: `${active.length} active artifacts.\n\nBy employee/case:\n${caseSummary}\n\nClick below to browse artifacts or specific employees.`,
        sources: [
          { title: "View All Artifacts →", url: "/artifacts" },
          { title: "View OAuth Apps →", url: "/apps" },
          ...Object.keys(byCase).slice(0, 2).filter(c => c !== "Unlinked").map(c => {
            const cs = cases.find(x => x.name === c);
            return { title: cs?.employee_name || c, url: `/cases/${c}` };
          }),
        ],
      };
    }

    if (lowerMsg.includes("artifact") || lowerMsg.includes("token") || lowerMsg.includes("oauth") || lowerMsg.includes("asp") || lowerMsg.includes("access")) {
      const active = artifacts.filter(a => a.status === "Active");
      const byType = active.reduce((acc, a) => {
        acc[a.artifact_type] = (acc[a.artifact_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const typeSummary = Object.entries(byType).map(([t, c]) => `${t}: ${c}`).join(", ");
      return {
        reply: `${active.length} active artifacts.\n\nBy type: ${typeSummary}\n\nArtifacts are access mechanisms (tokens, ASPs, logins) needing review.`,
        sources: [
          { title: "View Artifacts →", url: "/artifacts" },
          { title: "View OAuth Apps →", url: "/apps" },
        ],
      };
    }

    if (lowerMsg.includes("finding") || lowerMsg.includes("risk") || lowerMsg.includes("critical") || lowerMsg.includes("severity") || lowerMsg.includes("gap")) {
      const open = findings.filter(f => !f.closed_at);
      const bySev = open.reduce((acc, f) => {
        acc[f.severity] = (acc[f.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const sevSummary = Object.entries(bySev).map(([s, c]) => `${s}: ${c}`).join(", ");
      const critical = open.filter(f => f.severity === "Critical");
      return {
        reply: `${open.length} open findings (${findings.length} total).\n\nSeverity: ${sevSummary}\n\n${critical.length > 0 ? `Critical findings:\n${critical.slice(0, 3).map(f => `- ${f.name}: ${f.summary.slice(0, 60)}`).join("\n")}` : "No critical findings."}`,
        sources: [
          { title: "View All Findings →", url: "/findings" },
          ...critical.slice(0, 2).map(f => ({ title: f.name, url: `/findings?finding=${encodeURIComponent(f.name)}` })),
        ],
      };
    }

    if (lowerMsg.includes("doc") || lowerMsg.includes("help") || lowerMsg.includes("how") || lowerMsg.includes("what") || lowerMsg.includes("explain")) {
      return {
        reply: `OGM manages security for employee offboarding:\n\n1. **Cases** created when employees leave\n2. **Scans** discover lingering access\n3. **Findings** flag policy violations\n4. **Remediation** revokes access\n5. **Audit logs** track everything\n\nIntegrates with Frappe HRMS + Google Workspace.`,
        sources: [
          { title: "Documentation →", url: "/docs" },
          { title: "Dashboard →", url: "/dashboard" },
          { title: "Settings →", url: "/settings" },
        ],
      };
    }

    const totalCases = cases.length;
    const openFindings = findings.filter(f => !f.closed_at).length;
    const activeArtifacts = artifacts.filter(a => a.status === "Active").length;
    return {
      reply: `I can help you with information about the OGM system. Here's a quick overview:\n\n- **${totalCases} offboarding cases** tracked\n- **${openFindings} open findings** requiring attention\n- **${activeArtifacts} active artifacts** across all cases\n\nTry asking about:\n- Cases and their statuses\n- Findings and severity levels\n- Access artifacts (tokens, ASPs)\n- Remediation actions\n- Audit logs\n- Settings and configuration\n- Employees\n- Scanning process`,
      sources: [
        { title: "Dashboard →", url: "/dashboard" },
        { title: "Cases →", url: "/cases" },
        { title: "Findings →", url: "/findings" },
        { title: "Employees →", url: "/employees" },
      ],
    };
  }

  private _getTopApps(): OAuthAppSummary[] {
    const appMap: Record<string, OAuthAppSummary> = {};
    for (const a of artifacts) {
      if (a.artifact_type !== "OAuthToken" || a.status !== "Active" || !a.client_id) continue;
      if (!appMap[a.client_id]) {
        appMap[a.client_id] = { client_id: a.client_id, app_display_name: a.app_display_name || "Unknown", grant_count: 0 };
      }
      appMap[a.client_id].grant_count++;
    }
    return Object.values(appMap).sort((a, b) => b.grant_count - a.grant_count).slice(0, 10);
  }

  private _closeFindingsForCase(caseName: string, types: string[]) {
    for (const f of findings) {
      if (f.case === caseName && types.includes(f.finding_type) && !f.closed_at) {
        f.closed_at = new Date().toISOString();
      }
    }
  }

  private _rescanCase(caseName: string) {
    const c = cases.find(c => c.name === caseName);
    if (!c) return;
    const activeArt = artifacts.filter(a => a.case === caseName && a.status === "Active").length;
    const openFind = findings.filter(f => f.case === caseName && !f.closed_at).length;
    if (activeArt === 0 && openFind === 0) {
      if (["Gaps Found", "Draft", "Scheduled"].includes(c.status)) c.status = "Remediated";
    } else {
      c.status = "Gaps Found";
    }
  }
}
