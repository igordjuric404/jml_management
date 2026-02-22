/**
 * Local data store for cases, findings, and audit log.
 *
 * Uses SQLite via Prisma. Frappe only stores employees.
 * Access artifacts come live from Microsoft Graph API.
 */

import { db } from "@/lib/db";
import type {
  OffboardingCase,
  Finding,
  UnifiedAuditLogEntry,
  OGMSettings,
} from "@/lib/dto/types";

export class LocalStore {
  // ── Cases ─────────────────────────────────────────────────

  async listCases(filters?: Record<string, unknown>): Promise<OffboardingCase[]> {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.primary_email) where.primaryEmail = filters.primary_email;

    const rows = await db.offboardingCase.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return rows.map(this.mapCase);
  }

  async getCase(id: string): Promise<OffboardingCase | null> {
    const row = await db.offboardingCase.findUnique({ where: { id } });
    return row ? this.mapCase(row) : null;
  }

  async createCase(data: Partial<OffboardingCase>): Promise<OffboardingCase> {
    const row = await db.offboardingCase.create({
      data: {
        employeeId: data.employee || "",
        employeeName: data.employee_name || "",
        primaryEmail: data.primary_email || "",
        eventType: data.event_type || "Offboard",
        effectiveDate: data.effective_date || null,
        status: data.status || "Draft",
        notes: data.notes || null,
      },
    });
    return this.mapCase(row);
  }

  async updateCase(id: string, data: Partial<OffboardingCase>): Promise<OffboardingCase> {
    const update: Record<string, unknown> = {};
    if (data.status !== undefined) update.status = data.status;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.effective_date !== undefined) update.effectiveDate = data.effective_date;
    if (data.event_type !== undefined) update.eventType = data.event_type;

    const row = await db.offboardingCase.update({ where: { id }, data: update });
    return this.mapCase(row);
  }

  async findCaseByEmail(email: string): Promise<OffboardingCase | null> {
    const row = await db.offboardingCase.findFirst({
      where: { primaryEmail: email },
      orderBy: { createdAt: "desc" },
    });
    return row ? this.mapCase(row) : null;
  }

  private mapCase(row: {
    id: string;
    employeeId: string;
    employeeName: string;
    primaryEmail: string;
    eventType: string;
    effectiveDate: string | null;
    status: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): OffboardingCase {
    return {
      name: row.id,
      employee: row.employeeId,
      employee_name: row.employeeName,
      primary_email: row.primaryEmail,
      event_type: row.eventType as OffboardingCase["event_type"],
      effective_date: row.effectiveDate || "",
      status: row.status as OffboardingCase["status"],
      notes: row.notes || undefined,
      notify_user_1w: false,
      notify_user_1d: false,
      creation: row.createdAt.toISOString(),
      modified: row.updatedAt.toISOString(),
    };
  }

  // ── Findings ──────────────────────────────────────────────

  async listFindings(filters?: Record<string, unknown>): Promise<Finding[]> {
    const where: Record<string, unknown> = {};
    if (filters?.case) where.caseId = filters.case;
    if (filters?.status === "Open") where.closedAt = null;

    const rows = await db.finding.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(this.mapFinding);
  }

  async getFinding(id: string): Promise<Finding | null> {
    const row = await db.finding.findUnique({ where: { id } });
    return row ? this.mapFinding(row) : null;
  }

  async createFinding(data: {
    caseId: string;
    findingType: string;
    severity: string;
    summary: string;
    subjectEmail: string;
    recommendedAction?: string;
  }): Promise<Finding> {
    const row = await db.finding.create({ data });
    return this.mapFinding(row);
  }

  async closeFinding(id: string): Promise<Finding> {
    const row = await db.finding.update({
      where: { id },
      data: { closedAt: new Date() },
    });
    return this.mapFinding(row);
  }

  async findingsForCase(caseId: string): Promise<Finding[]> {
    const rows = await db.finding.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(this.mapFinding);
  }

  private mapFinding(row: {
    id: string;
    caseId: string;
    findingType: string;
    severity: string;
    summary: string;
    subjectEmail: string;
    recommendedAction: string | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Finding {
    return {
      name: row.id,
      case: row.caseId,
      finding_type: row.findingType as Finding["finding_type"],
      severity: row.severity as Finding["severity"],
      summary: row.summary,
      recommended_action: row.recommendedAction || undefined,
      closed_at: row.closedAt?.toISOString() || undefined,
      creation: row.createdAt.toISOString(),
      modified: row.updatedAt.toISOString(),
    };
  }

  // ── Audit Log ─────────────────────────────────────────────

  async listAuditLogs(filters?: Record<string, unknown>): Promise<UnifiedAuditLogEntry[]> {
    const where: Record<string, unknown> = {};
    if (filters?.target_email) where.targetEmail = filters.target_email;
    if (filters?.action_type) where.actionType = filters.action_type;

    const rows = await db.auditLogEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(this.mapAuditLog);
  }

  async logAction(data: {
    caseId?: string;
    actorUser: string;
    actionType: string;
    targetEmail: string;
    result: string;
    remediationType?: string;
    requestJson?: string;
    responseJson?: string;
  }): Promise<void> {
    await db.auditLogEntry.create({ data });
  }

  private mapAuditLog(row: {
    id: string;
    caseId: string | null;
    actorUser: string;
    actionType: string;
    targetEmail: string;
    result: string;
    remediationType: string | null;
    requestJson: string | null;
    responseJson: string | null;
    createdAt: Date;
  }): UnifiedAuditLogEntry {
    return {
      name: row.id,
      actor_user: row.actorUser,
      action_type: row.actionType,
      target_email: row.targetEmail,
      result: row.result,
      remediation_type: row.remediationType || undefined,
      request_json: row.requestJson || undefined,
      response_json: row.responseJson || undefined,
      timestamp: row.createdAt.toISOString(),
      creation: row.createdAt.toISOString(),
    };
  }

  // ── Settings ──────────────────────────────────────────────

  async getSettings(): Promise<OGMSettings> {
    const row = await db.appSettings.findUnique({ where: { id: "singleton" } });
    if (!row) {
      await db.appSettings.create({ data: { id: "singleton" } });
      return this.defaultSettings();
    }
    return {
      auto_scan_on_offboard: row.autoScanOnOffboard,
      auto_remediate_on_offboard: row.autoRemediateOnOffboard,
      background_scan_enabled: row.backgroundScanEnabled,
      auto_create_case_on_leave: row.autoCreateCaseOnLeave,
      background_scan_interval: row.backgroundScanInterval,
      remediation_check_interval: row.remediationCheckInterval,
      notify_on_new_findings: row.notifyOnNewFindings,
      notify_on_remediation: row.notifyOnRemediation,
      notification_email: row.notificationEmail || undefined,
      default_remediation_action: row.defaultRemediationAction,
    };
  }

  async updateSettings(s: Partial<OGMSettings>): Promise<OGMSettings> {
    const data: Record<string, unknown> = {};
    if (s.auto_scan_on_offboard !== undefined) data.autoScanOnOffboard = s.auto_scan_on_offboard;
    if (s.auto_remediate_on_offboard !== undefined) data.autoRemediateOnOffboard = s.auto_remediate_on_offboard;
    if (s.background_scan_enabled !== undefined) data.backgroundScanEnabled = s.background_scan_enabled;
    if (s.auto_create_case_on_leave !== undefined) data.autoCreateCaseOnLeave = s.auto_create_case_on_leave;
    if (s.background_scan_interval !== undefined) data.backgroundScanInterval = s.background_scan_interval;
    if (s.notification_email !== undefined) data.notificationEmail = s.notification_email;

    await db.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });
    return this.getSettings();
  }

  private defaultSettings(): OGMSettings {
    return {
      auto_scan_on_offboard: false,
      auto_remediate_on_offboard: false,
      background_scan_enabled: false,
      auto_create_case_on_leave: true,
      background_scan_interval: "daily",
      remediation_check_interval: "6h",
      notify_on_new_findings: true,
      notify_on_remediation: true,
      default_remediation_action: "full_bundle",
    };
  }
}

let _store: LocalStore | null = null;
export function getLocalStore(): LocalStore {
  if (!_store) _store = new LocalStore();
  return _store;
}
