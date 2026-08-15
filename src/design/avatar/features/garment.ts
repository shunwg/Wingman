import type { AvatarPalette } from '@domain/avatar';
import { shade, type HeadGeometry } from './face';

/**
 * Shoulders and what is on them.
 *
 * The shoulder line does more work than it looks like it should: it sets the
 * build, it frames the head, and its neckline is most of what distinguishes one
 * generated portrait from the next at card size. A plain rounded blob reads as
 * a bust in a museum.
 */

export const GARMENT_COUNT = 5;

const r = (n: number) => Math.round(n * 100) / 100;

export function garment(idx: number, g: HeadGeometry, p: AvatarPalette): string {
  const style = idx % GARMENT_COUNT;
  const shoulderY = r(g.chinY + g.ry * 0.42);
  const width = 30 + (style % 3) * 4.5;
  const light = shade(p.garment, 0.14);
  const dark = shade(p.garment, -0.16);

  const body = `
    <path d="M ${r(50 - width)} 100
             C ${r(50 - width)} ${r(shoulderY + g.ry * 0.5)} ${r(50 - width * 0.52)} ${shoulderY} 50 ${shoulderY}
             C ${r(50 + width * 0.52)} ${shoulderY} ${r(50 + width)} ${r(shoulderY + g.ry * 0.5)} ${r(50 + width)} 100 Z"
          fill="${p.garment}"/>`;

  switch (style) {
    case 0: // crew neck
      return `${body}
        <ellipse cx="50" cy="${r(shoulderY + 1)}" rx="${r(g.rx * 0.52)}" ry="${r(g.ry * 0.16)}" fill="${dark}"/>`;

    case 1: // V-neck, with skin showing
      return `${body}
        <path d="M ${r(50 - g.rx * 0.5)} ${r(shoulderY - 0.5)} L 50 ${r(shoulderY + g.ry * 0.5)} L ${r(50 + g.rx * 0.5)} ${r(shoulderY - 0.5)} Z"
              fill="${p.skin}"/>`;

    case 2: // collar and lapels
      return `${body}
        <path d="M ${r(50 - g.rx * 0.62)} ${r(shoulderY - 1)} L 50 ${r(shoulderY + g.ry * 0.62)} L ${r(50 - g.rx * 0.1)} ${r(shoulderY - 1.5)} Z"
              fill="${light}"/>
        <path d="M ${r(50 + g.rx * 0.62)} ${r(shoulderY - 1)} L 50 ${r(shoulderY + g.ry * 0.62)} L ${r(50 + g.rx * 0.1)} ${r(shoulderY - 1.5)} Z"
              fill="${light}"/>`;

    case 3: // scarf or high neck
      return `${body}
        <ellipse cx="50" cy="${r(shoulderY - g.ry * 0.1)}" rx="${r(g.rx * 0.72)}" ry="${r(g.ry * 0.3)}" fill="${light}"/>`;

    default: // open shirt over a base layer
      return `${body}
        <path d="M ${r(50 - g.rx * 0.72)} ${r(shoulderY + g.ry * 0.1)} L ${r(50 - g.rx * 0.2)} 100 L ${r(50 + g.rx * 0.2)} 100 L ${r(50 + g.rx * 0.72)} ${r(shoulderY + g.ry * 0.1)}
                 C ${r(50 + g.rx * 0.3)} ${r(shoulderY + g.ry * 0.5)} ${r(50 - g.rx * 0.3)} ${r(shoulderY + g.ry * 0.5)} ${r(50 - g.rx * 0.72)} ${r(shoulderY + g.ry * 0.1)} Z"
              fill="${dark}"/>`;
  }
}
