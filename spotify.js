/* Health Log. · SPOTIFY de verdade dentro de uma janela: login na sua conta (OAuth PKCE, sem senha no app), busca, suas playlists e o player
   (Spotify Web Playback SDK) tocando AQUI, no navegador. O Spotify exige conta PREMIUM para tocar dentro do app (regra deles, não nossa).
   Você precisa do seu "Client ID" (grátis, em developer.spotify.com/dashboard): crie um app, ponha a Redirect URI mostrada em Configurações e cole o Client ID.
   Segredo só no aparelho: Client ID e tokens ficam no banco local (meta `spotify`), nunca em operação, cópia de segurança, arquivo baixado ou Git. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const SP = RT.spo = { cfg: { clientId: '', access: '', refresh: '', exp: 0 }, me: null, device: null, player: null, estado: null, premium: null, erro: '', aoMudar: null, sdkOk: false };
  const AUTH = 'https://accounts.spotify.com/authorize', TOKEN = 'https://accounts.spotify.com/api/token', API = 'https://api.spotify.com/v1';
  const ESCOPOS = ['streaming', 'user-read-email', 'user-read-private', 'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'playlist-read-private', 'playlist-read-collaborative', 'user-library-read'];
  const avisar = () => { try { SP.aoMudar && SP.aoMudar(); } catch (e) { console.error(e); } };
  SP.redirectUri = () => new URL('./', g.location.href).href.split('?')[0].split('#')[0];
  SP.conectado = () => !!(SP.cfg.access && SP.cfg.refresh);

  SP.carregar = async function () {
    try { const r = await RT.DB.get('meta', 'spotify'); if (r && r.v) SP.cfg = Object.assign(SP.cfg, r.v); } catch (e) { /* sem dados guardados */ }
  };
  const guardar = () => RT.DB.put('meta', { k: 'spotify', v: SP.cfg }).catch(() => { /* só perde o login */ });
  SP.definirClientId = async function (id) { SP.cfg.clientId = String(id || '').trim().replace(/[^A-Za-z0-9]/g, '').slice(0, 64); await guardar(); avisar(); };

  /* ---------- login (PKCE) ---------- */
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const aleatorio = n => { const a = new Uint8Array(n); g.crypto.getRandomValues(a); return b64url(a).slice(0, n); };
  SP.irPara = url => { g.location.assign(url); };
  SP.conectar = async function () {
    if (!SP.cfg.clientId) { SP.erro = 'Cole primeiro o seu Client ID do Spotify.'; avisar(); return null; }
    const verif = aleatorio(96), estado = aleatorio(24), desafio = b64url(await g.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verif)));
    try { sessionStorage.setItem('hr:spo', JSON.stringify({ verif, estado })); } catch (e) { SP.erro = 'O navegador bloqueou o armazenamento temporário.'; avisar(); return null; }
    const url = AUTH + '?' + new URLSearchParams({ client_id: SP.cfg.clientId, response_type: 'code', redirect_uri: SP.redirectUri(), code_challenge_method: 'S256', code_challenge: desafio, state: estado, scope: ESCOPOS.join(' ') });
    SP.irPara(url); return url;
  };
  async function pedirToken(corpo) {
    const r = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(Object.assign({ client_id: SP.cfg.clientId }, corpo)), redirect: 'error' });
    if (!r.ok) throw new Error('o Spotify recusou o login (' + r.status + ')');
    const j = await r.json(); if (!j.access_token) throw new Error('resposta do Spotify sem token');
    SP.cfg.access = j.access_token; if (j.refresh_token) SP.cfg.refresh = j.refresh_token; SP.cfg.exp = Date.now() + (j.expires_in || 3600) * 1000; await guardar();
  }
  /* volta do Spotify com ?code=…&state=… */
  SP.tratarRetorno = async function () {
    const q = new URLSearchParams(g.location.search), code = q.get('code'), st = q.get('state'), err = q.get('error');
    if (!(code || err) || !st) return false;
    let salvo = null; try { salvo = JSON.parse(sessionStorage.getItem('hr:spo') || 'null'); } catch (e) { /* ok */ }
    if (!salvo || salvo.estado !== st) return false;   // não é o nosso retorno
    try { sessionStorage.removeItem('hr:spo'); } catch (e) { /* ok */ }
    try { history.replaceState(null, '', g.location.pathname); } catch (e) { /* ok */ }
    if (err) { SP.erro = 'Login cancelado no Spotify.'; avisar(); return true; }
    try { await pedirToken({ grant_type: 'authorization_code', code, redirect_uri: SP.redirectUri(), code_verifier: salvo.verif }); SP.erro = ''; }
    catch (e) { SP.erro = 'Não consegui entrar: ' + (e.message || e); }
    avisar(); return true;
  };
  SP.sair = async function () {
    try { if (SP.player) SP.player.disconnect(); } catch (e) { /* ok */ }
    SP.player = null; SP.device = null; SP.estado = null; SP.me = null; SP.premium = null; SP.cfg.access = ''; SP.cfg.refresh = ''; SP.cfg.exp = 0; await guardar(); avisar();
  };
  SP.token = async function () {
    if (!SP.cfg.refresh) throw new Error('sem login');
    if (Date.now() > SP.cfg.exp - 60000) { try { await pedirToken({ grant_type: 'refresh_token', refresh_token: SP.cfg.refresh }); } catch (e) { SP.cfg.access = ''; SP.cfg.refresh = ''; await guardar(); avisar(); throw e; } }
    return SP.cfg.access;
  };
  SP.api = async function (caminho, opc) {
    opc = opc || {}; const t = await SP.token();
    const r = await fetch(API + caminho, { method: opc.metodo || 'GET', headers: Object.assign({ Authorization: 'Bearer ' + t }, opc.corpo ? { 'Content-Type': 'application/json' } : {}), body: opc.corpo ? JSON.stringify(opc.corpo) : undefined, redirect: 'error' });
    if (r.status === 204 || r.status === 202) return {};
    let j = null; try { j = await r.json(); } catch (e) { /* sem corpo */ }
    if (!r.ok) { const m = (j && j.error && (j.error.message || j.error)) || ('erro ' + r.status); const e = new Error(m); e.status = r.status; throw e; }
    return j || {};
  };

  /* ---------- conta, listas e busca ---------- */
  SP.carregarConta = async function () {
    SP.me = await SP.api('/me'); SP.premium = SP.me.product === 'premium'; avisar(); return SP.me;
  };
  SP.minhasListas = async () => ((await SP.api('/me/playlists?limit=40')).items || []).filter(Boolean);
  SP.buscar = async function (q) {
    const j = await SP.api('/search?' + new URLSearchParams({ q, type: 'track,playlist,album', limit: '8' }));
    return { musicas: ((j.tracks || {}).items || []).filter(Boolean), listas: ((j.playlists || {}).items || []).filter(Boolean), albuns: ((j.albums || {}).items || []).filter(Boolean) };
  };

  /* ---------- player (Web Playback SDK) ---------- */
  let sdkP = null;
  const carregarSdk = () => sdkP || (sdkP = new Promise((ok, er) => {
    if (g.Spotify && g.Spotify.Player) return ok();
    g.onSpotifyWebPlaybackSDKReady = () => ok();
    const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; s.async = true; s.onerror = () => { sdkP = null; er(new Error('não consegui carregar o player do Spotify (internet ou bloqueio)')); }; document.head.appendChild(s);
  }));
  SP.iniciarPlayer = async function () {
    if (SP.player || !SP.conectado()) return;
    await carregarSdk();
    const p = new g.Spotify.Player({ name: 'Health Log', getOAuthToken: cb => { SP.token().then(cb).catch(() => { /* sem login */ }); }, volume: +(localStorage.getItem('hr:spoVol') || 0.6) });
    p.addListener('ready', ({ device_id }) => { SP.device = device_id; SP.erro = ''; avisar(); });
    p.addListener('not_ready', () => { SP.device = null; avisar(); });
    p.addListener('player_state_changed', s => { SP.estado = s || null; avisar(); });
    p.addListener('initialization_error', e => { SP.erro = 'Este navegador não consegue tocar Spotify aqui dentro (' + e.message + ').'; avisar(); });
    p.addListener('authentication_error', e => { SP.erro = 'O Spotify recusou o login: ' + e.message; avisar(); });
    p.addListener('account_error', () => { SP.premium = false; SP.erro = 'Tocar dentro do app exige conta Spotify Premium.'; avisar(); });
    p.addListener('playback_error', e => { SP.erro = 'Erro ao tocar: ' + e.message; avisar(); });
    SP.player = p; await p.connect();
  };
  const naMaquina = async () => { if (!SP.device) throw new Error('o player ainda está abrindo, tente de novo em instantes'); await SP.api('/me/player', { metodo: 'PUT', corpo: { device_ids: [SP.device], play: false } }).catch(() => { /* já era este */ }); };
  /* item = { uri } de uma playlist/álbum/artista (contexto) ou de uma música */
  SP.tocar = async function (uri) {
    await SP.iniciarPlayer(); await naMaquina();
    const corpo = /^spotify:track:/.test(uri) ? { uris: [uri] } : { context_uri: uri };
    await SP.api('/me/player/play?device_id=' + encodeURIComponent(SP.device), { metodo: 'PUT', corpo });
  };
  SP.controle = async function (acao, v) {
    const p = SP.player; if (!p) return;
    if (acao === 'play') return p.togglePlay(); if (acao === 'prox') return p.nextTrack(); if (acao === 'ant') return p.previousTrack();
    if (acao === 'vol') { try { localStorage.setItem('hr:spoVol', String(v)); } catch (e) { /* ok */ } return p.setVolume(v); }
    if (acao === 'pos') return p.seek(Math.round(v));
  };
})(typeof window !== 'undefined' ? window : globalThis);
