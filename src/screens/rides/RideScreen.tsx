import { useState } from 'react';
import type { AvatarSpec, DisclosureLevel } from '@domain/index';
import { localTime } from '@domain/time';
import { redact } from '@privacy/index';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { Avatar } from '@design/primitives/Avatar';
import { airportIndex } from '@data/airports/index';
import { personById } from '@data/seed/people';
import { useRide, pendingSeats } from '@state/selectors/rides';
import { useStore } from '@state/store';
import { DOOR_COPY, RIDE_GROUND } from '@data/copy/rides';
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
  const [copied, setCopied] = useState(false);

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
  const when = zone
    ? `${localTime(ride.window.from, zone)} – ${localTime(ride.window.to, zone)}`
    : `${String(ride.window.from).slice(11, 16)} – ${String(ride.window.to).slice(11, 16)}`;
  const isHost = String(ride.hostPersonId) === String(me.id);
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
          <Chip tone="neutral">
            {ride.fareSplit === 'host_pays' ? 'Host is covering it' : 'Fare split evenly'}
          </Chip>
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
            <Button variant="danger" onClick={() => cancelRide(rideId)}>
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
    </div>
  );
}
