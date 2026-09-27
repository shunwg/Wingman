import type { GuardianSession, ISODateTime } from '@domain/index';
import { meetIdForChannel } from '@domain/index';
import { isLive } from '@privacy/index';

/**
 * Whether ending these meets for you also ends your watch.
 *
 * A watch over a meet that has just ended for you ends with it — giving up
 * the seat, a called-off car or plan, a hide — because those take away the
 * room its "I'm safe" lived in. But never once the alarm has been raised: an
 * escalated watch ends only when you say you are safe, whatever else you tap.
 *
 * Shared by the store, which ends it, and the sheets, which say so first.
 */
export function watchEndsWith(g: GuardianSession | null, channelIds: readonly string[], now: ISODateTime): boolean {
  if (!g || !isLive(g, now) || g.status === 'escalated') return false;
  const meets = channelIds.map((c) => String(meetIdForChannel(c) ?? ''));
  return meets.includes(String(g.meetId));
}
