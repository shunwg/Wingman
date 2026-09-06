import { useState } from 'react';
import { Chip } from '@design/primitives/Chip';
import { OptionRow } from '@design/primitives/OptionRow';
import type { Gender } from '@domain/index';
import { compilePolicy, isSelfSilencing, meetPreference } from '@privacy/index';
import { useStore } from '@state/store';

/**
 * Who you want to meet.
 *
 * Four options, always — never three and a hidden bucket. The fourth,
 * "people who have not said", is where every new account starts, so leaving
 * it out silently hides most of the network from the chooser and the chooser
 * from it. The last ticked option refuses to untick: an empty list is
 * invisibility, and that should not be reachable by tapping.
 *
 * Symmetric by construction, and said so: choosing a narrower set also
 * means everyone outside it cannot see you. This is the policy. The
 * women-only chip on Discover is a lens on what you see and nothing more,
 * and the two are named as different things wherever they appear.
 */

const OPTIONS: { id: Gender; label: string }[] = [
  { id: 'woman', label: 'Women' },
  { id: 'man', label: 'Men' },
  { id: 'nonbinary', label: 'Non-binary people' },
  { id: 'undisclosed', label: 'People who have not said' },
];
const ALL: Gender[] = OPTIONS.map((o) => o.id);

export function MeetPreference({ compact }: { compact?: boolean }) {
  const privacy = useStore((s) => s.me.privacy);
  const memberships = useStore((s) => s.me.memberships);
  const setMeetPreference = useStore((s) => s.setMeetPreference);

  const stored = meetPreference(privacy);
  const chosen: Gender[] = stored === 'any' ? ALL : stored;
  const narrowed = stored !== 'any' && chosen.length < ALL.length;

  const [refused, setRefused] = useState(false);
  const toggle = (g: Gender) => {
    const on = chosen.includes(g);
    if (on && chosen.length === 1) {
      setRefused(true);
      return; // never empty
    }
    setRefused(false);
    const next = on ? chosen.filter((x) => x !== g) : [...chosen, g];
    setMeetPreference(next.length === ALL.length ? 'any' : next);
  };

  const compiled = compilePolicy(privacy, memberships.map((m) => String(m.circleId)));
  const silenced = isSelfSilencing(compiled.audience, compiled.seeking);
  const quietOut = narrowed && !chosen.includes('undisclosed');

  return (
    <div className="panel__stack">
      <div className="panel__stack">
        {OPTIONS.map((o) => (
          <OptionRow
            key={o.id}
            label={o.label}
            selected={chosen.includes(o.id)}
            onClick={() => toggle(o.id)}
          />
        ))}
      </div>
      {refused && (
        <p className="panel__note" role="status">
          One has to stay on. Untick a different one, or leave it at everyone.
        </p>
      )}
      <p className="panel__note">
        {narrowed
          ? 'Works both ways. The people you do not see cannot see you either.'
          : 'Everyone. Narrow it and the people outside your choice cannot see you either.'}
      </p>
      {quietOut && (
        <p className="panel__note">
          Most people have not said what they are. Leaving that unticked hides them from you, and you
          from them.
        </p>
      )}
      {silenced && (
        <Chip tone="warn">Nobody fits this together with your other settings. Widen one of them.</Chip>
      )}
      {!compact && (
        <p className="panel__note">
          This is not the women-only chip on Discover. That one only changes what you see, and only for
          this session.
        </p>
      )}
    </div>
  );
}
