"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFindings, useFindingDetail, useRemediateFinding } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Shield } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { format } from "date-fns";
import { SortableTableHead, useSort } from "@/components/sortable-header";

const severities = ["Critical", "High", "Medium", "Low"];
const findingTypes = [
  "LingeringOAuthGrant",
  "LingeringASP",
  "PostOffboardLogin",
  "PostOffboardSuspiciousLogin",
  "AdminMFAWeak",
  "DWDHighRisk",
  "OffboardingNotEnforced",
];

const severityVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Critical: "destructive",
  High: "outline",
  Medium: "default",
  Low: "secondary",
};

function SeverityBadge({ severity }: { severity: string }) {
  const variant = severityVariant[severity] ?? "secondary";
  const className =
    severity === "High"
      ? "bg-orange-500/90 text-white border-orange-600"
      : severity === "Medium"
        ? "bg-yellow-500/90 text-black border-yellow-600"
        : severity === "Low"
          ? "bg-gray-500/90 text-white border-gray-600"
          : undefined;
  return (
    <Badge variant={variant} className={className}>
      {severity}
    </Badge>
  );
}

function FindingDetailView({ findingId }: { findingId: string }) {
  const { data: finding, isLoading } = useFindingDetail(findingId);
  const remediateFinding = useRemediateFinding();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="space-y-4">
        <Link href="/findings">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Findings
          </Button>
        </Link>
        <p className="text-muted-foreground">Finding not found: {findingId}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/findings">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Findings
          </Button>
        </Link>
        {!finding.closed_at && (
          <Button
            variant="destructive"
            onClick={() => remediateFinding.mutate(finding.name)}
            disabled={remediateFinding.isPending}
          >
            {remediateFinding.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shield className="mr-2 h-4 w-4" />
            )}
            Remediate Finding
          </Button>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold">{finding.name}</h1>
        <p className="text-muted-foreground">Finding detail</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finding Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="font-medium">{finding.finding_type}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Severity</span>
              <p><SeverityBadge severity={finding.severity} /></p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p>
                <Badge variant={finding.closed_at ? "secondary" : "default"}>
                  {finding.closed_at ? "Closed" : "Open"}
                </Badge>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Case</span>
              <p>
                <Link href={`/cases/${finding.case}`} className="text-primary hover:underline">
                  {finding.case}
                </Link>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{finding.summary}</p>
        </CardContent>
      </Card>

      {finding.recommended_action && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended Action</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{finding.recommended_action}</p>
          </CardContent>
        </Card>
      )}

      {finding.evidence && finding.evidence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finding.evidence.map((e) => (
                  <TableRow key={e.name}>
                    <TableCell className="font-medium">{e.evidence_type}</TableCell>
                    <TableCell>{e.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Created</span>
              <p>{finding.creation ? format(new Date(finding.creation), "PPp") : "-"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Modified</span>
              <p>{finding.modified ? format(new Date(finding.modified), "PPp") : "-"}</p>
            </div>
            {finding.closed_at && (
              <div>
                <span className="text-muted-foreground">Closed At</span>
                <p>{format(new Date(finding.closed_at), "PPp")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FindingsPageContent() {
  const router = useRouter();
  const { sortConfig, onSort, sortData } = useSort();
  const searchParams = useSearchParams();
  const findingParam = searchParams.get("finding");
  const [filterSeverity, setFilterSeverity] = useState<string>(
    searchParams.get("severity") ?? "all"
  );
  const [filterType, setFilterType] = useState<string>(
    searchParams.get("type") ?? "all"
  );

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (filterSeverity && filterSeverity !== "all") f.severity = filterSeverity;
    if (filterType && filterType !== "all") f.finding_type = filterType;
    return Object.keys(f).length ? f : undefined;
  }, [filterSeverity, filterType]);

  const { data: findings, isLoading } = useFindings(filters);

  if (findingParam) {
    return <FindingDetailView findingId={findingParam} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Findings</h1>
        <p className="text-muted-foreground">
          Policy violations and security gaps from scans
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">All Findings</CardTitle>
          <div className="flex gap-2">
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severity</SelectItem>
                {severities.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {findingTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="name" label="Name" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="case" label="Case" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="finding_type" label="Type" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="severity" label="Severity" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="summary" label="Summary" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="closed_at" label="Status" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="creation" label="Created" sortConfig={sortConfig} onSort={onSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(findings ? sortData(findings as unknown as Record<string, unknown>[]) : []).map((f) => (
                <TableRow
                  key={f.name as string}
                  className="cursor-pointer"
                  onClick={() => router.push(`/findings?finding=${encodeURIComponent(f.name as string)}`)}
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/findings?finding=${encodeURIComponent(f.name as string)}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {f.name as string}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/cases/${f.case}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {f.case as string}
                    </Link>
                  </TableCell>
                  <TableCell>{f.finding_type as string}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={f.severity as string} />
                  </TableCell>
                  <TableCell className="max-w-md truncate">{f.summary as string}</TableCell>
                  <TableCell>
                    <Badge variant={f.closed_at ? "secondary" : "default"}>
                      {f.closed_at ? "Closed" : "Open"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {f.creation
                      ? format(new Date(f.creation as string), "PP")
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FindingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <FindingsPageContent />
    </Suspense>
  );
}
