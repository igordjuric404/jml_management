# JML Management — Implementation Plan v1

## Overview
17 features and bug fixes from `new-features-and-issues-v1.md`, organized into testable phases.

---

## Phase 1: Floating Chatbot Button + Fix Chat Logic (Issues #1, #2)

**Goal:** Replace the dedicated `/chat` page with a persistent floating chat button in the bottom-right corner of every page. Fix the mock provider's chat to actually answer questions using system context instead of canned greetings.

### Tasks
- [ ] 1.1 Create a `ChatWidget` component: floating FAB button (bottom-right), opens/closes a chat window overlay
- [ ] 1.2 Integrate `ChatWidget` into the app layout (`src/app/(app)/layout.tsx`)
- [ ] 1.3 Move chat logic from `chat/page.tsx` into the widget (message state, mutation, rendering)
- [ ] 1.4 Fix `MockProvider.chat()` to actually parse user questions and respond with real data from mock data (cases, findings, artifacts, audit logs, settings, employees, docs)
- [ ] 1.5 Add additional keyword matching in mock chat: audit logs, employees, remediation, settings, scan, docs, scheduling
- [ ] 1.6 Test: open chat from multiple pages, ask various questions, verify real answers
- [ ] 1.7 Remove or repurpose the `/chat` sidebar nav entry (keep route for backward compat but redirect to chatbot)

---

## Phase 2: Docs Page Redesign (Issue #3)

**Goal:** Restructure docs with sidebar navigation, subsections as subpages, improved typography/spacing/layout.

### Tasks
- [ ] 2.1 Create a docs layout with persistent sidebar navigation
- [ ] 2.2 Create individual subpage components for each section (Architecture, Findings, Access Artifacts, Audit Log, Remediation, Integrations)
- [ ] 2.3 Use route-based navigation (`/docs`, `/docs/architecture`, `/docs/findings`, etc.) or state-based section switching
- [ ] 2.4 Add subsections within each section with proper hierarchy
- [ ] 2.5 Improve typography: prose styling, heading hierarchy, spacing, readable line lengths
- [ ] 2.6 Add an overview landing page at `/docs` with summary cards linking to sections
- [ ] 2.7 Test: navigate all sections, verify readability and layout

---

## Phase 3: Table Row Click Navigation (Issue #4)

**Goal:** Clicking anywhere on a table row (not just the name/ID link) should navigate to the detail page.

### Tasks
- [ ] 3.1 Cases table: add `onClick` handler on `<TableRow>` to navigate to `/cases/{id}`
- [ ] 3.2 Findings table: add row click to navigate to finding detail view
- [ ] 3.3 Artifacts table: add row click to navigate to artifact detail view
- [ ] 3.4 Employees table: add row click to navigate to employee detail view
- [ ] 3.5 Ensure existing link clicks (name, email, case links) still work and don't double-navigate
- [ ] 3.6 Add `cursor-pointer` styling to clickable rows
- [ ] 3.7 Test: click on empty space within rows on each table page

---

## Phase 4: Fix "Run Scheduled Now" Button Visibility (Issue #5)

**Goal:** Only show "Run Scheduled Now" on cases that actually have a scheduled remediation date and are in Scheduled status.

### Tasks
- [ ] 4.1 In `cases/[id]/page.tsx`, conditionally render the "Run Scheduled Now" button only when `c.status === "Scheduled" && c.scheduled_remediation_date`
- [ ] 4.2 Verify in the cases list that `scheduled_remediation_date` is only shown for appropriate cases
- [ ] 4.3 Test: verify the button appears only on Case OBC-2025-00005 (Eve Wilson, Scheduled status)

---

## Phase 5: Fix Findings Detail View (Issue #6)

**Goal:** Clicking a finding should show a detail view, not just change the URL query param.

### Tasks
- [ ] 5.1 Add `useFindingDetail` hook to `use-api.ts` that fetches `/api/findings/{id}`
- [ ] 5.2 In `findings/page.tsx`, read `?finding=` search param and conditionally show detail view or list
- [ ] 5.3 Create a finding detail view component showing: finding info, severity, type, case link, evidence, recommended action, status
- [ ] 5.4 Add back button to return to findings list
- [ ] 5.5 Test: click on finding IDs, verify detail view renders

---

## Phase 6: Fix Artifacts Detail View (Issue #7)

**Goal:** Same as Phase 5 but for artifacts.

### Tasks
- [ ] 6.1 Add `useArtifactDetail` hook to `use-api.ts` that fetches `/api/artifacts/{id}`
- [ ] 6.2 In `artifacts/page.tsx`, read `?artifact=` search param and conditionally show detail view or list
- [ ] 6.3 Create an artifact detail view component showing: artifact info, type, status, risk level, scopes, metadata, case link
- [ ] 6.4 Add back button to return to artifacts list
- [ ] 6.5 Test: click on artifact IDs, verify detail view renders

---

## Phase 7: Findings Remediation Actions (Issue #8)

**Goal:** Allow triggering remediation from findings list or finding detail page.

### Tasks
- [ ] 7.1 Add `useRemediateFinding` hook/mutation to `use-api.ts`
- [ ] 7.2 Add API route `POST /api/findings/[id]/remediate` that calls the appropriate provider method
- [ ] 7.3 Add "Remediate" button on finding detail view
- [ ] 7.4 Add bulk remediate option on findings list (checkbox + button)
- [ ] 7.5 Implement remediation logic in mock provider: close finding, remediate associated artifacts
- [ ] 7.6 Test: remediate individual finding, verify status changes

---

## Phase 8: Finding "Remediated" Status + Medium/Low Findings (Issue #9)

**Goal:** Findings should have a "Remediated" status. When all findings of a case are remediated, case becomes Remediated. Generate findings for medium and low risk artifacts too.

### Tasks
- [ ] 8.1 Update `Finding` type to include `status` field with "Open" | "Remediated" | "Closed" (or use `closed_at` as remediated indicator)
- [ ] 8.2 Update mock data to generate findings for Medium and Low risk artifacts (not just High/Critical)
- [ ] 8.3 Update `_rescanCase` in mock provider to set case status to Remediated when all findings are remediated
- [ ] 8.4 Update finding display in list views and detail views to show "Remediated" status
- [ ] 8.5 Update findings badge styling for Remediated status
- [ ] 8.6 Test: remediate all findings of a case, verify case status changes

---

## Phase 9: Custom Confirmation Dialogs (Issue #10)

**Goal:** Replace all `confirm()` / `alert()` browser dialogs with custom toast or modal confirmations.

### Tasks
- [ ] 9.1 Create a reusable confirmation dialog component (or use sonner toast with action)
- [ ] 9.2 Replace all `confirm()` calls in: `cases/[id]/page.tsx`, `employees/page.tsx`
- [ ] 9.3 Replace all `alert()` calls
- [ ] 9.4 Ensure consistent look and feel
- [ ] 9.5 Test: trigger confirmations on case remediation, employee revoke, bulk actions

---

## Phase 10: Fix Employee Data Consistency (Issue #11)

**Goal:** After revoking access for an employee, the Employee Access Overview should reflect updated counts.

### Tasks
- [ ] 10.1 In mock provider, update `mockEmployees` counts when `revokeEmployeeAccess` or `executeRemediation` is called
- [ ] 10.2 Ensure `getEmployeeList()` computes counts dynamically from current artifact/finding state
- [ ] 10.3 Invalidate employee queries after revoke mutations
- [ ] 10.4 Test: revoke Ivy Chen's access, verify employee list shows 0 active artifacts and 0 open findings

---

## Phase 11: Employee Detail — Artifacts Table + Table Ordering (Issue #12)

**Goal:** Add artifacts table to employee detail page. Order tables: Cases → Findings → Artifacts.

### Tasks
- [ ] 11.1 Add Artifacts table to employee detail view in `employees/page.tsx`
- [ ] 11.2 Reorder sections: Cases first, then Findings, then Artifacts (then Apps)
- [ ] 11.3 Test: view employee detail, verify artifacts table and correct order

---

## Phase 12: Fix Settings Interval Persistence (Issue #13)

**Goal:** Settings interval values should persist across page refreshes.

### Tasks
- [ ] 12.1 Align UI interval options with backend/mock values: use `"Every Hour"`, `"Every 5 Minutes"`, `"Every 15 Minutes"`, `"Every 30 Minutes"`, `"Every 6 Hours"`, `"Daily"` instead of `"hourly"`, `"daily"` etc.
- [ ] 12.2 Update settings page dropdown options to match backend format
- [ ] 12.3 Ensure the form loads saved values correctly from API response
- [ ] 12.4 Test: change intervals, save, refresh page, verify values persisted

---

## Phase 13: Table Column Sorting (Issue #15)

**Goal:** All table columns should be sortable with arrow indicators in headers.

### Tasks
- [ ] 13.1 Create a reusable `SortableTableHead` component with sort indicator arrows
- [ ] 13.2 Add sorting state management (column, direction) to each table page
- [ ] 13.3 Implement client-side sorting for: Cases, Findings, Artifacts, Employees, Audit Log, Scan History tables
- [ ] 13.4 Ensure clicking the entire column header triggers sort (not just text)
- [ ] 13.5 Test: sort each table by different columns, verify ascending/descending toggle

---

## Phase 14: Email Notification Integration (Issue #16)

**Goal:** Integrate a free email-sending service. Send notification emails when high/critical findings are discovered.

### Tasks
- [ ] 14.1 Research free email services (Resend, SendGrid free tier, Mailgun, etc.)
- [ ] 14.2 Install chosen email SDK and configure API key
- [ ] 14.3 Create email sending utility in `src/lib/email.ts`
- [ ] 14.4 Create API route `POST /api/notifications/email` for sending emails
- [ ] 14.5 Integrate email sending into mock provider's `systemScan` when high/critical findings are found
- [ ] 14.6 Add email sending to scheduler notification task
- [ ] 14.7 Configure sender email as `igordjuric404@gmail.com`
- [ ] 14.8 Test: trigger a scan that discovers high/critical findings, verify email is sent

---

## Phase 15: Test Automations (Issue #14)

**Goal:** Validate that background scan and remediation check intervals actually work.

### Tasks
- [ ] 15.1 Temporarily decrease scan/remediation intervals for testing (e.g., "Every 5 Minutes" or even faster)
- [ ] 15.2 Run scheduler with `--once` flag and verify background scan executes
- [ ] 15.3 Run scheduler loop and verify interval timing
- [ ] 15.4 Create a test case with scheduled remediation in the past, verify it gets remediated
- [ ] 15.5 Verify logs show correct actions and timing
- [ ] 15.6 Restore normal intervals after testing

---

## Phase 16: Frappe Integration E2E Test (Issue #17)

**Goal:** Test the full JML pipeline: user fired/moved → scan → findings → remediation → email notification.

### Tasks
- [ ] 16.1 Create 2 test employees who are active with permissions (in mock data)
- [ ] 16.2 Simulate "user fired" event: change employee status, trigger case creation
- [ ] 16.3 Simulate "user moved" event: change department, trigger security review
- [ ] 16.4 Verify scan runs for the employee
- [ ] 16.5 Verify findings are created
- [ ] 16.6 Verify auto-remediation works (if toggle enabled)
- [ ] 16.7 Verify email notification for high/critical findings
- [ ] 16.8 Document results in Execution Log

---

## Dependency Order
- Phases 1-6 can proceed independently
- Phase 7 depends on Phase 5 (finding detail view)
- Phase 8 depends on Phase 7 (remediation actions)
- Phase 10 relates to Phase 7-8 (data consistency after remediation)
- Phase 14 should be done before Phase 15-16 (email needed for full test)
- Phase 16 depends on Phase 14-15

## Recommended Execution Order
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16
