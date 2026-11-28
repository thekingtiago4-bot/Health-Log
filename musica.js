/* Health Log. · janela flutuante "♪ Música": o Spotify (de verdade) dentro do app. Tela de preparo (Client ID + Redirect URI), login, busca, suas
   playlists e o player (tocando aqui, via Web Playback SDK — exige conta Premium). Sem login/Premium dá para colar o link de uma lista e ouvir
   pelo player incorporado do Spotify (prévias de 30 s sem entrar na conta). O motor está em spotify.js (RT.spo). */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {}), U = RT.U, esc = U.esc;
  const M = RT.mus = { modo: '', timer: null };
  const SP = () => RT.spo;
  const $j = () => U.$('#jan-musica');
  const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const msg = (t, tipo) => { const e = $j() && $j().querySelector('#mus-msg'); if (e) { e.textContent = t || ''; e.hidden = !t; e.className = 'mus-msg ' + (tipo || ''); } };

  /* ---------- link do Spotify → player incorporado (modo simples, sem login) ---------- */
  M.analisar = function (txt) {
    const t = String(txt || '').trim();
    const m = /open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[A-Za-z]{2})?\/)?(?:embed\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]{22})/.exec(t) || /^spotify:(playlist|album|track|artist|show|episode):([A-Za-z0-9]{22})$/.exec(t);
    return m ? { tipo: m[1], id: m[2] } : null;
  };
  M.url = x => 'https://open.spotify.com/embed/' + x.tipo + '/' + x.id + '?theme=0';
  const embedHtml = () => '<details class="mus-simples"><summary>Ouvir sem login (colar o link de uma lista)</summary><div class="mus-barra"><input id="mus-link" class="filtro" placeholder="Cole o link do Spotify (playlist, álbum, música…)" autocomplete="off" aria-label="Link do Spotify"><button type="button" class="btn mini pri" id="mus-tocar">Tocar</button></div><div class="mus-embed" id="mus-embed"></div></details>';
  function ligarEmbed(raiz) {
    const inp = raiz.querySelector('#mus-link'), box = raiz.querySelector('#mus-embed'); if (!inp) return;
    const tocar = x => { box.innerHTML = '<iframe title="Spotify" src="' + esc(M.url(x)) + '" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>'; U.pref.gravar('spotify', 'https://open.spotify.com/' + x.tipo + '/' + x.id); };
    const ir = () => { const x = M.analisar(inp.value); if (!x) { msg('Não reconheci esse link. No Spotify: ••• → Compartilhar → Copiar link.', 'er'); return; } msg(''); tocar(x); inp.value = ''; };
    raiz.querySelector('#mus-tocar').onclick = ir; inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ir(); } });
    const x = M.analisar(U.pref.ler('spotify', '')); if (x) { tocar(x); raiz.querySelector('details').open = true; }
  }

  /* ---------- telas ---------- */
  function telaPreparo(corpo) {
    const sp = SP();
    corpo.innerHTML = '<div class="mus-prep"><h3>Spotify dentro do Health Log</h3><p class="dica">Para entrar na <b>sua conta</b> e tocar aqui dentro, o Spotify pede um cadastro gratuito do app (uma vez só):</p>' +
      '<ol class="mus-passos"><li>Abra <b>developer.spotify.com/dashboard</b>, entre com a sua conta e clique em <b>Create app</b>.</li><li>Em <b>Redirect URI</b> coloque exatamente: <div class="mus-red"><input id="mus-red" readonly value="' + esc(sp.redirectUri()) + '" aria-label="Redirect URI"><button type="button" class="btn mini" id="mus-copia">Copiar</button></div></li><li>Marque <b>Web Playback SDK</b> e <b>Web API</b> e salve.</li><li>Copie o <b>Client ID</b> e cole aqui:<div class="mus-red"><input id="mus-cid" class="filtro" placeholder="Client ID" autocomplete="off" aria-label="Client ID do Spotify" value="' + esc(sp.cfg.clientId) + '"><button type="button" class="btn mini pri" id="mus-cid-ok">Salvar</button></div></li></ol>' +
      '<p class="dica">Tocar dentro do app exige conta <b>Premium</b> (regra do Spotify). Em app novo do Spotify, adicione o e-mail da sua conta em <i>User Management</i>.</p></div>' + embedHtml();
    corpo.querySelector('#mus-copia').onclick = async () => { try { await navigator.clipboard.writeText(sp.redirectUri()); msg('Redirect URI copiada.', 'ok'); } catch (e) { corpo.querySelector('#mus-red').select(); msg('Selecionei para você copiar (Ctrl+C).', 'ok'); } };
    corpo.querySelector('#mus-cid-ok').onclick = async () => { await sp.definirClientId(corpo.querySelector('#mus-cid').value); msg(sp.cfg.clientId ? '' : 'Cole o Client ID.', 'er'); };
    ligarEmbed(corpo);
  }
  function telaConectar(corpo) {
    const sp = SP();
    corpo.innerHTML = '<div class="mus-prep"><h3>Entrar no Spotify</h3><p class="dica">Você vai para o site do Spotify, entra na sua conta e volta para cá. O Health Log não vê nem guarda a sua senha.</p><button type="button" class="btn pri grande" id="mus-entrar">Conectar ao Spotify</button><p class="dica"><button type="button" class="lib" id="mus-trocar">trocar o Client ID</button></p></div>' + embedHtml();
    corpo.querySelector('#mus-entrar').onclick = () => sp.conectar();
    corpo.querySelector('#mus-trocar').onclick = async () => { sp.cfg.clientId = ''; await sp.definirClientId(''); };
    ligarEmbed(corpo);
  }
  function telaApp(corpo) {
    const sp = SP();
    corpo.innerHTML = '<div class="mus-app"><div class="mus-topo"><span id="mus-quem">…</span><button type="button" class="lib" id="mus-sair">sair</button></div>' +
      '<div class="mus-barra"><input id="mus-busca" class="filtro" placeholder="Buscar música, artista, playlist ou álbum" autocomplete="off" aria-label="Buscar no Spotify"></div>' +
      '<div class="mus-lista" id="mus-lista"><p class="dica" style="padding:10px">Carregando suas playlists…</p></div>' +
      '<div class="mus-player" id="mus-pl"><div class="mus-capa" id="mus-capa"></div><div class="mus-info"><b id="mus-nome">Nada tocando</b><small id="mus-art">Escolha uma lista ou música acima</small><div class="mus-prog"><span id="mus-t0">0:00</span><input type="range" id="mus-pos" min="0" max="1000" value="0" aria-label="Posição"><span id="mus-t1">0:00</span></div></div>' +
      '<div class="mus-ctl"><button type="button" data-c="ant" aria-label="Anterior">⏮</button><button type="button" data-c="play" id="mus-play" aria-label="Tocar/pausar">▶</button><button type="button" data-c="prox" aria-label="Próxima">⏭</button><input type="range" id="mus-vol" min="0" max="100" value="60" aria-label="Volume"></div></div></div>' + embedHtml();
    corpo.querySelector('#mus-sair').onclick = () => sp.sair();
    corpo.querySelector('#mus-vol').value = Math.round(+(localStorage.getItem('hr:spoVol') || 0.6) * 100);
    corpo.querySelector('#mus-vol').oninput = e => sp.controle('vol', e.target.value / 100);
    corpo.querySelector('#mus-pos').onchange = e => { const s = sp.estado; if (s) sp.controle('pos', (e.target.value / 1000) * s.duration); };
    corpo.querySelector('.mus-ctl').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) sp.controle(b.dataset.c); });
    let deb = null;
    corpo.querySelector('#mus-busca').addEventListener('input', e => { clearTimeout(deb); deb = setTimeout(() => buscar(e.target.value.trim()), 350); });
    corpo.querySelector('#mus-lista').addEventListener('click', async e => {
      const it = e.target.closest('[data-uri]'); if (!it) return;
      try { msg(''); await sp.tocar(it.dataset.uri); } catch (er) { msg(er.status === 403 ? 'Tocar aqui dentro exige conta Premium.' : 'Não consegui tocar: ' + (er.message || er), 'er'); }
    });
    ligarEmbed(corpo);
    iniciarApp();
  }
  const item = (uri, img, nome, sub) => '<button type="button" class="mus-it" data-uri="' + esc(uri) + '"><span class="mus-img">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '') + '</span><span class="mus-tx"><b>' + esc(nome) + '</b><small>' + esc(sub || '') + '</small></span></button>';
  const imgDe = o => (o && o.images && o.images[o.images.length - 1] && o.images[o.images.length - 1].url) || (o && o.album && o.album.images && o.album.images.length ? o.album.images[o.album.images.length - 1].url : '');
  async function iniciarApp() {
    const sp = SP(); const j = $j(); if (!j) return;
    try {
      if (!sp.me) await sp.carregarConta();
      const q = j.querySelector('#mus-quem'); if (q) q.innerHTML = esc(sp.me.display_name || sp.me.id) + (sp.premium ? ' <span class="mus-badge">Premium</span>' : ' <span class="mus-badge fr">sem Premium</span>');
      if (!sp.premium) msg('Sua conta não é Premium: o Spotify só libera tocar dentro de aplicativos para Premium. Você pode buscar aqui, mas para ouvir use "Ouvir sem login" abaixo (prévias) ou o app do Spotify.', 'am'); else sp.iniciarPlayer().catch(e => msg(e.message, 'er'));
      const ls = await sp.minhasListas(), lista = j.querySelector('#mus-lista');
      if (lista && !j.querySelector('#mus-busca').value.trim()) lista.innerHTML = '<div class="mus-sec">Suas playlists</div>' + (ls.length ? ls.map(p => item(p.uri, imgDe(p), p.name, (p.tracks && p.tracks.total != null ? p.tracks.total + ' músicas' : 'playlist'))).join('') : '<p class="dica" style="padding:10px">Nenhuma playlist na sua conta.</p>');
    } catch (e) { msg('Spotify: ' + (e.message || e), 'er'); }
  }
  async function buscar(q) {
    const sp = SP(), lista = $j() && $j().querySelector('#mus-lista'); if (!lista) return;
    if (!q) return iniciarApp();
    try {
      const r = await sp.buscar(q);
      lista.innerHTML = (r.musicas.length ? '<div class="mus-sec">Músicas</div>' + r.musicas.map(t => item(t.uri, imgDe(t), t.name, (t.artists || []).map(a => a.name).join(', '))).join('') : '') +
        (r.listas.length ? '<div class="mus-sec">Playlists</div>' + r.listas.map(p => item(p.uri, imgDe(p), p.name, 'playlist')).join('') : '') +
        (r.albuns.length ? '<div class="mus-sec">Álbuns</div>' + r.albuns.map(a => item(a.uri, imgDe(a), a.name, (a.artists || []).map(x => x.name).join(', '))).join('') : '') || '<p class="dica" style="padding:10px">Nada encontrado.</p>';
    } catch (e) { msg('Busca: ' + (e.message || e), 'er'); }
  }
  /* barra do player: título, capa, tocar/pausar e a posição andando */
  M.atualizarPlayer = function () {
    const j = $j(); if (!j) return; const s = SP().estado, nome = j.querySelector('#mus-nome'); if (!nome) return;
    const t = s && s.track_window && s.track_window.current_track;
    nome.textContent = t ? t.name : 'Nada tocando'; j.querySelector('#mus-art').textContent = t ? (t.artists || []).map(a => a.name).join(', ') : 'Escolha uma lista ou música acima';
    const im = t && t.album && t.album.images && t.album.images[0]; j.querySelector('#mus-capa').innerHTML = im ? '<img src="' + esc(im.url) + '" alt="">' : '';
    j.querySelector('#mus-play').textContent = s && !s.paused ? '⏸' : '▶';
    const dur = s ? s.duration : 0, pos = s ? s.position : 0; M._base = { pos, em: Date.now(), tocando: !!(s && !s.paused), dur };
    j.querySelector('#mus-t1').textContent = fmt(dur); desenharPos();
  };
  function desenharPos() {
    const j = $j(); if (!j || !M._base) return; const b = M._base, p = Math.min(b.dur, b.pos + (b.tocando ? Date.now() - b.em : 0));
    const r = j.querySelector('#mus-pos'), t0 = j.querySelector('#mus-t0'); if (r && g.document.activeElement !== r) r.value = b.dur ? Math.round((p / b.dur) * 1000) : 0; if (t0) t0.textContent = fmt(p);
  }

  /* ---------- controle da janela ---------- */
  M.render = function () {
    const j = $j(); if (!j) return; const corpo = j.querySelector('#mus-corpo'), sp = SP(); if (!corpo) return;
    const modo = !sp.cfg.clientId ? 'preparo' : !sp.conectado() ? 'conectar' : 'app';
    if (modo !== M.modo || !corpo.firstChild) { M.modo = modo; (modo === 'preparo' ? telaPreparo : modo === 'conectar' ? telaConectar : telaApp)(corpo); if (sp.erro) msg(sp.erro, 'er'); }
    else if (modo === 'app') M.atualizarPlayer();
    if (sp.erro && modo !== 'app') msg(sp.erro, 'er');
  };
  M.ligar = function () {
    const jan = document.getElementById('jan-musica'); if (!jan) return;
    jan.addEventListener('click', e => { if (e.target.closest('[data-mus-fechar]')) RT.A.janVer('mus', false); });
    RT.spo.aoMudar = () => { const j = $j(); if (j && !j.hidden) { M.render(); if (SP().erro && M.modo === 'app') msg(SP().erro, 'er'); } };
    if (!M.timer) M.timer = setInterval(desenharPos, 500);
  };
})(typeof window !== 'undefined' ? window : globalThis);
