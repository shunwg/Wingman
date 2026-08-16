/**
 * The approval-stamps engine — public entry.
 *
 * Screens import from here and nowhere deeper. `scripts/check-boundaries.ts`
 * fails the build on `@stamps/providers/anything`, because a screen that knows
 * a provider's file path is a screen that will end up switching on its name.
 */

export type {
  BeginInput,
  ChallengeMode,
  CompleteInput,
  InputPrompt,
  PollState,
  StampChallenge,
  StampEnv,
  StampProvider,
  StampResult,
} from './contract';

export { addMinutes } from './contract';
export type { CredentialFlags } from './registry';
export {
  PROVIDERS,
  availableProviders,
  configuredFrom,
  isMocked,
  providerById,
} from './registry';
export { assuranceOf, isActive, lapsed, revoke } from './assurance';
export { domainOf, mockCodeFor } from './providers/email-domain';
