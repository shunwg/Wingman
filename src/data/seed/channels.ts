import type { Channel, Message, PersonId } from '@domain/index';
import { asMessageId, asPersonId, asUtc, circleChannelId, asChannelId } from '@domain/index';
import { SEED_PEOPLE } from './people';

/**
 * Seeded conversations.
 *
 * A circle's General exists for every circle; the demo person is in INSEAD,
 * so that one has a pinned note and a few messages, plus a small group of
 * INSEAD people in Singapore this week. Grid Week's General is here for
 * anyone who joins it. Timestamps sit before SEED_NOW so the inbox has a
 * history to sort by.
 */
const inCircle = (circleId: string): PersonId[] =>
  SEED_PEOPLE.filter((p) => p.memberships.some((m) => String(m.circleId) === circleId)).map((p) => p.id);

const insead = inCircle('insead');
const gridweek = inCircle('gridweek');
const you = asPersonId('you');

export const SEED_CHANNELS: Channel[] = [
  {
    id: circleChannelId('insead'),
    kind: 'circle',
    title: 'INSEAD · General',
    memberIds: [],
    circleId: 'insead' as never,
    createdBy: insead[0] ?? you,
    createdAt: asUtc('2026-01-04T09:00:00Z'),
    pinned: {
      text: 'Alumni drinks in Singapore Thursday 4 Sept, 19:00, Lau Pa Sat. Say hello if you are landing that week.',
      at: asUtc('2026-08-28T08:00:00Z'),
    },
  },
  {
    id: asChannelId('group:insead-singapore'),
    kind: 'group',
    title: 'Singapore this week',
    memberIds: [you, ...insead.slice(0, 3)],
    circleId: 'insead' as never,
    createdBy: insead[0] ?? you,
    createdAt: asUtc('2026-08-30T10:00:00Z'),
  },
  {
    id: circleChannelId('gridweek'),
    kind: 'circle',
    title: 'Grid Week · General',
    memberIds: [],
    circleId: 'gridweek' as never,
    createdBy: gridweek[0] ?? you,
    createdAt: asUtc('2026-07-20T09:00:00Z'),
    pinned: {
      text: 'Registration opens 08:00 in Hall B. The networking lounge is on level 3 all week.',
      at: asUtc('2026-09-01T07:00:00Z'),
    },
  },
  {
    id: circleChannelId('northwind'),
    kind: 'circle',
    title: 'Northwind Grid · General',
    memberIds: [],
    circleId: 'northwind' as never,
    createdBy: you,
    createdAt: asUtc('2026-02-11T09:00:00Z'),
  },
];

let n = 0;
const msg = (channelId: string, from: PersonId | undefined, at: string, text: string): Message[] =>
  from
    ? [
        {
          id: asMessageId(`seed_m_${++n}`),
          channelId: asChannelId(channelId),
          from,
          at: asUtc(at),
          body: { kind: 'text', text },
        },
      ]
    : [];

export const SEED_MESSAGES: Message[] = [
  ...msg('circle:insead', insead[0], '2026-08-28T08:05:00Z', 'Pinned the Thursday drinks above. Who is around Singapore that week?'),
  ...msg('circle:insead', insead[1], '2026-08-28T09:40:00Z', 'Landing Wednesday night, in for the whole week. Count me in.'),
  ...msg('circle:insead', insead[2], '2026-08-29T06:12:00Z', 'Same flight as half of you by the look of it. Coffee at the gate before?'),
  ...msg('circle:insead', insead[0], '2026-08-29T07:00:00Z', 'Lau Pa Sat gets loud after eight, so seven is the real start.'),
  ...msg('circle:insead', insead[3] ?? insead[1], '2026-09-01T18:30:00Z', 'Anyone doing the Marina Bay walk on Friday morning?'),
  ...msg('circle:insead', insead[1], '2026-09-02T11:15:00Z', 'Friday works. Meet at the Merlion at eight?'),

  ...msg('group:insead-singapore', insead[0], '2026-08-30T10:02:00Z', 'Made this so the Singapore lot are not spamming General.'),
  ...msg('group:insead-singapore', insead[1], '2026-08-30T10:20:00Z', 'Good call. Hotel is near Tanjong Pagar if anyone wants to share a ride from Changi.'),
  ...msg('group:insead-singapore', insead[2], '2026-09-02T14:05:00Z', 'Landing Thursday 17:00. Happy to split a cab into town.'),

  ...msg('circle:gridweek', gridweek[0], '2026-09-01T07:10:00Z', 'Speakers, the green room is behind Hall B. Badges at the desk from 07:30.'),
  ...msg('circle:gridweek', gridweek[1] ?? gridweek[0], '2026-09-01T12:40:00Z', 'Lunch on level 3 today was quick. Recommend the noodle stall.'),
];
