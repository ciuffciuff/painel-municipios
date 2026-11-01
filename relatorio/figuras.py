"""Figuras do relatório do Painel de Municípios."""
import json, numpy as np, pandas as pd, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MPoly
from matplotlib.collections import PolyCollection
import re

D = '/home/claude/painel-municipios/dados/'
O = '/home/claude/rel/fig/'
import os; os.makedirs(O, exist_ok=True)
m = pd.read_csv(D + 'municipios.csv'); pf = pd.read_csv(D + 'perfis.csv')
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False,
                     'axes.titleweight': 'bold', 'axes.titlesize': 11, 'axes.titlelocation': 'left'})
COR = ['#2563eb', '#e8710a', '#14876f', '#c8382f', '#7c4dcc', '#8d6748']
CINZA = '#9aa5b1'
NOMES = {r.grupo: r.nome for r in pf.itertuples()}

# ---------- mapas ----------
malha = json.load(open(D + 'malha_municipios.json')); ufs = json.load(open(D + 'malha_ufs.json'))
def polys(d):
    out = []
    for part in re.findall(r'M([^Z]+)Z', d):
        pts = [tuple(map(float, p.split(','))) for p in part.split('L')]
        out.append(pts)
    return out
geo = [(r['cod'], polys(r['d'])) for r in malha]
ufp = [p for r in ufs for p in polys(r['d'])]
byc = m.set_index('cod')

def mapa(cores, titulo, arq, legenda=None, cbar=None):
    fig, ax = plt.subplots(figsize=(7.2, 7.0))
    P, C = [], []
    for cod, ps in geo:
        c = cores.get(cod, '#dddddd')
        for p in ps: P.append(p); C.append(c)
    ax.add_collection(PolyCollection(P, facecolors=C, edgecolors='none'))
    ax.add_collection(PolyCollection(ufp, facecolors='none', edgecolors='white', linewidths=0.6))
    ax.set_xlim(0, 1000); ax.set_ylim(971, 0); ax.set_aspect('equal'); ax.axis('off')
    ax.set_title(titulo, loc='left')
    if legenda:
        from matplotlib.patches import Patch
        ax.legend(handles=[Patch(color=c, label=l) for l, c in legenda], loc='upper left', bbox_to_anchor=(0, 0.02), frameon=False, fontsize=8, ncol=1)
    if cbar: cbar(fig, ax)
    fig.savefig(O + arq, dpi=170, bbox_inches='tight'); plt.close(fig)

mapa({c: COR[g - 1] for c, g in byc.grupo.items()}, 'Perfis de necessidade dos municípios (k-means, k = 6)', 'f1_mapa_perfis.png',
     legenda=[(f'{g}. {NOMES[g]}', COR[g - 1]) for g in range(1, 7)])

import matplotlib.colors as mc
cmap = mc.LinearSegmentedColormap.from_list('n', ['#f3f4f6', '#c8382f'])
norm = mc.Normalize(0, 100)
def cb(fig, ax, lab='Índice TOPSIS (0 = menor prioridade, 100 = maior)'):
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm); c = fig.colorbar(sm, ax=ax, orientation='horizontal', fraction=0.035, pad=0.01); c.set_label(lab, fontsize=8)
mapa({c: mc.to_hex(cmap(norm(v))) for c, v in byc.topsis.items()}, 'Índice de prioridade (TOPSIS) por município', 'f2_mapa_topsis.png', cbar=cb)

div = mc.LinearSegmentedColormap.from_list('d', ['#e8710a', '#f3f4f6', '#2563eb'])
nd = mc.Normalize(20, 80)
def cb2(fig, ax):
    sm = plt.cm.ScalarMappable(cmap=div, norm=nd); c = fig.colorbar(sm, ax=ax, orientation='horizontal', fraction=0.035, pad=0.01)
    c.set_label('% de Lula nos votos válidos (laranja: maioria de Flávio Bolsonaro; azul: maioria de Lula)', fontsize=8)
mapa({c: mc.to_hex(div(nd(v))) for c, v in byc.lula_26_2t.items()}, 'Voto em Lula no 2º turno de 2026, por município', 'f3_mapa_voto26.png', cbar=cb2)

# ---------- necessidade por região ----------
dims = ['saude', 'educacao', 'saneamento', 'renda']; dl = ['Saúde', 'Educação', 'Saneamento', 'Renda']
reg = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']
v = {r: [np.average(m[m.regiao == r]['nec_' + d], weights=m[m.regiao == r].pop2025) for d in dims] for r in reg}
fig, ax = plt.subplots(figsize=(7.2, 3.6)); w = 0.18; x = np.arange(len(reg))
tons = ['#1e3a8a', '#2563eb', '#60a5fa', '#bfdbfe']
for i, d in enumerate(dl):
    b = ax.bar(x + (i - 1.5) * w, [v[r][i] for r in reg], w, label=d, color=tons[i])
    ax.bar_label(b, fmt='%.0f', fontsize=7, padding=1)
ax.set_xticks(x, reg); ax.set_ylim(0, 80); ax.axhline(50, color=CINZA, ls='--', lw=0.8); ax.set_ylabel('Necessidade média (0–100)')
ax.legend(ncol=4, frameon=False, fontsize=8, loc='lower left', bbox_to_anchor=(0, 1.0)); ax.set_title('Norte e Nordeste concentram as necessidades sociais', pad=22)
fig.savefig(O + 'f4_regioes.png', dpi=170, bbox_inches='tight'); plt.close(fig)

# ---------- perfis: necessidade por dimensão ----------
fig, ax = plt.subplots(figsize=(7.2, 3.6)); x = np.arange(6)
for i, d in enumerate(dims):
    b = ax.bar(x + (i - 1.5) * w, pf['nec_' + d], w, label=dl[i], color=tons[i])
ax.set_xticks(x, [f'Perfil {g}' for g in pf.grupo]); ax.set_ylim(0, 90); ax.axhline(50, color=CINZA, ls='--', lw=0.8)
ax.set_ylabel('Necessidade média (0–100)'); ax.legend(ncol=4, frameon=False, fontsize=8, loc='lower left', bbox_to_anchor=(0, 1.0))
ax.set_title('Necessidade sobe do perfil 1 ao 6, exceto em saúde', pad=22)
fig.savefig(O + 'f5_perfis.png', dpi=170, bbox_inches='tight'); plt.close(fig)

# ---------- silhueta ----------
k = pd.read_csv(D + 'selecao_k.csv')
fig, ax = plt.subplots(figsize=(7.2, 2.8))
ax.plot(k.k, k.silhueta, marker='o', color=CINZA)
ax.plot([6], k[k.k == 6].silhueta, marker='o', color=COR[0], ms=9)
for r in k.itertuples(): ax.annotate(f'{r.silhueta:.2f}'.replace('.', ','), (r.k, r.silhueta), textcoords='offset points', xytext=(0, 7), ha='center', fontsize=8)
ax.set_xlabel('Número de perfis (k)'); ax.set_ylabel('Silhueta média'); ax.set_ylim(0, 0.32)
ax.set_title('Silhueta baixa para todo k: as necessidades são contínuas')
fig.savefig(O + 'f6_silhueta.png', dpi=170, bbox_inches='tight'); plt.close(fig)

# ---------- alocação ----------
a = pd.read_csv(D + 'ref_politica.csv')
pol = ['saude', 'educacao', 'saneamento', 'renda']
fig, ax = plt.subplots(figsize=(7.2, 3.2)); x = np.arange(4); w = 0.36
for j, (mod, lab, c) in enumerate([('eficiencia', 'Eficiência', CINZA), ('equidade', 'Equidade', COR[0])]):
    vals = [a[(a.modelo == mod) & (a.politica == p)].gasto_bi.iloc[0] for p in pol]
    b = ax.bar(x + (j - 0.5) * w, vals, w, label=lab, color=c); ax.bar_label(b, labels=[f'{t:.1f}'.replace('.', ',') for t in vals], fontsize=8, padding=1)
ax.set_xticks(x, ['Saúde', 'Educação', 'Saneamento', 'Renda, emprego\ne assistência']); ax.set_ylabel('R$ bilhões'); ax.set_ylim(0, 11.5)
ax.legend(frameon=False); ax.set_title('Equidade desloca recursos para saneamento e renda')
fig.savefig(O + 'f7_alocacao.png', dpi=170, bbox_inches='tight'); plt.close(fig)

# ---------- dispersão ----------
fig, ax = plt.subplots(figsize=(7.2, 4.4))
for g in range(1, 7):
    s = m[m.grupo == g]; ax.scatter(s.topsis, s.lula_26_2t, s=np.clip(np.sqrt(s.pop2025) / 12, 2, 60), color=COR[g - 1], alpha=0.45, lw=0, label=f'Perfil {g}')
ax.axhline(50, color=CINZA, ls='--', lw=0.8); ax.set_xlim(0, 100); ax.set_ylim(0, 100)
ax.set_xlabel('Índice de prioridade (TOPSIS)'); ax.set_ylabel('% de Lula, 2º turno de 2026')
r = np.corrcoef(m.topsis, m.lula_26_2t)[0, 1]
ax.set_title(f'Quanto maior a prioridade, maior o voto em Lula (r = {r:.2f})'.replace('.', ','))
ax.legend(frameon=False, fontsize=8, markerscale=1.5, ncol=3, loc='lower right')
fig.savefig(O + 'f8_dispersao.png', dpi=170, bbox_inches='tight'); plt.close(fig)

# ---------- correlações ----------
V = [('nec_renda', 'Necessidade em renda'), ('bf_cob', 'Domicílios no Bolsa Família'), ('nec_educacao', 'Necessidade em educação'), ('topsis', 'Índice TOPSIS'),
     ('nec_saneamento', 'Necessidade em saneamento'), ('cob_esf', 'Cobertura Saúde da Família'), ('esgoto_adeq', 'Esgoto adequado'), ('ideb_ai', 'IDEB anos iniciais'),
     ('nec_saude', 'Necessidade em saúde'), ('emprego_1000', 'Emprego formal/mil hab.'), ('renda_pc', 'Renda per capita'), ('alfab', 'Alfabetização 15+')]
rr = [(lab, np.corrcoef(m[c], m.lula_26_2t)[0, 1]) for c, lab in V]; rr.sort(key=lambda t: t[1])
fig, ax = plt.subplots(figsize=(7.2, 4.0))
ax.barh([t[0] for t in rr], [t[1] for t in rr], color=[COR[0] if t[1] > 0 else COR[1] for t in rr])
for i, t in enumerate(rr): ax.text(t[1] + (0.02 if t[1] > 0 else -0.02), i, f'{t[1]:.2f}'.replace('.', ','), va='center', ha='left' if t[1] > 0 else 'right', fontsize=8)
ax.axvline(0, color='#555', lw=0.8); ax.set_xlim(-1, 1); ax.set_xlabel('Correlação de Pearson com o % de Lula (2º turno de 2026)')
ax.set_title('Renda e escolaridade são as variáveis mais associadas ao voto')
fig.savefig(O + 'f9_correlacoes.png', dpi=170, bbox_inches='tight'); plt.close(fig)

# ---------- variação por perfil ----------
def wm(x, w): return (x * w).sum() / w.sum()
var = [wm(s.lula_26_2t, s.votos_26_2t) - wm(s.lula_22_2t, s.votos_22_2t) for g, s in m.groupby('grupo')]
fig, ax = plt.subplots(figsize=(7.2, 2.8))
b = ax.barh([f'Perfil {g}' for g in range(1, 7)][::-1], var[::-1], color=[COR[g - 1] for g in range(6, 0, -1)])
for i, t in enumerate(var[::-1]): ax.text(t + (0.08 if t > 0 else -0.08), i, (f'{t:+.1f}'.replace('-', '−').replace('.', ',')) + ' p.p.', va='center', ha='left' if t > 0 else 'right', fontsize=8)
ax.axvline(0, color='#555', lw=0.8); ax.set_xlim(-4.5, 3); ax.set_xlabel('Variação de Lula no 2º turno, 2022 → 2026 (p.p.)')
ax.set_title('Lula cresceu nos grandes centros e caiu no interior')
fig.savefig(O + 'f10_variacao.png', dpi=170, bbox_inches='tight'); plt.close(fig)
print(sorted(os.listdir(O)))
