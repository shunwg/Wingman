import { useMemo } from 'react';
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
 */

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

const PX: Record<AvatarSize, string> = {
  xs: '28px',
  sm: '40px',
  md: '56px',
  lg: '88px',
  xl: '128px',
  full: '100%',
};

export interface AvatarProps {
  spec: AvatarSpec;
  size?: AvatarSize;
  /** Pass a name to label it; omit when a name sits directly beside it. */
  label?: string;
  /** Square by default; `photo` uses the card radius for full-bleed use. */
  shape?: 'circle' | 'photo';
  className?: string;
}

export function Avatar({ spec, size = 'md', label, shape = 'circle', className }: AvatarProps) {
  // Hooks run before the early return, because they have to run every render.
  const svg = useMemo(
    () => (spec.photoUrl ? '' : renderAvatarSVG(spec, label ? { title: label } : {})),
    [spec, label],
  );

  const box = { width: PX[size], height: shape === 'photo' ? '100%' : PX[size] };

  if (spec.photoUrl) {
    return (
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
    );
  }

  return (
    <div
      className={`avatar avatar--${shape} ${className ?? ''}`}
      style={box}
      // The generator's output is built entirely from typed values and escaped
      // labels — no user-supplied markup ever reaches it.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
