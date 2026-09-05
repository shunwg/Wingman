import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { NewGroupSheet } from '@screens/inbox/NewGroupSheet';
import { Chip, ToggleChip } from '@design/primitives/Chip';
import { CircleCrest } from '@design/patterns/CircleCrest';
import { PersonCard } from '@design/patterns/PersonCard';
import type { MembershipDisplay } from '@domain/index';
import { admissionSentence, admits } from '@domain/index';
import { circleIsLive } from '@data/seed/circles';
import { bucketPhrase } from '@lib/bucket';
import { useCircle, useCircleMembers } from '@state/selectors/circles';
import { useStore } from '@state/store';

/**
 * A circle's home.
 *
 * Leads with how everyone got in — that sentence is the whole reason a
 * circle is worth anything — then what you wear here, then the members who
 * chose to be seen. Members who chose matching-only are matched against and
 * never listed; that is the opt-in the brief asked for.
 */

const DISPLAY_LABEL: Record<MembershipDisplay, string> = {
  show_badge: 'Badge shown',
  match_only: 'Matching only',
  paused: 'Paused',
};

export function CircleScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const circle = useCircle(id);
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const joinCircle = useStore((s) => s.joinCircle);
  const leaveCircle = useStore((s) => s.leaveCircle);
  const setDisplay = useStore((s) => s.setMembershipDisplay);
  const members = useCircleMembers(id);
  const [grouping, setGrouping] = useState(false);

  if (!circle) {
    return (
      <div className="empty">
        <h2 className="empty__title display">No such circle</h2>
        <p className="empty__body">It may have closed, or the link was wrong.</p>
        <Button variant="secondary" onClick={onBack}>
          Back to circles
        </Button>
      </div>
    );
  }

  const mine = me.memberships.find((m) => String(m.circleId) === String(circle.id));
  const live = circleIsLive(circle, String(now).slice(0, 10));
  const verifiedDomains = me.verifications
    .filter((v) => v.kind === 'email_domain' && v.evidence?.domain)
    .map((v) => v.evidence!.domain!);
  const eligible = admits(circle.admission, { verifiedDomains });
  const needsList =
    circle.admission.kind === 'invite_list' ||
    (circle.admission.kind === 'any_of' && circle.admission.rules.some((r) => r.kind === 'invite_list'));
  const wearing = (mine?.badgeIds ?? [])
    .map((bid) => circle.badges?.find((b) => b.id === bid))
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  return (
    <>
      <button className="person__back" onClick={onBack} type="button">
        ← Circles
      </button>

      <section className="circlehome">
        <div className="circlecard__head">
          <CircleCrest shortName={circle.shortName} {...(circle.crestUrl ? { crestUrl: circle.crestUrl } : {})} size="lg" />
          <div className="circlecard__id">
            <h2 className="circlehome__name display">{circle.name}</h2>
            <p className="circlecard__meta mono">
              {circle.kind}
              {circle.runs && ` · ${circle.runs.from} → ${circle.runs.to}`}
              {' · '}
              {bucketPhrase(circle.memberCount, 'member', 'members')}
            </p>
          </div>
        </div>

        <p className="circlehome__sentence">{admissionSentence(circle.admission)}</p>

        {!live && (
          <Chip tone="warn">
            {String(now).slice(0, 10) > String(circle.runs?.to) ? 'Finished — no longer matching' : 'Not started'}
          </Chip>
        )}

        {mine ? (
          <>
            {wearing.length > 0 && (
              <div className="panel__row">
                {wearing.map((b) => (
                  <Chip key={b.id} tone={b.tone}>
                    {b.label}
                  </Chip>
                ))}
              </div>
            )}
            <div className="circlecard__display">
              {(['show_badge', 'match_only', 'paused'] as MembershipDisplay[]).map((d) => (
                <ToggleChip key={d} selected={mine.display === d} onClick={() => setDisplay(String(circle.id), d)}>
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
          </>
        ) : eligible ? (
          <Button onClick={() => joinCircle(String(circle.id), circle.admission.kind)}>
            Join {circle.shortName}
          </Button>
        ) : (
          <p className="circlecard__locked">
            {needsList
              ? 'This circle admits from a list. Open the invitation you were sent to prove your address.'
              : circle.admission.kind === 'email_domain'
                ? `Verify an email at ${circle.admission.domains[0]} under You, and this opens.`
                : 'Ask the organiser for the link.'}
          </p>
        )}
      </section>

      <section className="panel">
        <h3 className="panel__title">Members you may see</h3>
        {members.length === 0 ? (
          <p className="panel__note">Nobody here has chosen to show the badge yet.</p>
        ) : (
          <div className="panel__stack">
            {members.map((p) => (
              <PersonCard key={String(p.id)} person={p} layout="row" />
            ))}
          </div>
        )}
        <p className="panel__note">
          Members who chose matching-only are matched with you and never listed.
        </p>
      </section>

      {mine?.role === 'admin' && (
        <div className="panel panel__row">
          <Button size="sm" onClick={() => (window.location.hash = '#/circles/' + String(circle.id) + '/invite')}>
            Invite people
          </Button>
          <Button size="sm" variant="secondary" onClick={() => (window.location.hash = '#/circles/' + String(circle.id) + '/admin')}>
            Manage
          </Button>
        </div>
      )}
      {mine && (
        <div className="panel panel__row">
          <Button size="sm" onClick={() => (window.location.hash = `#/inbox/circle:${String(circle.id)}`)}>
            Open General
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setGrouping(true)}>
            Start a group
          </Button>
          <Button variant="quiet" size="sm" onClick={() => leaveCircle(String(circle.id))}>
            Leave {circle.shortName}
          </Button>
        </div>
      )}
      {grouping && (
        <NewGroupSheet
          circleId={String(circle.id)}
          onClose={() => setGrouping(false)}
          onOpened={(channelId) => (window.location.hash = `#/inbox/${channelId}`)}
        />
      )}
    </>
  );
}
