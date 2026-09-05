import { useCallback, useEffect, useRef, useState } from 'react';
import type { PollState, StampChallenge, StampEnv, StampProvider } from '@stamps/index';
import { availableProviders, configuredFrom, isMocked, providerById } from '@stamps/index';
import { useStore } from '@state/store';

/**
 * The verification flow, and the only place in the app that acts on a challenge.
 *
 * The engine is pure: it describes what should happen and judges what came
 * back. Everything impure lives here — reading the environment, opening a URL,
 * running a timer, generating an id. That split is what lets the whole provider
 * matrix be tested in plain Node while this file stays small enough to read.
 */

/**
 * What the environment actually offers.
 *
 * `configured` is derived from which `VITE_*` keys are present. It carries ids
 * only; the keys themselves never cross into the engine, which is enforced by
 * the purity gate rather than by remembering not to.
 */
export function readEnv(): StampEnv {
  const e = import.meta.env;

  return {
    // Booleans out, ids back. The registry owns the mapping, so this file names
    // no provider and adding a seventh needs no edit here.
    configured: configuredFrom({
      bankid: Boolean(e.VITE_BANKID_CLIENT_ID),
      linkedin: Boolean(e.VITE_LINKEDIN_CLIENT_ID),
      google: Boolean(e.VITE_GOOGLE_CLIENT_ID),
      facebook: Boolean(e.VITE_FACEBOOK_APP_ID),
      instagram: Boolean(e.VITE_INSTAGRAM_APP_ID),
    }),
    allowMocks: true,
    // A deeplink is only worth offering where an app can answer it. Coarse
    // pointer is a better proxy than a user-agent string and does not lie when
    // someone resizes a window.
    platform: window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop',
  };
}

export type FlowState =
  | { step: 'idle' }
  | { step: 'running'; provider: StampProvider; challenge: StampChallenge; poll?: PollState }
  | { step: 'done'; provider: StampProvider }
  | { step: 'failed'; provider: StampProvider; error: string };

export function useVerify() {
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const addVerification = useStore((s) => s.addVerification);
  const revokeVerification = useStore((s) => s.revokeVerification);

  const [env] = useState(readEnv);
  const [flow, setFlow] = useState<FlowState>({ step: 'idle' });
  const startedAt = useRef(0);
  const seq = useRef(0);

  const providers = availableProviders(env);
  const held = new Map(me.verifications.map((v) => [v.providerId, v]));

  const begin = useCallback(
    (providerId: string) => {
      const provider = providerById(providerId);
      if (!provider) return;
      // Session ids are injected because engines may not call Math.random().
      // A counter plus the person's id is enough here and keeps flows distinct
      // within a session without pretending to be cryptographic.
      const sessionId = `${String(me.id)}-${provider.id}-${++seq.current}`;
      const challenge = provider.begin({ personId: me.id, now, sessionId }, env);
      startedAt.current = performance.now();
      setFlow({ step: 'running', provider, challenge });
    },
    [env, me.id, now],
  );

  /*
   * The poll loop, for the two shapes that wait.
   *
   * Keyed on the session id rather than on `flow`, because each pending tick
   * writes poll state back into `flow` — depending on the whole object would
   * tear the interval down and rebuild it on every tick it produced. Within one
   * session the provider and the challenge never change, so capturing them is
   * safe; `startedAt` is a ref precisely so the elapsed clock survives renders.
   */
  const session = flow.step === 'running' ? flow.challenge.sessionId : null;
  useEffect(() => {
    if (flow.step !== 'running') return;

    // Narrowed after destructuring, not before: `const { challenge } = flow`
    // creates a fresh binding that carries none of the narrowing applied to
    // `flow.challenge`. Pulling the two values out and guarding them here also
    // avoids a non-null assertion inside a timer, which stays true right up
    // until someone adds a provider that declares a poll interval and no poller.
    const { provider, challenge } = flow;
    const tick = provider.poll;
    const every = challenge.poll?.everyMs;
    if (!tick || !every) return;

    const id = window.setInterval(() => {
      const elapsed = performance.now() - startedAt.current;
      const polled = tick(challenge, elapsed);
      if (polled.status === 'pending') {
        setFlow((f) => (f.step === 'running' ? { ...f, poll: polled } : f));
        return;
      }
      window.clearInterval(id);
      finish(provider, challenge, { polled });
    }, every);

    return () => window.clearInterval(id);
  }, [session]);

  const finish = useCallback(
    (
      provider: StampProvider,
      challenge: StampChallenge,
      extra: { answer?: string; polled?: PollState },
    ) => {
      const res = provider.complete({
        challenge,
        personId: me.id,
        now,
        recordId: `v_${String(me.id)}_${provider.id}`,
        ...extra,
      });

      if (res.ok) {
        // A stand-in proved nothing. The owner sees it labelled; a viewer never sees it.
        addVerification(isMocked(provider, env) ? { ...res.record, mocked: true } : res.record);
        setFlow({ step: 'done', provider });
      } else {
        setFlow({ step: 'failed', provider, error: res.error });
      }
    },
    [addVerification, env, me.id, now],
  );

  /** `redirect` and `deeplink`: hand off, then come back and confirm. */
  const openAndReturn = useCallback((challenge: StampChallenge) => {
    if (!challenge.url) return;
    if (challenge.url.startsWith('#/')) {
      window.location.hash = challenge.url;
      return;
    }
    // A real OAuth hop replaces the page; a deeplink hands off to an app and
    // leaves this one alive underneath.
    window.location.href = challenge.url;
  }, []);

  return {
    env,
    providers,
    held,
    flow,
    begin,
    cancel: () => setFlow({ step: 'idle' }),
    submit: (answer: string) => {
      if (flow.step !== 'running') return;
      finish(flow.provider, flow.challenge, { answer });
    },
    openAndReturn,
    revoke: revokeVerification,
  };
}
