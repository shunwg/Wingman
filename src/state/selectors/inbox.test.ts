import { describe, expect, it } from 'vitest';
import type { ISODateTime, Message } from '@domain/index';
import { asMessageId, asPersonId, circleChannelId, meetChannelId } from '@domain/index';
import { demoState, seededInbound } from '../account/reducers';
import { channelsFor, lastLine, messagesFor, sortRows, type InboxRow } from './inbox';

const me = asPersonId('you');
const T = (s: string) => s as ISODateTime;

describe('channelsFor', () => {
  it('derives a meet channel per accepted request, a General per circle, and my groups', () => {
    const accepted = [{ ...seededInbound(), status: 'accepted' as const }];
    const channels = channelsFor(me, accepted, ['insead'], []);
    const kinds = channels.map((c) => c.kind);
    expect(kinds).toContain('meet');
    expect(kinds).toContain('circle');
    expect(kinds).toContain('group'); // the seeded INSEAD Singapore group includes 'you'
    const meet = channels.find((c) => c.kind === 'meet')!;
    expect(String(meet.id)).toBe(String(meetChannelId('req_seed_priya')));
    expect(meet.memberIds).toContain(me);
    expect(meet.title).toBe('Priya');
  });

  it('synthesises a General for a circle with no seeded channel', () => {
    const channels = channelsFor(me, [], ['brand-new'], []).filter((c) => c.kind === 'circle');
    expect(channels).toHaveLength(1);
    expect(String(channels[0]!.id)).toBe(String(circleChannelId('brand-new')));
    expect(channels[0]!.title).toBe('General');
  });
});

describe('messagesFor / lastLine', () => {
  it('merges seed and stored messages in time order', () => {
    const stored: Message = {
      id: asMessageId('m_x'),
      channelId: circleChannelId('insead'),
      from: me,
      at: T('2026-09-02T16:30:00Z'),
      body: { kind: 'text', text: 'Landing tonight.' },
    };
    const msgs = messagesFor(circleChannelId('insead'), [stored]);
    expect(msgs.length).toBeGreaterThan(1);
    expect(msgs[msgs.length - 1]).toBe(stored);
    expect(lastLine(stored, me)).toBe('Landing tonight.');
  });

  it('words a stage update for whoever moved', () => {
    const mine: Message = {
      id: asMessageId('m_s'),
      channelId: meetChannelId('r'),
      from: me,
      at: T('2026-09-02T16:30:00Z'),
      body: { kind: 'stage', stage: 'at_gate' },
    };
    expect(lastLine(mine, me)).toBe("You're at the gate");
    expect(lastLine({ ...mine, from: asPersonId('priya') }, me)).toBe('Priya is at the gate');
    expect(lastLine(undefined, me)).toBe('Nothing yet.');
  });
});

describe('sortRows', () => {
  const row = (id: string, at: string, extra: Partial<InboxRow> = {}): InboxRow => ({
    id,
    kind: 'circle',
    title: id,
    line: '',
    at: T(at),
    unread: false,
    needsYou: false,
    muted: false,
    ...extra,
  });

  it('puts what needs you first, muted last, then newest first', () => {
    const rows = sortRows([
      row('old', '2026-09-01T00:00:00Z'),
      row('muted-new', '2026-09-03T00:00:00Z', { muted: true }),
      row('needs', '2026-08-01T00:00:00Z', { needsYou: true }),
      row('new', '2026-09-02T00:00:00Z'),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['needs', 'new', 'old', 'muted-new']);
  });
});

describe('demo state', () => {
  it('starts with no channels of its own and no reports', () => {
    const s = demoState('d');
    expect(s.channels).toEqual([]);
    expect(s.reports).toEqual([]);
    expect(s.muted).toEqual([]);
  });
});
