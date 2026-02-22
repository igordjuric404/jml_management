import type { HrProvider } from "./interface";
import { UnifiedProvider } from "./unified-provider";

export type { HrProvider, AuthSession, ProviderType } from "./interface";

let providerInstance: HrProvider | null = null;

/**
 * Get the application provider.
 *
 * Architecture:
 * - Frappe → Employee records only (HR source of truth)
 * - Microsoft Graph API → Real OAuth grants, app roles (live queries)
 * - Local SQLite → Cases, findings, audit logs, settings
 */
export function getProvider(): HrProvider {
  if (providerInstance) return providerInstance;
  providerInstance = new UnifiedProvider();
  return providerInstance;
}

export function resetProvider() {
  providerInstance = null;
}
