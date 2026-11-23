/* Health Route · aplicação (telas, estado, gravação). */
(function () {
  'use strict';
  const { N, U, DB } = RT;
  const { $, $$, esc, toast } = U;
  const VERSAO = '0.15.1';
  const cmp = (a, b) => String(a).localeCompare(String(b), 'pt-BR');
  const m$ = N.fmtMoeda, i$ = N.fmtInt;

  const S = RT.S = {
    op: null, idx: null, res: null, carroAtivo: null,
    cidadeAberta: null, ordemCar: 'nome', janFoco: null, draft: new Set(), draft0: new Set(), expand: new Set(), ordemCli: 'nome',
    hist: [], mapa: null, precisaEnquadrar: true, lote: null, destino: 'atual',
    nf: { q: '', carro: '', origem: '', ord: 'nf', dir: 1 },
    canal: null, ext: null, parede: false, modoMapa: /[?&]mapa=1/.test(location.search),
    fila: Promise.resolve(), ultimoSalvo: null, ultimoBackup: null, pend: { q: '', ordem: 'nome', mostrarTodas: false }
  };

  /* ================= estado, histórico e gravação ================= */
  function reindexar() {
    if (!S.op) { S.idx = null; S.res = null; return; }
    S.idx = N.indexar(S.op); S.res = N.resumo(S.op, S.idx);
  }
  const carroPorId = id => (S.op ? S.op.carros.find(c => c.id === id) : null) || null;
  const nomeId = id => { const c = carroPorId(id); return c ? N.nomeCarro(c) : 'Veículo ?'; };
  const corDe = id => { const c = carroPorId(id); return c ? c.cor : '#888'; };

  function empurrarHist(rotulo) {
    S.hist.push({ rotulo, snap: JSON.stringify({ atrib: S.op.atrib, carros: S.op.carros, proxCarro: S.op.proxCarro, status: S.op.status || {}, agIgnorar: S.op.agIgnorar || {} }) });
    if (S.hist.length > 60) S.hist.shift();
  }
  function mutar(rotulo, fn) {
    empurrarHist(rotulo); fn(); S.op.rev++;
    reindexar(); salvar(); atualizarTudo();
  }
  function desfazer() {
    if (!S.op) return;
    const h = S.hist.pop();
    if (!h) { toast('Não há nada para desfazer.'); return; }
    const s = JSON.parse(h.snap);
    S.op.atrib = s.atrib; S.op.carros = s.carros; S.op.proxCarro = s.proxCarro; S.op.status = s.status || {}; S.op.agIgnorar = s.agIgnorar || {}; S.op.rev++;
    if (!carroPorId(S.carroAtivo)) S.carroAtivo = S.op.carros.length ? S.op.carros[0].id : null;
    reindexar(); resetDraft(); salvar(); atualizarTudo();
    toast('Desfeito: ' + h.rotulo);
  }

  function statusSalvo(tipo, msg) {
    const el = $('#r-salvo'), box = el.parentElement;
    box.classList.toggle('erro', tipo === 'erro');
    const fe = $('#faixa-erro');
    if (tipo === 'ok') {
      el.textContent = 'Salvo às ' + S.ultimoSalvo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      fe.hidden = true;
    } else if (tipo === 'salvando') el.textContent = 'Salvando…';
    else if (tipo === 'sem') el.textContent = 'Sem operação aberta';
    else {
      el.textContent = 'NÃO salvou';
      fe.hidden = false;
      fe.textContent = '⚠ Não consegui salvar neste navegador: ' + msg + ' — baixe uma cópia (Importar XML → Operações guardadas) para não perder o trabalho.';
    }
  }
  function salvar() {
    if (!S.op || S.modoMapa) return Promise.resolve();
    if (!DB.db) { statusSalvo('erro', DB.erro || 'banco indisponível'); return Promise.resolve(); }
    statusSalvo('salvando'); S.sujo = true;
    const copia = structuredClone(S.op);
    S.fila = S.fila
      .then(() => DB.put('ops', copia))
      .then(() => DB.put('meta', { k: 'ativa', id: copia.id }))
      .then(() => { S.ultimoSalvo = new Date(); S.sujo = false; statusSalvo('ok'); enviar({ t: 'op', id: copia.id, rev: copia.rev }); })
      .catch(e => statusSalvo('erro', (e && e.message) || String(e)));
    return S.fila;
  }
  /* botão Salvar (igual ao do Health Search): grava agora, espera terminar e deixa cópia de segurança */
  async function salvarAgora() {
    if (!S.op) { toast('Não há operação aberta para salvar.'); return; }
    await salvar(); await S.fila;
    if (S.sujo || !(await backup(S.op, 'Salvar'))) { toast('⚠ Não consegui salvar. Baixe uma cópia em Importar XML → Operações guardadas.'); return; }
    toast('✓ Tudo salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' (com cópia de segurança).');
  }
  window.addEventListener('beforeunload', e => { if (window.__hsRecarregando) return; if (S.sujo || (DB.erro && S.op)) { e.preventDefault(); e.returnValue = ''; } });
  /* menu lateral que esconde, e instalar o aplicativo */
  function ligarLateral() {
    const app = $('#app'), seta = $('#bt-rail');
    const aplicar = (oculta, grava) => { app.classList.toggle('rail-oculta', oculta); seta.textContent = oculta ? '›' : '‹'; seta.setAttribute('aria-expanded', String(!oculta)); seta.setAttribute('aria-label', oculta ? 'Mostrar o menu lateral' : 'Esconder o menu lateral'); if (grava) U.pref.gravar('railOculta', oculta); setTimeout(() => { window.dispatchEvent(new Event('resize')); if (S.mapa) { S.mapa.redimensionar(); S.mapa.marcar(); } }, 60); };
    seta.onclick = () => aplicar(!app.classList.contains('rail-oculta'), true);
    aplicar(!!U.pref.ler('railOculta', false), false);
    $('#bt-salvar').onclick = salvarAgora;
    let evt = null; const bi = $('#bt-instalar');
    const instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (!instalado()) bi.hidden = false;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evt = e; bi.hidden = false; });
    window.addEventListener('appinstalled', () => { bi.hidden = true; toast('Health LOG instalado.'); });
    bi.onclick = async () => {
      if (evt) { evt.prompt(); try { await evt.userChoice; } catch (er) { /* ok */ } evt = null; return; }
      U.modal('<h2>Instalar o Health LOG</h2><p><b>Computador (Chrome ou Edge):</b> clique no ícone de instalar (um monitor com seta) no fim da barra de endereço, ou no menu ⋮ → “Instalar Health LOG”. O ícone da bússola vai para a área de trabalho.</p><p><b>iPhone / iPad (Safari):</b> botão Compartilhar → “Adicionar à Tela de Início”.</p><p><b>Android (Chrome):</b> menu ⋮ → “Instalar aplicativo”.</p><div class="botoes"><button class="btn pri" data-s>Entendi</button></div>', (f, fechar) => { f.querySelector('[data-s]').onclick = () => fechar(true); });
    };
  }
  /* cópia de segurança ANTES de qualquer coisa destrutiva. Se não conseguir guardar, quem chamou aborta. */
  async function backup(op, motivo) {
    try {
      await DB.put('bk', { opId: op.id, nome: op.nome, quando: new Date().toISOString(), motivo, rev: op.rev, op: structuredClone(op) });
      S.ultimoBackup = new Date();
      const todos = (await DB.todos('bk')).filter(b => b.opId === op.id).sort((a, b) => a.k - b.k);
      for (const velho of todos.slice(0, Math.max(0, todos.length - 30))) await DB.apagar('bk', velho.k);
      return true;
    } catch (e) { toast('⚠ Não consegui guardar a cópia de segurança: ' + ((e && e.message) || e)); return false; }
  }

  /* ================= navegação ================= */
  let tela = 'rotas';
  function irPara(t) {
    if (t === 'mural') { muralAbrir(); return; }
    tela = t;
    for (const sec of $$('.tela')) sec.hidden = sec.id !== 't-' + t;
    for (const b of $$('.nav button')) { if (b.dataset.tela === 'mural') continue; if (b.dataset.tela === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
    $('#principal').classList.toggle('cheio', t === 'rotas');
    if (t === 'rotas' && RT.pronto) setTimeout(() => RT.sit && RT.sit.popup(), 60);
    if (t === 'rotas') requestAnimationFrame(() => { S.mapa.redimensionar(); if (S.precisaEnquadrar && S.op) { ajustarPadMapa(); S.mapa.enquadrar(); S.precisaEnquadrar = false; } S.mapa.marcar(); });
    else fecharCidade(true);
    renderTelaAtual();
  }
  function renderTelaAtual() {
    if (tela === 'notas') renderNotas();
    else if (tela === 'folha') renderFolha();
    else if (tela === 'importar') { renderLote(); renderOps(); renderBk(); RT.bip && RT.bip.render(); }
    else if (tela === 'relatorios') RT.relatorios.render();
    else if (tela === 'config') renderConfig();
    else if (tela === 'xmls' || tela === 'cadastros') RT.rom.render(tela);
    else if (tela === 'agenda' || tela === 'diverg') RT.sit.render(tela);
    else if (tela === 'geo') { renderGeo(); requestAnimationFrame(() => { if (S.geo.mapa) { S.geo.mapa.redimensionar(); if (!S.geo.enq) { S.geo.enq = true; geoEnquadrarTudo(); } S.geo.mapa.marcar(); } }); }
  }
  function atualizarTudo() {
    renderRail(); renderCarros(); atualizarMapa(); renderPend(); renderJanCidade(); renderJanCarros(); RT.rom && RT.rom.badge(); RT.sit && (RT.sit.contadores(), !$('#jan-busca').hidden && RT.sit.renderBusca());
    if (tela !== 'rotas') renderTelaAtual();
    if (!$('#mural').hidden) renderMural();
  }

  /* ================= trilho lateral ================= */
  function renderRail() {
    const r = S.res, op = S.op;
    $('#r-op').textContent = op ? op.nome : '—';
    $('#r-nf').textContent = r ? i$(r.tot.notas) : '0';
    $('#r-vol').textContent = r ? i$(r.tot.vol) : '0';
    $('#r-aloc').textContent = r ? r.pctAloc + '%' : '0%';
    $('#r-car').textContent = op ? String(op.carros.length) : '0';
    const pend = r ? r.cont.pendente + r.cont.parcial : 0;
    const q = $('#qt-pend'); q.textContent = String(pend); q.hidden = !pend;
    const qn = $('#qt-notas'); qn.textContent = r ? i$(r.tot.notas) : '0'; qn.hidden = !r || !r.tot.notas;
  }

  /* ================= carros ================= */
  function renderCarros() {
    const box = $('#chips-carros'), op = S.op;
    if (!op) { box.innerHTML = ''; $('#faixa-carro').innerHTML = '<span>Abra uma operação para montar as rotas.</span>'; return; }
    box.innerHTML = S.res.carros.map(rc => {
      const c = rc.carro;
      return '<button type="button" class="chip-carro" role="tab" data-id="' + c.id + '" aria-selected="' + (c.id === S.carroAtivo) + '" style="--cor:' + c.cor + '">' +
        '<b>' + N.nomeCarro(c) + (c.motorista ? '<span class="mot">' + esc(c.motorista) + '</span>' : '') + '</b>' +
        '<small>' + i$(rc.vol) + ' vol · ' + rc.paradas + ' par · ' + m$(rc.valor) + (kmTxt(kmDe(c)) ? ' · <span class="km">' + kmTxt(kmDe(c)) + '</span>' : '') + '</small>' +
        '<span class="acoes"><span data-ac="ren" title="Motorista / renomear" role="button" aria-label="Renomear">✎</span><span data-ac="del" title="Excluir carro" role="button" aria-label="Excluir carro">✕</span></span></button>';
    }).join('');
    const f = $('#faixa-carro'), rc = S.res.carros.find(x => x.carro.id === S.carroAtivo);
    if (!op.carros.length) f.innerHTML = '<span>Nenhum carro ainda. Clique em <b>+ Carro</b> (ou direto numa cidade) para começar.</span>';
    else if (rc) {
      f.style.setProperty('--cor', rc.carro.cor);
      f.innerHTML = '<span><i class="bolinha"></i><b>' + esc(N.rotuloCarro(rc.carro)) + '</b></span>' +
        '<span><b>' + rc.cidades.length + '</b> cidade(s)</span><span><b>' + rc.paradas + '</b> paradas</span><span><b>' + i$(rc.vol) + '</b> volumes</span>' +
        '<span><b>' + m$(rc.valor) + '</b></span><span>peso <b>' + N.fmtPeso(rc.peso) + '</b> kg</span>' + (kmTxt(kmDe(rc.carro)) ? '<span title="Distância pelas rodovias, de cidade em cidade, saindo da base e voltando a ela. Estimativa: sem trânsito e sem o percurso dentro das cidades.">' + kmTxt(kmDe(rc.carro), true).replace('≈ ', '≈ <b class="km">').replace(' km', ' km</b>') + '</span>' : '') +
        '<span class="rota-cad">' + (S.mapa.base && S.mapa.mostrarBase ? '<span class="no-base">' + esc((S.mapa.base.sigla || 'BASE')) + '</span>' : '') + rc.cidades.map((c, i) => (i || (S.mapa.base && S.mapa.mostrarBase) ? '<i class="seta">›</i>' : '') + '<button type="button" class="cid-chip" style="--cor:' + rc.carro.cor + '" data-cid="' + esc(c.key) + '"><b>' + (i + 1) + '</b>' + esc(c.nome) + '</button>').join('') + '</span>';
    }
    const ch = $('.chip-carro[aria-selected="true"]'); if (ch && ch.scrollIntoView) ch.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  async function novoVeiculo(tipo) {
    if (!S.op) { toast('Importe os XMLs primeiro.'); return; }
    if (tipo === 'caminhao' && N.contarTipo(S.op, 'caminhao') >= 1) {
      const ok = await U.confirmar('Mais de um caminhão?', 'Você não possui mais de um caminhão. Tem certeza?', 'Sim', false, 'Não');
      if (!ok) return;
    }
    mutar('novo ' + N.TIPOS[tipo].nome.toLowerCase(), () => { const c = N.novoCarro(S.op, '', tipo); S.carroAtivo = c.id; });
    janVer('carros', true);
  }
  const novoCarro = () => novoVeiculo('carro');
  function selecionarCarro(id) {
    if (id === S.carroAtivo) return;
    if (S.cidadeAberta && draftSujo()) toast('Marcações não concluídas foram descartadas.');
    S.carroAtivo = id; S.mapa.setAtivo(id); resetDraft(); renderCarros(); renderJanCidade();
  }
  /* lápis do veículo: motorista + cor (algumas cores da lista inicial são fracas no mapa) */
  const PALETA_CARRO = ['#7B3FE4', '#1C6DD0', '#E8590C', '#D6336C', '#0B8FA6', '#8D5A2B', '#C92A2A', '#4C5DDC', '#B23BC4', '#2FA0F5', '#F5B700', '#2E9E48', '#FF3EA5', '#00C2A8', '#FF7A00', '#111111'];
  async function renomearCarro(id) {
    const c = carroPorId(id); if (!c) return;
    let cor = c.cor;
    const html = '<h2>Editar ' + esc(N.nomeCarro(c)) + '</h2><label class="cfg-campo">Motorista<input class="filtro modal-in" id="ec-mot" style="max-width:none;width:100%" maxlength="40" placeholder="Nome do motorista (opcional)"></label>' +
      '<p class="sub" style="margin:12px 0 6px">Cor no mapa</p><div class="ec-cores">' + PALETA_CARRO.map(x => '<button type="button" class="ec-cor" data-cor="' + x + '" style="background:' + x + '" aria-label="Cor ' + x + '"></button>').join('') +
      '<label class="ec-cor ec-livre" title="Escolher outra cor"><input type="color" id="ec-livre" value="' + (/^#[0-9a-f]{6}$/i.test(c.cor) ? c.cor : '#7b3fe4') + '">+</label></div>' +
      '<div class="ec-previa" id="ec-previa"></div><div class="botoes"><button class="btn" data-n>Cancelar</button><button class="btn pri" data-s>Salvar</button></div>';
    const r = await U.modal(html, (f, fechar) => {
      const mot = f.querySelector('#ec-mot'); mot.value = c.motorista || ''; mot.focus();
      const marcar = () => { f.querySelectorAll('.ec-cor[data-cor]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cor.toLowerCase() === String(cor).toLowerCase()))); f.querySelector('#ec-previa').innerHTML = '<span style="display:inline-block;width:46px;border-top:5px dashed ' + cor + ';vertical-align:middle;margin-right:8px"></span><b style="color:' + cor + '">' + esc(N.nomeCarro(c)) + '</b>'; };
      marcar();
      f.addEventListener('click', e => { const b = e.target.closest('.ec-cor[data-cor]'); if (b) { cor = b.dataset.cor; marcar(); } });
      f.querySelector('#ec-livre').addEventListener('input', e => { cor = e.target.value; marcar(); });
      const ok = () => fechar({ mot: mot.value.trim().slice(0, 40), cor });
      mot.onkeydown = e => { if (e.key === 'Enter') ok(); };
      f.querySelector('[data-n]').onclick = () => fechar(null); f.querySelector('[data-s]').onclick = ok;
    });
    if (!r) return;
    mutar('editar ' + N.nomeCarro(c), () => { c.motorista = r.mot; c.cor = r.cor; });
  }
  async function excluirCarro(id) {
    const rc = S.res.carros.find(x => x.carro.id === id); if (!rc) return;
    if (rc.notas) {
      const ok = await U.confirmar('Excluir ' + N.nomeCarro(rc.carro) + '?', 'Ele tem ' + rc.notas + ' nota(s) (' + m$(rc.valor) + '). Elas voltam para pendentes. Uma cópia de segurança é guardada antes.', 'Excluir carro', true);
      if (!ok) return;
      if (!(await backup(S.op, 'antes de excluir ' + N.nomeCarro(rc.carro)))) return;
    }
    mutar('excluir ' + N.nomeCarro(rc.carro), () => {
      N.removerCarro(S.op, S.idx, id);
      if (S.carroAtivo === id) S.carroAtivo = S.op.carros.length ? S.op.carros[0].id : null;
    });
  }

  /* ================= mapa ================= */
  function dadosMapa() {
    if (!S.res) return [];
    return S.res.cidades.map(rc => {
      const c = rc.cidade;
      const cores = [...rc.porCarro.entries()].map(([id, t]) => ({ cor: corDe(id), frac: t.notas }));
      const clientes = c.listaClientes.map(cl => {
        const e = N.estadoCliente(cl, S.op.atrib); const prim = [...e.carros.keys()][0];
        return { cor: prim != null ? corDe(prim) : null, parcial: e.estado === 'parcial' };
      });
      return { key: c.key, nome: c.nome, uf: c.uf, lat: c.lat, lon: c.lon, code: c.code, fora: rc.fora, estado: rc.estado, alocadas: rc.alocadas, total: rc.total, notas: rc.total, cores, clientes };
    });
  }
  function ajustarPadMapa() { const j = $('#jan-pend'); S.mapa.padEsq = (j && !j.classList.contains('recolhida') && j.offsetWidth && parseFloat(j.style.left || 12) < 120) ? j.offsetWidth + 24 : 0; }
  function atualizarMapa() {
    S.mapa.setCidades(dadosMapa()); S.mapa.setAtivo(S.carroAtivo);
    atualizarVias();
    S.mapa.setRotas(S.res ? S.res.carros.filter(rc => rc.carro.cidades.length).map(rc => ({ id: rc.carro.id, cor: rc.carro.cor, pontos: rc.carro.cidades.map((k, i) => ({ key: k, n: i + 1 })) })) : []);
    S.mapa.setSelecionada(S.cidadeAberta);
    $('#vazio-mapa').hidden = !!(S.op && S.op.notas.length);
  }
  function tip(h, e) {
    const t = $('#tip');
    if (!h || !S.res) { t.hidden = true; return; }
    const rc = S.res.cidades.find(x => x.cidade.key === h.key); if (!rc) { t.hidden = true; return; }
    const tot = N.somar(rc.cidade.notas);
    const est = { pendente: 'sem veículo', parcial: 'falta nota', completa: 'tudo em veículo' }[rc.estado] + (rc.fora ? ' · FORA DE ROTA' : '');
    const carros = [...rc.porCarro.entries()].map(([id, x]) => nomeId(id) + ' (' + x.notas + ')').join(', ');
    t.innerHTML = '<b>' + esc(rc.cidade.nome) + '/' + esc(rc.cidade.uf) + '</b> · ' + est + '<br>' + rc.cidade.listaClientes.length + ' cliente(s) · ' + tot.notas + ' nota(s) · ' + m$(tot.valor) + (carros ? '<br>' + esc(carros) : '');
    t.hidden = false;
    const a = $('#mapa-area').getBoundingClientRect();
    let x = e.clientX - a.left + 16, y = e.clientY - a.top + 16;
    if (x + 280 > a.width) x = e.clientX - a.left - 290; if (y + 90 > a.height) y = e.clientY - a.top - 80;
    t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, y) + 'px';
  }

  /* ================= cidades pendentes (janela flutuante) ================= */
  /* Ctrl+V com a janela de pendentes aberta: A–Z → maior volume → maior valor → volta ao A–Z (e fica assim até você mudar) */
  const prox3 = (seq, x) => seq[(seq.indexOf(x) + 1) % seq.length];
  /* Ctrl+V: vale na janela em foco (moldura destacada) ou na tabela de Notas; sempre A–Z → maior volume → maior valor → A–Z */
  function ciclarOrdemFoco() {
    const f = S.janFoco && $('#' + S.janFoco), vis = f && !f.hidden ? S.janFoco : null;
    if (vis === 'jan-cid' && S.cidadeAberta) { S.ordemCli = prox3(['nome', 'vol', 'maior'], S.ordemCli); renderJanCidade(); toast('Clientes: ' + ({ nome: 'A–Z', vol: 'maior volume', maior: 'maior valor' })[S.ordemCli]); return true; }
    if (vis === 'jan-carros') { S.ordemCar = prox3(['nome', 'volume', 'valor'], S.ordemCar); renderJanCarros(); toast('Veículos: ' + ({ nome: 'A–Z (ordem de criação)', volume: 'maior volume', valor: 'maior valor' })[S.ordemCar]); return true; }
    if (vis === 'jan-pend' || (!vis && tela === 'rotas' && !$('#jan-pend').hidden)) { ciclarOrdemPend(); return true; }
    return false;
  }
  function ciclarOrdemNotas() {
    const f = S.nf, ordem = f.ord === 'vol' ? 'valor' : f.ord === 'valor' ? 'cliente' : 'vol'; f.ord = ordem; f.dir = ordem === 'cliente' ? 1 : -1;
    renderNotas(); toast('Notas: ' + ({ cliente: 'cliente A–Z', vol: 'maior volume', valor: 'maior valor' })[ordem]);
  }
  function ciclarOrdemPend() {
    const seq = ['nome', 'volume', 'valor'], prox = seq[(seq.indexOf(S.pend.ordem) + 1) % 3];
    S.pend.ordem = prox; U.pref.gravar('pendOrdem', prox); $('#pend-ordem').value = prox; renderPend();
    const l = $('#pend-lista'); if (l) l.scrollTop = 0;
    toast('Cidades pendentes: ' + { nome: 'ordem alfabética (A–Z)', volume: 'maior volume primeiro', valor: 'maior valor primeiro' }[prox] + '.');
  }
  function renderPend() {
    const lista = $('#pend-lista');
    if (!S.res) { lista.innerHTML = '<li class="pend-vazio">Sem operação.</li>'; $('#pend-qt').textContent = '0'; return; }
    const q = N.norm(S.pend.q), ord = S.pend.ordem;
    const casa = rc => !q || N.norm(rc.cidade.nome).includes(q);
    const ordenar = (a, b) => ord === 'valor' ? b.livres.valor - a.livres.valor || cmp(a.cidade.nome, b.cidade.nome)
      : ord === 'volume' ? b.livres.vol - a.livres.vol || cmp(a.cidade.nome, b.cidade.nome) : cmp(a.cidade.nome, b.cidade.nome);
    const emRota = S.res.cidades.filter(rc => !rc.fora), fora = S.res.cidades.filter(rc => rc.fora);
    const total = emRota.filter(rc => rc.estado !== 'completa').length;
    $('#pend-qt').textContent = String(total);
    $('#pend-qt').style.background = total ? '' : 'var(--ok)'; $('#pend-qt').style.color = total ? '' : '#fff';
    const linha = (rc, foraRota) => {
      const c = rc.cidade, pt = rc.estado === 'completa' ? 'ok' : rc.estado === 'parcial' ? 'parc' : '';
      const l = rc.estado === 'completa' ? N.somar(c.notas) : rc.livres, tot = N.somar(c.notas); // o que AINDA falta (vai abatendo a cada nota/volume que sai)
      const sub = rc.estado === 'completa' ? 'tudo em veículo' : (rc.paradasLivres + ' parada(s)' + (rc.estado === 'parcial' ? ' · já saíram ' + (tot.notas - l.notas) + ' de ' + tot.notas + ' notas' : '')) + (c.semPosicao ? ' · sem posição no mapa' : '');
      const reg = foraRota ? N.regioesDaCidade(c.code).join(', ') : '';
      return '<li class="' + (foraRota ? 'fora' : '') + '" data-cid="' + esc(c.key) + '"' + (c.key === S.cidadeAberta ? ' aria-current="true"' : '') + '><span class="pt ' + pt + '">' + (pt === 'parc' ? '!' : '') + '</span><b>' + esc(c.nome) + '<span class="tag" style="margin-left:6px">' + esc(c.uf) + '</span></b><span class="n" title="notas que faltam (de ' + tot.notas + ')">' + l.notas + '</span><span class="v" title="volumes que faltam (de ' + i$(tot.vol) + ')">' + i$(l.vol) + '</span><span class="vl" title="valor que falta (de ' + m$(tot.valor) + ')">' + m$(l.valor) + '</span><small>' + sub + (reg ? ' · ' + esc(reg) : '') + '</small>' +
        (c.code ? '<button type="button" class="bt-fora" data-fora="' + esc(c.key) + '">' + (foraRota ? 'trazer para a rota' : 'marcar fora de rota') + '</button>' : '') + '</li>';
    };
    /* rodapé: quanto ainda falta sair, somando as cidades em rota que não zeraram */
    { const f = emRota.filter(rc => rc.estado !== 'completa').reduce((t, rc) => ({ n: t.n + rc.livres.notas, v: t.v + rc.livres.vol, $: t.$ + rc.livres.valor, p: t.p + rc.paradasLivres }), { n: 0, v: 0, $: 0, p: 0 });
      const rod = $('#pend-rod'); if (rod) rod.innerHTML = total ? 'Faltam <b>' + i$(f.n) + '</b> notas · <b>' + i$(f.v) + '</b> vol · <b>' + m$(f.$) + '</b> · ' + f.p + ' parada(s)' : '<b style="color:var(--ok)">✓ Nada pendente</b>'; }
    const itens = emRota.filter(rc => (S.pend.mostrarTodas || rc.estado !== 'completa') && casa(rc)).sort(ordenar);
    let h = itens.length ? itens.map(rc => linha(rc, false)).join('') :
      '<li class="pend-vazio">' + (total ? 'Nenhuma cidade com esse nome.' : '✓ Todas as cidades em rota têm todas as notas em algum veículo.') + '</li>';
    if (fora.length) {
      const fv = fora.reduce((t, rc) => t + N.somar(rc.cidade.notas).valor, 0);
      h += '<li class="fora-sep" style="display:block;padding:0"><button type="button" class="fora-cab" id="pend-fora-cab" aria-expanded="' + !!S.pend.foraAberto + '"><span>Fora de rota (' + fora.length + ')</span><span>' + m$(fv) + ' ' + (S.pend.foraAberto ? '▾' : '▸') + '</span></button></li>';
      if (S.pend.foraAberto) h += fora.filter(casa).sort(ordenar).map(rc => linha(rc, true)).join('');
    }
    lista.innerHTML = h;
  }

  /* ================= janela da cidade: clientes → notas ================= */
  function notasDaCidade() { const c = S.idx && S.idx.cidades.get(S.cidadeAberta); return c ? c.notas : []; }
  function resetDraft() {
    const car = S.carroAtivo;
    S.draft = new Set(notasDaCidade().filter(n => car != null && S.op.atrib[n.id] === car).map(n => n.id));
    S.draft0 = new Set(S.draft);
  }
  function draftSujo() {
    if (S.draft.size !== S.draft0.size) return true;
    for (const x of S.draft) if (!S.draft0.has(x)) return true;
    return false;
  }
  function disponivel(n) { const a = S.op.atrib[n.id]; return a == null || a === S.carroAtivo; }

  function abrirCidade(key, o) {
    o = o || {};
    if (!S.op || !S.idx || !S.idx.cidades.has(key)) return;
    if (S.cidadeAberta && S.cidadeAberta !== key && draftSujo()) toast('Marcações não concluídas foram descartadas.');
    if (!S.op.carros.length) { mutar('novo carro', () => { const c = N.novoCarro(S.op); S.carroAtivo = c.id; }); toast('Criei o Carro 1 para você começar.'); }
    if (S.carroAtivo == null || !carroPorId(S.carroAtivo)) S.carroAtivo = S.op.carros[0].id;
    S.cidadeAberta = key; S.expand = new Set(); resetDraft();
    S.mapa.setSelecionada(key); enviar({ t: 'sel', key, centrar: !!o.centrar });
    const area = $('#mapa-area'), jan = $('#jan-cid');
    jan.hidden = false; renderJanCidade(); renderCarros(); renderPend();
    const W = area.clientWidth, H = area.clientHeight;
    if (o.centrar) S.mapa.centrarEm(key, 140);
    const salvo = posJan('cid');
    if (salvo) U.posicionar(jan, area, salvo.x, salvo.y); // onde você deixou, fica
    else {
      const anchor = (o.centrar || S.parede) ? { x: W / 2, y: H / 2 } : (S.mapa.posicaoDaCidade(key) || { x: W * 0.55, y: H * 0.3 });
      const w = jan.offsetWidth; let x = anchor.x + 28; if (x + w > W - 8) x = anchor.x - w - 28;
      U.posicionar(jan, area, x, anchor.y - 70);
    }
    const l = $('.cid-lista', jan); if (l) l.scrollTop = 0;
  }
  function fecharCidade(silencioso) {
    if (!S.cidadeAberta) return;
    if (!silencioso && draftSujo()) toast('Marcações não concluídas foram descartadas.');
    S.cidadeAberta = null; S.draft = new Set(); S.draft0 = new Set();
    $('#jan-cid').hidden = true; S.mapa && S.mapa.setSelecionada(null); enviar({ t: 'sel', key: null }); renderPend();
  }

  function chipPos(carros) {
    return [...carros.entries()].map(([id, q]) => { const c = carroPorId(id); return c ? '<span class="chip-pos" style="--cor:' + c.cor + '">' + N.nomeCarro(c) + (q > 1 ? ' · ' + q : '') + '</span>' : ''; }).join('');
  }
  function renderJanCidade() {
    const jan = $('#jan-cid');
    if (!S.cidadeAberta || !S.idx) { return; }
    const c = S.idx.cidades.get(S.cidadeAberta);
    if (!c) { fecharCidade(true); return; }
    const rc = S.res.cidades.find(x => x.cidade === c), car = carroPorId(S.carroAtivo);
    const foco = document.activeElement && jan.contains(document.activeElement) ? { cls: document.activeElement.className, i: document.activeElement.dataset.i, n: document.activeElement.dataset.n } : null;
    const rolagem = $('.cid-lista', jan) ? $('.cid-lista', jan).scrollTop : 0;
    const tot = N.somar(c.notas);
    const disp = c.notas.filter(disponivel);
    const selDisp = disp.filter(n => S.draft.has(n.id)).length;
    let clientes = c.listaClientes.slice();
    const vcli = cl => N.somar(cl.notas).valor;
    const vvol = cl => N.somar(cl.notas).vol;
    if (S.ordemCli === 'vol') clientes.sort((a, b) => vvol(b) - vvol(a) || cmp(a.nome, b.nome));
    else if (S.ordemCli === 'maior') clientes.sort((a, b) => vcli(b) - vcli(a) || cmp(a.nome, b.nome));
    else if (S.ordemCli === 'menor') clientes.sort((a, b) => vcli(a) - vcli(b) || cmp(a.nome, b.nome));
    jan.style.setProperty('--cor', car ? car.cor : 'var(--teal)');
    const est = { pendente: 'Sem carro', parcial: 'Falta nota', completa: 'Completa' }[rc.estado];
    const sel = c.notas.filter(n => S.draft.has(n.id)), st = N.somar(sel), par = new Set(sel.map(N.chaveCliente)).size;
    const linhas = clientes.map(cl => {
      const e = N.estadoCliente(cl, S.op.atrib), dsp = cl.notas.filter(disponivel), nsel = dsp.filter(n => S.draft.has(n.id)).length;
      const cinza = dsp.length === 0, meu = cl.notas.some(n => S.op.atrib[n.id] === S.carroAtivo);
      const t = N.somar(cl.notas), exp = S.expand.has(cl.key);
      const idx = c.listaClientes.indexOf(cl);
      const outros = new Map([...e.carros].filter(([id]) => id !== S.carroAtivo));
      let h = '<div class="cli' + (cinza ? ' cinza' : '') + (meu ? ' meu' : '') + '"><div class="cli-lin">' +
        '<input type="checkbox" class="cl-chk" data-i="' + idx + '"' + (nsel && nsel === dsp.length ? ' checked' : '') + (cinza ? ' disabled' : '') + ' aria-label="Levar ' + esc(cl.nome) + ' neste carro">' +
        '<button type="button" class="cli-exp" data-i="' + idx + '" aria-expanded="' + exp + '" aria-label="Ver notas">▸</button>' +
        '<div class="cli-nome" data-i="' + idx + '"><b>' + esc(cl.nome) + chipPos(outros) + (cinza && outros.size ? '<button type="button" class="lib" data-libc="' + idx + '">liberar</button>' : '') + '</b>' +
        '<small>' + esc(cl.end) + (cl.num && cl.num !== '0' ? ', ' + esc(cl.num) : '') + (cl.bairro ? ' · ' + esc(cl.bairro) : '') + '</small></div>' +
        '<div class="cli-num">' + m$(t.valor) + '<small>' + t.notas + ' nota' + (t.notas > 1 ? 's' : '') + ' · ' + i$(t.vol) + ' vol</small></div></div>';
      if (exp) {
        h += '<div class="nts">' + cl.notas.slice().sort((a, b) => b.valor - a.valor).map(n => {
          const a = S.op.atrib[n.id], outro = a != null && a !== S.carroAtivo;
          return '<div class="nt' + (outro ? ' cinza' : '') + '"><input type="checkbox" class="nt-chk" data-n="' + esc(n.id) + '"' + (S.draft.has(n.id) ? ' checked' : '') + (outro ? ' disabled' : '') + ' aria-label="NF ' + esc(n.nf) + '">' +
            '<div class="l1">NF ' + esc(n.nf) + ' <span>· ' + esc(n.origem.replace(/\.xml$/i, '')) + ' · ' + i$(n.vol) + ' vol</span>' + (outro ? chipPos(new Map([[a, 1]])) + '<button type="button" class="lib" data-libn="' + esc(n.id) + '">liberar</button>' : '') + '</div>' +
            '<div class="v">' + m$(n.valor) + '</div></div>';
        }).join('') + '</div>';
      }
      return h + '</div>';
    }).join('');
    jan.innerHTML =
      '<div class="jan-cab" id="jc-cab"><b>' + esc(c.nome) + ' <small class="tag">' + esc(c.uf) + '</small></b><span class="estado ' + rc.estado + '">' + est + '</span><button type="button" class="jan-x" data-a="fechar" aria-label="Fechar">✕</button></div>' +
      '<div class="cid-info"><span><b>' + c.listaClientes.length + '</b> clientes</span><span><b>' + tot.notas + '</b> notas</span><span><b>' + i$(tot.vol) + '</b> vol</span><span><b>' + m$(tot.valor) + '</b></span>' +
      (rc.estado === 'parcial' ? '<span style="color:var(--amarTxt)">faltam <b>' + rc.livres.notas + '</b> nota(s) · ' + m$(rc.livres.valor) + '</span>' : '') + (c.semPosicao ? '<span style="color:var(--no)">cidade sem posição no mapa</span>' : '') + (c.fora ? '<span style="color:var(--mudo)">FORA DE ROTA</span>' : '') + (c.code ? '<button type="button" class="lib" data-a="forarota">' + (c.fora ? 'trazer para a rota' : 'marcar como fora de rota') + '</button>' : '') + '</div>' +
      '<div class="cid-ctrl"><span>Levar para:</span><div class="carros-mini">' + S.op.carros.map(x => '<button type="button" class="mini-car" data-car="' + x.id + '" aria-pressed="' + (x.id === S.carroAtivo) + '" style="--cor:' + x.cor + '">' + N.nomeCarro(x) + '</button>').join('') + '</div>' +
      '<select id="jc-ordem" class="filtro" style="min-height:28px;padding:1px 6px;font-size:.78rem" aria-label="Ordenar clientes"><option value="nome"' + (S.ordemCli === 'nome' ? ' selected' : '') + '>A–Z</option><option value="vol"' + (S.ordemCli === 'vol' ? ' selected' : '') + '>Maior volume</option><option value="maior"' + (S.ordemCli === 'maior' ? ' selected' : '') + '>Maior valor</option><option value="menor"' + (S.ordemCli === 'menor' ? ' selected' : '') + '>Menor valor</option></select>' +
      '<label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" id="jc-todos" data-a="todos"' + (disp.length && selDisp === disp.length ? ' checked' : '') + (disp.length ? '' : ' disabled') + '> todos</label></div>' +
      '<div class="cid-lista">' + (linhas || '<div class="vazio-lista">Sem clientes.</div>') + '</div>' +
      '<div class="cid-rod"><div class="sel">' + (sel.length ? '<b>' + sel.length + '</b> nota(s) · <b>' + par + '</b> parada(s)<br><b>' + i$(st.vol) + '</b> vol · <b>' + m$(st.valor) + '</b>' : 'Marque os clientes (ou abra ▸ para escolher notas) e clique em Concluir.') + '</div>' +
      '<button type="button" class="btn" data-a="cancelar">Cancelar</button><button type="button" class="btn concluir" data-a="concluir"' + (draftSujo() && car ? '' : ' disabled') + '>Concluir' + (car ? ' → ' + N.nomeCarro(car) : '') + '</button></div>';
    const l = $('.cid-lista', jan); if (l) l.scrollTop = rolagem;
    const areaH = $('#mapa-area').clientHeight, topo = parseFloat(jan.style.top) || 0;
    if (topo + jan.offsetHeight > areaH - 6) jan.style.top = Math.max(6, areaH - jan.offsetHeight - 6) + 'px';
    if (foco) {
      const seletor = foco.n != null ? '.nt-chk[data-n="' + CSS.escape(foco.n) + '"]' : foco.i != null ? '.' + String(foco.cls).split(' ')[0] + '[data-i="' + foco.i + '"]' : null;
      const el = seletor && jan.querySelector(seletor); if (el) el.focus();
    }
  }
  function marcarCliente(i, marcar) {
    const c = S.idx.cidades.get(S.cidadeAberta), cl = c.listaClientes[i]; if (!cl) return;
    for (const n of cl.notas.filter(disponivel)) { if (marcar) S.draft.add(n.id); else S.draft.delete(n.id); }
    renderJanCidade();
  }
  function concluirCidade() {
    const c = S.idx.cidades.get(S.cidadeAberta), car = carroPorId(S.carroAtivo); if (!c || !car) return;
    const add = c.notas.filter(n => S.draft.has(n.id) && S.op.atrib[n.id] !== car.id).map(n => n.id);
    const rem = c.notas.filter(n => !S.draft.has(n.id) && S.op.atrib[n.id] === car.id).map(n => n.id);
    if (!add.length && !rem.length) { fecharCidade(true); return; }
    const nome = c.nome, vAdd = N.somar(c.notas.filter(n => add.includes(n.id)));
    S.cidadeAberta = null; S.draft = new Set(); S.draft0 = new Set(); $('#jan-cid').hidden = true;
    mutar('' + N.nomeCarro(car) + ' ↔ ' + nome, () => {
      if (add.length) N.alocar(S.op, S.idx, add, car.id);
      if (rem.length) N.alocar(S.op, S.idx, rem, null);
    });
    toast(nome + ' → ' + N.nomeCarro(car) + ': ' + (add.length ? '+' + add.length + ' nota(s) (' + m$(vAdd.valor) + ')' : '') + (rem.length ? (add.length ? ', ' : '') + rem.length + ' devolvida(s)' : ''), { rotulo: 'Desfazer', fn: desfazer });
  }
  function liberar(ids, rotulo) {
    mutar(rotulo, () => N.alocar(S.op, S.idx, ids, null));
    if (S.cidadeAberta) resetDraftMantendoMarcas();
    renderJanCidade();
  }
  function resetDraftMantendoMarcas() { // depois de liberar, mantém o que o usuário já tinha marcado
    const ant = new Set(S.draft); resetDraft(); for (const id of ant) S.draft.add(id);
    S.draft0 = new Set(notasDaCidade().filter(n => S.op.atrib[n.id] === S.carroAtivo).map(n => n.id));
  }

  /* ================= notas ================= */
  function renderNotas() {
    const op = S.op, f = S.nf;
    $('#notas-sub').textContent = op ? op.nome + ' · ' + U.dataBR(op.data) + ' · ' + i$(op.notas.length) + ' nota(s) · ' + S.res.cont.completa + ' cidade(s) completa(s).' : 'Nenhuma operação aberta.';
    const sc = $('#n-carro'), so = $('#n-origem');
    if (!op) { $('#n-tabela').innerHTML = ''; $('#n-rodape').textContent = ''; return; }
    const vc = sc.value, vo = so.value;
    sc.innerHTML = '<option value="">Todos os carros</option><option value="livre">Sem carro (livres)</option>' + op.carros.map(c => '<option value="' + c.id + '">' + N.nomeCarro(c) + (c.motorista ? ' · ' + esc(c.motorista) : '') + '</option>').join('');
    so.innerHTML = '<option value="">Todas as origens</option>' + [...S.res.origens.keys()].sort(cmp).map(o => '<option value="' + esc(o) + '">' + esc(o) + '</option>').join('');
    sc.value = vc; so.value = vo; f.carro = sc.value; f.origem = so.value;
    const q = N.norm(f.q);
    let lista = op.notas.filter(n => {
      const a = op.atrib[n.id];
      if (f.carro === 'livre' && a != null) return false;
      if (f.carro && f.carro !== 'livre' && String(a) !== f.carro) return false;
      if (f.origem && n.origem !== f.origem) return false;
      if (q && !(N.norm(n.nf + ' ' + n.cliente + ' ' + n.cidade + ' ' + n.chave + ' ' + n.end).includes(q))) return false;
      return true;
    });
    const chave = { nf: n => n.nf, origem: n => n.origem, cliente: n => N.norm(n.cliente), cidade: n => N.norm(n.cidade), vol: n => n.vol, peso: n => n.peso, valor: n => n.valor, carro: n => op.atrib[n.id] == null ? 0 : op.atrib[n.id] };
    const kf = chave[f.ord] || chave.nf;
    lista.sort((a, b) => { const x = kf(a), y = kf(b); return (typeof x === 'number' ? x - y : cmp(x, y)) * f.dir; });
    const t = N.somar(lista), MAX = 1500, ver = lista.slice(0, MAX);
    const th = (k, rot, dir) => '<th data-ord="' + k + '" class="' + (dir ? 'dir' : '') + '">' + rot + (f.ord === k ? (f.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>';
    $('#n-tabela').innerHTML = '<thead><tr>' + th('nf', 'NF') + th('origem', 'Origem') + th('cliente', 'Cliente') + th('cidade', 'Cidade') + th('vol', 'Vol', 1) + th('peso', 'Peso kg', 1) + th('valor', 'Valor', 1) + th('carro', 'Carro') + '<th>Situação</th><th>Bipada</th></tr></thead><tbody>' +
      ver.map(n => {
        const a = op.atrib[n.id], c = a != null ? carroPorId(a) : null;
        return '<tr><td>' + esc(n.nf) + '</td><td>' + esc(n.origem.replace(/\.xml$/i, '')) + '</td><td title="' + esc(n.cliente) + '">' + esc(n.cliente) + '</td><td>' + esc(n.cidade) + '/' + esc(n.uf) + '</td><td class="dir">' + n.vol + '</td><td class="dir">' + N.fmtPeso(n.peso) + '</td><td class="dir">' + m$(n.valor) + '</td><td>' +
          (c ? '<span class="carro-tag" style="--cor:' + c.cor + '">' + N.nomeCarro(c) + '</span>' : '<span class="livre-tag">livre</span>') + '</td><td>' + ({ presente: 'Presente', agendamento: '<b style="color:var(--amarTxt)">Agendamento</b>', divergencia: '<b style="color:var(--no)">Divergência</b>' }[N.estadoNota(op, n)]) + '</td><td>' + ((op.bipes || {})[n.id] ? '<span style="color:var(--ok);font-weight:700" title="Bipada às ' + new Date(op.bipes[n.id].em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '">✓</span>' : '') + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td colspan="4">' + i$(t.notas) + ' nota(s)</td><td class="dir">' + i$(t.vol) + '</td><td class="dir">' + N.fmtPeso(t.peso) + '</td><td class="dir">' + m$(t.valor) + '</td><td></td><td></td><td></td></tr></tfoot>';
    $('#n-rodape').textContent = lista.length > MAX ? 'Mostrando as primeiras ' + MAX + ' de ' + lista.length + '. Use a busca para afunilar. Os totais acima valem para todas as ' + lista.length + '.' : 'Peso ausente no XML conta como zero.';
  }

  /* ================= folha de rotas ================= */
  function renderFolha() {
    const box = $('#folha');
    if (!S.op) { box.innerHTML = '<p class="sub">Nenhuma operação aberta.</p>'; return; }
    const cars = S.res.carros.filter(c => c.notas > 0);
    if (!cars.length) { box.innerHTML = '<p class="sub">Nenhum carro com notas ainda. Monte as rotas primeiro.</p>'; return; }
    const agora = new Date();
    const tot = cars.reduce((t, c) => ({ vol: t.vol + c.vol, par: t.par + c.paradas, val: t.val + c.valor }), { vol: 0, par: 0, val: 0 });
    const faltam = S.res.rota.notas - S.res.alocRota.notas;
    let h = (faltam ? '<div class="folha-aviso">⚠ Esta folha ainda não está completa: faltam ' + faltam + ' nota(s) (' + m$(S.res.rota.valor - S.res.alocRota.valor) + ') sem carro.</div>' : '') +
      '<div class="folha"><div class="f-cab"><b>ROTA ' + U.dataBR(S.op.data) + '</b><span>Emitida em ' + agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</span></div>';
    for (let i = 0; i < cars.length; i += 7) {
      const bl = cars.slice(i, i + 7), pad = n => Array.from({ length: 7 - bl.length }, () => n);
      const cel = (fn, tag) => bl.map(fn).concat(pad('')).map(x => '<' + (tag || 'td') + '>' + (x || '') + '</' + (tag || 'td') + '>').join('');
      h += '<div class="f-blk"><table><tr><th class="lbl"></th>' + cel(c => esc((c.carro.motorista || N.nomeCarro(c.carro)).toUpperCase()), 'th') + '</tr>' +
        '<tr><td class="lbl"></td>' + bl.map(c => '<td class="cidades">' + c.cidades.map(x => esc(N.norm(x.nome))).join('<br>') + '</td>').concat(pad('<td class="cidades"></td>')).join('') + '</tr>' +
        '<tr class="vol"><td class="lbl">VOLUMES</td>' + cel(c => i$(c.vol)) + '</tr><tr class="par"><td class="lbl">PARADAS</td>' + cel(c => c.paradas) + '</tr>' +
        '<tr class="val"><td class="lbl">VALOR</td>' + cel(c => m$(c.valor)) + '</tr><tr><td class="lbl">CONF.</td>' + cel(() => '') + '</tr></table></div>';
    }
    h += '<div class="f-tot"><div>TOTAL (' + cars.length + ' rotas)</div><div>VOLUMES: ' + i$(tot.vol) + '</div><div>PARADAS: ' + i$(tot.par) + '</div><div>VALOR: ' + m$(tot.val) + '</div></div></div>';
    box.innerHTML = h;
  }

  /* ================= importar ================= */
  async function lerArquivos(files) {
    const lidos = [], hashes = new Map();
    for (const f of files) {
      let buf; try { buf = await f.arrayBuffer(); } catch (e) { lidos.push({ arquivo: f.name, notas: [], ignoradas: [], avisos: [], erro: 'Não consegui abrir o arquivo.' }); continue; }
      const h = await U.sha256(buf);
      const r = N.lerXml(buf, f.name); r.hash = h;
      if (h && [...hashes.values()].includes(h)) { r.duplicadoNoLote = true; r.notas = []; }
      if (h) hashes.set(f.name, h);
      lidos.push(r);
    }
    S.lote = { lidos };
    S.destino = S.op ? 'atual' : 'nova';
    renderLote();
  }
  function relLote() {
    const L = S.lote; if (!L) return null;
    return N.prepararLote(S.destino === 'atual' && S.op ? S.op : null, L.lidos);
  }
  function renderLote() {
    const box = $('#lote');
    if (!S.lote) { box.innerHTML = ''; return; }
    const rel = relLote(), t = N.somar(rel.novas);
    const jaTem = f => S.op && S.destino === 'atual' && f.hash && S.op.arquivos.some(a => a.hash === f.hash);
    const linhas = rel.arquivos.map((f, i) => {
      const r = S.lote.lidos[i];
      return '<tr><td>' + esc(f.arquivo) + '</td><td class="dir">' + (f.erro ? '<span class="erro">erro</span>' : f.lidas) + '</td><td class="dir"><b>' + f.novas + '</b></td><td class="dir">' + f.repetidas + '</td><td class="dir">' + (f.conflitos ? '<span class="erro">' + f.conflitos + '</span>' : 0) + '</td><td class="dir">' + (f.ignoradas.length ? '<span class="am">' + f.ignoradas.length + '</span>' : 0) + '</td><td>' +
        (f.erro ? '<span class="erro">' + esc(f.erro) + '</span>' : r.duplicadoNoLote ? '<span class="am">arquivo idêntico a outro do lote</span>' : jaTem(r) ? '<span class="am">este mesmo arquivo já foi importado nesta operação</span>' : '') + '</td></tr>';
    }).join('');
    const det = rel.arquivos.map((f, i) => (f.ignoradas.length || f.avisos.length) ?
      '<details><summary>' + esc(f.arquivo) + ': ' + f.ignoradas.length + ' linha(s) ignorada(s), ' + f.avisos.length + ' aviso(s)</summary>' + f.ignoradas.slice(0, 40).map(x => '<div>linha ' + x.linha + ': ' + esc(x.motivo) + '</div>').join('') + f.avisos.slice(0, 40).map(x => '<div>' + esc(x) + '</div>').join('') + '</details>' : '').join('');
    const conf = rel.conflitos.length ? '<details open><summary class="erro">' + rel.conflitos.length + ' nota(s) com a mesma identidade mas dados diferentes (mantive a primeira)</summary>' + rel.conflitos.slice(0, 40).map(x => '<div>NF ' + esc(x.nf) + ': ' + esc(x.arquivo) + ' × ' + esc(x.outro) + '</div>').join('') + '</details>' : '';
    const hoje = U.hoje(), d = hoje.split('-');
    box.innerHTML = '<div class="rel"><h3>Resumo da leitura</h3><table><thead><tr><th>Arquivo</th><th class="dir">Linhas</th><th class="dir">Novas</th><th class="dir">Repetidas</th><th class="dir">Conflitos</th><th class="dir">Ignoradas</th><th>Situação</th></tr></thead><tbody>' + linhas + '</tbody></table>' + det + conf +
      '<div class="acao"><div style="flex:1;min-width:240px"><b>' + i$(rel.novas.length) + '</b> nota(s) novas · <b>' + i$(t.vol) + '</b> volumes · <b>' + m$(t.valor) + '</b>' + (rel.repetidas ? ' · ' + rel.repetidas + ' repetida(s) não entram' : '') + '</div>' +
      (S.op ? '<label><input type="radio" name="dest" value="atual"' + (S.destino === 'atual' ? ' checked' : '') + '> Adicionar à operação <b>' + esc(S.op.nome) + '</b></label><label><input type="radio" name="dest" value="nova"' + (S.destino === 'nova' ? ' checked' : '') + '> Nova operação</label>' : '<span>Vai criar uma nova operação.</span>') +
      (S.destino === 'nova' || !S.op ? '<input id="op-nome" class="filtro" value="' + esc('Operação ' + d[2] + '-' + d[1]) + '" aria-label="Nome da operação"><input id="op-data" type="date" class="filtro" value="' + hoje + '" aria-label="Data da operação">' : '') +
      '<button class="btn" id="lote-cancelar" type="button">Descartar</button><button class="btn pri" id="lote-ok" type="button"' + (rel.novas.length ? '' : ' disabled') + '>Importar ' + i$(rel.novas.length) + ' nota(s)</button></div></div>';
  }
  async function confirmarImportacao() {
    const L = S.lote; if (!L) return;
    const rel = relLote(); if (!rel.novas.length) return;
    let op;
    if (S.destino === 'atual' && S.op) {
      if (!(await backup(S.op, 'antes de importar ' + rel.novas.length + ' nota(s)'))) return;
      op = S.op; empurrarHist('importação');
    } else {
      const nome = ($('#op-nome') && $('#op-nome').value.trim()) || 'Operação';
      const data = ($('#op-data') && $('#op-data').value) || U.hoje();
      op = N.novaOperacao(nome, data); S.hist = [];
    }
    for (const n of rel.novas) op.notas.push(n);
    const ap = N.aplicarAgenda(op, RT.agenda.itens);
    for (const r of L.lidos) if (!r.erro && !r.duplicadoNoLote) op.arquivos.push({ nome: r.arquivo, hash: r.hash || null, notas: r.notas.length, em: new Date().toISOString() });
    op.rev++;
    S.op = op; S.lote = null; S.precisaEnquadrar = true;
    if (!op.carros.some(c => c.id === S.carroAtivo)) S.carroAtivo = op.carros.length ? op.carros[0].id : null;
    reindexar(); await salvar();
    toast('Importei ' + rel.novas.length + ' nota(s) em ' + op.nome + '.' + (ap.auto.length ? ' ' + ap.auto.length + ' saíram da rota por serem agendamento' + (ap.mesa.length ? ' (' + ap.mesa.length + ' da MESA ficaram na rota)' : '') + '.' : ''));
    atualizarTudo(); irPara('rotas');
    if (S.pdfsPend) { const p = S.pdfsPend; S.pdfsPend = null; RT.rom.adicionarPdfs(p); }
  }
  async function renderOps() {
    const box = $('#lista-ops'); let ops = [];
    try { ops = await DB.todos('ops'); } catch (e) { box.innerHTML = '<p class="erro">Não consegui ler as operações: ' + esc(e.message) + '</p>'; return; }
    ops.sort((a, b) => String(b.criada).localeCompare(String(a.criada)));
    if (!ops.length) { box.innerHTML = '<p class="sub">Nenhuma operação guardada ainda.</p>'; return; }
    box.innerHTML = ops.map(o => {
      const aloc = Object.keys(o.atrib || {}).length;
      return '<div class="op-card' + (S.op && S.op.id === o.id ? ' ativa' : '') + '"><div class="nome"><b>' + esc(o.nome) + '</b><small>' + U.dataBR(o.data) + ' · ' + i$(o.notas.length) + ' notas · ' + aloc + ' alocadas · ' + (o.carros || []).length + ' carros · revisão ' + o.rev + '</small></div>' +
        (S.op && S.op.id === o.id ? '<span class="base">aberta</span>' : '<button class="btn mini" data-op-abrir="' + esc(o.id) + '">Abrir</button>') +
        '<button class="btn mini" data-op-ren="' + esc(o.id) + '">Renomear</button><button class="btn mini" data-op-baixar="' + esc(o.id) + '">Baixar cópia</button><button class="btn mini perigo" data-op-del="' + esc(o.id) + '">Excluir</button></div>';
    }).join('');
  }
  async function renderBk() {
    const box = $('#lista-bk'); let bk = [];
    try { bk = (await DB.todos('bk')).sort((a, b) => b.k - a.k).slice(0, 12); } catch (e) { box.innerHTML = ''; return; }
    if (!bk.length) { box.innerHTML = '<p class="dica">Nenhuma cópia ainda.</p>'; return; }
    box.innerHTML = bk.map(b => '<div class="op-card"><div class="nome"><b>' + esc(b.nome) + '</b><small>' + new Date(b.quando).toLocaleString('pt-BR') + ' · ' + esc(b.motivo) + ' · ' + b.op.notas.length + ' notas</small></div><button class="btn mini" data-bk-rest="' + b.k + '">Restaurar como nova operação</button></div>').join('');
  }
  async function abrirOperacao(op) {
    if (S.cidadeAberta) fecharCidade(true);
    S.op = op; S.hist = []; S.carroAtivo = op.carros.length ? op.carros[0].id : null; S.precisaEnquadrar = true;
    reindexar(); S.ultimoSalvo = new Date();
    try { await DB.put('meta', { k: 'ativa', id: op.id }); } catch (e) { /* aviso aparece no próximo salvar */ }
    statusSalvo('ok'); atualizarTudo();
    if (tela === 'rotas') { ajustarPadMapa(); S.mapa.enquadrar(); S.precisaEnquadrar = false; }
  }
  async function restaurarObjeto(op, sufixo) {
    if (!op || !Array.isArray(op.notas) || !Array.isArray(op.carros) || typeof op.atrib !== 'object' || !op.atrib) throw new Error('arquivo não parece uma operação do Health Route');
    const novo = structuredClone(op); novo.id = 'op' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    novo.nome = (novo.nome || 'Operação') + sufixo; novo.rev = (novo.rev || 0) + 1;
    await DB.put('ops', novo); await abrirOperacao(novo); renderOps(); toast('Restaurei como "' + novo.nome + '". A original continua guardada.');
  }

  /* ================= mural do dia ================= */
  function muralAbrir() { $('#mural').hidden = false; renderMural(); $('#mural').focus(); }
  function muralFechar() { $('#mural').hidden = true; if (tela === 'rotas' && RT.pronto) setTimeout(() => RT.sit && RT.sit.popup(), 60); }
  function renderMural() {
    const m = $('#mural'), r = S.res, op = S.op;
    const dt = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    const car = r ? r.carros.filter(c => c.notas > 0) : [];
    const pend = r ? r.cont.pendente + r.cont.parcial : 0;
    const par = r ? N.paradasTotais(op, S.idx) : 0;
    const bk = S.ultimoBackup;
    m.innerHTML = '<div class="mural-in"><header><div><span class="mural-k">Mural do dia</span><h1>' + esc(dt[0].toUpperCase() + dt.slice(1)) + '</h1><span class="sub">Bom trabalho, Tiago.</span></div><button class="btn pri" id="mural-x" type="button">Entrar no programa</button></header><div class="mural-g">' +
      '<div class="mural-c mural-topo"><h3>Operação</h3>' + (op ? '<div><b class="num" style="font-size:1.25rem">' + esc(op.nome) + '</b> <span class="tag">' + U.dataBR(op.data) + '</span></div><div class="linha-nums"><div><b class="big num">' + i$(r.tot.notas) + '</b><small>notas</small></div><div><b class="big num">' + i$(r.tot.vol) + '</b><small>volumes</small></div><div><b class="big num">' + m$(r.tot.valor) + '</b><small>valor das notas</small></div><div><b class="big num">' + N.fmtPeso(r.tot.peso) + '</b><small>kg (peso informado)</small></div><div><b class="big num">' + i$(par) + '</b><small>paradas (clientes por cidade)</small></div></div>' : '<p class="sub" style="margin:6px 0 0">Nenhuma operação aberta. Importe os XMLs do dia.</p><button class="btn pri mini" data-ir="importar" type="button">Importar XMLs</button>') + '</div>' +
      (op ? '<div class="mural-c"><h3>Cidades</h3><b class="big">' + i$(r.cidades.length) + '</b> na operação<ul><li><span class="ok">✓ completas (tudo em carro)</span><b>' + r.cont.completa + '</b></li><li><span class="aten">! faltam notas</span><b>' + r.cont.parcial + '</b></li><li><span>sem carro ainda</span><b>' + r.cont.pendente + '</b></li></ul><button class="btn mini" data-ir="rotas" type="button">Montar rotas</button></div>' +
        '<div class="mural-c"><h3>Alocação nos carros</h3><b class="big ' + (r.pctAloc === 100 ? 'ok' : '') + '">' + r.pctAloc + '%</b> das notas<div class="barra"><i style="width:' + r.pctAloc + '%"></i></div><p class="sub" style="margin:0;font-size:var(--fs-sm)">' + i$(r.alocRota.notas) + ' de ' + i$(r.rota.notas) + ' notas em rota · ' + m$(r.alocRota.valor) + ' de ' + m$(r.rota.valor) + '. “Alocada” = está num veículo; não é entregue nem conferida.' + (r.fora.notas ? ' Fora de rota (' + r.fora.cidades + ' cidade(s)): ' + r.fora.notas + ' notas, ' + m$(r.fora.valor) + ' — não entram nesta conta.' : '') + '</p></div>' +
        '<div class="mural-c"><h3>Carros</h3><b class="big">' + car.length + '</b> com rota' + (car.length ? '<ul>' + car.slice(0, 6).map(c => '<li><span><i class="chip-pos" style="--cor:' + c.carro.cor + '">' + c.carro.numero + '</i> ' + esc(c.carro.motorista || '') + '</span><b>' + i$(c.vol) + ' vol · ' + m$(c.valor) + '</b></li>').join('') + (car.length > 6 ? '<li><span>+ ' + (car.length - 6) + ' carro(s)</span></li>' : '') + '</ul>' : '<p class="sub" style="margin:4px 0 0">Nenhum carro com notas.</p>') + '</div>' +
        ((r.ret.agendamento || r.ret.divergencia) ? '<div class="mural-c"><h3>Fora da rota</h3><ul><li><span>agendamentos</span><b>' + r.ret.agendamento + '</b></li><li><span>divergências</span><b>' + r.ret.divergencia + '</b></li></ul><button class="btn mini" data-ir="agenda" type="button">Ver agendamentos</button></div>' : '') +
        (Object.keys(op.bipes || {}).length || (op.extras || []).length ? '<div class="mural-c"><h3>Bipagem</h3><b class="big">' + Object.keys(op.bipes || {}).length + '</b> de ' + i$(r.tot.notas) + ' notas bipadas<ul><li><span>fora do romaneio</span><b>' + (op.extras || []).length + '</b></li></ul><button class="btn mini" data-ir="importar" type="button">Bipar notas</button></div>' : '') +
        '<div class="mural-c"><h3>Origens (arquivos)</h3><b class="big">' + r.origens.size + '</b> origem(ns)<ul>' + [...r.origens.entries()].sort((a, b) => b[1].notas - a[1].notas).slice(0, 8).map(([o, x]) => '<li><span class="base">' + esc(o.replace(/\.xml$/i, '')) + '</span><b>' + x.notas + ' notas</b></li>').join('') + '</ul></div>' : '') +
      '<div class="mural-c' + (op && r.cidadesSemPosicao ? ' aviso' : '') + '"><h3>Avisos</h3>' + (op && r.cidadesSemPosicao ? '<p class="aten" style="margin:0 0 6px"><b>' + r.cidadesSemPosicao + '</b> cidade(s) sem posição no mapa (nome não achado no IBGE). Elas continuam na lista de pendentes.</p>' : '<p class="sub" style="margin:0">Sem avisos.</p>') + '</div>' +
      '<div class="mural-c"><h3>Cópia de segurança</h3>' + (bk && bk.toDateString() === new Date().toDateString() ? '<b class="ok">Feita hoje às ' + bk.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</b>' : '<b class="aten">Nenhuma cópia nesta sessão</b>') + '<p class="sub" style="margin:6px 0 0;font-size:var(--fs-sm)">O app guarda uma cópia sozinho antes de ações destrutivas. Você também pode baixar o arquivo.</p>' + (op ? '<button class="btn mini" data-mural-bk type="button">Baixar cópia da operação</button>' : '') + '</div>' +
      '</div><p class="mural-dica">Esc volta para a tela anterior. Clique no logo para ver este mural de novo.</p></div>';
  }
  function baixarCopia(op) {
    U.baixar('health-route-' + N.norm(op.nome).replace(/[^A-Z0-9]+/g, '-').toLowerCase() + '-' + op.data + '.json', JSON.stringify({ formato: 'health-route-operacao', v: 1, versao_app: VERSAO, op }));
  }

  /* ================= configuração: fora de rota e alerta de valor ================= */
  S.cfg = { fora: {}, limite: null };
  async function carregarCfg() {
    try { const r = await DB.get('meta', 'config'); if (r && r.v) S.cfg = Object.assign({ fora: {}, limite: null }, r.v); } catch (e) { /* segue com o padrão */ }
    N.setAjustesRota(S.cfg.fora);
  }
  function salvarCfg() {
    N.setAjustesRota(S.cfg.fora); reindexar(); atualizarTudo();
    enviar({ t: 'cfg' });
    DB.put('meta', { k: 'config', v: S.cfg }).then(() => enviar({ t: 'cfg' })).catch(e => statusSalvo('erro', 'não consegui salvar as configurações: ' + ((e && e.message) || e)));
  }
  function alternarFora(key) {
    const c = S.idx && S.idx.cidades.get(key); if (!c) return;
    if (!c.code) { toast('Essa cidade não foi achada no IBGE; não dá para mudar a classificação dela.'); return; }
    const vaiFora = !c.fora; S.cfg.fora[c.code] = vaiFora ? 'fora' : 'rota';
    salvarCfg(); toast(c.nome + (vaiFora ? ' agora está FORA DE ROTA (continua no mapa e na lista de baixo).' : ' voltou para a rota.'));
  }

  /* ================= janelas flutuantes: a posição fica onde você deixou ================= */
  const JANS = { pend: '#jan-pend', carros: '#jan-carros', cid: '#jan-cid', busca: '#jan-busca' };
  const posJan = id => { const p = U.pref.ler('pos:' + id, null) || (id === 'pend' ? U.pref.ler('pendPos', null) : null); return p && isFinite(p.x) && isFinite(p.y) ? p : null; };
  function restaurarPos(id) { const j = $(JANS[id]), p = posJan(id); if (j && p) U.posicionar(j, $('#mapa-area'), p.x, p.y); }
  function janVer(id, vis) {
    const j = $(JANS[id]); j.hidden = !vis; U.pref.gravar('ver:' + id, vis);
    const b = $('#bt-ver-' + id); if (b) b.setAttribute('aria-pressed', String(vis));
    if (vis) { if (id === 'carros') renderJanCarros(); restaurarPos(id); }
  }

  /* ================= janela de veículos e rotas ================= */
  S.carAberto = new Set(); S.carExp = new Set(); S.selMov = new Set();
  const fmtLimite = c => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
  function notasDoVeiculoNaCidade(carId, key) { const c = S.idx.cidades.get(key); return c ? c.notas.filter(n => S.op.atrib[n.id] === carId) : []; }
  function veiculoHtml(rc) {
    const c = rc.carro, aberto = S.carAberto.has(c.id), acima = S.cfg.limite != null && rc.valor > S.cfg.limite;
    const rastro = c.rastreio === 'sim' ? 'Rastreio: SIM' : c.rastreio === 'nao' ? 'Rastreio: NÃO' : 'Rastreio: —';
    let h = '<div class="vei' + (c.id === S.carroAtivo ? ' ativo' : '') + '" data-car="' + c.id + '" style="--cor:' + c.cor + '"><div class="vei-cab"><b>' + esc(N.rotuloCarro(c)) + '</b>' +
      '<span class="vei-bt"><button type="button" class="rast ' + (c.rastreio || '') + '" data-rast="' + c.id + '" title="Marque se este veículo vai com rastreio (clique para alternar: sem marca → sim → não)">' + rastro + '</button><button type="button" data-ren="' + c.id + '" title="Motorista / nome" aria-label="Renomear">✎</button><button type="button" data-del="' + c.id + '" title="Excluir veículo" aria-label="Excluir">✕</button><button type="button" data-abrir="' + c.id + '" aria-label="' + (aberto ? 'Recolher' : 'Expandir') + '">' + (aberto ? '▾' : '▸') + '</button></span>' +
      '<span class="vei-tot">' + m$(rc.valor) + ' · ' + i$(rc.vol) + ' vol · ' + rc.paradas + ' parada' + (rc.paradas === 1 ? '' : 's') + ' · ' + N.fmtPeso(rc.peso) + ' kg · ' + rc.cidades.length + ' cidade(s)' + (kmTxt(kmDe(c)) ? ' · <span class="km">' + kmTxt(kmDe(c), true) + '</span>' : '') + '</span>' +
      (acima ? '<span class="vei-alerta">⚠ acima do limite de ' + m$(S.cfg.limite) + '</span>' : '') + '</div>';
    if (aberto) {
      h += '<ol class="vei-cid">' + (rc.cidades.length ? '' : '<li style="padding:4px 8px;color:var(--mudo);font-size:.8rem;list-style:none">Nenhuma cidade ainda.</li>');
      rc.cidades.forEach((cid, i) => {
        const nts = notasDoVeiculoNaCidade(c.id, cid.key), t = N.somar(nts), ex = S.carExp.has(c.id + '|' + cid.key);
        const marcadas = nts.filter(n => S.selMov.has(n.id)).length;
        h += '<li class="cid" draggable="true" data-car="' + c.id + '" data-i="' + i + '" data-k="' + esc(cid.key) + '"><span class="alca" title="Arraste para mudar a ordem">⠿</span><span class="ord">' + (i + 1) + '</span>' +
          '<span class="nm"><input type="checkbox" class="mv-cid" data-car="' + c.id + '" data-k="' + esc(cid.key) + '"' + (marcadas && marcadas === nts.length ? ' checked' : '') + ' aria-label="Selecionar as notas de ' + esc(cid.nome) + '" style="vertical-align:-2px;margin-right:6px"><span class="ir" data-go="' + esc(cid.key) + '" style="cursor:pointer">' + esc(cid.nome) + '</span><small>' + t.notas + ' nota' + (t.notas === 1 ? '' : 's') + ' · ' + m$(t.valor) + '</small></span>' +
          '<span class="bt"><button type="button" data-up="' + c.id + '|' + i + '" title="Subir" aria-label="Subir"' + (i === 0 ? ' disabled style="opacity:.3"' : '') + '>▲</button><button type="button" data-dn="' + c.id + '|' + i + '" title="Descer" aria-label="Descer"' + (i === rc.cidades.length - 1 ? ' disabled style="opacity:.3"' : '') + '>▼</button><button type="button" data-ex="' + c.id + '|' + esc(cid.key) + '" aria-label="Ver notas">' + (ex ? '▾' : '▸') + '</button></span></li>';
        if (ex) {
          const porCli = new Map(); for (const n of nts) { const k = N.chaveCliente(n); if (!porCli.has(k)) porCli.set(k, []); porCli.get(k).push(n); }
          h += '<li style="list-style:none"><ul class="vei-nts">' + [...porCli.values()].map(l => '<li><span class="cl">' + esc(l[0].cliente) + '</span></li>' + l.sort((a, b) => b.valor - a.valor).map(n =>
            '<li><input type="checkbox" class="mv-chk" data-n="' + esc(n.id) + '"' + (S.selMov.has(n.id) ? ' checked' : '') + ' aria-label="NF ' + esc(n.nf) + '"><span>NF ' + esc(n.nf) + ' · ' + i$(n.vol) + ' vol</span><span class="v">' + m$(n.valor) + '</span></li>').join('')).join('') + '</ul></li>';
        }
      });
      h += '</ol>';
    }
    return h + '</div>';
  }
  const ordemVeiculos = (a, b) => S.ordemCar === 'volume' ? (b.vol - a.vol || a.carro.id - b.carro.id) : S.ordemCar === 'valor' ? (b.valor - a.valor || a.carro.id - b.carro.id) : 0;
  function renderJanCarros() {
    const jan = $('#jan-carros'); if (jan.hidden) return;
    const corpo = $('#car-corpo'), op = S.op;
    if (!op || !S.res) { corpo.innerHTML = '<div class="vazio-lista">Sem operação aberta.</div>'; $('#car-qt').textContent = '0'; return; }
    const r = S.res, antes = $('.car-lista', corpo), rol = antes ? antes.scrollTop : 0;
    const emFoco = document.activeElement && document.activeElement.id === 'car-lim';
    $('#car-qt').textContent = String(op.carros.length);
    for (const id of [...S.selMov]) if (!S.idx.notaPorId.has(id) || op.atrib[id] == null) S.selMov.delete(id);
    let h = '<div class="car-res"><span><b>' + r.carros.filter(x => x.notas).length + '</b> rodando</span><span><b>' + m$(r.aloc.valor) + '</b></span><span><b>' + i$(r.aloc.vol) + '</b> vol</span>' +
      '<label class="car-lim" title="Opcional. Regra sua: o app só avisa quando o valor de um veículo passa deste número.">alerta acima de R$ <input id="car-lim" class="filtro" inputmode="decimal" placeholder="sem limite" value="' + fmtLimite(S.cfg.limite) + '"></label></div>' +
      '<div class="car-lista">' + (r.carros.length ? r.carros.slice().sort(ordemVeiculos).map(veiculoHtml).join('') : '<div class="vazio-lista">Nenhum veículo ainda. Use + Carro, + Van ou + Caminhão.</div>') + '</div>';
    if (S.selMov.size) {
      const ns = [...S.selMov].map(id => S.idx.notaPorId.get(id)), t = N.somar(ns);
      h += '<div class="car-mover"><b>' + ns.length + ' nota' + (ns.length === 1 ? '' : 's') + '</b> · ' + m$(t.valor) + ' → mover para <select id="mv-dest" class="filtro">' + op.carros.map(c => '<option value="' + c.id + '">' + esc(N.rotuloCarro(c)) + '</option>').join('') + '</select>' +
        '<button type="button" class="btn mini pri" data-mv="mover">Mover</button><button type="button" class="btn mini" data-mv="tirar">Tirar do veículo</button><button type="button" class="btn mini" data-mv="limpar">Limpar</button></div>';
    }
    corpo.innerHTML = h;
    const nova = $('.car-lista', corpo); if (nova) nova.scrollTop = rol;
    if (emFoco) { const i = $('#car-lim'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
  function moverNotas(ids, dest, rotulo) {
    if (!ids.length) return;
    mutar(rotulo, () => N.alocar(S.op, S.idx, ids, dest));
    S.selMov.clear(); renderJanCarros();
    toast(ids.length + ' nota(s) ' + (dest == null ? 'saíram do veículo.' : '→ ' + nomeId(dest) + '.'), { rotulo: 'Desfazer', fn: desfazer });
  }
  function ligarJanCarros() {
    const jan = $('#jan-carros'), corpo = $('#car-corpo');
    U.arrastavel(jan, '.jan-cab', $('#mapa-area'), p => U.pref.gravar('pos:carros', p));
    $('#car-min').onclick = () => { const r = jan.classList.toggle('recolhida'); $('#car-min').textContent = r ? '+' : '–'; };
    $('#car-x').onclick = () => janVer('carros', false);
    corpo.addEventListener('click', e => {
      const t = e.target;
      let m;
      if ((m = t.closest('[data-rast]'))) { const c = carroPorId(+m.dataset.rast); const prox = { null: 'sim', sim: 'nao', nao: null }[String(c.rastreio || null)]; return mutar('rastreio de ' + N.nomeCarro(c), () => { c.rastreio = prox; }); }
      if ((m = t.closest('[data-ren]'))) return renomearCarro(+m.dataset.ren);
      if ((m = t.closest('[data-del]'))) return excluirCarro(+m.dataset.del);
      if ((m = t.closest('[data-up]'))) { const [id, i] = m.dataset.up.split('|').map(Number); return mutar('ordem das paradas', () => N.moverCidade(S.op, id, i, i - 1)); }
      if ((m = t.closest('[data-dn]'))) { const [id, i] = m.dataset.dn.split('|').map(Number); return mutar('ordem das paradas', () => N.moverCidade(S.op, id, i, i + 1)); }
      if ((m = t.closest('[data-ex]'))) { const k = m.dataset.ex; S.carExp.has(k) ? S.carExp.delete(k) : S.carExp.add(k); return renderJanCarros(); }
      if ((m = t.closest('[data-go]'))) { return abrirCidade(m.dataset.go, { centrar: true }); }
      if ((m = t.closest('[data-mv]'))) {
        const ids = [...S.selMov], a = m.dataset.mv;
        if (a === 'limpar') { S.selMov.clear(); return renderJanCarros(); }
        if (a === 'tirar') return moverNotas(ids, null, 'tirar notas do veículo');
        const dest = +$('#mv-dest').value; return moverNotas(ids.filter(id => S.op.atrib[id] !== dest), dest, 'mover notas');
      }
      if (t.closest('input,select')) return;
      const cab = t.closest('.vei-cab'), vei = t.closest('.vei');
      if (cab && vei) { const id = +vei.dataset.car; S.carAberto.has(id) ? S.carAberto.delete(id) : S.carAberto.add(id); selecionarCarro(id); renderJanCarros(); }
    });
    corpo.addEventListener('change', e => {
      const t = e.target;
      if (t.classList.contains('mv-chk')) { t.checked ? S.selMov.add(t.dataset.n) : S.selMov.delete(t.dataset.n); renderJanCarros(); }
      else if (t.classList.contains('mv-cid')) { for (const n of notasDoVeiculoNaCidade(+t.dataset.car, t.dataset.k)) t.checked ? S.selMov.add(n.id) : S.selMov.delete(n.id); renderJanCarros(); }
      else if (t.id === 'car-lim') { const v = t.value.trim(); if (!v) S.cfg.limite = null; else { const d = N.dec(v, 2); if (!d.ok || d.v < 0) { toast('Valor inválido.'); return; } S.cfg.limite = d.v; } salvarCfg(); }
    });
    /* arrastar e soltar a ordem das paradas (os botões ▲▼ fazem o mesmo, para teclado e toque) */
    let arr = null;
    corpo.addEventListener('dragstart', e => { const li = e.target.closest('li.cid'); if (!li) return; arr = { car: +li.dataset.car, i: +li.dataset.i }; li.classList.add('arrastando'); try { e.dataTransfer.setData('text/plain', 'cidade'); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ok */ } });
    corpo.addEventListener('dragover', e => { const li = e.target.closest('li.cid'); if (!arr || !li || +li.dataset.car !== arr.car) return; e.preventDefault(); $$('li.cid.alvo', corpo).forEach(x => x.classList.remove('alvo')); li.classList.add('alvo'); });
    corpo.addEventListener('drop', e => { const li = e.target.closest('li.cid'); if (!arr || !li || +li.dataset.car !== arr.car) { arr = null; return; } e.preventDefault(); const de = arr.i, para = +li.dataset.i, car = arr.car; arr = null; if (de !== para) mutar('ordem das paradas', () => N.moverCidade(S.op, car, de, para)); else renderJanCarros(); });
    corpo.addEventListener('dragend', () => { arr = null; $$('li.cid.arrastando,li.cid.alvo', corpo).forEach(x => x.classList.remove('arrastando', 'alvo')); });
  }

  /* ================= geolocalização (regiões e bases, como no Health Search) ================= */
  const CORES_REG = ['#2A9D8F', '#E07A1F', '#7B5CC4', '#D1495B', '#3A86C8', '#137F7A', '#3D5A80', '#B5651D', '#4C9A2A', '#C77DFF', '#E9A23B', '#6D597A', '#2B9348', '#BC4749'];
  S.geo = { mapa: null, tipo: 'regiao', sel: null, foco: null };
  async function carregarReg() {
    let base = null;
    try { base = await (await fetch('data/regioes.json')).json(); } catch (e) { console.warn('regiões originais não carregaram', e); }
    S.regBase = base;
    let usar = null;
    try { const r = await DB.get('meta', 'regioes'); if (r && r.v && Array.isArray(r.v.regioes)) usar = r.v; } catch (e) { /* usa as originais */ }
    S.reg = usar || (base ? JSON.parse(JSON.stringify(base)) : { regioes: [] });
    N.setRegioes(S.reg);
  }
  function salvarReg() {
    N.setRegioes(S.reg);
    DB.put('meta', { k: 'regioes', v: S.reg }).then(() => enviar({ t: 'cfg' })).catch(e => statusSalvo('erro', 'não consegui salvar as regiões: ' + ((e && e.message) || e)));
    reindexar(); atualizarTudo(); renderGeo();
  }
  const munInfo = code => (S.mun && S.mun[code]) ? { code, nome: S.mun[code][0], uf: S.mun[code][1], lat: S.mun[code][2], lon: S.mun[code][3] } : null;
  function geoGarantirMapa() {
    if (S.geo.mapa) return S.geo.mapa;
    const m = S.geo.mapa = new RT.Mapa($('#geo-box'), {
      onClique: h => { if (h) geoSelecionar(h.code, false); },
      onHover: (h, e) => { const t = $('#geo-tip'); if (!h) { t.hidden = true; return; } const rs = (S.reg.regioes || []).filter(r => r.cidades.includes(h.code)).map(r => r.nome); t.innerHTML = '<b>' + esc(h.nome) + (h.uf ? '/' + esc(h.uf) : '') + '</b>' + (rs.length ? '<br>' + esc(rs.join(' · ')) : '<br>sem lista'); t.hidden = false; const a = $('#geo-box').getBoundingClientRect(); t.style.left = Math.min(a.width - 270, e.clientX - a.left + 14) + 'px'; t.style.top = Math.max(4, e.clientY - a.top + 14) + 'px'; },
      onMover: () => { $('#geo-tip').hidden = true; }
    }, { semBase: true });
    m.setPoligonosDe(S.mapa);
    if (S.mun) m.setTodas(Object.entries(S.mun).filter(([c]) => S.mapa.poli.has(c)).map(([c, v]) => ({ code: c, nome: v[0], uf: v[1], lat: v[2], lon: v[3] })));
    return m;
  }
  function geoSelecionar(code, centrar) {
    S.geo.sel = code; renderGeo();
    const i = munInfo(code); if (i && centrar && S.geo.mapa) S.geo.mapa.enquadrarPontos([{ lat: i.lat + 0.6, lon: i.lon - 0.8 }, { lat: i.lat - 0.6, lon: i.lon + 0.8 }]);
  }
  function renderGeo() {
    if (tela !== 'geo' || !S.reg) return;
    const m = geoGarantirMapa(), tipo = S.geo.tipo, regs = S.reg.regioes;
    const cor = new Map();
    for (const r of regs) if (r.tipo === tipo) for (const c of r.cidades) if (!cor.has(c)) cor.set(c, r.cor || '#888');
    if (S.geo.foco) { const rf = regs.find(r => r.id === S.geo.foco); if (rf) for (const c of [...cor.keys()]) if (!rf.cidades.includes(c)) cor.delete(c); }
    m.setGeo({ cor, sel: S.geo.sel });
    for (const b of $$('[data-geo-tipo]')) b.setAttribute('aria-pressed', String(b.dataset.geoTipo === tipo));
    $('#geo-leg').innerHTML = regs.filter(r => r.tipo === tipo).map(r => '<span style="--cor:' + (r.cor || '#888') + '"><i></i>' + esc(r.nome) + '</span>').join('') || '<span>Nenhuma lista desse tipo.</span>';
    /* cartão da cidade escolhida */
    const card = $('#geo-res'), i = S.geo.sel && munInfo(S.geo.sel);
    if (!i) card.innerHTML = '<p class="vazio-g">Clique numa cidade do mapa, ou digite o nome acima, para ver a região e a base dela.</p>';
    else {
      const fora = N.foraDeRota(i.code, i.uf), aj = S.cfg.fora[i.code];
      const bloco = (tp, rot) => {
        const em = regs.filter(r => r.tipo === tp && r.cidades.includes(i.code)), ops = regs.filter(r => r.tipo === tp).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
        const et = r => '<span class="geo-et"><i style="background:' + (r.cor || '#888') + '"></i>' + esc(r.nome) + '</span>';
        const corpo = em.length ? em.map(et).join('<br>') + (em.length > 1 ? '<p class="geo-expl">A cidade está em ' + em.length + ' listas.</p>' : '') : '<span class="geo-et">Nenhuma</span><p class="geo-expl">Esta cidade não está em nenhuma lista de ' + (tp === 'base' ? 'bases' : 'regiões') + '.</p>';
        const atual = em.length === 1 ? em[0].id : '';
        const ens = '<div class="geo-ensinar"><select data-geo-sel="' + tp + '" aria-label="' + (em.length ? 'Mover para outra' : 'Colocar numa') + ' ' + rot + '"><option value="">' + (em.length > 1 ? 'Está em ' + em.length + ' listas — deixar só em…' : em.length ? 'Mover para…' : 'Colocar em…') + '</option>' +
          ops.map(r => '<option value="' + esc(r.id) + '"' + (r.id === atual ? ' disabled' : '') + '>' + esc(r.nome) + '</option>').join('') + (em.length ? '<option value="-">Nenhuma (tirar das listas)</option>' : '') + '</select>' +
          '<button class="btn mini pri" type="button" data-geo-mover="' + tp + '">' + (em.length ? 'Mover' : 'Ensinar') + '</button></div>';
        return '<div class="geo-linha"><div class="rotulo">' + rot + ' <span class="geo-fonte ' + (em.length ? 'lista' : 'fora') + '">' + (em.length ? 'na lista' : 'fora das listas') + '</span></div>' + corpo + ens + '</div>';
      };
      const doCid = S.idx && S.idx.lista ? S.idx.lista.find(c => String(c.code) === String(i.code)) : null, tt = doCid ? N.somar(doCid.notas) : null;
      card.innerHTML = '<h2>' + esc(i.nome) + '/' + esc(i.uf) + '</h2><div class="ibge">IBGE ' + esc(i.code) + '</div>' + bloco('regiao', 'Região (rota)') + bloco('base', 'Base') +
        '<div class="geo-linha"><div class="rotulo">Conta como</div><span class="geo-st ' + (fora ? 'fora' : 'rota') + '">' + (fora ? 'FORA DE ROTA' : 'EM ROTA') + '</span>' + (aj ? ' <small>ajuste manual · <button type="button" class="lib" data-geo-aj="limpar">voltar ao automático</button></small>' : '') +
        '<div style="margin-top:8px"><button type="button" class="btn mini" data-geo-aj="' + (fora ? 'rota' : 'fora') + '">' + (fora ? 'Contar como em rota' : 'Contar como fora de rota') + '</button></div></div>' +
        '<div class="geo-linha"><div class="rotulo">Na operação aberta</div>' + (tt && tt.notas ? '<p class="geo-expl" style="font-size:var(--fs)">' + i$(tt.notas) + ' nota(s), ' + i$(tt.vol) + ' volume(s), ' + m$(tt.valor) + '</p>' : '<p class="geo-expl">Nenhuma nota desta cidade.</p>') + '</div>' +
        (S.geo.desfazer ? '<div class="geo-linha"><button type="button" class="btn mini" data-geo-desf="1">↶ Desfazer a última mudança de lista</button></div>' : '');

    }
    /* listas cadastradas */
    $('#geo-listas').innerHTML = regs.map(r => '<div class="geo-lista" style="--cor:' + (r.cor || '#888') + '"><i></i><span><b>' + esc(r.nome) + '</b> <small>' + (r.tipo === 'base' ? 'base' : 'região') + ' · ' + r.cidades.length + ' cidades</small></span>' +
      '<select class="filtro" data-geo-grupo="' + esc(r.id) + '" aria-label="Conta como" style="min-height:30px;padding:2px 6px"><option value="rota"' + (r.grupo !== 'fora' ? ' selected' : '') + '>Em rota</option><option value="fora"' + (r.grupo === 'fora' ? ' selected' : '') + '>Fora de rota</option></select>' +
      '<button type="button" class="btn mini" data-geo-ver="' + esc(r.id) + '">' + (S.geo.foco === r.id ? 'Ver todas' : 'Ver no mapa') + '</button><button type="button" class="btn mini perigo" data-geo-del="' + esc(r.id) + '">Excluir</button></div>').join('');
  }
  async function geoColarLista() {
    const nome = $('#geo-c-nome').value.trim(), txt = $('#geo-c-txt').value, res = $('#geo-c-res');
    if (!nome) { res.textContent = 'Dê um nome para a lista.'; return; }
    const codes = [], naoAchei = [], ambiguas = [];
    for (const lin of txt.split(/\r?\n/)) {
      const t = lin.trim(); if (!t) continue;
      const [cn, uf] = t.split('/').map(x => x.trim());
      const r = N.achaMunicipios(cn, uf || '');
      if (!r.length) naoAchei.push(t); else if (r.length > 1) { ambiguas.push(cn + ' (' + r.map(x => x.uf).join('/') + ')'); } else if (!codes.includes(r[0].code)) codes.push(r[0].code);
    }
    if (!codes.length) { res.textContent = 'Não achei nenhuma cidade no texto.'; return; }
    const tipo = $('#geo-c-tipo').value, grupo = $('#geo-c-grupo').value;
    const ex = S.reg.regioes.find(r => N.norm(r.nome) === N.norm(nome));
    if (ex && !(await U.confirmar('Já existe "' + ex.nome + '"', 'Substituir a lista pelas ' + codes.length + ' cidades coladas?', 'Substituir'))) return;
    if (ex) { ex.cidades = codes; ex.tipo = tipo; ex.grupo = grupo; }
    else S.reg.regioes.push({ id: 'l' + Date.now().toString(36), nome, tipo, grupo, cor: CORES_REG[S.reg.regioes.length % CORES_REG.length], cidades: codes });
    salvarReg();
    res.innerHTML = '<b>' + codes.length + '</b> cidade(s) na lista “' + esc(nome) + '”.' + (naoAchei.length ? ' <b>Não achei:</b> ' + esc(naoAchei.slice(0, 12).join('; ')) + '.' : '') + (ambiguas.length ? ' <b>Nome em mais de um estado (use /UF):</b> ' + esc(ambiguas.slice(0, 10).join('; ')) + '.' : '');
  }
  function ligarGeo() {
    const q = $('#geo-q'), sug = $('#geo-sug');
    const achar = () => {
      const t = N.norm(q.value); if (t.length < 2 || !S.mun) { sug.hidden = true; return []; }
      const r = Object.entries(S.mun).filter(([c, v]) => N.norm(v[0]).includes(t)).slice(0, 9);
      sug.innerHTML = r.map(([c, v]) => '<li data-code="' + c + '"><span>' + esc(v[0]) + '</span><span class="tag">' + esc(v[1]) + '</span></li>').join(''); sug.hidden = !r.length; return r;
    };
    q.addEventListener('input', achar);
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { const r = achar(); if (r[0]) { geoSelecionar(r[0][0], true); sug.hidden = true; } } });
    sug.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { geoSelecionar(li.dataset.code, true); sug.hidden = true; q.value = ''; } });
    q.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 150));
    for (const b of $$('[data-geo-tipo]')) b.onclick = () => { S.geo.tipo = b.dataset.geoTipo; S.geo.foco = null; renderGeo(); };
    $('#geo-z-mais').onclick = () => S.geo.mapa && S.geo.mapa.zoom(1.5); $('#geo-z-menos').onclick = () => S.geo.mapa && S.geo.mapa.zoom(1 / 1.5);
    $('#geo-ver-tudo').onclick = () => { S.geo.foco = null; geoEnquadrarTudo(); renderGeo(); };
    $('#geo-res').addEventListener('click', e => {
      const i = S.geo.sel && munInfo(S.geo.sel); if (!i) return;
      const mov = e.target.closest('[data-geo-mover]'), aj = e.target.closest('[data-geo-aj]'), desf = e.target.closest('[data-geo-desf]');
      if (mov) {
        const tp = mov.dataset.geoMover, sel = mov.parentElement.querySelector('select'); if (!sel.value) { toast('Escolha a lista na caixa ao lado.'); return; }
        S.geo.desfazer = JSON.stringify(S.reg);
        const de = [];
        for (const l of S.reg.regioes) if (l.tipo === tp && l.cidades.includes(i.code) && l.id !== sel.value) { l.cidades = l.cidades.filter(c => c !== i.code); de.push(l.nome); }
        const dest = sel.value === '-' ? null : S.reg.regioes.find(x => x.id === sel.value); if (dest && !dest.cidades.includes(i.code)) dest.cidades.push(i.code);
        salvarReg(); toast(i.nome + ': ' + (dest ? 'agora em ' + dest.nome : 'tirada das listas') + (de.length ? ' (saiu de ' + de.join(', ') + ')' : '') + '. Já vale em todo o programa.');
      } else if (desf) { if (S.geo.desfazer) { S.reg = JSON.parse(S.geo.desfazer); S.geo.desfazer = null; salvarReg(); toast('Última mudança de lista desfeita.'); } }
      if (aj) { const v = aj.dataset.geoAj; if (v === 'limpar') delete S.cfg.fora[i.code]; else S.cfg.fora[i.code] = v; salvarCfg(); renderGeo(); }
    });
    $('#geo-listas').addEventListener('click', async e => {
      const ver = e.target.closest('[data-geo-ver]'), del = e.target.closest('[data-geo-del]');
      if (ver) { const id = ver.dataset.geoVer; S.geo.foco = S.geo.foco === id ? null : id; const r = S.reg.regioes.find(x => x.id === id); if (S.geo.foco && r) { S.geo.tipo = r.tipo; S.geo.mapa.enquadrarPontos(r.cidades.map(munInfo).filter(Boolean)); } renderGeo(); }
      if (del) { const r = S.reg.regioes.find(x => x.id === del.dataset.geoDel); if (r && await U.confirmar('Excluir “' + r.nome + '”?', 'A lista (' + r.cidades.length + ' cidades) sai daqui. “Restaurar listas originais” traz de volta as do Health Search.', 'Excluir lista', true)) { S.reg.regioes = S.reg.regioes.filter(x => x !== r); salvarReg(); } }
    });
    $('#geo-listas').addEventListener('change', e => { const g = e.target.closest('[data-geo-grupo]'); if (!g) return; const r = S.reg.regioes.find(x => x.id === g.dataset.geoGrupo); if (r) { r.grupo = g.value; salvarReg(); toast('“' + r.nome + '” agora conta como ' + (r.grupo === 'fora' ? 'FORA de rota.' : 'em rota.')); } });
    $('#geo-orig').onclick = async () => {
      if (!S.regBase) { toast('As listas originais não estão disponíveis.'); return; }
      if (!(await U.confirmar('Restaurar as listas originais?', 'Suas edições nas regiões e bases são descartadas e voltam as listas que vieram do Health Search.', 'Restaurar', true))) return;
      if (!(await backupReg())) return;
      S.reg = JSON.parse(JSON.stringify(S.regBase)); try { await DB.apagar('meta', 'regioes'); } catch (e) { /* ok */ }
      N.setRegioes(S.reg); reindexar(); atualizarTudo(); renderGeo(); toast('Listas originais restauradas.');
    };
    $('#geo-c-ok').onclick = geoColarLista;
  }
  async function backupReg() { try { await DB.put('bk', { opId: 'regioes', nome: 'Regiões e bases', quando: new Date().toISOString(), motivo: 'antes de restaurar as listas originais', rev: 0, op: { notas: [], carros: [], atrib: {}, regioes: structuredClone(S.reg) } }); return true; } catch (e) { toast('⚠ Não consegui guardar a cópia das regiões: ' + ((e && e.message) || e)); return false; } }
  function geoEnquadrarTudo() {
    const pts = []; for (const r of S.reg.regioes) if (r.tipo === 'regiao' && r.grupo !== 'fora') for (const c of r.cidades) { const i = munInfo(c); if (i) pts.push(i); }
    if (S.geo.mapa) S.geo.mapa.enquadrarPontos(pts.length ? pts : [{ lat: -15, lon: -55 }, { lat: -25, lon: -45 }]);
  }

  /* ================= mapa em outra tela (segundo monitor) ================= */
  const enviar = m => { try { if (S.canal) S.canal.postMessage(m); } catch (e) { /* sem canal: segue sozinho */ } };
  function entrarParede(sim) {
    S.parede = !!sim;
    $('#mapa-area').classList.toggle('parede', S.parede);
    S.mapa.setPausado(S.parede);
    const b = $('#bt-mapa-fora'); b.textContent = S.parede ? 'Trazer o mapa de volta' : 'Mapa em outra tela'; b.setAttribute('aria-pressed', String(S.parede));
    if (!S.parede) { requestAnimationFrame(() => { S.mapa.redimensionar(); S.mapa.marcar(); }); }
  }
  function abrirMapaExterno() {
    if (S.parede && S.ext && !S.ext.closed) { try { S.ext.close(); } catch (e) { /* ok */ } entrarParede(false); S.ext = null; return; }
    const w = window.open(location.pathname + '?mapa=1', 'hr-mapa', 'popup=yes,width=1400,height=900');
    if (!w) { toast('O navegador bloqueou a nova janela. Libere pop-ups para este endereço e tente de novo.'); return; }
    S.ext = w; entrarParede(true); toast('Mapa aberto em outra janela. Arraste-a para o outro monitor (a tela cheia é F11).');
    /* melhor esforço: se o navegador deixar, leva a janela para o outro monitor */
    (async () => { try { if (window.getScreenDetails) { const d = await window.getScreenDetails(), o = d.screens.find(s => s !== d.currentScreen); if (o) { w.moveTo(o.availLeft, o.availTop); w.resizeTo(o.availWidth, o.availHeight); } } } catch (e) { /* sem permissão: tudo bem */ } })();
    const t = setInterval(() => { if (!S.ext || S.ext.closed) { clearInterval(t); if (S.parede) { entrarParede(false); toast('A janela do mapa foi fechada. O mapa voltou para esta tela.'); } S.ext = null; } }, 700);
  }
  async function recarregarDoBanco(id) {
    try {
      const [c, r] = [await DB.get('meta', 'config'), await DB.get('meta', 'regioes')];
      if (c && c.v) S.cfg = Object.assign({ fora: {}, limite: null }, c.v); N.setAjustesRota(S.cfg.fora);
      if (r && r.v && Array.isArray(r.v.regioes)) { S.reg = r.v; N.setRegioes(S.reg); }
      const op = id ? await DB.get('ops', id) : null;
      if (op) { S.op = op; if (!carroPorId(S.carroAtivo) && op.carros.length) S.carroAtivo = op.carros[0].id; }
      reindexar(); atualizarTudo();
    } catch (e) { console.warn('não consegui atualizar a partir do banco', e); }
  }
  function ligarCanal() {
    if (typeof BroadcastChannel === 'undefined') return;
    S.canal = new BroadcastChannel('health-route');
    S.canal.onmessage = ev => {
      const m = ev.data || {};
      if (S.modoMapa) { // janela do mapa: só recebe e desenha
        if (m.t === 'op' || m.t === 'cfg') recarregarDoBanco(m.id || (S.op && S.op.id));
        else if (m.t === 'sel') { S.cidadeAberta = m.key; S.mapa.setSelecionada(m.key); if (m.key && m.centrar) S.mapa.centrarEm(m.key, 140); }
        else if (m.t === 'tema') aplicarTemaAtual();
      } else { // janela principal
        if (m.t === 'clique' && S.parede) abrirCidade(m.key, { centrar: false });
        else if (m.t === 'pronto') { if (S.op) enviar({ t: 'op', id: S.op.id, rev: S.op.rev }); enviar({ t: 'sel', key: S.cidadeAberta }); }
      }
    };
    if (S.modoMapa) { window.addEventListener('pagehide', () => enviar({ t: 'fechou' })); }
  }
  function aplicarTemaAtual() { document.documentElement.setAttribute('data-tema', U.pref.ler('tema', 'escuro') === 'claro' ? 'claro' : 'escuro'); S.mapa && S.mapa.temaMudou(); }

  /* ================= base de saída e fundo de estradas ================= */
  function aplicarBase() {
    if (!S.mun) return;
    const code = S.cfg.base || '3503208', i = munInfo(code); // Araraquara (AQA) é o padrão
    S.mapa.setBase(i ? { lat: i.lat, lon: i.lon, nome: i.nome, sigla: code === '3503208' ? 'AQA' : i.nome.slice(0, 3).toUpperCase() } : null);
    S.mapa.setMostrarBase(S.cfg.mostrarBase !== false);
    const b = $('#bt-base'); if (b) b.setAttribute('aria-pressed', String(S.cfg.mostrarBase !== false));
  }

  /* ================= rodovias: o traçado de cidade em cidade e o KM ================= */
  const seqDoVeiculo = car => { const cids = car.cidades.map(k => S.idx && S.idx.cidades.get(k)).filter(c => c && c.lat != null); const b = S.mapa.base && S.mapa.mostrarBase ? [S.mapa.base] : []; return [...b, ...cids]; };
  const pernasDe = (seq, comVolta) => {
    const o = []; for (let i = 1; i < seq.length; i++) if (!RT.vias.igual(seq[i - 1], seq[i])) o.push([seq[i - 1], seq[i]]);
    if (comVolta && S.mapa.base && S.mapa.mostrarBase && seq.length > 1 && !RT.vias.igual(seq[seq.length - 1], seq[0])) o.push([seq[seq.length - 1], seq[0]]); // a volta à base
    return o;
  };
  /* KM do veículo pelas rodovias (ida: da base até a última parada). Estimativa: sem trânsito, sem o percurso dentro das cidades. */
  function kmDe(car) {
    const ps = pernasDe(seqDoVeiculo(car), true), volta = !!(S.mapa.base && S.mapa.mostrarBase); let km = 0, min = 0, faltam = 0;
    for (const [a, b] of ps) { const p = S.mapa.pernas.get(RT.vias.chave(a, b)); if (p) { km += p.km; min += p.min; } else faltam++; }
    return { km, min, faltam, n: ps.length, volta };
  }
  const kmTxt = (k, longo) => !k.n ? '' : (k.faltam ? 'calculando km…' : '≈ ' + Math.round(k.km).toLocaleString('pt-BR') + ' km' + (longo ? (k.volta ? ' (ida e volta)' : ' (entre as paradas)') : ''));
  function atualizarVias() {
    if (!S.res || !S.mapa) return;
    for (const rc of S.res.carros) for (const [a, b] of pernasDe(seqDoVeiculo(rc.carro), true)) {
      const k = RT.vias.chave(a, b); if (S.mapa.pernas.has(k)) continue;
      RT.vias.pedir(a, b).then(p => { if (p && !S.mapa.pernas.has(k)) S.mapa.setPerna(k, p); statusVias(); });
    }
    statusVias();
  }
  function statusVias() {
    const el = $('#vias-st'); if (!el) return; const V = RT.vias, pend = V.pendentes();
    let falta = 0; if (S.res) for (const rc of S.res.carros) falta += kmDe(rc.carro).faltam;
    if (!S.mapa.viasLigadas) { el.hidden = true; return; }
    if (pend) { el.hidden = false; el.className = 'vias-st'; el.textContent = 'Traçando as rodovias… ' + pend + ' trecho(s)'; }
    else if (falta && V.ultimoErro) { el.hidden = false; el.className = 'vias-st erro'; el.textContent = 'Sem rodovias agora (' + V.ultimoErro + '). Mostrando linhas curvas.'; }
    else el.hidden = true;
  }

  /* ================= configurações (só deste aparelho) ================= */
  async function carregarApiKey() { try { const r = await DB.get('meta', 'meudanfe'); S.apiKey = (r && r.v) || ''; } catch (e) { S.apiKey = ''; } }
  function renderConfig() {
    $('#cfg-md').value = '';
    $('#cfg-md').placeholder = S.apiKey ? '••••••••••••••••  (chave guardada — cole outra para trocar)' : 'Cole a Api-Key aqui';
    const bi = munInfo(S.cfg.base || '3503208'); $('#cfg-base').value = bi ? bi.nome + '/' + bi.uf : ''; $('#cfg-base-st').textContent = bi ? 'Base atual: ' + bi.nome + '/' + bi.uf + '.' : '';
    $('#cfg-md-st').textContent = S.apiKey ? '✓ Há uma Api-Key guardada neste aparelho.' : 'Nenhuma Api-Key guardada. A bipagem funciona sem ela, mas as notas fora dos XMLs vão para o Romaneio Extra para você preencher à mão.';
  }
  function ligarConfig() {
    $('#cfg-base-ok').onclick = () => {
      const t = $('#cfg-base').value.trim(), [nome, uf] = t.split('/').map(x => x.trim()), r = N.achaMunicipios(nome, uf || '');
      if (!r.length) { toast('Não achei essa cidade. Escreva o nome e a UF (ex.: Araraquara/SP).'); return; }
      if (r.length > 1) { toast('Há mais de uma cidade com esse nome: escreva com a UF (ex.: ' + r[0].nome + '/' + r[0].uf + ').'); return; }
      S.cfg.base = r[0].code; salvarCfg(); aplicarBase(); renderConfig(); toast('Base de saída: ' + r[0].nome + '/' + r[0].uf + '.');
    };
    $('#cfg-md-ok').onclick = async () => {
      const v = $('#cfg-md').value.trim();
      if (!v) { toast('Cole a Api-Key primeiro.'); return; }
      if (v.length > 1024 || /[\u0000-\u001f\u007f\s]/.test(v)) { toast('Essa Api-Key tem caracteres que não podem existir numa chave. Cole de novo.'); return; }
      try { await DB.put('meta', { k: 'meudanfe', v }); S.apiKey = v; renderConfig(); toast('Api-Key guardada neste aparelho.'); } catch (e) { toast('⚠ Não consegui guardar a chave: ' + ((e && e.message) || e)); }
    };
    $('#cfg-md-rm').onclick = async () => {
      if (!S.apiKey) { toast('Não há chave guardada.'); return; }
      if (!(await U.confirmar('Remover a Api-Key?', 'A bipagem deixa de buscar no Meu Danfe neste aparelho. Você pode colar a chave de novo quando quiser.', 'Remover', true))) return;
      try { await DB.apagar('meta', 'meudanfe'); S.apiKey = ''; renderConfig(); toast('Api-Key removida.'); } catch (e) { toast('⚠ ' + ((e && e.message) || e)); }
    };
  }

  /* ================= eventos ================= */
  function ligar() {
    for (const b of $$('.nav button')) b.addEventListener('click', () => irPara(b.dataset.tela));
    $('#marca').addEventListener('click', muralAbrir);
    $('#marca').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); muralAbrir(); } });
    document.addEventListener('click', e => {
      const ir = e.target.closest('[data-ir]'); if (ir) { muralFechar(); irPara(ir.dataset.ir); return; }
      if (e.target.id === 'mural-x') muralFechar();
      if (e.target.closest('[data-mural-bk]') && S.op) baixarCopia(S.op);
    });
    $('#bt-mapa-fora').onclick = abrirMapaExterno;
    $('#bt-novo-carro').onclick = () => novoVeiculo('carro');
    $('#bt-novo-van').onclick = () => novoVeiculo('van');
    $('#bt-novo-caminhao').onclick = () => novoVeiculo('caminhao');
    $('#bt-desfazer').onclick = desfazer;
    $('#bt-enquadrar').onclick = e => (ajustarPadMapa(), S.mapa.enquadrar(null, e.shiftKey));
    $('#bt-ver-pend').onclick = () => janVer('pend', $('#jan-pend').hidden);
    $('#bt-ver-carros').onclick = () => janVer('carros', $('#jan-carros').hidden);
    $('#pend-x').onclick = () => janVer('pend', false);
    ligarJanCarros(); ligarGeo(); ligarConfig(); RT.sit.ligar(); RT.rom.ligar();
    window.addEventListener('resize', () => { for (const id of ['pend', 'carros', 'cid', 'busca']) { const j = $(JANS[id]); if (j && !j.hidden && j.style.left) U.posicionar(j, $('#mapa-area'), parseFloat(j.style.left), parseFloat(j.style.top)); } });
    $('#aviso-fora').onclick = () => { ajustarPadMapa(); S.mapa.enquadrar(null, true); };
    $('#bt-estradas').onclick = () => { const v = $('#bt-estradas').getAttribute('aria-pressed') !== 'true'; $('#bt-estradas').setAttribute('aria-pressed', String(v)); U.pref.gravar('estradas', v); S.mapa.setEstradas(v); };
    const REAL = ['forte', 'suave', 'nenhum'], rotuloReal = v => 'Realce: ' + v;
    $('#bt-realce').onclick = () => { const v = REAL[(REAL.indexOf(S.mapa.realce) + 1) % 3]; U.pref.gravar('realce', v); S.mapa.setRealce(v); $('#bt-realce').textContent = rotuloReal(v); };
    $('#bt-vias').onclick = () => { const v = $('#bt-vias').getAttribute('aria-pressed') !== 'true'; $('#bt-vias').setAttribute('aria-pressed', String(v)); U.pref.gravar('vias', v); S.mapa.setVias(v); if (v) atualizarVias(); statusVias(); };
    $('#bt-base').onclick = () => { S.cfg.mostrarBase = S.cfg.mostrarBase === false; salvarCfg(); aplicarBase(); };
    $('#z-mais').onclick = () => S.mapa.zoom(1.5); $('#z-menos').onclick = () => S.mapa.zoom(1 / 1.5);

    /* chips de carro */
    $('#chips-carros').addEventListener('click', e => {
      const b = e.target.closest('.chip-carro'); if (!b) return; const id = +b.dataset.id;
      const ac = e.target.closest('[data-ac]');
      if (ac) { ac.dataset.ac === 'ren' ? renomearCarro(id) : excluirCarro(id); return; }
      selecionarCarro(id);
      const rc = S.res && S.res.carros.find(x => x.carro.id === id); // clicar no veículo enquadra a rota dele
      if (rc && rc.carro.cidades.length) { ajustarPadMapa(); S.mapa.enquadrar(rc.carro.cidades); }
    });
    $('#chips-carros').addEventListener('dblclick', e => { const b = e.target.closest('.chip-carro'); if (b) renomearCarro(+b.dataset.id); });
    $('#faixa-carro').addEventListener('click', e => { const b = e.target.closest('[data-cid]'); if (b) abrirCidade(b.dataset.cid, { centrar: true }); });

    /* busca de cidade */
    const bi = $('#busca-cidade'), sug = $('#sug-cidade');
    const achar = () => {
      const q = N.norm(bi.value); if (!q || !S.idx) { sug.hidden = true; return []; }
      const r = S.idx.lista.filter(c => N.norm(c.nome).includes(q)).slice(0, 8);
      sug.innerHTML = r.map(c => '<li data-cid="' + esc(c.key) + '"><span>' + esc(c.nome) + '</span><span class="tag">' + esc(c.uf) + '</span></li>').join('');
      sug.hidden = !r.length; return r;
    };
    bi.addEventListener('input', achar);
    bi.addEventListener('keydown', e => { if (e.key === 'Enter') { const r = achar(); if (r[0]) { abrirCidade(r[0].key, { centrar: true }); bi.value = ''; sug.hidden = true; } } if (e.key === 'Escape') { bi.value = ''; sug.hidden = true; } });
    sug.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { abrirCidade(li.dataset.cid, { centrar: true }); bi.value = ''; sug.hidden = true; } });
    bi.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 150));

    /* painel de pendentes */
    $('#pend-lista').addEventListener('click', e => {
      const bf = e.target.closest('.bt-fora'); if (bf) { alternarFora(bf.dataset.fora); return; }
      if (e.target.closest('#pend-fora-cab')) { S.pend.foraAberto = !S.pend.foraAberto; U.pref.gravar('foraAberto', S.pend.foraAberto); renderPend(); return; }
      const li = e.target.closest('li[data-cid]'); if (li) abrirCidade(li.dataset.cid, { centrar: true });
    });
    $('#pend-busca').addEventListener('input', e => { S.pend.q = e.target.value; renderPend(); });
    $('#pend-ordem').addEventListener('change', e => { S.pend.ordem = e.target.value; U.pref.gravar('pendOrdem', S.pend.ordem); renderPend(); });
    $('#pend-ordem').value = S.pend.ordem;
    $('#pend-min').addEventListener('click', () => { const j = $('#jan-pend'); const r = j.classList.toggle('recolhida'); $('#pend-min').textContent = r ? '+' : '–'; U.pref.gravar('pendMin', r); });
    $('#pend-qt').addEventListener('dblclick', () => { S.pend.mostrarTodas = !S.pend.mostrarTodas; renderPend(); toast(S.pend.mostrarTodas ? 'Mostrando também as cidades completas.' : 'Mostrando só as que ainda faltam.'); });
    U.arrastavel($('#jan-pend'), '.jan-cab', $('#mapa-area'), p => U.pref.gravar('pos:pend', p));
    if (U.pref.ler('pendMin', window.innerWidth < 860)) { $('#jan-pend').classList.add('recolhida'); $('#pend-min').textContent = '+'; }

    /* janela da cidade */
    const jc = $('#jan-cid');
    U.arrastavel(jc, '.jan-cab', $('#mapa-area'), p => U.pref.gravar('pos:cid', p));
    jc.addEventListener('click', e => {
      const t = e.target;
      const a = t.closest('[data-a]');
      if (a && a.dataset.a === 'fechar') return fecharCidade();
      if (a && a.dataset.a === 'cancelar') return fecharCidade();
      if (a && a.dataset.a === 'concluir') return concluirCidade();
      if (a && a.dataset.a === 'forarota') return alternarFora(S.cidadeAberta);
      const car = t.closest('.mini-car'); if (car) return selecionarCarro(+car.dataset.car);
      const lc = t.closest('[data-libc]'); if (lc) { const cl = S.idx.cidades.get(S.cidadeAberta).listaClientes[+lc.dataset.libc]; return liberar(cl.notas.filter(n => S.op.atrib[n.id] != null && S.op.atrib[n.id] !== S.carroAtivo).map(n => n.id), 'liberar notas de ' + cl.nome); }
      const ln = t.closest('[data-libn]'); if (ln) return liberar([ln.dataset.libn], 'liberar nota');
      const ex = t.closest('.cli-exp'); if (ex) { const cl = S.idx.cidades.get(S.cidadeAberta).listaClientes[+ex.dataset.i]; S.expand.has(cl.key) ? S.expand.delete(cl.key) : S.expand.add(cl.key); return renderJanCidade(); }
      const nm = t.closest('.cli-nome'); if (nm && !t.closest('.lib')) { const i = +nm.dataset.i, cl = S.idx.cidades.get(S.cidadeAberta).listaClientes[i], dsp = cl.notas.filter(disponivel); if (dsp.length) marcarCliente(i, !dsp.every(n => S.draft.has(n.id))); }
    });
    jc.addEventListener('change', e => {
      const t = e.target;
      if (t.classList.contains('cl-chk')) marcarCliente(+t.dataset.i, t.checked);
      else if (t.classList.contains('nt-chk')) { t.checked ? S.draft.add(t.dataset.n) : S.draft.delete(t.dataset.n); renderJanCidade(); }
      else if (t.id === 'jc-ordem') { S.ordemCli = t.value; renderJanCidade(); }
      else if (t.id === 'jc-todos') { for (const n of notasDaCidade().filter(disponivel)) { t.checked ? S.draft.add(n.id) : S.draft.delete(n.id); } renderJanCidade(); }
    });
    jc.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.target.closest('select') && draftSujo() && !e.target.closest('button')) { e.preventDefault(); concluirCidade(); } });

    /* notas */
    $('#n-busca').addEventListener('input', e => { S.nf.q = e.target.value; renderNotas(); });
    $('#n-carro').addEventListener('change', renderNotas); $('#n-origem').addEventListener('change', renderNotas);
    $('#n-tabela').addEventListener('click', e => { const th = e.target.closest('th[data-ord]'); if (!th) return; const o = th.dataset.ord; if (S.nf.ord === o) S.nf.dir *= -1; else { S.nf.ord = o; S.nf.dir = 1; } renderNotas(); });

    /* folha */
    $('#bt-imprimir').onclick = () => U.imprimir('folha');

    /* importar */
    const arq = $('#arq'), drop = $('#drop');
    const separar = files => { const todos = [...files], pdfs = todos.filter(f => /\.pdf$/i.test(f.name)), xmls = todos.filter(f => /\.xml$/i.test(f.name)); if (!pdfs.length && !xmls.length) { toast('Solte arquivos .xml (e os romaneios em .pdf).'); return; } if (xmls.length) lerArquivos(xmls); if (pdfs.length) { if (xmls.length && !S.op) { S.pdfsPend = pdfs; toast('Os romaneios serão lidos assim que você confirmar a importação dos XMLs.'); } else { RT.rom.adicionarPdfs(pdfs); irPara('xmls'); } } };
    arq.addEventListener('change', () => { if (arq.files.length) separar(arq.files); arq.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('sobre'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('sobre'); }));
    drop.addEventListener('drop', e => separar(e.dataTransfer.files));
    $('#lote').addEventListener('click', e => {
      if (e.target.id === 'lote-ok') confirmarImportacao();
      if (e.target.id === 'lote-cancelar') { S.lote = null; renderLote(); }
    });
    $('#lote').addEventListener('change', e => { if (e.target.name === 'dest') { S.destino = e.target.value; renderLote(); } });
    $('#lista-ops').addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      const get = async id => (await DB.todos('ops')).find(o => o.id === id);
      if (b.dataset.opAbrir) { const o = await get(b.dataset.opAbrir); if (o) { await abrirOperacao(o); renderOps(); toast('Abri ' + o.nome + '.'); } }
      else if (b.dataset.opBaixar) { const o = await get(b.dataset.opBaixar); if (o) baixarCopia(o); }
      else if (b.dataset.opRen) { const o = await get(b.dataset.opRen); const v = o && await U.perguntar('Renomear operação', '', o.nome, 'Salvar'); if (v) { o.nome = v.slice(0, 60); o.rev++; await DB.put('ops', o); if (S.op && S.op.id === o.id) { S.op.nome = o.nome; S.op.rev = o.rev; atualizarTudo(); } renderOps(); } }
      else if (b.dataset.opDel) {
        const o = await get(b.dataset.opDel); if (!o) return;
        if (!(await U.confirmar('Excluir "' + o.nome + '"?', 'A operação sai da lista. Antes disso o app guarda uma cópia de segurança, que você pode restaurar abaixo.', 'Excluir operação', true))) return;
        if (!(await backup(o, 'antes de excluir a operação'))) return;
        await DB.apagar('ops', o.id);
        if (S.op && S.op.id === o.id) { S.op = null; S.idx = null; S.res = null; S.carroAtivo = null; fecharCidade(true); statusSalvo('sem'); try { await DB.apagar('meta', 'ativa'); } catch (x) { /* ok */ } atualizarTudo(); }
        renderOps(); renderBk();
      }
    });
    $('#lista-bk').addEventListener('click', async e => {
      const b = e.target.closest('[data-bk-rest]'); if (!b) return;
      const r = await DB.get('bk', +b.dataset.bkRest); if (r) try { await restaurarObjeto(r.op, ' (restaurada)'); } catch (x) { toast('⚠ ' + x.message); }
    });
    $('#arq-bk').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { const j = JSON.parse(await f.text()); await restaurarObjeto(j.op || j, ' (restaurada)'); } catch (x) { toast('⚠ Não consegui restaurar: ' + x.message); }
    });

    /* teclado */
    document.addEventListener('keydown', e => {
      const emCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox';
      const so = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey, tecla = e.key.toLowerCase();
      if (so && tecla === 's') { e.preventDefault(); if (!S.modoMapa) salvarAgora(); }
      else if (so && tecla === 'z' && !emCampo) { e.preventDefault(); desfazer(); }
      else if (so && tecla === 'l' && !S.modoMapa && !document.querySelector('.fundo')) { e.preventDefault(); RT.sit.abrirBusca(); } // Ctrl+L: abre a busca de nota
      else if (so && tecla === 'v' && !emCampo && !S.modoMapa && !document.querySelector('.fundo')) { if (tela === 'rotas' && ciclarOrdemFoco()) e.preventDefault(); else if (tela === 'notas') { e.preventDefault(); ciclarOrdemNotas(); } } // Ctrl+V: A–Z → maior volume → maior valor → A–Z, na janela em foco
      else if (e.key === 'Escape' && !document.querySelector('.fundo')) {
        if (!$('#mural').hidden) muralFechar(); else if (S.cidadeAberta) fecharCidade();
      }
    });

    /* tema */
    const aplicarTema = t => { document.documentElement.setAttribute('data-tema', t === 'claro' ? 'claro' : 'escuro'); $('#tema-lbl').textContent = t === 'claro' ? 'Tema escuro' : 'Tema claro'; S.mapa && S.mapa.temaMudou(); };
    $('#bt-tema').onclick = () => { const t = document.documentElement.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro'; U.pref.gravar('tema', t); aplicarTema(t); enviar({ t: 'tema' }); };
    aplicarTema(U.pref.ler('tema', 'escuro'));
    window.addEventListener('pagehide', () => { /* gravações já são feitas a cada ação */ });
  }

  /* ================= abertura do app ================= */
  async function boot() {
    $('#versao').textContent = 'versão ' + VERSAO; ligarLateral();
    S.mapa = new RT.Mapa($('#mapa-area'), {
      onClique: h => { if (S.modoMapa) { if (h) enviar({ t: 'clique', key: h.key }); return; } if (h) abrirCidade(h.key, { centrar: false }); else if (S.cidadeAberta && !draftSujo()) fecharCidade(true); },
      onHover: (h, e) => tip(h, e), onMover: () => { $('#tip').hidden = true; },
      onFora: nomes => { const b = $('#aviso-fora'); b.hidden = !nomes.length; b.textContent = nomes.length ? '+' + nomes.length + ' fora do quadro: ' + nomes.slice(0, 2).join(', ') + (nomes.length > 2 ? '…' : '') : ''; }
    });
    RT.vias.aoChegar = (k, p) => { if (k && p) S.mapa.setPerna(k, p); statusVias(); if (!k || (RT.vias.fila.length % 5 === 0)) { renderCarros(); renderJanCarros(); } };
    ligar(); ligarCanal();
    if (S.modoMapa) { document.body.classList.add('modo-mapa'); document.title = 'Health LOG · Mapa'; } else muralAbrir(); // o mural aparece atrás da animação de abertura, como no Health Search
    const okDb = await DB.abrir();
    if (!okDb) { statusSalvo('erro', DB.erro || 'banco indisponível'); }
    try {
      const mun = await (await fetch('data/municipios.json')).json();
      N.setMunicipios(mun); S.mun = mun;
    } catch (e) { $('#faixa-erro').hidden = false; $('#faixa-erro').textContent = '⚠ Não consegui carregar a lista de municípios (IBGE). Reabra o app com internet uma vez.'; }
    const malha = S.mapa.carregarMalha('data/malha.json');
    if (okDb) {
      try {
        const meta = await DB.get('meta', 'ativa');
        let op = meta ? await DB.get('ops', meta.id) : null;
        if (!op) { const todas = (await DB.todos('ops')).sort((a, b) => String(b.criada).localeCompare(String(a.criada))); op = todas[0] || null; }
        if (op) { S.op = op; S.carroAtivo = op.carros.length ? op.carros[0].id : null; reindexar(); S.ultimoSalvo = new Date(); statusSalvo('ok'); }
        else statusSalvo('sem');
      } catch (e) { statusSalvo('erro', (e && e.message) || String(e)); }
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ok */ }
    }
    await carregarCfg(); await carregarReg(); await carregarApiKey(); await RT.sit.carregar(); await RT.rom.carregarMot(); S.pend.foraAberto = U.pref.ler('foraAberto', false); { const o = U.pref.ler('pendOrdem', 'nome'); S.pend.ordem = ['nome', 'volume', 'valor'].includes(o) ? o : 'nome'; $('#pend-ordem').value = S.pend.ordem; }
    if (!S.modoMapa) { janVer('pend', U.pref.ler('ver:pend', true)); janVer('carros', U.pref.ler('ver:carros', false)); janVer('busca', false); }
    if (reindexar(), S.op) atualizarTudo(); else atualizarTudo();
    irPara('rotas');
    await malha; S.mapa.marcar();
    aplicarBase();
    { const re = U.pref.ler('realce', 'suave'); S.mapa.setRealce(re); $('#bt-realce').textContent = 'Realce: ' + re; }
    { const v = U.pref.ler('vias', true); S.mapa.setVias(v); $('#bt-vias').setAttribute('aria-pressed', String(v)); atualizarVias(); }
    { const e = U.pref.ler('estradas', true); S.mapa.setEstradas(e); $('#bt-estradas').setAttribute('aria-pressed', String(e)); }
    if (S.mun) { const rota = new Set(); for (const r of ((S.reg && S.reg.regioes) || [])) if (r.grupo !== 'fora') for (const c of r.cidades) rota.add(String(c)); S.mapa.setTodas(Object.entries(S.mun).map(([c, v]) => ({ code: c, nome: v[0], lat: v[2], lon: v[3], pri: rota.has(c) ? 1 : 0 })).sort((x, y) => y.pri - x.pri || x.nome.length - y.nome.length)); }
    if (S.op && tela === 'rotas') { ajustarPadMapa(); S.mapa.enquadrar(); S.precisaEnquadrar = false; }
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').then(r => { r.update().catch(() => { }); setInterval(() => r.update().catch(() => { }), 10 * 60 * 1000); }).catch(() => { });
    /* versão nova assumiu: recarrega sozinho (o trabalho já está gravado); se houver gravação pendente, avisa */
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) { let recarregou = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (recarregou) return; const ir = () => { recarregou = true; window.__hsRecarregando = true; location.reload(); }; if (!S.sujo) ir(); else toast('Há uma versão nova do Health LOG.', { rotulo: 'Atualizar agora', fn: ir }); }); }
    if (S.modoMapa) enviar({ t: 'pronto' });
    RT.pronto = true;
  }
  /* clicar numa janela flutuante (em qualquer ponto, inclusive na moldura) a deixa em foco: borda destacada e atalhos valem nela */
  document.addEventListener('pointerdown', e => {
    const j = e.target.closest && e.target.closest('.jan'); const id = j ? j.id : null;
    if (id === S.janFoco) return; S.janFoco = id;
    $$('.jan').forEach(x => x.classList.toggle('foco', x.id === id));
  }, true);
  RT.A = { backup, kmDe, salvar, reindexar, atualizarTudo, nomeId, carroPorId, abrirCidade, irPara, mutar, desfazer, janVer };
  boot().catch(e => { console.error(e); const fe = $('#faixa-erro'); fe.hidden = false; fe.textContent = '⚠ Erro ao abrir o app: ' + ((e && e.message) || e); });
})();
