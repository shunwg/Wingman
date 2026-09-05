import type { ChannelId, MessageId, PersonId } from './ids';
import type { SafetyFlag } from './rating';
import type { ISODateTime } from './time';

/**
 * A report.
 *
 * Kept on the device until Wingman has a server — and said so on the sheet
 * that files it. Hiding the person is immediate and separate; a report is
 * for trust and safety, never a message to the person reported.
 */
export interface SafetyReport {
  id: string;
  personId: PersonId;
  channelId?: ChannelId;
  messageId?: MessageId;
  reason: SafetyFlag | 'other';
  note?: string;
  at: ISODateTime;
}

export const REPORT_REASONS: { id: SafetyFlag | 'other'; label: string }[] = [
  { id: 'pushy', label: 'Pushy or would not take no' },
  { id: 'unsafe', label: 'Made me feel unsafe' },
  { id: 'misrepresented', label: 'Not who they said they were' },
  { id: 'commercial_spam', label: 'Selling something' },
  { id: 'other', label: 'Something else' },
];
