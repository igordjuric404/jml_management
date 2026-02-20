"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  useArtifacts,
  useRemediateArtifacts,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

const artifactTypes = ["OAuthToken", "ASP", "LoginEvent", "AdminMFA", "DWDChange"];
const statuses = ["Active", "Hidden", "Revoked", "Deleted", "Acknowledged"];

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

const riskVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Critical: "destructive",
  High: "destructive",
  Medium: "default",
  Low: "secondary",
};

function ArtifactsPageContent() {
  const searchParams = useSearchParams();
  const [filterType, setFilterType] = useState<string>(
    searchParams.get("type") ?? "all"
  );
  const [filterStatus, setFilterStatus] = useState<string>(
    searchParams.get("status") ?? "all"
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (filterType && filterType !== "all") f.artifact_type = filterType;
    if (filterStatus && filterStatus !== "all") f.status = filterStatus;
    return Object.keys(f).length ? f : undefined;
  }, [filterType, filterStatus]);

  const { data: artifacts, isLoading } = useArtifacts(filters);
  const remediate = useRemediateArtifacts();

  const activeArtifacts = useMemo(
    () => artifacts?.filter((a) => a.status === "Active") ?? [],
    [artifacts]
  );

  const toggleOne = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === activeArtifacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activeArtifacts.map((a) => a.name)));
    }
  };

  const handleRemediate = () => {
    const names = Array.from(selected);
    if (names.length === 0) return;
    remediate.mutate(names, { onSuccess: () => setSelected(new Set()) });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Access Artifacts</h1>
          <p className="text-muted-foreground">
            OAuth tokens, ASPs, login events, and other access mechanisms
          </p>
        </div>
        {selected.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleRemediate}
            disabled={remediate.isPending}
          >
            {remediate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Remediate ({selected.size} selected)
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Artifacts</CardTitle>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {artifactTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
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
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      activeArtifacts.length > 0 &&
                      activeArtifacts.every((a) => selected.has(a.name))
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>App Name</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artifacts?.map((a) => (
                <TableRow key={a.name}>
                  <TableCell>
                    {a.status === "Active" && (
                      <Checkbox
                        checked={selected.has(a.name)}
                        onCheckedChange={() => toggleOne(a.name)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/artifacts?artifact=${encodeURIComponent(a.name)}`}
                      className="text-primary hover:underline"
                    >
                      {a.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/cases/${a.case}`}
                      className="text-primary hover:underline"
                    >
                      {a.case}
                    </Link>
                  </TableCell>
                  <TableCell>{a.artifact_type}</TableCell>
                  <TableCell>
                    <Link
                      href={`/employees?email=${encodeURIComponent(a.subject_email)}`}
                      className="text-primary hover:underline"
                    >
                      {a.subject_email}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[a.status] ?? "secondary"}>
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
                      <Badge variant={riskVariant[a.risk_level] ?? "secondary"}>
                        {a.risk_level}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {a.creation
                      ? format(new Date(a.creation), "PP")
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

export default function ArtifactsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ArtifactsPageContent />
    </Suspense>
  );
}
