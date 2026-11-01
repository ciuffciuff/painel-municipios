# Fontes de dados

Os dados oficiais foram obtidos de repositórios públicos no GitHub que os redistribuem já agregados por município, porque o ambiente que gerou o painel não alcançava os portais oficiais (IBGE/SIDRA, DATASUS, INEP, TSE). O script `python/baixar_fontes.sh` baixa esses repositórios. Para uma versão institucional, recomenda-se refazer a coleta direto nas fontes oficiais, indicadas na última coluna.

| Dado | Repositório usado | Arquivo | Fonte oficial |
|---|---|---|---|
| Municípios, população do Censo 2022, alfabetização 15+, região | [Osodnil/tcc-fea-usp-gasto-publico-educacao-saeb-ideb](https://github.com/Osodnil/tcc-fea-usp-gasto-publico-educacao-saeb-ideb) | `data/processed/dim_municipio.parquet` | IBGE, Censo 2022 |
| IDEB 2025 (anos iniciais e finais, rede pública) | idem | `data/processed/painel_municipal.parquet` | INEP |
| População 2025, UBS, hospitais, distância ao hospital | [pedropaulofernandes88-stack/saude-brasil-insights](https://github.com/pedropaulofernandes88-stack/saude-brasil-insights) | `data/processed/municipios.csv` | IBGE (estimativas) e MS/CNES |
| Equipes de Saúde da Família (out/2026) | [fabiodiehl0402/aps-cnes-ine](https://github.com/fabiodiehl0402/aps-cnes-ine) | `dados/atual/*_equipes.csv.gz` | MS/CNES |
| Água, esgoto e lixo por domicílio | [zxcortes/Saneamento-censo-2022-Analise_de_Dados](https://github.com/zxcortes/Saneamento-censo-2022-Analise_de_Dados) | `t_Agua_Municipio.csv`, `t_Esgoto_Municipio.csv`, `t_Lixo_Municipio.csv` | IBGE, Censo 2022 |
| Renda domiciliar per capita, domicílios, Bolsa Família (ago/2026) | [TreferDG/analise-bolsa-familia](https://github.com/TreferDG/analise-bolsa-familia) | `dados/municipio_final.parquet` | IBGE (SIDRA 9728 e 10295) e CGU/Portal da Transparência |
| PIB per capita 2023 | [DanielNego/projeto-bi-pib-municipios](https://github.com/DanielNego/projeto-bi-pib-municipios) | `dados/csv/pib_municipios_tratado.csv` | IBGE, PIB dos Municípios |
| Empregos formais (RAIS 2024) e malha municipal | [rafapolo/rais](https://github.com/rafapolo/rais) | `docs/data/mun/2024.bin.gz`, `docs/data/brasil.topo.json` | MTE/PDET e IBGE (malha municipal) |
| Votação presidencial 2022 e 2026 por município | [JeffAirData/brasil-eleicoes-para-presidente-2022-2026](https://github.com/JeffAirData/brasil-eleicoes-para-presidente-2022-2026) | `Data/processed/president_votes_municipality.parquet`, `turnout_municipality.parquet` | TSE, Portal de Dados Abertos |

## Conferências feitas

- **Eleições:** a soma dos municípios reproduz os percentuais nacionais do TSE nos quatro turnos (por exemplo, 2º turno de 2026: Lula 51,78% e Flávio Bolsonaro 48,22%; 1º turno de 2026: Flávio Bolsonaro 47,04% e Lula 45,16%).
- **Reprodutibilidade:** rodar o pipeline do zero (`python/`) gera arquivos idênticos byte a byte aos de `dados/`.
- **Otimização:** o simplex em JavaScript do painel e o HiGHS (Python) dão o mesmo valor ótimo nos cenários testados.

## Bases candidatas para próximas versões

O catálogo de 85 bases municipais levantado no projeto (IBGE Cidades e outras fontes federais) lista alternativas e complementos: mortalidade infantil (SIM + SINASC via `microdatasus`), SISAB, SINISA (saneamento), Siconfi/FINBRA (finanças municipais), MapBiomas, Atlas da Violência e Censo Escolar.

## Licenças

Os dados oficiais são públicos e seguem os termos de cada órgão. Os repositórios intermediários têm licenças próprias; consulte cada um antes de redistribuir os arquivos brutos.
