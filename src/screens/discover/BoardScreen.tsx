import { PersonCard } from '@design/patterns/PersonCard';
import { Chip } from '@design/primitives/Chip';
import { Button } from '@design/primitives/Button';
import { bucketLabel } from '@lib/bucket';
import { useBoard, useRelaxations } from '@state/selectors/board';
import { useStore } from '@state/store';
import type { Candidate } from '@matching/index';
import { ContextStrip } from './ContextStrip';
import { SuppressionNote } from './SuppressionNote';

/**
 * The board.
 *
 * The main surface. Contains no matching logic whatsoever — it renders what the
 * selector hands it, which is what keeps the interesting decisions in a place
 * that can be tested under plain Node.
 */
export function BoardScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { candidates, suppressed, context } = useBoard();
  const relaxations = useRelaxations();
  const myTrip = useStore((s) => s.myTrip);

  if (!myTrip) {
    return (
      <div className="empty">
        <h2 className="empty__title display">No trip yet</h2>
        <p className="empty__body">
          Wingman only shows you people around a trip. Add one and the board fills in.
        </p>
        <Button onClick={() => (window.location.hash = '#/trips')}>Add a trip</Button>
      </div>
    );
  }

  return (
    <>
      <ContextStrip context={context} />

      {candidates.length === 0 ? (
        <div className="empty">
          <h2 className="empty__title display">You&rsquo;re first on this route</h2>
          <p className="empty__body">
            Nobody overlapping yet. Your trip stays listed, and anyone who books onto it will
            show up here.
          </p>
          {relaxations.length > 0 && (
            <div className="empty__unlocks">
              {relaxations.slice(0, 2).map((r) => (
                <p key={r.relaxation.kind} className="empty__unlock">
                  {r.label}
                </p>
              ))}
            </div>
          )}
          <SuppressionNote suppressed={suppressed} />
        </div>
      ) : (
        <>
          <div className="board">
            {candidates.map((c) => (
              <PersonCard
                key={String(c.person.id)}
                person={c.person}
                context={contextLine(c)}
                onClick={() => onOpen(String(c.person.id))}
                footer={<CardFooter candidate={c} />}
              />
            ))}
          </div>
          <SuppressionNote suppressed={suppressed} />
        </>
      )}
    </>
  );
}

function CardFooter({ candidate }: { candidate: Candidate }) {
  return (
    <div className="pcard__footer">
      <p className="pcard__why">{candidate.receipt.headline}</p>
      <div className="pcard__chips">
        {candidate.proposableKinds.slice(0, 3).map((k) => (
          <Chip key={k} tone="accent">
            {KIND_LABEL[k] ?? k}
          </Chip>
        ))}
      </div>
    </div>
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

/**
 * The line under the name.
 *
 * Facts only, in mono — where and when, never a compatibility claim. This is
 * the difference between "you are both on SQ317" and "92% match", and the first
 * one is both truer and more persuasive.
 */
function contextLine(c: Candidate): string {
  const o = c.overlap;
  switch (o.kind) {
    case 'same_flight':
      return `On your flight · ${hours(o.durationMin)}`;
    case 'shared_layover':
      return `${o.airport} layover · ${o.usableMin} min together`;
    case 'same_airport_window':
      return `${o.airport} · ${o.usableMin} min overlap`;
    case 'same_city_night':
      return `Same city · ${o.night}`;
    case 'overlapping_stay':
      return `${o.days} ${o.days === 1 ? 'day' : 'days'} overlapping`;
  }
}

const hours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export { bucketLabel };
