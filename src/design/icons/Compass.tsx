import { Icon, type IconProps } from './Icon';

/** Discover. A compass rather than a list, because the answer is "who is near". */
export function Compass(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.6 8.4-2.3 5.5-5.5 2.3 2.3-5.5z" />
    </Icon>
  );
}
