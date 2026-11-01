// Teste de fumaça: executa o painel num DOM simulado com um "dash" falso e roda todas as desenhos.
import { JSDOM } from 'jsdom';
import fs from 'fs';
import Papa from 'papaparse';
import * as d3 from 'd3';

const W = new URL('../web/', import.meta.url).pathname, O = new URL('../dados/', import.meta.url).pathname;
const csv = (f) => Papa.parse(fs.readFileSync(O + f, 'utf8'), { header: true, skipEmptyLines: true }).data; // tudo texto, como no painel
const DS = {
  municipios: csv('municipios.csv'), perfis: csv('perfis.csv'), grupos: csv('grupos.csv'), politicas: csv('parametros_politicas.csv'),
  geral: csv('parametros_gerais.csv'), selecao_k: csv('selecao_k.csv'), ref_politica: csv('ref_politica.csv'),
  malha: JSON.parse(fs.readFileSync(O + 'malha_municipios.json')), ufs: JSON.parse(fs.readFileSync(O + 'malha_ufs.json')),
};
const html = fs.readFileSync(W + 'index.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
const dom = new JSDOM('<!doctype html><html><body><div id="dash-root">' + html + '</div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
win.SVGElement.prototype.getBBox = function () { return { x: 0, y: 0, width: 10, height: 10 }; };
win.SVGElement.prototype.getComputedTextLength = function () { return (this.textContent || '').length * 6; };
win.d3 = d3;
let params = { var: 'grupo', modo: 'equidade' };
const calcs = {}, draws = {}, onData = [];
const calcCache = {};
win.dash = {
  colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'],
  data(id) {
    if (DS[id]) return { status: 'ok', data: DS[id] };
    if (calcs[id]) { if (!calcCache[id]) calcCache[id] = calcs[id].fn(...calcs[id].inputs.map((i) => DS[i])); return { status: 'ok', data: calcCache[id] }; }
    return { status: 'missing', data: [] };
  },
  calc(id, o) { calcs[id] = o; },
  draw(n, fn) { draws[n] = fn; },
  onData(fn) { onData.push(fn); },
  params() { return params; },
  setParams(o) { params = { ...params, ...o }; },
  resetParams() { params = { var: 'grupo', modo: 'equidade' }; },
  setLink() {},
};
for (const f of ['simplex.js', 'lpmodel.js', 'app.js']) win.eval(fs.readFileSync(W + f, 'utf8'));
function runAll(label) {
  onData.forEach((f) => f());
  const errs = [];
  win.document.querySelectorAll('[data-draw]').forEach((el) => {
    if (el.closest('[hidden]')) return;
    const n = el.getAttribute('data-draw');
    try { const t0 = Date.now(); draws[n](el); const dt = Date.now() - t0; if (dt > 300) console.log('  lento', n, dt + 'ms'); }
    catch (e) { errs.push(n + ': ' + e.message); }
    if (/NaN|undefined/.test(el.textContent)) errs.push(n + ': texto com NaN/undefined → ' + el.textContent.slice(0, 120));
  });
  console.log(label, errs.length ? errs : 'ok');
}
const show = (t) => win.document.querySelectorAll('section[data-page]').forEach((s) => (s.hidden = s.getAttribute('data-page') !== t));
runAll('visao');
params.mun = 2927408; params.var = 'topsis'; runAll('visao+mun+topsis');
for (const v of ['aloc', 'lula_26_2t', 'var_lula', 'venc_26_1t', 'renda_pc', 'cob_esf']) { params.var = v; runAll('var ' + v); }
params.uf = 'BA'; runAll('uf BA');
for (const t of ['perfis', 'ranking', 'simulador', 'eleicoes', 'metodo']) { show(t); runAll(t); }
show('simulador'); params.modo = 'eficiencia'; runAll('sim eficiencia');
params.orc = 2; params.teto = 50; params.preg = 100; runAll('sim extremo');
const k = (n) => win.document.querySelector(`[data-draw="${n}"]`).textContent;
params = { var: 'grupo', modo: 'equidade' }; show('simulador'); runAll('sim padrão');
console.log('KPIs sim:', k('s-gasto'), k('s-red'), k('s-min'), k('s-marg'));
show('visao'); runAll('v'); console.log('KPIs:', k('k-mun'), k('k-pop'), k('k-grupos'), k('k-top'));
show('eleicoes'); runAll('e'); console.log('Eleições:', k('e-22'), k('e-26'), k('e-26-1'), k('e-mun'));
console.log(JSON.stringify(calcCache.votos_regiao.filter((r) => r.eleicao.startsWith('2026 · 2'))));
