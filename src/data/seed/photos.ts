/**
 * Photographs for the seeded cast.
 *
 * Sixteen portraits, one per seeded person, imported so Vite fingerprints and
 * serves them rather than us hand-rolling paths that break in a subdirectory
 * deploy. The map is keyed by person id, and `photoFor` returns `undefined`
 * rather than throwing for an unknown one — a person with no photograph is the
 * normal case, not an error, and they fall through to the generated portrait.
 *
 * These are generated likenesses of people who do not exist. That is the only
 * defensible choice for a seed set: no real face appears on a fictional
 * profile. In production these are replaced by uploads, which brings image
 * moderation into scope — see the deployment memo.
 */

import amelie from '@assets/people/amelie.jpg';
import ayla from '@assets/people/ayla.jpg';
import daniel from '@assets/people/daniel.jpg';
import elin from '@assets/people/elin.jpg';
import hugo from '@assets/people/hugo.jpg';
import ingrid from '@assets/people/ingrid.jpg';
import jonas from '@assets/people/jonas.jpg';
import lucas from '@assets/people/lucas.jpg';
import marek from '@assets/people/marek.jpg';
import mira from '@assets/people/mira.jpg';
import nina from '@assets/people/nina.jpg';
import omar from '@assets/people/omar.jpg';
import priya from '@assets/people/priya.jpg';
import sofia from '@assets/people/sofia.jpg';
import theo from '@assets/people/theo.jpg';
import tobias from '@assets/people/tobias.jpg';

const PHOTOS: Record<string, string> = {
  amelie,
  ayla,
  daniel,
  elin,
  hugo,
  ingrid,
  jonas,
  lucas,
  marek,
  mira,
  nina,
  omar,
  priya,
  sofia,
  theo,
  tobias,
};

export function photoFor(id: string): string | undefined {
  return PHOTOS[id];
}

/** Every id that has a photograph. Used by the seed test to catch a typo'd id. */
export const PHOTO_IDS: readonly string[] = Object.keys(PHOTOS);
