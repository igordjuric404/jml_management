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
    return frappeCall<DashboardStats>("oauth_gap_monitor.api.get_dashboard_stats");
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
    return frappeCall<CaseDetail>("oauth_gap_monitor.api.get_case_detail", {
      body: { case_name: caseName },
    });
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
    return frappeCall<Employee[]>("oauth_gap_monitor.api.get_employee_list");
  }

  async getEmployeeDetail(employeeId: string): Promise<EmployeeDetail> {
    return frappeCall<EmployeeDetail>("oauth_gap_monitor.api.get_employee_detail", {
      body: { employee_id: employeeId },
    });
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
