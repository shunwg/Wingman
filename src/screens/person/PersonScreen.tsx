import { useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip, ToggleChip } from '@design/primitives/Chip';
import { StampBadge } from '@design/patterns/StampBadge';
import { isRedacted } from '@domain/person';
import type { MeetKind } from '@domain/intent';
import { useBoard } from '@state/selectors/board';
import { MEET_KIND_LABEL } from '@data/copy/meetKinds';
import { useStore } from '@state/store';
import { PersonMenu } from '@screens/safety/PersonMenu';
import { addMinutes } from '@domain/time';
import { asTripId } from '@domain/ids';

/**
 * One person, and the decision to ask.
 *
 * Everything here comes from the board's already-redacted candidate — the
 * screen never fetches a `Person`, so there is no path by which it could render
 * a field the ladder withheld.
 *
 * The request itself is deliberately constrained: pick a kind that the overlap
 * physically supports, pick from templated openers, send. Nobody has to compose
 * a first message to a stranger from a jet bridge, and nobody can overshare by
 * accident in one.
 */


const OPENERS = [
  'Same flight. Fancy a coffee before boarding?',
  'Happy to share the ride into town if you are heading that way.',
  'In town the same nights. Dinner, if you are free?',
  'Would be good to talk shop for twenty minutes.',
];

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

  const [kind, setKind] = useState<MeetKind | null>(null);
  const [opener, setOpener] = useState(OPENERS[0]!);
  const [custom, setCustom] = useState('');
  const [sent, setSent] = useState(false);
  const saved = useStore((s) => s.saved);
  const toggleSaved = useStore((s) => s.toggleSaved);

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
        <Button variant="secondary" onClick={onBack}>
          Back to the board
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
          Back to the board
        </Button>
      </div>
    );
  }

  const p = candidate.person;
  const name = isRedacted(p.displayName) ? null : p.displayName;
  const headline = isRedacted(p.headline) ? null : p.headline;
  const professional = isRedacted(p.professional) ? null : p.professional;
  const chosen = kind ?? candidate.proposableKinds[0]!;

  const sharedCircle = candidate.person.circles.find((c) =>
    me.memberships.some((m) => String(m.circleId) === String(c.circleId)),
  )?.circleId;

  const send = () => {
    const window = { from: now, to: addMinutes(now, 90) };
    sendRequest({
      fromPersonId: me.id,
      toPersonId: p.id,
      // Which of your journeys this is for. Accepting closes that trip and no
      // other, so getting this wrong would stop suggestions for the wrong one.
      tripId: asTripId(candidate.viaTripId),
      // A shared live circle is the organiser's report, so it is recorded here.
      ...(sharedCircle ? { circleId: sharedCircle } : {}),
      overlapRef: overlapRefOf(candidate.overlap),
      proposal: { kind: chosen, window },
      message: custom.trim() ? custom.trim().slice(0, 240) : opener,
      expiresAt: addMinutes(now, 60 * 24),
    });
    setSent(true);
  };

  return (
    <article className="person">
      <button className="person__back" onClick={onBack} type="button">
        ← Board
      </button>

      <div className="person__hero person__hero--band">
        <Avatar spec={p.avatar} shape="photo" size="full" {...(name ? { label: name } : {})} />
        <div className="person__scrim" aria-hidden="true" />
        <div className="person__menu">
          <PersonMenu personId={p.id} firstName={name ?? 'them'} onHidden={onBack} />
        </div>
        <div className="person__heroText">
          <h2 className="person__name display">
            {name ?? <span className="person__withheld">Name shown once you both agree</span>}
          </h2>
          <p className="person__ctx mono">{candidate.receipt.headline}</p>
        </div>
      </div>

      <div className="person__body">
        {p.stamps.length > 0 && (
          <div className="person__stamps">
            {p.stamps.map((s, i) => (
              <StampBadge key={`${s.kind}-${s.handle ?? i}`} stamp={s} />
            ))}
          </div>
        )}

        {headline && <p className="person__headline">{headline}</p>}
        <div className="person__actions">
          <Button size="sm" variant={saved.includes(p.id) ? 'secondary' : 'quiet'} onClick={() => toggleSaved(p.id)}>
            {saved.includes(p.id) ? 'Saved for later' : 'Save for later'}
          </Button>
        </div>

        {professional && (
          <p className="person__work">
            {[professional.title, professional.industry].filter(Boolean).join(' · ')}
            {professional.workingOn ? `. ${professional.workingOn}` : ''}
          </p>
        )}

        {p.circles.length > 0 && (
          <div className="pcard__chips">
            {p.circles.map((c) => (
              <Chip key={String(c.circleId)}>{c.shortName || String(c.circleId)}</Chip>
            ))}
          </div>
        )}

        {/* Why they are here, in facts. The score exists but is never shown. */}
        <section className="receipt">
          <h3 className="receipt__title">Why you are seeing this</h3>
          {/* J5: a sentence, not a table. Nobody reads label/value rows at a gate. */}
          <p className="receipt__facts">
            {candidate.receipt.lines.map((l) => (
              <span key={l.label} className={`receipt__fact${l.mono ? ' mono' : ''}`}>
                {l.value}
              </span>
            ))}
          </p>
          {candidate.receipt.suggestion && (
            <p className="receipt__suggestion">{candidate.receipt.suggestion}</p>
          )}
        </section>

        {sent ? (
          <div className="sentnote">
            <p className="sentnote__title">Request sent.</p>
            <p className="sentnote__body">
              You will hear back if they say yes. If they would rather not, you will simply see
              this close. No reason, and nothing to read into it.
            </p>
          </div>
        ) : (
          <section className="ask">
            <h3 className="ask__title">Ask to meet</h3>
            <p className="ask__note">Only what your overlap actually allows time for.</p>
            <div className="ask__kinds">
              {candidate.proposableKinds.map((k) => (
                <ToggleChip key={k} selected={chosen === k} onClick={() => setKind(k)}>
                  {MEET_KIND_LABEL[k]}
                </ToggleChip>
              ))}
            </div>

            <h4 className="ask__sub">Say something</h4>
            <div className="ask__openers">
              {OPENERS.map((o) => (
                <ToggleChip key={o} selected={opener === o && !custom.trim()} onClick={() => { setOpener(o); setCustom(''); }}>
                  {o}
                </ToggleChip>
              ))}
            </div>
            <textarea
              className="field__input ask__custom"
              rows={2}
              maxLength={240}
              placeholder="Or in your own words. Why them, in a sentence."
              aria-label="In your own words"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />

            <Button full size="lg" onClick={send}>
              Send request
            </Button>
            <p className="ask__fineprint">
              They can say no, and you will not be told why. Your name and links stay hidden until
              you both agree.
            </p>
          </section>
        )}
      </div>
    </article>
  );
}

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
