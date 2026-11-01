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

## Versão institucional: coleta nas fontes oficiais

O script `R/coleta_oficial.R` baixa os dados diretamente do IBGE (SIDRA), do DATASUS (SIM, SINASC e CNES) e do TSE, e calcula a **taxa de mortalidade infantil** (óbitos de menores de 1 ano ÷ nascidos vivos × 1.000, soma de 2022 a 2024, por município de residência). Ele precisa de acesso a `apisidra.ibge.gov.br`, `ftp.datasus.gov.br` e `cdn.tse.jus.br`, que não estavam disponíveis no ambiente que gerou esta versão; ainda não foi executado. Números de tabelas do SIDRA marcados "a conferir" no script devem ser checados com `sidrar::info_sidra()`.

## Conectores e coleta pelo GitHub Actions

Como o ambiente de análise não alcança os portais oficiais, a coleta roda no GitHub Actions, que tem acesso livre à internet, e os resultados são gravados no repositório.

| Fonte | Conector | O que o catálogo traz (`dados/fontes/<fonte>/`) |
|---|---|---|
| IBGE/SIDRA | `R/sidra_descritores.R` (workflow `sidra-descritores.yml`) | Catálogo de todas as tabelas e descritores (variáveis, períodos, classificações) em `dados/sidra/` |
| Portal da Transparência (CGU) | `R/conectores/transparencia.R` | `endpoints.csv` e `parametros.csv`, lidos da especificação OpenAPI; resultados dos pedidos em `resultados/` |
| DATASUS | `R/conectores/datasus.R` | `arquivos_ftp.csv`: arquivos .dbc do SIM, SINASC, CNES, SIH e SINAN, com tamanho e data |
| TSE | `R/conectores/tse.R` | `catalogo.csv`: todos os conjuntos do Portal de Dados Abertos e o endereço de cada arquivo |
| INEP | `R/conectores/inep.R` | `bases_pda.csv` (bases públicas do inventário do PDA Inep 2025–2027), `links_paginas.csv` (links das páginas oficiais) e `enderecos_testados.csv` |

A API do Portal da Transparência exige chave gratuita (cadastro em portaldatransparencia.gov.br/api-de-dados/cadastrar-email), guardada no segredo `TRANSPARENCIA_CHAVE` do repositório. Os pedidos ficam em `dados/fontes/transparencia/pedidos.csv`; `por_municipio = TRUE` repete a consulta para os 5.570 municípios. Arquivos com mais de 95 MB não vão para o repositório: ficam como artefato da execução por 30 dias.

## Conferências feitas

- **Eleições:** a soma dos municípios reproduz os percentuais nacionais do TSE nos quatro turnos (por exemplo, 2º turno de 2026: Lula 51,78% e Flávio Bolsonaro 48,22%; 1º turno de 2026: Flávio Bolsonaro 47,04% e Lula 45,16%).
- **Reprodutibilidade:** rodar o pipeline do zero (`python/`) gera arquivos idênticos byte a byte aos de `dados/`.
- **Otimização:** o simplex em JavaScript do painel e o HiGHS (Python) dão o mesmo valor ótimo nos cenários testados.

## Bases candidatas para próximas versões

O catálogo de 85 bases municipais levantado no projeto (IBGE Cidades e outras fontes federais) lista alternativas e complementos: mortalidade infantil (SIM + SINASC via `microdatasus`), SISAB, SINISA (saneamento), Siconfi/FINBRA (finanças municipais), MapBiomas, Atlas da Violência e Censo Escolar.

## Licenças

Os dados oficiais são públicos e seguem os termos de cada órgão. Os repositórios intermediários têm licenças próprias; consulte cada um antes de redistribuir os arquivos brutos. A licença deste projeto (MIT para o código, CC BY 4.0 para textos e dados derivados) está em `LICENSE` e `LICENSE-CONTEUDO.md`.
