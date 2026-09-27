/**
 * A name as other people will read it.
 *
 * Normalised, stripped of every character that prints as nothing, whitespace
 * collapsed, capped by what a person sees. A name is shown in other people's
 * rooms and on their boards; an uncapped one could carry a paragraph, and an
 * invisible one made a person anonymous.
 *
 * Returns '' when nothing a person could read is left — no letter, number or
 * emoji. Callers decide what a blank means: the store keeps the name you had,
 * the profile form refuses it.
 */
export function cleanName(raw: string, max: number): string {
  const kept = Array.from(raw.normalize('NFKC'))
    .filter((ch) => !invisible(ch.codePointAt(0) ?? 0))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(kept)) return '';
  // Capped by what a person sees, so an emoji is never cut in half.
  const Seg = (
    Intl as unknown as {
      Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> };
    }
  ).Segmenter;
  const parts = Seg ? Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(kept), (x) => x.segment) : Array.from(kept);
  return parts.slice(0, max).join('');
}

/**
 * Characters that print as nothing: controls, every format character (zero-
 * width marks, direction overrides, soft hyphens, the tag characters), the
 * variation selectors, and the blank letters that pass for a name — the
 * Hangul fillers, the braille blank, the Khmer and Mongolian invisibles.
 */
const FORMAT = /^[\p{Cc}\p{Cf}]$/u;
const invisible = (c: number): boolean =>
  FORMAT.test(String.fromCodePoint(c)) ||
  c === 0x34f ||
  (c >= 0x115f && c <= 0x1160) ||
  (c >= 0x17b4 && c <= 0x17b5) ||
  (c >= 0x180b && c <= 0x180e) ||
  (c >= 0x2028 && c <= 0x2029) ||
  c === 0x2800 ||
  c === 0x3164 ||
  c === 0xffa0 ||
  (c >= 0xfe00 && c <= 0xfe0f) ||
  (c >= 0xe0100 && c <= 0xe01ef);
