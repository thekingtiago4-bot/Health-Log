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

  async function guardados(opId) { try { return (await RT.DB.todos('meta')).filter(x => x.k && x.k.startsWith(PREF) && (!opId || x.v.opId === opId)).map(x => x.v).sort((a, b) => b.quando.localeCompare(a.quando)); } catch (e) { return []; } }

  async function abrir() {
    const s = S(); if (!s.op || !s.res) { toast('Abra ou importe uma operação primeiro.'); return; }
    const f = fotografar(), antes = await guardados(s.op.id);
    const html = '<h2>Final de Turno</h2><pre class="turno-txt" id="turno-txt">' + esc(texto(f)) + '</pre>' +
      '<p class="dica" id="turno-st">' + (antes.length ? 'Esta operação já tem ' + antes.length + ' final(is) de turno guardado(s); o último foi em ' + new Date(antes[0].quando).toLocaleString('pt-BR') + '.' : 'Nada guardado ainda para esta operação.') + ' Ao guardar, fica uma cópia de segurança da operação e os números do dia para os relatórios.</p>' +
      '<div class="botoes"><button class="btn" data-a="x">Fechar</button><button class="btn" data-a="h">Ver guardados (' + antes.length + ')</button><button class="btn" data-a="c">Copiar</button><button class="btn" data-a="w">WhatsApp</button><button class="btn pri" data-a="g" id="turno-g">Guardar final de turno</button></div>';
    return U.modal(html, (fm, fechar) => {
      let guardou = null;
      fm.querySelector('.modal').style.maxWidth = '600px';
      fm.addEventListener('click', async e => {
        const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, txt = guardou ? texto(guardou) : texto(f);
        if (a === 'x') fechar(true);
        if (a === 'c') { try { await navigator.clipboard.writeText(txt); toast('Resumo copiado.'); } catch (er) { toast('Não consegui copiar. Selecione o texto e use Ctrl+C.'); } }
        if (a === 'w') window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener,noreferrer');
        if (a === 'h') {
          const l = await guardados(); fm.querySelector('#turno-txt').textContent = l.length ? l.map(x => '• ' + new Date(x.quando).toLocaleString('pt-BR') + ' · ' + x.opNome + ' · ' + i$(x.totais.notas) + ' notas · ' + m$(x.totais.valor) + ' · alocadas ' + x.pctAloc + '%').join('\n') : 'Nenhum final de turno guardado ainda.';
        }
        if (a === 'g') {
          if (guardou) { toast('Este final de turno já foi guardado.'); return; }
          const novo = fotografar(); if (!(await A().backup(s.op, 'Final de turno'))) return;
          try { await RT.DB.put('meta', { k: novo.k, v: novo }); guardou = novo; fm.querySelector('#turno-txt').textContent = texto(novo); b.disabled = true; b.textContent = '✓ Guardado'; fm.querySelector('#turno-st').textContent = 'Final de turno guardado às ' + new Date(novo.quando).toLocaleTimeString('pt-BR').slice(0, 5) + ' e cópia de segurança feita.'; }
          catch (er) { toast('⚠ Não consegui guardar o final de turno: ' + ((er && er.message) || er)); }
        }
      });
    });
  }
  RT.turno = { abrir, fotografar, texto, guardados };
  document.addEventListener('DOMContentLoaded', () => { const b = document.getElementById('bt-turno'); if (b) b.addEventListener('click', abrir); });
  if (document.readyState !== 'loading') { const b = document.getElementById('bt-turno'); if (b) b.addEventListener('click', abrir); }
})(typeof window !== 'undefined' ? window : globalThis);
