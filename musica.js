/* Health Log. · janela flutuante "Música": toca Spotify dentro do app (player oficial incorporado do Spotify).
   Cole o link de uma playlist, álbum, música, artista ou podcast. Para ouvir inteiro, entre na sua conta do Spotify neste navegador
   (sem login o Spotify toca só prévias de 30 s). O app NÃO recebe nem guarda login/senha do Spotify: tudo acontece dentro do player dele. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {}), U = RT.U, esc = U.esc;
  const M = RT.mus = {};
  /* aceita link do site (com ou sem ?si=…, /intl-pt/) ou URI "spotify:playlist:ID" */
  M.analisar = function (txt) {
    const t = String(txt || '').trim();
    let m = /open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[A-Za-z]{2})?\/)?(?:embed\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]{22})/.exec(t) || /^spotify:(playlist|album|track|artist|show|episode):([A-Za-z0-9]{22})$/.exec(t);
    return m ? { tipo: m[1], id: m[2] } : null;
  };
  M.url = x => 'https://open.spotify.com/embed/' + x.tipo + '/' + x.id + '?theme=0';
  function tocar(x) {
    const box = U.$('#mus-player'); if (!box) return;
    box.innerHTML = '<iframe title="Spotify" src="' + esc(M.url(x)) + '" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    U.pref.gravar('spotify', 'https://open.spotify.com/' + x.tipo + '/' + x.id);
  }
  M.render = function () {
    const jan = U.$('#jan-musica'); if (!jan) return;
    const salvo = U.pref.ler('spotify', ''), x = M.analisar(salvo), box = jan.querySelector('#mus-player');
    if (x && !box.querySelector('iframe')) tocar(x);
    if (!x && !box.querySelector('iframe')) box.innerHTML = '<p class="dica" style="padding:14px">Cole acima o link de uma playlist, álbum, música ou podcast do Spotify e clique em <b>Tocar</b>. Para ouvir inteiro, entre na sua conta do Spotify neste navegador.</p>';
  };
  M.ligar = function () {
    const jan = document.getElementById('jan-musica'); if (!jan) return;
    const inp = jan.querySelector('#mus-link'), er = jan.querySelector('#mus-erro');
    const ir = () => { const x = M.analisar(inp.value); if (!x) { er.textContent = 'Não reconheci esse link. Copie no Spotify: ••• → Compartilhar → Copiar link.'; er.hidden = false; return; } er.hidden = true; tocar(x); inp.value = ''; };
    jan.querySelector('#mus-tocar').onclick = ir;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ir(); } });
    jan.addEventListener('click', e => { if (e.target.closest('[data-mus-fechar]')) RT.A.janVer('mus', false); if (e.target.closest('[data-mus-limpar]')) { U.pref.gravar('spotify', ''); jan.querySelector('#mus-player').innerHTML = ''; M.render(); } });
    inp.value = '';
  };
})(typeof window !== 'undefined' ? window : globalThis);
