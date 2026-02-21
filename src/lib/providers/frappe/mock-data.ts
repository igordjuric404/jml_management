/**
 * Mock data mirroring the Frappe repopulate_test_data.sh output.
 * Used as fallback when Frappe is unreachable (e.g. Cloudflare production).
 */

import type {
  OffboardingCase,
  AccessArtifact,
  Finding,
  UnifiedAuditLogEntry,
  Employee,
  OGMSettings,
} from "@/lib/dto/types";

const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

// ── Employees ──────────────────────────────────────────────
export const mockEmployees: Employee[] = [
  // Active employees (from repopulate_test_data.sh)
  { employee_id: "HR-EMP-TEST-00025", employee_name: "Alex Rivera", company_email: "alex.rivera@testcorp.com", emp_status: "Active", date_of_joining: "2023-06-01", department: "Engineering", designation: "Senior Backend Developer", company: "HUB201", case_count: 0, active_artifacts: 4, open_findings: 0 },
  { employee_id: "HR-EMP-TEST-00026", employee_name: "Maya Patel", company_email: "maya.patel@testcorp.com", emp_status: "To Leave", date_of_joining: "2023-06-01", relieving_date: "2026-03-15", department: "Product", designation: "Product Manager", company: "HUB201", case_count: 1, active_artifacts: 3, open_findings: 0 },
  { employee_id: "HR-EMP-TEST-00027", employee_name: "James O'Brien", company_email: "james.obrien@testcorp.com", emp_status: "Active", date_of_joining: "2023-06-01", department: "Security", designation: "Security Analyst", company: "HUB201", case_count: 0, active_artifacts: 3, open_findings: 0 },
  { employee_id: "HR-EMP-TEST-00028", employee_name: "Yuki Tanaka", company_email: "yuki.tanaka@testcorp.com", emp_status: "Active", date_of_joining: "2023-06-01", department: "Data", designation: "Data Engineer", company: "HUB201", case_count: 0, active_artifacts: 2, open_findings: 0 },
  { employee_id: "HR-EMP-TEST-00029", employee_name: "Sofia Martinez", company_email: "sofia.martinez@testcorp.com", emp_status: "Active", date_of_joining: "2023-06-01", department: "DevOps", designation: "DevOps Lead", company: "HUB201", case_count: 0, active_artifacts: 3, open_findings: 0 },
  // Active employees (from Frappe base setup)
  { employee_id: "HR-EMP-00011", employee_name: "Henry Check", company_email: "henry.check@example.com", emp_status: "Active", date_of_joining: "2022-01-15", department: "Engineering", company: "HUB201", case_count: 1, active_artifacts: 0, open_findings: 0 },
  { employee_id: "HR-EMP-00013", employee_name: "John Active", company_email: "john.active@example.com", emp_status: "Active", date_of_joining: "2021-03-10", department: "Engineering", company: "HUB201", case_count: 0, active_artifacts: 2, open_findings: 0 },
  { employee_id: "HR-EMP-00014", employee_name: "Sarah Active", company_email: "sarah.active@example.com", emp_status: "Active", date_of_joining: "2021-06-20", department: "Marketing", company: "HUB201", case_count: 0, active_artifacts: 3, open_findings: 0 },
  { employee_id: "HR-EMP-00015", employee_name: "Mike Active", company_email: "mike.active@example.com", emp_status: "Active", date_of_joining: "2022-02-01", department: "Sales", company: "HUB201", case_count: 0, active_artifacts: 2, open_findings: 0 },
  { employee_id: "HR-EMP-00016", employee_name: "Lisa Active", company_email: "lisa.active@example.com", emp_status: "Active", date_of_joining: "2021-09-15", department: "Finance", company: "HUB201", case_count: 0, active_artifacts: 2, open_findings: 0 },
  { employee_id: "HR-EMP-00018", employee_name: "Emma Active", company_email: "emma.active@example.com", emp_status: "Active", date_of_joining: "2022-04-01", department: "HR", company: "HUB201", case_count: 0, active_artifacts: 4, open_findings: 0 },
  // Left employees with cases/artifacts/findings (from repopulate_test_data.sh)
  { employee_id: "HR-EMP-TEST-00030", employee_name: "Carlos Mendez", company_email: "carlos.mendez@testcorp.com", emp_status: "Left", date_of_joining: "2021-03-01", relieving_date: "2026-02-13", department: "Engineering", designation: "Staff Engineer", company: "HUB201", case_count: 1, active_artifacts: 5, open_findings: 4 },
  { employee_id: "HR-EMP-TEST-00031", employee_name: "Nina Kowalski", company_email: "nina.kowalski@testcorp.com", emp_status: "Left", date_of_joining: "2021-03-01", relieving_date: "2026-02-13", department: "Finance", designation: "Finance Manager", company: "HUB201", case_count: 1, active_artifacts: 3, open_findings: 2 },
  { employee_id: "HR-EMP-TEST-00032", employee_name: "Raj Sharma", company_email: "raj.sharma@testcorp.com", emp_status: "Left", date_of_joining: "2021-03-01", relieving_date: "2026-02-13", department: "IT", designation: "IT Admin", company: "HUB201", case_count: 1, active_artifacts: 3, open_findings: 2 },
];

// ── Cases ──────────────────────────────────────────────────
export const mockCases: OffboardingCase[] = [
  { name: "OBC-MOCK-00000", employee: "HR-EMP-TEST-00026", employee_name: "Maya Patel", primary_email: "maya.patel@testcorp.com", event_type: "Offboard", effective_date: "2026-03-15T00:00:00", status: "Scheduled", scheduled_remediation_date: "2026-03-15T00:00:00", notes: "Scheduled offboarding — tokens active until leaving date", notify_user_1w: false, notify_user_1d: false, creation: weekAgo },
  { name: "OBC-MOCK-00001", employee: "HR-EMP-TEST-00030", employee_name: "Carlos Mendez", primary_email: "carlos.mendez@testcorp.com", event_type: "Offboard", effective_date: "2026-02-13T00:00:00", status: "Gaps Found", notes: "Post-offboard login detected", notify_user_1w: false, notify_user_1d: false, creation: weekAgo },
  { name: "OBC-MOCK-00002", employee: "HR-EMP-TEST-00031", employee_name: "Nina Kowalski", primary_email: "nina.kowalski@testcorp.com", event_type: "Offboard", effective_date: "2026-02-13T00:00:00", status: "Gaps Found", notes: "Post-offboard login detected", notify_user_1w: false, notify_user_1d: false, creation: weekAgo },
  { name: "OBC-MOCK-00003", employee: "HR-EMP-TEST-00032", employee_name: "Raj Sharma", primary_email: "raj.sharma@testcorp.com", event_type: "Offboard", effective_date: "2026-02-13T00:00:00", status: "Gaps Found", notes: "Lingering OAuth and ASP access", notify_user_1w: false, notify_user_1d: false, creation: weekAgo },
];

// ── Access Artifacts ───────────────────────────────────────
export const mockArtifacts: AccessArtifact[] = [
  // Active employees — unlinked artifacts
  { name: "ART-M-001", case: "", artifact_type: "OAuthToken", subject_email: "alex.rivera@testcorp.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive", risk_level: "High", scopes_json: '["https://www.googleapis.com/auth/drive"]', creation: weekAgo },
  { name: "ART-M-002", case: "", artifact_type: "OAuthToken", subject_email: "alex.rivera@testcorp.com", status: "Active", app_display_name: "GitHub", client_id: "client-github", risk_level: "Critical", scopes_json: '["https://www.googleapis.com/auth/admin.directory.user"]', creation: weekAgo },
  { name: "ART-M-003", case: "", artifact_type: "OAuthToken", subject_email: "alex.rivera@testcorp.com", status: "Active", app_display_name: "Slack", client_id: "client-slack", risk_level: "Medium", scopes_json: '["https://www.googleapis.com/auth/gmail.readonly"]', creation: weekAgo },
  { name: "ART-M-004", case: "", artifact_type: "ASP", subject_email: "alex.rivera@testcorp.com", status: "Active", app_display_name: "Thunderbird Mail", risk_level: "Medium", creation: weekAgo },
  { name: "ART-M-005", case: "", artifact_type: "OAuthToken", subject_email: "maya.patel@testcorp.com", status: "Active", app_display_name: "Notion", client_id: "client-notion", risk_level: "Low", creation: weekAgo },
  { name: "ART-M-006", case: "", artifact_type: "OAuthToken", subject_email: "maya.patel@testcorp.com", status: "Active", app_display_name: "Figma", client_id: "client-figma", risk_level: "Medium", creation: weekAgo },
  { name: "ART-M-007", case: "", artifact_type: "OAuthToken", subject_email: "maya.patel@testcorp.com", status: "Active", app_display_name: "Zoom", client_id: "client-zoom", risk_level: "Low", creation: weekAgo },
  { name: "ART-M-008", case: "", artifact_type: "OAuthToken", subject_email: "james.obrien@testcorp.com", status: "Active", app_display_name: "Salesforce", client_id: "client-salesforce", risk_level: "High", creation: weekAgo },
  { name: "ART-M-009", case: "", artifact_type: "OAuthToken", subject_email: "james.obrien@testcorp.com", status: "Active", app_display_name: "Jira", client_id: "client-jira", risk_level: "Medium", creation: weekAgo },
  { name: "ART-M-010", case: "", artifact_type: "ASP", subject_email: "james.obrien@testcorp.com", status: "Active", app_display_name: "Outlook Desktop", risk_level: "Medium", creation: weekAgo },
  { name: "ART-M-011", case: "", artifact_type: "OAuthToken", subject_email: "yuki.tanaka@testcorp.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive", risk_level: "High", creation: weekAgo },
  { name: "ART-M-012", case: "", artifact_type: "OAuthToken", subject_email: "yuki.tanaka@testcorp.com", status: "Active", app_display_name: "ChatGPT", client_id: "client-chatgpt", risk_level: "Medium", creation: weekAgo },
  { name: "ART-M-013", case: "", artifact_type: "OAuthToken", subject_email: "sofia.martinez@testcorp.com", status: "Active", app_display_name: "GitHub", client_id: "client-github", risk_level: "Critical", creation: weekAgo },
  { name: "ART-M-014", case: "", artifact_type: "OAuthToken", subject_email: "sofia.martinez@testcorp.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive", risk_level: "High", creation: weekAgo },
  { name: "ART-M-015", case: "", artifact_type: "ASP", subject_email: "sofia.martinez@testcorp.com", status: "Active", app_display_name: "K-9 Mail", risk_level: "Low", creation: weekAgo },
  // Carlos Mendez — Left, with case
  { name: "ART-M-016", case: "OBC-MOCK-00001", artifact_type: "OAuthToken", subject_email: "carlos.mendez@testcorp.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive", risk_level: "High", creation: weekAgo },
  { name: "ART-M-017", case: "OBC-MOCK-00001", artifact_type: "OAuthToken", subject_email: "carlos.mendez@testcorp.com", status: "Active", app_display_name: "GitHub", client_id: "client-github", risk_level: "Critical", creation: weekAgo },
  { name: "ART-M-018", case: "OBC-MOCK-00001", artifact_type: "OAuthToken", subject_email: "carlos.mendez@testcorp.com", status: "Active", app_display_name: "Slack", client_id: "client-slack", risk_level: "Medium", creation: weekAgo },
  { name: "ART-M-019", case: "OBC-MOCK-00001", artifact_type: "ASP", subject_email: "carlos.mendez@testcorp.com", status: "Active", app_display_name: "Thunderbird Mail", risk_level: "Medium", creation: weekAgo },
  { name: "ART-M-020", case: "OBC-MOCK-00001", artifact_type: "LoginEvent", subject_email: "carlos.mendez@testcorp.com", status: "Active", app_display_name: "Google Login", risk_level: "High", metadata_json: '{"ip":"203.0.113.77","login_time":"2026-02-18T14:30:00","user_agent":"Chrome/122"}', creation: weekAgo },
  // Nina Kowalski — Left, with case
  { name: "ART-M-021", case: "OBC-MOCK-00002", artifact_type: "OAuthToken", subject_email: "nina.kowalski@testcorp.com", status: "Active", app_display_name: "Salesforce", client_id: "client-salesforce", risk_level: "High", creation: weekAgo },
  { name: "ART-M-022", case: "OBC-MOCK-00002", artifact_type: "OAuthToken", subject_email: "nina.kowalski@testcorp.com", status: "Active", app_display_name: "Notion", client_id: "client-notion", risk_level: "Low", creation: weekAgo },
  { name: "ART-M-023", case: "OBC-MOCK-00002", artifact_type: "LoginEvent", subject_email: "nina.kowalski@testcorp.com", status: "Active", app_display_name: "Google Login", risk_level: "High", metadata_json: '{"ip":"198.51.100.42","login_time":"2026-02-19T09:15:00","user_agent":"Firefox/121"}', creation: weekAgo },
  // Raj Sharma — Left, with case
  { name: "ART-M-024", case: "OBC-MOCK-00003", artifact_type: "OAuthToken", subject_email: "raj.sharma@testcorp.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive", risk_level: "High", creation: weekAgo },
  { name: "ART-M-025", case: "OBC-MOCK-00003", artifact_type: "OAuthToken", subject_email: "raj.sharma@testcorp.com", status: "Active", app_display_name: "Jira", client_id: "client-jira", risk_level: "Medium", creation: weekAgo },
  { name: "ART-M-026", case: "OBC-MOCK-00003", artifact_type: "ASP", subject_email: "raj.sharma@testcorp.com", status: "Active", app_display_name: "Outlook Desktop", risk_level: "Medium", creation: weekAgo },
  // Base active employees
  { name: "ART-M-027", case: "", artifact_type: "OAuthToken", subject_email: "john.active@example.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive", risk_level: "Low", creation: monthAgo },
  { name: "ART-M-028", case: "", artifact_type: "OAuthToken", subject_email: "john.active@example.com", status: "Active", app_display_name: "Slack", client_id: "client-slack", risk_level: "Low", creation: monthAgo },
  { name: "ART-M-029", case: "", artifact_type: "OAuthToken", subject_email: "sarah.active@example.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive", risk_level: "Low", creation: monthAgo },
  { name: "ART-M-030", case: "", artifact_type: "OAuthToken", subject_email: "sarah.active@example.com", status: "Active", app_display_name: "Figma", client_id: "client-figma", risk_level: "Low", creation: monthAgo },
  { name: "ART-M-031", case: "", artifact_type: "OAuthToken", subject_email: "sarah.active@example.com", status: "Active", app_display_name: "Zoom", client_id: "client-zoom", risk_level: "Low", creation: monthAgo },
  { name: "ART-M-032", case: "", artifact_type: "OAuthToken", subject_email: "mike.active@example.com", status: "Active", app_display_name: "Salesforce", client_id: "client-salesforce", risk_level: "Medium", creation: monthAgo },
  { name: "ART-M-033", case: "", artifact_type: "OAuthToken", subject_email: "mike.active@example.com", status: "Active", app_display_name: "Jira", client_id: "client-jira", risk_level: "Low", creation: monthAgo },
  { name: "ART-M-034", case: "", artifact_type: "OAuthToken", subject_email: "lisa.active@example.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive", risk_level: "Low", creation: monthAgo },
  { name: "ART-M-035", case: "", artifact_type: "OAuthToken", subject_email: "lisa.active@example.com", status: "Active", app_display_name: "Notion", client_id: "client-notion", risk_level: "Low", creation: monthAgo },
  { name: "ART-M-036", case: "", artifact_type: "OAuthToken", subject_email: "emma.active@example.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive", risk_level: "Low", creation: monthAgo },
  { name: "ART-M-037", case: "", artifact_type: "OAuthToken", subject_email: "emma.active@example.com", status: "Active", app_display_name: "GitHub", client_id: "client-github", risk_level: "Medium", creation: monthAgo },
  { name: "ART-M-038", case: "", artifact_type: "OAuthToken", subject_email: "emma.active@example.com", status: "Active", app_display_name: "Figma", client_id: "client-figma", risk_level: "Low", creation: monthAgo },
  { name: "ART-M-039", case: "", artifact_type: "OAuthToken", subject_email: "emma.active@example.com", status: "Active", app_display_name: "Slack", client_id: "client-slack", risk_level: "Low", creation: monthAgo },
];

// ── Findings ───────────────────────────────────────────────
export const mockFindings: Finding[] = [
  // Carlos Mendez
  { name: "FND-M-001", case: "OBC-MOCK-00001", finding_type: "LingeringOAuthGrant", severity: "Critical", summary: "OAuth grant for GitHub with admin scope persists after offboarding.", recommended_action: "Revoke the GitHub OAuth token.", creation: weekAgo },
  { name: "FND-M-002", case: "OBC-MOCK-00001", finding_type: "LingeringOAuthGrant", severity: "High", summary: "OAuth grant for Google Drive with full drive access.", recommended_action: "Revoke the Google Drive token.", creation: weekAgo },
  { name: "FND-M-003", case: "OBC-MOCK-00001", finding_type: "LingeringASP", severity: "Medium", summary: "App-Specific Password for Thunderbird still active.", recommended_action: "Delete the ASP.", creation: weekAgo },
  { name: "FND-M-004", case: "OBC-MOCK-00001", finding_type: "PostOffboardLogin", severity: "High", summary: "Post-offboard login detected from IP 203.0.113.77 via Chrome.", recommended_action: "Sign out all sessions and investigate.", creation: weekAgo },
  // Nina Kowalski
  { name: "FND-M-005", case: "OBC-MOCK-00002", finding_type: "LingeringOAuthGrant", severity: "High", summary: "OAuth grant for Salesforce with contacts access persists.", recommended_action: "Revoke Salesforce token.", creation: weekAgo },
  { name: "FND-M-006", case: "OBC-MOCK-00002", finding_type: "PostOffboardLogin", severity: "High", summary: "Post-offboard login detected from IP 198.51.100.42 via Firefox.", recommended_action: "Sign out all sessions.", creation: weekAgo },
  // Raj Sharma
  { name: "FND-M-007", case: "OBC-MOCK-00003", finding_type: "LingeringOAuthGrant", severity: "High", summary: "OAuth grant for Google Drive with full drive access from former IT admin.", recommended_action: "Revoke the Google Drive token.", creation: weekAgo },
  { name: "FND-M-008", case: "OBC-MOCK-00003", finding_type: "LingeringASP", severity: "Medium", summary: "ASP for Outlook Desktop still active after offboarding.", recommended_action: "Delete ASP.", creation: weekAgo },
];

// ── Audit Logs ─────────────────────────────────────────────
export const mockAuditLogs: UnifiedAuditLogEntry[] = [
  { name: "AUD-M-001", actor_user: "Administrator", action_type: "CaseCreated", target_email: "carlos.mendez@testcorp.com", result: "Success", request_json: '{"case":"OBC-MOCK-00001"}', timestamp: weekAgo, creation: weekAgo },
  { name: "AUD-M-002", actor_user: "Administrator", action_type: "CaseCreated", target_email: "nina.kowalski@testcorp.com", result: "Success", request_json: '{"case":"OBC-MOCK-00002"}', timestamp: weekAgo, creation: weekAgo },
  { name: "AUD-M-003", actor_user: "Administrator", action_type: "CaseCreated", target_email: "raj.sharma@testcorp.com", result: "Success", request_json: '{"case":"OBC-MOCK-00003"}', timestamp: weekAgo, creation: weekAgo },
  { name: "AUD-M-004", actor_user: "Administrator", action_type: "ScanFinished", target_email: "carlos.mendez@testcorp.com", result: "Success", request_json: '{"case":"OBC-MOCK-00001","active_artifacts":5}', timestamp: weekAgo, creation: weekAgo },
];

// ── Settings ───────────────────────────────────────────────
export const mockSettings: OGMSettings = {
  auto_scan_on_offboard: true,
  auto_remediate_on_offboard: true,
  background_scan_enabled: true,
  auto_create_case_on_leave: true,
  background_scan_interval: "Every 15 Minutes",
  remediation_check_interval: "Every 5 Minutes",
  notify_on_new_findings: true,
  notify_on_remediation: true,
  notification_email: "igordjuric404@gmail.com",
  default_remediation_action: "full_bundle",
};
