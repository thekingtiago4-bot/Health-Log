/* Health Log. · feriados das cidades (como no Health Search): estaduais e municipais vêm da internet (guardados no aparelho),
   mais os que você inclui ou tira à mão. No mapa da Geolocalização a cidade com feriado fica em VERMELHO.
   Feriado nacional não pinta o mapa (seria o país inteiro) — só estadual, municipal e os cadastrados. */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const { N, U } = RT;
  const URLS = {
    est: 'https://raw.githubusercontent.com/joaopbini/feriados-brasil/HEAD/dados/feriados/estadual/json/{ano}.json',
    mun: 'https://raw.githubusercontent.com/joaopbini/feriados-brasil/HEAD/dados/feriados/municipal/json/{ano}.json'
  };
  const VALE_EST = 60 * 60 * 1000, VALE_MUN = 6 * 60 * 60 * 1000;   // a lista municipal é grande: baixa de novo só a cada 6 h
  const F = (RT.fer = { cache: {}, manual: [], estado: 'parado', erro: null, quando: null, _memo: null });
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const diaMais = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };
  const brIso = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''); };
  const mesmoNome = (a, b) => N.norm(a) === N.norm(b);
  F.diaMais = diaMais;

  F.carregar = async function () {
    try { const r = await RT.DB.get('meta', 'feriados'); if (r && r.v) F.cache = r.v; } catch (e) { /* sem cache: segue */ }
    try { const r = await RT.DB.get('meta', 'feriadosManual'); if (r && Array.isArray(r.v)) F.manual = r.v; } catch (e) { /* ok */ }
  };
  const guardar = () => RT.DB.put('meta', { k: 'feriados', v: F.cache }).catch(() => { /* só perde o cache */ });
  const guardarManual = () => RT.DB.put('meta', { k: 'feriadosManual', v: F.manual }).catch(e => U.toast('⚠ Não consegui guardar os feriados: ' + ((e && e.message) || e)));

  async function buscar(url) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 25000);
    try { const r = await fetch(url, { cache: 'no-store', signal: ac.signal }); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return await r.json(); }
    finally { clearTimeout(t); }
  }
  /* baixa (se estiver velho) os feriados estaduais e municipais dos anos da janela de hoje até +7 dias */
  F.atualizar = async function (forcar) {
    if (F.estado === 'buscando') return;
    const anos = [...new Set([0, 7].map(n => +diaMais(n).slice(0, 4)))], erros = [];
    F.estado = 'buscando'; F.erro = null;
    for (const ano of anos) {
      const c = (F.cache[ano] = F.cache[ano] || {}), agora = Date.now();
      if (forcar || !c.estEm || agora - c.estEm > VALE_EST) {
        try { const j = await buscar(URLS.est.replace('{ano}', ano)), est = {}; for (const x of j || []) { const uf = String(x.uf || '').toUpperCase(), d = brIso(x.data); if (uf && d) (est[uf] = est[uf] || []).push({ d, n: String(x.nome || 'Feriado estadual') }); } c.est = est; c.estEm = Date.now(); }
        catch (e) { if (e.status !== 404) erros.push('estaduais'); }
      }
      if (forcar || !c.munEm || agora - c.munEm > VALE_MUN) {
        try { const j = await buscar(URLS.mun.replace('{ano}', ano)), mun = {}; for (const x of j || []) { const cod = String(x.codigo_ibge || ''), d = brIso(x.data); if (cod && d) (mun[cod] = mun[cod] || []).push({ d, n: String(x.nome || 'Feriado municipal') }); } c.mun = mun; c.munEm = Date.now(); }
        catch (e) { if (e.status !== 404) erros.push('municipais'); }
      }
    }
    F.estado = 'pronto'; F.erro = erros.length ? [...new Set(erros)] : null; F.quando = new Date(); F._memo = null;
    await guardar();
    if (RT.G && RT.G.render) RT.G.render();
  };

  /* feriados de uma cidade num dia (estadual, municipal e cadastrados; "não é feriado" tira o de mesmo nome) */
  F.noDia = function (dia, code, uf) {
    const c = F.cache[+dia.slice(0, 4)] || {}, out = [];
    for (const x of (c.est || {})[uf] || []) if (x.d === dia) out.push({ tipo: 'Estadual', n: x.n });
    for (const x of (c.mun || {})[String(code)] || []) if (x.d === dia && !out.some(o => mesmoNome(o.n, x.n))) out.push({ tipo: 'Municipal', n: x.n });
    const man = F.manual.filter(m => m.d === dia && m.alvo === String(code)), tira = man.filter(m => m.t === '-');
    const res = out.filter(x => !tira.some(t => mesmoNome(t.n, x.n)));
    for (const m of man) if (m.t === '+') res.push({ tipo: 'Cadastrado', n: m.n, id: m.id });
    return res;
  };
  F.deCidade = function (code, uf, dias) { const out = []; for (let i = 0; i <= (dias == null ? 7 : dias); i++) { const d = diaMais(i); for (const x of F.noDia(d, code, uf)) out.push(Object.assign({ iso: d }, x)); } return out; };
  /* mapa: quais cidades têm feriado de hoje até hoje+ate dias (para pintar de vermelho) */
  F.mapa = function (ate) {
    const chave = diaMais(0) + '|' + ate + '|' + (F._memo ? F._memo.v : 0); if (F._memo && F._memo.k === chave) return F._memo.m;
    const m = new Map(), mun = RT.S.mun || {};
    for (const code in mun) { const uf = mun[code][1]; for (let i = 0; i <= ate; i++) { const d = diaMais(i), fs = F.noDia(d, code, uf); if (fs.length) { m.set(code, { iso: d, n: fs[0].n, tipo: fs[0].tipo }); break; } } }
    F._memo = { k: chave, m, v: F._memo ? F._memo.v : 0 }; return m;
  };
  const limpar = () => { F._memo = null; };
  F.incluir = async function (code, dia, nome) { F.manual.push({ id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), d: dia, n: String(nome).slice(0, 80), alvo: String(code), t: '+' }); limpar(); await guardarManual(); };
  F.tirar = async function (code, dia, nome) { F.manual.push({ id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), d: dia, n: String(nome).slice(0, 80), alvo: String(code), t: '-' }); limpar(); await guardarManual(); };
  F.remover = async function (id) { F.manual = F.manual.filter(m => m.id !== id); limpar(); await guardarManual(); };
  F.status = function () {
    if (F.estado === 'buscando') return 'Buscando os feriados na internet…';
    const c = F.cache[+diaMais(0).slice(0, 4)] || {}; const tem = !!(c.est || c.mun);
    if (F.erro) return (tem ? 'Usando os feriados guardados. ' : 'Feriados não carregados. ') + 'Não consegui buscar os ' + F.erro.join(' e ') + ' (sem internet?).';
    if (!tem) return 'Feriados ainda não carregados.';
    const q = Math.max(c.estEm || 0, c.munEm || 0); return 'Feriados atualizados às ' + new Date(q).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.';
  };
})(typeof window !== 'undefined' ? window : globalThis);
