import { useMemo } from 'react';
import type { MeetRequest } from '@domain/index';
import { minutesBetween } from '@domain/time';
import { expireIfDue } from '../machines/meetRequest';
import { useStore } from '../store';

/**
 * Requests, as they stand right now.
 *
 * Expiry is applied on read, never persisted: a request that lapsed while the
 * app was closed reads as expired the moment it is looked at, and nothing
 * stale is stored to disagree with the clock. Rule 2 in CLAUDE.md.
 */
export interface RequestsView {
  /** Sent to me, still open. */
  incomingPending: MeetRequest[];
  /** Sent by me, any status. */
  outgoing: MeetRequest[];
  /** Agreed, either direction. */
  accepted: MeetRequest[];
  all: MeetRequest[];
}

export function expiresIn(request: MeetRequest, now: string): string | null {
  const mins = minutesBetween(now as never, request.expiresAt);
  if (mins <= 0) return null;
  if (mins < 60) return `Expires in ${mins}m`;
  const h = Math.round(mins / 60);
  return `Expires in ${h}h`;
}

export function useRequests(): RequestsView {
  const requests = useStore((s) => s.requests);
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);

  return useMemo(() => {
    const all = requests.map((r) => expireIfDue(r, now));
    return {
      all,
      incomingPending: all.filter(
        (r) => r.toPersonId === me.id && (r.status === 'sent' || r.status === 'viewed'),
      ),
      outgoing: all.filter((r) => r.fromPersonId === me.id),
      accepted: all.filter((r) => r.status === 'accepted'),
    };
  }, [requests, me.id, now]);
}
