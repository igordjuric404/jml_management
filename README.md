# JML Management

Joiners, Movers, Leavers access management — standalone OAuth Gap Monitor.

Deployed at: **https://jml-management.igordjuric404.workers.dev**

## Overview

JML Management is a standalone application that replicates and extends the OAuth Gap Monitor Frappe app. It monitors and remediates lingering access (OAuth tokens, ASPs, login sessions) for offboarded employees.

**Frappe is the system of record** — the standalone app reads from and writes back to Frappe for all mutations.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (mock data mode)
./start.sh dev

# Or run directly
npm run dev
```

Default login: **Administrator / admin**

Dashboard: http://localhost:3000/dashboard

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Router                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Dashboard │ │  Cases   │ │Employees │ │OAuth Apps │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       └─────────────┴────────────┴─────────────┘        │
│                         │                                │
│               ┌─────────┴──────────┐                     │
│               │   API Routes (BFF) │                     │
│               └─────────┬──────────┘                     │
│                         │                                │
│            ┌────────────┴────────────┐                   │
│            │    HrProvider Interface  │                   │
│            └────┬──────┬──────┬──────┘                   │
│                 │      │      │                           │
│          ┌──────┴──┐ ┌┴────┐ ┌┴──────┐                  │
│          │ Frappe  │ │Google│ │ M365  │                  │
│          │Provider │ │Mock  │ │ Mock  │                  │
│          └─────────┘ └─────┘ └───────┘                  │
└─────────────────────────────────────────────────────────┘
```

### Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **State Management**: TanStack React Query
- **Testing**: Vitest, @testing-library/react
- **Deployment**: Cloudflare Workers via @opennextjs/cloudflare

### Provider Abstraction

The `HrProvider` interface enables pluggable backends:

| Provider | Status | Notes |
|----------|--------|-------|
| Frappe REST API | ✅ Full | Production-ready adapter |
| Mock (in-memory) | ✅ Full | For dev/demo without Frappe |
| Google Workspace | ✅ Mocked | Documented enablement path |
| Microsoft 365 | ✅ Mocked | Documented enablement path |

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run test suite (98 tests) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run seed` | Reset mock data |
| `npm run seed:frappe` | Repopulate Frappe test data |
| `npm run scheduler` | Start background job scheduler |
| `npm run cf:build` | Build for Cloudflare |
| `npm run cf:deploy` | Deploy to Cloudflare Workers |
| `./start.sh dev` | Start dev (with env checks) |
| `./start.sh prod` | Build + start production |
| `./start.sh scheduler` | Start scheduler |
| `./start.sh seed` | Reset test data |

## Configuration

Copy `.env.example` to `.env.local`:

```bash
# Frappe backend URL
NEXT_PUBLIC_FRAPPE_URL=http://localhost:8000

# Use mock data (no Frappe required)
NEXT_PUBLIC_USE_MOCK=true

# Frappe API credentials (for production)
FRAPPE_API_KEY=your_api_key
FRAPPE_API_SECRET=your_api_secret
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

**98 tests** covering:
- Mock provider operations (43 tests)
- Mock data integrity (30 tests)  
- Auth session management (7 tests)
- Provider factory (3 tests)
- API route integration (7 tests)
- Fixture/schema validation (8 tests)

## Frappe Integration Layer

### Endpoints Used

All Frappe communication flows through `src/lib/providers/frappe/client.ts`:

- **Auth**: `POST /api/method/login`
- **REST**: `GET/POST /api/method/oauth_gap_monitor.api.*`
- **Resources**: `GET /api/resource/{DocType}/{name}`
- **Lists**: `GET /api/resource/{DocType}?filters=...`

### Auth Strategy

Token-based: `Authorization: token {api_key}:{api_secret}`

### Data Mappings

All Frappe DocTypes are mapped to TypeScript interfaces in `src/lib/dto/types.ts`. The mapping is explicit — no implicit field access.

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | KPIs, quick links, top apps, risky cases |
| Offboarding Cases | `/cases` | Case list + create dialog |
| Case Detail | `/cases/[id]` | Artifacts, findings, audit log, actions |
| Access Artifacts | `/artifacts` | Filterable artifact list, bulk remediate |
| Findings | `/findings` | Severity-filtered finding list |
| Employees | `/employees` | Employee access overview, bulk revoke |
| OAuth Apps | `/apps` | App list, active/revoked split, scope mgmt |
| Scan History | `/scan-history` | Scan stats and log |
| Audit Log | `/audit-log` | Action audit trail |
| Settings | `/settings` | Automation, schedules, notifications |
| Documentation | `/docs` | Product documentation |
| AI Chat | `/chat` | Contextual help assistant |
| Login | `/login` | Authentication |
