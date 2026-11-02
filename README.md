# Painel de Municípios

Necessidades dos 5.570 municípios brasileiros (Censo 2022) em saúde, educação, saneamento e renda, agrupadas por machine learning e usadas num modelo de pesquisa operacional para indicar a alocação de políticas públicas. Os resultados das eleições presidenciais de 2022 e 2026 entram como camada descritiva.

Painel interativo:
- GitHub Pages: https://ciuffciuff.github.io/painel-municipios/ (pasta `docs/`)
- Claude: https://claude.ai/artifact/NZXKJNrt81eyJ74HZFFDJA

## O que o projeto faz

1. **Indicadores (12).** Saúde: mortalidade infantil 2022–2023 (SIM/SINASC), cobertura da Saúde da Família (e-Gestor), UBS por 10 mil habitantes, distância ao hospital. Educação: alfabetização de 15 anos ou mais e IDEB 2025 (anos iniciais). Saneamento: população atendida com água por rede (SINISA 2023), esgoto adequado e coleta de lixo. Renda: renda domiciliar per capita, empregos formais privados por mil habitantes e domicílios no Bolsa Família.
2. **Necessidade.** Cada indicador vira uma posição percentual entre os municípios (0 = melhor do país, 100 = pior). A necessidade de uma dimensão é a média dos seus indicadores.
3. **TOPSIS.** Índice de prioridade de 0 a 100, com peso igual por dimensão.
4. **k-means.** Seis perfis de necessidade, numerados do menos ao mais necessitado.
5. **Programação linear.** Distribui um orçamento entre 30 grupos (5 regiões × 6 perfis) e 4 políticas, com retornos decrescentes, pisos por política e por região e teto de absorção por habitante. Há duas formulações: eficiência (maior redução total do déficit) e equidade (maximin lexicográfico).

## Perfis encontrados

| Perfil | Nome | Municípios |
|---|---|---|
| 1 | Consolidados, com atenção primária a reforçar | 1.107 |
| 2 | Grandes centros com lacuna na atenção primária | 840 |
| 3 | Interior com déficit de esgotamento e longe de hospital | 996 |
| 4 | Vulnerabilidade de renda e educação com infraestrutura intermediária | 876 |
| 5 | Vulnerabilidade múltipla com isolamento geográfico | 676 |
| 6 | Vulnerabilidade social aguda | 1.075 |

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `R/` | `painel_municipios.R`: necessidade, TOPSIS, k-means e programação linear (`lpSolve`), comentado para iniciantes. Usa `dados/municipios.csv`. |
| `python/` | Pipeline que gerou os dados: `build_data.py` (junta as fontes), `model.py` (necessidade, TOPSIS, k-means), `lp.py` (programação linear com SciPy/HiGHS), `geo.py` (malha SVG), `out_build.py` (arquivos finais), `decode_rais.py` (RAIS por município). |
| `dados/` | Base final por município, perfis, grupos do modelo, parâmetros, solução de referência e malhas. |
| `web/` | Código-fonte do painel (HTML/JS, simplex em JavaScript), escrito para a API `dash` do painel do Claude. |
| `docs/` | Versão independente do painel, publicada no GitHub Pages. `dash-shim.js` substitui a API `dash`; `montar.py` regenera a pasta a partir de `web/` e `dados/` (`python docs/montar.py`). |
| `R/sidra_*.R`, `dados/sidra/` | Conector da API SIDRA (`DescritoresTabela`). O workflow `.github/workflows/sidra-descritores.yml` baixa os descritores de todas as tabelas do catálogo do IBGE (ou das listadas em `dados/sidra/tabelas.txt`), guarda o JSON original em `dados/sidra/descritores/` e tabelas consolidadas em `dados/sidra/consolidado/`. |
| `R/conectores/`, `dados/fontes/` | Conectores para Portal da Transparência (API da CGU), DATASUS (FTP), TSE (catálogo CKAN) e INEP (downloads). O workflow `.github/workflows/fontes-oficiais.yml` baixa os catálogos de cada fonte (`descobrir`), executa os pedidos da API da Transparência (`transparencia`) ; `painel-oficial.yml` roda `R/coleta_oficial.R`. Ver [FONTES.md](FONTES.md). |
| `teste/` | Teste do painel num DOM simulado (`node teste/run.mjs`, requer `jsdom`, `d3` e `papaparse`). |

Documentos: [METODOLOGIA.md](METODOLOGIA.md) (fórmulas e escolhas de cada etapa) e [FONTES.md](FONTES.md) (origem de cada dado e conferências).

## Ver o painel no seu computador

```bash
cd docs
python -m http.server 8000     # abra http://localhost:8000
```

## Como rodar em R

Usa a base pronta em `dados/municipios.csv`.

```r
install.packages(c("tidyverse", "cluster", "lpSolve"))
setwd("dados")          # o script lê municipios.csv na pasta atual
source("../R/painel_municipios.R")
```

## Como refazer tudo do zero (Python)

Rode a partir da raiz do repositório:

```bash
pip install -r requirements.txt
bash python/baixar_fontes.sh        # baixa os repositórios de origem para fontes/
python python/decode_rais.py        # RAIS 2024 por município
python python/build_data.py         # junta as fontes → dados/base_bruta.parquet
python python/model.py              # necessidade, TOPSIS, k-means
python python/lp.py                 # programação linear (SciPy/HiGHS)
python python/geo.py                # malhas em SVG
python python/out_build.py          # arquivos finais de dados/
```

Feito a partir de `fontes/` recém-baixado, o pipeline gera arquivos idênticos aos de `dados/`. Se algum repositório de origem for atualizado, os números podem mudar.

## Fontes

IBGE (Censo 2022, estimativas de população 2025, PIB dos Municípios 2023, malha municipal), INEP (IDEB 2025), Ministério da Saúde (SIM e SINASC 2022–2023; e-Gestor AB, mar/2023; CNES: UBS e hospitais), Ministério das Cidades (SINISA 2023), Instituto Cidades Sustentáveis (base IDSC-BR 2025), MTE/RAIS 2024, CGU/Portal da Transparência (Novo Bolsa Família, ago/2026) e TSE (eleição presidencial de 2022 e 2026). Detalhes, arquivos e links em [FONTES.md](FONTES.md).

## Limitações

- A mortalidade infantil é instável em municípios pequenos: somamos 2022 e 2023 e aplicamos suavização bayesiana empírica em direção à taxa do estado (a taxa bruta fica em `tmi_bruta`).
- O esgoto continua do Censo 2022: o SINISA não tem 2.265 municípios e conta só a rede coletora.
- O IDEB falta em 251 municípios; foi usada a mediana do estado (no DF, a da região).
- Os custos por unidade de déficit no modelo (R$ 300, 250, 900 e 500) são hipóteses para comparar cenários, não estimativas orçamentárias.
- A silhueta do k-means é baixa (0,17): as necessidades variam de forma contínua e os perfis são faixas desse contínuo.
- As votações não entram no agrupamento, no índice nem na alocação (princípio da impessoalidade, art. 37 da Constituição).

## Licença

Código sob a licença [MIT](LICENSE). Textos e dados derivados sob [CC BY 4.0](LICENSE-CONTEUDO.md). Os dados oficiais de origem seguem os termos de cada órgão (detalhes em [LICENSE-CONTEUDO.md](LICENSE-CONTEUDO.md) e [FONTES.md](FONTES.md)).

## Autor

César Ciuffo — ORCID [0009-0001-0248-6791](https://orcid.org/0009-0001-0248-6791)
