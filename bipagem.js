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
      const go = t.closest('[data-go]'); if (go) { e.preventDefault(); RT.A.irPara('rotas'); RT.A.abrirCidade(go.dataset.go, { centrar: true }); }
    });
    box.addEventListener('change', e => {
      if (!e.target.matches('[data-ex-cidade]')) return;
      const form = e.target.closest('[data-extra]'), r = N.achaMunicipios(e.target.value, '');
      const uf = form.querySelector('[data-ex-uf]');
      if (r.length === 1) uf.value = r[0].uf; else if (r.length > 1 && !uf.value) uf.placeholder = r.map(x => x.uf).join('/');
    });
  }


  /* ---------- Meu Danfe (API v2): só para nota que NÃO está nos XMLs carregados ---------- */
  const MD = 'https://api.meudanfe.com.br/v2';
  const espera = ms => new Promise(r => setTimeout(r, ms));
  function erroHttp(status) {
    return status === 401 || status === 403 ? 'O Meu Danfe recusou a Api-Key (confira em Configurações).' : status === 402 ? 'O Meu Danfe disse que a consulta não foi liberada (saldo ou plano).' :
      status === 429 ? 'Muitas consultas seguidas no Meu Danfe. Espere alguns segundos e bipe de novo.' : status === 400 ? 'O Meu Danfe recusou a chave (confira se foi bipada inteira).' : 'O Meu Danfe respondeu erro ' + status + '.';
  }
  async function consultarMeuDanfe(chave) {
    const key = S().apiKey; if (!key) return { semChave: true };
    const h = { 'Api-Key': key, Accept: 'application/json' };
    const chamar = async (metodo, caminho) => { try { return await fetch(MD + caminho, { method: metodo, headers: h, redirect: 'error' }); } catch (e) { return { falhaRede: true }; } };
    let r = await chamar('GET', '/fd/get/xml/' + chave);
    if (r.falhaRede) return { erro: navigator.onLine === false ? 'Sem internet agora — não dá para consultar o Meu Danfe.' : 'Não consegui falar com o Meu Danfe (api.meudanfe.com.br). Pode ser a internet ou a rede bloqueando o endereço.' };
    if (r.status === 404) { // só 404 autoriza pedir a nota ao Meu Danfe; depois consulta o andamento sem pressa (>1 s)
      let ok = false;
      for (let i = 0; i < 10 && !ok; i++) {
        const p = await chamar('PUT', '/fd/add/' + chave);
        if (p.falhaRede) return { erro: 'Falha de conexão com o Meu Danfe.' };
        if (!p.ok) return { erro: erroHttp(p.status) };
        let st = ''; try { st = String((await p.json()).status || '').toUpperCase(); } catch (e) { /* segue */ }
        if (st === 'OK') ok = true; else if (st === 'WAITING' || st === 'SEARCHING' || st === '') await espera(1600); else return { erro: 'O Meu Danfe respondeu "' + st + '" para essa nota.' };
      }
      if (!ok) return { erro: 'O Meu Danfe ainda está buscando essa nota. Bipe de novo em instantes.' };
      r = await chamar('GET', '/fd/get/xml/' + chave);
      if (r.falhaRede) return { erro: 'Falha de conexão com o Meu Danfe.' };
    }
    if (!r.ok) return { erro: r.status === 404 ? 'Nota não encontrada no Meu Danfe.' : erroHttp(r.status) };
    let j; try { j = await r.json(); } catch (e) { return { erro: 'Resposta do Meu Danfe ilegível.' }; }
    if (!j || j.type !== 'NFE' || j.format !== 'XML' || typeof j.data !== 'string') return { erro: 'O Meu Danfe não devolveu o XML da NF-e.' };
    const d = N.lerNFe(j.data);
    if (d.erro) return { erro: d.erro };
    if (d.chave !== chave) return { erro: 'O XML recebido é de outra nota (a chave não confere). Não foi usado.' };
    return { dados: d };
  }
  function notaDeNFe(d, volMil) {
    const mun = d.cMun ? N.municipioPorCodigo(d.cMun) : null, cidade = mun ? mun.nome : d.cidade, uf = mun ? mun.uf : N.norm(d.uf);
    const n = { id: '', nf: d.nf.padStart(9, '0'), remetente: d.emitNome ? d.emitNome : 'EMITENTE ' + d.emitCnpj, doc: N.soDigitos(d.doc), cliente: d.cliente || '(sem nome no XML)', cep: N.soDigitos(d.cep),
      end: d.end + (d.compl ? ' ' + d.compl : ''), num: d.num, bairro: d.bairro, cidade: N.norm(cidade), uf, vol: Math.round(volMil / 1000), volMil, peso: d.peso, valor: d.valor, chave: d.chave, origem: 'ROMANEIO EXTRA ' + dd(), linha: 0, extra: true, viaMeuDanfe: true };
    n.id = N.idNota(n); return n;
  }

  let fila = Promise.resolve();
  const processar = txt => (fila = fila.then(() => processarUm(txt)).catch(e => { aviso = { t: 'er', m: 'Erro ao bipar: ' + ((e && e.message) || e) }; render(); }));
  async function processarUm(txt) {
    const itens = N.lerBipe(txt); if (!itens.length) return;
    for (const it of itens) await tratar(it);
    render();
  }
  async function tratar(it) {
    const o = S().op;
    if (!o) { aviso = { t: 'er', m: 'Abra ou importe uma operação antes de bipar.' }; return; }
    if (it.tipo === 'invalido') { aviso = { t: 'er', m: 'Leitura não reconhecida (' + it.valor.length + ' dígitos). A chave da NF-e tem 44 dígitos e o número da NF tem até 9.' }; return; }
    const achados = N.acharBipe(o, it);
    if (achados.length === 1) return marcar(achados[0], true);
    if (achados.length > 1) { ambig = { notas: achados }; aviso = { t: 'am', m: 'O número ' + Number(it.valor) + ' existe em ' + achados.length + ' notas (remetentes diferentes). Escolha qual é a que você bipou.' }; return; }
    await fora(it);
  }
  function marcar(n, semRender) {
    const o = S().op; o.bipes = o.bipes || {};
    if (o.bipes[n.id]) { aviso = { t: 'am', m: 'NF ' + n.nf + ' já foi bipada às ' + hora(o.bipes[n.id].em) + '. Bipe repetido não conta de novo.' }; if (!semRender) render(); return; }
    o.bipes[n.id] = { em: new Date().toISOString() }; o.rev++; A().salvar();
    const sit = (o.status || {})[n.id];
    aviso = sit ? { t: 'am', m: '✓ NF ' + n.nf + ' bipada — mas está como ' + (sit.tipo === 'agendamento' ? 'AGENDAMENTO' : 'DIVERGÊNCIA') + ' e fora da rota. ' + n.cliente + ' · ' + n.cidade + '/' + n.uf } : { t: 'ok', m: '✓ NF ' + n.nf + ' · ' + n.cliente + ' · ' + n.cidade + '/' + n.uf + ' · ' + i$(n.vol) + ' vol · ' + m$(n.valor) };
    if (!semRender) render();
  }
  async function fora(it) {
    const o = S().op; o.extras = o.extras || [];
    const chave = it.tipo === 'chave' ? it.valor : '';
    if (chave && !N.chaveValida(chave)) { aviso = { t: 'er', m: 'Chave inválida (o dígito verificador não confere). Bipe de novo ou confira a etiqueta.' }; return; }
    const info = chave ? N.lerChave(chave) : null, nf = info ? info.nf : String(+it.valor);
    if (o.extras.some(e => (chave ? e.chave === chave : (!e.chave && e.nf === nf)))) { aviso = { t: 'am', m: 'NF ' + nf + ' já está no romaneio extra.' }; return; }
    let motivo = '';
    if (chave && S().apiKey) { // o Meu Danfe traz os dados da nota
      aviso = { t: 'am', m: '🔎 NF ' + nf + ' não está nos XMLs — buscando no Meu Danfe…' }; render();
      const r = await consultarMeuDanfe(chave);
      if (r.dados) {
        const d = r.dados;
        if (d.valor != null && d.valor > 0 && d.volMil && d.cidade) {
          const nota = notaDeNFe(d, d.volMil);
          if (o.notas.some(x => x.id === nota.id)) { aviso = { t: 'am', m: 'NF ' + nota.nf + ' já existe na operação.' }; return; }
          o.notas.push(nota); o.bipes = o.bipes || {}; o.bipes[nota.id] = { em: new Date().toISOString() }; o.rev++;
          A().reindexar(); A().salvar(); A().atualizarTudo();
          aviso = { t: 'ok', m: '✓ NF ' + nota.nf + ' veio do Meu Danfe e entrou na operação (ROMANEIO EXTRA): ' + nota.cliente + ' · ' + nota.cidade + '/' + nota.uf + ' · ' + i$(nota.vol) + ' vol · ' + m$(nota.valor) };
          return;
        }
        /* o XML veio, mas sem volumes (ou sem algo essencial): guarda o que veio e pede só o que falta */
        o.extras.push({ id: 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), chave, nf, cnpj: info ? info.cnpj : '', serie: info ? info.serie : '', em: new Date().toISOString(), dados: d });
        o.rev++; A().salvar();
        aviso = { t: 'am', m: 'NF ' + nf + ' veio do Meu Danfe' + (d.volMil ? '' : ' SEM VOLUMES no XML') + '. Complete o que falta abaixo para ela entrar nos totais.' }; return;
      }
      motivo = r.erro || '';
    }
    o.extras.push({ id: 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), chave, nf, cnpj: info ? info.cnpj : '', serie: info ? info.serie : '', em: new Date().toISOString() });
    o.rev++; A().salvar();
    aviso = { t: 'am', m: 'NF ' + nf + ' NÃO está em nenhum XML carregado → foi para o ROMANEIO EXTRA. ' + (motivo ? motivo + ' ' : (chave && !S().apiKey ? 'Para os dados virem sozinhos, coloque a Api-Key do Meu Danfe em Configurações. ' : '')) + 'Complete os dados abaixo para ela entrar nos totais.' };
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
        extras.map(e => '<div class="bip-extra" data-extra="' + esc(e.id) + '"><div><b>NF ' + esc(e.nf) + '</b>' + (e.dados ? ' <span class="tag">dados do Meu Danfe</span>' : '') + (e.cnpj ? ' · emitente CNPJ ' + esc(e.cnpj) + (e.serie ? ' · série ' + esc(e.serie) : '') : '') + ' · bipada às ' + hora(e.em) + ' <small style="color:var(--amarTxt)">' + (e.dados ? (e.dados.volMil ? 'confira e inclua' : 'sem volumes no XML: informe os volumes') : 'sem dados') + ' — não entra nos totais até completar</small></div>' +
          '<div class="linha"><label>Cliente<input data-ex-cliente style="min-width:230px" value="' + esc((e.dados || {}).cliente || '') + '"></label><label>Cidade<input data-ex-cidade list="bip-cidades" style="width:170px" value="' + esc((e.dados || {}).cidade || '') + '"></label><label>UF<input data-ex-uf maxlength="2" style="width:48px;text-transform:uppercase" value="' + esc((e.dados || {}).uf || '') + '"></label><label>Endereço<input data-ex-end style="min-width:200px" value="' + esc((e.dados || {}).end || '') + '"></label><label>Nº<input data-ex-num style="width:64px" value="' + esc((e.dados || {}).num || '') + '"></label><label>Bairro<input data-ex-bairro style="width:130px" value="' + esc((e.dados || {}).bairro || '') + '"></label><label>CEP<input data-ex-cep style="width:92px" inputmode="numeric" value="' + esc((e.dados || {}).cep || '') + '"></label></div>' +
          '<div class="linha"><label>Volumes<input data-ex-vol inputmode="decimal" style="width:76px" value="' + ((e.dados || {}).volMil ? (e.dados.volMil / 1000) : '') + '"></label><label>Valor da NF (R$)<input data-ex-valor inputmode="decimal" style="width:120px" value="' + ((e.dados || {}).valor != null ? (e.dados.valor / 100).toFixed(2).replace('.', ',') : '') + '"></label><label>Peso (kg, opcional)<input data-ex-peso inputmode="decimal" style="width:110px"></label><button class="btn mini pri" data-extra-ok="' + esc(e.id) + '" type="button">Incluir na operação</button><button class="btn mini" data-extra-rm="' + esc(e.id) + '" type="button">Tirar da lista</button></div></div>').join('') +
        '<datalist id="bip-cidades">' + (s.idx ? s.idx.lista.map(c => '<option value="' + esc(c.nome) + '">').join('') : '') + '</datalist></div>';
    }
    /* últimas bipadas */
    h += '<div class="bip-sec"><h3><span>Últimas bipadas</span><span class="tag">' + i$(bn.length) + ' no total</span></h3>' + (recentes.length ? '<div style="overflow:auto"><table><thead><tr><th>Hora</th><th>NF</th><th>Cliente</th><th>Cidade</th><th>Parada (endereço)</th><th class="dir">Vol</th><th class="dir">Valor</th><th>Veículo</th></tr></thead><tbody>' +
      recentes.map(id => { const n = s.idx.notaPorId.get(id), car = o.atrib[id] != null ? RT.A.carroPorId(o.atrib[id]) : null;
        return '<tr><td>' + hora(bipes[id].em) + '</td><td>' + esc(n.nf) + '</td><td title="' + esc(n.cliente) + '">' + esc(n.cliente) + '</td><td><a href="#" data-go="' + esc(s.idx.chaveCidadeDaNota.get(id)) + '" style="color:var(--acento)">' + esc(n.cidade) + '/' + esc(n.uf) + '</a></td><td title="' + esc(n.end + ', ' + n.num) + '">' + esc(n.end) + (n.num && n.num !== '0' ? ', ' + esc(n.num) : '') + '</td><td class="dir">' + i$(n.vol) + '</td><td class="dir">' + m$(n.valor) + '</td><td>' + (car ? '<span class="carro-tag" style="--cor:' + car.cor + '">' + esc(N.nomeCarro(car)) + '</span>' : '<span class="livre-tag">livre</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<p class="dica" style="padding:12px 14px;margin:0">Nenhuma nota bipada ainda nesta operação. O valor, a cidade, a parada e os volumes aparecem aqui assim que você bipar.</p>') + '</div>';
    /* XMLs carregados e conferência por origem */
    const por = new Map();
    for (const n of o.notas) { const x = por.get(n.origem) || { notas: 0, vol: 0, valor: 0, bip: 0 }; x.notas++; x.vol += n.vol; x.valor += n.valor; if (bipes[n.id]) x.bip++; por.set(n.origem, x); }
    const quadro = N.quadroXml(o), motDe = nome => { const l = quadro.find(x => x.xml && x.xml.nome === nome); return l && l.rom ? l.rom : null; };
    h += '<div class="bip-sec"><h3><span>XMLs carregados e conferência por origem</span></h3><div style="overflow:auto"><table><thead><tr><th>Origem</th><th>Motorista</th><th class="dir">Notas</th><th class="dir">Volumes</th><th class="dir">Valor</th><th>Bipadas</th></tr></thead><tbody>' +
      [...por.entries()].sort((a, b) => b[1].notas - a[1].notas).map(([k, x]) => '<tr><td>' + esc(k) + '</td><td>' + (motDe(k) ? esc(motDe(k).motorista) + (motDe(k).origem ? ' <span class="tag">' + esc(motDe(k).origem) + '</span>' : '') : '') + '</td><td class="dir">' + i$(x.notas) + '</td><td class="dir">' + i$(x.vol) + '</td><td class="dir">' + m$(x.valor) + '</td><td><span class="bip-prog"><i style="width:' + Math.round(x.bip / x.notas * 100) + '%"></i></span>' + x.bip + ' / ' + x.notas + '</td></tr>').join('') + '</tbody></table></div></div>' +
      '<p class="dica">Bipada = conferida. Isso é diferente de estar num veículo (alocada) e de entregue. Bipe repetido não soma duas vezes. Leitor de código de barras: aponte para a etiqueta com este campo selecionado — ele digita a chave e dá Enter sozinho.</p>';
    box.innerHTML = h;
    if (emFoco || (!document.activeElement || document.activeElement === document.body)) { const i = $('#bip-in'); if (i && $('#t-xmls') && !$('#t-xmls').hidden) i.focus(); }
  }
  RT.bip = { render, processar, consultarMeuDanfe };
})(typeof window !== 'undefined' ? window : globalThis);
