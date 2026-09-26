import { useId, useMemo, useState } from 'react';
import type { RideAudience, RideDirection, Trip } from '@domain/index';
import { addMinutes, anyAudience, asCircleId, localTime, utcFromLocal } from '@domain/index';
import { airportIndex } from '@data/airports/index';
import { Button } from '@design/primitives/Button';
import { Field } from '@design/primitives/Field';
import { OptionRow } from '@design/primitives/OptionRow';
import { Sheet } from '@design/primitives/Sheet';
import { ToggleChip } from '@design/primitives/Chip';
import { useCircles } from '@state/selectors/circles';
import { DOOR_COPY } from '@data/copy/rides';
import { FARE_CURRENCIES, currencyForAirport } from '@data/currency';
import { useStore, type HostRideInput } from '@state/store';

/**
 * Offering a car.
 *
 * The form asks five things and infers the rest, because every extra field on
 * a screen someone reaches while walking to passport control is a field that
 * does not get filled in.
 *
 * Direction first, and it is a real choice rather than a guess from the trip:
 * the same journey has both a "get me to the airport" and a "get me out of the
 * airport" end, and which one someone means is the whole point.
 *
 * The door is three options, not a pile of switches. "Anyone matching" carries
 * the optional filters; a circle and a link do not need them, because those
 * people were already admitted to something.
 */

export interface RideSheetProps {
  open: boolean;
  trip: Trip;
  onClose: () => void;
  onDone: (rideId: string) => void;
}

type Door = 'open' | 'circles' | 'invite';

export function RideSheet({ open, trip, onClose, onDone }: RideSheetProps) {
  const id = useId();
  const hostRide = useStore((s) => s.hostRide);
  const circles = useCircles();
  const me = useStore((s) => s.me);

  const [direction, setDirection] = useState<RideDirection>('from_airport');
  const [door, setDoor] = useState<Door>('open');
  const [circleId, setCircleId] = useState<string>('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [seats, setSeats] = useState(3);
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('');
  const [fareAmount, setFareAmount] = useState('');
  const [fareCurrency, setFareCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * The two ends of this trip, so the airport is inferred rather than typed.
   * Landing at Changi means the car leaves Changi; a 06:40 out of Oslo means
   * the car arrives at Oslo.
   */
  const ends = useMemo(() => {
    const first = trip.segments[0];
    const last = trip.segments.at(-1);
    return {
      from_airport: last ? { iata: last.to, at: last.arriveUtc } : undefined,
      to_airport: first ? { iata: first.from, at: first.departUtc } : undefined,
    };
  }, [trip]);

  const end = ends[direction];
  const zone = end ? airportIndex.zone(end.iata) : undefined;
  // The meter runs in the airport's country; the host can say otherwise.
  const currency = fareCurrency ?? (end ? currencyForAirport(end.iata) : 'EUR');
  const dateOf = end && zone ? String(end.at).slice(0, 10) : undefined;

  /** The stay's own area, offered as the default so most people type nothing. */
  const suggested = trip.stays.find((s) => s.destination)?.destination;
  const mine = circles.filter((c) => me.memberships.some((m) => String(m.circleId) === String(c.id)));

  const submit = () => {
    if (!end || !zone || !dateOf) {
      setError('This trip has no flight to hang a car off yet.');
      return;
    }
    const placeLabel = label.trim() || suggested?.label || '';
    if (!placeLabel) {
      setError('Say roughly where the car goes — a neighbourhood, never an address.');
      return;
    }
    if (!time) {
      setError('Say when you want to leave.');
      return;
    }
    if (door === 'circles' && !circleId) {
      setError('Pick the circle, or open the car to anyone matching.');
      return;
    }

    /*
     * The coordinates come from the trip's stay, and they are the *city*
     * centroid — see the note in `tripEntry.ts`, where the decision is made
     * and defended: an area label is a label, never geocoded, so nothing
     * precise enough to find a door exists anywhere in this app.
     *
     * What that costs, stated plainly rather than discovered later: between
     * two manually entered trips in the same city the distance is always zero,
     * so the 5/15/40 km filter cannot tell "also going to Marina Bay" from
     * "going to Jurong". Direction, airport and pickup window still do the
     * real work of matching a car, and the label still carries the human
     * meaning. Sub-city precision would need a closed vocabulary of
     * neighbourhoods with published centroids — the same shape as the
     * interest-tag vocabulary, and a dataset decision, not a form field.
     */
    const point = suggested
      ? { lat: suggested.lat, lon: suggested.lon, label: placeLabel }
      : undefined;
    if (!point) {
      setError('Add where you are staying on this trip first, so people going your way can find the car.');
      return;
    }

    const rules = {
      ...anyAudience(),
      ...(womenOnly ? { genders: ['woman' as const] } : {}),
      ...(verifiedOnly ? { minAssurance: 2 as const } : {}),
    };
    const audience: RideAudience =
      door === 'open'
        ? { kind: 'open', rules }
        : door === 'circles'
          ? { kind: 'circles', circleIds: [asCircleId(circleId)], ...(womenOnly || verifiedOnly ? { rules } : {}) }
          : { kind: 'invite', ...(womenOnly || verifiedOnly ? { rules } : {}) };

    const from = utcFromLocal(dateOf as never, time, zone);
    const input: HostRideInput = {
      tripId: trip.id,
      direction,
      airportIata: end.iata,
      point,
      // An hour's window. Nobody knows their own pickup time to the minute
      // after a long flight, and a single instant would make two people who
      // could easily share a car look like they cannot.
      window: { from, to: addMinutes(from, 60) },
      seatsTotal: seats,
      audience,
      ...(fareAmount ? { fare: { amountMinor: Number(fareAmount) * 100, currency } } : {}),
    };

    try {
      const ride = hostRide(input);
      onDone(String(ride.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That car could not be opened.');
    }
  };

  return (
    <Sheet
      open={open}
      title="Share a car"
      onClose={onClose}
      actions={
        <Button onClick={submit} full>
          Offer the car
        </Button>
      }
    >
      <Field label="Which way" hint="Both halves of a journey need a car.">
        <div className="segmented" role="group" aria-label="Which way">
          <button
            type="button"
            className={`segmented__item ${direction === 'from_airport' ? 'is-on' : ''}`}
            aria-pressed={direction === 'from_airport'}
            onClick={() => setDirection('from_airport')}
          >
            Out of the airport
          </button>
          <button
            type="button"
            className={`segmented__item ${direction === 'to_airport' ? 'is-on' : ''}`}
            aria-pressed={direction === 'to_airport'}
            onClick={() => setDirection('to_airport')}
          >
            To the airport
          </button>
        </div>
      </Field>

      <p className="panel__note">
        {end
          ? `${direction === 'from_airport' ? 'From' : 'To'} ${String(end.iata)}${
              zone ? ` · ${localTime(end.at, zone)} local` : ''
            }`
          : 'This trip has no flight yet.'}
      </p>

      <Field
        label={direction === 'from_airport' ? 'Where the car goes' : 'Where the car starts'}
        hint="A neighbourhood, never an address."
        htmlFor={`${id}-label`}
      >
        <input
          id={`${id}-label`}
          className="input"
          value={label}
          placeholder={suggested?.label ?? 'Marina Bay'}
          onChange={(e) => {
            setLabel(e.target.value);
            setError(null);
          }}
        />
      </Field>

      <Field label="Leaving around" hint="Local time. An hour's window either side." htmlFor={`${id}-time`}>
        <input
          id={`${id}-time`}
          className="input mono"
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setError(null);
          }}
        />
      </Field>

      <Field label="Seats, including yours">
        <div className="segmented" role="group" aria-label="Seats">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              className={`segmented__item ${seats === n ? 'is-on' : ''}`}
              aria-pressed={seats === n}
              onClick={() => setSeats(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="The whole car, roughly"
        hint={
          fareAmount
            ? `About ${Math.ceil(Number(fareAmount) / seats)} ${currency} each if it fills. Optional.`
            : 'Optional. People decide faster when they can see what they would pay.'
        }
        htmlFor={`${id}-fare`}
      >
        <div className="fareinput">
          <input
            id={`${id}-fare`}
            className="input mono"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={fareAmount}
            onChange={(e) => setFareAmount(e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '').slice(0, 5))}
          />
          <select
            className="input fareinput__currency"
            value={currency}
            aria-label="Currency"
            onChange={(e) => setFareCurrency(e.target.value)}
          >
            {FARE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </Field>

      <Field label="Who can join">
        {/* Each option states its *consent* model, not its category. Two
            persona walks read "A circle" as a tightening and missed that it
            waives the host's yes — which is the half that matters when you
            are the one who will be sitting in the car. */}
        <OptionRow
          label="Anyone matching"
          note={DOOR_COPY.open.host}
          selected={door === 'open'}
          onClick={() => setDoor('open')}
        />
        <OptionRow
          label="A circle"
          note={DOOR_COPY.circles.host}
          selected={door === 'circles'}
          onClick={() => setDoor('circles')}
          disabled={mine.length === 0}
        />
        <OptionRow
          label="By link only"
          note={DOOR_COPY.invite.host}
          selected={door === 'invite'}
          onClick={() => setDoor('invite')}
        />
      </Field>

      {door === 'circles' && (
        <Field label="Which circle">
          <div className="panel__row">
            {mine.map((c) => (
              <ToggleChip
                key={String(c.id)}
                selected={circleId === String(c.id)}
                onClick={() => {
                  setCircleId(String(c.id));
                  setError(null);
                }}
              >
                {c.name}
              </ToggleChip>
            ))}
          </div>
        </Field>
      )}

      <Field
        label="Narrow it further"
        hint="On top of your profile's own privacy, which already applies to this car."
      >
        <div className="panel__row">
          <ToggleChip selected={womenOnly} onClick={() => setWomenOnly((v) => !v)}>
            Women only
          </ToggleChip>
          <ToggleChip selected={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)}>
            Verified only
          </ToggleChip>
        </div>
      </Field>

      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}

      <p className="panel__note">
        The fare is split evenly and stated, never charged. Wingman does not take money.
        The exact spot and the car can be added later, for the people in it.
      </p>
    </Sheet>
  );
}
