// Baut aus src/ und recht/ eine einzelne Datei public/index.html
const fs = require('fs');
const path = require('path');
const root = __dirname;
const legal = {};
for (const f of fs.readdirSync(path.join(root, 'recht'))) legal[f.replace('.md', '')] = fs.readFileSync(path.join(root, 'recht', f), 'utf8');
let body = fs.readFileSync(path.join(root, 'src/app.src.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
body = body.replace('/*__LEGAL__*/{}', JSON.stringify(legal).replace(/<\//g, '<\\/')).replace('/*__APPJS__*/', () => js);
const html = '<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#14161b">\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'public/index.html'), html);
console.log('public/index.html', html.length, 'bytes');
