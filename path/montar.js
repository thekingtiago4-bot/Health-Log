/* Monta o Health-Path.html: UM arquivo só (tudo dentro: visual, fontes, cidades e código). Dá para salvar, abrir com duplo clique e mandar por WhatsApp/e-mail.
   Uso: node path/montar.js */
const fs = require('fs'), path = require('path');
const dir = __dirname, raiz = path.join(dir, '..');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(dir, 'path.css'), 'utf8');
css = css.replace(/url\(fonts\/([^)]+)\)/g, (_, f) => 'url(data:font/woff2;base64,' + fs.readFileSync(path.join(dir, 'fonts', f)).toString('base64') + ')');
const js = fs.readFileSync(path.join(dir, 'path.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const mun = JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, 'data', 'municipios.json'), 'utf8')));
const svg = fs.readFileSync(path.join(dir, 'icons', 'icone.svg'), 'utf8');
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '')
  .replace(/<link rel="manifest"[^>]*>\n?/, '')
  .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') + '">')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
  .replace('<link rel="stylesheet" href="path.css">', '<style>' + css + '</style>')
  .replace('<script src="path.js"></script>', '<script>window.__MUN=' + mun + ';</script>\n<script>' + js + '</script>');
fs.writeFileSync(path.join(dir, 'Health-Path.html'), html);
console.log('Health-Path.html', Math.round(html.length / 1024) + ' KB');
