#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

log() { echo "[JML] $*"; }
warn() { echo "[JML][WARN] $*" >&2; }

# ── Check prerequisites ────────────────────────────────────
command -v node >/dev/null 2>&1 || { warn "Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v npm  >/dev/null 2>&1 || { warn "npm is required."; exit 1; }

NODE_VERSION=$(node -v | sed 's/^v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  warn "Node.js 18+ is required. Current: $(node -v)"
  exit 1
fi

# ── Install dependencies ───────────────────────────────────
if [ ! -d "node_modules" ]; then
  log "Installing dependencies..."
  npm install
fi

# ── Check environment ──────────────────────────────────────
if [ ! -f ".env.local" ]; then
  log "Creating .env.local from .env.example..."
  cp .env.example .env.local
  log "Edit .env.local to configure Frappe connection or keep NEXT_PUBLIC_USE_MOCK=true for demo mode."
fi

# ── Check Frappe connectivity (if not mock) ────────────────
USE_MOCK=$(grep NEXT_PUBLIC_USE_MOCK .env.local 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'" || true)
FRAPPE_URL=$(grep NEXT_PUBLIC_FRAPPE_URL .env.local 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'" || true)

if [ "$USE_MOCK" != "true" ] && [ -n "$FRAPPE_URL" ]; then
  log "Checking Frappe connectivity at $FRAPPE_URL..."
  if curl -sf "$FRAPPE_URL/api/method/frappe.ping" >/dev/null 2>&1; then
    log "Frappe is reachable."
  else
    warn "Cannot reach Frappe at $FRAPPE_URL. Falling back to mock mode."
    warn "Edit .env.local to fix the URL or set NEXT_PUBLIC_USE_MOCK=true."
  fi
else
  log "Running in MOCK mode (Frappe not required)."
fi

# ── Build (if needed) ──────────────────────────────────────
if [ ! -d ".next" ] || [ "${1:-}" = "--build" ]; then
  log "Building Next.js application..."
  npm run build
fi

# ── Start ──────────────────────────────────────────────────
MODE="${1:-dev}"

case "$MODE" in
  dev)
    log "Starting in DEVELOPMENT mode..."
    log ""
    log "JML Management is starting..."
    log "URL:       http://localhost:3000"
    log "Login:     Administrator / admin"
    log "Dashboard: http://localhost:3000/dashboard"
    log ""
    npm run dev
    ;;
  prod|start)
    log "Starting in PRODUCTION mode..."
    npm run build
    log ""
    log "JML Management is ready!"
    log "URL:       http://localhost:3000"
    log "Login:     Administrator / admin"
    log "Dashboard: http://localhost:3000/dashboard"
    log ""
    npm start
    ;;
  scheduler)
    log "Starting background scheduler..."
    npx tsx scripts/scheduler.ts
    ;;
  seed)
    log "Seeding test data..."
    npx tsx scripts/seed.ts "${@:2}"
    ;;
  build)
    log "Building for Cloudflare..."
    npx opennextjs-cloudflare build
    log "Build complete. Deploy with: npx wrangler deploy --name jml-management"
    ;;
  *)
    echo "Usage: $0 [dev|prod|scheduler|seed|build]"
    echo ""
    echo "  dev        Start development server (default)"
    echo "  prod       Build and start production server"
    echo "  scheduler  Start background job scheduler"
    echo "  seed       Reset test data (add --frappe for Frappe)"
    echo "  build      Build for Cloudflare deployment"
    exit 1
    ;;
esac
