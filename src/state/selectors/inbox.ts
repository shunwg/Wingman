import { useMemo } from 'react';
import type { AvatarSpec, Channel, ChannelId, ISODateTime, MeetRequest, Message, PersonId } from '@domain/index';
import { circleChannelId, meetChannelId } from '@domain/index';
import { SEED_CHANNELS, SEED_MESSAGES } from '@data/seed/channels';
import { personById } from '@data/seed/people';
import { STAGE_COPY } from '@data/copy/stages';
import { useStore } from '../store';
import { allCircles } from './circles';
import { useRequests } from './requests';

/**
 * One inbox.
 *
 * Every conversation you are in — a meet, a circle's General, a group — as a
 * row of the same shape, sorted by what needs you and then by what moved
 * last. Derived on every read; nothing here is stored. Unread is a comparison
 * against `readAt`, which is the one thing that is (it is a fact about you).
 */

export type InboxRowKind = 'meet' | 'circle' | 'group' | 'request';

export interface InboxRow {
  id: string;
  kind: InboxRowKind;
  channelId?: ChannelId;
  requestId?: string;
  /** The person, for a meet or a request row. */
  personId?: PersonId;
  title: string;
  /** The last line, already worded — a stage renders as its sentence. */
  line: string;
  at: ISODateTime;
  unread: boolean;
  /** Needs an answer from you — sorts to the top. */
  needsYou: boolean;
  muted: boolean;
  avatar?: AvatarSpec;
  crest?: { shortName: string; crestUrl?: string };
  /** A status chip for request rows. */
  status?: 'waiting' | 'closed';
}

export type InboxFilter = 'all' | 'meets' | 'circles' | 'groups';

/** Every channel I am in, seed and mine, with meet channels derived from requests. */
export function channelsFor(
  meId: PersonId,
  accepted: MeetRequest[],
  circleIds: string[],
  mine: Channel[],
): Channel[] {
  const meets: Channel[] = accepted.map((r) => {
    const other = r.fromPersonId === meId ? r.toPersonId : r.fromPersonId;
    return {
      id: meetChannelId(r.id),
      kind: 'meet',
      title: personById(String(other))?.firstName ?? 'Meeting',
      memberIds: [meId, other],
      requestId: r.id,
      createdBy: r.fromPersonId,
      createdAt: r.createdAt,
    };
  });
  const circles: Channel[] = circleIds.map((cid) => {
    const seeded = SEED_CHANNELS.find((c) => String(c.id) === String(circleChannelId(cid)));
    return (
      seeded ?? {
        id: circleChannelId(cid),
        kind: 'circle',
        title: 'General',
        memberIds: [],
        circleId: cid as never,
        createdBy: meId,
        createdAt: '2026-01-01T00:00:00Z' as ISODateTime,
      }
    );
  });
  const groups = [...SEED_CHANNELS, ...mine].filter(
    (c) => c.kind === 'group' && c.memberIds.includes(meId),
  );
  return [...meets, ...circles, ...groups];
}

export function messagesFor(channelId: ChannelId, stored: Message[]): Message[] {
  return [...SEED_MESSAGES, ...stored]
    .filter((m) => m.channelId === channelId)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

export function lastLine(m: Message | undefined, meId: PersonId): string {
  if (!m) return 'Nothing yet.';
  if (m.body.kind === 'text') return m.body.text;
  if (m.body.kind === 'system') return m.body.text;
  const who = m.from === meId ? undefined : personById(String(m.from))?.firstName;
  const copy = STAGE_COPY[m.body.stage];
  return m.from === meId ? copy.mine : `${who ?? 'They'} ${copy.theirs}`;
}

export function sortRows(rows: InboxRow[]): InboxRow[] {
  return [...rows].sort((a, b) => {
    if (a.needsYou !== b.needsYou) return a.needsYou ? -1 : 1;
    if (a.muted !== b.muted) return a.muted ? 1 : -1;
    return String(b.at).localeCompare(String(a.at));
  });
}

export function useInbox(filter: InboxFilter = 'all') {
  const me = useStore((s) => s.me);
  const myCircles = useStore((s) => s.myCircles);
  const channels = useStore((s) => s.channels);
  const messages = useStore((s) => s.messages);
  const readAt = useStore((s) => s.readAt);
  const muted = useStore((s) => s.muted);
  const { incomingPending, outgoing, accepted } = useRequests();

  return useMemo(() => {
    const circles = allCircles(myCircles);
    const circleIds = me.memberships
      .filter((m) => m.display !== 'paused')
      .map((m) => String(m.circleId));
    const all = channelsFor(me.id, accepted, circleIds, channels);

    const rows: InboxRow[] = all.map((c) => {
      const msgs = messagesFor(c.id, messages);
      const last = msgs[msgs.length - 1];
      const at = last?.at ?? c.createdAt;
      const read = readAt[String(c.id)];
      const unread = Boolean(last && last.from !== me.id && (!read || String(last.at) > String(read)));
      const circle = c.circleId ? circles.find((x) => String(x.id) === String(c.circleId)) : undefined;
      const other = c.kind === 'meet' ? c.memberIds.find((id) => id !== me.id) : undefined;
      const otherPerson = other ? personById(String(other)) : undefined;
      return {
        id: String(c.id),
        kind: c.kind,
        channelId: c.id,
        ...(c.requestId ? { requestId: String(c.requestId) } : {}),
        ...(other ? { personId: other } : {}),
        title: c.kind === 'circle' && circle ? `${circle.shortName} · General` : c.title,
        line: lastLine(last, me.id),
        at,
        unread,
        needsYou: false,
        muted: muted.includes(String(c.id)),
        ...(otherPerson ? { avatar: otherPerson.avatar } : {}),
        ...(circle
          ? { crest: { shortName: circle.shortName, ...(circle.crestUrl ? { crestUrl: circle.crestUrl } : {}) } }
          : {}),
      };
    });

    // Outgoing requests: a row you cannot open yet, with a chip.
    for (const r of outgoing) {
      if (r.status === 'accepted') continue;
      const to = personById(String(r.toPersonId));
      rows.push({
        id: `request:${String(r.id)}`,
        kind: 'request',
        requestId: String(r.id),
        personId: r.toPersonId,
        title: to?.firstName ?? 'Someone',
        line: `You asked: “${r.message}”`,
        at: r.createdAt,
        unread: false,
        needsYou: false,
        muted: false,
        ...(to ? { avatar: to.avatar } : {}),
        status: r.status === 'sent' || r.status === 'viewed' || r.status === 'countered' ? 'waiting' : 'closed',
      });
    }

    const filtered = rows.filter((r) => {
      if (filter === 'all') return true;
      if (filter === 'meets') return r.kind === 'meet' || r.kind === 'request';
      if (filter === 'circles') return r.kind === 'circle';
      return r.kind === 'group';
    });

    return {
      pending: incomingPending,
      rows: sortRows(filtered),
      unreadCount: rows.filter((r) => r.unread && !r.muted).length,
    };
  }, [me, myCircles, channels, messages, readAt, muted, incomingPending, outgoing, accepted, filter]);
}

/** For the tab bar: how many things need you. */
export function useInboxBadge(): number {
  const { pending, unreadCount } = useInbox('all');
  return pending.length + unreadCount;
}
