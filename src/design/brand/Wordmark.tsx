import type { CSSProperties } from 'react';
import { Logo, type LogoTone } from './Logo';

/**
 * The mark and the name together. The name carries `.display` — the same
 * rounded display face as every heading — so the wordmark never drifts from
 * the type it sits above.
 */
export function Wordmark({
  size = 28,
  tone = 'ink',
  className,
}: {
  size?: number;
  tone?: LogoTone;
  className?: string;
}) {
  const style = { '--wordmark-size': `${size}px` } as CSSProperties;
  return (
    <span className={`wordmark ${className ?? ''}`} style={style}>
      <Logo size={size} tone={tone} />
      <span className="wordmark__name display">Wingman</span>
    </span>
  );
}
