export type DeploymentStatus = "submitted" | "provisioning" | "ready" | "failed";

export interface DeploymentRecord {
  deployment_id: string;
  status: DeploymentStatus;
  vm_id?: string;
  vm_hostname?: string;
  gateway_token?: string;
  telegram_enabled: boolean;
  telegram_bot_username?: string;
  error_message?: string;
  created_at: string;
  provisioned_at?: string;
}

export interface RenderConfig {
  vmHostname?: string;
  anthropicApiKey: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  deploymentId?: string;
  gatewayToken?: string;
  welcomeAtIso?: string;
}

export interface RenderResult {
  compose: string;
  openclawJson: string;
  cronJobsJson: string;
  workspace: Record<string, string>;
  deploymentId: string;
  gatewayToken: string;
  telegramEnabled: boolean;
}

export interface FormSubmission {
  tier: "byo";
  secretaiApiKey: string;
  anthropicApiKey: string;
  telegramEnabled: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramBotUsername?: string;
}
