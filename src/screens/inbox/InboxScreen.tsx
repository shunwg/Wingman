import { useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip, ToggleChip } from '@design/primitives/Chip';
import { CircleCrest } from '@design/patterns/CircleCrest';
import { Ticket } from '@design/icons/Ticket';
import { ShieldCheck } from '@design/icons/ShieldCheck';
import { PersonMark } from '@design/icons/PersonMark';
import type { MeetRequest } from '@domain/index';
import { personById } from '@data/seed/people';
import { generateAvatar } from '@design/avatar/generate';
import { useInbox, type InboxFilter, type InboxRow } from '@state/selectors/inbox';
import { expiresIn } from '@state/selectors/requests';
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

  return (
    <>
      {pending.length > 0 && (
        <section className="strip" aria-label="Waiting for you">
          {pending.map((r) => {
            const from = personById(String(r.fromPersonId));
            return (
              <article className="strip__row" key={String(r.id)}>
                <Avatar spec={from?.avatar ?? generateAvatar(String(r.fromPersonId))} size="sm" />
                <div className="strip__body">
                  <p className="strip__who">
                    {from?.firstName ?? 'Someone'} asked to meet
                    <span className="strip__when mono"> · {expiresIn(r, String(now)) ?? 'expiring'}</span>
                  </p>
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
            advance(String(accepting.id), 'accepted', me.id);
            setAccepting(null);
          }}
        />
      )}
      {denying && <DenySheet request={denying} onClose={() => setDenying(null)} />}
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
