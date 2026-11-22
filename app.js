/* Health Route · aplicação (telas, estado, gravação). */
(function () {
  'use strict';
  const { N, U, DB } = RT;
  const { $, $$, esc, toast } = U;
  const VERSAO = '0.1.0';
  const cmp = (a, b) => String(a).localeCompare(String(b), 'pt-BR');
  const m$ = N.fmtMoeda, i$ = N.fmtInt;

  const S = RT.S = {
    op: null, idx: null, res: null, carroAtivo: null,
    cidadeAberta: null, draft: new Set(), draft0: new Set(), expand: new Set(), ordemCli: 'nome',
    hist: [], mapa: null, precisaEnquadrar: true, lote: null, destino: 'atual',
    nf: { q: '', carro: '', origem: '', ord: 'nf', dir: 1 },
    fila: Promise.resolve(), ultimoSalvo: null, ultimoBackup: null, pend: { q: '', ordem: 'nome', mostrarTodas: false }
  };

  /* ================= estado, histórico e gravação ================= */
  function reindexar() {
    if (!S.op) { S.idx = null; S.res = null; return; }
    S.idx = N.indexar(S.op); S.res = N.resumo(S.op, S.idx);
  }
  const carroPorId = id => (S.op ? S.op.carros.find(c => c.id === id) : null) || null;
  const corDe = id => { const c = carroPorId(id); return c ? c.cor : '#888'; };

  function empurrarHist(rotulo) {
    S.hist.push({ rotulo, snap: JSON.stringify({ atrib: S.op.atrib, carros: S.op.carros, proxCarro: S.op.proxCarro }) });
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
    S.op.atrib = s.atrib; S.op.carros = s.carros; S.op.proxCarro = s.proxCarro; S.op.rev++;
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
    if (!S.op) return Promise.resolve();
    if (!DB.db) { statusSalvo('erro', DB.erro || 'banco indisponível'); return Promise.resolve(); }
    statusSalvo('salvando');
    const copia = structuredClone(S.op);
    S.fila = S.fila
      .then(() => DB.put('ops', copia))
      .then(() => DB.put('meta', { k: 'ativa', id: copia.id }))
      .then(() => { S.ultimoSalvo = new Date(); statusSalvo('ok'); })
      .catch(e => statusSalvo('erro', (e && e.message) || String(e)));
    return S.fila;
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
    if (t === 'rotas') requestAnimationFrame(() => { S.mapa.redimensionar(); if (S.precisaEnquadrar && S.op) { ajustarPadMapa(); S.mapa.enquadrar(); S.precisaEnquadrar = false; } S.mapa.marcar(); });
    else fecharCidade(true);
    renderTelaAtual();
  }
  function renderTelaAtual() {
    if (tela === 'notas') renderNotas();
    else if (tela === 'folha') renderFolha();
    else if (tela === 'importar') { renderLote(); renderOps(); renderBk(); }
  }
  function atualizarTudo() {
    renderRail(); renderCarros(); atualizarMapa(); renderPend(); renderJanCidade();
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
        '<b>Carro ' + c.numero + (c.motorista ? '<span class="mot">' + esc(c.motorista) + '</span>' : '') + '</b>' +
        '<small>' + i$(rc.vol) + ' vol · ' + rc.paradas + ' par · ' + m$(rc.valor) + '</small>' +
        '<span class="acoes"><span data-ac="ren" title="Motorista / renomear" role="button" aria-label="Renomear">✎</span><span data-ac="del" title="Excluir carro" role="button" aria-label="Excluir carro">✕</span></span></button>';
    }).join('');
    const f = $('#faixa-carro'), rc = S.res.carros.find(x => x.carro.id === S.carroAtivo);
    if (!op.carros.length) f.innerHTML = '<span>Nenhum carro ainda. Clique em <b>+ Carro</b> (ou direto numa cidade) para começar.</span>';
    else if (rc) {
      f.style.setProperty('--cor', rc.carro.cor);
      f.innerHTML = '<span><i class="bolinha"></i><b>' + esc(N.rotuloCarro(rc.carro)) + '</b></span>' +
        '<span><b>' + rc.cidades.length + '</b> cidade(s)</span><span><b>' + rc.paradas + '</b> paradas</span><span><b>' + i$(rc.vol) + '</b> volumes</span>' +
        '<span><b>' + m$(rc.valor) + '</b></span><span>peso <b>' + N.fmtPeso(rc.peso) + '</b> kg</span>' +
        rc.cidades.map(c => '<button type="button" class="cid-chip" style="--cor:' + rc.carro.cor + '" data-cid="' + esc(c.key) + '">' + esc(c.nome) + '</button>').join('');
    }
    const ch = $('.chip-carro[aria-selected="true"]'); if (ch && ch.scrollIntoView) ch.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function novoCarro() {
    if (!S.op) { toast('Importe os XMLs primeiro.'); return; }
    mutar('novo carro', () => { const c = N.novoCarro(S.op); S.carroAtivo = c.id; });
  }
  function selecionarCarro(id) {
    if (id === S.carroAtivo) return;
    if (S.cidadeAberta && draftSujo()) toast('Marcações não concluídas foram descartadas.');
    S.carroAtivo = id; resetDraft(); renderCarros(); renderJanCidade();
  }
  async function renomearCarro(id) {
    const c = carroPorId(id); if (!c) return;
    const v = await U.perguntar('Motorista do Carro ' + c.numero, 'O nome aparece na folha de rotas. Deixe vazio para tirar.', c.motorista, 'Salvar');
    if (v == null) return;
    mutar('renomear carro ' + c.numero, () => { c.motorista = v.slice(0, 40); });
  }
  async function excluirCarro(id) {
    const rc = S.res.carros.find(x => x.carro.id === id); if (!rc) return;
    if (rc.notas) {
      const ok = await U.confirmar('Excluir o Carro ' + rc.carro.numero + '?', 'Ele tem ' + rc.notas + ' nota(s) (' + m$(rc.valor) + '). Elas voltam para pendentes. Uma cópia de segurança é guardada antes.', 'Excluir carro', true);
      if (!ok) return;
      if (!(await backup(S.op, 'antes de excluir o Carro ' + rc.carro.numero))) return;
    }
    mutar('excluir carro ' + rc.carro.numero, () => {
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
      return { key: c.key, nome: c.nome, uf: c.uf, lat: c.lat, lon: c.lon, code: c.code, estado: rc.estado, alocadas: rc.alocadas, total: rc.total, notas: rc.total, cores, clientes };
    });
  }
  function ajustarPadMapa() { const j = $('#jan-pend'); S.mapa.padEsq = (j && !j.classList.contains('recolhida') && j.offsetWidth && parseFloat(j.style.left || 12) < 120) ? j.offsetWidth + 24 : 0; }
  function atualizarMapa() {
    S.mapa.setCidades(dadosMapa());
    S.mapa.setSelecionada(S.cidadeAberta);
    $('#vazio-mapa').hidden = !!(S.op && S.op.notas.length);
  }
  function tip(h, e) {
    const t = $('#tip');
    if (!h || !S.res) { t.hidden = true; return; }
    const rc = S.res.cidades.find(x => x.cidade.key === h.key); if (!rc) { t.hidden = true; return; }
    const tot = N.somar(rc.cidade.notas);
    const est = { pendente: 'sem carro', parcial: 'falta nota', completa: 'tudo em carro' }[rc.estado];
    const carros = [...rc.porCarro.entries()].map(([id, x]) => 'Carro ' + (carroPorId(id) || { numero: '?' }).numero + ' (' + x.notas + ')').join(', ');
    t.innerHTML = '<b>' + esc(rc.cidade.nome) + '/' + esc(rc.cidade.uf) + '</b> · ' + est + '<br>' + rc.cidade.listaClientes.length + ' cliente(s) · ' + tot.notas + ' nota(s) · ' + m$(tot.valor) + (carros ? '<br>' + esc(carros) : '');
    t.hidden = false;
    const a = $('#mapa-area').getBoundingClientRect();
    let x = e.clientX - a.left + 16, y = e.clientY - a.top + 16;
    if (x + 280 > a.width) x = e.clientX - a.left - 290; if (y + 90 > a.height) y = e.clientY - a.top - 80;
    t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, y) + 'px';
  }

  /* ================= cidades pendentes (janela flutuante) ================= */
  function renderPend() {
    const lista = $('#pend-lista');
    if (!S.res) { lista.innerHTML = '<li class="pend-vazio">Sem operação.</li>'; $('#pend-qt').textContent = '0'; return; }
    const q = N.norm(S.pend.q);
    let itens = S.res.cidades.filter(rc => (S.pend.mostrarTodas || rc.estado !== 'completa') && (!q || N.norm(rc.cidade.nome).includes(q)));
    const total = S.res.cidades.filter(rc => rc.estado !== 'completa').length;
    $('#pend-qt').textContent = String(total);
    $('#pend-qt').style.background = total ? '' : 'var(--ok)'; $('#pend-qt').style.color = total ? '' : '#fff';
    const ord = S.pend.ordem;
    itens.sort((a, b) => ord === 'valor' ? b.livres.valor - a.livres.valor || cmp(a.cidade.nome, b.cidade.nome)
      : ord === 'paradas' ? b.paradasLivres - a.paradasLivres || cmp(a.cidade.nome, b.cidade.nome) : cmp(a.cidade.nome, b.cidade.nome));
    if (!itens.length) { lista.innerHTML = '<li class="pend-vazio">' + (total ? 'Nenhuma cidade com esse nome.' : '✓ Todas as cidades têm todas as notas em algum carro.') + '</li>'; return; }
    lista.innerHTML = itens.map(rc => {
      const c = rc.cidade, pt = rc.estado === 'completa' ? 'ok' : rc.estado === 'parcial' ? 'parc' : '';
      const sub = rc.estado === 'completa' ? 'tudo em carro' : (rc.paradasLivres + ' parada(s) · ' + i$(rc.livres.vol) + ' vol' + (rc.estado === 'parcial' ? ' · faltam ' + rc.livres.notas + ' nota(s)' : '')) + (c.semPosicao ? ' · sem posição no mapa' : '');
      return '<li data-cid="' + esc(c.key) + '"' + (c.key === S.cidadeAberta ? ' aria-current="true"' : '') + '><span class="pt ' + pt + '">' + (pt === 'parc' ? '!' : '') + '</span><b>' + esc(c.nome) + '<span class="tag" style="margin-left:6px">' + esc(c.uf) + '</span></b><span class="vl">' + m$(rc.estado === 'completa' ? N.somar(c.notas).valor : rc.livres.valor) + '</span><small>' + sub + '</small></li>';
    }).join('');
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
    S.mapa.setSelecionada(key);
    const area = $('#mapa-area'), jan = $('#jan-cid');
    jan.hidden = false; renderJanCidade(); renderCarros(); renderPend();
    const W = area.clientWidth, H = area.clientHeight;
    let anchor;
    if (o.centrar) { S.mapa.centrarEm(key, 140); anchor = { x: W / 2, y: H / 2 }; }
    else anchor = S.mapa.posicaoDaCidade(key) || { x: W * 0.55, y: H * 0.3 };
    const w = jan.offsetWidth;
    let x = anchor.x + 28; if (x + w > W - 8) x = anchor.x - w - 28;
    U.posicionar(jan, area, x, anchor.y - 70);
    const l = $('.cid-lista', jan); if (l) l.scrollTop = 0;
  }
  function fecharCidade(silencioso) {
    if (!S.cidadeAberta) return;
    if (!silencioso && draftSujo()) toast('Marcações não concluídas foram descartadas.');
    S.cidadeAberta = null; S.draft = new Set(); S.draft0 = new Set();
    $('#jan-cid').hidden = true; S.mapa && S.mapa.setSelecionada(null); renderPend();
  }

  function chipPos(carros) {
    return [...carros.entries()].map(([id, q]) => { const c = carroPorId(id); return c ? '<span class="chip-pos" style="--cor:' + c.cor + '">Carro ' + c.numero + (q > 1 ? ' · ' + q : '') + '</span>' : ''; }).join('');
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
    if (S.ordemCli === 'maior') clientes.sort((a, b) => vcli(b) - vcli(a) || cmp(a.nome, b.nome));
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
      (rc.estado === 'parcial' ? '<span style="color:var(--amarTxt)">faltam <b>' + rc.livres.notas + '</b> nota(s) · ' + m$(rc.livres.valor) + '</span>' : '') + (c.semPosicao ? '<span style="color:var(--no)">cidade sem posição no mapa</span>' : '') + '</div>' +
      '<div class="cid-ctrl"><span>Levar para:</span><div class="carros-mini">' + S.op.carros.map(x => '<button type="button" class="mini-car" data-car="' + x.id + '" aria-pressed="' + (x.id === S.carroAtivo) + '" style="--cor:' + x.cor + '">Carro ' + x.numero + '</button>').join('') + '</div>' +
      '<select id="jc-ordem" class="filtro" style="min-height:28px;padding:1px 6px;font-size:.78rem" aria-label="Ordenar clientes"><option value="nome"' + (S.ordemCli === 'nome' ? ' selected' : '') + '>A–Z</option><option value="maior"' + (S.ordemCli === 'maior' ? ' selected' : '') + '>Maior valor</option><option value="menor"' + (S.ordemCli === 'menor' ? ' selected' : '') + '>Menor valor</option></select>' +
      '<label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" id="jc-todos" data-a="todos"' + (disp.length && selDisp === disp.length ? ' checked' : '') + (disp.length ? '' : ' disabled') + '> todos</label></div>' +
      '<div class="cid-lista">' + (linhas || '<div class="vazio-lista">Sem clientes.</div>') + '</div>' +
      '<div class="cid-rod"><div class="sel">' + (sel.length ? '<b>' + sel.length + '</b> nota(s) · <b>' + par + '</b> parada(s)<br><b>' + i$(st.vol) + '</b> vol · <b>' + m$(st.valor) + '</b>' : 'Marque os clientes (ou abra ▸ para escolher notas) e clique em Concluir.') + '</div>' +
      '<button type="button" class="btn" data-a="cancelar">Cancelar</button><button type="button" class="btn concluir" data-a="concluir"' + (draftSujo() && car ? '' : ' disabled') + '>Concluir' + (car ? ' → Carro ' + car.numero : '') + '</button></div>';
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
    mutar('Carro ' + car.numero + ' ↔ ' + nome, () => {
      if (add.length) N.alocar(S.op, S.idx, add, car.id);
      if (rem.length) N.alocar(S.op, S.idx, rem, null);
    });
    toast(nome + ' → Carro ' + car.numero + ': ' + (add.length ? '+' + add.length + ' nota(s) (' + m$(vAdd.valor) + ')' : '') + (rem.length ? (add.length ? ', ' : '') + rem.length + ' devolvida(s)' : ''), { rotulo: 'Desfazer', fn: desfazer });
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
    sc.innerHTML = '<option value="">Todos os carros</option><option value="livre">Sem carro (livres)</option>' + op.carros.map(c => '<option value="' + c.id + '">Carro ' + c.numero + (c.motorista ? ' · ' + esc(c.motorista) : '') + '</option>').join('');
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
    $('#n-tabela').innerHTML = '<thead><tr>' + th('nf', 'NF') + th('origem', 'Origem') + th('cliente', 'Cliente') + th('cidade', 'Cidade') + th('vol', 'Vol', 1) + th('peso', 'Peso kg', 1) + th('valor', 'Valor', 1) + th('carro', 'Carro') + '</tr></thead><tbody>' +
      ver.map(n => {
        const a = op.atrib[n.id], c = a != null ? carroPorId(a) : null;
        return '<tr><td>' + esc(n.nf) + '</td><td>' + esc(n.origem.replace(/\.xml$/i, '')) + '</td><td title="' + esc(n.cliente) + '">' + esc(n.cliente) + '</td><td>' + esc(n.cidade) + '/' + esc(n.uf) + '</td><td class="dir">' + n.vol + '</td><td class="dir">' + N.fmtPeso(n.peso) + '</td><td class="dir">' + m$(n.valor) + '</td><td>' +
          (c ? '<span class="carro-tag" style="--cor:' + c.cor + '">Carro ' + c.numero + '</span>' : '<span class="livre-tag">livre</span>') + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td colspan="4">' + i$(t.notas) + ' nota(s)</td><td class="dir">' + i$(t.vol) + '</td><td class="dir">' + N.fmtPeso(t.peso) + '</td><td class="dir">' + m$(t.valor) + '</td><td></td></tr></tfoot>';
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
    const faltam = S.res.tot.notas - S.res.aloc.notas;
    let h = (faltam ? '<div class="folha-aviso">⚠ Esta folha ainda não está completa: faltam ' + faltam + ' nota(s) (' + m$(S.res.tot.valor - S.res.aloc.valor) + ') sem carro.</div>' : '') +
      '<div class="folha"><div class="f-cab"><b>ROTA ' + U.dataBR(S.op.data) + '</b><span>Emitida em ' + agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</span></div>';
    for (let i = 0; i < cars.length; i += 7) {
      const bl = cars.slice(i, i + 7), pad = n => Array.from({ length: 7 - bl.length }, () => n);
      const cel = (fn, tag) => bl.map(fn).concat(pad('')).map(x => '<' + (tag || 'td') + '>' + (x || '') + '</' + (tag || 'td') + '>').join('');
      h += '<div class="f-blk"><table><tr><th class="lbl"></th>' + cel(c => esc((c.carro.motorista || 'CARRO ' + c.carro.numero).toUpperCase()), 'th') + '</tr>' +
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
    for (const r of L.lidos) if (!r.erro && !r.duplicadoNoLote) op.arquivos.push({ nome: r.arquivo, hash: r.hash || null, notas: r.notas.length, em: new Date().toISOString() });
    op.rev++;
    S.op = op; S.lote = null; S.precisaEnquadrar = true;
    if (!op.carros.some(c => c.id === S.carroAtivo)) S.carroAtivo = op.carros.length ? op.carros[0].id : null;
    reindexar(); await salvar();
    toast('Importei ' + rel.novas.length + ' nota(s) em ' + op.nome + '.');
    atualizarTudo(); irPara('rotas');
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
  function muralFechar() { $('#mural').hidden = true; }
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
        '<div class="mural-c"><h3>Alocação nos carros</h3><b class="big ' + (r.pctAloc === 100 ? 'ok' : '') + '">' + r.pctAloc + '%</b> das notas<div class="barra"><i style="width:' + r.pctAloc + '%"></i></div><p class="sub" style="margin:0;font-size:var(--fs-sm)">' + i$(r.aloc.notas) + ' de ' + i$(r.tot.notas) + ' notas · ' + m$(r.aloc.valor) + ' de ' + m$(r.tot.valor) + '. “Alocada” = está num carro; não é entregue nem conferida.</p></div>' +
        '<div class="mural-c"><h3>Carros</h3><b class="big">' + car.length + '</b> com rota' + (car.length ? '<ul>' + car.slice(0, 6).map(c => '<li><span><i class="chip-pos" style="--cor:' + c.carro.cor + '">' + c.carro.numero + '</i> ' + esc(c.carro.motorista || '') + '</span><b>' + i$(c.vol) + ' vol · ' + m$(c.valor) + '</b></li>').join('') + (car.length > 6 ? '<li><span>+ ' + (car.length - 6) + ' carro(s)</span></li>' : '') + '</ul>' : '<p class="sub" style="margin:4px 0 0">Nenhum carro com notas.</p>') + '</div>' +
        '<div class="mural-c"><h3>Origens (arquivos)</h3><b class="big">' + r.origens.size + '</b> origem(ns)<ul>' + [...r.origens.entries()].sort((a, b) => b[1].notas - a[1].notas).slice(0, 8).map(([o, x]) => '<li><span class="base">' + esc(o.replace(/\.xml$/i, '')) + '</span><b>' + x.notas + ' notas</b></li>').join('') + '</ul></div>' : '') +
      '<div class="mural-c' + (op && r.cidadesSemPosicao ? ' aviso' : '') + '"><h3>Avisos</h3>' + (op && r.cidadesSemPosicao ? '<p class="aten" style="margin:0 0 6px"><b>' + r.cidadesSemPosicao + '</b> cidade(s) sem posição no mapa (nome não achado no IBGE). Elas continuam na lista de pendentes.</p>' : '<p class="sub" style="margin:0">Sem avisos.</p>') + '</div>' +
      '<div class="mural-c"><h3>Cópia de segurança</h3>' + (bk && bk.toDateString() === new Date().toDateString() ? '<b class="ok">Feita hoje às ' + bk.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</b>' : '<b class="aten">Nenhuma cópia nesta sessão</b>') + '<p class="sub" style="margin:6px 0 0;font-size:var(--fs-sm)">O app guarda uma cópia sozinho antes de ações destrutivas. Você também pode baixar o arquivo.</p>' + (op ? '<button class="btn mini" data-mural-bk type="button">Baixar cópia da operação</button>' : '') + '</div>' +
      '</div><p class="mural-dica">Esc volta para a tela anterior. Clique no logo para ver este mural de novo.</p></div>';
  }
  function baixarCopia(op) {
    U.baixar('health-route-' + N.norm(op.nome).replace(/[^A-Z0-9]+/g, '-').toLowerCase() + '-' + op.data + '.json', JSON.stringify({ formato: 'health-route-operacao', v: 1, versao_app: VERSAO, op }));
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
    $('#bt-novo-carro').onclick = novoCarro;
    $('#bt-desfazer').onclick = desfazer;
    $('#bt-enquadrar').onclick = e => (ajustarPadMapa(), S.mapa.enquadrar(null, e.shiftKey));
    $('#aviso-fora').onclick = () => { ajustarPadMapa(); S.mapa.enquadrar(null, true); };
    $('#z-mais').onclick = () => S.mapa.zoom(1.5); $('#z-menos').onclick = () => S.mapa.zoom(1 / 1.5);

    /* chips de carro */
    $('#chips-carros').addEventListener('click', e => {
      const b = e.target.closest('.chip-carro'); if (!b) return; const id = +b.dataset.id;
      const ac = e.target.closest('[data-ac]');
      if (ac) { ac.dataset.ac === 'ren' ? renomearCarro(id) : excluirCarro(id); return; }
      selecionarCarro(id);
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
    $('#pend-lista').addEventListener('click', e => { const li = e.target.closest('li[data-cid]'); if (li) abrirCidade(li.dataset.cid, { centrar: true }); });
    $('#pend-busca').addEventListener('input', e => { S.pend.q = e.target.value; renderPend(); });
    $('#pend-ordem').addEventListener('change', e => { S.pend.ordem = e.target.value; renderPend(); });
    $('#pend-min').addEventListener('click', () => { const j = $('#jan-pend'); const r = j.classList.toggle('recolhida'); $('#pend-min').textContent = r ? '+' : '–'; U.pref.gravar('pendMin', r); });
    $('#pend-qt').addEventListener('dblclick', () => { S.pend.mostrarTodas = !S.pend.mostrarTodas; renderPend(); toast(S.pend.mostrarTodas ? 'Mostrando também as cidades completas.' : 'Mostrando só as que ainda faltam.'); });
    U.arrastavel($('#jan-pend'), '.jan-cab', $('#mapa-area'), p => U.pref.gravar('pendPos', p));
    const pp = U.pref.ler('pendPos', null); if (pp && isFinite(pp.x) && isFinite(pp.y)) { const j = $('#jan-pend'); j.style.left = pp.x + 'px'; j.style.top = pp.y + 'px'; }
    if (U.pref.ler('pendMin', window.innerWidth < 860)) { $('#jan-pend').classList.add('recolhida'); $('#pend-min').textContent = '+'; }

    /* janela da cidade */
    const jc = $('#jan-cid');
    U.arrastavel(jc, '.jan-cab', $('#mapa-area'));
    jc.addEventListener('click', e => {
      const t = e.target;
      const a = t.closest('[data-a]');
      if (a && a.dataset.a === 'fechar') return fecharCidade();
      if (a && a.dataset.a === 'cancelar') return fecharCidade();
      if (a && a.dataset.a === 'concluir') return concluirCidade();
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
    $('#bt-imprimir').onclick = () => window.print();

    /* importar */
    const arq = $('#arq'), drop = $('#drop');
    arq.addEventListener('change', () => { if (arq.files.length) lerArquivos([...arq.files]); arq.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('sobre'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('sobre'); }));
    drop.addEventListener('drop', e => { const fs = [...e.dataTransfer.files].filter(f => /\.xml$/i.test(f.name)); if (fs.length) lerArquivos(fs); else toast('Solte arquivos .xml.'); });
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !emCampo) { e.preventDefault(); desfazer(); }
      else if (e.key === 'Escape' && !document.querySelector('.fundo')) {
        if (!$('#mural').hidden) muralFechar(); else if (S.cidadeAberta) fecharCidade();
      }
    });

    /* tema */
    const aplicarTema = t => { document.documentElement.setAttribute('data-tema', t === 'escuro' ? 'escuro' : 'claro'); $('#tema-lbl').textContent = t === 'escuro' ? 'Tema claro' : 'Tema escuro'; S.mapa && S.mapa.temaMudou(); };
    $('#bt-tema').onclick = () => { const t = document.documentElement.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro'; U.pref.gravar('tema', t); aplicarTema(t); };
    aplicarTema(U.pref.ler('tema', 'claro'));
    window.addEventListener('pagehide', () => { /* gravações já são feitas a cada ação */ });
  }

  /* ================= abertura do app ================= */
  async function boot() {
    $('#versao').textContent = 'versão ' + VERSAO;
    S.mapa = new RT.Mapa($('#mapa-area'), {
      onClique: h => { if (h) abrirCidade(h.key, { centrar: false }); else if (S.cidadeAberta && !draftSujo()) fecharCidade(true); },
      onHover: (h, e) => tip(h, e), onMover: () => { $('#tip').hidden = true; },
      onFora: nomes => { const b = $('#aviso-fora'); b.hidden = !nomes.length; b.textContent = nomes.length ? '+' + nomes.length + ' fora do quadro: ' + nomes.slice(0, 2).join(', ') + (nomes.length > 2 ? '…' : '') : ''; }
    });
    ligar();
    muralAbrir(); // aparece atrás da animação de abertura, como no Health Search
    const okDb = await DB.abrir();
    if (!okDb) { statusSalvo('erro', DB.erro || 'banco indisponível'); }
    try {
      const mun = await (await fetch('data/municipios.json')).json();
      N.setMunicipios(mun);
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
    atualizarTudo();
    irPara('rotas');
    await malha; S.mapa.marcar();
    if (S.op && tela === 'rotas') { ajustarPadMapa(); S.mapa.enquadrar(); S.precisaEnquadrar = false; }
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
    RT.pronto = true;
  }
  boot().catch(e => { console.error(e); const fe = $('#faixa-erro'); fe.hidden = false; fe.textContent = '⚠ Erro ao abrir o app: ' + ((e && e.message) || e); });
})();
