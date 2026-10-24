// Baut aus src/ und recht/ eine einzelne Datei public/index.html
// Karte: MapLibre + OpenFreeMap, gratis und ohne Schlüssel. MAP_STYLE_URL kann optional einen anderen Kartenstil setzen.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const legal = {};
for (const f of fs.readdirSync(path.join(root, 'recht'))) legal[f.replace('.md', '')] = fs.readFileSync(path.join(root, 'recht', f), 'utf8');
const config = { mapStyle: process.env.MAP_STYLE_URL || '' };
const safe = o => JSON.stringify(o).replace(/</g, '\\u003c');
let body = fs.readFileSync(path.join(root, 'src/app.src.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
body = body
  .replace('/*__LEGAL__*/{}', () => safe(legal))
  .replace('/*__CONFIG__*/{}', () => safe(config))
  .replace('/*__APPJS__*/', () => js);
const html = '<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#08090b">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'public/index.html'), html);
// Artifact-Vorschau ohne Doctype-Gerüst
if (process.argv.includes('--preview')) fs.writeFileSync(path.join(root, 'preview.html'), body);
console.log('public/index.html', html.length, 'bytes');
