/* Health Route · rotas pelas RODOVIAS (OSRM público do FOSSGIS, dados do OpenStreetMap).
   Cada trecho é de uma sede de cidade até a outra (coordenadas do IBGE — nunca endereço de cliente).
   O desenho segue a pista e o KM vem da própria rota por estrada. É ESTIMATIVA: sem trânsito, sem o percurso
   dentro das cidades e sem a volta. O que já foi calculado fica guardado neste aparelho (não pede de novo).
   Respeita o serviço público: um pedido por vez, com pausa entre eles, e tenta de novo com espera se falhar. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const BASE = 'https://routing.openstreetmap.de/routed-car/route/v1/driving/';
  const TESTE = !!g.__HR_TESTE;
  const V = RT.vias = {
    intervalo: TESTE ? 0 : 1100, esperas: TESTE ? [0, 0, 0] : [2000, 5000, 10000], validade: 30 * 24 * 3600 * 1000,
    mem: new Map(), fila: [], rodando: false, ultimo: 0, falhas: 0, ultimoErro: '', aoChegar: null, total: 0, feitos: 0
  };
  V.chave = (a, b) => a.lon.toFixed(4) + ',' + a.lat.toFixed(4) + ';' + b.lon.toFixed(4) + ',' + b.lat.toFixed(4);
  V.igual = (a, b) => V.chave(a, a) === V.chave(b, b) || (Math.abs(a.lon - b.lon) < 1e-4 && Math.abs(a.lat - b.lat) < 1e-4);
  V.pendentes = () => V.fila.length + (V.rodando ? 1 : 0);

  const espera = ms => new Promise(r => setTimeout(r, ms));
  async function doCache(k) {
    try { const r = await RT.DB.get('meta', 'via:' + k); if (r && r.v && r.v.coords && Date.now() - r.v.em < V.validade) return r.v; } catch (e) { /* sem cache: pede */ }
    return null;
  }
  async function pedirRede(a, b) {
    let ult = '';
    for (let t = 0; t <= V.esperas.length; t++) {
      const falta = V.intervalo - (Date.now() - V.ultimo); if (falta > 0) await espera(falta);
      V.ultimo = Date.now();
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);
      try {
        const r = await fetch(BASE + a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat + '?overview=full&geometries=geojson&steps=true&alternatives=false', { signal: ac.signal, redirect: 'error', headers: { Accept: 'application/json' } });
        clearTimeout(to);
        if (r.status === 429 || r.status >= 500) { ult = 'o serviço de rotas respondeu ' + r.status; if (t < V.esperas.length) { await espera(V.esperas[t]); continue; } break; }
        if (!r.ok) { ult = 'o serviço de rotas respondeu ' + r.status; break; }
        const j = await r.json(), rt = j && j.routes && j.routes[0];
        if (j.code !== 'Ok' || !rt || !rt.geometry || !Array.isArray(rt.geometry.coordinates) || rt.geometry.coordinates.length < 2 || !isFinite(rt.distance)) { ult = j && j.code === 'NoRoute' ? 'não há estrada ligando essas duas cidades' : 'resposta do serviço de rotas inválida'; break; }
        /* as rodovias do trecho (ex.: SP-310, BR-050), as que mais pesam em km */
        const porRef = new Map();
        for (const lg of (rt.legs || [])) for (const st of (lg.steps || [])) { const ref = String(st.ref || '').split(';')[0].trim().replace(/\s+/g, '-').toUpperCase(); if (ref && /^[A-Z]{2,3}-?\d/.test(ref)) porRef.set(ref, (porRef.get(ref) || 0) + (st.distance || 0)); }
        const refs = [...porRef.entries()].filter(x => x[1] >= 3000).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
        return { ok: { coords: rt.geometry.coordinates.map(c => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5]), km: rt.distance / 1000, min: (rt.duration || 0) / 60, refs, em: Date.now() } };
      } catch (e) {
        clearTimeout(to); ult = navigator.onLine === false ? 'sem internet' : 'não consegui falar com o serviço de rotas';
        if (t < V.esperas.length) await espera(V.esperas[t]);
      }
    }
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
        if (r.ok) { V.falhas = 0; V.ultimoErro = ''; RT.DB.put('meta', { k: 'via:' + it.k, v: r.ok }).catch(() => { }); } else { V.falhas++; V.ultimoErro = r.erro; }
      }
      V.mem.set(it.k, r.ok ? { ok: r.ok } : { erro: r.erro, em: Date.now() });
      V.feitos++; it.res(r.ok || null);
      if (V.aoChegar) try { V.aoChegar(it.k, r.ok || null); } catch (e) { console.error(e); }
    }
    V.rodando = false; if (V.aoChegar) try { V.aoChegar(null, null); } catch (e) { /* ok */ }
  }
  /* pede um trecho; devolve uma promessa com {coords, km, min} ou null se não deu */
  V.pedir = function (a, b) {
    const k = V.chave(a, b), m = V.mem.get(k);
    if (m && m.ok) return Promise.resolve(m.ok);
    if (m && m.erro && Date.now() - m.em < 60000) return Promise.resolve(null); // falhou há pouco: não insiste a cada clique
    const ja = V.fila.find(x => x.k === k); if (ja) return ja.p;
    let res; const p = new Promise(r => { res = r; });
    V.fila.push({ k, a, b, p, res }); V.total++; rodar();
    return p;
  };
})(typeof window !== 'undefined' ? window : globalThis);
