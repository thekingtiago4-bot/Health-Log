/* Health Route · mapa leve em canvas.
   Fundo = contorno dos municípios (data/malha.json, o mesmo do Health Search): funciona sem internet e sem
   "tiles" carregando aos pedaços — por isso não pisca nem trava. Cada cidade é UM marcador na sede
   municipal (IBGE); os pontinhos dos clientes ficam em volta do marcador. NÃO são o endereço real do cliente
   (não temos coordenada de endereço e não inventamos). */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const KMIN = 8, KMAX = 9000, K_PONTOS = 240, R_MARC = 12;
  /* Mercator (a mesma das peças do OpenStreetMap): x = longitude em graus; y = -mercator(latitude) em graus.
     Assim a peça z/x/y ocupa exatamente 360/2^z em cada eixo e o fundo de estradas encaixa nos contornos. */
  const RAD = Math.PI / 180;
  const X = lon => lon, Y = lat => -(Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2)) / RAD);

  class Mapa {
    constructor(el, cb) {
      this.el = el; this.cb = cb || {};
      this.cv = document.createElement('canvas');
      this.cv.className = 'mapa-cv';
      this.cv.setAttribute('role', 'img');
      this.cv.setAttribute('aria-label', 'Mapa das cidades da operação');
      el.insertBefore(this.cv, el.firstChild); /* canvas por baixo das janelas flutuantes */
      this.ctx = this.cv.getContext('2d');
      this.v = { cx: X(-47), cy: Y(-22), k: 80 };
      this.W = 0; this.H = 0; this.dpr = 1;
      this.cidades = []; this.porChave = new Map(); this.rotas = []; this.todas = []; this.pausado = false;
      this.estradas = true; this.tiles = new Map(); this.tileFila = []; this.tileAtivos = 0; this.tileTema = null; this.tilesVistos = false;
      this.pernas = new Map(); this.viasLigadas = true;
      this.ativo = null; this.base = null; this.mostrarBase = true; this.fase = 0; this._ult = 0;
      this.animarRotas = !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
      this.bg = document.createElement('canvas'); this.bctx = this.bg.getContext('2d'); this._bgSujo = true;
      this.sel = null; this.hover = null;
      this.poli = new Map(); this.estados = []; this.malhaOk = false;
      this.sujo = true; this.anim = null;
      this.ponteiros = new Map();
      this._cores = null;
      this._ligar();
      this.ro = new ResizeObserver(() => this.redimensionar());
      this.ro.observe(el);
      this.redimensionar();
      this._loop = this._loop.bind(this);
      this._raf = requestAnimationFrame(this._loop);
    }

    /* ---------- dados ---------- */
    async carregarMalha(url) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        const q = j.q || 1000;
        const montar = ring => {
          const p = new Path2D(); let x = ring[0] / q, y = ring[1] / q;
          let x0 = x, x1 = x, y0 = y, y1 = y;
          p.moveTo(X(x), Y(y));
          for (let i = 2; i + 1 < ring.length; i += 2) {
            x += ring[i] / q; y += ring[i + 1] / q;
            p.lineTo(X(x), Y(y));
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          p.closePath();
          return { p, b: [X(x0), Y(y1), X(x1), Y(y0)] };
        };
        for (const code in j.m) {
          const partes = j.m[code].map(montar);
          const path = new Path2D(); const b = [1e9, 1e9, -1e9, -1e9];
          for (const pt of partes) {
            path.addPath(pt.p);
            b[0] = Math.min(b[0], pt.b[0]); b[1] = Math.min(b[1], pt.b[1]); b[2] = Math.max(b[2], pt.b[2]); b[3] = Math.max(b[3], pt.b[3]);
          }
          this.poli.set(code, { path, b });
        }
        for (const uf in j.e) {
          const path = new Path2D();
          for (const ring of j.e[uf]) path.addPath(montar(ring).p);
          this.estados.push(path);
        }
        this.malhaOk = true;
      } catch (e) {
        this.malhaOk = false;
        console.warn('malha não carregou — o mapa segue só com os marcadores:', e);
      }
      this.sujo = true;
    }

    /* cidades: [{key,nome,uf,lat,lon,code,estado,cores:[{cor,frac}],clientes:[{cor,parcial}],notas}] */
    setCidades(lista) {
      this._bgSujo = true;
      this.cidades = lista.filter(c => c.lat != null);
      this.porChave = new Map(this.cidades.map(c => [c.key, c]));
      this.sujo = true;
    }
    setSelecionada(k) { this.sel = k; this._bgSujo = this.sujo = true; }
    /* rotas: [{id, cor, pontos:[{key, n}]}] — linhas tracejadas na ordem das paradas */
    setRotas(r) { this.rotas = r || []; this.sujo = true; }
    /* municípios sem entrega (só para mostrar o nome): [{code, nome, lat, lon}] */
    setTodas(t) { this.todas = t || []; this.todasPorCod = new Map(this.todas.map(x => [x.code, x])); this.sujo = true; }
    /* modo geolocalização: pinta os municípios por região. g = {cor: Map(código -> cor css), sel: código} */
    setGeo(g) { this.geo = g; this.sujo = true; }
    setPoligonosDe(outro) { this.poli = outro.poli; this.estados = outro.estados; this.malhaOk = outro.malhaOk; this.sujo = true; }
    /* trecho de rodovia já calculado: coords = [[lon,lat],...]; guarda também em coordenadas do mapa (para desenhar rápido) */
    setPerna(chave, p) {
      if (!p || !p.coords) { this.pernas.delete(chave); return; }
      const n = p.coords.length, w = new Float64Array(n * 2); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < n; i++) { const x = X(p.coords[i][0]), y = Y(p.coords[i][1]); w[2 * i] = x; w[2 * i + 1] = y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      this.pernas.set(chave, { w, b: [x0, y0, x1, y1], km: p.km, min: p.min }); this.sujo = true;
    }
    setVias(v) { this.viasLigadas = !!v; this.sujo = true; }
    setAtivo(id) { if (id !== this.ativo) { this.ativo = id; this.sujo = true; } }
    setBase(b) { this.base = b && b.lat != null ? b : null; this.sujo = true; }
    setMostrarBase(v) { this.mostrarBase = !!v; this.sujo = true; }
    setEstradas(v) { this.estradas = !!v; this._bgSujo = this.sujo = true; }
    setPausado(v) { this.pausado = !!v; if (!v) { this.redimensionar(); this.sujo = true; } }
    marcar() { this.sujo = true; }
    temaMudou() { this._cores = null; this.tiles.clear(); this.tileFila = []; this._bgSujo = this.sujo = true; }

    /* ---------- vista ---------- */
    redimensionar() {
      const r = this.el.getBoundingClientRect();
      const W = Math.max(0, Math.round(r.width)), H = Math.max(0, Math.round(r.height));
      this.dpr = Math.min(2, g.devicePixelRatio || 1);
      if (W === this.W && H === this.H && this.cv.width === Math.round(W * this.dpr)) return;
      this.W = W; this.H = H;
      this.cv.width = Math.max(1, Math.round(W * this.dpr)); this.cv.height = Math.max(1, Math.round(H * this.dpr));
      this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
      this.bg.width = this.cv.width; this.bg.height = this.cv.height; this._bgSujo = true;
      this.sujo = true;
    }
    /* Enquadra as cidades. Sem `tudo`, uma ou duas cidades isoladas bem longe das demais (ex.: uma nota
       para Brasília no meio de uma operação do interior de SP) ficam de fora do enquadramento para o
       resto não virar pontinhos — elas continuam na lista de pendentes e no mapa (é só afastar). */
    enquadrar(chaves, tudo) {
      let alvo = (chaves ? chaves.map(k => this.porChave.get(k)).filter(Boolean) : this.cidades), fora = [];
      if (!alvo.length || !this.W) return;
      if (!tudo && !chaves && alvo.length >= 8) {
        const xs = alvo.map(c => X(c.lon)).sort((a, b) => a - b), ys = alvo.map(c => Y(c.lat)).sort((a, b) => a - b);
        const mx = xs[xs.length >> 1], my = ys[ys.length >> 1];
        const d = alvo.map(c => Math.hypot(X(c.lon) - mx, Y(c.lat) - my));
        const ord = d.slice().sort((a, b) => a - b), ref = ord[Math.floor(ord.length * 0.9) - 1] || 0;
        const dentro = alvo.filter((c, i) => d[i] <= Math.max(ref * 1.7, 1.2));
        if (dentro.length >= alvo.length - 3 && dentro.length >= 5) { fora = alvo.filter(c => !dentro.includes(c)); alvo = dentro; }
      }
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const c of alvo) { const x = X(c.lon), y = Y(c.lat); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      this.fora = fora.map(c => c.nome); this.cb.onFora && this.cb.onFora(this.fora);
      const pad = 70, esq = this.padEsq || 0, dx = Math.max(x1 - x0, 0.25), dy = Math.max(y1 - y0, 0.25);
      const k = Math.max(KMIN, Math.min(KMAX, Math.min((this.W - esq - pad * 2) / dx, (this.H - pad * 2) / dy)));
      /* esq = faixa à esquerda ocupada pela janela de pendentes: centraliza no espaço que sobra */
      this._ir({ cx: (x0 + x1) / 2 - (esq / 2) / k, cy: (y0 + y1) / 2, k }, false);
    }
    enquadrarPontos(pts) {
      if (!pts.length || !this.W) return;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const c of pts) { const x = X(c.lon), y = Y(c.lat); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const pad = 40, dx = Math.max(x1 - x0, 0.25), dy = Math.max(y1 - y0, 0.25);
      const k = Math.max(KMIN, Math.min(KMAX, Math.min((this.W - pad * 2) / dx, (this.H - pad * 2) / dy)));
      this._ir({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k }, false);
    }
    centrarEm(key, kMin) {
      const c = this.porChave.get(key); if (!c) return;
      this._ir({ cx: X(c.lon), cy: Y(c.lat), k: Math.max(this.v.k, kMin || 0) }, true);
    }
    _ir(alvo, animar) {
      if (!animar) { this.v = alvo; this.anim = null; this.sujo = true; return; }
      this.anim = { de: { ...this.v }, para: alvo, t0: performance.now(), dur: 280 };
      this.sujo = true;
    }
    para(c) { // coordenada de tela (px dentro do elemento) da sede da cidade
      return { x: (X(c.lon) - this.v.cx) * this.v.k + this.W / 2, y: (Y(c.lat) - this.v.cy) * this.v.k + this.H / 2 };
    }
    posicaoDaCidade(key) { const c = this.porChave.get(key); return c ? this.para(c) : null; }
    zoom(f, px, py) {
      if (px == null) { px = this.W / 2; py = this.H / 2; }
      const k0 = this.v.k, k1 = Math.max(KMIN, Math.min(KMAX, k0 * f));
      const wx = (px - this.W / 2) / k0 + this.v.cx, wy = (py - this.H / 2) / k0 + this.v.cy;
      this.v = { k: k1, cx: wx - (px - this.W / 2) / k1, cy: wy - (py - this.H / 2) / k1 };
      this.anim = null; this.sujo = true;
      this.cb.onMover && this.cb.onMover();
    }

    /* ---------- entrada ---------- */
    _ligar() {
      const cv = this.cv;
      cv.style.touchAction = 'none';
      cv.addEventListener('wheel', e => {
        e.preventDefault();
        const r = cv.getBoundingClientRect();
        const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
        this.zoom(f, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
      cv.addEventListener('pointerdown', e => {
        cv.setPointerCapture(e.pointerId);
        this.ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
        this.anim = null;
      });
      cv.addEventListener('pointermove', e => {
        const p = this.ponteiros.get(e.pointerId);
        const r = cv.getBoundingClientRect();
        if (!p) { this._passar(e.clientX - r.left, e.clientY - r.top, e); return; }
        if (this.ponteiros.size === 2) {
          const ids = [...this.ponteiros.keys()], a = this.ponteiros.get(ids[0]), b = this.ponteiros.get(ids[1]);
          const d0 = Math.hypot(a.x - b.x, a.y - b.y);
          p.x = e.clientX; p.y = e.clientY;
          const d1 = Math.hypot(a.x - b.x, a.y - b.y);
          if (d0 > 0 && d1 > 0) this.zoom(d1 / d0, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
          return;
        }
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 4) p.moveu = true;
        if (p.moveu) {
          this.v = { ...this.v, cx: this.v.cx - dx / this.v.k, cy: this.v.cy - dy / this.v.k };
          this.sujo = true; this._arrasto = true; cv.classList.add('arrastando');
          this.cb.onMover && this.cb.onMover();
        }
      });
      const fim = e => {
        const p = this.ponteiros.get(e.pointerId);
        this.ponteiros.delete(e.pointerId);
        cv.classList.remove('arrastando');
        if (this._arrasto) { this._arrasto = false; this._bgSujo = this.sujo = true; }
        if (p && !p.moveu && this.ponteiros.size === 0 && e.type === 'pointerup') {
          const r = cv.getBoundingClientRect();
          const h = this.acharEm(e.clientX - r.left, e.clientY - r.top);
          this.cb.onClique && this.cb.onClique(h, e);
        }
      };
      cv.addEventListener('pointerup', fim);
      cv.addEventListener('pointercancel', fim);
      cv.addEventListener('pointerleave', () => { if (this.hover) { this.hover = null; this.sujo = true; this.cb.onHover && this.cb.onHover(null); } });
      cv.addEventListener('dblclick', e => {
        const r = cv.getBoundingClientRect(); this.zoom(1.7, e.clientX - r.left, e.clientY - r.top);
      });
    }
    _passar(px, py, e) {
      const h = this.acharEm(px, py);
      const k = h ? h.key : null;
      if (k !== this.hover) {
        this.hover = k; this.sujo = true;
        this.cv.style.cursor = h ? 'pointer' : 'grab';
        this.cb.onHover && this.cb.onHover(h, e);
      } else if (h && this.cb.onHover) this.cb.onHover(h, e);
    }

    /* cidade sob o ponto: primeiro o marcador (com folga), depois o contorno do município */
    _acharGeo(px, py) {
      const wx = (px - this.W / 2) / this.v.k + this.v.cx, wy = (py - this.H / 2) / this.v.k + this.v.cy;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const [code, pl] of this.poli) {
        if (wx < pl.b[0] || wx > pl.b[2] || wy < pl.b[1] || wy > pl.b[3]) continue;
        if (this.ctx.isPointInPath(pl.path, wx, wy)) { const t = this.todasPorCod && this.todasPorCod.get(code); return { key: code, code, nome: t ? t.nome : code, uf: t ? t.uf : '' }; }
      }
      return null;
    }
    acharEm(px, py) {
      if (this.geo) return this._acharGeo(px, py);
      let melhor = null, dm = 1e9;
      for (const c of this.cidades) {
        const p = this.para(c); const d = Math.hypot(p.x - px, p.y - py);
        const folga = R_MARC + 7 + (this._mostrarPontos(c) ? 18 : 0);
        if (d <= folga && d < dm) { dm = d; melhor = c; }
      }
      if (melhor) return melhor;
      const wx = (px - this.W / 2) / this.v.k + this.v.cx, wy = (py - this.H / 2) / this.v.k + this.v.cy;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const c of this.cidades) {
        const pl = c.code && this.poli.get(c.code); if (!pl) continue;
        if (wx < pl.b[0] || wx > pl.b[2] || wy < pl.b[1] || wy > pl.b[3]) continue;
        if (this.ctx.isPointInPath(pl.path, wx, wy)) return c;
      }
      return null;
    }
    _mostrarPontos(c) { return this.v.k >= K_PONTOS || c.key === this.sel || c.key === this.hover; }

    /* ---------- desenho ---------- */
    _loop(t) {
      this._raf = requestAnimationFrame(this._loop);
      if (this.anim) {
        const a = this.anim, f = Math.min(1, (t - a.t0) / a.dur), e = 1 - Math.pow(1 - f, 3);
        this.v = { cx: a.de.cx + (a.para.cx - a.de.cx) * e, cy: a.de.cy + (a.para.cy - a.de.cy) * e, k: a.de.k * Math.pow(a.para.k / a.de.k, e) };
        this.sujo = true; if (f >= 1) this.anim = null;
        this.cb.onMover && this.cb.onMover();
      }
      if (!this.W || !this.H || this.pausado) return;
      /* o fluxo das linhas tracejadas redesenha só a camada de cima (o fundo fica guardado) */
      let soSobre = false;
      if (!this.sujo && this.animarRotas && this.rotas.length && !this.geo && !document.hidden && t - this._ult > 45) { this.sujo = true; soSobre = true; }
      if (!this.sujo) return;
      this.sujo = false;
      if (!soSobre) this._bgSujo = true;
      this._ult = t; this._t = t;
      try { this._desenhar(); } catch (e) { console.error('erro ao desenhar o mapa', e); }
    }
    _paleta() {
      if (this._cores) return this._cores;
      const s = getComputedStyle(document.documentElement), v = n => s.getPropertyValue(n).trim();
      const escuro = document.documentElement.getAttribute('data-tema') === 'escuro';
      this._cores = {
        fundo: v('--papel') || '#EEF3F3', terra: escuro ? '#0D2A30' : '#F8FBFB', temNota: escuro ? '#0F3438' : '#E9F3F2',
        linha: escuro ? '#1E4148' : '#C7D6D6', linha2: escuro ? '#24535A' : '#A9C3C3', linhaT: escuro ? 'rgba(130,200,205,.28)' : 'rgba(40,90,95,.30)', mudo: escuro ? '#8FB3B3' : '#62797C', apagado: escuro ? '#5E8387' : '#8FA4A6', estado: escuro ? '#3C666B' : '#8FA9AB', tinta: v('--tinta') || '#0F2E33',
        teal: v('--teal') || '#0F4B55', sup: v('--sup') || '#fff', livre: escuro ? '#9CC3C5' : '#5B7C80', escuro
      };
      return this._cores;
    }
    _desenharGeo() {
      const { ctx, dpr, W, H } = this, { cx, cy, k } = this.v, P = this._paleta(), G = this.geo;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = P.fundo; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      const x0 = cx - W / 2 / k, x1 = cx + W / 2 / k, y0 = cy - H / 2 / k, y1 = cy + H / 2 / k;
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (W / 2 - cx * k), dpr * (H / 2 - cy * k));
      ctx.lineJoin = 'round'; ctx.lineWidth = (k > 400 ? 1 : 0.7) / k; ctx.strokeStyle = P.linha;
      for (const [code, pl] of this.poli) {
        if (pl.b[2] < x0 || pl.b[0] > x1 || pl.b[3] < y0 || pl.b[1] > y1) continue;
        const cor = G.cor.get(code);
        ctx.fillStyle = cor || P.terra; ctx.globalAlpha = cor ? (P.escuro ? 0.7 : 0.78) : 1; ctx.fill(pl.path); ctx.globalAlpha = 1; ctx.stroke(pl.path);
      }
      for (const code of [G.sel, this.hover]) {
        const pl = code && this.poli.get(code); if (!pl) continue;
        ctx.lineWidth = (code === G.sel ? 3 : 2) / k; ctx.strokeStyle = P.tinta; ctx.stroke(pl.path);
      }
      ctx.strokeStyle = P.estado; ctx.lineWidth = 1.3 / k; for (const p of this.estados) ctx.stroke(p);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.font = '600 11px "Barlow","Barlow Semi Condensed",system-ui,sans-serif';
      const caixas = []; let n = 0;
      const rotulos = (this.todas || []).filter(t => t.code === G.sel || t.code === this.hover || (k >= 55 && G.cor.has(t.code)));
      rotulos.sort((a, b) => (b.code === G.sel) - (a.code === G.sel) || (b.code === this.hover) - (a.code === this.hover));
      for (const t of rotulos) {
        if (n > 380) break;
        const px = (X(t.lon) - cx) * k + W / 2, py = (Y(t.lat) - cy) * k + H / 2;
        if (px < 8 || py < 8 || px > W - 8 || py > H - 8) continue;
        const forca = t.code === G.sel || t.code === this.hover, w = ctx.measureText(t.nome).width, r = [px - w / 2 - 2, py - 4, px + w / 2 + 2, py + 12];
        if (!forca && caixas.some(b => !(r[2] < b[0] || r[0] > b[2] || r[3] < b[1] || r[1] > b[3]))) continue;
        caixas.push(r); n++;
        ctx.lineWidth = 3.4; ctx.strokeStyle = P.fundo; ctx.strokeText(t.nome, px, py + 9); ctx.fillStyle = P.tinta; ctx.fillText(t.nome, px, py + 9);
      }
      ctx.textAlign = 'start';
    }
    _fundo() {
      const ctx = this.bctx, { dpr, W, H } = this, { cx, cy, k } = this.v, P = this._paleta();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = P.fundo; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      const comTiles = this.estradas && this._desenharTiles(ctx, P);
      this._comTiles = comTiles;
      const x0 = cx - W / 2 / k, x1 = cx + W / 2 / k, y0 = cy - H / 2 / k, y1 = cy + H / 2 / k;
      /* mundo (contornos) */
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (W / 2 - cx * k), dpr * (H / 2 - cy * k));
      const com = new Map(this.cidades.filter(c => c.code).map(c => [c.code, c]));
      ctx.lineJoin = 'round';
      ctx.lineWidth = (k > 400 ? 1 : 0.7) / k;
      ctx.strokeStyle = comTiles ? P.linhaT : P.linha; ctx.fillStyle = P.terra;
      for (const [code, pl] of this.poli) {
        if (pl.b[2] < x0 || pl.b[0] > x1 || pl.b[3] < y0 || pl.b[1] > y1) continue;
        if (com.has(code)) continue;
        if (comTiles && k < 170) continue; // com estradas ao fundo e zoom aberto, os contornos de todos os municípios só pesam
        if (!comTiles) ctx.fill(pl.path);
        ctx.stroke(pl.path);
      }
      /* municípios com nota: pendente = quase nada de cor; em carro = a cor do carro */
      for (const [code, c] of com) {
        const pl = this.poli.get(code); if (!pl) continue;
        if (pl.b[2] < x0 || pl.b[0] > x1 || pl.b[3] < y0 || pl.b[1] > y1) continue;
        const emCarro = c.cores && c.cores.length;
        if (!comTiles || !c.fora) { ctx.fillStyle = c.fora ? P.terra : P.temNota; ctx.globalAlpha = comTiles ? 0.5 : 1; ctx.fill(pl.path); ctx.globalAlpha = 1; }
        if (emCarro) {
          ctx.save(); ctx.clip(pl.path);
          const h = pl.b[3] - pl.b[1]; let y = pl.b[1];
          const total = c.cores.reduce((s, x) => s + x.frac, 0) || 1;
          ctx.globalAlpha = comTiles ? (P.escuro ? 0.55 : 0.42) : (P.escuro ? 0.62 : 0.5);
          for (const f of c.cores) { const hh = h * f.frac / total; ctx.fillStyle = f.cor; ctx.fillRect(pl.b[0], y, pl.b[2] - pl.b[0], hh + 1 / k); y += hh; }
          ctx.restore();
        }
        ctx.lineWidth = (c.key === this.sel ? 2.4 : emCarro ? 1.3 : 0.8) / k;
        ctx.strokeStyle = c.key === this.sel ? P.tinta : (emCarro ? c.cores[0].cor : P.linha2);
        ctx.stroke(pl.path);
      }
      ctx.strokeStyle = P.estado; ctx.lineWidth = 1.3 / k;
      for (const p of this.estados) ctx.stroke(p);
      this._bgSujo = false;
    }

    _desenhar() {
      if (this.geo) return this._desenharGeo();
      const { ctx, dpr, W, H } = this, { cx, cy, k } = this.v, P = this._paleta(), t = this._t || 0;
      /* durante o arrasto o fundo não é redesenhado: só se desloca a imagem guardada (barato). Ao soltar, redesenha. */
      let dx = 0, dy = 0;
      if (this._bgSujo && this._arrasto && this._bgV && this._bgV.k === this.v.k) { dx = (this._bgV.cx - cx) * k * dpr; dy = (this._bgV.cy - cy) * k * dpr; }
      else if (this._bgSujo) { this._fundo(); this._bgV = { cx, cy, k }; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (dx || dy) { ctx.fillStyle = P.fundo; ctx.fillRect(0, 0, this.cv.width, this.cv.height); }
      ctx.drawImage(this.bg, Math.round(dx), Math.round(dy));
      const com = new Map(this.cidades.filter(c => c.code).map(c => [c.code, c]));
      /* tela */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const caixas = [], vis = [];
      for (const c of this.cidades) {
        const p = this.para(c);
        if (p.x < -60 || p.y < -60 || p.x > W + 60 || p.y > H + 60) continue;
        vis.push({ c, p });
      }
      /* rotas: seguem as RODOVIAS (trecho a trecho, de cidade em cidade); enquanto o trecho não chega, uma curva fina.
         O veículo escolhido fica em destaque. */
      const temAtivo = this.ativo != null && this.rotas.some(r => r.id === this.ativo);
      const baseP = this.base && this.mostrarBase ? this.para(this.base) : null;
      const vx0 = cx - W / 2 / k, vx1 = cx + W / 2 / k, vy0 = cy - H / 2 / k, vy1 = cy + H / 2 / k;
      const chavePerna = (a, b) => a.lon.toFixed(4) + ',' + a.lat.toFixed(4) + ';' + b.lon.toFixed(4) + ',' + b.lat.toFixed(4);
      const mesmo = (a, b) => Math.abs(a.lon - b.lon) < 1e-4 && Math.abs(a.lat - b.lat) < 1e-4;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      this.rotas.forEach((r, ri) => {
        const cids = r.pontos.map(q => this.porChave.get(q.key)).filter(Boolean);
        const seq = this.base && this.mostrarBase ? [this.base, ...cids] : cids; if (seq.length < 2) return;
        const forte = !temAtivo || r.id === this.ativo, sinal = ri % 2 ? -1 : 1, pesado = forte ? 1 : 0;
        const trechos = [];
        for (let i = 1; i < seq.length; i++) { if (mesmo(seq[i - 1], seq[i])) continue; trechos.push({ a: seq[i - 1], b: seq[i], per: this.viasLigadas ? this.pernas.get(chavePerna(seq[i - 1], seq[i])) : null }); }
        if (!trechos.length) return;
        ctx.globalAlpha = forte ? 1 : 0.26;
        const pista = trechos.filter(t => t.per), reta = trechos.filter(t => !t.per);
        const pts = t => { const w = t.per.w, n = w.length / 2, o = new Array(n); for (let j = 0; j < n; j++) o[j] = { x: (w[2 * j] - cx) * k + W / 2, y: (w[2 * j + 1] - cy) * k + H / 2 }; return o; };
        const curva = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, off = Math.min(70, d * 0.17) * sinal; return { x: (a.x + b.x) / 2 - dy / d * off, y: (a.y + b.y) / 2 + dx / d * off }; };
        const visivel = t => !t.per || !(t.per.b[2] < vx0 || t.per.b[0] > vx1 || t.per.b[3] < vy0 || t.per.b[1] > vy1);
        const traco = (lista, halo, larg, cor, dash) => {
          ctx.beginPath();
          for (const t of lista) {
            if (!visivel(t)) continue;
            if (t.per) { const q = pts(t); ctx.moveTo(q[0].x, q[0].y); for (let j = 1; j < q.length; j++) ctx.lineTo(q[j].x, q[j].y); }
            else { const a = this.para(t.a), b = this.para(t.b), c1 = curva(a, b); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c1.x, c1.y, b.x, b.y); }
          }
          ctx.setLineDash(dash); ctx.lineDashOffset = this.animarRotas && !halo ? -((this._t * 0.035) % 20) : 0; ctx.lineWidth = larg; ctx.strokeStyle = cor; ctx.stroke();
        };
        const claro = P.escuro ? 'rgba(4,16,20,.82)' : 'rgba(255,255,255,.92)';
        if (pista.length) { traco(pista, true, pesado ? 8 : 5.5, claro, []); traco(pista, false, pesado ? 4.2 : 2.6, r.cor, pesado ? [11, 9] : [8, 8]); }
        if (reta.length) { ctx.globalAlpha *= 0.65; traco(reta, true, pesado ? 5 : 3.5, claro, []); traco(reta, false, pesado ? 2.6 : 1.8, r.cor, [2, 8]); ctx.globalAlpha = forte ? 1 : 0.26; }
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        for (const t of trechos) { // seta no meio de cada trecho: mostra o sentido
          if (!visivel(t)) continue;
          let mx, my, ang;
          if (t.per) { const q = pts(t), i = Math.max(0, Math.floor(q.length / 2) - 1), a = q[i], b = q[Math.min(q.length - 1, i + 1)]; mx = (a.x + b.x) / 2; my = (a.y + b.y) / 2; ang = Math.atan2(b.y - a.y, b.x - a.x); }
          else { const a = this.para(t.a), b = this.para(t.b), c1 = curva(a, b); if (Math.hypot(b.x - a.x, b.y - a.y) < 52) continue; mx = 0.25 * a.x + 0.5 * c1.x + 0.25 * b.x; my = 0.25 * a.y + 0.5 * c1.y + 0.25 * b.y; ang = Math.atan2(b.y - a.y, b.x - a.x); }
          const sz = forte ? 8.5 : 6;
          ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.75, -sz * 0.85); ctx.lineTo(-sz * 0.35, 0); ctx.lineTo(-sz * 0.75, sz * 0.85); ctx.closePath();
          ctx.fillStyle = r.cor; ctx.lineWidth = 2; ctx.strokeStyle = P.escuro ? '#041014' : '#fff'; ctx.stroke(); ctx.fill(); ctx.restore();
        }
      });
      ctx.restore();
      if (baseP && this.rotas.some(r => r.pontos.length)) { // a base de saída
        ctx.beginPath(); ctx.arc(baseP.x, baseP.y, 13, 0, 6.2832); ctx.fillStyle = '#0B2545'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = P.escuro ? '#6EE1DC' : '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '800 9px "Barlow Semi Condensed",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((this.base.sigla || 'BASE').slice(0, 4), baseP.x, baseP.y + 0.5);
      }
      for (const { c, p } of vis) if (c.clientes && !c.fora && this._mostrarPontos(c)) this._pontos(ctx, c, p, P);
      for (const { c, p } of vis) { this._marcador(ctx, c, p, P); caixas.push([p.x - R_MARC - 3, p.y - R_MARC - 3, p.x + R_MARC + 14, p.y + R_MARC + 2]); }
      /* número da parada em cada rota (canto de cima, à esquerda) */
      const nums = new Map();
      for (const r of this.rotas) for (const q of r.pontos) { if (!nums.has(q.key)) nums.set(q.key, []); nums.get(q.key).push({ n: q.n, cor: r.cor }); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 11px "Barlow Semi Condensed",system-ui,sans-serif';
      for (const { c, p } of vis) {
        const l = nums.get(c.key); if (!l) continue;
        l.forEach((q, i) => {
          const x = p.x - R_MARC - 2 - i * 17, y = p.y - R_MARC - 2;
          ctx.beginPath(); ctx.arc(x, y, 8.5, 0, 6.2832); ctx.fillStyle = q.cor; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = P.escuro ? '#071E22' : '#fff'; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.fillText(String(q.n), x, y + 0.5);
        });
      }
      /* nomes: embaixo da bolinha, sem sobreposição. Primeiro as cidades com entrega… */
      ctx.lineJoin = 'round'; ctx.textBaseline = 'alphabetic';
      const ordem = vis.slice().sort((a, b) => (b.c.key === this.sel) - (a.c.key === this.sel) || (b.c.key === this.hover) - (a.c.key === this.hover) || (a.c.fora ? 1 : 0) - (b.c.fora ? 1 : 0) || (b.c.notas || 0) - (a.c.notas || 0));
      const colide = r => caixas.some(b => !(r[2] < b[0] || r[0] > b[2] || r[3] < b[1] || r[1] > b[3]));
      ctx.font = '700 12.5px "Barlow Semi Condensed","Barlow",system-ui,sans-serif';
      for (const { c, p } of ordem) {
        const forca = c.key === this.sel || c.key === this.hover;
        if (!forca && k < 40) continue;
        const w = ctx.measureText(c.nome).width, ty = p.y + R_MARC + (this._mostrarPontos(c) && !c.fora ? 20 : 18);
        const r = [p.x - w / 2 - 3, ty - 12, p.x + w / 2 + 3, ty + 4];
        if (!forca && colide(r)) continue;
        caixas.push(r);
        ctx.fillStyle = P.escuro ? 'rgba(5,22,26,.78)' : 'rgba(255,255,255,.82)'; this._pilula(ctx, r[0] + 1, r[1] + 1, r[2] - r[0] - 2, r[3] - r[1], 7); ctx.fill();
        ctx.fillStyle = c.fora ? P.mudo : P.tinta; ctx.fillText(c.nome, p.x, ty);
      }
      /* …depois os municípios sem entrega, em cinza claro, só para você se situar */
      if (k >= 45 && this.todas.length && !this._comTiles) {
        ctx.font = '500 10.5px "Barlow","Barlow Semi Condensed",system-ui,sans-serif';
        let n = 0;
        for (const t of this.todas) {
          if (n > 420) break;
          if (com.has(t.code)) continue;
          const px = (X(t.lon) - cx) * k + W / 2, py = (Y(t.lat) - cy) * k + H / 2;
          if (px < 10 || py < 10 || px > W - 10 || py > H - 10) continue;
          const w = ctx.measureText(t.nome).width, r = [px - w / 2 - 2, py + 1, px + w / 2 + 2, py + 15];
          if (colide(r)) continue;
          caixas.push(r); n++;
          ctx.beginPath(); ctx.arc(px, py, 2, 0, 6.2832); ctx.fillStyle = P.apagado; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = P.fundo; ctx.strokeText(t.nome, px, py + 12);
          ctx.fillStyle = P.apagado; ctx.fillText(t.nome, px, py + 12);
        }
      }
      if (this._comTiles) { ctx.font = '500 10px system-ui,sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = P.escuro ? 'rgba(200,225,225,.75)' : 'rgba(40,60,60,.75)'; ctx.fillText('© OpenStreetMap contributors', W - 8, H - 6); }
      ctx.textAlign = 'start';
    }

    _pilula(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    /* ---------- fundo de estradas (peças do OpenStreetMap), com o que já chegou enquanto as outras carregam ---------- */
    _pedirTile(z, x, y) {
      const key = z + '/' + x + '/' + y, ex = this.tiles.get(key);
      if (ex) return ex;
      const t = { img: null, ok: false, falhou: 0 }; this.tiles.set(key, t);
      this.tileFila.push({ key, z, x, y }); this._bombear();
      return t;
    }
    _bombear() {
      while (this.tileAtivos < 6 && this.tileFila.length) {
        const q = this.tileFila.pop(), t = this.tiles.get(q.key); if (!t) continue;
        this.tileAtivos++;
        const img = new Image(); img.crossOrigin = 'anonymous';
        const tema = this._paleta().escuro;
        img.onload = () => {
          this.tileAtivos--;
          if (this._paleta().escuro !== tema) { this.tiles.delete(q.key); this._bombear(); return; }
          const c = document.createElement('canvas'); c.width = c.height = 256; const cc = c.getContext('2d');
          cc.filter = tema ? 'invert(1) hue-rotate(195deg) brightness(.78) contrast(.92) saturate(.55)' : 'saturate(.5) brightness(1.04) contrast(.94)';
          cc.drawImage(img, 0, 0, 256, 256); t.img = c; t.ok = true; this._bgSujo = this.sujo = true; this._bombear();
        };
        img.onerror = () => { this.tileAtivos--; t.falhou = Date.now(); this._bombear(); };
        img.src = 'https://tile.openstreetmap.org/' + q.z + '/' + q.x + '/' + q.y + '.png';
      }
      if (this.tiles.size > 480) { let n = 0; for (const key of this.tiles.keys()) { this.tiles.delete(key); if (++n > 140) break; } }
    }
    /* devolve true se desenhou algo (para o resto saber que há estrada ao fundo) */
    _desenharTiles(ctx, P) {
      const { W, H, dpr } = this, { cx, cy, k } = this.v;
      const z = Math.max(3, Math.min(17, Math.round(Math.log2(360 * k / 256))));
      const n = 2 ** z, tw = 360 / n, x0 = cx - W / 2 / k, x1 = cx + W / 2 / k, y0 = cy - H / 2 / k, y1 = cy + H / 2 / k;
      const tx0 = Math.max(0, Math.floor((x0 + 180) / tw)), tx1 = Math.min(n - 1, Math.floor((x1 + 180) / tw)), ty0 = Math.max(0, Math.floor((y0 + 180) / tw)), ty1 = Math.min(n - 1, Math.floor((y1 + 180) / tw));
      if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 70) return false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); let desenhou = false;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const sx = (-180 + tx * tw - cx) * k + W / 2, sy = (-180 + ty * tw - cy) * k + H / 2, sz = tw * k;
        const t = this._pedirTile(z, tx, ty);
        if (t.ok) { ctx.drawImage(t.img, sx, sy, sz + 0.6, sz + 0.6); desenhou = true; continue; }
        if (t.falhou && Date.now() - t.falhou > 30000) { t.falhou = 0; this.tileFila.push({ key: z + '/' + tx + '/' + ty, z, x: tx, y: ty }); this._bombear(); }
        for (let up = 1; up <= 4; up++) { // enquanto a peça não chega, usa um pedaço da peça de zoom menor
          const a = this.tiles.get((z - up) + '/' + (tx >> up) + '/' + (ty >> up));
          if (a && a.ok) { const lado = 256 / 2 ** up; ctx.drawImage(a.img, (tx - ((tx >> up) << up)) * lado, (ty - ((ty >> up) << up)) * lado, lado, lado, sx, sy, sz + 0.6, sz + 0.6); desenhou = true; break; }
        }
      }
      return desenhou;
    }
    _pontos(ctx, c, p, P) {
      const n = c.clientes.length, max = 60;
      const mostrar = Math.min(n, max);
      for (let i = 0; i < mostrar; i++) {
        const cl = c.clientes[i];
        const ang = i * 2.399963, rad = R_MARC + 9 + 4.6 * Math.sqrt(i);
        const x = p.x + Math.cos(ang) * rad, y = p.y + Math.sin(ang) * rad;
        ctx.beginPath(); ctx.arc(x, y, 3.8, 0, 6.2832);
        ctx.fillStyle = cl.cor || P.livre; ctx.fill();
        ctx.lineWidth = 1.3; ctx.strokeStyle = cl.parcial ? '#F4C21F' : (P.escuro ? '#071E22' : '#fff'); ctx.stroke();
      }
      if (n > max) {
        ctx.font = '700 10px "Barlow Semi Condensed",system-ui,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillStyle = P.tinta; ctx.fillText('+' + (n - max), p.x + R_MARC + 8, p.y + R_MARC + 14);
        ctx.textAlign = 'center';
      }
    }
    _marcador(ctx, c, p, P) {
      const sel = c.key === this.sel, hov = c.key === this.hover;
      if (c.fora) { // cidade fora de rota: bolinha cinza discreta (continua clicável)
        const r = 8;
        if (sel || hov) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, 6.2832); ctx.fillStyle = 'rgba(110,225,220,.4)'; ctx.fill(); }
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fillStyle = P.escuro ? '#0C2B31' : '#fff'; ctx.fill();
        ctx.setLineDash([3, 3]); ctx.lineWidth = 2; ctx.strokeStyle = P.mudo; ctx.stroke(); ctx.setLineDash([]);
        if (c.estado === 'completa') this._selo(ctx, p.x + r + 3, p.y - r - 3, '#1B9A53', 'ok');
        else if (c.estado === 'parcial') this._selo(ctx, p.x + r + 3, p.y - r - 3, '#F4C21F', '!');
        return;
      }
      const r = R_MARC;
      if (sel || hov) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 6, 0, 6.2832); ctx.fillStyle = sel ? 'rgba(110,225,220,.55)' : 'rgba(110,225,220,.3)'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 2, 0, 6.2832); ctx.fillStyle = P.escuro ? '#071E22' : '#fff'; ctx.fill();
      const cores = c.cores || [];
      const alocFrac = c.total ? c.alocadas / c.total : 0;
      if (!cores.length) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r - 1, 0, 6.2832); ctx.fillStyle = P.sup; ctx.fill();
        ctx.lineWidth = 2.8; ctx.strokeStyle = P.teal; ctx.stroke();
      } else {
        const tot = cores.reduce((s, x) => s + x.frac, 0) || 1;
        let a = -Math.PI / 2;
        for (const f of cores) {
          const fim = a + (f.frac / tot) * alocFrac * 6.2832;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, r - 1, a, fim >= a + 6.28 ? a + 6.2831 : fim); ctx.closePath();
          ctx.fillStyle = f.cor; ctx.fill(); a = fim;
        }
        if (alocFrac < 0.999) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, r - 1, a, -Math.PI / 2 + 6.2832); ctx.closePath();
          ctx.fillStyle = P.sup; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, r - 1, 0, 6.2832); ctx.lineWidth = 1.8; ctx.strokeStyle = cores[0].cor; ctx.stroke();
      }
      /* selos para FORA do círculo (não cobrem a cor do carro): verde = tudo em carro · amarelo ! = falta nota */
      if (c.estado === 'completa') this._selo(ctx, p.x + r + 4, p.y - r - 4, '#1B9A53', 'ok');
      else if (c.estado === 'parcial') this._selo(ctx, p.x + r + 4, p.y - r - 4, '#F4C21F', '!');
    }
    _selo(ctx, x, y, cor, t) {
      ctx.beginPath(); ctx.arc(x, y, 9.5, 0, 6.2832); ctx.fillStyle = cor; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = this._cores && this._cores.escuro ? '#071E22' : '#fff'; ctx.stroke();
      if (t === 'ok') {
        ctx.beginPath(); ctx.moveTo(x - 4.4, y + 0.3); ctx.lineTo(x - 1.2, y + 3.6); ctx.lineTo(x + 4.6, y - 3.4);
        ctx.lineWidth = 2.6; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      } else {
        ctx.fillStyle = '#3B2C00'; ctx.fillRect(x - 1.3, y - 5.2, 2.6, 6.4); ctx.beginPath(); ctx.arc(x, y + 4.4, 1.6, 0, 6.2832); ctx.fill();
      }
    }
    destruir() { cancelAnimationFrame(this._raf); this.ro.disconnect(); this.cv.remove(); }
  }
  RT.Mapa = Mapa;
})(typeof window !== 'undefined' ? window : globalThis);
