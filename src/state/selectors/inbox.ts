import { useMemo } from 'react';
import type { AvatarSpec, Channel, ChannelId, ISODateTime, MeetRequest, Message, PersonId, Ride } from '@domain/index';
import { circleChannelId, meetChannelId, rideChannelId, roomMembers } from '@domain/index';
import { SEED_CHANNELS } from '@data/seed/channels';
import { personById } from '@data/seed/people';
import { STAGE_COPY } from '@data/copy/stages';
import { MEET_KIND_LABEL } from '@data/copy/meetKinds';
import { PLAN_COPY } from '@data/copy/plans';
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
  announcements: Record<string, { text: string; at: ISODateTime }> = {},
  derive: { rides?: readonly Ride[]; blocked?: readonly PersonId[] } = {},
): Channel[] {
  const blocked = new Set((derive.blocked ?? []).map(String));
  const meets: Channel[] = accepted.flatMap((r) => {
    const other = r.fromPersonId === meId ? r.toPersonId : r.fromPersonId;
    // Hidden means gone from here too — the room, and the plan in it.
    return blocked.has(String(other)) ? [] : [r];
  }).map((r) => {
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
    const pin = announcements[cid];
    const base: Channel =
      seeded ?? {
        id: circleChannelId(cid),
        kind: 'circle',
        title: 'General',
        memberIds: [],
        circleId: cid as never,
        createdBy: meId,
        createdAt: '2026-01-01T00:00:00Z' as ISODateTime,
      };
    // The organiser's own pin wins over the seeded one.
    return pin ? { ...base, pinned: pin } : base;
  });
  const rides = new Map((derive.rides ?? []).map((r) => [String(rideChannelId(String(r.id))), r]));
  const groups = [...SEED_CHANNELS, ...mine]
    .map((c) => {
      // A car's room holds whoever is in the car *now* — derived from the car,
      // not the list stored when the room opened. See `roomMembers`.
      const ride = rides.get(String(c.id));
      return ride ? { ...c, memberIds: roomMembers(ride) } : c;
    })
    .filter((c) => c.kind === 'group' && c.memberIds.includes(meId));
  return [...meets, ...circles, ...groups];
}

import { messagesFor } from '../log';
export { messagesFor };

export function lastLine(m: Message | undefined, meId: PersonId): string {
  if (!m) return 'Nothing yet.';
  if (m.body.kind === 'text') return m.body.text;
  if (m.body.kind === 'system') return m.body.text;
  if (m.body.kind === 'proposal') return `Suggested ${MEET_KIND_LABEL[m.body.meetKind].toLowerCase()} at ${m.body.placeLabel}`;
  if (m.body.kind === 'agreed') return PLAN_COPY.preview.agreed;
  if (m.body.kind === 'plan_off') return PLAN_COPY.preview.off;
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
  const announcements = useStore((s) => s.announcements);
  const rides = useStore((s) => s.rides);
  const { incomingPending, outgoing, accepted } = useRequests();

  return useMemo(() => {
    const circles = allCircles(myCircles);
    const circleIds = me.memberships
      .filter((m) => m.display !== 'paused')
      .map((m) => String(m.circleId));
    const all = channelsFor(me.id, accepted, circleIds, channels, announcements, { rides, blocked: me.blocked });

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
        // A meet is a one-on-one arrangement; an unread message there — a
        // reply, a stage update like "running late", an unanswered proposal —
        // is something waiting on you specifically. This was hardcoded false
        // for every row, so a delay or a cancellation sorted no differently
        // than an old, already-read circle thread. Circle and group channels
        // stay conservative: general chatter in a room of many people is not
        // "needs you" just because it is unread.
        needsYou: c.kind === 'meet' && unread,
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
  }, [me, myCircles, channels, messages, readAt, muted, announcements, incomingPending, outgoing, accepted, filter, rides]);
}

/** For the tab bar: how many things need you. */
export function useInboxBadge(): number {
  const { pending, unreadCount } = useInbox('all');
  return pending.length + unreadCount;
}
