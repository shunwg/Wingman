/**
 * A car's invite link.
 *
 * The same shape as the circle invite link in `data/seed/circles.ts`, and for
 * the same reason: the whole URL is the thing you paste into a message, so it
 * has to survive being sent from a static bundle served at any path.
 */
export function rideInviteLink(code: string): string {
  const base =
    typeof window === 'undefined'
      ? 'https://wingman.app'
      : `${window.location.origin}${window.location.pathname}`;
  return `${base}#/car/${code}`;
}
