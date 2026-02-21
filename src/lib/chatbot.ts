/**
 * Knowledge-based chatbot module.
 *
 * Mirrors the legacy Frappe chatbot architecture: curated DOCS_KNOWLEDGE,
 * keyword search, optional OpenRouter LLM, and concise navigational fallback.
 * Keeps API keys server-side.
 */

/* ------------------------------------------------------------------ */
/*  Knowledge base                                                     */
/* ------------------------------------------------------------------ */

interface DocEntry {
  id: string;
  title: string;
  keywords: string[];
  content: string;
  answer: string;
}

const DOCS_KNOWLEDGE: Record<string, DocEntry> = {
  overview: {
    id: "overview",
    title: "OGM Overview",
    keywords: ["overview", "what is ogm", "oauth gap monitor", "purpose", "jml management"],
    content:
      "OGM (OAuth Gap Monitor) is a post-offboarding access and OAuth gap monitor for Google Workspace. " +
      "It detects lingering OAuth tokens, ASPs, post-offboarding logins, admin MFA gaps, and DWD risks. " +
      "Main URL: /dashboard. Key pages: Dashboard (/dashboard), Cases (/cases), " +
      "Employees (/employees), OAuth Apps (/apps), Findings (/findings), " +
      "Artifacts (/artifacts), Scan History (/scan-history), " +
      "Audit Log (/audit-log), Settings (/settings), Docs (/docs).",
    answer:
      "OGM (OAuth Gap Monitor) is a post-offboarding security tool for Google Workspace. " +
      "It detects lingering OAuth tokens, app-specific passwords, suspicious logins, and other access gaps " +
      "after employees leave. You can get started from the [Dashboard](/dashboard).",
  },
  remediation: {
    id: "remediation",
    title: "Remediation Actions",
    keywords: ["remediate", "revoke", "delete", "sign out", "fix", "resolve", "bundle"],
    content:
      "Remediation actions: 1) Revoke All OAuth Grants (tokens.delete), 2) Delete All ASPs (asps.delete), " +
      "3) Sign Out User Everywhere (users.signOut), 4) Full Remediation Bundle (all of the above + close findings). " +
      "Available from: case detail page (/cases/{id}), employee page (/employees), artifact list (/artifacts), " +
      "app dashboard (/apps). After any remediation, case status updates automatically.",
    answer:
      "Remediation lets you revoke lingering access for offboarded employees. " +
      "Actions include revoking OAuth grants, deleting ASPs, signing out sessions, " +
      "or running a Full Bundle that does all three and closes findings. " +
      "You can trigger remediation from any case detail page under [Cases](/cases).",
  },
  findings: {
    id: "findings",
    title: "Finding Types",
    keywords: ["finding", "issue", "vulnerability", "gap", "severity"],
    content:
      "Finding types: LingeringOAuthGrant (active tokens), LingeringASP (active passwords), " +
      "PostOffboardLogin (login after leaving), PostOffboardSuspiciousLogin (suspicious login), " +
      "OffboardingNotEnforced (account not suspended), AdminMFAWeak (admin without 2SV), " +
      "DWDHighRisk (dangerous domain-wide delegation). Severities: Low, Medium, High, Critical. " +
      "URL: /findings.",
    answer:
      "Findings are security issues discovered during scans. Types include lingering OAuth grants, " +
      "lingering ASPs, post-offboard logins, weak admin MFA, and risky domain-wide delegation. " +
      "Each finding has a severity (Low, Medium, High, or Critical). " +
      "You can review and remediate them on the [Findings](/findings) page.",
  },
  scanning: {
    id: "scanning",
    title: "Scanning",
    keywords: ["scan", "rescan", "discover", "detect", "hidden", "system scan"],
    content:
      "System Scan: triggered from the Dashboard (/dashboard) via the 'Scan System' button. " +
      "Discovers hidden leftover access across ALL offboarded employees — tokens, ASPs, logins. " +
      "Auto-creates cases for new discoveries. Background scan runs on the configured interval " +
      "(if enabled in Settings). Scan history at /scan-history.",
    answer:
      "You can run a System Scan from the [Dashboard](/dashboard) to discover hidden leftover access " +
      "across all offboarded employees. It automatically creates cases for any new discoveries. " +
      "Background scanning can also be enabled in [Settings](/settings). View past scans under [Scan History](/scan-history).",
  },
  automation: {
    id: "automation",
    title: "Automation & Settings",
    keywords: ["automatic", "auto", "setting", "config", "toggle", "schedule", "background", "interval"],
    content:
      "Settings at /settings: Auto-Scan on Offboarding (off by default), " +
      "Auto-Remediate on Offboarding (off), Background Scanning (on), " +
      "Auto-Create Case on Employee Leave (on). Scheduled remediations check every 5 minutes. " +
      "Notifications for 7-day and 1-day reminders.",
    answer:
      "You can configure automation on the [Settings](/settings) page. Options include auto-scan on offboarding, " +
      "auto-remediation, background scanning, and automatic case creation when employees leave. " +
      "Notification reminders are sent at 7-day and 1-day intervals.",
  },
  cases: {
    id: "offboarding-case",
    title: "Offboarding Cases",
    keywords: ["case", "offboarding", "draft", "gaps found", "remediated", "all clear"],
    content:
      "Offboarding Cases track user access reviews. Status flow: Draft → (scan) → All Clear or Gaps Found → " +
      "(remediate) → Remediated → Closed. Can also be Scheduled. Fields: primary_email, employee, event_type, " +
      "effective_date, status, scheduled_remediation_date. URL: /cases. Detail: /cases/{id}.",
    answer:
      "Offboarding Cases track the access review process for departing employees. " +
      "They follow a status flow: Draft → All Clear or Gaps Found → Remediated → Closed. " +
      "You can view and manage all cases on the [Cases](/cases) page.",
  },
  artifacts: {
    id: "artifacts",
    title: "Access Artifacts",
    keywords: ["artifact", "token", "asp", "login event", "access artifact", "oauth token"],
    content:
      "Access Artifacts: OAuthToken (third-party OAuth grant), ASP (app-specific password), " +
      "LoginEvent (login record), AdminMFA (MFA status), DWDChange (domain delegation event). " +
      "Status: Hidden → (system scan) → Active → Revoked/Deleted/Acknowledged. " +
      "You can access and manage them at /artifacts.",
    answer:
      "The artifacts are stored within the OAuth Gap Monitor system. " +
      "You can access and manage them on the [Artifacts](/artifacts) page. " +
      "The artifact types are OAuthToken, ASP, LoginEvent, AdminMFA, and DWDChange.",
  },
  employees: {
    id: "employees",
    title: "Employee Management",
    keywords: ["employee", "staff", "people", "personnel"],
    content:
      "Employee Access Overview at /employees. Lists all employees with case/artifact/finding counts. " +
      "Per-employee detail: info, KPIs, apps used, findings with remediate buttons, cases with resolve buttons. " +
      "Bulk revoke: select employees and revoke all tokens or ASPs.",
    answer:
      "You can view all employees and their access status on the [Employees](/employees) page. " +
      "Each employee shows their cases, artifacts, findings, and apps used, " +
      "with options to remediate directly. Bulk revoke is also available.",
  },
  apps: {
    id: "apps",
    title: "OAuth Applications",
    keywords: ["app", "application", "oauth app", "slack", "notion", "client", "grant"],
    content:
      "OAuth App Dashboard at /apps. Lists all apps with grant counts. " +
      "Per-app detail: users with grants, scopes, risk levels. Per-user revoke or global revoke.",
    answer:
      "You can see all your OAuth apps on the [Apps](/apps) page. " +
      "It lists every third-party application with active grants, " +
      "showing user counts and scopes. You can revoke access per-user or globally.",
  },
  audit: {
    id: "audit-log",
    title: "Audit Log",
    keywords: ["audit", "log", "trail", "action history"],
    content:
      "Unified Audit Log at /audit-log. Records all OGM actions: scans, remediations, " +
      "case creation. Fields: actor_user, action_type, target_email, result, remediation_type " +
      "(manual/automatic/scheduler), timestamp.",
    answer:
      "The Audit Log records every action in the system — scans, remediations, and case changes. " +
      "You can review the full history on the [Audit Log](/audit-log) page.",
  },
  navigation: {
    id: "navigation",
    title: "Navigation Guide",
    keywords: ["navigate", "page", "url", "sidebar", "menu"],
    content:
      "Dashboard: /dashboard. Cases: /cases. Employees: /employees. " +
      "Apps: /apps. Findings: /findings. Artifacts: /artifacts. " +
      "Scan History: /scan-history. Audit Log: /audit-log. " +
      "Settings: /settings. Docs: /docs. All accessible from the sidebar navigation.",
    answer:
      "All pages are accessible from the sidebar. Key areas: " +
      "[Dashboard](/dashboard), [Cases](/cases), [Employees](/employees), [Apps](/apps), [Findings](/findings), " +
      "[Artifacts](/artifacts), [Audit Log](/audit-log), and [Settings](/settings).",
  },
};

/* ------------------------------------------------------------------ */
/*  Keyword helpers                                                    */
/* ------------------------------------------------------------------ */

const DATA_KEYWORDS = [
  "how many", "count", "number", "total", "active", "open", "status",
  "statistics", "stat", "finding", "artifact", "case", "critical",
  "remediated", "pending", "hidden",
];

const NAV_KEYWORDS = ["where", "find", "navigate", "go to", "how to get", "located", "stored", "page", "url"];

function isNavigational(message: string): boolean {
  const lower = message.toLowerCase();
  return NAV_KEYWORDS.some((kw) => lower.includes(kw));
}

export function needsLiveData(message: string): boolean {
  if (isNavigational(message)) return false;
  const lower = message.toLowerCase();
  return DATA_KEYWORDS.some((kw) => lower.includes(kw));
}

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "i", "me", "my",
  "we", "our", "you", "your", "he", "she", "it", "they", "them",
  "this", "that", "these", "those", "am", "or", "and", "but", "if",
  "not", "no", "so", "up", "out", "on", "off", "in", "to", "at",
  "of", "for", "by", "with", "from", "as", "into", "about", "how",
  "what", "which", "who", "whom", "when", "where", "why", "all",
  "each", "any", "both", "more", "most", "some", "such", "than",
  "too", "very", "just", "also", "there", "here", "then",
]);

const GENERIC_KEYS = new Set(["navigation", "overview"]);

type ScoredDoc = [score: number, key: string, doc: DocEntry];

export function searchKnowledge(query: string): ScoredDoc[] {
  const lower = query.toLowerCase();
  const scored: ScoredDoc[] = [];
  let hasSpecificKeywordHit = false;

  for (const [key, doc] of Object.entries(DOCS_KNOWLEDGE)) {
    let score = 0;
    let keywordHit = false;
    for (const kw of doc.keywords) {
      if (lower.includes(kw)) {
        score += 10;
        keywordHit = true;
      }
    }
    const words = (lower.match(/\w+/g) ?? []).filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
    for (const w of words) {
      if (doc.content.toLowerCase().includes(w)) score += 1;
    }
    if (score > 0) {
      scored.push([score, key, doc]);
      if (keywordHit && !GENERIC_KEYS.has(key)) hasSpecificKeywordHit = true;
    }
  }

  scored.sort((a, b) => b[0] - a[0]);

  if (hasSpecificKeywordHit && scored.length >= 2 && GENERIC_KEYS.has(scored[0][1])) {
    const idx = scored.findIndex(([, k]) => !GENERIC_KEYS.has(k));
    if (idx > 0) {
      const [item] = scored.splice(idx, 1);
      scored.unshift(item);
    }
  }

  return scored.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/*  Live data (mock)                                                   */
/* ------------------------------------------------------------------ */

export interface LiveDataProvider {
  getCaseCounts(): Promise<Record<string, number>>;
  getTotalCases(): Promise<number>;
  getOpenFindings(): Promise<number>;
  getTotalFindings(): Promise<number>;
  getCriticalFindings(): Promise<number>;
  getActiveArtifacts(): Promise<number>;
  getTotalArtifacts(): Promise<number>;
  getHiddenArtifacts(): Promise<number>;
  getOffboardedEmployees(): Promise<number>;
}

export async function getLiveDataString(provider: LiveDataProvider): Promise<string> {
  try {
    const [totalCases, caseCounts, totalFindings, openFindings, criticalFindings,
      totalArtifacts, activeArtifacts, hiddenArtifacts, employees] = await Promise.all([
      provider.getTotalCases(),
      provider.getCaseCounts(),
      provider.getTotalFindings(),
      provider.getOpenFindings(),
      provider.getCriticalFindings(),
      provider.getTotalArtifacts(),
      provider.getActiveArtifacts(),
      provider.getHiddenArtifacts(),
      provider.getOffboardedEmployees(),
    ]);

    const closedFindings = totalFindings - openFindings;
    const statusParts = Object.entries(caseCounts).map(([s, n]) => `${s}: ${n}`).join(", ");

    return (
      `LIVE DATABASE: ${totalCases} total cases (${statusParts}). ` +
      `${totalFindings} total findings (${openFindings} open, ${closedFindings} closed, ` +
      `${criticalFindings} critical open). ` +
      `${totalArtifacts} total artifacts (${activeArtifacts} active, ${hiddenArtifacts} hidden/undiscovered). ` +
      `${employees} offboarded employees.`
    );
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Source building                                                     */
/* ------------------------------------------------------------------ */

interface ChatSource {
  title: string;
  url: string;
}

const DOC_ID_TO_URL: Record<string, string> = {
  overview: "/dashboard",
  remediation: "/cases",
  findings: "/findings",
  scanning: "/scan-history",
  automation: "/settings",
  "offboarding-case": "/cases",
  artifacts: "/artifacts",
  employees: "/employees",
  apps: "/apps",
  "audit-log": "/audit-log",
  navigation: "/dashboard",
};

function buildSources(relevant: ScoredDoc[]): ChatSource[] {
  return relevant.map(([, , doc]) => ({
    title: doc.title,
    url: DOC_ID_TO_URL[doc.id] || "/dashboard",
  }));
}

/* ------------------------------------------------------------------ */
/*  Local (no-LLM) answer                                              */
/* ------------------------------------------------------------------ */

export function localAnswer(
  message: string,
  relevant: ScoredDoc[],
  liveData?: string,
): { reply: string; sources: ChatSource[] } {
  if (relevant.length > 0) {
    const top = relevant[0][2];
    let reply = top.answer;
    if (needsLiveData(message) && liveData) {
      reply = liveData + "\n\n" + reply;
    }
    return { reply, sources: buildSources(relevant) };
  }

  return {
    reply:
      "I can help with questions about OGM. Try asking about: " +
      "findings, remediation, scanning, automation, cases, employees, " +
      "artifacts, navigation, or the audit log.",
    sources: [
      { title: "Dashboard", url: "/dashboard" },
      { title: "Documentation", url: "/docs" },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  OpenRouter LLM call                                                */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT =
  "You are the OGM Help Assistant. Answer questions about the OAuth Gap Monitor system. " +
  "Be concise (2-4 sentences max). Include relevant URLs when helpful (use format /page-name like /artifacts, /cases, /findings). " +
  "If LIVE DATABASE data is provided, use those exact numbers. Only answer based on provided context.";

export async function chatWithLLM(
  message: string,
  context: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Context:\n${context}\n\nQuestion: ${message}` },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Main chat entry point                                              */
/* ------------------------------------------------------------------ */

export interface ChatResult {
  reply: string;
  sources: ChatSource[];
}

export async function chat(
  message: string,
  opts?: {
    apiKey?: string;
    liveDataProvider?: LiveDataProvider;
  },
): Promise<ChatResult> {
  if (!message || message.trim().length < 2) {
    return { reply: "Please ask a question about the OGM system.", sources: [] };
  }

  const relevant = searchKnowledge(message);

  const contextParts: string[] = [];

  let liveData: string | undefined;
  if (needsLiveData(message) && opts?.liveDataProvider) {
    liveData = await getLiveDataString(opts.liveDataProvider);
    if (liveData) contextParts.push(liveData);
  }

  if (relevant.length > 0) {
    for (const [, , doc] of relevant) {
      contextParts.push(`[${doc.title}]: ${doc.content}`);
    }
  } else {
    contextParts.push(DOCS_KNOWLEDGE.overview.content);
    contextParts.push(DOCS_KNOWLEDGE.navigation.content);
  }

  const context = contextParts.join("\n\n");
  const sources = buildSources(relevant);

  if (opts?.apiKey) {
    const llmReply = await chatWithLLM(message, context, opts.apiKey);
    if (llmReply) return { reply: llmReply, sources };
  }

  return localAnswer(message, relevant, liveData);
}
