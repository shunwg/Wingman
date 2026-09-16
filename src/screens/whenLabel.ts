import type { IanaZone, ISODateTime } from '@domain/index';
import { epoch, localTime } from '@domain/time';

/**
 * "Tonight 21:00", "Tomorrow 17:00", "Fri 08:40", "18 Sep".
 *
 * Two clocks meet here, deliberately. The day word is yours — days ahead on
 * the calendar your phone is showing, because days are the unit you plan in —
 * and the time is the place's, because that is the wall clock above the gate
 * when you get there. Reading both from one zone breaks the other half:
 * Singapore is already past midnight when Oslo is at 18:30, so Changi's own
 * calendar calls a landing sixteen hours out "today", and nobody standing in
 * Oslo on Wednesday evening means that.
 *
 * What it costs: a red-eye can read "Today 02:00" while the aircraft is still
 * on the stand. Rare, and still true.
 *
 * Shared rather than private to one screen because a shared car needs exactly
 * this and shipped without it: the board can hold cars drawn from trips in
 * September and October at once, and every card showed a bare "17:30 – 18:30".
 * An undated car is the one thing that sends somebody back to the group chat
 * to ask "which day?", which is the whole thing the feature exists to stop.
 */
export function whenLabel(at: ISODateTime, zone: IanaZone | undefined, now: ISODateTime): string {
  const clock = zone ? localTime(at, zone) : undefined;
  const ahead = daysAhead(now, at);
  if (ahead <= 0) {
    if (!clock) return 'Today';
    return `${Number(clock.slice(0, 2)) >= 18 ? 'Tonight' : 'Today'} ${clock}`;
  }
  if (ahead === 1) return clock ? `Tomorrow ${clock}` : 'Tomorrow';
  // Inside the week a weekday is how people say it. Past that it stops being
  // useful — "Tue" three weeks out tells you nothing — and the clock goes with
  // it, because the hour of a flight a month away is not what you are reading.
  if (ahead < 7) return [datePart(at, zone, { weekday: 'short' }), clock].filter(Boolean).join(' ');
  return datePart(at, zone, { day: 'numeric', month: 'short' });
}

/**
 * The day, with a window rather than an instant — "Tonight 17:30 – 18:30".
 *
 * A car has a pickup window, not a departure time, and the window is the point:
 * nobody knows their own pickup minute after a long flight, and two people who
 * could easily share a car should not look like they cannot.
 */
export function windowLabel(
  from: ISODateTime,
  to: ISODateTime,
  zone: IanaZone | undefined,
  now: ISODateTime,
): string {
  const day = whenLabel(from, zone, now);
  if (!zone) return day;
  // `whenLabel` already ends in the opening time, so only the closing one is
  // appended — "Tonight 17:30 – 18:30" rather than "Tonight 17:30 17:30–18:30".
  return `${day} – ${localTime(to, zone)}`;
}

/** Whole days from today to `t`, on the viewer's own calendar — the render edge. */
export function daysAhead(now: ISODateTime, t: ISODateTime): number {
  const midnight = (ms: number) => {
    const d = new Date(ms);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.round((midnight(epoch(t)) - midnight(epoch(now))) / 86_400_000);
}

/** A piece of a local date — its weekday, or its day and month. */
function datePart(at: ISODateTime, zone: IanaZone | undefined, parts: Intl.DateTimeFormatOptions): string {
  return new Date(epoch(at)).toLocaleDateString('en-GB', {
    ...parts,
    ...(zone ? { timeZone: String(zone) } : {}),
  });
}
