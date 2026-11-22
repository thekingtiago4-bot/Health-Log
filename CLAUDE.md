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

## Arquivos
`nucleo.js` regras puras · `mapa.js` canvas · `ui.js` utilitários + IndexedDB · `app.js` telas · `relatorios.js` · `bipagem.js` · `situacao.js` · `romaneio.js` · `vendor/` (pdf.js e Tesseract, cópia do Health Search) · `abertura.js` animação (cópia do Health Search v10.6)
`data/municipios.json` sedes IBGE (fonte: IBGE Localidades 2022) · `data/malha.json` contornos (mesmo do Health Search)

## Publicar
Trocar `VERSAO` em `app.js`, `CACHE` em `sw.js` e `version.json`; rodar os testes; commit e push.
