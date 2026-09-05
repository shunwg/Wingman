/**
 * Time.
 *
 * One rule, and every layover and "same night" calculation depends on it:
 * **the domain stores UTC instants, exclusively.** Local time exists only at
 * the render edge, converted using the airport's IANA timezone.
 *
 * The reason is that this app compares two people's schedules across arbitrary
 * timezones. "We are both in Singapore on Thursday night" is a claim about two
 * instants and one local calendar, and getting it wrong produces answers that
 * look plausible — off by a few hours, only for some airports — which is far
 * worse than answers that look broken.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** An absolute instant, ISO-8601, always UTC, always with the `Z`. */
export type ISODateTime = Brand<string, 'ISODateTime'>;

/** A local calendar date, `YYYY-MM-DD`. Carries no instant and no zone. */
export type ISODate = Brand<string, 'ISODate'>;

/** An IANA zone name, e.g. `Europe/Oslo`. Derived at build time from coordinates. */
export type IanaZone = Brand<string, 'IanaZone'>;

/** Minutes. Named so signatures stop being a row of anonymous numbers. */
export type Minutes = number;

export interface TimeWindow {
  from: ISODateTime;
  to: ISODateTime;
}

/** An inclusive span of local calendar dates — a stay, not an instant. */
export interface DateRange {
  from: ISODate;
  to: ISODate;
}

const UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODateTime(s: string): s is ISODateTime {
  return UTC_RE.test(s) && !Number.isNaN(Date.parse(s));
}

export function isISODate(s: string): s is ISODate {
  return DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/**
 * Mint an ISODateTime, rejecting anything that is not explicitly UTC.
 *
 * A local-looking string like `2026-08-16T14:05:00` is refused rather than
 * quietly reinterpreted, because silently assuming a zone is exactly how the
 * plausible-but-wrong bugs get in.
 */
export function asUtc(s: string): ISODateTime {
  if (!isISODateTime(s)) {
    throw new Error(
      `Not a UTC instant: ${JSON.stringify(s)}. The domain stores UTC only — convert at the render edge.`,
    );
  }
  return s;
}

export function asISODate(s: string): ISODate {
  if (!isISODate(s)) throw new Error(`Not a calendar date: ${JSON.stringify(s)}`);
  return s;
}

/** Epoch milliseconds. The only sanctioned way to do arithmetic on an instant. */
export const epoch = (t: ISODateTime): number => Date.parse(t);

export const addMinutes = (t: ISODateTime, m: Minutes): ISODateTime =>
  new Date(epoch(t) + m * 60_000).toISOString() as ISODateTime;

export const minutesBetween = (a: ISODateTime, b: ISODateTime): Minutes =>
  Math.round((epoch(b) - epoch(a)) / 60_000);

export const isBefore = (a: ISODateTime, b: ISODateTime): boolean => epoch(a) < epoch(b);
export const isAfter = (a: ISODateTime, b: ISODateTime): boolean => epoch(a) > epoch(b);

export const windowLengthMin = (w: TimeWindow): Minutes => minutesBetween(w.from, w.to);

export const containsInstant = (w: TimeWindow, t: ISODateTime): boolean =>
  epoch(t) >= epoch(w.from) && epoch(t) <= epoch(w.to);

/**
 * The overlap of two windows, or null when they do not touch.
 *
 * This is the primitive underneath every travel overlap: a shared layover is
 * the intersection of two ground windows at one airport, and a shared city
 * night is the intersection of two stays.
 */
export function intersectWindows(a: TimeWindow, b: TimeWindow): TimeWindow | null {
  const from = Math.max(epoch(a.from), epoch(b.from));
  const to = Math.min(epoch(a.to), epoch(b.to));
  if (to <= from) return null;
  return {
    from: new Date(from).toISOString() as ISODateTime,
    to: new Date(to).toISOString() as ISODateTime,
  };
}

/** Inclusive overlap of two local date ranges, or null. */
export function intersectDates(a: DateRange, b: DateRange): DateRange | null {
  const from = a.from > b.from ? a.from : b.from;
  const to = a.to < b.to ? a.to : b.to;
  return from <= to ? { from, to } : null;
}

/** Inclusive day count — a one-day stay is 1, not 0. */
export function dateRangeDays(r: DateRange): number {
  const ms = Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * The local calendar date of an instant, in a given zone.
 *
 * This is the one place local time is allowed to matter inside the domain, and
 * it exists because "the same night" is a local-calendar claim. A flight
 * landing at 23:40 UTC is a different night in Oslo than in São Paulo.
 */
export function localDate(t: ISODateTime, zone: IanaZone): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(epoch(t)));
  return parts as ISODate;
}

/** Local wall-clock `HH:MM` in a zone — for rendering, never for comparison. */
export function localTime(t: ISODateTime, zone: IanaZone): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(epoch(t)));
}

/**
 * The inverse of `localTime`: a wall-clock `HH:MM` on a local calendar date,
 * in a zone, as a UTC instant. This is the single place local time enters the
 * domain from the outside; forms hold strings, the domain holds instants.
 *
 * Method: assume the wall clock is UTC, read what that instant looks like in
 * `zone`, and shift by the difference. A second pass covers DST edges. A time
 * inside a spring-forward gap resolves to just after the jump; a time that
 * happens twice on a fall-back night resolves to the first, which is what a
 * printed ticket means.
 */
export function utcFromLocal(date: ISODate, hhmm: string, zone: IanaZone): ISODateTime {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const want = Date.UTC(y, mo - 1, d, h, m);
  // Two passes: the offset at the naive instant, then the offset at the
  // corrected one. They agree everywhere except across a DST change.
  const g1 = want - (wallClockMs(want, zone) - want);
  const g2 = g1 - (wallClockMs(g1, zone) - want);
  let guess: number;
  if (wallClockMs(g2, zone) === want) {
    guess = g2;
    // Fall-back night: two instants show this wall clock; take the earlier one.
    if (wallClockMs(g2 - 3_600_000, zone) === want) guess = g2 - 3_600_000;
  } else {
    // Spring-forward gap: the wall clock never happens. The later candidate is
    // the one just after the jump.
    guess = Math.max(g1, g2);
  }
  return new Date(guess).toISOString().replace(/\.\d{3}Z$/, 'Z') as ISODateTime;
}

function wallClockMs(ms: number, zone: IanaZone): number {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(ms))) {
    p[part.type] = part.value;
  }
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!);
}
