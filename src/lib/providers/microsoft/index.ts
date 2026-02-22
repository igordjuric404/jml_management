export { MicrosoftGraphClient, GraphApiError } from "./graph-client";
export { MicrosoftRemediationService, getMicrosoftRemediationService, resetMicrosoftRemediationService } from "./remediation-service";
export { MicrosoftEnhancedProvider } from "./enhanced-provider";
export { getMicrosoftConfig, isMicrosoftConfigured, REQUIRED_GRAPH_PERMISSIONS } from "./config";
export type {
  GraphClientConfig,
  MSGraphUser,
  MSGraphOAuth2PermissionGrant,
  MSGraphAppRoleAssignment,
  MSGraphSignIn,
  MSGraphServicePrincipal,
  RemediationActionResult,
} from "./types";
