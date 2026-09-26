import type { ChannelId, Message } from '@domain/index';
import { SEED_MESSAGES } from '@data/seed/channels';

/**
 * One room's messages, in the order they were said.
 *
 * Lives outside both the store and the selectors because both need it: the
 * store validates a yes against the room's log before writing it, and the
 * selectors derive the plan from the same log when reading. Two copies of this
 * function would be two opinions about what a room contains.
 *
 * `sort` is stable, so messages written at the same simulated instant keep the
 * order they were written in — which is what makes a yes land after the
 * suggestion it answers.
 */
export function messagesFor(channelId: ChannelId | string, stored: readonly Message[]): Message[] {
  return [...SEED_MESSAGES, ...stored]
    .filter((m) => String(m.channelId) === String(channelId))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
