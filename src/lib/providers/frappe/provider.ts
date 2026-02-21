/**
 * Frappe provider — implements HrProvider against the Frappe REST API.
 * This is the first (and currently only) concrete provider.
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
import { frappeCall, frappeGetDoc, frappeGetList, frappeLogin, setFrappeCookies } from "./client";

export class FrappeProvider implements HrProvider {
  readonly name = "frappe";

  async authenticate(username: string, password: string): Promise<AuthSession> {
    const result = await frappeLogin(username, password);
    setFrappeCookies(result.cookies);
    return {
      user: result.user,
      full_name: result.full_name,
      roles: ["System Manager"],
    };
  }

  async logout(): Promise<void> {
    await frappeCall("logout");
    setFrappeCookies("");
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      const user = await frappeCall<string>("frappe.auth.get_logged_user");
      if (user && user !== "Guest") {
        return { user, full_name: user, roles: ["System Manager"] };
      }
      return null;
    } catch {
      return null;
    }
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const [raw, oauthCount] = await Promise.all([
      frappeCall<DashboardStats>("oauth_gap_monitor.api.get_dashboard_stats"),
      frappeGetList<{ name: string }>("Access Artifact", {
        filters: { artifact_type: "OAuthToken", status: "Active" },
        fields: ["name"],
        limit_page_length: 0,
      }),
    ]);
    const k = raw.kpis as Record<string, number>;
    k.oauth_grants = oauthCount.length;
    k.post_offboard_logins = k.post_offboard_logins ?? k.post_offboard_logins_30d ?? k.post_offboard_logins_7d ?? 0;
    return raw;
  }

  async getStatistics(): Promise<Statistics> {
    return frappeCall<Statistics>("oauth_gap_monitor.api.get_statistics");
  }

  async listCases(filters?: Record<string, unknown>): Promise<OffboardingCase[]> {
    return frappeGetList<OffboardingCase>("Offboarding Case", {
      filters,
      fields: [
        "name", "employee", "employee_name", "primary_email",
        "event_type", "effective_date", "status",
        "scheduled_remediation_date", "notes", "creation", "modified",
      ],
      order_by: "modified desc",
      limit_page_length: 0,
    });
  }

  async getCaseDetail(caseName: string): Promise<CaseDetail> {
    const detail = await frappeCall<CaseDetail>("oauth_gap_monitor.api.get_case_detail", {
      body: { case_name: caseName },
    });

    const linked = [
      ...(detail.artifacts?.tokens ?? []),
      ...(detail.artifacts?.asps ?? []),
      ...(detail.artifacts?.login_events ?? []),
      ...(detail.artifacts?.other ?? []),
    ];

    if (linked.length === 0 && detail.case.primary_email) {
      const byEmail = await frappeGetList<AccessArtifact>("Access Artifact", {
        filters: { subject_email: detail.case.primary_email },
        fields: [
          "name", "case", "artifact_type", "subject_email", "status",
          "app_display_name", "client_id", "risk_level", "scopes_json",
          "metadata_json", "creation", "modified",
        ],
        limit_page_length: 0,
      });

      const tokens: AccessArtifact[] = [];
      const asps: AccessArtifact[] = [];
      const loginEvents: AccessArtifact[] = [];
      const other: AccessArtifact[] = [];
      for (const a of byEmail) {
        if (a.artifact_type === "OAuthToken") tokens.push(a);
        else if (a.artifact_type === "ASP") asps.push(a);
        else if (a.artifact_type === "LoginEvent") loginEvents.push(a);
        else other.push(a);
      }
      detail.artifacts = { tokens, asps, login_events: loginEvents, other, total: byEmail.length };
    }

    return detail;
  }

  async createCase(data: Partial<OffboardingCase>): Promise<OffboardingCase> {
    const doc = {
      doctype: "Offboarding Case",
      ...data,
    };
    const res = await frappeCall<OffboardingCase>("frappe.client.insert", { body: { doc } });
    return res;
  }

  async createCaseFromEmployee(employeeId: string): Promise<OffboardingCase> {
    return frappeCall<OffboardingCase>("oauth_gap_monitor.api.create_case_from_employee", {
      body: { employee: employeeId },
    });
  }

  async updateCase(caseName: string, data: Partial<OffboardingCase>): Promise<OffboardingCase> {
    return frappeCall<OffboardingCase>("frappe.client.set_value", {
      body: { doctype: "Offboarding Case", name: caseName, fieldname: data },
    });
  }

  async triggerScan(caseName: string): Promise<{ status: string; message: string }> {
    return frappeCall("oauth_gap_monitor.api.trigger_scan", {
      body: { case_name: caseName },
    });
  }

  async systemScan(): Promise<{ status: string; message: string }> {
    return frappeCall("oauth_gap_monitor.api.system_scan");
  }

  async getScanHistory(): Promise<ScanHistoryEntry[]> {
    return frappeCall<ScanHistoryEntry[]>("oauth_gap_monitor.api.get_scan_history");
  }

  async executeRemediation(
    caseName: string,
    action: string,
    kwargs?: Record<string, unknown>
  ): Promise<RemediationResult> {
    return frappeCall<RemediationResult>("oauth_gap_monitor.api.execute_remediation", {
      body: { case_name: caseName, action, ...kwargs },
    });
  }

  async bulkRemediate(caseName: string, artifactNames: string[]): Promise<RemediationResult> {
    return frappeCall<RemediationResult>("oauth_gap_monitor.api.bulk_remediate", {
      body: { case_name: caseName, artifact_names: JSON.stringify(artifactNames) },
    });
  }

  async remediateArtifacts(docnames: string[]): Promise<RemediationResult> {
    return frappeCall<RemediationResult>("oauth_gap_monitor.api.remediate_artifacts", {
      body: { docnames: JSON.stringify(docnames) },
    });
  }

  async runScheduledRemediationNow(caseName: string): Promise<RemediationResult> {
    return frappeCall<RemediationResult>("oauth_gap_monitor.api.run_scheduled_remediation_now", {
      body: { case_name: caseName },
    });
  }

  async listArtifacts(filters?: Record<string, unknown>): Promise<AccessArtifact[]> {
    return frappeGetList<AccessArtifact>("Access Artifact", {
      filters,
      fields: [
        "name", "case", "artifact_type", "subject_email", "status",
        "app_display_name", "client_id", "risk_level", "scopes_json",
        "metadata_json", "creation", "modified",
      ],
      order_by: "modified desc",
      limit_page_length: 0,
    });
  }

  async getArtifact(name: string): Promise<AccessArtifact> {
    return frappeGetDoc<AccessArtifact>("Access Artifact", name);
  }

  async listFindings(filters?: Record<string, unknown>): Promise<Finding[]> {
    return frappeGetList<Finding>("Finding", {
      filters,
      fields: [
        "name", "case", "finding_type", "severity", "summary",
        "recommended_action", "closed_at", "creation", "modified",
      ],
      order_by: "severity desc, creation desc",
      limit_page_length: 0,
    });
  }

  async getFinding(name: string): Promise<Finding> {
    return frappeGetDoc<Finding>("Finding", name);
  }

  async remediateFinding(name: string): Promise<RemediationResult> {
    return frappeCall<RemediationResult>("oauth_gap_monitor.api.remediate_finding", {
      body: { finding_name: name },
    });
  }

  async getEmployeeList(): Promise<Employee[]> {
    const [ogmEmployees, allFrappeEmployees, activeArtifacts, openFindings, allCases] = await Promise.all([
      frappeCall<Employee[]>("oauth_gap_monitor.api.get_employee_list"),
      frappeGetList<Record<string, string>>("Employee", {
        fields: ["name", "employee_name", "company_email", "status", "department", "designation", "date_of_joining", "relieving_date", "company"],
        order_by: "modified desc",
        limit_page_length: 0,
      }),
      frappeGetList<{ subject_email: string }>("Access Artifact", {
        filters: { status: "Active" },
        fields: ["subject_email"],
        limit_page_length: 0,
      }),
      frappeGetList<{ case: string }>("Finding", {
        filters: { closed_at: ["is", "not set"] },
        fields: ["case"],
        limit_page_length: 0,
      }),
      frappeGetList<{ name: string; primary_email: string; status: string }>("Offboarding Case", {
        fields: ["name", "primary_email", "status"],
        limit_page_length: 0,
      }),
    ]);

    const artifactCountByEmail = new Map<string, number>();
    for (const a of activeArtifacts) {
      artifactCountByEmail.set(a.subject_email, (artifactCountByEmail.get(a.subject_email) || 0) + 1);
    }

    const caseEmailMap = new Map<string, string>();
    const remediatedEmails = new Set<string>();
    for (const c of allCases) {
      caseEmailMap.set(c.name, c.primary_email);
      if (c.status === "Remediated" || c.status === "Closed") {
        remediatedEmails.add(c.primary_email);
      }
    }

    const openFindingsByEmail = new Map<string, number>();
    for (const f of openFindings) {
      const email = caseEmailMap.get(f.case);
      if (email) {
        openFindingsByEmail.set(email, (openFindingsByEmail.get(email) || 0) + 1);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const deriveStatus = (frappeStatus: string, relievingDate: string | undefined, email: string): Employee["emp_status"] => {
      if (frappeStatus === "Left" && relievingDate && relievingDate > today && !remediatedEmails.has(email)) {
        return "To Leave";
      }
      if (frappeStatus === "Left") return "Left";
      if (frappeStatus === "Suspended") return "Suspended";
      return "Active";
    };

    const ogmMap = new Map(ogmEmployees.map(e => [e.employee_id, e]));
    const merged: Employee[] = [];
    for (const fe of allFrappeEmployees) {
      const liveArtifacts = artifactCountByEmail.get(fe.company_email) || 0;
      const liveOpenFindings = openFindingsByEmail.get(fe.company_email) || 0;
      const existing = ogmMap.get(fe.name);
      if (existing) {
        existing.emp_status = deriveStatus(fe.status, fe.relieving_date, fe.company_email);
        existing.relieving_date = fe.relieving_date || undefined;
        existing.active_artifacts = liveArtifacts;
        existing.open_findings = liveOpenFindings;
        merged.push(existing);
        ogmMap.delete(fe.name);
      } else {
        merged.push({
          employee_id: fe.name,
          employee_name: fe.employee_name || "",
          company_email: fe.company_email || "",
          emp_status: deriveStatus(fe.status, fe.relieving_date, fe.company_email),
          date_of_joining: fe.date_of_joining || undefined,
          relieving_date: fe.relieving_date || undefined,
          department: fe.department || undefined,
          designation: fe.designation || undefined,
          company: fe.company || undefined,
          case_count: 0,
          active_artifacts: liveArtifacts,
          open_findings: liveOpenFindings,
        });
      }
    }
    for (const remaining of ogmMap.values()) merged.push(remaining);
    return merged.filter(e =>
      e.emp_status === "Active" ||
      e.emp_status === "To Leave" ||
      (e.case_count ?? 0) > 0 ||
      (e.active_artifacts ?? 0) > 0 ||
      (e.open_findings ?? 0) > 0
    );
  }

  async getEmployeeDetail(employeeId: string): Promise<EmployeeDetail> {
    const [detail, frappeEmp, empCases] = await Promise.all([
      frappeCall<EmployeeDetail>("oauth_gap_monitor.api.get_employee_detail", {
        body: { employee_id: employeeId },
      }),
      frappeGetList<Record<string, string>>("Employee", {
        filters: { name: employeeId },
        fields: ["status", "relieving_date", "company_email"],
        limit_page_length: 1,
      }),
      frappeGetList<{ status: string }>("Offboarding Case", {
        filters: { employee: employeeId },
        fields: ["status"],
        limit_page_length: 0,
      }),
    ]);

    if (frappeEmp.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const fe = frappeEmp[0];
      const isRemediated = empCases.some(c => c.status === "Remediated" || c.status === "Closed");
      if (fe.status === "Left" && fe.relieving_date && fe.relieving_date > today && !isRemediated) {
        detail.employee.status = "To Leave";
      } else if (fe.status === "Left") {
        detail.employee.status = "Left";
      }

      const allArtifactsForEmail = await frappeGetList<AccessArtifact>("Access Artifact", {
        filters: { subject_email: fe.company_email },
        fields: [
          "name", "case", "artifact_type", "subject_email", "status",
          "app_display_name", "client_id", "risk_level", "scopes_json",
          "metadata_json", "creation", "modified",
        ],
        order_by: "modified desc",
        limit_page_length: 0,
      });
      detail.summary.active_artifacts = allArtifactsForEmail.filter(a => a.status === "Active").length;
      detail.artifacts = allArtifactsForEmail;
    } else {
      detail.summary.active_artifacts = detail.artifacts.filter(a => a.status === "Active").length;
    }

    detail.summary.open_findings = detail.findings.filter(f => !f.closed_at).length;

    return detail;
  }

  async revokeEmployeeAccess(employeeId: string, scope: string): Promise<RemediationResult> {
    return frappeCall<RemediationResult>("oauth_gap_monitor.api.revoke_employee_access", {
      body: { employee_id: employeeId, scope },
    });
  }

  async getAllActiveOAuthApps(): Promise<OAuthAppSummary[]> {
    return frappeCall<OAuthAppSummary[]>("oauth_gap_monitor.api.get_all_active_oauth_apps");
  }

  async getAppDetail(clientId: string): Promise<AppDetail> {
    return frappeCall<AppDetail>("oauth_gap_monitor.api.get_app_detail", {
      body: { client_id: clientId },
    });
  }

  async globalAppRemoval(clientId: string, appName: string): Promise<RemediationResult> {
    return frappeCall<RemediationResult>("oauth_gap_monitor.api.global_app_removal", {
      body: { client_id: clientId, app_name: appName },
    });
  }

  async revokeAppForUsers(clientId: string, artifactNames: string[]): Promise<RemediationResult> {
    return frappeCall<RemediationResult>("oauth_gap_monitor.api.revoke_app_for_users", {
      body: { client_id: clientId, artifact_names: JSON.stringify(artifactNames) },
    });
  }

  async restoreAppForUsers(clientId: string, artifactNames: string[]): Promise<RemediationResult> {
    return frappeCall<RemediationResult>("oauth_gap_monitor.api.restore_app_for_users", {
      body: { client_id: clientId, artifact_names: JSON.stringify(artifactNames) },
    });
  }

  async updateUserScopes(
    artifactName: string,
    scopes: string[]
  ): Promise<{ removed: number; added: number }> {
    return frappeCall("oauth_gap_monitor.api.update_user_scopes", {
      body: { artifact_name: artifactName, scopes: JSON.stringify(scopes) },
    });
  }

  async listAuditLogs(filters?: Record<string, unknown>): Promise<UnifiedAuditLogEntry[]> {
    return frappeGetList<UnifiedAuditLogEntry>("Unified Audit Log Entry", {
      filters,
      fields: [
        "name", "actor_user", "action_type", "target_email", "result",
        "remediation_type", "request_json", "response_json", "timestamp", "creation",
      ],
      order_by: "creation desc",
      limit_page_length: 100,
    });
  }

  async getSettings(): Promise<OGMSettings> {
    return frappeGetDoc<OGMSettings>("OGM Settings", "OGM Settings");
  }

  async updateSettings(settings: Partial<OGMSettings>): Promise<OGMSettings> {
    return frappeCall<OGMSettings>("frappe.client.set_value", {
      body: {
        doctype: "OGM Settings",
        name: "OGM Settings",
        fieldname: settings,
      },
    });
  }

  async chat(message: string): Promise<{ reply: string; sources: { title: string; url: string }[] }> {
    return frappeCall("oauth_gap_monitor.chatbot.chat", {
      body: { message },
    });
  }
}
