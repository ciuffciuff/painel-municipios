const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
const C = require('./content.js');
const F = 'Times New Roman';
const P = (t, o = {}) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 160 },
  children: t.split(/(\[[^\]]+\])/).filter(Boolean).map(s => new TextRun({ text: s, font: F, highlight: s.startsWith('[') ? 'yellow' : undefined })), ...o });
const H = t => new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: t, bold: true, font: F })] });
const kids = [
  P('[City], [date]'),
  P('To the Editor-in-Chief'),
  P('BAR – Brazilian Administration Review'),
  P(`Dear Editor,`),
  P(`I submit the manuscript “${C.title}” for consideration as a research article in BAR – Brazilian Administration Review.`),
  H('Fit with the journal'),
  P('The manuscript addresses a central problem of public administration in Brazil: how to allocate federal resources among 5,570 municipalities according to need while respecting the constitutional principle of impersonality. It connects strategic management and public value (Moore; Bryson), social equity (Frederickson) and the literature on distributive politics with an analytics design based on official open data. BAR has published research on Brazilian municipal management and on data mining in public administration, and this manuscript contributes to that line by offering both evidence and a reproducible decision-support method.'),
  H('Background and contribution'),
  P('Since 2006, the presidential vote for Lula has been concentrated in poorer municipalities. When need and vote overlap, an allocation based strictly on need will look partisan. Using data for the 2022 and 2026 elections, the manuscript shows that (a) need and the second-round vote are strongly associated in both elections (r = 0.76), whether Lula ran as challenger or incumbent; (b) the association is carried by income need, while health and sanitation needs add little; (c) it holds within 25 of 26 states; (d) the 2022–2026 change is unrelated to overall need; and (e) a linear-programming allocation that ignores votes gives 59% of resources to municipalities won by Lula, a gap that disappears once need is held constant. The manuscript proposes an “impersonality audit” that public agencies and control bodies can apply to show that allocation follows need and not politics.'),
  H('JEL codes'),
  P(`${C.jel} (D72 – Elections and voting behavior; H53 – Government expenditures and welfare programs; H77 – Intergovernmental relations, federalism; R58 – Regional development planning and policy; C38 – Classification methods, cluster analysis).`),
  H('Originality and prior presentation'),
  P('The manuscript is original, has not been published, and is not under review elsewhere. [It has not been presented at any event. / It was presented at (event, year), in a previous version.]'),
  H('Use of generative artificial intelligence'),
  P('Claude Opus 5.5 (Anthropic) was used to write and debug data-collection and analysis code, to run exploratory analyses under the author’s direction and to assist with drafting and translating the manuscript. The author defined the research questions and methods, checked the code, results and references, and takes full responsibility for the content. This use is also described in Section 3.5 of the manuscript.'),
  H('Data availability'),
  P('All data come from official open sources (IBGE, DATASUS, INEP, TSE and CGU) and are cited in the reference list. In line with BAR\u2019s policy, the processed municipal database, the collection and analysis scripts and the allocation model were deposited in Zenodo [DOI]. The link is not included in the manuscript to preserve blind review and is given in the Open Science Compliance Form submitted with this letter.'),
  H('Acknowledgments'),
  P('[Acknowledgments, if any. They appear only in this letter to preserve blind review.]'),
  H('Funding and conflicts of interest'),
  P('[The author received no specific funding for this research. / Funding: agency, grant number.] The author declares no conflict of interest.'),
  H('Authorship (CRediT)'),
  P('[Author name]: conceptualization, data curation, formal analysis, investigation, methodology, software, validation, visualization, writing – original draft, writing – review & editing.'),
  P('Sincerely,'),
  P('[Full name]'),
  P('[Affiliation, city, country] – [e-mail]'),
  P('ORCID: https://orcid.org/0009-0001-0248-6791'),
];
const doc = new Document({ styles: { default: { document: { run: { font: F, size: 22 } } } },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1417, bottom: 1417, left: 1417, right: 1417 } } }, children: kids }] });
Packer.toBuffer(doc).then(b => { fs.writeFileSync('Cover_Letter_BAR.docx', b); console.log('ok'); });
