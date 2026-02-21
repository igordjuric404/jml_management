#!/usr/bin/env bash
set -euo pipefail

# Frappe connection settings
FRAPPE_URL="${FRAPPE_URL:-http://localhost:8000}"
FRAPPE_USER="${FRAPPE_USER:-Administrator}"
FRAPPE_PASS="${FRAPPE_PASS:-admin}"
COOKIE_JAR=$(mktemp)
ENV_FILE="$(cd "$(dirname "$0")" && pwd)/.env.local"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[repopulate]${NC} $*"; }
warn() { echo -e "${YELLOW}[repopulate]${NC} $*"; }
err()  { echo -e "${RED}[repopulate]${NC} $*"; }

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

# ── Login ────────────────────────────────────────────────────
log "Logging into Frappe at $FRAPPE_URL..."
LOGIN=$(curl -s -c "$COOKIE_JAR" "$FRAPPE_URL/api/method/login" \
  -H 'Content-Type: application/json' \
  -d "{\"usr\":\"$FRAPPE_USER\",\"pwd\":\"$FRAPPE_PASS\"}" 2>&1)
if echo "$LOGIN" | grep -q '"message":"Logged In"'; then
  log "Logged in as $FRAPPE_USER"
else
  err "Login failed: $LOGIN"; exit 1
fi

api() {
  local method=$1 url=$2; shift 2
  curl -s -b "$COOKIE_JAR" -X "$method" "$FRAPPE_URL$url" \
    -H 'Content-Type: application/json' -H 'Accept: application/json' "$@" 2>&1
}

create_doc() {
  local doctype=$1 payload=$2
  local encoded; encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$doctype'))")
  api POST "/api/resource/$encoded" -d "$payload"
}

delete_if_exists() {
  local doctype=$1 name=$2
  local encoded_dt; encoded_dt=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$doctype'))")
  local encoded_nm; encoded_nm=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$name'))")
  api DELETE "/api/resource/$encoded_dt/$encoded_nm" > /dev/null 2>&1 || true
}

# ── Test employee data ────────────────────────────────────────
EMPLOYEES=(
  "HR-EMP-TEST-01|Test_Alex|Rivera|alex.rivera@testcorp.com|Engineering|Senior Backend Developer"
  "HR-EMP-TEST-02|Test_Maya|Patel|maya.patel@testcorp.com|Product|Product Manager"
  "HR-EMP-TEST-03|Test_James|O'Brien|james.obrien@testcorp.com|Security|Security Analyst"
  "HR-EMP-TEST-04|Test_Yuki|Tanaka|yuki.tanaka@testcorp.com|Data|Data Engineer"
  "HR-EMP-TEST-05|Test_Sofia|Martinez|sofia.martinez@testcorp.com|DevOps|DevOps Lead"
)

# ── 1. Clean up old test data (by email, handles Frappe auto-naming) ──
log "Cleaning up old test data..."
for entry in "${EMPLOYEES[@]}"; do
  IFS='|' read -r _empid _first _last email _dept _desig <<< "$entry"
  encoded_email=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$email'))")

  # Delete artifacts for this email
  ARTS=$(api GET "/api/resource/Access%20Artifact?filters=%5B%5B%22subject_email%22%2C%22%3D%22%2C%22$encoded_email%22%5D%5D&fields=%5B%22name%22%5D&limit_page_length=0" | python3 -c "import sys,json; [print(a['name']) for a in json.load(sys.stdin).get('data',[])]" 2>/dev/null || true)
  for art in $ARTS; do
    delete_if_exists "Access Artifact" "$art"
  done

  # Delete cases by email
  CASES=$(api GET "/api/resource/Offboarding%20Case?filters=%5B%5B%22primary_email%22%2C%22%3D%22%2C%22$encoded_email%22%5D%5D&fields=%5B%22name%22%5D&limit_page_length=0" | python3 -c "import sys,json; [print(c['name']) for c in json.load(sys.stdin).get('data',[])]" 2>/dev/null || true)
  for cas in $CASES; do
    FNDS=$(api GET "/api/resource/Finding?filters=%5B%5B%22case%22%2C%22%3D%22%2C%22$cas%22%5D%5D&fields=%5B%22name%22%5D&limit_page_length=0" | python3 -c "import sys,json; [print(f['name']) for f in json.load(sys.stdin).get('data',[])]" 2>/dev/null || true)
    for fnd in $FNDS; do
      delete_if_exists "Finding" "$fnd"
    done
    delete_if_exists "Offboarding Case" "$cas"
  done

  # Delete ALL employees with this email (handles duplicates from re-runs)
  EMPS=$(api GET "/api/resource/Employee?filters=%5B%5B%22company_email%22%2C%22%3D%22%2C%22$encoded_email%22%5D%5D&fields=%5B%22name%22%5D&limit_page_length=0" | python3 -c "import sys,json; [print(e['name']) for e in json.load(sys.stdin).get('data',[])]" 2>/dev/null || true)
  for emp in $EMPS; do
    delete_if_exists "Employee" "$emp"
  done
done
log "Cleanup complete."

# ── 2. Create fresh test employees (Active status) ──────────
log "Creating test employees..."
for entry in "${EMPLOYEES[@]}"; do
  IFS='|' read -r empid first last email dept desig <<< "$entry"
  # Replace Test_ prefix used for naming_series workaround
  first_clean=${first#Test_}
  RESULT=$(create_doc "Employee" "{
    \"name\": \"$empid\",
    \"naming_series\": \"HR-EMP-TEST-\",
    \"first_name\": \"$first_clean\",
    \"last_name\": \"$last\",
    \"company_email\": \"$email\",
    \"date_of_birth\": \"1990-01-15\",
    \"date_of_joining\": \"2023-06-01\",
    \"gender\": \"Prefer not to say\",
    \"status\": \"Active\",
    \"company\": \"HUB201\"
  }")
  if echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('name',''))" 2>/dev/null | grep -q "HR-EMP"; then
    log "  Created $first_clean $last ($email)"
  else
    warn "  Employee $empid may already exist or failed: $(echo "$RESULT" | head -c 200)"
  fi
done

# ── 3. Create Access Artifacts for test employees ────────────
log "Creating access artifacts..."

create_artifact() {
  local email=$1 atype=$2 app=$3 client_id=$4 risk=$5 scopes=$6
  create_doc "Access Artifact" "{
    \"artifact_type\": \"$atype\",
    \"subject_email\": \"$email\",
    \"status\": \"Active\",
    \"app_display_name\": \"$app\",
    \"client_id\": \"$client_id\",
    \"risk_level\": \"$risk\",
    \"scopes_json\": \"$scopes\"
  }" > /dev/null 2>&1
}

# Alex Rivera — 4 artifacts (heavy OAuth + ASP)
create_artifact "alex.rivera@testcorp.com" "OAuthToken" "Google Drive" "client-google-drive" "High" \
  '[\"https://www.googleapis.com/auth/drive\",\"https://www.googleapis.com/auth/drive.file\"]'
create_artifact "alex.rivera@testcorp.com" "OAuthToken" "GitHub" "client-github" "Critical" \
  '[\"https://www.googleapis.com/auth/admin.directory.user\",\"https://www.googleapis.com/auth/gmail.send\"]'
create_artifact "alex.rivera@testcorp.com" "OAuthToken" "Slack" "client-slack" "Medium" \
  '[\"https://www.googleapis.com/auth/gmail.readonly\",\"https://www.googleapis.com/auth/calendar\"]'
create_artifact "alex.rivera@testcorp.com" "ASP" "Thunderbird Mail" "" "Medium" '[]'
log "  Alex Rivera: 3 OAuth + 1 ASP"

# Maya Patel — 3 artifacts (OAuth + login)
create_artifact "maya.patel@testcorp.com" "OAuthToken" "Notion" "client-notion" "Low" \
  '[\"https://www.googleapis.com/auth/drive.readonly\"]'
create_artifact "maya.patel@testcorp.com" "OAuthToken" "Figma" "client-figma" "Medium" \
  '[\"https://www.googleapis.com/auth/userinfo.profile\",\"https://www.googleapis.com/auth/drive\"]'
create_artifact "maya.patel@testcorp.com" "OAuthToken" "Zoom" "client-zoom" "Low" \
  '[\"https://www.googleapis.com/auth/calendar\"]'
log "  Maya Patel: 3 OAuth"

# James O'Brien — 3 artifacts (admin-level access)
create_artifact "james.obrien@testcorp.com" "OAuthToken" "Salesforce" "client-salesforce" "High" \
  '[\"https://www.googleapis.com/auth/contacts\",\"https://www.googleapis.com/auth/gmail.send\"]'
create_artifact "james.obrien@testcorp.com" "OAuthToken" "Jira" "client-jira" "Medium" \
  '[\"https://www.googleapis.com/auth/calendar\",\"https://www.googleapis.com/auth/tasks\"]'
create_artifact "james.obrien@testcorp.com" "ASP" "Outlook Desktop" "" "Medium" '[]'
log "  James O'Brien: 2 OAuth + 1 ASP"

# Yuki Tanaka — 2 artifacts
create_artifact "yuki.tanaka@testcorp.com" "OAuthToken" "Google Drive" "client-google-drive" "High" \
  '[\"https://www.googleapis.com/auth/drive\",\"https://www.googleapis.com/auth/drive.appdata\"]'
create_artifact "yuki.tanaka@testcorp.com" "OAuthToken" "ChatGPT" "client-chatgpt" "Medium" \
  '[\"https://www.googleapis.com/auth/gmail.readonly\"]'
log "  Yuki Tanaka: 2 OAuth"

# Sofia Martinez — 3 artifacts (DevOps access)
create_artifact "sofia.martinez@testcorp.com" "OAuthToken" "GitHub" "client-github" "Critical" \
  '[\"https://www.googleapis.com/auth/cloud-platform\",\"https://www.googleapis.com/auth/admin.directory.user\"]'
create_artifact "sofia.martinez@testcorp.com" "OAuthToken" "Google Drive" "client-google-drive" "High" \
  '[\"https://www.googleapis.com/auth/drive\"]'
create_artifact "sofia.martinez@testcorp.com" "ASP" "K-9 Mail" "" "Low" '[]'
log "  Sofia Martinez: 2 OAuth + 1 ASP"

# ── 4. Update OGM Settings via bench (REST API doesn't persist checkboxes) ──
log "Updating OGM Settings for full automation..."
OAUTH_DIR="${OAUTH_MANAGEMENT_DIR:-/Users/igodju/Projects/oauth-management}"
DC_FILE="$OAUTH_DIR/.devcontainer/docker-compose.yml"
BENCH_CMD="cd /workspace/development/frappe-bench && PYENV_VERSION=3.12.12 bench --site development.localhost"

bench_set() {
  docker compose -f "$DC_FILE" exec -T frappe bash -c "$BENCH_CMD execute frappe.client.set_value --args='[\"OGM Settings\",\"OGM Settings\",\"$1\",$2]'" > /dev/null 2>&1
}

bench_set "auto_scan_on_offboard" "1"
bench_set "auto_remediate_on_offboard" "1"
bench_set "background_scan_enabled" "1"
bench_set "auto_create_case_on_leave" "1"
bench_set "background_scan_interval" '"Every 15 Minutes"'
bench_set "remediation_check_interval" '"Every 5 Minutes"'
bench_set "notify_on_new_findings" "1"
bench_set "notify_on_remediation" "1"
bench_set "notification_email" '"igordjuric404@gmail.com"'
bench_set "default_remediation_action" '"full_bundle"'
log "OGM Settings updated: all automation enabled."

# ── 5. Generate / retrieve API key ─────────────────────────────
log "Generating API key for Administrator..."
KEY_RESULT=$(api POST "/api/method/frappe.core.doctype.user.user.generate_keys" \
  -d '{"user":"Administrator"}')
API_KEY=$(echo "$KEY_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['message']['api_key'])" 2>/dev/null || echo "")
API_SECRET=$(echo "$KEY_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['message']['api_secret'])" 2>/dev/null || echo "")

if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
  err "Failed to generate API key. You may need to set them manually."
else
  log "API key generated."
fi

# ── 6. Update .env.local ────────────────────────────────────────
log "Updating $ENV_FILE..."
cat > "$ENV_FILE" <<ENVEOF
NEXT_PUBLIC_FRAPPE_URL=$FRAPPE_URL
NEXT_PUBLIC_APP_NAME=JML Management

# Frappe API credentials
FRAPPE_API_KEY=$API_KEY
FRAPPE_API_SECRET=$API_SECRET

# OpenRouter API key for AI chatbot
OPENROUTER_API_KEY=

# Resend API key for email notifications
RESEND_API_KEY=re_CBCLXGCX_Kzy1Fw4QMrB4HDYDJ534NPxc
NOTIFICATION_SENDER_EMAIL=onboarding@resend.dev
NOTIFICATION_RECIPIENT_EMAIL=igordjuric404@gmail.com
ENVEOF
log ".env.local updated (NEXT_PUBLIC_USE_MOCK removed, Frappe API credentials set)."

# ── Summary ────────────────────────────────────────────────────
echo ""
log "============================================"
log "  Test data repopulated successfully!"
log ""
log "  5 Active employees with OAuth/ASP access:"
log "    - Alex Rivera    (alex.rivera@testcorp.com)    4 artifacts"
log "    - Maya Patel     (maya.patel@testcorp.com)     3 artifacts"
log "    - James O'Brien  (james.obrien@testcorp.com)   3 artifacts"
log "    - Yuki Tanaka    (yuki.tanaka@testcorp.com)    2 artifacts"
log "    - Sofia Martinez (sofia.martinez@testcorp.com)  3 artifacts"
log ""
log "  OGM Settings: all automation ON"
log "  API Key: $API_KEY"
log ""
log "  To test offboarding:"
log "    1. Go to $FRAPPE_URL/app/employee/HR-EMP-TEST-01"
log "    2. Change status to 'Left', set relieving date, save"
log "    3. OGM will auto-create case, scan, and remediate"
log "    4. Check JML dashboard at http://localhost:3000"
log "============================================"
