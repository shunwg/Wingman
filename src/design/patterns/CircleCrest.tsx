/**
 * A circle's mark.
 *
 * The organiser's uploaded image when there is one; otherwise two letters on
 * a sunk square — a crest, not a logo, generated the way people get generated
 * portraits. One component, three sizes, so the mark on a card chip, a list
 * row and a circle's home are visibly the same thing.
 */
export type CrestSize = 'xs' | 'sm' | 'md' | 'lg';

const PX: Record<CrestSize, number> = { xs: 18, sm: 28, md: 44, lg: 72 };

export function CircleCrest({
  shortName,
  crestUrl,
  size = 'md',
  className,
}: {
  shortName: string;
  crestUrl?: string;
  size?: CrestSize;
  className?: string;
}) {
  const px = PX[size];
  const letters = shortName.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '·';
  if (crestUrl) {
    return (
      <img
        className={`crest crest--${size} ${className ?? ''}`}
        src={crestUrl}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <span className={`crest crest--${size} crest--letters mono ${className ?? ''}`} aria-hidden="true">
      {letters}
    </span>
  );
}
