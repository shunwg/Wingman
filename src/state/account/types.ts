import type { ISODateTime } from '@domain/index';

/**
 * How this device came to have a person on it.
 *
 *   none  — fresh install; the welcome screen is next.
 *   local — someone created a profile here. It lives on this device only.
 *   demo  — the seeded cast, entered from the welcome screen or #/demo.
 */
export type AccountMode = 'none' | 'local' | 'demo';

export interface Account {
  mode: AccountMode;
  /**
   * Minted once per install. Seeds the blank portrait so two strangers do not
   * get the same face, and becomes the anonymous id the day a backend arrives.
   */
  deviceId: string;
  /**
   * The seam. Everything that knows where an account lives reads this and
   * nothing else does, so swapping 'device' for a hosted provider later is a
   * change to three actions in the store, not to any screen.
   */
  provider: 'device';
  createdAt?: ISODateTime;
  /**
   * Where to go once onboarding is done — an invitation someone opened before
   * they had a profile, e.g. '#/join/ABC123'. Persisted, not in memory, because
   * BankID on a phone leaves the page and a refresh mid-signup must not lose
   * the invitation.
   */
  returnTo?: string;
}
