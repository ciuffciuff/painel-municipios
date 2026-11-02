const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, TableOfContents, PageBreak, Footer, Header, PageNumber,
  ExternalHyperlink,
} = require('docx');

const FIG = '/home/claude/rel/fig/';
const FONT = 'Calibri';
const AZUL = '1F3A8A';
const W = 9026; // largura útil A4 com margens de 2,5 cm (DXA)

// ---------- auxiliares ----------
function runs(text, base = {}) {
  // **negrito** e _itálico_ simples
  const out = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const P = (t, o = {}) => new Paragraph({ children: runs(t), spacing: { after: 120, line: 300 }, alignment: AlignmentType.JUSTIFIED, ...o });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)], keepNext: true });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)], keepNext: true });
const B = (t, lvl = 0) => new Paragraph({ children: runs(t), numbering: { reference: 'bullets', level: lvl }, spacing: { after: 80, line: 288 } });
const N = (t, ref = 'num') => new Paragraph({ children: runs(t), numbering: { reference: ref, level: 0 }, spacing: { after: 80, line: 288 } });
const EQ = (t) => new Paragraph({ children: [new TextRun({ text: t, italics: true, font: 'Cambria Math' })], alignment: AlignmentType.CENTER, spacing: { before: 80, after: 120 } });
let nfig = 0, ntab = 0;
function FIGURA(arq, titulo, fonte, larg = 15.5) {
  nfig++;
  const buf = fs.readFileSync(FIG + arq);
  const w0 = buf.readUInt32BE(16), h0 = buf.readUInt32BE(20);
  const wpx = larg / 2.54 * 96, hpx = wpx * h0 / w0;
  return [
    new Paragraph({ children: [new TextRun({ text: `Figura ${nfig} – ${titulo}`, bold: true, size: 20 })], spacing: { before: 200, after: 80 }, keepNext: true }),
    new Paragraph({ children: [new ImageRun({ type: 'png', data: buf, transformation: { width: Math.round(wpx), height: Math.round(hpx) },
      altText: { title: titulo, description: titulo, name: arq } })], alignment: AlignmentType.CENTER, keepNext: true }),
    new Paragraph({ children: [new TextRun({ text: `Fonte: ${fonte}`, size: 18, color: '555555' })], spacing: { after: 240 } }),
  ];
}
const bord = { style: BorderStyle.SINGLE, size: 4, color: 'BFC5CC' };
const borders = { top: bord, bottom: bord, left: bord, right: bord };
function TABELA(titulo, cab, linhas, larguras, fonte, alinhNum = true) {
  ntab++;
  const tot = larguras.reduce((a, b) => a + b, 0);
  const ws = larguras.map((x) => Math.round(x / tot * W));
  ws[ws.length - 1] += W - ws.reduce((a, b) => a + b, 0);
  const cel = (t, i, head) => new TableCell({
    borders, width: { size: ws[i], type: WidthType.DXA },
    shading: head ? { fill: 'E8EDF5', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [new Paragraph({ children: runs(String(t), { size: 18, bold: head ? true : undefined }),
      alignment: (!head && i > 0 && alinhNum && /^[−+\-]?[\d.,]+( p\.p\.)?%?$/.test(String(t))) ? AlignmentType.RIGHT : AlignmentType.LEFT })],
  });
  return [
    new Paragraph({ children: [new TextRun({ text: `Tabela ${ntab} – ${titulo}`, bold: true, size: 20 })], spacing: { before: 200, after: 80 }, keepNext: true }),
    new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: ws,
      rows: [new TableRow({ tableHeader: true, children: cab.map((c, i) => cel(c, i, true)) }),
             ...linhas.map((l) => new TableRow({ children: l.map((c, i) => cel(c, i, false)) }))] }),
    new Paragraph({ children: [new TextRun({ text: `Fonte: ${fonte}`, size: 18, color: '555555' })], spacing: { before: 60, after: 240 } }),
  ];
}
const LINK = (t, url) => new ExternalHyperlink({ link: url, children: [new TextRun({ text: t, style: 'Hyperlink' })] });

// ---------- conteúdo ----------
const corpo = [];
const add = (...xs) => xs.flat().forEach((x) => corpo.push(x));

// Capa
add(
  new Paragraph({ spacing: { before: 2400 }, children: [] }),
  new Paragraph({ children: [new TextRun({ text: 'PAINEL DE MUNICÍPIOS', bold: true, size: 44, color: AZUL })], alignment: AlignmentType.CENTER }),
  new Paragraph({ children: [new TextRun({ text: 'Necessidades dos municípios brasileiros, prioridade territorial e alocação de políticas públicas', size: 30 })], alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 } }),
  new Paragraph({ children: [new TextRun({ text: 'Relatório técnico com sumário executivo e resultados detalhados, incluindo a relação com as eleições presidenciais de 2022 e 2026', size: 24, italics: true, color: '555555' })], alignment: AlignmentType.CENTER, spacing: { after: 2400 } }),
  new Paragraph({ children: [new TextRun({ text: 'César Ciuffo', size: 26, bold: true })], alignment: AlignmentType.CENTER }),
  new Paragraph({ children: [new TextRun({ text: 'ORCID 0009-0001-0248-6791', size: 20, color: '555555' })], alignment: AlignmentType.CENTER }),
  new Paragraph({ children: [new TextRun({ text: 'Brasília, novembro de 2026', size: 24 })], alignment: AlignmentType.CENTER, spacing: { before: 1200 } }),
);
// Sumário
add(
  new Paragraph({ children: [new TextRun({ text: 'Sumário', bold: true, size: 32, color: AZUL })], pageBreakBefore: true, spacing: { after: 240 } }),
  new TableOfContents('Sumário', { hyperlink: true, headingStyleRange: '1-2' }),
);

// 1 Sumário executivo
add(H1('1 Sumário executivo'),
  P('Este relatório apresenta os resultados do Painel de Municípios, que mede as necessidades dos 5.570 municípios brasileiros em saúde, educação, saneamento e renda, agrupa-os em perfis de necessidade por aprendizado de máquina, ordena a prioridade de cada um por análise multicritério e simula a divisão de um orçamento entre políticas públicas por programação linear. Os resultados das eleições presidenciais de 2022 e 2026 são cruzados com as necessidades, mas não entram em nenhum cálculo de prioridade ou alocação.'),
  H3('Principais resultados'),
  N('**As necessidades sociais concentram-se no Norte e no Nordeste.** Essas regiões têm necessidade média acima de 50 (numa escala de 0 a 100) em educação e renda; o Norte lidera em saneamento (70,6) e em saúde (60,6), com a maior mortalidade infantil do país (15,6 por mil nascidos vivos em 2022–2024, contra 10,2 no Sul).', 'num1'),
  N('**Seis perfis de necessidade.** Vão de municípios consolidados do Sul e do Sudeste (perfil 1) à vulnerabilidade social aguda (perfil 6: 785 municípios, 63% no Nordeste e 29% no Norte, renda per capita mediana de R$ 698, só 23% dos domicílios com esgoto adequado e mortalidade infantil de 16,0 por mil).', 'num1'),
  N('**Os grandes centros têm um problema próprio.** O perfil 2 reúne 54% da população e tem os melhores indicadores de renda e saneamento, mas a menor cobertura da Saúde da Família (82,5% na mediana) e a menor oferta de UBS (2,3 por 10 mil habitantes).', 'num1'),
  N('**A prioridade é territorialmente concentrada.** Dos 500 municípios mais prioritários pelo TOPSIS, 384 estão no Nordeste e 104 no Norte; Maranhão, Bahia e Piauí lideram.', 'num1'),
  N('**Equidade e eficiência levam a orçamentos diferentes.** Com R$ 20 bilhões, a solução eficiente destina 49% a saúde e 10% a saneamento; a de equidade, que garante pelo menos 13,3% de redução do déficit em todos os grupos e políticas, destina 37% a saneamento e 25% a saúde.', 'num1'),
  N('**Necessidade e voto andam juntos.** A correlação entre o índice de prioridade e o voto em Lula no 2º turno de 2026 é de 0,76: ele obteve 40,6% no quinto de municípios menos prioritários e 72,4% no mais prioritário.', 'num1'),
  N('**Lula ganhou no total, mas perdeu na maioria dos municípios.** Subiu 0,9 ponto percentual (p.p.) entre 2022 e 2026, com alta nos grandes centros (+2,0 p.p.), mas caiu em 78% dos municípios; 278 municípios passaram para Flávio Bolsonaro, sobretudo no interior do Sul, Sudeste e Centro-Oeste.', 'num1'),
  H3('Recomendações'),
  B('Tratar os perfis 5 e 6 como prioridade intersetorial: água e saneamento, saúde materno-infantil, alfabetização, primeira infância e inclusão produtiva, com cooperação federativa pela baixa capacidade de execução local.'),
  B('Nos grandes centros (perfil 2), expandir a Estratégia Saúde da Família e as UBS nas periferias.'),
  B('No interior com déficit de esgotamento (perfil 3), apostar em saneamento descentralizado e consórcios intermunicipais de saúde.'),
  B('Usar a formulação de equidade como referência quando o objetivo for não deixar nenhum grupo para trás, e a de eficiência para dimensionar o custo dessa escolha.'),
  B('Calibrar os custos do modelo de alocação com custos reais de programas antes de qualquer uso orçamentário.'),
);

// 2 Introdução
add(H1('2 Introdução e objetivos'),
  P('O Brasil tem 5.570 municípios com realidades muito distintas. Políticas públicas de amplo espectro precisam reconhecer essas diferenças: o mesmo programa pode ser prioritário numa região e secundário em outra. Este trabalho combina dados abertos oficiais, aprendizado de máquina e pesquisa operacional para responder a três perguntas:'),
  N('Quais são as principais necessidades de cada município e como elas se agrupam no território?', 'num2'),
  N('Quais municípios devem ter prioridade, considerando várias dimensões ao mesmo tempo?', 'num2'),
  N('Como dividir um orçamento entre políticas e regiões, e quanto muda a resposta quando o critério é eficiência ou equidade?', 'num2'),
  P('Uma quarta pergunta, descritiva, examina como as necessidades se relacionam com o resultado das eleições presidenciais de 2022 e 2026. O voto é tratado apenas como camada de leitura: usá-lo para distribuir recursos contrariaria o princípio da impessoalidade da administração pública (BRASIL, 1988, art. 37).'),
  P('Os resultados estão disponíveis num painel interativo e num repositório público com código, dados e documentação, listados no Apêndice A.'),
);

// 3 Dados
add(H1('3 Dados'),
  P('A unidade de análise é o município, identificado pelo código de 7 dígitos do IBGE. Foram usados os 5.570 municípios do Censo Demográfico 2022 (IBGE, 2023); Boa Esperança do Norte (MT), criado depois do Censo, ficou de fora por não ter indicadores censitários próprios. A população de referência é a estimativa do IBGE para 2025.'),
  TABELA('Indicadores usados, por dimensão', ['Dimensão', 'Indicador', 'Sentido', 'Fonte e período'], [
    ['Saúde', 'Mortalidade infantil (por mil nascidos vivos)', 'maior é pior', 'SIM/SINASC (DATASUS), 2022–2024'],
    ['Saúde', 'Cobertura da Saúde da Família (%)', 'maior é melhor', 'e-Gestor AB via IDSC-BR, mar/2023'],
    ['Saúde', 'UBS por 10 mil habitantes', 'maior é melhor', 'CNES; IBGE, população 2025'],
    ['Saúde', 'Distância ao município com hospital mais próximo (km)', 'maior é pior', 'CNES'],
    ['Educação', 'Alfabetização de 15 anos ou mais (%)', 'maior é melhor', 'IBGE, Censo 2022'],
    ['Educação', 'IDEB, anos iniciais, rede pública', 'maior é melhor', 'INEP, 2025'],
    ['Saneamento', 'População atendida com água por rede (%)', 'maior é melhor', 'SINISA 2023 via IDSC-BR'],
    ['Saneamento', 'Domicílios com esgoto por rede ou fossa séptica (%)', 'maior é melhor', 'IBGE, Censo 2022'],
    ['Saneamento', 'Domicílios com coleta de lixo (%)', 'maior é melhor', 'IBGE, Censo 2022'],
    ['Renda', 'Rendimento domiciliar per capita médio (R$)', 'maior é melhor', 'IBGE, Censo 2022'],
    ['Renda', 'Vínculos formais privados por mil habitantes', 'maior é melhor', 'MTE, RAIS 2024'],
    ['Renda', 'Domicílios com família no Bolsa Família (%)', 'maior é pior', 'CGU, ago/2026'],
  ], [1.2, 3.6, 1.3, 2.2], 'elaboração própria.', false),
  P('**Mortalidade infantil.** Óbitos de menores de 1 ano por mil nascidos vivos (RIPSA, 2008), calculada com os microdados do Sistema de Informações sobre Mortalidade (SIM-DOINF) e do Sistema de Informações sobre Nascidos Vivos (SINASC), por município de residência, baixados do DATASUS com o pacote microdatasus (SALDANHA; BASTOS; BARCELLOS, 2019). Para reduzir a instabilidade em municípios pequenos, os óbitos e os nascimentos de 2022, 2023 e 2024 foram somados; a taxa nacional resultante é de 12,6 por mil. Mesmo assim, 84 municípios têm menos de 50 nascimentos no triênio; por isso a taxa foi suavizada pelo estimador bayesiano empírico de Marshall (1991), que aproxima as taxas instáveis da média do estado em proporção à incerteza. A taxa bruta permanece na base de dados.'),
  P('**Cobertura da Saúde da Família e água.** A cobertura é a população atendida por equipes de Saúde da Família dividida pela população, última série publicada no e-Gestor AB (março de 2023). O abastecimento de água é a população atendida por rede (indicador IAG0001 do SINISA, que substituiu o IN055 do SNIS); nos 48 municípios sem informação foi usado o Censo 2022. O esgoto continuou do Censo 2022, porque no SINISA faltam 2.265 municípios e só se conta a rede coletora, o que trataria a fossa séptica, solução adequada em áreas de baixa densidade, como ausência de esgoto.'),
  P('**IDEB ausente.** O INEP não calcula o IDEB quando a participação no Saeb é insuficiente (INEP, 2026). Nos 251 municípios sem o índice, foi usada a mediana do estado; no Distrito Federal, a da região Centro-Oeste.'),
  P('**Eleições.** Percentual dos votos válidos de Lula e do principal adversário (Jair Bolsonaro em 2022, Flávio Bolsonaro em 2026), vencedor e abstenção, nos dois turnos (TSE, 2026). As somas dos municípios reproduzem os totais nacionais divulgados pelo TSE: no 2º turno de 2026, 51,78% para Lula e 48,22% para Flávio Bolsonaro.'),
  P('**Origem dos arquivos.** Como o ambiente de processamento não acessava diretamente os portais oficiais, os dados foram obtidos de repositórios públicos que redistribuem as bases oficiais já agregadas por município. A lista completa está no arquivo FONTES.md do repositório. O pipeline foi executado do zero e reproduziu os mesmos arquivos byte a byte.'),
);

// 4 Métodos
add(H1('4 Métodos'),
  H2('4.1 Necessidade relativa'),
  P('Cada indicador _x_ foi convertido em uma posição percentual entre os municípios, depois de inverter o sinal dos indicadores em que "maior é melhor". Assim, 0 representa o melhor município do país e 100 o pior:'),
  EQ('n(i, j) = 100 × posição percentual de [ −s(j) × x(i, j) ]'),
  P('em que _s(j)_ = +1 quando "maior é melhor" e −1 quando "maior é pior". A necessidade de uma dimensão é a média simples dos seus indicadores. O uso de posições, e não de valores brutos, coloca todos os indicadores na mesma escala e reduz a influência de valores extremos. A contrapartida é que a necessidade é relativa: mede a posição frente aos demais municípios, não a distância a uma meta.'),
  H2('4.2 Índice de prioridade (TOPSIS)'),
  P('O TOPSIS (_Technique for Order Preference by Similarity to Ideal Solution_) ordena alternativas pela distância a uma solução ideal e a uma solução anti-ideal (HWANG; YOON, 1981). É um dos métodos multicritério mais usados em decisões públicas e de planejamento (BEHZADIAN et al., 2012). Com a matriz _X_ das 12 necessidades em escala de 0 a 1 e pesos _w_ iguais por dimensão (1/4 dividido entre os indicadores da dimensão):'),
  EQ('v(i, j) = w(j) × x(i, j)'),
  EQ('d⁺(i) = √ Σⱼ [ v(i, j) − minᵢ v(i, j) ]²     d⁻(i) = √ Σⱼ [ v(i, j) − maxᵢ v(i, j) ]²'),
  EQ('TOPSIS(i) = 100 × d⁺(i) / [ d⁺(i) + d⁻(i) ]'),
  P('O índice vai de 0 a 100; quanto maior, mais perto da pior situação observada e mais prioritário o município.'),
  H2('4.3 Perfis de necessidade (k-means)'),
  P('As 12 necessidades foram padronizadas (média 0, desvio-padrão 1) e agrupadas pelo algoritmo k-means (MACQUEEN, 1967; LLOYD, 1982), implementado no scikit-learn (PEDREGOSA et al., 2011), com 50 inicializações e semente fixa. Para escolher o número de grupos, foi calculado o coeficiente de silhueta (ROUSSEEUW, 1987) para k de 3 a 9.'),
  FIGURA('f6_silhueta.png', 'Silhueta média do k-means para cada número de perfis', 'elaboração própria a partir de amostra de 4.000 municípios.', 15),
  P('A silhueta é baixa para qualquer k (entre 0,13 e 0,20): as necessidades variam de forma contínua no território, e os perfis devem ser lidos como faixas desse contínuo, não como grupos isolados. Essa é uma situação comum quando o agrupamento é aplicado a fenômenos socioeconômicos (JAIN, 2010). O valor k = 6 foi escolhido pela interpretação: k = 3 tem a maior silhueta, mas mistura situações que pedem políticas diferentes, como os grandes centros com lacuna em atenção primária e o interior sem esgotamento. Os perfis foram numerados de 1 (menor TOPSIS médio) a 6 (maior).'),
  H2('4.4 Alocação de orçamento (programação linear)'),
  P('O modelo de programação linear (DANTZIG, 1963) distribui um orçamento _B_ entre 30 grupos _g_ (5 regiões × 6 perfis) e 4 políticas _p_. O déficit de cada grupo numa política é medido em "pessoas-equivalentes":'),
  EQ('D(g, p) = Σ população(i) × necessidade(i, p) / 100,   para os municípios i do grupo g'),
  P('Cada déficit é dividido em três segmentos iguais com eficiência de 100%, 70% e 40%, o que representa retornos decrescentes: reduzir o primeiro terço do déficit custa menos que reduzir o último. A variável _y(g, p, s)_ é o déficit reduzido no segmento _s_, e o custo unitário é _c(p) / e(s)_.'),
  P('**Formulação de eficiência:**'),
  EQ('maximizar  Σ peso(p) × [ necessidade(g, p) / 50 ]^α × y(g, p, s)'),
  P('sujeito a:'),
  B('orçamento: Σ c(p) / e(s) × y(g, p, s) ≤ B;'),
  B('piso por política: cada política recebe pelo menos 10% de B;'),
  B('piso regional: cada região recebe pelo menos 50% de B multiplicado pela sua participação no déficit total;'),
  B('teto de absorção: o gasto num grupo não passa de R$ 250 por habitante, representando a capacidade limitada de execução;'),
  B('limites dos segmentos: 0 ≤ y(g, p, s) ≤ D(g, p) / 3.'),
  P('O expoente α expressa aversão à desigualdade, na linha das medidas de bem-estar de Atkinson (1970): com α = 0, toda pessoa-equivalente vale o mesmo; com α > 0, reduzir déficit onde a necessidade é mais intensa vale mais.'),
  P('**Formulação de equidade.** Inspirada no princípio maximin (RAWLS, 1971) e na otimização lexicográfica (OGRYCZAK, 1997), é resolvida em dois estágios. Primeiro, maximiza a menor fração de déficit reduzida entre todos os grupos e políticas, _t_ = min Σₛ y(g, p, s) / D(g, p). Depois, mantém essa garantia mínima e usa o orçamento restante com o critério de eficiência.'),
  P('Os custos unitários (R$ 300 para saúde, R$ 250 para educação, R$ 900 para saneamento e R$ 500 para renda, por pessoa-equivalente) são hipóteses de trabalho para comparar cenários, não estimativas orçamentárias. O modelo foi resolvido com o solver HiGHS (HUANGFU; HALL, 2018) via SciPy (VIRTANEN et al., 2020); o painel resolve o mesmo modelo no navegador por um método simplex de duas fases, e os dois dão o mesmo valor ótimo.'),
  H2('4.5 Análise eleitoral'),
  P('Os percentuais de votos foram agregados por perfil, região e quinto de prioridade, com peso pelos votos válidos de cada município. A relação entre indicadores e voto foi medida pela correlação de Pearson entre municípios. Por serem associações entre unidades territoriais, e não entre indivíduos, essas correlações estão sujeitas à falácia ecológica (ROBINSON, 1950): não dizem como cada eleitor vota, nem indicam causa.'),
);

// 5 Resultados
add(H1('5 Resultados'),
  H2('5.1 Panorama regional'),
  P('As necessidades sociais concentram-se no Norte e no Nordeste. Em educação, o Nordeste tem a maior necessidade média (62,8); em saneamento, o Norte (55,0); em renda, as duas regiões ficam próximas de 56. No Sudeste, a necessidade em saneamento é a menor do país (14,9).'),
  FIGURA('f4_regioes.png', 'Necessidade média por região e dimensão', 'elaboração própria com dados do IBGE, INEP, Ministério da Saúde, SINISA, RAIS e CGU. Média ponderada pela população de 2025.'),
  P('Na saúde, o Norte tem a maior necessidade (67,2) e o Sul a menor (49,4), mas Sudeste (58,8), Centro-Oeste (60,4) e Nordeste (57,5) ficam próximos. A dimensão junta sinais opostos: a mortalidade infantil é maior no Norte (15,5 por mil) e no Nordeste (13,9) do que no Sudeste (11,7) e no Sul (10,1), enquanto a cobertura da Saúde da Família e a oferta de UBS por habitante são menores nas grandes cidades, onde a expansão da atenção primária foi mais lenta.'),
  FIGURA('f11_mapa_tmi.png', 'Mortalidade infantil por município, 2022–2024', 'elaboração própria com dados do SIM e do SINASC (DATASUS). Taxa suavizada em direção à do estado. Malha municipal: IBGE.', 13),
  H2('5.2 Perfis de necessidade'),
  P('Os seis perfis separam dois problemas distintos: a vulnerabilidade social do Nordeste e do Norte (perfis 4 a 6) e lacunas específicas de serviço no Sul, Sudeste e Centro-Oeste (perfis 1 a 3). A Figura 3 mostra a distribuição territorial.'),
  FIGURA('f1_mapa_perfis.png', 'Perfis de necessidade dos municípios brasileiros', 'elaboração própria. Malha municipal: IBGE.', 14),
  FIGURA('f5_perfis.png', 'Necessidade média de cada perfil, por dimensão', 'elaboração própria.'),
  TABELA('Composição e necessidade média dos perfis', ['Perfil', 'Municípios', 'População (%)', 'Saúde', 'Educação', 'Saneamento', 'Renda', 'TOPSIS'], [
    ['1. Consolidados, com atenção primária a reforçar', '1.150', '14,0', '44,3', '25,1', '28,9', '22,4', '30,6'],
    ['2. Grandes centros com lacuna na atenção primária', '707', '54,3', '62,1', '30,7', '19,3', '23,2', '33,8'],
    ['3. Interior com déficit de esgotamento e longe de hospital', '1.089', '3,5', '46,0', '40,4', '59,5', '42,4', '45,9'],
    ['4. Vulnerabilidade de renda e educação', '786', '14,3', '51,8', '60,2', '45,7', '53,1', '52,4'],
    ['5. Vulnerabilidade múltipla com baixo acesso a saneamento', '1.053', '5,8', '44,4', '72,2', '68,6', '80,2', '64,3'],
    ['6. Vulnerabilidade social aguda e maior mortalidade infantil', '785', '8,1', '58,9', '77,1', '74,8', '81,6', '69,8'],
  ], [3.6, 1, 1, 0.8, 0.9, 1, 0.8, 0.8], 'elaboração própria. Necessidade de 0 (melhor) a 100 (pior).'),
  TABELA('Indicadores típicos de cada perfil (mediana)', ['Perfil', 'Mort. inf. (‰)', 'Cob. SF (%)', 'UBS/10 mil', 'Hospital (km)', 'Alfab. (%)', 'IDEB', 'Água (%)', 'Esgoto (%)', 'Renda pc (R$)', 'Emprego/mil', 'Bolsa Fam. (%)'], [
    ['1', '10,9', '100,0', '3,6', '13,7', '95,1', '6,7', '85,4', '80,6', '1.592', '164', '11,7'],
    ['2', '11,2', '82,5', '2,3', '0,0', '95,8', '6,3', '91,7', '87,8', '1.577', '188', '14,2'],
    ['3', '11,1', '100,0', '5,2', '21,4', '91,5', '6,5', '60,1', '43,7', '1.326', '61', '20,1'],
    ['4', '13,1', '100,0', '4,0', '0,0', '88,1', '5,8', '77,3', '59,5', '1.008', '87', '38,8'],
    ['5', '13,4', '100,0', '6,3', '0,0', '78,6', '5,8', '55,8', '28,8', '723', '16', '57,9'],
    ['6', '14,7', '88,1', '4,9', '0,0', '80,9', '5,3', '48,4', '22,6', '698', '17', '62,9'],
  ], [0.6, 0.8, 0.8, 0.8, 0.8, 0.8, 0.6, 0.7, 0.8, 0.9, 0.8, 0.8], 'elaboração própria. Mortalidade infantil: mediana das taxas suavizadas. A distância de 0 km indica hospital no próprio município.'),
  H3('Descrição dos perfis'),
  P('**Perfil 1 – Consolidados, com atenção primária a reforçar (1.150 municípios).** Baixa necessidade em educação, saneamento e renda e a menor mortalidade infantil do país (10,6 por mil no conjunto do perfil); 93% estão no Sudeste e no Sul. Em saúde ficam perto da média, pela menor oferta de UBS por habitante e pela distância ao hospital (cerca de 14 km na mediana).'),
  P('**Perfil 2 – Grandes centros com lacuna na atenção primária (707 municípios, 54% da população).** Reúne capitais, regiões metropolitanas e cidades médias. Tem a maior renda e o melhor saneamento, mas a cobertura da Saúde da Família (82,5% na mediana) e a oferta de UBS (2,3 por 10 mil habitantes) são as mais baixas.'),
  P('**Perfil 3 – Interior com déficit de esgotamento e longe de hospital (1.089 municípios).** Municípios pequenos do Sul (41%), Sudeste (38%) e Centro-Oeste (18%). Renda e educação razoáveis e mortalidade infantil baixa (11,6 por mil), mas só 44% dos domicílios têm esgoto adequado, a água por rede chega a 60% da população e o hospital mais próximo fica a cerca de 21 km.'),
  P('**Perfil 4 – Vulnerabilidade de renda e educação (786 municípios).** 48% no Nordeste, 23% no Sudeste, 15% no Centro-Oeste e 13% no Norte. Analfabetismo de cerca de 12%, renda per capita perto de R$ 1.010, 39% dos domicílios no Bolsa Família e mortalidade infantil de 14,1 por mil; saneamento intermediário.'),
  P('**Perfil 5 – Vulnerabilidade múltipla com baixo acesso a saneamento (1.053 municípios).** Municípios pequenos, 85% no Nordeste. Emprego formal muito baixo (16 vínculos por mil habitantes), água por rede para 56% da população, esgoto adequado em 29% dos domicílios, coleta de lixo em dois terços e mortalidade infantil de 14,2 por mil.'),
  P('**Perfil 6 – Vulnerabilidade social aguda e maior mortalidade infantil (785 municípios).** A maior necessidade do país: renda per capita de R$ 698, 63% dos domicílios no Bolsa Família, analfabetismo de cerca de 19%, água por rede para 48% da população, esgoto adequado em 23% dos domicílios e a maior mortalidade infantil (16,0 por mil). 63% estão no Nordeste e 29% no Norte; Bahia, Maranhão e Pará são os estados com mais municípios no perfil.'),
  H2('5.3 Prioridade territorial'),
  P('O índice TOPSIS confirma a concentração territorial da necessidade. Dos 500 municípios mais prioritários, 384 estão no Nordeste, 104 no Norte, 6 no Sudeste e 6 no Centro-Oeste; nenhum no Sul. Maranhão (122), Bahia (99), Piauí (69), Pará (42) e Paraíba (39) concentram a maior parte. Com a mortalidade infantil no índice, municípios do Norte com taxas altas, como Amajari (RR), Ipixuna (AM) e Marechal Thaumaturgo (AC), aparecem entre os primeiros.'),
  FIGURA('f2_mapa_topsis.png', 'Índice de prioridade (TOPSIS) por município', 'elaboração própria. Malha municipal: IBGE.', 13),
  TABELA('Os 10 municípios mais prioritários pelo TOPSIS', ['Posição', 'Município', 'UF', 'Perfil', 'TOPSIS', 'População 2025'], [
    ['1', 'Pedro Alexandre', 'BA', '6', '84,3', '14.226'], ['2', 'Amajari', 'RR', '6', '84,3', '16.112'], ['3', 'Ipixuna', 'AM', '6', '84,2', '25.629'],
    ['4', 'Marechal Thaumaturgo', 'AC', '6', '83,2', '18.057'], ['5', 'Fartura do Piauí', 'PI', '5', '83,1', '5.426'], ['6', 'Manari', 'PE', '6', '82,9', '27.046'],
    ['7', 'Envira', 'AM', '6', '82,9', '17.985'], ['8', 'Melgaço', 'PA', '6', '82,9', '30.080'], ['9', 'Pilão Arcado', 'BA', '6', '82,7', '37.388'],
    ['10', 'Poço das Trincheiras', 'AL', '6', '82,5', '12.965'],
  ], [0.8, 2.6, 0.6, 0.8, 0.9, 1.3], 'elaboração própria.'),
  H2('5.4 Alocação de orçamento'),
  P('Com R$ 20 bilhões e os parâmetros padrão, a escolha da formulação muda mais o destino por política do que o destino por região. A eficiência concentra recursos em saúde e educação, onde reduzir o déficit custa menos; saneamento e renda recebem apenas o piso de 10%. A equidade desloca recursos para saneamento e renda, onde estão os maiores déficits relativos.'),
  FIGURA('f7_alocacao.png', 'Orçamento por política nas formulações de eficiência e equidade', 'elaboração própria. Solução do modelo de programação linear com o solver HiGHS; orçamento de R$ 20 bilhões.'),
  TABELA('Orçamento por região, nas duas formulações', ['Região', 'Eficiência (R$ bi)', 'Equidade (R$ bi)'], [
    ['Nordeste', '9,38', '7,77'], ['Sudeste', '4,96', '5,93'], ['Norte', '2,85', '2,79'], ['Sul', '1,44', '2,09'], ['Centro-Oeste', '1,37', '1,43'],
  ], [2, 1.5, 1.5], 'elaboração própria.'),
  TABELA('Gasto por habitante em cada perfil, nas duas formulações', ['Perfil', 'Eficiência (R$/hab.)', 'Equidade (R$/hab.)'], [
    ['1', '0', '63'], ['2', '70', '66'], ['3', '130', '133'], ['4', '114', '129'], ['5', '250', '177'], ['6', '250', '196'],
  ], [1, 1.5, 1.5], 'elaboração própria.'),
  P('Na eficiência, os perfis 5 e 6 atingem o teto de R$ 250 por habitante e o perfil 1 fica sem recursos. Na equidade, todos os 120 pares grupo × política têm ao menos 13,3% do déficit reduzido, e o orçamento se espalha mais. O preço-sombra estimado indica que R$ 1 bilhão adicional reduziria cerca de 2,3 milhões de pessoas-equivalentes de déficit na formulação de equidade; na de eficiência, o dual do orçamento é de 3,53 unidades do objetivo por R$ 1 milhão.'),
  H2('5.5 Eleições de 2022 e 2026 e as necessidades'),
  P('O voto em Lula cresce com a necessidade do município, e a variação entre 2022 e 2026 dividiu o país entre grandes centros, onde ele cresceu, e o interior, onde caiu. Na soma dos municípios (sem o exterior), Lula teve 50,9% no 2º turno de 2022 e 51,8% no de 2026; no 1º turno de 2026, Flávio Bolsonaro ficou à frente, com 47,0% contra 45,2%.'),
  FIGURA('f3_mapa_voto26.png', 'Voto em Lula no 2º turno de 2026, por município', 'elaboração própria com dados do TSE. Malha municipal: IBGE.', 13),
  FIGURA('f8_dispersao.png', 'Índice de prioridade e voto em Lula no 2º turno de 2026', 'elaboração própria com dados do TSE. Cada ponto é um município; o tamanho é proporcional à população.'),
  P('A correlação entre o índice TOPSIS e o percentual de Lula é de 0,76. Lula obteve 40,6% no quinto de municípios menos prioritários e 72,4% no mais prioritário. Nos perfis 4 a 6, venceu em 68% a 96% dos municípios; nos perfis 1 a 3, em 10% a 32%.'),
  FIGURA('f9_correlacoes.png', 'Correlação de cada indicador com o voto em Lula', 'elaboração própria. Correlação de Pearson entre os 5.570 municípios.'),
  P('Renda e escolaridade são as variáveis mais associadas ao voto: necessidade em renda (+0,83), alfabetização (−0,81), Bolsa Família (+0,80) e renda per capita (−0,78). A necessidade em saúde não se associa ao voto (0,00) porque junta sinais opostos: a mortalidade infantil é maior onde Lula teve mais votos (+0,46), mas a menor cobertura de atenção primária está nos grandes centros, onde ele teve votação menor.'),
  FIGURA('f10_variacao.png', 'Variação do voto em Lula entre 2022 e 2026, por perfil', 'elaboração própria com dados do TSE. Média ponderada pelos votos válidos.'),
  TABELA('Votação no 2º turno por perfil de necessidade', ['Perfil', 'Lula 2022 (%)', 'Lula 2026 (%)', 'Variação (p.p.)', 'Vitória de Lula em 2026 (% dos municípios)', 'Passaram para Flávio', 'Passaram para Lula'], [
    ['1', '39,6', '39,2', '−0,3', '11,4', '52', '5'], ['2', '45,5', '47,5', '+2,0', '20,6', '16', '16'], ['3', '47,1', '43,7', '−3,4', '29,2', '158', '1'],
    ['4', '61,7', '61,9', '+0,2', '76,8', '31', '6'], ['5', '76,7', '74,3', '−2,4', '95,3', '13', '2'], ['6', '71,8', '69,9', '−1,9', '89,8', '8', '1'],
  ], [0.7, 1, 1, 1, 1.6, 1.1, 1.1], 'elaboração própria com dados do TSE. Percentuais nos votos válidos, ponderados pelos votos de cada município.'),
  P('A alta de 0,9 p.p. de Lula no total veio dos grandes centros (perfil 2, +2,0 p.p.), que têm 53% dos votos válidos. Em 78% dos municípios ele perdeu votos (mediana de −2,0 p.p.). Dos 278 municípios que passaram de Lula para Flávio Bolsonaro, 158 estão no perfil 3, o interior do Sul, Sudeste e Centro-Oeste; apenas 31 fizeram o caminho inverso. Lula perdeu menos onde o saneamento é melhor (correlação de +0,28 entre esgoto adequado e variação).'),
  P('**A alocação não segue o voto, mas coincide com ele.** No simulador (equidade, parâmetros padrão), os municípios onde Lula venceu recebem R$ 115 por habitante e aqueles onde Flávio Bolsonaro venceu, R$ 74. O modelo não usa votos: a diferença decorre da necessidade, que é maior onde Lula teve mais votos. Esse ponto deve ser explicitado em qualquer apresentação dos resultados, para evitar a leitura de que a alocação favorece um lado.'),
);

// 6 Recomendações
add(H1('6 Recomendações de política por perfil'),
  P('As recomendações abaixo derivam dos indicadores típicos de cada perfil e são indicativas. Devem ser validadas com as áreas setoriais e com os entes federados.'),
  TABELA('Políticas sugeridas por perfil', ['Perfil', 'Necessidade principal', 'Políticas sugeridas'], [
    ['1. Consolidados', 'Atenção primária', 'Qualificar a atenção primária e manter os níveis atuais; cooperação técnica com os perfis mais vulneráveis.'],
    ['2. Grandes centros', 'Saúde da Família e UBS', 'Expandir a Estratégia Saúde da Família e as UBS nas periferias (provimento de profissionais, custeio da APS); focalizar bolsões de pobreza intraurbana.'],
    ['3. Interior com déficit de esgotamento', 'Saneamento e acesso hospitalar', 'Saneamento de pequena escala e rural; consórcios intermunicipais de saúde; transporte sanitário até o hospital de referência.'],
    ['4. Vulnerabilidade de renda e educação', 'Educação e renda', 'Alfabetização de jovens e adultos (EJA), alfabetização na idade certa, qualificação profissional e inclusão produtiva articuladas ao Cadastro Único; atenção ao pré-natal e à primeira infância.'],
    ['5. Vulnerabilidade múltipla', 'Saneamento, renda e educação', 'Pacote integrado de abastecimento de água e saneamento rural, coleta de resíduos, inclusão produtiva rural e alfabetização; cooperação federativa.'],
    ['6. Vulnerabilidade social aguda', 'Saneamento, saúde materno-infantil, educação e renda', 'Prioridade máxima e intersetorial: universalizar água e esgoto, nos termos do Marco Legal do Saneamento (BRASIL, 2020); pré-natal e cuidado ao recém-nascido; alfabetização e permanência escolar; primeira infância; transferência de renda com inclusão produtiva.'],
  ], [1.6, 1.5, 4.5], 'elaboração própria.', false),
  P('Do ponto de vista orçamentário, a formulação de equidade é a mais coerente com o objetivo de reduzir desigualdades, pois garante que nenhum grupo fique sem redução mínima de déficit. A formulação de eficiência serve para dimensionar o custo dessa escolha: a diferença entre os objetivos das duas soluções mostra quanto de redução total se abre mão em troca de distribuição mais ampla.'),
);

// 7 Limitações
add(H1('7 Limitações'),
  B('A necessidade é relativa (posição entre municípios), não a distância a uma meta absoluta.'),
  B('Os indicadores têm anos diferentes: Censo 2022, mortalidade infantil 2022–2024, cobertura da Saúde da Família de 2023, SINISA 2023, RAIS 2024, IDEB 2025, CNES e Bolsa Família de 2026.'),
  B('A mortalidade infantil é instável em municípios pequenos, mesmo somando três anos; a suavização bayesiana reduz o ruído, mas puxa as taxas desses municípios para a média do estado.'),
  B('O IDEB falta em 251 municípios. A cobertura da Saúde da Família é a última publicada no e-Gestor (março de 2023) e mede equipes, não atendimento.'),
  B('A distância ao hospital é calculada entre os pontos centrais dos municípios, não pelo trajeto viário.'),
  B('Médias municipais escondem desigualdades dentro dos grandes centros (perfil 2).'),
  B('A silhueta baixa indica que os limites entre perfis são difusos; municípios próximos da fronteira entre dois perfis podem mudar de grupo com pequenas alterações nos dados.'),
  B('Os custos unitários e as eficiências dos segmentos do modelo de alocação são hipóteses de trabalho.'),
  B('As análises eleitorais são ecológicas e não permitem inferir comportamento individual nem causalidade.'),
  B('Mortalidade infantil, UBS, população, renda e votos foram coletados direto nas fontes oficiais (IBGE, DATASUS e TSE) em novembro de 2026; os demais indicadores vêm de repositórios de terceiros que redistribuem bases oficiais, e uma versão institucional deve refazer também essa coleta.'),
);

// 8 Considerações finais
add(H1('8 Considerações finais'),
  P('A combinação de indicadores abertos, agrupamento e otimização permite passar de um diagnóstico difuso ("o Nordeste precisa mais") para recomendações específicas por perfil e para uma estimativa de como um orçamento poderia ser distribuído sob critérios explícitos. O principal achado metodológico é que a escolha entre eficiência e equidade muda mais a composição do gasto por política do que a sua distribuição regional.'),
  P('Os próximos passos são calibrar os custos unitários com dados de programas, validar os perfis com as áreas setoriais e completar a coleta nas fontes oficiais, que já fornecem a mortalidade infantil, as UBS, a população, a renda e os votos. O painel e o repositório permitem que esses ajustes sejam incorporados e os resultados recalculados.'),
);

// Referências
const refs = [
  'ATKINSON, A. B. On the measurement of inequality. **Journal of Economic Theory**, v. 2, n. 3, p. 244-263, 1970.',
  'BEHZADIAN, M.; OTAGHSARA, S. K.; YAZDANI, M.; IGNATIUS, J. A state-of the-art survey of TOPSIS applications. **Expert Systems with Applications**, v. 39, n. 17, p. 13051-13069, 2012.',
  'BRASIL. [Constituição (1988)]. **Constituição da República Federativa do Brasil de 1988**. Brasília, DF: Presidência da República, 1988.',
  'BRASIL. Ministério da Saúde. Portaria nº 2.436, de 21 de setembro de 2017. Aprova a Política Nacional de Atenção Básica. **Diário Oficial da União**, Brasília, DF, 22 set. 2017.',
  'BRASIL. Lei nº 14.026, de 15 de julho de 2020. Atualiza o marco legal do saneamento básico. **Diário Oficial da União**, Brasília, DF, 16 jul. 2020.',
  'DANTZIG, G. B. **Linear programming and extensions**. Princeton: Princeton University Press, 1963.',
  'HUANGFU, Q.; HALL, J. A. J. Parallelizing the dual revised simplex method. **Mathematical Programming Computation**, v. 10, n. 1, p. 119-142, 2018.',
  'HWANG, C.-L.; YOON, K. **Multiple attribute decision making**: methods and applications. Berlin: Springer-Verlag, 1981.',
  'IBGE – INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. **Censo Demográfico 2022**. Rio de Janeiro: IBGE, 2023.',
  'IBGE – INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. **Estimativas da população residente para os municípios brasileiros**. Rio de Janeiro: IBGE, 2025.',
  'IBGE – INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. **Produto Interno Bruto dos Municípios 2023**. Rio de Janeiro: IBGE, 2025.',
  'INEP – INSTITUTO NACIONAL DE ESTUDOS E PESQUISAS EDUCACIONAIS ANÍSIO TEIXEIRA. **Índice de Desenvolvimento da Educação Básica (Ideb) 2025**: resultados por município. Brasília, DF: Inep, 2026.',
  'JAIN, A. K. Data clustering: 50 years beyond K-means. **Pattern Recognition Letters**, v. 31, n. 8, p. 651-666, 2010.',
  'LLOYD, S. P. Least squares quantization in PCM. **IEEE Transactions on Information Theory**, v. 28, n. 2, p. 129-137, 1982.',
  'MACQUEEN, J. Some methods for classification and analysis of multivariate observations. In: BERKELEY SYMPOSIUM ON MATHEMATICAL STATISTICS AND PROBABILITY, 5., 1967, Berkeley. **Proceedings** [...]. Berkeley: University of California Press, 1967. v. 1, p. 281-297.',
  'INSTITUTO CIDADES SUSTENTÁVEIS. **Índice de Desenvolvimento Sustentável das Cidades – Brasil (IDSC-BR) 2025**: base de dados. São Paulo: ICS, 2025.',
  'MARSHALL, R. J. Mapping disease and mortality rates using empirical Bayes estimators. **Journal of the Royal Statistical Society: Series C (Applied Statistics)**, v. 40, n. 2, p. 283-294, 1991.',
  'RIPSA – REDE INTERAGENCIAL DE INFORMAÇÕES PARA A SAÚDE. **Indicadores básicos para a saúde no Brasil**: conceitos e aplicações. 2. ed. Brasília, DF: Organização Pan-Americana da Saúde, 2008.',
  'MINISTÉRIO DA SAÚDE. **Sistema de Informações sobre Mortalidade (SIM) e Sistema de Informações sobre Nascidos Vivos (SINASC)**: dados de 2022 a 2024. Brasília, DF: DATASUS, 2026.',
  'MINISTÉRIO DA SAÚDE. **e-Gestor Atenção Primária**: cobertura da Atenção Primária, competência março de 2023. Brasília, DF: Secretaria de Atenção Primária à Saúde, 2023.',
  'MINISTÉRIO DAS CIDADES. **Sistema Nacional de Informações em Saneamento Básico (SINISA)**: abastecimento de água, ano de referência 2023. Brasília, DF: Ministério das Cidades, 2025.',
  'MINISTÉRIO DA SAÚDE. **Cadastro Nacional de Estabelecimentos de Saúde (CNES)**: estabelecimentos de saúde, competência setembro de 2026. Brasília, DF: DATASUS, 2026.',
  'MINISTÉRIO DO TRABALHO E EMPREGO. **Relação Anual de Informações Sociais (RAIS) 2024**. Brasília, DF: MTE, 2025.',
  'CONTROLADORIA-GERAL DA UNIÃO. **Portal da Transparência**: pagamentos do Novo Bolsa Família, agosto de 2026. Brasília, DF: CGU, 2026.',
  'OGRYCZAK, W. On the lexicographic minimax approach to location problems. **European Journal of Operational Research**, v. 100, n. 3, p. 566-585, 1997.',
  'PEDREGOSA, F. et al. Scikit-learn: machine learning in Python. **Journal of Machine Learning Research**, v. 12, p. 2825-2830, 2011.',
  'SALDANHA, R. F.; BASTOS, R. R.; BARCELLOS, C. Microdatasus: pacote para download e pré-processamento de microdados do Departamento de Informática do SUS (DATASUS). **Cadernos de Saúde Pública**, Rio de Janeiro, v. 35, n. 9, e00032419, 2019.',
  'RAWLS, J. **A theory of justice**. Cambridge, MA: Harvard University Press, 1971.',
  'ROBINSON, W. S. Ecological correlations and the behavior of individuals. **American Sociological Review**, v. 15, n. 3, p. 351-357, 1950.',
  'ROUSSEEUW, P. J. Silhouettes: a graphical aid to the interpretation and validation of cluster analysis. **Journal of Computational and Applied Mathematics**, v. 20, p. 53-65, 1987.',
  'TSE – TRIBUNAL SUPERIOR ELEITORAL. **Portal de Dados Abertos**: resultados das eleições presidenciais de 2022 e 2026 por município. Brasília, DF: TSE, 2026.',
  'VIRTANEN, P. et al. SciPy 1.0: fundamental algorithms for scientific computing in Python. **Nature Methods**, v. 17, p. 261-272, 2020.',
];
refs.sort((a, b) => a.localeCompare(b, 'pt'));
add(H1('Referências'), ...refs.map((r) => new Paragraph({ children: runs(r), spacing: { after: 160, line: 276 }, alignment: AlignmentType.LEFT })));

// Apêndice
add(H1('Apêndice A – Reprodução'),
  P('Todo o processamento é reproduzível. O repositório contém o pipeline em Python, um script didático em R, os dados finais, o código do painel e a documentação de método e fontes.'),
  new Paragraph({ children: [new TextRun('Painel interativo: '), LINK('claude.ai/artifact/6UZNGmcSJGXEDVLem7hayC', 'https://claude.ai/artifact/6UZNGmcSJGXEDVLem7hayC')], spacing: { after: 80 } }),
  new Paragraph({ children: [new TextRun('Repositório: '), LINK('github.com/ciuffciuff/painel-municipios', 'https://github.com/ciuffciuff/painel-municipios')], spacing: { after: 80 } }),
  new Paragraph({ children: [new TextRun('Metodologia: '), LINK('METODOLOGIA.md', 'https://github.com/ciuffciuff/painel-municipios/blob/main/METODOLOGIA.md'), new TextRun(' · Fontes: '), LINK('FONTES.md', 'https://github.com/ciuffciuff/painel-municipios/blob/main/FONTES.md')], spacing: { after: 160 } }),
  TABELA('Arquivos principais do repositório', ['Arquivo', 'Função'], [
    ['python/build_data.py', 'Junta as fontes numa base por município'],
    ['python/model.py', 'Calcula a necessidade, o TOPSIS e os perfis (k-means)'],
    ['python/lp.py', 'Resolve o modelo de alocação (SciPy/HiGHS)'],
    ['R/painel_municipios.R', 'Versão didática em R: necessidade, TOPSIS, k-means e alocação (lpSolve)'],
    ['dados/municipios.csv', 'Base final com os 5.570 municípios'],
    ['docs/', 'Painel independente (GitHub Pages)'],
  ], [2.2, 4.5], 'elaboração própria.', false),
  P('Licenças: código sob MIT; textos e dados derivados sob Creative Commons Atribuição 4.0 (CC BY 4.0).'),
);

// ---------- documento ----------
const doc = new Document({
  creator: 'César Ciuffo', title: 'Painel de Municípios – relatório técnico', description: 'Sumário executivo e resultados detalhados',
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: FONT, color: AZUL }, paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: FONT, color: AZUL }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, font: FONT }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ...['num', 'num1', 'num2'].map((r) => ({ reference: r, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] })),
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1418, bottom: 1418, left: 1440, right: 1440 } }, titlePage: true },
    headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'Painel de Municípios – relatório técnico', size: 16, color: '777777' })], alignment: AlignmentType.RIGHT })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })], alignment: AlignmentType.CENTER })] }) },
    children: corpo,
  }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync('/home/claude/rel/Relatorio_Painel_de_Municipios.docx', b); console.log('ok', b.length); });
