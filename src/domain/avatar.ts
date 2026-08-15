/**
 * Everyone gets a photo.
 *
 * Real portraits are not an option here: a prototype has no licensed portrait
 * library, and putting real strangers' faces on fictional profiles is not a
 * thing to do casually. So a portrait is *generated* — deterministically, from
 * the person's id, with no network call — and it has to be good enough that the
 * card reads as photographic at a glance.
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
  variant: AvatarVariant;
  palette: AvatarPalette;
  features: AvatarFeatures;
  /** Fallback glyph for the monogram variant. */
  initial: string;
  /** Film grain opacity, 0–1. Subtle; kills the vector flatness. */
  grain: number;
}
