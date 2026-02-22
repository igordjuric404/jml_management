# Execution Log V2 — Features & Improvements

## Implementation Plan Overview

Based on `new-features-and-issues-v2.md`. All phases must be executed in strict order.

---

## Phase List

### Phase 1: Commit + Deploy + Production Validation (BLOCKER)
- **Goal**: Commit all working changes, deploy to Cloudflare, validate real artifact data in production
- **Status**: In Progress
- [ ] Commit all current changes to git (igordjuric404 account)
- [ ] Handle Cloudflare build compatibility (Prisma/SQLite → CF Workers)
- [ ] Set Cloudflare secrets via wrangler
- [ ] Deploy via `npm run cf:deploy`
- [ ] Validate production shows real artifact data for test employees
- [ ] Only proceed to Phase 2 after production validation passes

### Phase 2: Granular Revocation on Employee Page
- **Goal**: Select one/many/all artifacts and revoke only selected set
- **Status**: Not Started
- [ ] Add checkbox selection to artifact table UI
- [ ] Add "Revoke Selected" button alongside existing "Revoke All"
- [ ] Create API endpoint for selective artifact revocation
- [ ] Wire UI selection → API → Microsoft Graph revocation
- [ ] Test: revoke exactly ONE artifact, confirm only that one removed
- [ ] Add unit tests for selective revocation logic
- [ ] Add integration tests for the full flow

### Phase 3: Data Consistency Across Pages
- **Goal**: All pages show same artifact/grant data from same source of truth
- **Status**: Not Started
- [ ] Fix `getEmployeeList()` — currently hardcodes `active_artifacts: 0`
- [ ] Fix `listArtifacts()` — currently filters by `Left` status only, returns nothing
- [ ] Fix `getAllActiveOAuthApps()` — same `Left` filter bug
- [ ] Fix `getDashboardStats()` — same `Left` filter bug
- [ ] Fix `mapEmployeeStatus()` — currently always returns "Active"
- [ ] Fix `getArtifact()` — currently always throws
- [ ] Employee Access Overview: show real artifact counts
- [ ] Access Artifacts page: show all artifacts for all employees
- [ ] OAuth App Dashboard: list all apps from real artifacts
- [ ] Test all pages show consistent data

### Phase 4: Offboarding + Findings Pipeline Visibility
- **Goal**: Verify settings, test offboarding flow, auto-create case, convert artifacts to findings
- **Status**: Not Started
- [ ] Verify settings: auto remediate OFF, auto create case ON
- [ ] Offboard employee in Frappe with future effective date
- [ ] Verify status becomes "to leave"
- [ ] Auto-create offboarding case
- [ ] Convert artifacts into findings tied to case
- [ ] Verify Offboarding and Findings pages display correctly

### Phase 5: Granular Revocation on Offboarding Case
- **Goal**: Same select one/many/all artifact revocation on case and findings pages
- **Status**: Not Started
- [ ] Add granular selection UI to case detail page
- [ ] Add granular selection UI to findings detail page
- [ ] Wire to same revocation API
- [ ] Test selective revocation from case page
- [ ] Test selective revocation from findings page

### Phase 6: Email Notifications (Remediation Only)
- **Goal**: Send email on remediation event only (not on new finding)
- **Status**: Not Started
- [ ] Configure notification rules — remediation events only
- [ ] Test email sends to igordjuric404@gmail.com
- [ ] Verify email works after automated revocation

### Phase 7: Auto-Remediate on Offboarding
- **Goal**: Enable auto-remediation, offboard employee, verify automation triggers
- **Status**: Not Started
- [ ] Enable auto remediate on offboarding in settings
- [ ] Offboard employee with future effective date
- [ ] Simulate time progression for effective date
- [ ] Verify automation revokes all access
- [ ] Verify artifact status changes to revoked
- [ ] Verify employee status changes to left
- [ ] Ensure only targeted user affected

---

## Phase Completion Summaries

(Will be appended as phases complete)
