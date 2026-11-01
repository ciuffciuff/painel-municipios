// Modelo de programação linear da alocação de orçamento (mesma formulação de lp.py).
// Unidades internas: dinheiro em R$ milhões; redução de déficit em milhares de pessoas-equivalentes.
(function (root) {
  var SEG = [1.0, 0.7, 0.4];

  function build(grupos, politicas, geral, modo, tFix) {
    var B = geral.orcamento_bi * 1e3;
    var model = { optimize: 'obj', opType: 'max', constraints: {}, variables: {} };
    var C = model.constraints;
    C.orc = { max: B };
    var totgap = 0, share = {};
    grupos.forEach(function (g) {
      politicas.forEach(function (p) { totgap += g['gap_' + p.politica]; });
    });
    grupos.forEach(function (g) {
      var s = 0;
      politicas.forEach(function (p) { s += g['gap_' + p.politica]; });
      share[g.regiao] = (share[g.regiao] || 0) + s;
    });
    politicas.forEach(function (p) { C['piso_' + p.politica] = { min: p.piso_pct / 100 * B }; });
    Object.keys(share).forEach(function (r) {
      C['reg_' + r] = { min: geral.piso_regional_pct / 100 * B * share[r] / totgap };
    });
    grupos.forEach(function (g) {
      C['teto_' + g.gid] = { max: geral.teto_per_capita * g.pop / 1e6 };
      politicas.forEach(function (p) {
        var gap = g['gap_' + p.politica] / 1e3;
        var val = p.peso * Math.pow(g['nec_' + p.politica] / 50, geral.equidade);
        if (modo === 'equidade') C['eq_' + g.gid + '_' + p.politica] = { min: 0 };
        SEG.forEach(function (e, si) {
          var name = 'y|' + g.gid + '|' + p.politica + '|' + si;
          var cost = p.custo_unitario / e / 1e3;
          var v = { orc: cost };
          v['piso_' + p.politica] = cost;
          v['reg_' + g.regiao] = cost;
          v['teto_' + g.gid] = cost;
          v['ub_' + name] = 1;
          C['ub_' + name] = { max: gap / SEG.length };
          if (modo === 'equidade') v['eq_' + g.gid + '_' + p.politica] = 1 / gap;
          v.obj = (modo === 'equidade' && tFix == null) ? 0 : val;
          model.variables[name] = v;
        });
      });
    });
    if (modo === 'equidade') {
      // eq_{g,p}: sum(y)/gap - t >= 0
      var t = { obj: tFix == null ? 1 : 0 };
      grupos.forEach(function (g) {
        politicas.forEach(function (p) { t['eq_' + g.gid + '_' + p.politica] = -1; });
      });
      if (tFix != null) { t.tfix = 1; C.tfix = { min: tFix }; }
      model.variables.t = t;
    }
    return model;
  }

  function collect(res, grupos, politicas) {
    var out = [];
    grupos.forEach(function (g) {
      politicas.forEach(function (p) {
        var y = 0, gasto = 0;
        SEG.forEach(function (e, si) {
          var v = res['y|' + g.gid + '|' + p.politica + '|' + si] || 0;
          y += v; gasto += v * p.custo_unitario / e / 1e3;
        });
        out.push({ gid: g.gid, regiao: g.regiao, grupo: g.grupo, politica: p.politica,
                   gasto: gasto * 1e6, reducao: y * 1e3, reducao_pct: 100 * y * 1e3 / g['gap_' + p.politica] });
      });
    });
    return out;
  }

  function objetivo(rows, grupos, politicas, geral) {
    var gi = {}; grupos.forEach(function (g) { gi[g.gid] = g; });
    var pi = {}; politicas.forEach(function (p) { pi[p.politica] = p; });
    return rows.reduce(function (s, r) {
      var g = gi[r.gid], p = pi[r.politica];
      return s + p.peso * Math.pow(g['nec_' + p.politica] / 50, geral.equidade) * r.reducao / 1e3;
    }, 0);
  }

  function solve(solver, grupos, politicas, geral, modo) {
    var t = null, res;
    if (modo === 'equidade') {
      var r1 = solver.Solve(build(grupos, politicas, geral, 'equidade', null));
      if (!r1.feasible) return { feasible: false };
      t = r1.t || 0;
      res = solver.Solve(build(grupos, politicas, geral, 'equidade', t * 0.999));
    } else {
      res = solver.Solve(build(grupos, politicas, geral, 'eficiencia', null));
    }
    if (!res.feasible) return { feasible: false };
    var rows = collect(res, grupos, politicas);
    return { feasible: true, rows: rows, t: t, obj: objetivo(rows, grupos, politicas, geral) };
  }

  root.LPModel = { solve: solve, objetivo: objetivo, SEG: SEG };
})(typeof window !== 'undefined' ? window : globalThis);
