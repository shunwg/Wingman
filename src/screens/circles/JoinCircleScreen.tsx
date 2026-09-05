import { useEffect, useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { CircleCrest } from '@design/patterns/CircleCrest';
import type { AdmissionRule } from '@domain/index';
import { admissionSentence, admits, parseInvite } from '@domain/index';
import { inviteCodeFor } from '@data/seed/circles';
import { useCircles } from '@state/selectors/circles';
import { useStore } from '@state/store';
import { ChallengeView } from '@screens/verify/ChallengeView';
import { useVerify } from '@screens/verify/useVerify';
import { hashEmail } from './hash';

/**
 * Opening someone's invitation.
 *
 * The link gets you to the door, and that is all it does. What the circle
 * asks for is decided by `admits()`: a domain circle still needs a verified
 * address, and a list circle needs you to prove the address that was listed.
 * That proof runs through the ordinary email-OTP stamp; the screen hashes
 * the address with the circle's salt and compares, and the address itself is
 * gone the moment that is done.
 */
export function JoinCircleScreen({ code, onDone }: { code: string; onDone: () => void }) {
  const me = useStore((s) => s.me);
  const joinCircle = useStore((s) => s.joinCircle);
  const circles = useCircles();
  const invite = parseInvite(code);
  const circle = invite ? circles.find((c) => inviteCodeFor(c) === invite.code) : undefined;

  const v = useVerify();
  const [emailHash, setEmailHash] = useState<string | undefined>(undefined);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);

  const listRule = circle ? findList(circle.admission) : undefined;

  // When the OTP flow finishes and we hold the hash, decide.
  useEffect(() => {
    if (!circle || !listRule || v.flow.step !== 'done' || !pendingAddress) return;
    void hashEmail(pendingAddress, listRule.salt).then((h) => {
      setEmailHash(h);
      setPendingAddress(null);
    });
  }, [circle, listRule, v.flow.step, pendingAddress]);

  if (!circle) {
    return (
      <div className="empty">
        <h2 className="empty__title display">That link has expired</h2>
        <p className="empty__body">
          The code <code className="mono">{code}</code> does not match a circle. Ask whoever sent
          it for a fresh link.
        </p>
        <Button variant="secondary" onClick={onDone}>
          Back to circles
        </Button>
      </div>
    );
  }

  const already = me.memberships.some((m) => String(m.circleId) === String(circle.id));
  const verifiedDomains = me.verifications
    .filter((x) => x.kind === 'email_domain' && x.evidence?.domain)
    .map((x) => x.evidence!.domain!);
  const proof = { verifiedDomains, hasLink: true, ...(emailHash ? { emailHash } : {}) };
  const eligible = admits(circle.admission, proof);
  const domainRule = circle.admission.kind === 'email_domain' ? circle.admission : null;
  const otp = v.providers.find((p) => p.kind === 'email_domain');

  // A badge on the link is honoured only if the circle defines it.
  const badgeDef = invite?.badgeId ? circle.badges?.find((b) => b.id === invite.badgeId) : undefined;

  const join = () => {
    joinCircle(
      String(circle.id),
      listRule && emailHash ? 'invite_list' : circle.admission.kind,
      badgeDef ? [badgeDef.id] : undefined,
    );
    onDone();
  };

  return (
    <section className="panel">
      <p className="eyebrow">You&rsquo;ve been invited to</p>
      <div className="circlecard__head">
        <CircleCrest shortName={circle.shortName} {...(circle.crestUrl ? { crestUrl: circle.crestUrl } : {})} size="lg" />
        <div className="circlecard__id">
          <h2 className="empty__title display">{circle.name}</h2>
          <p className="circlecard__meta mono">
            {circle.kind}
            {circle.runs && ` · ${circle.runs.from} → ${circle.runs.to}`}
          </p>
        </div>
      </div>

      <p className="circlehome__sentence">{admissionSentence(circle.admission)}</p>
      {badgeDef && <Chip tone={badgeDef.tone}>You join as {badgeDef.label}</Chip>}

      {already ? (
        <>
          <Chip tone="trust">You&rsquo;re already a member</Chip>
          <Button variant="secondary" full onClick={onDone}>
            Back to circles
          </Button>
        </>
      ) : eligible ? (
        <>
          <Button full onClick={join}>
            Join {circle.shortName}
          </Button>
          <p className="panel__note">
            You&rsquo;ll join with the badge hidden: matching only. Turning it on is a separate
            choice, on the circle&rsquo;s page.
          </p>
        </>
      ) : listRule && otp ? (
        v.flow.step === 'running' ? (
          <section className="verify">
            <h3 className="verify__title display">Prove your address</h3>
            <ChallengeView
              flow={v.flow}
              submit={(answer) => {
                // "address|code" — keep the address just long enough to hash it.
                setPendingAddress(answer.split('|')[0] ?? '');
                v.submit(answer);
              }}
              cancel={v.cancel}
              openAndReturn={v.openAndReturn}
            />
          </section>
        ) : v.flow.step === 'done' && emailHash && !eligible ? (
          <>
            <p className="circlecard__locked">
              That address is verified, but it is not on this circle&rsquo;s list. If it should
              be, ask the organiser to add it.
            </p>
            <Button variant="secondary" full onClick={onDone}>
              Back to circles
            </Button>
          </>
        ) : (
          <>
            <p className="circlecard__locked">
              This circle admits from the organiser&rsquo;s list. Prove the address they have for
              you and you are in. The address is hashed on this device and never stored.
            </p>
            {v.flow.step === 'failed' && (
              <p className="field__error" role="alert">
                {v.flow.error}
              </p>
            )}
            <Button full onClick={() => v.begin(otp.id)}>
              Prove your address
            </Button>
          </>
        )
      ) : (
        <>
          <p className="circlecard__locked">
            {domainRule
              ? `Verify an address at ${domainRule.domains[0]} first, and this opens. The link alone is not enough. That is the point of a domain circle.`
              : 'This circle needs the organiser to let you in.'}
          </p>
          {domainRule && (
            <Button full onClick={() => (window.location.hash = '#/verify')}>
              Verify an email
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function findList(rule: AdmissionRule): Extract<AdmissionRule, { kind: 'invite_list' }> | undefined {
  if (rule.kind === 'invite_list') return rule;
  if (rule.kind === 'any_of') {
    for (const r of rule.rules) {
      const hit = findList(r);
      if (hit) return hit;
    }
  }
  return undefined;
}
