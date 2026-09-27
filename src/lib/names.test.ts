import { describe, expect, it } from 'vitest';
import { cleanName } from './names';

describe('cleanName', () => {
  it('keeps a real name as typed, trimmed', () => {
    expect(cleanName('  Mira  Lindqvist ', 60)).toBe('Mira Lindqvist');
  });

  it('reads a name of invisible characters as blank', () => {
    expect(cleanName('\u200B\u200B', 30)).toBe('');
    expect(cleanName('\u3164\u2800\u00AD', 30)).toBe('');
    // Tag characters and variation selectors alone (round 4, bad actor).
    expect(cleanName('\u{E0041}\u{E0042}', 30)).toBe('');
    expect(cleanName('\uFE0F\uFE0F', 30)).toBe('');
  });

  it('strips invisible characters from inside a name', () => {
    expect(cleanName('Jo\u{E0041}nas\u200B', 30)).toBe('Jonas');
  });

  it('keeps an emoji-only name, and never cuts one in half', () => {
    expect(cleanName('\u{1F9D1}\u200D\u2708', 30)).not.toBe('');
    expect(cleanName('x'.repeat(200), 30)).toHaveLength(30);
  });
});
