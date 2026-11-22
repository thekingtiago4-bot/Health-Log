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

## Arquivos
`nucleo.js` regras puras · `mapa.js` canvas · `ui.js` utilitários + IndexedDB · `app.js` telas · `relatorios.js` · `bipagem.js` · `abertura.js` animação (cópia do Health Search v10.6)
`data/municipios.json` sedes IBGE (fonte: IBGE Localidades 2022) · `data/malha.json` contornos (mesmo do Health Search)

## Publicar
Trocar `VERSAO` em `app.js`, `CACHE` em `sw.js` e `version.json`; rodar os testes; commit e push.
