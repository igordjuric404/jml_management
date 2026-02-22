/**
 * Microsoft 365 Discovery Service.
 *
 * Queries the Microsoft Graph API to discover REAL OAuth grants, app role
 * assignments, and sign-in activity for a given user email.
 * Returns data mapped to the application's AccessArtifact format.
 */

import { MicrosoftGraphClient } from "./graph-client";
import { getMicrosoftConfig } from "./config";
import type {
  MSGraphOAuth2PermissionGrant,
  MSGraphAppRoleAssignment,
  MSGraphServicePrincipal,
  MSGraphUser,
} from "./types";
import type { AccessArtifact, Finding } from "@/lib/dto/types";

export interface LicensedApp {
  name: string;
  servicePlanName: string;
  category: "email" | "collaboration" | "storage" | "productivity" | "security" | "other";
  riskLevel: "Low" | "Medium" | "High";
}

/**
 * Maps M365 service plan names to user-facing app names.
 * First-party M365 apps don't create OAuth grants — access is
 * governed by the license. This mapping lets the discovery service
 * surface these apps as artifacts.
 */
const SERVICE_PLAN_TO_APP: Record<string, LicensedApp> = {
  EXCHANGE_S_STANDARD: { name: "Microsoft Outlook", servicePlanName: "EXCHANGE_S_STANDARD", category: "email", riskLevel: "High" },
  EXCHANGE_S_ENTERPRISE: { name: "Microsoft Outlook", servicePlanName: "EXCHANGE_S_ENTERPRISE", category: "email", riskLevel: "High" },
  MCOSTANDARD: { name: "Microsoft Teams", servicePlanName: "MCOSTANDARD", category: "collaboration", riskLevel: "Medium" },
  TEAMS1: { name: "Microsoft Teams", servicePlanName: "TEAMS1", category: "collaboration", riskLevel: "Medium" },
  SHAREPOINTSTANDARD: { name: "SharePoint Online", servicePlanName: "SHAREPOINTSTANDARD", category: "storage", riskLevel: "High" },
  SHAREPOINTENTERPRISE: { name: "SharePoint Online", servicePlanName: "SHAREPOINTENTERPRISE", category: "storage", riskLevel: "High" },
  SHAREPOINTWAC: { name: "Office for the Web", servicePlanName: "SHAREPOINTWAC", category: "productivity", riskLevel: "Low" },
  OFFICE_BUSINESS: { name: "Microsoft 365 Apps", servicePlanName: "OFFICE_BUSINESS", category: "productivity", riskLevel: "Medium" },
  OFFICESUBSCRIPTION: { name: "Microsoft 365 Apps", servicePlanName: "OFFICESUBSCRIPTION", category: "productivity", riskLevel: "Medium" },
  SWAY: { name: "Sway", servicePlanName: "SWAY", category: "productivity", riskLevel: "Low" },
  YAMMER_ENTERPRISE: { name: "Yammer", servicePlanName: "YAMMER_ENTERPRISE", category: "collaboration", riskLevel: "Low" },
  PROJECTWORKMANAGEMENT: { name: "Microsoft Planner", servicePlanName: "PROJECTWORKMANAGEMENT", category: "productivity", riskLevel: "Low" },
  MICROSOFTBOOKINGS: { name: "Microsoft Bookings", servicePlanName: "MICROSOFTBOOKINGS", category: "productivity", riskLevel: "Low" },
  FORMS_PLAN_E1: { name: "Microsoft Forms", servicePlanName: "FORMS_PLAN_E1", category: "productivity", riskLevel: "Low" },
  STREAM_O365_SMB: { name: "Microsoft Stream", servicePlanName: "STREAM_O365_SMB", category: "collaboration", riskLevel: "Low" },
  POWERAPPS_O365_P1: { name: "Power Apps", servicePlanName: "POWERAPPS_O365_P1", category: "productivity", riskLevel: "Medium" },
  FLOW_O365_P1: { name: "Power Automate", servicePlanName: "FLOW_O365_P1", category: "productivity", riskLevel: "Medium" },
  Bing_Chat_Enterprise: { name: "Microsoft Copilot", servicePlanName: "Bing_Chat_Enterprise", category: "productivity", riskLevel: "Medium" },
  MICROSOFT_LOOP: { name: "Microsoft Loop", servicePlanName: "MICROSOFT_LOOP", category: "collaboration", riskLevel: "Low" },
};

export interface DiscoveryResult {
  user: MSGraphUser | null;
  artifacts: AccessArtifact[];
  findings: Finding[];
  raw: {
    oauthGrants: MSGraphOAuth2PermissionGrant[];
    appRoleAssignments: MSGraphAppRoleAssignment[];
    licensedApps: LicensedApp[];
  };
  error?: string;
}

const spCache = new Map<string, MSGraphServicePrincipal | null>();

let _instance: MicrosoftDiscoveryService | null = null;

export function getMicrosoftDiscoveryService(): MicrosoftDiscoveryService {
  if (_instance) return _instance;
  _instance = new MicrosoftDiscoveryService();
  return _instance;
}

export class MicrosoftDiscoveryService {
  private graphClient: MicrosoftGraphClient | null = null;

  constructor(graphClient?: MicrosoftGraphClient) {
    if (graphClient) {
      this.graphClient = graphClient;
      return;
    }
    const config = getMicrosoftConfig();
    if (config) {
      this.graphClient = new MicrosoftGraphClient(config);
    }
  }

  get isConfigured(): boolean {
    return this.graphClient !== null;
  }

  /**
   * Discover all Microsoft 365 access for a user by email.
   * Queries Graph API for OAuth grants, app role assignments, and resolves
   * service principal names. Returns data mapped to AccessArtifact format.
   */
  async discoverUserAccess(
    email: string,
    caseName?: string,
  ): Promise<DiscoveryResult> {
    if (!this.graphClient) {
      return {
        user: null,
        artifacts: [],
        findings: [],
        raw: { oauthGrants: [], appRoleAssignments: [], licensedApps: [] },
        error: "Microsoft 365 not configured",
      };
    }

    const user = await this.graphClient.getUser(email);
    if (!user) {
      return {
        user: null,
        artifacts: [],
        findings: [],
        raw: { oauthGrants: [], appRoleAssignments: [], licensedApps: [] },
        error: `User not found in Azure AD: ${email}`,
      };
    }

    const [oauthGrants, appRoleAssignments, licenses] = await Promise.all([
      this.graphClient.listUserOAuthGrants(user.id).catch(() => []),
      this.graphClient.listUserAppRoleAssignments(user.id).catch(() => []),
      this.graphClient.getUserLicenseDetails(email).catch(() => []),
    ]);

    const spIds = new Set<string>();
    for (const g of oauthGrants) spIds.add(g.clientId);
    for (const a of appRoleAssignments) spIds.add(a.resourceId);
    await this.resolveServicePrincipals([...spIds]);

    const artifacts: AccessArtifact[] = [];
    const caseRef = caseName || "";
    const now = new Date().toISOString();

    // OAuth2 delegated permission grants (third-party apps)
    for (const grant of oauthGrants) {
      const sp = spCache.get(grant.clientId);
      const scopes = grant.scope?.split(" ").filter(Boolean) || [];
      const riskLevel = this.assessOAuthRisk(scopes);

      artifacts.push({
        name: `ms-grant-${grant.id}`,
        case: caseRef,
        artifact_type: "OAuthToken",
        subject_email: email,
        status: "Active",
        app_display_name: sp?.displayName || `ServicePrincipal:${grant.clientId}`,
        client_id: sp?.appId || grant.clientId,
        risk_level: riskLevel,
        scopes_json: JSON.stringify(scopes),
        metadata_json: JSON.stringify({
          graph_grant_id: grant.id,
          consent_type: grant.consentType,
          resource_id: grant.resourceId,
          principal_id: grant.principalId,
          source: "microsoft_graph",
          artifact_kind: "oauth_grant",
        }),
        creation: now,
        modified: now,
      });
    }

    // App role assignments (enterprise app assignments)
    for (const assignment of appRoleAssignments) {
      artifacts.push({
        name: `ms-role-${assignment.id}`,
        case: caseRef,
        artifact_type: "OAuthToken",
        subject_email: email,
        status: "Active",
        app_display_name: assignment.resourceDisplayName || `App:${assignment.resourceId}`,
        client_id: assignment.resourceId,
        risk_level: "Medium",
        scopes_json: JSON.stringify([`AppRole:${assignment.appRoleId}`]),
        metadata_json: JSON.stringify({
          graph_assignment_id: assignment.id,
          app_role_id: assignment.appRoleId,
          principal_type: assignment.principalType,
          created: assignment.createdDateTime,
          source: "microsoft_graph",
          artifact_kind: "app_role_assignment",
        }),
        creation: assignment.createdDateTime || now,
        modified: now,
      });
    }

    // M365 licensed apps (first-party apps that don't create OAuth grants)
    const licensedApps: LicensedApp[] = [];
    const seenApps = new Set<string>();
    for (const lic of licenses) {
      for (const plan of lic.servicePlans || []) {
        if (plan.provisioningStatus !== "Success") continue;
        const app = SERVICE_PLAN_TO_APP[plan.servicePlanName];
        if (app && !seenApps.has(app.name)) {
          seenApps.add(app.name);
          licensedApps.push(app);

          artifacts.push({
            name: `ms-license-${lic.skuId}-${plan.servicePlanName}`,
            case: caseRef,
            artifact_type: "OAuthToken",
            subject_email: email,
            status: "Active",
            app_display_name: app.name,
            client_id: `license:${plan.servicePlanName}`,
            risk_level: app.riskLevel,
            scopes_json: JSON.stringify([`License:${plan.servicePlanName}`]),
            metadata_json: JSON.stringify({
              sku_id: lic.skuId,
              sku_part_number: lic.skuPartNumber,
              service_plan_name: plan.servicePlanName,
              category: app.category,
              source: "microsoft_graph",
              artifact_kind: "licensed_app",
              note: "First-party M365 app — access governed by license, not OAuth consent",
            }),
            creation: now,
            modified: now,
          });
        }
      }
    }

    const findings = this.generateFindings(email, artifacts, caseRef, user);

    return {
      user,
      artifacts,
      findings,
      raw: { oauthGrants, appRoleAssignments, licensedApps },
    };
  }

  /**
   * Discover all access across ALL tenant users.
   * Used for system-wide scans.
   */
  async discoverAllUsersAccess(
    emails: string[],
  ): Promise<Map<string, DiscoveryResult>> {
    const results = new Map<string, DiscoveryResult>();
    for (const email of emails) {
      try {
        results.set(email, await this.discoverUserAccess(email));
      } catch (err) {
        results.set(email, {
          user: null,
          artifacts: [],
          findings: [],
          raw: { oauthGrants: [], appRoleAssignments: [], licensedApps: [] },
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }

  /**
   * Quick check: does this user have any active access in Microsoft 365?
   */
  async hasActiveAccess(email: string): Promise<boolean> {
    if (!this.graphClient) return false;
    const user = await this.graphClient.getUser(email);
    if (!user) return false;

    const [grants, roles] = await Promise.all([
      this.graphClient.listUserOAuthGrants(user.id).catch(() => []),
      this.graphClient.listUserAppRoleAssignments(user.id).catch(() => []),
    ]);

    return grants.length > 0 || roles.length > 0;
  }

  private async resolveServicePrincipals(ids: string[]): Promise<void> {
    if (!this.graphClient) return;

    const unresolved = ids.filter((id) => !spCache.has(id));
    await Promise.all(
      unresolved.map(async (id) => {
        try {
          const sp = await this.graphClient!.getServicePrincipal(id);
          spCache.set(id, sp);
        } catch {
          spCache.set(id, null);
        }
      }),
    );
  }

  private assessOAuthRisk(
    scopes: string[],
  ): "Low" | "Medium" | "High" | "Critical" {
    const highRiskPatterns = [
      "Mail.ReadWrite", "Mail.Send", "Files.ReadWrite.All",
      "Directory.ReadWrite.All", "User.ReadWrite.All",
      "Sites.ReadWrite.All", "MailboxSettings.ReadWrite",
    ];
    const criticalPatterns = [
      "full_access_as_app", "Exchange.ManageAsApp",
      "RoleManagement.ReadWrite.Directory",
    ];

    const scopeStr = scopes.join(" ");

    if (criticalPatterns.some((p) => scopeStr.includes(p))) return "Critical";
    if (highRiskPatterns.some((p) => scopeStr.includes(p))) return "High";
    if (scopes.some((s) => s.includes("Write") || s.includes("ReadWrite"))) return "Medium";
    return "Low";
  }

  private generateFindings(
    email: string,
    artifacts: AccessArtifact[],
    caseName: string,
    user: MSGraphUser,
  ): Finding[] {
    const findings: Finding[] = [];
    const now = new Date().toISOString();
    const activeArtifacts = artifacts.filter((a) => a.status === "Active");

    if (activeArtifacts.length > 0 && !user.accountEnabled) {
      findings.push({
        name: `fnd-disabled-access-${Date.now()}`,
        case: caseName,
        finding_type: "LingeringOAuthGrant",
        severity: "High",
        summary: `${activeArtifacts.length} active OAuth grant(s) found for disabled account ${email}`,
        recommended_action: "Revoke all OAuth grants and sign-in sessions",
        creation: now,
        modified: now,
      });
    }

    if (activeArtifacts.length > 0) {
      const highRisk = activeArtifacts.filter(
        (a) => a.risk_level === "High" || a.risk_level === "Critical",
      );
      if (highRisk.length > 0) {
        findings.push({
          name: `fnd-high-risk-${Date.now()}`,
          case: caseName,
          finding_type: "LingeringOAuthGrant",
          severity: "Critical",
          summary: `${highRisk.length} high/critical risk OAuth grant(s) for ${email}: ${highRisk.map((a) => a.app_display_name).join(", ")}`,
          recommended_action: "Immediately revoke high-risk grants",
          creation: now,
          modified: now,
        });
      }
    }

    return findings;
  }
}
