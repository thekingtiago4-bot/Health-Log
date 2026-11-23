/* Health Log. · rotas pelas RODOVIAS (Valhalla público do FOSSGIS, dados do OpenStreetMap; se ele falhar, OSRM público).
   Cada trecho é de uma sede de cidade até a outra (coordenadas do IBGE — nunca endereço de cliente).
   O desenho segue a pista, o KM vem da própria rota por estrada e os TRECHOS COM PEDÁGIO vêm marcados pelo mapa (ícone no desenho).
   Padrão = o caminho mais direto, com pedágio ou não. Opção "Evitar pedágio" pede outro caminho (pode ser mais longo).
   É ESTIMATIVA: sem trânsito e sem o percurso dentro das cidades. O que já foi calculado fica guardado neste aparelho.
   Respeita o serviço público: um pedido por vez, com pausa entre eles, e tenta de novo com espera se falhar. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const VAL = 'https://valhalla1.openstreetmap.de/route';
  const OSRM = 'https://routing.openstreetmap.de/routed-car/route/v1/driving/';
  const TESTE = !!g.__HR_TESTE, MV = 2;   // MV = versão do formato guardado (2 = Valhalla, com pedágio)
  const V = RT.vias = {
    intervalo: TESTE ? 0 : 1100, esperas: TESTE ? [0, 0, 0] : [2000, 5000, 10000], validade: 30 * 24 * 3600 * 1000,
    mem: new Map(), fila: [], rodando: false, ultimo: 0, falhas: 0, ultimoErro: '', aoChegar: null, total: 0, feitos: 0,
    evitar: false                                                                   // true = "Evitar pedágio"
  };
  const sufixo = () => (V.evitar ? '#sempedagio' : '');
  V.chave = (a, b) => a.lon.toFixed(4) + ',' + a.lat.toFixed(4) + ';' + b.lon.toFixed(4) + ',' + b.lat.toFixed(4) + sufixo();
  V.igual = (a, b) => Math.abs(a.lon - b.lon) < 1e-4 && Math.abs(a.lat - b.lat) < 1e-4;
  V.pendentes = () => V.fila.length + (V.rodando ? 1 : 0);

  const espera = ms => new Promise(r => setTimeout(r, ms));
  const r5 = x => Math.round(x * 1e5) / 1e5;
  async function doCache(k) {
    try { const r = await RT.DB.get('meta', 'via:' + k); if (r && r.v && r.v.coords && r.v.mv === MV && Date.now() - r.v.em < V.validade) return r.v; } catch (e) { /* sem cache: pede */ }
    return null;
  }
  /* polilinha do Valhalla (precisão 6) -> [[lon,lat],…] */
  function decodificar(s) {
    const out = []; let i = 0, lat = 0, lon = 0;
    while (i < s.length) {
      let b, sh = 0, r = 0; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); lat += (r & 1) ? ~(r >> 1) : (r >> 1);
      sh = 0; r = 0; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); lon += (r & 1) ? ~(r >> 1) : (r >> 1);
      out.push([r5(lon / 1e6), r5(lat / 1e6)]);
    }
    return out;
  }
  const refDe = nome => { const m = /^([A-Z]{2,3})[\s-]?(\d{1,4})/.exec(String(nome || '').trim().toUpperCase()); return m ? m[1] + '-' + m[2].padStart(m[1] === 'BR' ? 3 : 0, '0') : ''; };

  async function viaValhalla(a, b) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 25000);
    try {
      const corpo = { locations: [{ lon: a.lon, lat: a.lat }, { lon: b.lon, lat: b.lat }], costing: 'auto', costing_options: { auto: { use_tolls: V.evitar ? 0.0 : 1.0, use_highways: 1.0, use_ferry: 0.0 } }, directions_options: { units: 'kilometers', language: 'pt-BR' } };
      const r = await fetch(VAL, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'health-log' }, signal: ac.signal, redirect: 'error' });
      clearTimeout(to);
      if (r.status === 429 || r.status >= 500) return { erro: 'o serviço de rotas respondeu ' + r.status, repetir: true };
      const j = await r.json().catch(() => null);
      if (!r.ok) return { erro: j && j.error_code === 442 ? 'não há estrada ligando essas duas cidades' : 'o serviço de rotas respondeu ' + r.status };
      const lg = j && j.trip && j.trip.legs && j.trip.legs[0];
      if (!lg || typeof lg.shape !== 'string' || !j.trip.summary || !isFinite(j.trip.summary.length)) return { erro: 'resposta do serviço de rotas inválida' };
      const coords = decodificar(lg.shape); if (coords.length < 2) return { erro: 'resposta do serviço de rotas inválida' };
      const porRef = new Map(), ped = []; let run = null;
      for (const m of (lg.maneuvers || [])) {
        const nome = (m.street_names || []).map(refDe).find(Boolean) || '';
        if (nome) porRef.set(nome, (porRef.get(nome) || 0) + (m.length || 0) * 1000);
        if (m.toll) { if (!run) { run = { i: m.begin_shape_index || 0, km: 0, n: nome }; ped.push(run); } run.km += m.length || 0; if (!run.n) run.n = nome; } else run = null;
      }
      const refs = [...porRef.entries()].filter(x => x[1] >= 3000).sort((x, y) => y[1] - x[1]).slice(0, 2).map(x => x[0]);
      return { ok: { coords, km: j.trip.summary.length, min: (j.trip.summary.time || 0) / 60, refs, pedagios: ped.filter(p => coords[p.i]).map(p => ({ lon: coords[p.i][0], lat: coords[p.i][1], km: Math.round(p.km * 10) / 10, n: p.n })), temPedagio: !!j.trip.summary.has_toll, mv: MV, em: Date.now() } };
    } catch (e) { clearTimeout(to); return { erro: navigator.onLine === false ? 'sem internet' : 'não consegui falar com o serviço de rotas', repetir: true }; }
  }
  /* reserva: OSRM (só no modo padrão; não sabe de pedágio) */
  async function viaOsrm(a, b) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch(OSRM + a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat + '?overview=full&geometries=geojson&steps=true&alternatives=false', { signal: ac.signal, redirect: 'error', headers: { Accept: 'application/json' } });
      clearTimeout(to); if (!r.ok) return null;
      const j = await r.json(), rt = j && j.routes && j.routes[0];
      if (j.code !== 'Ok' || !rt || !rt.geometry || !Array.isArray(rt.geometry.coordinates) || rt.geometry.coordinates.length < 2 || !isFinite(rt.distance)) return null;
      const porRef = new Map();
      for (const lg of (rt.legs || [])) for (const st of (lg.steps || [])) { const ref = refDe(String(st.ref || '').split(';')[0]); if (ref) porRef.set(ref, (porRef.get(ref) || 0) + (st.distance || 0)); }
      const refs = [...porRef.entries()].filter(x => x[1] >= 3000).sort((x, y) => y[1] - x[1]).slice(0, 2).map(x => x[0]);
      return { coords: rt.geometry.coordinates.map(c => [r5(c[0]), r5(c[1])]), km: rt.distance / 1000, min: (rt.duration || 0) / 60, refs, pedagios: null, temPedagio: null, mv: 1, em: Date.now() };
    } catch (e) { clearTimeout(to); return null; }
  }
  async function pedirRede(a, b) {
    let ult = '';
    for (let t = 0; t <= V.esperas.length; t++) {
      const falta = V.intervalo - (Date.now() - V.ultimo); if (falta > 0) await espera(falta);
      V.ultimo = Date.now();
      const r = await viaValhalla(a, b);
      if (r.ok) return r;
      ult = r.erro; if (r.repetir && t < V.esperas.length) { await espera(V.esperas[t]); continue; } break;
    }
    if (!V.evitar) { const o = await viaOsrm(a, b); if (o) return { ok: o, reserva: true }; }   // Valhalla fora do ar: OSRM salva o desenho e o KM (sem pedágio)
    return { erro: ult || 'falha ao calcular a rota' };
  }
  async function rodar() {
    if (V.rodando) return; V.rodando = true;
    while (V.fila.length) {
      const it = V.fila.pop(); // o pedido mais recente primeiro: é o que está na tela agora
      const m = V.mem.get(it.k); if (m && m.ok) { it.res(m.ok); continue; }
      let v = await doCache(it.k), r = null;
      if (v) r = { ok: v };
      else {
        r = await pedirRede(it.a, it.b);
        if (r.ok) { V.falhas = 0; V.ultimoErro = ''; if (!r.reserva) RT.DB.put('meta', { k: 'via:' + it.k, v: r.ok }).catch(() => { }); } else { V.falhas++; V.ultimoErro = r.erro; }
      }
      V.mem.set(it.k, r.ok ? { ok: r.ok } : { erro: r.erro, em: Date.now() });
      V.feitos++; it.res(r.ok || null);
      if (V.aoChegar) try { V.aoChegar(it.k, r.ok || null); } catch (e) { console.error(e); }
    }
    V.rodando = false; if (V.aoChegar) try { V.aoChegar(null, null); } catch (e) { /* ok */ }
  }
  /* pede um trecho; devolve uma promessa com {coords, km, min, refs, pedagios} ou null se não deu */
  V.pedir = function (a, b) {
    const k = V.chave(a, b), m = V.mem.get(k);
    if (m && m.ok) return Promise.resolve(m.ok);
    if (m && m.erro && Date.now() - m.em < 60000) return Promise.resolve(null); // falhou há pouco: não insiste a cada clique
    const ja = V.fila.find(x => x.k === k); if (ja) return ja.p;
    let res; const p = new Promise(r => { res = r; });
    V.fila.push({ k, a, b, p, res }); V.total++; rodar();
    return p;
  };
  /* liga/desliga "evitar pedágio": os trechos já calculados de cada modo ficam guardados separadamente */
  V.definirEvitar = function (v) { V.evitar = !!v; V.fila.length = 0; };
})(typeof window !== 'undefined' ? window : globalThis);
