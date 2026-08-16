import { Button } from '@design/primitives/Button';
import { Chip, ToggleChip } from '@design/primitives/Chip';
import type { MembershipDisplay } from '@domain/index';
import { SEED_CIRCLES, circleIsLive } from '@data/seed/circles';
import { bucketPhrase } from '@lib/bucket';
import { useStore } from '@state/store';

/**
 * Circles.
 *
 * A closed loop is the thing a school or a conference actually buys, so this is
 * a top-level surface rather than a settings row. Three ideas carry the screen:
 *
 *  1. **Admission is proved, never claimed.** You cannot type "INSEAD" and be
 *     in it — you verify an email on the domain, or you hold an invite code.
 *     That is the entire reason a circle is worth anything to the people in it.
 *  2. **Being in a circle and advertising it are separate decisions.** Joining
 *     defaults to matching-only; the badge is a second, explicit choice. Most
 *     products conflate these and quietly publish where you studied.
 *  3. **A conference is a circle with an end date.** After it, the delegate
 *     list stops matching. Nobody consented to being permanently findable as
 *     someone who attended a thing.
 */

const DISPLAY_LABEL: Record<MembershipDisplay, string> = {
  show_badge: 'Badge shown',
  match_only: 'Matching only',
  paused: 'Paused',
};

export function CirclesScreen() {
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const joinCircle = useStore((s) => s.joinCircle);
  const leaveCircle = useStore((s) => s.leaveCircle);
  const setDisplay = useStore((s) => s.setMembershipDisplay);

  const today = String(now).slice(0, 10);
  const verifiedDomains = new Set(
    me.verifications.filter((v) => v.kind === 'email_domain').map((v) => v.evidence?.domain),
  );

  return (
    <>
      <p className="screennote">
        Closed loops where everyone was admitted the same way you were.
      </p>

      {SEED_CIRCLES.map((circle) => {
        const mine = me.memberships.find((m) => String(m.circleId) === String(circle.id));
        const live = circleIsLive(circle, today);
        const byDomain = circle.admission.kind === 'email_domain' ? circle.admission : null;
        const eligible = byDomain
          ? byDomain.domains.some((d) => verifiedDomains.has(d))
          : false;

        return (
          <article className="circlecard" key={String(circle.id)}>
            <div className="circlecard__head">
              <span className="circlecard__crest mono" aria-hidden="true">
                {circle.shortName.slice(0, 2).toUpperCase()}
              </span>
              <div className="circlecard__id">
                <h2 className="circlecard__name">{circle.name}</h2>
                <p className="circlecard__meta mono">
                  {/* Bucketed, like every count that crosses into the UI. An
                      exact membership figure on a small circle is a roster. */}
                  {bucketPhrase(circle.memberCount, 'member', 'members')}
                  {circle.runs && ` · ${circle.runs.from} → ${circle.runs.to}`}
                </p>
              </div>
            </div>

            <p className="circlecard__admission">
              {byDomain
                ? `Admits anyone with a verified ${byDomain.domains.join(' or ')} address.`
                : circle.admission.kind === 'invite_code'
                  ? 'Invite code only — for bodies whose members work everywhere.'
                  : 'Approved by an admin.'}
            </p>

            {!live && (
              <Chip tone="warn">
                {today > String(circle.runs?.to) ? 'Finished — no longer matching' : 'Not started'}
              </Chip>
            )}

            {mine ? (
              <>
                <div className="circlecard__display">
                  {(['show_badge', 'match_only', 'paused'] as MembershipDisplay[]).map((d) => (
                    <ToggleChip
                      key={d}
                      selected={mine.display === d}
                      onClick={() => setDisplay(String(circle.id), d)}
                    >
                      {DISPLAY_LABEL[d]}
                    </ToggleChip>
                  ))}
                </div>
                <p className="circlecard__note">
                  {mine.display === 'show_badge'
                    ? 'Your card shows this circle to anyone who can see you.'
                    : mine.display === 'match_only'
                      ? 'Used to decide who you match with. Never shown on your card.'
                      : 'Neither matching nor shown, until you turn it back on.'}
                </p>
                <Button variant="secondary" size="sm" onClick={() => leaveCircle(String(circle.id))}>
                  Leave
                </Button>
              </>
            ) : (
              <>
                {/* Not eligible is a *state*, not a broken button. Rendering it
                    as a greyed-out primary makes the CTA the loudest thing on a
                    card you cannot act on; the requirement goes where it can
                    actually be read and acted on instead. */}
                {eligible ? (
                  <Button size="sm" onClick={() => joinCircle(String(circle.id), circle.admission.kind)}>
                    Join
                  </Button>
                ) : (
                  <p className="circlecard__locked">
                    {byDomain
                      ? `Verify an email at ${byDomain.domains[0]} under You, and this opens.`
                      : 'Ask the organiser for an invite code.'}
                  </p>
                )}
              </>
            )}
          </article>
        );
      })}

      <div className="circlecard circlecard--pitch">
        <h2 className="circlecard__name">Running a school or a conference?</h2>
        <p className="circlecard__admission">
          A circle is a verified domain, a crest, and — for an event — a date range. Admission is
          proved by email or invite, never by typing a name, which is the only reason a member can
          trust that everyone else in the room belongs there. Ask us to open one.
        </p>
      </div>
    </>
  );
}
