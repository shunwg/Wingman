import { useMemo, type CSSProperties } from 'react';
import type { AvatarSpec } from '@domain/avatar';
import { renderAvatarSVG } from '../avatar/generate';

/**
 * A person's photo.
 *
 * Two paths, one component, and the caller never picks. A spec carrying a
 * `photoUrl` renders the photograph; everything else renders the generated
 * portrait. Screens stay ignorant of which they got, which is what stops the
 * "does this person have a picture" question from spreading across the app.
 *
 * The generated path is a thin wrapper: the generator produces an SVG string in
 * the pure layer, this puts it on screen. Keeping the split means the
 * interesting logic — variety, determinism, the contrast guard rail — is tested
 * in plain Node without a renderer.
 *
 * A spec always carries a `palette` — even a person with a real photograph got
 * one generated from their id first, and the photo was layered on top (see
 * `domain/avatar.ts`). The `chip` shape uses that palette as a soft glow behind
 * the photo, so a real photograph and a generated portrait sit in the same
 * colour-matched frame on a card rather than one looking "designed" and the
 * other not.
 */

export type AvatarSize = 'xs' | 'sm' | 'md' | 'chip' | 'lg' | 'xl' | 'full';

const PX: Record<AvatarSize, string> = {
  xs: '28px',
  sm: '40px',
  md: '56px',
  /** The card-identity size: bigger and squarer than `md`, still nowhere near
   *  a full photo card — see `.avatar--chip`. */
  chip: '68px',
  lg: '88px',
  xl: '128px',
  full: '100%',
};

export interface AvatarProps {
  spec: AvatarSpec;
  size?: AvatarSize;
  /** Pass a name to label it; omit when a name sits directly beside it. */
  label?: string;
  /**
   * `circle` for a chat-header/small glance. `photo` uses the card radius for
   * full-bleed use. `chip` is the card-identity treatment: a rounded square
   * with a colour-matched glow, big enough to read as a photograph.
   */
  shape?: 'circle' | 'photo' | 'chip';
  className?: string;
}

export function Avatar({ spec, size = 'md', label, shape = 'circle', className }: AvatarProps) {
  // Hooks run before the early return, because they have to run every render.
  const svg = useMemo(
    () => (spec.photoUrl ? '' : renderAvatarSVG(spec, label ? { title: label } : {})),
    [spec, label],
  );

  const box = { width: PX[size], height: shape === 'photo' ? '100%' : PX[size] };

  const image = spec.photoUrl ? (
    <img
      src={spec.photoUrl}
      // Decorative when a name sits beside it: announcing "photo of Priya"
      // next to the text "Priya" is noise in a screen reader, not detail.
      alt={label ?? ''}
      loading="lazy"
      decoding="async"
      className={`avatar avatar--${shape} ${className ?? ''}`}
      style={box}
    />
  ) : (
    <div
      className={`avatar avatar--${shape} ${className ?? ''}`}
      style={box}
      // The generator's output is built entirely from typed values and escaped
      // labels — no user-supplied markup ever reaches it.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );

  if (shape !== 'chip') return image;

  const glow = {
    '--chip-from': spec.palette.bgFrom,
    '--chip-to': spec.palette.bgTo,
    width: box.width,
    height: box.width,
  } as CSSProperties;

  return (
    <span className="avatar-chip" style={glow}>
      {image}
    </span>
  );
}
