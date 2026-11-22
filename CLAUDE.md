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
- Van = carga ≥ 15 volumes por parada (só classificação de folha; ainda não implementada aqui).

## Arquivos
`nucleo.js` regras puras · `mapa.js` canvas · `ui.js` utilitários + IndexedDB · `app.js` telas · `abertura.js` animação (cópia do Health Search v10.6)
`data/municipios.json` sedes IBGE (fonte: IBGE Localidades 2022) · `data/malha.json` contornos (mesmo do Health Search)

## Publicar
Trocar `VERSAO` em `app.js`, `CACHE` em `sw.js` e `version.json`; rodar os testes; commit e push.
