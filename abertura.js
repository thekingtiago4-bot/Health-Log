/* ================= v9.6.1 · Abertura animada de 5,5 s antes do login (v10.1.9: não se pula) ================= */
(function(){ const st=document.createElement('style'); st.textContent=`
#hs-cine{position:fixed;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vmin;background:radial-gradient(120vmax 80vmax at 50% 40%,#17656a 0%,#0f4c4c 35%,#062427 100%);overflow:hidden;cursor:pointer}
#hs-cine.fim{animation:hcSai .7s ease-in forwards}
.nv-cine .nv-caixa{opacity:0!important;pointer-events:none}
#hs-cine svg{width:min(68vh,94vw,780px);height:auto;overflow:visible;flex:none}
#hs-cine{gap:1.2vmin!important}
#hs-cine .hc-nome{font:700 clamp(2rem,7.5vmin,4.2rem)/1 "Barlow Semi Condensed","Barlow",sans-serif;color:#fff;letter-spacing:.02em;display:flex}
#hs-cine .hc-nome i{font-style:normal;display:inline-block;opacity:0;animation:hcLetra .55s cubic-bezier(.2,1.4,.4,1) forwards;white-space:pre}
#hs-cine .hc-sub{color:#9af5ea;letter-spacing:.5em;text-transform:uppercase;font-size:clamp(.7rem,1.9vmin,1rem);opacity:0;animation:hcSub .9s 4.1s ease-out forwards;padding-left:.5em}
#hs-cine .hc-barra{width:min(46vmin,300px);height:3px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:2vmin}
#hs-cine .hc-barra b{display:block;height:100%;width:100%;background:linear-gradient(90deg,#4fd1c5,#d9fffa);transform-origin:left;animation:hcBarra 5.3s cubic-bezier(.4,0,.2,1) forwards}

#hs-cine .pt{position:absolute;bottom:-12px;width:5px;height:5px;border-radius:50%;background:#9af5ea;opacity:0;animation:hcPt linear infinite}
#hs-cine .vb{transform-box:view-box;transform-origin:200px 200px}
.hc-onda{fill:none;stroke:#6fe3d6;stroke-width:1.2;opacity:0;animation:hcOnda 3s ease-out infinite}
.hc-cx{animation:hcPop .9s cubic-bezier(.2,1.5,.4,1) both}
.hc-anel{stroke-dasharray:100;animation:hcTraco 1.5s .4s cubic-bezier(.6,0,.2,1) both}
.hc-anel2{stroke-dasharray:100;animation:hcTraco 1.6s .9s cubic-bezier(.6,0,.2,1) both;opacity:.5}
.hc-ticks{opacity:0;animation:hcTicks 1.4s 1.5s ease-out forwards}
.hc-card{opacity:0;animation:hcFade .5s 2.1s forwards}
.hc-agulha{animation:hcAgulha 2.9s .9s cubic-bezier(.25,1,.35,1) both,hcBal 5s 3.9s ease-in-out infinite}
.hc-flash{opacity:0;animation:hcFlash 1.1s 3.5s ease-out}
.hc-rota{stroke-dasharray:100;stroke-dashoffset:100;animation:hcRota 2.2s 2.3s ease-in-out forwards}
.hc-pin{opacity:0;transform-box:fill-box;transform-origin:center bottom;animation:hcPin .5s cubic-bezier(.2,1.6,.4,1) forwards}
.hc-orb{animation:hcGira 3.2s linear infinite}.hc-orbr{animation:hcGira 4.6s linear infinite reverse}.hc-orbl{animation:hcGira 7s linear infinite}
.hc-o2{animation-delay:-1.6s}.hc-orbr.hc-o2{animation-delay:-2.3s}.hc-o3{animation-direction:reverse;animation-duration:9s}
.hc-orb,.hc-orbr,.hc-orbl{opacity:0;animation-name:hcGira,hcFade;animation-duration:3.2s,.8s;animation-delay:0s,1.6s;animation-iteration-count:infinite,1;animation-fill-mode:none,forwards;animation-timing-function:linear,ease-out}
.hc-orbr{animation-duration:4.6s,.8s;animation-direction:reverse,normal}.hc-orbl{animation-duration:7s,.8s;animation-delay:0s,.6s}.hc-o3{animation-duration:9s,.8s;animation-direction:reverse,normal}
#nv-tela::before{background:radial-gradient(circle at 50% 0,#d9fffa 0 3px,rgba(154,245,234,.5) 4px,transparent 9px),radial-gradient(circle at 50% 100%,#d9fffa 0 2px,transparent 7px)}
#nv-tela::after{background:radial-gradient(circle at 0 50%,#d9fffa 0 3px,rgba(154,245,234,.5) 4px,transparent 9px),radial-gradient(circle at 100% 50%,#fff 0 2px,transparent 7px)}
.hsl-brilho{filter:drop-shadow(0 0 3px #fff)}
@keyframes hcPop{from{transform:scale(0) rotate(-40deg);opacity:0}to{transform:none;opacity:1}}
@keyframes hcTraco{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@keyframes hcTicks{from{opacity:0;transform:rotate(-90deg) scale(.8)}to{opacity:.7;transform:none}}
@keyframes hcFade{to{opacity:1}}
@keyframes hcAgulha{0%{transform:rotate(-1080deg) scale(0);opacity:0}15%{opacity:1;transform:rotate(-900deg) scale(1)}70%{transform:rotate(24deg)}80%{transform:rotate(-14deg)}88%{transform:rotate(8deg)}95%{transform:rotate(-3deg)}100%{transform:rotate(0)}}
@keyframes hcBal{0%,100%{transform:rotate(0)}30%{transform:rotate(4deg)}65%{transform:rotate(-3deg)}}
@keyframes hcFlash{0%{opacity:.9;transform:scale(.3)}100%{opacity:0;transform:scale(2.4)}}
@keyframes hcRota{to{stroke-dashoffset:0}}
@keyframes hcPin{from{opacity:0;transform:translateY(-18px) scale(.3)}to{opacity:1;transform:none}}
@keyframes hcGira{to{transform:rotate(360deg)}}
@keyframes hcOnda{0%{opacity:.5;transform:scale(.55)}100%{opacity:0;transform:scale(1.35)}}
@keyframes hcLetra{from{opacity:0;transform:translateY(.6em) scale(.6) rotate(8deg)}to{opacity:1;transform:none}}
@keyframes hcSub{from{opacity:0;letter-spacing:1.2em}to{opacity:1;letter-spacing:.5em}}
@keyframes hcBarra{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes hcPt{0%{opacity:0;transform:translateY(0)}15%{opacity:.7}100%{opacity:0;transform:translateY(-105vh) translateX(var(--dx))}}
@keyframes hcSai{to{opacity:0;transform:scale(1.06)}}
/* v10.5.6 - abertura fluida: nenhum filtro por quadro, so transform/opacity */
#hs-cine{contain:layout paint style;backface-visibility:hidden}
#hs-cine svg [filter]{filter:none!important}
#hs-cine .hc-nome i,#hs-cine .hc-barra b,#hs-cine .pt{will-change:transform,opacity}
body.hs-cine-on #hs-splash *{animation:none!important;filter:none!important}`; document.head.appendChild(st); })();
function hsCineHtml(){ let ticks=''; for(let i=0;i<60;i++){ const g=i%5===0; ticks+=`<line x1="200" y1="${g?52:56}" x2="200" y2="${g?66:62}" stroke="#9af5ea" stroke-width="${g?2.4:1.2}" stroke-linecap="round" transform="rotate(${i*6} 200 200)"/>`; }
  let pts=''; const NPT=14; for(let i=0;i<NPT;i++) pts+=`<span class="pt" style="left:${Math.round(Math.random()*100)}%;--dx:${Math.round(Math.random()*120-60)}px;animation-duration:${(4+Math.random()*5).toFixed(1)}s;animation-delay:${(Math.random()*4).toFixed(1)}s;width:${3+Math.round(Math.random()*4)}px;height:${3+Math.round(Math.random()*4)}px"></span>`;
  const nome='Health Search'.split('').map((c,i)=>`<i style="animation-delay:${(3.2+i*0.07).toFixed(2)}s">${c===' '?'&nbsp;':c}</i>`).join('');
  const pin=(x,y,d)=>`<g class="hc-pin" style="animation-delay:${d}s"><path d="M${x} ${y} c-9 -12 -13 -18 -13 -25 a13 13 0 0 1 26 0 c0 7 -4 13 -13 25z" fill="#d9fffa"/><circle cx="${x}" cy="${y-25}" r="5" fill="#0f4c4c"/></g>`;
  return `${pts}<svg viewBox="34 34 332 332" aria-hidden="true">
  <defs><linearGradient id="hcBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0e444b"/><stop offset="1" stop-color="#061f23"/></linearGradient>
   <linearGradient id="hcA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9fffa"/><stop offset="1" stop-color="#4fd1c5"/></linearGradient>
   <radialGradient id="hcHalo"><stop offset=".62" stop-color="#6fe3d6" stop-opacity="0"/><stop offset=".82" stop-color="#9af5ea" stop-opacity=".30"/><stop offset="1" stop-color="#9af5ea" stop-opacity="0"/></radialGradient></defs>
  <circle class="hc-onda vb" cx="200" cy="200" r="190"/><circle class="hc-onda vb" cx="200" cy="200" r="190" style="animation-delay:1s"/><circle class="hc-onda vb" cx="200" cy="200" r="190" style="animation-delay:2s"/>
  <path class="hc-rota" pathLength="100" d="M-30 330 C60 250 90 360 170 300 S300 330 430 210" fill="none" stroke="#6fe3d6" stroke-width="3" stroke-linecap="round" stroke-dasharray="100" opacity=".55"/>
  ${pin(38,283,2.9)}${pin(362,262,4.2)}
  <rect class="hc-cx vb" x="50" y="50" width="300" height="300" rx="72" fill="url(#hcBg)" stroke="rgba(154,245,234,.25)" stroke-width="2"/>
  <circle cx="200" cy="200" r="150" fill="url(#hcHalo)"/>
  <g class="hc-ticks vb">${ticks}</g>
  <circle class="hc-anel" cx="200" cy="200" r="112" fill="none" stroke="url(#hcA)" stroke-width="12" stroke-linecap="round" pathLength="100" transform="rotate(-90 200 200)"/>
  <circle class="hc-anel2" cx="200" cy="200" r="92" fill="none" stroke="#6fe3d6" stroke-width="2" pathLength="100" transform="rotate(90 200 200)"/>
  <g class="hc-card" fill="#ffffff" stroke="#062227" stroke-width="5" stroke-linejoin="round" paint-order="stroke" font-family="Barlow Semi Condensed,Arial" font-weight="800" font-size="23" text-anchor="middle"><!-- v10.6.31: contorno escuro para não sumir no anel claro --><text x="200" y="101">N</text><text x="200" y="315">S</text><text x="307" y="208">L</text><text x="93" y="208">O</text></g>
  <circle class="hc-flash vb" cx="200" cy="200" r="90" fill="#d9fffa"/>
  <g class="hc-agulha vb"><path d="M200 108 L226 200 L200 292 L174 200 Z" fill="url(#hcA)"/><path d="M200 108 L226 200 L200 200 Z" fill="#fff"/><path d="M200 292 L174 200 L200 200 Z" fill="#2c9c92"/>
   <path d="M132 200 L200 182 L268 200 L200 218 Z" fill="#6fe3d6" opacity=".85"/><circle cx="200" cy="200" r="13" fill="#062427" stroke="#d9fffa" stroke-width="4"/></g>
  <g class="hc-orb vb"><circle cx="200" cy="200" r="112" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="9 91" transform="rotate(-90 200 200)" opacity=".85"/><circle cx="200" cy="88" r="5.5" fill="#fff"/></g><g class="hc-orb hc-o2 vb"><circle cx="200" cy="200" r="112" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" pathLength="100" stroke-dasharray="6 94" transform="rotate(-90 200 200)" opacity=".85"/><circle cx="200" cy="88" r="4.5" fill="#fff"/></g><g class="hc-orbr vb"><circle cx="200" cy="200" r="92" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" pathLength="100" stroke-dasharray="7 93" transform="rotate(-90 200 200)" opacity=".85"/><circle cx="200" cy="108" r="3.7" fill="#fff"/></g><g class="hc-orbr hc-o2 vb"><circle cx="200" cy="200" r="92" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" pathLength="100" stroke-dasharray="5 95" transform="rotate(-90 200 200)" opacity=".85"/><circle cx="200" cy="108" r="3.5" fill="#fff"/></g><g class="hc-orbl vb"><circle cx="200" cy="200" r="168" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" pathLength="100" stroke-dasharray="4 96" transform="rotate(-90 200 200)" opacity=".85"/><circle cx="200" cy="32" r="3.5" fill="#fff"/></g><g class="hc-orbl hc-o3 vb"><circle cx="200" cy="200" r="186" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" pathLength="100" stroke-dasharray="3 97" transform="rotate(-90 200 200)" opacity=".85"/><circle cx="200" cy="14" r="3.1" fill="#fff"/></g>
 </svg><div class="hc-nome">${nome}</div><div class="hc-sub">Relatórios Precisos</div><div class="hc-barra"><b></b></div>`; }
/* v9.6.5: a abertura toca sempre que o app abre (logado ou não), por cima da tela de carregamento */
(function(){ try{ if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const c=document.createElement('div'); c.id='hs-cine'; c.style.zIndex='2100'; c.innerHTML=hsCineHtml(); document.body.appendChild(c);
  document.body.classList.add('hs-cine-on');
  let fim=false; const sair=()=>{ if(fim) return; fim=true; document.body.classList.remove('hs-cine-on'); c.classList.add('fim'); setTimeout(()=>c.remove(),700); };
  /* v10.1.9 · a abertura não se pula: roda inteira, para ninguém entrar na tela antes da hora */
  setTimeout(sair,5600); }catch(e){ console.error(e); } })();
