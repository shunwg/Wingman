import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { SEED_CIRCLES, inviteCodeFor } from '@data/seed/circles';
import { useStore } from '@state/store';

/**
 * Opening someone's invite link.
 *
 * The link gets you to the door, and that is all it does. A domain circle still
 * demands a verified address before you are in — otherwise a forwarded link
 * would be enough to put anybody inside INSEAD, and the badge would stop
 * meaning anything to the people already wearing it.
 *
 * So this screen has three honest outcomes: you are in, you can be in once you
 * verify, or this code matches nothing.
 */
export function JoinCircleScreen({ code, onDone }: { code: string; onDone: () => void }) {
  const me = useStore((s) => s.me);
  const myCircles = useStore((s) => s.myCircles);
  const joinCircle = useStore((s) => s.joinCircle);

  const all = [...SEED_CIRCLES, ...myCircles];
  const circle = all.find((c) => inviteCodeFor(c) === code.toUpperCase());

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

  const already = me.memberships.some((m) => m.circleId === circle.id);
  const byDomain = circle.admission.kind === 'email_domain' ? circle.admission : null;
  const verifiedDomains = new Set(
    me.verifications.filter((v) => v.kind === 'email_domain').map((v) => v.evidence?.domain),
  );
  const eligible = byDomain ? byDomain.domains.some((d) => verifiedDomains.has(d)) : true;

  return (
    <section className="panel">
      <p className="eyebrow">You&rsquo;ve been invited to</p>
      <h2 className="empty__title display">{circle.name}</h2>

      <div className="panel__row">
        <Chip tone="neutral">{circle.kind}</Chip>
        {circle.runs && (
          <Chip tone="neutral">
            {circle.runs.from} → {circle.runs.to}
          </Chip>
        )}
      </div>

      <p className="panel__note">
        {byDomain
          ? `Everyone in here proved an address at ${byDomain.domains.join(' or ')}. That is the only reason the badge is worth anything.`
          : 'Admission is by invite link. Anyone holding it can join, so it is a door key rather than a password.'}
      </p>

      {already ? (
        <>
          <Chip tone="trust">You&rsquo;re already a member</Chip>
          <Button variant="secondary" full onClick={onDone}>
            Back to circles
          </Button>
        </>
      ) : eligible ? (
        <>
          <Button
            full
            onClick={() => {
              joinCircle(String(circle.id), circle.admission.kind);
              onDone();
            }}
          >
            Join {circle.shortName}
          </Button>
          <p className="panel__note">
            You&rsquo;ll join with the badge hidden — matching only. Turning it on is a separate
            choice, under Circles.
          </p>
        </>
      ) : (
        <>
          <p className="circlecard__locked">
            Verify an address at {byDomain?.domains[0]} first, and this opens. The link alone is
            not enough — that is the point of a domain circle.
          </p>
          <Button full onClick={() => (window.location.hash = '#/verify')}>
            Verify an email
          </Button>
        </>
      )}
    </section>
  );
}
