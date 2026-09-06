import { useId, useMemo, useState } from 'react';
import { Chip } from '@design/primitives/Chip';
import { Field } from '@design/primitives/Field';
import { OptionRow } from '@design/primitives/OptionRow';
import { TagPicker, type TagPickerGroup } from '@design/patterns/TagPicker';
import { TAGS, TAG_BY_ID, normaliseTag, type TagGroup, type TagId } from '@domain/index';
import { CAPS, type WorkDraft } from './useProfileDraft';

/**
 * What you are into, what you want from a meeting, and what you can give.
 *
 * Three pickers over one vocabulary. Free text survives underneath: anything
 * the vocabulary recognises becomes the tag and says so, so people learn the
 * words instead of fighting them; anything it does not stays as a plain
 * topic and still counts as an exact match. The liberal switch relaxes the
 * two-sided fit — it never lowers a score, only stops one from being applied.
 */

const GROUP_LABEL: Record<TagGroup, string> = {
  industry: 'Industry',
  craft: 'What you do',
  topic: 'Things to talk about',
  activity: 'Things to do',
  culture: 'Food, music, books',
  life: 'Life',
};
const GROUP_ORDER: TagGroup[] = ['industry', 'craft', 'topic', 'activity', 'culture', 'life'];

const groups: TagPickerGroup[] = GROUP_ORDER.map((g) => ({
  id: g,
  label: GROUP_LABEL[g],
  tags: TAGS.filter((t) => t.group === g).map((t) => ({ id: t.id, label: t.label })),
}));

export function InterestFields({
  draft,
  onChange,
}: {
  draft: WorkDraft;
  onChange: (next: WorkDraft) => void;
}) {
  const id = useId();
  const [free, setFree] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const set = <K extends keyof WorkDraft>(k: K, v: WorkDraft[K]) => onChange({ ...draft, [k]: v });

  const addFree = () => {
    const text = free.trim();
    if (!text) return;
    const tag = normaliseTag(text);
    if (tag) {
      if (!draft.interests.includes(tag) && draft.interests.length < CAPS.interests) {
        set('interests', [...draft.interests, tag]);
      }
      setSaid(`Added as ${TAG_BY_ID.get(tag)?.label ?? tag}.`);
    } else {
      const lower = text.toLowerCase();
      if (!draft.topics.map((t) => t.toLowerCase()).includes(lower)) set('topics', [...draft.topics, text]);
      setSaid(null);
    }
    setFree('');
  };

  const asIds = (xs: string[]) => xs as TagId[];
  const openNote = useMemo(
    () =>
      draft.openToAnyone
        ? 'What you are looking for and can give still show; they just stop narrowing who you see.'
        : 'Off, the two lists above shape who ranks first. On, you are neutral on both.',
    [draft.openToAnyone],
  );

  return (
    <div className="formstack">
      <TagPicker
        label="Into"
        hint="Up to twelve. The things you would actually talk about."
        groups={groups}
        value={draft.interests}
        onChange={(v) => set('interests', asIds(v))}
        max={CAPS.interests}
      />
      <TagPicker
        label="Looking for"
        hint="Up to six. What you want out of a meeting."
        groups={groups}
        value={draft.seeking}
        onChange={(v) => set('seeking', asIds(v))}
        max={CAPS.seeking}
      />
      <TagPicker
        label="Can offer"
        hint="Up to six. What you can give. Adjacent beats identical."
        groups={groups}
        value={draft.offering}
        onChange={(v) => set('offering', asIds(v))}
        max={CAPS.offering}
      />

      <Field label="Something missing?" hint={said ?? 'A word the lists do not have. It still counts when it matches exactly.'} htmlFor={`${id}-free`}>
        <div className="panel__row">
          <input
            id={`${id}-free`}
            className="field__input"
            placeholder="birdwatching"
            maxLength={30}
            value={free}
            onChange={(e) => setFree(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addFree();
              }
            }}
          />
          <button type="button" className="btn btn--secondary btn--sm" onClick={addFree}>
            Add
          </button>
        </div>
      </Field>
      {draft.topics.length > 0 && (
        <div className="panel__row" aria-label="Free-text topics">
          {draft.topics.map((t) => (
            <button
              key={t}
              type="button"
              className="chip chip--toggle is-selected"
              aria-label={`Remove ${t}`}
              onClick={() => set('topics', draft.topics.filter((x) => x !== t))}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="panel__stack">
        <OptionRow
          label="Open to anyone"
          note={openNote}
          selected={draft.openToAnyone}
          onClick={() => set('openToAnyone', !draft.openToAnyone)}
        />
        {draft.openToAnyone && <Chip tone="trust">Neutral on fit, both ways</Chip>}
      </div>
    </div>
  );
}
