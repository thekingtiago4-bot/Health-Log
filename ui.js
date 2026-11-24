/* Health Route · utilitários de tela e banco local (IndexedDB).
   Regra herdada do Health Search e do Nex Route: o banco é a fonte de verdade e um erro de gravação
   NUNCA pode passar em silêncio nem apagar o que já está guardado. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const U = (RT.U = {});

  /* Janelas flutuantes podem estar na SEGUNDA TELA (outro document, mesma origem): sem `r`, a busca olha esta tela e depois a outra. */
  const docExt = () => { try { const S = RT.S, w = S && S.ext; return w && !w.closed && S.janExt && S.janExt.size ? w.document : null; } catch (e) { return null; } };
  const $ = (s, r) => { if (r) return r.querySelector(s); const a = document.querySelector(s); if (a) return a; const d = docExt(); return d ? d.querySelector(s) : null; };
  const $$ = (s, r) => { if (r) return [...r.querySelectorAll(s)]; const d = docExt(); return [...document.querySelectorAll(s), ...(d ? d.querySelectorAll(s) : [])]; };
  U.$ = $; U.$$ = $$;
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* localStorage só para conveniências (tema, posição de janela). Pode falhar: nunca depender dele. */
  U.pref = {
    ler(k, pad) { try { const v = localStorage.getItem('hr:' + k); return v == null ? pad : JSON.parse(v); } catch (e) { return pad; } },
    gravar(k, v) { try { localStorage.setItem('hr:' + k, JSON.stringify(v)); } catch (e) { /* ok */ } },
    apagar(k) { try { localStorage.removeItem('hr:' + k); } catch (e) { /* ok */ } }
  };

  /* ---------- aviso rápido ---------- */
  let tt = null;
  U.toast = function (msg, acao) {
    const el = $('#toast'); if (!el) return;
    el.innerHTML = '<span></span>'; el.style.transform = ''; el.style.opacity = '';
    el.firstChild.textContent = msg;
    if (acao) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-acao'; b.textContent = acao.rotulo;
      b.onclick = () => { el.hidden = true; acao.fn(); };
      el.appendChild(b);
    }
    const x = document.createElement('button'); x.type = 'button'; x.className = 'toast-x'; x.textContent = '×'; x.title = 'Ignorar (ou arraste para cima)'; x.setAttribute('aria-label', 'Ignorar aviso');
    x.onclick = () => { el.hidden = true; }; el.appendChild(x);
    el.hidden = false; clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, acao ? 7000 : 3800);
  };
  /* arrastar o aviso para cima (ou tocar nele) = ignorar */
  (function () {
    document.addEventListener('DOMContentLoaded', () => {
      const el = $('#toast'); if (!el) return; let y0 = null, dy = 0;
      el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; try { el.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } });
      el.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.min(0, e.clientY - y0); el.style.transform = 'translateX(-50%) translateY(' + dy + 'px)'; el.style.opacity = String(Math.max(.2, 1 + dy / 80)); });
      const fim = () => { if (y0 == null) return; const t = y0; y0 = null; if (dy < -18 || Math.abs(dy) < 4) el.hidden = true; el.style.transform = ''; el.style.opacity = ''; void t; };
      el.addEventListener('pointerup', fim); el.addEventListener('pointercancel', fim);
    });
  })();

  /* ---------- sons (sintetizados, sem arquivo): 'ok' = cidade completa · 'popup' = janela que aparece · 'aviso' ---------- */
  let ac = null;
  U.som = function (tipo, forcar) {
    try {
      if (!forcar && !U.som.ligado()) return;
      ac = ac || new (g.AudioContext || g.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      const seq = {
        ok: [[523.25, .13, 'sine'], [659.25, .13, 'sine'], [783.99, .13, 'sine'], [1046.5, .38, 'sine']],   // acorde subindo: tudo certo
        popup: [[880, .09, 'triangle'], [1174.66, .16, 'triangle']],                                      // “plim” curto
        aviso: [[330, .14, 'square'], [247, .22, 'square']]
      }[tipo] || [[660, .1, 'sine']];
      let t = ac.currentTime + .02;
      for (const [f, d, tp] of seq) {
        const o = ac.createOscillator(), gn = ac.createGain(); o.type = tp; o.frequency.value = f;
        gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(tipo === 'aviso' ? .09 : .2, t + .015); gn.gain.exponentialRampToValueAtTime(.0001, t + d);
        o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + d + .02); t += d * .9;
      }
    } catch (e) { /* sem áudio: segue em silêncio */ }
  };
  U.som.ligado = () => U.pref.ler('som', true) !== false;
  U.som.ligar = v => U.pref.gravar('som', !!v);

  /* ---------- janelas modais (sem alert/confirm/prompt do navegador) ---------- */
  function modal(html, onMontar) {
    return new Promise(res => {
      const f = document.createElement('div'); f.className = 'fundo';
      f.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
      const fechar = v => { f.remove(); document.removeEventListener('keydown', tecla, true); res(v); };
      const tecla = e => { if (e.key === 'Escape') { e.stopPropagation(); fechar(null); } };
      document.addEventListener('keydown', tecla, true);
      f.addEventListener('mousedown', e => { if (e.target === f) fechar(null); });
      document.body.appendChild(f); U.som('popup');
      onMontar(f, fechar);
      /* a digitação já entra: se a janela tem campo de texto e ninguém pediu foco, o primeiro campo recebe o cursor */
      if (!f.contains(document.activeElement) || /^(BODY|HTML)$/.test(document.activeElement.tagName)) { const c = f.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]):not([type=color]):not([type=range]), textarea'); if (c && !c.disabled) { c.focus(); if (c.select && c.type !== 'date') { try { c.select(); } catch (e) { /* ok */ } } } }
    });
  }
  U.modal = modal;
  U.confirmar = function (titulo, texto, rotulo, perigo, rotuloNao) {
    return modal('<h2>' + U.esc(titulo) + '</h2><p>' + U.esc(texto) + '</p><div class="botoes"><button class="btn" data-n>' + U.esc(rotuloNao || 'Cancelar') + '</button><button class="btn ' + (perigo ? 'perigo' : 'pri') + '" data-s>' + U.esc(rotulo || 'Confirmar') + '</button></div>',
      (f, fechar) => { f.querySelector('[data-n]').onclick = () => fechar(false); f.querySelector('[data-s]').onclick = () => fechar(true); f.querySelector('[data-s]').focus(); }).then(v => !!v);
  };
  U.perguntar = function (titulo, texto, valor, rotulo) {
    return modal('<h2>' + U.esc(titulo) + '</h2>' + (texto ? '<p>' + U.esc(texto) + '</p>' : '') + '<input class="filtro modal-in" style="max-width:none;width:100%" value="">' +
      '<div class="botoes"><button class="btn" data-n>Cancelar</button><button class="btn pri" data-s>' + U.esc(rotulo || 'Salvar') + '</button></div>',
      (f, fechar) => {
        const i = f.querySelector('input'); i.value = valor || ''; i.focus(); i.select();
        const ok = () => fechar(i.value.trim());
        i.onkeydown = e => { if (e.key === 'Enter') ok(); };
        f.querySelector('[data-n]').onclick = () => fechar(null); f.querySelector('[data-s]').onclick = ok;
      });
  };
  U.aviso = function (titulo, htmlCorpo) {
    return modal('<h2>' + U.esc(titulo) + '</h2><div class="corpo">' + htmlCorpo + '</div><div class="botoes"><button class="btn pri" data-s>Fechar</button></div>',
      (f, fechar) => { f.querySelector('[data-s]').onclick = () => fechar(true); f.querySelector('[data-s]').focus(); });
  };

  /* ---------- janela flutuante arrastável dentro de uma área ----------
     Só o cabeçalho (seletor `alca`) arrasta; o resto da janela recebe cliques normalmente.
     Os ouvintes ficam na janela, então continuam valendo quando o conteúdo é redesenhado. */
  U.arrastavel = function (jan, alca, area, aoSoltar) {
    let d = null;
    jan.addEventListener('pointerdown', e => {
      const h = e.target.closest(alca);
      if (!h || !jan.contains(h) || e.target.closest('button,input,select,a')) return;
      const r = jan.getBoundingClientRect(), a = (jan.parentElement || area).getBoundingClientRect();
      d = { dx: e.clientX - r.left, dy: e.clientY - r.top, a, id: e.pointerId };
      jan.setPointerCapture(e.pointerId); jan.classList.add('movendo'); e.preventDefault();
    });
    jan.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const w = jan.offsetWidth, h = jan.offsetHeight;
      const x = Math.max(4, Math.min(d.a.width - w - 4, e.clientX - d.a.left - d.dx));
      const y = Math.max(4, Math.min(d.a.height - Math.min(h, 60) - 4, e.clientY - d.a.top - d.dy));
      jan.style.left = x + 'px'; jan.style.top = y + 'px'; jan.style.right = 'auto'; jan.style.bottom = 'auto';
    });
    const fim = e => { if (!d || e.pointerId !== d.id) return; d = null; jan.classList.remove('movendo'); if (!jan.classList.contains('na-ext')) aoSoltar && aoSoltar({ x: parseFloat(jan.style.left), y: parseFloat(jan.style.top) }); };
    jan.addEventListener('pointerup', fim); jan.addEventListener('pointercancel', fim);
  };
  /* ---------- redimensionar janela flutuante (bordas direita e de baixo + canto) ----------
     O tamanho fica guardado neste aparelho (pref "tam:<chave>") e volta igual na próxima vez.
     As alças são recolocadas se a janela for redesenhada por dentro. */
  U.redimensionavel = function (jan, chave, area, aoSoltar) {
    const MIN_W = 250, MIN_H = 150;
    const aplicar = (w, h) => {
      const a = (jan.parentElement || area).getBoundingClientRect();
      if (w != null) jan.style.width = Math.max(MIN_W, Math.min(a.width - 8, w)) + 'px';
      if (h != null) jan.style.height = Math.max(MIN_H, Math.min(a.height - 8, h)) + 'px';
      jan.style.maxHeight = 'none'; jan.style.maxWidth = 'none'; jan.classList.add('redim');
    };
    const salvo = U.pref.ler('tam:' + chave, null);
    if (salvo && isFinite(salvo.w) && isFinite(salvo.h)) aplicar(salvo.w, salvo.h);
    const alca = (cls, cursor) => { const e = document.createElement('div'); e.className = 'jan-rz ' + cls; e.dataset.rz = cls; e.style.cursor = cursor; e.setAttribute('aria-hidden', 'true'); return e; };
    const garantir = () => {
      for (const [cls, cur] of [['rz-d', 'ew-resize'], ['rz-b', 'ns-resize'], ['rz-c', 'nwse-resize']]) if (!jan.querySelector(':scope > .' + cls)) jan.appendChild(alca(cls, cur));
    };
    garantir();
    new MutationObserver(() => { if (!jan.querySelector(':scope > .rz-c') || !jan.querySelector(':scope > .rz-d') || !jan.querySelector(':scope > .rz-b')) garantir(); }).observe(jan, { childList: true });
    let d = null;
    jan.addEventListener('pointerdown', e => {
      const h = e.target.closest && e.target.closest('.jan-rz'); if (!h || h.parentElement !== jan) return;
      const r = jan.getBoundingClientRect(), a = (jan.parentElement || area).getBoundingClientRect();
      /* passa a posicionar por esquerda/topo, para a borda esquerda e o topo ficarem parados */
      jan.style.left = (r.left - a.left) + 'px'; jan.style.top = (r.top - a.top) + 'px'; jan.style.right = 'auto'; jan.style.bottom = 'auto';
      d = { x0: e.clientX, y0: e.clientY, w0: r.width, h0: r.height, modo: h.dataset.rz, id: e.pointerId };
      jan.setPointerCapture(e.pointerId); jan.classList.add('movendo'); e.preventDefault(); e.stopPropagation();
    }, true);
    jan.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      aplicar(d.modo === 'rz-b' ? null : d.w0 + dx, d.modo === 'rz-d' ? null : d.h0 + dy);
    });
    const fim = e => {
      if (!d || e.pointerId !== d.id) return; d = null; jan.classList.remove('movendo');
      if (!jan.classList.contains('na-ext')) U.pref.gravar('tam:' + chave, { w: jan.offsetWidth, h: jan.offsetHeight }); aoSoltar && aoSoltar();
    };
    jan.addEventListener('pointerup', fim); jan.addEventListener('pointercancel', fim);
  };
  /* a janela em que você mexeu vem para a frente (como post-it na parede) */
  U.z = 30;
  U.ligarZ = doc => doc.addEventListener('pointerdown', e => { const j = e.target.closest && e.target.closest('.jan'); if (j && j.style.zIndex !== String(U.z)) j.style.zIndex = String(++U.z); }, true);
  U.ligarZ(document);
  U.posicionar = function (jan, area, x, y) {
    const w = jan.offsetWidth, h = jan.offsetHeight, a = (jan.parentElement || area).getBoundingClientRect();
    x = Math.max(4, Math.min(a.width - w - 4, x)); y = Math.max(4, Math.min(a.height - h - 4, y));
    jan.style.left = x + 'px'; jan.style.top = y + 'px'; jan.style.right = 'auto'; jan.style.bottom = 'auto';
  };

  /* imprimir: define o tamanho da folha antes (A4 paisagem para a folha de rotas, retrato para relatórios) */
  U.imprimir = function (tipo) {
    let st = document.getElementById('pg-estilo');
    if (!st) { st = document.createElement('style'); st.id = 'pg-estilo'; document.head.appendChild(st); }
    st.textContent = tipo === 'rel' ? '@page{size:A4 portrait;margin:0}' : '@page{size:A4 landscape;margin:8mm}';
    document.body.dataset.imp = tipo;
    const fim = () => { delete document.body.dataset.imp; window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    window.print();
  };
  U.baixar = function (nome, texto, tipo) {
    const b = new Blob([texto], { type: tipo || 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  U.sha256 = async function (buf) {
    if (!(g.crypto && g.crypto.subtle)) return null;
    const h = await g.crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  };
  U.dataBR = iso => { const [a, m, d] = String(iso).slice(0, 10).split('-'); return d + '/' + m + '/' + a; };
  U.hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ---------- banco local ---------- */
  const DB = (RT.DB = {
    db: null, erro: null,
    abrir() {
      return new Promise(res => {
        let req;
        try { req = indexedDB.open('health-route', 1); } catch (e) { DB.erro = 'Este navegador não deixa guardar dados (IndexedDB indisponível).'; return res(false); }
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains('ops')) d.createObjectStore('ops', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' });
          if (!d.objectStoreNames.contains('bk')) d.createObjectStore('bk', { keyPath: 'k', autoIncrement: true });
        };
        req.onsuccess = () => { DB.db = req.result; DB.db.onversionchange = () => DB.db.close(); res(true); };
        /* erro ao abrir: NÃO recria nem apaga nada — só avisa */
        req.onerror = () => { DB.erro = 'Não consegui abrir o banco deste navegador: ' + ((req.error && req.error.message) || 'erro desconhecido'); res(false); };
        req.onblocked = () => { DB.erro = 'O banco está bloqueado por outra aba aberta. Feche as outras abas do Health Log.'; res(false); };
      });
    },
    _tx(store, modo, fn) {
      return new Promise((res, rej) => {
        if (!DB.db) return rej(new Error(DB.erro || 'banco fechado'));
        let r; const tx = DB.db.transaction(store, modo);
        tx.oncomplete = () => res(r);
        tx.onerror = () => rej(tx.error || new Error('erro na transação'));
        tx.onabort = () => rej(tx.error || new Error('transação cancelada'));
        r = fn(tx.objectStore(store));
        if (r && 'onsuccess' in r) { const q = r; r = undefined; q.onsuccess = () => { r = q.result; }; }
      });
    },
    put(store, obj) { return DB._tx(store, 'readwrite', s => s.put(obj)); },
    get(store, k) { return DB._tx(store, 'readonly', s => s.get(k)); },
    todos(store) { return DB._tx(store, 'readonly', s => s.getAll()); },
    apagar(store, k) { return DB._tx(store, 'readwrite', s => s.delete(k)); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
