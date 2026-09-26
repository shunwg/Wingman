import { useState } from 'react';
import type { AvatarSpec, DisclosureLevel } from '@domain/index';
import { PICKUP_NOTE_CAP } from '@domain/index';
import { redact } from '@privacy/index';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { Avatar } from '@design/primitives/Avatar';
import { Field } from '@design/primitives/Field';
import { Sheet } from '@design/primitives/Sheet';
import { FARE_CURRENCIES, currencyForAirport } from '@data/currency';
import { windowLabel } from '@screens/whenLabel';
import { fareCopy } from './fareCopy';
import { airportIndex } from '@data/airports/index';
import { personById } from '@data/seed/people';
import { useRide, pendingSeats } from '@state/selectors/rides';
import { useStore } from '@state/store';
import { DOOR_COPY, RIDE_FARE_NOTE, RIDE_GROUND } from '@data/copy/rides';
import { useCircles } from '@state/selectors/circles';
import { rideInviteLink } from './link';

/**
 * One shared car.
 *
 * The screen answers three questions in the order people ask them: where and
 * when, who else is in it, and what it costs. The claim button is last because
 * nobody decides before they have read the first two.
 *
 * The host's view is the same screen with the pending seats on it. A separate
 * host screen would have meant two places to keep the fare line honest.
 */

export interface RideScreenProps {
  rideId: string;
  onBack: () => void;
  onOpenRoom: (channelId: string) => void;
}

/**
 * A rider, at the rung the viewer has earned.
 *
 * Rule 1: a screen holds `RedactedPerson`, never `Person`. Someone browsing a
 * car they are not in sees the ladder's first rung — an avatar and a first
 * name, which is all "who is in this car" needs. Sharing the car is mutual
 * consent to share the journey, so a confirmed seat reads at `accepted`.
 */
function riderCard(personId: string, rung: DisclosureLevel, me?: { id: string; avatar: AvatarSpec }) {
  // The viewer is not in the seed pool, so `personById` misses on your own id
  // and the host saw a blank grey tile where their own face should be — a
  // rounded square among circles, on their own car.
  if (me && personId === me.id) return { card: { avatar: me.avatar }, first: 'You' };
  const raw = personById(personId);
  if (!raw) return undefined;
  const card = redact(raw, rung);
  const first = typeof card.displayName === 'string' ? card.displayName.split(' ')[0]! : 'Someone';
  return { card, first };
}

const REFUSAL_COPY: Record<string, string> = {
  own_car: 'This is your car.',
  no_seats: 'Every seat is taken.',
  closed: 'This car has left.',
  already_claimed: '',
  not_visible: '',
};

export function RideScreen({ rideId, onBack, onOpenRoom }: RideScreenProps) {
  const row = useRide(rideId);
  const me = useStore((s) => s.me);
  const claimSeat = useStore((s) => s.claimSeat);
  const withdrawSeat = useStore((s) => s.withdrawSeat);
  const confirmSeat = useStore((s) => s.confirmSeat);
  const declineSeat = useStore((s) => s.declineSeat);
  const cancelRide = useStore((s) => s.cancelRide);
  // Subscribed, not read once: taking a seat opens the room in the same tick,
  // and a getState() read here left the button missing until something else
  // happened to re-render the screen.
  const channels = useStore((s) => s.channels);
  const circles = useCircles();
  const removeSeat = useStore((s) => s.removeSeat);
  const setRideFare = useStore((s) => s.setRideFare);
  const setPickupNote = useStore((s) => s.setPickupNote);
  const now = useStore((s) => s.now);
  const [copied, setCopied] = useState(false);
  const [editingFare, setEditingFare] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  if (!row) {
    return (
      <div className="screen">
        <p className="panel__note">That car is not available.</p>
        <Button variant="quiet" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  const { ride, route, seatsLeft, mine, refusal } = row;
  // Rung 1 — see the note in RideBoard: a shared car is not mutual consent
  // between passengers, so it does not release what an accepted request does.
  const rung: DisclosureLevel = mine?.status === 'confirmed' ? 1 : 0;
  const zone = airportIndex.zone(ride.airportIata);
  // Dated, like the card: "Tomorrow 17:30 – 18:30". The screen said only the
  // clock while the card that led here said the day, so the day vanished on
  // the one screen where you decide.
  const when = windowLabel(ride.window.from, ride.window.to, zone, now);
  const isHost = String(ride.hostPersonId) === String(me.id);
  const inCar = isHost || mine?.status === 'confirmed';
  const hostName = isHost ? 'You' : (riderCard(String(ride.hostPersonId), 0)?.first ?? 'The host');
  const fare = fareCopy(ride, row.riders.length, inCar, hostName);
  const pending = isHost ? pendingSeats(ride) : [];
  const roomId = `ride:${String(ride.id)}`;

  // The circle is named, not merely alluded to. "Circle only" told a cohort
  // member nothing about *which* cohort, and INSEAD has 1,840 members where
  // her class has 180 — a difference she would very much like to see.
  const audience = ride.audience;
  const circleName =
    audience.kind === 'circles'
      ? (circles.find((c) => String(c.id) === String(audience.circleIds[0]))?.name ?? 'A circle')
      : undefined;

  // The extra narrowing, spelled out. A restriction nobody can read is a
  // restriction nobody can trust.
  const rules = audience.rules;
  const narrowed: string[] = [];
  if (rules && rules.genders !== 'any') narrowed.push(`${rules.genders.join(' and ')} only`);
  if (rules && rules.minAssurance > 0) narrowed.push('verified people only');

  return (
    <div className="screen ride">
      <header className="ride__head">
        <p className="ride__route">
          <span>{route.from}</span>
          <span className="ride__to">to</span>
          <span>{route.to}</span>
        </p>
        <p className="ride__when mono">{when} local</p>
        <div className="panel__row">
          <Chip tone={seatsLeft === 0 ? 'neutral' : 'accent'}>
            {/* Same wording as the card. "1 seat left" left a persona asking
                "out of how many?", and two surfaces answering the same
                question differently is its own small dishonesty. */}
            {seatsLeft === 0
              ? 'Full'
              : `${seatsLeft} of ${ride.seatsTotal} seat${ride.seatsTotal === 1 ? '' : 's'} free`}
          </Chip>
          <Chip tone="neutral">{fare.short}</Chip>
          {ride.status === 'cancelled' && <Chip tone="warn">Called off</Chip>}
        </div>
      </header>

      <section className="panel">
        <h3 className="panel__title">Who can join</h3>
        <p className="ride__door">
          <Chip tone="neutral">{DOOR_COPY[ride.audience.kind].chip}</Chip>
          {circleName && <Chip tone="neutral">{circleName}</Chip>}
        </p>
        <p className="panel__note">
          {isHost ? DOOR_COPY[ride.audience.kind].host : DOOR_COPY[ride.audience.kind].guest}
        </p>
        {narrowed.length > 0 && (
          <p className="panel__note">Narrowed to {narrowed.join(' and ')}.</p>
        )}
      </section>

      <section className="panel">
        <h3 className="panel__title">Who is in it</h3>
        <ul className="ride__riders">
          {row.riders.map((pid) => {
            const isYou = String(pid) === String(me.id);
            const r = riderCard(String(pid), isYou ? 3 : rung, { id: String(me.id), avatar: me.avatar });
            return (
              <li key={String(pid)} className="ride__rider">
                {r ? <Avatar spec={r.card.avatar} size="sm" /> : <span className="ride__blank" />}
                <span>{isYou ? 'You' : (r?.first ?? 'Someone')}</span>
                {String(pid) === String(ride.hostPersonId) && <Chip tone="neutral">Host</Chip>}
                {isHost && !isYou && (
                  <Button size="sm" variant="quiet" onClick={() => removeSeat(rideId, pid)}>
                    Take the seat back
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="panel__note">{RIDE_GROUND}</p>
      </section>

      <section className="panel" aria-label="What it costs">
        <h3 className="panel__title">What it costs</h3>
        {fare.each ? (
          <p className="ride__fare">
            <span className="ride__fareeach">{fare.each}</span> <span className="ride__faredetail">{fare.detail}</span>
          </p>
        ) : (
          <p className="panel__note">{fare.detail}</p>
        )}
        <p className="panel__note">{RIDE_FARE_NOTE}</p>
        {isHost && ride.fareSplit !== 'host_pays' && ride.status !== 'cancelled' && (
          <Button size="sm" variant="quiet" onClick={() => setEditingFare(true)}>
            {ride.fare ? 'Change the estimate' : 'Add an estimate'}
          </Button>
        )}
      </section>

      <section className="panel" aria-label="Where to meet the car">
        <h3 className="panel__title">Where to meet the car</h3>
        {/* The exact spot and the car are for the people in it. Gated on
            being in, not on the car filling: a car that never fills still has
            passengers who need to know where to stand. */}
        {inCar ? (
          ride.pickupNote ? (
            <p className="ride__pickup">{ride.pickupNote}</p>
          ) : (
            <p className="panel__note">
              {isHost
                ? 'Add the exact spot and the car once you know them. Only the people in the car see this.'
                : `${hostName} has not said yet. It appears here, and in the car\u2019s room, when they do.`}
            </p>
          )
        ) : (
          <p className="panel__note">The exact spot and the car are shared with the people in it, once you are.</p>
        )}
        {isHost && ride.status !== 'cancelled' && (
          <Button size="sm" variant="quiet" onClick={() => setEditingNote(true)}>
            {ride.pickupNote ? 'Edit the pickup details' : 'Add pickup details'}
          </Button>
        )}
      </section>

      {isHost && pending.length > 0 && (
        <section className="panel">
          <h3 className="panel__title">
            {pending.length === 1 ? 'One person is asking' : `${pending.length} people are asking`}
          </h3>
          <ul className="ride__riders">
            {pending.map((c) => {
              // Somebody asking for a seat has not been accepted yet, so they
              // read at the browsing rung — the same as they do on the board.
              const r = riderCard(String(c.personId), 0);
              return (
                <li key={String(c.personId)} className="ride__rider">
                  {r ? <Avatar spec={r.card.avatar} size="sm" /> : <span className="ride__blank" />}
                  <span className="ride__askname">{r?.first ?? 'Someone'}</span>
                  {c.note && <span className="panel__note">{c.note}</span>}
                  <Button size="sm" onClick={() => confirmSeat(rideId, c.personId)}>
                    Yes
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => declineSeat(rideId, c.personId)}>
                    No
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {isHost && ride.inviteCode && (
        <section className="panel">
          <h3 className="panel__title">The link</h3>
          <p className="ride__code mono">{ride.inviteCode}</p>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              void navigator.clipboard?.writeText(rideInviteLink(ride.inviteCode!)).then(
                () => setCopied(true),
                // A refused clipboard is not an error worth a dialog: the code
                // is on the screen and can be read out loud.
                () => setCopied(false),
              );
            }}
          >
            {copied ? 'Copied' : 'Copy the link'}
          </Button>
          <p className="panel__note">
            Anyone holding this can take a seat. Nobody else can see the car at all.
          </p>
        </section>
      )}

      <div className="ride__actions">
        {channels.some((c) => String(c.id) === roomId) &&
          (row.mine?.status === 'confirmed' || isHost) && (
          <Button variant="quiet" onClick={() => onOpenRoom(roomId)}>
            Open the car&rsquo;s room
          </Button>
        )}

        {!isHost && !mine && refusal === null && (
          <Button full onClick={() => claimSeat(rideId)}>
            {row.seatsAutomatically ? 'Take the seat' : 'Ask for a seat'}
          </Button>
        )}

        {!isHost && !mine && refusal !== null && REFUSAL_COPY[refusal] && (
          <p className="panel__note">{REFUSAL_COPY[refusal]}</p>
        )}

        {mine?.status === 'requested' && (
          <>
            <p className="panel__note">Waiting on the host. You will see it here either way.</p>
            <Button variant="quiet" onClick={() => withdrawSeat(rideId)}>
              Withdraw
            </Button>
          </>
        )}

        {mine?.status === 'confirmed' && (
          <Button variant="quiet" onClick={() => withdrawSeat(rideId)}>
            Give up the seat
          </Button>
        )}

        {isHost && ride.status !== 'cancelled' && (
          <>
            <Button variant="danger" onClick={() => setConfirmingCancel(true)}>
              Call off the car
            </Button>
            <p className="panel__note">
              {row.riders.length > 1
                ? 'Everyone in the car is told it is off. Their seats end; nothing is deleted.'
                : 'Nobody has a seat yet, so nobody is affected.'}
            </p>
          </>
        )}

        <Button variant="quiet" onClick={onBack}>
          Back
        </Button>
      </div>

      {editingFare && (
        <FareSheet
          {...(ride.fare ? { current: ride.fare } : {})}
          fallbackCurrency={currencyForAirport(ride.airportIata)}
          seats={ride.seatsTotal}
          onClose={() => setEditingFare(false)}
          onSave={(f) => {
            setRideFare(rideId, f);
            setEditingFare(false);
          }}
        />
      )}
      {editingNote && (
        <PickupSheet
          current={ride.pickupNote ?? ''}
          onClose={() => setEditingNote(false)}
          onSave={(note) => {
            setPickupNote(rideId, note);
            setEditingNote(false);
          }}
        />
      )}
      {confirmingCancel && (
        <Sheet
          open
          title="Call off the car?"
          onClose={() => setConfirmingCancel(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>
                Keep the car
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  cancelRide(rideId);
                  setConfirmingCancel(false);
                }}
              >
                Call it off
              </Button>
            </>
          }
        >
          <p className="sheet__body">
            {row.riders.length > 1
              ? 'Everyone in the car is told in its room, and their seats end. This cannot be undone \u2014 you would offer a new car.'
              : 'Nobody has a seat yet. The car stops showing on the board.'}
          </p>
        </Sheet>
      )}
    </div>
  );
}

/**
 * The host's estimate for the whole car.
 *
 * One number and a currency. Clearing the field takes the estimate back. The
 * hint shows the per-person figure while you type, because that is the number
 * everyone else will read.
 */
function FareSheet({
  current,
  fallbackCurrency,
  seats,
  onClose,
  onSave,
}: {
  current?: { amountMinor: number; currency: string };
  fallbackCurrency: string;
  seats: number;
  onClose: () => void;
  onSave: (fare: { amountMinor: number; currency: string } | null) => void;
}) {
  const [amount, setAmount] = useState(current ? String(Math.round(current.amountMinor / 100)) : '');
  const [currency, setCurrency] = useState(current?.currency ?? fallbackCurrency);
  const whole = Number(amount);
  const empty = amount.trim() === '';
  const valid = empty || (Number.isInteger(whole) && whole > 0);
  const each = valid && !empty ? Math.ceil(whole / seats) : undefined;
  return (
    <Sheet
      open
      title="What the car should cost"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={() => onSave(empty ? null : { amountMinor: whole * 100, currency })}>
            Save
          </Button>
        </>
      }
    >
      <Field
        label="The whole car, roughly"
        hint={
          each !== undefined
            ? `About ${each} ${currency} each if all ${seats} seats fill. Leave it empty to take the estimate back.`
            : 'Your best guess at the meter. Leave it empty to take the estimate back.'
        }
      >
        <div className="fareinput">
          <input
            className="input mono"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            aria-label="Amount"
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
          />
          <select
            className="input fareinput__currency"
            value={currency}
            aria-label="Currency"
            onChange={(e) => setCurrency(e.target.value)}
          >
            {FARE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </Field>
      <p className="panel__note">{RIDE_FARE_NOTE}</p>
    </Sheet>
  );
}

/** The exact spot and the car, for the people in it. */
function PickupSheet({
  current,
  onClose,
  onSave,
}: {
  current: string;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(current);
  return (
    <Sheet
      open
      title="Where to meet the car"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(note)}>Save</Button>
        </>
      }
    >
      <Field
        label="The spot and the car"
        hint={`Only the people in the car see this. ${PICKUP_NOTE_CAP - note.length} characters left.`}
      >
        <textarea
          className="field__input"
          rows={3}
          value={note}
          maxLength={PICKUP_NOTE_CAP}
          placeholder="Rank door 12. White estate, plate ends 4R."
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <p className="panel__note">A public place, never an address. Clear it to take the details down.</p>
    </Sheet>
  );
}
