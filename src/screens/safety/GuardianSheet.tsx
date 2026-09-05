import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Field } from '@design/primitives/Field';
import { OptionRow } from '@design/primitives/OptionRow';
import { Sheet } from '@design/primitives/Sheet';
import type { ISODateTime } from '@domain/index';
import { GUARDIAN_PRESET_LIST, describeScope, type GuardianPresetId } from '@privacy/index';
import { useStore } from '@state/store';

/**
 * Tell someone where you will be.
 *
 * Scoped and temporary, never a standing permission: the person you name
 * gets a link that dies when the meet does, and what it shows is one of
 * three presets, each described in plain sentences from the engine so the
 * sheet cannot promise less than the link delivers.
 */
export function GuardianSheet({
  channelId,
  window,
  onClose,
}: {
  channelId: string;
  window: { from: ISODateTime; to: ISODateTime };
  onClose: () => void;
}) {
  const arm = useStore((s) => s.armGuardianFor);
  const [label, setLabel] = useState('');
  const [preset, setPreset] = useState<GuardianPresetId>('balanced');

  return (
    <Sheet
      open
      title="Tell someone where you are"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={label.trim().length < 1}
            onClick={() => {
              arm(channelId, { label: label.trim(), channel: 'link' }, preset, window);
              onClose();
            }}
          >
            Start watching
          </Button>
        </>
      }
    >
      <p className="sheet__body">
        They get a link that works for this meet and a little after, then dies. No account
        needed on their side.
      </p>
      <Field label="Who" hint="What you call them. Mum, Priya, my flatmate.">
        <input
          className="field__input"
          value={label}
          maxLength={30}
          placeholder="Mum"
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <div className="sheet__options">
        {GUARDIAN_PRESET_LIST.map((p) => (
          <OptionRow
            key={p.id}
            label={p.label}
            note={describeScope(p.build(window.to)).join(' ')}
            selected={preset === p.id}
            onClick={() => setPreset(p.id)}
          />
        ))}
      </div>
    </Sheet>
  );
}
