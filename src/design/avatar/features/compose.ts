import type { AvatarSpec } from '@domain/avatar';
import { ears, features, headGeometry, headPath, neck } from './face';
import { garment } from './garment';
import { hair } from './hair';

/**
 * Layer order.
 *
 * Painting order is the whole illusion. Hair behind the head gives volume;
 * hair in front gives a hairline. The neck shadow has to land after the neck
 * and before the head, or the chin floats. Get the order wrong and every
 * individual shape can be correct while the result still looks like a collage.
 */

export const BACKGROUND_COUNT = 4;

const r = (n: number) => Math.round(n * 100) / 100;

/** A soft shape behind the figure — depth without detail. */
export function backgroundMark(idx: number, rim: string): string {
  switch (idx % BACKGROUND_COUNT) {
    case 0:
      return `<circle cx="70" cy="27" r="31" fill="${rim}" opacity="0.16"/>`;
    case 1:
      return `<ellipse cx="26" cy="70" rx="44" ry="36" fill="${rim}" opacity="0.12"/>`;
    case 2:
      return `<rect x="-10" y="56" width="120" height="60" fill="${rim}" opacity="0.1"/>`;
    default:
      return `<circle cx="50" cy="46" r="34" fill="${rim}" opacity="0.09"/>`;
  }
}

export function composeFigure(spec: AvatarSpec): string {
  const { features: f, palette: p } = spec;
  const g = headGeometry(f.face);
  const jawWidth = 0.72 + (f.face % 3) * 0.08;
  const { back, front } = hair(f.hair, g, p);

  return `
    <!-- Light behind the head, so the subject sits in the frame rather than on it. -->
    <ellipse cx="${g.cx}" cy="${r(g.cy + 2)}" rx="${r(g.rx * 2.1)}" ry="${r(g.ry * 2.1)}"
             fill="${p.rim}" opacity="0.13"/>

    ${back}
    ${garment(f.garment, g, p)}
    ${neck(g, p)}
    ${ears(g, p)}
    <path d="${headPath(g, jawWidth)}" fill="${p.skin}"/>
    <!-- Form shadow down one side of the face; the light comes from the left. -->
    <path d="${headPath(g, jawWidth)}" fill="url(#${shadeId(spec.seed)})" opacity="0.5"/>
    ${features(g, f.face, p)}
    ${front}
  `;
}

/** Deterministic id fragment so gradients never collide across a page. */
export const shadeId = (seed: string) => `sh-${seed.replace(/[^a-zA-Z0-9]/g, '')}`;
