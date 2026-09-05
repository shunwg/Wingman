/**
 * Invite codes, and the badge a link may carry.
 *
 * `ABC123` is the circle's door key; `ABC123-speaker` is the same key with a
 * role attached, so an organiser can hand speakers a link that makes them
 * findable as speakers without ever editing a member list. The badge id is
 * only honoured if the circle actually defines it — a made-up suffix grants
 * nothing.
 */
export interface ParsedInvite {
  code: string;
  badgeId?: string;
}

const CODE = /^([A-Z0-9]{6})(?:-([a-z0-9_-]{1,24}))?$/i;

export function parseInvite(raw: string): ParsedInvite | null {
  const m = CODE.exec(raw.trim());
  if (!m) return null;
  const code = m[1]!.toUpperCase();
  return m[2] ? { code, badgeId: m[2].toLowerCase() } : { code };
}

export function inviteWithBadge(code: string, badgeId?: string): string {
  return badgeId ? `${code}-${badgeId}` : code;
}
