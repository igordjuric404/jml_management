"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  DashboardStats,
  OffboardingCase,
  CaseDetail,
  AccessArtifact,
  Finding,
  Employee,
  EmployeeDetail,
  OAuthAppSummary,
  AppDetail,
  ScanHistoryEntry,
  UnifiedAuditLogEntry,
  OGMSettings,
  RemediationResult,
} from "@/lib/dto/types";

interface ApiResponse<T> {
  status: string;
  data?: T;
  error?: string;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json: ApiResponse<T> = await res.json();
  if (json.status === "error") throw new Error(json.error || "API error");
  return json.data as T;
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Dashboard ──────────────────────────────────────────────
export function useDashboard() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch("/api/dashboard"),
  });
}

// ── Cases ──────────────────────────────────────────────────
export function useCases() {
  return useQuery<OffboardingCase[]>({
    queryKey: ["cases"],
    queryFn: () => apiFetch("/api/cases"),
  });
}

export function useCaseDetail(id: string) {
  return useQuery<CaseDetail>({
    queryKey: ["cases", id],
    queryFn: () => apiFetch(`/api/cases/${id}`),
    enabled: !!id,
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<OffboardingCase>) => apiPost("/api/cases", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Case created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateCaseFromEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) =>
      apiPost("/api/cases/from-employee", { employee_id: employeeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Case created from employee");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTriggerScan(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/api/cases/${caseId}/scan`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases", caseId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Scan triggered");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemediation(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { action: string; [key: string]: unknown }) =>
      apiPost<RemediationResult>(`/api/cases/${caseId}/remediate`, params),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["cases", caseId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Remediation completed: ${data.artifacts_remediated || data.revoked || data.deleted || 0} item(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRunScheduledRemediation(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<RemediationResult>(`/api/cases/${caseId}/scheduled-remediation`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Scheduled remediation completed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBulkRemediate(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (artifactNames: string[]) =>
      apiPost<RemediationResult>(`/api/cases/${caseId}/bulk-remediate`, {
        artifact_names: artifactNames,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Bulk remediation completed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSystemScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost("/api/scan", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success("System scan queued");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Artifacts ──────────────────────────────────────────────
export function useArtifacts(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters);
  return useQuery<AccessArtifact[]>({
    queryKey: ["artifacts", filters],
    queryFn: () => apiFetch(`/api/artifacts?${params.toString()}`),
  });
}

export function useRemediateArtifacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docnames: string[]) =>
      apiPost("/api/artifacts", { docnames: docnames }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["artifacts"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Artifacts remediated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Findings ───────────────────────────────────────────────
export function useFindings(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters);
  return useQuery<Finding[]>({
    queryKey: ["findings", filters],
    queryFn: () => apiFetch(`/api/findings?${params.toString()}`),
  });
}

// ── Employees ──────────────────────────────────────────────
export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => apiFetch("/api/employees"),
  });
}

export function useEmployeeDetail(id: string) {
  return useQuery<EmployeeDetail>({
    queryKey: ["employees", id],
    queryFn: () => apiFetch(`/api/employees/${id}`),
    enabled: !!id,
  });
}

export function useRevokeEmployeeAccess(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scope: string) =>
      apiPost(`/api/employees/${employeeId}/revoke`, { scope }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Employee access revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── OAuth Apps ─────────────────────────────────────────────
export function useOAuthApps() {
  return useQuery<OAuthAppSummary[]>({
    queryKey: ["apps"],
    queryFn: () => apiFetch("/api/apps"),
  });
}

export function useAppDetail(clientId: string) {
  return useQuery<AppDetail>({
    queryKey: ["apps", clientId],
    queryFn: () => apiFetch(`/api/apps/${encodeURIComponent(clientId)}`),
    enabled: !!clientId,
  });
}

export function useGlobalAppRemoval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { clientId: string; appName: string }) =>
      apiPost(`/api/apps/${encodeURIComponent(params.clientId)}/global-remove`, {
        app_name: params.appName,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apps"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("App globally revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeAppForUsers(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (artifactNames: string[]) =>
      apiPost(`/api/apps/${encodeURIComponent(clientId)}/revoke-users`, {
        artifact_names: artifactNames,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apps", clientId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("App revoked for selected users");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRestoreAppForUsers(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (artifactNames: string[]) =>
      apiPost(`/api/apps/${encodeURIComponent(clientId)}/restore-users`, {
        artifact_names: artifactNames,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apps", clientId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("App restored for selected users");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateScopes(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { artifactName: string; scopes: string[] }) =>
      apiPost(`/api/apps/${encodeURIComponent(clientId)}/update-scopes`, {
        artifact_name: params.artifactName,
        scopes: params.scopes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apps", clientId] });
      toast.success("Scopes updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Scan History ───────────────────────────────────────────
export function useScanHistory() {
  return useQuery<ScanHistoryEntry[]>({
    queryKey: ["scan-history"],
    queryFn: () => apiFetch("/api/scan/history"),
  });
}

// ── Audit Log ──────────────────────────────────────────────
export function useAuditLog() {
  return useQuery<UnifiedAuditLogEntry[]>({
    queryKey: ["audit-log"],
    queryFn: () => apiFetch("/api/audit-log"),
  });
}

// ── Settings ───────────────────────────────────────────────
export function useSettings() {
  return useQuery<OGMSettings>({
    queryKey: ["settings"],
    queryFn: () => apiFetch("/api/settings"),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<OGMSettings>) =>
      apiPatch<OGMSettings>("/api/settings", settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Chat ───────────────────────────────────────────────────
export function useChatMutation() {
  return useMutation({
    mutationFn: (message: string) =>
      apiPost<{ reply: string; sources: { title: string; url: string }[] }>(
        "/api/chat",
        { message }
      ),
    onError: (e: Error) => toast.error(e.message),
  });
}
