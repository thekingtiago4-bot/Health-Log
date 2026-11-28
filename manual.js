/* Health Log. · MANUAL DO USUÁRIO (Ajustes → Manual). Capa, sumário e passo a passo de TODAS as funcionalidades, com fotos das telas,
   em páginas A4 separadas na tela e prontas para imprimir / salvar em PDF (logo do Health Log em todas as páginas).
   Para atualizar: edite a lista MAN abaixo (uma seção por assunto) e rode os testes. As fotos ficam em manual/*.jpg (dados de teste, nunca reais). */
(function (g) {
  'use strict';
  const RT = (g.RT = g.RT || {});
  const { U } = RT; const { $, esc } = U;
  const M = RT.man = {};

  /* ---------------------------------------------------------------- CONTEÚDO ---------------------------------------------------------------- */
  const MAN = [
    { id: 'inicio', t: 'Primeiros passos', img: 'montar', intro: 'O Health Log. monta as rotas do dia a partir dos XMLs da SoftLog: você importa as notas, distribui as cidades e clientes entre os veículos, confere o KM, imprime a folha e fecha o turno. Tudo fica guardado neste aparelho.',
      passos: [
        ['Abrir e instalar', 'Abra o endereço do Health Log. no Chrome (computador ou celular). Em Configurações → Instalar aplicativo (ou no ⬇ da barra do navegador) ele vira um aplicativo na área de trabalho. Depois de instalado, o botão fica cinza.'],
        ['Abertura e versão', 'Ao abrir aparece a animação das barras do Health Log. A versão fica no rodapé do menu lateral. O app se atualiza sozinho ao abrir; se algo parecer antigo, feche e abra de novo (ou Ctrl+F5).'],
        ['Menu lateral', 'Operação: Montar rotas, Notas, XMLs e Romaneios, Folha de rotas e Geolocalização. Painel de Gestão: Relatórios, Agendamentos e Divergências. Ajustes: Configurações, Cadastros e Manual. A seta ‹ no meio da borda esconde e mostra o menu. Os números ao lado dos itens mostram pendências.'],
        ['Resumo da operação', 'Na parte de baixo do menu: nome da operação, notas, volumes, % alocadas, carros e a hora do último “salvo”. Clicar na logo abre o Mural do dia.'],
        ['Salvar', 'Tudo é gravado sozinho a cada mudança. O botão flutuante 💾 Salvar (ou Ctrl+S) grava na hora e deixa uma cópia de segurança; clique com o botão direito nele para ver as versões salvas.'],
        ['Tema e sons', 'Claro ou escuro em Configurações → Tema (o escuro é o padrão). Sons de cidade completa e de pop-up podem ser ligados ou desligados em Configurações → Sons.'],
        ['Dados só neste aparelho', 'Operações, observações, preferências e a Api-Key do Meu Danfe ficam apenas no navegador deste aparelho (nada vai para a internet além das consultas de rota, mapa e Meu Danfe). Por isso, tire cópias: baixe a operação e use as cópias de segurança.']] },

    { id: 'importar', t: 'Importar XML e operações', img: 'xmls', intro: 'Uma operação é o dia de trabalho: as notas dos XMLs, os veículos e as rotas. Cada dia importado vira uma operação com a data que você escolher (os Relatórios leem delas).',
      passos: [
        ['Importar os XMLs', 'Em XMLs e Romaneios → Importar XML, arraste os arquivos da SoftLog (ou clique e escolha). O app mostra uma prévia antes de gravar: notas novas, repetidas e conflitos.'],
        ['Destino e data', 'Escolha “adicionar à operação atual” ou “criar uma operação nova” (nome e data). A data certa é importante: é ela que os Relatórios e o Boletim usam.'],
        ['Repetidas e conflitos', 'Nota repetida não entra de novo. Se a mesma nota vier com valores diferentes, ela aparece como conflito e você decide. Arquivo que não é da SoftLog vira um erro explícito.'],
        ['Operações guardadas', 'A lista abaixo traz todas as operações deste aparelho: abrir, baixar (arquivo .json) ou excluir. Abrir uma operação antiga troca a que está na tela.'],
        ['Cópias de segurança', 'Antes de qualquer ação destrutiva (excluir carro com carga, restaurar, encerrar) o app guarda uma cópia. Em “Cópias de segurança” você restaura qualquer uma como uma operação nova.'],
        ['Agendamentos', 'Notas que constam na lista de Agendamentos saem da rota sozinhas (exceto romaneio com MESA no nome). Um pop-up ao abrir o mapa lista as ocultadas; marque as que quer devolver.']] },

    { id: 'romaneios', t: 'Romaneios, bipagem e Romaneio - EXTRA', img: 'xmls', intro: 'O romaneio (PDF da SoftLog) dá motorista, placa e origem e confere se o XML entrou. A bipagem confere as notas na mão.',
      passos: [
        ['Romaneios (PDF)', 'Arraste os PDFs em Romaneios (PDF). Sem camada de texto, o app lê por OCR no próprio aparelho. Ele nunca cria notas: serve só para o cabeçalho e para saber se o XML entrou.'],
        ['Verde, amarelo e vermelho', 'Verde = romaneio e XML ligados. Amarelo = só o XML. Vermelho = só o romaneio. A ligação é por escolha sua, mesmo título, mesmas notas e volumes ou as mesmas NFs.'],
        ['Motoristas', 'Em Cadastros ficam os motoristas (nome → origem e placa). Origem só é perguntada para motorista novo. CPF e CNH não são guardados.'],
        ['Bipar notas', 'Em Bipar notas, bipe a chave de 44 dígitos (ou o número da NF). Bipada ≠ alocada ≠ entregue. Bipe repetido não conta de novo.'],
        ['Botão XML (Montar rotas)', 'O botão XML abre um pop-up para bipar a chave de uma nota que NÃO está nos XMLs. Com a Api-Key do Meu Danfe (Configurações) o app busca cliente, cidade, volumes e valor e a nota entra no ROMANEIO - EXTRA. Sem a chave, ela vai para a lista de extras para você completar à mão.'],
        ['Conferência por origem', 'A tela mostra quantas notas de cada origem já foram bipadas, com barra de progresso.']] },

    { id: 'mapa', t: 'Montar rotas — o mapa', img: 'montar', intro: 'A tela principal: o mapa com uma bolinha por cidade, as janelas flutuantes e a barra de cima.',
      passos: [
        ['Bolinhas e cores', 'Cada cidade com nota é uma bolinha. Anel vazio = sem carro; fatia colorida = a cor do carro que levou; selo amarelo ! = falta nota; selo verde ✓ = completa; bolinha laranja tracejada = fora de rota; cinza com listras = não vai hoje. A legenda do canto mostra tudo.'],
        ['Rotas no mapa', 'As linhas tracejadas saem da base (padrão Araraquara) e passam pelas cidades de cada veículo, na ordem das paradas, seguindo as estradas. Onde duas rotas dividem a estrada, as linhas ficam lado a lado. Os números mostram a ordem da parada.'],
        ['Mover e aproximar', 'Arraste para mover; a roda do mouse (ou + e −) aproxima e afasta. “Enquadrar mapa” mostra todas as cidades da operação (com Shift inclui as muito isoladas).'],
        ['Realce', 'O botão Realce (no canto do mapa) regula o destaque das cidades do dia: forte, suave ou nenhum. Também regula o vermelho dos feriados.'],
        ['Feriados', 'Cidade da rota do dia que está em feriado fica vermelha. O botão Feriados mostra ou oculta, também em vermelho, as cidades em feriado que não têm nota no dia.'],
        ['Observação 📄', 'Um papel amarelo em cima da cidade avisa que há observação guardada de algum cliente ou nota dela (veja “Editar informações”).'],
        ['Visual do mapa', 'Em Configurações → Visual do mapa: Padrão (cidades destacadas) ou Simplificado (só as bolinhas e os caminhos que saem delas). A escolha é sua e fica neste aparelho.']] },

    { id: 'cidade', t: 'Cidades, clientes e notas', img: 'cidade', intro: 'Clicar numa cidade abre a janela dela com os clientes e as notas para distribuir entre os veículos.',
      passos: [
        ['Abrir a cidade', 'Clique na bolinha, na lista de Pendentes ou escreva o nome em Buscar cidade. Dá para ter várias janelas de cidade abertas ao mesmo tempo; clicar de novo numa cidade aberta só a traz para a frente.'],
        ['Marcar e concluir', 'Marque clientes (ou abra a seta ▸ e escolha notas uma a uma) e clique em Concluir → Carro N. O botão “todos” marca todas as notas livres. Cancelar descarta as marcações. Enter também conclui.'],
        ['Levar para', 'Sem nenhuma janela de veículo aberta aparecem todos os carros em “Levar para”; clicar num carro abre a janela só dele. Com UMA janela de carro aberta, as notas vão para ele (não aparece escolha). Com duas ou mais, só aparecem os carros das janelas abertas.'],
        ['Cinza = já está em outro carro', 'Nota ou cliente de outro carro fica cinza com a etiqueta do carro. “Liberar” devolve para você poder mover. Concluir mostra um aviso com Desfazer.'],
        ['Ordenar clientes', 'A caixa A–Z / Maior volume / Maior valor ordena os clientes. Com a janela em foco, Ctrl+V gira a ordem.'],
        ['Selecionar todas', 'Na lista de Pendentes, o quadrado ao lado da cidade põe TODAS as notas e clientes dela no carro escolhido de uma vez (e desmarcar tira de novo).'],
        ['Fora de rota', 'No cabeçalho da cidade, “marcar fora de rota” tira a cidade do trabalho do dia (continua no mapa e na lista de baixo). “trazer para a rota” desfaz.']] },

    { id: 'veiculos', t: 'Veículos e rotas', img: 'montar', intro: 'Carro, Van e Caminhão diferem só pelo nome. Cada veículo tem a sua cor, a sua janela e a sua sequência de cidades.',
      passos: [
        ['Criar', '+ Carro, + Van e + Caminhão na barra de cima. O veículo novo já abre a janela própria. Só se espera um caminhão: o segundo pede confirmação.'],
        ['Janela do veículo', 'Mostra o resumo (valor, volumes, paradas, peso, cidades e KM), as cidades na ordem (numeradas) e as notas. A faixa lateral e o cabeçalho levam a cor do carro. Dá para mover, redimensionar, recolher (–) e fechar (✕).'],
        ['Lista Rotas', 'O botão Rotas abre a lista com todos os veículos. Clicar no carro seleciona, dá zoom na rota dele e abre a janela só dele.'],
        ['Motorista e cor', 'O lápis (✎) edita o nome do motorista e a cor do carro. Rastreio: o botão alterna sem marca → sim → não.'],
        ['Ordem das paradas', 'A ordem é a em que você foi adicionando as cidades: o app não reordena sozinho. Para mudar, arraste a cidade (⠿) ou use ▲ e ▼.'],
        ['Mover notas', 'Marque notas na janela do veículo e use “mover para” outro carro ou “tirar do veículo”. Ao marcar a cidade inteira, as notas dela vão juntas.'],
        ['Avisos do veículo', 'Alerta amarelo: valor acima do limite que VOCÊ definiu (campo “alerta acima de R$”); com rastreio SIM o aviso fica verde. Aviso azul/verde de rodagem mínima (padrão 400 km, campo “aviso abaixo de”): só aviso, não obriga.'],
        ['Excluir', 'O ✕ do veículo com carga pede confirmação, guarda uma cópia de segurança e devolve as notas para as pendentes. Dá para Desfazer.'],
        ['Focar (Ctrl+F)', 'Abre um pop-up com um quadradinho por veículo (número e cor). Clique, ou digite 1 a 9, para ir ao mapa e enquadrar a rota inteira. Fica aberto até você fechar (✕ ou Ctrl+F) e pode ir para a segunda tela.']] },

    { id: 'pendentes', t: 'Pendentes e Romaneios (janelas)', img: 'montar', intro: 'Duas janelas ajudam a decidir o que sai hoje.',
      passos: [
        ['Cidades pendentes', 'Lista as cidades que ainda têm nota sem carro, com notas, volumes e valor que FALTAM. Filtre pelo nome, ordene por A–Z, volume ou valor (Ctrl+V gira). O rodapé soma o que ainda falta.'],
        ['Ver as notas', 'A seta ▸ ao lado do nome abre as notas da cidade, das mais caras para as mais baratas, com o carro de cada uma.'],
        ['Concluídas', 'Duplo clique no contador mostra também as cidades completas. Fora de rota e Não vão hoje ficam em seções que abrem e fecham no fim da lista.'],
        ['Romaneios', 'O botão Romaneios abre um cartão por romaneio de hoje. Abra e DESMARQUE as cidades que não vão hoje: as notas saem dos carros e dos totais. Uma cidade sem nenhuma nota restante fica cinza com listras no mapa; dá para abrir e ver as notas, mas não dá para pôr em carro. Marcar de novo traz de volta. Tem Desfazer.']] },

    { id: 'km', t: 'KM, tempo e pedágio', img: 'km', intro: 'O KM é uma estimativa por estrada, de sede de cidade a sede de cidade, sem trânsito. Nunca é inventado: se o serviço de rotas falha, o app avisa e desenha curvas.',
      passos: [
        ['Como o Google Maps (padrão)', 'A rota mais rápida, com KM e tempo pela média de dois serviços de rota (Valhalla e OSRM), o que chega bem perto do Google Maps. Em Configurações → Cálculo do KM você pode trocar para “Caminho mais curto” (menor distância, aceitando estradinha e vicinal).'],
        ['KM do veículo', 'Soma da base até a última parada E a volta à base (ida e volta). Aparece no cartão do veículo e, ao clicar no trecho, o mapa mostra o KM e a rodovia.'],
        ['Botão KM', 'Abre uma janela que calcula SOZINHA o KM de cada rota e soma o KM Total, atualizando em tempo real enquanto os trechos chegam. “Recalcular tudo” refaz.'],
        ['Folha de rotas', 'A folha traz a linha KM TOTAL de cada rota e o total geral.'],
        ['Pedágio', 'O ícone $ marca o começo de trechos com pedágio (informação do serviço de rotas). O app não evita pedágio.'],
        ['Cache', 'Cada trecho calculado fica guardado por 30 dias neste aparelho; o mesmo trecho não é pedido de novo.']] },

    { id: 'buscar', t: 'Buscar nota, Editar informações e observações', img: 'editar', intro: 'Encontre qualquer nota e corrija o que veio errado no XML.',
      passos: [
        ['Buscar nota (Ctrl+L)', 'Digite NF, cliente, cidade, endereço ou origem. Enter escolhe a nota, centra o mapa na cidade e deixa a nota marcada. ↑ e ↓ navegam. Ctrl+V ordena a lista.'],
        ['Presente, Agendamento, Divergência', 'Cada nota tem três estados: ✓ presente (vai na rota), A agendamento e ! divergência (sem volumes ou volumes parciais). Agendamento e divergência SAEM da rota, mas continuam na operação e nos relatórios.'],
        ['Editar informações (botão direito)', 'Clique com o botão direito num cliente (ou numa nota) da janela da cidade, da tabela Notas, da busca ou da lista do veículo. Dá para mudar volumes, valor, endereço, número e CIDADE (com a opção de valer para as outras notas do cliente). O que veio no XML fica guardado e há “voltar ao XML”.'],
        ['Observação do cliente ou da nota', 'Escreva, por exemplo, “Cliente recebe até 14h”. A observação fica guardada para sempre. Sempre que esse cliente ou nota estiver na rota do dia: aparece o papel 📄 em cima da cidade, uma faixa amarela dentro da janela da cidade e um aviso ao abrir a operação.'],
        ['Cancelar', 'Cancelar (ou Esc) fecha sem mudar nada. Ctrl+Z não desfaz edição de volumes, valor ou endereço.']] },

    { id: 'geo', t: 'Geolocalização, regiões e feriados', img: 'geo', intro: 'Mostra a região (rota) e a base que atendem cada cidade, no mesmo padrão do Health Search.',
      passos: [
        ['Consultar', 'Digite a cidade (ex.: Varginha, Marília) e veja a região e a base dela no cartão: na lista, ensinada por você, automática (fora das listas, mas no meio de uma região, com % de certeza) ou fora.'],
        ['Mapa', 'Cada município é pintado pela região. Automática = preenchimento claro e contorno tracejado; ensinada = contorno escuro; “Não fazemos” = cinza. A legenda esconde/mostra cada lista. “Estradas” liga o mapa de ruas; “Abrir em outra janela” abre só o mapa; “Tela cheia” amplia.'],
        ['Ensinar e confirmar', 'No cartão da cidade: Confirmar (aceita a automática), “Corrigir para…” + Ensinar, e Esquecer (apaga o que você ensinou). Em “Para conferir” ficam as automáticas das cidades da operação, com “Confirmar todas”.'],
        ['Alimentar', 'O botão Alimentar traz listas novas: arraste PDF (com texto ou escaneado) ou TXT, ou cole a lista. O app corrige a grafia, mostra uma prévia editável (nome, tipo, apelidos) e só grava em “Salvar lista”. Título com BASE vira base.'],
        ['Editor de regiões', 'Delimitar: escolha em “Aplicar em” a região (ou base, ou + Nova) e clique, em ordem, nas cidades-limite; “Fechar e aplicar” põe as de dentro na lista. “Não fazemos” deixa a cidade cinza. “Esquecer” tira a cidade das listas e a deixa sem nada, na cor normal. Lacunas grava as automáticas. Também há cor, nome e apelidos de cada lista e Desfazer.'],
        ['Feriados', 'Os feriados estaduais e municipais vêm da internet (e ficam guardados). A cidade em feriado fica vermelha no mapa da Geolocalização e das rotas; o cartão da cidade lista os feriados e deixa incluir ou tirar um (“não é feriado”).'],
        ['Fora de rota', 'Só lista LKR, BH, Cajamar (ou DF) e que não esteja em nenhuma região atendida é fora de rota. Cidade que não está em nenhuma lista conta como EM ROTA.'],
        ['Importar do Health Search', 'Em Alimentar → Trazer o mapa do Health Search: leia o “Backup do banco” (.json ou .json.gz) e as regiões, bases e etiquetas ensinadas SUBSTITUEM as atuais (com cópia de segurança).']] },

    { id: 'notas', t: 'Notas, Agendamentos e Divergências', img: 'notas', intro: 'As telas de consulta e de exceções.',
      passos: [
        ['Notas', 'Tabela com todas as notas da operação: NF, origem, cliente, cidade, volumes, peso, valor, carro e situação. Clique no título da coluna para ordenar; filtre por carro, origem ou texto; Ctrl+V gira a ordem. Botão direito numa linha edita as informações.'],
        ['Agendamentos', 'Cole a lista de agendamentos (a lista do Health Search é colada aqui). As notas dessa lista saem da rota. A tela mostra o que está agendado, data e hora; “voltar para a rota” devolve a nota.'],
        ['Divergências', 'Notas sem volumes ou com volumes parciais (informe quantos chegaram). Elas saem da rota e aparecem aqui até serem resolvidas.'],
        ['Contadores', 'Os números do menu mostram quantas notas há em cada situação.']] },

    { id: 'folha', t: 'Folha de rotas', img: 'folha', intro: 'O documento do dia: uma rota por veículo, pronto para imprimir.',
      passos: [
        ['O que mostra', 'Topo com a logo, “ROTA dd/mm/aaaa” e a hora de emissão. Um cartão por veículo: cidades na ordem, volumes, paradas, valor e KM TOTAL. No fim, os totais.'],
        ['Aviso de incompleta', 'Se ainda há notas sem carro aparece um aviso amarelo com quantas e quanto valem.'],
        ['Imprimir', 'O botão “Imprimir / salvar PDF” abre a impressão (A4 paisagem). Na impressão a folha sai clara, mantendo as cores dos carros.']] },

    { id: 'turno', t: 'Final de Turno', intro: 'Resume o dia e encerra a operação para começar a próxima.',
      passos: [
        ['Resumo', 'O botão ☀ Final de Turno mostra o resumo (notas, volumes, valor, % alocadas, cidades completas/parciais/pendentes, bipagem, agendamentos, divergências, fora de rota, veículos com KM e o que ficou pendente). Copiar e WhatsApp mandam o texto.'],
        ['Guardar', 'Só “Guardar” grava (com confirmação): registra o turno, faz cópia de segurança, GUARDA a operação (os Relatórios leem dela) e LIMPA a tela: XMLs, notas, veículos e rotas. A próxima importação começa uma nova operação.'],
        ['Ver guardados', 'Ver guardados lista os turnos anteriores. Cancelar não muda nada.']] },

    { id: 'rel', t: 'Relatórios e Boletim diário', img: 'boletim', intro: 'Painel de Gestão → Relatórios tem duas abas.',
      passos: [
        ['Demanda e valor das entregas', 'Compara períodos (ou mostra um só) com paradas previstas, notas fiscais, ticket por parada, valor, volumes, peso, principais destinos e clientes. Atalhos: mês atual, mês anterior, anterior × atual e últimos 30 dias. Uma parada é um endereço por dia; nota repetida entre operações conta uma vez.'],
        ['Boletim diário', 'Um boletim por dia de operação (◀ ▶, data, Hoje, Último dia): valor da operação, notas, cidades, paradas, volumes e kg com ▲▼ sobre o dia anterior; carga por transporte (Carro, Van, Caminhão, A definir); agendamentos e divergências.'],
        ['Gráficos e comparativos', 'Dois gráficos da semana (volumes e valor, segunda a domingo, com o melhor dia em destaque) e comparativos com o dia anterior, o mesmo dia da semana passada, a semana, o mês e o ano, mais os últimos dias. O histórico começa no dia da primeira rota criada.'],
        ['Imprimir', 'O botão Imprimir gera A4 retrato com a logo em todas as páginas.']] },

    { id: 'janelas', t: 'Janelas flutuantes e segunda tela', intro: 'As janelas são como post-its sobre o mapa.',
      passos: [
        ['Mover e redimensionar', 'Arraste pelo título. As bordas direita e de baixo e o canto redimensionam. O conteúdo encolhe junto quando a janela fica estreita. Posição e tamanho são lembrados.'],
        ['Em foco', 'A janela clicada fica em foco (moldura destacada): é nela que Ctrl+V age. A que você mexeu por último vem para a frente.'],
        ['Mapa em outra tela', 'O botão Mapa em outra tela abre o mapa numa janela para o segundo monitor; esta tela vira uma parede para as janelas. Cada janela ganha o botão ⇥ para ir para a segunda tela e ⇤ para voltar. A posição e o tamanho na segunda tela são lembrados à parte.'],
        ['Parede', 'Na tela das janelas, o botão Cor de fundo escolhe entre 12 cores (escuras no tema escuro, claras no claro) ou uma cor livre.'],
        ['Resetar', 'Configurações → Janelas flutuantes → Resetar padrão devolve tamanho e posição de todas.'],
        ['Pop-ups', 'Os pop-ups abrem na mesma tela de onde você clicou.']] },

    { id: 'musica', t: 'Música (Spotify)', img: 'musica', intro: 'Um Spotify dentro do app, numa janela flutuante.',
      passos: [
        ['Preparar (uma vez)', 'Abra developer.spotify.com/dashboard, crie um app, ponha a Redirect URI mostrada na janela, marque Web API e Web Playback SDK, copie o Client ID e cole na janela ♪ Música.'],
        ['Entrar', 'Clique em Conectar ao Spotify: você entra no site do Spotify e volta. O Health Log não vê nem guarda a sua senha (login seguro PKCE).'],
        ['Usar', 'Busque músicas, artistas, playlists e álbuns, escolha uma das suas playlists e use tocar/pausar, anterior, próxima, posição e volume. Tocar dentro do app exige conta Premium (regra do Spotify).'],
        ['Sem Premium', 'Sem Premium use “Ouvir sem login”: cole o link de uma playlist ou álbum e ouça as prévias pelo player incorporado.']] },

    { id: 'config', t: 'Configurações e Cadastros', img: 'config', intro: 'Ajustes do aparelho. Nada daqui vai para as cópias de segurança nem para os arquivos baixados.',
      passos: [
        ['Meu Danfe (API)', 'Cole a Api-Key para buscar notas que não estão nos XMLs (cada consulta é cobrada pelo Meu Danfe). A chave fica só neste navegador; o campo não mostra a chave de volta; “Remover chave” apaga.'],
        ['Base de saída', 'A cidade de onde as rotas saem e voltam (padrão Araraquara, AQA).'],
        ['Tema, sons, linha da rota', 'Tema escuro/claro; sons; linha tracejada em movimento ou fixa (inteira, sem setas).'],
        ['Cálculo do KM e visual do mapa', 'Como o Google Maps ou caminho mais curto; mapa Padrão ou Simplificado.'],
        ['Janelas flutuantes e instalar', 'Resetar padrão das janelas e Instalar aplicativo (fica cinza depois de instalado).'],
        ['Cadastros', 'Motoristas cadastrados (nome, origem e placa) e a lista de origens; valem para sempre.']] },
  ];

  /* ---------------------------------------------------------------- ATALHOS (TUDO) ---------------------------------------------------------------- */
  const TECLADO = [
    ['Ctrl + Espaço', 'Esconde / mostra o menu lateral (o mesmo da seta ‹ na borda do menu).'],
    ['Ctrl + L', 'Buscar nota: abre a janela e leva o cursor para o campo. Enter escolhe, ↑ ↓ navegam, Esc fecha.'],
    ['Ctrl + C', 'Sem nada selecionado e fora de um campo: vai direto para “Buscar cidade”. Com texto selecionado continua copiando.'],
    ['Ctrl + F', 'Abre/fecha o pop-up Focar (um quadradinho por veículo). Vale em qualquer tela e substitui a busca do navegador.'],
    ['1 a 9', 'Com o pop-up Focar aberto (e o cursor fora de campo de texto): vai ao veículo de mesmo número e enquadra a rota.'],
    ['Ctrl + V', 'Na janela em foco, gira a ordem: A–Z → maior volume → maior valor → A–Z (Pendentes, clientes da cidade, veículos, Buscar nota) e na tabela de Notas. Dentro de campo continua colando.'],
    ['Ctrl + S', 'Salvar agora: grava e deixa uma cópia de segurança.'],
    ['Ctrl + Z', 'Desfazer a última alteração das rotas (notas movidas, carros, sequência, cidades que não vão hoje). Não desfaz edição de volumes/valor/endereço.'],
    ['Enter', 'Na janela da cidade: conclui (Concluir → Carro). Em Buscar cidade: abre a cidade. Em Buscar nota, no Bipar notas, no pop-up XML e em campos de confirmação: confirma.'],
    ['Esc', 'Fecha a janela da cidade em foco, o Buscar nota, o editor de regiões e os pop-ups (Cancelar). No pop-up Focar não fecha (use ✕ ou Ctrl+F).'],
    ['↑  ↓', 'Em Buscar nota: escolhe a nota. Nas sugestões de cidade: navega.'],
    ['Tab', 'Anda entre botões e campos da tela.'],
    ['Enter / Espaço na logo', 'Abre o Mural do dia (pelo teclado).'],
    ['Shift + Enquadrar', 'Ao clicar em Enquadrar mapa com Shift, inclui as cidades muito isoladas.'],
  ];
  const MOUSE = [
    ['Clique na bolinha', 'Abre a janela da cidade (e centra no mapa se veio da busca).'],
    ['Botão direito', 'Num cliente ou nota: Editar informações. No botão Salvar: versões salvas. Em outros lugares é bloqueado (não aparece o menu do Windows); em campos de texto o menu de copiar/colar continua.'],
    ['Arrastar o mapa / roda', 'Mover e aproximar/afastar o mapa. Os botões + e − fazem o mesmo.'],
    ['Passar o mouse', 'Mostra a dica da cidade (clientes, notas, valor, feriado) e os botões escondidos.'],
    ['Duplo clique no contador', 'Na janela Pendentes: mostra ou esconde as cidades completas.'],
    ['Arrastar pelo título', 'Move qualquer janela flutuante; pelas bordas, redimensiona.'],
    ['Arrastar ⠿ (cidade do veículo)', 'Muda a ordem das paradas do veículo (▲ ▼ fazem o mesmo).'],
    ['Clique no cartão do veículo', 'Seleciona o carro, dá zoom na rota dele e abre a janela só dele. O mesmo vale para “Levar para: Carro N”.'],
    ['Clique no título da coluna', 'Na tabela Notas: ordena por essa coluna (de novo inverte).'],
    ['Seta ‹ da borda do menu', 'Esconde ou mostra o menu lateral.'],
    ['⇥ / ⇤ no título', 'Manda a janela para a segunda tela / traz de volta (só com o mapa em outra tela).'],
  ];

  /* ---------------------------------------------------------------- PÁGINAS ---------------------------------------------------------------- */
  const LINHA = 100;   // caracteres por linha (estimativa para quebrar as páginas)
  const linhas = s => Math.ceil(String(s).length / LINHA);
  const CAP = 36;      // linhas úteis por página (sem a cabeça e o rodapé)
  const CUSTO_IMG = 17;

  function secaoEmPaginas(s) {
    const pgs = []; let atual = { itens: [], l: 0 };
    const novo = () => { pgs.push(atual); atual = { itens: [], l: 0 }; };
    atual.l += 3 + linhas(s.intro) + 1;
    if (s.img) atual.l += CUSTO_IMG;
    s.passos.forEach((p, i) => {
      const custo = 1 + linhas(p[1]) + 0.7;
      if (atual.l + custo > CAP && atual.itens.length) novo();
      atual.itens.push([i, p]); atual.l += custo;
    });
    pgs.push(atual);
    return pgs;
  }
  function tabela2(cab, lista) {
    return '<table class="man-tab"><thead><tr><th>' + esc(cab[0]) + '</th><th>' + esc(cab[1]) + '</th></tr></thead><tbody>' + lista.map(x => '<tr><td><kbd>' + esc(x[0]) + '</kbd></td><td>' + esc(x[1]) + '</td></tr>').join('') + '</tbody></table>';
  }
  M.paginas = function () {
    const versao = (RT.A && RT.A.versao) || '', hoje = new Date().toLocaleDateString('pt-BR');
    const paginas = [];   // { titulo, sub, html }
    // capa
    paginas.push({ capa: true, html: '' });
    // sumário (preenchido depois)
    paginas.push({ sumario: true, html: '' });
    const idx = [];
    for (const s of MAN) {
      const pgs = secaoEmPaginas(s);
      pgs.forEach((pg, k) => {
        const primeira = k === 0;
        const html = (primeira ? '<p class="man-intro">' + esc(s.intro) + '</p>' + (s.img ? '<figure class="man-foto"><img src="manual/' + esc(s.img) + '.jpg" alt="Tela: ' + esc(s.t) + '" loading="lazy"><figcaption>Tela de exemplo (dados de teste)</figcaption></figure>' : '') : '') +
          '<ol class="man-passos" start="' + (pg.itens[0][0] + 1) + '">' + pg.itens.map(([i, p]) => '<li><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></li>').join('') + '</ol>';
        paginas.push({ titulo: s.t + (primeira ? '' : ' (continuação)'), sub: 'Manual do usuário', html, secao: s.id, primeira });
      });
    }
    // atalhos (teclado e mouse), em páginas próprias
    paginas.push({ titulo: 'Atalhos do teclado', sub: 'Manual do usuário', secao: 'atalhos', primeira: true, html: '<p class="man-intro">Todos os atalhos do Health Log. Quem usa muito fica bem mais rápido: Ctrl+L para achar nota, Ctrl+C para achar cidade, Ctrl+F para focar um veículo e Ctrl+Z para desfazer.</p>' + tabela2(['Tecla', 'O que faz'], TECLADO) });
    paginas.push({ titulo: 'Mouse e toque', sub: 'Manual do usuário', secao: 'mouse', primeira: true, html: '<p class="man-intro">Tudo o que se faz com o mouse (e, no toque, com o dedo).</p>' + tabela2(['Ação', 'O que faz'], MOUSE) + '<p class="man-dica">Dica: com o mapa em outra tela, os mesmos atalhos valem em qualquer uma das duas telas.</p>' });
    // numeração e sumário
    paginas.forEach((p, i) => { p.n = i + 1; });
    const lista = [];
    for (const s of MAN) lista.push([s.t, paginas.find(p => p.secao === s.id && p.primeira).n]);
    lista.push(['Atalhos do teclado', paginas.find(p => p.secao === 'atalhos').n]); lista.push(['Mouse e toque', paginas.find(p => p.secao === 'mouse').n]);
    const sum = paginas[1];
    sum.titulo = 'Sumário'; sum.sub = 'Manual do usuário';
    sum.html = '<ol class="man-sum">' + lista.map((x, i) => '<li><span class="n">' + (i + 1) + '</span><span class="t">' + esc(x[0]) + '</span><i></i><span class="p">' + x[1] + '</span></li>').join('') + '</ol>';
    paginas[0].versao = versao; paginas[0].hoje = hoje;
    return paginas;
  };
  const cab = (titulo, sub, pag) => '<div class="rl-cab"><div><span>MANUAL DO USUÁRIO &nbsp;/&nbsp; ' + esc(sub) + '</span><h2>' + esc(titulo) + '</h2></div><img src="icons/healthlog.png" alt="Health Log"></div>';
  M.render = function () {
    const raiz = $('#man-saida'); if (!raiz) return;
    const pgs = M.paginas(), total = pgs.length;
    raiz.innerHTML = pgs.map(p => {
      if (p.capa) return '<section class="rl-pag man-pag man-capa"><div class="man-capa-topo"><img src="icons/healthlog.png" alt="Health Log"></div><div class="man-capa-meio"><span>MANUAL DO USUÁRIO</span><h1>Health Log.</h1><p>Eficiência Máxima Em Roteirização</p></div><div class="man-capa-rod"><b>Versão ' + esc(p.versao) + '</b><span>' + esc(p.hoje) + ' · Desenvolvido por Tiago</span></div></section>';
      return '<section class="rl-pag man-pag" id="man-p' + p.n + '">' + cab(p.titulo, p.sub, p.n) + '<div class="man-corpo">' + p.html + '</div><div class="man-rod"><span>Health Log. · Manual do usuário</span><b>página ' + p.n + ' de ' + total + '</b></div></section>';
    }).join('');
  };
  M.ligar = function () {
    const raiz = $('#man-saida'); if (!raiz || raiz.dataset.lig) return; raiz.dataset.lig = '1';
    raiz.addEventListener('error', e => { if (e.target && e.target.tagName === 'IMG' && e.target.closest('.man-foto')) e.target.closest('.man-foto').remove(); }, true);
    $('#bt-imprimir-man').onclick = () => U.imprimir('man');
  };
  M.secoes = MAN; M.teclado = TECLADO; M.mouse = MOUSE;
})(typeof window !== 'undefined' ? window : globalThis);
