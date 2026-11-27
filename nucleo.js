/* Health Route · núcleo (regras puras, sem tela).
   Tudo aqui é testável sem navegador de verdade: leitura do XML SoftLog, notas, clientes (paradas),
   cidades, carros e totais. Dinheiro em CENTAVOS, peso em décimos de grama (1e-4 kg), volumes inteiros —
   nunca ponto flutuante nas somas. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const N = (RT.N = {});

  /* ---------- texto ---------- */
  N.norm = function (s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/\s+/g, ' ').trim();
  };
  /* nome de cidade: sem acento, sem pontuação (D'OESTE = D OESTE) */
  N.normCidade = function (s) {
    return N.norm(s).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  N.soDigitos = s => String(s == null ? '' : s).replace(/\D/g, '');

  /* ---------- números exatos ---------- */
  /* texto decimal -> inteiro em `esc` casas, arredondando metade para cima pelos DÍGITOS (sem float).
     Aceita "1234.56", "1.234,56", "1234,56", "8.3160". */
  N.dec = function (txt, esc) {
    let t = String(txt == null ? '' : txt).trim().replace(/\s/g, '');
    if (!t) return { v: 0, ok: false, vazio: true };
    let neg = false;
    if (t[0] === '-') { neg = true; t = t.slice(1); }
    const ult = { v: t.lastIndexOf(','), p: t.lastIndexOf('.') };
    if (ult.v >= 0 && ult.p >= 0) {
      if (ult.v > ult.p) t = t.replace(/\./g, '').replace(',', '.');
      else t = t.replace(/,/g, '');
    } else if (ult.v >= 0) t = t.replace(',', '.');
    if (!/^\d*\.?\d*$/.test(t) || t === '.' || t === '') return { v: 0, ok: false };
    let [i, f = ''] = t.split('.');
    i = i || '0';
    const resto = f.slice(esc);
    f = (f + '0'.repeat(esc)).slice(0, esc);
    let v = Number(i + f);
    const arred = resto.length && resto[0] >= '5';
    if (arred) v += 1;
    if (!Number.isSafeInteger(v)) return { v: 0, ok: false };
    return { v: neg ? -v : v, ok: true, perdeu: /[1-9]/.test(resto) };
  };

  N.fmtMoeda = c => 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  N.fmtInt = n => Number(n || 0).toLocaleString('pt-BR');
  N.fmtPeso = p => (Math.round(p / 10) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  /* ---------- leitura do XML (SpreadsheetML da SoftLog) ---------- */
  const SS = 'urn:schemas-microsoft-com:office:spreadsheet';
  const CAMPOS = {
    nf: ['NUMERO NF'], remetente: ['REMETENTE'], doc: ['CNPJ/CPF DESTINATARIO', 'CNPJ/CPF'],
    cliente: ['DESTINATARIO'], cep: ['CEP'], end: ['ENDERECO'], num: ['NUMERO'], bairro: ['BAIRRO'],
    cidade: ['CIDADE DESTINO', 'CIDADE'], uf: ['UF'], regiao: ['REGIAO'], vol: ['VOLUMES'], peso: ['PESO'],
    valor: ['VALOR NF IND'], valorProd: ['VALOR PRODUTOS'], chave: ['CHAVE NFE', 'CHAVE NF-E', 'CHAVE']
  };
  const OBRIGATORIOS = ['nf', 'cliente', 'cidade', 'uf', 'vol', 'valor'];
  const NOMES = { nf: 'NÚMERO NF', cliente: 'DESTINATÁRIO', cidade: 'CIDADE DESTINO', uf: 'UF', vol: 'VOLUMES', valor: 'VALOR NF IND' };

  function decodificar(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const cab = new TextDecoder('latin1').decode(u8.subarray(0, 300));
    const m = /encoding\s*=\s*["']([^"']+)["']/i.exec(cab);
    let enc = m ? m[1].toLowerCase() : 'utf-8';
    if (enc === 'iso-8859-1') enc = 'windows-1252';
    let txt;
    try { txt = new TextDecoder(enc).decode(u8); } catch (e) { txt = new TextDecoder('utf-8').decode(u8); }
    return txt.replace(/^﻿/, '');
  }

  function linhasDoXml(doc) {
    const out = [];
    const rows = doc.getElementsByTagNameNS('*', 'Row');
    for (let r = 0; r < rows.length; r++) {
      const cels = rows[r].getElementsByTagNameNS('*', 'Cell');
      const cel = {}; let col = 0;
      for (let c = 0; c < cels.length; c++) {
        const idx = cels[c].getAttributeNS(SS, 'Index') || cels[c].getAttribute('ss:Index');
        col = idx ? parseInt(idx, 10) : col + 1;
        const d = cels[c].getElementsByTagNameNS('*', 'Data')[0];
        cel[col] = d ? (d.textContent || '').trim() : '';
      }
      out.push({ n: r + 1, cel });
    }
    return out;
  }

  /* Lê UM arquivo. Devolve {arquivo, notas, ignoradas, avisos, erro}. O cabeçalho é achado pelo NOME
     das colunas (nunca por posição fixa de linha/coluna). */
  N.lerXml = function (buf, arquivo) {
    const res = { arquivo, notas: [], ignoradas: [], avisos: [], erro: null, linhasLidas: 0 };
    let doc;
    try {
      const txt = decodificar(buf);
      doc = new DOMParser().parseFromString(txt, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('arquivo XML inválido');
    } catch (e) { res.erro = 'Não consegui ler o arquivo: ' + (e.message || e); return res; }
    const linhas = linhasDoXml(doc);
    let cab = null, mapa = null;
    for (const l of linhas) {
      const nomes = {};
      for (const k in l.cel) nomes[N.norm(l.cel[k])] = +k;
      if (nomes['NUMERO NF'] != null) {
        mapa = {};
        for (const campo in CAMPOS) {
          for (const alvo of CAMPOS[campo]) {
            let achou = nomes[alvo];
            if (achou == null && alvo === 'CNPJ/CPF') {
              const k = Object.keys(nomes).find(x => x.startsWith('CNPJ/CPF'));
              if (k) achou = nomes[k];
            }
            if (achou != null) { mapa[campo] = achou; break; }
          }
        }
        cab = l; break;
      }
    }
    if (!cab) { res.erro = 'Cabeçalho "NÚMERO NF" não encontrado — não parece o relatório de notas da SoftLog.'; return res; }
    const falta = OBRIGATORIOS.filter(c => mapa[c] == null).map(c => NOMES[c]);
    if (falta.length) { res.erro = 'Faltam colunas obrigatórias: ' + falta.join(', ') + '.'; return res; }

    for (const l of linhas) {
      if (l.n <= cab.n) continue;
      const g = c => (mapa[c] == null ? '' : (l.cel[mapa[c]] || ''));
      const nf = g('nf');
      if (!nf) continue; // linha em branco
      res.linhasLidas++;
      if (!/^\d+$/.test(nf)) { res.ignoradas.push({ linha: l.n, motivo: 'número de NF não numérico: "' + nf.slice(0, 20) + '"' }); continue; }
      const vol = N.dec(g('vol'), 3), valor = N.dec(g('valor'), 2), peso = N.dec(g('peso'), 4);
      if (!valor.ok) { res.ignoradas.push({ linha: l.n, motivo: 'valor da NF ilegível: "' + g('valor') + '" (NF ' + nf + ')' }); continue; }
      if (!vol.ok) { res.ignoradas.push({ linha: l.n, motivo: 'volumes ilegível: "' + g('vol') + '" (NF ' + nf + ')' }); continue; }
      if (!g('cidade')) { res.ignoradas.push({ linha: l.n, motivo: 'sem cidade de destino (NF ' + nf + ')' }); continue; }
      const nota = {
        id: '', nf, remetente: g('remetente'), doc: N.soDigitos(g('doc')), cliente: g('cliente'),
        cep: N.soDigitos(g('cep')), end: g('end'), num: g('num'), bairro: g('bairro'),
        cidade: g('cidade'), uf: N.norm(g('uf')), vol: Math.round(vol.v / 1000), volMil: vol.v,
        peso: peso.ok ? peso.v : 0, valor: valor.v, chave: N.soDigitos(g('chave')),
        origem: arquivo, linha: l.n
      };
      if (vol.v % 1000 !== 0) res.avisos.push('NF ' + nf + ': volumes fracionados (' + g('vol') + ') — arredondado para ' + nota.vol + '.');
      if (!peso.ok) res.avisos.push('NF ' + nf + ': peso ausente — fica zerado nos totais.');
      nota.id = N.idNota(nota);
      res.notas.push(nota);
    }
    return res;
  };

  /* identidade fiscal: chave de 44 dígitos prevalece; sem ela, número + remetente + destinatário.
     Número isolado NUNCA prova duplicidade. */
  N.idNota = function (n) {
    if (n.chave && n.chave.length === 44) return 'k:' + n.chave;
    return 'n:' + n.nf + '|' + N.norm(n.remetente) + '|' + (n.doc || N.norm(n.cliente));
  };

  /* Junta lotes lidos com o que já existe. Não altera nada: devolve o relatório e as notas novas. */
  N.prepararLote = function (op, lidos) {
    const ja = new Map();
    for (const n of (op ? op.notas : [])) ja.set(n.id, n);
    const novos = new Map();
    const rel = { arquivos: [], novas: [], repetidas: 0, conflitos: [], erros: 0 };
    for (const r of lidos) {
      const f = { arquivo: r.arquivo, erro: r.erro, lidas: r.notas.length, novas: 0, repetidas: 0, conflitos: 0, ignoradas: r.ignoradas, avisos: r.avisos };
      if (r.erro) rel.erros++;
      for (const n of r.notas) {
        const ex = ja.get(n.id) || novos.get(n.id);
        if (!ex) { novos.set(n.id, n); rel.novas.push(n); f.novas++; continue; }
        const igual = ex.vol === n.vol && ex.valor === n.valor && ex.peso === n.peso &&
          N.normCidade(ex.cidade) === N.normCidade(n.cidade) && ex.uf === n.uf;
        if (igual) { rel.repetidas++; f.repetidas++; }
        else { rel.conflitos.push({ nf: n.nf, arquivo: n.origem, outro: ex.origem }); f.conflitos++; }
      }
      rel.arquivos.push(f);
    }
    return rel;
  };

  /* ---------- operação ---------- */
  N.novaOperacao = function (nome, data) {
    return {
      v: 1, id: 'op' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome: nome || 'Operação', data: data || new Date().toISOString().slice(0, 10),
      criada: new Date().toISOString(), rev: 0, notas: [], carros: [], atrib: {}, proxCarro: 1, arquivos: []
    };
  };

  const CORES = ['#7B3FE4', '#1C6DD0', '#E8590C', '#D6336C', '#0B8FA6', '#8D5A2B', '#C92A2A', '#4C5DDC',
    '#B23BC4', '#2FA0F5', '#7A1F3D', '#F06543', '#9B7BD6', '#B7791F', '#E5736B', '#2B6CB0'];
  N.corDoCarro = function (numero) {
    if (numero <= CORES.length) return CORES[numero - 1];
    const h = [190, 215, 240, 265, 290, 315, 340, 5, 20][(numero - 1) % 9];
    const l = 34 + (Math.floor((numero - CORES.length - 1) / 9) % 3) * 9;
    return 'hsl(' + h + ',62%,' + l + '%)';
  };

  /* Operação vinda de ARQUIVO (importar/restaurar): confere e limpa os campos que vão para a tela, para um arquivo
     adulterado não injetar HTML/estilo nem quebrar os totais. O resto da operação segue como veio. */
  N.sanearOp = function (op) {
    const txt = (v, max) => String(v == null ? '' : v).slice(0, max || 300), inteiro = v => Number.isFinite(+v) ? Math.trunc(+v) : 0;
    const cor = (v, id) => /^#[0-9a-fA-F]{6}$/.test(v) ? v : N.corDoCarro(id || 1);
    const o = Object.assign({}, op);
    o.nome = txt(o.nome, 80) || 'Operação'; o.data = /^\d{4}-\d{2}-\d{2}$/.test(o.data) ? o.data : '';
    o.notas = o.notas.filter(n => n && typeof n === 'object').map(n => {
      const x = Object.assign({}, n);
      for (const k of ['id', 'nf', 'chave', 'cliente', 'doc', 'end', 'num', 'bairro', 'cep', 'cidade', 'uf', 'cMun', 'origem', 'serie', 'emitente']) if (k in x) x[k] = txt(x[k]);
      for (const k of ['vol', 'peso', 'valor']) x[k] = Math.max(0, inteiro(x[k]));
      return x;
    });
    o.carros = o.carros.filter(c => c && typeof c === 'object').map(c => {
      const id = inteiro(c.id), x = Object.assign({}, c);
      x.id = id; x.numero = Math.max(1, inteiro(c.numero)); x.tipo = N.TIPOS[c.tipo] ? c.tipo : 'carro';
      x.motorista = txt(c.motorista, 40); x.cor = cor(c.cor, id); x.rastreio = c.rastreio === 'sim' || c.rastreio === 'nao' ? c.rastreio : null;
      x.cidades = Array.isArray(c.cidades) ? c.cidades.map(k => txt(k, 80)) : [];
      return x;
    });
    const atrib = {}; for (const id in o.atrib) { const v = inteiro(o.atrib[id]); if (o.carros.some(c => c.id === v)) atrib[id] = v; }
    o.atrib = atrib;
    return o;
  };

  /* Veículos: carro, van e caminhão. Van e caminhão diferem do carro só pelo NOME (o galpão sabe que cabe
     mais volume); nenhuma regra de distribuição muda. */
  N.TIPOS = { carro: { nome: 'Carro', plural: 'Carros' }, van: { nome: 'Van', plural: 'Vans' }, caminhao: { nome: 'Caminhão', plural: 'Caminhões' } };
  N.nomeCarro = c => (N.TIPOS[c.tipo || 'carro'] || N.TIPOS.carro).nome + ' ' + c.numero;
  N.rotuloCarro = c => N.nomeCarro(c) + (c.motorista ? ' · ' + c.motorista : '');
  N.novoCarro = function (op, motorista, tipo) {
    tipo = N.TIPOS[tipo] ? tipo : 'carro';
    const id = op.proxCarro++;
    const numero = Math.max(0, ...op.carros.filter(c => (c.tipo || 'carro') === tipo).map(c => c.numero)) + 1;
    const c = { id, tipo, numero, motorista: motorista || '', cor: N.corDoCarro(id), cidades: [], rastreio: null };
    op.carros.push(c);
    op.rev++;
    return c;
  };
  N.contarTipo = (op, tipo) => op.carros.filter(c => (c.tipo || 'carro') === tipo).length;
  /* ordem das paradas: move a cidade de `de` para `para` dentro da rota do veículo */
  N.moverCidade = function (op, carroId, de, para) {
    const c = op.carros.find(x => x.id === carroId);
    if (!c || de === para || de < 0 || para < 0 || de >= c.cidades.length || para >= c.cidades.length) return false;
    const [k] = c.cidades.splice(de, 1); c.cidades.splice(para, 0, k); op.rev++;
    return true;
  };

  /* Move/aloca notas para um carro (id) — ou libera (carroId = null). Mantém a lista de cidades do carro. */
  /* "Não vai hoje": nota tirada da rota do dia pelo Romaneio. Continua na operação e na cidade (que pode ficar cinza), mas NÃO entra em carro nem nos totais da rota. */
  N.naoVai = (op, n) => !!(op.naoVai && op.naoVai[n.id]);
  N.marcarNaoVai = function (op, idx, ids, sim) {
    op.naoVai = op.naoVai || {};
    for (const id of ids) { if (sim) { op.naoVai[id] = true; delete op.atrib[id]; } else delete op.naoVai[id]; }
    N.reorganizarCidades(op, idx); op.rev++;
  };
  N.alocar = function (op, idx, notaIds, carroId) {
    if (carroId != null && op.naoVai) notaIds = notaIds.filter(id => !op.naoVai[id]);
    for (const id of notaIds) {
      if (carroId == null) delete op.atrib[id]; else op.atrib[id] = carroId;
    }
    N.reorganizarCidades(op, idx);
    op.rev++;
  };
  /* recalcula carro.cidades preservando a ordem em que as cidades entraram no carro */
  N.reorganizarCidades = function (op, idx) {
    const por = new Map();
    for (const c of op.carros) por.set(c.id, new Set());
    for (const n of op.notas) {
      const car = op.atrib[n.id];
      if (car != null && por.has(car)) por.get(car).add(idx.chaveCidadeDaNota.get(n.id));
    }
    for (const c of op.carros) {
      const tem = por.get(c.id);
      const mantidas = c.cidades.filter(k => tem.has(k));
      for (const k of tem) if (!mantidas.includes(k)) mantidas.push(k);
      c.cidades = mantidas;
    }
  };
  N.removerCarro = function (op, idx, carroId) {
    for (const id of Object.keys(op.atrib)) if (op.atrib[id] === carroId) delete op.atrib[id];
    op.carros = op.carros.filter(c => c.id !== carroId);
    N.reorganizarCidades(op, idx);
    op.rev++;
  };

  /* ---------- municípios (IBGE) ---------- */
  let MUN = null, MUNIDX = null;
  let MUNNOME = null;
  /* todos os municípios com esse nome (e UF, se vier) — para listas coladas */
  N.achaMunicipios = function (nome, uf) {
    const l = (MUNNOME && MUNNOME.get(N.normCidade(nome))) || [];
    const u = uf ? N.norm(uf) : '';
    return l.filter(c => !u || MUN[c][1] === u).map(c => ({ code: c, nome: MUN[c][0], uf: MUN[c][1] }));
  };
  N.setMunicipios = function (obj) {
    MUN = obj; MUNIDX = new Map(); MUNNOME = new Map();
    for (const code in obj) { const k = N.normCidade(obj[code][0]); if (!MUNNOME.has(k)) MUNNOME.set(k, []); MUNNOME.get(k).push(code); }
    for (const code in obj) {
      const m = obj[code];
      const k = N.normCidade(m[0]) + '|' + m[1];
      if (!MUNIDX.has(k)) MUNIDX.set(k, code);
    }
  };
  N.municipio = function (nome, uf) {
    if (!MUNIDX) return null;
    const code = MUNIDX.get(N.normCidade(nome) + '|' + N.norm(uf));
    if (!code) return null;
    const m = MUN[code];
    return { code, nome: m[0], uf: m[1], lat: m[2], lon: m[3] };
  };
  N.municipioPorCodigo = code => (MUN && MUN[code]) ? { code, nome: MUN[code][0], uf: MUN[code][1], lat: MUN[code][2], lon: MUN[code][3] } : null;


  /* ---------- situação da nota: presente (na rota) · agendamento · divergência ----------
     Nota em agendamento ou divergência SAI da rota (não aparece nas cidades, no mapa nem nos totais da rota),
     mas continua na operação e nos relatórios (ela veio no XML). */
  N.estadoNota = (op, n) => (op.status && op.status[n.id] && op.status[n.id].tipo) || 'presente';
  N.ativas = op => (op.status && Object.keys(op.status).length ? op.notas.filter(n => !op.status[n.id]) : op.notas);
  N.marcarStatus = function (op, idx, ids, st) {
    op.status = op.status || {};
    for (const id of ids) { op.status[id] = Object.assign({ em: new Date().toISOString() }, st); delete op.atrib[id]; }
    N.reorganizarCidades(op, idx); op.rev++;
  };
  /* volta para a rota; `lembrar` impede que a regra automática de agendamento esconda de novo */
  N.tirarStatus = function (op, ids, lembrar) {
    op.agIgnorar = op.agIgnorar || {};
    for (const id of ids) { if (op.status) delete op.status[id]; if (lembrar) op.agIgnorar[id] = true; }
    op.rev++;
  };
  N.ehMesa = n => N.norm(n.origem).includes('MESA');
  N.casaAgenda = function (n, it) {
    if (it.tipo === 'nf') return String(+it.valor) === String(+n.nf);
    const v = N.norm(it.valor), d = N.soDigitos(it.valor);
    return (d.length >= 11 && n.doc === d) || (v.length >= 4 && N.norm(n.cliente).includes(v));
  };
  /* Regra do Tiago: nota que consta nos agendamentos é ocultada da rota automaticamente — EXCETO as do romaneio MESA,
     que continuam na rota. O que o usuário devolver à mão não é escondido de novo. */
  N.aplicarAgenda = function (op, itens) {
    const r = { auto: [], mesa: [] };
    if (!itens || !itens.length) return r;
    op.status = op.status || {}; op.agIgnorar = op.agIgnorar || {};
    for (const n of op.notas) {
      if (op.status[n.id] || op.agIgnorar[n.id]) continue;
      const it = itens.find(x => N.casaAgenda(n, x)); if (!it) continue;
      if (N.ehMesa(n)) { r.mesa.push(n.id); continue; }
      op.status[n.id] = { tipo: 'agendamento', auto: true, obs: it.obs || '', data: it.data || '', hora: it.hora || '', agendaId: it.id, em: new Date().toISOString() };
      delete op.atrib[n.id]; r.auto.push(n.id);
    }
    if (r.auto.length) op.rev++;
    return r;
  };
  /* lista colada / CSV: "NF;data;hora;obs" ou "cliente;data;hora;obs". Data dd/mm/aaaa ou aaaa-mm-dd. */
  N.lerAgenda = function (texto) {
    const itens = [], ruins = [];
    for (const lin of String(texto || '').split(/\r?\n/)) {
      const t = lin.trim(); if (!t) continue;
      const c = t.split(/[;\t]/).map(x => x.trim());
      let valor = c[0].replace(/^NF\s*/i, ''); if (!valor) { ruins.push(t); continue; }
      let data = '';
      const d = (c[1] || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/) ; if (d) data = d[3] + '-' + d[2] + '-' + d[1]; else if (/^\d{4}-\d{2}-\d{2}$/.test(c[1] || '')) data = c[1];
      itens.push({ id: 'ag' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tipo: /^\d{1,9}$/.test(valor) ? 'nf' : 'cliente', valor, data, hora: /^\d{1,2}:\d{2}$/.test(c[2] || '') ? c[2] : '', obs: c.slice(3).join(' ').trim() });
    }
    return { itens, ruins };
  };

  /* ---------- fora de rota ---------- */
  /* Regras: está FORA se só aparece nas listas de LKR/BH/Cajamar do Health Search (ou é do DF) e em nenhuma
     região atendida. Cidade que não aparece em lista nenhuma conta como EM ROTA (o mapa embutido é incompleto:
     perder uma cidade atendida seria pior que mostrar uma a mais). O usuário corrige cidade a cidade (`ajustes`). */
  let REG = null, AJ = {};
  N.setRegioes = function (dados) {
    REG = { rota: new Set(), fora: new Set(), nomes: new Map() };
    for (const r of (dados && dados.regioes) || []) for (const c of r.cidades) { (r.grupo === 'fora' ? REG.fora : REG.rota).add(String(c)); if (!REG.nomes.has(String(c))) REG.nomes.set(String(c), []); REG.nomes.get(String(c)).push(r.nome); }
    /* cidades "ensinadas" (confirmadas na Geolocalização) contam como se estivessem na lista escolhida */
    const apr = (dados && dados.aprend) || {};
    for (const cod in apr) for (const tp in apr[cod]) {
      const l = ((dados && dados.regioes) || []).find(x => x.id === apr[cod][tp]); if (!l) continue;
      (l.grupo === 'fora' ? REG.fora : REG.rota).add(String(cod)); if (!REG.nomes.has(String(cod))) REG.nomes.set(String(cod), []); if (!REG.nomes.get(String(cod)).includes(l.nome)) REG.nomes.get(String(cod)).push(l.nome);
    }
  };
  N.setAjustesRota = o => { AJ = o || {}; };
  N.foraDeRota = function (code, uf) {
    const k = code || ('x:' + uf);
    if (code && AJ[code] === 'fora') return true;
    if (code && AJ[code] === 'rota') return false;
    if (uf === 'DF') return true;
    return !!(code && REG && REG.fora.has(String(code)) && !REG.rota.has(String(code)));
  };
  N.regioesDaCidade = code => (REG && code && REG.nomes.get(String(code))) || [];

  /* ---------- índice derivado: cidades -> clientes -> notas ---------- */
  N.chaveCliente = n => (n.doc || N.norm(n.cliente)) + '|' + n.cep + '|' + N.norm(n.end) + '|' + N.norm(n.num);

  N.indexar = function (op) {
    const cidades = new Map(), chaveCidadeDaNota = new Map(), notaPorId = new Map();
    for (const n of N.ativas(op)) {
      const k = N.normCidade(n.cidade) + '|' + n.uf;
      let c = cidades.get(k);
      if (!c) {
        const m = N.municipio(n.cidade, n.uf);
        c = { key: k, nome: m ? m.nome : n.cidade, uf: n.uf, code: m ? m.code : null, lat: m ? m.lat : null, lon: m ? m.lon : null,
          semPosicao: !m, clientes: new Map(), notas: [], fora: N.foraDeRota(m ? m.code : null, n.uf) };
        cidades.set(k, c);
      }
      const ck = N.chaveCliente(n);
      chaveCidadeDaNota.set(n.id, k); notaPorId.set(n.id, n);
      if (N.naoVai(op, n)) {   // tirada da rota de hoje: guardada à parte (aparece na janela da cidade como indisponível)
        c.notasFora = c.notasFora || []; c.clientesFora = c.clientesFora || new Map();
        let cf = c.clientesFora.get(ck);
        if (!cf) { cf = { key: ck, nome: n.cliente, doc: n.doc, end: n.end, num: n.num, bairro: n.bairro, cep: n.cep, notas: [] }; c.clientesFora.set(ck, cf); }
        cf.notas.push(n); c.notasFora.push(n); continue;
      }
      let cl = c.clientes.get(ck);
      if (!cl) { cl = { key: ck, nome: n.cliente, doc: n.doc, end: n.end, num: n.num, bairro: n.bairro, cep: n.cep, notas: [] }; c.clientes.set(ck, cl); }
      cl.notas.push(n); c.notas.push(n);
    }
    const lista = [...cidades.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    for (const c of lista) { c.listaClientes = [...c.clientes.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); c.listaFora = c.clientesFora ? [...c.clientesFora.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) : []; c.notasFora = c.notasFora || []; c.cinza = !c.notas.length && c.notasFora.length > 0; }
    return { cidades, lista, chaveCidadeDaNota, notaPorId };
  };

  const zero = () => ({ notas: 0, vol: 0, peso: 0, valor: 0 });
  N.somar = function (notas) {
    const t = zero();
    for (const n of notas) { t.notas++; t.vol += n.vol; t.peso += n.peso; t.valor += n.valor; }
    return t;
  };

  /* estado de uma cidade: pendente (nada alocado), parcial (falta nota), completa (tudo alocado) */
  N.estadoCidade = function (cidade, atrib) {
    let a = 0;
    for (const n of cidade.notas) if (atrib[n.id] != null) a++;
    return { alocadas: a, total: cidade.notas.length, estado: a === 0 ? 'pendente' : a < cidade.notas.length ? 'parcial' : 'completa' };
  };
  /* estado de um cliente dentro da cidade */
  N.estadoCliente = function (cl, atrib) {
    const por = new Map(); let livres = 0;
    for (const n of cl.notas) {
      const c = atrib[n.id];
      if (c == null) livres++; else por.set(c, (por.get(c) || 0) + 1);
    }
    return { livres, carros: por, estado: livres === cl.notas.length ? 'livre' : livres === 0 ? 'alocado' : 'parcial' };
  };

  /* resumo completo da operação (alimenta Mural, mapa, barra de carros e Folha) */
  N.volMil = n => (n.volMil != null ? n.volMil : n.vol * 1000);
  N.resumo = function (op, idx) {
    const atrib = op.atrib, base = N.ativas(op);
    const tot = N.somar(base);
    const aloc = N.somar(base.filter(n => atrib[n.id] != null));
    const ret = { agendamento: 0, divergencia: 0 };
    for (const id in (op.status || {})) { const t = op.status[id].tipo; if (ret[t] != null) ret[t]++; }
    const cidades = [];
    const cont = { pendente: 0, parcial: 0, completa: 0 };
    const fora = { cidades: 0, notas: 0, vol: 0, peso: 0, valor: 0 };
    const rota = zero(), alocRota = zero();
    for (const c of idx.lista) {
      if (c.cinza) { cidades.push({ cidade: c, estado: 'cinza', alocadas: 0, total: 0, porCarro: new Map(), livres: zero(), paradasLivres: 0, fora: !!c.fora, cinza: true }); continue; }   // todas as notas saíram da rota de hoje
      const e = N.estadoCidade(c, atrib);
      const porCarro = new Map();
      const livres = zero(); const clientesLivres = new Set();
      for (const n of c.notas) {
        const car = atrib[n.id];
        if (car == null) { livres.notas++; livres.vol += n.vol; livres.peso += n.peso; livres.valor += n.valor; clientesLivres.add(N.chaveCliente(n)); continue; }
        let p = porCarro.get(car); if (!p) { p = zero(); porCarro.set(car, p); }
        p.notas++; p.vol += n.vol; p.peso += n.peso; p.valor += n.valor;
      }
      if (c.fora) { fora.cidades++; for (const n of c.notas) { fora.notas++; fora.vol += n.vol; fora.peso += n.peso; fora.valor += n.valor; } }
      else {
        cont[e.estado]++;
        for (const n of c.notas) { rota.notas++; rota.vol += n.vol; rota.peso += n.peso; rota.valor += n.valor; if (atrib[n.id] != null) { alocRota.notas++; alocRota.vol += n.vol; alocRota.peso += n.peso; alocRota.valor += n.valor; } }
      }
      cidades.push({ cidade: c, estado: e.estado, alocadas: e.alocadas, total: e.total, porCarro, livres, paradasLivres: clientesLivres.size, fora: !!c.fora, cinza: false });
    }
    const carros = op.carros.map(car => {
      const notas = op.notas.filter(n => atrib[n.id] === car.id);
      const t = N.somar(notas);
      const par = new Set();
      for (const n of notas) par.add(idx.chaveCidadeDaNota.get(n.id) + '#' + N.chaveCliente(n));
      return { carro: car, ...t, paradas: par.size, cidades: car.cidades.map(k => idx.cidades.get(k)).filter(Boolean) };
    });
    const origens = new Map();
    for (const n of base) { const o = origens.get(n.origem) || zero(); o.notas++; o.vol += n.vol; o.valor += n.valor; origens.set(n.origem, o); }
    return { tot, aloc, rota, alocRota, fora, ret, cidades, cont, carros, origens,
      cidadesSemPosicao: idx.lista.filter(c => c.semPosicao).length,
      pctAloc: rota.notas ? Math.round((alocRota.notas / rota.notas) * 100) : 0 };
  };

  N.paradasTotais = function (op, idx) {
    const s = new Set();
    for (const n of op.notas) s.add(idx.chaveCidadeDaNota.get(n.id) + '#' + N.chaveCliente(n));
    return s.size;
  };



  /* ---------- bipagem: chave da NF-e (44 dígitos) ---------- */
  N.chaveValida = function (c) {
    if (!/^\d{44}$/.test(c)) return false;
    let soma = 0, peso = 2;
    for (let i = 42; i >= 0; i--) { soma += (+c[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
    const r = soma % 11, dv = r < 2 ? 0 : 11 - r;
    return dv === +c[43];
  };
  /* o que a própria chave diz (sem inventar nada): UF do emitente, mês, CNPJ do emitente, série e número */
  N.lerChave = c => ({ uf: c.slice(0, 2), aamm: c.slice(2, 6), cnpj: c.slice(6, 20), serie: String(+c.slice(22, 25)), nf: String(+c.slice(25, 34)) });
  /* separa o que veio do leitor em itens: chave (44 dígitos) ou número de NF */
  N.lerBipe = function (txt) {
    const itens = [];
    for (const d of String(txt || '').split(/[\s;,]+/).map(x => x.replace(/\D/g, '')).filter(Boolean)) {
      if (d.length > 44 && d.length % 44 === 0) { for (let i = 0; i < d.length; i += 44) itens.push({ tipo: 'chave', valor: d.slice(i, i + 44) }); } // leitor que cola várias chaves sem separador
      else itens.push(d.length === 44 ? { tipo: 'chave', valor: d } : d.length >= 1 && d.length <= 9 ? { tipo: 'nf', valor: d } : { tipo: 'invalido', valor: d });
    }
    return itens;
  };
  /* procura a leitura nas notas da operação */
  N.acharBipe = function (op, item) {
    if (item.tipo === 'chave') { const n = op.notas.find(x => x.chave === item.valor); return n ? [n] : []; }
    const num = String(+item.valor);
    return op.notas.filter(x => String(+x.nf) === num);
  };


  /* ---------- NF-e completa (XML do Meu Danfe): tudo que o fisco informou, sem inventar nada ---------- */
  N.lerNFe = function (xml) {
    let doc;
    try { doc = new DOMParser().parseFromString(String(xml || ''), 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw new Error('x'); } catch (e) { return { erro: 'XML da NF-e inválido.' }; }
    const el = (ctx, tag) => (ctx ? ctx.getElementsByTagNameNS('*', tag)[0] : null) || null;
    const q = (ctx, tag) => { const e = el(ctx, tag); return e ? (e.textContent || '').trim() : ''; };
    const inf = el(doc, 'infNFe'); if (!inf) return { erro: 'O arquivo não é uma NF-e.' };
    const ide = el(inf, 'ide'), emit = el(inf, 'emit'), dest = el(inf, 'dest'), end = el(dest, 'enderDest'), tot = el(inf, 'ICMSTot');
    let volMil = 0, peso = 0, temVol = false;
    for (const v of Array.from(inf.getElementsByTagNameNS('*', 'vol'))) { const d = N.dec(q(v, 'qVol'), 3); if (d.ok && d.v > 0) { volMil += d.v; temVol = true; } const p = N.dec(q(v, 'pesoB'), 4); if (p.ok) peso += p.v; }
    const valor = N.dec(q(tot, 'vNF'), 2);
    return {
      chave: (inf.getAttribute('Id') || '').replace(/^NFe/, ''), nf: q(ide, 'nNF'), serie: q(ide, 'serie'), emitCnpj: q(emit, 'CNPJ'), emitNome: q(emit, 'xNome'),
      doc: q(dest, 'CNPJ') || q(dest, 'CPF'), cliente: q(dest, 'xNome'), end: q(end, 'xLgr'), num: q(end, 'nro'), compl: q(end, 'xCpl'), bairro: q(end, 'xBairro'),
      cMun: q(end, 'cMun'), cidade: q(end, 'xMun'), uf: q(end, 'UF'), cep: q(end, 'CEP'), valor: valor.ok ? valor.v : null, volMil: temVol ? volMil : null, peso
    };
  };


  /* ---------- romaneio em PDF (SOMENTE cabeçalho) e ligação com os XMLs ---------- */
  /* texto do OCR do topo da 1ª página -> campos. Só devolve o que achou; nada é inventado. */
  N.lerCabecalhoRomaneio = function (texto, tabelaTexto) {
    const t = String(texto || '').replace(/\r/g, ''), linhas = t.split('\n').map(l => l.replace(/\s+$/, ''));
    const pega = (re, s) => { const m = (s || t).match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
    const int = s => { const d = String(s || '').replace(/\./g, '').replace(/\D/g, ''); return d ? Number(d) : null; };
    const cab = { motorista: '', placa: '', origem: '', filial: '', numero: '', data: '', notas: null, volumes: null, obs: '' };
    cab.motorista = pega(/MOTORISTA\s*:\s*([^\n]*?)(?:\s{2,}CPF|\s+CPF\s*:|\n|$)/i).replace(/[^A-Za-zÀ-ÿ' .-]/g, '').trim();
    const pl = pega(/VE[IÍ]CULO\s*:\s*([A-Z0-9][A-Z0-9 -]{4,9})/i).toUpperCase().replace(/\s+/g, '');
    cab.placa = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/.test(pl) ? pl.replace(/^([A-Z]{3})-?/, '$1-') : pl;
    cab.origem = pega(/ORIGEM\s*:\s*([A-Za-zÀ-ÿ .'-]+?)(?:\s{2,}|\s+SEGURADORA|\n|$)/i);
    cab.filial = pega(/FILIAL\s*:\s*([^\n]+)/i);
    cab.numero = pega(/ROMANEIO\s*N[ºo°]?\s*([\d.]+)/i);
    const dv = pega(/DATA DA VIAGEM\s*:\s*(\d{2}\/\d{2}\/\d{4})/i) || pega(/\bDATA\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (dv) cab.data = dv.slice(6, 10) + '-' + dv.slice(3, 5) + '-' + dv.slice(0, 2);
    cab.notas = int(pega(/\bNotas\s*:\s*([\d.]+)/i)); cab.volumes = int(pega(/\bVolumes\s*:\s*([\d.]+)/i));
    const i = linhas.findIndex(l => /OBSERVA[CÇ][OÕ]ES\s*:/i.test(l));
    if (i >= 0) { const f = []; const p1 = linhas[i].replace(/^.*OBSERVA[CÇ][OÕ]ES\s*:\s*/i, '').trim(); if (p1) f.push(p1); for (let k = i + 1; k < linhas.length && !/^\s*REMETENTE/i.test(linhas[k]); k++) if (linhas[k].trim()) f.push(linhas[k].trim()); cab.obs = f.join(' · ').slice(0, 240); }
    /* NFs que o OCR viu nas primeiras linhas da tabela (servem só para ligar o romaneio ao XML) */
    const tab = String(tabelaTexto || '') + '\n' + (t.split(/\n\s*REMETENTE[^\n]*\n/i)[1] || '');
    cab.nfs = [...new Set((tab.match(/(?<!\d)0\d{8}(?!\d)/g) || []).map(x => String(+x)))].slice(0, 40);
    return cab;
  };
  N.normArquivo = nome => N.norm(String(nome || '').replace(/\.[A-Za-z0-9]{2,4}$/, '')).replace(/\b(ROMANEIO|MANIFESTO)\b/g, ' ').replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  N.mesmoMotorista = (a, b) => {
    const x = N.norm(a).split(' ').filter(Boolean), y = N.norm(b).split(' ').filter(Boolean); if (!x.length || !y.length) return false;
    if (x.join(' ') === y.join(' ')) return true;
    const comum = x.filter(p => y.includes(p)).length; return comum >= Math.min(x.length, y.length) && comum >= 2 && x[0] === y[0];
  };
  /* arquivos XML da operação com os totais de cada um */
  N.arquivosXml = function (op) {
    const por = new Map();
    for (const n of op.notas) { const x = por.get(n.origem) || { nome: n.origem, notas: 0, vol: 0, valor: 0, extra: !!n.extra }; x.notas++; x.vol += n.vol; x.valor += n.valor; por.set(n.origem, x); }
    const nomes = new Set((op.arquivos || []).map(a => a.nome));
    for (const a of (op.arquivos || [])) if (!por.has(a.nome)) por.set(a.nome, { nome: a.nome, notas: 0, vol: 0, valor: 0 });
    return [...por.values()].filter(x => nomes.has(x.nome) || !x.extra);
  };
  /* liga cada romaneio a UM xml: 1) escolha manual  2) mesmo título  3) mesmas notas e volumes. Devolve linhas verde/amarelo/vermelho. */
  N.quadroXml = function (op) {
    const xmls = N.arquivosXml(op), roms = op.romaneios || [], usados = new Set(), lig = new Map();
    const ligar = (r, x, como) => { lig.set(r.id, { x: x.nome, como }); usados.add(x.nome); };
    for (const r of roms) if (r.xmlManual) { const x = xmls.find(y => y.nome === r.xmlManual); if (x && !usados.has(x.nome)) ligar(r, x, 'manual'); }
    for (const r of roms) if (!lig.has(r.id)) { const k = N.normArquivo(r.arquivo), x = k && xmls.find(y => !usados.has(y.nome) && N.normArquivo(y.nome) === k); if (x) ligar(r, x, 'mesmo título'); }
    /* por nome e por contagem já tentados; agora pelas NOTAS: em qual XML estão as NFs lidas no romaneio? */
    const nfsPorXml = new Map(); for (const x of xmls) nfsPorXml.set(x.nome, new Set());
    for (const nt of op.notas) { const s = nfsPorXml.get(nt.origem); if (s) s.add(String(+nt.nf)); }
    const porContagem = r => r.notas != null && r.volumes != null;
    for (const r of roms) if (!lig.has(r.id) && porContagem(r)) { const c = xmls.filter(y => !usados.has(y.nome) && y.notas === r.notas && y.vol === r.volumes); if (c.length === 1) ligar(r, c[0], 'mesmas notas e volumes'); }
    for (const r of roms) if (!lig.has(r.id) && r.nfs && r.nfs.length) {
      const pontos = xmls.filter(y => !usados.has(y.nome)).map(y => ({ y, p: r.nfs.filter(f => nfsPorXml.get(y.nome).has(f)).length })).filter(z => z.p > 0).sort((a, b) => b.p - a.p);
      if (pontos.length && (pontos.length === 1 || pontos[0].p > pontos[1].p) && pontos[0].p >= Math.min(2, r.nfs.length)) ligar(r, pontos[0].y, 'as mesmas notas');
    }
    const linhas = [];
    for (const x of xmls) { const r = roms.find(z => lig.has(z.id) && lig.get(z.id).x === x.nome) || null; linhas.push({ xml: x, rom: r, estado: r ? 'verde' : 'amarelo', como: r ? lig.get(r.id).como : '' }); }
    for (const r of roms) if (!lig.has(r.id)) linhas.push({ xml: null, rom: r, estado: 'vermelho', como: '' });
    return linhas;
  };

  /* ---------- relatórios por período (mesmas definições do PDF "Comparativo de Entregas") ----------
     • Nota fiscal ÚNICA: a mesma identidade fiscal em operações diferentes entra UMA vez (a primeira por data).
     • Parada prevista = um ENDEREÇO por DIA. • Ticket por parada = valor das notas ÷ paradas previstas.
     • Dias de operação = datas distintas com nota contada. • Médias diárias = total ÷ dias de operação. */
  N.chaveEndereco = n => N.normCidade(n.cidade) + '|' + n.uf + '|' + n.cep + '|' + N.norm(n.end) + '|' + N.norm(n.num);
  const dividir = (a, b) => (b ? a / b : 0);
  N.relatorio = function (ops, de, ate) {
    const sel = ops.filter(o => o.data >= de && o.data <= ate).sort((a, b) => a.data.localeCompare(b.data) || String(a.criada).localeCompare(String(b.criada)));
    const vistos = new Set(), dias = new Map(), paradas = new Set(), cidades = new Map(), clientes = new Map();
    const r = { de, ate, operacoes: sel.length, duplicadas: 0, notas: 0, valor: 0, volMil: 0, peso: 0, paradas: 0, dias: 0, porDia: [], topCidades: [], topClientes: [] };
    for (const o of sel) {
      for (const n of o.notas) {
        if (vistos.has(n.id)) { r.duplicadas++; continue; }
        vistos.add(n.id);
        r.notas++; r.valor += n.valor; r.volMil += N.volMil(n); r.peso += n.peso;
        const d = dias.get(o.data) || { data: o.data, notas: 0, valor: 0, volMil: 0, paradas: new Set() };
        d.notas++; d.valor += n.valor; d.volMil += N.volMil(n); d.paradas.add(N.chaveEndereco(n)); dias.set(o.data, d);
        paradas.add(o.data + '#' + N.chaveEndereco(n));
        const ck = N.normCidade(n.cidade) + '|' + n.uf; const mun = N.municipio(n.cidade, n.uf); const c = cidades.get(ck) || { nome: mun ? mun.nome : n.cidade, uf: n.uf, valor: 0 }; c.valor += n.valor; cidades.set(ck, c);
        const kc = n.doc || N.norm(n.cliente); const cl = clientes.get(kc) || { nome: N.titulo(n.cliente), valor: 0 }; cl.valor += n.valor; clientes.set(kc, cl);
      }
    }
    r.paradas = paradas.size; r.dias = dias.size;
    r.ticket = Math.round(dividir(r.valor, r.paradas));
    r.porDia = [...dias.values()].sort((a, b) => a.data.localeCompare(b.data)).map(d => ({ data: d.data, notas: d.notas, valor: d.valor, volMil: d.volMil, paradas: d.paradas.size }));
    r.media = { paradas: dividir(r.paradas, r.dias), valor: dividir(r.valor, r.dias), notas: dividir(r.notas, r.dias), vol: dividir(r.volMil / 1000, r.dias), peso: dividir(r.peso / 10000, r.dias) };
    r.mapaCidades = cidades;
    r.topCidades = [...cidades.values()].sort((a, b) => b.valor - a.valor);
    r.topClientes = [...clientes.values()].sort((a, b) => b.valor - a.valor);
    return r;
  };
  /* "UNIMED DE PRES PRUDENTE LTDA" -> "Unimed de Pres Prudente Ltda" (o XML vem em maiúsculas e sem acento) */
  N.titulo = function (s) {
    const peq = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'para']);
    return String(s || '').toLowerCase().replace(/(^|[\s(\/-])([a-zà-ú])([a-zà-ú']*)/g, (m, pre, a, resto, off) => { const w = a + resto; return pre + (off > 0 && peq.has(w) ? w : a.toUpperCase() + resto); });
  };
  const varPct = (a, b) => (a ? ((b - a) / a) * 100 : null);
  /* comparação entre dois períodos já calculados: diferenças, variação % e frases-resumo */
  N.comparativo = function (A, B) {
    const m = (nome, a, b) => ({ nome, a, b, dif: b - a, pct: varPct(a, b) });
    const ind = {
      paradas: m('Paradas previstas', A.paradas, B.paradas), valor: m('Valor das notas', A.valor, B.valor), notas: m('Notas fiscais únicas', A.notas, B.notas),
      ticket: m('Ticket por parada', A.ticket, B.ticket), dias: m('Dias de operação', A.dias, B.dias),
      paradasDia: m('Paradas por dia', A.media.paradas, B.media.paradas), valorDia: m('Valor por dia', A.media.valor, B.media.valor),
      vol: m('Volumes informados', A.volMil / 1000, B.volMil / 1000), peso: m('Peso informado', A.peso / 10000, B.peso / 10000),
      volDia: m('Volumes por dia', A.media.vol, B.media.vol), pesoDia: m('Peso por dia', A.media.peso, B.media.peso), notasDia: m('Notas fiscais por dia', A.media.notas, B.media.notas)
    };
    /* quem mais explicou a variação do valor: cidade com a maior diferença no mesmo sentido da variação total */
    const difTotal = B.valor - A.valor, sinal = difTotal >= 0 ? 1 : -1, difs = [];
    const chaves = new Set([...A.mapaCidades.keys(), ...B.mapaCidades.keys()]);
    for (const k of chaves) { const a = (A.mapaCidades.get(k) || { valor: 0 }).valor, b = (B.mapaCidades.get(k) || { valor: 0 }).valor, x = A.mapaCidades.get(k) || B.mapaCidades.get(k); difs.push({ nome: x.nome, uf: x.uf, dif: b - a }); }
    difs.sort((x, y) => (y.dif - x.dif) * sinal);
    const lider = difs[0] && difs[0].dif * sinal > 0 && difTotal !== 0 ? { nome: difs[0].nome, uf: difs[0].uf, parcela: (difs[0].dif / difTotal) * 100 } : null;
    return { ind, lider };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RT;
})(typeof window !== 'undefined' ? window : globalThis);
