/* Health Route · Relatórios por período ou comparativo (desenho do PDF "Comparativo de Entregas"). */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const { N, U } = RT; const { $, esc } = U;
  const R = { modo: 'comparar', A: { de: '', ate: '' }, B: { de: '', ate: '' }, pronto: false };
  const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const f1 = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const f2 = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const f3 = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const i0 = n => Math.round(n).toLocaleString('pt-BR');
  const brl = c => 'R$ ' + f2(c / 100);
  const mi = c => f2(c / 1e8);
  const sinal = n => (n > 0 ? '+' : n < 0 ? '−' : '');
  const pct = p => (p == null ? '—' : sinal(p) + f1(Math.abs(p)) + '%');
  const dm = s => s.slice(8, 10) + '/' + s.slice(5, 7);
  const rotulo = P => (P.de.slice(0, 4) === P.ate.slice(0, 4) ? dm(P.de) + ' a ' + dm(P.ate) : U.dataBR(P.de) + ' a ' + U.dataBR(P.ate));
  function tituloMeses(de, ate) {
    const a = +de.slice(5, 7) - 1, b = +ate.slice(5, 7) - 1, ya = de.slice(0, 4), yb = ate.slice(0, 4);
    if (a === b && ya === yb) return MESES[a] + ' ' + ya;
    return MESES[a] + (ya !== yb ? ' ' + ya : '') + ' – ' + MESES[b] + ' ' + yb;
  }
  function presets(kind) {
    const h = new Date(), y = h.getFullYear(), m = h.getMonth();
    const ini = (yy, mm) => iso(new Date(yy, mm, 1)), fim = (yy, mm) => iso(new Date(yy, mm + 1, 0));
    if (kind === 'mes') return { modo: 'unico', A: { de: ini(y, m), ate: iso(h) } };
    if (kind === 'ant') return { modo: 'unico', A: { de: ini(y, m - 1), ate: fim(y, m - 1) } };
    if (kind === 'antatual') return { modo: 'comparar', A: { de: ini(y, m - 1), ate: fim(y, m - 1) }, B: { de: ini(y, m), ate: iso(h) } };
    const d30 = n => { const d = new Date(h); d.setDate(d.getDate() - n); return iso(d); };
    return { modo: 'comparar', A: { de: d30(59), ate: d30(30) }, B: { de: d30(29), ate: iso(h) } };
  }
  function aplicarPreset(k) { const p = presets(k); R.modo = p.modo; R.A = p.A; if (p.B) R.B = p.B; salvarPref(); }
  const salvarPref = () => U.pref.gravar('rel', { modo: R.modo, A: R.A, B: R.B });
  function iniciar() {
    if (R.pronto) return; R.pronto = true;
    const p = U.pref.ler('rel', null);
    if (p && p.A && p.A.de) { R.modo = p.modo; R.A = p.A; R.B = p.B || R.B; } else aplicarPreset('antatual');
    const raiz = $('#t-relatorios');
    raiz.addEventListener('click', e => {
      const m = e.target.closest('[data-rl-modo]'), pr = e.target.closest('[data-rl-pre]');
      if (m) { R.modo = m.dataset.rlModo; if (R.modo === 'comparar' && !R.B.de) aplicarPreset('antatual'); salvarPref(); render(); }
      if (pr) { aplicarPreset(pr.dataset.rlPre); render(); }
    });
    raiz.addEventListener('change', e => {
      const i = e.target.closest('input[type=date]'); if (!i) return;
      const [per, campo] = i.id.replace('rl-', '').split('-'); R[per.toUpperCase()][campo] = i.value; salvarPref(); render();
    });
    $('#bt-imprimir-rel').onclick = () => U.imprimir('rel');
  }
  async function render() {
    iniciar();
    const ops = await RT.DB.todos('ops').catch(() => []);
    const cmp = R.modo === 'comparar', per = (id, tit, P) => '<div class="rl-per"><b>' + tit + '</b><input type="date" id="rl-' + id + '-de" value="' + P.de + '" aria-label="' + tit + ' início"> a <input type="date" id="rl-' + id + '-ate" value="' + P.ate + '" aria-label="' + tit + ' fim"></div>';
    $('#rl-ctrl').innerHTML = '<div class="seg" role="group" aria-label="Tipo"><button type="button" data-rl-modo="unico" aria-pressed="' + !cmp + '">Um período</button><button type="button" data-rl-modo="comparar" aria-pressed="' + cmp + '">Comparar dois períodos</button></div>' +
      per('a', cmp ? '1º período' : 'Período', R.A) + (cmp ? per('b', '2º período', R.B) : '') +
      '<div class="rl-pre"><span>Atalhos:</span><button type="button" class="btn mini" data-rl-pre="mes">Mês atual</button><button type="button" class="btn mini" data-rl-pre="ant">Mês anterior</button><button type="button" class="btn mini" data-rl-pre="antatual">Mês anterior × atual</button><button type="button" class="btn mini" data-rl-pre="30">30 dias × 30 anteriores</button></div>';
    const A = N.relatorio(ops, R.A.de, R.A.ate), B = cmp ? N.relatorio(ops, R.B.de, R.B.ate) : null;
    const fonte = $('#rl-fonte'), tot = ops.length;
    fonte.textContent = tot ? 'Fonte: ' + tot + ' operação(ões) guardada(s) neste navegador. Cada dia importado em “Importar XML” vira uma operação com a data que você escolheu; notas repetidas entre operações entram uma vez só.' : 'Nenhuma operação guardada ainda.';
    const out = $('#rl-saida');
    if (R.A.de > R.A.ate || (cmp && R.B.de > R.B.ate)) { out.innerHTML = '<p class="sub">A data inicial não pode ser depois da final.</p>'; return; }
    if (!A.notas || (cmp && !B.notas)) {
      out.innerHTML = '<div class="vazio-rel"><h2>Sem dados ' + (!A.notas ? 'no ' + (cmp ? '1º período' : 'período') : 'no 2º período') + '</h2><p>Não há operações guardadas entre ' + U.dataBR(!A.notas ? R.A.de : R.B.de) + ' e ' + U.dataBR(!A.notas ? R.A.ate : R.B.ate) + '. Para o relatório, importe os XMLs de cada dia em <b>Importar XML</b>, escolhendo “Nova operação” com a data certa de cada dia.</p><button class="btn pri" data-ir="importar" type="button">Importar XMLs</button></div>';
      return;
    }
    out.innerHTML = cmp ? paginasComparar(A, B) : paginasUnico(A);
  }

  /* ---------- peças visuais ---------- */
  const cab = (kicker, titulo, sub, pag) => '<div class="rl-cab"><div><span>DISTRIBUIÇÃO &nbsp;/&nbsp; ' + esc(kicker) + '</span><h2>' + esc(titulo) + '</h2></div><img src="icons/healthlog.png" alt="HealthLog, uma empresa Viveo"></div><div class="rl-sub"><b>' + sub + '</b><span>' + pag + '</span></div>';
  const kpi = (cls, rot, val, p) => '<div class="rl-kpi ' + cls + '"><span>' + rot + '</span><b>' + val + '</b><i>' + (p == null ? '' : p) + '</i></div>';
  function barrasV(a, b, rotA, rotB, fmt) {
    const max = Math.max(a, b, 1), h = v => Math.round((v / max) * 190);
    return '<svg viewBox="0 0 420 260" class="rl-graf" role="img" aria-label="Valor das notas por período"><g font-family="Arial,Helvetica,sans-serif" text-anchor="middle">' +
      '<rect x="70" y="' + (220 - h(a)) + '" width="110" height="' + h(a) + '" fill="#003B5B"/><text x="125" y="' + (212 - h(a)) + '" font-size="19" font-weight="700" fill="#003B5B">' + fmt(a) + '</text><text x="125" y="244" font-size="12.5" font-weight="700" fill="#003B5B">' + esc(rotA) + '</text>' +
      '<rect x="240" y="' + (220 - h(b)) + '" width="110" height="' + h(b) + '" fill="#33F6C2"/><text x="295" y="' + (212 - h(b)) + '" font-size="19" font-weight="700" fill="#003B5B">' + fmt(b) + '</text><text x="295" y="244" font-size="12.5" font-weight="700" fill="#003B5B">' + esc(rotB) + '</text></g></svg>';
  }
  function barrasH(rotA, a, rotB, b, fmt, un) {
    const max = Math.max(a, b, 1);
    const lin = (r, v, c) => '<div class="rl-bh"><div class="rl-bh-t"><span>' + esc(r) + '</span><b>' + fmt(v) + ' ' + un + '</b></div><div class="rl-bh-b"><i style="width:' + Math.max(2, (v / max) * 100) + '%;background:' + c + '"></i></div></div>';
    return lin(rotA, a, '#003B5B') + lin(rotB, b, '#33F6C2');
  }
  const tabela = (cols, linhas, cls) => '<table class="rl-tab ' + (cls || '') + '"><thead><tr>' + cols.map((c, i) => '<th' + (i ? ' class="d"' : '') + '>' + c + '</th>').join('') + '</tr></thead><tbody>' + linhas.map(l => '<tr>' + l.map((c, i) => '<td' + (i ? ' class="d"' : '') + '>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  const top = (lista, n) => lista.slice(0, n).map(x => '<li><span>' + esc(x.nome) + '</span><b>' + f3(x.valor / 1e8) + '</b></li>').join('') || '<li><span>—</span></li>';
  const rodape = (txt, extra) => '<div class="rl-rod">' + esc(txt) + (extra ? ' ' + esc(extra) : '') + '</div>';
  const dup = (A, B) => { const n = A.duplicadas + (B ? B.duplicadas : 0); return n ? n + ' nota(s) repetida(s) entre operações foram ignoradas.' : ''; };

  function paginasComparar(A, B) {
    const c = N.comparativo(A, B), I = c.ind, k = tituloMeses(R.A.de, R.B.ate), pa = rotulo(R.A), pb = rotulo(R.B);
    const dif = I.paradas.dif, manch = dif > 0 ? i0(dif) + ' paradas adicionais' : dif < 0 ? i0(-dif) + ' paradas a menos' : 'Mesmo número de paradas';
    const dm1 = I.paradasDia, tend = dm1.pct == null ? '' : (dm1.dif >= 0 ? 'alta' : 'queda') + ' de ' + f1(Math.abs(dm1.pct)) + '%';
    const vd = Math.round(I.volDia.dif), dv = I.valor.dif;
    const p1 = '<section class="rl-pag">' + cab(k, 'Demanda e valor das entregas', pa + ' &nbsp;×&nbsp; ' + pb, '01 / 02') +
      '<div class="rl-corpo"><div class="rl-col">' + kpi('m', 'PARADAS PREVISTAS', i0(B.paradas), pct(I.paradas.pct)) + kpi('lm', 'NOTAS FISCAIS', i0(B.notas), pct(I.notas.pct)) + kpi('az', 'TICKET POR PARADA', brl(B.ticket), pct(I.ticket.pct)) + '</div>' +
      '<div class="rl-graf-bx"><h3>Valor das notas fiscais</h3><small>R$ milhões</small>' + barrasV(A.valor, B.valor, pa.replace(' a ', '–'), pb.replace(' a ', '–'), mi) + '</div></div>' +
      '<div class="rl-faixa m">Comparativo dos indicadores</div>' +
      tabela(['Indicador', '1º período', '2º período', 'Diferença'], [
        ['Paradas previstas', i0(A.paradas), i0(B.paradas), sinal(I.paradas.dif) + i0(Math.abs(I.paradas.dif))],
        ['Valor das notas (R$)', f2(A.valor / 100), f2(B.valor / 100), sinal(dv) + f2(Math.abs(dv) / 100)],
        ['Notas fiscais únicas', i0(A.notas), i0(B.notas), sinal(I.notas.dif) + i0(Math.abs(I.notas.dif))],
        ['Ticket por parada (R$)', f2(A.ticket / 100), f2(B.ticket / 100), sinal(I.ticket.dif) + f2(Math.abs(I.ticket.dif) / 100)],
        ['Dias de operação', i0(A.dias), i0(B.dias), sinal(I.dias.dif) + i0(Math.abs(I.dias.dif))],
        ['Paradas por dia', f1(A.media.paradas), f1(B.media.paradas), sinal(I.paradasDia.dif) + f1(Math.abs(I.paradasDia.dif))],
        ['Valor por dia (R$)', f2(A.media.valor / 100), f2(B.media.valor / 100), sinal(I.valorDia.dif) + f2(Math.abs(I.valorDia.dif) / 100)]]) +
      '<div class="rl-dest"><h3>' + esc(manch) + '</h3><p>A média diária passou de ' + f1(A.media.paradas) + ' para ' + f1(B.media.paradas) + ' paradas' + (tend ? ', ' + tend : '') + '.</p>' +
      '<p>O valor das mercadorias nas notas ' + (dv >= 0 ? 'aumentou ' : 'diminuiu ') + brl(Math.abs(dv)) + ' (' + pct(I.valor.pct) + ').</p></div>' +
      rodape('Fonte: ' + (A.operacoes + B.operacoes) + ' operações guardadas. Uma parada prevista corresponde a um endereço por dia. Ticket por parada = valor das notas ÷ paradas previstas.', dup(A, B)) + '</section>';
    const p2 = '<section class="rl-pag">' + cab(k, 'Carga movimentada', pa + ' &nbsp;×&nbsp; ' + pb, '02 / 02') +
      '<div class="rl-faixa m">Carga registrada nos XMLs</div><div class="rl-duas"><div><h3>Volumes informados</h3>' + barrasH(pa.replace(' a ', '–'), A.volMil / 1000, pb.replace(' a ', '–'), B.volMil / 1000, f1, 'vol.') + '<p class="rl-var">' + pct(I.vol.pct) + ' no período</p></div>' +
      '<div><h3>Peso informado</h3>' + barrasH(pa.replace(' a ', '–'), A.peso / 10000, pb.replace(' a ', '–'), B.peso / 10000, f1, 'kg') + '<p class="rl-var">' + pct(I.peso.pct) + ' no período</p></div></div>' +
      '<div class="rl-faixa az">Principais destinos e clientes por valor das notas</div><div class="rl-duas">' +
      [[pa, A], [pb, B]].map(([r, P]) => '<div><h4>' + esc(r.replace(' a ', '–')) + '</h4><h5>Destinos &nbsp;•&nbsp; R$ milhões</h5><ul class="rl-top">' + top(P.topCidades, 3) + '</ul><h5>Clientes &nbsp;•&nbsp; R$ milhões</h5><ul class="rl-top">' + top(P.topClientes, 3) + '</ul></div>').join('') + '</div>' +
      (c.lider ? '<p class="rl-nota">' + esc(c.lider.nome) + ' respondeu por ' + f1(c.lider.parcela) + '% ' + (dv >= 0 ? 'do aumento' : 'da queda') + ' no valor das notas.</p>' : '') +
      '<div class="rl-faixa lm">Carga média por dia de operação</div>' +
      tabela(['Indicador', pa.replace(' a ', '–'), pb.replace(' a ', '–'), 'Variação'], [
        ['Volumes por dia', f1(A.media.vol), f1(B.media.vol), pct(I.volDia.pct)], ['Peso por dia (kg)', f1(A.media.peso), f1(B.media.peso), pct(I.pesoDia.pct)], ['Notas fiscais por dia', f1(A.media.notas), f1(B.media.notas), pct(I.notasDia.pct)]], 'g') +
      '<div class="rl-dest"><h3>' + (vd >= 0 ? i0(vd) + ' volumes a mais por dia, em média.' : i0(-vd) + ' volumes a menos por dia, em média.') + '</h3></div>' +
      rodape('Soma por NF-e única. Os XMLs incluem volumes fracionados. Totais exibidos com uma casa decimal.', dup(A, B)) + '</section>';
    return p1 + p2;
  }

  function paginasUnico(A) {
    const k = tituloMeses(R.A.de, R.A.ate), pr = rotulo(R.A), max = Math.max(...A.porDia.map(d => d.valor), 1);
    const dias = A.porDia.map(d => '<div class="rl-dia" title="' + U.dataBR(d.data) + ': ' + brl(d.valor) + '"><i style="height:' + Math.max(3, (d.valor / max) * 100) + '%"></i><span>' + d.data.slice(8, 10) + '</span></div>').join('');
    const p1 = '<section class="rl-pag">' + cab(k, 'Demanda e valor das entregas', pr, '01 / 02') +
      '<div class="rl-corpo"><div class="rl-col">' + kpi('m', 'PARADAS PREVISTAS', i0(A.paradas), '') + kpi('lm', 'NOTAS FISCAIS', i0(A.notas), '') + kpi('az', 'TICKET POR PARADA', brl(A.ticket), '') + '</div>' +
      '<div class="rl-graf-bx"><h3>Valor das notas por dia</h3><small>cada barra é um dia de operação</small><div class="rl-dias">' + dias + '</div></div></div>' +
      '<div class="rl-faixa m">Indicadores do período</div>' +
      tabela(['Indicador', 'Período'], [['Paradas previstas', i0(A.paradas)], ['Valor das notas (R$)', f2(A.valor / 100)], ['Notas fiscais únicas', i0(A.notas)], ['Ticket por parada (R$)', f2(A.ticket / 100)], ['Dias de operação', i0(A.dias)], ['Paradas por dia', f1(A.media.paradas)], ['Valor por dia (R$)', f2(A.media.valor / 100)]]) +
      '<div class="rl-dest"><h3>' + brl(A.valor) + ' em ' + i0(A.paradas) + ' paradas</h3><p>Em média, ' + f1(A.media.paradas) + ' paradas e ' + brl(Math.round(A.media.valor)) + ' por dia de operação.</p></div>' +
      rodape('Fonte: ' + A.operacoes + ' operações guardadas. Uma parada prevista corresponde a um endereço por dia. Ticket por parada = valor das notas ÷ paradas previstas.', dup(A)) + '</section>';
    const p2 = '<section class="rl-pag">' + cab(k, 'Carga movimentada', pr, '02 / 02') +
      '<div class="rl-faixa m">Carga registrada nos XMLs</div><div class="rl-duas"><div><h3>Volumes informados</h3><p class="rl-grande">' + f1(A.volMil / 1000) + ' vol.</p></div><div><h3>Peso informado</h3><p class="rl-grande">' + f1(A.peso / 10000) + ' kg</p></div></div>' +
      '<div class="rl-faixa az">Principais destinos e clientes por valor das notas</div><div class="rl-duas"><div><h5>Destinos &nbsp;•&nbsp; R$ milhões</h5><ul class="rl-top">' + top(A.topCidades, 5) + '</ul></div><div><h5>Clientes &nbsp;•&nbsp; R$ milhões</h5><ul class="rl-top">' + top(A.topClientes, 5) + '</ul></div></div>' +
      '<div class="rl-faixa lm">Carga média por dia de operação</div>' +
      tabela(['Indicador', 'Período'], [['Volumes por dia', f1(A.media.vol)], ['Peso por dia (kg)', f1(A.media.peso)], ['Notas fiscais por dia', f1(A.media.notas)]], 'g') +
      rodape('Soma por NF-e única. Os XMLs incluem volumes fracionados. Totais exibidos com uma casa decimal.', dup(A)) + '</section>';
    return p1 + p2;
  }
  RT.relatorios = { render };
})(typeof window !== 'undefined' ? window : globalThis);
