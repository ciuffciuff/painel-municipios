// Versão independente da API "dash" usada pelo painel (app.js), para rodar fora do Claude:
// GitHub Pages ou qualquer servidor de arquivos estáticos.
// Carrega os arquivos de dados/, calcula os dash.calc, guarda os filtros e redesenha os elementos data-draw.
(function () {
  var SOURCES = {
    municipios: 'dados/municipios.csv', perfis: 'dados/perfis.csv', grupos: 'dados/grupos.csv',
    politicas: 'dados/parametros_politicas.csv', geral: 'dados/parametros_gerais.csv',
    selecao_k: 'dados/selecao_k.csv', ref_politica: 'dados/ref_politica.csv',
    malha: 'dados/malha_municipios.json', ufs: 'dados/malha_ufs.json'
  };
  var DEFAULTS = { var: 'grupo', modo: 'equidade' };
  var store = {}, calcs = {}, calcVal = {}, draws = {}, onDataFns = [], params = Object.assign({}, DEFAULTS);

  var dash = {
    colors: (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)
      ? ['#6ea8fe', '#f4a261', '#5cc8a3', '#ef6f6c', '#b49cf2', '#d4a373', '#f28ec8', '#9aa5b1']
      : ['#2563eb', '#e8710a', '#14876f', '#c8382f', '#7c4dcc', '#8d6748', '#c2477f', '#5f6b7a'],
    data: function (id) {
      if (store[id]) return store[id];
      if (calcs[id]) {
        if (!(id in calcVal)) {
          var c = calcs[id], ins = c.inputs.map(function (i) { return dash.data(i); });
          if (ins.some(function (x) { return x.status !== 'ok'; })) return { status: 'loading', data: [] };
          try { calcVal[id] = { status: 'ok', data: c.fn.apply(null, ins.map(function (x) { return x.data; })) }; }
          catch (e) { console.error('calc', id, e); calcVal[id] = { status: 'error', data: [], message: String(e) }; }
        }
        return calcVal[id];
      }
      return { status: 'missing', data: [] };
    },
    calc: function (id, o) { calcs[id] = o; },
    loader: function () {},
    draw: function (name, fn) { draws[name] = fn; },
    onData: function (fn) { onDataFns.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params: function () { return params; },
    setParams: function (o) {
      for (var k in o) { if (o[k] == null) delete params[k]; else params[k] = o[k]; }
      schedule();
    },
    resetParams: function () { params = Object.assign({}, DEFAULTS); schedule(); },
    setLink: function (name) { try { history.replaceState(null, '', '#' + name); } catch (e) {} },
    refresh: function () {}
  };
  window.dash = dash;

  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; render(); }); }
  function render() {
    onDataFns.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    document.querySelectorAll('[data-draw]').forEach(function (el) {
      if (el.closest('[hidden]')) return;
      var fn = draws[el.getAttribute('data-draw')]; if (!fn) return;
      try { fn(el); } catch (e) { console.error('draw', el.getAttribute('data-draw'), e); }
    });
  }
  window.addEventListener('resize', (function () { var t; return function () { clearTimeout(t); t = setTimeout(schedule, 150); }; })());
  new MutationObserver(function (ms) { if (ms.some(function (m) { return m.attributeName === 'hidden'; })) schedule(); })
    .observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['hidden'] });

  // carrega todas as fontes; o painel desenha à medida que cada uma chega
  Object.keys(SOURCES).forEach(function (id) {
    store[id] = { status: 'loading', data: [] };
    fetch(SOURCES[id]).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + SOURCES[id]); return r.text(); })
      .then(function (t) {
        var data = /\.json$/.test(SOURCES[id]) ? JSON.parse(t) : d3.csvParse(t);
        store[id] = { status: 'ok', data: data, columns: data.columns };
        calcVal = {}; schedule();
      })
      .catch(function (e) { console.error(e); store[id] = { status: 'error', data: [], message: String(e) }; schedule(); });
  });
  document.addEventListener('DOMContentLoaded', schedule);
})();
