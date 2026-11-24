/* Health Route · romaneio em PDF: lê SÓ o cabeçalho (motorista, placa, origem, notas, volumes, número).
   O romaneio não cria nota nenhuma — quem manda é o XML. O PDF do SoftLog não tem camada de texto
   (o texto é desenhado como imagem), então a leitura é por OCR local (Tesseract em português, o mesmo
   do Health Search), feito no próprio navegador: nada sai do aparelho. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const N = RT.N;
  const SCRIPTS = new Map();
  const carregar = src => SCRIPTS.get(src) || (SCRIPTS.set(src, new Promise((ok, er) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = ok; s.onerror = () => { SCRIPTS.delete(src); er(new Error('não carregou ' + src + ' (sem internet na primeira vez?)')); }; document.head.appendChild(s); })), SCRIPTS.get(src));
  /* os arquivos vindos do Health Search chamam HSA.poe(id, tipo, conteúdo) para guardar blocos grandes */
  if (!g.HSA) g.HSA = { poe(id, tipo, conteudo) { if (document.getElementById(id)) return; const s = document.createElement('script'); s.type = tipo; s.id = id; s.textContent = conteudo; document.body.appendChild(s); } };

  async function pdfjs() {
    if (!g.pdfjsLib) await carregar('vendor/pdf.js');
    if (!g.pdfjsWorker) await carregar('vendor/pdf-worker.js');
    return g.pdfjsLib;
  }
  let ocrP = null;
  function ocr() {
    if (ocrP) return ocrP;
    ocrP = (async () => {
      if (!(typeof WebAssembly === 'object' && typeof DecompressionStream !== 'undefined')) throw new Error('Este navegador não tem o que o leitor de PDF precisa (WebAssembly/DecompressionStream). Use o Chrome ou o Edge atualizado.');
      if (!document.getElementById('ocr-wasm') || !g.Tesseract) await carregar('vendor/ocr.js');
      const txt = id => document.getElementById(id).textContent.replace(/\s+/g, '');
      const bin = atob(txt('ocr-codigo')), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const codigo = new TextDecoder().decode(u);
      const url = URL.createObjectURL(new Blob(['self.__W="' + txt('ocr-wasm') + '";self.__P="' + txt('ocr-por') + '";\n', codigo], { type: 'text/javascript' }));
      const w = await g.Tesseract.createWorker('por', 1, { workerPath: url, workerBlobURL: false, corePath: 'embutido.js', langPath: 'https://embutido.invalid/tessdata', cacheMethod: 'none', gzip: true, errorHandler: e => console.error('OCR', e) }, { load_system_dawg: '0', load_freq_dawg: '0' });
      await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1', user_defined_dpi: '300' });
      return w;
    })();
    ocrP.catch(() => { ocrP = null; });
    return ocrP;
  }

  /* lê a parte de cima da 1ª página (de onde saem os dados do cabeçalho) e devolve o texto reconhecido */
  async function textoDoCabecalho(buf) {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: buf.slice(0) }).promise;
    const page = await doc.getPage(1), vp = page.getViewport({ scale: 3.4 });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    const fatia = (de, ate) => { const c = document.createElement('canvas'), y0 = Math.round(cv.height * de), h = Math.round(cv.height * ate) - y0; c.width = cv.width; c.height = h; c.getContext('2d').drawImage(cv, 0, y0, cv.width, h, 0, 0, cv.width, h); return c; };
    const w = await ocr();
    /* duas passadas: o cabeçalho (curto, para não perder linhas) e a tabela (só para ver as NFs e ligar ao XML) */
    const topo = await w.recognize(fatia(0, 0.34), {}, { text: true });
    const tab = await w.recognize(fatia(0.3, 0.58), {}, { text: true });
    return { texto: topo.data.text || '', tabela: tab.data.text || '', paginas: doc.numPages };
  }

  /* ================= motoristas cadastrados (valem para sempre, até você mudar) ================= */
  const U = RT.U, $ = U.$, $$ = U.$$, esc = U.esc, toast = U.toast;
  RT.motoristas = [];
  async function carregarMot() { try { const x = await RT.DB.get('meta', 'motoristas'); if (x && Array.isArray(x.v)) RT.motoristas = x.v; } catch (e) { /* começa vazio */ } }
  const guardarMot = () => RT.DB.put('meta', { k: 'motoristas', v: RT.motoristas }).catch(e => toast('⚠ Não consegui guardar os motoristas: ' + ((e && e.message) || e)));
  const acharMot = nome => RT.motoristas.find(m => N.mesmoMotorista(m.nome, nome));
  const origensConhecidas = () => [...new Set(RT.motoristas.map(m => m.origem).filter(Boolean))];

  function perguntarOrigem(cab) {
    const sug = N.titulo(cab.origem || '');
    return U.modal('<h2>Motorista novo</h2><p><b>' + esc(cab.motorista) + '</b>' + (cab.placa ? ' · placa ' + esc(cab.placa) : '') + '<br>De onde ele sai? O Health Route guarda e não pergunta mais — até você mudar em <b>Cadastros</b>.</p><input class="filtro modal-in" list="rom-origens" style="max-width:none;width:100%" placeholder="Ex.: Cajamar, Brasília…"><datalist id="rom-origens">' + origensConhecidas().map(o => '<option value="' + esc(o) + '">').join('') + '</datalist>' +
      '<div class="botoes"><button class="btn" data-n>Agora não</button><button class="btn pri" data-s>Salvar para sempre</button></div>', (f, fechar) => {
        const i = f.querySelector('input'); i.value = sug; i.focus(); i.select();
        const ok = () => { const v = i.value.trim(); if (!v) { toast('Diga de onde ele sai.'); return; } fechar(v); };
        i.onkeydown = e => { if (e.key === 'Enter') ok(); };
        f.querySelector('[data-s]').onclick = ok; f.querySelector('[data-n]').onclick = () => fechar(null);
      });
  }

  /* lê os PDFs, guarda só o cabeçalho e pergunta a origem do motorista novo */
  async function adicionarPdfs(files) {
    const S = RT.S, A = RT.A;
    if (!S.op) { toast('Importe os XMLs primeiro: o romaneio é ligado ao XML da operação.'); return; }
    const o = S.op; o.romaneios = o.romaneios || [];
    const st = $('#rom-status'), say = m => { if (st) st.textContent = m; };
    const lista = [...files]; let novos = 0, repetidos = 0; const falhas = [];
    for (let i = 0; i < lista.length; i++) {
      const f = lista[i]; say('Lendo o cabeçalho de ' + f.name + ' (' + (i + 1) + ' de ' + lista.length + ')… a 1ª vez demora um pouco mais.');
      const buf = await f.arrayBuffer(), hash = await U.sha256(buf);
      if (hash && o.romaneios.some(x => x.hash === hash)) { repetidos++; continue; }
      let cab;
      try { const t = await textoDoCabecalho(buf); cab = N.lerCabecalhoRomaneio(t.texto, t.tabela); cab.paginas = t.paginas; } catch (e) { falhas.push(f.name + ': ' + ((e && e.message) || e)); continue; }
      if (!cab.motorista && !cab.placa) { falhas.push(f.name + ': não achei motorista nem placa — é um romaneio do SoftLog?'); continue; }
      let m = cab.motorista && acharMot(cab.motorista);
      if (!m && cab.motorista) {
        const origem = await perguntarOrigem(cab);
        if (origem) { m = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nome: cab.motorista, origem, placa: cab.placa }; RT.motoristas.push(m); await guardarMot(); }
      } else if (m && cab.placa && m.placa !== cab.placa) { m.placa = cab.placa; await guardarMot(); }
      o.romaneios.push({ id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), arquivo: f.name, hash, em: new Date().toISOString(), motorista: (m ? m.nome : cab.motorista), placa: cab.placa, origem: (m ? m.origem : N.titulo(cab.origem)), filial: cab.filial, numero: cab.numero, data: cab.data, notas: cab.notas, volumes: cab.volumes, obs: cab.obs, paginas: cab.paginas, nfs: cab.nfs });
      novos++;
    }
    if (novos) { o.rev++; A.salvar(); }
    say(novos + ' romaneio(s) lido(s)' + (repetidos ? ', ' + repetidos + ' repetido(s) ignorado(s)' : '') + (falhas.length ? ' — ' + falhas.length + ' com problema: ' + falhas.join(' | ') : '') + '.');
    if (falhas.length) toast('⚠ ' + falhas.length + ' romaneio(s) não foram lidos. Veja a mensagem na aba XMLs.');
    A.atualizarTudo();
  }

  /* ================= aba XMLs: verde (romaneio + XML) · amarelo (só XML) · vermelho (só romaneio) ================= */
  const hs = RT.U.hoje;
  function renderXmls() {
    const box = $('#xm-box'), S = RT.S, o = S.op; if (!box) return;
    if (!o) { box.innerHTML = '<p class="sub">Abra uma operação.</p>'; return; }
    const linhas = N.quadroXml(o), roms = o.romaneios || [], m$ = N.fmtMoeda, i$ = N.fmtInt;
    const ligadosX = new Set(linhas.filter(l => l.rom && l.xml).map(l => l.xml.nome)), ligadosR = new Set(linhas.filter(l => l.rom && l.xml).map(l => l.rom.id));
    const xmlsLivres = linhas.filter(l => !l.rom && l.xml).map(l => l.xml.nome), romsLivres = linhas.filter(l => !l.xml && l.rom).map(l => l.rom);
    const cont = { verde: 0, amarelo: 0, vermelho: 0 }; linhas.forEach(l => cont[l.estado]++);
    const txt = { verde: 'Romaneio e XML', amarelo: 'Só o XML (sem romaneio)', vermelho: 'Só o romaneio — o XML NÃO entrou' };
    let h = '<div class="xm-topo"><label class="drop" id="xm-drop" style="flex:1;min-width:300px;padding:16px"><b>Arraste os romaneios (PDF) aqui</b><span>ou</span><span class="btn pri">Escolher PDFs</span><input type="file" id="xm-arq" accept=".pdf,application/pdf" multiple hidden></label>' +
      '<div class="xm-leg"><span><i class="q v on">✓</i> romaneio + XML <b>' + cont.verde + '</b></span><span><i class="q a on">●</i> só XML <b>' + cont.amarelo + '</b></span><span><i class="q r on">●</i> só romaneio <b>' + cont.vermelho + '</b></span></div></div>' +
      '<p class="dica" id="rom-status">O romaneio serve só para o cabeçalho (motorista, placa, origem) e para saber se o XML entrou. Quem manda nas notas é o XML.</p>';
    h += '<div class="tabela-wrap" style="max-height:none"><table class="tabela"><thead><tr><th></th><th>XML</th><th>Romaneio</th><th>Motorista</th><th>Placa</th><th>Origem</th><th class="dir">Notas</th><th class="dir">Vol.</th><th class="dir">Valor</th><th>Romaneio diz</th><th>Bipadas</th><th></th></tr></thead><tbody>' + linhas.map(l => {
      const x = l.xml, r = l.rom, bip = x ? o.notas.filter(n => n.origem === x.nome && (o.bipes || {})[n.id]).length : 0;
      const diz = r && r.notas != null ? (x ? ((r.notas === x.notas && r.volumes === x.vol) ? '<span style="color:var(--ok)">✓ ' + r.notas + ' / ' + i$(r.volumes) + '</span>' : '<b style="color:var(--no)">⚠ ' + r.notas + ' notas / ' + i$(r.volumes) + ' vol — o XML tem ' + x.notas + ' / ' + i$(x.vol) + '</b>') : r.notas + ' notas / ' + i$(r.volumes) + ' vol') : '<span class="livre-tag">—</span>';
      let acao = '';
      if (l.estado === 'amarelo' && romsLivres.length) acao = '<select class="filtro" data-xm-lig-x="' + esc(x.nome) + '" style="min-height:28px;padding:1px 6px"><option value="">ligar a um romaneio…</option>' + romsLivres.map(z => '<option value="' + esc(z.id) + '">' + esc(z.arquivo) + '</option>').join('') + '</select>';
      if (l.estado === 'vermelho' && xmlsLivres.length) acao = '<select class="filtro" data-xm-lig-r="' + esc(r.id) + '" style="min-height:28px;padding:1px 6px"><option value="">ligar a um XML…</option>' + xmlsLivres.map(z => '<option value="' + esc(z) + '">' + esc(z) + '</option>').join('') + '</select>';
      if (r) acao += ' <button class="btn mini" data-xm-ed="' + esc(r.id) + '" type="button" title="Corrigir motorista, placa e origem">✎</button><button class="btn mini perigo" data-xm-rm="' + esc(r.id) + '" type="button" title="Tirar este romaneio">✕</button>' + (l.como === 'manual' ? '<button class="btn mini" data-xm-des="' + esc(r.id) + '" type="button">desligar</button>' : '');
      return '<tr><td><span class="q ' + (l.estado === 'verde' ? 'v' : l.estado === 'amarelo' ? 'a' : 'r') + ' on" title="' + txt[l.estado] + (l.como ? ' (ligados por ' + l.como + ')' : '') + '">' + (l.estado === 'verde' ? '✓' : '●') + '</span></td><td>' + (x ? esc(x.nome) : '<b style="color:var(--no)">XML não entrou</b>') + '</td><td title="' + esc(r ? r.arquivo : '') + '">' + (r ? esc(r.arquivo) : '<span class="livre-tag">sem romaneio</span>') + '</td><td>' + esc(r ? r.motorista : '') + '</td><td>' + esc(r ? r.placa : '') + '</td><td>' + esc(r ? r.origem : '') + '</td><td class="dir">' + (x ? i$(x.notas) : '') + '</td><td class="dir">' + (x ? i$(x.vol) : '') + '</td><td class="dir">' + (x ? m$(x.valor) : '') + '</td><td>' + diz + '</td><td>' + (x ? bip + ' / ' + x.notas : '') + '</td><td style="white-space:nowrap">' + acao + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (!linhas.length) h += '<p class="dica">Nenhum XML nesta operação ainda.</p>';
    box.innerHTML = h;
    const q = $('#qt-xml'); if (q) { const p = roms.length ? cont.amarelo + cont.vermelho : 0; q.textContent = String(p); q.hidden = !p; }
  }
  const badgeXml = () => { const o = RT.S.op, q = $('#qt-xml'); if (!q) return; if (!o || !(o.romaneios || []).length) { q.hidden = true; return; } const l = N.quadroXml(o), p = l.filter(x => x.estado !== 'verde').length; q.textContent = String(p); q.hidden = !p; };

  function editarRomaneio(id) {
    const o = RT.S.op, r = o.romaneios.find(x => x.id === id); if (!r) return;
    U.modal('<h2>Corrigir romaneio</h2><p>' + esc(r.arquivo) + '</p><div style="display:grid;gap:8px"><label>Motorista<input class="filtro" id="ed-m" style="max-width:none;width:100%"></label><label>Placa<input class="filtro" id="ed-p" style="max-width:none;width:100%"></label><label>Origem<input class="filtro" id="ed-o" list="rom-origens2" style="max-width:none;width:100%"><datalist id="rom-origens2">' + origensConhecidas().map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></label></div><div class="botoes"><button class="btn" data-n>Cancelar</button><button class="btn pri" data-s>Salvar</button></div>', (f, fechar) => {
      f.querySelector('#ed-m').value = r.motorista || ''; f.querySelector('#ed-p').value = r.placa || ''; f.querySelector('#ed-o').value = r.origem || '';
      f.querySelector('[data-n]').onclick = () => fechar(null); f.querySelector('[data-s]').onclick = () => fechar({ m: f.querySelector('#ed-m').value.trim(), p: f.querySelector('#ed-p').value.trim().toUpperCase(), o: f.querySelector('#ed-o').value.trim() });
    }).then(v => { if (!v) return; r.motorista = v.m; r.placa = v.p; r.origem = v.o; o.rev++; RT.A.salvar(); RT.A.atualizarTudo(); });
  }

  /* ================= aba Cadastros: motoristas e origem ================= */
  function renderCadastros() {
    const box = $('#cd-box'); if (!box) return;
    const lista = RT.motoristas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    box.innerHTML = '<div class="cfg-card" style="max-width:none"><h2>Motoristas (' + lista.length + ')</h2><p class="sub" style="margin-bottom:10px">A origem de cada motorista fica salva para sempre. Quando você joga um romaneio, o Health Route reconhece o motorista pelo nome e só pergunta a origem se ele for novo.</p>' +
      '<div class="cd-novo"><input id="cd-nome" class="filtro" placeholder="Nome do motorista" autocomplete="off"><input id="cd-origem" class="filtro" list="cd-origens" placeholder="Origem (ex.: Cajamar)" autocomplete="off"><input id="cd-placa" class="filtro" placeholder="Placa (opcional)" style="width:130px" autocomplete="off"><button class="btn pri" id="cd-add" type="button">➕ Cadastrar</button></div><datalist id="cd-origens">' + origensConhecidas().map(o => '<option value="' + esc(o) + '">').join('') + '</datalist>' +
      (lista.length ? '<div style="overflow:auto;margin-top:12px"><table class="tabela"><thead><tr><th>Motorista</th><th>Origem</th><th>Placa</th><th></th></tr></thead><tbody>' + lista.map(m => '<tr><td>' + esc(m.nome) + '</td><td><input class="filtro" data-cd-o="' + esc(m.id) + '" value="' + esc(m.origem) + '" list="cd-origens" style="min-height:30px"></td><td><input class="filtro" data-cd-p="' + esc(m.id) + '" value="' + esc(m.placa || '') + '" style="min-height:30px;width:120px"></td><td><button class="btn mini perigo" data-cd-rm="' + esc(m.id) + '" type="button">remover</button></td></tr>').join('') + '</tbody></table></div>' : '<p class="dica">Nenhum motorista cadastrado ainda.</p>') + '</div>';
  }
  function ligarTelas() {
    const xm = $('#t-xmls');
    xm.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'xm-arq') { if (t.files.length) adicionarPdfs([...t.files]); t.value = ''; return; }
      const o = RT.S.op; if (!o) return;
      if (t.dataset.xmLigX && t.value) { const r = (o.romaneios || []).find(x => x.id === t.value); if (r) { r.xmlManual = t.dataset.xmLigX; o.rev++; RT.A.salvar(); RT.A.atualizarTudo(); } }
      else if (t.dataset.xmLigR && t.value) { const r = (o.romaneios || []).find(x => x.id === t.dataset.xmLigR); if (r) { r.xmlManual = t.value; o.rev++; RT.A.salvar(); RT.A.atualizarTudo(); } }
    });
    xm.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return; const o = RT.S.op;
      if (b.dataset.xmEd) editarRomaneio(b.dataset.xmEd);
      else if (b.dataset.xmDes) { const r = o.romaneios.find(x => x.id === b.dataset.xmDes); if (r) { delete r.xmlManual; o.rev++; RT.A.salvar(); RT.A.atualizarTudo(); } }
      else if (b.dataset.xmRm) { const r = o.romaneios.find(x => x.id === b.dataset.xmRm); if (r && await U.confirmar('Tirar este romaneio?', r.arquivo + ' sai da lista. Os XMLs e as notas não mudam.', 'Tirar', true)) { o.romaneios = o.romaneios.filter(x => x !== r); o.rev++; RT.A.salvar(); RT.A.atualizarTudo(); } }
    });
    const dz = () => $('#xm-drop');
    xm.addEventListener('dragover', e => { if (e.target.closest('#xm-drop')) { e.preventDefault(); dz().classList.add('sobre'); } });
    xm.addEventListener('dragleave', () => dz() && dz().classList.remove('sobre'));
    xm.addEventListener('drop', e => { if (!e.target.closest('#xm-drop')) return; e.preventDefault(); dz().classList.remove('sobre'); const f = [...e.dataTransfer.files].filter(x => /\.pdf$/i.test(x.name)); if (f.length) adicionarPdfs(f); else toast('Solte arquivos PDF.'); });
    const cd = $('#t-cadastros');
    cd.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'cd-add') { const nome = $('#cd-nome').value.trim(), origem = $('#cd-origem').value.trim(); if (!nome || !origem) { toast('Preencha o nome e a origem.'); return; } if (acharMot(nome)) { toast('Esse motorista já está cadastrado.'); return; } RT.motoristas.push({ id: 'm' + Date.now().toString(36), nome: nome.toUpperCase(), origem, placa: $('#cd-placa').value.trim().toUpperCase() }); await guardarMot(); renderCadastros(); toast('Motorista cadastrado.'); }
      else if (b.dataset.cdRm) { const m = RT.motoristas.find(x => x.id === b.dataset.cdRm); if (m && await U.confirmar('Remover ' + m.nome + '?', 'Ele deixa de ser reconhecido nos próximos romaneios (os já lidos não mudam).', 'Remover', true)) { RT.motoristas = RT.motoristas.filter(x => x !== m); await guardarMot(); renderCadastros(); } }
    });
    cd.addEventListener('change', async e => { const t = e.target; const m = RT.motoristas.find(x => x.id === (t.dataset.cdO || t.dataset.cdP)); if (!m) return; if (t.dataset.cdO) m.origem = t.value.trim(); else m.placa = t.value.trim().toUpperCase(); await guardarMot(); toast('Salvo.'); });
  }
  RT.rom = { pdfjs, textoDoCabecalho, ocr, adicionarPdfs, carregarMot, ligar: ligarTelas, render(t) { if (t === 'xmls') renderXmls(); else if (t === 'cadastros') renderCadastros(); }, badge: badgeXml };
})(typeof window !== 'undefined' ? window : globalThis);
