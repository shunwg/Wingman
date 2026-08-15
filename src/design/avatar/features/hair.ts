import type { AvatarPalette } from '@domain/avatar';
import { shade, type HeadGeometry } from './face';

/**
 * Hair.
 *
 * Drawn in two layers — a mass behind the head and a shape in front of it —
 * because a single silhouette pasted on top always reads as a hat. The back
 * layer is what gives volume; the front layer is what gives a hairline.
 *
 * Eight styles, none of them gendered in the data. The generator picks from all
 * of them for everyone, which is both the right default and one less field for
 * anything downstream to accidentally key on.
 */

export const HAIR_COUNT = 8;

const r = (n: number) => Math.round(n * 100) / 100;

export interface HairLayers {
  /** Drawn before the head. */
  back: string;
  /** Drawn after the head and its features. */
  front: string;
}

export function hair(idx: number, g: HeadGeometry, p: AvatarPalette): HairLayers {
  const style = idx % HAIR_COUNT;
  const { cx, cy, rx, ry } = g;
  const light = shade(p.hair, 0.16);
  const dark = shade(p.hair, -0.22);
  const crown = r(cy - ry * 1.24);

  /**
   * The mass that sits on the skull, shared by every style.
   *
   * The hairline is the whole difference between hair and a hat. It has to sit
   * high on the forehead and sweep *down* at the temples — a flat edge straight
   * across reads as a cap brim, no matter what colour it is.
   */
  const capTop = (spread = 1.02, drop = 0.12) => `
    <path d="M ${r(cx - rx * spread)} ${r(cy + ry * drop)}
             C ${r(cx - rx * spread)} ${r(crown + ry * 0.05)} ${r(cx - rx * 0.6)} ${r(crown - ry * 0.12)} ${cx} ${r(crown - ry * 0.12)}
             C ${r(cx + rx * 0.6)} ${r(crown - ry * 0.12)} ${r(cx + rx * spread)} ${r(crown + ry * 0.05)} ${r(cx + rx * spread)} ${r(cy + ry * drop)}
             C ${r(cx + rx * 0.78)} ${r(cy - ry * 0.5)} ${r(cx + rx * 0.42)} ${r(cy - ry * 0.74)} ${cx} ${r(cy - ry * 0.72)}
             C ${r(cx - rx * 0.42)} ${r(cy - ry * 0.74)} ${r(cx - rx * 0.78)} ${r(cy - ry * 0.5)} ${r(cx - rx * spread)} ${r(cy + ry * drop)} Z"
          fill="${p.hair}"/>`;

  switch (style) {
    case 0: // cropped
      return { back: '', front: capTop(1.0, -0.16) };

    case 1: // side-swept, with a real parting
      return {
        back: '',
        front: `${capTop(1.02, -0.1)}
          <path d="M ${r(cx - rx * 1.02)} ${r(cy - ry * 0.1)}
                   C ${r(cx - rx * 0.5)} ${r(cy - ry * 0.62)} ${r(cx + rx * 0.35)} ${r(cy - ry * 0.5)} ${r(cx + rx * 1.0)} ${r(cy - ry * 0.34)}
                   C ${r(cx + rx * 0.4)} ${r(cy - ry * 0.86)} ${r(cx - rx * 0.4)} ${r(cy - ry * 0.9)} ${r(cx - rx * 1.02)} ${r(cy - ry * 0.1)} Z"
                fill="${light}" opacity="0.75"/>`,
      };

    case 2: // bob
      return {
        back: `<path d="M ${r(cx - rx * 1.24)} ${r(cy + ry * 0.72)}
                        C ${r(cx - rx * 1.3)} ${r(cy - ry * 0.6)} ${r(cx - rx * 0.6)} ${r(crown - ry * 0.14)} ${cx} ${r(crown - ry * 0.14)}
                        C ${r(cx + rx * 0.6)} ${r(crown - ry * 0.14)} ${r(cx + rx * 1.3)} ${r(cy - ry * 0.6)} ${r(cx + rx * 1.24)} ${r(cy + ry * 0.72)}
                        L ${r(cx + rx * 0.88)} ${r(cy + ry * 0.58)}
                        C ${r(cx + rx * 0.9)} ${r(cy - ry * 0.3)} ${r(cx - rx * 0.9)} ${r(cy - ry * 0.3)} ${r(cx - rx * 0.88)} ${r(cy + ry * 0.58)} Z"
                      fill="${p.hair}"/>`,
        front: capTop(1.04, -0.14),
      };

    case 3: // long
      return {
        back: `<path d="M ${r(cx - rx * 1.3)} ${r(cy + ry * 1.9)}
                        C ${r(cx - rx * 1.36)} ${r(cy - ry * 0.5)} ${r(cx - rx * 0.6)} ${r(crown - ry * 0.16)} ${cx} ${r(crown - ry * 0.16)}
                        C ${r(cx + rx * 0.6)} ${r(crown - ry * 0.16)} ${r(cx + rx * 1.36)} ${r(cy - ry * 0.5)} ${r(cx + rx * 1.3)} ${r(cy + ry * 1.9)}
                        L ${r(cx + rx * 0.92)} ${r(cy + ry * 1.5)}
                        C ${r(cx + rx * 0.98)} ${r(cy - ry * 0.2)} ${r(cx - rx * 0.98)} ${r(cy - ry * 0.2)} ${r(cx - rx * 0.92)} ${r(cy + ry * 1.5)} Z"
                      fill="${p.hair}"/>`,
        front: capTop(1.04, -0.12),
      };

    case 4: // curls — volume from overlapping rounds
      return {
        back: `<g fill="${p.hair}">
            <circle cx="${r(cx - rx * 0.92)}" cy="${r(cy - ry * 0.5)}" r="${r(rx * 0.5)}"/>
            <circle cx="${r(cx + rx * 0.92)}" cy="${r(cy - ry * 0.5)}" r="${r(rx * 0.5)}"/>
            <circle cx="${r(cx - rx * 0.5)}" cy="${r(cy - ry * 1.0)}" r="${r(rx * 0.52)}"/>
            <circle cx="${r(cx + rx * 0.5)}" cy="${r(cy - ry * 1.0)}" r="${r(rx * 0.52)}"/>
            <circle cx="${cx}" cy="${r(cy - ry * 1.14)}" r="${r(rx * 0.54)}"/>
            <circle cx="${r(cx - rx * 1.05)}" cy="${r(cy + ry * 0.02)}" r="${r(rx * 0.38)}"/>
            <circle cx="${r(cx + rx * 1.05)}" cy="${r(cy + ry * 0.02)}" r="${r(rx * 0.38)}"/>
          </g>`,
        front: `<path d="M ${r(cx - rx * 0.98)} ${r(cy - ry * 0.2)}
                         C ${r(cx - rx * 0.9)} ${r(cy - ry * 0.9)} ${r(cx + rx * 0.9)} ${r(cy - ry * 0.9)} ${r(cx + rx * 0.98)} ${r(cy - ry * 0.2)}
                         C ${r(cx + rx * 0.5)} ${r(cy - ry * 0.56)} ${r(cx - rx * 0.5)} ${r(cy - ry * 0.56)} ${r(cx - rx * 0.98)} ${r(cy - ry * 0.2)} Z"
                      fill="${p.hair}"/>`,
      };

    case 5: // tied back
      return {
        back: `<ellipse cx="${r(cx + rx * 1.02)}" cy="${r(cy + ry * 0.42)}" rx="${r(rx * 0.34)}" ry="${r(ry * 0.6)}" fill="${dark}"/>`,
        front: `${capTop(1.02, -0.06)}
          <path d="M ${r(cx - rx * 0.9)} ${r(cy - ry * 0.28)} Q ${cx} ${r(cy - ry * 0.72)} ${r(cx + rx * 0.9)} ${r(cy - ry * 0.28)}"
                stroke="${light}" stroke-width="0.8" fill="none" opacity="0.5"/>`,
      };

    case 6: {
      // Close crop. Drawn tight to the skull in hair colour rather than as a
      // translucent cap — a semi-transparent shape over the head reads as a
      // swim cap, which is a very specific and very wrong impression.
      const hairline = r(cy - ry * 0.42);
      return {
        back: '',
        front: `<path d="M ${r(cx - rx * 0.98)} ${hairline}
                         C ${r(cx - rx * 0.98)} ${r(cy - ry * 1.02)} ${r(cx - rx * 0.6)} ${r(crown - ry * 0.02)} ${cx} ${r(crown - ry * 0.02)}
                         C ${r(cx + rx * 0.6)} ${r(crown - ry * 0.02)} ${r(cx + rx * 0.98)} ${r(cy - ry * 1.02)} ${r(cx + rx * 0.98)} ${hairline}
                         C ${r(cx + rx * 0.5)} ${r(cy - ry * 0.62)} ${r(cx - rx * 0.5)} ${r(cy - ry * 0.62)} ${r(cx - rx * 0.98)} ${hairline} Z"
                      fill="${p.hair}"/>
                <!-- Faded edge where it meets the temple. -->
                <path d="M ${r(cx - rx * 0.98)} ${hairline} C ${r(cx - rx * 0.5)} ${r(cy - ry * 0.56)} ${r(cx + rx * 0.5)} ${r(cy - ry * 0.56)} ${r(cx + rx * 0.98)} ${hairline}"
                      stroke="${p.hair}" stroke-width="2.4" fill="none" opacity="0.35"/>`,
      };
    }

    default: // wrapped / covered
      return {
        back: '',
        front: `<path d="M ${r(cx - rx * 1.14)} ${r(cy + ry * 0.98)}
                         C ${r(cx - rx * 1.2)} ${r(cy - ry * 0.5)} ${r(cx - rx * 0.6)} ${r(crown - ry * 0.16)} ${cx} ${r(crown - ry * 0.16)}
                         C ${r(cx + rx * 0.6)} ${r(crown - ry * 0.16)} ${r(cx + rx * 1.2)} ${r(cy - ry * 0.5)} ${r(cx + rx * 1.14)} ${r(cy + ry * 0.98)}
                         C ${r(cx + rx * 0.6)} ${r(cy + ry * 0.72)} ${r(cx - rx * 0.6)} ${r(cy + ry * 0.72)} ${r(cx - rx * 1.14)} ${r(cy + ry * 0.98)} Z"
                      fill="${p.hair}"/>
                <path d="M ${r(cx - rx * 1.1)} ${r(cy + ry * 0.5)} Q ${cx} ${r(cy + ry * 0.2)} ${r(cx + rx * 1.1)} ${r(cy + ry * 0.5)}"
                      stroke="${light}" stroke-width="1" fill="none" opacity="0.35"/>`,
      };
  }
}
