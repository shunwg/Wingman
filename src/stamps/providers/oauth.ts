import type { AssuranceLevel, StampKind } from '@domain/index';
import { asVerificationId } from '@domain/ids';
import { asUtc } from '@domain/time';
import { addMinutes, type StampProvider } from '../contract';

/**
 * The OAuth-shaped providers: LinkedIn, Google, Facebook, Instagram.
 *
 * Four providers, one factory, because the differences between them are a name,
 * an authorise URL, a scope list and an icon — and writing the same redirect
 * dance four times is how three of them quietly drift out of sync with the
 * fourth. Each still gets its own file and its own registry line, so the
 * "add a provider, touch no screens" property holds.
 *
 * All four sit at assurance 1. That is deliberate and it is the ceiling: an
 * OAuth grant proves someone controls an account, which is a *persistent*
 * identity, not a legal one. A LinkedIn profile can be six weeks old. Only
 * BankID reaches level 3, and only the level-3 presets protect anybody in the
 * way they think they are being protected.
 *
 * What is stored: the handle, and nothing else. Not the access token, not the
 * refresh token, not the email. The record exists to say "this was checked".
 */

export interface OAuthSpec {
  id: string;
  label: string;
  iconKey: string;
  authorizeUrl: string;
  scopes: string[];
  /** Where the handle appears, for the typed fallback. */
  handleHint: string;
  handlePattern: RegExp;
  kind?: StampKind;
  assurance?: AssuranceLevel;
  publicLabel: string;
  explainer: string;
  unlocks: string;
}

export function makeOAuthProvider(spec: OAuthSpec): StampProvider {
  const kind: StampKind = spec.kind ?? 'social_account';

  return {
    id: spec.id,
    kind,
    assurance: spec.assurance ?? 1,
    display: {
      label: spec.label,
      iconKey: spec.iconKey,
      tone: 'social',
      explainer: spec.explainer,
      publicLabel: spec.publicLabel,
    },
    unlocks: spec.unlocks,
    modes: ['redirect'],

    // Mocks stand in when unconfigured, so all four flows are reachable — and
    // Playwright-testable — with no credentials at all.
    isAvailable: (env) => env.configured.includes(spec.id) || env.allowMocks,

    begin: (input, env) => {
      const live = env.configured.includes(spec.id);
      const params = [
        `client_id=${live ? '$CLIENT_ID' : 'mock'}`,
        `redirect_uri=${encodeURIComponent(input.returnUrl ?? '/verify/callback')}`,
        `scope=${encodeURIComponent(spec.scopes.join(' '))}`,
        `state=${input.sessionId}`,
        'response_type=code',
      ].join('&');

      return {
        mode: 'redirect',
        providerId: spec.id,
        sessionId: input.sessionId,
        // Ten minutes. Long enough to read a consent screen properly, short
        // enough that an abandoned tab cannot be completed tomorrow.
        expiresAt: addMinutes(input.now, 10),
        url: live
          ? `${spec.authorizeUrl}?${params}`
          : `#/verify/mock/${spec.id}/${input.sessionId}`,
        waitingCopy: `Finishing up with ${spec.label}…`,
      };
    },

    complete: ({ challenge, personId, now, recordId, answer }) => {
      if (challenge.providerId !== spec.id) {
        return { ok: false, error: 'This challenge belongs to a different provider.' };
      }
      if (now > challenge.expiresAt) {
        return { ok: false, error: `That took too long. Start ${spec.label} again.` };
      }

      const handle = (answer ?? '').trim().replace(/^@/, '');
      if (!handle) {
        return { ok: false, error: `${spec.label} did not send anything back.` };
      }
      if (!spec.handlePattern.test(handle)) {
        return { ok: false, error: `That does not look like a ${spec.label} ${spec.handleHint}.` };
      }

      return {
        ok: true,
        record: {
          id: asVerificationId(recordId),
          personId,
          providerId: spec.id,
          kind,
          assurance: spec.assurance ?? 1,
          verifiedAt: asUtc(String(now)),
          evidence: { handle },
        },
      };
    },

    // Re-checked twice a year. An account that was deleted or renamed should
    // stop vouching for someone, and nothing else notices if this never lapses.
    lifetimeDays: 180,
  };
}
