import { useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Field } from '@design/primitives/Field';
import { Sheet } from '@design/primitives/Sheet';
import type { PersonId } from '@domain/index';
import { useCircleMembers } from '@state/selectors/circles';
import { useStore } from '@state/store';

/**
 * A group inside a circle.
 *
 * Explicit members, picked from those who chose to be seen there — a
 * matching-only member is never listed, so they cannot be pulled into a
 * group they did not know existed. Twelve is the cap: past that it is a
 * channel, and the circle already has one.
 */
export function NewGroupSheet({
  circleId,
  onClose,
  onOpened,
}: {
  circleId: string;
  onClose: () => void;
  onOpened: (channelId: string) => void;
}) {
  const members = useCircleMembers(circleId);
  const openGroup = useStore((s) => s.openGroup);
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 12 ? [...p, id] : p));

  return (
    <Sheet
      open
      title="Start a group"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={picked.length === 0 || title.trim().length < 2}
            onClick={() => {
              const c = openGroup(circleId, title, picked as PersonId[]);
              onOpened(String(c.id));
            }}
          >
            Open
          </Button>
        </>
      }
    >
      <Field label="What is it about?">
        <input
          className="field__input"
          value={title}
          maxLength={40}
          placeholder="Singapore this week"
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <p className="sheet__body">Up to twelve people who show their badge here.</p>
      <ul className="picklist">
        {members.map((m) => {
          const name = typeof m.displayName === 'string' ? m.displayName : 'Member';
          const on = picked.includes(String(m.id));
          return (
            <li key={String(m.id)}>
              <button type="button" className={`pickrow ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(String(m.id))}>
                <Avatar spec={m.avatar} size="sm" />
                <span className="pickrow__name">{name}</span>
                <span className="pickrow__tick" aria-hidden="true">{on ? '✓' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
