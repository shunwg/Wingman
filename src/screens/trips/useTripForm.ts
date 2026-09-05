import { useMemo, useState } from 'react';
import type { IataCode, ISODate, TripEntry } from '@domain/index';
import { asISODate, asPersonId, asTripId, buildTripFromEntry, validateTripEntry } from '@domain/index';
import { airportIndex } from '@data/airports/index';
import { useStore } from '@state/store';

/**
 * The trip form's state, and the one place it turns into a Trip.
 *
 * The draft is strings all the way down — that is what a form is — and the
 * domain builder is the only thing that turns them into instants. Errors are
 * computed on every change but only *shown* after the first attempt, so the
 * form does not shout at someone who has typed two letters.
 */

export interface TripDraft {
  flightNo: string;
  date: string;
  from: IataCode | '';
  to: IataCode | '';
  departLocal: string;
  arriveLocal: string;
  terminalFrom: string;
  terminalTo: string;
  passingThrough: boolean;
  until: string;
  areaLabel: string;
}

const EMPTY: TripDraft = {
  flightNo: '',
  date: '',
  from: '',
  to: '',
  departLocal: '',
  arriveLocal: '',
  terminalFrom: '',
  terminalTo: '',
  passingThrough: false,
  until: '',
  areaLabel: '',
};

function toEntry(d: TripDraft): TripEntry {
  const seg = {
    from: (d.from || 'ZZZ') as IataCode,
    to: (d.to || 'ZZZ') as IataCode,
    date: d.date as ISODate,
    departLocal: d.departLocal,
    arriveLocal: d.arriveLocal,
    ...(d.flightNo.trim() ? { flightNo: d.flightNo.trim() } : {}),
    ...(d.terminalFrom.trim() ? { terminalFrom: d.terminalFrom.trim() } : {}),
    ...(d.terminalTo.trim() ? { terminalTo: d.terminalTo.trim() } : {}),
  };
  return {
    segments: [seg],
    ...(!d.passingThrough && d.until
      ? { stay: { until: d.until as ISODate, ...(d.areaLabel.trim() ? { areaLabel: d.areaLabel.trim() } : {}) } }
      : {}),
  };
}

/** Two days after the arrival date — the stay most people mean by default. */
function plusDays(date: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function useTripForm(onDone: () => void) {
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const addTrip = useStore((s) => s.addTrip);

  const [draft, setDraft] = useState<TripDraft>(EMPTY);
  const [attempted, setAttempted] = useState(false);

  const set = <K extends keyof TripDraft>(k: K, v: TripDraft[K]) =>
    setDraft((d) => {
      const next = { ...d, [k]: v };
      // The stay's end follows the date until someone edits it.
      if (k === 'date' && (d.until === '' || d.until === plusDays(d.date, 2))) {
        next.until = plusDays(String(v), 2);
      }
      return next;
    });

  const required =
    draft.from !== '' &&
    draft.to !== '' &&
    draft.date !== '' &&
    draft.departLocal !== '' &&
    draft.arriveLocal !== '';

  const errors = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (!required) return out;
    for (const e of validateTripEntry(toEntry(draft), airportIndex, now)) {
      out[e.field] ??= e.message;
    }
    return out;
  }, [draft, now, required]);

  const missing: Record<string, string> = {};
  if (attempted) {
    if (!draft.from) missing.from = 'Where does it leave from?';
    if (!draft.to) missing.to = 'Where does it land?';
    if (!draft.date) missing.date = 'Which day?';
    if (!draft.departLocal) missing.departLocal = 'Local departure time.';
    if (!draft.arriveLocal) missing.arriveLocal = 'Local arrival time.';
  }

  const shown: Record<string, string> = attempted ? { ...errors, ...missing } : {};
  const valid = required && Object.keys(errors).length === 0;

  const submit = () => {
    setAttempted(true);
    if (!valid) return;
    const trip = buildTripFromEntry(toEntry(draft), airportIndex, {
      tripId: asTripId(`t_${crypto.randomUUID().slice(0, 8)}`),
      personId: asPersonId(String(me.id)),
      now,
    });
    addTrip(trip);
    onDone();
  };

  return {
    draft,
    set,
    errors: shown,
    /** True once every required field has something in it. */
    ready: required,
    submit,
    /** For the date input's `min`: the simulated clock's date. */
    minDate: asISODate(String(now).slice(0, 10)),
    tomorrowOf: (d: string) => plusDays(d, 1),
  };
}

export type TripFormApi = ReturnType<typeof useTripForm>;
