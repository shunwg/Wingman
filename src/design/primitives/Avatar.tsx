import { useMemo } from 'react';
import type { AvatarSpec } from '@domain/avatar';
import { renderAvatarSVG } from '../avatar/generate';

/**
 * A person's photo.
 *
 * Thin wrapper: the generator produces an SVG string in the pure layer, this
 * puts it on screen. Keeping the split means the interesting logic — variety,
 * determinism, the contrast guard rail — is tested in plain Node without a
 * renderer.
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
  const svg = useMemo(
    () => renderAvatarSVG(spec, label ? { title: label } : {}),
    [spec, label],
  );

  return (
    <div
      className={`avatar avatar--${shape} ${className ?? ''}`}
      style={{ width: PX[size], height: shape === 'photo' ? '100%' : PX[size] }}
      // The generator's output is built entirely from typed values and escaped
      // labels — no user-supplied markup ever reaches it.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
