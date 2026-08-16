import { PersonCard } from '@design/patterns/PersonCard';
import { Chip } from '@design/primitives/Chip';
import { Button } from '@design/primitives/Button';
import { bucketLabel } from '@lib/bucket';
import { tripCode } from '@domain/trip';
import { tripHueClass } from '@design/tokens/tripHue';
import { useBoard, useRelaxations, type BoardCandidate } from '@state/selectors/board';
import { useStore } from '@state/store';
import { personById } from '@data/seed/people';
import { BoardFilters } from './BoardFilters';
import { ContextStrip } from './ContextStrip';
import { SuppressionNote } from './SuppressionNote';

/**
 * The board.
 *
 * The main surface. Contains no matching logic whatsoever — it renders what the
 * selector hands it, which is what keeps the interesting decisions in a place
 * that can be tested under plain Node.
 *
 * Every suggestion is tagged with the journey it belongs to. Once there is more
 * than one trip in flight, an untagged board is unreadable: "coffee at the
 * gate" means nothing until you know which gate, in which month.
 */
export function BoardScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const board = useBoard();
  const relaxations = useRelaxations();
  const myTrips = useStore((s) => s.myTrips);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const reopenTrip = useStore((s) => s.reopenTrip);

  if (myTrips.length === 0) {
    return (
      <div className="empty">
        <h2 className="empty__title display">No trips yet</h2>
        <p className="empty__body">
          Wingman only shows you people around a trip. Add one and the board fills in.
        </p>
        <Button onClick={() => (window.location.hash = '#/trip')}>Add a trip</Button>
      </div>
    );
  }

  return (
    <>
      <ContextStrip context={board.context} />
      <BoardFilters openTrips={board.openTrips} />

      {/* A settled trip is not an empty result — it is a finished one, and
          saying so is the difference between "we found nobody" and "you already
          found someone". */}
      {board.settledTrips.map((t) => {
        const withWhom = personById(String(t.outcome!.settledWith));
        return (
          <div className={`settled ${tripHueClass(tripCode(t))}`} key={String(t.id)}>
            <div className="settled__head">
              <span className="tripdot" aria-hidden="true" />
              <span className="settled__code mono">{tripCode(t)}</span>
              <Chip tone="trust">Sorted</Chip>
            </div>
            <p className="settled__body">
              You&rsquo;re meeting {withWhom?.firstName ?? 'someone'} on this trip, so Wingman has
              stopped suggesting people for it.
            </p>
            <Button size="sm" variant="secondary" onClick={() => reopenTrip(String(t.id))}>
              Look again anyway
            </Button>
          </div>
        );
      })}

      {board.openTrips.length === 0 ? (
        <div className="empty">
          <h2 className="empty__title display">Every trip is sorted</h2>
          <p className="empty__body">
            You have someone lined up for each journey. Add another trip, or reopen one above.
          </p>
        </div>
      ) : board.candidates.length === 0 ? (
        <div className="empty">
          <h2 className="empty__title display">
            {board.hiddenByFilters > 0 ? 'Nobody matches those filters' : 'You’re first on this route'}
          </h2>
          <p className="empty__body">
            {board.hiddenByFilters > 0
              ? `${board.hiddenByFilters} ${board.hiddenByFilters === 1 ? 'person is' : 'people are'} hidden by the filters above.`
              : 'Nobody overlapping yet. Your trip stays listed, and anyone who books onto it will show up here.'}
          </p>
          {board.hiddenByFilters > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setFilters({ tripId: 'all', circleId: 'any', womenOnly: false, withinKm: null })
              }
            >
              Clear the filters
            </Button>
          )}
          {board.hiddenByFilters === 0 && relaxations.length > 0 && (
            <div className="empty__unlocks">
              {relaxations.slice(0, 2).map((r) => (
                <p key={r.relaxation.kind} className="empty__unlock">
                  {r.label}
                </p>
              ))}
            </div>
          )}
          <SuppressionNote suppressed={board.suppressed} />
        </div>
      ) : (
        <>
          {board.hiddenByFilters > 0 && (
            <p className="filters__hidden">
              {board.hiddenByFilters} more {board.hiddenByFilters === 1 ? 'person' : 'people'}{' '}
              hidden by your filters.
            </p>
          )}

          <div className="board">
            {board.candidates.map((c) => (
              <PersonCard
                // Keyed by person *and* trip: the same traveller can appear
                // under two flight codes, and a person-only key would collide.
                key={`${String(c.person.id)}-${c.viaTripId}`}
                person={c.person}
                context={contextLine(c)}
                // Only worth showing when there is something to distinguish
                // from. With one open trip the flight code is noise on every
                // card, repeating what the header already said.
                {...(board.openTrips.length > 1 && filters.tripId === 'all'
                  ? { tripCode: c.tripCode, tripLabel: c.tripLabel }
                  : {})}
                onClick={() => onOpen(`${String(c.person.id)}/${c.viaTripId}`)}
                footer={<CardFooter candidate={c} />}
              />
            ))}
          </div>
          <SuppressionNote suppressed={board.suppressed} />
        </>
      )}
    </>
  );
}

function CardFooter({ candidate }: { candidate: BoardCandidate }) {
  return (
    <div className="pcard__footer">
      <p className="pcard__why">{candidate.receipt.headline}</p>
      {candidate.destinationKm !== undefined && (
        <p className="pcard__why">
          {/* Rounded, and never below 1km. A precise distance between two
              stated destinations is a good deal more locating than either
              destination alone. */}
          Heading{' '}
          {candidate.destinationKm < 1
            ? 'the same way as you'
            : `about ${Math.round(candidate.destinationKm)}km from you`}
          .
        </p>
      )}
      {/* What is physically possible given the overlap — information, not
          controls. These were ember, which made three of them shout louder
          than the card's actual action and read as buttons that do nothing
          when tapped. */}
      <div className="pcard__chips">
        {candidate.proposableKinds.slice(0, 3).map((k) => (
          <Chip key={k} tone="neutral">
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
function contextLine(c: BoardCandidate): string {
  const o = c.overlap;
  switch (o.kind) {
    case 'same_flight':
      return `On your flight · ${hours(o.durationMin)}`;
    case 'shared_layover':
      return `${o.airport} layover · ${o.usableMin} min together`;
    case 'same_airport_window':
      return `${o.airport} · ${o.usableMin} min overlap`;
    case 'same_city_night':
      return `Same city · ${humanDate(o.night)}`;
    case 'overlapping_stay':
      return `${o.days} ${o.days === 1 ? 'day' : 'days'} overlapping`;
  }
}

const hours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/**
 * "2026-09-03" → "3 Sept".
 *
 * An ISO date is a storage format, not a thing to show a person standing in a
 * terminal. The domain keeps the machine-readable form and the render edge
 * turns it into something you can read at a glance — the same split that keeps
 * every time in this app UTC underneath and local on screen.
 */
function humanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  // Noon UTC, so the date cannot slip a day when it is rendered west of GMT.
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  // No weekday: the context line is uppercase mono and "SAME CITY · THU 3 SEPT"
  // wraps at 390px, where "SAME CITY · 3 SEP" does not. The day of the week is
  // not what anyone is deciding on.
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export { bucketLabel };
