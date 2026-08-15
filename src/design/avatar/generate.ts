import type { AvatarFeatures, AvatarSpec, AvatarVariant } from '@domain/avatar';
import { floatBetween, intBetween, rngFrom } from '@lib/rng';
import { buildPalette, contrastRatio } from './palette';
import { BACKGROUND_COUNT, backgroundMark, composeFigure, shadeId } from './features/compose';
import { FACE_COUNT } from './features/face';
import { HAIR_COUNT } from './features/hair';
import { GARMENT_COUNT } from './features/garment';

export { FACE_COUNT, HAIR_COUNT, GARMENT_COUNT, BACKGROUND_COUNT };

/**
 * Everyone gets a photo.
 *
 * A prototype has no licensed portrait library, and putting real strangers'
 * faces on fictional profiles is not something to do casually. So a portrait is
 * generated — deterministically from the person's id, with no network call.
 *
 * The bar is that a card has to read as photographic at a glance. Four things
 * do most of that work, and they are why this is not just a coloured circle
 * with an initial:
 *
 *  · a duotone gradient backdrop, which is what photographic portraits of this
 *    kind actually look like;
 *  · an off-centre crop, because a subject dead-centre reads as an icon;
 *  · a rim light down one edge of the figure, which implies a light source;
 *  · a little grain, which kills the flatness that gives vector art away.
 *
 * Same seed in, byte-identical SVG out — so avatars are stable across devices
 * and sessions, and the generator is testable in plain Node.
 */

/** Minimum contrast between the figure and the backdrop behind it. */
const MIN_FIGURE_CONTRAST = 1.6;

export function generateAvatar(seed: string, variant: AvatarVariant = 'portrait'): AvatarSpec {
  const rng = rngFrom('avatar', seed);
  let palette = buildPalette(rng);

  // Guard rail: a figure that disappears into its own backdrop is a real
  // failure mode for procedural portraits, and it looks like a broken image
  // rather than a design choice. Redraw until the silhouette reads.
  let attempts = 0;
  while (contrastRatio(palette.garment, palette.bgTo) < MIN_FIGURE_CONTRAST && attempts < 8) {
    palette = buildPalette(rngFrom('avatar', seed, `retry${attempts}`));
    attempts++;
  }

  const features: AvatarFeatures = {
    face: intBetween(rng, 0, FACE_COUNT - 1),
    hair: intBetween(rng, 0, HAIR_COUNT - 1),
    garment: intBetween(rng, 0, GARMENT_COUNT - 1),
    background: intBetween(rng, 0, BACKGROUND_COUNT - 1),
    // Kept small. A subject dead-centre reads as an icon; nudged slightly off
    // reads as a crop of something larger.
    offsetX: Number(floatBetween(rng, -0.22, 0.22).toFixed(3)),
    offsetY: Number(floatBetween(rng, -0.1, 0.12).toFixed(3)),
    scale: Number(floatBetween(rng, 0.94, 1.12).toFixed(3)),
  };

  return {
    seed,
    variant,
    palette,
    features,
    initial: (seed.trim()[0] ?? '?').toUpperCase(),
    grain: Number(floatBetween(rng, 0.03, 0.07).toFixed(3)),
  };
}

/** Deterministic id fragment, so gradient ids never collide on one page. */
const uid = (seed: string, kind: string) => `${kind}-${seed.replace(/[^a-zA-Z0-9]/g, '')}`;

const round = (n: number) => Math.round(n * 100) / 100;

/* ── Render ───────────────────────────────────────────────────────────────── */

export interface RenderOptions {
  /** Square viewport size in px. The SVG scales; this sets the viewBox only. */
  size?: number;
  /** Accessible label. Portraits are decorative when a name sits beside them. */
  title?: string;
}

/**
 * Render a spec to an SVG string.
 *
 * Returns a string rather than JSX so the generator stays in the pure layer and
 * can be tested under plain Node — the React component is a thin wrapper.
 */
export function renderAvatarSVG(spec: AvatarSpec, opts: RenderOptions = {}): string {
  const { palette: p, features: f } = spec;
  const gradId = uid(spec.seed, 'g');
  const rimId = uid(spec.seed, 'r');
  const clipId = uid(spec.seed, 'c');
  const grainId = uid(spec.seed, 'n');

  if (spec.variant === 'monogram') {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img"${
      opts.title ? ` aria-label="${escapeAttr(opts.title)}"` : ' aria-hidden="true"'
    }>
  <defs><linearGradient id="${gradId}" gradientTransform="rotate(${p.bgAngle} 0.5 0.5)">
    <stop offset="0%" stop-color="${p.bgFrom}"/><stop offset="100%" stop-color="${p.bgTo}"/>
  </linearGradient></defs>
  <rect width="100" height="100" fill="url(#${gradId})"/>
  <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
        font-family="Fraunces, Georgia, serif" font-size="42" font-weight="600"
        fill="${p.onBg}">${escapeText(spec.initial)}</text>
</svg>`;
  }

  const tx = round(f.offsetX * 14);
  const ty = round(f.offsetY * 12);

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img"${
    opts.title ? ` aria-label="${escapeAttr(opts.title)}"` : ' aria-hidden="true"'
  }>
  <defs>
    <linearGradient id="${gradId}" gradientTransform="rotate(${p.bgAngle} 0.5 0.5)">
      <stop offset="0%" stop-color="${p.bgFrom}"/>
      <stop offset="100%" stop-color="${p.bgTo}"/>
    </linearGradient>
    <linearGradient id="${rimId}" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0%" stop-color="${p.rim}" stop-opacity="0.5"/>
      <stop offset="42%" stop-color="${p.rim}" stop-opacity="0"/>
    </linearGradient>
    <!-- Form shadow across the face. The light comes from the upper left, and
         one soft gradient is the difference between a flat cut-out and a head. -->
    <linearGradient id="${shadeId(spec.seed)}" x1="0.15" y1="0" x2="1" y2="0.5">
      <stop offset="35%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#3a1f10" stop-opacity="0.42"/>
    </linearGradient>
    <clipPath id="${clipId}"><rect width="100" height="100"/></clipPath>
    <filter id="${grainId}">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>

  <g clip-path="url(#${clipId})">
    <rect width="100" height="100" fill="url(#${gradId})"/>
    ${backgroundMark(f.background, p.rim)}
    <g transform="translate(${tx} ${ty}) scale(${f.scale}) translate(${round((1 - f.scale) * 50)} ${round((1 - f.scale) * 50)})">
      ${composeFigure(spec)}
      <!-- Rim light down one edge: the cheapest way to imply a light source. -->
      <rect width="100" height="100" fill="url(#${rimId})" style="mix-blend-mode:screen"/>
    </g>
    <!-- Grain, last. Removes the vector flatness that gives generated art away. -->
    <rect width="100" height="100" filter="url(#${grainId})" opacity="${spec.grain}"
          style="mix-blend-mode:overlay"/>
  </g>
</svg>`;
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Convenience: seed straight to SVG. */
export const avatarFor = (seed: string, opts?: RenderOptions): string =>
  renderAvatarSVG(generateAvatar(seed), opts);

/** Data URI, for use as a CSS background or an <img> src. */
export const avatarDataUri = (spec: AvatarSpec): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(renderAvatarSVG(spec))}`;
