/* Health Log. · "Alimentar as referências" da Geolocalização — IGUAL ao do Health Search:
   jogar PDF (com texto ou escaneado, lido pelo leitor de fotos) ou TXT com a lista de cidades, ou colar a lista; o app casa os nomes
   com o IBGE (corrige a grafia, escolhe a cidade certa quando há homônimas), mostra uma PRÉVIA editável (nome, tipo, "também chamada de",
   o que entra e o que sai) e só grava quando você toca em "Salvar lista". Listas cadastradas e "Para conferir" também são como no HS. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const { N, U } = RT; const { $, esc, toast } = U;
  const G = () => RT.G, S = () => RT.G.S;
  const CORES = ['#2A9D8F', '#E07A1F', '#7B5CC4', '#D1495B', '#3A86C8', '#4C9A2A', '#137F7A', '#3D5A80', '#B5651D', '#C2185B', '#00838F', '#6D4C41', '#7CB342', '#5E35B1'];
  const TITULO = /REGI[AÃ]O|CIDADES ATENDIDAS|^\s*BASE\b|\bBASE\s|^ROTA\b|^P[AÁ]GINA\b|^INTERIOR$/i;
  const fmtN = n => Number(n || 0).toLocaleString('pt-BR');
  const norm = s => N.normCidade(s);
  const prevs = [];

  /* ---------- casar nomes com o IBGE ---------- */
  let IDX = null, IDX_MUN = null;
  function ibge() {
    if (IDX && IDX_MUN === S().mun) return IDX; IDX_MUN = S().mun;
    const uf = {}; for (const c in S().mun) { const m = S().mun[c]; (uf[m[1]] = uf[m[1]] || []).push([norm(m[0]), { c, n: m[0], u: m[1] }]); }
    return (IDX = { uf });
  }
  function lev(a, b) { if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return m || n; let p = new Array(n + 1); for (let j = 0; j <= n; j++) p[j] = j; for (let i = 1; i <= m; i++) { const q = [i]; for (let j = 1; j <= n; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; } return p[n]; }
  const razao = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length);
  function limparNome(s) {
    let t = String(s || '').replace(/[|—_\[\]=“”«»¢~]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[^A-Za-zÀ-ú')]+$/, '').replace(/^[^A-Za-zÀ-ú]+/, '').replace(/\s*[\/\-–]\s*([A-Z]{2})\s*$/, ' /$1');
    t = t.replace(/\bS[3a]o\b|\bS30\b|\bSdo\b|\bSéo\b/g, 'São').replace(/Jodo/g, 'João'); return t;
  }
  const dist = (a, b) => { const la = (a.lat + b.lat) / 2 * Math.PI / 180, dx = (a.lon - b.lon) * 111.32 * Math.cos(la), dy = (a.lat - b.lat) * 110.57; return Math.sqrt(dx * dx + dy * dy); };
  function casar(nomes, ufsPref) {
    const I = ibge(), ufs = [...(ufsPref && ufsPref.length ? ufsPref : G().ufs)].filter(u => I.uf[u]);
    const chaves = []; for (const u of ufs) for (const [k, o] of I.uf[u]) chaves.push({ k, o });
    const ok = [], amb = [], falta = [];
    for (const bruto of nomes) {
      let t = limparNome(bruto), ufN = null; const mu = t.match(/\s\/([A-Z]{2})$/); if (mu) { ufN = mu[1]; t = t.slice(0, mu.index); }
      const k = norm(t); if (k.length < 3) continue;
      let cand = chaves.filter(x => (x.k === k || x.k.replace(/ /g, '') === k.replace(/ /g, '')) && (!ufN || x.o.u === ufN)).map(x => x.o), fz = false;
      if (!cand.length) {
        let best = null, bs = 0; for (const x of chaves) { if (ufN && x.o.u !== ufN) continue; if (Math.abs(x.k.length - k.length) > 4) continue; const s = razao(k, x.k); if (s > bs) { bs = s; best = x; } }
        if (best && bs >= 0.8) { cand = chaves.filter(x => x.k === best.k).map(x => x.o); fz = true; } else { falta.push({ nome: bruto, sug: best && bs >= 0.6 ? best.o : null }); continue; }
      }
      (cand.length === 1 ? ok : amb).push({ nome: bruto, cand, fz });
    }
    const un = ok.map(x => G().info(x.cand[0].c)).filter(Boolean);
    const med = un.length ? { lat: un.map(p => p.lat).sort((a, b) => a - b)[un.length >> 1], lon: un.map(p => p.lon).sort((a, b) => a - b)[un.length >> 1] } : null;
    for (const x of amb) { x.cand.sort((a, b) => { const pa = G().info(a.c), pb = G().info(b.c); if (!med || !pa || !pb) return (a.u === 'SP' ? -1 : 0); return dist(med, pa) - dist(med, pb); }); ok.push({ nome: x.nome, cand: [x.cand[0]], fz: x.fz, amb: true }); }
    return { cods: [...new Set(ok.map(x => x.cand[0].c))], ok, falta };
  }

  /* ---------- ler PDF / TXT ---------- */
  const celulasDeLinhas = linhas => { const out = []; for (const l of linhas) for (const p of l.split(/\s{2,}|\t|;|\|/)) { const t = p.trim(); if (t) out.push(t); } return out; };
  function segmentos(celulas) {
    const segs = []; let atual = { titulo: null, celulas: [] };
    for (const c of celulas) {
      if (TITULO.test(c) && !/^P[AÁ]GINA/i.test(c)) {
        const t = c.replace(/\s+/g, ' ').trim(), ja = segs.find(s => norm(s.titulo || '') === norm(t)) || (norm(atual.titulo || '') === norm(t) ? atual : null);
        if (ja) { if (ja !== atual) { if (atual.celulas.length || atual.titulo) segs.push(atual); atual = ja; segs.splice(segs.indexOf(ja), 1); } continue; }
        if (atual.celulas.length || atual.titulo) segs.push(atual); atual = { titulo: t, celulas: [] }; continue;
      }
      atual.celulas.push(c);
    }
    if (atual.celulas.length || atual.titulo) segs.push(atual); return segs.filter(s => s.celulas.length);
  }
  /* tabela escaneada: apaga as linhas da grade e separa as colunas antes do OCR */
  function limparGrade(cv) {
    const W = cv.width, H = cv.height, cx = cv.getContext('2d'), im = cx.getImageData(0, 0, W, H), d = im.data, esc_ = new Uint8Array(W * H);
    for (let i = 0, j = 0; j < W * H; i += 4, j++) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; esc_[j] = l < 140 ? 1 : 0; }
    const col = new Uint32Array(W), lin = new Uint32Array(H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (esc_[y * W + x]) { col[x]++; lin[y]++; }
    const vx = []; for (let x = 0; x < W; x++) if (col[x] > H * 0.45) vx.push(x);
    for (let j = 0, i = 0; j < W * H; j++, i += 4) { const x = j % W, y = (j / W) | 0, linha = col[x] > H * 0.45 || lin[y] > W * 0.45, v = linha ? 255 : (esc_[j] ? 0 : 255); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    cx.putImageData(im, 0, 0);
    const cl = []; for (const x of vx) { if (cl.length && x - cl[cl.length - 1][1] <= 6) cl[cl.length - 1][1] = x; else cl.push([x, x]); }
    const partes = []; for (let i = 0; i < cl.length - 1; i++) { const a = cl[i][1] + 4, b = cl[i + 1][0] - 4; if (b - a < W * 0.12) continue; const c = document.createElement('canvas'); c.width = b - a; c.height = H; c.getContext('2d').drawImage(cv, a, 0, b - a, H, 0, 0, b - a, H); partes.push(c); }
    return partes.length >= 2 ? partes : [cv];
  }
  async function lerArquivo(f, status) {
    if (/\.(txt|csv)$/i.test(f.name) || /^text\//.test(f.type)) { const txt = await f.text(); return segmentos(celulasDeLinhas(txt.split(/\r?\n/))); }
    const lib = await RT.rom.pdfjs(), buf = await f.arrayBuffer(), doc = await lib.getDocument({ data: new Uint8Array(buf), verbosity: 0, isOffscreenCanvasSupported: false }).promise, celulas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pg = await doc.getPage(n), tc = await pg.getTextContent(), its = tc.items.filter(i => i.str && i.str.trim());
      if (its.reduce((s, i) => s + i.str.trim().length, 0) >= 15) {
        const lin = new Map(); for (const it of its) { const y = Math.round(it.transform[5] / 3); if (!lin.has(y)) lin.set(y, []); lin.get(y).push(it); }
        for (const y of [...lin.keys()].sort((a, b) => b - a)) {
          const l = lin.get(y).sort((a, b) => a.transform[4] - b.transform[4]); let cel = null, fim = 0;
          for (const it of l) { const x = it.transform[4], h = Math.abs(it.transform[3]) || 10, txt = it.str; if (cel !== null && x - fim < h * 0.9) cel += (x - fim > h * 0.15 ? ' ' : '') + txt; else { if (cel && cel.trim()) celulas.push(cel.trim()); cel = txt; } fim = x + (it.width || txt.length * h * 0.5); }
          if (cel && cel.trim()) celulas.push(cel.trim());
        }
      } else {                                              // PDF escaneado: leitor de fotos (OCR local)
        status && status('lendo a página ' + n + ' de ' + doc.numPages + ' com o leitor de fotos…');
        const vp = pg.getViewport({ scale: 2.6 }), cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); await pg.render({ canvasContext: cx, viewport: vp }).promise;
        const w = await RT.rom.ocr();
        for (const parte of limparGrade(cv)) {
          const r = await w.recognize(parte, {}, { text: true, blocks: true });
          let ws = r.data.words; if (!ws && r.data.blocks) { ws = []; for (const b of r.data.blocks) for (const p of (b.paragraphs || [])) for (const l of (p.lines || [])) for (const wd of (l.words || [])) ws.push(wd); }
          ws = (ws || []).filter(x => x.text && x.text.trim()).map(x => ({ text: x.text, x0: x.bbox.x0, y0: x.bbox.y0, x1: x.bbox.x1, y1: x.bbox.y1 }));
          ws.sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2); const linhas = [];
          for (const wd of ws) { const yc = (wd.y0 + wd.y1) / 2, h = wd.y1 - wd.y0, l = linhas.find(L => Math.abs(L.yc - yc) < h * 0.6); if (l) l.ws.push(wd); else linhas.push({ yc, ws: [wd] }); }
          for (const L of linhas) { L.ws.sort((a, b) => a.x0 - b.x0); let cel = null, fim = 0, h = 0; for (const wd of L.ws) { const hh = wd.y1 - wd.y0; if (cel !== null && wd.x0 - fim < Math.max(h, hh) * 1.2) cel += ' ' + wd.text; else { if (cel) celulas.push(cel); cel = wd.text; } fim = wd.x1; h = hh; } if (cel) celulas.push(cel); }
        }
      }
    }
    return segmentos(celulas);
  }
  const tituloDeArquivo = nome => nome.replace(/\.[^.]+$/, '').replace(/^(Rota|Planilha|Lista|LISTA)\s*[-–_]\s*/i, '').replace(/_/g, ' ').replace(/Regi o/, 'Região').replace(/Ribeir o/, 'Ribeirão').trim();
  const slug = s => norm(s).toLowerCase().replace(/ /g, '-').slice(0, 40) || ('lista-' + Date.now());
  const lista = id => S().reg.regioes.find(l => l.id === id);

  /* ---------- prévia ---------- */
  function previa(nome, tipo, celulas, origem) {
    nome = String(nome || 'Lista').replace(/^\s*CIDADES ATENDIDAS\s*/i, '').trim() || 'Lista';
    const nomes = celulas.filter(c => !TITULO.test(c)), ufTit = (nome.match(/[-\/]\s*(SP|MG|GO|MS|PR|RJ|ES|DF)\s*$/) || [])[1];
    const pref = tipo === 'base' && /CONTAGEM|\bBH\b|BELO HORIZONTE/i.test(nome) ? ['MG'] : null;
    const r = casar(nomes, pref || (ufTit && tipo === 'base' ? [ufTit, 'MG', 'SP'] : null));
    const alias = []; if (/MINAS GERAIS E REGI/i.test(nome)) alias.push('VIA MINAS'); if (/TRI[AÂ]NGULO/i.test(nome)) alias.push('LKR');
    const m = nome.match(/BASE\s+([A-ZÀ-Ú]+)/i); if (tipo === 'base' && m) { const sig = { ARARAQUARA: 'AQA', CAJAMAR: 'CAJ', CONTAGEM: 'BH' }[norm(m[1])]; if (sig) alias.push(sig); }
    const set = new Set(r.cods); let alvo = S().reg.regioes.find(l => l.id === slug(nome) || norm(l.nome) === norm(nome));
    if (!alvo && r.cods.length) { let bs = 0; for (const l of S().reg.regioes) { const com = l.cidades.filter(c => set.has(String(c))).length, sc = com / Math.max(1, l.cidades.length, r.cods.length); if (sc > bs) { bs = sc; alvo = l; } } if (bs < 0.6) alvo = null; }
    if (alvo) { for (const a of alvo.alias || []) if (!alias.includes(a)) alias.push(a); tipo = alvo.tipo; }
    prevs.push(Object.assign({ k: Date.now() + Math.random(), nome: alvo ? alvo.nome : nome, lido: nome, alvo: alvo ? alvo.id : null, tipo, alias, origem }, r)); renderPrevs();
  }
  function renderPrevs() {
    $('#geo-prevs').innerHTML = prevs.map((p, i) => {
      const ex = (p.alvo && lista(p.alvo)) || S().reg.regioes.find(l => l.id === slug(p.nome) || norm(l.nome) === norm(p.nome));
      const dif = ex ? (() => { const a = new Set(ex.cidades.map(String)), b = new Set(p.cods), ent = p.cods.filter(c => !a.has(c)).length, sai = ex.cidades.filter(c => !b.has(String(c))).length; return ent || sai ? '; entram ' + ent + ', saem ' + sai : '; nada muda'; })() : '';
      return '<div class="geo-prev" data-prev="' + i + '"><div class="cab">' +
        '<label>Nome<input data-p="nome" value="' + esc(p.nome) + '"></label>' +
        '<label>Tipo<select data-p="tipo"><option value="regiao"' + (p.tipo === 'regiao' ? ' selected' : '') + '>Região (rota)</option><option value="base"' + (p.tipo === 'base' ? ' selected' : '') + '>Base</option></select></label>' +
        '<label>Também chamada de<input data-p="alias" value="' + esc(p.alias.join(', ')) + '" placeholder="Ex.: VIA MINAS, LKR"></label>' +
        '<button class="btn pri" type="button" data-p-salvar="' + i + '">' + (ex ? 'Atualizar lista' : 'Salvar lista') + '</button><button class="btn" type="button" data-p-desc="' + i + '">Descartar</button></div>' +
        '<p class="sub" style="margin:8px 0 0">' + esc(p.origem || '') + ' · <b>' + fmtN(p.cods.length) + '</b> cidade(s) reconhecida(s)' + (p.ok.filter(x => x.fz).length ? ' (' + p.ok.filter(x => x.fz).length + ' corrigida(s) pela grafia)' : '') + (p.lido && p.lido !== p.nome ? ' · título na folha: “' + esc(p.lido) + '”' : '') + (ex ? ' · vai atualizar a lista <b>' + esc(ex.nome) + '</b> (hoje com ' + ex.cidades.length + ' cidades' + dif + ')' : '') + '</p>' +
        '<div class="nomes">' + p.cods.slice(0, 400).map(c => { const o = G().info(c); return o ? esc(o.nome) + (o.uf !== 'SP' ? '/' + o.uf : '') : c; }).join(', ') + '</div>' +
        (p.falta.length ? '<p class="falta" style="font-size:var(--fs-sm);margin:6px 0 0">Não reconheci: ' + p.falta.map(f => esc(f.nome) + (f.sug ? ' (seria ' + esc(f.sug.n) + '/' + f.sug.u + '?)' : '')).join(', ') + '</p>' : '') + '</div>';
    }).join('');
  }
  async function alimentar(files) {
    const st = $('#geo-status');
    for (const f of files) {
      st.innerHTML = '<span class="gira"></span> Lendo ' + esc(f.name) + '…';
      try {
        const segs = await lerArquivo(f, t => { st.innerHTML = '<span class="gira"></span> ' + esc(f.name) + ': ' + esc(t); });
        if (!segs.length) { toast(f.name + ': não achei nomes de cidades.'); continue; }
        for (const sg of segs) { const nome = sg.titulo || tituloDeArquivo(f.name); previa(nome, /BASE/i.test(nome) ? 'base' : 'regiao', sg.celulas, f.name); }
      } catch (e) { console.error(e); toast('Não consegui ler ' + f.name + (e && e.message ? ' (' + e.message + ')' : '') + '.'); }
    }
    st.innerHTML = prevs.length ? 'Confira as listas abaixo e toque em “Salvar lista”.' : ''; $('#geo-arq').value = '';
  }
  function salvarPrev(i) {
    const p = prevs[i]; if (!p) return; const box = document.querySelector('[data-prev="' + i + '"]');
    p.nome = box.querySelector('[data-p="nome"]').value.trim().slice(0, 60) || p.nome; p.tipo = box.querySelector('[data-p="tipo"]').value; p.alias = box.querySelector('[data-p="alias"]').value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!p.cods.length) { toast('Nenhuma cidade reconhecida nesta lista.'); return; }
    const id = slug(p.nome); let l = (p.alvo && lista(p.alvo)) || S().reg.regioes.find(x => x.id === id || norm(x.nome) === norm(p.nome));
    G().S.geo.desfazer = JSON.stringify(S().reg);
    if (l) { l.cidades = p.cods.slice(); l.tipo = p.tipo; l.alias = p.alias; l.nome = p.nome; l.fonte = p.origem || 'alimentado'; l.em = new Date().toISOString(); }
    else { const usadas = new Set(S().reg.regioes.map(x => x.cor)); l = { id, nome: p.nome, tipo: p.tipo, grupo: 'rota', alias: p.alias, cidades: p.cods.slice(), cor: CORES.find(c => !usadas.has(c)) || CORES[S().reg.regioes.length % CORES.length], fonte: p.origem || 'alimentado', em: new Date().toISOString() }; S().reg.regioes.push(l); }
    prevs.splice(i, 1); G().salvarReg(); renderPrevs(); toast('Lista ' + l.nome + ' salva com ' + l.cidades.length + ' cidades.');
  }

  /* ---------- listas cadastradas e Para conferir (tabelas, como no HS) ---------- */
  function renderListas() {
    const ls = [...S().reg.regioes].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome, 'pt-BR'));
    $('#geo-listas').innerHTML = '<div class="rolagem"><table><thead><tr><th></th><th>Lista</th><th>Tipo</th><th class="num">Cidades</th><th>Conta como</th><th>Origem</th><th></th></tr></thead><tbody>' +
      ls.map(l => '<tr><td><span class="geo-cor" style="background:' + esc(l.cor) + '"></span></td><td class="forte">' + esc(l.nome) + ((l.alias || []).length ? ' <span class="sec">(' + esc(l.alias.join(', ')) + ')</span>' : '') + '</td><td>' + (l.tipo === 'base' ? 'Base' : 'Região') + '</td><td class="num">' + fmtN(l.cidades.length) + '</td>' +
        '<td><select class="filtro" data-geo-grupo="' + esc(l.id) + '" aria-label="Conta como" style="min-height:28px;padding:1px 6px"><option value="rota"' + (l.grupo !== 'fora' ? ' selected' : '') + '>Em rota</option><option value="fora"' + (l.grupo === 'fora' ? ' selected' : '') + '>Fora de rota</option></select></td>' +
        '<td class="sec">' + esc(l.fonte === 'embutido' || !l.fonte ? 'veio com o programa' : l.fonte) + '</td><td style="text-align:right;white-space:nowrap"><button class="btn mini" type="button" data-geo-ver="' + esc(l.id) + '">' + (S().geo.foco === l.id ? 'Ver todas' : 'Ver no mapa') + '</button> ' + (l.id.startsWith('matriz') ? '' : '<button class="btn mini perigo" type="button" data-geo-rem="' + esc(l.id) + '">Remover</button>') + '</td></tr>').join('') + '</tbody></table></div>';
  }
  function paraConferir() {
    const out = [], vistos = new Set();
    if (S().idx) for (const c of S().idx.lista) { if (!c.code || vistos.has(c.code)) continue; vistos.add(c.code); for (const tipo of ['regiao', 'base']) { const r = G().classe(c.code, tipo); if (r.fonte === 'auto') out.push({ c: String(c.code), tipo, r }); } }
    return out.sort((a, b) => a.r.conf - b.r.conf);
  }
  function renderConferir() {
    const l = paraConferir(); $('#geo-conf-todas').hidden = !l.length;
    $('#geo-conferir').innerHTML = l.length ? '<div class="rolagem" style="max-height:320px;overflow:auto"><table><thead><tr><th>Cidade</th><th>Tipo</th><th>Etiqueta automática</th><th class="num">Certeza</th><th></th></tr></thead><tbody>' +
      l.map(x => { const o = G().info(x.c), cor = (lista(x.r.ids[0]) || {}).cor || '#888', nm = (lista(x.r.ids[0]) || {}).nome || ''; return '<tr><td class="forte">' + esc(o.nome) + '/' + esc(o.uf) + '</td><td>' + (x.tipo === 'base' ? 'Base' : 'Região') + '</td><td><span class="geo-cor" style="background:' + esc(cor) + '"></span> ' + esc(nm) + '</td><td class="num">' + x.r.conf + '%</td><td style="text-align:right;white-space:nowrap"><button class="btn mini pri" type="button" data-geo-conf1="' + esc(x.c) + '|' + x.tipo + '">Confirmar</button> <button class="btn mini" type="button" data-geo-ir="' + esc(x.c) + '">Abrir</button></td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="vazio-lista">Nada para conferir: as cidades da operação já estão nas listas ou foram confirmadas.</div>';
  }
  RT.gal = { render() { renderListas(); renderConferir(); }, previa, alimentar, casar, paraConferir, prevs };

  /* ---------- eventos ---------- */
  function ligar() {
    const arq = $('#geo-arq'); if (!arq) return;
    arq.addEventListener('change', e => { if (e.target.files.length) alimentar([...e.target.files]); });
    const sol = $('#geo-soltar');
    sol.addEventListener('dragover', e => { e.preventDefault(); sol.classList.add('sobre'); }); sol.addEventListener('dragleave', () => sol.classList.remove('sobre'));
    sol.addEventListener('drop', e => { e.preventDefault(); sol.classList.remove('sobre'); const f = [...e.dataTransfer.files]; if (f.length) alimentar(f); });
    sol.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); arq.click(); } });
    $('#geo-c-ok').onclick = () => {
      const nome = $('#geo-c-nome').value.trim() || 'Lista colada', txt = $('#geo-c-txt').value;
      if (!txt.trim()) { toast('Cole a lista de cidades (uma por linha).'); return; }
      previa(nome, $('#geo-c-tipo').value, celulasDeLinhas(txt.split(/\r?\n/)), 'texto colado'); $('#geo-status').textContent = 'Confira a lista abaixo e toque em “Salvar lista”.';
    };
    $('#geo-prevs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pSalvar != null) salvarPrev(+b.dataset.pSalvar);
      else if (b.dataset.pDesc != null) { prevs.splice(+b.dataset.pDesc, 1); renderPrevs(); $('#geo-status').textContent = prevs.length ? 'Confira as listas abaixo e toque em “Salvar lista”.' : ''; }
    });
    $('#geo-listas').addEventListener('click', async e => {
      const ver = e.target.closest('[data-geo-ver]'), rem = e.target.closest('[data-geo-rem]');
      if (ver) { const id = ver.dataset.geoVer, s = S(); s.geo.foco = s.geo.foco === id ? null : id; const r = lista(id); if (s.geo.foco && r) { s.geo.tipo = r.tipo; const pts = r.cidades.map(c => G().info(c)).filter(Boolean); if (pts.length && s.geo.mapa) s.geo.mapa.enquadrarPontos(pts); } G().render(); }
      if (rem) { const r = lista(rem.dataset.geoRem); if (r && await U.confirmar('Remover “' + r.nome + '”?', 'A lista (' + r.cidades.length + ' cidades) sai daqui. “Restaurar listas originais” traz de volta as que vieram com o programa. Dá para desfazer em seguida.', 'Remover', true)) { S().geo.desfazer = JSON.stringify(S().reg); S().reg.regioes = S().reg.regioes.filter(x => x !== r); for (const k in S().reg.aprend || {}) if (S().reg.aprend[k][r.tipo] === r.id) delete S().reg.aprend[k][r.tipo]; G().salvarReg(); } }
    });
    $('#geo-listas').addEventListener('change', e => { const gr = e.target.closest('[data-geo-grupo]'); if (!gr) return; const r = lista(gr.dataset.geoGrupo); if (r) { r.grupo = gr.value; G().salvarReg(); toast('Salvo. Já vale em todo o programa.'); } });
    $('#geo-conferir').addEventListener('click', e => {
      const ir = e.target.closest('[data-geo-ir]'), c1 = e.target.closest('[data-geo-conf1]');
      if (ir) G().selecionar(ir.dataset.geoIr, true);
      if (c1) { const [cod, tp] = c1.dataset.geoConf1.split('|'), r = G().classe(cod, tp); if (r.ids[0]) { G().ensinar(cod, tp, r.ids[0]); toast('Confirmado.'); } }
    });
    $('#geo-conf-todas').onclick = async () => {
      const l = paraConferir(); if (!l.length) return;
      if (!(await U.confirmar('Confirmar todas?', 'As ' + l.length + ' etiquetas automáticas das cidades desta operação viram “ensinadas” e passam a valer em todo o programa.', 'Confirmar todas'))) return;
      const s = S(); s.geo.desfazer = JSON.stringify(s.reg); s.reg.aprend = s.reg.aprend || {}; for (const x of l) { s.reg.aprend[x.c] = s.reg.aprend[x.c] || {}; s.reg.aprend[x.c][x.tipo] = x.r.ids[0]; }
      G().salvarReg(); toast(l.length + ' etiqueta(s) confirmada(s).');
    };
  }
  document.addEventListener('DOMContentLoaded', ligar);
  if (document.readyState !== 'loading') ligar();
})(typeof window !== 'undefined' ? window : globalThis);
