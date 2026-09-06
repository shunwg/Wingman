import { Icon, type IconProps } from './Icon';

/** Home. A roof and a door, at the same weight as the rest of the set. */
export function Home(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 10.5 12 3.8l8.5 6.7" />
      <path d="M5.5 9.3V20h13V9.3" />
      <path d="M10 20v-5.5h4V20" />
    </Icon>
  );
}
