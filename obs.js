/* Health Log. · "Editar informações" (botão direito num cliente ou numa nota) + OBSERVAÇÕES que o app guarda e lembra.
   Observação = texto livre ("Cliente recebe até 14h") ligado ao CLIENTE (doc+CEP+endereço+nº) ou à NOTA. Fica guardada neste aparelho
   (IndexedDB meta `obs`), vale para sempre e avisa toda vez que o cliente/nota estiver na rota do dia: papel 📄 em cima da cidade no mapa,
   faixa amarela dentro da janela da cidade (junto da relação de entregas) e aviso ao abrir a operação.
   Editar volumes, valor, endereço e cidade da nota é correção SUA: o que veio no XML fica guardado e dá para voltar. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {}), N = RT.N, U = RT.U, esc = U.esc;
  const O = RT.obs = { dados: { c: {}, n: {} } };
  const S = () => RT.S, A = () => RT.A;
  const chaveN = n => n.chave || ('nf:' + n.nf + '|' + (n.doc || N.norm(n.cliente)));
  const chaveC = n => N.chaveCliente(n);
  const guardar = () => RT.DB.put('meta', { k: 'obs', v: O.dados }).catch(e => U.toast('⚠ Não consegui guardar a observação: ' + ((e && e.message) || e)));
  O.carregar = async function () {
    try { const r = await RT.DB.get('meta', 'obs'); if (r && r.v) O.dados = { c: Object.assign({}, r.v.c), n: Object.assign({}, r.v.n) }; } catch (e) { /* sem observações guardadas */ }
  };
  const texto = r => (r && typeof r.t === 'string' ? r.t : '');
  O.doCliente = n => texto(O.dados.c[chaveC(n)]);
  O.daNota = n => texto(O.dados.n[chaveN(n)]);
  /* observações que valem para uma cidade na operação aberta: [{ i, cl, c, notas:[{n, t}] }] (i = posição do cliente na cidade) */
  O.deCidade = function (c) {
    const out = [];
    (c.listaClientes || []).forEach((cl, i) => {
      const tc = cl.notas.length ? O.doCliente(cl.notas[0]) : '', notas = cl.notas.map(n => ({ n, t: O.daNota(n) })).filter(x => x.t);
      if (tc || notas.length) out.push({ i, cl, c: tc, notas });
    });
    return out;
  };
  O.contagem = c => { if (!Object.keys(O.dados.c).length && !Object.keys(O.dados.n).length) return 0; return O.deCidade(c).reduce((s, x) => s + (x.c ? 1 : 0) + x.notas.length, 0); };
  O.faixa = function (c) {
    const l = O.deCidade(c); if (!l.length) return '';
    return '<div class="cid-obs" role="note"><b class="co-t">📄 Observações de hoje</b><ul>' + l.map(x =>
      (x.c ? '<li data-obs-ed="' + x.i + '"><b>' + esc(x.cl.nome) + '</b>: ' + esc(x.c) + '</li>' : '') +
      x.notas.map(y => '<li data-obs-ed="' + x.i + '"><b>' + esc(x.cl.nome) + '</b> · NF ' + esc(y.n.nf) + ': ' + esc(y.t) + '</li>').join('')).join('') + '</ul></div>';
  };
  /* aviso ao abrir a operação: quantas observações valem hoje */
  O.avisar = function () {
    const s = S(); if (!s.op || !s.idx) return;
    const achei = []; for (const c of s.idx.cidades.values()) for (const x of O.deCidade(c)) achei.push({ c, x });
    if (!achei.length) return;
    const p = achei[0], t = p.x.c || (p.x.notas[0] && p.x.notas[0].t) || '';
    U.toast('📄 ' + achei.length + ' cliente(s) com observação hoje. ' + p.x.cl.nome + ' (' + p.c.nome + '): ' + t.slice(0, 90), { rotulo: 'Ver', fn: () => A().abrirCidade(p.c.key, { centrar: true }) });
  };

  const brl = v => (v / 100).toFixed(2).replace('.', ',');
  O.editar = function (nid, cliente) {
    const s = S(), o = s.op; if (!o || !s.idx) return;
    const n = o.notas.find(x => x.id === nid); if (!n) return;
    const ck = chaveC(n), kc = s.idx.chaveCidadeDaNota.get(n.id);
    const mesmos = o.notas.filter(x => s.idx.chaveCidadeDaNota.get(x.id) === kc && chaveC(x) === ck);
    const linhas = cliente ? mesmos : [n], outras = mesmos.length - 1;
    const tc = O.doCliente(n), tn = O.daNota(n);
    const html = '<h2>Editar informações</h2><p class="dica" style="margin-top:-6px">' + (cliente ? '<b>' + esc(n.cliente) + '</b>' : 'NF <b>' + esc(n.nf) + '</b> · ' + esc(n.cliente)) + ' · ' + esc(n.cidade) + '/' + esc(n.uf) + '</p>' +
      '<label class="eo-obs"><span>📄 Observação do cliente <small>(fica guardada e avisa sempre que ele estiver na rota)</small></span><textarea data-f="obsC" maxlength="500" rows="3" placeholder="Ex.: Cliente recebe até 14h">' + esc(tc) + '</textarea></label>' +
      (cliente ? '' : '<label class="eo-obs"><span>📄 Observação só desta nota <small>(NF ' + esc(n.nf) + ')</small></span><textarea data-f="obsN" maxlength="500" rows="2" placeholder="Ex.: Entregar junto com a NF anterior">' + esc(tn) + '</textarea></label>') +
      '<div class="eo-grade"><label>Endereço<input data-f="end" value="' + esc(n.end) + '" autocomplete="off"></label><label class="eo-num">Nº<input data-f="num" value="' + esc(n.num) + '" autocomplete="off"></label></div>' +
      '<label class="eo-cid">Cidade <small>(digite para trocar' + (n.cidadeOrig ? '; no XML: ' + esc(n.cidadeOrig.cidade) + '/' + esc(n.cidadeOrig.uf) : '') + ')</small><input data-f="cid" value="" placeholder="' + esc(n.cidade) + '/' + esc(n.uf) + '" autocomplete="off"></label><div class="sug-cid" id="eo-sug"></div>' +
      (n.cidadeOrig ? '<p class="dica" style="margin:0 0 6px">Cidade corrigida por você. <button type="button" class="lib" data-cid-volta="1">voltar à cidade do XML</button></p>' : '') +
      (!cliente && outras ? '<label class="chk-cid"><input type="checkbox" data-f="junto"> Valer também para as outras ' + outras + ' nota(s) deste cliente (endereço e cidade)</label>' : '') +
      '<table class="eo-notas"><thead><tr><th>NF</th><th>Volumes</th><th>Valor (R$)</th><th></th></tr></thead><tbody>' + linhas.map(x =>
        '<tr data-n="' + esc(x.id) + '"><td>' + esc(x.nf) + '</td><td><input data-f="vol" inputmode="numeric" value="' + x.vol + '"></td><td><input data-f="valor" inputmode="decimal" value="' + brl(x.valor) + '"></td><td>' + (x.orig ? '<button type="button" class="lib" data-rest="' + esc(x.id) + '" title="Voltar ao que veio no XML (volumes ' + x.orig.vol + ', valor ' + brl(x.orig.valor) + ')">voltar ao XML</button>' : '') + '</td></tr>').join('') + '</tbody></table>' +
      '<div class="botoes"><button class="btn" data-cancelar type="button">Cancelar</button><button class="btn pri" data-s type="button">Salvar</button></div>';
    return U.modal(html, (f, fechar) => {
      f.querySelector('.modal').classList.add('modal-eo');
      const q = sel => f.querySelector(sel); let codeCid = null;
      const obsC = q('[data-f=obsC]'); obsC.focus(); obsC.setSelectionRange(obsC.value.length, obsC.value.length);
      q('[data-cancelar]').onclick = () => fechar(null);   // (antes pegava a 1ª linha de nota, que também tem data-n, e o Cancelar não fazia nada)
      f.addEventListener('click', e => {
        if (e.target.closest('[data-cid-volta]')) { RT.sit.trocarCidade(n.id, 'orig', cliente); fechar(true); return; }
        const r = e.target.closest('[data-rest]'); if (r) { const x = o.notas.find(z => z.id === r.dataset.rest), tr = r.closest('tr'); if (x && x.orig) { tr.querySelector('[data-f=vol]').value = x.orig.vol; tr.querySelector('[data-f=valor]').value = brl(x.orig.valor); } return; }
        const sg = e.target.closest('.sug-i'); if (sg) { codeCid = sg.dataset.cid; q('[data-f=cid]').value = sg.firstChild.textContent + '/' + sg.querySelector('span').textContent; q('#eo-sug').innerHTML = ''; }
      });
      q('[data-f=cid]').addEventListener('input', e => {
        codeCid = null; const r = RT.sit.sugerirCidades(e.target.value), box = q('#eo-sug');
        box.innerHTML = r.length ? r.map(([, code, m]) => '<button type="button" class="sug-i" data-cid="' + code + '">' + esc(m[0]) + '<span>' + esc(m[1]) + '</span></button>').join('') : (e.target.value.trim().length >= 2 ? '<p class="dica">Nenhuma cidade com esse nome.</p>' : '');
      });
      q('[data-s]').onclick = () => {
        /* confere tudo antes de gravar */
        const mud = [];
        for (const tr of f.querySelectorAll('.eo-notas tbody tr')) {
          const x = o.notas.find(z => z.id === tr.dataset.n), vt = tr.querySelector('[data-f=vol]').value.trim(), dt = tr.querySelector('[data-f=valor]').value.trim();
          if (!/^\d{1,6}$/.test(vt)) { U.toast('Volumes da NF ' + x.nf + ': use só números inteiros.'); return; }
          const d = N.dec(dt, 2); if (!d.ok || d.v < 0) { U.toast('Valor da NF ' + x.nf + ' ilegível. Ex.: 1.234,56'); return; }
          mud.push({ x, vol: +vt, valor: d.v });
        }
        if (/\S/.test(q('[data-f=cid]').value) && !codeCid) { U.toast('Escolha a cidade na lista que aparece embaixo do campo.'); return; }
        const end = q('[data-f=end]').value.trim(), num = q('[data-f=num]').value.trim(), junto = cliente || !!(q('[data-f=junto]') && q('[data-f=junto]').checked);
        const tC = obsC.value.trim().slice(0, 500), tN = q('[data-f=obsN]') ? q('[data-f=obsN]').value.trim().slice(0, 500) : null;
        const alvoEnd = junto ? mesmos : [n], velhaC = chaveC(n);
        const mudou = mud.some(m => m.vol !== m.x.vol || m.valor !== m.x.valor) || end !== n.end || num !== n.num;
        const gravaObs = () => {
          const nova = chaveC(n);
          if (velhaC !== nova) delete O.dados.c[velhaC];
          if (tC) O.dados.c[nova] = { t: tC, em: Date.now() }; else delete O.dados.c[nova];
          if (tN !== null) { const kn = chaveN(n); if (tN) O.dados.n[kn] = { t: tN, em: Date.now() }; else delete O.dados.n[kn]; }
          guardar();
        };
        if (mudou) {
          A().mutar('editar informações' + (cliente ? ' do cliente' : ' da NF ' + n.nf), () => {
            for (const m of mud) {
              if (m.vol !== m.x.vol) { m.x.orig = m.x.orig || {}; if (m.x.orig.vol == null) { m.x.orig.vol = m.x.vol; m.x.orig.volMil = m.x.volMil; } m.x.vol = m.vol; m.x.volMil = m.vol * 1000; }
              if (m.valor !== m.x.valor) { m.x.orig = m.x.orig || {}; if (m.x.orig.valor == null) m.x.orig.valor = m.x.valor; m.x.valor = m.valor; }
              if (m.x.orig && m.x.orig.vol === m.x.vol && (m.x.orig.valor == null || m.x.orig.valor === m.x.valor)) delete m.x.orig;   // voltou ao XML
            }
            if (end !== n.end || num !== n.num) for (const x of alvoEnd) { x.origEnd = x.origEnd || { end: x.end, num: x.num }; x.end = end; x.num = num; if (x.origEnd.end === x.end && x.origEnd.num === x.num) delete x.origEnd; }
          });
        }
        gravaObs();
        if (codeCid) RT.sit.trocarCidade(n.id, codeCid, junto);
        else { A().atualizarTudo(); U.toast(mudou || tC || tN ? 'Informações salvas.' : 'Nada mudou.'); }
        fechar(true);
      };
    });
  };
  RT.obsAbrir = O.editar;
})(typeof window !== 'undefined' ? window : globalThis);
