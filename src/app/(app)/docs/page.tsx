"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  AlertTriangle,
  Shield,
  FileText,
  Wrench,
  Plug,
  ChevronRight,
  BookOpen,
} from "lucide-react";

const sections = [
  {
    id: "architecture",
    title: "Architecture",
    icon: LayoutDashboard,
    description: "System components, DocTypes, and data flow",
    subsections: ["Overview", "DocTypes", "Data Flow", "Deployment"],
  },
  {
    id: "findings",
    title: "Findings",
    icon: AlertTriangle,
    description: "Policy violations, severity levels, and finding types",
    subsections: ["Finding Types", "Severity Levels", "Evidence", "Lifecycle"],
  },
  {
    id: "access-artifacts",
    title: "Access Artifacts",
    icon: Shield,
    description: "OAuth tokens, ASPs, login events, and risk assessment",
    subsections: ["Artifact Types", "Risk Levels", "Scopes", "Discovery"],
  },
  {
    id: "audit-log",
    title: "Audit Log",
    icon: FileText,
    description: "Immutable event records and action tracking",
    subsections: ["Action Types", "Entries", "Filtering"],
  },
  {
    id: "remediation",
    title: "Remediation",
    icon: Wrench,
    description: "Automated and manual remediation workflows",
    subsections: ["Full Bundle", "Standalone Actions", "Scheduling", "Bulk Operations"],
  },
  {
    id: "integrations",
    title: "Integrations",
    icon: Plug,
    description: "HRMS, Google Workspace, Frappe Scheduler",
    subsections: ["HRMS Employee", "Google Workspace", "Frappe Scheduler", "Webhooks"],
  },
];

type SectionId = (typeof sections)[number]["id"];

const sectionContent: Record<SectionId, Record<string, React.ReactNode>> = {
  architecture: {
    Overview: (
      <>
        <p>
          The OAuth Gap Monitor (OGM) is a decoupled system designed to detect and remediate
          lingering access after employee offboarding. It comprises two primary components:
        </p>
        <ul>
          <li>
            <strong>Frappe App</strong> — frontend UI, database, REST API, and business logic.
            Hosts the OGM Settings, Offboarding Cases, Access Artifacts, Findings, and the
            Unified Audit Log.
          </li>
          <li>
            <strong>External Scanner Service</strong> — Python-based worker that connects to
            Google Workspace APIs to discover OAuth tokens, ASPs, login events, and other access
            mechanisms. Runs as a background job via the Frappe scheduler.
          </li>
        </ul>
        <p>
          The Next.js management dashboard (this application) provides a modern web interface
          that communicates with the Frappe backend via REST API, offering real-time visibility
          into the offboarding security posture.
        </p>
      </>
    ),
    DocTypes: (
      <>
        <p>The system is built around five core DocTypes:</p>
        <div className="grid gap-3 not-prose">
          {[
            { name: "Offboarding Case", href: "/cases", desc: "Tracks an employee offboarding event through its lifecycle: Draft → Scheduled → Scanned → Gaps Found → Remediated → Closed." },
            { name: "Access Artifact", href: "/artifacts", desc: "Concrete access mechanisms discovered during scans: OAuth tokens, ASPs, login events, admin MFA settings, and DWD changes." },
            { name: "Finding", href: "/findings", desc: "Policy violations generated from artifacts: LingeringOAuthGrant, LingeringASP, PostOffboardLogin, AdminMFAWeak, DWDHighRisk, OffboardingNotEnforced." },
            { name: "Unified Audit Log Entry", href: "/audit-log", desc: "Immutable record of every scan, remediation, and administrative action performed in the system." },
            { name: "OGM Settings", href: "/settings", desc: "Singleton configuration for automation toggles, scan intervals, remediation defaults, and notification preferences." },
          ].map((dt) => (
            <Card key={dt.name} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={dt.href} className="font-semibold text-primary hover:underline">{dt.name}</Link>
                  <p className="text-sm text-muted-foreground mt-1">{dt.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      </>
    ),
    "Data Flow": (
      <>
        <p>The typical data flow for an offboarding event:</p>
        <ol>
          <li><strong>Employee status change</strong> in HRMS triggers a webhook or is detected by the scheduler.</li>
          <li><strong>Offboarding Case</strong> is auto-created (if <code>auto_create_case_on_leave</code> is enabled).</li>
          <li><strong>Scan</strong> runs automatically or manually, discovering access artifacts.</li>
          <li><strong>Findings</strong> are generated from artifacts that violate security policies.</li>
          <li><strong>Remediation</strong> is triggered (auto or manual), revoking tokens, deleting ASPs, signing out sessions.</li>
          <li><strong>Audit log</strong> records every action throughout the process.</li>
        </ol>
      </>
    ),
    Deployment: (
      <>
        <p>The management dashboard supports two deployment modes:</p>
        <ul>
          <li><strong>Cloudflare Workers</strong> — production deployment via <code>opennextjs-cloudflare</code>. Uses Wrangler for deployment and supports edge computing.</li>
          <li><strong>Standard Next.js</strong> — development mode with <code>next dev</code>. Supports mock provider for offline development.</li>
        </ul>
        <p>The Frappe backend runs as a standard Frappe site with the <code>oauth_gap_monitor</code> app installed.</p>
      </>
    ),
  },
  findings: {
    "Finding Types": (
      <>
        <p>Each finding type represents a specific policy violation:</p>
        <div className="grid gap-3 not-prose">
          {[
            { type: "LingeringOAuthGrant", sev: "High/Critical", desc: "OAuth tokens remain active after offboarding. The employee can still access Google services through authorized third-party apps.", action: "Revoke All OAuth Grants or Full Bundle" },
            { type: "LingeringASP", sev: "Medium", desc: "Application-Specific Passwords remain active, allowing email access through legacy mail clients.", action: "Delete ASPs or Full Bundle" },
            { type: "PostOffboardLogin", sev: "High", desc: "A login event was detected from the employee's account after their offboarding date.", action: "Sign Out User or Full Bundle" },
            { type: "PostOffboardSuspiciousLogin", sev: "Critical", desc: "A suspicious login (unusual IP, device, or location) was detected post-offboarding.", action: "Sign Out User + Investigation" },
            { type: "AdminMFAWeak", sev: "Critical", desc: "An admin account lacks strong two-factor authentication (only SMS or no 2FA).", action: "Manual — enforce hardware security key" },
            { type: "DWDHighRisk", sev: "Critical", desc: "Domain-Wide Delegation grant to a service account with sensitive scopes (admin, directory, gmail.send).", action: "Manual — review and restrict DWD scopes" },
            { type: "OffboardingNotEnforced", sev: "High", desc: "The employee's account has not been suspended or deleted after offboarding.", action: "Manual — suspend in Admin Console" },
          ].map((f) => (
            <Card key={f.type} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <code className="text-sm font-semibold">{f.type}</code>
                <Badge variant={f.sev.includes("Critical") ? "destructive" : "default"} className="text-xs">{f.sev}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
              <p className="text-sm mt-1"><strong>Remediation:</strong> {f.action}</p>
            </Card>
          ))}
        </div>
      </>
    ),
    "Severity Levels": (
      <>
        <p>Findings are classified into four severity levels:</p>
        <div className="grid grid-cols-2 gap-3 not-prose">
          {[
            { level: "Critical", color: "destructive" as const, desc: "Immediate action required. Active admin-level access or suspicious post-offboard activity." },
            { level: "High", color: "default" as const, desc: "Urgent. Lingering OAuth grants with sensitive scopes or post-offboard logins.", className: "bg-orange-500/90 text-white" },
            { level: "Medium", color: "default" as const, desc: "Moderate risk. ASPs or tokens with limited scopes still active.", className: "bg-yellow-500/90 text-black" },
            { level: "Low", color: "secondary" as const, desc: "Low risk. Read-only access or tokens for non-sensitive services." },
          ].map((s) => (
            <Card key={s.level} className="p-4">
              <Badge variant={s.color} className={s.className}>{s.level}</Badge>
              <p className="text-sm text-muted-foreground mt-2">{s.desc}</p>
            </Card>
          ))}
        </div>
      </>
    ),
    Evidence: (
      <>
        <p>Each finding can include evidence entries that provide detailed context:</p>
        <ul>
          <li><strong>Evidence type</strong> — the category (e.g., "OAuth Token", "Login Event", "ASP")</li>
          <li><strong>Detail</strong> — specific information like client IDs, IP addresses, timestamps, or scope lists</li>
        </ul>
        <p>Evidence links findings to specific access artifacts, enabling targeted remediation.</p>
      </>
    ),
    Lifecycle: (
      <>
        <p>Finding lifecycle states:</p>
        <ol>
          <li><strong>Open</strong> — newly discovered, requires attention</li>
          <li><strong>Remediated</strong> — the underlying access has been revoked/deleted</li>
          <li><strong>Closed</strong> — resolved and acknowledged</li>
        </ol>
        <p>When all findings for a case are remediated or closed, the case status automatically transitions to "Remediated".</p>
      </>
    ),
  },
  "access-artifacts": {
    "Artifact Types": (
      <>
        <p>Five types of access artifacts are tracked:</p>
        <div className="grid gap-3 not-prose">
          {[
            { type: "OAuthToken", desc: "Third-party application OAuth grants. Each token has scopes defining what the app can access (Drive, Gmail, Calendar, Admin, etc.)." },
            { type: "ASP", desc: "Application-Specific Passwords for legacy mail clients (Thunderbird, Outlook, Apple Mail). Provide full email access without OAuth." },
            { type: "LoginEvent", desc: "Detected login activities. Includes IP address, user agent, and timestamp. Flagged when occurring after offboarding date." },
            { type: "AdminMFA", desc: "Admin Console MFA settings. Flagged when admin accounts lack hardware security keys or have only SMS-based verification." },
            { type: "DWDChange", desc: "Domain-Wide Delegation changes. Service accounts with broad scopes that could access user data across the organization." },
          ].map((a) => (
            <Card key={a.type} className="p-4">
              <code className="text-sm font-semibold">{a.type}</code>
              <p className="text-sm text-muted-foreground mt-1">{a.desc}</p>
            </Card>
          ))}
        </div>
      </>
    ),
    "Risk Levels": (
      <>
        <p>Artifacts are assigned risk levels based on the sensitivity of their access:</p>
        <ul>
          <li><strong>Critical</strong> — Admin-level access, sensitive scopes (admin.directory, gmail.send, DWD)</li>
          <li><strong>High</strong> — Broad data access (Drive read/write, Gmail, Contacts)</li>
          <li><strong>Medium</strong> — Limited but notable access (Calendar, Tasks, profile)</li>
          <li><strong>Low</strong> — Read-only or minimal scope access (userinfo.profile, drive.readonly)</li>
        </ul>
      </>
    ),
    Scopes: (
      <>
        <p>OAuth scopes define the level of access granted to third-party applications. Common scopes include:</p>
        <ul>
          <li><code>drive</code> / <code>drive.file</code> — Google Drive access</li>
          <li><code>gmail.readonly</code> / <code>gmail.send</code> — Gmail access</li>
          <li><code>calendar</code> / <code>calendar.readonly</code> — Calendar access</li>
          <li><code>admin.directory.user</code> — Admin Directory access (high risk)</li>
          <li><code>contacts</code> — Contacts access</li>
        </ul>
        <p>Scopes are classified as "read" or "write" level. Write-level scopes (send, modify, compose, admin, manage) are considered higher risk.</p>
      </>
    ),
    Discovery: (
      <>
        <p>Artifacts are discovered through two mechanisms:</p>
        <ul>
          <li><strong>Case scan</strong> — targets a specific employee, querying Google Workspace APIs for their OAuth tokens, ASPs, and recent login activity.</li>
          <li><strong>System scan</strong> — broad scan that discovers "hidden" artifacts not yet assigned to a case and creates cases automatically for offboarded employees.</li>
        </ul>
      </>
    ),
  },
  "audit-log": {
    "Action Types": (
      <>
        <p>The audit log tracks these action types:</p>
        <div className="grid grid-cols-2 gap-2 not-prose">
          {[
            "CaseCreated", "ScanStarted", "ScanFinished",
            "RemediationStarted", "RemediationCompleted",
            "TokenRevoked", "ASPDeleted", "UserSignedOut",
            "GlobalAppRemoval", "SettingsUpdated",
          ].map((a) => (
            <Card key={a} className="p-3">
              <code className="text-sm">{a}</code>
            </Card>
          ))}
        </div>
      </>
    ),
    Entries: (
      <>
        <p>Each audit log entry records:</p>
        <ul>
          <li><strong>Actor</strong> — who performed the action (user or "Scheduler")</li>
          <li><strong>Action type</strong> — the category of action</li>
          <li><strong>Target email</strong> — the employee or system target</li>
          <li><strong>Result</strong> — Success or Failure</li>
          <li><strong>Request/Response JSON</strong> — raw data for forensic review</li>
          <li><strong>Timestamp</strong> — exact time of the action</li>
        </ul>
        <p>Audit log entries are <strong>immutable</strong> — they cannot be edited or deleted once created.</p>
      </>
    ),
    Filtering: (
      <>
        <p>The audit log can be filtered by:</p>
        <ul>
          <li>Action type (scan, remediation, etc.)</li>
          <li>Target email</li>
          <li>Date range</li>
          <li>Actor</li>
        </ul>
        <p>The most recent 100 entries are loaded by default, with older entries available via pagination.</p>
      </>
    ),
  },
  remediation: {
    "Full Bundle": (
      <>
        <p>The <strong>Full Remediation Bundle</strong> executes all automated remediation steps in sequence:</p>
        <ol>
          <li>Revoke all OAuth tokens for the employee</li>
          <li>Delete all Application-Specific Passwords</li>
          <li>Sign out all active sessions</li>
          <li>Close all open findings</li>
          <li>Update case status to "Remediated"</li>
        </ol>
        <p>This is the recommended action for complete offboarding cleanup. Available from the case detail page.</p>
      </>
    ),
    "Standalone Actions": (
      <>
        <p>Individual remediation actions can be triggered separately:</p>
        <ul>
          <li><strong>Revoke OAuth Grants</strong> — revokes all OAuth tokens, closes LingeringOAuthGrant findings</li>
          <li><strong>Delete ASPs</strong> — deletes all Application-Specific Passwords, closes LingeringASP findings</li>
          <li><strong>Sign Out User</strong> — terminates all active sessions, closes PostOffboardLogin findings</li>
        </ul>
        <p>Standalone actions are useful when only specific types of access need to be addressed.</p>
      </>
    ),
    Scheduling: (
      <>
        <p>Cases can have scheduled remediation:</p>
        <ul>
          <li>Set a <strong>scheduled_remediation_date</strong> on the case</li>
          <li>The scheduler checks for due remediations at the configured interval</li>
          <li>When the date arrives, full bundle remediation is executed automatically</li>
          <li>7-day and 1-day notification reminders are sent if configured</li>
        </ul>
        <p>Use "Run Scheduled Now" on a case detail page to execute scheduled remediation immediately.</p>
      </>
    ),
    "Bulk Operations": (
      <>
        <p>Bulk remediation options:</p>
        <ul>
          <li><strong>Case-level bulk</strong> — select multiple artifacts within a case and remediate them together</li>
          <li><strong>Artifact page bulk</strong> — select artifacts across cases from the artifacts list page</li>
          <li><strong>Employee revoke</strong> — revoke all access for an employee across all their cases</li>
          <li><strong>Global app removal</strong> — revoke a specific app for all users organization-wide</li>
        </ul>
      </>
    ),
  },
  integrations: {
    "HRMS Employee": (
      <>
        <p>OGM integrates with Frappe HRMS for employee lifecycle events:</p>
        <ul>
          <li>When an employee's status changes to <strong>"Left"</strong>, an Offboarding Case is auto-created (if <code>auto_create_case_on_leave</code> is enabled).</li>
          <li>Employee data (name, email, department, designation) is synchronized from HRMS.</li>
          <li>Department transfers can trigger security reviews.</li>
        </ul>
      </>
    ),
    "Google Workspace": (
      <>
        <p>The scanner service connects to Google Workspace Admin SDK to:</p>
        <ul>
          <li>List OAuth tokens granted to third-party apps</li>
          <li>Enumerate Application-Specific Passwords</li>
          <li>Query login/audit events from the Reports API</li>
          <li>Check admin account MFA settings</li>
          <li>Review Domain-Wide Delegation configurations</li>
        </ul>
        <p>Authentication uses a service account with appropriate admin scopes.</p>
      </>
    ),
    "Frappe Scheduler": (
      <>
        <p>The background scheduler runs four task types:</p>
        <ol>
          <li><strong>Background scan</strong> — system-wide scan at configurable intervals</li>
          <li><strong>Remediation check</strong> — processes scheduled remediations that are due</li>
          <li><strong>Daily case scan</strong> — re-scans Draft and Scheduled cases once per day</li>
          <li><strong>Notifications</strong> — sends reminder emails for upcoming scheduled remediations</li>
        </ol>
        <p>Run with <code>npx tsx scripts/scheduler.ts</code> for continuous operation, or <code>--once</code> for a single pass.</p>
      </>
    ),
    Webhooks: (
      <>
        <p>Future integration points (planned):</p>
        <ul>
          <li>Slack/Teams notifications for new findings</li>
          <li>SIEM integration for audit log streaming</li>
          <li>Custom webhook endpoints for third-party integrations</li>
        </ul>
      </>
    ),
  },
};

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>(sections[0].id);
  const [activeSubsection, setActiveSubsection] = useState<string>(
    sections[0].subsections[0]
  );

  const currentSection = sections.find((s) => s.id === activeSection)!;
  const content = sectionContent[activeSection]?.[activeSubsection];

  return (
    <div className="flex gap-8 max-w-7xl mx-auto">
      <aside className="w-64 shrink-0 hidden md:block">
        <div className="sticky top-0 space-y-1 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Documentation</h2>
          </div>
          {sections.map((s) => (
            <div key={s.id}>
              <button
                onClick={() => {
                  setActiveSection(s.id);
                  setActiveSubsection(s.subsections[0]);
                }}
                className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  activeSection === s.id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.title}
              </button>
              {activeSection === s.id && (
                <div className="ml-6 mt-1 space-y-0.5 mb-2">
                  {s.subsections.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setActiveSubsection(sub)}
                      className={`block w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                        activeSubsection === sub
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/50"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/docs" className="hover:text-foreground">Docs</Link>
            <ChevronRight className="h-3 w-3" />
            <span>{currentSection.title}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{activeSubsection}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{activeSubsection}</h1>
          <p className="text-muted-foreground mt-2 text-lg">{currentSection.description}</p>
        </div>

        <Card>
          <CardContent className="pt-8 pb-8 px-8">
            <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-p:leading-7 prose-li:leading-7 prose-ul:space-y-1 prose-ol:space-y-1 prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:before:content-none prose-code:after:content-none">
              {content}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          {(() => {
            const allPages: { section: SectionId; sub: string }[] = [];
            sections.forEach((s) =>
              s.subsections.forEach((sub) => allPages.push({ section: s.id, sub }))
            );
            const idx = allPages.findIndex(
              (p) => p.section === activeSection && p.sub === activeSubsection
            );
            const prev = idx > 0 ? allPages[idx - 1] : null;
            const next = idx < allPages.length - 1 ? allPages[idx + 1] : null;
            return (
              <>
                {prev ? (
                  <button
                    onClick={() => {
                      setActiveSection(prev.section);
                      setActiveSubsection(prev.sub);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    &larr; {prev.sub}
                  </button>
                ) : <div />}
                {next ? (
                  <button
                    onClick={() => {
                      setActiveSection(next.section);
                      setActiveSubsection(next.sub);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {next.sub} &rarr;
                  </button>
                ) : <div />}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
