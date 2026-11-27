/* Health Log. · janela flutuante "Romaneios": os romaneios (XML + PDF) da operação de hoje. Abrir um deles mostra as cidades dele; desmarcar uma
   cidade a tira da rota de hoje (as notas dela ficam "não vai hoje": saem de carros, totais e pendentes, mas continuam na cidade). Cidade sem
   nenhuma nota restante fica cinza com listras brancas no mapa; dá para abri-la e ver as notas, só não dá para pôr em carro. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {}), N = RT.N, U = RT.U, esc = U.esc;
  const J = RT.romj = { aberto: new Set() };
  const A = () => RT.A, S = () => RT.S;
  function linhas() {
    const s = S(), o = s.op; if (!o || !s.idx) return [];
    const ativas = N.ativas(o), m$ = N.fmtMoeda;
    const base = N.quadroXml(o).filter(l => l.xml), nomes = new Set(base.map(l => l.xml.nome));
    for (const n of ativas) if (n.extra && !nomes.has(n.origem)) { nomes.add(n.origem); base.push({ xml: { nome: n.origem }, rom: null }); }   // ROMANEIO - EXTRA (notas bipadas)
    return base.map(l => {
      const nome = l.xml.nome, porCid = new Map();
      for (const n of ativas) if (n.origem === nome) { const k = s.idx.chaveCidadeDaNota.get(n.id); if (!porCid.has(k)) porCid.set(k, []); porCid.get(k).push(n); }
      const cidades = [...porCid.entries()].map(([k, notas]) => { const c = s.idx.cidades.get(k), vai = notas.filter(n => !N.naoVai(o, n)).length; return { k, nome: c ? c.nome : k, uf: c ? c.uf : '', notas, vai, tot: N.somar(notas) }; }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return { nome, rom: l.rom, cidades, notas: cidades.reduce((t, c) => t + c.notas.length, 0), m$ };
    });
  }
  J.render = function () {
    const jan = document.getElementById('jan-rom') || (RT.U.$ && RT.U.$('#jan-rom')); if (!jan || S().modoMapa) return;
    const corpo = jan.querySelector('#rom-corpo'), qt = jan.querySelector('#rom-qt'); if (!corpo) return;
    const L = linhas(); qt.textContent = String(L.length);
    if (!S().op) { corpo.innerHTML = '<div class="vazio-lista">Sem operação aberta.</div>'; return; }
    if (!L.length) { corpo.innerHTML = '<div class="vazio-lista">Nenhum romaneio/XML na operação de hoje.</div>'; return; }
    const rol = corpo.scrollTop;
    corpo.innerHTML = '<p class="dica" style="margin:6px 10px">Abra um romaneio e <b>desmarque as cidades que não vão hoje</b>. Elas saem dos carros e do trabalho do dia, e ficam em cinza no mapa.</p>' + L.map(x => {
      const vao = x.cidades.filter(c => c.vai > 0).length, titulo = x.rom ? (x.rom.motorista || x.rom.arquivo) : x.nome;
      return '<details class="rm" data-x="' + esc(x.nome) + '"' + (J.aberto.has(x.nome) ? ' open' : '') + '><summary><b>' + esc(titulo) + '</b><small>' + esc(x.nome.replace(/\.xml$/i, '')) + (x.rom && x.rom.placa ? ' · ' + esc(x.rom.placa) : '') + '</small><span class="rm-qt' + (vao < x.cidades.length ? ' parcial' : '') + '">' + vao + '/' + x.cidades.length + ' cidades</span></summary>' +
        '<div class="rm-acoes"><button type="button" class="lib" data-rm-todas="0" data-x="' + esc(x.nome) + '">tirar todas</button><button type="button" class="lib" data-rm-todas="1" data-x="' + esc(x.nome) + '">todas vão</button></div><ul class="rm-cid">' +
        x.cidades.map(c => '<li class="' + (c.vai ? '' : 'fora') + '"><label><input type="checkbox" data-rm-cid="' + esc(c.k) + '" data-x="' + esc(x.nome) + '"' + (c.vai === c.notas.length ? ' checked' : '') + '><span class="rm-n">' + esc(c.nome) + ' <small>' + esc(c.uf) + '</small></span></label><span class="rm-v">' + c.notas.length + ' nota' + (c.notas.length > 1 ? 's' : '') + ' · ' + x.m$(c.tot.valor) + '</span></li>').join('') + '</ul></details>';
    }).join('');
    corpo.scrollTop = rol;
  };
  function mudar(x, keys, sim) {
    const s = S(), o = s.op, ids = [];
    for (const l of linhas()) if (l.nome === x) for (const c of l.cidades) if (!keys || keys.includes(c.k)) for (const n of c.notas) if (N.naoVai(o, n) !== sim) ids.push(n.id);
    if (!ids.length) return;
    const tiradas = sim ? ids.filter(id => o.atrib[id] != null).length : 0;
    A().mutar(sim ? 'tirar da rota de hoje' : 'voltar para a rota de hoje', () => N.marcarNaoVai(o, s.idx, ids, sim));
    U.toast((sim ? 'Fora da rota de hoje: ' : 'De volta à rota de hoje: ') + ids.length + ' nota(s)' + (tiradas ? ' (' + tiradas + ' saíram de veículos)' : '') + '.', { rotulo: 'Desfazer', fn: () => A().desfazer() });
  }
  J.ligar = function () {
    const jan = document.getElementById('jan-rom'); if (!jan) return;
    jan.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('details.rm'); if (!d) return; d.open ? J.aberto.add(d.dataset.x) : J.aberto.delete(d.dataset.x); }, true);
    jan.addEventListener('change', e => { const c = e.target.closest && e.target.closest('[data-rm-cid]'); if (c) mudar(c.dataset.x, [c.dataset.rmCid], !c.checked); });
    jan.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-rm-todas]'); if (b) { mudar(b.dataset.x, null, b.dataset.rmTodas === '0'); return; }
      if (e.target.closest('[data-rm-fechar]')) A().janVer('rom', false);
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
