/* Health Route · Final de Turno: resumo do dia + registro guardado neste aparelho (meta "turno:<op>:<data-hora>")
   para os relatórios futuros. Não mexe na operação; só lê e guarda uma fotografia do momento. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const { N, U } = RT; const { esc, toast } = U;
  const S = () => RT.S, A = () => RT.A, m$ = N.fmtMoeda, i$ = N.fmtInt;
  const PREF = 'turno:';

  /* fotografia do momento: só números e nomes de cidade/veículo (sem CPF, sem endereço de cliente) */
  function fotografar() {
    const s = S(), o = s.op, r = s.res; if (!o || !r) return null;
    const bip = o.bipes || {}, naRota = new Set();
    for (const c of r.cidades) if (!c.fora) for (const n of c.cidade.notas) naRota.add(n.id);
    const bipadas = [...naRota].filter(id => bip[id]).length;
    const alocNaoBip = o.notas.filter(n => o.atrib[n.id] != null && !bip[n.id]).length;
    const carros = r.carros.map(rc => {
      const km = A().kmDe(rc.carro);
      return { nome: N.nomeCarro(rc.carro), motorista: rc.carro.motorista || '', notas: rc.notas, vol: rc.vol, peso: rc.peso, valor: rc.valor, paradas: rc.paradas,
        cidades: rc.cidades.map(c => c.nome + '/' + c.uf), km: km.n && !km.faltam ? Math.round(km.km * 10) / 10 : null };
    }).filter(c => c.notas || c.cidades.length);
    const pendentes = r.cidades.filter(c => !c.fora && c.livres.notas).map(c => ({ cidade: c.cidade.nome + '/' + c.cidade.uf, notas: c.livres.notas, vol: c.livres.vol, valor: c.livres.valor }))
      .sort((a, b) => b.valor - a.valor);
    const quando = new Date().toISOString();
    return {
      k: PREF + o.id + ':' + quando, tipo: 'final-de-turno', quando, opId: o.id, opNome: o.nome, opData: o.data, rev: o.rev,
      totais: { notas: r.tot.notas, vol: r.tot.vol, peso: r.tot.peso, valor: r.tot.valor, paradas: N.paradasTotais(o, s.idx) },
      rota: r.rota, alocadas: r.alocRota, fora: r.fora, pctAloc: r.pctAloc,
      agendamentos: r.ret.agendamento, divergencias: r.ret.divergencia,
      bipagem: { bipadas, alocadasSemBipar: alocNaoBip, extras: (o.extras || []).length },
      cidades: { pendentes: r.cont.pendente, parciais: r.cont.parcial, completas: r.cont.completa },
      carros, pendentes, origens: [...r.origens].map(([nome, v]) => ({ nome, notas: v.notas, vol: v.vol, valor: v.valor }))
    };
  }

  function texto(f) {
    const d = new Date(f.quando), hora = d.toLocaleTimeString('pt-BR').slice(0, 5);
    const L = ['*Final de turno · ' + U.dataBR(f.opData) + ' ' + hora + '*', f.opNome, '',
      'Notas: ' + i$(f.totais.notas) + ' · Volumes: ' + i$(f.totais.vol) + ' · ' + m$(f.totais.valor),
      'Na rota: ' + i$(f.rota.notas) + ' notas · alocadas em veículos: ' + i$(f.alocadas.notas) + ' (' + f.pctAloc + '%)',
      'Cidades: ' + f.cidades.completas + ' completas · ' + f.cidades.parciais + ' parciais · ' + f.cidades.pendentes + ' pendentes',
      'Bipadas: ' + i$(f.bipagem.bipadas) + ' · alocadas sem bipar: ' + i$(f.bipagem.alocadasSemBipar) + (f.bipagem.extras ? ' · Romaneio Extra: ' + f.bipagem.extras : ''),
      'Agendamentos: ' + f.agendamentos + ' · Divergências: ' + f.divergencias + ' · Fora de rota: ' + i$(f.fora.notas) + ' notas', '', '*Veículos*'];
    if (!f.carros.length) L.push('Nenhum veículo montado.');
    for (const c of f.carros) L.push('• ' + c.nome + (c.motorista ? ' (' + c.motorista + ')' : '') + ': ' + i$(c.notas) + ' notas · ' + i$(c.vol) + ' vol · ' + m$(c.valor) + ' · ' + c.paradas + ' paradas' + (c.km != null ? ' · ≈ ' + Math.round(c.km) + ' km' : ''));
    if (f.pendentes.length) { L.push('', '*Ficou pendente (' + f.pendentes.length + ' cidades)*'); f.pendentes.slice(0, 20).forEach(p => L.push('• ' + p.cidade + ': ' + p.notas + ' notas · ' + i$(p.vol) + ' vol · ' + m$(p.valor))); if (f.pendentes.length > 20) L.push('… e mais ' + (f.pendentes.length - 20)); }
    return L.join('\n');
  }

  /* resumo na tela: cartões, chips e tabelas no visual do app (o TEXTO para copiar/WhatsApp continua sendo texto()) */
  function htmlResumo(f) {
    const d = new Date(f.quando), hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const kpi = (r, v, cls) => '<div class="tr-k ' + (cls || '') + '"><small>' + r + '</small><b>' + v + '</b></div>';
    const chip = (ic, r, v, cls) => '<span class="tr-chip ' + (cls || '') + '"><i>' + ic + '</i>' + r + ' <b>' + v + '</b></span>';
    const car = f.carros.length ? '<table class="tr-tab"><thead><tr><th>Veículo</th><th class="d">Notas</th><th class="d">Volumes</th><th class="d">Paradas</th><th class="d">Valor</th><th class="d">KM</th></tr></thead><tbody>' +
      f.carros.map(c => '<tr><td><b>' + esc(c.nome) + '</b>' + (c.motorista ? '<small>' + esc(c.motorista) + '</small>' : '') + '</td><td class="d">' + i$(c.notas) + '</td><td class="d">' + i$(c.vol) + '</td><td class="d">' + c.paradas + '</td><td class="d">' + m$(c.valor) + '</td><td class="d">' + (c.km != null ? '≈ ' + Math.round(c.km).toLocaleString('pt-BR') : '—') + '</td></tr>').join('') + '</tbody></table>' : '<p class="tr-vazio">Nenhum veículo montado.</p>';
    const pend = f.pendentes.length ? '<table class="tr-tab"><thead><tr><th>Cidade</th><th class="d">Notas</th><th class="d">Volumes</th><th class="d">Valor</th></tr></thead><tbody>' +
      f.pendentes.slice(0, 20).map(p => '<tr><td>' + esc(p.cidade) + '</td><td class="d">' + p.notas + '</td><td class="d">' + i$(p.vol) + '</td><td class="d">' + m$(p.valor) + '</td></tr>').join('') + '</tbody></table>' + (f.pendentes.length > 20 ? '<p class="tr-vazio">e mais ' + (f.pendentes.length - 20) + ' cidade(s)…</p>' : '') : '<p class="tr-ok">✔ Nada pendente: todas as cidades em rota têm todas as notas em veículo.</p>';
    return '<div class="tr-tit"><b>Final de turno</b><span>' + U.dataBR(f.opData) + ' · ' + hora + ' · ' + esc(f.opNome) + '</span></div>' +
      '<div class="tr-kpis">' + kpi('Notas', i$(f.totais.notas)) + kpi('Volumes', i$(f.totais.vol)) + kpi('Valor', m$(f.totais.valor), 'dest') + '<div class="tr-k"><small>Alocadas em veículos</small><b>' + f.pctAloc + '%</b><i class="tr-barra"><u style="width:' + Math.min(100, f.pctAloc) + '%"></u></i><em>' + i$(f.alocadas.notas) + ' de ' + i$(f.rota.notas) + ' notas da rota</em></div></div>' +
      '<div class="tr-chips">' + chip('✔', 'completas', f.cidades.completas, 'ok') + chip('◐', 'parciais', f.cidades.parciais, 'am') + chip('○', 'pendentes', f.cidades.pendentes, f.cidades.pendentes ? 'er' : 'ok') + '</div>' +
      '<div class="tr-chips">' + chip('▮', 'Bipadas', f.bipagem.bipadas) + chip('!', 'alocadas sem bipar', f.bipagem.alocadasSemBipar, f.bipagem.alocadasSemBipar ? 'am' : '') + (f.bipagem.extras ? chip('+', 'Romaneio Extra', f.bipagem.extras) : '') + chip('A', 'Agendamentos', f.agendamentos) + chip('⚠', 'Divergências', f.divergencias, f.divergencias ? 'er' : '') + chip('⛔', 'Fora de rota', i$(f.fora.notas) + ' notas') + '</div>' +
      '<h4>Veículos</h4>' + car + '<h4>Ficou pendente (' + f.pendentes.length + ' cidade' + (f.pendentes.length === 1 ? '' : 's') + ')</h4>' + pend;
  }
  function htmlGuardados(l) {
    if (!l.length) return '<p class="tr-vazio">Nenhum final de turno guardado ainda.</p>';
    return '<div class="tr-tit"><b>Finais de turno guardados</b><span>' + l.length + ' registro(s)</span></div><table class="tr-tab"><thead><tr><th>Quando</th><th>Operação</th><th class="d">Notas</th><th class="d">Valor</th><th class="d">Alocadas</th></tr></thead><tbody>' +
      l.map(x => '<tr><td>' + esc(new Date(x.quando).toLocaleString('pt-BR')) + '</td><td>' + esc(x.opNome) + '</td><td class="d">' + i$(x.totais.notas) + '</td><td class="d">' + m$(x.totais.valor) + '</td><td class="d">' + x.pctAloc + '%</td></tr>').join('') + '</tbody></table>';
  }

  async function guardados(opId) { try { return (await RT.DB.todos('meta')).filter(x => x.k && x.k.startsWith(PREF) && (!opId || x.v.opId === opId)).map(x => x.v).sort((a, b) => b.quando.localeCompare(a.quando)); } catch (e) { return []; } }

  async function abrir() {
    const s = S(); if (!s.op || !s.res) { toast('Abra ou importe uma operação primeiro.'); return; }
    const f = fotografar(), antes = await guardados(s.op.id);
    const html = '<div class="doc-logo"><img src="icons/healthlog.png" alt="Health Log"></div><div class="tr-doc" id="turno-txt">' + htmlResumo(f) + '</div>' +
      '<p class="dica" id="turno-st">' + (antes.length ? 'Esta operação já tem ' + antes.length + ' final(is) de turno guardado(s); o último foi em ' + new Date(antes[0].quando).toLocaleString('pt-BR') + '.' : 'Nada guardado ainda para esta operação.') + ' Ao guardar, ficam a cópia de segurança e os números do dia para os relatórios, e o mapa e os XMLs são limpos para a próxima operação.</p>' +
      '<div class="botoes tr-bot"><div class="tr-bl"><button class="btn" data-a="c">Copiar</button><button class="btn" data-a="w">WhatsApp</button></div><div class="tr-bm"><button class="btn pri" data-a="g" id="turno-g">Guardar final de turno</button></div><div class="tr-br"><button class="btn" data-a="h">Ver guardados (' + antes.length + ')</button><button class="btn" data-a="x">Fechar</button></div></div>';
    return U.modal(html, (fm, fechar) => {
      let guardou = null;
      fm.querySelector('.modal').style.maxWidth = '680px';
      fm.addEventListener('click', async e => {
        const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, txt = guardou ? texto(guardou) : texto(f);
        if (a === 'x') fechar(true);
        if (a === 'c') { try { await navigator.clipboard.writeText(txt); toast('Resumo copiado.'); } catch (er) { toast('Não consegui copiar. Selecione o texto e use Ctrl+C.'); } }
        if (a === 'w') window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener,noreferrer');
        if (a === 'h') {
          const l = await guardados(); fm.querySelector('#turno-txt').innerHTML = htmlGuardados(l);
        }
        if (a === 'g') {
          if (guardou) { toast('Este final de turno já foi guardado.'); return; }
          const ok = await U.confirmar('Guardar o turno e começar uma nova operação?', 'Os números do dia ficam guardados para os Relatórios e a operação (XMLs, notas, veículos) fica salva em “Operações guardadas”. Em seguida o mapa e os XMLs são LIMPOS, para você importar a próxima operação. Uma cópia de segurança é feita antes.', 'Guardar e começar nova');
          if (!ok) return;
          const novo = fotografar(); if (!(await A().backup(s.op, 'Final de turno'))) return;
          try {
            await RT.DB.put('meta', { k: novo.k, v: novo }); guardou = novo; b.disabled = true;
            await A().encerrarOperacao(); fechar(true);
            toast('✔ Turno guardado (' + new Date(novo.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '). A operação ficou nos Relatórios e a tela está limpa: importe os XMLs da próxima.');
          } catch (er) { toast('⚠ Não consegui guardar o final de turno: ' + ((er && er.message) || er)); b.disabled = false; }
        }
      });
    });
  }
  RT.turno = { abrir, fotografar, texto, guardados };
  document.addEventListener('DOMContentLoaded', () => { const b = document.getElementById('bt-turno'); if (b) b.addEventListener('click', abrir); });
  if (document.readyState !== 'loading') { const b = document.getElementById('bt-turno'); if (b) b.addEventListener('click', abrir); }
})(typeof window !== 'undefined' ? window : globalThis);
