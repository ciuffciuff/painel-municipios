"""Monta docs/index.html (versão independente do painel) a partir de web/index.html.
Uso, na raiz do repositório: python docs/montar.py"""
import re, shutil, os
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
web, docs = os.path.join(raiz, 'web'), os.path.join(raiz, 'docs')
corpo = open(os.path.join(web, 'index.html'), encoding='utf-8').read()
corpo = corpo.replace('<meta name="dash-one-writer">\n', '')
corpo = re.sub(r'<script src="[^"]+"></script>\n?', '', corpo)
TEMA = """<style>
:root {
  --font-anthropic-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-anthropic-serif: Georgia, "Times New Roman", serif;
  --color-fg: #1f2328; --color-fg-muted: #5f6b7a; --color-bg: #ffffff; --color-panel: #f7f8fa;
  --color-border-line: #dde1e6; --color-ok: #14876f; --color-warn: #b7791f; --color-bad: #c8382f;
  --cds-font-size-caption: 0.8rem; --cds-font-size-body: 0.95rem; --cds-font-size-heading: 1.1rem; --cds-font-size-title: 1.75rem;
  --cds-font-weight-medium: 600;
  --cds-gap-xs: 4px; --cds-gap-sm: 8px; --cds-gap-md: 16px; --cds-gap-lg: 24px; --cds-gap-xl: 32px;
  --cds-pad-xs: 4px; --cds-pad-sm: 8px; --cds-pad-md: 12px; --cds-pad-lg: 18px; --cds-pad-xl: 28px;
  --cds-radius: 8px; --cds-dur-slow: 300ms;
  --cds-chart-muted: #d5dae0; --cds-chart-grid: #e6e9ed; --cds-chart-axis: #9aa5b1; --cds-chart-reference: #7b8794;
  --cds-surface-popover: #ffffff; --cds-border: #dde1e6; --cds-shadow-popover: 0 4px 16px rgba(0,0,0,.12); --cds-text-secondary: #5f6b7a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-fg: #e6e8eb; --color-fg-muted: #a0a9b4; --color-bg: #15181c; --color-panel: #1d2126;
    --color-border-line: #333a42; --color-ok: #5cc8a3; --color-warn: #e0b45a; --color-bad: #ef6f6c;
    --cds-chart-muted: #3a424b; --cds-chart-grid: #2b3138; --cds-chart-axis: #6b7682; --cds-chart-reference: #8a95a1;
    --cds-surface-popover: #22272d; --cds-border: #3a424b; --cds-shadow-popover: 0 4px 16px rgba(0,0,0,.5); --cds-text-secondary: #a0a9b4;
  }
}
html, body { margin: 0; background: var(--color-bg); color: var(--color-fg); }
#dash-root { padding: var(--dash-gutter, 24px); }
.pm .rodape { margin-top: var(--cds-gap-lg); padding-top: var(--cds-gap-md); border-top: 1px solid var(--color-border-line); }
.pm .rodape a { color: inherit; }
.pm svg text[fill^="var("] { fill: currentColor; }
</style>
"""
RODAPE = """  <p class="muted rodape">Código, dados e método: <a href="https://github.com/ciuffciuff/painel-municipios">github.com/ciuffciuff/painel-municipios</a> · Código sob licença MIT; textos e dados derivados sob CC BY 4.0 · César Ciuffo, 2026.</p>
</div>"""
i = corpo.rfind('</div>')
corpo = corpo[:i] + RODAPE + corpo[i + len('</div>'):]
html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Painel de Municípios</title>
<meta name="description" content="Necessidades dos 5.570 municípios brasileiros, perfis por k-means, prioridade por TOPSIS e alocação de orçamento por programação linear.">
{TEMA}</head>
<body>
<div id="dash-root">
{corpo}</div>
<script src="d3.min.js"></script>
<script src="dash-shim.js"></script>
<script src="simplex.js"></script>
<script src="lpmodel.js"></script>
<script src="app.js"></script>
<script src="eleicoes.js"></script>
</body>
</html>
"""
open(os.path.join(docs, 'index.html'), 'w', encoding='utf-8').write(html)
for f in ['app.js', 'eleicoes.js', 'lpmodel.js', 'simplex.js']:
    shutil.copy(os.path.join(web, f), docs)
os.makedirs(os.path.join(docs, 'dados'), exist_ok=True)
for f in ['municipios.csv', 'perfis.csv', 'grupos.csv', 'parametros_politicas.csv', 'parametros_gerais.csv',
          'selecao_k.csv', 'ref_politica.csv', 'malha_municipios.json', 'malha_ufs.json']:
    shutil.copy(os.path.join(raiz, 'dados', f), os.path.join(docs, 'dados'))
print('docs/index.html montado')
