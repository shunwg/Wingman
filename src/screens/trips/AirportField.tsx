import { useEffect, useId, useRef, useState } from 'react';
import { Field } from '@design/primitives/Field';
import type { Airport, IataCode } from '@domain/index';
import { airportIndex, hasMediumAirports, loadMediumAirports } from '@data/airports/index';

/**
 * Pick an airport.
 *
 * A combobox over the bundled index: type three letters or a city and pick.
 * The large-airport set answers instantly; when it has fewer than three hits
 * the medium set is pulled in and the search runs again, so Bodø and Bergamo
 * arrive a beat later rather than never. Screen-level rather than a primitive
 * because design/ may not import @data.
 */
export function AirportField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: IataCode | '';
  onChange: (iata: IataCode | '') => void;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState(() => describe(value));
  const [hits, setHits] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searchingMore, setSearchingMore] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Keep the text in step when the value is set from outside (a prefill).
  useEffect(() => {
    if (value) setQuery(describe(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const first = airportIndex.search(q, 6);
    setHits(first);
    if (first.length < 3 && !hasMediumAirports()) {
      setSearchingMore(true);
      void loadMediumAirports().then(() => {
        if (cancelled) return;
        setHits(airportIndex.search(q, 6));
        setSearchingMore(false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [query, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (a: Airport) => {
    onChange(a.iata);
    setQuery(describe(a.iata));
    setOpen(false);
  };

  const listId = `${id}-list`;

  return (
    <Field label={label} htmlFor={id} {...(error ? { error } : {})} {...(hint ? { hint } : {})}>
      <div className="combo" ref={wrap}>
        <input
          id={id}
          className="field__input mono"
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && hits[active] ? `${listId}-${hits[active].iata}` : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="OSL or Oslo"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            if (value) onChange('');
          }}
          onKeyDown={(e) => {
            if (!open || hits.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const a = hits[active];
              if (a) choose(a);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {open && (hits.length > 0 || searchingMore) && (
          <ul className="combo__list" role="listbox" id={listId}>
            {hits.map((a, i) => (
              <li
                key={a.iata}
                id={`${listId}-${a.iata}`}
                role="option"
                aria-selected={i === active}
                className="combo__opt"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(a)}
              >
                <span className="combo__iata mono">{a.iata}</span>
                <span className="combo__city">{a.city}</span>
                <span className="combo__name">{a.name}</span>
              </li>
            ))}
            {searchingMore && <li className="combo__more">Searching smaller airports…</li>}
          </ul>
        )}
      </div>
    </Field>
  );
}

function describe(iata: IataCode | ''): string {
  if (!iata) return '';
  const a = airportIndex.get(iata);
  return a ? `${a.iata} · ${a.city}` : iata;
}
