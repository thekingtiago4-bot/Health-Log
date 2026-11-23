# Health Route — instruções para o Claude

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

- Rodovias/KM: `vias.js` pede ao OSRM público do FOSSGIS (routing.openstreetmap.de) um trecho por vez, de sede de cidade a sede de cidade (coordenadas IBGE; nunca endereço de cliente), 1 pedido a cada 1,1 s, com tentativas e espera; cada trecho fica guardado no aparelho (IndexedDB meta `via:`, validade 30 dias). KM = soma dos trechos da base até a última parada E a volta à base (ida e volta, decisão do Tiago), sem trânsito e sem o percurso dentro das cidades; cada trecho do veículo escolhido mostra km e rodovia (ref) no mapa. É estimativa e deve ser tratada assim. Se o serviço falha, o app avisa e desenha curvas; nunca inventa KM.

- Faixas: onde mais de uma rota usa o mesmo trecho de estrada, as linhas são deslocadas lateralmente (mapa.js `_calcularLanes`: células de ~250 m, ordem fixa pelo id do veículo, média móvel para transição suave) para nenhuma cobrir a outra. Contorno claro de todas primeiro, tracejados depois.

## Arquivos
`nucleo.js` regras puras · `mapa.js` canvas · `ui.js` utilitários + IndexedDB · `app.js` telas · `relatorios.js` · `bipagem.js` · `situacao.js` · `romaneio.js` · `vias.js` · `vendor/` (pdf.js e Tesseract, cópia do Health Search) · `abertura.js` animação (cópia do Health Search v10.6)
`data/municipios.json` sedes IBGE (fonte: IBGE Localidades 2022) · `data/malha.json` contornos (mesmo do Health Search)

## Publicar
Trocar `VERSAO` em `app.js`, `CACHE` em `sw.js` e `version.json`; rodar os testes; commit e push.

## Atalhos (v0.13)
- Ctrl+L = abre "Buscar nota" (Enter escolhe e centra o mapa; ↑/↓ navegam). Ctrl+V com a janela de pendentes aberta e fora de qualquer campo = A–Z → maior volume → maior valor → A–Z; a última ordem fica guardada (pref `pendOrdem`). Dentro de campo, Ctrl+V continua sendo colar.
- Cidades sem rota no dia também têm o nome no mapa, sem destaque.

## Final de Turno (v0.14, `turno.js`)
- Botão "🌙 Final de Turno" (Rotas): mostra o resumo (copiar/WhatsApp, como o Health Search). Só "Guardar" grava: meta `turno:<opId>:<data-hora>` (totais, rota, alocadas, bipagem, agendamentos, divergências, veículos com km, cidades pendentes, origens) + cópia de segurança da operação (`bk`, motivo "Final de turno"). Sem CPF/CNPJ/chave. Os relatórios futuros leem esses registros (`RT.turno.guardados()`).

## v0.15
- Nome do app: **Health LOG** — "Eficiência Máxima Em Roteirização" (tela, manifest, abertura).
- Janela flutuante clicada fica em foco (`.jan.foco`, `S.janFoco`); Ctrl+V gira A–Z → maior volume → maior valor na janela em foco (pendentes, clientes da cidade, veículos) e na tabela de Notas.
- Aviso (toast): × e arrastar para cima ignoram. Estados no mapa: linha branca de 2 px (escuro). Lápis do veículo: motorista + cor. Seta `#bt-rail` esconde o menu lateral (pref `railOculta`).
- 💾 Salvar / Ctrl+S: grava, espera e deixa cópia (`bk`, motivo "Salvar"); aviso ao fechar com gravação pendente/falha. "Instalar aplicativo" (beforeinstallprompt, com instruções se o navegador não oferecer).
- Geolocalização: cartão da cidade como no Health Search (Região e Base, "na lista"/"fora das listas", Mover/Ensinar, Desfazer).
