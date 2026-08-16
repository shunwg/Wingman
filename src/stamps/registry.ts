import type { StampEnv, StampProvider } from './contract';
import { bankidNo } from './providers/bankid-no';
import { emailDomain } from './providers/email-domain';
import { facebook } from './providers/facebook';
import { google } from './providers/google';
import { instagram } from './providers/instagram';
import { linkedin } from './providers/linkedin';

/**
 * The registry.
 *
 * Adding a provider is one import and one line in this array. Nothing else in
 * the app names a provider: screens render challenge *shapes*, the privacy
 * engine reads only the derived `AssuranceLevel`, and an ESLint rule bans
 * provider-id string literals under `screens/**` so the boundary cannot rot
 * quietly.
 *
 * Order is display order, and it is not arbitrary. Email domain comes first
 * because it is the one that opens circles, which is what most people are
 * actually here to do. BankID is second because it is the only stamp that
 * changes who can see you.
 */
export const PROVIDERS: readonly StampProvider[] = [
  emailDomain,
  bankidNo,
  linkedin,
  google,
  facebook,
  instagram,
];

export function providerById(id: string): StampProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/**
 * Which providers have real credentials.
 *
 * The mapping from "a key is present" to "this provider id is live" belongs
 * here rather than in the screen that reads `import.meta.env`. The screen hands
 * over booleans; the registry owns its own ids. Without this the screen has to
 * name every provider, which is the exact coupling the ESLint rule exists to
 * prevent — and secrets still never cross the purity gate, because only the
 * presence of a key is ever passed, never the key.
 */
export interface CredentialFlags {
  bankid?: boolean;
  linkedin?: boolean;
  google?: boolean;
  facebook?: boolean;
  instagram?: boolean;
}

export function configuredFrom(flags: CredentialFlags): string[] {
  const pairs: [keyof CredentialFlags, string][] = [
    ['bankid', bankidNo.id],
    ['linkedin', linkedin.id],
    ['google', google.id],
    ['facebook', facebook.id],
    ['instagram', instagram.id],
  ];
  return pairs.filter(([k]) => flags[k]).map(([, id]) => id);
}

export function availableProviders(env: StampEnv): StampProvider[] {
  return PROVIDERS.filter((p) => p.isAvailable(env));
}

/**
 * Whether a provider is running for real or standing in.
 *
 * Surfaced in the UI on purpose. A verification flow that looks identical
 * whether or not it did anything is how a demo gets mistaken for a product, and
 * the person deserves to know that the badge they just earned is a placeholder.
 */
export function isMocked(provider: StampProvider, env: StampEnv): boolean {
  return !env.configured.includes(provider.id) && provider.id !== 'email_otp';
}
