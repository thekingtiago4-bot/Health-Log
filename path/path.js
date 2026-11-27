/* Health Path · KM de ida e volta entre duas cidades, pelo caminho mais curto.
   Cada trecho vai da sede de uma cidade à da outra (coordenadas do IBGE). Rota: Valhalla público do FOSSGIS (OpenStreetMap), com OSRM de reserva.
   É ESTIMATIVA: sem trânsito e sem o percurso dentro das cidades. Nada é enviado além das coordenadas das duas sedes. */
(function () {
  'use strict';
  const VERSAO = '1.0.0';
  const VAL = 'https://valhalla1.openstreetmap.de/route', OSRM = 'https://routing.openstreetmap.de/routed-car/route/v1/driving/';
  const $ = s => document.querySelector(s);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 /]/g, ' ').replace(/\s+/g, ' ').trim();
  const ls = { ler(k, d) { try { const v = localStorage.getItem('hp:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, gravar(k, v) { try { localStorage.setItem('hp:' + k, JSON.stringify(v)); } catch (e) { /* sem armazenamento: segue */ } } };
  const sel = { a: null, b: null };
  let MUN = [], ocupado = false, ultimo = null;

  /* ---------- cidades ---------- */
  async function carregarCidades() {
    let bruto = window.__MUN;   // versão de arquivo único: as cidades vão junto no próprio HTML
    if (!bruto) { const r = await fetch('../data/municipios.json'); bruto = await r.json(); }
    MUN = Object.entries(bruto).map(([code, v]) => ({ code, nome: v[0], uf: v[1], lat: v[2], lon: v[3], n: norm(v[0]) }));
    MUN.sort((x, y) => x.nome.length - y.nome.length || x.nome.localeCompare(y.nome, 'pt-BR'));
  }
  function achar(txt) {
    const t = norm(txt); if (t.length < 2) return [];
    const [nome, uf] = t.split('/').map(s => s.trim());
    const out = [];
    for (const m of MUN) {
      if (uf && !m.uf.toLowerCase().startsWith(uf)) continue;
      if (m.n.startsWith(nome)) out.push([0, m]); else if (nome.length >= 3 && m.n.includes(nome)) out.push([1, m]);
    }
    return out.sort((x, y) => x[0] - y[0] || x[1].nome.length - y[1].nome.length).slice(0, 8).map(x => x[1]);
  }
  const rotulo = m => m.nome + '/' + m.uf;

  /* ---------- caixa de sugestões ---------- */
  function ligarCampo(chave) {
    const inp = $('#in-' + chave), ul = $('#sug-' + chave); let itens = [], ativo = -1;
    const fechar = () => { ul.hidden = true; inp.setAttribute('aria-expanded', 'false'); ativo = -1; };
    const escolher = m => { sel[chave] = m; inp.value = rotulo(m); fechar(); limparErro(); if (chave === 'a') $('#in-b').focus(); };
    const marcar = () => { [...ul.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === ativo))); };
    inp.addEventListener('input', () => {
      sel[chave] = null; itens = achar(inp.value); ativo = itens.length ? 0 : -1;
      ul.innerHTML = itens.map((m, i) => '<li role="option" data-i="' + i + '">' + m.nome.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '<span>' + m.uf + '</span></li>').join('');
      ul.hidden = !itens.length; inp.setAttribute('aria-expanded', String(!!itens.length)); marcar();
    });
    inp.addEventListener('keydown', e => {
      if (ul.hidden || !itens.length) { return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); ativo = (ativo + 1) % itens.length; marcar(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = (ativo - 1 + itens.length) % itens.length; marcar(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); escolher(itens[Math.max(0, ativo)]); }
      else if (e.key === 'Escape') fechar();
    });
    ul.addEventListener('pointerdown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); escolher(itens[+li.dataset.i]); } });
    inp.addEventListener('blur', () => setTimeout(fechar, 120));
    inp.addEventListener('focus', () => { if (inp.value && !sel[chave]) inp.dispatchEvent(new Event('input')); });
  }
  /* texto digitado sem escolher da lista: aceita se só uma cidade combina exatamente */
  function resolver(chave) {
    if (sel[chave]) return sel[chave];
    const txt = $('#in-' + chave).value, t = norm(txt); if (!t) return null;
    const ex = achar(txt).filter(m => m.n === t.split('/')[0].trim());
    if (ex.length === 1) { sel[chave] = ex[0]; $('#in-' + chave).value = rotulo(ex[0]); return ex[0]; }
    return null;
  }

  /* ---------- rota ---------- */
  function decodificar(s) {
    const out = []; let i = 0, lat = 0, lon = 0;
    while (i < s.length) {
      let b, sh = 0, r = 0; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); lat += (r & 1) ? ~(r >> 1) : (r >> 1);
      sh = 0; r = 0; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); lon += (r & 1) ? ~(r >> 1) : (r >> 1);
      out.push([lon / 1e6, lat / 1e6]);
    }
    return out;
  }
  const simplificar = (c, max) => { if (c.length <= max) return c; const p = Math.ceil(c.length / max), o = c.filter((_, i) => i % p === 0); if (o[o.length - 1] !== c[c.length - 1]) o.push(c[c.length - 1]); return o; };
  const chaveVia = (a, b) => a.lon.toFixed(4) + ',' + a.lat.toFixed(4) + ';' + b.lon.toFixed(4) + ',' + b.lat.toFixed(4);
  async function viaValhalla(a, b) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 25000);
    try {
      const corpo = { locations: [{ lon: a.lon, lat: a.lat }, { lon: b.lon, lat: b.lat }], costing: 'auto', costing_options: { auto: { use_tolls: 1.0, use_ferry: 0.0, shortest: true, use_tracks: 0.5, use_living_streets: 0.5 } }, alternates: 2, directions_options: { units: 'kilometers', language: 'pt-BR' } };
      const r = await fetch(VAL, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' }, signal: ac.signal, redirect: 'error' });
      clearTimeout(to);
      if (r.status === 429 || r.status >= 500) return { erro: 'o serviço de rotas respondeu ' + r.status, repetir: true };
      const j = await r.json().catch(() => null);
      if (!r.ok) return { erro: j && j.error_code === 442 ? 'não há estrada ligando essas duas cidades' : 'o serviço de rotas respondeu ' + r.status };
      const monta = t => { const lg = t && t.legs && t.legs[0]; if (!lg || typeof lg.shape !== 'string' || !t.summary || !isFinite(t.summary.length)) return null; const c = decodificar(lg.shape); return c.length < 2 ? null : { coords: c, km: t.summary.length, min: (t.summary.time || 0) / 60 }; };
      const cand = [monta(j && j.trip), ...((j && j.alternates) || []).map(x => monta(x && x.trip))].filter(Boolean);
      if (!cand.length) return { erro: 'resposta do serviço de rotas inválida' };
      const rapida = Math.min(...cand.map(c => c.min));
      return { ok: cand.filter(c => c.min <= rapida * 2).sort((x, y) => x.km - y.km)[0] };   // caminho mais curto (em km), sem aceitar o que leva mais que o dobro do tempo
    } catch (e) { clearTimeout(to); return { erro: navigator.onLine === false ? 'sem internet' : 'não consegui falar com o serviço de rotas', repetir: true }; }
  }
  async function viaOsrm(a, b) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch(OSRM + a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat + '?overview=full&geometries=geojson&alternatives=false', { signal: ac.signal, redirect: 'error' });
      clearTimeout(to); if (!r.ok) return null;
      const j = await r.json(), rt = j && j.routes && j.routes[0];
      if (j.code !== 'Ok' || !rt || !rt.geometry || !isFinite(rt.distance)) return null;
      return { coords: rt.geometry.coordinates, km: rt.distance / 1000, min: (rt.duration || 0) / 60 };
    } catch (e) { clearTimeout(to); return null; }
  }
  const espera = ms => new Promise(r => setTimeout(r, ms));
  async function trecho(a, b) {
    const k = chaveVia(a, b), c = ls.ler('via:' + k, null);
    if (c && c.mv === 1 && Date.now() - c.em < 30 * 24 * 3600 * 1000) return c;
    let ult = '';
    for (let t = 0; t < 3; t++) {
      const r = await viaValhalla(a, b);
      if (r.ok) { const v = { coords: simplificar(r.ok.coords, 250), km: r.ok.km, min: r.ok.min, mv: 1, em: Date.now() }; ls.gravar('via:' + k, v); return v; }
      ult = r.erro; if (r.repetir && t < 2) { await espera(t ? 4000 : 1500); continue; } break;
    }
    const o = await viaOsrm(a, b);
    if (o) { const v = { coords: simplificar(o.coords, 250), km: o.km, min: o.min, mv: 1, em: Date.now(), reserva: true }; return v; }
    throw new Error(ult || 'falha ao calcular a rota');
  }

  /* ---------- tela ---------- */
  const km1 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const tempo = min => { const m = Math.round(min), h = Math.floor(m / 60); return h ? h + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min'; };
  function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200); }
  function erro(m) { const e = $('#erro'); e.textContent = m; e.hidden = false; }
  function limparErro() { $('#erro').hidden = true; }
  function desenhar(a, b, ida, volta) {
    const W = 600, H = 250, P = 26, todos = ida.coords.concat(volta.coords);
    const mid = (a.lat + b.lat) / 2, fx = Math.cos(mid * Math.PI / 180);
    const xs = todos.map(c => c[0] * fx), ys = todos.map(c => c[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const esc = Math.min((W - 2 * P) / Math.max(x1 - x0, 1e-6), (H - 2 * P) / Math.max(y1 - y0, 1e-6));
    const ox = (W - (x1 - x0) * esc) / 2, oy = (H - (y1 - y0) * esc) / 2;
    const pt = c => [(c[0] * fx - x0) * esc + ox, H - ((c[1] - y0) * esc + oy)];
    const d = cs => cs.map((c, i) => { const p = pt(c); return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    const A = pt([a.lon, a.lat]), B = pt([b.lon, b.lat]);
    const nome = (m, p, dir) => '<text x="' + (p[0] + (dir > 0 ? 12 : -12)).toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="' + (dir > 0 ? 'start' : 'end') + '" font-size="15" font-weight="700" font-family="Barlow Semi Condensed,sans-serif" fill="currentColor">' + m.nome.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>';
    $('#res-mapa').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="m-svg" aria-hidden="true"><path class="m-linha" d="' + d(volta.coords) + '" stroke="var(--mudo)" stroke-width="3" stroke-dasharray="2 7" opacity=".9"/><path class="m-linha" d="' + d(ida.coords) + '" stroke="var(--aqua)" stroke-width="4.5"/>' +
      '<circle cx="' + A[0].toFixed(1) + '" cy="' + A[1].toFixed(1) + '" r="8" fill="var(--sup)" stroke="var(--tinta)" stroke-width="3.5"/><circle cx="' + B[0].toFixed(1) + '" cy="' + B[1].toFixed(1) + '" r="8" fill="var(--aqua)" stroke="var(--sup)" stroke-width="3.5"/>' +
      nome(a, A, A[0] < W / 2 ? 1 : -1) + nome(b, B, B[0] < W / 2 ? 1 : -1) + '</svg>';
  }
  function mostrar(a, b, ida, volta) {
    const total = ida.km + volta.km;
    $('#res-rota').textContent = rotulo(a) + '  →  ' + rotulo(b) + '  →  ' + rotulo(a);
    $('#res-total').textContent = km1(total);
    $('#res-ida').textContent = km1(ida.km) + ' km'; $('#res-volta').textContent = km1(volta.km) + ' km'; $('#res-tempo').textContent = tempo(ida.min + volta.min);
    desenhar(a, b, ida, volta);
    ultimo = { a, b, ida: ida.km, volta: volta.km, total, min: ida.min + volta.min };
    const r = $('#res'); r.hidden = false; r.style.animation = 'none'; void r.offsetWidth; r.style.animation = ''; r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function guardarRecente(a, b) {
    const l = ls.ler('recentes', []).filter(x => !(x.a === a.code && x.b === b.code)); l.unshift({ a: a.code, b: b.code }); ls.gravar('recentes', l.slice(0, 5)); renderRecentes();
  }
  function renderRecentes() {
    const l = ls.ler('recentes', []).map(x => ({ a: MUN.find(m => m.code === x.a), b: MUN.find(m => m.code === x.b) })).filter(x => x.a && x.b);
    $('#recentes').hidden = !l.length;
    $('#rec-lista').innerHTML = l.map((x, i) => '<button type="button" data-i="' + i + '">' + x.a.nome + ' ⇄ ' + x.b.nome + '</button>').join('');
    $('#rec-lista').onclick = e => { const bt = e.target.closest('button'); if (!bt) return; const x = l[+bt.dataset.i]; sel.a = x.a; sel.b = x.b; $('#in-a').value = rotulo(x.a); $('#in-b').value = rotulo(x.b); calcular(); };
  }
  async function calcular() {
    if (ocupado) return; limparErro();
    const a = resolver('a'), b = resolver('b');
    if (!a) return erro($('#in-a').value.trim() ? 'Escolha a cidade inicial na lista que aparece enquanto você digita.' : 'Digite a cidade inicial.');
    if (!b) return erro($('#in-b').value.trim() ? 'Escolha a cidade final na lista que aparece enquanto você digita.' : 'Digite a cidade final.');
    if (a.code === b.code) return erro('As duas cidades são a mesma. Escolha uma cidade final diferente.');
    ocupado = true; const bt = $('#bt-calc'); bt.disabled = true; bt.classList.add('carregando'); $('.calc-t').textContent = 'Calculando…';
    try {
      const ida = await trecho(a, b), volta = await trecho(b, a);
      mostrar(a, b, ida, volta); guardarRecente(a, b);
      if (ida.reserva || volta.reserva) toast('Serviço principal fora do ar: usei o reserva.');
    } catch (e) { erro('Não consegui calcular agora (' + ((e && e.message) || e) + '). Confira a internet e tente de novo.'); }
    finally { ocupado = false; bt.disabled = false; bt.classList.remove('carregando'); $('.calc-t').textContent = 'Calcular KM ida e volta'; }
  }
  function textoCopia() { const u = ultimo; return u ? rotulo(u.a) + ' → ' + rotulo(u.b) + ' → ' + rotulo(u.a) + ': ida ' + km1(u.ida) + ' km + volta ' + km1(u.volta) + ' km = ' + km1(u.total) + ' km (caminho mais curto, sem trânsito) · Health Path' : ''; }
  async function copiar() {
    const t = textoCopia(); if (!t) return;
    try { await navigator.clipboard.writeText(t); toast('Resultado copiado.'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Resultado copiado.'); } catch (x) { toast('Não consegui copiar.'); } ta.remove(); }
  }
  function tema(t) { document.documentElement.setAttribute('data-tema', t); ls.gravar('tema', t); const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'claro' ? '#EEF3F3' : '#071E22'; }

  async function iniciar() {
    $('#versao').textContent = 'v' + VERSAO;
    tema(ls.ler('tema', 'escuro') === 'claro' ? 'claro' : 'escuro');
    ligarCampo('a'); ligarCampo('b');
    $('#form').addEventListener('submit', e => { e.preventDefault(); calcular(); });
    $('#bt-tema').onclick = () => tema(document.documentElement.getAttribute('data-tema') === 'claro' ? 'escuro' : 'claro');
    $('#bt-troca').onclick = () => { const t = sel.a, v = $('#in-a').value; sel.a = sel.b; sel.b = t; $('#in-a').value = $('#in-b').value; $('#in-b').value = v; limparErro(); };
    $('#bt-copiar').onclick = copiar;
    $('#bt-novo').onclick = () => { $('#res').hidden = true; sel.a = sel.b = null; $('#in-a').value = $('#in-b').value = ''; limparErro(); window.scrollTo({ top: 0, behavior: 'smooth' }); $('#in-a').focus(); };
    let evi = null; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evi = e; $('#bt-instalar').hidden = false; });
    $('#bt-instalar').onclick = async () => { if (!evi) return; evi.prompt(); try { await evi.userChoice; } catch (e) { /* ok */ } evi = null; $('#bt-instalar').hidden = true; };
    window.addEventListener('appinstalled', () => { $('#bt-instalar').hidden = true; });
    try { await carregarCidades(); } catch (e) { erro('Não consegui carregar a lista de cidades. Recarregue a página.'); }
    renderRecentes();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { /* sem offline: segue */ });
    $('#in-a').focus();
    window.HP = { sel, calcular, achar, get ultimo() { return ultimo; } };
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
