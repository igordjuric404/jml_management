import type { HrProvider } from "./interface";
import { FrappeProvider } from "./frappe/provider";
import { MockProvider } from "./frappe/mock-provider";

export type { HrProvider, AuthSession, ProviderType } from "./interface";

/**
 * FallbackProvider wraps FrappeProvider — if any Frappe call fails
 * (e.g. Frappe is down), it transparently falls back to MockProvider.
 */
class FallbackProvider implements HrProvider {
  readonly name = "fallback";
  private frappe = new FrappeProvider();
  private mock = new MockProvider();
  private frappeHealthy = true;

  private async try<T>(frappeCall: () => Promise<T>, mockCall: () => Promise<T>): Promise<T> {
    if (!this.frappeHealthy) return mockCall();
    try {
      return await frappeCall();
    } catch {
      this.frappeHealthy = false;
      setTimeout(() => { this.frappeHealthy = true; }, 30_000);
      return mockCall();
    }
  }

  authenticate = (u: string, p: string) => this.try(() => this.frappe.authenticate(u, p), () => this.mock.authenticate(u, p));
  logout = () => this.try(() => this.frappe.logout(), () => this.mock.logout());
  getSession = () => this.try(() => this.frappe.getSession(), () => this.mock.getSession());
  getDashboardStats = () => this.try(() => this.frappe.getDashboardStats(), () => this.mock.getDashboardStats());
  getStatistics = () => this.try(() => this.frappe.getStatistics(), () => this.mock.getStatistics());
  listCases = (f?: Record<string, unknown>) => this.try(() => this.frappe.listCases(f), () => this.mock.listCases(f));
  getCaseDetail = (n: string) => this.try(() => this.frappe.getCaseDetail(n), () => this.mock.getCaseDetail(n));
  createCase = (d: Parameters<HrProvider["createCase"]>[0]) => this.try(() => this.frappe.createCase(d), () => this.mock.createCase(d));
  createCaseFromEmployee = (id: string) => this.try(() => this.frappe.createCaseFromEmployee(id), () => this.mock.createCaseFromEmployee(id));
  updateCase = (n: string, d: Parameters<HrProvider["updateCase"]>[1]) => this.try(() => this.frappe.updateCase(n, d), () => this.mock.updateCase(n, d));
  triggerScan = (n: string) => this.try(() => this.frappe.triggerScan(n), () => this.mock.triggerScan(n));
  systemScan = () => this.try(() => this.frappe.systemScan(), () => this.mock.systemScan());
  getScanHistory = () => this.try(() => this.frappe.getScanHistory(), () => this.mock.getScanHistory());
  executeRemediation = (c: string, a: string, k?: Record<string, unknown>) => this.try(() => this.frappe.executeRemediation(c, a, k), () => this.mock.executeRemediation(c, a, k));
  bulkRemediate = (c: string, a: string[]) => this.try(() => this.frappe.bulkRemediate(c, a), () => this.mock.bulkRemediate(c, a));
  remediateArtifacts = (d: string[]) => this.try(() => this.frappe.remediateArtifacts(d), () => this.mock.remediateArtifacts(d));
  runScheduledRemediationNow = (c: string) => this.try(() => this.frappe.runScheduledRemediationNow(c), () => this.mock.runScheduledRemediationNow(c));
  listArtifacts = (f?: Record<string, unknown>) => this.try(() => this.frappe.listArtifacts(f), () => this.mock.listArtifacts(f));
  getArtifact = (n: string) => this.try(() => this.frappe.getArtifact(n), () => this.mock.getArtifact(n));
  listFindings = (f?: Record<string, unknown>) => this.try(() => this.frappe.listFindings(f), () => this.mock.listFindings(f));
  getFinding = (n: string) => this.try(() => this.frappe.getFinding(n), () => this.mock.getFinding(n));
  remediateFinding = (n: string) => this.try(() => this.frappe.remediateFinding(n), () => this.mock.remediateFinding(n));
  getEmployeeList = () => this.try(() => this.frappe.getEmployeeList(), () => this.mock.getEmployeeList());
  getEmployeeDetail = (id: string) => this.try(() => this.frappe.getEmployeeDetail(id), () => this.mock.getEmployeeDetail(id));
  revokeEmployeeAccess = (id: string, s: string) => this.try(() => this.frappe.revokeEmployeeAccess(id, s), () => this.mock.revokeEmployeeAccess(id, s));
  getAllActiveOAuthApps = () => this.try(() => this.frappe.getAllActiveOAuthApps(), () => this.mock.getAllActiveOAuthApps());
  getAppDetail = (c: string) => this.try(() => this.frappe.getAppDetail(c), () => this.mock.getAppDetail(c));
  globalAppRemoval = (c: string, a: string) => this.try(() => this.frappe.globalAppRemoval(c, a), () => this.mock.globalAppRemoval(c, a));
  revokeAppForUsers = (c: string, a: string[]) => this.try(() => this.frappe.revokeAppForUsers(c, a), () => this.mock.revokeAppForUsers(c, a));
  restoreAppForUsers = (c: string, a: string[]) => this.try(() => this.frappe.restoreAppForUsers(c, a), () => this.mock.restoreAppForUsers(c, a));
  updateUserScopes = (a: string, s: string[]) => this.try(() => this.frappe.updateUserScopes(a, s), () => this.mock.updateUserScopes(a, s));
  listAuditLogs = (f?: Record<string, unknown>) => this.try(() => this.frappe.listAuditLogs(f), () => this.mock.listAuditLogs(f));
  getSettings = () => this.try(() => this.frappe.getSettings(), () => this.mock.getSettings());
  updateSettings = (s: Parameters<HrProvider["updateSettings"]>[0]) => this.try(() => this.frappe.updateSettings(s), () => this.mock.updateSettings(s));
  chat = (m: string) => this.try(() => this.frappe.chat(m), () => this.mock.chat(m));
}

let providerInstance: HrProvider | null = null;

export function getProvider(): HrProvider {
  if (providerInstance) return providerInstance;
  providerInstance = new FallbackProvider();
  return providerInstance;
}

export function resetProvider() {
  providerInstance = null;
}
