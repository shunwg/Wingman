import { asVerificationId } from '@domain/ids';
import { asUtc } from '@domain/time';
import { addMinutes, type StampProvider } from '../contract';

/**
 * Norwegian BankID.
 *
 * The only provider that reaches assurance 3, and therefore the only one that
 * makes `id_verified_only` and the strict half of `women_only` mean anything.
 * Everything else on this list proves an account; this proves a legal person
 * who can be found again if something goes wrong.
 *
 * Two challenge shapes, because BankID really has two. On a phone it opens the
 * BankID app by URL scheme and waits. On a laptop it shows a reference word
 * that must match what appears on your phone — the anti-phishing step, and the
 * reason the reference is displayed rather than typed. Both then poll.
 *
 * Nobody integrates BankID directly: you go through a broker (Criipto is
 * self-serve, Signicat is enterprise), which is why `id` is the generic
 * `bankid_no` rather than a vendor name — swapping brokers must not invalidate
 * everyone's stamp.
 *
 * What is stored on success: that it succeeded, and when. No national identity
 * number, no date of birth, no name. Those are the fields that turn a breach
 * into a catastrophe, and the product needs none of them — it needs to know
 * somebody real stood behind this account.
 */

/** Deterministic, human-readable, and never a real word. */
function referenceFor(sessionId: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O — they read as 1 and 0
  let h = 2166136261;
  for (let i = 0; i < sessionId.length; i++) {
    h = Math.imul(h ^ sessionId.charCodeAt(i), 16777619) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += alphabet[h % alphabet.length];
    h = Math.floor(h / alphabet.length) + i * 7919;
  }
  return out;
}

export const bankidNo: StampProvider = {
  id: 'bankid_no',
  kind: 'government_eid',
  assurance: 3,
  display: {
    label: 'BankID',
    iconKey: 'bankid',
    tone: 'trust',
    explainer: 'You proved a legal identity with BankID. We keep that it happened, nothing else.',
    // The viewer is told less than the truth on purpose: "ID verified" does not
    // disclose nationality, and BankID is Norwegian.
    publicLabel: 'ID verified',
  },
  unlocks: 'The only stamp that gets you into women-only and ID-verified-only rooms.',
  modes: ['deeplink', 'polling'],

  isAvailable: (env) => env.configured.includes('bankid_no') || env.allowMocks,

  begin: (input, env) => {
    const onPhone = env.platform === 'mobile';
    const reference = referenceFor(input.sessionId);

    return {
      mode: onPhone ? 'deeplink' : 'polling',
      providerId: 'bankid_no',
      sessionId: input.sessionId,
      // Five minutes is BankID's own order of magnitude. A longer window is a
      // longer phishing window, and nobody needs more than five minutes.
      expiresAt: addMinutes(input.now, 5),
      ...(onPhone ? { url: `bankid:///?autostarttoken=${input.sessionId}` } : { reference }),
      poll: { everyMs: 2000, timeoutMs: 5 * 60 * 1000 },
      waitingCopy: onPhone
        ? 'Open BankID and confirm. Come back here when it says done.'
        : `Open BankID on your phone. It should show ${reference}. If it shows anything else, stop.`,
    };
  },

  /**
   * The mock's timeline, and it is not instant on purpose. A verification that
   * completes the moment you look away teaches nothing about how the real one
   * feels, and the waiting state is the part most likely to be built badly.
   */
  poll: (challenge, elapsedMs) => {
    if (elapsedMs > (challenge.poll?.timeoutMs ?? 300_000)) return { status: 'expired' };
    if (elapsedMs < 3500) return { status: 'pending' };
    return { status: 'ready' };
  },

  complete: ({ challenge, personId, now, recordId, polled }) => {
    if (challenge.providerId !== 'bankid_no') {
      return { ok: false, error: 'This challenge belongs to a different provider.' };
    }
    if (polled?.status === 'expired' || now > challenge.expiresAt) {
      return { ok: false, error: 'BankID timed out. Start again when you are ready.' };
    }
    if (polled?.status === 'failed') {
      return { ok: false, error: polled.reason };
    }
    if (polled?.status !== 'ready') {
      return { ok: false, error: 'BankID has not confirmed yet.' };
    }

    return {
      ok: true,
      record: {
        id: asVerificationId(recordId),
        personId,
        providerId: 'bankid_no',
        kind: 'government_eid',
        assurance: 3,
        verifiedAt: asUtc(String(now)),
        // No evidence field at all. There is nothing here it would be
        // responsible to keep.
      },
    };
  },

  // A legal identity does not lapse, and re-verifying costs real money per
  // check. Revocation is the mechanism that matters here, not expiry.
};
