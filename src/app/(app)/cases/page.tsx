"use client";

import { useState } from "react";
import {
  useCases,
  useCreateCaseFromEmployee,
  useEmployees,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Draft: "secondary",
  Scheduled: "default",
  "Gaps Found": "destructive",
  "All Clear": "default",
  Remediated: "default",
  Closed: "secondary",
};

function StatusBadge({ status }: { status: string }) {
  const variant = statusVariant[status] ?? "secondary";
  const className =
    status === "Scheduled"
      ? "bg-blue-500/90 text-white border-blue-600"
      : status === "All Clear" || status === "Remediated"
        ? "bg-green-600 text-white border-green-700"
        : undefined;
  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  );
}

export default function CasesPage() {
  const { data: cases, isLoading } = useCases();
  const { data: employees } = useEmployees();
  const createCase = useCreateCaseFromEmployee();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");

  const handleCreate = () => {
    if (!selectedEmployee) return;
    createCase.mutate(selectedEmployee, {
      onSuccess: () => {
        setDialogOpen(false);
        setSelectedEmployee("");
      },
    });
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
          <h1 className="text-2xl font-bold">Offboarding Cases</h1>
          <p className="text-muted-foreground">
            Manage access review and remediation cases
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Case
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Scheduled Remediation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases?.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/cases/${c.name}`}
                      className="text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/employees?employee=${encodeURIComponent(c.employee)}`}
                      className="text-primary hover:underline"
                    >
                      {c.employee_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/employees?email=${encodeURIComponent(c.primary_email)}`}
                      className="text-primary hover:underline"
                    >
                      {c.primary_email}
                    </Link>
                  </TableCell>
                  <TableCell>{c.event_type}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>
                    {c.effective_date
                      ? format(new Date(c.effective_date), "PP")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {c.scheduled_remediation_date
                      ? format(
                          new Date(c.scheduled_remediation_date),
                          "PP"
                        )
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Offboarding Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee</label>
              <Select
                value={selectedEmployee}
                onValueChange={setSelectedEmployee}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map((emp) => (
                    <SelectItem
                      key={emp.employee_id}
                      value={emp.employee_id}
                    >
                      {emp.employee_name} ({emp.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!selectedEmployee || createCase.isPending}
            >
              {createCase.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Case"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
