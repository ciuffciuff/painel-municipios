"""Monta a base municipal do Painel de Municípios a partir de repositórios públicos
que redistribuem dados oficiais (IBGE, INEP, MS/CNES, MTE/RAIS, CGU, TSE)."""
import os, glob, numpy as np, pandas as pd

R = os.environ.get('FONTES', 'fontes') + '/'
OUT = 'dados/'
import os; os.makedirs(OUT, exist_ok=True)

def num(s):
    return pd.to_numeric(s.astype(str).str.strip().replace({'-': '0', '': np.nan, 'nan': np.nan}), errors='coerce')

# ---- base: municípios (Censo 2022) ----
dim = pd.read_parquet(R + 'tcc-fea-usp-gasto-publico-educacao-saeb-ideb/data/processed/dim_municipio.parquet')
dim['cod'] = dim.CO_MUNICIPIO.astype(int)
base = dim[['cod', 'NO_MUNICIPIO', 'SG_UF', 'NM_REGIAO', 'POPULACAO_TOTAL_CENSO', 'TAXA_ALFABETIZACAO_15MAIS']].rename(
    columns={'NO_MUNICIPIO': 'nome', 'SG_UF': 'uf', 'NM_REGIAO': 'regiao', 'POPULACAO_TOTAL_CENSO': 'pop_censo2022',
             'TAXA_ALFABETIZACAO_15MAIS': 'alfab'})
base['alfab'] = base.alfab * 100

# população estimada 2025 + oferta de saúde (CNES)
sb = pd.read_csv(R + 'saude-brasil-insights/data/processed/municipios.csv')
sb = sb.rename(columns={'ibge7': 'cod', 'populacao': 'pop2025'})[['cod', 'pop2025', 'ubs', 'hospitais', 'ubs_por_10k', 'distancia_hospital_proxy_km']]
base = base.merge(sb, on='cod', how='left')

# equipes de Saúde da Família (CNES, out/2026)
eq = pd.concat([pd.read_csv(f, dtype=str, sep=';') for f in sorted(glob.glob(R + 'aps-cnes-ine/dados/atual/*_equipes.csv.gz'))])
eq = eq[(eq.tipo == 'eSF') & (eq.situacao != 'Desativada')]
esf = eq.groupby('ibge').ine.nunique().rename('esf').reset_index()
esf['cod6'] = esf.ibge.astype(int)
base['cod6'] = base.cod // 10
base = base.merge(esf[['cod6', 'esf']], on='cod6', how='left')
base['esf'] = base.esf.fillna(0)
base['cob_esf'] = np.minimum(100, base.esf * 3450 / base.pop2025 * 100)

# IDEB 2025 anos iniciais (rede pública)
pm = pd.read_parquet(R + 'tcc-fea-usp-gasto-publico-educacao-saeb-ideb/data/processed/painel_municipal.parquet')
ide = pm[(pm.ANO == 2025)].pivot_table(index='CO_MUNICIPIO', columns='ETAPA', values='IDEB').reset_index()
ide['cod'] = ide.CO_MUNICIPIO.astype(int)
ide = ide.rename(columns={'AI': 'ideb_ai', 'AF': 'ideb_af'})[['cod', 'ideb_ai', 'ideb_af']]
base = base.merge(ide, on='cod', how='left')

# saneamento (Censo 2022, domicílios)
S = R + 'Saneamento-censo-2022-Analise_de_Dados/'
ag = pd.read_csv(S + 't_Agua_Municipio.csv', dtype=str, encoding='utf-8-sig')
es = pd.read_csv(S + 't_Esgoto_Municipio.csv', dtype=str, encoding='utf-8-sig')
lx = pd.read_csv(S + 't_Lixo_Municipio.csv', dtype=str, encoding='utf-8-sig')
san = pd.DataFrame({'cod': num(ag.cod).astype(int),
                    'agua_rede': 100 * num(ag.rede_geral_principal_agua) / num(ag.total_agua)})
e = pd.DataFrame({'cod': num(es.cod).astype(int),
                  'esgoto_adeq': 100 * (num(es.rede_geral_ou_pluvial_esgoto) + num(es.fossa_septica_ou_fossa_filtro_nao_ligada_a_rede_esgoto)) / num(es.total_esgoto)})
l = pd.DataFrame({'cod': num(lx.cod).astype(int), 'lixo_coleta': 100 * num(lx.coletado_lixo) / num(lx.total_lixo)})
base = base.merge(san, on='cod', how='left').merge(e, on='cod', how='left').merge(l, on='cod', how='left')

# renda (Censo 2022) e Bolsa Família (ago/2026)
bf = pd.read_parquet(R + 'analise-bolsa-familia/dados/municipio_final.parquet')
bf['cod'] = pd.to_numeric(bf.cod_ibge, errors='coerce')
bf = bf.dropna(subset=['cod']); bf['cod'] = bf.cod.astype(int)
base = base.merge(bf[['cod', 'renda_media', 'familias', 'domicilios', 'cobertura_pct']].rename(
    columns={'renda_media': 'renda_pc', 'familias': 'bf_familias', 'cobertura_pct': 'bf_cob'}), on='cod', how='left')

# PIB per capita 2023
pib = pd.read_csv(R + 'projeto-bi-pib-municipios/dados/csv/pib_municipios_tratado.csv', encoding='utf-8-sig', sep=';', decimal=',')
pib = pib[pib.ano == pib.ano.max()][['cod_municipio', 'pib_per_capita']].rename(columns={'cod_municipio': 'cod', 'pib_per_capita': 'pib_pc'})
print('PIB ano', pd.read_csv(R + 'projeto-bi-pib-municipios/dados/csv/pib_municipios_tratado.csv', encoding='utf-8-sig', sep=';', decimal=',').ano.max())
base = base.merge(pib, on='cod', how='left')

# emprego formal (RAIS 2024)
rais = pd.read_csv(OUT + 'rais2024_mun.csv').rename(columns={'ibge': 'cod'})
base = base.merge(rais[['cod', 'vinc', 'vinc_priv']], on='cod', how='left')
base['emprego_1000'] = 1000 * base.vinc_priv.fillna(0) / base.pop2025

# ---- eleições presidenciais 2022 e 2026 ----
v = pd.read_parquet(R + 'brasil-eleicoes-para-presidente-2022-2026/Data/processed/president_votes_municipality.parquet')
v = v[v.uf != 'ZZ'].dropna(subset=['ibge_code'])
v['cod'] = v.ibge_code.astype(int)
tot = v.groupby(['cod', 'year', 'round']).votes.sum().rename('validos')
v = v.join(tot, on=['cod', 'year', 'round'])
v['pct'] = 100 * v.votes / v.validos
def pick(year, rnd, cand, col):
    s = v[(v.year == year) & (v['round'] == rnd) & (v.candidate == cand)].set_index('cod').pct.rename(col)
    return s
el = pd.concat([pick(2022, 1, 'LULA', 'lula_22_1t'), pick(2022, 1, 'JAIR BOLSONARO', 'bolsonaro_22_1t'),
                pick(2022, 2, 'LULA', 'lula_22_2t'), pick(2022, 2, 'JAIR BOLSONARO', 'bolsonaro_22_2t'),
                pick(2026, 1, 'LULA', 'lula_26_1t'), pick(2026, 1, 'FLAVIO BOLSONARO', 'flavio_26_1t'),
                pick(2026, 2, 'LULA', 'lula_26_2t'), pick(2026, 2, 'FLAVIO BOLSONARO', 'flavio_26_2t')], axis=1)
t = pd.read_parquet(R + 'brasil-eleicoes-para-presidente-2022-2026/Data/processed/turnout_municipality.parquet')
t = t.merge(v[['tse_code', 'cod']].drop_duplicates(), on='tse_code', how='inner')
for (y, r), g in t.groupby(['year', 'round']):
    el = el.join(g.set_index('cod').pct_abstention.rename(f'abst_{str(y)[2:]}_{r}t'))
for y, r in [(2022, 1), (2022, 2), (2026, 1), (2026, 2)]:
    el[f'votos_{str(y)[2:]}_{r}t'] = tot.xs((y, r), level=[1, 2])
el = el.reset_index()
base = base.merge(el, on='cod', how='left')

# ---- indicadores oficiais compilados no IDSC-BR 2025 (Instituto Cidades Sustentáveis) ----
# Base: data/raw/Base_de_Dados_IDSC-BR_2025.xlsx do repositório clarabecker/idsc-analysis.
IDSC = R + 'idsc-analysis/data/raw/Base_de_Dados_IDSC-BR_2025.xlsx'
idsc = pd.read_excel(IDSC, 'Todos os Dados', usecols=['ID', 'SDG6_6_SERV_AG', 'SDG3_29_SF', 'SDG4_5_T_AN_15A'])
idsc = idsc.rename(columns={'ID': 'cod'})
base = base.merge(idsc, on='cod', how='left')
# água: SINISA (população atendida com abastecimento, %); 48 municípios sem dado → Censo 2022 (domicílios com rede geral)
base['agua_fonte'] = np.where(base.SDG6_6_SERV_AG.notna(), 'SINISA', 'Censo 2022')
base['agua_rede'] = base.SDG6_6_SERV_AG.fillna(base.agua_rede)
# Saúde da Família: cobertura oficial do e-Gestor (mar/2023), no lugar da estimativa por equipes do CNES
base['cob_esf'] = base.SDG3_29_SF
# alfabetização: 100 − analfabetismo de 15 anos ou mais (Censo 2022)
base['alfab'] = 100 - base.SDG4_5_T_AN_15A
base = base.drop(columns=['SDG6_6_SERV_AG', 'SDG3_29_SF', 'SDG4_5_T_AN_15A'])

# ---- mortalidade infantil (SIM/SINASC), 2022 e 2023 somados ----
# taxa anual do IDSC (série temporal, fonte DataSUS) × nascidos vivos do SINASC (OpenDataSUS) = óbitos;
# depois soma de óbitos ÷ soma de nascidos × 1.000. Conferência: Brasil 2023 = 12,61 (DATASUS).
st = pd.read_excel(IDSC, 'Séries Temporais', usecols=['ID', 'ANO', 'SDG3_15_T_M_INF'])
st = st[st.ANO.isin([2022, 2023])].copy(); st['cod6'] = st.ID // 10
nv = pd.read_csv(R + 'painel-epidemiologico-saude-materna/dados/tratados/fato_nascidos_municipio.csv')
nv = nv.groupby(['ano', 'cod_mun_res']).qtd_nascidos.sum().reset_index().rename(columns={'ano': 'ANO', 'cod_mun_res': 'cod6'})
st = st.merge(nv, on=['ANO', 'cod6'], how='left')
st['obitos'] = (st.SDG3_15_T_M_INF * st.qtd_nascidos / 1000).round()
tmi = st.groupby('ID').agg(obitos_inf=('obitos', 'sum'), nascidos=('qtd_nascidos', 'sum')).reset_index().rename(columns={'ID': 'cod'})
tmi['tmi_bruta'] = 1000 * tmi.obitos_inf / tmi.nascidos
# Suavização bayesiana empírica (Marshall, 1991) em direção à taxa do estado:
# em municípios com poucos nascimentos, um único óbito muda muito a taxa bruta.
tmi['uf'] = tmi.cod // 100000
def eb(g):
    r = g.obitos_inf / g.nascidos; n = g.nascidos
    m = g.obitos_inf.sum() / n.sum()
    s2 = max((n * (r - m) ** 2).sum() / n.sum() - m / n.mean(), 0)
    A = s2 / (s2 + m / n)
    return 1000 * (m + A * (r - m))
tmi['tmi'] = tmi.groupby('uf', group_keys=False).apply(eb)
tmi = tmi.drop(columns='uf')
print('TMI Brasil 2022-2023:', round(1000 * tmi.obitos_inf.sum() / tmi.nascidos.sum(), 2))
base = base.merge(tmi, on='cod', how='left')

base = base.drop(columns=['cod6'])
print(base.shape)
print(base.isna().sum()[base.isna().sum() > 0])
base.to_parquet(OUT + 'base_bruta.parquet')
# conferência eleitoral: somas nacionais a partir da base municipal
for y, r in [(2022, 1), (2022, 2), (2026, 1), (2026, 2)]:
    sub = v[(v.year == y) & (v['round'] == r)]
    s = sub.groupby('candidate').votes.sum().sort_values(ascending=False)
    print(y, r, (100 * s / s.sum()).head(3).round(2).to_dict(), 'mun', sub.cod.nunique())
