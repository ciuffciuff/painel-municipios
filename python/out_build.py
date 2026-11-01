"""Gera os arquivos de dados publicados no painel."""
import pandas as pd, numpy as np
OUT = 'dados/'
b = pd.read_parquet(OUT + 'base_modelo.parquet')

PERFIS = {
 1: ('Consolidados, com atenção primária a reforçar',
     'Baixa necessidade em educação, saneamento e renda. Em saúde ficam na média nacional, pela menor oferta de UBS por habitante e pela distância ao hospital (cerca de 13 km na mediana). Concentrados no Sul e no Sudeste.',
     'Qualificar a atenção primária (mais equipes de Saúde da Família onde a cobertura não chega a 100%) e manter os níveis atuais nas demais áreas; são candidatos a contrapartida e cooperação técnica com os grupos mais vulneráveis.'),
 2: ('Grandes centros com lacuna na atenção primária',
     'Reúne capitais, regiões metropolitanas e cidades médias: 61% da população do país. Saneamento, renda e educação estão acima da média, mas a cobertura estimada da Saúde da Família e a oferta de UBS por habitante são as mais baixas.',
     'Expandir a Estratégia Saúde da Família e a rede de UBS nas periferias urbanas (provimento como o Mais Médicos, custeio da APS) e focalizar bolsões de pobreza intraurbana, que a média municipal esconde.'),
 3: ('Interior com déficit de esgotamento e longe de hospital',
     'Municípios pequenos do interior do Sul, Sudeste e Centro-Oeste. Renda e educação razoáveis, mas só cerca de 42% dos domicílios têm esgoto por rede ou fossa séptica, e o hospital mais próximo fica a cerca de 21 km (mediana).',
     'Saneamento de pequena escala (soluções individuais e descentralizadas, saneamento rural), consórcios intermunicipais de saúde e transporte sanitário até o hospital de referência.'),
 4: ('Vulnerabilidade de renda e educação com infraestrutura intermediária',
     'Dois terços no Nordeste. Analfabetismo de cerca de 15% entre pessoas de 15 anos ou mais, renda per capita perto de R$ 870 e quase metade dos domicílios no Bolsa Família; o saneamento é intermediário.',
     'Alfabetização e educação de jovens e adultos (EJA), alfabetização na idade certa, qualificação profissional e inclusão produtiva, articuladas ao Bolsa Família e ao Cadastro Único.'),
 5: ('Vulnerabilidade múltipla com isolamento geográfico',
     'Municípios pequenos do Nordeste, Norte e norte de Minas Gerais. Renda e emprego formal muito baixos, esgoto adequado em cerca de 26% dos domicílios, coleta de lixo em dois terços, e o hospital mais próximo a cerca de 22 km.',
     'Pacote integrado: saneamento rural e coleta de resíduos, transporte sanitário e telessaúde, inclusão produtiva rural e alfabetização. Precisa de cooperação federativa, pela baixa capacidade de execução local.'),
 6: ('Vulnerabilidade social aguda',
     'A maior necessidade do país: renda per capita perto de R$ 700, 62% dos domicílios no Bolsa Família, analfabetismo de cerca de 20% e esgoto adequado em pouco mais de um quinto dos domicílios. Três quartos estão no Nordeste e um quinto no Norte.',
     'Prioridade máxima e intersetorial: universalizar água e esgoto (Marco Legal do Saneamento, Novo PAC), alfabetização e permanência escolar, primeira infância, transferência de renda com inclusão produtiva e reforço da atenção primária.'),
}

pf = pd.read_csv(OUT + 'perfil_raw.csv')
pf['nome'] = pf.grupo.map(lambda g: PERFIS[g][0])
pf['descricao'] = pf.grupo.map(lambda g: PERFIS[g][1])
pf['politicas_sugeridas'] = pf.grupo.map(lambda g: PERFIS[g][2])
pf['pop_pct'] = 100 * pf.populacao / pf.populacao.sum()
pf = pf.round(2)
pf.to_csv(OUT + 'perfis.csv', index=False)

cols = ['cod', 'nome', 'uf', 'regiao', 'pop2025', 'pop_censo2022', 'grupo', 'gid', 'topsis', 'rank_topsis',
        'nec_saude', 'nec_educacao', 'nec_saneamento', 'nec_renda',
        'cob_esf', 'ubs_por_10k', 'distancia_hospital_proxy_km', 'alfab', 'ideb_ai', 'ideb_imputado',
        'agua_rede', 'esgoto_adeq', 'lixo_coleta', 'renda_pc', 'emprego_1000', 'bf_cob', 'pib_pc',
        'lula_22_1t', 'bolsonaro_22_1t', 'lula_22_2t', 'bolsonaro_22_2t',
        'lula_26_1t', 'flavio_26_1t', 'lula_26_2t', 'flavio_26_2t',
        'abst_22_1t', 'abst_22_2t', 'abst_26_1t', 'abst_26_2t', 'votos_22_2t', 'votos_26_2t']
def venc(a, bcol, nb):
    return np.where(b[a] > b[bcol], 'Lula', np.where(b[a] < b[bcol], nb, 'Empate'))
b['venc_22_2t'] = venc('lula_22_2t', 'bolsonaro_22_2t', 'Jair Bolsonaro')
b['venc_26_1t'] = venc('lula_26_1t', 'flavio_26_1t', 'Flávio Bolsonaro')
b['venc_26_2t'] = venc('lula_26_2t', 'flavio_26_2t', 'Flávio Bolsonaro')
cols += ['venc_22_2t', 'venc_26_1t', 'venc_26_2t', 'votos_22_1t', 'votos_26_1t']
m = b[cols].copy()
for c in m.columns:
    if m[c].dtype.kind == 'f':
        m[c] = m[c].round(2)
m['pop2025'] = m.pop2025.astype(int); m['pop_censo2022'] = m.pop_censo2022.astype(int)
m = m.rename(columns={'distancia_hospital_proxy_km': 'dist_hospital_km', 'ubs_por_10k': 'ubs_10k'})
m.to_csv(OUT + 'municipios.csv', index=False)
print(m.shape, round(len(m.to_csv(index=False)) / 1e6, 2), 'MB')
print(pf[['grupo', 'nome', 'municipios', 'pop_pct']])
