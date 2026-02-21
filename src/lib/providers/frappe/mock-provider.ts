/**
 * Mock provider — serves test data when Frappe is unavailable.
 * Replicates the same behavior as the Frappe provider but against in-memory data.
 */

import type { HrProvider, AuthSession } from "@/lib/providers/interface";
import type { LiveDataProvider } from "@/lib/chatbot";
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

const FRAPPE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || "http://localhost:8000";
const FRAPPE_ADMIN_USER = process.env.FRAPPE_ADMIN_USER || "Administrator";
const FRAPPE_ADMIN_PASS = process.env.FRAPPE_ADMIN_PASS || "admin";

let _frappeEmployeeCache: { data: Employee[] | null; ts: number } = { data: null, ts: 0 };
const EMPLOYEE_CACHE_TTL = 60_000;

async function fetchFrappeEmployees(): Promise<Employee[] | null> {
  if (typeof process !== "undefined" && process.env?.VITEST) return null;
  if (_frappeEmployeeCache.data && Date.now() - _frappeEmployeeCache.ts < EMPLOYEE_CACHE_TTL) {
    return _frappeEmployeeCache.data;
  }
  try {
    const loginRes = await fetch(`${FRAPPE_URL}/api/method/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usr: FRAPPE_ADMIN_USER, pwd: FRAPPE_ADMIN_PASS }),
    });
    if (!loginRes.ok) return null;

    const rawCookies = loginRes.headers.getSetCookie?.() ?? [];
    const cookieStr = rawCookies.length
      ? rawCookies.map(c => c.split(";")[0]).join("; ")
      : loginRes.headers.get("set-cookie")?.split(",").map(c => c.trim().split(";")[0]).join("; ") ?? "";

    const params = new URLSearchParams({
      fields: JSON.stringify(["name", "employee_name", "company_email", "status", "department", "designation", "date_of_joining", "relieving_date", "company"]),
      limit_page_length: "0",
    });
    const empRes = await fetch(`${FRAPPE_URL}/api/resource/Employee?${params}`, {
      headers: { Accept: "application/json", Cookie: cookieStr },
    });
    if (!empRes.ok) return null;

    const json = await empRes.json();
    const employees: Employee[] = ((json.data as Record<string, string>[]) || []).map(e => ({
      employee_id: e.name,
      employee_name: e.employee_name || "",
      company_email: e.company_email || "",
      emp_status: (e.status === "Left" ? "Left" : e.status === "Suspended" ? "Suspended" : "Active") as Employee["emp_status"],
      date_of_joining: e.date_of_joining || undefined,
      relieving_date: e.relieving_date || undefined,
      department: e.department || undefined,
      designation: e.designation || undefined,
      company: e.company || undefined,
    }));
    _frappeEmployeeCache = { data: employees, ts: Date.now() };
    return employees;
  } catch {
    return null;
  }
}

async function getEmployeeSource(): Promise<Employee[]> {
  const frappe = await fetchFrappeEmployees();
  return frappe ?? clone(mockEmployees);
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

let _auditSeq = 0;
function logAction(actionType: string, targetEmail: string, data?: Record<string, unknown>) {
  _auditSeq++;
  auditLogs.unshift({
    name: `AUD-MOCK-${Date.now()}-${_auditSeq}`,
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
    this._checkOverdueRemediations();

    const pendingScan = cases.filter(c => ["Draft", "Scheduled"].includes(c.status)).length;
    const criticalFindings = findings.filter(f => f.severity === "Critical" && !f.closed_at);
    const criticalCaseNames = new Set(criticalFindings.map(f => f.case));

    const oauthGrants = artifacts.filter(a => a.artifact_type === "OAuthToken" && a.status === "Active").length;
    const postOffboardLogins = findings.filter(f =>
      ["PostOffboardLogin", "PostOffboardSuspiciousLogin"].includes(f.finding_type) && !f.closed_at
    ).length;

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
        oauth_grants: oauthGrants,
        post_offboard_logins: postOffboardLogins,
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

  async listCases(_filters?: Record<string, unknown>): Promise<OffboardingCase[]> {
    this._checkOverdueRemediations();
    return clone(cases);
  }

  async getCaseDetail(caseName: string): Promise<CaseDetail> {
    this._checkOverdueRemediations();
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
    const allEmps = await getEmployeeSource();
    const emp = allEmps.find(e => e.employee_id === employeeId);
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
        const allEmps = await getEmployeeSource();
        const emp = allEmps.find(e => e.company_email === art.subject_email);
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

  async executeRemediation(caseName: string, action: string, _kwargs?: Record<string, unknown>): Promise<RemediationResult> {
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
    const baseEmployees = await getEmployeeSource();
    return baseEmployees.map(e => {
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
    const allEmps = await getEmployeeSource();
    const emp = allEmps.find(e => e.employee_id === employeeId);
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

  async listAuditLogs(_filters?: Record<string, unknown>): Promise<UnifiedAuditLogEntry[]> {
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
    const { chat: knowledgeChat } = await import("@/lib/chatbot");

    const liveDataProvider: LiveDataProvider = {
      getCaseCounts: async () => {
        const counts: Record<string, number> = {};
        for (const s of ["Draft", "Scheduled", "All Clear", "Gaps Found", "Remediated", "Closed"]) {
          const n = cases.filter(c => c.status === s).length;
          if (n > 0) counts[s] = n;
        }
        return counts;
      },
      getTotalCases: async () => cases.length,
      getOpenFindings: async () => findings.filter(f => !f.closed_at).length,
      getTotalFindings: async () => findings.length,
      getCriticalFindings: async () => findings.filter(f => f.severity === "Critical" && !f.closed_at).length,
      getActiveArtifacts: async () => artifacts.filter(a => a.status === "Active").length,
      getTotalArtifacts: async () => artifacts.length,
      getHiddenArtifacts: async () => artifacts.filter(a => a.status === "Hidden").length,
      getOffboardedEmployees: async () => {
        const emps = await getEmployeeSource();
        return emps.filter(e => e.emp_status === "Left").length;
      },
    };

    return knowledgeChat(message, {
      apiKey: process.env.OPENROUTER_API_KEY,
      liveDataProvider,
    });
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

  private _checkOverdueRemediations() {
    const now = new Date();
    for (const c of cases) {
      if (c.status === "Scheduled" && c.scheduled_remediation_date) {
        const scheduled = new Date(c.scheduled_remediation_date);
        if (scheduled <= now) {
          const caseArtifacts = artifacts.filter(a => a.case === c.name && a.status === "Active");
          for (const art of caseArtifacts) {
            art.status = art.artifact_type === "ASP" ? "Deleted" : "Revoked";
          }
          const caseFindings = findings.filter(f => f.case === c.name && !f.closed_at);
          for (const f of caseFindings) {
            f.closed_at = now.toISOString();
          }
          c.status = "Remediated";
          logAction("ScheduledRemediationExecuted", c.primary_email, {
            case: c.name,
            scheduled_for: c.scheduled_remediation_date,
            artifacts_remediated: caseArtifacts.length,
            findings_closed: caseFindings.length,
          });
        }
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
