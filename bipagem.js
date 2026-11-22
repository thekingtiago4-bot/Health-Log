/* Health Route · bipagem: bipar a nota (chave de 44 dígitos ou número) e ela entra na conferência na hora.
   Nota que não está em nenhum XML carregado vai para o ROMANEIO EXTRA do dia, para ser completada.
   Estados continuam separados: bipada (conferida) ≠ alocada (num veículo) ≠ entregue. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const { N, U } = RT; const { $, esc, toast } = U;
  const S = () => RT.S, A = () => RT.A;
  let aviso = null, ambig = null, pronto = false;
  const m$ = N.fmtMoeda, i$ = N.fmtInt;
  const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dd = () => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };

  function iniciar() {
    if (pronto) return; pronto = true;
    const box = $('#bip-box');
    box.addEventListener('keydown', e => { if (e.target.id === 'bip-in' && e.key === 'Enter') { e.preventDefault(); const v = e.target.value; e.target.value = ''; processar(v); } });
    box.addEventListener('click', e => {
      const t = e.target;
      const am = t.closest('[data-ambig]'); if (am) { const n = ambig && ambig.notas[+am.dataset.ambig]; ambig = null; if (n) marcar(n); else render(); return; }
      const ok = t.closest('[data-extra-ok]'); if (ok) return incluirExtra(ok.dataset.extraOk);
      const rm = t.closest('[data-extra-rm]'); if (rm) return removerExtra(rm.dataset.extraRm);
      const go = t.closest('[data-go]'); if (go) { RT.A.irPara('rotas'); RT.A.abrirCidade(go.dataset.go, { centrar: true }); }
    });
    box.addEventListener('change', e => {
      if (!e.target.matches('[data-ex-cidade]')) return;
      const form = e.target.closest('[data-extra]'), r = N.achaMunicipios(e.target.value, '');
      const uf = form.querySelector('[data-ex-uf]');
      if (r.length === 1) uf.value = r[0].uf; else if (r.length > 1 && !uf.value) uf.placeholder = r.map(x => x.uf).join('/');
    });
  }

  function processar(txt) {
    const itens = N.lerBipe(txt); if (!itens.length) return;
    for (const it of itens) tratar(it);
    render();
  }
  function tratar(it) {
    const o = S().op;
    if (!o) { aviso = { t: 'er', m: 'Abra ou importe uma operação antes de bipar.' }; return; }
    if (it.tipo === 'invalido') { aviso = { t: 'er', m: 'Leitura não reconhecida (' + it.valor.length + ' dígitos). A chave da NF-e tem 44 dígitos e o número da NF tem até 9.' }; return; }
    const achados = N.acharBipe(o, it);
    if (achados.length === 1) return marcar(achados[0], true);
    if (achados.length > 1) { ambig = { notas: achados }; aviso = { t: 'am', m: 'O número ' + Number(it.valor) + ' existe em ' + achados.length + ' notas (remetentes diferentes). Escolha qual é a que você bipou.' }; return; }
    fora(it);
  }
  function marcar(n, semRender) {
    const o = S().op; o.bipes = o.bipes || {};
    if (o.bipes[n.id]) { aviso = { t: 'am', m: 'NF ' + n.nf + ' já foi bipada às ' + hora(o.bipes[n.id].em) + '. Bipe repetido não conta de novo.' }; if (!semRender) render(); return; }
    o.bipes[n.id] = { em: new Date().toISOString() }; o.rev++; A().salvar();
    aviso = { t: 'ok', m: '✓ NF ' + n.nf + ' · ' + n.cliente + ' · ' + n.cidade + '/' + n.uf + ' · ' + i$(n.vol) + ' vol · ' + m$(n.valor) };
    if (!semRender) render();
  }
  function fora(it) {
    const o = S().op; o.extras = o.extras || [];
    const chave = it.tipo === 'chave' ? it.valor : '';
    if (chave && !N.chaveValida(chave)) { aviso = { t: 'er', m: 'Chave inválida (o dígito verificador não confere). Bipe de novo ou confira a etiqueta.' }; return; }
    const info = chave ? N.lerChave(chave) : null, nf = info ? info.nf : String(+it.valor);
    if (o.extras.some(e => (chave ? e.chave === chave : (!e.chave && e.nf === nf)))) { aviso = { t: 'am', m: 'NF ' + nf + ' já está no romaneio extra.' }; return; }
    o.extras.push({ id: 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), chave, nf, cnpj: info ? info.cnpj : '', serie: info ? info.serie : '', em: new Date().toISOString() });
    o.rev++; A().salvar();
    aviso = { t: 'am', m: 'NF ' + nf + ' NÃO está em nenhum XML carregado → foi para o ROMANEIO EXTRA. Complete os dados abaixo para ela entrar nos totais.' };
  }
  async function removerExtra(id) {
    const o = S().op, e = o.extras.find(x => x.id === id); if (!e) return;
    if (!(await U.confirmar('Tirar do romaneio extra?', 'A NF ' + e.nf + ' sai da lista (ela não tinha entrado nos totais).', 'Tirar', true))) return;
    o.extras = o.extras.filter(x => x.id !== id); o.rev++; A().salvar(); render();
  }
  function incluirExtra(id) {
    const o = S().op, e = o.extras.find(x => x.id === id), f = $('[data-extra="' + id + '"]'); if (!e || !f) return;
    const v = s => (f.querySelector('[' + s + ']') || {}).value || '';
    const cliente = v('data-ex-cliente').trim(), cidade = v('data-ex-cidade').trim(), uf = N.norm(v('data-ex-uf'));
    const vol = N.dec(v('data-ex-vol'), 3), valor = N.dec(v('data-ex-valor'), 2), peso = N.dec(v('data-ex-peso') || '0', 4);
    const erro = !cliente ? 'Falta o cliente.' : !cidade ? 'Falta a cidade.' : !/^[A-Z]{2}$/.test(uf) ? 'Falta a UF (2 letras).' : !vol.ok || vol.v <= 0 ? 'Volumes inválidos.' : !valor.ok || valor.v <= 0 ? 'Valor inválido.' : !peso.ok ? 'Peso inválido.' : '';
    if (erro) { toast('⚠ ' + erro); return; }
    const mun = N.municipio(cidade, uf);
    const nota = { id: '', nf: e.nf.padStart(9, '0'), remetente: e.cnpj ? 'EMITENTE ' + e.cnpj : '', doc: '', cliente, cep: N.soDigitos(v('data-ex-cep')), end: v('data-ex-end').trim(), num: v('data-ex-num').trim(), bairro: v('data-ex-bairro').trim(),
      cidade: mun ? mun.nome.toUpperCase() : cidade.toUpperCase(), uf, vol: Math.round(vol.v / 1000), volMil: vol.v, peso: peso.v, valor: valor.v, chave: e.chave, origem: 'ROMANEIO EXTRA ' + dd(), linha: 0, extra: true };
    nota.id = N.idNota(nota);
    if (o.notas.some(n => n.id === nota.id)) { toast('⚠ Essa nota já existe na operação.'); return; }
    o.notas.push(nota); o.extras = o.extras.filter(x => x.id !== id); o.bipes = o.bipes || {}; o.bipes[nota.id] = { em: e.em }; o.rev++;
    A().reindexar(); A().salvar(); A().atualizarTudo();
    aviso = { t: 'ok', m: '✓ NF ' + nota.nf + ' entrou na operação (ROMANEIO EXTRA): ' + nota.cidade + '/' + nota.uf + ' · ' + m$(nota.valor) + '. Já aparece nas pendentes e no mapa.' };
    render();
  }

  function render() {
    iniciar();
    const box = $('#bip-box'), s = S(), o = s.op;
    if (!box) return;
    if (!o) { box.innerHTML = '<p class="sub">Importe os XMLs para começar a bipar.</p>'; return; }
    const bipes = o.bipes || {}, ids = Object.keys(bipes).filter(id => s.idx && s.idx.notaPorId.has(id)), extras = o.extras || [];
    const bn = ids.map(id => s.idx.notaPorId.get(id)), bt = N.somar(bn), tot = s.res.tot;
    const recentes = ids.sort((a, b) => bipes[b].em.localeCompare(bipes[a].em)).slice(0, 15);
    const emFoco = document.activeElement && document.activeElement.id === 'bip-in';
    let h = '<div class="bip-topo"><label class="bip-campo"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>' +
      '<input id="bip-in" autocomplete="off" spellcheck="false" inputmode="numeric" placeholder="Bipe a nota aqui (chave de 44 dígitos ou número da NF) e aperte Enter" aria-label="Bipar nota"></label>' +
      '<div class="bip-cont"><div><b class="bip-ok">' + i$(bn.length) + '</b><small>de ' + i$(tot.notas) + ' notas bipadas</small></div><div><b>' + i$(bt.vol) + '</b><small>volumes</small></div><div><b>' + m$(bt.valor) + '</b><small>valor bipado</small></div><div><b' + (extras.length ? ' style="color:var(--ag)"' : '') + '>' + extras.length + '</b><small>fora do romaneio</small></div></div></div>';
    if (aviso) h += '<div class="bip-aviso ' + aviso.t + '" role="status">' + esc(aviso.m) + '</div>';
    if (ambig) h += '<div class="bip-sec"><h3>Qual é a nota?</h3><table><tbody>' + ambig.notas.map((n, i) => '<tr><td>NF ' + esc(n.nf) + '</td><td>' + esc(n.remetente) + '</td><td>' + esc(n.cliente) + '</td><td>' + esc(n.cidade) + '/' + esc(n.uf) + '</td><td class="dir">' + m$(n.valor) + '</td><td><button class="btn mini pri" data-ambig="' + i + '" type="button">É esta</button></td></tr>').join('') + '</tbody></table></div>';
    /* romaneio extra */
    if (extras.length) {
      h += '<div class="bip-sec"><h3><span>ROMANEIO EXTRA · ' + dd() + ' <small style="font-weight:500;color:var(--mudo)">(notas bipadas que não estão em nenhum XML)</small></span><span class="tag">' + extras.length + '</span></h3>' +
        extras.map(e => '<div class="bip-extra" data-extra="' + esc(e.id) + '"><div><b>NF ' + esc(e.nf) + '</b>' + (e.cnpj ? ' · emitente CNPJ ' + esc(e.cnpj) + (e.serie ? ' · série ' + esc(e.serie) : '') : '') + ' · bipada às ' + hora(e.em) + ' <small style="color:var(--amarTxt)">sem dados: não entra nos totais até completar</small></div>' +
          '<div class="linha"><label>Cliente<input data-ex-cliente style="min-width:230px"></label><label>Cidade<input data-ex-cidade list="bip-cidades" style="width:170px"></label><label>UF<input data-ex-uf maxlength="2" style="width:48px;text-transform:uppercase"></label><label>Endereço<input data-ex-end style="min-width:200px"></label><label>Nº<input data-ex-num style="width:64px"></label><label>Bairro<input data-ex-bairro style="width:130px"></label><label>CEP<input data-ex-cep style="width:92px" inputmode="numeric"></label></div>' +
          '<div class="linha"><label>Volumes<input data-ex-vol inputmode="decimal" style="width:76px"></label><label>Valor da NF (R$)<input data-ex-valor inputmode="decimal" style="width:120px"></label><label>Peso (kg, opcional)<input data-ex-peso inputmode="decimal" style="width:110px"></label><button class="btn mini pri" data-extra-ok="' + esc(e.id) + '" type="button">Incluir na operação</button><button class="btn mini" data-extra-rm="' + esc(e.id) + '" type="button">Tirar da lista</button></div></div>').join('') +
        '<datalist id="bip-cidades">' + (s.idx ? s.idx.lista.map(c => '<option value="' + esc(c.nome) + '">').join('') : '') + '</datalist></div>';
    }
    /* últimas bipadas */
    h += '<div class="bip-sec"><h3><span>Últimas bipadas</span><span class="tag">' + i$(bn.length) + ' no total</span></h3>' + (recentes.length ? '<div style="overflow:auto"><table><thead><tr><th>Hora</th><th>NF</th><th>Cliente</th><th>Cidade</th><th>Parada (endereço)</th><th class="dir">Vol</th><th class="dir">Valor</th><th>Veículo</th></tr></thead><tbody>' +
      recentes.map(id => { const n = s.idx.notaPorId.get(id), car = o.atrib[id] != null ? RT.A.carroPorId(o.atrib[id]) : null;
        return '<tr><td>' + hora(bipes[id].em) + '</td><td>' + esc(n.nf) + '</td><td title="' + esc(n.cliente) + '">' + esc(n.cliente) + '</td><td><a href="#" data-go="' + esc(s.idx.chaveCidadeDaNota.get(id)) + '" style="color:var(--acento)" onclick="return false">' + esc(n.cidade) + '/' + esc(n.uf) + '</a></td><td title="' + esc(n.end + ', ' + n.num) + '">' + esc(n.end) + (n.num && n.num !== '0' ? ', ' + esc(n.num) : '') + '</td><td class="dir">' + i$(n.vol) + '</td><td class="dir">' + m$(n.valor) + '</td><td>' + (car ? '<span class="carro-tag" style="--cor:' + car.cor + '">' + esc(N.nomeCarro(car)) + '</span>' : '<span class="livre-tag">livre</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<p class="dica" style="padding:12px 14px;margin:0">Nenhuma nota bipada ainda nesta operação. O valor, a cidade, a parada e os volumes aparecem aqui assim que você bipar.</p>') + '</div>';
    /* XMLs carregados e conferência por origem */
    const por = new Map();
    for (const n of o.notas) { const x = por.get(n.origem) || { notas: 0, vol: 0, valor: 0, bip: 0 }; x.notas++; x.vol += n.vol; x.valor += n.valor; if (bipes[n.id]) x.bip++; por.set(n.origem, x); }
    h += '<div class="bip-sec"><h3><span>XMLs carregados e conferência por origem</span></h3><div style="overflow:auto"><table><thead><tr><th>Origem</th><th class="dir">Notas</th><th class="dir">Volumes</th><th class="dir">Valor</th><th>Bipadas</th></tr></thead><tbody>' +
      [...por.entries()].sort((a, b) => b[1].notas - a[1].notas).map(([k, x]) => '<tr><td>' + esc(k) + '</td><td class="dir">' + i$(x.notas) + '</td><td class="dir">' + i$(x.vol) + '</td><td class="dir">' + m$(x.valor) + '</td><td><span class="bip-prog"><i style="width:' + Math.round(x.bip / x.notas * 100) + '%"></i></span>' + x.bip + ' / ' + x.notas + '</td></tr>').join('') + '</tbody></table></div></div>' +
      '<p class="dica">Bipada = conferida. Isso é diferente de estar num veículo (alocada) e de entregue. Bipe repetido não soma duas vezes. Leitor de código de barras: aponte para a etiqueta com este campo selecionado — ele digita a chave e dá Enter sozinho.</p>';
    box.innerHTML = h;
    if (emFoco || (!document.activeElement || document.activeElement === document.body)) { const i = $('#bip-in'); if (i && $('#t-importar') && !$('#t-importar').hidden) i.focus(); }
  }
  RT.bip = { render, processar };
})(typeof window !== 'undefined' ? window : globalThis);
