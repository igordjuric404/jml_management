"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useArtifacts,
  useRemediateArtifacts,
  useArtifactDetail,
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
import { Loader2, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { SortableTableHead, useSort } from "@/components/sortable-header";

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

function ArtifactDetailView({ artifactId }: { artifactId: string }) {
  const { data: artifact, isLoading } = useArtifactDetail(artifactId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="space-y-4">
        <Link href="/artifacts">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Artifacts
          </Button>
        </Link>
        <p className="text-muted-foreground">Artifact not found: {artifactId}</p>
      </div>
    );
  }

  const scopes: string[] = artifact.scopes_json ? JSON.parse(artifact.scopes_json) : [];
  const metadata = artifact.metadata_json ? JSON.parse(artifact.metadata_json) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/artifacts">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Artifacts
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{artifact.name}</h1>
        <p className="text-muted-foreground">Artifact detail</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Artifact Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="font-medium">{artifact.artifact_type}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p>
                <Badge variant={statusVariant[artifact.status] ?? "secondary"}>
                  {artifact.status}
                </Badge>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Risk Level</span>
              <p>
                {artifact.risk_level ? (
                  <Badge variant={riskVariant[artifact.risk_level] ?? "secondary"}>
                    {artifact.risk_level}
                  </Badge>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Case</span>
              <p>
                {artifact.case ? (
                  <Link href={`/cases/${artifact.case}`} className="text-primary hover:underline">
                    {artifact.case}
                  </Link>
                ) : (
                  "-"
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Subject Email</span>
              <p>
                <Link
                  href={`/employees?email=${encodeURIComponent(artifact.subject_email)}`}
                  className="text-primary hover:underline"
                >
                  {artifact.subject_email}
                </Link>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">App</span>
              <p>
                {artifact.client_id ? (
                  <Link
                    href={`/apps?client_id=${encodeURIComponent(artifact.client_id)}`}
                    className="text-primary hover:underline"
                  >
                    {artifact.app_display_name || artifact.client_id}
                  </Link>
                ) : (
                  artifact.app_display_name || "-"
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <p>{artifact.creation ? format(new Date(artifact.creation), "PPp") : "-"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Modified</span>
              <p>{artifact.modified ? format(new Date(artifact.modified), "PPp") : "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {scopes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">OAuth Scopes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {scopes.map((scope) => (
                <Badge key={scope} variant="outline" className="text-xs font-mono">
                  {scope}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {metadata && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted rounded-md p-4 overflow-x-auto">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ArtifactsPageContent() {
  const router = useRouter();
  const { sortConfig, onSort, sortData } = useSort();
  const searchParams = useSearchParams();
  const artifactParam = searchParams.get("artifact");
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

  if (artifactParam) {
    return <ArtifactDetailView artifactId={artifactParam} />;
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
                <SortableTableHead column="name" label="Name" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="case" label="Case" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="artifact_type" label="Type" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="subject_email" label="Subject Email" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="status" label="Status" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="app_display_name" label="App Name" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="risk_level" label="Risk Level" sortConfig={sortConfig} onSort={onSort} />
                <SortableTableHead column="creation" label="Created" sortConfig={sortConfig} onSort={onSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(artifacts ? sortData(artifacts as unknown as Record<string, unknown>[]) : []).map((raw) => {
                const a = raw as unknown as import("@/lib/dto/types").AccessArtifact;
                return (
                <TableRow
                  key={a.name}
                  className="cursor-pointer"
                  onClick={() => router.push(`/artifacts?artifact=${encodeURIComponent(a.name)}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
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
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/cases/${a.case}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.case}
                    </Link>
                  </TableCell>
                  <TableCell>{a.artifact_type}</TableCell>
                  <TableCell>
                    <Link
                      href={`/employees?email=${encodeURIComponent(a.subject_email)}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
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
                        onClick={(e) => e.stopPropagation()}
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
                );
              })}
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
