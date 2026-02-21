"use client";

import { useState, Fragment } from "react";
import { useAuditLog } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function AuditLogPage() {
  const { data: entries, isLoading } = useAuditLog();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
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
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">
            Immutable record of all OGM actions and their outcomes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Log Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Action Type</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Target Email</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries
                  ?.filter((log, idx, arr) => arr.findIndex(l => l.name === log.name) === idx)
                  .map((log) => (
                  <Fragment key={log.name}>
                    <TableRow>
                      <TableCell>
                        {log.request_json && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(log.name); }}
                          >
                            {expanded.has(log.name) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{log.name}</TableCell>
                      <TableCell>{log.action_type}</TableCell>
                      <TableCell>{log.actor_user}</TableCell>
                      <TableCell>
                        <Link
                          href={`/employees?email=${encodeURIComponent(log.target_email)}`}
                          className="text-primary hover:underline"
                        >
                          {log.target_email}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.result === "Success"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {log.result}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              {log.timestamp
                                ? format(new Date(log.timestamp), "PPp")
                                : "-"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {log.timestamp}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    {expanded.has(log.name) && log.request_json && (
                      <TableRow key={`${log.name}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/50 p-4">
                          <p className="text-xs font-mono whitespace-pre-wrap break-all">
                            {log.request_json}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
