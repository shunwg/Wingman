import { Button } from '@design/primitives/Button';
import { OptionRow } from '@design/primitives/OptionRow';
import type { Gender, PrivacyPresetId } from '@domain/index';
import { PRESET_LIST } from '@privacy/index';
import { useStore } from '@state/store';

/**
 * Who can see you — decided before the board exists.
 *
 * Not skippable. The presets are the ones from You, in an order that puts the
 * one most likely to matter first: women-only leads for a woman, and is off
 * until she says so. Verified-only is on by default for everyone; the next
 * step explains the exchange. No counts appear here — an audience figure on
 * a screen someone has not chosen yet is a nudge, not information.
 */

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'nonbinary', label: 'Non-binary' },
  { id: 'undisclosed', label: 'Rather not say' },
];

export function PrivacyStep({ onNext }: { onNext: () => void }) {
  const gender = useStore((s) => s.me.gender);
  const presets = useStore((s) => s.me.privacy.presets);
  const setMe = useStore((s) => s.setMe);
  const setPrivacy = useStore((s) => s.setPrivacy);

  const toggle = (id: PrivacyPresetId) =>
    setPrivacy({ presets: presets.includes(id) ? presets.filter((p) => p !== id) : [...presets, id] });

  const ordered = [...PRESET_LIST].sort((a, b) => {
    if (gender === 'woman') {
      if (a.id === 'women_only') return -1;
      if (b.id === 'women_only') return 1;
    }
    return 0;
  });

  const note = (id: PrivacyPresetId) => {
    if (id === 'id_verified_only') return 'Needs the ID stamp from the next step.';
    if (id === 'verified_only') return 'On by default. Verify, and the people who chose this can see you back.';
    return undefined;
  };

  return (
    <>
      <p className="signup__lede">
        Each of these works in both directions at once. You can change it any time under You.
      </p>

      <div className="panel__stack">
        <span className="field__label">You are</span>
        <div className="panel__row">
          {GENDERS.map((g) => (
            <OptionRow
              key={g.id}
              label={g.label}
              selected={gender === g.id}
              onClick={() => setMe({ gender: g.id })}
            />
          ))}
        </div>
        <p className="panel__note">
          Used only to make the women-only setting work. Never shown on your card, never a
          matching signal. BankID does not tell us your gender, and we do not ask it to.
        </p>
      </div>

      <div className="panel__stack">
        <span className="field__label">Who can see you</span>
        {ordered.map((p) => (
          <OptionRow
            key={p.id}
            label={p.label}
            note={note(p.id) ?? p.explainer}
            selected={presets.includes(p.id)}
            onClick={() => toggle(p.id)}
          />
        ))}
      </div>

      <div className="signup__actions">
        <Button size="lg" onClick={onNext}>
          Next
        </Button>
      </div>
    </>
  );
}
