"use client";

import { useScanHistory } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Zap, AlertTriangle, History } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function ScanHistoryPage() {
  const { data: history, isLoading } = useScanHistory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalScans = history?.length ?? 0;
  const manual = history?.filter((h) => h.trigger === "manual").length ?? 0;
  const automatic = history?.filter((h) => h.trigger === "automatic").length ?? 0;
  const foundIssues = history?.filter(
    (h) => (h.open_findings ?? 0) > 0 || (h.active_artifacts ?? 0) > 0
  ).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scan History</h1>
        <p className="text-muted-foreground">
          History of all scan runs and their results
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalScans}</p>
                <p className="text-sm text-muted-foreground">Total Scans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{manual}</p>
                <p className="text-sm text-muted-foreground">Manual</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{automatic}</p>
                <p className="text-sm text-muted-foreground">Automatic</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{foundIssues}</p>
                <p className="text-sm text-muted-foreground">Found Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Artifacts</TableHead>
                <TableHead>Findings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.map((h) => (
                <TableRow key={h.scan_id}>
                  <TableCell>
                    {formatDistanceToNow(new Date(h.started_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/cases/${h.case}`}
                      className="text-primary hover:underline"
                    >
                      {h.case}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/employees?email=${encodeURIComponent(h.target_email)}`}
                      className="text-primary hover:underline"
                    >
                      {h.target_email}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={h.trigger === "manual" ? "default" : "secondary"}
                    >
                      {h.trigger}
                    </Badge>
                  </TableCell>
                  <TableCell>{h.result}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {h.new_status ?? "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>{h.active_artifacts ?? 0}</TableCell>
                  <TableCell>
                    {h.findings_link ? (
                      <Link
                        href={h.findings_link}
                        className="text-primary hover:underline"
                      >
                        {h.open_findings ?? 0}
                      </Link>
                    ) : (
                      h.open_findings ?? 0
                    )}
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
