"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  useOAuthApps,
  useAppDetail,
  useRevokeAppForUsers,
  useRestoreAppForUsers,
  useUpdateScopes,
  useGlobalAppRemoval,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  MoreVertical,
  Lock,
  RotateCcw,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import type { AppUser } from "@/lib/dto/types";

function AppsPageContent() {
  const searchParams = useSearchParams();
  const clientIdParam = searchParams.get("client_id");

  const { data: apps, isLoading: loadingApps } = useOAuthApps();
  const { data: detail, isLoading: loadingDetail } = useAppDetail(
    clientIdParam ?? ""
  );

  const [activeSelected, setActiveSelected] = useState<Set<string>>(new Set());
  const [revokedSelected, setRevokedSelected] = useState<Set<string>>(new Set());
  const [manageScopesOpen, setManageScopesOpen] = useState(false);
  const [manageScopesUser, setManageScopesUser] = useState<AppUser | null>(
    null
  );
  const [scopeCheckboxes, setScopeCheckboxes] = useState<Record<string, boolean>>({});

  const revoke = useRevokeAppForUsers(clientIdParam ?? "");
  const restore = useRestoreAppForUsers(clientIdParam ?? "");
  const updateScopes = useUpdateScopes(clientIdParam ?? "");
  const globalRemoval = useGlobalAppRemoval();

  const activeUsers = useMemo(
    () => detail?.users?.filter((u) => u.status === "Active") ?? [],
    [detail]
  );
  const revokedUsers = useMemo(
    () =>
      detail?.users?.filter(
        (u) => u.status === "Revoked" || u.status === "Inactive"
      ) ?? [],
    [detail]
  );

  const openManageScopes = (user: AppUser) => {
    const initial: Record<string, boolean> = {};
    (user.raw_scopes ?? []).forEach((s) => {
      const name = s.split("/").pop() ?? s;
      initial[name] = true;
    });
    detail?.scopes?.forEach((s) => {
      if (!(s in initial)) initial[s] = false;
    });
    setScopeCheckboxes(initial);
    setManageScopesUser(user);
    setManageScopesOpen(true);
  };

  const handleSaveScopes = () => {
    if (!manageScopesUser) return;
    const scopes = Object.entries(scopeCheckboxes)
      .filter(([, v]) => v)
      .map(([k]) =>
        k.startsWith("https://") ? k : `https://www.googleapis.com/auth/${k}`
      );
    updateScopes.mutate(
      { artifactName: manageScopesUser.artifact_name, scopes },
      {
        onSuccess: () => {
          setManageScopesOpen(false);
          setManageScopesUser(null);
        },
      }
    );
  };

  const toggleActive = (artifactName: string) => {
    setActiveSelected((prev) => {
      const next = new Set(prev);
      if (next.has(artifactName)) next.delete(artifactName);
      else next.add(artifactName);
      return next;
    });
  };

  const toggleRevoked = (artifactName: string) => {
    setRevokedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(artifactName)) next.delete(artifactName);
      else next.add(artifactName);
      return next;
    });
  };

  const handleRevokeSelected = () => {
    const names = Array.from(activeSelected);
    if (names.length === 0) return;
    revoke.mutate(names, { onSuccess: () => setActiveSelected(new Set()) });
  };

  const handleRestoreSelected = () => {
    const names = Array.from(revokedSelected);
    if (names.length === 0) return;
    restore.mutate(names, { onSuccess: () => setRevokedSelected(new Set()) });
  };

  const handleGlobalRemoval = () => {
    if (!clientIdParam || !detail) return;
    if (
      confirm(
        `Revoke this app globally for ALL users? This will revoke ${detail.active_grants} grant(s).`
      )
    ) {
      globalRemoval.mutate({
        clientId: clientIdParam,
        appName: detail.app_name,
      });
    }
  };

  const showDetail = !!clientIdParam && (loadingDetail || detail);

  if (loadingApps && !showDetail) {
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
          <Link href="/apps">
            <Button variant="outline" size="sm">
              Back to Apps
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                variant="destructive"
                onClick={handleGlobalRemoval}
                disabled={globalRemoval.isPending}
              >
                <Shield className="mr-2 h-4 w-4" />
                Revoke Globally
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{detail.app_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Client ID: <code>{detail.client_id}</code>
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-2xl font-bold">{detail.active_grants}</p>
                <p className="text-sm text-muted-foreground">Active Grants</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{detail.revoked_grants}</p>
                <p className="text-sm text-muted-foreground">Revoked</p>
              </div>
            </div>
            {detail.scopes && detail.scopes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {detail.scopes.map((s) => (
                  <Badge
                    key={s}
                    variant={/send|modify|compose|write|admin|manage/i.test(s) ? "destructive" : "default"}
                    className={
                      /send|modify|compose|write|admin|manage/i.test(s)
                        ? undefined
                        : "bg-blue-500/90 text-white"
                    }
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Active Grants</CardTitle>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRevokeSelected}
              disabled={activeSelected.size === 0 || revoke.isPending}
            >
              {revoke.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              Revoke Selected ({activeSelected.size})
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeUsers.map((u) => (
                  <TableRow key={u.artifact_name}>
                    <TableCell>
                      <Checkbox
                        checked={activeSelected.has(u.artifact_name)}
                        onCheckedChange={() => toggleActive(u.artifact_name)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/employees?email=${encodeURIComponent(u.email)}`}
                        className="text-primary hover:underline"
                      >
                        {u.email}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{u.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.risk_level ? (
                        <Badge variant="destructive">{u.risk_level}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {u.scopes?.map((s) => s.scope).join(", ") || "-"}
                    </TableCell>
                    <TableCell>
                      {u.case ? (
                        <Link
                          href={`/cases/${u.case}`}
                          className="text-primary hover:underline"
                        >
                          {u.case}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openManageScopes(u)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Revoked / Inactive Grants</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestoreSelected}
              disabled={revokedSelected.size === 0 || restore.isPending}
            >
              {restore.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Restore Selected ({revokedSelected.size})
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revokedUsers.map((u) => (
                  <TableRow key={u.artifact_name}>
                    <TableCell>
                      <Checkbox
                        checked={revokedSelected.has(u.artifact_name)}
                        onCheckedChange={() => toggleRevoked(u.artifact_name)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/employees?email=${encodeURIComponent(u.email)}`}
                        className="text-primary hover:underline"
                      >
                        {u.email}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.risk_level ? (
                        <Badge variant="outline">{u.risk_level}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {u.scopes?.map((s) => s.scope).join(", ") || "-"}
                    </TableCell>
                    <TableCell>
                      {u.case ? (
                        <Link
                          href={`/cases/${u.case}`}
                          className="text-primary hover:underline"
                        >
                          {u.case}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openManageScopes(u)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={manageScopesOpen} onOpenChange={setManageScopesOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Scopes</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {manageScopesUser && (
                <p className="text-sm text-muted-foreground">
                  {manageScopesUser.email} — {manageScopesUser.artifact_name}
                </p>
              )}
              <div className="space-y-2">
                {detail?.scopes?.map((scope) => (
                  <div
                    key={scope}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id={`scope-${scope}`}
                      checked={scopeCheckboxes[scope] ?? false}
                      onCheckedChange={(v) =>
                        setScopeCheckboxes((prev) => ({
                          ...prev,
                          [scope]: !!v,
                        }))
                      }
                    />
                    <label
                      htmlFor={`scope-${scope}`}
                      className="text-sm cursor-pointer"
                    >
                      {scope}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManageScopesOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveScopes}
                disabled={updateScopes.isPending}
              >
                {updateScopes.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OAuth App Dashboard</h1>
        <p className="text-muted-foreground">
          Manage OAuth app grants and permissions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">OAuth Apps</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead>Active Grants</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Cases</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps?.map((app) => (
                <TableRow key={app.client_id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/apps?client_id=${encodeURIComponent(app.client_id)}`}
                      className="text-primary hover:underline"
                    >
                      {app.app_display_name || "Unknown"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{app.client_id}</code>
                  </TableCell>
                  <TableCell>{app.grant_count}</TableCell>
                  <TableCell>{app.user_count ?? "-"}</TableCell>
                  <TableCell>{app.case_count ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AppsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AppsPageContent />
    </Suspense>
  );
}
