// Simplex de duas fases (tableau denso), compatível com o formato de modelo do jsLPSolver:
// { optimize, opType: 'max'|'min', constraints: {nome: {max?, min?}}, variables: {nome: {restrição: coef, ...}} }
(function (root) {
  var EPS = 1e-9;
  function Solve(model) {
    var vars = Object.keys(model.variables), cons = Object.keys(model.constraints);
    var n = vars.length, sign = model.opType === 'min' ? -1 : 1;
    var cidx = {}; cons.forEach(function (c, i) { cidx[c] = i; });
    var A = cons.map(function () { return new Float64Array(n); });
    var c = new Float64Array(n);
    vars.forEach(function (v, j) {
      var o = model.variables[v];
      for (var k in o) { if (k === model.optimize) c[j] = sign * o[k]; if (k in cidx) A[cidx[k]][j] = o[k]; }
    });
    var rows = [];
    cons.forEach(function (name, i) {
      var cc = model.constraints[name];
      if (cc.max != null) rows.push({ a: A[i], b: cc.max, ge: false });
      if (cc.min != null) rows.push({ a: A[i], b: cc.min, ge: true });
      if (cc.equal != null) { rows.push({ a: A[i], b: cc.equal, ge: false }); rows.push({ a: A[i], b: cc.equal, ge: true }); }
    });
    rows.forEach(function (r) {
      if ((!r.ge && r.b < 0) || (r.ge && r.b <= 0)) { var a = new Float64Array(n); for (var j = 0; j < n; j++) a[j] = -r.a[j]; r.a = a; r.b = -r.b; r.ge = !r.ge; }
    });
    var m = rows.length, k = rows.filter(function (r) { return r.ge; }).length;
    var W = n + m + k + 1, RHS = W - 1, ART0 = n + m;
    var T = [], basis = new Int32Array(m), art = 0;
    rows.forEach(function (r, i) {
      var t = new Float64Array(W); t.set(r.a); t[RHS] = r.b;
      if (r.ge) { t[n + i] = -1; t[ART0 + art] = 1; basis[i] = ART0 + art; art++; }
      else { t[n + i] = 1; basis[i] = n + i; }
      T.push(t);
    });
    var z = new Float64Array(W);
    function pivot(r, s) {
      var tr = T[r], p = tr[s], j;
      for (j = 0; j < W; j++) tr[j] /= p;
      for (var i = 0; i < m; i++) {
        if (i === r) continue; var ti = T[i], f = ti[s];
        if (f !== 0) for (j = 0; j < W; j++) { if (tr[j] !== 0) ti[j] -= f * tr[j]; }
      }
      var fz = z[s]; if (fz !== 0) for (j = 0; j < W; j++) { if (tr[j] !== 0) z[j] -= fz * tr[j]; }
      basis[r] = s;
    }
    function run(limitCol) {
      for (var it = 0; it < 50000; it++) {
        var s = -1, best = -EPS;
        for (var j = 0; j < limitCol; j++) if (z[j] < best) { best = z[j]; s = j; }
        if (s < 0) return 'ok';
        var r = -1, ratio = Infinity;
        for (var i = 0; i < m; i++) {
          var a = T[i][s];
          if (a > EPS) { var q = T[i][RHS] / a; if (q < ratio - 1e-12 || (Math.abs(q - ratio) <= 1e-12 && basis[i] < basis[r])) { ratio = q; r = i; } }
        }
        if (r < 0) return 'unbounded';
        pivot(r, s);
      }
      return 'iter';
    }
    // fase 1: maximizar -soma(artificiais)
    var bsum = 0;
    for (var i = 0; i < m; i++) if (basis[i] >= ART0) { for (var j = 0; j < W; j++) z[j] -= T[i][j]; bsum += T[i][RHS]; }
    for (var a2 = ART0; a2 < ART0 + k; a2++) z[a2] = 0;
    if (k > 0) {
      if (run(W - 1) !== 'ok') return { feasible: false };
      if (z[RHS] < -1e-7 * Math.max(1, bsum)) return { feasible: false };
      for (i = 0; i < m; i++) if (basis[i] >= ART0) {
        for (j = 0; j < ART0; j++) if (Math.abs(T[i][j]) > EPS) { pivot(i, j); break; }
      }
    }
    // fase 2
    z = new Float64Array(W);
    for (j = 0; j < n; j++) z[j] = -c[j];
    for (i = 0; i < m; i++) { var cb = basis[i] < n ? c[basis[i]] : 0; if (cb !== 0) for (j = 0; j < W; j++) z[j] += cb * T[i][j]; }
    var st = run(ART0);
    if (st !== 'ok') return { feasible: false, bounded: st !== 'unbounded' };
    var res = { feasible: true, bounded: true, result: sign * z[RHS] };
    for (i = 0; i < m; i++) if (basis[i] < n && T[i][RHS] > 1e-12) res[vars[basis[i]]] = T[i][RHS];
    return res;
  }
  root.solver = { Solve: Solve };
})(typeof window !== 'undefined' ? window : globalThis);
