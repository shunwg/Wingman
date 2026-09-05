import { useId, useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Field } from '@design/primitives/Field';
import { AirportField } from './AirportField';
import { useTripForm } from './useTripForm';

/**
 * Add a trip by hand.
 *
 * The flight number and date come first, large and in mono, because for the
 * common case they are the whole answer — a later stream fills the rest in
 * from a schedule. Everything else is the honest fallback: two airports, two
 * local times, and where you are staying.
 */
export function TripForm({
  onDone,
  submitLabel = 'List this trip',
  secondary,
}: {
  onDone: () => void;
  submitLabel?: string;
  /** An optional escape hatch beside the primary — "I'll add a flight later". */
  secondary?: React.ReactNode;
}) {
  const id = useId();
  const f = useTripForm(onDone);
  const [terminals, setTerminals] = useState(false);
  const d = f.draft;
  const err = (k: string) => (f.errors[k] ? { error: f.errors[k]! } : {});

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
        <AirportField label="From" value={d.from} onChange={(v) => f.set('from', v)} {...err('from')} />
        <AirportField label="To" value={d.to} onChange={(v) => f.set('to', v)} {...err('to')} />
      </div>

      <div className="formrow">
        <Field label="Departs" hint="Local time." htmlFor={`${id}-dep`} {...err('departLocal')}>
          <input
            id={`${id}-dep`}
            className="field__input mono"
            type="time"
            value={d.departLocal}
            onChange={(e) => f.set('departLocal', e.target.value)}
          />
        </Field>
        <Field label="Arrives" hint="Local time there." htmlFor={`${id}-arr`} {...err('arriveLocal')}>
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

      <p className="tripform__legend">Where are you staying?</p>
      <label className="tripform__pass">
        <input
          type="checkbox"
          checked={d.passingThrough}
          onChange={(e) => f.set('passingThrough', e.target.checked)}
        />
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
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
