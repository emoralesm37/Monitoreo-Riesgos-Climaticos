export type ExternalProvider = 'google' | 'github';

export interface ExternalProfile {
  provider: ExternalProvider;
  providerUserId: string;
  email: string;
  name: string;
}