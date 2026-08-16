import { Icon, type IconProps } from './Icon';

/**
 * Requests. A torn-stub ticket: something was asked for and is pending an
 * answer. A speech bubble would promise a chat feature that does not exist.
 */
export function Ticket(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 9.2V7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v1.7a2.8 2.8 0 0 0 0 5.6v1.7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-1.7a2.8 2.8 0 0 0 0-5.6Z" />
      <path d="M9.5 9v1.5M9.5 13.5V15" />
    </Icon>
  );
}
