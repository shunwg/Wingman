import { useState } from 'react';
import { Menu, type MenuItem } from '@design/primitives/Menu';
import type { PersonId } from '@domain/index';
import { useStore } from '@state/store';
import { ReportSheet } from './ReportSheet';

/**
 * The three things you can always do about a person: hide them, report
 * them, and — in a channel — mute it. On every surface that shows someone,
 * as an overflow, so it is always there and never the loudest thing.
 */
export function PersonMenu({
  personId,
  firstName,
  channelId,
  onHidden,
}: {
  personId: PersonId;
  firstName: string;
  /** When shown inside a channel, offers Mute as well. */
  channelId?: string;
  /** Called after "Hide from me", so the screen can leave. */
  onHidden?: () => void;
}) {
  const blockPerson = useStore((s) => s.blockPerson);
  const muted = useStore((s) => s.muted);
  const muteChannel = useStore((s) => s.muteChannel);
  const unmuteChannel = useStore((s) => s.unmuteChannel);
  const [reporting, setReporting] = useState(false);

  const items: MenuItem[] = [];
  if (channelId) {
    const isMuted = muted.includes(channelId);
    items.push({
      label: isMuted ? 'Unmute' : 'Mute',
      onClick: () => (isMuted ? unmuteChannel(channelId) : muteChannel(channelId)),
    });
  }
  items.push({
    label: `Hide ${firstName} from me`,
    onClick: () => {
      blockPerson(personId);
      onHidden?.();
    },
  });
  items.push({ label: 'Report…', tone: 'danger', onClick: () => setReporting(true) });

  return (
    <>
      <Menu label={`More about ${firstName}`} items={items} />
      {reporting && (
        <ReportSheet
          personId={personId}
          firstName={firstName}
          onClose={() => {
            setReporting(false);
          }}
        />
      )}
    </>
  );
}
