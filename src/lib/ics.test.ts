import { describe, expect, it } from 'vitest';
import { buildIcs, icsStamp } from './ics';

describe('buildIcs', () => {
  it('writes a UTC event with CRLF line ends and escaped text', () => {
    const ics = buildIcs(
      {
        uid: 'meet:r1@wingman',
        title: 'Coffee at the gate',
        start: '2026-09-03T12:10:00Z',
        end: '2026-09-03T12:50:00Z',
        location: 'CPH, Terminal 3; by the coffee place',
        description: 'Met through Wingman',
      },
      '2026-09-02T16:30:00Z',
    );
    const lines = ics.split('\r\n');
    expect(lines).toContain('DTSTART:20260903T121000Z');
    expect(lines).toContain('DTEND:20260903T125000Z');
    expect(lines).toContain('DTSTAMP:20260902T163000Z');
    expect(lines).toContain('LOCATION:CPH\\, Terminal 3\\; by the coffee place');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('folds long lines at 75 octets', () => {
    const ics = buildIcs({ uid: 'u', title: 'x'.repeat(120), start: '2026-09-03T12:10:00Z', end: '2026-09-03T12:50:00Z' });
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });

  it('stamps without milliseconds', () => {
    expect(icsStamp('2026-09-03T12:10:00.123Z')).toBe('20260903T121000Z');
  });
});
