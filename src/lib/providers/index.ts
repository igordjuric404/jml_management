import type { HrProvider } from "./interface";
import { FrappeProvider } from "./frappe/provider";
import { MockProvider } from "./frappe/mock-provider";

export type { HrProvider, AuthSession, ProviderType } from "./interface";

let providerInstance: HrProvider | null = null;

export function getProvider(): HrProvider {
  if (providerInstance) return providerInstance;

  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true" ||
    process.env.NODE_ENV === "development" && !process.env.FRAPPE_API_KEY;

  providerInstance = useMock ? new MockProvider() : new FrappeProvider();
  return providerInstance;
}

export function resetProvider() {
  providerInstance = null;
}
