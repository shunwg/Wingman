import { useEffect, useMemo, useRef, useState } from 'react';
import type { IataCode, ISODate, Trip, TripEntry } from '@domain/index';
import { asISODate, asPersonId, asTripId, buildTripFromEntry, localDate, localTime, validateTripEntry } from '@domain/index';
import { airportIndex } from '@data/airports/index';
import { resolveFlight } from '@providers/flights/resolve';
import { useStore } from '@state/store';
import { postureToAppetite, type Posture } from '@screens/profile/useProfileDraft';

/**
 * The trip form's state, and the one place it turns into a Trip.
 *
 * The draft is strings all the way down — that is what a form is — and the
 * domain builder is the only thing that turns them into instants. Errors are
 * computed on every change but only *shown* after the first attempt, so the
 * form does not shout at someone who has typed two letters.
 *
 * A known flight number fills the rest in from the schedule; anything the
 * person has typed themselves is left alone.
 */

export interface LegDraft {
  flightNo: string;
  from: IataCode | '';
  to: IataCode | '';
  departLocal: string;
  arriveLocal: string;
  terminalFrom: string;
  terminalTo: string;
}

export interface TripDraft extends LegDraft {
  date: string;
  connection: LegDraft | null;
  passingThrough: boolean;
  until: string;
  areaLabel: string;
  purpose: Posture;
}

const EMPTY_LEG: LegDraft = { flightNo: '', from: '', to: '', departLocal: '', arriveLocal: '', terminalFrom: '', terminalTo: '' };
const EMPTY: TripDraft = { ...EMPTY_LEG, date: '', connection: null, passingThrough: false, until: '', areaLabel: '', purpose: 'both' };

function toEntry(d: TripDraft): TripEntry {
  const leg = (l: LegDraft, date: string) => ({
    from: (l.from || 'ZZZ') as IataCode,
    to: (l.to || 'ZZZ') as IataCode,
    date: date as ISODate,
    departLocal: l.departLocal,
    arriveLocal: l.arriveLocal,
    ...(l.flightNo.trim() ? { flightNo: l.flightNo.trim() } : {}),
    ...(l.terminalFrom.trim() ? { terminalFrom: l.terminalFrom.trim() } : {}),
    ...(l.terminalTo.trim() ? { terminalTo: l.terminalTo.trim() } : {}),
  });
  const segments = [leg(d, d.date)];
  if (d.connection) segments.push(leg({ ...d.connection, from: d.to }, d.date));
  return {
    segments,
    ...(!d.passingThrough && d.until
      ? { stay: { until: d.until as ISODate, ...(d.areaLabel.trim() ? { areaLabel: d.areaLabel.trim() } : {}) } }
      : {}),
  };
}

/** N days after a date — the stay most people mean by default is +2. */
function plusDays(date: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** A stored trip, back into form strings, for editing. */
export function draftFromTrip(trip: Trip): TripDraft {
  const [a, b] = trip.segments;
  if (!a) return EMPTY;
  const leg = (s: typeof a): LegDraft => ({
    flightNo: s.flightNo.includes('–') ? '' : s.flightNo,
    from: s.from,
    to: s.to,
    departLocal: localTime(s.departUtc, airportIndex.zone(s.from)!),
    arriveLocal: localTime(s.arriveUtc, airportIndex.zone(s.to)!),
    terminalFrom: s.terminalFrom ?? '',
    terminalTo: s.terminalTo ?? '',
  });
  const stay = trip.stays[0];
  const posture: Posture = trip.intent?.appetite
    ? trip.intent.appetite.professional - trip.intent.appetite.social > 0.25
      ? 'work'
      : trip.intent.appetite.social - trip.intent.appetite.professional > 0.25
        ? 'social'
        : 'both'
    : 'both';
  return {
    ...leg(a),
    date: localDate(a.departUtc, airportIndex.zone(a.from)!),
    connection: b ? leg(b) : null,
    passingThrough: !stay,
    until: stay ? String(stay.dates.to) : '',
    areaLabel: stay?.areaLabel ?? '',
    purpose: posture,
  };
}

export function useTripForm(onDone: () => void, existing?: Trip) {
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const addTrip = useStore((s) => s.addTrip);

  const [draft, setDraft] = useState<TripDraft>(() => (existing ? draftFromTrip(existing) : EMPTY));
  const [attempted, setAttempted] = useState(false);
  /** Fields the schedule filled and the person has not touched since. */
  const [fromSchedule, setFromSchedule] = useState<Set<keyof LegDraft>>(new Set());
  const touched = useRef<Set<string>>(new Set());

  const set = <K extends keyof TripDraft>(k: K, v: TripDraft[K]) => {
    touched.current.add(k);
    setDraft((d) => {
      const next = { ...d, [k]: v };
      // The stay's end follows the date until someone edits it.
      if (k === 'date' && (d.until === '' || d.until === plusDays(d.date, 2))) {
        next.until = plusDays(String(v), 2);
      }
      return next;
    });
    if (k !== 'flightNo') setFromSchedule((s) => (s.has(k as keyof LegDraft) ? new Set([...s].filter((x) => x !== k)) : s));
  };

  const setConnection = (patch: Partial<LegDraft> | null) =>
    setDraft((d) => ({ ...d, connection: patch === null ? null : { ...EMPTY_LEG, ...(d.connection ?? {}), ...patch } }));

  // Prefill from the schedule once the flight number matches.
  const flightNo = draft.flightNo;
  useEffect(() => {
    if (!/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/i.test(flightNo.trim())) return;
    let cancelled = false;
    void resolveFlight(flightNo).then((r) => {
      if (cancelled || r.status !== 'bundled') return;
      const f = r.flight;
      setDraft((d) => {
        const filled = new Set<keyof LegDraft>();
        const next = { ...d };
        const fill = <K extends keyof LegDraft>(k: K, v: LegDraft[K]) => {
          if (!touched.current.has(k) || d[k] === '') {
            (next as LegDraft)[k] = v;
            filled.add(k);
          }
        };
        fill('from', f.from);
        fill('to', f.to);
        fill('departLocal', f.departLocal);
        fill('arriveLocal', f.arriveLocal);
        if (f.terminalFrom) fill('terminalFrom', f.terminalFrom);
        if (f.terminalTo) fill('terminalTo', f.terminalTo);
        setFromSchedule(filled);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [flightNo]);

  const required =
    draft.from !== '' && draft.to !== '' && draft.date !== '' && draft.departLocal !== '' && draft.arriveLocal !== '' &&
    (!draft.connection || (draft.connection.to !== '' && draft.connection.departLocal !== '' && draft.connection.arriveLocal !== ''));

  const errors = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (!required) return out;
    for (const e of validateTripEntry(toEntry(draft), airportIndex, now)) out[e.field] ??= e.message;
    return out;
  }, [draft, now, required]);

  const missing: Record<string, string> = {};
  if (attempted) {
    if (!draft.from) missing.from = 'Where does it leave from?';
    if (!draft.to) missing.to = 'Where does it land?';
    if (!draft.date) missing.date = 'Which day?';
    if (!draft.departLocal) missing.departLocal = 'Local departure time.';
    if (!draft.arriveLocal) missing.arriveLocal = 'Local arrival time.';
    if (draft.connection) {
      if (!draft.connection.to) missing['segments.1.to'] = 'Where does the connection land?';
      if (!draft.connection.departLocal) missing['segments.1.departLocal'] = 'Local departure time.';
      if (!draft.connection.arriveLocal) missing['segments.1.arriveLocal'] = 'Local arrival time.';
    }
  }

  const shown: Record<string, string> = attempted ? { ...errors, ...missing } : {};
  const valid = required && Object.keys(errors).length === 0;

  const submit = () => {
    setAttempted(true);
    if (!valid) return;
    const trip = buildTripFromEntry(toEntry(draft), airportIndex, {
      tripId: existing?.id ?? asTripId(`t_${crypto.randomUUID().slice(0, 8)}`),
      personId: asPersonId(String(me.id)),
      now: existing?.createdAt ?? now,
    });
    // Purpose narrows the standing appetite for this trip only.
    const withIntent: Trip = { ...trip, intent: { appetite: postureToAppetite(draft.purpose) } };
    if (existing) {
      withIntent.visibility = existing.visibility;
      if (existing.outcome) withIntent.outcome = existing.outcome;
    }
    addTrip(withIntent);
    onDone();
  };

  return {
    draft,
    set,
    setConnection,
    errors: shown,
    ready: required,
    fromSchedule,
    submit,
    editing: Boolean(existing),
    minDate: asISODate(String(now).slice(0, 10)),
  };
}

export type TripFormApi = ReturnType<typeof useTripForm>;
