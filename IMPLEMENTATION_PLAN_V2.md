# Implementation Plan V2

## Phase 1: Employee Detail — Hide Empty Sections
- Wrap Cases, Findings, Artifacts, Applications sections in conditionals
- Only show section if `detail.<field>?.length > 0`

## Phase 2: Frappe Employee Integration
- Modify mock provider's `getEmployeeList()` to fetch from Frappe REST API at localhost:8000
- Modify `getEmployeeDetail()` to fetch base employee data from Frappe
- Fall back to mock employees if Frappe is unavailable
- Map Frappe Employee fields → OGM Employee interface
- Merge with mock artifacts/findings data for enrichment

## Phase 3: Fix OBC-2025-00005 Scheduled Remediation
- Change `twoWeeksFromNow` in mock-data.ts to a date in the past (1 hour ago)
- Ensure the mock scheduler logic properly detects and auto-executes overdue scheduled remediations
- The `_rescanCase` and scheduled check logic should trigger on overdue cases

## Phase 4: Fix Audit Log Dropdown Row Duplication
- Investigate the expand/collapse causing visual duplication
- Fix Fragment + TableRow key handling
- Ensure click on chevron doesn't cause multiple re-renders or duplicate entries

## Phase 5: Commit, Push, Deploy
- Run tests
- Commit
- Push to GitHub (igordjuric404)
- Build and deploy to Cloudflare
