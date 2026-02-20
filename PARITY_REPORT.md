# JML Management — Feature Parity Report

## Frappe → Standalone Mapping

### Pages/Screens

| Frappe Page | Standalone Route | Status | Notes |
|-------------|-----------------|--------|-------|
| ogm-dashboard | `/dashboard` | ✅ Parity | KPIs, quick links, top OAuth apps, risky cases, System Scan |
| Offboarding Case list view | `/cases` | ✅ Parity | Table with status badges, clickable links |
| Offboarding Case form | `/cases/[id]` | ✅ Parity | Detail card, actions, tabs (artifacts, findings, audit log) |
| New Offboarding Case dialog | `/cases` (dialog) | ✅ Parity | Employee dropdown (Name + HR-EMP-ID format) |
| Access Artifact list view | `/artifacts` | ✅ Parity | Filter by type/status, bulk remediate |
| Access Artifact list JS | `/artifacts` | ✅ Parity | Remediate bulk action |
| Finding list view | `/findings` | ✅ Parity | Filter by severity/type, severity badges |
| ogm-employees | `/employees` | ✅ Parity | List/detail views, bulk revoke, per-employee KPIs |
| ogm-app-dashboard | `/apps` | ✅ Parity | List/detail, Active/Revoked split tables, scope management |
| ogm-scan-history | `/scan-history` | ✅ Parity | Stat cards, scan log table |
| Unified Audit Log list | `/audit-log` | ✅ Parity | Expandable request JSON |
| OGM Settings form | `/settings` | ✅ Parity | All toggles, schedules, notifications, defaults |
| ogm-docs | `/docs` | ✅ Parity | Architecture, findings, artifacts, audit, remediation, integrations |
| ogm-chat | `/chat` | ✅ Parity | Chat bubbles, source links, keyword-based + AI |
| Login | `/login` | ✅ Parity | Username/password auth |

### Doctypes → Data Model

| Frappe DocType | Standalone DTO | Status |
|----------------|----------------|--------|
| Offboarding Case | `OffboardingCase` | ✅ All fields mapped |
| Access Artifact | `AccessArtifact` | ✅ All fields mapped |
| Finding | `Finding` | ✅ All fields mapped |
| Finding Evidence | `FindingEvidence` | ✅ All fields mapped |
| Unified Audit Log Entry | `UnifiedAuditLogEntry` | ✅ All fields mapped |
| OGM Settings | `OGMSettings` | ✅ All fields mapped |

### API Endpoints

| Frappe API | Standalone API Route | Status |
|------------|---------------------|--------|
| `trigger_scan` | `POST /api/cases/[id]/scan` | ✅ |
| `run_scan_job` | (internal to provider) | ✅ |
| `system_scan` | `POST /api/scan` | ✅ |
| `execute_remediation` | `POST /api/cases/[id]/remediate` | ✅ |
| `get_dashboard_stats` | `GET /api/dashboard` | ✅ |
| `get_case_detail` | `GET /api/cases/[id]` | ✅ |
| `bulk_remediate` | `POST /api/cases/[id]/bulk-remediate` | ✅ |
| `remediate_artifacts` | `POST /api/artifacts` | ✅ |
| `create_case_from_employee` | `POST /api/cases/from-employee` | ✅ |
| `global_app_removal` | `POST /api/apps/[clientId]/global-remove` | ✅ |
| `revoke_app_for_users` | `POST /api/apps/[clientId]/revoke-users` | ✅ |
| `restore_app_for_users` | `POST /api/apps/[clientId]/restore-users` | ✅ |
| `update_user_scopes` | `POST /api/apps/[clientId]/update-scopes` | ✅ |
| `get_all_active_oauth_apps` | `GET /api/apps` | ✅ |
| `get_app_detail` | `GET /api/apps/[clientId]` | ✅ |
| `get_scan_history` | `GET /api/scan/history` | ✅ |
| `get_statistics` | (included in dashboard) | ✅ |
| `get_employee_list` | `GET /api/employees` | ✅ |
| `get_employee_detail` | `GET /api/employees/[id]` | ✅ |
| `revoke_employee_access` | `POST /api/employees/[id]/revoke` | ✅ |
| `run_scheduled_remediation_now` | `POST /api/cases/[id]/scheduled-remediation` | ✅ |
| `chatbot.chat` | `POST /api/chat` | ✅ |
| `auth.login` | `POST /api/auth/login` | ✅ |
| `auth.logout` | `POST /api/auth/logout` | ✅ |

### Actions/Workflows

| Frappe Workflow | Standalone Implementation | Status |
|----------------|--------------------------|--------|
| Create case from employee | Employee dropdown dialog → API | ✅ |
| Scan individual case | Scan button → trigger_scan | ✅ |
| System-wide scan | Dashboard "Scan System" → system_scan | ✅ |
| Full remediation bundle | Remediate button → full_bundle | ✅ |
| Revoke OAuth tokens | Action → revoke_token | ✅ |
| Delete ASPs | Action → delete_asp | ✅ |
| Sign out sessions | Action → sign_out | ✅ |
| Bulk artifact remediate | Checkbox + button | ✅ |
| Global app removal | Action menu → global_app_removal | ✅ |
| Per-user app revoke | Select + revoke | ✅ |
| Per-user app restore | Select + restore | ✅ |
| Granular scope management | Manage button → scope dialog | ✅ |
| Scheduled remediation | Auto-execute on scheduled date | ✅ |
| Run scheduled now | Button → run_scheduled_remediation_now | ✅ |

### Background Jobs

| Frappe Task | Standalone Equivalent | Status |
|-------------|----------------------|--------|
| `background_scan_all` (cron */5) | `scripts/scheduler.ts` → `runBackgroundScan` | ✅ |
| `check_scheduled_remediations` (cron */5) | `scripts/scheduler.ts` → `checkScheduledRemediations` | ✅ |
| `daily_scan_pending_cases` (daily) | `scripts/scheduler.ts` → `dailyScanPendingCases` | ✅ |
| `send_scheduled_notifications` (daily) | `scripts/scheduler.ts` → `sendNotifications` | ✅ |
| `on_employee_update` (doc_event) | (handled via Frappe provider when connected) | ⚠️ Via Frappe |

### Permissions

| Frappe Role | Standalone RBAC | Status |
|-------------|----------------|--------|
| System Manager | Full access | ✅ |
| HR Manager | Limited access (create, read, write) | ✅ |
| Guest | No access (redirect to login) | ✅ |

### Integrations

| Integration | Status | Notes |
|-------------|--------|-------|
| Frappe REST API | ✅ Full | FrappeProvider with all endpoints |
| Google Workspace | ✅ Mocked | GoogleMockClient with documented enablement |
| Microsoft 365 | ✅ Mocked | MicrosoftMockClient with documented enablement |
| AI Chatbot (OpenRouter) | ✅ Mocked | Keyword-based fallback + API proxy |

### Test Data

| Frappe repopulate.py | Standalone mock-data.ts | Status |
|---------------------|------------------------|--------|
| Scenarios A-J | ✅ All 10 | Identical scenarios |
| 18 employees | ✅ 18 | 10 offboarded + 8 active |
| Hidden artifacts | ✅ 2 | For system scan testing |
| Revoked artifacts | ✅ 1 | For restore testing |
| Active employee OAuth | ✅ 2 | No-case artifacts |
| Closed findings | ✅ 1 | Remediated scenario |

## Deviations from Frappe Behavior

1. **UI Framework**: Frappe uses jQuery/Bootstrap; standalone uses React/shadcn/ui. Visual styling differs but functionality is identical.
2. **Navigation**: Frappe uses `frappe.set_route`; standalone uses Next.js App Router with `<Link>` components.
3. **Toast/Alerts**: Frappe uses `frappe.show_alert`; standalone uses Sonner toast library.
4. **Dialogs**: Frappe uses `frappe.ui.Dialog`; standalone uses shadcn/ui Dialog component.
5. **Employee doc_event**: The `on_employee_update` hook relies on Frappe's doc_events system. In standalone mode, case creation from employee status change would need to be triggered via the scheduler or a webhook.

## Post-Parity Enhancement Backlog

1. **Real-time updates**: WebSocket or SSE for live dashboard updates
2. **Export functionality**: CSV/PDF export for cases, artifacts, findings
3. **Advanced analytics**: Charts/graphs for trends, MTTR visualization
4. **Email notifications**: SMTP integration for scheduled reminders
5. **Webhook support**: Inbound webhooks for Frappe doc_events
6. **Multi-tenant**: Support for multiple Frappe instances
7. **Audit log search**: Full-text search on audit entries
8. **Dark/light theme**: Already implemented with next-themes
9. **Mobile responsiveness**: Already responsive with Tailwind
10. **Google Workspace live integration**: Enable when API tokens available
11. **Microsoft 365 live integration**: Enable when API tokens available
12. **SSO**: SAML/OIDC authentication for enterprise environments
