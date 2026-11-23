# Health Log. — instruções para o Claude (pasta health_route)

Módulo de **roteirização** que depois entra como aba dentro do Health Search (`thekingtiago4-bot/Health_Search`).
Identidade, linguagem e cuidado com dados são os do Health Search. Dono e único usuário por enquanto: Tiago (admin).

## Regras
- Português do Brasil em tudo que o usuário lê. Linguagem de galpão, não de TI.
- Botão criado é botão clicado: testar antes de entregar. `node testes/regressao.js` precisa passar.
- **Nunca versionar dados reais** (XML da SoftLog, PDFs, planilhas): têm clientes, CNPJ/CPF e valores. Testes usam só dados sintéticos.
- Dinheiro em centavos, peso em 1e-4 kg, volumes inteiros. Sem ponto flutuante nas somas.
- Banco local (IndexedDB) é a fonte de verdade. Erro de banco nunca apaga nem recria por cima. Cópia de segurança antes de qualquer ação destrutiva.
- Não inventar coordenadas, tempos, distâncias nem dados de NF. Cidade = sede municipal IBGE; os pontinhos dos clientes ficam EM VOLTA do marcador (não são o endereço).
- Estados diferentes: **alocada** (está num carro) ≠ conferida ≠ entregue. Hoje só existe "alocada".
- Identidade fiscal: chave de 44 dígitos prevalece; sem ela NF+remetente+destinatário. Número isolado não prova duplicidade.
- Parada = cliente (doc + CEP + endereço + número) dentro de uma cidade.
- Veículos: Carro, Van e Caminhão. Van e Caminhão diferem do carro **só pelo nome** (cabe mais volume); nenhuma regra de distribuição muda. Só se espera 1 caminhão: o 2º pede confirmação. Frota atual (informada pelo Tiago): 15 carros, 5 vans, 1 caminhão.
- Parada nos RELATÓRIOS = um endereço por dia (como no PDF do Tiago). Ticket por parada = valor das notas ÷ paradas.
- Fora de rota = só em listas LKR/BH/Cajamar do Health Search (ou DF) e em nenhuma região atendida; editável na Geolocalização. Cidade em nenhuma lista conta como EM ROTA (o mapa embutido é incompleto).

- Bipagem: bipada (conferida) ≠ alocada ≠ entregue. Bipe repetido não soma. Nota fora de todos os XMLs vai para o ROMANEIO EXTRA e só entra nos totais depois de completar cliente/cidade/UF/volumes/valor (a chave só dá NF, CNPJ do emitente e série — nada de inventar).
- Relatórios: só leem operações guardadas; cada dia importado precisa ser uma operação com a data certa.

- Api-Key do Meu Danfe: fica SÓ no navegador (IndexedDB meta `meudanfe`), nunca na operação, nas cópias, nos arquivos baixados nem no Git. A consulta só acontece para nota fora dos XMLs carregados (cada consulta é cobrada). API v2: GET /fd/get/xml/{chave}; só 404 autoriza PUT /fd/add/{chave}.

- Situação da nota: presente (✓, padrão) · agendamento (A) · divergência (!: sem volumes ou volumes parciais). Agendamento e divergência SAEM da rota (não entram em cidades, mapa nem totais da rota) mas continuam na operação e nos relatórios.
- Regra de agendamento (Tiago): nota que consta na lista de agendamentos é ocultada automaticamente, EXCETO a do romaneio com MESA no nome (continua na rota). Pop-up ao abrir o mapa lista as ocultadas; marcar = volta; “Não mostrar mais hoje” vale até meia-noite. O que o usuário devolve não é escondido de novo.
- A lista de agendamentos do Health Search é colada/importada aqui (não há acesso direto ao Supabase).

- Romaneio (PDF do SoftLog) serve SÓ para o cabeçalho (motorista, placa, origem, notas/volumes) e para saber se o XML entrou; nunca cria nota. Sem camada de texto → OCR local (Tesseract pt, vendor/ vindo do Health Search), em duas passadas (cabeçalho e tabela). Ligação com o XML: 1) escolha manual 2) mesmo título 3) mesmas notas e volumes 4) as mesmas NFs. Verde = romaneio+XML, amarelo = só XML, vermelho = só romaneio.
- Motoristas cadastrados (nome → origem, placa) valem para sempre; origem só é perguntada para motorista novo. Não guardar CPF/CNH (dado pessoal desnecessário).

- Mapa: projeção Mercator. Fundo "Estradas" = mapa NOSSO (fundo.js): MapLibre + dados abertos do OpenFreeMap/OpenStreetMap com estilo próprio (claro/escuro), SEM nomes de cidade (os nomes são do app) e só com rodovias+número; precisa de internet e WebGL, senão cai para só contornos. NÃO usar tiles raster do CARTO (exigem API key) nem os do OSM padrão (trazem nomes duplicados). Rotas = curvas tracejadas da BASE (padrão Araraquara/AQA, editável em Configurações) até as paradas, na ordem do veículo; é só desenho, sem distância nem tempo. Tema padrão: escuro.

- Rodovias/KM (v0.24: motor = **Valhalla** público do FOSSGIS, valhalla1.openstreetmap.de, com OSRM routing.openstreetmap.de só de reserva): `vias.js` pede um trecho por vez, de sede de cidade a sede de cidade (coordenadas IBGE; nunca endereço de cliente), 1 pedido a cada 1,1 s, com tentativas e espera; cada trecho fica guardado no aparelho (IndexedDB meta `via:`, validade 30 dias). KM = soma dos trechos da base até a última parada E a volta à base (ida e volta, decisão do Tiago), sem trânsito e sem o percurso dentro das cidades; cada trecho do veículo escolhido mostra km e rodovia (ref) no mapa. É estimativa e deve ser tratada assim. Se o serviço falha, o app avisa e desenha curvas; nunca inventa KM.

- Faixas: onde mais de uma rota usa o mesmo trecho de estrada, as linhas são deslocadas lateralmente (mapa.js `_calcularLanes`: células de ~250 m, ordem fixa pelo id do veículo, média móvel para transição suave) para nenhuma cobrir a outra. Contorno claro de todas primeiro, tracejados depois.

## Arquivos
`nucleo.js` regras puras · `mapa.js` canvas · `ui.js` utilitários + IndexedDB · `app.js` telas · `relatorios.js` · `bipagem.js` · `situacao.js` · `romaneio.js` · `vias.js` · `vendor/` (pdf.js e Tesseract, cópia do Health Search) · `abertura.js` animação (só o que a abertura de barras usa) · `turno.js` final de turno · `tema.js` tema + gatilho da abertura (arquivo próprio: a página não tem script embutido)
`data/municipios.json` sedes IBGE (fonte: IBGE Localidades 2022) · `data/malha.json` contornos (mesmo do Health Search)

## Publicar
Trocar `VERSAO` em `app.js`, `CACHE` em `sw.js` e `version.json`; rodar os testes; commit e push.

## Atalhos (v0.13)
- Ctrl+L = abre "Buscar nota" (Enter escolhe e centra o mapa; ↑/↓ navegam). Ctrl+V com a janela de pendentes aberta e fora de qualquer campo = A–Z → maior volume → maior valor → A–Z; a última ordem fica guardada (pref `pendOrdem`). Dentro de campo, Ctrl+V continua sendo colar.
- Cidades sem rota no dia também têm o nome no mapa, sem destaque.

## Final de Turno (v0.14, `turno.js`)
- Botão "🌙 Final de Turno" (Rotas): mostra o resumo (copiar/WhatsApp, como o Health Search). Só "Guardar" grava: meta `turno:<opId>:<data-hora>` (totais, rota, alocadas, bipagem, agendamentos, divergências, veículos com km, cidades pendentes, origens) + cópia de segurança da operação (`bk`, motivo "Final de turno"). Sem CPF/CNPJ/chave. Os relatórios futuros leem esses registros (`RT.turno.guardados()`).

## v0.15
- Nome do app: **Health Log** — "Eficiência Máxima Em Roteirização" (tela, manifest, abertura).
- Janela flutuante clicada fica em foco (`.jan.foco`, `S.janFoco`); Ctrl+V gira A–Z → maior volume → maior valor na janela em foco (pendentes, clientes da cidade, veículos) e na tabela de Notas.
- Aviso (toast): × e arrastar para cima ignoram. Estados no mapa: linha branca de 2 px (escuro). Lápis do veículo: motorista + cor. Seta `#bt-rail` esconde o menu lateral (pref `railOculta`).
- 💾 Salvar / Ctrl+S: grava, espera e deixa cópia (`bk`, motivo "Salvar"); aviso ao fechar com gravação pendente/falha. "Instalar aplicativo" (beforeinstallprompt, com instruções se o navegador não oferecer).
- Geolocalização: cartão da cidade como no Health Search (Região e Base, "na lista"/"fora das listas", Mover/Ensinar, Desfazer).
- v0.15.1: o service worker busca da REDE primeiro (cache só offline) e o app recarrega sozinho quando sai versão nova (ou avisa se houver gravação pendente), para o nome/versão nova aparecer sem limpar cache.
- v0.15.2: menu lateral escondido não pode zerar a tela (grid 1fr); fundo de estradas confere o tamanho do canvas ao sincronizar (evita mapa de fundo cortado).
- v0.16.0: símbolo = gráfico de barras minimalista (`icons/icone.svg` → icon-192/512, maskable, marca.png; animação de abertura com barras). Salvar = pílula flutuante `#bt-salvar` (como `#hs-salvar` do HS; botão direito = versões salvas). Fora de rota = bolinha laranja tracejada com contorno (antes cinza, quase invisível).
- v0.17.0: Buscar nota → "editar cidade" (situacao.js trocarCidade): troca cidade/UF/cMun da nota por município IBGE, guarda `cidadeOrig` (volta ao XML), opção de trocar as outras notas do mesmo cliente; reorganiza as cidades dos veículos. Ctrl+Z não desfaz (use "voltar à cidade do XML").
- v0.17.1: veículo com rastreio SIM acima do limite = aviso verde "Dentro do limite" (`.vei-alerta.ok`). Configurações → "Linha tracejada das rotas": em movimento (padrão) ou fixa (`cfg.rotaFixa`, `aplicarRotaAnim`; vale no mapa em outra tela; 'reduzir movimento' do sistema também deixa fixa).
- v0.18.0: janelas flutuantes redimensionáveis (`U.redimensionavel`: alças direita/baixo/canto; pref `tam:<id>` + `pos:<id>`); Configurações → "Resetar janelas flutuantes para o padrão" (`resetarJanelas`). Pendentes: nome com reticências, UF inteira (`.cn-nome` + `.tag`).
- v0.18.1: abertura sem pins de mapa e sem a linha ao fundo.
- v0.18.2: nome de marca = **Health Log.** (com ponto, nas telas de marca); linha 'Fixa' = contínua, sem tracejado e sem setas (`mapa.rotaFixa`).
- v0.18.3: faixa de veículos sem barra de rolagem (roda do mouse rola).

## Segurança e limpeza (v0.19)
- `index.html` tem CSP (meta): só scripts do próprio site (+ blob/wasm para PDF/OCR/mapa), nenhum script/evento embutido (`onclick=` etc. é bloqueado — use `addEventListener`). Hosts liberados para conexão: tiles.openfreemap.org, routing.openstreetmap.de, api.meudanfe.com.br. Novo serviço externo = liberar aqui de propósito.
- Operação importada/restaurada de arquivo passa por `N.sanearOp` (texto/números/cores/ids conferidos). Todo texto de XML/arquivo/usuário que vai para `innerHTML` passa por `esc()`.
- Links externos abrem com `noopener,noreferrer`. Nada de segredo no Git (Api-Key só no IndexedDB).
- Ícones PNG recomprimidos sem perda; CSS/JS mortos da bússola antiga removidos.

## v0.20
- Faixa de carros do topo RETIRADA (pedido do Tiago): escolher/editar/excluir veículo é na janela "Veículos e rotas"; clicar no cartão do veículo seleciona e dá zoom na rota dele.
- **Ctrl+F** (`abrirFocar`/`focarVeiculo`): pop-up `#pop-focar` com um quadradinho por veículo (número + cor); clique ou digitar o número escolhe o veículo, vai ao mapa e enquadra a rota. Vale em qualquer tela/janela; Esc fecha. Substitui o "buscar na página" do navegador.
- Buscar nota entra no Ctrl+V (A–Z cliente → maior volume → maior valor; `#busca-ordem`, pref `buscaOrdem`) quando a janela está em foco e o cursor não está no campo de texto.

## v0.21
- Menu: **Operação** (Montar rotas · Notas · XMLs e Romaneios · Folha de rotas · Geolocalização) · **Painel de Gestão** (Relatórios · Agendamentos · Divergências) · **Ajustes** (Configurações · Cadastros). O Mural do dia abre pela logo (sem item no menu). "Importar XML", bipagem, operações guardadas e cópias ficam no alto de "XMLs e Romaneios" (`irPara('importar')` vira `xmls`). Tema e "Instalar aplicativo" moram em Configurações.
- Sons (`U.som`, WebAudio sintetizado, pref `som`, liga/desliga em Configurações): `ok` quando uma cidade FICA completa (detectado em `reindexar`, não toca ao abrir operação nem ao desfazer) e `popup` quando abre qualquer janela modal (`U.modal`).

## v0.22 — Geolocalização como no Health Search
- Classificação por cidade (`geoClasse`): lista · ensinada (`S.reg.aprend[code][tipo]`) · **automática** (fora das listas, no meio de uma região/base; vizinhas mais próximas, `GEO_RAIO` 50 km, `GEO_K` 8, `GEO_MAX` 160, % de certeza) · fora · sem coordenadas. Automática NÃO conta para fora de rota; **ensinada conta** (`N.setRegioes` lê `aprend`). Confirmar/Ensinar/Esquecer no cartão da cidade; "Para conferir" lista as automáticas das cidades da operação aberta (+ Confirmar todas).
- Mapa: município colorido pela região; automática = preenchimento claro + contorno tracejado; ensinada = contorno escuro; nome da região no centro da área; legenda com contagem ("42 + 129 auto") que esconde/mostra a lista; Tela cheia; "Alimentar" abre colar lista / arrastar .txt / listas cadastradas.
- NÃO portado do HS (dependem de nuvem/Supabase ou de outro módulo): Publicar mapa / Usar mapa publicado / Diagnóstico, mapa de ruas por baixo, Abrir em outra janela. As listas que o HS publica na nuvem não estão acessíveis aqui: para trazê-las, usar Alimentar (colar a lista).

## v0.23 — Feriados e Editor de regiões (Geolocalização)
- `feriados.js` (`RT.fer`): estaduais e municipais vêm de raw.githubusercontent.com/joaopbini/feriados-brasil (CSP liberada), guardados no IndexedDB (`meta feriados`; estadual 1 h, municipal 6 h); feriados cadastrados/"não é feriado" por cidade em `meta feriadosManual`. Feriado NACIONAL não pinta o mapa. No mapa: cidade com feriado em VERMELHO (hoje mais forte; período hoje/+amanhã/3/7 dias); cartão da cidade lista os feriados e permite incluir/tirar.
- `geoeditor.js` (`RT.ged`): Editor de regiões (como no HS): clicar nas cidades-limite monta o contorno, "Fechar e aplicar" move as cidades de dentro para a lista (opção de não mexer nas que já são de outra), Lacunas (grava as automáticas), "Não fazemos" (aprend `-`, cinza), cor/nome/apelidos, só/excluir lista, desfazer. App expõe `RT.G` (classe, salvarReg, info, selecionar, render, interceptar).

## v0.23.1
- Ctrl+F/focar: `focarVeiculo` enquadra os pontos da rota + a base (`enquadrarPontos`, que agora respeita a janela de pendentes), mostra "Focando em…" e manda `{t:'foco'}` pelo BroadcastChannel — o mapa em outra tela (segundo monitor) também enquadra.
- Configurações: opções liga/desliga são SEMPRE a chave `.chave` (Ligado/Desligado, ou Sim/Não no tema); Instalar é o último cartão e, depois de instalado (`appinstalled`, modo app ou pref `instalado`), o botão fica desativado e cinza; Janelas flutuantes = um só botão "Resetar padrão".
- v0.23.2: pop-up do Ctrl+F é móvel (arrastar pelo título; pref `pos:focar`).
- v0.23.3: pop-up do Ctrl+F é FIXO na tela: só fecha no ✕ ou com Ctrl+F de novo (Esc e clique fora não fecham); escolher veículo não fecha; `desenharFocar` roda em `atualizarTudo`, então veículos novos aparecem sozinhos. Número 1–9 só vale com o cursor dentro do pop-up.
- v0.23.4: TODO pop-up/formulário com campo de texto abre com o cursor no primeiro campo (`U.modal` foca sozinho; Buscar → editar cidade/agendamento/divergência; Geolocalização foca a busca de cidade ao entrar e o nome da lista ao abrir Alimentar; editor: nome da nova lista). Ctrl+F: número do veículo (1–9) vale com o pop-up aberto, exceto se o cursor estiver num campo de texto (corrige a nota da v0.23.3).

## v0.24 — rotas, pedágio, ordem e menu
- `vias.js`: Valhalla (costing auto, `use_tolls` 1.0 = caminho mais direto com ou sem pedágio; 0.0 = "Evitar pedágio"), reserva OSRM (sem dado de pedágio, não é gravada no cache). Trechos guardados em `meta via:<chave>` com `mv:2`; o modo "evitar" tem chave própria (`#sempedagio`). Pedágio vem dos `maneuvers[].toll` do Valhalla: o ícone `$` (âmbar) fica no COMEÇO de cada trecho pedagiado (a praça está nesse trecho; não se inventa a posição exata) e o rótulo do km diz "· pedágio". Chip "Evitar pedágio" (`#bt-pedagio`, `cfg.evitarPedagio`, vale no mapa em outra tela). CSP liberou valhalla1.openstreetmap.de.
- Botão ↯ no cartão do veículo = "Menor KM" (`ordemMaisCurta`/`ordenarCurto`): reordena as cidades saindo/voltando à base pelo menor percurso em LINHA RETA (até 9 cidades testa tudo; acima, vizinho mais próximo + 2-opt). Ctrl+Z desfaz. O `optimized_route` do Valhalla público não serve (limite de 150 km).
- Menu lateral sem rolagem em qualquer altura de tela (espaços encolhem; abaixo de 820/700/600 px de altura some autoria, linhas do resumo e o subtítulo).
