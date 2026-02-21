"use client";

import { useDashboard, useSystemScan } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, FolderOpen, Users, Grid3X3,
  History, FileText, Search, RefreshCw, Loader2, Lock,
} from "lucide-react";
import Link from "next/link";
import { confirmAction } from "@/components/confirm-dialog";

const quickLinks = [
  { label: "Offboarding Cases", href: "/cases", icon: FolderOpen },
  { label: "Employees", href: "/employees", icon: Users },
  { label: "Access Artifacts", href: "/artifacts", icon: Lock },
  { label: "Findings", href: "/findings", icon: AlertTriangle },
  { label: "OAuth Apps", href: "/apps", icon: Grid3X3 },
  { label: "Scan History", href: "/scan-history", icon: History },
  { label: "Audit Log", href: "/audit-log", icon: FileText },
];

export default function DashboardPage() {
  const { data: stats, isLoading, refetch } = useDashboard();
  const systemScan = useSystemScan();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = stats?.kpis;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">OAuth Gap Monitor Dashboard</h1>
          <p className="text-muted-foreground">Overview of access security posture</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              confirmAction({
                title: "System Scan",
                description: "Run a system-wide scan to discover new lingering access? This will check all employees for hidden artifacts.",
                confirmLabel: "Run Scan",
                onConfirm: () => systemScan.mutate(),
              });
            }}
            disabled={systemScan.isPending}
          >
            {systemScan.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Scan System
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Pending Scan" value={kpis?.pending_scan} href="/cases?status=Draft" />
        <KpiCard label="Critical Gaps" value={kpis?.critical_gaps} href="/findings?severity=Critical" />
        <KpiCard label="OAuth Grants" value={kpis?.oauth_grants} href="/artifacts?type=OAuthToken" />
        <KpiCard label="Post-offboard Logins" value={kpis?.post_offboard_logins} href="/findings?type=PostOffboardLogin" />
        <KpiCard label="Total Cases" value={kpis?.total_cases} href="/cases" />
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <link.icon className="mr-2 h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risky Cases */}
      {stats?.risky_cases && stats.risky_cases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Risky Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Critical</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.risky_cases.map((c) => (
                  <TableRow key={c.case_name}>
                    <TableCell>
                      <Link href={`/cases/${c.case_name}`} className="text-primary hover:underline">
                        {c.case_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/employees?email=${encodeURIComponent(c.primary_email)}`}
                        className="hover:underline"
                      >
                        {c.primary_email}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {c.employee_name ? (
                        <Link
                          href={`/employees?email=${encodeURIComponent(c.primary_email)}`}
                          className="hover:underline"
                        >
                          {c.employee_name}
                        </Link>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/findings?case=${c.case_name}`}
                        className="hover:underline"
                      >
                        {c.finding_count} finding(s)
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.critical_count > 0 ? "destructive" : "secondary"}>
                        {c.critical_count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Top OAuth Apps */}
      {stats?.top_oauth_apps && stats.top_oauth_apps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Lingering OAuth Apps</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead className="text-right">Active Grants</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.top_oauth_apps.map((app) => (
                  <TableRow key={app.client_id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/apps?client_id=${encodeURIComponent(app.client_id)}`}
                        className="hover:underline text-primary"
                      >
                        {app.app_display_name || "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{app.client_id?.substring(0, 30)}</code>
                    </TableCell>
                    <TableCell className="text-right font-bold">{app.grant_count}</TableCell>
                    <TableCell>
                      <Link
                        href={`/apps?client_id=${encodeURIComponent(app.client_id)}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Details →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  label, value, href,
}: {
  label: string; value?: number; href: string;
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold">
            {value ?? 0}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
