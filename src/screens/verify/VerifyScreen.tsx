import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { isMocked } from '@stamps/index';
import { useVerify } from './useVerify';
import { InputChallenge } from './challenges/InputChallenge';
import { RedirectChallenge } from './challenges/RedirectChallenge';
import { DeeplinkChallenge } from './challenges/DeeplinkChallenge';
import { PollingChallenge } from './challenges/PollingChallenge';

/**
 * Connect your accounts.
 *
 * The screen renders challenge *shapes*, never provider names — the switch
 * below is over four modes, and there is no branch anywhere in this folder that
 * says "if linkedin". An ESLint rule bans provider-id literals under screens/,
 * so adding a seventh provider is a registry line and no work here at all.
 *
 * Two decisions worth naming:
 *
 *  · **What each stamp buys you is stated up front.** "Connect LinkedIn"
 *    without a reason is a request for data; "opens circles that admit by
 *    domain" is an exchange. Verification that is asked for without a reason is
 *    the single most common place a good app starts feeling extractive.
 *
 *  · **Mocked providers say so.** A flow that looks identical whether or not it
 *    checked anything is how a demo gets mistaken for a product, and the person
 *    deserves to know the badge they just earned is a placeholder.
 */

export function VerifyScreen() {
  const { env, providers, held, flow, begin, cancel, submit, openAndReturn, revoke } = useVerify();

  if (flow.step === 'running') {
    const { provider, challenge, poll } = flow;
    return (
      <section className="verify">
        <h2 className="verify__title display">{provider.display.label}</h2>

        {/* One switch, over shapes. Four renderers, forever. */}
        {challenge.mode === 'input' && (
          <InputChallenge challenge={challenge} onSubmit={submit} onCancel={cancel} />
        )}
        {challenge.mode === 'redirect' && (
          <RedirectChallenge
            challenge={challenge}
            label={provider.display.label}
            onSubmit={submit}
            onCancel={cancel}
          />
        )}
        {challenge.mode === 'deeplink' && (
          <DeeplinkChallenge
            challenge={challenge}
            {...(poll ? { poll } : {})}
            onOpen={() => openAndReturn(challenge)}
            onCancel={cancel}
          />
        )}
        {challenge.mode === 'polling' && (
          <PollingChallenge challenge={challenge} {...(poll ? { poll } : {})} onCancel={cancel} />
        )}
      </section>
    );
  }

  return (
    <>
      {flow.step === 'done' && (
        <div className="verify__result verify__result--ok" role="status">
          <strong>{flow.provider.display.label} connected.</strong>
          <span>{flow.provider.display.explainer}</span>
        </div>
      )}
      {flow.step === 'failed' && (
        <div className="verify__result verify__result--bad" role="alert">
          <strong>That did not go through.</strong>
          <span>{flow.error}</span>
        </div>
      )}

      <p className="screennote">
        Nothing here is shared as data. Others see a stamp — that something was checked — never
        what was checked or by whom.
      </p>

      {providers.map((p) => {
        const record = held.get(p.id);
        const mocked = isMocked(p, env);

        return (
          <article className="stamprow" key={p.id}>
            <div className="stamprow__head">
              <h3 className="stamprow__name">{p.display.label}</h3>
              {record ? (
                <Chip tone="trust">Connected</Chip>
              ) : (
                mocked && <Chip tone="neutral">Stand-in</Chip>
              )}
            </div>

            <p className="stamprow__buys">{p.unlocks}</p>

            {record?.evidence?.handle && (
              <p className="stamprow__handle mono">@{record.evidence.handle}</p>
            )}
            {record?.evidence?.domain && (
              <p className="stamprow__handle mono">{record.evidence.domain}</p>
            )}

            <div className="stamprow__actions">
              {record ? (
                <Button size="sm" variant="secondary" onClick={() => revoke(p.id)}>
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" onClick={() => begin(p.id)}>
                  Connect
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}
