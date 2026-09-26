import { useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { StampBadge } from '@design/patterns/StampBadge';
import { isRedacted } from '@domain/person';
import type { MeetKind } from '@domain/intent';
import { useBoard } from '@state/selectors/board';
import { useStore } from '@state/store';
import { PersonMenu } from '@screens/safety/PersonMenu';
import { addMinutes, epoch } from '@domain/time';
import { asTripId } from '@domain/ids';
import { HelloSheet } from './HelloSheet';
import { helloWindow } from '@state/requests/helloWindow';

/** Said on the screen, so the demo never pretends somebody is typing. */
const DEMO_ANSWER_NOTE =
  'This is the demo, so they will answer on their own in a few seconds. In a real account, only a real person can.';

/**
 * One person, and the decision to say hello.
 *
 * Everything here comes from the board's already-redacted candidate — the
 * screen never fetches a `Person`, so there is no path by which it could render
 * a field the ladder withheld. The profile is rich but restrained: who they
 * are, why you should care, what has been proved, then one action.
 */
export function PersonScreen({
  id,
  tripId,
  onBack,
}: {
  id: string;
  tripId?: string;
  onBack: () => void;
}) {
  const { candidates } = useBoard();
  // Narrowed by trip when the board said which one, because the same person
  // can sit on the board twice under two flight codes and the request has to
  // go against the journey you actually tapped.
  const candidate =
    candidates.find(
      (c) => String(c.person.id) === id && (!tripId || c.viaTripId === tripId),
    ) ?? candidates.find((c) => String(c.person.id) === id);
  const sendRequest = useStore((s) => s.sendRequest);
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const myTrips = useStore((s) => s.myTrips);
  const demo = useStore((s) => s.account.mode === 'demo');
  const saved = useStore((s) => s.saved);
  const toggleSaved = useStore((s) => s.toggleSaved);

  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);

  // Sending a request takes them off the board — the engine does not re-surface
  // someone with a live request — so the note has to survive their disappearance.
  if (!candidate && sent) {
    return (
      <div className="empty">
        <h2 className="empty__title display">Request sent.</h2>
        <p className="empty__body">
          You will hear back if they say yes. If they would rather not, you will simply see this
          close. No reason, and nothing to read into it.
        </p>
        {demo && <p className="empty__body">{DEMO_ANSWER_NOTE}</p>}
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="empty">
        <h2 className="empty__title display">Not on your board</h2>
        <p className="empty__body">
          They may have changed their plans, their privacy settings, or already answered.
        </p>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  const p = candidate.person;
  const name = isRedacted(p.displayName) ? null : p.displayName;
  const headline = isRedacted(p.headline) ? null : p.headline;
  const professional = isRedacted(p.professional) ? null : p.professional;
  const firstName = name ? name.split(' ')[0]! : 'them';

  const sharedCircle = candidate.person.circles.find((c) =>
    me.memberships.some((m) => String(m.circleId) === String(c.circleId)),
  )?.circleId;

  const send = (kind: MeetKind, message: string) => {
    // When and where the hello is about, from how the two trips touch — not
    // "the next ninety minutes" whatever the overlap. See helloWindow.ts.
    const myTrip = myTrips.find((t) => String(t.id) === candidate.viaTripId);
    const about = helloWindow(candidate.overlap, kind, myTrip?.segments ?? [], now);
    const window = about.window;
    const ref = overlapRefOf(candidate.overlap);
    sendRequest({
      fromPersonId: me.id,
      toPersonId: p.id,
      // Which of your journeys this is for. Accepting closes that trip and no
      // other, so getting this wrong would stop suggestions for the wrong one.
      tripId: asTripId(candidate.viaTripId),
      // A shared live circle is the organiser's report, so it is recorded here.
      ...(sharedCircle ? { circleId: sharedCircle } : {}),
      // A same-flight overlap names a flight, not a place; the hello's own
      // airport anchors the plan it may become.
      overlapRef: ref.airport || !about.airport ? ref : { ...ref, airport: about.airport },
      proposal: { kind, window },
      message,
      // A day at most, and never past the thing it asks about: a coffee
      // before boarding cannot still be answered after the doors close.
      expiresAt: epoch(window.to) < epoch(addMinutes(now, 60 * 24)) ? window.to : addMinutes(now, 60 * 24),
    });
    setAsking(false);
    setSent(true);
  };

  return (
    <article className="person">
      <button className="person__back" onClick={onBack} type="button">
        ← Back
      </button>

      <div className="person__hero person__hero--band">
        <Avatar spec={p.avatar} shape="photo" size="full" {...(name ? { label: name } : {})} />
        <div className="person__scrim" aria-hidden="true" />
        <div className="person__menu">
          <PersonMenu personId={p.id} firstName={firstName} onHidden={onBack} />
        </div>
      </div>

      <div className="person__body">
        <div className="person__id">
          <h2 className="person__name display">
            {name ?? <span className="person__withheld">Name shown once you both agree</span>}
            {p.stamps.some((s) => s.display.tone === 'trust') && (
              <span className="person__tick" aria-label="Verified" title="Verified">✓</span>
            )}
          </h2>
          {professional && (professional.title || professional.industry) && (
            <p className="person__role">
              {[professional.title, professional.industry].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="person__ctx mono">{candidate.receipt.headline}</p>
        </div>

        {headline && <p className="person__headline">{headline}</p>}

        {/* Why meet? In facts. The score exists but is never shown. */}
        <section className="why">
          <h3 className="why__title">Why meet?</h3>
          <p className="why__body">
            {candidate.receipt.lines.map((l) => (
              <span key={l.label} className={`receipt__fact${l.mono ? ' mono' : ''}`}>
                {l.value}
              </span>
            ))}
          </p>
          {candidate.receipt.suggestion && <p className="why__suggestion">{candidate.receipt.suggestion}</p>}
          {candidate.proposableKinds.length > 0 && (
            <div className="pcard__chips">
              {candidate.proposableKinds.slice(0, 3).map((k) => (
                <Chip key={k} tone="neutral">
                  {KIND_LABEL[k] ?? k}
                </Chip>
              ))}
            </div>
          )}
        </section>

        {professional?.workingOn && (
          <section className="why">
            <h3 className="why__title">Working on</h3>
            <p className="why__body">{professional.workingOn}</p>
          </section>
        )}

        {(p.stamps.length > 0 || p.circles.length > 0) && (
          <section className="why">
            <h3 className="why__title">Verified</h3>
            <div className="person__stamps">
              {p.stamps.map((s, i) => (
                <StampBadge key={`${s.kind}-${s.handle ?? i}`} stamp={s} />
              ))}
              {p.circles.map((c) => (
                <Chip key={String(c.circleId)} tone="neutral">{c.shortName || String(c.circleId)}</Chip>
              ))}
            </div>
          </section>
        )}

        {sent ? (
          <div className="sentnote">
            <p className="sentnote__title">Request sent.</p>
            <p className="sentnote__body">
              You will hear back if they say yes. If they would rather not, you will simply see
              this close. No reason, and nothing to read into it.
            </p>
            {demo && <p className="sentnote__body">{DEMO_ANSWER_NOTE}</p>}
          </div>
        ) : (
          <div className="person__cta">
            <Button full size="lg" onClick={() => setAsking(true)}>
              Say hello
            </Button>
            <Button size="sm" variant={saved.includes(p.id) ? 'secondary' : 'quiet'} onClick={() => toggleSaved(p.id)}>
              {saved.includes(p.id) ? 'Saved for later' : 'Save for later'}
            </Button>
          </div>
        )}
      </div>

      {asking && (
        <HelloSheet
          firstName={firstName}
          kinds={candidate.proposableKinds}
          onClose={() => setAsking(false)}
          onSend={send}
        />
      )}
    </article>
  );
}

const KIND_LABEL: Record<string, string> = {
  gate_coffee: 'Coffee at the gate',
  lounge: 'Lounge',
  terminal_walk: 'Walk the terminal',
  ride_share: 'Share the ride in',
  meal: 'A meal',
  drinks: 'A drink',
  business_intro: 'An introduction',
  coworking: 'Cowork',
};

function overlapRefOf(o: ReturnType<typeof useBoard>['candidates'][number]['overlap']) {
  switch (o.kind) {
    case 'same_flight':
      return { kind: o.kind };
    case 'shared_layover':
    case 'same_airport_window':
      return { kind: o.kind, airport: o.airport, window: o.window };
    case 'same_city_night':
      return { kind: o.kind, cityKey: o.cityKey };
    case 'overlapping_stay':
      return { kind: o.kind, cityKey: o.cityKey };
  }
}
