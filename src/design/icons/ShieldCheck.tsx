import { Icon, type IconProps } from './Icon';

/**
 * Circles. A shield with a check, because a circle's whole claim is that
 * membership was *proved* rather than typed in — the verification is the
 * product, and the icon should say so before the label does.
 */
export function ShieldCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 5 5.8v5.4c0 4.1 2.9 7.6 7 8.6 4.1-1 7-4.5 7-8.6V5.8z" />
      <path d="m9.2 11.8 2 2 3.6-3.8" />
    </Icon>
  );
}
