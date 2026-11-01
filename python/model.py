"""Índices de necessidade, TOPSIS, k-means e programação linear de alocação."""
import json, numpy as np, pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from scipy.optimize import linprog

OUT = 'dados/'
b = pd.read_parquet(OUT + 'base_bruta.parquet')
b = b[b.pop_censo2022.notna()].copy()          # 5.570 municípios do Censo 2022
b['cod'] = b.cod.astype(int)

# indicador -> (dimensão, sentido: +1 maior é melhor, -1 maior é pior)
IND = {
    'cob_esf': ('saude', 1), 'ubs_por_10k': ('saude', 1), 'distancia_hospital_proxy_km': ('saude', -1),
    'alfab': ('educacao', 1), 'ideb_ai': ('educacao', 1),
    'agua_rede': ('saneamento', 1), 'esgoto_adeq': ('saneamento', 1), 'lixo_coleta': ('saneamento', 1),
    'renda_pc': ('renda', 1), 'emprego_1000': ('renda', 1), 'bf_cob': ('renda', -1),
}
DIMS = ['saude', 'educacao', 'saneamento', 'renda']

# imputação do IDEB ausente pela mediana da UF (marcada)
b['ideb_imputado'] = b.ideb_ai.isna().astype(int)
b['ideb_ai'] = b.ideb_ai.fillna(b.groupby('uf').ideb_ai.transform('median')).fillna(b.groupby('regiao').ideb_ai.transform('median'))
assert b[list(IND)].isna().sum().sum() == 0, b[list(IND)].isna().sum()

# necessidade por indicador: posição percentual (0 = melhor do país, 100 = pior)
for k, (d, s) in IND.items():
    b['n_' + k] = (-s * b[k]).rank(pct=True) * 100
for d in DIMS:
    b['nec_' + d] = b[['n_' + k for k, (dd, _) in IND.items() if dd == d]].mean(axis=1)

# TOPSIS (pesos iguais por dimensão, divididos entre os indicadores da dimensão)
X = b[['n_' + k for k in IND]].values / 100            # 0 melhor ... 1 pior
w = np.array([1 / 4 / sum(1 for v in IND.values() if v[0] == IND[k][0]) for k in IND])
V = X * w
ideal, anti = V.min(axis=0), V.max(axis=0)               # ideal = menor necessidade
dp = np.sqrt(((V - ideal) ** 2).sum(1)); dm = np.sqrt(((V - anti) ** 2).sum(1))
b['topsis'] = 100 * dp / (dp + dm)                        # 100 = mais prioritário
b['rank_topsis'] = b.topsis.rank(ascending=False, method='min').astype(int)

# k-means sobre as necessidades padronizadas dos 11 indicadores
Z = (X - X.mean(0)) / X.std(0)
sel = []
for k in range(3, 10):
    km = KMeans(k, n_init=20, random_state=42).fit(Z)
    sel.append({'k': k, 'silhueta': round(float(silhouette_score(Z, km.labels_, sample_size=4000, random_state=1)), 4),
                'inercia': round(float(km.inertia_), 1), 'menor_grupo': int(np.bincount(km.labels_).min())})
sel = pd.DataFrame(sel); print(sel)
K = int(json.load(open('k.json'))['k']) if __import__('os').path.exists('k.json') else 6
km = KMeans(K, n_init=50, random_state=42).fit(Z)
b['cluster_raw'] = km.labels_
# ordena grupos do menos para o mais necessitado (TOPSIS médio)
order = b.groupby('cluster_raw').topsis.mean().sort_values().index
mp = {c: i + 1 for i, c in enumerate(order)}
b['grupo'] = b.cluster_raw.map(mp)
sel['escolhido'] = (sel.k == K).astype(int)

prof = b.groupby('grupo').agg(municipios=('cod', 'size'), populacao=('pop2025', 'sum'),
                              **{f'nec_{d}': (f'nec_{d}', 'mean') for d in DIMS}, topsis=('topsis', 'mean'),
                              **{k: (k, 'median') for k in IND}).reset_index()
reg = pd.crosstab(b.grupo, b.regiao, normalize='index') * 100
prof = prof.join(reg.round(1), on='grupo')
pd.set_option('display.width', 250); pd.set_option('display.max_columns', 40)
print(prof.round(1))
prof.to_csv(OUT + 'perfil_raw.csv', index=False)
b.to_parquet(OUT + 'base_modelo.parquet')
sel.to_csv(OUT + 'selecao_k.csv', index=False)
