import { describe, expect, it } from 'vitest';
import { generateAvatar, renderAvatarSVG, avatarFor } from './generate';
import { contrastRatio, mixHex, paletteCount } from './palette';

/**
 * Procedural portraits have two failure modes that only show up at scale: the
 * same face appearing everywhere, and the occasional seed whose figure vanishes
 * into its own backdrop. Both look like bugs to a user, so both are tested
 * across a realistic population rather than on one example.
 */

const SEEDS = Array.from({ length: 200 }, (_, i) => `person-${i}`);

describe('determinism', () => {
  it('gives the same seed byte-identical output', () => {
    expect(avatarFor('ada')).toBe(avatarFor('ada'));
    expect(generateAvatar('ada')).toEqual(generateAvatar('ada'));
  });

  it('is stable regardless of generation order', () => {
    const first = avatarFor('bo');
    avatarFor('someone-else');
    avatarFor('another');
    expect(avatarFor('bo')).toBe(first);
  });

  it('gives different seeds different output', () => {
    expect(avatarFor('ada')).not.toBe(avatarFor('bo'));
  });
});

describe('variety across a population', () => {
  it('produces a distinct portrait for every one of 200 people', () => {
    const svgs = new Set(SEEDS.map((s) => avatarFor(s)));
    expect(svgs.size).toBe(SEEDS.length);
  });

  it('spreads across the palette set rather than favouring one', () => {
    const used = new Set(SEEDS.map((s) => generateAvatar(s).palette.bgFrom));
    // Every curated duotone should appear somewhere in 200 draws.
    expect(used.size).toBe(paletteCount);
  });

  it('varies the silhouette, not just the colour', () => {
    const shapes = new Set(
      SEEDS.map((s) => {
        const f = generateAvatar(s).features;
        return `${f.face}-${f.hair}-${f.garment}`;
      }),
    );
    expect(shapes.size).toBeGreaterThan(40);
  });

  it('varies the crop, so nobody is dead-centre', () => {
    const offsets = SEEDS.map((s) => generateAvatar(s).features.offsetX);
    expect(new Set(offsets).size).toBeGreaterThan(100);
    // But keeps it subtle — a face half out of frame is not a portrait.
    for (const o of offsets) expect(Math.abs(o)).toBeLessThanOrEqual(0.22);
  });
});

describe('legibility', () => {
  it('never lets the figure disappear into the backdrop', () => {
    for (const seed of SEEDS) {
      const { palette } = generateAvatar(seed);
      const ratio = contrastRatio(palette.garment, palette.bgTo);
      expect(ratio, `${seed} produced an unreadable silhouette`).toBeGreaterThanOrEqual(1.6);
    }
  });

  it('keeps the monogram readable where it actually sits', () => {
    // The glyph is centred, so the gradient midpoint is the ground it has to
    // clear — not either end stop.
    for (const seed of SEEDS) {
      const { palette } = generateAvatar(seed, 'monogram');
      const mid = mixHex(palette.bgFrom, palette.bgTo, 0.5);
      expect(
        contrastRatio(palette.onBg, mid),
        `${seed} produced an unreadable monogram`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('markup', () => {
  it('is a well-formed standalone SVG', () => {
    const svg = avatarFor('ada');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 100 100"');
  });

  it('scopes gradient ids per seed so two portraits never collide', () => {
    const a = avatarFor('ada');
    const b = avatarFor('bo');
    const idOf = (svg: string) => svg.match(/id="(g-[^"]+)"/)?.[1];
    expect(idOf(a)).toBeDefined();
    expect(idOf(a)).not.toBe(idOf(b));
  });

  it('is decorative unless given a label', () => {
    expect(avatarFor('ada')).toContain('aria-hidden="true"');
    expect(avatarFor('ada', { title: 'Ada' })).toContain('aria-label="Ada"');
  });

  it('escapes a hostile label rather than injecting it', () => {
    const svg = avatarFor('x', { title: 'Ada" onload="alert(1)' });
    // The payload may appear as text; what matters is that its quotes are
    // escaped, so it cannot close aria-label and open a real attribute.
    expect(svg).toContain('&quot;');
    expect(svg).not.toContain('onload="');
    expect(svg).toContain('aria-label="Ada&quot; onload=&quot;alert(1)"');
  });

  it('renders a monogram fallback', () => {
    const svg = renderAvatarSVG(generateAvatar('ada', 'monogram'));
    expect(svg).toContain('>A<');
  });

  it('handles an empty seed without producing broken markup', () => {
    const svg = renderAvatarSVG(generateAvatar('', 'monogram'));
    expect(svg).toContain('>?<');
  });
});
