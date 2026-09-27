import { useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip, ToggleChip } from '@design/primitives/Chip';
import { CircleCrest } from '@design/patterns/CircleCrest';
import { Ticket } from '@design/icons/Ticket';
import { ShieldCheck } from '@design/icons/ShieldCheck';
import { PersonMark } from '@design/icons/PersonMark';
import { isRedacted, meetChannelId, type MeetRequest } from '@domain/index';
import { MEET_KIND_LABEL } from '@data/copy/meetKinds';
import { StampBadge } from '@design/patterns/StampBadge';
import { markArriving } from './arrive';
import { personById } from '@data/seed/people';
import { generateAvatar } from '@design/avatar/generate';
import { useInbox, type InboxFilter, type InboxRow } from '@state/selectors/inbox';
import { expiresIn, useIncomingCards } from '@state/selectors/requests';
import { useSeatAsks, type SeatAsk } from '@state/selectors/rides';
import { PersonMenu } from '@screens/safety/PersonMenu';
import { Sheet } from '@design/primitives/Sheet';
import { SEAT_YES_NOTE } from '@screens/rides/RideScreen';
import { windowLabel } from '@screens/whenLabel';
import { airportIndex } from '@data/airports/index';
import { useStore } from '@state/store';
import { AcceptSheet } from '@screens/safety/AcceptSheet';
import { DenySheet } from './DenySheet';

/**
 * One inbox.
 *
 * Every conversation as a row of the same shape: a meet, a circle's General,
 * a group, a request you sent. What needs you sits at the top; the rest is
 * ordered by what moved last. One filter row, no section headers, nothing
 * on a row that is not tappable.
 */

const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'meets', label: 'Meets' },
  { id: 'circles', label: 'Circles' },
  { id: 'groups', label: 'Groups' },
];

const EMPTY: Record<InboxFilter, { title: string; body: string; cta: string; to: string }> = {
  all: { title: 'Nothing here yet', body: 'Ask someone to meet, or open a circle and say hello.', cta: 'Find someone', to: '#/' },
  meets: { title: 'No meets yet', body: 'A room opens once you have both said yes.', cta: 'Find someone', to: '#/' },
  circles: { title: 'No circles yet', body: 'Join one and its General appears here.', cta: 'See circles', to: '#/circles' },
  groups: { title: 'No groups yet', body: 'Start one from a circle you are in.', cta: 'See circles', to: '#/circles' },
};

export function InboxScreen({ onOpen }: { onOpen: (hash: string) => void }) {
  const [filter, setFilter] = useState<InboxFilter>('all');
  const { pending, rows } = useInbox(filter);
  const now = useStore((s) => s.now);
  const me = useStore((s) => s.me);
  const advance = useStore((s) => s.advanceRequest);
  const [accepting, setAccepting] = useState<MeetRequest | null>(null);
  const [denying, setDenying] = useState<MeetRequest | null>(null);
  const cards = useIncomingCards();
  const seatAsks = useSeatAsks();
  const confirmSeat = useStore((s) => s.confirmSeat);
  const declineSeat = useStore((s) => s.declineSeat);
  const [seatYes, setSeatYes] = useState<SeatAsk | null>(null);

  return (
    <>
      {pending.length > 0 && (
        <section className="strip" aria-label="Waiting for you">
          {pending.map((r) => {
            const from = personById(String(r.fromPersonId));
            const card = cards.find((c) => String(c.request.id) === String(r.id))?.card;
            return (
              <article className="strip__row" key={String(r.id)}>
                <Avatar spec={from?.avatar ?? generateAvatar(String(r.fromPersonId))} size="sm" />
                <div className="strip__body">
                  <p className="strip__who">
                    {from?.firstName ?? 'Someone'} asked to meet
                    <span className="strip__when mono"> · {expiresIn(r, String(now)) ?? 'expiring'}</span>
                  </p>
                  {card && card.stamps.length > 0 && (
                    <span className="strip__stamps">
                      {card.stamps.slice(0, 3).map((s, i) => (
                        <StampBadge key={`${s.kind}-${i}`} stamp={s} compact />
                      ))}
                    </span>
                  )}
                  <p className="strip__receipt">
                    {MEET_KIND_LABEL[r.proposal.kind]}
                    {card && typeof card.headline === 'string' && card.headline ? ` · ${card.headline}` : ''}
                  </p>
                  {card && !isRedacted(card.professional) && Array.isArray(card.professional.lookingFor) && card.professional.lookingFor.length > 0 && (
                    <p className="strip__receipt">Looking for {card.professional.lookingFor.join(' · ')}</p>
                  )}
                  <p className="strip__msg">&ldquo;{r.message}&rdquo;</p>
                </div>
                <div className="strip__actions">
                  <Button size="sm" onClick={() => setAccepting(r)}>
                    Yes
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setDenying(r)}>
                    Not this time
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {seatAsks.length > 0 && (
        <section className="strip" aria-label="Seats asked for">
          {seatAsks.map((a) => {
            const first = typeof a.card.displayName === 'string' ? a.card.displayName.split(' ')[0] : 'Someone';
            return (
              <article className="strip__row" key={`${String(a.ride.id)}:${String(a.claim.personId)}`}>
                <Avatar spec={a.card.avatar} size="sm" />
                <div className="strip__body">
                  <p className="strip__who">{first} asked for a seat in your car</p>
                  {typeof a.card.headline === 'string' && a.card.headline && (
                    <p className="strip__receipt">{a.card.headline}</p>
                  )}
                  {a.card.stamps.length > 0 && (
                    <span className="strip__stamps">
                      {a.card.stamps.slice(0, 3).map((st, i) => (
                        <StampBadge key={`${st.kind}-${i}`} stamp={st} />
                      ))}
                    </span>
                  )}
                  <p className="strip__receipt">
                    <a className="strip__link" href={`#/car/${String(a.ride.id)}`}>
                      {a.route.from} → {a.route.to} · {windowLabel(a.ride.window.from, a.ride.window.to, airportIndex.zone(a.ride.airportIata), now)}
                    </a>
                  </p>
                  {a.claim.note && <p className="strip__msg">&ldquo;{a.claim.note}&rdquo;</p>}
                </div>
                <div className="strip__actions">
                  {/* Their note is in your inbox before any yes: hide or report
                      it from here, not only from a car screen. */}
                  <PersonMenu personId={a.claim.personId} firstName={first ?? 'them'} />
                  <Button size="sm" onClick={() => setSeatYes(a)}>
                    Yes
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => declineSeat(String(a.ride.id), a.claim.personId)}>
                    Not this time
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="filterbar filterbar--inbox" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <ToggleChip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </ToggleChip>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <h2 className="empty__title display">{EMPTY[filter].title}</h2>
          <p className="empty__body">{EMPTY[filter].body}</p>
          <Button onClick={() => onOpen(EMPTY[filter].to)}>{EMPTY[filter].cta}</Button>
        </div>
      ) : (
        <ol className="inbox">
          {rows.map((r) => (
            <li key={r.id}>
              <Row row={r} onOpen={onOpen} />
            </li>
          ))}
        </ol>
      )}

      {accepting && (
        <AcceptSheet
          request={accepting}
          firstName={personById(String(accepting.fromPersonId))?.firstName ?? 'them'}
          onClose={() => setAccepting(null)}
          onConfirm={() => {
            const room = String(meetChannelId(accepting.id));
            advance(String(accepting.id), 'accepted', me.id);
            setAccepting(null);
            // The one moment that animates: mark it, then go there.
            markArriving(room);
            onOpen(`#/inbox/${room}`);
          }}
        />
      )}
      {denying && <DenySheet request={denying} onClose={() => setDenying(null)} />}
      {seatYes && (
        <Sheet
          open
          title="Give them the seat?"
          onClose={() => setSeatYes(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setSeatYes(null)}>
                Not yet
              </Button>
              <Button
                onClick={() => {
                  confirmSeat(String(seatYes.ride.id), seatYes.claim.personId);
                  setSeatYes(null);
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
    </>
  );
}

function Row({ row, onOpen }: { row: InboxRow; onOpen: (hash: string) => void }) {
  const to = row.channelId ? `#/inbox/${String(row.channelId)}` : `#/person/${String(row.personId)}`;
  const Glyph = row.kind === 'circle' ? ShieldCheck : row.kind === 'group' ? PersonMark : Ticket;
  return (
    <button
      type="button"
      className={`inboxrow ${row.unread ? 'is-unread' : ''} ${row.muted ? 'is-muted' : ''}`}
      onClick={() => onOpen(to)}
    >
      <span className="inboxrow__mark">
        {row.crest ? (
          <CircleCrest shortName={row.crest.shortName} {...(row.crest.crestUrl ? { crestUrl: row.crest.crestUrl } : {})} size="sm" />
        ) : row.avatar ? (
          <Avatar spec={row.avatar} size="sm" />
        ) : (
          <span className="crest crest--sm" aria-hidden="true" />
        )}
      </span>
      <span className="inboxrow__body">
        <span className="inboxrow__top">
          <span className="inboxrow__title">{row.title}</span>
          <span className="inboxrow__time mono">{when(String(row.at), row.at ? undefined : undefined)}</span>
        </span>
        <span className="inboxrow__line">
          <span className="inboxrow__glyph" aria-hidden="true">
            <Glyph size={12} />
          </span>
          {row.status === 'waiting' && <Chip>Waiting</Chip>}
          {row.status === 'closed' && <Chip>Closed</Chip>}
          <span className="inboxrow__text">{row.line}</span>
        </span>
      </span>
      {row.unread && <span className="inboxrow__dot" aria-label="Unread" />}
    </button>
  );
}

/** HH:MM today, a weekday this week, else "12 Sep". Never longer. */
export function when(iso: string, _unused?: undefined): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date('2026-09-02T16:30:00Z');
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return iso.slice(11, 16);
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
