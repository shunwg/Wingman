import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { ToggleChip } from '@design/primitives/Chip';
import { Sheet } from '@design/primitives/Sheet';
import type { MeetKind } from '@domain/intent';
import { MEET_KIND_LABEL } from '@data/copy/meetKinds';

/**
 * Saying hello.
 *
 * The request is deliberately constrained: pick a kind the overlap physically
 * supports, pick a templated opener or write one sentence, send. Nobody has to
 * compose a first message to a stranger from a jet bridge, and nobody can
 * overshare by accident in one. Lives in a sheet so the profile itself stays
 * a profile.
 */
const OPENERS = [
  'Same flight. Fancy a coffee before boarding?',
  'Happy to share the ride into town if you are heading that way.',
  'In town the same nights. Dinner, if you are free?',
  'Would be good to talk shop for twenty minutes.',
];

export function HelloSheet({
  firstName,
  kinds,
  onClose,
  onSend,
}: {
  firstName: string;
  kinds: MeetKind[];
  onClose: () => void;
  onSend: (kind: MeetKind, message: string) => void;
}) {
  const [kind, setKind] = useState<MeetKind>(kinds[0]!);
  const [opener, setOpener] = useState(OPENERS[0]!);
  const [custom, setCustom] = useState('');
  const message = custom.trim() ? custom.trim().slice(0, 240) : opener;

  return (
    <Sheet
      open
      title={`Say hello to ${firstName}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={() => onSend(kind, message)}>Say hello</Button>
        </>
      }
    >
      <p className="sheet__body">Only what your overlap actually allows time for.</p>
      <div className="ask__kinds">
        {kinds.map((k) => (
          <ToggleChip key={k} selected={kind === k} onClick={() => setKind(k)}>
            {MEET_KIND_LABEL[k]}
          </ToggleChip>
        ))}
      </div>
      <h4 className="ask__sub">Say something</h4>
      <div className="ask__openers">
        {OPENERS.map((o) => (
          <ToggleChip key={o} selected={opener === o && !custom.trim()} onClick={() => { setOpener(o); setCustom(''); }}>
            {o}
          </ToggleChip>
        ))}
      </div>
      <textarea
        className="field__input ask__custom"
        rows={2}
        maxLength={240}
        placeholder="Or in your own words. Why them, in a sentence."
        aria-label="In your own words"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
      />
      <p className="ask__fineprint">
        They can say no, and you will not be told why. Your name and links stay hidden until you
        both agree.
      </p>
    </Sheet>
  );
}
