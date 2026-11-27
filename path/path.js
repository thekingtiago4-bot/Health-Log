/* Health Path · KM de ida e volta entre duas cidades, pelo caminho mais curto.
   Cada trecho vai da sede de uma cidade à da outra (coordenadas do IBGE). Rota: Valhalla público do FOSSGIS (OpenStreetMap), com OSRM de reserva.
   É ESTIMATIVA: sem trânsito e sem o percurso dentro das cidades. Nada é enviado além das coordenadas das duas sedes.
   PRECISA DE REDE: toda consulta é feita na hora, pela internet (nada de resultado guardado). */
(function () {
  'use strict';
  const VERSAO = '1.5.0';
  const VAL = 'https://valhalla1.openstreetmap.de/route', OSRM = 'https://routing.openstreetmap.de/routed-car/route/v1/driving/';
  const $ = s => document.querySelector(s);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 /]/g, ' ').replace(/\s+/g, ' ').trim();
  const ls = { ler(k, d) { try { const v = localStorage.getItem('hp:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, gravar(k, v) { try { localStorage.setItem('hp:' + k, JSON.stringify(v)); } catch (e) { /* sem armazenamento: segue */ } } };
  let MUN = [], ocupado = false, ultimo = null, modo = ls.ler('modo', 'google') === 'curto' ? 'curto' : 'google';

  /* ---------- cidades ---------- */
  async function carregarCidades() {
    let bruto = window.__MUN;   // versão de arquivo único: as cidades vão junto no próprio HTML
    if (!bruto) { const r = await fetch('data/municipios.json'); bruto = await r.json(); }
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

  /* ---------- campos de cidade (inicial, paradas no meio, final) ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const MAXC = 12;
  let campos = [{ m: null }, { m: null }];   // cada campo guarda a cidade escolhida (m)
  function desenharCampos() {
    const box = $('#campos'), n = campos.length;
    box.innerHTML = campos.map((c, i) => {
      const papel = i === 0 ? 'Cidade inicial' : i === n - 1 ? 'Cidade final' : 'Parada ' + i, id = i === 0 ? 'in-a' : i === n - 1 ? 'in-b' : 'in-p' + i;
      return '<label class="campo" for="' + id + '"><span class="rot"><i class="pino ' + (i === 0 ? 'a' : i === n - 1 ? 'b' : 'm') + '"></i>' + papel +
        (i > 0 && i < n - 1 ? '<span class="ac"><button type="button" data-sobe="' + i + '" aria-label="Subir a parada">↑</button><button type="button" data-desce="' + i + '" aria-label="Descer a parada">↓</button><button type="button" data-rm="' + i + '" aria-label="Tirar a parada">✕</button></span>' : '') +
        '</span><input id="' + id + '" data-i="' + i + '" type="text" inputmode="search" placeholder="' + (i === 0 ? 'Ex.: Araraquara' : i === n - 1 ? 'Ex.: Bauru' : 'Ex.: Jaú') + '" autocapitalize="words" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" value="' + esc(c.m ? rotulo(c.m) : (c.txt || '')) + '"><ul class="sug" role="listbox" hidden></ul></label>';
    }).join('');
    for (const inp of box.querySelectorAll('input')) ligarCampo(inp);
    $('#bt-add').disabled = n >= MAXC;
  }
  function lerTextos() { for (const inp of document.querySelectorAll('#campos input')) { const c = campos[+inp.dataset.i]; if (c && !c.m) c.txt = inp.value; } }
  function ligarCampo(inp) {
    const i = +inp.dataset.i, ul = inp.parentElement.querySelector('.sug'); let itens = [], ativo = -1;
    const fechar = () => { ul.hidden = true; inp.setAttribute('aria-expanded', 'false'); ativo = -1; };
    const escolher = m => {
      campos[i].m = m; campos[i].txt = ''; inp.value = rotulo(m); fechar(); limparErro();
      const prox = document.querySelector('#campos input[data-i="' + (i + 1) + '"]'); if (prox && !campos[i + 1].m) prox.focus();
    };
    const marcar = () => { [...ul.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === ativo))); };
    inp.addEventListener('input', () => {
      campos[i].m = null; campos[i].txt = inp.value; itens = achar(inp.value); ativo = itens.length ? 0 : -1;
      ul.innerHTML = itens.map((m, k) => '<li role="option" data-i="' + k + '">' + esc(m.nome) + '<span>' + m.uf + '</span></li>').join('');
      ul.hidden = !itens.length; inp.setAttribute('aria-expanded', String(!!itens.length)); marcar();
    });
    inp.addEventListener('keydown', e => {
      if (ul.hidden || !itens.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); ativo = (ativo + 1) % itens.length; marcar(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = (ativo - 1 + itens.length) % itens.length; marcar(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); escolher(itens[Math.max(0, ativo)]); }
      else if (e.key === 'Escape') fechar();
    });
    ul.addEventListener('pointerdown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); escolher(itens[+li.dataset.i]); } });
    inp.addEventListener('blur', () => setTimeout(fechar, 120));
    inp.addEventListener('focus', () => { if (inp.value && !campos[i].m) inp.dispatchEvent(new Event('input')); });
  }
  /* texto digitado sem escolher da lista: aceita se só uma cidade combina exatamente */
  function resolver(i) {
    const c = campos[i]; if (c.m) return c.m;
    const t = norm(c.txt || ''); if (!t) return null;
    const ex = achar(c.txt).filter(m => m.n === t.split('/')[0].trim());
    if (ex.length === 1) { c.m = ex[0]; return ex[0]; }
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
  async function viaValhalla(a, b, curto = true) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 25000);
    try {
      const corpo = { locations: [{ lon: a.lon, lat: a.lat }, { lon: b.lon, lat: b.lat }], costing: 'auto', costing_options: { auto: curto ? { use_tolls: 1.0, use_ferry: 0.0, shortest: true, use_tracks: 0.5, use_living_streets: 0.5 } : { use_tolls: 1.0, use_ferry: 0.0 } }, alternates: curto ? 2 : 0, directions_options: { units: 'kilometers', language: 'pt-BR' } };
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
  /* TEMPO EM CARRO: média de dois motores de rota (Valhalla e OSRM), cada um pela rota mais RÁPIDA entre as duas cidades, sem trânsito.
     Um costuma dar tempo um pouco acima e o outro um pouco abaixo do real; a média chega mais perto do que um GPS mostra. Se só um responder, usa ele. */
  async function minValhallaRapido(a, b) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 25000);
    try {
      const corpo = { locations: [{ lon: a.lon, lat: a.lat }, { lon: b.lon, lat: b.lat }], costing: 'auto', costing_options: { auto: { use_tolls: 1.0, use_ferry: 0.0 } }, directions_options: { units: 'kilometers', language: 'pt-BR' } };
      const r = await fetch(VAL, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' }, signal: ac.signal, redirect: 'error' });
      clearTimeout(to); if (!r.ok) return null;
      const j = await r.json().catch(() => null), s = j && j.trip && j.trip.summary; return s && isFinite(s.time) ? s.time / 60 : null;
    } catch (e) { clearTimeout(to); return null; }
  }
  async function minOsrmRapido(a, b) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch(OSRM + a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat + '?overview=false&alternatives=false', { signal: ac.signal, redirect: 'error' });
      clearTimeout(to); if (!r.ok) return null;
      const j = await r.json(), rt = j && j.routes && j.routes[0]; return j.code === 'Ok' && rt && isFinite(rt.duration) ? rt.duration / 60 : null;
    } catch (e) { clearTimeout(to); return null; }
  }
  async function minRapido(a, b, curto) {
    const v = await minValhallaRapido(a, b), o = await minOsrmRapido(a, b), l = [v, o].filter(x => x != null);
    if (!l.length) return curto.min;   // nenhum respondeu: usa o tempo do próprio caminho curto
    return l.reduce((s, x) => s + x, 0) / l.length;
  }
  const espera = ms => new Promise(r => setTimeout(r, ms));
  /* MODO "COMO O GOOGLE MAPS": rota mais RÁPIDA (como um GPS escolhe). KM e tempo = média dos dois motores (Valhalla e OSRM), que juntos chegam bem
     perto do Google (cada um sozinho erra para um lado). O desenho é o do Valhalla (ou do OSRM, se o outro falhar). */
  async function trechoGoogle(a, b) {
    const v = await viaValhalla(a, b, false), o = await viaOsrm(a, b), l = [v.ok, o].filter(Boolean);
    if (!l.length) throw new Error(v.erro || 'falha ao calcular a rota');
    const med = f => l.reduce((s, x) => s + x[f], 0) / l.length;
    const r = { coords: simplificar((v.ok || o).coords, 250), km: med('km'), min: med('min'), tempo: med('min'), mv: 2, em: Date.now(), motores: l.length };
    return r;
  }
  async function trecho(a, b) {
    let ult = '';
    for (let t = 0; t < 3; t++) {
      const r = await viaValhalla(a, b);
      if (r.ok) return { coords: simplificar(r.ok.coords, 250), km: r.ok.km, min: r.ok.min };
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
  function desenhar(pts, trechos) {
    const W = 600, H = 260, P = 30, todos = trechos.flatMap(t => t.coords);
    const mid = pts.reduce((s, m) => s + m.lat, 0) / pts.length, fx = Math.cos(mid * Math.PI / 180);
    const xs = todos.map(c => c[0] * fx), ys = todos.map(c => c[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const esc2 = Math.min((W - 2 * P) / Math.max(x1 - x0, 1e-6), (H - 2 * P) / Math.max(y1 - y0, 1e-6));
    const ox = (W - (x1 - x0) * esc2) / 2, oy = (H - (y1 - y0) * esc2) / 2;
    const pt = c => [(c[0] * fx - x0) * esc2 + ox, H - ((c[1] - y0) * esc2 + oy)];
    const d = cs => cs.map((c, i) => { const p = pt(c); return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    let linhas = '';
    trechos.forEach(t => { linhas += '<path class="m-linha" d="' + d(t.coords) + '" stroke="' + (t.volta ? 'var(--mudo)' : 'var(--aqua)') + '" stroke-width="' + (t.volta ? 3 : 4.5) + '"' + (t.volta ? ' stroke-dasharray="2 7"' : '') + '/>'; });
    const marc = pts.map((m, i) => {
      const p = pt([m.lon, m.lat]), ult = i === pts.length - 1 && pts.length > 1, ini = i === 0, dir = p[0] < W / 2 ? 1 : -1;
      return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="9" fill="' + (ini ? 'var(--sup)' : 'var(--aqua)') + '" stroke="' + (ini ? 'var(--tinta)' : 'var(--sup)') + '" stroke-width="3.5"/>' +
        '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 3.6).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="800" font-family="Barlow Semi Condensed,sans-serif" fill="' + (ini ? 'var(--tinta)' : 'var(--priTxt)') + '">' + (i + 1) + '</text>' +
        '<text x="' + (p[0] + dir * 14).toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="' + (dir > 0 ? 'start' : 'end') + '" font-size="14" font-weight="700" font-family="Barlow Semi Condensed,sans-serif" fill="currentColor">' + esc(m.nome) + '</text>';
    }).join('');
    $('#res-mapa').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="m-svg" aria-hidden="true">' + linhas + marc + '</svg>';
  }
  function mostrar(pts, trechos, volta) {
    const idas = trechos.filter(t => !t.volta), vs = trechos.filter(t => t.volta);
    const kmI = idas.reduce((s, t) => s + t.km, 0), kmV = vs.reduce((s, t) => s + t.km, 0), mI = idas.reduce((s, t) => s + t.tempo, 0), mV = vs.reduce((s, t) => s + t.tempo, 0);
    const total = kmI + kmV, minT = mI + mV, nomes = pts.map(rotulo);
    $('#res-rota').textContent = nomes.concat(volta ? [rotulo(pts[0])] : []).join('  →  ');
    $('#res-total').textContent = km1(total); $('#res-total-r').textContent = volta ? 'km · percurso total, ida e volta' : 'km · percurso total';
    $('#res-ida').textContent = km1(kmI) + ' km'; $('#res-ida-t').textContent = tempo(mI) + ' de carro';
    $('#res-volta').textContent = volta ? km1(kmV) + ' km' : '—'; $('#res-volta-t').textContent = volta ? tempo(mV) + ' de carro' : 'sem volta';
    $('#res-tempo').textContent = tempo(minT);
    $('#res-trechos').innerHTML = trechos.map(t => '<li><span>' + esc(t.de.nome) + ' → ' + esc(t.para.nome) + (t.volta ? ' <small>(volta)</small>' : '') + '</span><b>' + km1(t.km) + ' km · ' + tempo(t.tempo) + '</b></li>').join('');
    desenhar(pts, trechos);
    ultimo = { pts, volta, ida: kmI, voltaKm: kmV, total, min: minT };
    const r = $('#res'); r.hidden = false; r.style.animation = 'none'; void r.offsetWidth; r.style.animation = ''; r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function guardarRecente(pts) {
    const l = ls.ler('recentes', []).filter(x => x.join() !== pts.map(m => m.code).join()); l.unshift(pts.map(m => m.code)); ls.gravar('recentes', l.slice(0, 5)); renderRecentes();
  }
  function renderRecentes() {
    const l = ls.ler('recentes', []).map(x => (Array.isArray(x) ? x : [x.a, x.b]).map(c => MUN.find(m => m.code === c))).filter(x => x.length > 1 && x.every(Boolean));
    $('#recentes').hidden = !l.length;
    $('#rec-lista').innerHTML = l.map((x, i) => '<button type="button" data-i="' + i + '">' + esc(x.map(m => m.nome).join(' → ')) + '</button>').join('');
    $('#rec-lista').onclick = e => { const bt = e.target.closest('button'); if (!bt) return; campos = l[+bt.dataset.i].map(m => ({ m })); desenharCampos(); calcular(); };
  }
  async function calcular() {
    if (ocupado) return; limparErro(); lerTextos();
    const pts = [];
    for (let i = 0; i < campos.length; i++) {
      const m = resolver(i), papel = i === 0 ? 'a cidade inicial' : i === campos.length - 1 ? 'a cidade final' : 'a parada ' + i;
      if (!m) { const t = (campos[i].txt || '').trim(); return erro(t ? 'Escolha ' + papel + ' na lista que aparece enquanto você digita.' : 'Digite ' + papel + '.'); }
      pts.push(m);
    }
    if (pts.length === 2 && pts[0].code === pts[1].code) return erro('As duas cidades são a mesma. Escolha uma cidade final diferente.');
    for (let i = 1; i < pts.length; i++) if (pts[i].code === pts[i - 1].code) return erro('Duas cidades seguidas são iguais (' + rotulo(pts[i]) + '). Troque uma delas.');
    const volta = $('#chk-volta').checked;
    if (navigator.onLine === false) return erro('Sem internet. O Health Path precisa de rede para calcular: cada consulta é feita na hora, pela internet. Conecte e tente de novo.');
    ocupado = true; const bt = $('#bt-calc'); bt.disabled = true; bt.classList.add('carregando');
    try {
      const pares = []; for (let i = 1; i < pts.length; i++) pares.push([pts[i - 1], pts[i], false]);
      if (volta && pts[pts.length - 1].code !== pts[0].code) pares.push([pts[pts.length - 1], pts[0], true]);
      const google = modo === 'google', trechos = []; let reserva = false;
      for (let i = 0; i < pares.length; i++) {
        $('.calc-t').textContent = pares.length > 1 ? 'Calculando trecho ' + (i + 1) + ' de ' + pares.length + '…' : 'Calculando…';
        const [a, b, v] = pares[i];
        const t = google ? await trechoGoogle(a, b) : await trecho(a, b);
        if (!google) t.tempo = await minRapido(a, b, t);
        if (t.reserva) reserva = true;
        trechos.push({ de: a, para: b, volta: v, coords: t.coords, km: t.km, tempo: t.tempo });
      }
      mostrar(pts, trechos, volta && pares.some(p => p[2])); guardarRecente(pts);
      if (reserva) toast('Serviço principal fora do ar: usei o reserva.');
    } catch (e) { erro('Não consegui calcular agora (' + ((e && e.message) || e) + '). Confira a internet e tente de novo.'); }
    finally { ocupado = false; bt.disabled = false; bt.classList.remove('carregando'); $('.calc-t').textContent = 'Calcular KM ida e volta'; }
  }
  function textoCopia() { const u = ultimo; if (!u) return ''; const n = u.pts.map(rotulo); return n.concat(u.volta ? [n[0]] : []).join(' → ') + ': ' + km1(u.total) + ' km (' + (modo === 'curto' ? 'caminho mais curto' : 'rota mais rápida, como o Google Maps') + ') · ' + tempo(u.min) + ' de carro, sem trânsito · Health Path'; }
  async function copiar() {
    const t = textoCopia(); if (!t) return;
    try { await navigator.clipboard.writeText(t); toast('Resultado copiado.'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Resultado copiado.'); } catch (x) { toast('Não consegui copiar.'); } ta.remove(); }
  }
  function tema(t) { document.documentElement.setAttribute('data-tema', t); ls.gravar('tema', t); const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'claro' ? '#EEF3F3' : '#071E22'; }

  async function iniciar() {
    $('#versao').textContent = 'v' + VERSAO;
    tema(ls.ler('tema', 'escuro') === 'claro' ? 'claro' : 'escuro');
    desenharCampos();
    $('#form').addEventListener('submit', e => { e.preventDefault(); calcular(); });
    $('#campos').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; lerTextos();
      if (b.dataset.rm) campos.splice(+b.dataset.rm, 1);
      else if (b.dataset.sobe && +b.dataset.sobe > 1) { const i = +b.dataset.sobe; [campos[i - 1], campos[i]] = [campos[i], campos[i - 1]]; }
      else if (b.dataset.desce && +b.dataset.desce < campos.length - 2) { const i = +b.dataset.desce; [campos[i + 1], campos[i]] = [campos[i], campos[i + 1]]; }
      else return;
      desenharCampos();
    });
    $('#bt-add').onclick = () => { lerTextos(); if (campos.length >= MAXC) return; campos.splice(campos.length - 1, 0, { m: null }); desenharCampos(); const novo = document.querySelector('#campos input[data-i="' + (campos.length - 2) + '"]'); if (novo) novo.focus(); };
    $('#bt-troca').onclick = () => { lerTextos(); campos.reverse(); desenharCampos(); limparErro(); };
    $('#bt-tema').onclick = () => tema(document.documentElement.getAttribute('data-tema') === 'claro' ? 'escuro' : 'claro');
    $('#bt-copiar').onclick = copiar;
    $('#bt-novo').onclick = () => { $('#res').hidden = true; campos = [{ m: null }, { m: null }]; desenharCampos(); limparErro(); window.scrollTo({ top: 0, behavior: 'smooth' }); $('#in-a').focus(); };
    $('#chk-volta').onchange = () => { $('.calc-t').textContent = 'Calcular KM' + ($('#chk-volta').checked ? ' ida e volta' : ' do percurso'); if (!$('#res').hidden) calcular(); };
    const rede = () => { $('#aviso-rede').hidden = navigator.onLine !== false; };
    window.addEventListener('online', rede); window.addEventListener('offline', rede); rede();
    const pintarModo = () => { for (const bt of document.querySelectorAll('[data-modo]')) bt.setAttribute('aria-pressed', String(bt.dataset.modo === modo)); const n = $('#nota-modo'); if (n) n.innerHTML = modo === 'curto' ? 'Os <b>km</b> são do caminho mais curto (rodovia, rua, vicinal ou estradinha). O <b>tempo em carro</b> é a média de dois serviços de rota pela rota mais rápida, sem trânsito.' : 'Rota <b>mais rápida</b>, como um GPS escolhe. <b>Km e tempo</b> são a média de dois serviços de rota (Valhalla e OSRM), sem trânsito e sem parar; por isso ficam perto do Google Maps, que ainda usa o trânsito.'; };
    for (const bt of document.querySelectorAll('[data-modo]')) bt.onclick = () => { if (modo === bt.dataset.modo) return; modo = bt.dataset.modo; ls.gravar('modo', modo); pintarModo(); if (!$('#res').hidden) calcular(); };
    pintarModo();
    /* botão Instalar sempre visível; depois de instalado fica cinza e desativado */
    let evi = null; const bi = $('#bt-instalar'), it = $('#inst-t');
    const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || ls.ler('instalado', false);
    const pintarInst = () => { const ja = instalado(); bi.classList.toggle('instalado', ja); bi.setAttribute('aria-disabled', String(ja)); it.textContent = ja ? 'Instalado' : 'Instalar'; bi.title = ja ? 'O Health Path já está instalado neste aparelho' : 'Instalar o Health Path neste aparelho'; };
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evi = e; ls.gravar('instalado', false); pintarInst(); });
    window.addEventListener('appinstalled', () => { evi = null; ls.gravar('instalado', true); pintarInst(); toast('Health Path instalado.'); });
    bi.onclick = async () => {
      if (instalado()) return;
      if (evi) { evi.prompt(); try { const r = await evi.userChoice; if (r && r.outcome === 'accepted') { ls.gravar('instalado', true); pintarInst(); } } catch (e) { /* ok */ } evi = null; return; }
      toast(location.protocol === 'file:' ? 'Para instalar, abra o Health Path pelo endereço do site (não pelo arquivo salvo).' : /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".' : 'No menu do navegador (⋮), escolha "Instalar aplicativo" ou "Adicionar à tela inicial".');
    };
    pintarInst();
    try { await carregarCidades(); } catch (e) { erro('Não consegui carregar a lista de cidades. Recarregue a página.'); }
    renderRecentes();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { /* sem instalação: segue */ });
    $('#in-a').focus();
    window.HP = { calcular, achar, textoCopia, get modo() { return modo; }, get campos() { return campos; }, get ultimo() { return ultimo; } };
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();
