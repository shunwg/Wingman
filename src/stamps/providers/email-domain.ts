import { asVerificationId } from '@domain/ids';
import { asUtc } from '@domain/time';
import { addMinutes, type StampProvider } from '../contract';

/**
 * Email domain.
 *
 * Commercially the most important provider on the list, and the cheapest to
 * run. It is what admits someone to a circle, and a circle is what a school or
 * a conference actually buys. BankID costs money per check and proves the wrong
 * thing for this purpose — INSEAD does not need to know you are a legal person,
 * it needs to know you hold an `@insead.edu` address.
 *
 * Two steps, one shape: ask for the address, then ask for the code that was
 * sent to it. Both are `input`, so one renderer covers the whole flow.
 *
 * Only the domain is ever stored. The local part is the personal half of an
 * address and the product has no use for it — "someone at insead.edu" is the
 * entire claim being made.
 */

const EMAIL = /^[^\s@]+@([^\s@]+\.[^\s@]{2,})$/;

/** Free providers prove nothing about affiliation, which is the whole point. */
const CONSUMER_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
]);

export function domainOf(address: string): string | null {
  const m = EMAIL.exec(address.trim().toLowerCase());
  return m?.[1] ?? null;
}

/** Deterministic six digits — a mock's code, never a real one. */
function codeFor(sessionId: string): string {
  let h = 2166136261;
  for (let i = 0; i < sessionId.length; i++) {
    h = Math.imul(h ^ sessionId.charCodeAt(i), 16777619) >>> 0;
  }
  return String(h % 1_000_000).padStart(6, '0');
}

export const emailDomain: StampProvider = {
  id: 'email_otp',
  kind: 'email_domain',
  assurance: 2,
  display: {
    label: 'Work or school email',
    iconKey: 'mail',
    tone: 'trust',
    explainer: 'You confirmed an address on this domain. We keep the domain, never the address.',
    publicLabel: 'Verified affiliation',
  },
  unlocks: 'Opens circles that admit by domain — your school, your employer, a conference.',
  modes: ['input'],

  // No credentials needed beyond the ability to send mail, so this is the one
  // provider that is always available.
  isAvailable: () => true,

  begin: (input) => ({
    mode: 'input',
    providerId: 'email_otp',
    sessionId: input.sessionId,
    expiresAt: addMinutes(input.now, 20),
    prompt: {
      label: 'Your work or school address',
      placeholder: 'you@insead.edu',
      hint: 'We store the domain only — never the part before the @.',
      kind: 'email',
      validate: (value: string) => {
        const domain = domainOf(value);
        if (!domain) return { ok: false, message: 'That does not look like an email address.' };
        if (CONSUMER_DOMAINS.has(domain)) {
          return {
            ok: false,
            message: `${domain} is a personal address, so it cannot prove where you work or study.`,
          };
        }
        return { ok: true };
      },
    },
    waitingCopy: 'Check your inbox for a six-digit code.',
  }),

  complete: ({ challenge, personId, now, recordId, answer }) => {
    if (challenge.providerId !== 'email_otp') {
      return { ok: false, error: 'This challenge belongs to a different provider.' };
    }
    if (now > challenge.expiresAt) {
      return { ok: false, error: 'That code has expired. Send yourself a new one.' };
    }

    // `answer` arrives as "address|code" — the screen carries the address it
    // already validated through the second step so the provider stays stateless.
    const [address = '', code = ''] = (answer ?? '').split('|');
    const domain = domainOf(address);
    if (!domain) return { ok: false, error: 'That does not look like an email address.' };
    if (code.trim() !== codeFor(challenge.sessionId)) {
      return { ok: false, error: 'That code does not match. Check the most recent email.' };
    }

    return {
      ok: true,
      record: {
        id: asVerificationId(recordId),
        personId,
        providerId: 'email_otp',
        kind: 'email_domain',
        assurance: 2,
        verifiedAt: asUtc(String(now)),
        evidence: { domain },
      },
    };
  },

  // A year. People change jobs, and an affiliation stamp that never lapses
  // slowly becomes a claim about where somebody used to work.
  lifetimeDays: 365,
};

/** Exported for the mock screen, which has to show the person their code. */
export const mockCodeFor = codeFor;
