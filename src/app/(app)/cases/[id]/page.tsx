"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useCaseDetail,
  useTriggerScan,
  useRemediation,
  useRunScheduledRemediation,
  useBulkRemediate,
  useUpdateCase,
} from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Search,
  Shield,
  Play,
  Lock,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { confirmAction } from "@/components/confirm-dialog";
import type {
  AccessArtifact,
  Finding,
  CaseDetail,
} from "@/lib/dto/types";

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Active: "destructive",
  Revoked: "secondary",
  Deleted: "secondary",
  Hidden: "secondary",
  Acknowledged: "secondary",
};

const severityVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Critical: "destructive",
  High: "destructive",
  Medium: "default",
  Low: "secondary",
};

const riskVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Critical: "destructive",
  High: "destructive",
  Medium: "default",
  Low: "secondary",
};

export default function CaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, isLoading } = useCaseDetail(id);
  const triggerScan = useTriggerScan(id);
  const remediation = useRemediation(id);
  const runScheduled = useRunScheduledRemediation(id);
  const bulkRemediate = useBulkRemediate(id);
  const updateCase = useUpdateCase(id);
  const [selectedArtifacts, setSelectedArtifacts] = useState<Set<string>>(
    new Set()
  );
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  const allArtifacts = useMemo(() => {
    if (!data?.artifacts) return [];
    const a = data.artifacts;
    return [
      ...(a.tokens ?? []),
      ...(a.asps ?? []),
      ...(a.login_events ?? []),
      ...(a.other ?? []),
    ] as AccessArtifact[];
  }, [data]);

  const activeArtifacts = allArtifacts.filter((a) => a.status === "Active");

  const toggleArtifact = (name: string) => {
    setSelectedArtifacts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAllInGroup = (names: string[]) => {
    const allSelected = names.every((n) => selectedArtifacts.has(n));
    setSelectedArtifacts((prev) => {
      const next = new Set(prev);
      if (allSelected) names.forEach((n) => next.delete(n));
      else names.forEach((n) => next.add(n));
      return next;
    });
  };

  const handleBulkRemediate = () => {
    const names = Array.from(selectedArtifacts);
    if (names.length === 0) return;
    bulkRemediate.mutate(names, {
      onSuccess: () => setSelectedArtifacts(new Set()),
    });
  };

  const handleFullRemediation = () => {
    confirmAction({
      title: "Execute Full Remediation",
      description: "This will revoke all OAuth tokens, delete all ASPs, and sign out all sessions for this employee. This action cannot be undone.",
      confirmLabel: "Execute Remediation",
      onConfirm: () => remediation.mutate({ action: "full_bundle" }),
    });
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { case: c, artifacts: rawArtifacts, findings: rawFindings, audit_logs } = data;

  // Defensive: API may return different structure or missing keys
  const artifacts = {
    tokens: (rawArtifacts?.tokens ?? []) as AccessArtifact[],
    asps: (rawArtifacts?.asps ?? []) as AccessArtifact[],
    login_events: (rawArtifacts?.login_events ?? []) as AccessArtifact[],
    other: (rawArtifacts?.other ?? []) as AccessArtifact[],
    total: rawArtifacts?.total ?? 0,
  };
  const findings = (rawFindings ?? []) as Finding[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <p className="text-muted-foreground">Case detail</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Employee</span>
              <p>
                <Link
                  href={`/employees?employee=${encodeURIComponent(c.employee)}`}
                  className="text-primary hover:underline"
                >
                  {c.employee_name}
                </Link>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Email</span>
              <p>
                <Link
                  href={`/employees?email=${encodeURIComponent(c.primary_email)}`}
                  className="text-primary hover:underline"
                >
                  {c.primary_email}
                </Link>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p>
                <Badge variant="secondary">{c.status}</Badge>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Effective Date</span>
              <p>
                {c.effective_date
                  ? format(new Date(c.effective_date), "PP")
                  : "-"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => triggerScan.mutate()}
              disabled={triggerScan.isPending}
            >
              {triggerScan.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Scan
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleFullRemediation}
              disabled={remediation.isPending}
            >
              {remediation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              Remediate
            </Button>
            {c.scheduled_remediation_date && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  confirmAction({
                    title: "Run Scheduled Remediation Now",
                    description: `Execute the scheduled remediation for ${c.employee_name} immediately? This will perform a full remediation bundle.`,
                    confirmLabel: "Run Now",
                    onConfirm: () => runScheduled.mutate(),
                  });
                }}
                disabled={runScheduled.isPending}
              >
                {runScheduled.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run Scheduled Now
              </Button>
            )}
          </div>

          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Scheduled Remediation</Label>
                <p className="text-xs text-muted-foreground">
                  {c.scheduled_remediation_date
                    ? `Scheduled for ${format(new Date(c.scheduled_remediation_date), "PPp")}`
                    : "No scheduled date set"}
                </p>
              </div>
              {!editingSchedule ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingSchedule(true);
                    setScheduleDate(
                      c.scheduled_remediation_date
                        ? new Date(c.scheduled_remediation_date).toISOString().slice(0, 16)
                        : ""
                    );
                  }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {c.scheduled_remediation_date ? "Edit Schedule" : "Set Schedule"}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="h-8 text-sm w-52"
                  />
                  <Button
                    size="sm"
                    disabled={!scheduleDate || updateCase.isPending}
                    onClick={() => {
                      updateCase.mutate(
                        {
                          scheduled_remediation_date: new Date(scheduleDate).toISOString(),
                          status: "Scheduled",
                        },
                        {
                          onSuccess: () => setEditingSchedule(false),
                        }
                      );
                    }}
                  >
                    {updateCase.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingSchedule(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="artifacts">
        <TabsList>
          <TabsTrigger value="artifacts">
            Artifacts ({artifacts.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="findings">Findings ({findings?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="artifacts" className="space-y-4">
          {activeArtifacts.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkRemediate}
                disabled={
                  selectedArtifacts.size === 0 || bulkRemediate.isPending
                }
              >
                {bulkRemediate.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Bulk Remediate ({selectedArtifacts.size} selected)
              </Button>
            </div>
          )}
          {allArtifacts.length > 0 ? (
            <ArtifactGroups artifacts={artifacts} selectedArtifacts={selectedArtifacts} onToggle={toggleArtifact} onToggleAllInGroup={toggleAllInGroup} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-sm">No artifacts found for this case.</p>
                <p className="text-xs mt-1">Run a scan to discover OAuth tokens, ASPs, and login events.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="findings">
          <Card>
            <CardContent className="pt-6">
              {findings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {findings.map((f: Finding) => (
                      <TableRow key={f.name}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/findings?finding=${encodeURIComponent(f.name)}`}
                            className="text-primary hover:underline"
                          >
                            {f.name}
                          </Link>
                        </TableCell>
                        <TableCell>{f.finding_type}</TableCell>
                        <TableCell>
                          <Badge
                            variant={severityVariant[f.severity] ?? "secondary"}
                          >
                            {f.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={f.closed_at ? "secondary" : "default"}>
                            {f.closed_at ? "Closed" : "Open"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {f.summary}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="text-sm">No findings for this case.</p>
                  <p className="text-xs mt-1">Run a scan to detect lingering OAuth grants, ASPs, or post-offboard logins.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Action Type</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit_logs?.map((log) => (
                    <TableRow key={log.name}>
                      <TableCell className="font-medium">{log.name}</TableCell>
                      <TableCell>{log.action_type}</TableCell>
                      <TableCell>{log.actor_user}</TableCell>
                      <TableCell>{log.result}</TableCell>
                      <TableCell>
                        {log.timestamp
                          ? format(new Date(log.timestamp), "PPp")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ArtifactGroups({
  artifacts,
  selectedArtifacts,
  onToggle,
  onToggleAllInGroup,
}: {
  artifacts: CaseDetail["artifacts"];
  selectedArtifacts: Set<string>;
  onToggle: (name: string) => void;
  onToggleAllInGroup: (names: string[]) => void;
}) {
  const groups = [
    { key: "tokens", label: "Tokens", list: artifacts.tokens ?? [] },
    { key: "asps", label: "ASPs", list: artifacts.asps ?? [] },
    { key: "logins", label: "Login Events", list: artifacts.login_events ?? [] },
    { key: "other", label: "Other", list: artifacts.other ?? [] },
  ];

  return (
    <div className="space-y-4">
      {groups.map(({ key, label, list }) => {
        const activeInList = list.filter((a) => a.status === "Active");
        return list.length > 0 ? (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-base">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      {activeInList.length > 0 && (
                        <Checkbox
                          checked={
                            activeInList.every((a) =>
                              selectedArtifacts.has(a.name)
                            )
                          }
                          onCheckedChange={() =>
                            onToggleAllInGroup(activeInList.map((a) => a.name))
                          }
                        />
                      )}
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((a) => (
                    <TableRow key={a.name}>
                      <TableCell>
                        {a.status === "Active" && (
                          <Checkbox
                            checked={selectedArtifacts.has(a.name)}
                            onCheckedChange={() => onToggle(a.name)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/artifacts?artifact=${encodeURIComponent(a.name)}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {a.name}
                        </Link>
                      </TableCell>
                      <TableCell>{a.artifact_type}</TableCell>
                      <TableCell>
                        <Badge
                          variant={statusVariant[a.status] ?? "secondary"}
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.client_id ? (
                          <Link
                            href={`/apps?client_id=${encodeURIComponent(a.client_id)}`}
                            className="text-primary hover:underline"
                          >
                            {a.app_display_name || a.client_id}
                          </Link>
                        ) : (
                          a.app_display_name || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {a.risk_level ? (
                          <Badge
                            variant={riskVariant[a.risk_level] ?? "secondary"}
                          >
                            {a.risk_level}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null;
      })}
    </div>
  );
}
