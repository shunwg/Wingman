import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { isMocked } from '@stamps/index';
import { ChallengeView } from '@screens/verify/ChallengeView';
import { useVerify } from '@screens/verify/useVerify';

/**
 * Prove it is you — recommended, never required.
 *
 * The recommended row is chosen by *kind* (a government eID, highest
 * assurance first), never by name: the ESLint rule bans provider ids in
 * screens/, and this is why. The lead copy is the exchange, not a request:
 * verify, and the people who chose "verified only" can see you back.
 */
export function VerifyStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const v = useVerify();
  const byAssurance = [...v.providers].sort((a, b) => b.assurance - a.assurance);
  const recommended = byAssurance.find((p) => p.kind === 'government_eid');
  const others = v.providers.filter((p) => p !== recommended);

  if (v.flow.step === 'running') {
    return (
      <section className="verify">
        <h3 className="verify__title display">{v.flow.provider.display.label}</h3>
        <ChallengeView
          flow={v.flow}
          submit={v.submit}
          cancel={v.cancel}
          openAndReturn={v.openAndReturn}
        />
      </section>
    );
  }

  const row = (p: (typeof v.providers)[number], reco: boolean) => {
    const record = v.held.get(p.id);
    return (
      <article className={`stamprow ${reco ? 'verifystep__reco' : ''}`} key={p.id}>
        <div className="stamprow__head">
          <h3 className="stamprow__name">{p.display.label}</h3>
          {record ? (
            <Chip tone="trust">Connected</Chip>
          ) : (
            isMocked(p, v.env) && <Chip tone="neutral">Stand-in</Chip>
          )}
        </div>
        <p className="stamprow__buys">{p.unlocks}</p>
        <div className="stamprow__actions">
          {record ? (
            <Button size="sm" variant="secondary" onClick={() => v.revoke(p.id)}>
              Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={() => v.begin(p.id)}>
              Connect
            </Button>
          )}
        </div>
      </article>
    );
  };

  return (
    <>
      <p className="signup__lede">
        Verify, and the people who chose &ldquo;verified only&rdquo; can see you back. Others
        only ever see that something was checked, never what, and never by whom.
      </p>

      {v.flow.step === 'done' && (
        <div className="verify__result verify__result--ok" role="status">
          <strong>{v.flow.provider.display.label} connected.</strong>
          <span>{v.flow.provider.display.explainer}</span>
        </div>
      )}
      {v.flow.step === 'failed' && (
        <div className="verify__result verify__result--bad" role="alert">
          <strong>That did not go through.</strong>
          <span>{v.flow.error}</span>
        </div>
      )}

      {recommended && row(recommended, true)}
      {others.length > 0 && <p className="verifystep__label">Other ways to be trusted</p>}
      {others.map((p) => row(p, false))}

      <div className="signup__actions">
        <Button variant="secondary" size="lg" onClick={onSkip}>
          Skip for now
        </Button>
        <Button size="lg" onClick={onNext} disabled={v.held.size === 0}>
          Next
        </Button>
      </div>
      <p className="panel__note signup__skip">
        You can connect any of these later, under You.
      </p>
    </>
  );
}
