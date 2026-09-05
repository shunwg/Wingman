import { Icon, type IconProps } from './Icon';

/**
 * Trip. A route between two points — the same idea as the brand mark, drawn as
 * a nav glyph. Not an airplane: the brief bans the motif, and the trip is yours,
 * not aviation's.
 */
export function Route(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 18 C 9 18, 12 14, 13.5 10.5 C 14.5 8, 16.5 6.5, 19 6" />
      <circle cx="5" cy="18" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="6" r="1.6" fill="currentColor" stroke="none" />
    </Icon>
  );
}
