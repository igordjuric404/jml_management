"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useFindings } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
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

function FindingsPageContent() {
  const searchParams = useSearchParams();
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
                <TableHead>Name</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings?.map((f) => (
                <TableRow key={f.name}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/findings?finding=${encodeURIComponent(f.name)}`}
                      className="text-primary hover:underline"
                    >
                      {f.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/cases/${f.case}`}
                      className="text-primary hover:underline"
                    >
                      {f.case}
                    </Link>
                  </TableCell>
                  <TableCell>{f.finding_type}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={f.severity} />
                  </TableCell>
                  <TableCell className="max-w-md truncate">{f.summary}</TableCell>
                  <TableCell>
                    <Badge variant={f.closed_at ? "secondary" : "default"}>
                      {f.closed_at ? "Closed" : "Open"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {f.creation
                      ? format(new Date(f.creation), "PP")
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
