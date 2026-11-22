/* Dados SINTÉTICOS no formato do relatório da SoftLog (SpreadsheetML, ISO-8859-1). Nada daqui é real. */
const cab = ['NÚMERO NF', 'REMETENTE', 'CNPJ/CPF DESTINATÁRIO', 'DESTINATÁRIO', 'CEP', 'ENDEREÇO', 'NÚMERO', 'BAIRRO', 'CIDADE DESTINO', 'UF', 'REGIÃO', 'VOLUMES', 'PESO', 'VALOR NF IND', 'VALOR PRODUTOS', 'CHAVE NFE'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const celula = (v, i) => (v === '' || v == null ? '' : '<Cell' + (i ? ' ss:Index="' + i + '"' : '') + '><Data ss:Type="String">' + esc(v) + '</Data></Cell>');
function xml(linhas) {
  const rows = [['RELATÓRIO DE NOTAS FISCAIS PARA ROTEIRIZAÇÃO (TESTE)'], ['Número de Romaneios / Cargas: 1'], cab, ...linhas];
  const corpo = rows.map(r => '<Row>' + r.map((v, i) => celula(v, v === '' ? 0 : i + 1)).join('') + '</Row>').join('\n');
  const s = '<?xml version="1.0" encoding="iso-8859-1"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n<Worksheet ss:Name="Notas"><Table>\n' + corpo + '\n</Table></Worksheet></Workbook>';
  return Buffer.from(s, 'latin1');
}
const chave = n => String(n).padStart(44, '0');
/* [NF, remetente, doc, cliente, cep, end, num, bairro, cidade, uf, regiao, vol, peso, valor, valorProd, chave] */
const n = (nf, doc, cli, end, num, cidade, vol, peso, valor, ch) => [String(nf).padStart(9, '0'), 'INDUSTRIA TESTE S.A.', doc, cli, '14800000', end, String(num), 'CENTRO', cidade, 'SP', '', String(vol), peso, valor, valor, chave(ch == null ? nf : ch)];

const A = [
  n(1001, '11111111000101', 'CLINICA ALFA LTDA', 'RUA UM', 10, 'ARARAQUARA', 2, '1.2500', '1000.50'),
  n(1002, '11111111000101', 'CLINICA ALFA LTDA', 'RUA UM', 10, 'ARARAQUARA', 1, '0.5000', '250.00'),
  n(1003, '22222222000102', 'FARMÁCIA AÇAÍ LTDA', 'RUA DOIS', 20, 'ARARAQUARA', 20, '40.1000', '9000.00'),
  n(1004, '33333333000103', 'HOSPITAL GAMA', 'AV TRES', 30, 'ARARAQUARA', 3, '3.0000', '5000.25'),
  n(1005, '33333333000103', 'HOSPITAL GAMA', 'AV TRES', 30, 'ARARAQUARA', 1, '', '100.00'),
  n(1006, '44444444000104', 'LAB DELTA', 'RUA QUATRO', 40, 'SAO CARLOS', 4, '2.2000', '800.00'),
  n(1007, '55555555000105', 'CLINICA EPSILON', 'RUA CINCO', 50, 'SAO CARLOS', 1, '0.1000', '120.10'),
  n(1008, '55555555000105', 'CLINICA EPSILON', 'RUA CINCO', 50, 'SAO CARLOS', 2, '0.2000', '30.00'),
  n(1009, '66666666000106', 'DROGARIA ZETA', 'RUA SEIS', 60, 'JAU', 5, '5.0000', '600.00'),
  n(1010, '66666666000106', 'DROGARIA ZETA', 'RUA SEIS', 60, 'JAU', 5, '5.0000', '700.00'),
  n(1011, '77777777000107', 'CLINICA ETA', 'RUA SETE', 70, 'LUGAR QUE NAO EXISTE', 1, '0.1000', '10.00')
];
const B = [
  A[0].slice(),                                                  // idêntica a 1001 -> repetida
  [...A[1].slice(0, 13), '999.99', '999.99', A[1][15]],          // mesma chave que 1002, valor diferente -> conflito
  n(1012, '88888888000108', 'CLINICA TETA', 'RUA OITO', 80, 'ARARAQUARA', 2, '2.0000', '400.00'),
  ['TOTAL', '', '', '', '', '', '', '', '', '', '', '40', '', '', '', ''], // linha de total -> ignorada
  n(1013, '99999999000109', 'CLINICA IOTA', 'RUA NOVE', 90, 'SAO CARLOS', 1, '0.3000', '50.00')
];
const SOLTO = Buffer.from('<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet><Table><Row><Cell><Data ss:Type="String">OUTRA COISA</Data></Cell></Row></Table></Worksheet></Workbook>');
module.exports = { A: xml(A), B: xml(B), INVALIDO: SOLTO, linhasA: A, linhasB: B };
