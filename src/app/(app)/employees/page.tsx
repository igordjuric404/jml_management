"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  useEmployees,
  useEmployeeDetail,
  useRevokeEmployeeAccess,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  ArrowLeft,
  Shield,
  Lock,
  Key,
  ChevronDown,
  User,
} from "lucide-react";
import Link from "next/link";

function EmployeesPageContent() {
  const searchParams = useSearchParams();
  const employeeParam = searchParams.get("employee");
  const emailParam = searchParams.get("email");

  const { data: employees, isLoading: loadingList } = useEmployees();

  const detailEmployeeId = useMemo(() => {
    if (employeeParam) return employeeParam;
    if (emailParam && employees) {
      const emp = employees.find(
        (e) => e.company_email?.toLowerCase() === emailParam.toLowerCase()
      );
      return emp?.employee_id ?? null;
    }
    return null;
  }, [employeeParam, emailParam, employees]);

  const { data: detail, isLoading: loadingDetail } =
    useEmployeeDetail(detailEmployeeId ?? "");
  const revokeAll = useRevokeEmployeeAccess(detailEmployeeId ?? "");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!employees) return;
    if (selected.size === employees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(employees.map((e) => e.employee_id)));
    }
  };

  const handleRevokeAll = () => {
    if (selected.size === 0) return;
    if (confirm("Revoke all access for selected employees?")) {
      selected.forEach((id) => {
        revokeAll.mutate("all", { onSuccess: () => {} });
      });
      setSelected(new Set());
    }
  };

  const showDetail = !!detailEmployeeId && (loadingDetail || detail);

  if (loadingList && !showDetail) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (showDetail && detail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/employees">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Employees
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Revoke all access for this employee?")) {
                revokeAll.mutate("all");
              }
            }}
            disabled={revokeAll.isPending}
          >
            {revokeAll.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shield className="mr-2 h-4 w-4" />
            )}
            Revoke All Access
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employee Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Name</span>
                <p className="font-medium">{detail.employee.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email</span>
                <p>
                  <Link
                    href={`/employees?email=${encodeURIComponent(detail.employee.email)}`}
                    className="text-primary hover:underline"
                  >
                    {detail.employee.email}
                  </Link>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p>
                  <Badge
                    variant={
                      detail.employee.status === "Active"
                        ? "default"
                        : "destructive"
                    }
                    className={
                      detail.employee.status === "Active"
                        ? "bg-green-600 text-white"
                        : undefined
                    }
                  >
                    {detail.employee.status}
                  </Badge>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Department</span>
                <p>{detail.employee.department || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{detail.summary.total_cases}</p>
              <p className="text-sm text-muted-foreground">Cases</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">
                {detail.summary.active_artifacts}
              </p>
              <p className="text-sm text-muted-foreground">Active Artifacts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">
                {detail.summary.open_findings}
              </p>
              <p className="text-sm text-muted-foreground">Open Findings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{detail.summary.apps_used}</p>
              <p className="text-sm text-muted-foreground">Apps Used</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.apps?.map((app) => (
                  <TableRow key={app.artifact_name}>
                    <TableCell>
                      <Link
                        href={`/apps?client_id=${encodeURIComponent(app.client_id)}`}
                        className="text-primary hover:underline"
                      >
                        {app.app_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{app.client_id}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{app.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {app.risk_level ? (
                        <Badge variant="destructive">{app.risk_level}</Badge>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.findings?.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell>
                      <Link
                        href={`/findings?finding=${encodeURIComponent(f.name)}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {f.name}
                      </Link>
                    </TableCell>
                    <TableCell>{f.finding_type}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{f.severity}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {f.summary}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Associated Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Effective Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.cases?.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell>
                      <Link
                        href={`/cases/${c.name}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.effective_date
                        ? new Date(c.effective_date).toLocaleDateString()
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employee Access Overview</h1>
          <p className="text-muted-foreground">
            View and manage employee access across cases and apps
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={selected.size === 0}>
              <ChevronDown className="mr-2 h-4 w-4" />
              Bulk Revoke ({selected.size})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                if (confirm("Revoke all access for selected employees?")) {
                  selected.forEach((id) => {
                    // Would need per-employee revoke - for now show message
                    alert("Use Revoke All from employee detail view");
                  });
                }
              }}
            >
              <Shield className="mr-2 h-4 w-4" />
              Revoke All
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Lock className="mr-2 h-4 w-4" />
              Revoke Tokens
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Key className="mr-2 h-4 w-4" />
              Delete ASPs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      employees && employees.length > 0 &&
                      employees.every((e) => selected.has(e.employee_id))
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cases</TableHead>
                <TableHead>Active Artifacts</TableHead>
                <TableHead>Open Findings</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees?.map((emp) => (
                <TableRow key={emp.employee_id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(emp.employee_id)}
                      onCheckedChange={() => toggleOne(emp.employee_id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/employees?employee=${encodeURIComponent(emp.employee_id)}`}
                      className="text-primary hover:underline"
                    >
                      {emp.employee_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/employees?email=${encodeURIComponent(emp.company_email)}`}
                      className="text-primary hover:underline"
                    >
                      {emp.company_email}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={emp.emp_status === "Active" ? "default" : "destructive"}
                      className={
                        emp.emp_status === "Active"
                          ? "bg-green-600 text-white"
                          : undefined
                      }
                    >
                      {emp.emp_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{emp.case_count ?? 0}</TableCell>
                  <TableCell>{emp.active_artifacts ?? 0}</TableCell>
                  <TableCell>{emp.open_findings ?? 0}</TableCell>
                  <TableCell>
                    <Link
                      href={`/employees?employee=${encodeURIComponent(emp.employee_id)}`}
                    >
                      <Button variant="outline" size="sm">
                        <User className="mr-2 h-4 w-4" />
                        Details
                      </Button>
                    </Link>
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

export default function EmployeesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <EmployeesPageContent />
    </Suspense>
  );
}
