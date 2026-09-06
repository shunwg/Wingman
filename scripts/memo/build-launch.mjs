/**
 * docs/launch-memo/body.html → memo.html → A4 PDF + reMarkable PDF.
 *
 * The stylesheet is the deployment memo's, injected at build time so the two
 * memos cannot drift apart. The reMarkable 2 is 1404 × 1872 px at 226 ppi,
 * which is 157 × 210 mm; a page that size with small margins fills the screen
 * without the device scaling a wider sheet down.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, '..', '..', 'docs');
const deployMemo = readFileSync(join(docs, 'deploy-memo', 'memo.html'), 'utf8');
const style = deployMemo.match(/<style>[\s\S]*?<\/style>/)?.[0];
if (!style) throw new Error('No <style> block in the deployment memo to share.');

const dir = join(docs, 'launch-memo');
const body = readFileSync(join(dir, 'body.html'), 'utf8');
const html = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n${body.replace('<!--STYLE-->', style)}\n</html>\n`;
const src = join(dir, 'memo.html');
writeFileSync(src, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.emulateMedia({ colorScheme: 'light' });
await page.goto(`file://${src.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });

const footer = (label) =>
  '<div style="width:100%;font:9px -apple-system,Segoe UI,sans-serif;color:#8a8079;' +
  'padding:0 14mm;display:flex;justify-content:space-between;">' +
  `<span>${label}</span><span class="pageNumber"></span></div>`;

const a4 = join(dir, 'wingman-launch-memo-A4.pdf');
await page.pdf({
  path: a4,
  format: 'A4',
  printBackground: true,
  margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: footer('Wingman — launch memo'),
});

const rm = join(dir, 'wingman-launch-memo-reMarkable.pdf');
await page.addStyleTag({ content: '@media print { body { font-size: 11.5pt; } }' });
await page.pdf({
  path: rm,
  width: '157mm',
  height: '210mm',
  printBackground: true,
  margin: { top: '10mm', bottom: '12mm', left: '9mm', right: '9mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: footer('Wingman — launch memo'),
});

await browser.close();
console.log(`OUT=${a4}\nOUT=${rm}`);
