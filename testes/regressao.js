/* Testes de regressão do Health Route (navegador real + dados sintéticos).
   Rodar:  node testes/regressao.js   (precisa do Playwright; no ambiente do Claude: NODE_PATH=$(npm root -g)) */
const path = require('path');
const { chromium } = require('playwright');
const { subir } = require('./servidor.js');
const amostra = require('./amostra.js');

const PORTA = 8097, URL = 'http://localhost:' + PORTA + '/';
let ok = 0, falhas = [];
function igual(real, esperado, nome) {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a === b) { ok++; console.log('  ✔', nome); } else { falhas.push(nome); console.log('  ✘', nome, '\n      esperado:', b, '\n      recebido:', a); }
}
const verdade = (c, nome) => igual(!!c, true, nome);
const cents = s => Math.round(parseFloat(s) * 100);

(async () => {
  const srv = await subir(path.join(__dirname, '..'), PORTA);
  const browser = await chromium.launch();
  const erros = [];
  const novaPagina = async (opts) => {
    const ctx = await browser.newContext(Object.assign({ reducedMotion: 'reduce', viewport: { width: 1440, height: 860 }, acceptDownloads: true }, opts || {}));
    const p = await ctx.newPage();
    p.on('pageerror', e => erros.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
    return { ctx, p };
  };
  const abrir = async p => { await p.goto(URL); await p.waitForFunction(() => window.RT && RT.pronto, null, { timeout: 20000 }); };
  const estado = p => p.evaluate(() => ({ rev: RT.S.op && RT.S.op.rev, atrib: RT.S.op && RT.S.op.atrib, carros: RT.S.op && RT.S.op.carros.map(c => c.id), cont: RT.S.res && RT.S.res.cont, nnotas: RT.S.op && RT.S.op.notas.length }));

  const { ctx, p } = await novaPagina();
  await abrir(p);

  console.log('\nNúmeros exatos');
  const d = await p.evaluate(() => {
    const D = RT.N.dec;
    return [D('812.16', 2).v, D('1.234,56', 2).v, D('1234,56', 2).v, D('8.3160', 4).v, D('0.125', 2).v, D('0.124', 2).v, D('', 2).ok, D('abc', 2).ok, D('19422.1050', 4).v, D('0.1', 2).v];
  });
  igual(d, [81216, 123456, 123456, 83160, 13, 12, false, false, 194221050, 10], 'decimais em centavos/peso sem float');
  const n = await p.evaluate(() => [RT.N.norm('Açaí  São José'), RT.N.normCidade("SANTA BÁRBARA D'OESTE"), RT.N.municipio("SANTA BARBARA D OESTE", 'sp') && RT.N.municipio("SANTA BARBARA D OESTE", 'sp').nome]);
  igual(n, ['ACAI SAO JOSE', 'SANTA BARBARA D OESTE', "Santa Bárbara d'Oeste"], 'normalização de nomes e cidades com apóstrofo');

  console.log('\nImportação (pré-visualização)');
  await p.click('#mural-x');
  await p.click('.nav button[data-tela="importar"]');
  await p.setInputFiles('#arq', [
    { name: 'A.XML', mimeType: 'text/xml', buffer: amostra.A },
    { name: 'B.XML', mimeType: 'text/xml', buffer: amostra.B },
    { name: 'LIXO.XML', mimeType: 'text/xml', buffer: amostra.INVALIDO }
  ]);
  await p.waitForSelector('#lote-ok');
  const lin = await p.$$eval('#lote tbody tr', trs => trs.map(t => [...t.children].map(c => c.innerText.trim())));
  igual(lin[0].slice(0, 6), ['A.XML', '11', '11', '0', '0', '0'], 'A.XML: 11 linhas, 11 novas');
  igual(lin[1].slice(0, 6), ['B.XML', '4', '2', '1', '1', '1'], 'B.XML: 2 novas, 1 repetida, 1 conflito, 1 linha de total ignorada');
  verdade(/erro/.test(lin[2][2] + lin[2][1]) || /Cabeçalho|cabeçalho/.test(lin[2][6]), 'arquivo que não é da SoftLog vira erro explícito');
  verdade(await p.isDisabled('#lote-ok') === false, 'botão de importar habilitado');
  const resumo = await p.innerText('#lote .acao > div');
  verdade(/13 nota/.test(resumo), 'resumo: 13 notas novas (' + resumo.replace(/\n/g, ' ') + ')');

  await p.fill('#op-nome', 'Operação de teste');
  await p.click('#lote-ok');
  await p.waitForFunction(() => RT.S.op && RT.S.op.notas.length === 13);

  console.log('\nTotais da operação');
  const todas = [...amostra.linhasA, ...amostra.linhasB.slice(2, 3), ...amostra.linhasB.slice(4)];
  const vol = todas.reduce((s, l) => s + Number(l[11]), 0), val = todas.reduce((s, l) => s + cents(l[13]), 0);
  const peso = todas.reduce((s, l) => s + (l[12] ? Math.round(parseFloat(l[12]) * 10000) : 0), 0);
  const tot = await p.evaluate(() => RT.S.res.tot);
  igual(tot, { notas: 13, vol, peso, valor: val }, 'notas/volumes/peso/valor = soma independente dos dados de entrada');
  const geo = await p.evaluate(() => ({ cidades: RT.S.res.cidades.length, semPos: RT.S.res.cidadesSemPosicao, paradas: RT.N.paradasTotais(RT.S.op, RT.S.idx), acentos: RT.S.op.notas.some(n => n.cliente === 'FARMÁCIA AÇAÍ LTDA') }));
  igual(geo, { cidades: 4, semPos: 1, paradas: 9, acentos: true }, '4 cidades (1 sem posição), 9 paradas, acentos ISO-8859-1 preservados');
  const arq = await p.evaluate(() => RT.S.op.arquivos.map(a => [a.nome, a.notas]));
  igual(arq, [['A.XML', 11], ['B.XML', 4]], 'arquivos de origem registrados (o inválido não)');
  const origem = await p.evaluate(() => RT.S.op.notas.find(n => n.nf === '000001012') && RT.S.op.notas.find(n => n.nf === '000001012').origem);
  igual(origem, 'B.XML', 'cada nota guarda o arquivo de origem');

  console.log('\nMontar rotas: cidade → clientes → notas');
  await p.fill('#busca-cidade', 'araraq'); await p.keyboard.press('Enter');
  await p.waitForSelector('#jan-cid:not([hidden]) .cli');
  igual(await p.$$eval('#jan-cid .cli', e => e.length), 4, 'janela da cidade lista os 4 clientes de Araraquara');
  igual((await estado(p)).carros, [1], 'Carro 1 criado automaticamente ao abrir a primeira cidade');
  await p.locator('.cli', { hasText: 'CLINICA ALFA' }).locator('.cli-nome').click();
  igual(await p.locator('.cli', { hasText: 'CLINICA ALFA' }).locator('.cl-chk').isChecked(), true, 'clicar no cliente marca a caixinha');
  igual(Object.keys((await estado(p)).atrib).length, 0, 'marcar NÃO grava nada antes de Concluir');
  await p.click('[data-a=concluir]');
  let e = await estado(p);
  igual(Object.keys(e.atrib).sort(), ['k:' + '1001'.padStart(44, '0'), 'k:' + '1002'.padStart(44, '0')], 'Concluir leva as 2 notas do cliente para o Carro 1');
  igual(e.cont, { pendente: 3, parcial: 1, completa: 0 }, 'Araraquara fica parcial (falta nota) e as outras seguem pendentes');
  igual(await p.isHidden('#jan-cid'), true, 'janela fecha ao concluir');
  igual(await p.innerText('#qt-pend'), '4', 'selo de cidades pendentes no menu');

  console.log('\nExpandir e escolher só algumas notas do cliente');
  await p.fill('#busca-cidade', 'araraq'); await p.keyboard.press('Enter');
  await p.waitForSelector('#jan-cid:not([hidden]) .cli');
  const alfa = p.locator('.cli', { hasText: 'CLINICA ALFA' });
  igual(await alfa.evaluate(el => el.classList.contains('meu')), true, 'cliente já no carro aparece marcado');
  await alfa.locator('.cli-exp').click();
  igual(await p.$$eval('#jan-cid .nt', x => x.length), 2, 'seta expande as 2 notas');
  await p.locator('.nt', { hasText: 'NF 000001002' }).locator('.nt-chk').uncheck();
  await p.click('[data-a=concluir]');
  e = await estado(p);
  igual(Object.keys(e.atrib), ['k:' + '1001'.padStart(44, '0')], 'desmarcar uma nota e concluir devolve só ela (cliente fica parcial)');

  console.log('\nDois carros na mesma cidade (notas caras num, baratas no outro)');
  await p.click('#bt-novo-carro');
  await p.fill('#busca-cidade', 'araraq'); await p.keyboard.press('Enter');
  await p.waitForSelector('#jan-cid:not([hidden]) .cli');
  await p.click('.mini-car[data-car="2"]');
  igual(await p.locator('.cli', { hasText: 'CLINICA ALFA' }).locator('.chip-pos').first().innerText(), 'Carro 1', 'nota que já está no Carro 1 mostra a etiqueta do carro');
  igual(await p.$eval('#jc-todos', el => el.checked), false, 'nenhuma nota marcada para o Carro 2 ainda');
  await p.selectOption('#jc-ordem', 'maior');
  igual(await p.$$eval('#jan-cid .cli-nome b', b => b[0].childNodes[0].textContent.trim()), 'FARMÁCIA AÇAÍ LTDA', 'ordenar por maior valor põe o cliente mais caro primeiro');
  await p.click('#jc-todos');
  await p.click('[data-a=concluir]');
  e = await estado(p);
  igual(e.cont, { pendente: 3, parcial: 0, completa: 1 }, 'todas as notas de Araraquara em carros → cidade completa');
  const pc = await p.evaluate(() => RT.S.res.cidades.find(c => c.cidade.nome === 'Araraquara').porCarro.size);
  igual(pc, 2, 'cidade completa dividida entre 2 carros');
  igual(Object.keys(e.atrib).length, 6, '6 notas alocadas');

  console.log('\nCinza = já está em outro carro; liberar e desfazer');
  await p.click('.chip-carro[data-id="1"]');
  await p.fill('#busca-cidade', 'araraq'); await p.keyboard.press('Enter');
  await p.waitForSelector('#jan-cid:not([hidden]) .cli');
  const gama = p.locator('.cli', { hasText: 'HOSPITAL GAMA' });
  igual(await gama.evaluate(el => el.classList.contains('cinza')), true, 'cliente que está inteiro em outro carro fica cinza');
  igual(await gama.locator('.cl-chk').isDisabled(), true, 'e a caixinha fica desabilitada');
  await gama.locator('[data-libc]').click();
  igual(Object.keys((await estado(p)).atrib).length, 4, 'liberar tira as 2 notas do cliente do outro carro');
  igual((await estado(p)).cont.parcial, 1, 'cidade volta a ficar com "falta nota"');
  await p.keyboard.press('Escape');
  await p.click('#bt-desfazer');
  igual(Object.keys((await estado(p)).atrib).length, 6, 'Desfazer devolve as notas ao Carro 2');
  igual((await estado(p)).cont.completa, 1, 'e a cidade volta a completa');

  console.log('\nMapa');
  await p.click('.nav button[data-tela="rotas"]');
  await p.click('#bt-enquadrar'); await p.waitForTimeout(150);
  const pos = await p.evaluate(() => { const q = RT.S.mapa.posicaoDaCidade('JAU|SP'); const r = document.querySelector('.mapa-cv').getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y }; });
  await p.mouse.click(pos.x, pos.y);
  await p.waitForSelector('#jan-cid:not([hidden])');
  igual(await p.innerText('#jan-cid .jan-cab b'), 'Jaú SP', 'clicar no marcador da cidade no mapa abre a janela');
  await p.keyboard.press('Escape');
  igual(await p.evaluate(() => RT.S.mapa.cidades.length), 3, 'mapa desenha só cidades com posição (a sem posição fica de fora)');
  const sp = await p.locator('#pend-lista li', { hasText: 'LUGAR QUE NAO EXISTE' }).innerText();
  verdade(/sem posição no mapa/.test(sp), 'cidade sem posição continua na lista de pendentes, avisada');
  await p.locator('#pend-lista li', { hasText: 'LUGAR QUE NAO EXISTE' }).click();
  await p.waitForSelector('#jan-cid:not([hidden]) .cli');
  verdade(true, 'e dá para abrir e alocar mesmo sem posição');
  await p.keyboard.press('Escape');

  console.log('\nNotas e folha');
  await p.click('.nav button[data-tela="notas"]');
  await p.fill('#n-busca', 'acai');
  igual(await p.$$eval('#n-tabela tbody tr', t => t.length), 1, 'busca ignora acento (açaí = acai)');
  await p.fill('#n-busca', '');
  await p.selectOption('#n-carro', 'livre');
  igual(await p.$$eval('#n-tabela tbody tr', t => t.length), 7, 'filtro "sem carro" mostra as 7 notas livres');
  await p.click('.nav button[data-tela="folha"]');
  const folha = await p.innerText('#folha');
  verdade(/ROTA/.test(folha) && /CARRO 1/.test(folha) && /CARRO 2/.test(folha), 'folha mostra os dois carros');
  verdade(/faltam 7 nota/.test(await p.innerText('.folha-aviso')), 'folha avisa que está incompleta (7 notas sem carro)');
  const soma = await p.evaluate(() => RT.S.res.carros.reduce((s, c) => s + c.valor, 0));
  igual(soma, (await p.evaluate(() => RT.S.res.aloc.valor)), 'soma dos carros = valor alocado');

  console.log('\nPersistência (fechar e reabrir)');
  const antes = await estado(p);
  await p.reload(); await p.waitForFunction(() => window.RT && RT.pronto);
  const depois = await estado(p);
  igual(depois, antes, 'a operação volta idêntica depois de recarregar (notas, carros, alocações, revisão)');

  console.log('\nExcluir carro e cópia de segurança');
  await p.click('#mural-x');
  await p.hover('.chip-carro[data-id="2"]');
  await p.click('.chip-carro[data-id="2"] [data-ac=del]');
  await p.click('.fundo [data-s]');
  await p.waitForFunction(() => RT.S.op.carros.length === 1);
  igual((await estado(p)).cont.completa, 0, 'excluir o carro devolve as notas dele (nenhuma cidade completa)');
  const bks = await p.evaluate(() => RT.DB.todos('bk').then(x => x.map(b => b.motivo)));
  verdade(bks.some(m => /excluir o Carro 2/.test(m)), 'cópia de segurança guardada ANTES de excluir o carro');
  await p.click('#bt-desfazer');
  igual((await estado(p)).carros, [1, 2], 'desfazer traz o carro de volta');

  console.log('\nReimportar o mesmo arquivo não duplica');
  await p.click('.nav button[data-tela="importar"]');
  await p.setInputFiles('#arq', [{ name: 'A.XML', mimeType: 'text/xml', buffer: amostra.A }]);
  await p.waitForSelector('#lote-ok');
  igual(await p.isDisabled('#lote-ok'), true, 'importar de novo: 0 notas novas, botão desabilitado');
  verdade(/já foi importado/.test(await p.innerText('#lote')), 'e avisa que o mesmo arquivo já entrou');
  await p.click('#lote-cancelar');

  console.log('\nOperações guardadas');
  verdade((await p.innerText('#lista-ops')).includes('Operação de teste'), 'operação aparece na lista');
  const dl = p.waitForEvent('download');
  await p.click('[data-op-baixar]');
  const arqBk = await dl.then(d => d.suggestedFilename());
  verdade(/^health-route-.*\.json$/.test(arqBk), 'baixar cópia gera arquivo .json (' + arqBk + ')');

  await ctx.close();

  console.log('\nAbertura animada (igual à do Health Search)');
  const c2 = await novaPagina({ reducedMotion: 'no-preference' });
  await c2.p.goto(URL);
  await c2.p.waitForSelector('#hs-cine', { timeout: 3000 });
  verdade(await c2.p.evaluate(() => document.querySelectorAll('#hs-cine .hc-nome i').length === 13), 'animação "Health Search" presente');
  verdade(await c2.p.evaluate(() => !document.getElementById('mural').hidden), 'mural já está por trás da animação');
  await c2.p.waitForSelector('#hs-cine', { state: 'detached', timeout: 9000 });
  verdade(true, 'animação termina sozinha e revela o mural');
  await c2.ctx.close();

  console.log('\nCelular (390px)');
  const c3 = await novaPagina({ viewport: { width: 390, height: 780 } });
  await abrir(c3.p);
  await c3.p.click('#mural-x');
  igual(await c3.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'sem rolagem horizontal da página');
  await c3.ctx.close();

  console.log('\nErros no console');
  igual(erros, [], 'nenhum erro de JavaScript durante todos os testes');

  await browser.close(); srv.close();
  console.log('\n' + (falhas.length ? 'FALHOU: ' + falhas.length + ' teste(s) — ' + falhas.join(' | ') : 'OK: todos os ' + ok + ' testes passaram'));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
