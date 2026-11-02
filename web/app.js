(function () {
  // ---------- utilidades ----------
  var L = d3.formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['R$ ', ''] });
  var F = { i: L.format(',.0f'), d1: L.format(',.1f'), d2: L.format(',.2f'), pct: function (v) { return L.format(',.1f')(v) + '%'; } };
  var DIMS = ['saude', 'educacao', 'saneamento', 'renda'];
  var DIML = { saude: 'Saúde', educacao: 'Educação', saneamento: 'Saneamento', renda: 'Renda, emprego e assistência' };
  var REG = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
  var TXT = { nome: 1, uf: 1, regiao: 1, gid: 1, venc_22_2t: 1, venc_26_1t: 1, venc_26_2t: 1, rotulo: 1, politica: 1, descricao: 1, politicas_sugeridas: 1, modelo: 1 };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var NUMRE = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;

  function ok(id) { var d = dash.data(id); return d.status === 'ok' ? d.data : null; }
  var parsed = new WeakMap();
  function rows(id) {
    var r = ok(id); if (!r) return null;
    if (!Array.isArray(r)) return r;
    if (parsed.has(r)) return parsed.get(r);
    var out = r.map(function (o) {
      var x = {}; for (var k in o) { var v = o[k]; x[k] = (TXT[k] || typeof v !== 'string') ? v : (v === '' ? null : (NUMRE.test(v) ? Number(v) : v)); } return x;
    });
    parsed.set(r, out); return out;
  }
  function dashEl(el) { el.replaceChildren(document.createTextNode('—')); }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'style') e.setAttribute('style', attrs[k]); else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var colorCache = {};
  function resolve(c, el) {
    if (colorCache[c]) return colorCache[c];
    var t = document.createElement('span'); t.style.color = c; (el || document.getElementById('dash-root') || document.body).appendChild(t);
    var v = getComputedStyle(t).color; t.remove(); colorCache[c] = v; return v;
  }
  function col(i) { return dash.colors[i % dash.colors.length]; }
  function tipPos(tip, box, ev) {
    var r = box.getBoundingClientRect(); var x = ev.clientX - r.left + 12, y = ev.clientY - r.top + 12;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    if (x + tw > r.width) x = Math.max(0, ev.clientX - r.left - tw - 12);
    if (y + th > r.height) y = Math.max(0, ev.clientY - r.top - th - 12);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }

  // ---------- parâmetros do simulador ----------
  function simInputs() {
    var g = rows('grupos'), p = rows('politicas'), ge = rows('geral');
    if (!g || !p || !ge) return null;
    var P = dash.params(); var d = ge[0];
    var geral = {
      orcamento_bi: P.orc != null ? +P.orc : d.orcamento_bi,
      piso_regional_pct: P.preg != null ? +P.preg : d.piso_regional_pct,
      teto_per_capita: P.teto != null ? +P.teto : d.teto_per_capita,
      equidade: P.eq != null ? +P.eq : d.equidade
    };
    var pol = p.map(function (x) { var y = Object.assign({}, x); var w = P['w_' + x.politica]; if (w != null) y.peso = +w; return y; });
    return { grupos: g, politicas: pol, geral: geral, modo: P.modo || 'equidade' };
  }
  var simCache = new Map();
  function solveCached(inp, modo, extraBi) {
    var geral = Object.assign({}, inp.geral); if (extraBi) geral.orcamento_bi += extraBi;
    var key = JSON.stringify([modo, geral, inp.politicas.map(function (p) { return [p.peso, p.piso_pct, p.custo_unitario]; }), inp.grupos.length]);
    if (simCache.has(key)) return simCache.get(key);
    var r;
    try { r = window.LPModel.solve(window.solver, inp.grupos, inp.politicas, geral, modo); } catch (e) { r = { feasible: false }; }
    if (simCache.size > 40) simCache.clear();
    simCache.set(key, r); return r;
  }
  function sim(modo) { var inp = simInputs(); if (!inp) return null; return { inp: inp, res: solveCached(inp, modo || inp.modo) }; }

  // alocação por município (R$/hab) a partir da solução por grupo
  function alocMunicipal(mun, s) {
    if (!s || !s.res.feasible) return null;
    var gap = {};
    mun.forEach(function (m) { DIMS.forEach(function (d) { var k = m.gid + '|' + d; gap[k] = (gap[k] || 0) + m.pop2025 * m['nec_' + d] / 100; }); });
    var x = {}; s.res.rows.forEach(function (r) { x[r.gid + '|' + r.politica] = r.gasto; });
    var out = new Map();
    mun.forEach(function (m) {
      var tot = 0;
      DIMS.forEach(function (d) { var k = m.gid + '|' + d; if (gap[k] > 0) tot += (x[k] || 0) * (m.pop2025 * m['nec_' + d] / 100) / gap[k]; });
      out.set(m.cod, tot / m.pop2025);
    });
    return out;
  }

  // ---------- cálculos publicados ----------
  function n(v) { return v === '' || v == null ? null : Number(v); }
  dash.calc('resumo', {
    inputs: ['municipios'], title: 'Resumo da base municipal',
    description: 'Número de municípios, população estimada de 2025, número de perfis e município com maior índice TOPSIS.',
    fn: function (municipios) {
      var pop = 0, gs = {}, top = null;
      municipios.forEach(function (m) { pop += Number(m.pop2025); gs[m.grupo] = 1; if (!top || Number(m.topsis) > Number(top.topsis)) top = m; });
      return [{ municipios: municipios.length, populacao: pop, grupos: Object.keys(gs).length, mais_prioritario: top.nome + ' (' + top.uf + ')', topsis_max: Number(top.topsis) }];
    }
  });
  dash.calc('dim_regiao', {
    inputs: ['municipios'], title: 'Necessidade média por região',
    description: 'Média da necessidade (0–100) de cada dimensão por região, ponderada pela população de 2025.',
    fn: function (municipios) {
      var acc = {};
      municipios.forEach(function (m) {
        var p = Number(m.pop2025);
        ['saude', 'educacao', 'saneamento', 'renda'].forEach(function (d) {
          var k = m.regiao + '|' + d; acc[k] = acc[k] || { regiao: m.regiao, dimensao: d, s: 0, w: 0 };
          acc[k].s += p * Number(m['nec_' + d]); acc[k].w += p;
        });
      });
      return Object.values(acc).map(function (a) { return { regiao: a.regiao, dimensao: a.dimensao, necessidade: Math.round(10 * a.s / a.w) / 10 }; });
    }
  });
  dash.calc('votos_brasil', {
    inputs: ['municipios'], title: 'Votação nacional (municípios)',
    description: 'Percentual nos votos válidos somando os municípios (sem exterior) e municípios que mudaram de vencedor no 2º turno entre 2022 e 2026.',
    fn: function (municipios) {
      var s = { l22: 0, v22: 0, l26: 0, v26: 0, f261: 0, v261: 0, mud: 0 };
      municipios.forEach(function (m) {
        s.l22 += Number(m.lula_22_2t) * Number(m.votos_22_2t); s.v22 += Number(m.votos_22_2t);
        s.l26 += Number(m.lula_26_2t) * Number(m.votos_26_2t); s.v26 += Number(m.votos_26_2t);
        s.f261 += Number(m.flavio_26_1t) * Number(m.votos_26_1t); s.v261 += Number(m.votos_26_1t);
        var a = m.venc_22_2t === 'Lula', b = m.venc_26_2t === 'Lula';
        if (m.venc_22_2t !== 'Empate' && m.venc_26_2t !== 'Empate' && a !== b) s.mud += 1;
      });
      return [{ lula_22_2t: s.l22 / s.v22, lula_26_2t: s.l26 / s.v26, flavio_26_1t: s.f261 / s.v261, mudaram_vencedor: s.mud }];
    }
  });
  dash.calc('votos_perfil', {
    inputs: ['municipios'], title: 'Votação no 2º turno por perfil',
    description: 'Percentual de Lula nos votos válidos do 2º turno de 2022 e 2026, por perfil de necessidade, ponderado pelos votos válidos.',
    fn: function (municipios) {
      var acc = {};
      municipios.forEach(function (m) {
        [['2022', 'lula_22_2t', 'votos_22_2t'], ['2026', 'lula_26_2t', 'votos_26_2t']].forEach(function (e) {
          var k = m.grupo + '|' + e[0]; acc[k] = acc[k] || { grupo: Number(m.grupo), ano: e[0], s: 0, w: 0 };
          acc[k].s += Number(m[e[1]]) * Number(m[e[2]]); acc[k].w += Number(m[e[2]]);
        });
      });
      return Object.values(acc).map(function (a) { return { grupo: a.grupo, ano: a.ano, lula: Math.round(100 * a.s / a.w) / 100 }; });
    }
  });
  dash.calc('votos_regiao', {
    inputs: ['municipios'], title: 'Votação por região',
    description: 'Percentual nos votos válidos por região e turno, ponderado pelos votos válidos de cada município (no 1º turno, só os dois primeiros colocados).',
    fn: function (municipios) {
      var E = [['2022 · 1º turno', 'lula_22_1t', 'bolsonaro_22_1t', 'votos_22_1t', 'Jair Bolsonaro'], ['2022 · 2º turno', 'lula_22_2t', 'bolsonaro_22_2t', 'votos_22_2t', 'Jair Bolsonaro'],
               ['2026 · 1º turno', 'lula_26_1t', 'flavio_26_1t', 'votos_26_1t', 'Flávio Bolsonaro'], ['2026 · 2º turno', 'lula_26_2t', 'flavio_26_2t', 'votos_26_2t', 'Flávio Bolsonaro']];
      var acc = {};
      municipios.forEach(function (m) {
        E.forEach(function (e) {
          var k = m.regiao + '|' + e[0]; acc[k] = acc[k] || { regiao: m.regiao, eleicao: e[0], adversario: e[4], l: 0, a: 0, w: 0 };
          var w = Number(m[e[3]]); acc[k].l += Number(m[e[1]]) * w; acc[k].a += Number(m[e[2]]) * w; acc[k].w += w;
        });
      });
      return Object.values(acc).map(function (a) { return { regiao: a.regiao, eleicao: a.eleicao, lula: Math.round(100 * a.l / a.w) / 100, adversario: a.adversario, adversario_pct: Math.round(100 * a.a / a.w) / 100 }; });
    }
  });

  // ---------- abas ----------
  var tabs = document.querySelectorAll('.pm .tabs button');
  function showTab(name) {
    document.querySelectorAll('.pm section[data-page]').forEach(function (s) { s.hidden = s.getAttribute('data-page') !== name; });
    tabs.forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === name ? 'true' : 'false'); });
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { var t = b.getAttribute('data-tab'); showTab(t); dash.setLink(t); }); });
  var hashTab = location.hash.slice(1);
  if (hashTab && document.querySelector('.pm section[data-page="' + hashTab + '"]')) showTab(hashTab);

  // ---------- controles ----------
  document.querySelectorAll('.ctl-var').forEach(function (s) { s.addEventListener('change', function () { dash.setParams({ var: s.value }); }); });
  document.querySelectorAll('.ctl-uf').forEach(function (s) { s.addEventListener('change', function () { dash.setParams({ uf: s.value || null }); }); });
  document.querySelectorAll('.ctl-grupo').forEach(function (s) { s.addEventListener('change', function () { dash.setParams({ rgrupo: s.value || null }); }); });
  document.querySelectorAll('.ctl-busca').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var mun = rows('municipios'); if (!mun) return;
      var q = inp.value.trim().toLowerCase();
      var hit = mun.find(function (m) { return (m.nome + ' – ' + m.uf).toLowerCase() === q; }) || mun.find(function (m) { return m.nome.toLowerCase() === q; });
      if (hit) dash.setParams({ mun: hit.cod });
    });
  });
  document.querySelectorAll('.sl').forEach(function (sl) {
    sl.addEventListener('change', function () { var o = {}; o[sl.getAttribute('data-p')] = Number(sl.value); dash.setParams(o); });
  });
  document.querySelectorAll('input[name="modo"]').forEach(function (r) { r.addEventListener('change', function () { if (r.checked) dash.setParams({ modo: r.value }); }); });
  document.querySelectorAll('.reset-sim').forEach(function (b) {
    b.addEventListener('click', function () { dash.setParams({ orc: null, preg: null, teto: null, eq: null, w_saude: null, w_educacao: null, w_saneamento: null, w_renda: null, modo: 'equidade' }); });
  });

  dash.onData(function () {
    var P = dash.params();
    document.querySelectorAll('.ctl-var').forEach(function (s) { s.value = P.var || 'grupo'; });
    document.querySelectorAll('.ctl-uf').forEach(function (s) { s.value = P.uf || ''; });
    document.querySelectorAll('.ctl-grupo').forEach(function (s) { s.value = P.rgrupo == null ? '' : String(P.rgrupo); });
    document.querySelectorAll('input[name="modo"]').forEach(function (r) { r.checked = r.value === (P.modo || 'equidade'); });
    var sim = document.querySelector('.pm section[data-page="simulador"]');
    if (sim && !sim.hidden) {
      var inp = simInputs();
      if (inp) {
        var vals = { orc: inp.geral.orcamento_bi, preg: inp.geral.piso_regional_pct, teto: inp.geral.teto_per_capita, eq: inp.geral.equidade };
        inp.politicas.forEach(function (p) { vals['w_' + p.politica] = p.peso; });
        document.querySelectorAll('.sl').forEach(function (sl) { var k = sl.getAttribute('data-p'); if (vals[k] != null && sl !== document.activeElement) sl.value = vals[k]; });
      }
    }
    document.querySelectorAll('.det-vazio').forEach(function (e) { e.hidden = P.mun != null; });
    document.querySelectorAll('.det-conteudo').forEach(function (e) { e.hidden = P.mun == null; });
  });

  // ---------- KPIs da visão geral ----------
  function kpi(name, fn) {
    dash.draw(name, function (el) { var r = rows('resumo'); if (!r) return dashEl(el); el.textContent = fn(r[0]); });
  }
  kpi('k-mun', function (r) { return F.i(r.municipios); });
  kpi('k-pop', function (r) { return L.format(',.1f')(r.populacao / 1e6) + ' mi'; });
  kpi('k-grupos', function (r) { return F.i(r.grupos); });
  kpi('k-top', function (r) { return r.mais_prioritario; });

  dash.draw('lista-mun', function (el) {
    var mun = rows('municipios'); el.replaceChildren(); if (!mun) return;
    var P = dash.params();
    mun.filter(function (m) { return !P.uf || m.uf === P.uf; }).forEach(function (m) { el.appendChild(h('option', { value: m.nome + ' – ' + m.uf })); });
  });

  // ---------- escalas do mapa ----------
  var VARS = {
    grupo: { t: 'cat' }, venc_22_2t: { t: 'venc' }, venc_26_1t: { t: 'venc' }, venc_26_2t: { t: 'venc' },
    topsis: { t: 'seq', dir: 1, f: F.d1 }, aloc: { t: 'seq', dir: 1, f: F.i, pre: 'R$ ' },
    nec_saude: { t: 'seq', dir: 1, f: F.d1 }, nec_educacao: { t: 'seq', dir: 1, f: F.d1 }, nec_saneamento: { t: 'seq', dir: 1, f: F.d1 }, nec_renda: { t: 'seq', dir: 1, f: F.d1 },
    tmi: { t: 'seq', dir: 1, f: F.d1, suf: '‰' }, cob_esf: { t: 'seq', dir: -1, f: F.d1, suf: '%' }, ubs_10k: { t: 'seq', dir: -1, f: F.d2 }, alfab: { t: 'seq', dir: -1, f: F.d1, suf: '%' }, ideb_ai: { t: 'seq', dir: -1, f: F.d1 },
    agua_rede: { t: 'seq', dir: -1, f: F.d1, suf: '%' }, esgoto_adeq: { t: 'seq', dir: -1, f: F.d1, suf: '%' }, lixo_coleta: { t: 'seq', dir: -1, f: F.d1, suf: '%' },
    renda_pc: { t: 'seq', dir: -1, f: F.i, pre: 'R$ ' }, emprego_1000: { t: 'seq', dir: -1, f: F.d1 }, bf_cob: { t: 'seq', dir: 1, f: F.d1, suf: '%' },
    lula_22_2t: { t: 'div', mid: 50, f: F.d1, suf: '%' }, lula_26_2t: { t: 'div', mid: 50, f: F.d1, suf: '%' }, var_lula: { t: 'div', mid: 0, f: F.d1, suf: ' p.p.' },
    abst_26_2t: { t: 'seq', dir: 1, f: F.d1, suf: '%' }
  };
  function fmtV(meta, v) { return v == null || isNaN(v) ? 's/d' : (meta.pre || '') + meta.f(v) + (meta.suf || ''); }
  function value(m, v, aloc) {
    if (v === 'aloc') return aloc ? aloc.get(m.cod) : null;
    if (v === 'var_lula') return m.lula_26_2t - m.lula_22_2t;
    return m[v];
  }
  function scaleFor(v, mun, el) {
    var meta = VARS[v] || VARS.grupo;
    var bg = resolve('var(--color-bg)', el);
    if (meta.t === 'cat') return { meta: meta, color: function (m) { return col(m.grupo - 1); } };
    if (meta.t === 'venc') {
      var C = { 'Lula': col(0), 'Jair Bolsonaro': col(1), 'Flávio Bolsonaro': col(1), 'Empate': 'var(--cds-chart-muted)' };
      return { meta: meta, color: function (m) { return C[m[v]] || 'var(--cds-chart-muted)'; }, cats: C };
    }
    var aloc = v === 'aloc' ? alocMunicipal(mun, sim()) : null;
    var vals = mun.map(function (m) { return value(m, v, aloc); }).filter(function (x) { return x != null && !isNaN(x); });
    if (meta.t === 'div') {
      var c0 = resolve(col(0), el), c1 = resolve(col(1), el);
      var ext = d3.max(vals, function (x) { return Math.abs(x - meta.mid); }) || 1;
      var steps = [-1, -0.6, -0.2, 0.2, 0.6, 1].map(function (t) { return meta.mid + t * ext; });
      var th = [meta.mid - 0.6 * ext, meta.mid - 0.2 * ext, meta.mid + 0.2 * ext, meta.mid + 0.6 * ext];
      var ramp = [d3.interpolateRgb(bg, c1)(0.95), d3.interpolateRgb(bg, c1)(0.55), d3.interpolateRgb(bg, resolve('var(--cds-chart-muted)', el))(0.6), d3.interpolateRgb(bg, c0)(0.55), d3.interpolateRgb(bg, c0)(0.95)];
      var sc = d3.scaleThreshold().domain(th).range(ramp);
      return { meta: meta, aloc: aloc, color: function (m) { var x = value(m, v, aloc); return x == null || isNaN(x) ? 'var(--cds-chart-muted)' : sc(x); }, bins: ramp.map(function (c, i) { return { c: c, a: i === 0 ? null : th[i - 1], b: i === 4 ? null : th[i] }; }), steps: steps };
    }
    var strong = resolve(col(meta.dir === 1 ? 3 : 3), el);
    var ramp2 = [0.12, 0.3, 0.5, 0.72, 0.95].map(function (t) { return d3.interpolateRgb(bg, strong)(t); });
    var q = d3.scaleQuantile().domain(vals).range(meta.dir === 1 ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0]);
    var qs = q.quantiles();
    var lo = d3.min(vals), hi = d3.max(vals);
    var edges = [lo].concat(qs).concat([hi]);
    var bins = [0, 1, 2, 3, 4].map(function (i) { return { c: ramp2[meta.dir === 1 ? i : 4 - i], a: edges[i], b: edges[i + 1] }; });
    return { meta: meta, aloc: aloc, color: function (m) { var x = value(m, v, aloc); return x == null || isNaN(x) ? 'var(--cds-chart-muted)' : ramp2[q(x)]; }, bins: bins };
  }

  // ---------- mapa ----------
  dash.draw('mapa', function (el) {
    var mun = rows('municipios'), malha = rows('malha'), ufs = rows('ufs');
    if (!mun || !malha || !ufs) { el.__svg = null; return dashEl(el); }
    var P = dash.params(); var v = P.var || 'grupo';
    var byCod = el.__byCod;
    if (!el.__svg || !el.contains(el.__svg) || el.__src !== malha) {
      el.replaceChildren();
      var svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 1000 971'); svg.setAttribute('width', '100%'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Mapa dos municípios');
      var gm = document.createElementNS(SVGNS, 'g'), gu = document.createElementNS(SVGNS, 'g');
      byCod = new Map(); mun.forEach(function (m) { byCod.set(m.cod, m); });
      var paths = new Map();
      malha.forEach(function (r) {
        var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', r.d); p.setAttribute('class', 'm'); p.__cod = r.cod; gm.appendChild(p); paths.set(r.cod, p);
      });
      ufs.forEach(function (r) { var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', r.d); p.setAttribute('class', 'u'); p.__uf = r.uf; gu.appendChild(p); });
      svg.appendChild(gm); svg.appendChild(gu);
      var tip = h('div', { class: 'tip', style: 'display:none' });
      el.appendChild(svg); el.appendChild(tip);
      gm.addEventListener('mousemove', function (ev) {
        var c = ev.target.__cod; var m = el.__byCod && el.__byCod.get(c); if (!m) { tip.style.display = 'none'; return; }
        var s = el.__scale; var vv = el.__var;
        var lab;
        if (vv === 'grupo') lab = 'Perfil ' + m.grupo + (el.__perfis && el.__perfis[m.grupo] ? ': ' + el.__perfis[m.grupo] : '');
        else if (s.meta.t === 'venc') lab = m[vv];
        else lab = fmtV(s.meta, value(m, vv, s.aloc));
        tip.replaceChildren(h('div', { class: 'k', text: m.nome + ' – ' + m.uf }), h('div', { text: lab }));
        tip.style.display = 'block'; tipPos(tip, el, ev);
      });
      gm.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
      gm.addEventListener('click', function (ev) { var c = ev.target.__cod; if (c) dash.setParams({ mun: c }); });
      el.__svg = svg; el.__paths = paths; el.__byCod = byCod; el.__src = malha; el.__ufg = gu;
    }
    var pf = rows('perfis'); el.__perfis = {}; if (pf) pf.forEach(function (p) { el.__perfis[p.grupo] = p.nome; });
    var sc = scaleFor(v, mun, el); el.__scale = sc; el.__var = v;
    el.__paths.forEach(function (p, cod) {
      var m = el.__byCod.get(cod);
      var vis = !P.uf || (m && m.uf === P.uf);
      p.style.display = vis ? '' : 'none';
      p.style.fill = m ? sc.color(m) : 'var(--cds-chart-muted)';
      p.classList.toggle('sel', P.mun != null && cod === Number(P.mun));
    });
    // zoom no estado
    var vb = '0 0 1000 971';
    if (P.uf) {
      var bb = null;
      el.__paths.forEach(function (p, cod) { var m = el.__byCod.get(cod); if (m && m.uf === P.uf) { var b = p.getBBox(); bb = bb ? { x0: Math.min(bb.x0, b.x), y0: Math.min(bb.y0, b.y), x1: Math.max(bb.x1, b.x + b.width), y1: Math.max(bb.y1, b.y + b.height) } : { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }; } });
      if (bb && bb.x1 > bb.x0) { var pad = 0.04 * Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0); vb = [bb.x0 - pad, bb.y0 - pad, bb.x1 - bb.x0 + 2 * pad, bb.y1 - bb.y0 + 2 * pad].join(' '); }
    }
    el.__svg.setAttribute('viewBox', vb);
    el.__ufg.style.display = P.uf ? 'none' : '';
  });

  dash.draw('legenda', function (el) {
    var mun = rows('municipios'); if (!mun) return dashEl(el);
    var P = dash.params(); var v = P.var || 'grupo';
    var map = document.querySelector('.mapbox');
    var sc = (map && map.__scale && map.__var === v) ? map.__scale : scaleFor(v, mun, el);
    el.replaceChildren();
    if (sc.meta.t === 'cat') {
      var pf = rows('perfis'); if (!pf) return dashEl(el);
      pf.forEach(function (p) { el.appendChild(h('span', {}, [h('span', { class: 'sw', style: 'background:' + col(p.grupo - 1) }), 'Perfil ' + p.grupo + ': ' + p.nome])); });
      return;
    }
    if (sc.meta.t === 'venc') {
      var names = v === 'venc_22_2t' ? ['Lula', 'Jair Bolsonaro', 'Empate'] : ['Lula', 'Flávio Bolsonaro', 'Empate'];
      names.forEach(function (nm) { el.appendChild(h('span', {}, [h('span', { class: 'sw', style: 'background:' + sc.cats[nm] }), nm])); });
      return;
    }
    if (!sc.bins) return dashEl(el);
    sc.bins.forEach(function (b) {
      var t = b.a == null ? 'até ' + fmtV(sc.meta, b.b) : b.b == null ? 'acima de ' + fmtV(sc.meta, b.a) : fmtV(sc.meta, b.a) + ' a ' + fmtV(sc.meta, b.b);
      el.appendChild(h('span', {}, [h('span', { class: 'sw', style: 'background:' + b.c }), t]));
    });
    if (sc.meta.t === 'seq') el.appendChild(h('span', { text: sc.meta.dir === 1 ? '· mais escuro = maior valor' : '· mais escuro = pior situação' }));
    if (sc.meta.t === 'div') el.appendChild(h('span', { text: '· tons à direita: Lula; à esquerda: adversário' }));
  });

  // ---------- detalhe do município ----------
  dash.draw('detalhe', function (el) {
    var mun = rows('municipios'), pf = rows('perfis'); var P = dash.params();
    if (!mun || !pf || P.mun == null) return dashEl(el);
    var m = mun.find(function (x) { return x.cod === Number(P.mun); }); if (!m) return dashEl(el);
    var p = pf.find(function (x) { return x.grupo === m.grupo; });
    function dl(pairs) { var d = h('dl'); pairs.forEach(function (x) { d.appendChild(h('dt', { text: x[0] })); d.appendChild(h('dd', { text: x[1] })); }); return d; }
    var needs = h('div');
    DIMS.forEach(function (d) {
      var vv = m['nec_' + d];
      needs.appendChild(h('div', { class: 'dimrow' }, [h('span', { text: DIML[d] }), h('div', { class: 'bar' }, [h('div', { class: 'barfill', style: 'width:' + vv + '%;background:' + col(3) })]), h('span', { text: F.d1(vv), style: 'text-align:right' })]));
    });
    var s = sim(); var al = s && s.res.feasible ? alocMunicipal(mun, s) : null;
    el.replaceChildren(
      h('h3', { text: m.nome + ' – ' + m.uf }),
      h('div', { class: 'perfil-head' }, [h('span', { class: 'chip', style: 'background:' + col(m.grupo - 1) }), h('span', { text: 'Perfil ' + m.grupo + ': ' + (p ? p.nome : '') })]),
      dl([['Região', m.regiao], ['População 2025', F.i(m.pop2025)], ['Índice TOPSIS', F.d1(m.topsis)], ['Posição no país', F.i(m.rank_topsis) + 'º de 5.570'],
          ['Alocação simulada', al ? 'R$ ' + F.d2(al.get(m.cod)) + ' por habitante' : 's/d']]),
      h('h4', { text: 'Necessidade por dimensão (0 = melhor, 100 = pior)' }), needs,
      h('h4', { text: 'Indicadores' }),
      dl([['Mortalidade infantil 2022–24', F.d1(m.tmi) + ' por mil (bruta ' + F.d1(m.tmi_bruta) + '; ' + F.i(m.nascidos) + ' nascidos)'], ['Cobertura Saúde da Família', F.d1(m.cob_esf) + '%'], ['UBS por 10 mil hab.', F.d2(m.ubs_10k)], ['Distância ao hospital', F.d1(m.dist_hospital_km) + ' km'],
          ['Alfabetização 15+', F.d1(m.alfab) + '%'], ['IDEB anos iniciais', F.d1(m.ideb_ai) + (m.ideb_imputado ? ' (imputado)' : '')],
          ['Água por rede (população)', F.d1(m.agua_rede) + '%' + (m.agua_fonte === 'Censo 2022' ? ' (Censo)' : '')], ['Esgoto adequado', F.d1(m.esgoto_adeq) + '%'], ['Coleta de lixo', F.d1(m.lixo_coleta) + '%'],
          ['Renda per capita', 'R$ ' + F.i(m.renda_pc)], ['Empregos formais/mil hab.', F.d1(m.emprego_1000)], ['Domicílios no Bolsa Família', F.d1(m.bf_cob) + '%'], ['PIB per capita 2023', 'R$ ' + F.i(m.pib_pc)]]),
      h('h4', { text: 'Eleição presidencial (votos válidos)' }),
      dl([['2022, 1º turno', 'Lula ' + F.d1(m.lula_22_1t) + '% · J. Bolsonaro ' + F.d1(m.bolsonaro_22_1t) + '%'], ['2022, 2º turno', 'Lula ' + F.d1(m.lula_22_2t) + '% · J. Bolsonaro ' + F.d1(m.bolsonaro_22_2t) + '%'],
          ['2026, 1º turno', 'Lula ' + F.d1(m.lula_26_1t) + '% · F. Bolsonaro ' + F.d1(m.flavio_26_1t) + '%'], ['2026, 2º turno', 'Lula ' + F.d1(m.lula_26_2t) + '% · F. Bolsonaro ' + F.d1(m.flavio_26_2t) + '%'],
          ['Abstenção 2º turno 2022 / 2026', F.d1(m.abst_22_2t) + '% / ' + F.d1(m.abst_26_2t) + '%']])
    );
  });

  // ---------- gráfico de barras agrupadas genérico ----------
  function groupedBars(el, cats, series, get, opt) {
    el.replaceChildren();
    var W = Math.max(280, el.clientWidth || 600), rowH = opt.rowH || 22, gap = 10;
    var H = cats.length * (series.length * rowH + gap) + 30;
    var labW = 0;
    var svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', '0 0 ' + W + ' ' + H).style('font-family', 'var(--font-anthropic-sans)').style('font-size', 'var(--cds-font-size-caption)');
    var probe = svg.append('text').attr('visibility', 'hidden');
    cats.forEach(function (c) { probe.text(c.label); labW = Math.max(labW, probe.node().getComputedTextLength()); });
    probe.remove();
    var x0 = labW + 12, x1 = W - 56;
    var x = d3.scaleLinear().domain([0, opt.max]).range([x0, x1]);
    var tip = h('div', { class: 'tip', style: 'display:none' }); el.appendChild(tip);
    var y = 4;
    cats.forEach(function (c) {
      svg.append('text').attr('x', 0).attr('y', y + series.length * rowH / 2 + 4).attr('fill', 'var(--color-fg)').text(c.label);
      series.forEach(function (s, si) {
        var v = get(c, s); var yy = y + si * rowH;
        svg.append('rect').attr('x', x0).attr('y', yy + 3).attr('height', rowH - 6).attr('width', Math.max(0, x(v || 0) - x0)).attr('rx', 3).attr('fill', s.color)
          .on('mousemove', function (ev) { tip.replaceChildren(h('div', { class: 'k', text: c.label }), h('div', {}, [h('span', { class: 'sw', style: 'background:' + s.color }), s.label + ': ' + opt.fmt(v)])); tip.style.display = 'block'; tipPos(tip, el, ev); })
          .on('mouseleave', function () { tip.style.display = 'none'; });
        svg.append('text').attr('x', x(v || 0) + 4).attr('y', yy + rowH / 2 + 4).attr('fill', 'var(--color-fg-muted)').text(opt.fmt(v));
      });
      y += series.length * rowH + gap;
    });
    if (opt.ref != null) svg.append('line').attr('x1', x(opt.ref)).attr('x2', x(opt.ref)).attr('y1', 0).attr('y2', y).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
    var lg = h('div', { class: 'legend' }); series.forEach(function (s) { lg.appendChild(h('span', {}, [h('span', { class: 'sw', style: 'background:' + s.color }), s.label])); });
    el.appendChild(lg);
  }

  dash.draw('regioes', function (el) {
    var r = rows('dim_regiao'); if (!r) return dashEl(el);
    var cats = REG.map(function (g) { return { key: g, label: g }; });
    var series = DIMS.map(function (d, i) { return { key: d, label: DIML[d], color: col(i) }; });
    groupedBars(el, cats, series, function (c, s) { var x = r.find(function (z) { return z.regiao === c.key && z.dimensao === s.key; }); return x ? x.necessidade : null; }, { max: 100, fmt: F.d1, rowH: 16, ref: 50 });
  });

  // ---------- perfis ----------
  function eleicaoPerfil(g) {
    var r = rows('eleicao_perfil'); var e = r && r.find(function (z) { return z.grupo === g; }); if (!e) return null;
    var v = e.variacao, sv = (v > 0 ? '+' : v < 0 ? '−' : '') + F.d1(Math.abs(v));
    return h('p', { class: 'muted', style: 'margin-top:var(--cds-gap-sm)', text: 'Eleição presidencial, 2º turno: Lula teve ' + F.d1(e.lula_22_2t) + '% em 2022 e ' + F.d1(e.lula_26_2t) + '% em 2026 (' + sv + ' p.p.) e venceu em ' + F.d1(e.pct_mun_lula_26) + '% dos municípios do perfil. ' + F.i(e.viraram_flavio) + ' municípios passaram para Flávio Bolsonaro e ' + F.i(e.viraram_lula) + ' para Lula.' });
  }
  dash.draw('perfis-cards', function (el) {
    var pf = rows('perfis'); if (!pf) return dashEl(el);
    el.replaceChildren();
    pf.forEach(function (p) {
      var needs = h('div');
      DIMS.forEach(function (d) {
        var v = p['nec_' + d];
        needs.appendChild(h('div', { class: 'dimrow' }, [h('span', { text: DIML[d] }), h('div', { class: 'bar' }, [h('div', { class: 'barfill', style: 'width:' + v + '%;background:' + col(p.grupo - 1) })]), h('span', { text: F.d1(v), style: 'text-align:right' })]));
      });
      var comp = h('div', { style: 'display:flex;height:10px;border-radius:3px;overflow:hidden;margin:4px 0' });
      var compTxt = [];
      REG.forEach(function (r, i) { var v = p[r] || 0; if (v > 0) { comp.appendChild(h('div', { title: r + ': ' + F.d1(v) + '%', style: 'width:' + v + '%;background:' + col(i) })); if (v >= 5) compTxt.push(r + ' ' + F.i(v) + '%'); } });
      el.appendChild(h('div', { class: 'card', id: 'perfil-' + p.grupo }, [
        h('div', { class: 'perfil-head' }, [h('span', { class: 'chip', style: 'background:' + col(p.grupo - 1) }), h('h2', { text: 'Perfil ' + p.grupo + ': ' + p.nome, style: 'margin:0' })]),
        h('p', { class: 'muted', text: F.i(p.municipios) + ' municípios · ' + F.d1(p.pop_pct) + '% da população · TOPSIS médio ' + F.d1(p.topsis) }),
        h('p', { text: p.descricao }),
        h('h3', { text: 'Necessidade média (0–100)' }), needs,
        h('h3', { text: 'Distribuição por região', style: 'margin-top:var(--cds-gap-sm)' }), comp, h('p', { class: 'muted', text: compTxt.join(' · ') }),
        h('div', { class: 'policy' }, [h('h3', { text: 'Políticas sugeridas' }), h('p', { text: p.politicas_sugeridas, style: 'margin:0' })]),
        eleicaoPerfil(p.grupo)
      ]));
    });
  });

  dash.draw('matriz', function (el) {
    var pf = rows('perfis'); el.replaceChildren(); if (!pf) return;
    var C = [['municipios', F.i], ['pop_pct', F.d1], ['tmi', F.d1], ['cob_esf', F.d1], ['ubs_por_10k', F.d1], ['alfab', F.d1], ['ideb_ai', F.d1], ['agua_rede', F.d1], ['esgoto_adeq', F.d1], ['lixo_coleta', F.d1], ['renda_pc', F.i], ['emprego_1000', F.d1], ['bf_cob', F.d1]];
    pf.forEach(function (p) {
      var tr = h('tr', { 'data-key': String(p.grupo) }, [h('td', {}, [h('span', { class: 'sw', style: 'background:' + col(p.grupo - 1) }), String(p.grupo)])]);
      C.forEach(function (c) { tr.appendChild(h('td', { class: 'n', text: c[1](p[c[0]]) })); });
      el.appendChild(tr);
    });
  });

  // ---------- ranking ----------
  dash.draw('ranking', function (el) {
    var mun = rows('municipios'); el.replaceChildren(); if (!mun) return;
    var P = dash.params();
    var list = mun.filter(function (m) { return (!P.uf || m.uf === P.uf) && (P.rgrupo == null || m.grupo === Number(P.rgrupo)); })
      .sort(function (a, b) { return a.rank_topsis - b.rank_topsis; }).slice(0, 300);
    list.forEach(function (m) {
      var venc = m.venc_26_2t === 'Flávio Bolsonaro' ? 'F. Bolsonaro' : m.venc_26_2t;
      var tr = h('tr', { 'data-key': String(m.cod), style: 'cursor:pointer' }, [
        h('td', { class: 'n', text: F.i(m.rank_topsis) }), h('td', { text: m.nome }), h('td', { text: m.uf }),
        h('td', { class: 'n' }, [h('span', { class: 'sw', style: 'background:' + col(m.grupo - 1) }), String(m.grupo)]),
        h('td', { class: 'n', text: F.d1(m.topsis) }), h('td', { class: 'n', text: F.d1(m.nec_saude) }), h('td', { class: 'n', text: F.d1(m.nec_educacao) }),
        h('td', { class: 'n', text: F.d1(m.nec_saneamento) }), h('td', { class: 'n', text: F.d1(m.nec_renda) }), h('td', { class: 'n', text: F.i(m.pop2025) }),
        h('td', { class: 'n', text: F.d1(m.lula_22_2t) }), h('td', { class: 'n', text: F.d1(m.lula_26_2t) }), h('td', { text: venc })
      ]);
      tr.addEventListener('click', function () { dash.setParams({ mun: m.cod }); showTab('visao'); dash.setLink('visao'); });
      el.appendChild(tr);
    });
  });

  // ---------- simulador ----------
  function vlabel(name, fn) {
    dash.draw(name, function (el) { var inp = simInputs(); if (!inp) return dashEl(el); el.textContent = fn(inp); });
  }
  vlabel('v-orc', function (i) { return 'R$ ' + F.i(i.geral.orcamento_bi) + ' bi'; });
  vlabel('v-preg', function (i) { return F.i(i.geral.piso_regional_pct) + '%'; });
  vlabel('v-teto', function (i) { return 'R$ ' + F.i(i.geral.teto_per_capita); });
  vlabel('v-eq', function (i) { return F.d1(i.geral.equidade); });
  DIMS.forEach(function (d) { vlabel('v-w_' + d, function (i) { return F.d2(i.politicas.find(function (p) { return p.politica === d; }).peso); }); });

  function simDraw(name, fn) {
    dash.draw(name, function (el) { var s = sim(); if (!s || !s.res.feasible) return dashEl(el); fn(el, s); });
  }
  function gapTotal(g) { var t = 0; g.forEach(function (x) { DIMS.forEach(function (d) { t += x['gap_' + d]; }); }); return t; }
  simDraw('s-gasto', function (el, s) { el.textContent = 'R$ ' + F.d1(d3.sum(s.res.rows, function (r) { return r.gasto; }) / 1e9) + ' bi'; });
  simDraw('s-red', function (el, s) { el.textContent = F.pct(100 * d3.sum(s.res.rows, function (r) { return r.reducao; }) / gapTotal(s.inp.grupos)); });
  simDraw('s-min', function (el, s) { el.textContent = F.pct(d3.min(s.res.rows, function (r) { return r.reducao_pct; })); });
  simDraw('s-marg', function (el, s) {
    var r2 = solveCached(s.inp, s.inp.modo, 1);
    if (!r2.feasible) return dashEl(el);
    var d = d3.sum(r2.rows, function (r) { return r.reducao; }) - d3.sum(s.res.rows, function (r) { return r.reducao; });
    el.textContent = '+' + F.i(d / 1e3) + ' mil';
  });
  dash.draw('s-inviavel', function (el) { el.replaceChildren(); var s = sim(); if (s && !s.res.feasible) el.appendChild(h('div', { class: 'note', text: 'Não há alocação que respeite todos os pisos e tetos com esses valores. Aumente o orçamento ou o teto por habitante, ou reduza o piso regional.' })); });

  simDraw('s-regiao', function (el, s) {
    var cats = REG.map(function (g) { return { key: g, label: g }; });
    var series = DIMS.map(function (d, i) { return { key: d, label: DIML[d], color: col(i) }; });
    var agg = {}; s.res.rows.forEach(function (r) { var k = r.regiao + '|' + r.politica; agg[k] = (agg[k] || 0) + r.gasto / 1e9; });
    var mx = d3.max(Object.values(agg)) || 1;
    groupedBars(el, cats, series, function (c, sr) { return agg[c.key + '|' + sr.key] || 0; }, { max: mx * 1.1, fmt: function (v) { return 'R$ ' + F.d2(v) + ' bi'; }, rowH: 16 });
  });
  simDraw('s-perfil', function (el, s) {
    var pf = rows('perfis'); if (!pf) return dashEl(el);
    var a = solveCached(s.inp, 'equidade'), b = solveCached(s.inp, 'eficiencia');
    var pop = {}; s.inp.grupos.forEach(function (g) { pop[g.grupo] = (pop[g.grupo] || 0) + g.pop; });
    function per(res) { var o = {}; if (!res.feasible) return o; res.rows.forEach(function (r) { o[r.grupo] = (o[r.grupo] || 0) + r.gasto; }); for (var k in o) o[k] /= pop[k]; return o; }
    var A = per(a), B = per(b);
    var cats = pf.map(function (p) { return { key: p.grupo, label: 'Perfil ' + p.grupo }; });
    var series = [{ key: 'eq', label: 'Equidade', color: col(4) }, { key: 'ef', label: 'Eficiência', color: col(5) }];
    var mx = d3.max(cats, function (c) { return Math.max(A[c.key] || 0, B[c.key] || 0); }) || 1;
    groupedBars(el, cats, series, function (c, sr) { return (sr.key === 'eq' ? A : B)[c.key] || 0; }, { max: mx * 1.1, fmt: function (v) { return 'R$ ' + F.i(v); }, rowH: 16 });
  });
  simDraw('s-tabela', function (el, s) {
    var pf = rows('perfis'); var nm = {}; if (pf) pf.forEach(function (p) { nm[p.grupo] = p.nome; });
    var t = h('table'), th = h('tr', {}, [h('th', { text: 'Região' }), h('th', { text: 'Perfil' }), h('th', { class: 'n', text: 'População' })]);
    DIMS.forEach(function (d) { th.appendChild(h('th', { class: 'n', text: DIML[d] })); });
    th.appendChild(h('th', { class: 'n', text: 'Total (R$ mi)' })); th.appendChild(h('th', { class: 'n', text: 'R$/hab.' }));
    t.appendChild(h('thead', {}, [th]));
    var tb = h('tbody');
    var by = {}; s.res.rows.forEach(function (r) { by[r.gid + '|' + r.politica] = r; });
    var gs = s.inp.grupos.slice().sort(function (a, b) { return REG.indexOf(a.regiao) - REG.indexOf(b.regiao) || a.grupo - b.grupo; });
    var tot = { saude: 0, educacao: 0, saneamento: 0, renda: 0 }, totPop = 0;
    gs.forEach(function (g) {
      var tr = h('tr', {}, [h('td', { text: g.regiao }), h('td', {}, [h('span', { class: 'sw', style: 'background:' + col(g.grupo - 1) }), String(g.grupo)]), h('td', { class: 'n', text: F.i(g.pop) })]);
      var sum = 0;
      DIMS.forEach(function (d) { var r = by[g.gid + '|' + d]; sum += r.gasto; tot[d] += r.gasto; tr.appendChild(h('td', { class: 'n', text: F.i(r.gasto / 1e6) + ' (' + F.i(r.reducao_pct) + '%)' })); });
      totPop += g.pop;
      tr.appendChild(h('td', { class: 'n', text: F.i(sum / 1e6) })); tr.appendChild(h('td', { class: 'n', text: F.i(sum / g.pop) }));
      tb.appendChild(tr);
    });
    var all = d3.sum(DIMS, function (d) { return tot[d]; });
    var tr = h('tr', { style: 'font-weight:600' }, [h('td', { text: 'Total' }), h('td'), h('td', { class: 'n', text: F.i(totPop) })]);
    DIMS.forEach(function (d) { tr.appendChild(h('td', { class: 'n', text: F.i(tot[d] / 1e6) })); });
    tr.appendChild(h('td', { class: 'n', text: F.i(all / 1e6) })); tr.appendChild(h('td', { class: 'n', text: F.i(all / totPop) }));
    tb.appendChild(tr); t.appendChild(tb);
    el.replaceChildren(t);
  });
  dash.draw('s-ref', function (el) {
    var r = rows('ref_politica'); if (!r) return dashEl(el);
    var t = h('table'), hd = h('tr', {}, [h('th', { text: 'Formulação' })]);
    DIMS.forEach(function (d) { hd.appendChild(h('th', { class: 'n', text: DIML[d] + ' (R$ bi)' })); });
    t.appendChild(h('thead', {}, [hd])); var tb = h('tbody');
    [['equidade', 'Equidade'], ['eficiencia', 'Eficiência']].forEach(function (m) {
      var tr = h('tr', {}, [h('td', { text: m[1] })]);
      DIMS.forEach(function (d) { var x = r.find(function (z) { return z.modelo === m[0] && z.politica === d; }); tr.appendChild(h('td', { class: 'n', text: x ? F.d2(x.gasto_bi) : '—' })); });
      tb.appendChild(tr);
    });
    t.appendChild(tb); el.replaceChildren(t);
  });

  // ---------- eleições ----------
  function ekpi(name, fn) { dash.draw(name, function (el) { var r = rows('votos_brasil'); if (!r) return dashEl(el); el.textContent = fn(r[0]); }); }
  ekpi('e-22', function (r) { return F.pct(r.lula_22_2t); });
  ekpi('e-26', function (r) { return F.pct(r.lula_26_2t); });
  ekpi('e-26-1', function (r) { return F.pct(r.flavio_26_1t); });
  ekpi('e-mun', function (r) { return F.i(r.mudaram_vencedor); });
  dash.draw('votos-perfil', function (el) {
    var r = rows('votos_perfil'), pf = rows('perfis'); if (!r || !pf) return dashEl(el);
    var cats = pf.map(function (p) { return { key: p.grupo, label: 'Perfil ' + p.grupo }; });
    var series = [{ key: '2022', label: '2022', color: col(6) }, { key: '2026', label: '2026', color: col(0) }];
    groupedBars(el, cats, series, function (c, s) { var x = r.find(function (z) { return z.grupo === c.key && String(z.ano) === s.key; }); return x ? x.lula : null; }, { max: 100, fmt: F.pct, rowH: 16, ref: 50 });
  });
  dash.draw('votos-regiao', function (el) {
    var r = rows('votos_regiao'); if (!r) return dashEl(el);
    var E = ['2022 · 1º turno', '2022 · 2º turno', '2026 · 1º turno', '2026 · 2º turno'];
    var t = h('table'); var hd = h('tr', {}, [h('th', { text: 'Região' })]);
    E.forEach(function (e) { hd.appendChild(h('th', { class: 'n', text: e })); });
    t.appendChild(h('thead', {}, [hd])); var tb = h('tbody');
    REG.forEach(function (g) {
      var tr = h('tr', {}, [h('td', { text: g })]);
      E.forEach(function (e) { var x = r.find(function (z) { return z.regiao === g && z.eleicao === e; }); tr.appendChild(h('td', { class: 'n', text: x ? 'Lula ' + F.d1(x.lula) + '% · ' + x.adversario.split(' ')[0][0] + '. Bolsonaro ' + F.d1(x.adversario_pct) + '%' : '—' })); });
      tb.appendChild(tr);
    });
    t.appendChild(tb); el.replaceChildren(t);
  });

  window.PM = { rows: rows, F: F, col: col, h: h, dashEl: dashEl, tipPos: tipPos, groupedBars: groupedBars, sim: sim, alocMunicipal: alocMunicipal };

  // ---------- método ----------
  dash.draw('selk', function (el) {
    var r = rows('selecao_k'); el.replaceChildren(); if (!r) return;
    r.forEach(function (x) {
      el.appendChild(h('tr', { 'data-key': String(x.k), style: x.escolhido ? 'font-weight:600' : '' }, [h('td', { class: 'n', text: String(x.k) }), h('td', { class: 'n', text: F.d2(x.silhueta) }), h('td', { class: 'n', text: F.i(x.inercia) }), h('td', { class: 'n', text: F.i(x.menor_grupo) })]));
    });
  });
})();
