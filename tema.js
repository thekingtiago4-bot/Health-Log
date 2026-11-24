/* Health Log. · início: tema antes de pintar a tela (sem piscar) e abertura animada. Fica em arquivo próprio para a página não precisar de script embutido (CSP). */
try { var t = JSON.parse(localStorage.getItem('hr:tema') || 'null'); document.documentElement.setAttribute('data-tema', t === 'claro' ? 'claro' : 'escuro'); } catch (e) { document.documentElement.setAttribute('data-tema', 'escuro'); }
(function () {
  if (/[?&](mapa|geo)=1/.test(location.search)) return;
  /* a tela do app NUNCA aparece antes da abertura: uma cortina da cor da abertura cobre tudo já no primeiro quadro;
     a abertura (abertura.js, carregada com defer no index.html) a troca pela animação, e ela some sozinha se algo falhar */
  try {
    if (!matchMedia('(prefers-reduced-motion:reduce)').matches) {
      var pre = document.createElement('div'); pre.id = 'hs-pre';
      pre.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2200;background:radial-gradient(120vmax 80vmax at 50% 40%,#17656a 0%,#0f4c4c 35%,#062427 100%)';
      document.documentElement.appendChild(pre);
      setTimeout(function () { if (pre.parentNode) pre.parentNode.removeChild(pre); }, 8000);
    }
  } catch (e) { /* sem cortina: segue */ }
})();
