/**
 * memo.html → A4 PDF.
 *
 * One HTML source feeds the interactive artifact, this A4, and the reMarkable
 * edition, so the three cannot drift. The page's own `@media print` block does
 * the work — this script only supplies the paper.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// The memo lives with the docs; this script lives with the other tooling.
const memoDir = join(here, '..', '..', 'docs', 'deploy-memo');
const src = join(memoDir, 'memo.html');
const out = join(memoDir, 'wingman-deploy-memo-A4.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();

// Force the light palette: the print block redefines the tokens, but the
// emulated media has to be `screen` for `prefers-color-scheme` to resolve the
// way a person's printer would.
await page.emulateMedia({ colorScheme: 'light' });
await page.goto(`file://${src.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });

await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font:9px -apple-system,Segoe UI,sans-serif;color:#8a8079;' +
    'padding:0 18mm;display:flex;justify-content:space-between;">' +
    '<span>Wingman — deployment roadmap</span>' +
    '<span class="pageNumber"></span></div>',
});

await browser.close();
console.log(`OUT=${out}`);
