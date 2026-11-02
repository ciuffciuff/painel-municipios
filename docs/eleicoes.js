// Análise eleitoral (2022 e 2026) cruzada com as necessidades, em todas as abas do painel.
// Usa os auxiliares que app.js expõe em window.PM.
(function () {
  var PM = window.PM;
  var rows = PM.rows, F = PM.F, col = PM.col, h = PM.h, dashEl = PM.dashEl;

  // ---------- cálculos ----------
  dash.calc('eleicao_perfil', {
    inputs: ['municipios'], title: 'Eleições por perfil de necessidade',
    description: 'Por perfil: % de Lula e de Flávio Bolsonaro (votos válidos, ponderado pelos votos de cada município), variação 2022→2026, abstenção e municípios que mudaram de vencedor.',
    fn: function (municipios) {
      var acc = {};
      municipios.forEach(function (m) {
        var g = Number(m.grupo), a = acc[g] = acc[g] || { grupo: g, n: 0, l22: 0, w22: 0, l26: 0, w26: 0, l261: 0, f261: 0, w261: 0, ab22: 0, ab26: 0, venceL26: 0, viraL: 0, viraF: 0 };
        var w22 = Number(m.votos_22_2t), w26 = Number(m.votos_26_2t), w261 = Number(m.votos_26_1t);
        a.n += 1; a.l22 += Number(m.lula_22_2t) * w22; a.w22 += w22; a.l26 += Number(m.lula_26_2t) * w26; a.w26 += w26;
        a.l261 += Number(m.lula_26_1t) * w261; a.f261 += Number(m.flavio_26_1t) * w261; a.w261 += w261;
        a.ab22 += Number(m.abst_22_2t) * w22; a.ab26 += Number(m.abst_26_2t) * w26;
        if (m.venc_26_2t === 'Lula') a.venceL26 += 1;
        if (m.venc_22_2t !== 'Lula' && m.venc_26_2t === 'Lula') a.viraL += 1;
        if (m.venc_22_2t === 'Lula' && m.venc_26_2t !== 'Lula' && m.venc_26_2t !== 'Empate') a.viraF += 1;
      });
      return Object.values(acc).sort(function (x, y) { return x.grupo - y.grupo; }).map(function (a) {
        var l22 = a.l22 / a.w22, l26 = a.l26 / a.w26;
        return { grupo: a.grupo, lula_22_2t: l22, lula_26_2t: l26, variacao: l26 - l22, lula_26_1t: a.l261 / a.w261, flavio_26_1t: a.f261 / a.w261,
                 abst_22_2t: a.ab22 / a.w22, abst_26_2t: a.ab26 / a.w26, pct_mun_lula_26: 100 * a.venceL26 / a.n, viraram_lula: a.viraL, viraram_flavio: a.viraF };
      });
    }
  });

  dash.calc('eleicao_corr', {
    inputs: ['municipios'], title: 'Correlação entre indicadores e voto',
    description: 'Correlação de Pearson, entre os 5.570 municípios, de cada indicador com o % de Lula no 2º turno de 2026 e com a variação de Lula entre 2022 e 2026 (p.p.).',
    fn: function (municipios) {
      var V = [['topsis', 'Índice de prioridade (TOPSIS)'], ['nec_saude', 'Necessidade em saúde'], ['nec_educacao', 'Necessidade em educação'], ['nec_saneamento', 'Necessidade em saneamento'], ['nec_renda', 'Necessidade em renda'],
               ['renda_pc', 'Renda per capita'], ['alfab', 'Alfabetização 15+'], ['bf_cob', 'Domicílios no Bolsa Família'], ['esgoto_adeq', 'Esgoto adequado'], ['ideb_ai', 'IDEB anos iniciais'], ['tmi', 'Mortalidade infantil'], ['cob_esf', 'Cobertura Saúde da Família'], ['emprego_1000', 'Emprego formal/mil hab.']];
      function r(xs, ys) {
        var n = xs.length, mx = 0, my = 0, i; for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; } mx /= n; my /= n;
        var sxy = 0, sxx = 0, syy = 0; for (i = 0; i < n; i++) { var a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
        return sxy / Math.sqrt(sxx * syy);
      }
      var y = municipios.map(function (m) { return Number(m.lula_26_2t); });
      var s = municipios.map(function (m) { return Number(m.lula_26_2t) - Number(m.lula_22_2t); });
      return V.map(function (v) {
        var x = municipios.map(function (m) { return Number(m[v[0]]); });
        return { indicador: v[0], rotulo: v[1], r_lula_26: Math.round(1000 * r(x, y)) / 1000, r_variacao: Math.round(1000 * r(x, s)) / 1000 };
      });
    }
  });

  dash.calc('eleicao_quintil', {
    inputs: ['municipios'], title: 'Voto por quinto de prioridade',
    description: 'Municípios divididos em cinco partes iguais pela posição no TOPSIS (1 = menos prioritários); % de Lula no 2º turno ponderado pelos votos válidos.',
    fn: function (municipios) {
      var n = municipios.length, acc = {};
      municipios.forEach(function (m) {
        var q = 5 - Math.min(4, Math.floor((Number(m.rank_topsis) - 1) * 5 / n));
        var a = acc[q] = acc[q] || { quinto: q, n: 0, l22: 0, w22: 0, l26: 0, w26: 0 };
        a.n += 1; a.l22 += Number(m.lula_22_2t) * Number(m.votos_22_2t); a.w22 += Number(m.votos_22_2t);
        a.l26 += Number(m.lula_26_2t) * Number(m.votos_26_2t); a.w26 += Number(m.votos_26_2t);
      });
      return Object.values(acc).sort(function (x, y) { return x.quinto - y.quinto; }).map(function (a) {
        return { quinto: a.quinto, municipios: a.n, lula_22_2t: a.l22 / a.w22, lula_26_2t: a.l26 / a.w26 };
      });
    }
  });

  dash.calc('eleicao_resumo', {
    inputs: ['municipios'], title: 'Resumo da variação eleitoral',
    description: 'Variação de Lula no 2º turno entre 2022 e 2026: no total de votos e na mediana dos municípios; municípios que mudaram de vencedor.',
    fn: function (municipios) {
      var l22 = 0, w22 = 0, l26 = 0, w26 = 0, viraL = 0, viraF = 0, sw = [];
      municipios.forEach(function (m) {
        l22 += Number(m.lula_22_2t) * Number(m.votos_22_2t); w22 += Number(m.votos_22_2t);
        l26 += Number(m.lula_26_2t) * Number(m.votos_26_2t); w26 += Number(m.votos_26_2t);
        sw.push(Number(m.lula_26_2t) - Number(m.lula_22_2t));
        if (m.venc_22_2t !== 'Lula' && m.venc_26_2t === 'Lula') viraL += 1;
        if (m.venc_22_2t === 'Lula' && m.venc_26_2t !== 'Lula' && m.venc_26_2t !== 'Empate') viraF += 1;
      });
      sw.sort(function (a, b) { return a - b; });
      var neg = sw.filter(function (x) { return x < 0; }).length;
      return [{ variacao_total: l26 / w26 - l22 / w22, variacao_mediana: sw[Math.floor(sw.length / 2)], pct_mun_queda: 100 * neg / sw.length, viraram_lula: viraL, viraram_flavio: viraF }];
    }
  });

  // ---------- auxiliares de desenho ----------
  function txt(name, fn, src) {
    dash.draw(name, function (el) { var r = rows(src); if (!r) return dashEl(el); var v = fn(r); if (v == null) return dashEl(el); el.textContent = v; });
  }
  function corr(id) { return function (r) { var x = r.find(function (z) { return z.indicador === id; }); return x ? F.d2(x.r_lula_26) : null; }; }
  function sinal(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + F.d1(Math.abs(v)); }
  function perfilV(g, k, fmt) { return function (r) { var x = r.find(function (z) { return z.grupo === g; }); return x ? fmt(x[k]) : null; }; }

  // ---------- visão geral: dispersão TOPSIS × voto ----------
  txt('vg-r', corr('topsis'), 'eleicao_corr');
  txt('vg-q1', function (r) { return F.d1(r[0].lula_26_2t); }, 'eleicao_quintil');
  txt('vg-q5', function (r) { return F.d1(r[4].lula_26_2t); }, 'eleicao_quintil');
  dash.draw('dispersao', function (el) {
    var mun = rows('municipios'); if (!mun) return dashEl(el);
    var P = dash.params();
    el.replaceChildren();
    var W = Math.max(300, el.clientWidth || 600), H = Math.round(Math.min(420, W * 0.62)), m = { l: 44, r: 12, t: 10, b: 40 };
    var x = d3.scaleLinear().domain([0, 100]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, 100]).range([H - m.b, m.t]);
    var svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', '0 0 ' + W + ' ' + H).style('font-family', 'var(--font-anthropic-sans)').style('font-size', 'var(--cds-font-size-caption)');
    [0, 25, 50, 75, 100].forEach(function (t) {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', 'var(--cds-chart-grid)');
      svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('fill', 'var(--color-fg-muted)').text(t + '%');
      svg.append('text').attr('x', x(t)).attr('y', H - m.b + 16).attr('text-anchor', 'middle').attr('fill', 'var(--color-fg-muted)').text(t);
    });
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(50)).attr('y2', y(50)).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
    svg.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', H - 6).attr('text-anchor', 'middle').attr('fill', 'var(--color-fg-muted)').text('Índice de prioridade (TOPSIS) →');
    var g = svg.append('g');
    var sel = mun.filter(function (d) { return !P.uf || d.uf === P.uf; });
    g.selectAll('circle').data(sel).join('circle').attr('cx', function (d) { return x(d.topsis); }).attr('cy', function (d) { return y(d.lula_26_2t); })
      .attr('r', function (d) { return Math.max(1.4, Math.min(7, Math.sqrt(d.pop2025) / 160)); }).attr('fill', function (d) { return col(d.grupo - 1); }).attr('fill-opacity', 0.55)
      .style('cursor', 'pointer').on('click', function (ev, d) { dash.setParams({ mun: d.cod }); });
    var tip = h('div', { class: 'tip', style: 'display:none' }); el.appendChild(tip);
    g.on('mousemove', function (ev) {
      var d = ev.target.__data__; if (!d || !d.nome) { tip.style.display = 'none'; return; }
      tip.replaceChildren(h('div', { class: 'k', text: d.nome + ' – ' + d.uf }), h('div', { text: 'TOPSIS ' + F.d1(d.topsis) + ' · Lula ' + F.d1(d.lula_26_2t) + '% · Perfil ' + d.grupo }));
      tip.style.display = 'block'; PM.tipPos(tip, el, ev);
    }).on('mouseleave', function () { tip.style.display = 'none'; });
  });

  // ---------- perfis: tabela eleitoral ----------
  dash.draw('perfis-eleicao', function (el) {
    var r = rows('eleicao_perfil'); el.replaceChildren(); if (!r) return;
    r.forEach(function (p) {
      el.appendChild(h('tr', { 'data-key': String(p.grupo) }, [
        h('td', {}, [h('span', { class: 'sw', style: 'background:' + col(p.grupo - 1) }), String(p.grupo)]),
        h('td', { class: 'n', text: F.d1(p.lula_22_2t) }), h('td', { class: 'n', text: F.d1(p.lula_26_2t) }), h('td', { class: 'n', text: sinal(p.variacao) }),
        h('td', { class: 'n', text: F.d1(p.flavio_26_1t) }), h('td', { class: 'n', text: F.d1(p.pct_mun_lula_26) }),
        h('td', { class: 'n', text: F.i(p.viraram_flavio) }), h('td', { class: 'n', text: F.i(p.viraram_lula) }), h('td', { class: 'n', text: F.d1(p.abst_26_2t) })
      ]));
    });
  });
  txt('pe-l6', perfilV(6, 'lula_26_2t', F.d1), 'eleicao_perfil');
  txt('pe-l1', perfilV(1, 'lula_26_2t', F.d1), 'eleicao_perfil');
  txt('pe-l3', perfilV(3, 'lula_26_2t', F.d1), 'eleicao_perfil');
  txt('pe-v2', perfilV(2, 'variacao', sinal), 'eleicao_perfil');
  txt('pe-v3', perfilV(3, 'variacao', sinal), 'eleicao_perfil');
  txt('pe-f3', perfilV(3, 'viraram_flavio', F.i), 'eleicao_perfil');

  // ---------- ranking: leitura ----------
  dash.draw('rk-eleicao', function (el) {
    var mun = rows('municipios'); if (!mun) return dashEl(el);
    var P = dash.params();
    var list = mun.filter(function (m) { return (!P.uf || m.uf === P.uf) && (P.rgrupo == null || m.grupo === Number(P.rgrupo)); })
      .sort(function (a, b) { return a.rank_topsis - b.rank_topsis; }).slice(0, 300);
    if (!list.length) return dashEl(el);
    var nL = list.filter(function (m) { return m.venc_26_2t === 'Lula'; }).length, s = 0, w = 0;
    list.forEach(function (m) { s += m.lula_26_2t * m.votos_26_2t; w += m.votos_26_2t; });
    el.textContent = 'Lula venceu o 2º turno de 2026 em ' + F.i(nL) + ' dos ' + F.i(list.length) + ' municípios listados (' + F.d1(100 * nL / list.length) + '%), com ' + F.d1(s / w) + '% dos votos válidos somados.';
  });

  // ---------- simulador: neutralidade eleitoral ----------
  dash.draw('sim-eleicao', function (el) {
    var mun = rows('municipios'), s = PM.sim(); if (!mun || !s || !s.res.feasible) return dashEl(el);
    var al = PM.alocMunicipal(mun, s); if (!al) return dashEl(el);
    function agg(key) { var o = {}; mun.forEach(function (m) { var k = key(m); if (k == null) return; o[k] = o[k] || { r: 0, p: 0, n: 0 }; o[k].r += al.get(m.cod) * m.pop2025; o[k].p += m.pop2025; o[k].n += 1; }); return o; }
    var byW = agg(function (m) { return m.venc_26_2t === 'Empate' ? null : m.venc_26_2t; });
    var sorted = mun.slice().sort(function (a, b) { return a.lula_26_2t - b.lula_26_2t; }), qOf = new Map();
    sorted.forEach(function (m, i) { qOf.set(m.cod, 1 + Math.min(4, Math.floor(i * 5 / sorted.length))); });
    var byQ = agg(function (m) { return qOf.get(m.cod); });
    var t = h('table'), tb = h('tbody');
    t.appendChild(h('thead', {}, [h('tr', {}, [h('th', { text: 'Recorte (2º turno de 2026)' }), h('th', { class: 'n', text: 'Municípios' }), h('th', { class: 'n', text: 'R$ por habitante' }), h('th', { class: 'n', text: 'Parcela do orçamento' })])]));
    var tot = 0; mun.forEach(function (m) { tot += al.get(m.cod) * m.pop2025; });
    function row(lab, a) { tb.appendChild(h('tr', {}, [h('td', { text: lab }), h('td', { class: 'n', text: F.i(a.n) }), h('td', { class: 'n', text: 'R$ ' + F.i(a.r / a.p) }), h('td', { class: 'n', text: F.pct(100 * a.r / tot) })])); }
    if (byW['Lula']) row('Lula venceu', byW['Lula']);
    if (byW['Flávio Bolsonaro']) row('Flávio Bolsonaro venceu', byW['Flávio Bolsonaro']);
    ['1º quinto (menor % de Lula)', '2º quinto', '3º quinto', '4º quinto', '5º quinto (maior % de Lula)'].forEach(function (lab, i) { if (byQ[i + 1]) row(lab, byQ[i + 1]); });
    t.appendChild(tb); el.replaceChildren(t);
  });

  // ---------- aba eleições: análise ----------
  txt('el-r', corr('topsis'), 'eleicao_corr');
  txt('el-rr', corr('renda_pc'), 'eleicao_corr');
  txt('el-ra', corr('alfab'), 'eleicao_corr');
  txt('el-rb', corr('bf_cob'), 'eleicao_corr');
  txt('el-rs', corr('nec_saude'), 'eleicao_corr');
  txt('el-rt', corr('tmi'), 'eleicao_corr');
  txt('el-q1', function (r) { return F.d1(r[0].lula_26_2t); }, 'eleicao_quintil');
  txt('el-q5', function (r) { return F.d1(r[4].lula_26_2t); }, 'eleicao_quintil');
  txt('el-vt', function (r) { return sinal(r[0].variacao_total); }, 'eleicao_resumo');
  txt('el-vm', function (r) { return sinal(r[0].variacao_mediana); }, 'eleicao_resumo');
  txt('el-pq', function (r) { return F.d1(r[0].pct_mun_queda); }, 'eleicao_resumo');
  txt('el-vf', function (r) { return F.i(r[0].viraram_flavio); }, 'eleicao_resumo');
  txt('el-vl', function (r) { return F.i(r[0].viraram_lula); }, 'eleicao_resumo');
  txt('el-v2', perfilV(2, 'variacao', sinal), 'eleicao_perfil');
  txt('el-v3', perfilV(3, 'variacao', sinal), 'eleicao_perfil');
  txt('el-rsw', function (r) { var x = r.find(function (z) { return z.indicador === 'esgoto_adeq'; }); return x ? F.d2(x.r_variacao) : null; }, 'eleicao_corr');

  dash.draw('el-corr', function (el) {
    var r = rows('eleicao_corr'); if (!r) return dashEl(el);
    el.replaceChildren();
    var data = r.slice().sort(function (a, b) { return b.r_lula_26 - a.r_lula_26; });
    var W = Math.max(300, el.clientWidth || 600), rowH = 22, H = data.length * rowH + 30;
    var svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', '0 0 ' + W + ' ' + H).style('font-family', 'var(--font-anthropic-sans)').style('font-size', 'var(--cds-font-size-caption)');
    var probe = svg.append('text').attr('visibility', 'hidden'), lw = 0;
    data.forEach(function (d) { probe.text(d.rotulo); lw = Math.max(lw, probe.node().getComputedTextLength()); }); probe.remove();
    var x = d3.scaleLinear().domain([-1, 1]).range([lw + 16, W - 40]);
    [-1, -0.5, 0, 0.5, 1].forEach(function (t) {
      svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', 0).attr('y2', data.length * rowH).attr('stroke', t === 0 ? 'var(--cds-chart-axis)' : 'var(--cds-chart-grid)');
      svg.append('text').attr('x', x(t)).attr('y', data.length * rowH + 16).attr('text-anchor', 'middle').attr('fill', 'var(--color-fg-muted)').text(F.d1(t));
    });
    data.forEach(function (d, i) {
      var yy = i * rowH;
      svg.append('text').attr('x', 0).attr('y', yy + rowH / 2 + 4).attr('fill', 'var(--color-fg)').text(d.rotulo);
      var v = d.r_lula_26;
      svg.append('rect').attr('x', Math.min(x(0), x(v))).attr('y', yy + 4).attr('width', Math.abs(x(v) - x(0))).attr('height', rowH - 8).attr('rx', 3).attr('fill', v >= 0 ? col(0) : col(1));
      svg.append('text').attr('x', v >= 0 ? x(v) + 4 : x(v) - 4).attr('text-anchor', v >= 0 ? 'start' : 'end').attr('y', yy + rowH / 2 + 4).attr('fill', 'var(--color-fg-muted)').text(F.d2(v));
    });
  });

  dash.draw('el-quintil', function (el) {
    var r = rows('eleicao_quintil'); if (!r) return dashEl(el);
    var cats = r.map(function (q) { return { key: q.quinto, label: q.quinto + 'º quinto' }; });
    var series = [{ key: 'lula_22_2t', label: '2022', color: col(6) }, { key: 'lula_26_2t', label: '2026', color: col(0) }];
    PM.groupedBars(el, cats, series, function (c, s) { return r.find(function (z) { return z.quinto === c.key; })[s.key]; }, { max: 100, fmt: F.pct, rowH: 16, ref: 50 });
  });

  dash.draw('el-variacao', function (el) {
    var r = rows('eleicao_perfil'); if (!r) return dashEl(el);
    el.replaceChildren();
    var W = Math.max(300, el.clientWidth || 600), rowH = 26, H = r.length * rowH + 30;
    var svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', '0 0 ' + W + ' ' + H).style('font-family', 'var(--font-anthropic-sans)').style('font-size', 'var(--cds-font-size-caption)');
    var mx = d3.max(r, function (p) { return Math.abs(p.variacao); }) || 1;
    var x = d3.scaleLinear().domain([-mx * 1.25, mx * 1.25]).range([130, W - 60]);
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', r.length * rowH).attr('stroke', 'var(--cds-chart-axis)');
    r.forEach(function (p, i) {
      var yy = i * rowH, v = p.variacao;
      svg.append('text').attr('x', 0).attr('y', yy + rowH / 2 + 4).attr('fill', 'var(--color-fg)').text('Perfil ' + p.grupo);
      svg.append('rect').attr('x', Math.min(x(0), x(v))).attr('y', yy + 5).attr('width', Math.abs(x(v) - x(0))).attr('height', rowH - 10).attr('rx', 3).attr('fill', col(p.grupo - 1));
      svg.append('text').attr('x', v >= 0 ? x(v) + 4 : x(v) - 4).attr('text-anchor', v >= 0 ? 'start' : 'end').attr('y', yy + rowH / 2 + 4).attr('fill', 'var(--color-fg-muted)').text(sinal(v) + ' p.p.');
    });
    svg.append('text').attr('x', x(0)).attr('y', r.length * rowH + 18).attr('text-anchor', 'middle').attr('fill', 'var(--color-fg-muted)').text('variação de Lula no 2º turno, 2022 → 2026');
  });
})();
