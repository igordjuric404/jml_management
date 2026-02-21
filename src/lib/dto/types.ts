export interface OffboardingCase {
  name: string;
  employee: string;
  employee_name: string;
  primary_email: string;
  event_type: "Offboard" | "Security Review" | "Manual Check";
  effective_date: string;
  status: "Draft" | "Scheduled" | "All Clear" | "Gaps Found" | "Remediated" | "Closed";
  scheduled_remediation_date?: string;
  notify_user_1w: boolean;
  notify_user_1d: boolean;
  notes?: string;
  creation?: string;
  modified?: string;
}

export interface AccessArtifact {
  name: string;
  case: string;
  artifact_type: "OAuthToken" | "ASP" | "LoginEvent" | "AdminMFA" | "DWDChange";
  subject_email: string;
  status: "Active" | "Hidden" | "Revoked" | "Deleted" | "Acknowledged";
  app_display_name?: string;
  client_id?: string;
  risk_level?: "Low" | "Medium" | "High" | "Critical";
  scopes_json?: string;
  metadata_json?: string;
  creation?: string;
  modified?: string;
}

export interface Finding {
  name: string;
  case: string;
  finding_type:
    | "LingeringOAuthGrant"
    | "LingeringASP"
    | "PostOffboardLogin"
    | "PostOffboardSuspiciousLogin"
    | "AdminMFAWeak"
    | "DWDHighRisk"
    | "OffboardingNotEnforced";
  severity: "Low" | "Medium" | "High" | "Critical";
  summary: string;
  recommended_action?: string;
  closed_at?: string;
  evidence?: FindingEvidence[];
  creation?: string;
  modified?: string;
}

export interface FindingEvidence {
  name: string;
  evidence_type: string;
  detail: string;
}

export interface UnifiedAuditLogEntry {
  name: string;
  actor_user: string;
  action_type: string;
  target_email: string;
  result: string;
  remediation_type?: string;
  request_json?: string;
  response_json?: string;
  timestamp: string;
  creation?: string;
}

export interface Employee {
  employee_id: string;
  employee_name: string;
  company_email: string;
  emp_status: "Active" | "To Leave" | "Left" | "Suspended";
  date_of_joining?: string;
  relieving_date?: string;
  department?: string;
  designation?: string;
  company?: string;
  case_count?: number;
  active_artifacts?: number;
  open_findings?: number;
}

export interface OGMSettings {
  auto_scan_on_offboard: boolean;
  auto_remediate_on_offboard: boolean;
  background_scan_enabled: boolean;
  auto_create_case_on_leave: boolean;
  background_scan_interval: string;
  remediation_check_interval: string;
  notify_on_new_findings: boolean;
  notify_on_remediation: boolean;
  notification_email?: string;
  default_remediation_action: string;
}

export interface DashboardStats {
  kpis: {
    pending_scan: number;
    critical_gaps: number;
    oauth_grants: number;
    post_offboard_logins: number;
    total_cases: number;
    total_findings: number;
    total_artifacts: number;
    oauth_grants_7d?: number;
    oauth_grants_30d?: number;
    post_offboard_logins_7d?: number;
    post_offboard_logins_30d?: number;
  };
  top_oauth_apps: OAuthAppSummary[];
  risky_cases: RiskyCaseSummary[];
}

export interface OAuthAppSummary {
  client_id: string;
  app_display_name: string;
  grant_count: number;
  user_count?: number;
  case_count?: number;
}

export interface RiskyCaseSummary {
  case_name: string;
  primary_email: string;
  employee_name?: string;
  status: string;
  effective_date?: string;
  finding_count: number;
  critical_count: number;
}

export interface CaseDetail {
  case: OffboardingCase;
  artifacts: {
    tokens: AccessArtifact[];
    asps: AccessArtifact[];
    login_events: AccessArtifact[];
    other: AccessArtifact[];
    total: number;
  };
  findings: Finding[];
  audit_logs: UnifiedAuditLogEntry[];
}

export interface AppDetail {
  client_id: string;
  app_name: string;
  total_grants: number;
  active_grants: number;
  revoked_grants: number;
  cases_affected: string[];
  scopes: string[];
  users: AppUser[];
}

export interface AppUser {
  email: string;
  status: string;
  risk_level?: string;
  case: string;
  artifact_name: string;
  granted: string;
  scopes: ScopeInfo[];
  raw_scopes: string[];
}

export interface ScopeInfo {
  scope: string;
  full: string;
  level: "read" | "write";
}

export interface EmployeeDetail {
  employee: {
    id: string;
    name: string;
    email: string;
    status: string;
    date_of_joining?: string;
    relieving_date?: string;
    department?: string;
    designation?: string;
    company?: string;
  };
  cases: OffboardingCase[];
  artifacts: AccessArtifact[];
  findings: Finding[];
  apps: EmployeeApp[];
  summary: {
    total_cases: number;
    active_artifacts: number;
    open_findings: number;
    apps_used: number;
  };
}

export interface EmployeeApp {
  app_name: string;
  client_id: string;
  status: string;
  risk_level?: string;
  artifact_name: string;
}

export interface ScanHistoryEntry {
  scan_id: string;
  case: string;
  target_email: string;
  trigger: "manual" | "automatic";
  actor: string;
  started_at: string;
  result: string;
  new_status?: string;
  active_artifacts: number;
  open_findings?: number;
  findings_link?: string;
}

export interface Statistics {
  mean_time_to_enforce_hours: number | null;
  top_apps_by_exposure: OAuthAppSummary[];
  scope_heatmap: { scope: string; count: number }[];
  residual_access_trend: { week: string; finding_count: number }[];
}

export interface RemediationResult {
  status: string;
  action?: string;
  artifacts_remediated?: number;
  findings_closed?: number;
  revoked?: number;
  deleted?: number;
  case_status?: {
    active_artifacts: number;
    open_findings: number;
    new_status: string;
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

export interface ChatSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: "success" | "error";
}
