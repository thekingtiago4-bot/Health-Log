/* Health Log. · Editor de regiões (como no Health Search).
   Delimitar: clique, em ordem, nas cidades-limite em volta da área; ao aplicar, toda cidade DENTRO do contorno passa a ser da
   região/base escolhida (entra na lista e sai das outras do mesmo tipo). Também: preencher lacunas, "Não fazemos" (cidade cinza),
   cor / nome / apelidos de cada lista, esconder / excluir lista. Tudo vale no programa inteiro e dá para desfazer. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const { N, U } = RT; const { $, esc, toast } = U;
  const G = () => RT.G;
  const CORES = ['#2A9D8F', '#E07A1F', '#7B5CC4', '#D1495B', '#3A86C8', '#4C9A2A', '#137F7A', '#3D5A80', '#B5651D', '#C2185B', '#00838F', '#6D4C41', '#7CB342', '#5E35B1'];
  const NF = '-';                                       // "Não fazemos"
  const ED = (RT.ged = { on: false, pts: [], dentro: new Set(), alvo: '', soLivres: true, desfazer: null });
  const tipo = () => G().S.geo.tipo, tipoN = () => (tipo() === 'base' ? 'base' : 'região');
  const listas = () => G().S.reg.regioes.filter(l => l.tipo === tipo()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const lista = id => G().S.reg.regioes.find(l => l.id === id);

  function dentroDoContorno() {
    const S = G().S, pol = ED.pts.map(c => G().info(c)).filter(Boolean);
    ED.dentro = new Set(ED.pts.map(String));
    if (pol.length >= 3) for (const c in S.mun) {
      if (!G().ufs.has(S.mun[c][1])) continue; const lat = S.mun[c][2], lon = S.mun[c][3]; let ins = false;
      for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) { const a = pol[i], b = pol[j]; if (((a.lat > lat) !== (b.lat > lat)) && (lon < (b.lon - a.lon) * (lat - a.lat) / (b.lat - a.lat) + a.lon)) ins = !ins; }
      if (ins) ED.dentro.add(c);
    }
  }
  const lacunas = () => { const out = [], S = G().S; for (const c in S.mun) { if (!G().ufs.has(S.mun[c][1])) continue; const r = G().classe(c, tipo()); if (r.fonte === 'auto' && r.ids[0]) out.push({ c, id: r.ids[0] }); } return out; };
  const salvarDesfazer = () => { ED.desfazer = JSON.stringify(G().S.reg); };
  const esquecer = (c, tp) => { const ap = G().S.reg.aprend || {}; if (ap[c]) { delete ap[c][tp]; if (!Object.keys(ap[c]).length) delete ap[c]; } };

  function painel() {
    const p = $('#ged-painel'); if (!p) return; const foi = document.activeElement && document.activeElement.id;
    const ls = listas(); if (ED.alvo && ED.alvo !== '__nova' && ED.alvo !== NF && !lista(ED.alvo)) ED.alvo = '';
    const alvo = ED.alvo && lista(ED.alvo); let mud = 0, ja = 0;
    if (alvo) for (const c of ED.dentro) { const r = G().classe(c, tipo()); if (r.fonte === 'lista' && r.ids.length === 1 && r.ids[0] === alvo.id) ja++; else mud++; }
    const nNf = Object.values(G().S.reg.aprend || {}).filter(v => v && v[tipo()] === NF).length;
    p.innerHTML = '<div class="ged-topo"><b>Editor de ' + (tipo() === 'base' ? 'bases' : 'regiões') + '</b><button class="btn mini" type="button" id="ged-sair">Fechar editor</button></div>' +
      '<section><h3>Delimitar</h3><p>Clique, em ordem, nas cidades que formam o <b>limite</b> da ' + tipoN() + ' (contorno). Também dá para digitar a cidade na busca. Tudo que ficar dentro passa a ser dessa ' + tipoN() + '.</p>' +
      '<label class="ged-l">Aplicar em<select id="ged-alvo"><option value="">— escolha a ' + tipoN() + ' —</option>' + ls.map(l => '<option value="' + esc(l.id) + '"' + (l.id === ED.alvo ? ' selected' : '') + '>' + esc(l.nome) + '</option>').join('') +
      '<option value="__nova"' + (ED.alvo === '__nova' ? ' selected' : '') + '>+ Nova ' + tipoN() + '…</option><option value="' + NF + '"' + (ED.alvo === NF ? ' selected' : '') + '>⛔ Não fazemos — clique na cidade (' + nNf + ')</option></select></label>' +
      (ED.alvo === '__nova' ? '<label class="ged-l">Nome da nova ' + tipoN() + '<input id="ged-novo" class="filtro" placeholder="Ex.: Bauru e Região" autocomplete="off"></label>' : '') +
      (ED.alvo === NF ? '<p class="ged-info">Modo “Não fazemos”: cada clique numa cidade a deixa <b>cinza</b> (ou desmarca). Ela sai das listas desta camada.</p>' :
        '<div class="ged-pts">' + (ED.pts.length ? ED.pts.map((c, i) => { const o = G().info(c); return '<span>' + (i + 1) + '. ' + esc(o ? o.nome : c) + '</span>'; }).join('') : '<span class="sec">Nenhum ponto ainda.</span>') + '</div>' +
        '<div class="ged-info">' + (ED.pts.length < 3 ? 'Faltam ' + (3 - ED.pts.length) + ' ponto(s) para fechar.' : '<b>' + ED.dentro.size + '</b> cidade(s) dentro' + (alvo ? ' · <b>' + mud + '</b> mudam, ' + ja + ' já são de ' + esc(alvo.nome) : '') + '.') + '</div>' +
        '<div class="ged-bts"><button class="btn mini" type="button" id="ged-volta"' + (ED.pts.length ? '' : ' disabled') + '>Desfazer ponto</button><button class="btn mini" type="button" id="ged-limpa"' + (ED.pts.length ? '' : ' disabled') + '>Limpar</button><button class="btn mini pri" type="button" id="ged-aplica"' + (ED.pts.length >= 3 ? '' : ' disabled') + '>Fechar e aplicar</button></div>' +
        '<label class="ged-chk"><input type="checkbox" id="ged-livres"' + (ED.soLivres ? ' checked' : '') + '> Não mexer em cidades que já são de outra ' + tipoN() + '</label>') +
      (ED.desfazer ? '<button class="btn mini" type="button" id="ged-desfaz">Desfazer a última mudança</button>' : '') + '</section>' +
      '<section><h3>Lacunas</h3><p>Cidades sem ' + tipoN() + ' definida que ficam no meio das outras. O mapa já pinta pela vizinhança; aqui você grava de vez.</p><button class="btn mini pri" type="button" id="ged-lacunas">Preencher lacunas (' + lacunas().length + ')</button></section>' +
      '<section><h3>' + (tipo() === 'base' ? 'Bases' : 'Regiões') + ' <small class="sec">(troque em “Regiões / Bases” no mapa)</small></h3><div class="ged-ls">' +
      ls.map(l => '<div class="ged-it" data-id="' + esc(l.id) + '"><input type="color" value="' + esc(/^#[0-9a-fA-F]{6}$/.test(l.cor) ? l.cor : '#888888') + '" data-ged="cor" title="Cor"><div class="ged-cps"><input class="filtro" value="' + esc(l.nome) + '" data-ged="nome" aria-label="Nome"><input class="filtro" value="' + esc((l.alias || []).join(', ')) + '" data-ged="alias" placeholder="Apelidos (ex.: LKR, VIA MINAS)" aria-label="Apelidos"></div>' +
        '<div class="ged-acs"><small>' + l.cidades.length + '</small><button type="button" class="btn mini" data-ged-so="' + esc(l.id) + '" title="Mostrar só esta no mapa">só</button><button type="button" class="btn mini perigo" data-ged-del="' + esc(l.id) + '" title="Excluir a lista">✕</button></div></div>').join('') +
      '</div><button class="btn mini" type="button" id="ged-todas">Mostrar todas</button></section>';
    if (ED.alvo === '__nova' && foi !== 'ged-novo') { const n = $('#ged-novo'); if (n) n.focus(); }
  }
  /* o painel começa logo abaixo da barra de botões do mapa (que pode quebrar em duas linhas) */
  function posicionar() { const p = $('#ged-painel'), f = document.querySelector('#geo-mapa .ferr'); if (p && f) p.style.top = f.offsetHeight + 'px'; }
  window.addEventListener('resize', () => { if (ED.on) posicionar(); });
  function abrir() {
    if (!RT.G || !RT.G.S.reg) return; ED.on = true; ED.pts = []; ED.dentro = new Set(); RT.G.interceptar = clicar;
    document.body.classList.add('ged-on'); const mapa = $('#geo-mapa'); if (!$('#ged-painel')) mapa.insertAdjacentHTML('beforeend', '<aside id="ged-painel" aria-label="Editor de regiões"></aside>');
    posicionar(); painel(); G().render(); setTimeout(() => { const m = G().S.geo.mapa; if (m) { m.redimensionar(); m.marcar(); } }, 40);
  }
  function fechar() {
    ED.on = false; ED.pts = []; RT.G.interceptar = null; document.body.classList.remove('ged-on'); const p = $('#ged-painel'); if (p) p.remove();
    G().render(); setTimeout(() => { const m = G().S.geo.mapa; if (m) { m.redimensionar(); m.marcar(); } }, 40);
  }
  /* clique numa cidade (mapa ou busca) enquanto o editor está aberto */
  function clicar(code) {
    if (!ED.on) return false; const c = String(code), S = G().S, tp = tipo();
    if (ED.alvo === NF) {                              // "Não fazemos": liga/desliga a cidade
      salvarDesfazer(); S.reg.aprend = S.reg.aprend || {}; const o = G().info(c);
      if (((S.reg.aprend[c] || {})[tp]) === NF) { esquecer(c, tp); toast((o ? o.nome : 'Cidade') + ': desmarcada.'); }
      else { for (const l of S.reg.regioes) if (l.tipo === tp && l.cidades.some(x => String(x) === c)) l.cidades = l.cidades.filter(x => String(x) !== c); S.reg.aprend[c] = S.reg.aprend[c] || {}; S.reg.aprend[c][tp] = NF; toast((o ? o.nome : 'Cidade') + ': “Não fazemos” (fica cinza).'); }
      G().salvarReg(); painel(); return true;
    }
    const i = ED.pts.indexOf(c);
    if (i === 0 && ED.pts.length >= 3) { dentroDoContorno(); painel(); G().render(); toast('Contorno fechado. Confira e clique em “Fechar e aplicar”.'); return true; }
    if (i < 0) ED.pts.push(c); dentroDoContorno(); painel(); G().render(); return true;
  }
  function aplicar() {
    const S = G().S, tp = tipo(); let l;
    if (ED.alvo === '__nova') {
      const nm = ($('#ged-novo') || {}).value; if (!nm || !nm.trim()) { toast('Digite o nome da nova ' + tipoN() + '.'); return; }
      let id = N.norm(nm).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lista'; while (lista(id)) id += '-2';
      const usadas = new Set(S.reg.regioes.map(x => x.cor)); salvarDesfazer();
      l = { id, nome: nm.trim().slice(0, 60), tipo: tp, grupo: 'rota', alias: [], cidades: [], cor: CORES.find(c => !usadas.has(c)) || '#3A86C8' }; S.reg.regioes.push(l);
    } else { l = lista(ED.alvo); if (!l) { toast('Escolha em qual ' + tipoN() + ' aplicar.'); return; } salvarDesfazer(); }
    const set = new Set(l.cidades.map(String)); let pul = 0;
    for (const c of ED.dentro) {
      if (ED.soLivres) { const r0 = G().classe(c, tp); if (r0.fonte === 'lista' && !r0.ids.includes(l.id)) { pul++; continue; } }
      for (const o of S.reg.regioes) if (o !== l && o.tipo === tp && o.cidades.some(x => String(x) === c)) o.cidades = o.cidades.filter(x => String(x) !== c);
      set.add(c); esquecer(c, tp);
    }
    l.cidades = [...set]; const n = ED.dentro.size; ED.alvo = l.id; ED.pts = []; ED.dentro = new Set();
    G().salvarReg(); painel(); toast((n - pul) + ' cidade(s) agora são de ' + l.nome + (pul ? ' · ' + pul + ' já eram de outra e ficaram como estavam' : '') + '. Já vale em todo o programa.');
  }
  RT.ged.paraMapa = function () {
    if (!ED.on) return null; const cor = (ED.alvo && lista(ED.alvo) && lista(ED.alvo).cor) || '#E8590C';
    return { pts: ED.pts.map(c => G().info(c)).filter(Boolean).map(o => ({ lat: o.lat, lon: o.lon })), dentro: ED.dentro, cor };
  };
  RT.ged.aberto = () => ED.on;

  document.addEventListener('click', async e => {
    const t = e.target; if (!t.closest) return;
    if (t.id === 'ged-abrir') { ED.on ? fechar() : abrir(); return; }
    if (!t.closest('#ged-painel')) return; let b;
    const S = G().S;
    if (t.id === 'ged-sair') return fechar();
    if (t.id === 'ged-volta') { ED.pts.pop(); dentroDoContorno(); painel(); G().render(); return; }
    if (t.id === 'ged-limpa') { ED.pts = []; dentroDoContorno(); painel(); G().render(); return; }
    if (t.id === 'ged-aplica') return aplicar();
    if (t.id === 'ged-lacunas') {
      const l = lacunas(); if (!l.length) { toast('Nenhuma lacuna: todas as cidades da área já têm ' + tipoN() + '.'); return; }
      salvarDesfazer(); for (const { c, id } of l) { const x = lista(id); if (x && !x.cidades.some(y => String(y) === c)) x.cidades.push(c); }
      G().salvarReg(); painel(); toast(l.length + ' cidade(s) gravadas na ' + tipoN() + ' da vizinhança. Dá para desfazer.'); return;
    }
    if (t.id === 'ged-desfaz') { if (!ED.desfazer) return; S.reg = JSON.parse(ED.desfazer); ED.desfazer = null; G().salvarReg(); painel(); toast('Última mudança desfeita.'); return; }
    if (t.id === 'ged-todas') { S.geo.ocultos.clear(); G().render(); return; }
    if ((b = t.closest('[data-ged-so]'))) { S.geo.ocultos = new Set(listas().filter(l => l.id !== b.dataset.gedSo).map(l => l.id)); G().render(); return; }
    if ((b = t.closest('[data-ged-del]'))) {
      const l = lista(b.dataset.gedDel); if (!l) return;
      if (!(await U.confirmar('Excluir ' + l.nome + '?', 'As ' + l.cidades.length + ' cidades dela ficam sem ' + (l.tipo === 'base' ? 'base' : 'região') + ' (o programa volta a sugerir pela proximidade). Dá para desfazer em seguida.', 'Excluir', true))) return;
      salvarDesfazer(); S.reg.regioes = S.reg.regioes.filter(x => x !== l); for (const k in S.reg.aprend || {}) if (S.reg.aprend[k][l.tipo] === l.id) delete S.reg.aprend[k][l.tipo];
      G().salvarReg(); painel();
    }
  });
  document.addEventListener('change', e => {
    const t = e.target; if (!t.closest || !t.closest('#ged-painel')) return; const S = G().S;
    if (t.id === 'ged-livres') { ED.soLivres = t.checked; return; }
    if (t.id === 'ged-alvo') { ED.alvo = t.value; if (ED.alvo === NF) { ED.pts = []; ED.dentro = new Set(); } painel(); G().render(); return; }
    const it = t.closest('.ged-it'); if (!it || !t.dataset.ged) return; const l = lista(it.dataset.id); if (!l) return;
    salvarDesfazer();
    if (t.dataset.ged === 'cor') l.cor = t.value;
    else if (t.dataset.ged === 'nome') { const v = t.value.trim().slice(0, 60); if (!v) { t.value = l.nome; return; } l.nome = v; }
    else if (t.dataset.ged === 'alias') l.alias = t.value.split(',').map(s => s.trim().toUpperCase().slice(0, 30)).filter(Boolean);
    G().salvarReg(); painel(); toast('Salvo. Já vale em todo o programa.');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ED.on && !document.querySelector('.fundo')) fechar(); });
})(typeof window !== 'undefined' ? window : globalThis);
