/* Health Route · mapa leve em canvas.
   Fundo = contorno dos municípios (data/malha.json, o mesmo do Health Search): funciona sem internet e sem
   "tiles" carregando aos pedaços — por isso não pisca nem trava. Cada cidade é UM marcador na sede
   municipal (IBGE); os pontinhos dos clientes ficam em volta do marcador. NÃO são o endereço real do cliente
   (não temos coordenada de endereço e não inventamos). */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const COS = 0.9272; // cos(22°): achata a longitude para o desenho não ficar esticado
  const KMIN = 8, KMAX = 9000, K_PONTOS = 240, R_MARC = 9;

  const X = lon => lon * COS, Y = lat => -lat;

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
      this.cidades = []; this.porChave = new Map();
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
      this.cidades = lista.filter(c => c.lat != null);
      this.porChave = new Map(this.cidades.map(c => [c.key, c]));
      this.sujo = true;
    }
    setSelecionada(k) { this.sel = k; this.sujo = true; }
    marcar() { this.sujo = true; }
    temaMudou() { this._cores = null; this.sujo = true; }

    /* ---------- vista ---------- */
    redimensionar() {
      const r = this.el.getBoundingClientRect();
      const W = Math.max(0, Math.round(r.width)), H = Math.max(0, Math.round(r.height));
      this.dpr = Math.min(2, g.devicePixelRatio || 1);
      if (W === this.W && H === this.H && this.cv.width === Math.round(W * this.dpr)) return;
      this.W = W; this.H = H;
      this.cv.width = Math.max(1, Math.round(W * this.dpr)); this.cv.height = Math.max(1, Math.round(H * this.dpr));
      this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
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
          this.sujo = true; cv.classList.add('arrastando');
          this.cb.onMover && this.cb.onMover();
        }
      });
      const fim = e => {
        const p = this.ponteiros.get(e.pointerId);
        this.ponteiros.delete(e.pointerId);
        cv.classList.remove('arrastando');
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
    acharEm(px, py) {
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
      if (!this.sujo || !this.W || !this.H) return;
      this.sujo = false;
      try { this._desenhar(); } catch (e) { console.error('erro ao desenhar o mapa', e); }
    }
    _paleta() {
      if (this._cores) return this._cores;
      const s = getComputedStyle(document.documentElement), v = n => s.getPropertyValue(n).trim();
      const escuro = document.documentElement.getAttribute('data-tema') === 'escuro';
      this._cores = {
        fundo: v('--papel') || '#EEF3F3', terra: escuro ? '#0D2A30' : '#F8FBFB', temNota: escuro ? '#14474A' : '#D3EEEC',
        linha: escuro ? '#1E4148' : '#C7D6D6', estado: escuro ? '#3C666B' : '#8FA9AB', tinta: v('--tinta') || '#0F2E33',
        teal: v('--teal') || '#0F4B55', sup: v('--sup') || '#fff', livre: escuro ? '#9CC3C5' : '#5B7C80', escuro
      };
      return this._cores;
    }
    _desenhar() {
      const { ctx, dpr, W, H } = this, { cx, cy, k } = this.v, P = this._paleta();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = P.fundo; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      const x0 = cx - W / 2 / k, x1 = cx + W / 2 / k, y0 = cy - H / 2 / k, y1 = cy + H / 2 / k;
      /* mundo */
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (W / 2 - cx * k), dpr * (H / 2 - cy * k));
      const com = new Map(this.cidades.filter(c => c.code).map(c => [c.code, c]));
      ctx.lineJoin = 'round';
      ctx.lineWidth = (k > 400 ? 1 : 0.7) / k;
      ctx.strokeStyle = P.linha; ctx.fillStyle = P.terra;
      for (const [code, pl] of this.poli) {
        if (pl.b[2] < x0 || pl.b[0] > x1 || pl.b[3] < y0 || pl.b[1] > y1) continue;
        if (com.has(code)) continue;
        ctx.fill(pl.path); ctx.stroke(pl.path);
      }
      /* municípios com nota (tingidos pelo estado/carro) */
      for (const [code, c] of com) {
        const pl = this.poli.get(code); if (!pl) continue;
        if (pl.b[2] < x0 || pl.b[0] > x1 || pl.b[3] < y0 || pl.b[1] > y1) continue;
        ctx.fillStyle = P.temNota; ctx.fill(pl.path);
        if (c.cores && c.cores.length) {
          ctx.save(); ctx.clip(pl.path);
          const h = pl.b[3] - pl.b[1]; let y = pl.b[1];
          const total = c.cores.reduce((s, x) => s + x.frac, 0) || 1;
          ctx.globalAlpha = P.escuro ? 0.62 : 0.5;
          for (const f of c.cores) { const hh = h * f.frac / total; ctx.fillStyle = f.cor; ctx.fillRect(pl.b[0], y, pl.b[2] - pl.b[0], hh + 1 / k); y += hh; }
          ctx.restore();
        }
        ctx.lineWidth = (c.key === this.sel ? 2.6 : 1.1) / k;
        ctx.strokeStyle = c.key === this.sel ? P.tinta : (c.cores && c.cores.length ? c.cores[0].cor : P.teal);
        ctx.stroke(pl.path);
      }
      ctx.strokeStyle = P.estado; ctx.lineWidth = 1.4 / k;
      for (const p of this.estados) ctx.stroke(p);
      /* tela */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const caixas = []; const vis = [];
      for (const c of this.cidades) {
        const p = this.para(c);
        if (p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) continue;
        vis.push({ c, p });
      }
      /* pontos de clientes (por baixo dos marcadores) */
      for (const { c, p } of vis) if (c.clientes && this._mostrarPontos(c)) this._pontos(ctx, c, p, P);
      for (const { c, p } of vis) { this._marcador(ctx, c, p, P); caixas.push([p.x - R_MARC - 2, p.y - R_MARC - 2, p.x + R_MARC + 2, p.y + R_MARC + 2]); }
      /* nomes sem sobreposição */
      ctx.font = '600 11.5px "Barlow Semi Condensed","Barlow",system-ui,sans-serif';
      ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const ordem = vis.slice().sort((a, b) => (b.c.key === this.sel) - (a.c.key === this.sel) || (b.c.key === this.hover) - (a.c.key === this.hover) || (b.c.notas || 0) - (a.c.notas || 0));
      for (const { c, p } of ordem) {
        const forca = c.key === this.sel || c.key === this.hover;
        if (!forca && k < 55) continue;
        const nome = c.nome;
        const w = ctx.measureText(nome).width;
        const dx = this._mostrarPontos(c) && c.clientes ? R_MARC + 26 : R_MARC + 5;
        const r = [p.x + dx - 2, p.y - 8, p.x + dx + w + 3, p.y + 8];
        if (!forca && caixas.some(b => !(r[2] < b[0] || r[0] > b[2] || r[3] < b[1] || r[1] > b[3]))) continue;
        caixas.push(r);
        ctx.lineWidth = 3.4; ctx.strokeStyle = P.fundo; ctx.strokeText(nome, p.x + dx, p.y);
        ctx.fillStyle = P.tinta; ctx.fillText(nome, p.x + dx, p.y);
      }
    }
    _pontos(ctx, c, p, P) {
      const n = c.clientes.length, max = 60;
      const mostrar = Math.min(n, max);
      for (let i = 0; i < mostrar; i++) {
        const cl = c.clientes[i];
        const ang = i * 2.399963, rad = R_MARC + 7 + 4.1 * Math.sqrt(i);
        const x = p.x + Math.cos(ang) * rad, y = p.y + Math.sin(ang) * rad;
        ctx.beginPath(); ctx.arc(x, y, 3.3, 0, 6.2832);
        ctx.fillStyle = cl.cor || P.livre; ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = cl.parcial ? '#F4C21F' : (P.escuro ? '#071E22' : '#fff'); ctx.stroke();
      }
      if (n > max) {
        ctx.font = '700 10px "Barlow Semi Condensed",system-ui,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillStyle = P.tinta; ctx.fillText('+' + (n - max), p.x + R_MARC + 6, p.y + R_MARC + 12);
      }
    }
    _marcador(ctx, c, p, P) {
      const r = R_MARC, sel = c.key === this.sel, hov = c.key === this.hover;
      if (sel || hov) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, 6.2832); ctx.fillStyle = sel ? 'rgba(110,225,220,.55)' : 'rgba(110,225,220,.3)'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 1.6, 0, 6.2832); ctx.fillStyle = P.escuro ? '#071E22' : '#fff'; ctx.fill();
      const cores = c.cores || [];
      const alocFrac = c.total ? c.alocadas / c.total : 0;
      if (!cores.length) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r - 1, 0, 6.2832); ctx.fillStyle = P.sup; ctx.fill();
        ctx.lineWidth = 2.2; ctx.strokeStyle = P.teal; ctx.stroke();
      } else {
        const tot = cores.reduce((s, x) => s + x.frac, 0) || 1;
        let a = -Math.PI / 2;
        for (const f of cores) {
          const fim = a + (f.frac / tot) * alocFrac * 6.2832;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, r - 1, a, fim >= a + 6.28 ? a + 6.2831 : fim); ctx.closePath();
          ctx.fillStyle = f.cor; ctx.fill(); a = fim;
        }
        if (alocFrac < 0.999) { // parte que ainda falta
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, r - 1, a, -Math.PI / 2 + 6.2832); ctx.closePath();
          ctx.fillStyle = P.sup; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, r - 1, 0, 6.2832); ctx.lineWidth = 1.6; ctx.strokeStyle = cores[0].cor; ctx.stroke();
      }
      /* selos: verde = tudo alocado · amarelo ! = ainda falta nota */
      if (c.estado === 'completa') this._selo(ctx, p.x + r * 0.85, p.y - r * 0.85, '#1B9A53', 'ok');
      else if (c.estado === 'parcial') this._selo(ctx, p.x + r * 0.85, p.y - r * 0.85, '#F4C21F', '!');
    }
    _selo(ctx, x, y, cor, t) {
      ctx.beginPath(); ctx.arc(x, y, 6.6, 0, 6.2832); ctx.fillStyle = cor; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      if (t === 'ok') {
        ctx.beginPath(); ctx.moveTo(x - 3, y + 0.2); ctx.lineTo(x - 0.8, y + 2.6); ctx.lineTo(x + 3.2, y - 2.4);
        ctx.lineWidth = 1.9; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      } else {
        ctx.fillStyle = '#3B2C00'; ctx.fillRect(x - 0.9, y - 3.6, 1.8, 4.4); ctx.beginPath(); ctx.arc(x, y + 3.2, 1.1, 0, 6.2832); ctx.fill();
      }
    }
    destruir() { cancelAnimationFrame(this._raf); this.ro.disconnect(); this.cv.remove(); }
  }
  RT.Mapa = Mapa;
})(typeof window !== 'undefined' ? window : globalThis);
