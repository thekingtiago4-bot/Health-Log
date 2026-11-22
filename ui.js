/* Health Route · utilitários de tela e banco local (IndexedDB).
   Regra herdada do Health Search e do Nex Route: o banco é a fonte de verdade e um erro de gravação
   NUNCA pode passar em silêncio nem apagar o que já está guardado. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const U = (RT.U = {});

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  U.$ = $; U.$$ = $$;
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* localStorage só para conveniências (tema, posição de janela). Pode falhar: nunca depender dele. */
  U.pref = {
    ler(k, pad) { try { const v = localStorage.getItem('hr:' + k); return v == null ? pad : JSON.parse(v); } catch (e) { return pad; } },
    gravar(k, v) { try { localStorage.setItem('hr:' + k, JSON.stringify(v)); } catch (e) { /* ok */ } }
  };

  /* ---------- aviso rápido ---------- */
  let tt = null;
  U.toast = function (msg, acao) {
    const el = $('#toast'); if (!el) return;
    el.innerHTML = '<span></span>';
    el.firstChild.textContent = msg;
    if (acao) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-acao'; b.textContent = acao.rotulo;
      b.onclick = () => { el.hidden = true; acao.fn(); };
      el.appendChild(b);
    }
    el.hidden = false; clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, acao ? 7000 : 3800);
  };

  /* ---------- janelas modais (sem alert/confirm/prompt do navegador) ---------- */
  function modal(html, onMontar) {
    return new Promise(res => {
      const f = document.createElement('div'); f.className = 'fundo';
      f.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
      const fechar = v => { f.remove(); document.removeEventListener('keydown', tecla, true); res(v); };
      const tecla = e => { if (e.key === 'Escape') { e.stopPropagation(); fechar(null); } };
      document.addEventListener('keydown', tecla, true);
      f.addEventListener('mousedown', e => { if (e.target === f) fechar(null); });
      document.body.appendChild(f);
      onMontar(f, fechar);
    });
  }
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
      const r = jan.getBoundingClientRect(), a = area.getBoundingClientRect();
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
    const fim = e => { if (!d || e.pointerId !== d.id) return; d = null; jan.classList.remove('movendo'); aoSoltar && aoSoltar({ x: parseFloat(jan.style.left), y: parseFloat(jan.style.top) }); };
    jan.addEventListener('pointerup', fim); jan.addEventListener('pointercancel', fim);
  };
  U.posicionar = function (jan, area, x, y) {
    const w = jan.offsetWidth, h = jan.offsetHeight, a = area.getBoundingClientRect();
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
        req.onblocked = () => { DB.erro = 'O banco está bloqueado por outra aba aberta. Feche as outras abas do Health Route.'; res(false); };
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
