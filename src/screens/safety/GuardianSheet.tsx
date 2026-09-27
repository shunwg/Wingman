import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Field } from '@design/primitives/Field';
import { OptionRow } from '@design/primitives/OptionRow';
import { Sheet } from '@design/primitives/Sheet';
import type { ISODateTime } from '@domain/index';
import { meetIdForChannel } from '@domain/index';
import { GUARDIAN_PRESET_LIST, describeScope, isLive, type GuardianPresetId } from '@privacy/index';
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
  // One watch at a time: starting this one ends a live one over another meet.
  // It used to do that without a word.
  const replaces = useStore(
    (s) =>
      s.guardian !== null &&
      isLive(s.guardian, s.now) &&
      String(s.guardian.meetId) !== String(meetIdForChannel(channelId) ?? ''),
  );
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
      {/* A mock, like the stand-in verifications — and a watch someone thinks
          is on is worse than none, so it says so before it starts. */}
      <p className="panel__note">
        <strong>Stand-in.</strong> Nothing is sent yet: Wingman has no server to carry the link. The timer and
        &ldquo;I&rsquo;m safe&rdquo; work on this phone; tell {label.trim() || 'them'} yourself for now.
      </p>
      {replaces && <p className="panel__note">This ends the watch you started for another meet.</p>}
      {/* The examples used to include "Priya" — the seeded person you are
          meeting — which read as though this told *her* where you are. It is
          for someone who is not there. */}
      <Field label="Who" hint="Someone who is not at the meet. Mum, a flatmate, a friend at home.">
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
