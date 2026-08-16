/**
 * Everyone gets a photo. There are two ways to get one.
 *
 * The seeded cast carries real photographs, because a board of illustrations
 * does not read like a product people would join. Everyone else — which is to
 * say everyone, once this is live in an airport anywhere on Earth — gets a
 * portrait *generated* deterministically from their id, with no network call,
 * good enough that the card reads as photographic at a glance.
 *
 * Both paths stay live on purpose. The generator is not a placeholder waiting
 * to be deleted; it is what the app does for the 99.99% of people who have not
 * uploaded anything yet, and deleting it would leave them with a blank square.
 *
 * `AvatarSpec` is the resolved description; `design/avatar/generate.ts` turns a
 * seed into one and `design/primitives/Avatar.tsx` renders it. The split means
 * the generator can be tested in plain Node (same seed → identical output, and
 * no seed produces an unreadable face-on-background pair) without a renderer.
 */

export type AvatarVariant = 'portrait' | 'monogram';

export interface AvatarPalette {
  /** Two-stop backdrop. The duotone is what makes it read as a photograph. */
  bgFrom: string;
  bgTo: string;
  /** Backdrop gradient angle in degrees. */
  bgAngle: number;
  skin: string;
  hair: string;
  garment: string;
  /** Rim light — the detail that stops these looking like flat illustrations. */
  rim: string;
  /** Text colour guaranteed to clear 4.5:1 against the backdrop. */
  onBg: string;
}

export interface AvatarFeatures {
  face: number;
  hair: number;
  garment: number;
  background: number;
  /** Horizontal framing, -1..1. Off-centre crops look photographed. */
  offsetX: number;
  /** Vertical framing, -1..1. */
  offsetY: number;
  /** Subject scale, ~0.9–1.15. */
  scale: number;
}

export interface AvatarSpec {
  /** Stable across sessions and devices — the person's id. */
  seed: string;
  /**
   * A real photograph, when there is one. Absent means the generated portrait
   * below is what gets rendered — never a blank, never a broken image.
   *
   * This is a plain resolved URL rather than an asset import, so `domain/`
   * keeps compiling under the no-DOM tsconfig and the pure tests never touch a
   * bundler. Whoever builds the spec resolves the asset.
   */
  photoUrl?: string;
  variant: AvatarVariant;
  palette: AvatarPalette;
  features: AvatarFeatures;
  /** Fallback glyph for the monogram variant. */
  initial: string;
  /** Film grain opacity, 0–1. Subtle; kills the vector flatness. */
  grain: number;
}
