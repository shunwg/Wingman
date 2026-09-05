/**
 * A vCard from what the ladder released — and nothing the ladder did not.
 *
 * The caller passes the fields it already holds as a `RedactedPerson`; this
 * file only formats. RFC 6350: CRLF line ends, 75-octet folding, escaped
 * commas, semicolons and newlines.
 */
export interface ContactCard {
  fullName: string;
  title?: string;
  company?: string;
  urls: string[];
  note?: string;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

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

export function buildVCard(c: ContactCard): string {
  const parts = c.fullName.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]! : '';
  const lines = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    `FN:${esc(c.fullName)}`,
    `N:${esc(last)};${esc(first)};;;`,
    ...(c.title ? [`TITLE:${esc(c.title)}`] : []),
    ...(c.company ? [`ORG:${esc(c.company)}`] : []),
    ...c.urls.map((u) => `URL:${esc(u)}`),
    ...(c.note ? [`NOTE:${esc(c.note)}`] : []),
    'END:VCARD',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
