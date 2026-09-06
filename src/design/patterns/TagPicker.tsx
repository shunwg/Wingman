import { useId, useMemo, useState } from 'react';
import { Button } from '../primitives/Button';
import { Chip, ToggleChip } from '../primitives/Chip';
import { Field } from '../primitives/Field';
import { Sheet } from '../primitives/Sheet';

/**
 * Pick from a vocabulary, on a phone.
 *
 * Vocabulary-blind on purpose: it takes labelled groups of `{id, label}` and
 * knows nothing about interests, so it stays inside the design folder's
 * import rules. Ninety toggle chips at 44px is a wall, so the resting state
 * is the chosen few plus one button, and choosing happens in a sheet with a
 * search field pinned first — two taps to a known word, and the grouped list
 * is the fallback for browsing.
 *
 * The cap is a ranking decision, not a layout one: an uncapped list makes
 * any overlap-shaped signal trivially maximal for whoever ticks everything.
 */
export interface TagPickerGroup {
  id: string;
  label: string;
  tags: { id: string; label: string }[];
}

export interface TagPickerProps {
  label: string;
  hint?: string;
  groups: TagPickerGroup[];
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  /** Refuse to remove the last one. */
  neverEmpty?: boolean;
  /** What the "add" button says when nothing is chosen yet. */
  addLabel?: string;
}

export function TagPicker({
  label,
  hint,
  groups,
  value,
  onChange,
  max,
  neverEmpty,
  addLabel = 'Add',
}: TagPickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) for (const t of g.tags) m.set(t.id, t.label);
    return m;
  }, [groups]);

  const toggle = (tagId: string) => {
    const on = value.includes(tagId);
    if (on) {
      if (neverEmpty && value.length === 1) return;
      onChange(value.filter((x) => x !== tagId));
    } else if (value.length < max) {
      onChange([...value, tagId]);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, tags: q ? g.tags.filter((t) => t.label.toLowerCase().includes(q)) : g.tags }))
    .filter((g) => g.tags.length > 0);
  const full = value.length >= max;

  return (
    <div className="tagpicker">
      <span className="field__label">{label}</span>
      <div className="tagpicker__row">
        {value.map((v) => (
          <ToggleChip key={v} selected onClick={() => toggle(v)} aria-label={`Remove ${labelOf.get(v) ?? v}`}>
            {labelOf.get(v) ?? v}
          </ToggleChip>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          {value.length === 0 ? addLabel : 'Change'}
        </Button>
      </div>
      {hint && <span className="field__hint">{hint}</span>}

      <Sheet open={open} title={label} onClose={() => setOpen(false)} actions={<Button onClick={() => setOpen(false)}>Done</Button>}>
        <Field label="Search" htmlFor={`${id}-q`}>
          <input
            id={`${id}-q`}
            type="search"
            className="field__input"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <p className="tagpicker__count" role="status">
          {value.length} of {max}
          {full ? ' — remove one to add another.' : ''}
        </p>
        <div className="tagpicker__groups">
          {shown.length === 0 && (
            <p className="tagpicker__empty">Nothing here matches. Free text goes in the box below the picker.</p>
          )}
          {shown.map((g) => (
            <section key={g.id} className="tagpicker__group" aria-label={g.label}>
              <h3 className="tagpicker__grouptitle">{g.label}</h3>
              <div className="tagpicker__row">
                {g.tags.map((t) => {
                  const on = value.includes(t.id);
                  return (
                    <ToggleChip
                      key={t.id}
                      selected={on}
                      disabled={!on && full}
                      aria-disabled={!on && full}
                      onClick={() => toggle(t.id)}
                    >
                      {t.label}
                    </ToggleChip>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Sheet>
      {value.length === 0 && !hint && <Chip tone="neutral">Nothing yet</Chip>}
    </div>
  );
}
