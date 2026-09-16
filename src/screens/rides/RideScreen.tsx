import { useState } from 'react';
import type { DisclosureLevel } from '@domain/index';
import { localTime } from '@domain/time';
import { redact } from '@privacy/index';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { Avatar } from '@design/primitives/Avatar';
import { airportIndex } from '@data/airports/index';
import { personById } from '@data/seed/people';
import { useRide, pendingSeats } from '@state/selectors/rides';
import { useStore } from '@state/store';
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
function riderCard(personId: string, rung: DisclosureLevel) {
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
  const rung: DisclosureLevel = mine?.status === 'confirmed' ? 2 : 0;
  const zone = airportIndex.zone(ride.airportIata);
  const when = zone
    ? `${localTime(ride.window.from, zone)} – ${localTime(ride.window.to, zone)}`
    : `${String(ride.window.from).slice(11, 16)} – ${String(ride.window.to).slice(11, 16)}`;
  const isHost = String(ride.hostPersonId) === String(me.id);
  const pending = isHost ? pendingSeats(ride) : [];
  const roomId = `ride:${String(ride.id)}`;
  const hasRoom = useStore.getState().channels.some((c) => String(c.id) === roomId);

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
            {seatsLeft === 0 ? 'Full' : seatsLeft === 1 ? '1 seat left' : `${seatsLeft} seats left`}
          </Chip>
          <Chip tone="neutral">
            {ride.fareSplit === 'host_pays' ? 'Host is covering it' : 'Fare split evenly'}
          </Chip>
          {ride.status === 'cancelled' && <Chip tone="warn">Called off</Chip>}
        </div>
      </header>

      <section className="panel">
        <h3 className="panel__title">Who is in it</h3>
        <ul className="ride__riders">
          {row.riders.map((pid) => {
            const isYou = String(pid) === String(me.id);
            const r = riderCard(String(pid), isYou ? 3 : rung);
            return (
              <li key={String(pid)} className="ride__rider">
                {r ? <Avatar spec={r.card.avatar} size="sm" /> : <span className="ride__blank" />}
                <span>{isYou ? 'You' : (r?.first ?? 'Someone')}</span>
                {String(pid) === String(ride.hostPersonId) && <Chip tone="neutral">Host</Chip>}
              </li>
            );
          })}
        </ul>
        <p className="panel__note">
          Meeting at the taxi rank. Wingman never shares an address — the car is arranged on public
          ground, like every other meet.
        </p>
      </section>

      {isHost && pending.length > 0 && (
        <section className="panel">
          <h3 className="panel__title">Asking for a seat</h3>
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
        {hasRoom && (row.mine?.status === 'confirmed' || isHost) && (
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
          <Button variant="quiet" onClick={() => cancelRide(rideId)}>
            Call off the car
          </Button>
        )}

        <Button variant="quiet" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
