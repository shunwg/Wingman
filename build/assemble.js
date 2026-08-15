/* Assemble the single-file prototype: inline CSS + JS into shell.html */
const fs = require('fs');
const path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, '..', 'src', p), 'utf8');

const css = src('styles.css');
const js = ['data.js', 'matching.js', 'core.js', 'map.js', 'views1.js', 'views2.js']
  .map(f => `/* ===== ${f} ===== */\n` + src(f).replace(/<\/script>/g, '<\\/script>'))
  .join('\n\n');

let html = src('shell.html')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js);

const out = path.join(__dirname, '..', 'wingman.html');
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB');
