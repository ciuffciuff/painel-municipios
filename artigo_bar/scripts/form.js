const fs=require('fs');const {Document,Packer,Paragraph,TextRun,AlignmentType}=require('docx');
const C=require('./content.js');const F='Times New Roman';
const R=(t,o={})=>t.split(/(\[[^\]]+\])/).filter(Boolean).map(s=>new TextRun({text:s,font:F,highlight:s.startsWith('[')?'yellow':undefined,...o}));
const P=(t,o={},r={})=>new Paragraph({alignment:AlignmentType.JUSTIFIED,spacing:{line:300,after:100},children:R(t,r),...o});
const I=(t,lvl=1)=>P(t,{indent:{left:567*lvl},alignment:AlignmentType.LEFT});
const H=t=>new Paragraph({spacing:{before:240,after:100},children:[new TextRun({text:t,bold:true,font:F,size:24})]});
const k=[
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:60},children:[new TextRun({text:'SciELO Brazil Criteria',font:F,size:22})]}),
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:60},children:[new TextRun({text:'Open Science Compliance Form',bold:true,font:F,size:28})]}),
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:240},children:[new TextRun({text:'Version of June 29th, 2020',font:F,size:22})]}),
 P(`Journal: BAR – Brazilian Administration Review`),
 P(`Manuscript title: ${C.title}`),
 P('Through this form, the authors inform the journal about the conformity of the manuscript with Open Science communication practices. The authors are requested to inform: (a) if the manuscript is a preprint and, if so, its location; (b) whether data, software codes and other materials underlying the manuscript text are properly cited and referenced; and, (c) whether opening options are accepted in the peer review process.'),
 H('Preprints'),
 P('Deposit of the manuscript in a preprint server recognized by the journal.'),
 P('Is the manuscript a preprint?'),
 I('(   ) Yes – Name of the preprint server: ________   Preprint DOI: ________'),
 I('( X ) No'),
 H('Research Data and other Materials Availability'),
 P('Authors are encouraged to make available previously or at the time of publication all content (data, software codes and other materials) underlying the manuscript text. Exceptions are allowed in cases of legal and ethical issues. The objective is to facilitate the manuscript evaluation and, if approved, contribute to preserving and reusing the contents and research reproducibility.'),
 P('Are the contents underlying the manuscript text already available in their entirety and without restrictions or will they be at the time of publication?'),
 I('( X ) Yes:'),
 I('( X ) the contents underlying the research text are included in the manuscript',2),
 I('( X ) the contents are already available',2),
 I('(   ) the contents will be made available at the time of publication of the article',2),
 P('Titles and respective URLs, access numbers or file DOIs of the contents underlying the article text (one line for each data):',{indent:{left:1134}}),
 ...[
 'Processed municipal database (5,570 municipalities), collection and analysis scripts (R and Python) and allocation model – Zenodo: [DOI of the deposit, e.g., https://doi.org/10.5281/zenodo.XXXXXXX]',
 'Demographic Census 2022 and population estimates 2025 (Table 6579) – IBGE/SIDRA: https://sidra.ibge.gov.br',
 'SIM, SINASC (2022–2024) and CNES – DATASUS: https://datasus.saude.gov.br/transferencia-de-arquivos/',
 'IDEB 2025 results – INEP: https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados',
 'IDSC-BR 2025 (Family Health coverage; water supply, SINISA 2023) – Instituto Cidades Sustentáveis: https://idsc.cidadessustentaveis.org.br',
 'RAIS 2024 – Ministry of Labor and Employment/PDET: https://pdet.mte.gov.br/microdados-rais-e-caged',
 'Novo Bolsa Família payments, August 2026 – CGU/Portal da Transparência: https://portaldatransparencia.gov.br/download-de-dados/novo-bolsa-familia',
 'Election results 2022 and 2026 by municipality – TSE Open Data Portal: https://dadosabertos.tse.jus.br',
 ].map(t=>I('– '+t,2)),
 I('(   ) No:'),
 I('(   ) data is available on demand from referees',2),
 I('(   ) after publication the data will be available on demand to authors – a condition justified in the manuscript',2),
 I('(   ) data cannot be made publicly available. Justification: ________',2),
 H('Open peer review'),
 P('Authors may choose one or more means to opening the journal peer review process.'),
 P('When offered the option, authors agree with the publication of review reports of the approved manuscript?'),
 I('[( X ) Yes]'), I('(   ) No'),
 P('When offered the option, authors agree to interact directly with reviewers responsible for evaluating the manuscript?'),
 I('(   ) Yes'), I('[( X ) No]'),
 new Paragraph({spacing:{before:360,after:100},children:R('Author: [Full name] – ORCID: https://orcid.org/0009-0001-0248-6791')}),
 P('[City], [date]'),
 P('Signature: ______________________________'),
];
const doc=new Document({styles:{default:{document:{run:{font:F,size:22}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1417,bottom:1417,left:1417,right:1417}}},children:k}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync('Open_Science_Compliance_Form_BAR.docx',b);console.log('ok')});
