import { useId, useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Field } from '@design/primitives/Field';
import type { Trip } from '@domain/index';
import type { Posture } from '@screens/profile/useProfileDraft';
import { AirportField } from './AirportField';
import { useTripForm } from './useTripForm';

/**
 * Add a trip.
 *
 * The flight number and date come first, large and in mono, because for the
 * common case they are the whole answer: a known number fills the rest in
 * from the schedule. Everything else is the honest fallback — two airports,
 * two local times, where you are staying — and a connection is one tap.
 */

const PURPOSES: { id: Posture; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'leisure' as Posture, label: 'Leisure' },
  { id: 'both', label: 'Both' },
];

export function TripForm({
  onDone,
  existing,
  submitLabel,
  secondary,
}: {
  onDone: () => void;
  existing?: Trip;
  submitLabel?: string;
  /** An optional escape hatch beside the primary — "Add a flight later". */
  secondary?: React.ReactNode;
}) {
  const id = useId();
  const f = useTripForm(onDone, existing);
  const [terminals, setTerminals] = useState(Boolean(existing?.segments[0]?.terminalFrom || existing?.segments[0]?.terminalTo));
  const d = f.draft;
  const err = (k: string) => (f.errors[k] ? { error: f.errors[k]! } : {});
  const sched = (k: 'from' | 'to' | 'departLocal' | 'arriveLocal') =>
    f.fromSchedule.has(k) ? { hint: 'From the schedule. Change it if yours differs.' } : {};
  const label = submitLabel ?? (f.editing ? 'Save changes' : 'List this trip');

  return (
    <form
      className="formstack tripform"
      onSubmit={(e) => {
        e.preventDefault();
        f.submit();
      }}
      noValidate
    >
      <div className="formrow">
        <Field label="Flight number" hint="Optional. Like SK1465." htmlFor={`${id}-fno`} {...err('flightNo')}>
          <input
            id={`${id}-fno`}
            className="field__input mono"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="SK1465"
            value={d.flightNo}
            onChange={(e) => f.set('flightNo', e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="Date" hint="Local to departure." htmlFor={`${id}-date`} {...err('date')}>
          <input
            id={`${id}-date`}
            className="field__input mono"
            type="date"
            min={f.minDate}
            value={d.date}
            onChange={(e) => f.set('date', e.target.value)}
          />
        </Field>
      </div>

      <div className="formrow">
        <AirportField label="From" value={d.from} onChange={(v) => f.set('from', v)} {...err('from')} {...sched('from')} />
        <AirportField label="To" value={d.to} onChange={(v) => f.set('to', v)} {...err('to')} {...sched('to')} />
      </div>

      <div className="formrow">
        <Field label="Departs" hint={sched('departLocal').hint ?? 'Local time.'} htmlFor={`${id}-dep`} {...err('departLocal')}>
          <input
            id={`${id}-dep`}
            className="field__input mono"
            type="time"
            value={d.departLocal}
            onChange={(e) => f.set('departLocal', e.target.value)}
          />
        </Field>
        <Field label="Arrives" hint={sched('arriveLocal').hint ?? 'Local time there.'} htmlFor={`${id}-arr`} {...err('arriveLocal')}>
          <input
            id={`${id}-arr`}
            className="field__input mono"
            type="time"
            value={d.arriveLocal}
            onChange={(e) => f.set('arriveLocal', e.target.value)}
          />
        </Field>
      </div>

      {terminals ? (
        <div className="formrow">
          <Field label="Terminal out" htmlFor={`${id}-tf`}>
            <input
              id={`${id}-tf`}
              className="field__input mono"
              placeholder="T2"
              maxLength={4}
              value={d.terminalFrom}
              onChange={(e) => f.set('terminalFrom', e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Terminal in" htmlFor={`${id}-tt`}>
            <input
              id={`${id}-tt`}
              className="field__input mono"
              placeholder="T3"
              maxLength={4}
              value={d.terminalTo}
              onChange={(e) => f.set('terminalTo', e.target.value.toUpperCase())}
            />
          </Field>
        </div>
      ) : (
        <Button variant="quiet" size="sm" onClick={() => setTerminals(true)}>
          Add terminals
        </Button>
      )}

      {d.connection ? (
        <fieldset className="tripform__leg">
          <legend className="tripform__legend">Connection, from {d.to || 'the first arrival'}</legend>
          <div className="formrow">
            <Field label="Flight number" hint="Optional." htmlFor={`${id}-c-fno`} {...err('segments.1.flightNo')}>
              <input
                id={`${id}-c-fno`}
                className="field__input mono"
                autoCapitalize="characters"
                value={d.connection.flightNo}
                onChange={(e) => f.setConnection({ flightNo: e.target.value.toUpperCase() })}
              />
            </Field>
            <AirportField label="To" value={d.connection.to} onChange={(v) => f.setConnection({ to: v })} {...err('segments.1.to')} />
          </div>
          <div className="formrow">
            <Field label="Departs" hint="Local time." htmlFor={`${id}-c-dep`} {...err('segments.1.departLocal')}>
              <input
                id={`${id}-c-dep`}
                className="field__input mono"
                type="time"
                value={d.connection.departLocal}
                onChange={(e) => f.setConnection({ departLocal: e.target.value })}
              />
            </Field>
            <Field label="Arrives" hint="Local time there." htmlFor={`${id}-c-arr`} {...err('segments.1.arriveLocal')}>
              <input
                id={`${id}-c-arr`}
                className="field__input mono"
                type="time"
                value={d.connection.arriveLocal}
                onChange={(e) => f.setConnection({ arriveLocal: e.target.value })}
              />
            </Field>
          </div>
          <Button variant="quiet" size="sm" onClick={() => f.setConnection(null)}>
            Remove the connection
          </Button>
        </fieldset>
      ) : (
        <Button variant="quiet" size="sm" onClick={() => f.setConnection({})}>
          Add a connection
        </Button>
      )}

      <div className="panel__stack">
        <span className="field__label">Travelling for</span>
        <div className="segmented" role="group" aria-label="Travelling for">
          {PURPOSES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`segmented__item ${d.purpose === p.id ? 'is-on' : ''}`}
              aria-pressed={d.purpose === p.id}
              onClick={() => f.set('purpose', p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="panel__note">Narrows what you are open to on this trip only. Your standing settings stay as they are.</p>
      </div>

      <p className="tripform__legend">Where are you staying?</p>
      <label className="tripform__pass">
        <input type="checkbox" checked={d.passingThrough} onChange={(e) => f.set('passingThrough', e.target.checked)} />
        <span>Just passing through</span>
      </label>
      {!d.passingThrough && (
        <div className="formrow">
          <Field label="Until" htmlFor={`${id}-until`} {...err('stay.until')}>
            <input
              id={`${id}-until`}
              className="field__input mono"
              type="date"
              min={d.date || f.minDate}
              value={d.until}
              onChange={(e) => f.set('until', e.target.value)}
            />
          </Field>
          <Field label="Area" hint="A neighbourhood, never an address." htmlFor={`${id}-area`}>
            <input
              id={`${id}-area`}
              className="field__input"
              placeholder="Indre By"
              maxLength={40}
              value={d.areaLabel}
              onChange={(e) => f.set('areaLabel', e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="formactions">
        {secondary}
        <Button type="submit" disabled={!f.ready}>
          {label}
        </Button>
      </div>
    </form>
  );
}
