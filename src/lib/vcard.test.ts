import { describe, expect, it } from 'vitest';
import { buildVCard } from './vcard';

describe('buildVCard', () => {
  it('writes the released fields and nothing else', () => {
    const v = buildVCard({
      fullName: 'Jonas Lindqvist',
      title: 'Principal engineer',
      urls: ['https://www.linkedin.com/in/jonaslindqvist'],
    });
    expect(v).toContain('BEGIN:VCARD\r\nVERSION:4.0\r\n');
    expect(v).toContain('FN:Jonas Lindqvist\r\n');
    expect(v).toContain('N:Lindqvist;Jonas;;;\r\n');
    expect(v).toContain('TITLE:Principal engineer\r\n');
    expect(v).toContain('URL:https://www.linkedin.com/in/jonaslindqvist\r\n');
    expect(v).not.toContain('ORG:');
    expect(v.endsWith('END:VCARD\r\n')).toBe(true);
  });

  it('escapes commas, semicolons and newlines', () => {
    const v = buildVCard({ fullName: 'A; B', urls: [], note: 'one, two\nthree' });
    expect(v).toContain('FN:A\\; B');
    expect(v).toContain('NOTE:one\\, two\\nthree');
  });

  it('folds long lines at 75 octets', () => {
    const v = buildVCard({ fullName: 'X', urls: ['https://example.com/' + 'a'.repeat(100)] });
    const long = v.split('\r\n').find((l) => l.startsWith('URL:'))!;
    expect(long.length).toBe(75);
    expect(v).toContain('\r\n a');
  });
});
