import { useId } from 'react';
import { ToggleChip } from '@design/primitives/Chip';
import { Field } from '@design/primitives/Field';
import type { MeetKind } from '@domain/index';
import { MEET_KIND_LABEL, MEET_KIND_ORDER } from '@data/copy/meetKinds';
import type { Posture, WorkDraft } from './useProfileDraft';

/**
 * The professional card, and what you are open to.
 *
 * "Working on" and "looking for" are sentences, not tags — the seed cast is
 * looking for "a customs broker who answers the phone", and a taxonomy would
 * flatten exactly the thing that makes a card worth reading. The industry
 * field offers suggestions and accepts anything.
 *
 * Open-to cannot be emptied: an empty list makes a person invisible, and the
 * last chip refuses to be turned off rather than letting that happen quietly.
 */

const INDUSTRIES = [
  'Energy',
  'Software',
  'Infrastructure finance',
  'Strategy consulting',
  'Law',
  'Architecture',
  'Public health',
  'Journalism',
  'Logistics',
  'Education',
  'Media',
  'Product design',
  'Marine science',
  'Energy trading',
  'Music',
];

const POSTURES: { id: Posture; label: string; note: string }[] = [
  { id: 'social', label: 'Mostly social', note: 'Coffee, a meal, a walk.' },
  { id: 'both', label: 'Both', note: 'Whatever the moment allows.' },
  { id: 'work', label: 'Mostly work', note: 'Introductions and shop talk.' },
];

export function WorkFields({
  draft,
  onChange,
}: {
  draft: WorkDraft;
  onChange: (next: WorkDraft) => void;
}) {
  const id = useId();
  const set = <K extends keyof WorkDraft>(k: K, v: WorkDraft[K]) => onChange({ ...draft, [k]: v });

  const toggleKind = (k: MeetKind) => {
    const on = draft.openTo.includes(k);
    if (on && draft.openTo.length === 1) return; // never empty
    set('openTo', on ? draft.openTo.filter((x) => x !== k) : [...draft.openTo, k]);
  };

  return (
    <div className="formstack">
      <div className="formrow">
        <Field label="Title" htmlFor={`${id}-title`}>
          <input
            id={`${id}-title`}
            className="field__input"
            autoComplete="organization-title"
            placeholder="Principal engineer"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field label="Company" hint="Shown once you both agree." htmlFor={`${id}-company`}>
          <input
            id={`${id}-company`}
            className="field__input"
            autoComplete="organization"
            value={draft.company}
            onChange={(e) => set('company', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Industry" htmlFor={`${id}-industry`}>
        <input
          id={`${id}-industry`}
          className="field__input"
          list={`${id}-industries`}
          placeholder="Energy"
          value={draft.industry}
          onChange={(e) => set('industry', e.target.value)}
        />
        <datalist id={`${id}-industries`}>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
      </Field>

      <Field
        label="Working on"
        hint="One line. It sits under your sentence on the card."
        htmlFor={`${id}-working`}
      >
        <input
          id={`${id}-working`}
          className="field__input"
          placeholder="Cross-border capacity models"
          maxLength={80}
          value={draft.workingOn}
          onChange={(e) => set('workingOn', e.target.value)}
        />
      </Field>

      <Field
        label="Looking for"
        hint="A person, not a category. Shown once someone asks to meet."
        htmlFor={`${id}-looking`}
      >
        <input
          id={`${id}-looking`}
          className="field__input"
          placeholder="a customs broker who answers the phone"
          maxLength={100}
          value={draft.lookingFor[0] ?? ''}
          onChange={(e) => set('lookingFor', e.target.value ? [e.target.value] : [])}
        />
      </Field>

      <div className="panel__stack">
        <span className="field__label">Open to</span>
        <div className="panel__row">
          {MEET_KIND_ORDER.map((k) => (
            <ToggleChip key={k} selected={draft.openTo.includes(k)} onClick={() => toggleKind(k)}>
              {MEET_KIND_LABEL[k]}
            </ToggleChip>
          ))}
        </div>
      </div>

      <div className="panel__stack">
        <span className="field__label">Here for</span>
        <div className="segmented" role="group" aria-label="Here for">
          {POSTURES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`segmented__item ${draft.posture === p.id ? 'is-on' : ''}`}
              aria-pressed={draft.posture === p.id}
              onClick={() => set('posture', p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="panel__note">{POSTURES.find((p) => p.id === draft.posture)?.note}</p>
      </div>
    </div>
  );
}
