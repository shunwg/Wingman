import { useEffect, useRef, useState } from 'react';
import type { JourneyStage, StageUpdate, Trip } from '@domain/index';
import { ARRIVAL_RAIL, DEPARTURE_RAIL } from '@domain/index';
import { epoch, type ISODateTime } from '@domain/time';
import { STAGE_COPY } from '@data/copy/stages';
import { Button } from '@design/primitives/Button';

/**
 * Where you are in the journey, on the trip itself.
 *
 * **The motion thesis, in one line:** the rail is still on every view and moves
 * only at the moment you advance it.
 *
 * That is the whole design, and it is what lets this exist at all on a surface
 * the product says does not animate. Trips is opened dozens of times a day; a
 * rail that replayed its fill on every visit would be decoration wearing a
 * progress bar's clothes. But advancing a stage is a deliberate act that
 * happens five or six times in a journey, and motion *at that instant* is
 * feedback — the same argument that earns the app its one elaborate moment on
 * accepting a request.
 *
 * So: the connector draws from the stage you left to the stage you reached
 * (280ms, a clip-path wipe, deceleration curve), the reached dot swells once
 * and settles, and its label crossfades up. Nothing loops. Nothing runs on
 * mount. Under `prefers-reduced-motion` the travel is removed and the colour
 * and opacity changes remain, because the *state* change still has to read.
 *
 * **Why you tap it.** The clock knows when your flight leaves and nothing
 * else. It cannot know whether you are through security or still in the taxi,
 * and a rail that guesses confidently is worse than no rail — it would tell
 * the car you were at the terminal while you were stuck on the motorway. So
 * the stage is something you say. The clock's only job is choosing which half
 * of the journey you are looking at.
 *
 * **Who sees it.** Nobody, until you tap the button that tells a car. The rail
 * is a note to yourself; sharing it is a separate, deliberate act, per the
 * same disclosure ladder that governs everything else here.
 */

export interface JourneyRailProps {
  trip: Trip;
  now: ISODateTime;
  /** What you last said, if anything. */
  current?: StageUpdate;
  onSet: (stage: JourneyStage) => void;
  /** Present when this trip has a car whose room you could tell. */
  onTellCar?: (stage: JourneyStage) => void;
  /** Which car — "Tell the car to Marina Bay" — so nobody tells the wrong one. */
  tellCarTo?: string;
  /** Step back — a rail you cannot correct is a rail people stop using. */
  onUndo?: () => void;
}

/** Stages that appear on one rail only, and so can name a direction. */
const DEPARTURE_ONLY = DEPARTURE_RAIL.filter((s) => !ARRIVAL_RAIL.includes(s));
const ARRIVAL_ONLY = ARRIVAL_RAIL.filter((s) => !DEPARTURE_RAIL.includes(s));

/**
 * Which half of the journey to show.
 *
 * The last arrival is the hinge: before it you are getting to and onto a
 * plane, after it you are getting out of an airport. Not a preference — a rail
 * showing where you will be in fourteen hours answers nothing about the next
 * twenty minutes.
 */
function railFor(trip: Trip, now: ISODateTime, current?: StageUpdate): JourneyStage[] {
  const lastArrival = trip.segments.at(-1)?.arriveUtc;

  /*
   * An unambiguous stage outranks the clock; an ambiguous one cannot decide.
   *
   * `in_car` is deliberately on both rails — it is the same act in both
   * directions, which is the whole point of the feature — and that makes it
   * exactly the wrong thing to read a direction from. Asking "is this stage on
   * the arrival rail?" put anyone who got into a car *to* the airport onto the
   * arrival rail, where `in_car` is the last step: five steps marked done, the
   * journey declared over before the flight, and no button left to press.
   *
   * So only the one-rail-only stages speak, and for the shared one the clock
   * decides — which is correct in both directions, because a car before your
   * flight lands you on departure and a car after it lands you on arrival.
   */
  if (current && ARRIVAL_ONLY.includes(current.stage)) return ARRIVAL_RAIL;
  if (current && DEPARTURE_ONLY.includes(current.stage)) return DEPARTURE_RAIL;
  if (lastArrival && epoch(now) >= epoch(lastArrival)) return ARRIVAL_RAIL;
  return DEPARTURE_RAIL;
}

export function JourneyRail({ trip, now, current, onSet, onTellCar, tellCarTo, onUndo }: JourneyRailProps) {
  const rail = railFor(trip, now, current);
  const at = current ? rail.indexOf(current.stage) : -1;
  const next = rail[at + 1];

  /*
   * Animate the step that just happened, and nothing else.
   *
   * `moved` holds the index the rail advanced *to*, set only when the stage
   * changes while mounted — so a fresh render of an already-advanced rail
   * paints its final state with no motion at all. It clears itself when the
   * run finishes, which is also what stops a re-render mid-animation from
   * restarting it.
   */
  const [moved, setMoved] = useState<number | null>(null);
  const previous = useRef<number>(at);
  useEffect(() => {
    if (previous.current !== at) {
      if (at > previous.current) setMoved(at);
      previous.current = at;
    }
  }, [at]);

  return (
    <section className="jrail" aria-label="Where you are on this trip">
      <ol className="jrail__track">
        {rail.map((stage, i) => {
          const done = i <= at;
          const isMoved = moved === i;
          return (
            <li
              key={stage}
              className={`jrail__step ${done ? 'is-done' : ''} ${i === at ? 'is-here' : ''} ${
                isMoved ? 'is-arriving' : ''
              }`}
              onAnimationEnd={isMoved ? () => setMoved(null) : undefined}
            >
              {i > 0 && (
                <span
                  className={`jrail__link ${i <= at ? 'is-filled' : ''} ${
                    moved === i ? 'is-drawing' : ''
                  }`}
                  aria-hidden="true"
                />
              )}
              <span className="jrail__dot" aria-hidden="true" />
              <span className="jrail__label">{STAGE_COPY[stage].rail ?? STAGE_COPY[stage].button}</span>
            </li>
          );
        })}
      </ol>

      <p className="jrail__said" aria-live="polite">
        {current ? STAGE_COPY[current.stage].mine : 'Nothing said yet — the rail is yours alone.'}
      </p>

      <div className="jrail__actions">
        {next && (
          <Button size="sm" variant="secondary" onClick={() => onSet(next)}>
            {STAGE_COPY[next].button}
          </Button>
        )}
        {current && onTellCar && (
          <Button size="sm" variant="quiet" onClick={() => onTellCar(current.stage)}>
            {tellCarTo ? `Tell the car to ${tellCarTo}` : 'Tell the car'}
          </Button>
        )}
        {/* The last step is still a step, and a mis-tap is the common case —
            so the rail always has something to press. Without this the end of
            a journey was a row of buttons that had quietly become empty. */}
        {current && onUndo && (
          <Button size="sm" variant="quiet" onClick={onUndo}>
            {next ? 'Not yet' : 'Take that back'}
          </Button>
        )}
      </div>
    </section>
  );
}
