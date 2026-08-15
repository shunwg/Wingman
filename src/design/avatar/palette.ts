import type { AvatarPalette } from '@domain/avatar';
import type { Rng } from '@lib/rng';
import { floatBetween, intBetween } from '@lib/rng';

/**
 * Portrait palettes.
 *
 * Curated rather than random. Randomly generated colour produces muddy,
 * clashing results most of the time — the way to make generated imagery look
 * designed is to randomise *within* a set of combinations that were chosen by
 * hand.
 *
 * Each entry is a duotone backdrop plus a garment and rim light that sit well
 * against it. Skin tones are drawn separately and independently, so appearance
 * is never correlated with any other attribute of the person.
 */

interface Duotone {
  from: string;
  to: string;
  /** Garment colours that work against this backdrop. */
  garments: string[];
  /** Rim light — the detail that stops these reading as flat illustration. */
  rim: string;
  /** Text that clears 4.5:1 against the darker end of the gradient. */
  onBg: string;
}

const DUOTONES: Duotone[] = [
  { from: '#F4C9A8', to: '#D96C4F', garments: ['#2E1F1A', '#F7EDE3', '#6B3B2E'], rim: '#FFE2C4', onBg: '#2A140C' },
  { from: '#C8DCE8', to: '#42708F', garments: ['#17262F', '#EAF2F6', '#2F4A5C'], rim: '#DFF0FA', onBg: '#0C1A22' },
  { from: '#E8D9F0', to: '#7B5A9E', garments: ['#241832', '#F3EDF8', '#4C3866'], rim: '#F5E9FF', onBg: '#1A0F26' },
  { from: '#DCE8CF', to: '#5C8256', garments: ['#1B2618', '#F0F5EA', '#38512F'], rim: '#EAF6E0', onBg: '#101A0E' },
  { from: '#F6DDBE', to: '#C39238', garments: ['#2B2213', '#FAF3E6', '#5E4A1F'], rim: '#FFF0D6', onBg: '#241B09' },
  { from: '#E9CEC9', to: '#A8555F', garments: ['#2A171A', '#F8EDEC', '#5E2C34'], rim: '#FFE0DC', onBg: '#210E11' },
  { from: '#CFE3E0', to: '#3F7E77', garments: ['#122320', '#E9F5F3', '#27544F'], rim: '#DDF4F0', onBg: '#0A1917' },
  { from: '#DCDCE8', to: '#565A87', garments: ['#181A2A', '#EDEDF5', '#33375A'], rim: '#E7E7F8', onBg: '#0F1020' },
  { from: '#F2D7C4', to: '#8C6A50', garments: ['#241B14', '#F7EFE7', '#4F3B2C'], rim: '#FFE9D6', onBg: '#1C130C' },
  { from: '#D8E4F0', to: '#3B5E8C', garments: ['#101A26', '#EBF1F8', '#254163'], rim: '#E3EFFC', onBg: '#08131F' },
  { from: '#EFDCCB', to: '#B4623C', garments: ['#2A1811', '#F9EFE7', '#66341F'], rim: '#FFE5D2', onBg: '#200F08' },
  { from: '#D5E8DE', to: '#4A8168', garments: ['#132119', '#EAF6F0', '#2C5340'], rim: '#DFF6EA', onBg: '#0B1811' },
];

/**
 * Skin tones, drawn independently of everything else.
 *
 * Wide and evenly weighted, and not correlated with any other field — a
 * generated population should not encode a demographic assumption. Nothing in
 * matching or ranking ever reads these values.
 */
const SKIN = [
  '#F5D5BC', '#EFC5A4', '#E3AC85', '#D2916A', '#BC7A55',
  '#A0603F', '#83492F', '#6A3A25', '#52301F', '#3D2418',
];

/**
 * Hair colours, spread deliberately.
 *
 * An earlier version drew mostly from the dark end and produced a page of
 * near-identical black helmets — the variation was there in the data and
 * invisible on screen. Weighting toward the middle of the range is what makes a
 * grid of portraits look like a grid of different people.
 */
const HAIR = [
  '#2C1D16', '#4A2E1E', '#5C3324', '#6B4423', '#7A4B2A',
  '#8C6239', '#A0724A', '#B4874B', '#C99C63', '#D6B588',
  '#1B1310', '#3A3A3A', '#6E6660', '#9A938C', '#C4BDB6',
];

export function buildPalette(rng: Rng): AvatarPalette {
  const duo = DUOTONES[intBetween(rng, 0, DUOTONES.length - 1)]!;
  const garment = duo.garments[intBetween(rng, 0, duo.garments.length - 1)]!;

  return {
    bgFrom: duo.from,
    bgTo: duo.to,
    // Kept off the cardinal angles; a slightly tilted gradient reads as light
    // falling from somewhere rather than as a CSS default.
    bgAngle: Math.round(floatBetween(rng, 105, 165)),
    skin: SKIN[intBetween(rng, 0, SKIN.length - 1)]!,
    hair: HAIR[intBetween(rng, 0, HAIR.length - 1)]!,
    garment,
    rim: duo.rim,
    // Derived, not hand-picked. An eyeballed value per palette drifts out of
    // compliance the moment a gradient is tweaked, and the failure is silent.
    onBg: pickOnBackground(duo.from, duo.to),
  };
}

/** Linear blend of two hex colours. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace('#', ''), 16);
  const pb = parseInt(b.replace('#', ''), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * t);
  };
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(ch(16))}${hex(ch(8))}${hex(ch(0))}`.toUpperCase();
}

/**
 * Ink or paper, whichever reads better.
 *
 * Judged against the gradient's midpoint, because that is where a centred
 * monogram actually sits — testing against both end stops would be stricter
 * than reality and would reject palettes that look fine.
 */
export function pickOnBackground(from: string, to: string): string {
  const mid = mixHex(from, to, 0.5);
  const candidates = ['#FFFFFF', '#141110'];
  let best = candidates[0]!;
  let bestRatio = 0;
  for (const c of candidates) {
    const r = contrastRatio(c, mid);
    if (r > bestRatio) {
      bestRatio = r;
      best = c;
    }
  }
  return best;
}

export const paletteCount = DUOTONES.length;

/* ── Contrast, for the generator's own guard rail ─────────────────────────── */

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = srgbToLinear((n >> 16) & 255);
  const g = srgbToLinear((n >> 8) & 255);
  const b = srgbToLinear(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
