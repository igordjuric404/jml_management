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
# Active employees (to be offboarded for testing)
EMPLOYEES=(
  "HR-EMP-TEST-01|Test_Alex|Rivera|alex.rivera@testcorp.com|Engineering|Senior Backend Developer"
  "HR-EMP-TEST-02|Test_Maya|Patel|maya.patel@testcorp.com|Product|Product Manager"
  "HR-EMP-TEST-03|Test_James|O'Brien|james.obrien@testcorp.com|Security|Security Analyst"
  "HR-EMP-TEST-04|Test_Yuki|Tanaka|yuki.tanaka@testcorp.com|Data|Data Engineer"
  "HR-EMP-TEST-05|Test_Sofia|Martinez|sofia.martinez@testcorp.com|DevOps|DevOps Lead"
)

# Left employees (already offboarded, with lingering access for dashboard testing)
LEFT_EMPLOYEES=(
  "HR-EMP-TEST-L1|Test_Carlos|Mendez|carlos.mendez@testcorp.com|Engineering|Staff Engineer"
  "HR-EMP-TEST-L2|Test_Nina|Kowalski|nina.kowalski@testcorp.com|Finance|Finance Manager"
  "HR-EMP-TEST-L3|Test_Raj|Sharma|raj.sharma@testcorp.com|IT|IT Admin"
)

# ── 0. Remove stale employees from previous repopulate.py runs ──
log "Removing old repopulate.py employees..."
OLD_EMAILS=$(api GET "/api/resource/Employee?filters=%5B%5B%22company_email%22%2C%22like%22%2C%22%25%40example.com%22%5D%2C%5B%22status%22%2C%22%3D%22%2C%22Left%22%5D%5D&fields=%5B%22name%22%2C%22company_email%22%5D&limit_page_length=0" \
  | python3 -c "import sys,json; [print(e['name']+'|'+e['company_email']) for e in json.load(sys.stdin).get('data',[])]" 2>/dev/null || true)
for row in $OLD_EMAILS; do
  IFS='|' read -r emp_name emp_email <<< "$row"
  encoded_email=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$emp_email'))")
  # Delete artifacts
  for art in $(api GET "/api/resource/Access%20Artifact?filters=%5B%5B%22subject_email%22%2C%22%3D%22%2C%22$encoded_email%22%5D%5D&fields=%5B%22name%22%5D&limit_page_length=0" | python3 -c "import sys,json; [print(a['name']) for a in json.load(sys.stdin).get('data',[])]" 2>/dev/null || true); do
    delete_if_exists "Access Artifact" "$art"
  done
  # Delete cases and findings
  for cas in $(api GET "/api/resource/Offboarding%20Case?filters=%5B%5B%22primary_email%22%2C%22%3D%22%2C%22$encoded_email%22%5D%5D&fields=%5B%22name%22%5D&limit_page_length=0" | python3 -c "import sys,json; [print(c['name']) for c in json.load(sys.stdin).get('data',[])]" 2>/dev/null || true); do
    for fnd in $(api GET "/api/resource/Finding?filters=%5B%5B%22case%22%2C%22%3D%22%2C%22$cas%22%5D%5D&fields=%5B%22name%22%5D&limit_page_length=0" | python3 -c "import sys,json; [print(f['name']) for f in json.load(sys.stdin).get('data',[])]" 2>/dev/null || true); do
      delete_if_exists "Finding" "$fnd"
    done
    delete_if_exists "Offboarding Case" "$cas"
  done
  delete_if_exists "Employee" "$emp_name"
  log "  Removed $emp_name ($emp_email)"
done

# ── 1. Clean up old test data (by email, handles Frappe auto-naming) ──
log "Cleaning up old test data..."
ALL_EMPLOYEES=("${EMPLOYEES[@]}" "${LEFT_EMPLOYEES[@]}")
for entry in "${ALL_EMPLOYEES[@]}"; do
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

# ── 2b. Create Left employees ─────────────────────────────────
log "Creating Left test employees..."
RELIEVING_DATE=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)
for entry in "${LEFT_EMPLOYEES[@]}"; do
  IFS='|' read -r empid first last email dept desig <<< "$entry"
  first_clean=${first#Test_}
  RESULT=$(create_doc "Employee" "{
    \"name\": \"$empid\",
    \"naming_series\": \"HR-EMP-TEST-\",
    \"first_name\": \"$first_clean\",
    \"last_name\": \"$last\",
    \"company_email\": \"$email\",
    \"date_of_birth\": \"1988-05-20\",
    \"date_of_joining\": \"2021-03-01\",
    \"gender\": \"Prefer not to say\",
    \"status\": \"Left\",
    \"relieving_date\": \"$RELIEVING_DATE\",
    \"company\": \"HUB201\"
  }")
  if echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('name',''))" 2>/dev/null | grep -q "HR-EMP"; then
    log "  Created $first_clean $last ($email) [Left]"
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

# ── 3b. Create Offboarding Cases, Artifacts, Findings for Left employees ──
log "Creating cases and artifacts for Left employees..."

create_case() {
  local emp_id=$1 email=$2 emp_name=$3
  local encoded; encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('Offboarding Case'))")
  local result
  result=$(api POST "/api/resource/$encoded" -d "{
    \"employee\": \"$emp_id\",
    \"primary_email\": \"$email\",
    \"employee_name\": \"$emp_name\",
    \"event_type\": \"Offboard\",
    \"effective_date\": \"$RELIEVING_DATE\",
    \"status\": \"Gaps Found\"
  }")
  echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('name',''))" 2>/dev/null
}

create_finding() {
  local case_name=$1 ftype=$2 severity=$3 summary=$4
  local encoded; encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('Finding'))")
  api POST "/api/resource/$encoded" -d "{
    \"case\": \"$case_name\",
    \"finding_type\": \"$ftype\",
    \"severity\": \"$severity\",
    \"summary\": \"$summary\",
    \"recommended_action\": \"Review and remediate this access.\"
  }" > /dev/null 2>&1
}

create_linked_artifact() {
  local email=$1 atype=$2 app=$3 client_id=$4 risk=$5 case_name=$6
  local metadata="${7:-}"
  local encoded; encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('Access Artifact'))")
  api POST "/api/resource/$encoded" -d "{
    \"artifact_type\": \"$atype\",
    \"subject_email\": \"$email\",
    \"status\": \"Active\",
    \"app_display_name\": \"$app\",
    \"client_id\": \"$client_id\",
    \"risk_level\": \"$risk\",
    \"case\": \"$case_name\"${metadata:+, \"metadata_json\": \"$metadata\"}
  }" > /dev/null 2>&1
}

# Carlos Mendez — Left, 3 OAuth tokens, 1 ASP, 1 post-offboard login
CARLOS_EMP=$(api GET "/api/resource/Employee?filters=%5B%5B%22company_email%22%2C%22%3D%22%2C%22carlos.mendez%40testcorp.com%22%5D%5D&fields=%5B%22name%22%5D&limit_page_length=1" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d[0]['name'] if d else '')" 2>/dev/null)
CARLOS_CASE=$(create_case "$CARLOS_EMP" "carlos.mendez@testcorp.com" "Carlos Mendez")
if [ -n "$CARLOS_CASE" ]; then
  create_linked_artifact "carlos.mendez@testcorp.com" "OAuthToken" "Google Drive" "client-google-drive" "High" "$CARLOS_CASE"
  create_linked_artifact "carlos.mendez@testcorp.com" "OAuthToken" "GitHub" "client-github" "Critical" "$CARLOS_CASE"
  create_linked_artifact "carlos.mendez@testcorp.com" "OAuthToken" "Slack" "client-slack" "Medium" "$CARLOS_CASE"
  create_linked_artifact "carlos.mendez@testcorp.com" "ASP" "Thunderbird Mail" "" "Medium" "$CARLOS_CASE"
  create_linked_artifact "carlos.mendez@testcorp.com" "LoginEvent" "Google Login" "" "High" "$CARLOS_CASE" \
    '{\"ip\":\"203.0.113.77\",\"login_time\":\"2026-02-18T14:30:00\",\"user_agent\":\"Chrome/122\"}'
  create_finding "$CARLOS_CASE" "LingeringOAuthGrant" "Critical" "OAuth grant for GitHub with admin scope persists after offboarding."
  create_finding "$CARLOS_CASE" "LingeringOAuthGrant" "High" "OAuth grant for Google Drive with full drive access."
  create_finding "$CARLOS_CASE" "LingeringASP" "Medium" "App-Specific Password for Thunderbird still active."
  create_finding "$CARLOS_CASE" "PostOffboardLogin" "High" "Post-offboard login detected from IP 203.0.113.77 via Chrome."
  log "  Carlos Mendez: case=$CARLOS_CASE, 5 artifacts, 4 findings (incl. post-offboard login)"
fi

# Nina Kowalski — Left, 2 OAuth tokens, 1 post-offboard login
NINA_EMP=$(api GET "/api/resource/Employee?filters=%5B%5B%22company_email%22%2C%22%3D%22%2C%22nina.kowalski%40testcorp.com%22%5D%5D&fields=%5B%22name%22%5D&limit_page_length=1" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d[0]['name'] if d else '')" 2>/dev/null)
NINA_CASE=$(create_case "$NINA_EMP" "nina.kowalski@testcorp.com" "Nina Kowalski")
if [ -n "$NINA_CASE" ]; then
  create_linked_artifact "nina.kowalski@testcorp.com" "OAuthToken" "Salesforce" "client-salesforce" "High" "$NINA_CASE"
  create_linked_artifact "nina.kowalski@testcorp.com" "OAuthToken" "Notion" "client-notion" "Low" "$NINA_CASE"
  create_linked_artifact "nina.kowalski@testcorp.com" "LoginEvent" "Google Login" "" "High" "$NINA_CASE" \
    '{\"ip\":\"198.51.100.42\",\"login_time\":\"2026-02-19T09:15:00\",\"user_agent\":\"Firefox/121\"}'
  create_finding "$NINA_CASE" "LingeringOAuthGrant" "High" "OAuth grant for Salesforce with contacts access persists."
  create_finding "$NINA_CASE" "PostOffboardLogin" "High" "Post-offboard login detected from IP 198.51.100.42 via Firefox."
  log "  Nina Kowalski: case=$NINA_CASE, 3 artifacts, 2 findings (incl. post-offboard login)"
fi

# Raj Sharma — Left, 2 OAuth tokens, 1 ASP (IT admin — high risk)
RAJ_EMP=$(api GET "/api/resource/Employee?filters=%5B%5B%22company_email%22%2C%22%3D%22%2C%22raj.sharma%40testcorp.com%22%5D%5D&fields=%5B%22name%22%5D&limit_page_length=1" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d[0]['name'] if d else '')" 2>/dev/null)
RAJ_CASE=$(create_case "$RAJ_EMP" "raj.sharma@testcorp.com" "Raj Sharma")
if [ -n "$RAJ_CASE" ]; then
  create_linked_artifact "raj.sharma@testcorp.com" "OAuthToken" "Google Drive" "client-google-drive" "High" "$RAJ_CASE"
  create_linked_artifact "raj.sharma@testcorp.com" "OAuthToken" "Jira" "client-jira" "Medium" "$RAJ_CASE"
  create_linked_artifact "raj.sharma@testcorp.com" "ASP" "Outlook Desktop" "" "Medium" "$RAJ_CASE"
  create_finding "$RAJ_CASE" "LingeringOAuthGrant" "High" "OAuth grant for Google Drive with full drive access from former IT admin."
  create_finding "$RAJ_CASE" "LingeringASP" "Medium" "ASP for Outlook Desktop still active after offboarding."
  log "  Raj Sharma: case=$RAJ_CASE, 3 artifacts, 2 findings"
fi

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
NOTIFICATION_SENDER_EMAIL=offboarding@resend.dev
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
log "  3 Left employees with cases, artifacts, and findings:"
log "    - Carlos Mendez  (carlos.mendez@testcorp.com)  5 arts, 4 findings, 1 post-offboard login"
log "    - Nina Kowalski  (nina.kowalski@testcorp.com)  3 arts, 2 findings, 1 post-offboard login"
log "    - Raj Sharma     (raj.sharma@testcorp.com)     3 arts, 2 findings"
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
