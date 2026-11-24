/* Health Route · mapa de fundo NOSSO: dados abertos (OpenFreeMap / OpenStreetMap) desenhados com MapLibre num
   estilo escolhido por nós. Fica só o que serve para roteirizar: estradas e rodovias (com o número, ex.: SP-310),
   rios, matas e fronteiras. SEM nomes de cidade — os nomes são os do app, em negrito, sem repetição.
   Claro e escuro. Se faltar internet ou o navegador não tiver WebGL, o app segue só com os contornos dos municípios. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const URL_ESTILO = 'https://tiles.openfreemap.org/styles/positron';
  const PAL = {
    escuro: { fundo: '#0e1c20', parque: '#112428', agua: '#09141a', uso: '#12262a', mata: '#10222a', predio: '#15292d', trilha: '#1e3438', minor: '#2d4c52', majorCasing: '#08121 4', major: '#5b8087', motoCasing: '#08121 4', moto: '#b4cfd2', ferrovia: '#2b444a', fronteira: '#46717a', aero: '#16292d', texto: '#c6dcdf', halo: '#08121 4' },
    claro: { fundo: '#eef1ec', parque: '#e0e8dc', agua: '#b9d3e0', uso: '#e7eae3', mata: '#d9e4d4', predio: '#e5e5df', trilha: '#dfe2dc', minor: '#ffffff', majorCasing: '#bfc7c6', major: '#ffffff', motoCasing: '#c9a948', moto: '#ffe8a3', ferrovia: '#c3c9c7', fronteira: '#98adb0', aero: '#e2e5df', texto: '#4a5a5c', halo: '#ffffff' }
  };
  for (const t of ['escuro', 'claro']) for (const k in PAL[t]) PAL[t][k] = PAL[t][k].replace(/\s/g, '');
  const COR = { background: 'fundo', park: 'parque', water: 'agua', waterway: 'agua', landuse_residential: 'uso', landcover_wood: 'mata', landcover_ice_shelf: 'uso', landcover_glacier: 'uso', building: 'predio',
    highway_path: 'trilha', highway_minor: 'minor', highway_major_casing: 'majorCasing', highway_major_inner: 'major', highway_major_subtle: 'minor', highway_motorway_subtle: 'minor',
    highway_motorway_casing: 'motoCasing', highway_motorway_inner: 'moto', highway_motorway_bridge_casing: 'motoCasing', highway_motorway_bridge_inner: 'moto', tunnel_motorway_casing: 'motoCasing', tunnel_motorway_inner: 'moto',
    'aeroway-taxiway': 'aero', 'aeroway-runway-casing': 'aero', 'aeroway-area': 'aero', 'aeroway-runway': 'aero', road_area_pier: 'fundo', road_pier: 'fundo' };
  const MANTER_SIMBOLO = new Set(['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us', 'highway-name-major']);
  let baseJson = null;
  const F = RT.fundo = {
    async estilo(escuro) {
      if (!baseJson) { const r = await fetch(URL_ESTILO, { redirect: 'error' }); if (!r.ok) throw new Error('estilo do mapa: HTTP ' + r.status); baseJson = await r.json(); }
      const p = PAL[escuro ? 'escuro' : 'claro'], s = JSON.parse(JSON.stringify(baseJson)); s.name = 'Health Route';
      s.layers = s.layers.filter(l => l.type !== 'symbol' || MANTER_SIMBOLO.has(l.id)).filter(l => l.type !== 'raster');
      for (const l of s.layers) {
        l.paint = l.paint || {};
        const k = COR[l.id] || (/^railway/.test(l.id) ? 'ferrovia' : /^boundary/.test(l.id) ? 'fronteira' : null);
        if (k) { if (l.type === 'fill') { l.paint['fill-color'] = p[k]; delete l.paint['fill-outline-color']; } else if (l.type === 'line') { l.paint['line-color'] = p[k]; } else if (l.type === 'background') { l.paint['background-color'] = p[k]; } }
        if (/_dashline$/.test(l.id)) l.paint['line-color'] = p.fundo;
        /* rodovias mais grossas já nos zooms abertos (no padrão elas somem); estradas menores continuam finas */
        const grossa = (a, b, c, d) => ['interpolate', ['exponential', 1.5], ['zoom'], 5, a, 8, b, 12, c, 16, d];
        if (/^highway_motorway_(inner|bridge_inner)$/.test(l.id) || l.id === 'tunnel_motorway_inner') l.paint['line-width'] = grossa(1.6, 2.4, 5, 12);
        else if (/^highway_motorway_(casing|bridge_casing)$/.test(l.id) || l.id === 'tunnel_motorway_casing') l.paint['line-width'] = grossa(2.6, 3.8, 7, 15);
        else if (l.id === 'highway_major_inner') l.paint['line-width'] = grossa(1, 1.8, 3.6, 10);
        else if (l.id === 'highway_major_casing') l.paint['line-width'] = grossa(1.8, 3, 5.4, 12);
        else if (l.id === 'highway_major_subtle' || l.id === 'highway_motorway_subtle') l.paint['line-width'] = grossa(0.9, 1.4, 2.4, 4);
        if (l.id === 'highway-name-major') { l.paint['text-color'] = p.texto; l.paint['text-halo-color'] = p.halo; l.paint['text-halo-width'] = 1.2; }
      }
      return s;
    },
    /* Geolocalização: o mesmo mapa de ruas do Health Search (Esri World Street Map, com nomes), escurecido no tema escuro */
    estiloArcgis(escuro) {
      return {
        version: 8, name: 'Health Log arcgis',
        sources: { a: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 17, attribution: 'Esri, HERE, Garmin, © OpenStreetMap' } },
        layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': escuro ? '#0e1c20' : '#eef1ec' } },
          { id: 'ruas', type: 'raster', source: 'a', paint: escuro ? { 'raster-brightness-max': 0.5, 'raster-saturation': -0.45, 'raster-contrast': 0.1, 'raster-opacity': 0.95 } : { 'raster-saturation': -0.2 } }]
      };
    },
    carregarBiblioteca() {
      if (g.maplibregl) return Promise.resolve();
      if (F._bib) return F._bib;
      F._bib = new Promise((ok, er) => { const s = document.createElement('script'); s.src = 'vendor/maplibre-gl.js'; s.onload = ok; s.onerror = () => { F._bib = null; er(new Error('não carregou o MapLibre')); }; document.head.appendChild(s); });
      return F._bib;
    },
    /* cria o mapa de fundo dentro de `el` (sem interação: quem manda na vista é o nosso canvas) */
    async criar(el, escuro, tipo) {
      await F.carregarBiblioteca();
      const style = tipo === 'arcgis' ? F.estiloArcgis(escuro) : await F.estilo(escuro);
      const map = new g.maplibregl.Map({ container: el, style, center: [-48, -22], zoom: 6, interactive: false, attributionControl: false, fadeDuration: 0, renderWorldCopies: false, trackResize: false, pitchWithRotate: false, dragRotate: false, maxZoom: 18 });
      await new Promise((ok, er) => { map.once('load', ok); map.once('error', e => { if (!map.loaded()) er(e && e.error || new Error('erro no mapa')); }); setTimeout(() => ok(), 15000); });
      return map;
    },
    async trocarTema(map, escuro, tipo) { map.setStyle(tipo === 'arcgis' ? F.estiloArcgis(escuro) : await F.estilo(escuro), { diff: false }); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
