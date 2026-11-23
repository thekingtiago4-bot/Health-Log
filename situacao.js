/* Health Route · busca de nota, situação (presente / agendamento / divergência), abas e pop-up do dia. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const { N, U } = RT; const { $, $$, esc, toast } = U;
  const S = () => RT.S, A = () => RT.A, m$ = N.fmtMoeda, i$ = N.fmtInt;
  let consulta = '', aberta = null, pronto = false;
  const hoje = () => U.hoje();
  const dataBR = d => (d ? U.dataBR(d) : '');

  /* ---------- agenda guardada neste aparelho ---------- */
  RT.agenda = { itens: [], popupAte: '' };
  async function carregar() { try { const r = await RT.DB.get('meta', 'agenda'); if (r && r.v) RT.agenda = Object.assign({ itens: [], popupAte: '' }, r.v); } catch (e) { /* começa vazia */ } }
  function guardar() { return RT.DB.put('meta', { k: 'agenda', v: RT.agenda }).catch(e => toast('⚠ Não consegui guardar os agendamentos: ' + ((e && e.message) || e))); }

  /* ---------- busca (janela flutuante) ---------- */
  function achar(q) {
    const o = S().op; if (!o) return [];
    const t = N.norm(q), d = N.soDigitos(q); if (t.length < 2 && d.length < 2) return [];
    return o.notas.filter(n => (d.length >= 2 && (String(+n.nf).includes(String(+d)) && d.length <= 9 || n.chave.includes(d) || n.doc.includes(d))) || N.norm(n.cliente + ' ' + n.cidade + ' ' + n.end + ' ' + n.origem + ' ' + n.nf).includes(t)).slice(0, 40);
  }
  function linhaNota(n) {
    const o = S().op, st = (o.status || {})[n.id], tipo = st ? st.tipo : 'presente', car = o.atrib[n.id] != null ? A().carroPorId(o.atrib[n.id]) : null;
    const sq = (k, cls, txt, tit, on) => '<button type="button" class="q ' + cls + (on ? ' on' : '') + '" data-q="' + k + '" data-n="' + esc(n.id) + '" title="' + tit + '" aria-pressed="' + on + '">' + txt + '</button>';
    let h = '<div class="bn" data-nota="' + esc(n.id) + '"><div class="bq">' + sq('v', 'v', '✓', 'Presente: a nota está certa e vai na rota', tipo === 'presente') + sq('a', 'a', 'A', 'Agendamento: sai da rota e vai para a aba Agendamentos', tipo === 'agendamento') + sq('r', 'r', '!', 'Divergência (sem volumes ou volumes parciais): sai da rota e vai para a aba Divergências', tipo === 'divergencia') + '</div>' +
      '<div class="bi"><b>NF ' + esc(n.nf) + '</b> · ' + esc(n.cliente) + '<small>' + esc(n.cidade) + '/' + esc(n.uf) + ' · ' + esc(n.origem.replace(/\.xml$/i, '')) + ' · ' + i$(n.vol) + ' vol · ' + m$(n.valor) + (car ? ' · <span class="carro-tag" style="--cor:' + car.cor + '">' + esc(N.nomeCarro(car)) + '</span>' : '') +
      (st ? ' · <b style="color:' + (tipo === 'agendamento' ? 'var(--amarTxt)' : 'var(--no)') + '">' + (tipo === 'agendamento' ? 'AGENDAMENTO' + (st.auto ? ' (automático)' : '') : 'DIVERGÊNCIA: ' + descDiv(n, st)) + '</b>' : '') + '</small></div>';
    if (aberta && aberta.id === n.id) {
      h += '<div class="bf">' + (aberta.f === 'a' ?
        '<label>Data<input type="date" data-f="data" value="' + esc((st && st.data) || '') + '"></label><label>Hora<input type="time" data-f="hora" value="' + esc((st && st.hora) || '') + '"></label><label class="grande">Observação<input data-f="obs" value="' + esc((st && st.obs) || '') + '" placeholder="Ex.: cliente só recebe de manhã"></label><button type="button" class="btn mini pri" data-ok="a">Marcar como agendamento</button>' :
        '<label>O que houve<select data-f="div"><option value="sem-volumes">Sem volumes (não veio nada)</option><option value="parcial">Volumes parciais (veio só uma parte)</option></select></label><label>Chegaram quantos?<input data-f="rec" inputmode="numeric" style="width:70px" placeholder="0"></label><label class="grande">Observação<input data-f="obs" placeholder="Ex.: caixas 3 e 4 faltando"></label><button type="button" class="btn mini pri" data-ok="r">Marcar divergência</button>') +
        '<button type="button" class="btn mini" data-ok="x">Cancelar</button></div>';
    }
    return h + '</div>';
  }
  const descDiv = (n, st) => st.div === 'parcial' ? 'volumes parciais (chegaram ' + (st.rec || 0) + ' de ' + i$(n.vol) + ')' : 'sem volumes';
  let escolha = 0;
  function marcarEscolha(irAoMapa) {
    const linhas = [...document.querySelectorAll('#busca-res .bn')]; linhas.forEach((l, i) => l.classList.toggle('esc', i === escolha));
    const l = linhas[escolha]; if (!l) return; l.scrollIntoView({ block: 'nearest' });
    if (irAoMapa && S().idx) { const k = S().idx.chaveCidadeDaNota.get(l.dataset.nota); if (k) { S().mapa.setSelecionada(k); S().mapa.centrarEm(k, 110); } }
  }
  /* Ctrl+L: abre a busca como se tivesse clicado em "Buscar nota" e já deixa o cursor pronto para digitar */
  function abrirBusca() {
    if (!document.querySelector('#t-rotas') || document.querySelector('#t-rotas').hidden) A().irPara('rotas');
    const j = $('#jan-busca'); if (j.hidden) A().janVer('busca', true);
    j.style.zIndex = String(++U.z);
    setTimeout(() => { const i = $('#busca-q'); i.focus(); i.select(); }, 20);
  }
  function renderBusca() {
    const box = $('#busca-res'); if (!box) return;
    if (!S().op) { box.innerHTML = '<p class="dica" style="padding:12px">Abra uma operação.</p>'; return; }
    const r = achar(consulta);
    escolha = 0;
    box.innerHTML = consulta.trim().length < 2 ? '<p class="dica" style="padding:12px 14px;margin:0">Digite o número da NF, o cliente, a cidade, o endereço ou a origem. Nos quadrinhos: <b style="color:var(--ok)">✓</b> presente (já vem marcado), <b style="color:var(--amarTxt)">A</b> agendamento, <b style="color:var(--no)">!</b> divergência.</p>'
      : r.length ? r.map(linhaNota).join('') + (r.length === 40 ? '<p class="dica" style="padding:6px 14px">Mostrando as 40 primeiras. Afunile a busca.</p>' : '') : '<p class="dica" style="padding:12px 14px;margin:0">Nenhuma nota encontrada.</p>';
  }
  function marcar(tipo, id, f) {
    const o = S().op, n = o.notas.find(x => x.id === id); if (!n) return;
    const v = k => ((f.querySelector('[data-f="' + k + '"]') || {}).value || '').trim();
    if (tipo === 'a') A().mutar('agendamento da NF ' + n.nf, () => N.marcarStatus(o, S().idx, [id], { tipo: 'agendamento', auto: false, data: v('data'), hora: v('hora'), obs: v('obs') }));
    else {
      const div = v('div'), rec = N.dec(v('rec') || '0', 0);
      if (div === 'parcial' && (!rec.ok || rec.v >= n.vol || rec.v < 0)) { toast('Volumes parciais: diga quantos chegaram (menos que os ' + n.vol + ' da nota).'); return; }
      A().mutar('divergência da NF ' + n.nf, () => N.marcarStatus(o, S().idx, [id], { tipo: 'divergencia', div, rec: div === 'parcial' ? rec.v : 0, obs: v('obs') }));
    }
    aberta = null; renderBusca(); toast('NF ' + n.nf + ' saiu da rota → aba ' + (tipo === 'a' ? 'Agendamentos' : 'Divergências') + '.', { rotulo: 'Desfazer', fn: () => A().desfazer() });
  }
  function ligarBusca() {
    $('#busca-q').addEventListener('input', e => { consulta = e.target.value; aberta = null; renderBusca(); marcarEscolha(false); });
    $('#busca-res').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const o = S().op;
      if (b.dataset.q) {
        const id = b.dataset.n, st = (o.status || {})[id];
        if (b.dataset.q === 'v') { if (st) { A().mutar('voltar para a rota', () => N.tirarStatus(o, [id], true)); toast('A nota voltou para a rota.'); } return; }
        aberta = { id, f: b.dataset.q }; return renderBusca();
      }
      if (b.dataset.ok === 'x') { aberta = null; return renderBusca(); }
      if (b.dataset.ok) return marcar(b.dataset.ok, aberta.id, b.closest('.bf'));
    });
    $('#busca-x').onclick = () => A().janVer('busca', false);
    /* Enter (ou ↓/↑) escolhe a nota na lista; a cidade dela é destacada e o mapa vai até lá */
    $('#busca-q').addEventListener('keydown', e => {
      if (e.key === 'Escape') { A().janVer('busca', false); return; }
      if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      const linhas = [...document.querySelectorAll('#busca-res .bn')]; if (!linhas.length) return;
      e.preventDefault();
      if (e.key === 'ArrowDown') escolha = Math.min(linhas.length - 1, escolha + 1); else if (e.key === 'ArrowUp') escolha = Math.max(0, escolha - 1); else escolha = Math.max(0, escolha);
      marcarEscolha(e.key === 'Enter');
    });
    $('#bt-busca').onclick = () => { const j = $('#jan-busca'); A().janVer('busca', j.hidden); if (!j.hidden) setTimeout(() => $('#busca-q').focus(), 30); };
    U.arrastavel($('#jan-busca'), '.jan-cab', $('#mapa-area'), p => U.pref.gravar('pos:busca', p));
  }

  /* ---------- aba Agendamentos ---------- */
  function renderAgenda() {
    const box = $('#ag-box'), o = S().op; if (!box) return;
    const ag = RT.agenda;
    let h = '<div class="cfg-card" style="max-width:none"><h2>Agendamentos cadastrados (' + ag.itens.length + ')</h2><p class="sub" style="margin-bottom:8px">Notas que constam aqui são <b>ocultadas da rota automaticamente</b> quando você joga o XML — <b>exceto as do romaneio MESA</b>, que continuam na rota. Cole a lista do Health Search (uma por linha: <code>NF;data;hora;observação</code> ou <code>cliente;data;hora;observação</code>).</p>' +
      '<textarea id="ag-txt" class="filtro" style="width:100%;min-height:90px" placeholder="Ex.:&#10;746003;25/11/2026;08:00;só de manhã&#10;UNIMED RIBEIRAO PRETO;26/11/2026"></textarea>' +
      '<div class="botoes-linha"><button class="btn pri" id="ag-add" type="button">Importar lista</button><button class="btn" id="ag-aplicar" type="button"' + (o ? '' : ' disabled') + '>Aplicar na operação aberta</button></div><p class="dica" id="ag-res"></p>' +
      (ag.itens.length ? '<div style="overflow:auto"><table class="tabela"><thead><tr><th>Tipo</th><th>NF / cliente</th><th>Data</th><th>Hora</th><th>Observação</th><th></th></tr></thead><tbody>' + ag.itens.map(it => '<tr><td>' + (it.tipo === 'nf' ? 'NF' : 'Cliente') + '</td><td>' + esc(it.valor) + '</td><td>' + dataBR(it.data) + '</td><td>' + esc(it.hora) + '</td><td>' + esc(it.obs) + '</td><td><button class="btn mini perigo" data-ag-rm="' + esc(it.id) + '" type="button">remover</button></td></tr>').join('') + '</tbody></table></div>' : '') + '</div>';
    if (o) {
      const lista = o.notas.filter(n => (o.status || {})[n.id] && o.status[n.id].tipo === 'agendamento');
      h += '<h2 style="margin-top:22px">Notas em agendamento nesta operação (' + lista.length + ')</h2>' + (lista.length ? '<div class="tabela-wrap" style="max-height:none"><table class="tabela"><thead><tr><th>Origem</th><th>NF</th><th>Cliente</th><th>Cidade</th><th class="dir">Valor</th><th>Como entrou</th><th>Data</th><th>Obs.</th><th></th></tr></thead><tbody>' +
        lista.map(n => { const s = o.status[n.id]; return '<tr><td>' + esc(n.origem) + '</td><td>' + esc(n.nf) + '</td><td>' + esc(n.cliente) + '</td><td>' + esc(n.cidade) + '/' + esc(n.uf) + '</td><td class="dir">' + m$(n.valor) + '</td><td>' + (s.auto ? 'automático (consta na lista)' : 'marcado à mão') + '</td><td>' + dataBR(s.data) + ' ' + esc(s.hora || '') + '</td><td>' + esc(s.obs || '') + '</td><td><button class="btn mini" data-ag-volta="' + esc(n.id) + '" type="button">voltar para a rota</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="dica">Nenhuma nota em agendamento.</p>');
      const mesa = o.notas.filter(n => !(o.status || {})[n.id] && N.ehMesa(n) && ag.itens.some(it => N.casaAgenda(n, it)));
      if (mesa.length) h += '<h2 style="margin-top:22px">Agendamentos da MESA mantidos na rota (' + mesa.length + ')</h2><p class="dica">Regra: nota de agendamento do romaneio MESA continua na rota.</p><div class="tabela-wrap" style="max-height:none"><table class="tabela"><tbody>' + mesa.map(n => '<tr><td>' + esc(n.origem) + '</td><td>' + esc(n.nf) + '</td><td>' + esc(n.cliente) + '</td><td>' + esc(n.cidade) + '/' + esc(n.uf) + '</td><td class="dir">' + m$(n.valor) + '</td></tr>').join('') + '</tbody></table></div>';
    }
    box.innerHTML = h;
  }
  function renderDiverg() {
    const box = $('#dv-box'), o = S().op; if (!box) return;
    if (!o) { box.innerHTML = '<p class="sub">Abra uma operação.</p>'; return; }
    const lista = o.notas.filter(n => (o.status || {})[n.id] && o.status[n.id].tipo === 'divergencia');
    box.innerHTML = lista.length ? '<div class="tabela-wrap" style="max-height:none"><table class="tabela"><thead><tr><th>Origem</th><th>NF</th><th>Cliente</th><th>Cidade</th><th class="dir">Vol. da NF</th><th>O que houve</th><th class="dir">Valor</th><th>Obs.</th><th></th></tr></thead><tbody>' +
      lista.map(n => { const s = o.status[n.id]; return '<tr><td>' + esc(n.origem) + '</td><td>' + esc(n.nf) + '</td><td>' + esc(n.cliente) + '</td><td>' + esc(n.cidade) + '/' + esc(n.uf) + '</td><td class="dir">' + i$(n.vol) + '</td><td><b style="color:var(--no)">' + esc(s.div === 'parcial' ? 'Volumes parciais — chegaram ' + (s.rec || 0) + ' de ' + n.vol : 'Sem volumes') + '</b></td><td class="dir">' + m$(n.valor) + '</td><td>' + esc(s.obs || '') + '</td><td><button class="btn mini" data-dv-volta="' + esc(n.id) + '" type="button">resolvida: voltar para a rota</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="dica">Nenhuma divergência nesta operação.</p>';
  }
  function ligarAbas() {
    $('#t-agenda').addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return; const o = S().op;
      if (b.id === 'ag-add') { const r = N.lerAgenda($('#ag-txt').value); if (!r.itens.length) { $('#ag-res').textContent = 'Não achei nenhuma linha válida.'; return; } RT.agenda.itens.push(...r.itens); await guardar(); $('#ag-txt').value = ''; aplicar(true); renderAgenda(); $('#ag-res').textContent = r.itens.length + ' agendamento(s) importado(s).'; }
      else if (b.id === 'ag-aplicar') aplicar(false);
      else if (b.dataset.agRm) { RT.agenda.itens = RT.agenda.itens.filter(x => x.id !== b.dataset.agRm); await guardar(); renderAgenda(); }
      else if (b.dataset.agVolta) A().mutar('voltar para a rota', () => N.tirarStatus(o, [b.dataset.agVolta], true));
    });
    $('#t-diverg').addEventListener('click', e => { const b = e.target.closest('[data-dv-volta]'); if (b) A().mutar('divergência resolvida', () => N.tirarStatus(S().op, [b.dataset.dvVolta], true)); });
  }
  /* aplica a lista na operação aberta (guardando o que fez para poder desfazer) */
  function aplicar(silencioso) {
    const o = S().op; if (!o) return;
    A().mutar('aplicar agendamentos', () => { RT.ultimoAplicar = N.aplicarAgenda(o, RT.agenda.itens); });
    const r = RT.ultimoAplicar; if (!silencioso || r.auto.length) toast(r.auto.length ? r.auto.length + ' nota(s) saíram da rota por serem agendamento' + (r.mesa.length ? ' (' + r.mesa.length + ' da MESA continuam na rota)' : '') + '.' : 'Nenhuma nota nova bate com os agendamentos.');
  }

  /* ---------- pop-up ao abrir o mapa: "essas notas foram tiradas por ser agendamento" ---------- */
  async function popup() {
    const o = S().op; if (!o || RT.agenda.popupAte === hoje()) return;
    const lista = o.notas.filter(n => o.status && o.status[n.id] && o.status[n.id].tipo === 'agendamento' && o.status[n.id].auto);
    if (!lista.length) return;
    const html = '<h2>Notas tiradas por serem agendamento</h2><p>Estas notas constam nos agendamentos e saíram da rota. <b>Marque as que devem VOLTAR para a rota.</b> Deixe em branco e clique OK para continuarem fora.</p>' +
      '<div style="max-height:46vh;overflow:auto;border:1px solid var(--linha);border-radius:8px"><table class="tabela"><thead><tr><th></th><th>Romaneio de origem</th><th>NF</th><th>Cliente</th><th>Cidade</th></tr></thead><tbody>' +
      lista.map((n, i) => '<tr><td><input type="checkbox" data-volta="' + i + '" aria-label="Voltar NF ' + esc(n.nf) + ' para a rota"></td><td>' + esc(n.origem) + '</td><td>' + esc(n.nf) + '</td><td>' + esc(n.cliente) + '</td><td>' + esc(n.cidade) + '/' + esc(n.uf) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="botoes" style="align-items:center;justify-content:space-between"><label style="display:flex;gap:6px;align-items:center;font-size:.85rem"><input type="checkbox" id="pp-nao"> Não mostrar mais hoje</label><button class="btn pri" data-s>OK</button></div>';
    const r = await U.modal(html, (f, fechar) => { f.querySelector('.modal').style.maxWidth = '860px'; f.querySelector('[data-s]').onclick = () => fechar({ voltar: $$('[data-volta]:checked', f).map(c => lista[+c.dataset.volta].id), nao: f.querySelector('#pp-nao').checked }); });
    if (!r) return;
    if (r.nao) { RT.agenda.popupAte = hoje(); await guardar(); }
    if (r.voltar.length) { A().mutar('notas de agendamento voltaram', () => N.tirarStatus(o, r.voltar, true)); toast(r.voltar.length + ' nota(s) voltaram para a rota.'); }
  }
  function contadores() {
    const o = S().op, c = { a: 0, d: 0 };
    if (o && o.status) for (const id in o.status) { if (o.status[id].tipo === 'agendamento') c.a++; else c.d++; }
    for (const [id, k] of [['#qt-ag', c.a], ['#qt-dv', c.d]]) { const e = $(id); if (e) { e.textContent = String(k); e.hidden = !k; } }
  }
  RT.sit = { abrirBusca, carregar, guardar, popup, contadores, aplicar, ligar() { ligarBusca(); ligarAbas(); }, render(t) { if (t === 'agenda') renderAgenda(); else if (t === 'diverg') renderDiverg(); }, renderBusca };
})(typeof window !== 'undefined' ? window : globalThis);
