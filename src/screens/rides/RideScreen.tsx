import { useState } from 'react';
import type { AvatarSpec, DisclosureLevel } from '@domain/index';
import { PICKUP_NOTE_CAP, looksLikeAddress, seatsAutomatically } from '@domain/index';
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
import { watchEndsWith } from '@state/guardianWatch';
import { DOOR_COPY, RIDE_FARE_NOTE, rideGround } from '@data/copy/rides';
import { StampBadge } from '@design/patterns/StampBadge';
import { PersonMenu } from '@screens/safety/PersonMenu';
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

/** What saying yes to a seat gives away — said before, as a coffee request's sheet does. */
export const SEAT_YES_NOTE =
  'They join the car and its room, and see where to meet it. You can still take the seat back until the car leaves.';

const REFUSAL_COPY: Record<string, string> = {
  own_car: 'This is your car.',
  no_seats: 'Every seat is taken.',
  closed: 'This car has left.',
  already_claimed: '',
  not_again: 'This seat has closed.',
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
  const [givingUp, setGivingUp] = useState(false);
  const [takingBack, setTakingBack] = useState<string | null>(null);
  const [sayingYes, setSayingYes] = useState<string | null>(null);
  const endsWatch = useStore((s) => watchEndsWith(s.guardian, [`ride:${rideId}`], s.now));

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
  // You hid the host. The hide ended your seat; the rest of this screen — a
  // door, a split "with you in", a rider list with the host filtered out —
  // described a car you are no longer part of and never said why.
  if (!isHost && me.blocked.some((b) => String(b) === String(ride.hostPersonId))) {
    return (
      <div className="screen ride">
        <header className="ride__head">
          <p className="ride__route">
            <span>{route.from}</span>
            <span className="ride__to">to</span>
            <span>{route.to}</span>
          </p>
          <p className="ride__when mono">{when} local</p>
        </header>
        <section className="panel">
          <p className="panel__note">
            {mine?.status === 'revoked_by_policy'
              ? 'You hid the host of this car, so your seat in it has ended. The car no longer appears for you.'
              : 'You hid the host of this car, so it no longer appears for you.'}
          </p>
        </section>
        <Button variant="quiet" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }
  // A called-off car keeps its record — who was in it, when — and drops what
  // only a car still to come can promise: a door, a split, a place to stand.
  const calledOff = ride.status === 'cancelled';
  /*
   * You can ask again after giving a seat up or withdrawing a request. The
   * button used to need *no* claim at all, so a withdrawn one left only Back —
   * under a sheet that had just promised "you can ask again".
   */
  const live = mine?.status === 'requested' || mine?.status === 'confirmed';
  const canAsk = !isHost && !live && refusal === null;
  // A host's no, a removal, and a hide all read the same to the person whose
  // seat ended: it closed. Never which, and never who.
  const seatClosed =
    mine?.status === 'removed_by_host' ||
    mine?.status === 'declined' ||
    (mine?.status === 'revoked_by_policy' && ride.status !== 'cancelled');
  const hiddenHere = row.riders.some((pid) => me.blocked.includes(pid));
  const hostName = isHost ? 'You' : (riderCard(String(ride.hostPersonId), 0)?.first ?? 'The host');
  const fare = fareCopy(ride, row.riders.length, inCar, hostName, canAsk);
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
          {ride.status !== 'cancelled' && (
          <Chip tone={seatsLeft === 0 ? 'neutral' : 'accent'}>
            {/* Same wording as the card. "1 seat left" left a persona asking
                "out of how many?", and two surfaces answering the same
                question differently is its own small dishonesty. */}
            {seatsLeft === 0
              ? 'Full'
              : `${seatsLeft} of ${ride.seatsTotal} seat${ride.seatsTotal === 1 ? '' : 's'} free`}
          </Chip>
          )}
          {ride.status !== 'cancelled' && <Chip tone="neutral">{fare.short}</Chip>}
          {calledOff && <Chip tone="warn">Called off</Chip>}
        </div>
        {calledOff && <p className="panel__note ride__offnote">Every seat in it has ended. Nobody can ask for one now.</p>}
      </header>

      {/* First, for a host: somebody is waiting on them, and it used to sit
          below two new panels and the fold. */}
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
                <li key={String(c.personId)} className="ride__ask">
                  <div className="ride__askhead">
                    {r ? <Avatar spec={r.card.avatar} size="sm" /> : <span className="ride__blank" />}
                    <span className="ride__askwho">
                      <span className="ride__askname">{r?.first ?? 'Someone'}</span>
                      {/* What the ladder already allows at this rung — a line and
                          their stamps. A first name and a face was all a host had
                          to decide who sits beside her. */}
                      {r && 'headline' in r.card && typeof r.card.headline === 'string' && r.card.headline && (
                        <span className="ride__askline">{r.card.headline}</span>
                      )}
                      {r && 'stamps' in r.card && r.card.stamps.length > 0 && (
                        <span className="ride__askstamps">
                          {r.card.stamps.slice(0, 3).map((st, i) => (
                            <StampBadge key={`${st.kind}-${i}`} stamp={st} />
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="ride__askmore">
                      <PersonMenu personId={c.personId} firstName={r?.first ?? 'them'} />
                    </span>
                  </div>
                  {c.note && <p className="ride__asknote">&ldquo;{c.note}&rdquo;</p>}
                  <div className="ride__askactions">
                    {seatsLeft > 0 ? (
                      <Button size="sm" onClick={() => setSayingYes(String(c.personId))}>
                        Yes
                      </Button>
                    ) : (
                      <span className="panel__note">The car is full.</span>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => declineSeat(rideId, c.personId)}>
                      No
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!calledOff && (
      <section className="panel">
        <h3 className="panel__title">Who can join</h3>
        <p className="ride__door">
          <Chip tone="neutral">{isHost ? DOOR_COPY[ride.audience.kind].chip : DOOR_COPY[ride.audience.kind].guestChip}</Chip>
          {circleName && <Chip tone="neutral">{circleName}</Chip>}
        </p>
        <p className="panel__note">
          {isHost ? DOOR_COPY[ride.audience.kind].host : DOOR_COPY[ride.audience.kind].guest}
        </p>
        {narrowed.length > 0 && (
          <p className="panel__note">Narrowed to {narrowed.join(' and ')}.</p>
        )}
      </section>
      )}

      <section className="panel">
        <h3 className="panel__title">Who is in it</h3>
        <ul className="ride__riders">
          {row.riders.filter((pid) => !me.blocked.includes(pid)).map((pid) => {
            const isYou = String(pid) === String(me.id);
            const r = riderCard(String(pid), isYou ? 3 : rung, { id: String(me.id), avatar: me.avatar });
            return (
              <li key={String(pid)} className="ride__rider">
                {r ? <Avatar spec={r.card.avatar} size="sm" /> : <span className="ride__blank" />}
                <span>{isYou ? 'You' : (r?.first ?? 'Someone')}</span>
                {String(pid) === String(ride.hostPersonId) && <Chip tone="neutral">Host</Chip>}
                {isHost && !isYou && (
                  <Button size="sm" variant="quiet" onClick={() => setTakingBack(String(pid))}>
                    Take the seat back
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {hiddenHere && !isHost && mine?.status === 'confirmed' && (
          // A hide keeps them out of your view, not out of someone else's car.
          // Saying so is the difference between a hide and a false sense of one.
          <p className="ride__hidden" role="note">
            Someone you hid is in this car. Hiding them keeps them out of your view, not out of the car — they
            can still read what you post in its room. You can give up your seat.
          </p>
        )}
        <p className="panel__note">{rideGround(ride.direction)}</p>
      </section>

      {!calledOff && (
      <section className="panel" aria-label="What it costs">
        <h3 className="panel__title">What it costs</h3>
        {fare.each ? (
          <p className="ride__fare">
            <span className="ride__fareeach">{fare.each}</span> <span className="ride__faredetail">{fare.detail}</span>
          </p>
        ) : (
          <p className="panel__note">{fare.detail}</p>
        )}
        {/* Only when it is split: under "the host is covering it" this line
            contradicted the one above it. */}
        {ride.fareSplit !== 'host_pays' && <p className="panel__note">{RIDE_FARE_NOTE}</p>}
        {isHost && ride.fareSplit !== 'host_pays' && ride.status !== 'cancelled' && (
          <Button size="sm" variant="quiet" onClick={() => setEditingFare(true)}>
            {ride.fare ? 'Change the estimate' : 'Add an estimate'}
          </Button>
        )}
      </section>
      )}

      {!calledOff && (
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

      {canAsk && (
        // Pinned above the tab bar. A direct child of the screen, not of the
        // actions column: a sticky element cannot rise above the top of its
        // own container, and as that column's first child it never moved.
        <div className="ride__cta">
          <Button full onClick={() => claimSeat(rideId)}>
            {row.seatsAutomatically ? 'Take the seat' : 'Ask for a seat'}
          </Button>
          {mine?.status === 'withdrawn' && seatsAutomatically(ride.audience) && (
            <p className="panel__note">You gave this seat up, so the host says yes this time.</p>
          )}
        </div>
      )}

      {/* The host's no stands, and the passenger is told only that the seat
          closed — never which of them ended it. */}
      {!isHost && seatClosed && <p className="panel__note">This seat has closed.</p>}

      <div className="ride__actions">
        {channels.some((c) => String(c.id) === roomId) &&
          (row.mine?.status === 'confirmed' || isHost) && (
          <Button variant="quiet" onClick={() => onOpenRoom(roomId)}>
            Open the car&rsquo;s room
          </Button>
        )}

        {!isHost && !live && !seatClosed && refusal !== null && REFUSAL_COPY[refusal] && (
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
          <Button variant="quiet" onClick={() => setGivingUp(true)}>
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
                : pending.length > 0
                  ? 'Nobody has a seat yet. Anyone asking sees the request close.'
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
          placeholder={
            ride.direction === 'from_airport'
              ? 'Rank door 12. White estate, plate ends 4R.'
              : 'Outside the bakery on the square. Grey Skoda.'
          }
          onClose={() => setEditingNote(false)}
          onSave={(note) => {
            setPickupNote(rideId, note);
            setEditingNote(false);
          }}
        />
      )}
      {takingBack && (
        <Sheet
          open
          title="Take the seat back?"
          onClose={() => setTakingBack(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setTakingBack(null)}>
                Keep them in
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  removeSeat(rideId, takingBack as never);
                  setTakingBack(null);
                }}
              >
                Take it back
              </Button>
            </>
          }
        >
          <p className="sheet__body">
            They leave the car and its room, and cannot take the seat again. The car is told they are no longer in
            it — not who decided.
          </p>
        </Sheet>
      )}
      {sayingYes && (
        <Sheet
          open
          title="Give them the seat?"
          onClose={() => setSayingYes(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setSayingYes(null)}>
                Not yet
              </Button>
              <Button
                onClick={() => {
                  confirmSeat(rideId, sayingYes as never);
                  setSayingYes(null);
                }}
              >
                Yes, they are in
              </Button>
            </>
          }
        >
          <p className="sheet__body">{SEAT_YES_NOTE}</p>
        </Sheet>
      )}
      {givingUp && (
        <Sheet
          open
          title="Give up your seat?"
          onClose={() => setGivingUp(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setGivingUp(false)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  withdrawSeat(rideId);
                  setGivingUp(false);
                }}
              >
                Give it up
              </Button>
            </>
          }
        >
          <p className="sheet__body">
            The car is told you are no longer in it, and you leave its room. While a seat is free you can ask again.
          </p>
          {endsWatch && <p className="sheet__body">The watch you started for this car ends too.</p>}
        </Sheet>
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
      <div className="fareinput">
        <Field label="The whole car, roughly" htmlFor="fare-amount">
          <input
            id="fare-amount"
            className="field__input mono"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            aria-describedby="fare-each"
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
          />
        </Field>
        <Field label="Currency" htmlFor="fare-currency">
          <select
            id="fare-currency"
            className="field__input fareinput__currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {FARE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="field__hint" id="fare-each">
        {each !== undefined
          ? `About ${each} ${currency} each if all ${seats} seats fill. Leave it empty to take the estimate back.`
          : 'Your best guess at the meter. Leave it empty to take the estimate back.'}
      </p>
      <p className="panel__note">{RIDE_FARE_NOTE}</p>
    </Sheet>
  );
}

/** The exact spot and the car, for the people in it. */
function PickupSheet({
  current,
  placeholder,
  onClose,
  onSave,
}: {
  current: string;
  placeholder: string;
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
          <Button disabled={looksLikeAddress(note)} onClick={() => onSave(note)}>
            Save
          </Button>
        </>
      }
    >
      <Field
        {...(looksLikeAddress(note) ? { error: 'That reads like an address. Name a public spot instead.' } : {})}
        label="The spot and the car"
        hint={`Only the people in the car see this — including anyone who takes a seat later. ${PICKUP_NOTE_CAP - note.length} characters left.`}
      >
        <textarea
          className="field__input"
          rows={3}
          value={note}
          maxLength={PICKUP_NOTE_CAP}
          placeholder={placeholder}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <p className="panel__note">A public place, never an address. Clear it to take the details down.</p>
    </Sheet>
  );
}
