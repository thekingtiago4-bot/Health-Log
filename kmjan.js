/* Health Log. · janela flutuante "KM das rotas": calcula sozinha o KM (ida e volta) de cada veículo, em tempo real, e soma o KM Total.
   KM/tempo seguem o cálculo escolhido em Configurações (padrão: como o Google Maps — rota mais rápida, média de dois serviços de rota). */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {}), N = RT.N, U = RT.U, esc = U.esc;
  const K = RT.kmj = {};
  const tempo = min => { const m = Math.round(min), h = Math.floor(m / 60); return h ? h + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min'; };
  const km1 = v => Math.round(v).toLocaleString('pt-BR');
  K.linhas = function () {
    const s = RT.S; if (!s.op || !s.res) return [];
    return s.res.carros.filter(rc => rc.notas > 0).map(rc => { const k = RT.A.kmDe(rc.carro); return { rc, k, pronto: !!k.n && !k.faltam }; });
  };
  K.total = function () { const L = K.linhas(); return { km: L.reduce((t, x) => t + (x.pronto ? x.k.km : 0), 0), min: L.reduce((t, x) => t + (x.pronto ? x.k.min : 0), 0), faltam: L.filter(x => x.k.n && !x.pronto).length, n: L.length }; };
  K.render = function () {
    const jan = U.$('#jan-km'); if (!jan || RT.S.modoMapa) return;
    const corpo = jan.querySelector('#km-corpo'), qt = jan.querySelector('#km-qt'); if (!corpo) return;
    const L = K.linhas(), t = K.total(), pend = RT.vias.pendentes();
    qt.textContent = String(L.length);
    if (!RT.S.op) { corpo.innerHTML = '<div class="vazio-lista">Sem operação aberta.</div>'; return; }
    if (!L.length) { corpo.innerHTML = '<div class="vazio-lista">Nenhum veículo com notas ainda.</div>'; return; }
    const modo = RT.vias.modo === 'google' ? 'como o Google Maps (rota mais rápida)' : 'caminho mais curto';
    corpo.innerHTML = '<div class="km-tot"><small>KM TOTAL</small><b>' + (t.faltam ? '…' : km1(t.km)) + '<span> km</span></b><small>' + (t.faltam ? 'calculando… ' + (L.length - t.faltam) + ' de ' + L.length + ' veículos' : 'ida e volta, ' + L.length + ' veículo(s) · ' + tempo(t.min) + ' de carro') + '</small></div>' +
      (pend ? '<div class="km-prog"><i></i><span>Calculando ' + pend + ' trecho(s)…</span></div>' : '') +
      '<table class="km-tab"><thead><tr><th>Veículo</th><th>Cidades</th><th class="d">KM</th><th class="d">Tempo</th></tr></thead><tbody>' +
      L.map(x => '<tr><td><span class="km-pt" style="--cor:' + x.rc.carro.cor + '"></span>' + esc(N.rotuloCarro(x.rc.carro)) + '</td><td>' + x.rc.cidades.length + '</td><td class="d"><b>' + (x.pronto ? km1(x.k.km) : (x.k.n ? '…' : '—')) + '</b></td><td class="d">' + (x.pronto ? tempo(x.k.min) : '') + '</td></tr>').join('') + '</tbody></table>' +
      '<p class="dica" style="margin:8px 10px">Cálculo: ' + modo + ', sem trânsito, da base até a última parada e a volta à base. Muda em Configurações → Cálculo do KM.</p>' +
      '<div style="padding:0 10px 10px"><button type="button" class="btn mini" data-km-refazer>Recalcular tudo</button></div>';
  };
  K.ligar = function () {
    const jan = document.getElementById('jan-km'); if (!jan) return;
    jan.addEventListener('click', e => {
      if (e.target.closest('[data-km-fechar]')) return RT.A.janVer('km', false);
      if (e.target.closest('[data-km-refazer]')) { RT.S.mapa.pernas.clear(); RT.vias.mem.clear(); RT.A.atualizarVias(); K.render(); }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
