import { useId } from 'react';
import { Field } from '@design/primitives/Field';
import { PhotoPicker } from './PhotoPicker';
import { HEADLINE_MAX, firstNameOf, type ProfileDraft } from './useProfileDraft';

/**
 * Who you are, in the fewest fields that still make a card.
 *
 * The headline is the hero of the whole product — it is the largest thing on
 * a card — so it gets the most room and the most honest prompt. First name is
 * derived from the display name until someone edits it, because asking for
 * both up front is a form nobody wants to fill in at a gate.
 */
export function ProfileFields({
  draft,
  errors,
  avatarSeed,
  onChange,
}: {
  draft: ProfileDraft;
  errors: Partial<Record<keyof ProfileDraft, string>>;
  avatarSeed: string;
  onChange: (next: ProfileDraft) => void;
}) {
  const id = useId();
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) =>
    onChange({ ...draft, [k]: v });

  const firstNameAuto = draft.firstName === '' || draft.firstName === firstNameOf(draft.displayName);

  return (
    <div className="formstack">
      <PhotoPicker
        seed={avatarSeed}
        {...(draft.photoUrl ? { photoUrl: draft.photoUrl } : {})}
        onChange={(photoUrl) => {
          const next = { ...draft };
          if (photoUrl) next.photoUrl = photoUrl;
          else delete next.photoUrl;
          onChange(next);
        }}
      />

      <Field label="Your name" htmlFor={`${id}-name`} {...(errors.displayName ? { error: errors.displayName } : {})}>
        <input
          id={`${id}-name`}
          className="field__input"
          autoComplete="name"
          value={draft.displayName}
          onChange={(e) => {
            const displayName = e.target.value;
            onChange({
              ...draft,
              displayName,
              firstName: firstNameAuto ? firstNameOf(displayName) : draft.firstName,
            });
          }}
        />
      </Field>

      <div className="formrow">
        <Field
          label="Goes by"
          hint="What people call you at the gate."
          htmlFor={`${id}-first`}
        >
          <input
            id={`${id}-first`}
            className="field__input"
            autoComplete="given-name"
            value={draft.firstName}
            onChange={(e) => set('firstName', e.target.value)}
          />
        </Field>
        <Field label="Pronouns" hint="Optional." htmlFor={`${id}-pronouns`}>
          <input
            id={`${id}-pronouns`}
            className="field__input"
            placeholder="she/her"
            value={draft.pronouns}
            onChange={(e) => set('pronouns', e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="One sentence"
        hint={`What would you say at the gate? ${draft.headline.length}/${HEADLINE_MAX}`}
        htmlFor={`${id}-headline`}
        {...(errors.headline ? { error: errors.headline } : {})}
      >
        <textarea
          id={`${id}-headline`}
          className="field__input field__input--headline"
          rows={2}
          maxLength={HEADLINE_MAX + 20}
          placeholder="Grid engineer. Will talk about interconnectors for far too long."
          value={draft.headline}
          onChange={(e) => set('headline', e.target.value.replace(/\n/g, ' '))}
        />
      </Field>

      <Field label="A little more" hint="Optional. Shown once you both agree to meet." htmlFor={`${id}-bio`}>
        <textarea
          id={`${id}-bio`}
          className="field__input"
          rows={3}
          maxLength={280}
          value={draft.bio}
          onChange={(e) => set('bio', e.target.value)}
        />
      </Field>
    </div>
  );
}
