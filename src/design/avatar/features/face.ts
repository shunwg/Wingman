import type { AvatarPalette } from '@domain/avatar';

/**
 * The head, and the small amount of face that makes it a person.
 *
 * The judgement here: a completely blank head reads as a mannequin, which is
 * unsettling on an app about meeting people — the eye keeps looking for a face
 * and not finding one. A fully rendered face lands in the uncanny valley and
 * looks worse the bigger it gets.
 *
 * So: a real jaw, ears, brows and eyes, and nothing else. Enough that it reads
 * as somebody, stylised enough that it never pretends to be a photograph of a
 * particular person. Closed, relaxed eyes rather than staring ones — a stare
 * from a generated stranger is exactly the wrong feeling.
 */

export const FACE_COUNT = 6;

export interface HeadGeometry {
  cx: number;
  cy: number;
  /** Half-width at the cheekbones. */
  rx: number;
  /** Half-height, crown to chin. */
  ry: number;
  chinY: number;
  browY: number;
  eyeY: number;
}

const r = (n: number) => Math.round(n * 100) / 100;

/**
 * Head proportions vary by index — this is what carries recognition.
 *
 * The head fills a good share of the frame on purpose. A small head floating in
 * a large field reads as an icon; a portrait crops close, the way a photograph
 * of a person actually does.
 */
export function headGeometry(face: number): HeadGeometry {
  const i = face % FACE_COUNT;
  const rx = 19.4 + (i % 3) * 1.3;
  const ry = rx * (1.14 + (i % 2) * 0.06);
  const cy = 41 - (i % 3) * 0.8;
  return {
    cx: 50,
    cy,
    rx: r(rx),
    ry: r(ry),
    chinY: r(cy + ry),
    browY: r(cy - ry * 0.18),
    eyeY: r(cy + ry * 0.04),
  };
}

/**
 * The head silhouette.
 *
 * A path rather than an ellipse: a real head narrows to the jaw and rounds at
 * the crown, and that asymmetry is most of what stops it looking like an egg.
 */
export function headPath(g: HeadGeometry, jawWidth: number): string {
  const { cx, cy, rx, ry } = g;
  const jaw = rx * jawWidth;
  const chin = cy + ry;
  const temple = cy - ry * 0.35;

  return `M ${r(cx - rx)} ${r(temple)}
          C ${r(cx - rx)} ${r(cy - ry * 1.02)} ${r(cx - rx * 0.62)} ${r(cy - ry * 1.24)} ${cx} ${r(cy - ry * 1.24)}
          C ${r(cx + rx * 0.62)} ${r(cy - ry * 1.24)} ${r(cx + rx)} ${r(cy - ry * 1.02)} ${r(cx + rx)} ${r(temple)}
          C ${r(cx + rx)} ${r(cy + ry * 0.34)} ${r(cx + jaw)} ${r(chin - ry * 0.2)} ${cx} ${r(chin)}
          C ${r(cx - jaw)} ${r(chin - ry * 0.2)} ${r(cx - rx)} ${r(cy + ry * 0.34)} ${r(cx - rx)} ${r(temple)} Z`;
}

export function ears(g: HeadGeometry, p: AvatarPalette): string {
  const y = r(g.cy + g.ry * 0.06);
  const rxE = r(g.rx * 0.17);
  const ryE = r(g.ry * 0.17);
  return `<ellipse cx="${r(g.cx - g.rx * 0.97)}" cy="${y}" rx="${rxE}" ry="${ryE}" fill="${p.skin}"/>
          <ellipse cx="${r(g.cx + g.rx * 0.97)}" cy="${y}" rx="${rxE}" ry="${ryE}" fill="${p.skin}"/>`;
}

export function neck(g: HeadGeometry, p: AvatarPalette): string {
  const w = r(g.rx * 0.44);
  const top = r(g.chinY - g.ry * 0.28);
  return `
    <rect x="${r(g.cx - w)}" y="${top}" width="${r(w * 2)}" height="${r(g.ry * 0.85)}" fill="${p.skin}"/>
    <!-- Shadow under the jaw. One shape, and it is most of the depth. -->
    <ellipse cx="${g.cx}" cy="${r(top + 1.2)}" rx="${r(w * 1.28)}" ry="${r(g.ry * 0.2)}"
             fill="#000" opacity="0.13"/>`;
}

/**
 * Brows and eyes.
 *
 * Deliberately minimal: two brow strokes and two closed lids. Everything about
 * a face that is hard to get right — irises, catchlights, a mouth — is left
 * out, because each one added makes a generated portrait look more wrong rather
 * than more real.
 */
export function features(g: HeadGeometry, face: number, p: AvatarPalette): string {
  const i = face % FACE_COUNT;
  const eyeDx = r(g.rx * 0.42);
  const eyeW = r(g.rx * 0.21);
  const browY = r(g.browY - g.ry * 0.04);
  const browW = r(g.rx * 0.26);
  const browLift = [0, 0.6, -0.4, 0.3, 0, 0.5][i] ?? 0;
  const lidColour = shade(p.skin, -0.45);

  return `
    <g stroke="${lidColour}" stroke-linecap="round" fill="none">
      <path d="M ${r(g.cx - eyeDx - browW)} ${r(browY + browLift)}
               Q ${r(g.cx - eyeDx)} ${r(browY - 1.1 + browLift)} ${r(g.cx - eyeDx + browW)} ${r(browY + browLift)}"
            stroke-width="${r(0.9 + (i % 2) * 0.35)}" opacity="0.5"/>
      <path d="M ${r(g.cx + eyeDx - browW)} ${r(browY + browLift)}
               Q ${r(g.cx + eyeDx)} ${r(browY - 1.1 + browLift)} ${r(g.cx + eyeDx + browW)} ${r(browY + browLift)}"
            stroke-width="${r(0.9 + (i % 2) * 0.35)}" opacity="0.5"/>
      <path d="M ${r(g.cx - eyeDx - eyeW)} ${g.eyeY} Q ${r(g.cx - eyeDx)} ${r(g.eyeY + 1.5)} ${r(g.cx - eyeDx + eyeW)} ${g.eyeY}"
            stroke-width="1.15" opacity="0.82"/>
      <path d="M ${r(g.cx + eyeDx - eyeW)} ${g.eyeY} Q ${r(g.cx + eyeDx)} ${r(g.eyeY + 1.5)} ${r(g.cx + eyeDx + eyeW)} ${g.eyeY}"
            stroke-width="1.15" opacity="0.82"/>
    </g>
    <!-- A little warmth on the cheeks; the difference between a shape and a face. -->
    <ellipse cx="${r(g.cx - eyeDx - 1)}" cy="${r(g.eyeY + g.ry * 0.26)}" rx="${r(g.rx * 0.2)}" ry="${r(g.ry * 0.1)}"
             fill="${shade(p.skin, -0.2)}" opacity="0.28"/>
    <ellipse cx="${r(g.cx + eyeDx + 1)}" cy="${r(g.eyeY + g.ry * 0.26)}" rx="${r(g.rx * 0.2)}" ry="${r(g.ry * 0.1)}"
             fill="${shade(p.skin, -0.2)}" opacity="0.28"/>`;
}

/** Lighten (t > 0) or darken (t < 0) a hex colour. */
export function shade(hex: string, t: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    const out = t >= 0 ? v + (255 - v) * t : v * (1 + t);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  const hex2 = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex2(ch(16))}${hex2(ch(8))}${hex2(ch(0))}`;
}
