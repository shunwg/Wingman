/**
 * The one moment that animates.
 *
 * Accepting a meet is rare by construction, so it is the one place the design
 * spends its signature 1400 ms. The inbox marks the room as "arriving" on the
 * way in; the room takes the mark exactly once on mount and never again for
 * that channel in this session. A refresh, a back-and-forth, a second visit:
 * none of them replay it. Memory, not storage, on purpose.
 */
const arriving = new Set<string>();
const played = new Set<string>();

export function markArriving(channelId: string): void {
  if (!played.has(channelId)) arriving.add(channelId);
}

export function takeArriving(channelId: string): boolean {
  if (!arriving.has(channelId)) return false;
  arriving.delete(channelId);
  played.add(channelId);
  return true;
}

/** Test seam. */
export function resetArriving(): void {
  arriving.clear();
  played.clear();
}
