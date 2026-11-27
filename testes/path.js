/* Health Path: testes (celular e computador). Uso: NODE_PATH=$(npm root -g) node testes/path.js */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const { subir } = require('./servidor.js');
let ok = 0; const falhas = [];
const verdade = (c, m) => { if (c) { ok++; console.log('  ✔ ' + m); } else { falhas.push(m); console.log('  ✘ ' + m); } };
const igual = (a, b, m) => { const c = JSON.stringify(a) === JSON.stringify(b); if (c) { ok++; console.log('  ✔ ' + m); } else { falhas.push(m); console.log('  ✘ ' + m + '\n      esperado: ' + JSON.stringify(b) + '\n      recebido: ' + JSON.stringify(a)); } };
const enc = coords => { let lat = 0, lon = 0, s = ''; const c = v => { v = v < 0 ? ~(v << 1) : v << 1; let o = ''; while (v >= 32) { o += String.fromCharCode((32 | (v & 31)) + 63); v >>= 5; } return o + String.fromCharCode(v + 63); }; for (const [x, y] of coords) { const la = Math.round(y * 1e6), lo = Math.round(x * 1e6); s += c(la - lat) + c(lo - lon); lat = la; lon = lo; } return s; };
(async () => {
  const srv = await subir(path.join(__dirname, '..'), 8123);
  const b = await chromium.launch();
  const pedidos = [], pedidosOsrm = []; let osrmFora = false;
  const rotear = async ctx => {
    await ctx.route('https://valhalla1.openstreetmap.de/**', async r => {
      const rq = r.request(); if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      const c = JSON.parse(rq.postData()); pedidos.push(c);
      const [A, B] = c.locations, ida = A.lat > B.lat || A.lon < B.lon;   // só para distinguir os sentidos no teste
      const forma = [[A.lon, A.lat], [(A.lon + B.lon) / 2 + 0.05, (A.lat + B.lat) / 2 - 0.03], [B.lon, B.lat]];
      const trip = (km, min) => ({ legs: [{ shape: enc(forma) }], summary: { length: km, time: min * 60 } });
      if (!c.costing_options.auto.shortest) return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify({ trip: trip(95, 60) }) });   // rota mais rápida: 60 min
      const volta = A.lon < B.lon;   // Araraquara (lon maior) → Bauru é a ida
      const corpo = volta ? { trip: trip(91.1, 80), alternates: [] } : { trip: trip(100.4, 90), alternates: [{ trip: trip(90.2, 95) }] };
      r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
    });
    await ctx.route('https://routing.openstreetmap.de/**', r => { pedidosOsrm.push(r.request().url()); if (osrmFora) return r.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: '{}' }); r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify({ code: 'Ok', routes: [{ distance: 95000, duration: 3000 }] }) }); });
  };
  /* ---------- computador ---------- */
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await rotear(ctx);
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) erros.push(m.text()); });
  await p.goto('http://localhost:8123/path/index.html');
  await p.waitForFunction(() => window.HP && HP.achar('arar').length > 0);
  console.log('\nHealth Path (computador)');
  verdade(/Health Path/.test(await p.title()), 'a página se chama Health Path');
  verdade(await p.evaluate(() => document.activeElement.id === 'in-a'), 'o cursor já está na cidade inicial');
  await p.keyboard.type('araraq'); verdade(await p.locator('#sug-a li').count() >= 1, 'digitando, aparecem as cidades (sem acento e sem maiúscula)');
  await p.keyboard.press('Enter');
  igual(await p.inputValue('#in-a'), 'Araraquara/SP', 'Enter escolhe a primeira sugestão');
  verdade(await p.evaluate(() => document.activeElement.id === 'in-b'), 'e o cursor pula para a cidade final');
  await p.keyboard.type('Baur'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter');
  verdade(/^Bauru\/SP$/.test(await p.inputValue('#in-b')), 'cidade final escolhida (Bauru/SP)');
  await p.click('#bt-calc');
  await p.waitForSelector('#res:not([hidden])');
  igual(await p.innerText('#res-total'), '190,0', 'modo padrão "Como o Google Maps": km = média dos dois serviços de rota pela rota mais rápida (95 + 95)');
  await p.click('[data-modo="curto"]'); await p.waitForFunction(() => document.querySelector('#res-total').textContent === '181,3');
  verdade(true, 'modo "Mais curto": 181,3 km (90,2 + 91,1), o caminho mais CURTO entre as alternativas');
  igual([await p.innerText('#res-ida'), await p.innerText('#res-volta')], ['90,2 km', '91,1 km'], 'ida e volta separadas');
  igual([await p.innerText('#res-tempo'), await p.innerText('#res-ida-t')], ['1 h 50 min', '55 min de carro'], 'tempo em carro = média de dois serviços de rota pela rota mais rápida (Valhalla 60 min e OSRM 50 min → 55 min por sentido), separado do caminho mais curto dos km');
  verdade(await p.locator('#res-mapa svg path').count() >= 2 && /Araraquara/.test(await p.innerText('#res-mapa')), 'desenho do caminho com os nomes das cidades');
  const curtos = pedidos.filter(c => c.costing_options.auto.shortest); verdade(curtos.length === 2 && curtos.every(c => c.alternates === 2) && pedidos.some(c => !c.costing_options.auto.shortest), 'no modo "Mais curto": ida e volta pelo caminho mais curto (km) e, à parte, a rota mais rápida (tempo)');
  verdade(curtos[0].locations[0].lon !== curtos[1].locations[0].lon, 'a volta é pedida de Bauru para Araraquara');
  verdade(JSON.stringify(pedidos).match(/Araraquara|Bauru/i) === null, 'só coordenadas das sedes vão para o serviço de rotas (nenhum nome/dado a mais)');
  verdade(/1 h 50 min de carro/.test(await p.evaluate(() => HP.textoCopia())), 'o texto copiado inclui o tempo em carro');
  await p.click('#bt-copiar');
  verdade(/181,3 km/.test(await p.evaluate(() => navigator.clipboard.readText())), 'copiar resultado coloca o texto na área de transferência');
  verdade(await p.locator('#rec-lista button').count() === 1, 'a consulta fica em "Recentes"');
  const n0 = pedidos.length; await p.click('#bt-calc'); await p.waitForFunction(n => window.__p === undefined, n0); await p.waitForTimeout(600);
  verdade(pedidos.length > n0, 'o app precisa de rede: repetir a consulta pesquisa na rede de novo (nada fica guardado)');
  await p.context().setOffline(true);
  await p.click('#bt-calc');
  verdade(/Sem internet/.test(await p.innerText('#erro')) && await p.locator('#aviso-rede:visible').count() === 1, 'sem internet: avisa que precisa de rede e não calcula');
  await p.context().setOffline(false); await p.waitForFunction(() => document.querySelector('#aviso-rede').hidden);
  await p.click('#bt-troca'); igual([await p.inputValue('#in-a'), await p.inputValue('#in-b')], ['Bauru/SP', 'Araraquara/SP'], 'o botão ⇅ inverte as cidades');
  await p.click('#bt-novo'); igual(await p.inputValue('#in-a'), '', 'Nova consulta limpa os campos');
  osrmFora = true; await p.fill('#in-a', 'Jaú/SP'); await p.press('#in-a', 'Enter'); await p.fill('#in-b', 'Bauru/SP'); await p.press('#in-b', 'Enter'); await p.click('#bt-calc');
  await p.waitForFunction(() => /1 h 00 min de carro/.test(document.querySelector('#res-ida-t').textContent));
  verdade(true, 'se um dos serviços de tempo não responder, usa só o outro (sem travar)'); osrmFora = false;
  await p.fill('#in-a', 'Bauru'); await p.fill('#in-b', 'Bauru'); await p.click('#bt-calc');
  verdade(/mesma/.test(await p.innerText('#erro')), 'mesma cidade nas duas pontas: avisa');
  await p.fill('#in-b', 'xyzxyz'); await p.click('#bt-calc');
  verdade(/Escolha a cidade final/.test(await p.innerText('#erro')), 'texto que não é cidade: pede para escolher da lista');
  await p.fill('#in-a', ''); await p.fill('#in-b', ''); await p.click('#bt-calc');
  verdade(/Digite a cidade inicial/.test(await p.innerText('#erro')), 'campo vazio: avisa');
  verdade(await p.locator('#bt-instalar:visible').count() === 1 && !(await p.evaluate(() => document.querySelector('#bt-instalar').classList.contains('instalado'))), 'o botão Instalar fica sempre visível (ativo antes de instalar)');
  await p.evaluate(() => window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt() { window.__prompt = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) })));
  await p.click('#bt-instalar'); await p.waitForFunction(() => document.querySelector('#bt-instalar').classList.contains('instalado'));
  verdade(await p.evaluate(() => window.__prompt === true && /Instalado/.test(document.querySelector('#bt-instalar').innerText) && getComputedStyle(document.querySelector('#bt-instalar')).filter.includes('grayscale')), 'ao instalar, o botão fica cinza e escrito "Instalado"');
  const t0 = await p.evaluate(() => document.documentElement.dataset.tema); await p.click('#bt-tema');
  verdade(await p.evaluate(t => document.documentElement.dataset.tema !== t && localStorage.getItem('hp:tema') !== null, t0), 'o botão ◐ troca o tema e lembra a escolha');
  const man = await p.evaluate(() => fetch('manifest.webmanifest').then(r => r.json()));
  verdade(man.name === 'Health Path' && man.display === 'standalone' && man.icons.length === 3, 'manifest de aplicativo instalável (nome, standalone e 3 ícones)');
  for (const i of man.icons) verdade((await p.evaluate(s => fetch(s).then(r => r.status), i.src)) === 200, 'ícone ' + i.sizes + ' ' + i.purpose + ' existe');
  await p.waitForFunction(() => navigator.serviceWorker.getRegistration().then(r => !!r), null, { timeout: 8000 }).catch(() => {});
  verdade(await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r)), 'service worker registrado (abre sem internet)');
  verdade(erros.length === 0, 'nenhum erro de JavaScript/CSP' + (erros.length ? ': ' + erros[0] : ''));
  /* telas para conferir o visual */
  const esc = '/tmp/claude-0/-home-user/e29cec66-ee3f-5752-bd59-92a5e47fd4bc/scratchpad/';
  await p.evaluate(() => localStorage.setItem('hp:tema', '"escuro"')); await p.reload(); await p.waitForFunction(() => window.HP && HP.achar('arar').length > 0);
  await p.fill('#in-a', 'Araraquara'); await p.press('#in-a', 'Enter'); await p.fill('#in-b', 'Bauru'); await p.press('#in-b', 'Enter'); await p.click('#bt-calc'); await p.waitForSelector('#res:not([hidden])'); await p.waitForTimeout(500);
  await p.screenshot({ path: esc + 'hp_pc_escuro.png', fullPage: true });
  await p.evaluate(() => document.getElementById('bt-tema').click()); await p.waitForTimeout(200); await p.screenshot({ path: esc + 'hp_pc_claro.png', fullPage: true });
  /* ---------- celular ---------- */
  const cm = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await rotear(cm);
  const m = await cm.newPage(); await m.goto('http://localhost:8123/path/index.html'); await m.waitForFunction(() => window.HP && HP.achar('arar').length > 0);
  console.log('\nHealth Path (celular)');
  await m.fill('#in-a', 'Araraq'); await m.waitForSelector('#sug-a li'); await m.tap('#sug-a li >> nth=0');
  await m.fill('#in-b', 'Bauru'); await m.waitForSelector('#sug-b li'); await m.tap('#sug-b li >> nth=0');
  await m.screenshot({ path: esc + 'hp_cel_form.png' });
  await m.tap('#bt-calc'); await m.waitForSelector('#res:not([hidden])'); await m.waitForTimeout(500);
  igual(await m.innerText('#res-total'), '190,0', 'no celular: toque nas sugestões e um toque no botão dá o resultado');
  verdade(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sem rolagem lateral no celular');
  verdade(await m.evaluate(() => [...document.querySelectorAll('button')].filter(b => !b.hidden && b.offsetHeight).every(b => b.offsetHeight >= 38)), 'botões com tamanho bom para o toque');
  await m.screenshot({ path: esc + 'hp_cel_res.png', fullPage: true });
  /* ---------- arquivo único ---------- */
  console.log('\nHealth-Path.html (arquivo único)');
  const cf = await b.newContext({ viewport: { width: 420, height: 800 } }); await rotear(cf);
  const f = await cf.newPage(); const ef = []; f.on('pageerror', e => ef.push(e.message));
  await f.goto('file://' + path.join(__dirname, '..', 'path', 'Health-Path.html')); await f.waitForFunction(() => window.HP && HP.achar('arar').length > 0);
  await f.fill('#in-a', 'Araraquara'); await f.press('#in-a', 'Enter'); await f.fill('#in-b', 'Bauru'); await f.press('#in-b', 'Enter'); await f.click('#bt-calc'); await f.waitForSelector('#res:not([hidden])');
  igual(await f.innerText('#res-total'), '190,0', 'o arquivo único funciona sozinho (duplo clique), com as cidades dentro');
  verdade(ef.length === 0, 'sem erros no arquivo único');
  await b.close(); srv.close();
  console.log('\n' + (falhas.length ? 'FALHOU: ' + falhas.length + ' — ' + falhas.join(' | ') : 'OK: todos os ' + ok + ' testes passaram'));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
