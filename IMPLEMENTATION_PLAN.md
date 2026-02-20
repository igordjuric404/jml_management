# JML Management — Implementation Plan

## Architecture

- **Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Data Source**: Frappe REST API (with MockProvider for dev/demo)
- **Deployment**: Cloudflare Workers via OpenNext adapter
- **Provider Abstraction**: HrProvider interface for future Google/M365 integration

## Phases

### Phase 0: Project Setup ✅
- [x] Create jml_management project with Next.js 15, TypeScript, Tailwind
- [x] Install shadcn/ui components
- [x] Initialize git repo
- [x] Create GitHub repo (igordjuric404/jml_management)
- [x] Configure Cloudflare deployment

### Phase 1: Core Architecture ✅
- [x] Provider/Connector interface (HrProvider)
- [x] FrappeProvider (Frappe REST API adapter)
- [x] MockProvider (in-memory test data)
- [x] DTOs and data mapping types
- [x] Auth system (session cookies, RBAC)
- [x] 25 API routes

### Phase 2: All Pages ✅
- [x] Dashboard (KPIs, quick links, top OAuth apps, risky cases)
- [x] Offboarding Cases (list, detail, create, scan, remediate)
- [x] Access Artifacts (list, filter, bulk remediate)
- [x] Findings (list, filter, severity badges)
- [x] Employee Access Overview (list, detail, bulk revoke)
- [x] OAuth App Dashboard (list, detail, active/revoked tables, scope management)
- [x] Scan History (stats, log table)
- [x] Audit Log (expandable entries)
- [x] Settings (toggles, schedules)
- [x] Documentation (sections, nav sidebar)
- [x] AI Chat (message bubbles, source links)

### Phase 3: Testing Suite
- [ ] Install testing framework (Vitest + Testing Library)
- [ ] Unit tests for providers (mock + frappe)
- [ ] Unit tests for business logic (DTOs, auth)
- [ ] Integration tests for API routes
- [ ] Contract tests for Frappe API assumptions
- [ ] E2E tests for critical flows (Playwright)
- [ ] Test data fixtures validation

### Phase 4: Background Jobs & Startup Script
- [ ] Startup script (start.sh equivalent)
- [ ] Background job scheduler (cron-like)
- [ ] Scheduled scan management
- [ ] Notification system

### Phase 5: Google/M365 Mock Providers
- [ ] Google Workspace mock provider
- [ ] Microsoft 365 mock provider
- [ ] "How to enable" documentation

### Phase 6: CI/CD Pipeline
- [ ] GitHub Actions workflow
- [ ] Auto-deploy to Cloudflare on push
- [ ] Run tests in CI

### Phase 7: Parity Report & Docs
- [ ] Feature parity matrix (Frappe → JML)
- [ ] Integration layer documentation
- [ ] Post-parity enhancement backlog
