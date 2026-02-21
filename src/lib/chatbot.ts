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
}

const DOCS_KNOWLEDGE: Record<string, DocEntry> = {
  overview: {
    id: "overview",
    title: "OGM Overview",
    keywords: ["overview", "what is", "ogm", "oauth gap monitor", "purpose", "about", "jml"],
    content:
      "OGM (OAuth Gap Monitor) is a post-offboarding access and OAuth gap monitor for Google Workspace. " +
      "It detects lingering OAuth tokens, ASPs, post-offboarding logins, admin MFA gaps, and DWD risks. " +
      "Main URL: /dashboard. Key pages: Dashboard (/dashboard), Cases (/cases), " +
      "Employees (/employees), OAuth Apps (/apps), Findings (/findings), " +
      "Artifacts (/artifacts), Scan History (/scan-history), " +
      "Audit Log (/audit-log), Settings (/settings), Docs (/docs).",
  },
  remediation: {
    id: "remediation",
    title: "Remediation Actions",
    keywords: ["remediate", "revoke", "delete", "sign out", "fix", "resolve", "bundle", "action"],
    content:
      "Remediation actions: 1) Revoke All OAuth Grants (tokens.delete), 2) Delete All ASPs (asps.delete), " +
      "3) Sign Out User Everywhere (users.signOut), 4) Full Remediation Bundle (all of the above + close findings). " +
      "Available from: case detail page (/cases/{id}), employee page (/employees), artifact list (/artifacts), " +
      "app dashboard (/apps). After any remediation, case status updates automatically.",
  },
  findings: {
    id: "findings",
    title: "Finding Types",
    keywords: ["finding", "issue", "vulnerability", "gap", "security", "type", "severity"],
    content:
      "Finding types: LingeringOAuthGrant (active tokens), LingeringASP (active passwords), " +
      "PostOffboardLogin (login after leaving), PostOffboardSuspiciousLogin (suspicious login), " +
      "OffboardingNotEnforced (account not suspended), AdminMFAWeak (admin without 2SV), " +
      "DWDHighRisk (dangerous domain-wide delegation). Severities: Low, Medium, High, Critical. " +
      "URL: /findings.",
  },
  scanning: {
    id: "scanning",
    title: "Scanning",
    keywords: ["scan", "rescan", "discover", "detect", "hidden", "background", "system scan"],
    content:
      "System Scan: triggered from the Dashboard (/dashboard) via the 'Scan System' button. " +
      "Discovers hidden leftover access across ALL offboarded employees — tokens, ASPs, logins. " +
      "Auto-creates cases for new discoveries. Background scan runs on the configured interval " +
      "(if enabled in Settings). Scan history at /scan-history.",
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
  },
  cases: {
    id: "offboarding-case",
    title: "Offboarding Cases",
    keywords: ["case", "offboarding", "status", "draft", "gaps found", "remediated", "all clear"],
    content:
      "Offboarding Cases track user access reviews. Status flow: Draft → (scan) → All Clear or Gaps Found → " +
      "(remediate) → Remediated → Closed. Can also be Scheduled. Fields: primary_email, employee, event_type, " +
      "effective_date, status, scheduled_remediation_date. URL: /cases. Detail: /cases/{id}.",
  },
  artifacts: {
    id: "artifacts",
    title: "Access Artifacts",
    keywords: ["artifact", "token", "asp", "login", "access", "oauth", "stored"],
    content:
      "Access Artifacts: OAuthToken (third-party OAuth grant), ASP (app-specific password), " +
      "LoginEvent (login record), AdminMFA (MFA status), DWDChange (domain delegation event). " +
      "Status: Hidden → (system scan) → Active → Revoked/Deleted/Acknowledged. " +
      "You can access and manage them at /artifacts.",
  },
  employees: {
    id: "employees",
    title: "Employee Management",
    keywords: ["employee", "user", "staff", "people", "hr", "who"],
    content:
      "Employee Access Overview at /employees. Lists all employees with case/artifact/finding counts. " +
      "Per-employee detail: info, KPIs, apps used, findings with remediate buttons, cases with resolve buttons. " +
      "Bulk revoke: select employees and revoke all tokens or ASPs.",
  },
  apps: {
    id: "apps",
    title: "OAuth Applications",
    keywords: ["app", "application", "oauth", "slack", "notion", "client", "grant"],
    content:
      "OAuth App Dashboard at /apps. Lists all apps with grant counts. " +
      "Per-app detail: users with grants, scopes, risk levels. Per-user revoke or global revoke.",
  },
  audit: {
    id: "audit-log",
    title: "Audit Log",
    keywords: ["audit", "log", "history", "trail", "who", "when", "action", "track"],
    content:
      "Unified Audit Log at /audit-log. Records all OGM actions: scans, remediations, " +
      "case creation. Fields: actor_user, action_type, target_email, result, remediation_type " +
      "(manual/automatic/scheduler), timestamp.",
  },
  navigation: {
    id: "navigation",
    title: "Navigation Guide",
    keywords: ["where", "find", "navigate", "page", "url", "go to", "how to get", "located", "stored"],
    content:
      "Dashboard: /dashboard. Cases: /cases. Employees: /employees. " +
      "Apps: /apps. Findings: /findings. Artifacts: /artifacts. " +
      "Scan History: /scan-history. Audit Log: /audit-log. " +
      "Settings: /settings. Docs: /docs. All accessible from the sidebar navigation.",
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

type ScoredDoc = [score: number, key: string, doc: DocEntry];

export function searchKnowledge(query: string): ScoredDoc[] {
  const lower = query.toLowerCase();
  const scored: ScoredDoc[] = [];

  for (const [key, doc] of Object.entries(DOCS_KNOWLEDGE)) {
    let score = 0;
    for (const kw of doc.keywords) {
      if (lower.includes(kw)) score += 2;
    }
    const words = lower.match(/\w+/g) ?? [];
    for (const w of words) {
      if (doc.content.toLowerCase().includes(w)) score += 1;
    }
    if (score > 0) scored.push([score, key, doc]);
  }

  scored.sort((a, b) => b[0] - a[0]);
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
    let answer = top.content;
    if (needsLiveData(message) && liveData) {
      answer = liveData + "\n\n" + answer;
    }
    return { reply: answer, sources: buildSources(relevant) };
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
