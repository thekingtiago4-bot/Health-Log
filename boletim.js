/* Health Log. · BOLETIM OPERACIONAL DIÁRIO (Painel de Gestão → Relatórios → "Boletim diário").
   Um boletim por dia de operação, no mesmo visual do relatório "Demanda e valor das entregas" (azul #003B5B, menta #33F6C2, logo Health Log).
   O histórico começa no dia da PRIMEIRA ROTA criada: o dia se compara com o anterior, com o mesmo dia da semana passada, e a semana,
   o mês e o ano com os períodos anteriores. Tudo vem das operações guardadas neste aparelho (nada é inventado). */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const { N, U } = RT; const { $, esc } = U;
  const B = RT.bol = { data: '', pronto: false };
  const DIA3 = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'], DIAL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const f1 = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const f2 = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const i0 = n => Math.round(n).toLocaleString('pt-BR');
  const brl = c => 'R$ ' + f2(c / 100);
  const dm = s => s.slice(8, 10) + '/' + s.slice(5, 7);
  const isoD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dDe = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const soma = (s, n) => { const d = dDe(s); d.setDate(d.getDate() + n); return isoD(d); };
  const segunda = s => { const d = dDe(s), w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return isoD(d); };
  const sinal = n => (n > 0 ? '▲' : n < 0 ? '▼' : '•');
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);

  /* ---------- números de um dia (junta as operações guardadas daquela data; nota repetida entra uma vez) ---------- */
  function diaDe(ops, data) {
    const d = { data, ops: ops.filter(o => o.data === data), notas: 0, valor: 0, vol: 0, peso: 0, cidades: 0, paradas: 0, agend: { notas: 0, valor: 0, vol: 0 }, diverg: { notas: 0, valor: 0, vol: 0 }, nao: { notas: 0, valor: 0, vol: 0 }, def: { notas: 0, vol: 0, peso: 0, valor: 0 }, tr: { carro: { v: 0, notas: 0, vol: 0, peso: 0, valor: 0 }, van: { v: 0, notas: 0, vol: 0, peso: 0, valor: 0 }, caminhao: { v: 0, notas: 0, vol: 0, peso: 0, valor: 0 } }, comRota: false };
    const vistos = new Set(), cid = new Set(), par = new Set();
    for (const o of d.ops) {
      const usados = { carro: new Set(), van: new Set(), caminhao: new Set() };
      if (o.atrib && Object.keys(o.atrib).length) d.comRota = true;
      for (const n of o.notas) {
        if (vistos.has(n.id)) continue; vistos.add(n.id);
        d.notas++; d.valor += n.valor; d.vol += n.vol; d.peso += n.peso; cid.add(N.normCidade(n.cidade) + '|' + n.uf); par.add(N.chaveEndereco(n));
        const st = o.status && o.status[n.id], car = o.atrib && o.atrib[n.id] != null ? (o.carros || []).find(c => c.id === o.atrib[n.id]) : null;
        const add = (t, vol, peso, valor) => { t.notas++; t.vol += vol; t.peso += peso; t.valor += valor; };
        if (st && st.tipo === 'agendamento') { d.agend.notas++; d.agend.valor += n.valor; d.agend.vol += n.vol; }
        else if (st && st.tipo === 'divergencia') { d.diverg.notas++; d.diverg.valor += n.valor; d.diverg.vol += n.vol; }
        else if (o.naoVai && o.naoVai[n.id]) { d.nao.notas++; d.nao.valor += n.valor; d.nao.vol += n.vol; }
        else if (car) { const t = d.tr[car.tipo] || d.tr.carro; add(t, n.vol, n.peso, n.valor); usados[car.tipo in usados ? car.tipo : 'carro'].add(car.id); }
        else add(d.def, n.vol, n.peso, n.valor);
      }
      for (const k of Object.keys(usados)) d.tr[k].v += usados[k].size;
    }
    d.cidades = cid.size; d.paradas = par.size; d.kg = d.peso / 10000;
    for (const k of Object.keys(d.tr)) d.tr[k].kg = d.tr[k].peso / 10000;
    d.def.kg = d.def.peso / 10000;
    return d;
  }
  /* todos os dias de operação (a partir da primeira rota criada) */
  function dias(ops) {
    const datas = [...new Set(ops.filter(o => /^\d{4}-\d{2}-\d{2}$/.test(o.data || '')).map(o => o.data))].sort();
    const todos = datas.map(d => diaDe(ops, d)), ini = todos.find(x => x.comRota);
    return { todos, inicio: ini ? ini.data : null, validos: ini ? todos.filter(x => x.data >= ini.data) : [] };
  }
  const periodo = (validos, de, ate) => { const l = validos.filter(x => x.data >= de && x.data <= ate); return { de, ate, n: l.length, notas: l.reduce((t, x) => t + x.notas, 0), valor: l.reduce((t, x) => t + x.valor, 0), vol: l.reduce((t, x) => t + x.vol, 0), paradas: l.reduce((t, x) => t + x.paradas, 0), kg: l.reduce((t, x) => t + x.kg, 0) }; };

  /* ---------- peças visuais (mesmas do relatório Demanda e valor) ---------- */
  const cab = (titulo, sub, pag) => '<div class="rl-cab"><div><span>OPERAÇÃO &nbsp;/&nbsp; BOLETIM DIÁRIO</span><h2>' + esc(titulo) + '</h2></div><img src="icons/healthlog.png" alt="Health Log"></div><div class="rl-sub"><span>' + esc(sub) + '</span><span>' + pag + '</span></div>';
  const rod = txt => '<div class="rl-rod">' + esc(txt) + '</div>';
  function variacao(atual, ant, un) {
    if (!ant && !atual) return '<em class="bol-v z">sem dados no dia anterior</em>';
    if (!ant) return '<em class="bol-v z">sem dados no dia anterior</em>';
    const p = pct(atual, ant), cls = atual > ant ? 'up' : atual < ant ? 'dn' : 'z';
    return '<em class="bol-v ' + cls + '">' + sinal(atual - ant) + ' ' + f1(Math.abs(p)) + '% ' + (un || '') + '</em>';
  }
  /* gráfico de linha da semana (Seg → Dom), com "Sem dados" nos dias vazios e o melhor dia em destaque */
  function grafSemana(sem, campo, fmt, titulo, sub) {
    const W = 700, H = 230, X0 = 50, X1 = 650, Y0 = 55, Y1 = 170, passo = (X1 - X0) / 6;
    const vals = sem.map(d => (d ? d[campo] : null)), max = Math.max(...vals.filter(v => v != null), 1), min = 0;
    const y = v => Y1 - ((v - min) / (max - min || 1)) * (Y1 - Y0), x = i => X0 + i * passo;
    const melhor = vals.reduce((b, v, i) => (v != null && (b < 0 || v > vals[b]) ? i : b), -1);
    let pts = '', area = '', seq = [];
    vals.forEach((v, i) => { if (v != null) seq.push([x(i), y(v)]); });
    const linha = seq.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    if (seq.length > 1) area = '<path d="' + linha + 'L' + seq[seq.length - 1][0].toFixed(1) + ' ' + Y1 + 'L' + seq[0][0].toFixed(1) + ' ' + Y1 + 'Z" fill="#D4F9EF"/>';
    const marcas = sem.map((d, i) => {
      const lab = '<text x="' + x(i) + '" y="' + (H - 22) + '" font-size="12" fill="#003B5B" text-anchor="middle">' + DIA3[(i + 1) % 7] + ' ' + (d ? dm(d.data).slice(0, 2) : '') + '</text>';
      return (vals[i] != null
        ? '<circle cx="' + x(i) + '" cy="' + y(vals[i]).toFixed(1) + '" r="' + (i === melhor ? 8 : 5.5) + '" fill="' + (i === melhor ? '#33F6C2' : '#003B5B') + '" stroke="#003B5B" stroke-width="' + (i === melhor ? 3 : 0) + '"/><text x="' + x(i) + '" y="' + (y(vals[i]) - 14).toFixed(1) + '" font-size="14" font-weight="700" fill="#003B5B" text-anchor="middle">' + fmt(vals[i]) + '</text>'
        : '<text x="' + x(i) + '" y="' + (Y1 - 6) + '" font-size="11" fill="#5B7B84" text-anchor="middle">Sem dados</text>') + lab;
    }).join('');
    return '<div class="bol-graf"><div class="bol-graf-t"><h3>' + esc(titulo) + '</h3><span>' + esc(sub) + '</span></div><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(titulo) + '" font-family="Arial,Helvetica,sans-serif">' +
      '<line x1="' + X0 + '" y1="' + Y1 + '" x2="' + X1 + '" y2="' + Y1 + '" stroke="#B9D4DA" stroke-width="1.5"/>' + area + (seq.length > 1 ? '<path d="' + linha + '" fill="none" stroke="#003B5B" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>' : '') + marcas + '</svg>' +
      (melhor >= 0 ? '<p class="bol-melhor">Maior ' + (campo === 'valor' ? 'valor de cargas' : 'volumetria') + ' da semana: <b>' + DIA3[(melhor + 1) % 7] + ' ' + dm(sem[melhor].data) + '</b> com <b>' + fmt(vals[melhor]) + '</b>.</p>' : '') + '</div>';
  }
  function blocoComp(titulo, A, Bp, rotA, rotB) {
    const lin = (nome, a, b, fmt) => { const d = a - b, p = pct(a, b); return '<tr><td>' + nome + '</td><td class="d">' + fmt(a) + '</td><td class="d">' + (Bp.n ? fmt(b) : '—') + '</td><td class="d bol-' + (d > 0 ? 'up' : d < 0 ? 'dn' : 'z') + '">' + (Bp.n ? sinal(d) + ' ' + fmt(Math.abs(d)) : '—') + '</td><td class="d bol-' + (d > 0 ? 'up' : d < 0 ? 'dn' : 'z') + '">' + (Bp.n && p != null ? (d >= 0 ? '+' : '−') + f1(Math.abs(p)) + '%' : '—') + '</td></tr>'; };
    return '<div class="rl-faixa lm">' + esc(titulo) + '</div><table class="rl-tab bol-comp"><thead><tr><th>Indicador</th><th class="d">' + esc(rotA) + '</th><th class="d">' + esc(rotB) + '</th><th class="d">Diferença</th><th class="d">Variação</th></tr></thead><tbody>' +
      lin('Valor das notas', A.valor, Bp.valor, brl) + lin('Notas fiscais', A.notas, Bp.notas, i0) + lin('Volumes', A.vol, Bp.vol, i0) + lin('Paradas', A.paradas, Bp.paradas, i0) + '</tbody></table>';
  }

  /* ---------- o boletim do dia ---------- */
  B.montar = function (ops, data) {
    const H = dias(ops), d = diaDe(ops, data), inicio = H.inicio;
    const val = H.validos, ant = [...val].reverse().find(x => x.data < data) || null, semPas = val.find(x => x.data === soma(data, -7)) || null;
    const seg = segunda(data), sem = []; for (let i = 0; i < 7; i++) { const dd = soma(seg, i); sem.push(val.find(x => x.data === dd) || (d.data === dd && d.notas ? d : null)); }
    const dsem = DIAL[dDe(data).getDay()], titData = U.dataBR(data) + ' · ' + dsem;
    const L = (tipo, nome, cor, bg) => { const t = d.tr[tipo]; return '<tr style="--c:' + cor + ';--bg:' + bg + '"><td class="bol-t"><i></i>' + nome + '</td><td>' + (t.v || '—') + '</td><td>' + i0(t.notas) + '</td><td>' + i0(t.vol) + '</td><td>' + f1(t.kg) + '</td><td>' + brl(t.valor) + '</td></tr>'; };
    const defRow = '<tr style="--c:#6B7C85;--bg:#EEF2F3"><td class="bol-t"><i></i>A definir</td><td>—</td><td>' + i0(d.def.notas) + '</td><td>' + i0(d.def.vol) + '</td><td>' + f1(d.def.kg) + '</td><td>' + brl(d.def.valor) + '</td></tr>';
    const extra = (d.nao.notas ? '<tr style="--c:#9AA7AA;--bg:#F1F4F5"><td class="bol-t"><i></i>Não vão hoje</td><td>—</td><td>' + i0(d.nao.notas) + '</td><td>' + i0(d.nao.vol) + '</td><td>—</td><td>' + brl(d.nao.valor) + '</td></tr>' : '');
    const pa = ant ? ant : { notas: 0, valor: 0, vol: 0, paradas: 0, kg: 0, cidades: 0 };
    const p1 = '<section class="rl-pag">' + cab('Boletim operacional diário', titData, '01 / 04') +
      '<div class="bol-card"><span>VALOR DA OPERAÇÃO</span><b>' + brl(d.valor) + '</b>' + variacao(d.valor, ant ? pa.valor : 0, 'sobre o dia anterior') +
      '<div class="bol-kpis"><div><b>' + i0(d.notas) + '</b><small>NOTAS</small>' + variacao(d.notas, ant ? pa.notas : 0) + '</div><div><b>' + i0(d.cidades) + '</b><small>CIDADES</small>' + variacao(d.cidades, ant ? pa.cidades : 0) + '</div><div><b>' + i0(d.paradas) + '</b><small>PARADAS</small>' + variacao(d.paradas, ant ? pa.paradas : 0) + '</div><div><b>' + i0(d.vol) + '</b><small>VOLUMES</small>' + variacao(d.vol, ant ? pa.vol : 0) + '</div><div><b>' + f1(d.kg) + '</b><small>KG</small>' + variacao(d.kg, ant ? pa.kg : 0) + '</div></div></div>' +
      '<div class="rl-faixa az">Carga por transporte</div><table class="rl-tab bol-tr"><thead><tr><th>Transporte</th><th>Veículos</th><th>Notas</th><th>Volumes</th><th>Peso (kg)</th><th>Valor</th></tr></thead><tbody>' + L('carro', 'Carro', '#17896B', '#E8F4EE') + L('van', 'Van', '#4C78A8', '#E7EEF7') + L('caminhao', 'Caminhão', '#B6803B', '#F7EFDF') + defRow + extra + '</tbody></table>' +
      '<div class="rl-faixa m">Agendamentos e divergências</div><div class="rl-duas"><div><h3>' + i0(d.agend.notas) + ' <small>nota(s) agendada(s)</small></h3><p class="rl-var">' + brl(d.agend.valor) + '</p><p>' + i0(d.agend.vol) + ' volumes</p></div><div><h3>' + i0(d.diverg.notas) + ' <small>divergência(s)</small></h3><p class="rl-var">' + brl(d.diverg.valor) + '</p><p>' + i0(d.diverg.vol) + ' volumes</p></div></div>' +
      rod('Valor da operação = todas as notas do dia (inclui agendadas). “A definir” = notas ainda sem veículo. Fonte: ' + d.ops.length + ' operação(ões) guardada(s) em ' + U.dataBR(data) + '.') + '</section>';
    const sub2 = dm(seg) + ' a ' + dm(soma(seg, 6));
    const p2 = '<section class="rl-pag">' + cab('Semana da operação', sub2, '02 / 04') +
      grafSemana(sem, 'vol', v => i0(v), 'Volumes da semana', sub2) + grafSemana(sem, 'valor', v => 'R$ ' + (v / 100 >= 1e6 ? f2(v / 1e8) + ' mi' : i0(v / 100)), 'Valor das cargas da semana', sub2) +
      rod('Cada ponto é um dia de operação com rota criada. Dias sem operação aparecem como “Sem dados”.') + '</section>';
    /* comparativos */
    const sSemana = periodo(val, seg, soma(seg, 6)), sAnt = periodo(val, soma(seg, -7), soma(seg, -1));
    const m0 = data.slice(0, 8) + '01', mAnt = (() => { const dd = dDe(m0); dd.setMonth(dd.getMonth() - 1); return isoD(dd); })(), diaN = +data.slice(8, 10), ultAnt = new Date(dDe(mAnt).getFullYear(), dDe(mAnt).getMonth() + 1, 0).getDate();
    const mesA = periodo(val, m0, data), mesB = periodo(val, mAnt, mAnt.slice(0, 8) + String(Math.min(diaN, ultAnt)).padStart(2, '0'));
    const a0 = data.slice(0, 4) + '-01-01', anoA = periodo(val, a0, data), anoB = periodo(val, (+data.slice(0, 4) - 1) + '-01-01', (+data.slice(0, 4) - 1) + data.slice(4));
    const diaP = { n: 1, notas: d.notas, valor: d.valor, vol: d.vol, paradas: d.paradas };
    const dif = ant ? d.valor - ant.valor : 0, p = ant ? pct(d.valor, ant.valor) : null;
    const dest = ant ? '<div class="rl-dest"><h3>' + (dif >= 0 ? 'Aumento' : 'Queda') + ' de ' + f1(Math.abs(p || 0)) + '% no valor</h3><p>' + brl(d.valor) + ' em ' + U.dataBR(data) + ' contra ' + brl(ant.valor) + ' em ' + U.dataBR(ant.data) + ' (dia de operação anterior), ' + (dif >= 0 ? 'um aumento' : 'uma queda') + ' de ' + brl(Math.abs(dif)) + '.</p></div>' : '<div class="rl-dest"><h3>Primeiro dia do histórico</h3><p>' + (inicio ? 'O histórico começa em ' + U.dataBR(inicio) + ', no dia da primeira rota criada.' : 'Ainda não há rota criada nas operações guardadas.') + ' A partir do próximo dia, o boletim compara com o anterior.</p></div>';
    const comp = (rotulo, bruto) => bruto;
    const p3 = '<section class="rl-pag">' + cab('Comparativos e histórico', titData, '03 / 04') + dest +
      blocoComp('Dia × dia de operação anterior' + (ant ? ' (' + DIA3[dDe(ant.data).getDay()] + ' ' + dm(ant.data) + ')' : ''), diaP, ant ? { n: 1, notas: ant.notas, valor: ant.valor, vol: ant.vol, paradas: ant.paradas } : { n: 0 }, dm(data), ant ? dm(ant.data) : '—') +
      blocoComp('Dia × mesmo dia da semana passada' + (semPas ? ' (' + dm(semPas.data) + ')' : ''), diaP, semPas ? { n: 1, notas: semPas.notas, valor: semPas.valor, vol: semPas.vol, paradas: semPas.paradas } : { n: 0 }, dm(data), semPas ? dm(semPas.data) : '—') +
      blocoComp('Semana × semana anterior', sSemana, sAnt, dm(seg) + '–' + dm(soma(seg, 6)), dm(soma(seg, -7)) + '–' + dm(soma(seg, -1))) +
      rod('Histórico desde ' + (inicio ? U.dataBR(inicio) : '—') + ' (primeira rota criada): ' + val.length + ' dia(s) de operação. Variação = (atual − anterior) ÷ anterior.') + '</section>';
    /* dias de operação mais recentes (histórico diário) */
    const rec = val.filter(x => x.data <= data).slice(-10).reverse();
    const hist = rec.length ? '<div class="rl-faixa az">Últimos dias de operação</div><table class="rl-tab bol-comp"><thead><tr><th>Dia</th><th class="d">Valor</th><th class="d">Notas</th><th class="d">Volumes</th><th class="d">Paradas</th><th class="d">Valor × dia anterior</th></tr></thead><tbody>' + rec.map((x, k) => {
      const pv = val.slice().reverse().find(y => y.data < x.data), dv = pv ? pct(x.valor, pv.valor) : null;
      return '<tr' + (x.data === data ? ' class="bol-hoje"' : '') + '><td>' + DIA3[dDe(x.data).getDay()] + ' ' + dm(x.data) + '</td><td class="d">' + brl(x.valor) + '</td><td class="d">' + i0(x.notas) + '</td><td class="d">' + i0(x.vol) + '</td><td class="d">' + i0(x.paradas) + '</td><td class="d bol-' + (dv == null ? 'z' : dv > 0 ? 'up' : dv < 0 ? 'dn' : 'z') + '">' + (dv == null ? '—' : (dv >= 0 ? '▲ +' : '▼ −') + f1(Math.abs(dv)) + '%') + '</td></tr>';
    }).join('') + '</tbody></table>' : '';
    const p4 = '<section class="rl-pag">' + cab('Mês, ano e histórico diário', titData, '04 / 04') +
      blocoComp('Mês até hoje × mesmo período do mês anterior', mesA, mesB, dm(m0) + '–' + dm(data), dm(mAnt) + '–' + dm(mesB.ate)) +
      blocoComp('Ano até hoje × mesmo período do ano anterior', anoA, anoB, a0.slice(0, 4), String(+a0.slice(0, 4) - 1)) + hist +
      rod('Mês e ano comparam o mesmo número de dias do período anterior. Dias sem operação não entram.') + '</section>';
    return { html: p1 + p2 + p3 + p4, temDados: d.notas > 0, dias: H };
  };

  /* ---------- tela ---------- */
  B.render = async function () {
    const ops = await RT.DB.todos('ops').catch(() => []);
    const H = dias(ops), ctrl = $('#bol-ctrl'), out = $('#bol-saida'); if (!ctrl || !out) return;
    const hoje = isoD(new Date()), lista = H.validos.map(x => x.data);
    if (!B.data || !/^\d{4}-\d{2}-\d{2}$/.test(B.data)) B.data = U.pref.ler('bolData', '') || (lista.includes(hoje) ? hoje : (lista[lista.length - 1] || hoje));
    const i = lista.indexOf(B.data);
    ctrl.innerHTML = '<div class="rl-per"><b>Dia</b><button type="button" class="btn mini" data-bol-ant ' + (lista.length && B.data > lista[0] ? '' : 'disabled') + ' aria-label="Dia de operação anterior">◀</button><input type="date" id="bol-data" value="' + B.data + '" aria-label="Dia do boletim"><button type="button" class="btn mini" data-bol-prox ' + (lista.length && B.data < lista[lista.length - 1] ? '' : 'disabled') + ' aria-label="Próximo dia de operação">▶</button></div>' +
      '<div class="rl-pre"><span>Atalhos:</span><button type="button" class="btn mini" data-bol-hoje>Hoje</button><button type="button" class="btn mini" data-bol-ult>Último dia com dados</button></div>' +
      '<p class="dica" style="margin:0">' + (H.inicio ? 'Histórico desde ' + U.dataBR(H.inicio) + ' (primeira rota criada) · ' + lista.length + ' dia(s) de operação.' : 'Ainda não há rota criada em nenhuma operação guardada.') + '</p>';
    const r = B.montar(ops, B.data);
    out.innerHTML = r.temDados ? r.html : '<div class="vazio-rel"><h2>Sem operação em ' + U.dataBR(B.data) + '</h2><p>Não há notas guardadas nesse dia. Escolha outro dia' + (lista.length ? ' (último com dados: ' + U.dataBR(lista[lista.length - 1]) + ')' : '') + '.</p></div>';
  };
  B.ligar = function () {
    const raiz = $('#rl-boletim'); if (!raiz || raiz.dataset.lig) return; raiz.dataset.lig = '1';
    const ir = async d => { B.data = d; U.pref.gravar('bolData', d); await B.render(); };
    raiz.addEventListener('change', e => { if (e.target.id === 'bol-data' && e.target.value) ir(e.target.value); });
    raiz.addEventListener('click', async e => {
      const ops = await RT.DB.todos('ops').catch(() => []), lista = dias(ops).validos.map(x => x.data);
      if (e.target.closest('[data-bol-ant]')) { const p = [...lista].reverse().find(x => x < B.data); if (p) ir(p); }
      else if (e.target.closest('[data-bol-prox]')) { const p = lista.find(x => x > B.data); if (p) ir(p); }
      else if (e.target.closest('[data-bol-hoje]')) ir(isoD(new Date()));
      else if (e.target.closest('[data-bol-ult]')) { if (lista.length) ir(lista[lista.length - 1]); }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
