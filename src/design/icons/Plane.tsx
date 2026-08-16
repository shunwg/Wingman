import { Icon, type IconProps } from './Icon';

/** Trip. A paper plane, not an airliner — this is your journey, not aviation. */
export function Plane(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20.5 3.5 3.8 10.6a.4.4 0 0 0 0 .7l6.4 2.5 2.5 6.4a.4.4 0 0 0 .7 0z" />
      <path d="M10.2 13.8 20.5 3.5" />
    </Icon>
  );
}
