/**
 * Hashing at the edge.
 *
 * The purity gate compiles without `crypto`, so this lives with the screens
 * that need it: the organiser's setup (hashing a pasted list) and the join
 * screen (hashing the address someone just proved). Neither keeps the
 * address afterwards.
 */
export async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lowercased address + circle salt. The same input always hashes the same. */
export const hashEmail = (address: string, salt: string): Promise<string> =>
  sha256Hex(`${salt}:${address.trim().toLowerCase()}`);

/** A fresh salt per circle, so the same list in two circles hashes differently. */
export function newSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
