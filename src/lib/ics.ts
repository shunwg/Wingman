/**
 * A calendar entry for a meet, and nothing else.
 *
 * RFC 5545: CRLF line ends, 75-octet folding, UTC instants. The caller passes
 * only what the room already shows — the kind, the window, the public place
 * label — so nothing the ladder withheld can end up in someone's calendar.
 */
export interface CalendarEntry {
  uid: string;
  title: string;
  /** ISO 8601 UTC instants. */
  start: string;
  end: string;
  location?: string;
  description?: string;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

/** "2026-09-03T12:10:00Z" → "20260903T121000Z". */
export const icsStamp = (iso: string): string =>
  new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    out.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  out.push(rest);
  return out.join('\r\n');
}

export function buildIcs(e: CalendarEntry, now: string = e.start): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wingman//Meet//EN',
    'BEGIN:VEVENT',
    `UID:${esc(e.uid)}`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(e.start)}`,
    `DTEND:${icsStamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
