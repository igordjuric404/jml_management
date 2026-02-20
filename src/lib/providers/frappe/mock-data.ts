/**
 * Mock data matching the Frappe repopulate.py scenarios A–J.
 * Used when Frappe is unavailable (dev mode / Cloudflare Pages static build).
 */

import type {
  OffboardingCase,
  AccessArtifact,
  Finding,
  UnifiedAuditLogEntry,
  Employee,
  OGMSettings,
} from "@/lib/dto/types";

const now = new Date().toISOString();
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
const twoWeeksFromNow = new Date(Date.now() + 14 * 86400000).toISOString();

// ── Employees ──────────────────────────────────────────────
export const mockEmployees: Employee[] = [
  { employee_id: "HR-EMP-00001", employee_name: "Alice Johnson", company_email: "alice.johnson@testcorp.com", emp_status: "Left", date_of_joining: "2020-03-15", relieving_date: "2025-12-01", department: "Engineering", designation: "Senior Developer", company: "Test Corp", case_count: 1, active_artifacts: 3, open_findings: 2 },
  { employee_id: "HR-EMP-00002", employee_name: "Bob Smith", company_email: "bob.smith@testcorp.com", emp_status: "Left", date_of_joining: "2019-06-01", relieving_date: "2025-11-15", department: "Marketing", designation: "Marketing Manager", company: "Test Corp", case_count: 1, active_artifacts: 2, open_findings: 1 },
  { employee_id: "HR-EMP-00003", employee_name: "Charlie Brown", company_email: "charlie.brown@testcorp.com", emp_status: "Left", date_of_joining: "2021-01-10", relieving_date: "2025-10-20", department: "Sales", designation: "Sales Rep", company: "Test Corp", case_count: 1, active_artifacts: 1, open_findings: 1 },
  { employee_id: "HR-EMP-00004", employee_name: "Diana Prince", company_email: "diana.prince@testcorp.com", emp_status: "Left", date_of_joining: "2018-09-01", relieving_date: "2025-09-30", department: "IT", designation: "IT Admin", company: "Test Corp", case_count: 1, active_artifacts: 2, open_findings: 2 },
  { employee_id: "HR-EMP-00005", employee_name: "Eve Wilson", company_email: "eve.wilson@testcorp.com", emp_status: "Left", date_of_joining: "2020-07-15", relieving_date: "2025-08-15", department: "HR", designation: "HR Specialist", company: "Test Corp", case_count: 1, active_artifacts: 0, open_findings: 0 },
  { employee_id: "HR-EMP-00006", employee_name: "Frank Castle", company_email: "frank.castle@testcorp.com", emp_status: "Left", date_of_joining: "2017-04-20", relieving_date: "2025-07-01", department: "Engineering", designation: "DevOps Engineer", company: "Test Corp", case_count: 1, active_artifacts: 0, open_findings: 0 },
  { employee_id: "HR-EMP-00007", employee_name: "Grace Lee", company_email: "grace.lee@testcorp.com", emp_status: "Left", date_of_joining: "2021-11-01", relieving_date: "2025-12-15", department: "Finance", designation: "Accountant", company: "Test Corp", case_count: 1, active_artifacts: 4, open_findings: 3 },
  { employee_id: "HR-EMP-00008", employee_name: "Henry Ford", company_email: "henry.ford@testcorp.com", emp_status: "Left", date_of_joining: "2019-02-14", relieving_date: "2025-06-30", department: "Legal", designation: "Legal Counsel", company: "Test Corp", case_count: 1, active_artifacts: 1, open_findings: 1 },
  { employee_id: "HR-EMP-00009", employee_name: "Ivy Chen", company_email: "ivy.chen@testcorp.com", emp_status: "Left", date_of_joining: "2022-05-01", relieving_date: "2025-11-30", department: "Engineering", designation: "Backend Developer", company: "Test Corp", case_count: 1, active_artifacts: 6, open_findings: 4 },
  { employee_id: "HR-EMP-00010", employee_name: "Jack Daniels", company_email: "jack.daniels@testcorp.com", emp_status: "Left", date_of_joining: "2020-08-01", relieving_date: "2025-10-15", department: "Support", designation: "Support Lead", company: "Test Corp", case_count: 1, active_artifacts: 1, open_findings: 1 },
  { employee_id: "HR-EMP-00011", employee_name: "Karen White", company_email: "karen.white@testcorp.com", emp_status: "Active", date_of_joining: "2021-03-10", department: "Engineering", designation: "Frontend Developer", company: "Test Corp", case_count: 0, active_artifacts: 0, open_findings: 0 },
  { employee_id: "HR-EMP-00012", employee_name: "Liam Neeson", company_email: "liam.neeson@testcorp.com", emp_status: "Active", date_of_joining: "2019-11-20", department: "Marketing", designation: "Content Writer", company: "Test Corp", case_count: 0, active_artifacts: 0, open_findings: 0 },
  { employee_id: "HR-EMP-00013", employee_name: "Monica Geller", company_email: "monica.geller@testcorp.com", emp_status: "Active", date_of_joining: "2020-01-05", department: "Operations", designation: "Operations Manager", company: "Test Corp", case_count: 0, active_artifacts: 0, open_findings: 0 },
  { employee_id: "HR-EMP-00014", employee_name: "Nathan Drake", company_email: "nathan.drake@testcorp.com", emp_status: "Active", date_of_joining: "2022-06-15", department: "Engineering", designation: "QA Engineer", company: "Test Corp", case_count: 0, active_artifacts: 0, open_findings: 0 },
  { employee_id: "HR-EMP-00015", employee_name: "Olivia Pope", company_email: "olivia.pope@testcorp.com", emp_status: "Active", date_of_joining: "2018-12-01", department: "Executive", designation: "VP Operations", company: "Test Corp", case_count: 0, active_artifacts: 0, open_findings: 0 },
  { employee_id: "HR-EMP-00016", employee_name: "Peter Parker", company_email: "peter.parker@testcorp.com", emp_status: "Active", date_of_joining: "2023-01-20", department: "Engineering", designation: "Intern", company: "Test Corp", case_count: 0, active_artifacts: 0, open_findings: 0 },
  { employee_id: "HR-EMP-00017", employee_name: "Quinn Hughes", company_email: "quinn.hughes@testcorp.com", emp_status: "Active", date_of_joining: "2021-08-30", department: "Design", designation: "UI Designer", company: "Test Corp", case_count: 0, active_artifacts: 0, open_findings: 0 },
  { employee_id: "HR-EMP-00018", employee_name: "Rachel Green", company_email: "rachel.green@testcorp.com", emp_status: "Active", date_of_joining: "2020-04-15", department: "Sales", designation: "Account Executive", company: "Test Corp", case_count: 0, active_artifacts: 0, open_findings: 0 },
];

// ── Cases (Scenarios A-J) ──────────────────────────────────
export const mockCases: OffboardingCase[] = [
  { name: "OBC-2025-00001", employee: "HR-EMP-00001", employee_name: "Alice Johnson", primary_email: "alice.johnson@testcorp.com", event_type: "Offboard", effective_date: "2025-12-01T00:00:00", status: "Gaps Found", notes: "Scenario A: Multiple OAuth tokens lingering", notify_user_1w: false, notify_user_1d: false, creation: monthAgo },
  { name: "OBC-2025-00002", employee: "HR-EMP-00002", employee_name: "Bob Smith", primary_email: "bob.smith@testcorp.com", event_type: "Offboard", effective_date: "2025-11-15T00:00:00", status: "Gaps Found", notes: "Scenario B: ASPs still active", notify_user_1w: false, notify_user_1d: false, creation: monthAgo },
  { name: "OBC-2025-00003", employee: "HR-EMP-00003", employee_name: "Charlie Brown", primary_email: "charlie.brown@testcorp.com", event_type: "Offboard", effective_date: "2025-10-20T00:00:00", status: "Gaps Found", notes: "Scenario C: Post-offboard login detected", notify_user_1w: false, notify_user_1d: false, creation: monthAgo },
  { name: "OBC-2025-00004", employee: "HR-EMP-00004", employee_name: "Diana Prince", primary_email: "diana.prince@testcorp.com", event_type: "Security Review", effective_date: "2025-09-30T00:00:00", status: "Gaps Found", notes: "Scenario D: Admin MFA weak + DWD risk", notify_user_1w: false, notify_user_1d: false, creation: monthAgo },
  { name: "OBC-2025-00005", employee: "HR-EMP-00005", employee_name: "Eve Wilson", primary_email: "eve.wilson@testcorp.com", event_type: "Offboard", effective_date: "2025-08-15T00:00:00", status: "Scheduled", scheduled_remediation_date: twoWeeksFromNow, notes: "Scenario E: Scheduled remediation", notify_user_1w: true, notify_user_1d: false, creation: monthAgo },
  { name: "OBC-2025-00006", employee: "HR-EMP-00006", employee_name: "Frank Castle", primary_email: "frank.castle@testcorp.com", event_type: "Offboard", effective_date: "2025-07-01T00:00:00", status: "Remediated", notes: "Scenario F: Already remediated", notify_user_1w: false, notify_user_1d: false, creation: monthAgo },
  { name: "OBC-2025-00007", employee: "HR-EMP-00007", employee_name: "Grace Lee", primary_email: "grace.lee@testcorp.com", event_type: "Offboard", effective_date: "2025-12-15T00:00:00", status: "Gaps Found", notes: "Scenario G: All clear after scan", notify_user_1w: false, notify_user_1d: false, creation: weekAgo },
  { name: "OBC-2025-00008", employee: "HR-EMP-00008", employee_name: "Henry Ford", primary_email: "henry.ford@testcorp.com", event_type: "Manual Check", effective_date: "2025-06-30T00:00:00", status: "Gaps Found", notes: "Scenario H: Mixed artifacts", notify_user_1w: false, notify_user_1d: false, creation: weekAgo },
  { name: "OBC-2025-00009", employee: "HR-EMP-00009", employee_name: "Ivy Chen", primary_email: "ivy.chen@testcorp.com", event_type: "Offboard", effective_date: "2025-11-30T00:00:00", status: "Gaps Found", notes: "Scenario I: Manual check needed", notify_user_1w: false, notify_user_1d: false, creation: weekAgo },
  { name: "OBC-2025-00010", employee: "HR-EMP-00010", employee_name: "Jack Daniels", primary_email: "jack.daniels@testcorp.com", event_type: "Offboard", effective_date: "2025-10-15T00:00:00", status: "Gaps Found", notes: "Scenario J: Heavy OAuth user", notify_user_1w: false, notify_user_1d: false, creation: weekAgo },
];

// ── Access Artifacts ───────────────────────────────────────
export const mockArtifacts: AccessArtifact[] = [
  // Alice (A) — 3 OAuth tokens
  { name: "ART-2025-00001", case: "OBC-2025-00001", artifact_type: "OAuthToken", subject_email: "alice.johnson@testcorp.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive-001", risk_level: "High", scopes_json: '["https://www.googleapis.com/auth/drive","https://www.googleapis.com/auth/drive.file"]', creation: monthAgo },
  { name: "ART-2025-00002", case: "OBC-2025-00001", artifact_type: "OAuthToken", subject_email: "alice.johnson@testcorp.com", status: "Active", app_display_name: "Slack", client_id: "client-slack-001", risk_level: "Medium", scopes_json: '["https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/calendar.readonly"]', creation: monthAgo },
  { name: "ART-2025-00003", case: "OBC-2025-00001", artifact_type: "OAuthToken", subject_email: "alice.johnson@testcorp.com", status: "Active", app_display_name: "GitHub", client_id: "client-github-001", risk_level: "Critical", scopes_json: '["https://www.googleapis.com/auth/admin.directory.user","https://www.googleapis.com/auth/gmail.send"]', creation: monthAgo },
  // Bob (B) — 2 ASPs
  { name: "ART-2025-00004", case: "OBC-2025-00002", artifact_type: "ASP", subject_email: "bob.smith@testcorp.com", status: "Active", app_display_name: "Thunderbird Mail", risk_level: "Medium", creation: monthAgo },
  { name: "ART-2025-00005", case: "OBC-2025-00002", artifact_type: "ASP", subject_email: "bob.smith@testcorp.com", status: "Active", app_display_name: "Outlook Desktop", risk_level: "Medium", creation: monthAgo },
  // Charlie (C) — login event
  { name: "ART-2025-00006", case: "OBC-2025-00003", artifact_type: "LoginEvent", subject_email: "charlie.brown@testcorp.com", status: "Active", app_display_name: "Google Login", risk_level: "High", metadata_json: '{"ip":"203.0.113.45","login_time":"2025-10-25T14:30:00","user_agent":"Chrome/119"}', creation: weekAgo },
  // Diana (D) — AdminMFA + DWD
  { name: "ART-2025-00007", case: "OBC-2025-00004", artifact_type: "AdminMFA", subject_email: "diana.prince@testcorp.com", status: "Active", app_display_name: "Admin Console", risk_level: "Critical", creation: monthAgo },
  { name: "ART-2025-00008", case: "OBC-2025-00004", artifact_type: "DWDChange", subject_email: "diana.prince@testcorp.com", status: "Active", app_display_name: "Domain-Wide Delegation", risk_level: "Critical", metadata_json: '{"service_account":"sa@project.iam.gserviceaccount.com","scopes":["https://www.googleapis.com/auth/admin.directory.user"]}', creation: monthAgo },
  // Grace (G) — 4 OAuth tokens
  { name: "ART-2025-00009", case: "OBC-2025-00007", artifact_type: "OAuthToken", subject_email: "grace.lee@testcorp.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive-001", risk_level: "High", scopes_json: '["https://www.googleapis.com/auth/drive"]', creation: weekAgo },
  { name: "ART-2025-00010", case: "OBC-2025-00007", artifact_type: "OAuthToken", subject_email: "grace.lee@testcorp.com", status: "Active", app_display_name: "Zoom", client_id: "client-zoom-001", risk_level: "Medium", scopes_json: '["https://www.googleapis.com/auth/calendar"]', creation: weekAgo },
  { name: "ART-2025-00011", case: "OBC-2025-00007", artifact_type: "OAuthToken", subject_email: "grace.lee@testcorp.com", status: "Active", app_display_name: "Notion", client_id: "client-notion-001", risk_level: "Low", scopes_json: '["https://www.googleapis.com/auth/drive.readonly"]', creation: weekAgo },
  { name: "ART-2025-00012", case: "OBC-2025-00007", artifact_type: "ASP", subject_email: "grace.lee@testcorp.com", status: "Active", app_display_name: "Apple Mail", risk_level: "Medium", creation: weekAgo },
  // Henry (H) — mixed
  { name: "ART-2025-00013", case: "OBC-2025-00008", artifact_type: "OAuthToken", subject_email: "henry.ford@testcorp.com", status: "Active", app_display_name: "Salesforce", client_id: "client-salesforce-001", risk_level: "High", scopes_json: '["https://www.googleapis.com/auth/contacts","https://www.googleapis.com/auth/gmail.send"]', creation: weekAgo },
  // Ivy (I) — 6 artifacts (heavy OAuth user)
  { name: "ART-2025-00014", case: "OBC-2025-00009", artifact_type: "OAuthToken", subject_email: "ivy.chen@testcorp.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive-001", risk_level: "High", scopes_json: '["https://www.googleapis.com/auth/drive","https://www.googleapis.com/auth/drive.file","https://www.googleapis.com/auth/drive.appdata"]', creation: weekAgo },
  { name: "ART-2025-00015", case: "OBC-2025-00009", artifact_type: "OAuthToken", subject_email: "ivy.chen@testcorp.com", status: "Active", app_display_name: "Jira", client_id: "client-jira-001", risk_level: "Medium", scopes_json: '["https://www.googleapis.com/auth/calendar","https://www.googleapis.com/auth/tasks"]', creation: weekAgo },
  { name: "ART-2025-00016", case: "OBC-2025-00009", artifact_type: "OAuthToken", subject_email: "ivy.chen@testcorp.com", status: "Active", app_display_name: "VS Code", client_id: "client-vscode-001", risk_level: "Low", scopes_json: '["https://www.googleapis.com/auth/userinfo.profile"]', creation: weekAgo },
  { name: "ART-2025-00017", case: "OBC-2025-00009", artifact_type: "OAuthToken", subject_email: "ivy.chen@testcorp.com", status: "Active", app_display_name: "ChatGPT", client_id: "client-chatgpt-001", risk_level: "Medium", scopes_json: '["https://www.googleapis.com/auth/gmail.readonly"]', creation: weekAgo },
  { name: "ART-2025-00018", case: "OBC-2025-00009", artifact_type: "ASP", subject_email: "ivy.chen@testcorp.com", status: "Active", app_display_name: "Thunderbird", risk_level: "Medium", creation: weekAgo },
  { name: "ART-2025-00019", case: "OBC-2025-00009", artifact_type: "LoginEvent", subject_email: "ivy.chen@testcorp.com", status: "Active", app_display_name: "Google Login", risk_level: "High", metadata_json: '{"ip":"198.51.100.23","login_time":"2025-12-01T09:15:00","user_agent":"Firefox/120"}', creation: weekAgo },
  // Jack (J)
  { name: "ART-2025-00020", case: "OBC-2025-00010", artifact_type: "OAuthToken", subject_email: "jack.daniels@testcorp.com", status: "Active", app_display_name: "Dropbox", client_id: "client-dropbox-001", risk_level: "Medium", scopes_json: '["https://www.googleapis.com/auth/drive.readonly"]', creation: weekAgo },
  // Hidden artifacts for system scan testing
  { name: "ART-2025-00021", case: "", artifact_type: "OAuthToken", subject_email: "alice.johnson@testcorp.com", status: "Hidden", app_display_name: "Trello", client_id: "client-trello-001", risk_level: "Low", scopes_json: '["https://www.googleapis.com/auth/tasks"]', creation: weekAgo },
  { name: "ART-2025-00022", case: "", artifact_type: "ASP", subject_email: "bob.smith@testcorp.com", status: "Hidden", app_display_name: "K-9 Mail", risk_level: "Medium", creation: weekAgo },
  // Revoked artifacts (for restore testing)
  { name: "ART-2025-00023", case: "OBC-2025-00001", artifact_type: "OAuthToken", subject_email: "alice.johnson@testcorp.com", status: "Revoked", app_display_name: "Figma", client_id: "client-figma-001", risk_level: "Low", scopes_json: '["https://www.googleapis.com/auth/userinfo.profile"]', creation: monthAgo },
  // Active employees with OAuth (no cases)
  { name: "ART-2025-00024", case: "", artifact_type: "OAuthToken", subject_email: "karen.white@testcorp.com", status: "Active", app_display_name: "Google Drive", client_id: "client-google-drive-001", risk_level: "Low", scopes_json: '["https://www.googleapis.com/auth/drive"]' },
  { name: "ART-2025-00025", case: "", artifact_type: "OAuthToken", subject_email: "liam.neeson@testcorp.com", status: "Active", app_display_name: "Slack", client_id: "client-slack-001", risk_level: "Low", scopes_json: '["https://www.googleapis.com/auth/gmail.readonly"]' },
];

// ── Findings ───────────────────────────────────────────────
export const mockFindings: Finding[] = [
  // Alice
  { name: "FND-2025-00001", case: "OBC-2025-00001", finding_type: "LingeringOAuthGrant", severity: "Critical", summary: "OAuth grant for Google Drive discovered — full drive access persists after offboarding.", recommended_action: "Revoke the OAuth token for Google Drive immediately.", creation: monthAgo },
  { name: "FND-2025-00002", case: "OBC-2025-00001", finding_type: "LingeringOAuthGrant", severity: "High", summary: "OAuth grant for GitHub with admin.directory access still active.", recommended_action: "Revoke the GitHub OAuth token.", creation: monthAgo },
  // Bob
  { name: "FND-2025-00003", case: "OBC-2025-00002", finding_type: "LingeringASP", severity: "Medium", summary: "App-Specific Password for Thunderbird Mail still active.", recommended_action: "Delete the ASP for Thunderbird.", creation: monthAgo },
  // Charlie
  { name: "FND-2025-00004", case: "OBC-2025-00003", finding_type: "PostOffboardLogin", severity: "High", summary: "Post-offboard login detected from IP 203.0.113.45 via Chrome.", recommended_action: "Sign out all sessions and investigate.", creation: weekAgo },
  // Diana
  { name: "FND-2025-00005", case: "OBC-2025-00004", finding_type: "AdminMFAWeak", severity: "Critical", summary: "Admin account without strong 2FA — only SMS verification enabled.", recommended_action: "Enforce hardware security key for admin accounts.", creation: monthAgo },
  { name: "FND-2025-00006", case: "OBC-2025-00004", finding_type: "DWDHighRisk", severity: "Critical", summary: "Domain-Wide Delegation grant to service account with admin.directory scope.", recommended_action: "Review and restrict DWD scopes.", creation: monthAgo },
  // Grace
  { name: "FND-2025-00007", case: "OBC-2025-00007", finding_type: "LingeringOAuthGrant", severity: "High", summary: "OAuth grant for Google Drive persists after offboarding.", recommended_action: "Revoke Drive token.", creation: weekAgo },
  { name: "FND-2025-00008", case: "OBC-2025-00007", finding_type: "LingeringOAuthGrant", severity: "Medium", summary: "OAuth grant for Zoom with calendar access.", recommended_action: "Revoke Zoom token.", creation: weekAgo },
  { name: "FND-2025-00009", case: "OBC-2025-00007", finding_type: "LingeringASP", severity: "Medium", summary: "ASP for Apple Mail still active.", recommended_action: "Delete the ASP.", creation: weekAgo },
  // Henry
  { name: "FND-2025-00010", case: "OBC-2025-00008", finding_type: "LingeringOAuthGrant", severity: "High", summary: "OAuth grant for Salesforce with contacts and gmail.send access.", recommended_action: "Revoke Salesforce token.", creation: weekAgo },
  // Ivy (heavy)
  { name: "FND-2025-00011", case: "OBC-2025-00009", finding_type: "LingeringOAuthGrant", severity: "Critical", summary: "OAuth grant for Google Drive with full drive + appdata access.", recommended_action: "Revoke all Drive tokens immediately.", creation: weekAgo },
  { name: "FND-2025-00012", case: "OBC-2025-00009", finding_type: "LingeringOAuthGrant", severity: "Medium", summary: "OAuth grant for Jira with calendar and tasks access.", recommended_action: "Revoke Jira token.", creation: weekAgo },
  { name: "FND-2025-00013", case: "OBC-2025-00009", finding_type: "PostOffboardLogin", severity: "High", summary: "Post-offboard login detected from IP 198.51.100.23 via Firefox.", recommended_action: "Sign out all sessions.", creation: weekAgo },
  { name: "FND-2025-00014", case: "OBC-2025-00009", finding_type: "LingeringASP", severity: "Medium", summary: "ASP for Thunderbird still active after offboarding.", recommended_action: "Delete ASP.", creation: weekAgo },
  // Jack
  { name: "FND-2025-00015", case: "OBC-2025-00010", finding_type: "LingeringOAuthGrant", severity: "Medium", summary: "OAuth grant for Dropbox with drive.readonly access.", recommended_action: "Revoke Dropbox token.", creation: weekAgo },
  // Closed findings (Frank — remediated)
  { name: "FND-2025-00016", case: "OBC-2025-00006", finding_type: "LingeringOAuthGrant", severity: "High", summary: "OAuth grant for Slack — remediated.", recommended_action: "None — resolved.", closed_at: monthAgo, creation: monthAgo },
];

// ── Audit Logs ─────────────────────────────────────────────
export const mockAuditLogs: UnifiedAuditLogEntry[] = [
  { name: "AUD-2025-00001", actor_user: "Administrator", action_type: "CaseCreated", target_email: "alice.johnson@testcorp.com", result: "Success", request_json: '{"case":"OBC-2025-00001"}', timestamp: monthAgo, creation: monthAgo },
  { name: "AUD-2025-00002", actor_user: "Administrator", action_type: "ScanStarted", target_email: "alice.johnson@testcorp.com", result: "Success", request_json: '{"case":"OBC-2025-00001"}', timestamp: monthAgo, creation: monthAgo },
  { name: "AUD-2025-00003", actor_user: "Administrator", action_type: "ScanFinished", target_email: "alice.johnson@testcorp.com", result: "Success", request_json: '{"case":"OBC-2025-00001","active_artifacts":3,"open_findings":2,"new_status":"Gaps Found"}', timestamp: monthAgo, creation: monthAgo },
  { name: "AUD-2025-00004", actor_user: "Scheduler", action_type: "ScanStarted", target_email: "SYSTEM", result: "Success", request_json: '{"scan_type":"system_scan"}', timestamp: weekAgo, creation: weekAgo },
  { name: "AUD-2025-00005", actor_user: "Scheduler", action_type: "ScanFinished", target_email: "SYSTEM", result: "Success", request_json: '{"scan_type":"system_scan","discoveries":2,"cases_created":0}', timestamp: weekAgo, creation: weekAgo },
  { name: "AUD-2025-00006", actor_user: "Administrator", action_type: "RemediationStarted", target_email: "frank.castle@testcorp.com", result: "Success", request_json: '{"case":"OBC-2025-00006","action":"full_bundle"}', timestamp: monthAgo, creation: monthAgo },
  { name: "AUD-2025-00007", actor_user: "Administrator", action_type: "RemediationCompleted", target_email: "frank.castle@testcorp.com", result: "Success", request_json: '{"case":"OBC-2025-00006","action":"full_bundle","artifacts_remediated":2}', timestamp: monthAgo, creation: monthAgo },
  { name: "AUD-2025-00008", actor_user: "Administrator", action_type: "TokenRevoked", target_email: "alice.johnson@testcorp.com", result: "Success", request_json: '{"artifact":"ART-2025-00023","client_id":"client-figma-001"}', timestamp: monthAgo, creation: monthAgo },
];

// ── Settings ───────────────────────────────────────────────
export const mockSettings: OGMSettings = {
  auto_scan_on_offboard: true,
  auto_remediate_on_offboard: false,
  background_scan_enabled: true,
  auto_create_case_on_leave: true,
  background_scan_interval: "Every Hour",
  remediation_check_interval: "Every 5 Minutes",
  notify_on_new_findings: true,
  notify_on_remediation: true,
  notification_email: "security@testcorp.com",
  default_remediation_action: "full_bundle",
};
