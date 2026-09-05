import { useMemo } from 'react';
import type { Circle } from '@domain/index';
import { inviteCodeFor, inviteLinkFor } from '@data/seed/circles';
import { inviteWithBadge } from '@domain/index';
import { useCircle } from '@state/selectors/circles';
import { useStore } from '@state/store';

/**
 * What an organiser can see and do about their circle.
 *
 * Counts are bucketed the moment they cross into the UI (rule 3): a sponsor
 * report says "about 100 met through the circle", never 97. "Met through"
 * is a request that carried this circle's id when it was sent and was later
 * accepted.
 */
export function useCircleAdmin(circleId: string) {
  const circle = useCircle(circleId);
  const me = useStore((s) => s.me);
  const requests = useStore((s) => s.requests);
  const announcements = useStore((s) => s.announcements);
  const announce = useStore((s) => s.announce);
  const closeCircle = useStore((s) => s.closeCircle);
  const updateCircle = useStore((s) => s.updateCircle);

  const membership = me.memberships.find((m) => String(m.circleId) === circleId);
  const isOrganiser = membership?.role === 'admin';

  return useMemo(() => {
    if (!circle || !isOrganiser) return { circle: undefined, isOrganiser: false } as const;
    const metThrough = requests.filter((r) => String(r.circleId) === circleId && r.status === 'accepted').length;
    const asked = requests.filter((r) => String(r.circleId) === circleId).length;
    const code = inviteCodeFor(circle);
    const base = inviteLinkFor(circle);
    const badgeLinks = (circle.badges ?? []).map((b) => ({
      badge: b,
      code: inviteWithBadge(code, b.id),
      link: base.replace(code, inviteWithBadge(code, b.id)),
    }));
    return {
      circle: circle as Circle,
      isOrganiser: true as const,
      code,
      link: base,
      badgeLinks,
      metThrough,
      asked,
      pinned: announcements[circleId]?.text ?? '',
      announce: (text: string) => announce(circleId, text),
      close: () => closeCircle(circleId),
      update: (c: Circle) => updateCircle(c),
    };
  }, [circle, isOrganiser, requests, circleId, announcements, announce, closeCircle, updateCircle]);
}
