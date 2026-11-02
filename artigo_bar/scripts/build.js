const fs = require('fs');
const path = require('path');
const D = require('docx');
const { Document, Packer, Paragraph, TextRun, Header, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ImageRun, PageNumber, LevelFormat, TabStopType } = D;
const C = require('./content.js');
const FONT = 'Times New Roman';
const LINE15 = 360; // 1.5 spacing
const CM = 567;

function runs(text, base = {}) {
  const out = [];
  text.split(/(\*[^*]+\*)/).forEach(s => {
    if (!s) return;
    if (s.startsWith('*') && s.endsWith('*')) out.push(new TextRun({ text: s.slice(1, -1), italics: true, font: FONT, ...base }));
    else out.push(new TextRun({ text: s, font: FONT, ...base }));
  });
  return out;
}
const body = (t, o = {}) => new Paragraph({ children: runs(t), alignment: AlignmentType.JUSTIFIED,
  spacing: { line: LINE15, after: 120 }, indent: { firstLine: Math.round(1.25 * CM) }, ...o });
const plain = (t, o = {}, r = {}) => new Paragraph({ children: runs(t, r), spacing: { line: LINE15, after: 120 }, ...o });
const h1 = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, font: FONT })], spacing: { line: LINE15, before: 240, after: 120 }, keepNext: true });
const h2 = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, font: FONT })], spacing: { line: LINE15, before: 180, after: 120 }, keepNext: true });

const small = (t, o = {}, r = {}) => new Paragraph({ children: runs(t, { size: 20, ...r }), spacing: { line: 240, before: 60, after: 60 }, ...o });
const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const LB = { style: BorderStyle.SINGLE, size: 6, color: '000000' };

function table(id, n) {
  const t = C.tables[id];
  const total = t.widths.reduce((a, b) => a + b, 0);
  const mk = (cells, isHead, isLast) => new TableRow({ tableHeader: isHead, cantSplit: true, children: cells.map((c, i) => new TableCell({
    width: { size: t.widths[i], type: WidthType.DXA },
    margins: { top: 0, bottom: 0, left: 80, right: 80 },
    borders: { top: isHead ? LB : NB, bottom: (isHead || isLast) ? LB : NB, left: NB, right: NB },
    children: [small(c, { alignment: i === 0 ? AlignmentType.LEFT : (id === 't1' ? AlignmentType.LEFT : AlignmentType.CENTER) }, isHead ? { bold: false } : {})],
  })) });
  const rows = [mk(t.head, true, false), ...t.rows.map((r, i) => mk(r, false, i === t.rows.length - 1))];
  return [
    new Paragraph({ children: [new TextRun({ text: `Table ${n}`, bold: true, font: FONT, size: 20 })], spacing: { line: 240, before: 200, after: 60 }, keepNext: true }),
    new Paragraph({ children: [new TextRun({ text: t.title, italics: true, font: FONT, size: 20 })], spacing: { line: 240, after: 60 }, keepNext: true }),
    new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: t.widths, rows }),
    small(t.note, { alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, before: 60, after: 240 } }),
  ];
}
function figure(id, n) {
  const f = C.figures[id];
  const buf = fs.readFileSync(path.join(__dirname, 'fig', f.file));
  const px = cm => Math.round(cm / 2.54 * 96);
  const out = [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 200, after: 60 },
      children: [new ImageRun({ type: 'png', data: buf, transformation: { width: px(f.w), height: px(f.h) }, altText: { title: `Figure ${n}`, description: f.title, name: `Figure ${n}` } })] }),
    new Paragraph({ children: [new TextRun({ text: `Figure ${n}. `, bold: true, font: FONT, size: 20 }), new TextRun({ text: f.title, italics: true, font: FONT, size: 20 })], spacing: { line: 240, after: 60 }, keepNext: true }),
  ];
  f.note.split('\n').forEach((l, i, a) => out.push(small(l, { alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, after: i === a.length - 1 ? 240 : 0 } })));
  return out;
}

const children = [];
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: LINE15, after: 240 }, children: [new TextRun({ text: C.title, bold: true, font: FONT, size: 28 })] }));
children.push(plain('Abstract', { spacing: { line: LINE15, after: 60 } }, { bold: true }));
C.abstract.forEach(([k, v]) => children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: LINE15, after: 60 },
  children: [new TextRun({ text: `${k}: `, italics: true, font: FONT }), ...runs(v)] })));
children.push(new Paragraph({ spacing: { line: LINE15, before: 120, after: 60 }, children: [new TextRun({ text: 'Keywords: ', italics: true, font: FONT }), ...runs(C.keywords)] }));
children.push(new Paragraph({ spacing: { line: LINE15, after: 240 }, children: [new TextRun({ text: 'JEL Code: ', italics: true, font: FONT }), ...runs(C.jel)] }));

let tn = 0, fn = 0;
C.body.forEach(b => {
  if (b[0] === 'h1') children.push(h1(b[1]));
  else if (b[0] === 'h2') children.push(h2(b[1]));
  else if (b[0] === 'p') children.push(body(b[1]));
  else if (b[0] === 'list') b[1].forEach(t => children.push(new Paragraph({ children: runs(t), alignment: AlignmentType.JUSTIFIED, spacing: { line: LINE15, after: 60 }, indent: { left: Math.round(1.25 * CM) } })));
  else if (b[0] === 'table') children.push(...table(b[1], ++tn));
  else if (b[0] === 'fig') children.push(...figure(b[1], ++fn));
});
children.push(h1('REFERENCES'));
C.references.forEach(r => children.push(new Paragraph({ children: runs(r), alignment: AlignmentType.LEFT, spacing: { line: LINE15, after: 60 }, indent: { left: Math.round(1.25 * CM), hanging: Math.round(1.25 * CM) } })));

const doc = new Document({
  creator: '', title: C.title, description: '', lastModifiedBy: '',
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1417, bottom: 1417, left: 1417, right: 1417, header: 708 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 22 })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(process.argv[2] || 'manuscript.docx', b); console.log('ok'); });
