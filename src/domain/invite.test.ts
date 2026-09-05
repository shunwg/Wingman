import { describe, expect, it } from 'vitest';
import { inviteWithBadge, parseInvite } from './invite';

describe('invite codes', () => {
  it('parses a plain code, any case', () => {
    expect(parseInvite('abc123')).toEqual({ code: 'ABC123' });
    expect(parseInvite(' ABC123 ')).toEqual({ code: 'ABC123' });
  });
  it('parses a badge suffix', () => {
    expect(parseInvite('ABC123-speaker')).toEqual({ code: 'ABC123', badgeId: 'speaker' });
    expect(parseInvite('ABC123-Sponsor')).toEqual({ code: 'ABC123', badgeId: 'sponsor' });
  });
  it('refuses anything else', () => {
    expect(parseInvite('ABC12')).toBeNull();
    expect(parseInvite('ABC123-')).toBeNull();
    expect(parseInvite('ABC123-a b')).toBeNull();
  });
  it('round-trips', () => {
    expect(parseInvite(inviteWithBadge('ABC123', 'speaker'))).toEqual({ code: 'ABC123', badgeId: 'speaker' });
    expect(inviteWithBadge('ABC123')).toBe('ABC123');
  });
});
