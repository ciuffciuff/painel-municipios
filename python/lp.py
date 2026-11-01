"""Programação linear de alocação de orçamento (versão de referência com HiGHS).
Grupo de otimização = Região x Perfil (k-means). Política = saúde, educação, saneamento, renda."""
import numpy as np, pandas as pd
from scipy.optimize import linprog

OUT = 'dados/'
b = pd.read_parquet(OUT + 'base_modelo.parquet')
DIMS = ['saude', 'educacao', 'saneamento', 'renda']

PAR = pd.DataFrame({
    'politica': DIMS,
    'rotulo': ['Saúde', 'Educação', 'Saneamento', 'Renda, emprego e assistência'],
    'custo_unitario': [300, 250, 900, 500],     # R$ por "pessoa-equivalente" de déficit reduzida (hipótese editável)
    'peso': [1, 1, 1, 1],
    'piso_pct': [10, 10, 10, 10],               # % mínimo do orçamento por política
})
GERAL = {'orcamento_bi': 20, 'piso_regional_pct': 50, 'teto_per_capita': 250, 'equidade': 1.0}
SEG = [1.0, 0.7, 0.4]                           # eficiência de cada terço do déficit (retornos decrescentes)

b['gid'] = b.regiao.str.replace('-', '') + '_' + b.grupo.astype(str)
for d in DIMS:
    b['gap_' + d] = b.pop2025 * b['nec_' + d] / 100
g = b.groupby(['gid', 'regiao', 'grupo']).agg(pop=('pop2025', 'sum'), municipios=('cod', 'size'),
                                              **{f'gap_{d}': (f'gap_{d}', 'sum') for d in DIMS}).reset_index()
for d in DIMS:
    g['nec_' + d] = 100 * g['gap_' + d] / g['pop']   # necessidade média ponderada pela população


def solve(g, par, geral, modo='eficiencia'):
    G = len(g); P = len(par); S = len(SEG)
    B = geral['orcamento_bi'] * 1e3          # R$ milhões; y em milhares de pessoas-equivalentes
    nv = G * P * S + (1 if modo == 'equidade' else 0)
    idx = lambda gi, pi, si: (gi * P + pi) * S + si
    c = np.zeros(nv); ub = np.zeros(nv); cost = np.zeros(nv)
    for gi in range(G):
        for pi, p in par.iterrows():
            gap = g.loc[gi, 'gap_' + p.politica]
            val = p.peso * (g.loc[gi, 'nec_' + p.politica] / 50) ** geral['equidade']
            for si, e in enumerate(SEG):
                j = idx(gi, pi, si); ub[j] = gap / S / 1e3; cost[j] = p.custo_unitario / e / 1e3
                c[j] = -val if modo == 'eficiencia' else 0
    if modo == 'equidade':
        c[-1] = -1; ub[-1] = None
    A, rhs = [], []
    A.append(np.r_[cost[:G * P * S], [0] * (nv - G * P * S)]); rhs.append(B)                     # orçamento
    for pi, p in par.iterrows():                                                                 # piso por política
        row = np.zeros(nv)
        for gi in range(G):
            for si in range(S): row[idx(gi, pi, si)] = -cost[idx(gi, pi, si)]
        A.append(row); rhs.append(-p.piso_pct / 100 * B)
    totgap = sum(g['gap_' + d].sum() for d in par.politica)
    for r in g.regiao.unique():                                                                  # piso regional
        row = np.zeros(nv); share = 0
        for gi in g.index[g.regiao == r]:
            share += sum(g.loc[gi, 'gap_' + d] for d in par.politica)
            for pi in range(P):
                for si in range(S): row[idx(gi, pi, si)] = -cost[idx(gi, pi, si)]
        A.append(row); rhs.append(-geral['piso_regional_pct'] / 100 * B * share / totgap)
    for gi in range(G):                                                                          # teto de absorção
        row = np.zeros(nv)
        for pi in range(P):
            for si in range(S): row[idx(gi, pi, si)] = cost[idx(gi, pi, si)]
        A.append(row); rhs.append(geral['teto_per_capita'] * g.loc[gi, 'pop'] / 1e6)
    if modo == 'equidade':                                                                       # t <= fração fechada de cada (grupo, política)
        for gi in range(G):
            for pi, p in par.iterrows():
                gap = g.loc[gi, 'gap_' + p.politica] / 1e3
                row = np.zeros(nv); row[-1] = 1
                for si in range(S): row[idx(gi, pi, si)] = -1 / gap
                A.append(row); rhs.append(0)
    bounds = [(0, u if u == u else None) for u in ub]
    res = linprog(c, A_ub=np.array(A), b_ub=np.array(rhs), bounds=bounds, method='highs')
    assert res.status == 0, res.message
    tstar = None
    if modo == 'equidade':   # 2º estágio (lexicográfico): mantém o mínimo garantido e usa a sobra com eficiência
        tstar = res.x[-1]
        c2 = np.zeros(nv)
        for gi in range(G):
            for pi, p in par.iterrows():
                val = p.peso * (g.loc[gi, 'nec_' + p.politica] / 50) ** geral['equidade']
                for si in range(S): c2[idx(gi, pi, si)] = -val
        bounds[-1] = (tstar * 0.999, None)
        res = linprog(c2, A_ub=np.array(A), b_ub=np.array(rhs), bounds=bounds, method='highs')
        assert res.status == 0, res.message
    x = res.x
    out = []
    for gi in range(G):
        for pi, p in par.iterrows():
            y = 1e3 * sum(x[idx(gi, pi, si)] for si in range(S))
            gasto = 1e6 * sum(x[idx(gi, pi, si)] * cost[idx(gi, pi, si)] for si in range(S))
            out.append({'gid': g.loc[gi, 'gid'], 'politica': p.politica, 'gasto': gasto, 'reducao': y,
                        'reducao_pct': 100 * y / g.loc[gi, 'gap_' + p.politica]})
    dual_orc = -res.ineqlin.marginals[0]   # ganho no objetivo por R$ 1 milhão adicional
    return pd.DataFrame(out), (tstar if tstar is not None else -res.fun), dual_orc


par, geral = PAR, GERAL
ef, obj_ef, dual_ef = solve(g, par, geral, 'eficiencia')
eq, obj_eq, dual_eq = solve(g, par, geral, 'equidade')
print('eficiência obj', round(obj_ef), 'preço-sombra por R$1mi', round(dual_ef, 2), 'gasto', round(ef.gasto.sum() / 1e9, 3))
print('equidade t', round(obj_eq, 4), 'gasto', round(eq.gasto.sum() / 1e9, 3))
print(ef.pivot(index='gid', columns='politica', values='gasto').div(1e6).round(0))
print(eq.pivot(index='gid', columns='politica', values='gasto').div(1e6).round(0))
ef['modelo'] = 'eficiencia'; eq['modelo'] = 'equidade'
pd.concat([ef, eq]).to_csv(OUT + 'alocacao_referencia.csv', index=False)
g.to_csv(OUT + 'grupos.csv', index=False)
par.to_csv(OUT + 'parametros_politicas.csv', index=False)
pd.DataFrame([GERAL]).to_csv(OUT + 'parametros_gerais.csv', index=False)
b.to_parquet(OUT + 'base_modelo.parquet')
# total por política, usado no painel para conferir o simulador em JavaScript
ref = pd.concat([ef, eq]).groupby(['modelo', 'politica']).gasto.sum().div(1e9).round(3).reset_index().rename(columns={'gasto': 'gasto_bi'})
ref.to_csv(OUT + 'ref_politica.csv', index=False)
