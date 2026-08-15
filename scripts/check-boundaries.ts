/**
 * Import-boundary enforcement.
 *
 *     npx tsx scripts/check-boundaries.ts
 *
 * The four swappable axes only stay swappable if the edges between them are
 * enforced. ESLint carries the same rules for editor feedback; this exists so
 * the check also runs in CI without needing the whole lint pass, and so the
 * failure message explains *why* the edge exists rather than just naming a rule.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

interface Rule {
  /** Files under this folder… */
  folder: string;
  /** …may not import anything matching these. */
  forbidden: RegExp[];
  why: string;
}

const RULES: Rule[] = [
  {
    folder: 'design',
    forbidden: [/^@screens\//, /^@matching\//, /^@privacy\//, /^@stamps\//, /^@state\//, /^@providers\//],
    why: 'design/ renders; it does not decide. Swapping the design system must never require touching an engine.',
  },
  {
    folder: 'matching',
    forbidden: [/^react$/, /^react-dom/, /^@design\//, /^@screens\//, /^@state\//, /^@providers\//, /^@data\//, /^zustand/, /^@tanstack\//],
    why: 'matching/ must run under plain Node. Inject what it needs as a parameter.',
  },
  {
    folder: 'privacy',
    forbidden: [/^react$/, /^react-dom/, /^@design\//, /^@screens\//, /^@state\//, /^@providers\//, /^@data\//, /^@matching\//, /^zustand/, /^@tanstack\//],
    why: 'privacy/ is upstream of matching/ and must run under plain Node. The dependency runs one way only.',
  },
  {
    folder: 'stamps',
    forbidden: [/^react$/, /^react-dom/, /^@design\//, /^@screens\//, /^@state\//],
    why: 'stamps/ is a provider layer, not a UI layer. Adding a provider must need zero screen edits.',
  },
  {
    folder: 'domain',
    forbidden: [/^@/, /^react/],
    why: 'domain/ is the contract. It depends on nothing, so everything can depend on it.',
  },
];

/** Screens may use the engines, but only through their public index. */
const SCREEN_DEEP_IMPORT = /^@(matching|privacy|stamps)\/.+/;

const IMPORT_RE = /(?:^|\n)\s*import\s+(?:type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const EXPORT_FROM_RE = /(?:^|\n)\s*export\s+(?:type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

function importsIn(source: string): string[] {
  const found: string[] = [];
  for (const re of [IMPORT_RE, EXPORT_FROM_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) if (m[1]) found.push(m[1]);
  }
  return found;
}

const violations: string[] = [];

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).replace(/\\/g, '/');
  // Tests may reach across boundaries — that is what a test is for.
  if (/(^|\/)(__tests__|__fixtures__)\//.test(rel) || /\.(test|uitest)\.tsx?$/.test(rel)) continue;

  const specifiers = importsIn(readFileSync(file, 'utf8'));
  const topFolder = rel.split('/')[0]!;

  const rule = RULES.find((r) => r.folder === topFolder);
  if (rule) {
    for (const spec of specifiers) {
      if (rule.forbidden.some((re) => re.test(spec))) {
        violations.push(`${rel}\n    imports ${spec}\n    ${rule.why}`);
      }
    }
  }

  if (topFolder === 'screens') {
    for (const spec of specifiers) {
      if (SCREEN_DEEP_IMPORT.test(spec)) {
        violations.push(
          `${rel}\n    imports ${spec}\n    Import engines through their public index (e.g. @privacy), not their internals.`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`Boundary check FAILED — ${violations.length} violation(s):\n`);
  for (const v of violations) console.error(`  · ${v}\n`);
  process.exit(1);
}

console.log('  boundaries intact — no forbidden imports across the four axes');
