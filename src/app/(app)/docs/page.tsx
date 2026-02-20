"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  { id: "architecture", title: "Architecture" },
  { id: "findings", title: "Findings" },
  { id: "access-artifacts", title: "Access Artifacts" },
  { id: "audit-log", title: "Audit Log" },
  { id: "remediation", title: "Remediation" },
  { id: "integrations", title: "Integrations" },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState(sections[0].id);

  return (
    <div className="flex gap-8">
      <aside className="w-56 shrink-0 hidden md:block">
        <nav className="sticky top-6 space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSection(s.id);
                document.getElementById(s.id)?.scrollIntoView();
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm ${
                activeSection === s.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {s.title}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Documentation</h1>
          <p className="text-muted-foreground">
            OAuth Gap Monitor — system architecture and concepts
          </p>
        </div>

        <section id="architecture">
          <Card>
            <CardHeader>
              <CardTitle>Architecture</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                The OAuth Gap Monitor is a decoupled system comprising a{" "}
                <strong>Frappe App</strong> (frontend, database, API) and an{" "}
                <strong>External Scanner Service</strong> (Python worker).
              </p>
              <p>Key DocTypes:</p>
              <ul>
                <li>
                  <Link href="/cases" className="text-primary hover:underline">
                    Offboarding Case
                  </Link>
                  — Represents an employee offboarding event. Tracks status (Draft → Scheduled → Scanned → Gaps Found → Remediated).
                </li>
                <li>
                  <Link href="/artifacts" className="text-primary hover:underline">
                    Access Artifact
                  </Link>
                  — OAuth tokens, ASPs, login events, and other access mechanisms.
                </li>
                <li>
                  <Link href="/findings" className="text-primary hover:underline">
                    Finding
                  </Link>
                  — Policy violations (e.g., LingeringOAuthGrant, PostOffboardLogin).
                </li>
                <li>
                  <Link href="/audit-log" className="text-primary hover:underline">
                    Unified Audit Log Entry
                  </Link>
                  — Immutable record of all scan and remediation actions.
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <section id="findings">
          <Card>
            <CardHeader>
              <CardTitle>Findings</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Findings are policy violations detected by the scanner. Each type has a severity and recommended remediation.
              </p>
              <p>Finding types:</p>
              <ul>
                <li>
                  <strong>LingeringOAuthGrant</strong> — OAuth tokens remain after offboarding. Remediation:{" "}
                  <Link href="/cases" className="text-primary hover:underline">Revoke All OAuth Grants</Link> or Full Bundle.
                </li>
                <li>
                  <strong>LingeringASP</strong> — Application-Specific Passwords remain. Remediation: Delete ASPs or Full Bundle.
                </li>
                <li>
                  <strong>PostOffboardLogin</strong> / <strong>PostOffboardSuspiciousLogin</strong> — Login detected after offboarding. Remediation: Sign Out User or Full Bundle.
                </li>
                <li>
                  <strong>OffboardingNotEnforced</strong> — User not suspended. Requires manual suspension in Admin Console.
                </li>
                <li>
                  <strong>AdminMFAWeak</strong> — Admin without 2SV enforced. Manual fix in Admin Console.
                </li>
                <li>
                  <strong>DWDHighRisk</strong> — Domain-wide delegation with sensitive scopes. Manual review.
                </li>
              </ul>
              <Link href="/findings" className="text-primary hover:underline">
                View all findings →
              </Link>
            </CardContent>
          </Card>
        </section>

        <section id="access-artifacts">
          <Card>
            <CardHeader>
              <CardTitle>Access Artifacts</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Artifacts are concrete access mechanisms: OAuth tokens, ASPs, login events, etc.
              </p>
              <p>Artifact types: OAuthToken, ASP, LoginEvent, AdminMFA, DWDChange.</p>
              <p>
                Artifacts provide the raw evidence; Findings are conclusions drawn from them.
                One Finding may reference multiple Artifacts.
              </p>
              <Link href="/artifacts" className="text-primary hover:underline">
                View all artifacts →
              </Link>
            </CardContent>
          </Card>
        </section>

        <section id="audit-log">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                The audit log is an immutable record of who did what, to whom, when, and the result.
              </p>
              <p>Action types: ScanStarted, ScanFinished, RemediationStarted, RemediationCompleted, TokenRevoked, ASPDeleted, UserSignedOut, GlobalAppRemoval, etc.</p>
              <Link href="/audit-log" className="text-primary hover:underline">
                View audit log →
              </Link>
            </CardContent>
          </Card>
        </section>

        <section id="remediation">
          <Card>
            <CardHeader>
              <CardTitle>Remediation</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                The <strong>Full Remediation Bundle</strong> executes all automated steps:
              </p>
              <ol>
                <li>Revoke all OAuth tokens</li>
                <li>Delete all ASPs</li>
                <li>Sign out all sessions</li>
                <li>Close all findings</li>
                <li>Update case status</li>
              </ol>
              <p>
                Standalone actions: Revoke OAuth Grants, Delete ASPs, Sign Out User.
                Available from <Link href="/cases" className="text-primary hover:underline">case detail</Link>.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>OGM integrates with:</p>
              <ul>
                <li>
                  <strong>HRMS Employee</strong> — Auto-creates <Link href="/cases" className="text-primary hover:underline">Offboarding Cases</Link> when employee status changes to Left.
                </li>
                <li>
                  <strong>Frappe Scheduler</strong> — Background jobs for scanning, remediation, notifications.
                </li>
                <li>
                  <strong>Google Workspace APIs</strong> — Directory, Reports, Admin SDK for token/ASP management.
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
