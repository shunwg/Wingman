import { useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip, ToggleChip } from '@design/primitives/Chip';
import { StampBadge } from '@design/patterns/StampBadge';
import { isRedacted } from '@domain/person';
import type { MeetKind } from '@domain/intent';
import { useBoard } from '@state/selectors/board';
import { useStore } from '@state/store';
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

const KIND_LABEL: Record<MeetKind, string> = {
  gate_coffee: 'Coffee at the gate',
  lounge: 'The lounge',
  terminal_walk: 'Walk the terminal',
  ride_share: 'Share the ride in',
  meal: 'A meal',
  drinks: 'A drink',
  business_intro: 'An introduction',
  coworking: 'Cowork',
};

const OPENERS = [
  'Same flight — fancy a coffee before boarding?',
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
  const [sent, setSent] = useState(false);

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

  const send = () => {
    const window = { from: now, to: addMinutes(now, 90) };
    sendRequest({
      fromPersonId: me.id,
      toPersonId: p.id,
      // Which of your journeys this is for. Accepting closes that trip and no
      // other, so getting this wrong would stop suggestions for the wrong one.
      tripId: asTripId(candidate.viaTripId),
      overlapRef: overlapRefOf(candidate.overlap),
      proposal: { kind: chosen, window },
      message: opener,
      expiresAt: addMinutes(now, 60 * 24),
    });
    setSent(true);
  };

  return (
    <article className="person">
      <button className="person__back" onClick={onBack} type="button">
        ← Board
      </button>

      <div className="person__hero">
        <Avatar spec={p.avatar} shape="photo" size="full" {...(name ? { label: name } : {})} />
        <div className="person__scrim" aria-hidden="true" />
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

        {professional && (
          <p className="person__work">
            {[professional.title, professional.industry].filter(Boolean).join(' · ')}
            {professional.workingOn ? ` — ${professional.workingOn}` : ''}
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
          <dl className="receipt__list">
            {candidate.receipt.lines.map((l) => (
              <div className="receipt__row" key={l.label}>
                <dt>{l.label}</dt>
                <dd className={l.mono ? 'mono' : undefined}>{l.value}</dd>
              </div>
            ))}
          </dl>
          {candidate.receipt.suggestion && (
            <p className="receipt__suggestion">{candidate.receipt.suggestion}</p>
          )}
        </section>

        {sent ? (
          <div className="sentnote">
            <p className="sentnote__title">Request sent.</p>
            <p className="sentnote__body">
              You will hear back if they say yes. If they would rather not, you will simply see
              this close — no reason, and nothing to read into it.
            </p>
          </div>
        ) : (
          <section className="ask">
            <h3 className="ask__title">Ask to meet</h3>
            <p className="ask__note">Only what your overlap actually allows time for.</p>
            <div className="ask__kinds">
              {candidate.proposableKinds.map((k) => (
                <ToggleChip key={k} selected={chosen === k} onClick={() => setKind(k)}>
                  {KIND_LABEL[k]}
                </ToggleChip>
              ))}
            </div>

            <h4 className="ask__sub">Say something</h4>
            <div className="ask__openers">
              {OPENERS.map((o) => (
                <ToggleChip key={o} selected={opener === o} onClick={() => setOpener(o)}>
                  {o}
                </ToggleChip>
              ))}
            </div>

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
