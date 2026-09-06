import { useId } from 'react';
import { ToggleChip } from '@design/primitives/Chip';
import { Field } from '@design/primitives/Field';
import { TAGS, type MeetKind } from '@domain/index';
import { MEET_KIND_LABEL, MEET_KIND_ORDER } from '@data/copy/meetKinds';
import { InterestFields } from './InterestFields';
import { LOOKING_FOR_MAX, type Posture, type WorkDraft } from './useProfileDraft';

/**
 * The professional card, what you are open to, and what you are into.
 *
 * "Working on" and "looking for" stay sentences — the seed cast is looking
 * for "a customs broker who answers the phone", and a taxonomy would flatten
 * exactly the thing that makes a card worth reading. The machine-readable
 * half lives in `InterestFields` below; the two are halves of one intention,
 * not duplicates. The industry list is the vocabulary's, so the suggestions
 * and the matcher cannot drift apart.
 *
 * Open-to cannot be emptied: an empty list makes a person invisible, and the
 * last chip refuses to be turned off rather than letting that happen quietly.
 */

const INDUSTRIES = TAGS.filter((t) => t.group === 'industry').map((t) => t.label);

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

  // Always at least one row to type into; never more than the cap.
  const looking = draft.lookingFor.length === 0 ? [''] : draft.lookingFor;
  const setLooking = (i: number, v: string) => {
    const next = [...looking];
    next[i] = v;
    set('lookingFor', next);
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

      <div className="panel__stack">
        {looking.map((line, i) => (
          <Field
            key={i}
            label={i === 0 ? 'Looking for' : `Looking for, line ${i + 1}`}
            hint={i === looking.length - 1 ? 'A person, not a category. Shown once someone asks to meet.' : undefined}
            htmlFor={`${id}-looking-${i}`}
          >
            <div className="panel__row">
              <input
                id={`${id}-looking-${i}`}
                className="field__input"
                placeholder={i === 0 ? 'a customs broker who answers the phone' : ''}
                maxLength={100}
                value={line}
                onChange={(e) => setLooking(i, e.target.value)}
              />
              {looking.length > 1 && (
                <button
                  type="button"
                  className="btn btn--quiet btn--sm"
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => set('lookingFor', looking.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              )}
            </div>
          </Field>
        ))}
        {looking.length < LOOKING_FOR_MAX && looking[looking.length - 1]?.trim() && (
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            onClick={() => set('lookingFor', [...looking, ''])}
          >
            Add another
          </button>
        )}
      </div>

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

      <InterestFields draft={draft} onChange={onChange} />
    </div>
  );
}
