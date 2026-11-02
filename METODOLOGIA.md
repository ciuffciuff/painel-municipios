# Metodologia

Este documento descreve, passo a passo, como o Painel de Municípios transforma dados abertos em perfis de necessidade, num índice de prioridade e numa proposta de alocação de orçamento. Todos os números citados vêm dos arquivos de `dados/` e podem ser reproduzidos com os scripts de `python/` (pipeline original) ou `R/` (versão didática).

## 1. Unidade de análise

Os 5.570 municípios do Censo Demográfico 2022, identificados pelo código IBGE de 7 dígitos. Boa Esperança do Norte (MT), criado depois do Censo, fica de fora porque não tem população nem indicadores censitários próprios.

População de referência: estimativa do IBGE para 2025 (usada como peso). A população do Censo 2022 também está na base (`pop_censo2022`).

## 2. Indicadores

| Dimensão | Indicador (coluna) | Fonte | Sentido |
|---|---|---|---|
| Saúde | Mortalidade infantil, por mil nascidos vivos, 2022–2023 (`tmi`) | SIM/SINASC, via IDSC-BR 2025; suavizada (Bayes empírico) | maior é pior |
| Saúde | Cobertura da Saúde da Família, % (`cob_esf`) | e-Gestor AB, mar/2023, via IDSC-BR 2025 | maior é melhor |
| Saúde | UBS por 10 mil habitantes (`ubs_10k`) | CNES e população 2025 | maior é melhor |
| Saúde | Distância ao município com hospital mais próximo, km (`dist_hospital_km`) | CNES, entre pontos centrais dos municípios | maior é pior |
| Educação | Alfabetização de 15 anos ou mais, % (`alfab`) | Censo 2022 | maior é melhor |
| Educação | IDEB 2025, anos iniciais, rede pública (`ideb_ai`) | INEP | maior é melhor |
| Saneamento | População atendida com abastecimento de água, % (`agua_rede`) | SINISA 2023 (IAG0001), via IDSC-BR 2025; Censo 2022 em 48 municípios (`agua_fonte`) | maior é melhor |
| Saneamento | Domicílios com esgoto por rede geral, pluvial ou fossa séptica, % (`esgoto_adeq`) | Censo 2022 | maior é melhor |
| Saneamento | Domicílios com lixo coletado, % (`lixo_coleta`) | Censo 2022 | maior é melhor |
| Renda | Rendimento domiciliar per capita médio, R$ (`renda_pc`) | Censo 2022 (SIDRA 10295) | maior é melhor |
| Renda | Vínculos formais privados por mil habitantes (`emprego_1000`) | RAIS 2024, ativos em 31/12, setor "Empresas" | maior é melhor |
| Renda | Domicílios com família no Bolsa Família, % (`bf_cob`) | Portal da Transparência, ago/2026, ÷ domicílios do Censo | maior é pior |

**Mortalidade infantil:** o IDSC-BR traz a taxa anual por município (óbitos de menores de 1 ano ÷ nascidos vivos × 1.000). Para cada ano, os óbitos são reconstituídos como taxa × nascidos vivos (SINASC) e somados em 2022–2023; a taxa nacional resultante é 12,6 por mil, igual à do DATASUS. Como 285 municípios têm menos de 50 nascimentos no biênio, a taxa usada (`tmi`) é a suavizada pelo estimador bayesiano empírico global de Marshall (1991), por estado: `tmi = m + A·(r − m)`, com `A = s² / (s² + m/n)`, em que `m` é a taxa do estado, `r` a taxa bruta, `n` os nascidos vivos e `s²` a variância entre municípios descontada do ruído. A taxa bruta fica em `tmi_bruta`.

**Cobertura da Saúde da Família:** população atendida por equipes de Saúde da Família ÷ população, última série do e-Gestor AB (março de 2023). Mede equipes, não atendimento efetivo.

**Água e esgoto:** a água passou a vir do SINISA (população atendida por rede). O esgoto continua do Censo 2022 porque o SINISA não tem 2.265 municípios e conta só a rede coletora, o que trataria a fossa séptica como ausência de esgoto.

**IDEB ausente:** 251 municípios não têm IDEB por participação insuficiente no Saeb. Nesses casos usamos a mediana do estado; no Distrito Federal, que é um município só, a da região Centro-Oeste. A coluna `ideb_imputado` marca esses casos.

## 3. Necessidade por dimensão

Para cada indicador, calculamos a posição percentual do município entre os 5.570, depois de inverter o sinal dos indicadores em que "maior é melhor":

```
n_indicador = 100 × posição_percentual(−sentido × valor)
```

Assim, 0 é o melhor município do país e 100 o pior. A necessidade de uma dimensão (`nec_saude`, `nec_educacao`, `nec_saneamento`, `nec_renda`) é a média simples dos seus indicadores.

Usar posições, e não os valores brutos, deixa os indicadores na mesma escala e reduz a influência de valores extremos (como capitais com renda muito alta). A consequência é que a necessidade é **relativa**: mede a posição frente aos outros municípios, não a distância a uma meta absoluta.

## 4. Índice de prioridade (TOPSIS)

O TOPSIS (Technique for Order Preference by Similarity to Ideal Solution) compara cada município com dois pontos de referência: a situação ideal (menor necessidade observada em cada indicador) e a pior situação (maior necessidade observada).

1. Matriz X com as 12 necessidades em escala de 0 a 1.
2. Pesos: 1/4 para cada dimensão, dividido igualmente entre os indicadores da dimensão (por exemplo, cada indicador de saúde pesa 1/12).
3. Matriz ponderada V = X × pesos.
4. Distâncias euclidianas de cada município ao ideal (d⁺) e à pior situação (d⁻).
5. Índice = 100 × d⁺ / (d⁺ + d⁻).

O índice vai de 0 a 100: quanto maior, mais perto da pior situação e mais prioritário. A coluna `rank_topsis` dá a posição no país (1 = mais prioritário).

## 5. Perfis de necessidade (k-means)

1. As 12 necessidades são padronizadas (média 0, desvio-padrão 1).
2. Testamos k de 3 a 9, com 20 inicializações cada, e calculamos a silhueta numa amostra de 4.000 municípios (`dados/selecao_k.csv`).
3. Escolhemos k = 6 e rodamos o k-means com 50 inicializações (semente 42).
4. Os grupos são renumerados de 1 (menor TOPSIS médio) a 6 (maior).

| k | Silhueta |
|---|---|
| 3 | 0,26 |
| 4 | 0,21 |
| 5 | 0,18 |
| **6** | **0,17** |
| 7 | 0,16 |
| 8 | 0,16 |
| 9 | 0,16 |

A silhueta é baixa para qualquer k: as necessidades variam de forma contínua no território, e os perfis devem ser lidos como faixas desse contínuo, não como grupos isolados. O k = 3 tem a maior silhueta, mas mistura situações que pedem políticas diferentes (por exemplo, grandes centros com lacuna em atenção primária e interior sem esgotamento). O k = 6 foi escolhido pela interpretabilidade para política pública. Essa escolha é um julgamento e pode ser revista.

Os nomes, descrições e políticas sugeridas de cada perfil (`dados/perfis.csv`) foram escritos a partir das medianas dos indicadores e da composição regional de cada grupo. São indicativos e precisam de validação com as áreas setoriais.

## 6. Alocação de orçamento (programação linear)

### Grupos e déficit

O modelo trabalha com 30 grupos (5 regiões × 6 perfis), para que o problema seja pequeno o bastante para ser resolvido no navegador e para que a alocação respeite a escala regional.

O **déficit** de um grupo g numa política p é medido em "pessoas-equivalentes":

```
déficit[g, p] = Σ (população_2025 × necessidade_p / 100)   sobre os municípios do grupo
```

### Variáveis

y[g, p, s] = déficit reduzido no grupo g, política p e segmento s. Cada déficit é dividido em três segmentos iguais (s = 1, 2, 3) com eficiência de 100%, 70% e 40%. Reduzir o primeiro terço do déficit é mais barato que reduzir o último, o que modela retornos decrescentes e evita que todo o recurso vá para um só lugar.

Custo de reduzir uma unidade: `custo_p / eficiência_s`, com custos de R$ 300 (saúde), R$ 250 (educação), R$ 900 (saneamento) e R$ 500 (renda) por pessoa-equivalente. **Esses custos são hipóteses de trabalho** para comparar cenários; antes de uso real, devem ser calibrados com custos de programas.

### Restrições

1. **Orçamento:** Σ custo × y ≤ B (padrão: R$ 20 bilhões).
2. **Piso por política:** cada política recebe ao menos 10% de B.
3. **Piso regional:** cada região recebe ao menos (piso regional %) × B × (participação da região no déficit total). Padrão: 50%.
4. **Teto de absorção:** o gasto num grupo não passa de (teto) × população do grupo. Padrão: R$ 250 por habitante. Representa a capacidade limitada de executar recursos.
5. **Limite dos segmentos:** 0 ≤ y[g, p, s] ≤ déficit[g, p] / 3.

### Formulação de eficiência

```
maximizar  Σ peso_p × (necessidade[g, p] / 50)^α × y[g, p, s]
```

O expoente α (aversão à desigualdade, padrão 1) dá mais valor a reduzir déficit onde a necessidade é mais intensa. Com α = 0, todas as pessoas-equivalentes valem o mesmo.

### Formulação de equidade (maximin lexicográfico)

1. **Primeiro estágio:** maximizar t, sujeito a todas as restrições e a Σ_s y[g, p, s] / déficit[g, p] ≥ t para todo grupo e política. Ou seja, maximizar a menor fração de déficit reduzida.
2. **Segundo estágio:** manter t ≥ 0,999 × t* e maximizar o objetivo de eficiência com o orçamento que sobra.

Com os parâmetros padrão, a solução de equidade garante redução mínima de 13,2% do déficit em todos os 120 pares grupo × política.

### Solução e conferência

- `python/lp.py` resolve o modelo com SciPy/HiGHS e grava `dados/alocacao_referencia.csv` e `dados/ref_politica.csv`.
- O painel resolve o mesmo modelo em JavaScript (`web/simplex.js`, simplex de duas fases) a cada mudança de parâmetro. Nos parâmetros padrão, os dois solvers dão o mesmo valor ótimo (86.056,5 na eficiência).
- `R/painel_municipios.R` mostra a formulação de eficiência com `lpSolve`.

Resultado padrão por política (R$ bilhões):

| Formulação | Saúde | Educação | Saneamento | Renda |
|---|---|---|---|---|
| Eficiência | 9,71 | 6,29 | 2,00 | 2,00 |
| Equidade | 5,24 | 2,92 | 7,16 | 4,68 |

A eficiência concentra recursos onde a pessoa-equivalente é mais barata (saúde e educação); a equidade puxa recursos para saneamento e renda, onde estão os maiores déficits relativos.

**Preço-sombra:** o painel estima o ganho de R$ 1 bilhão adicional resolvendo de novo com B + 1. Na formulação de eficiência, o dual do orçamento no HiGHS é 3,74 unidades do objetivo por R$ 1 milhão.

### Do grupo ao município

Para mostrar a alocação no mapa, o valor de cada grupo e política é repartido entre os municípios do grupo em proporção a população × necessidade da política. É uma regra de rateio, não uma otimização por município.

## 7. Eleições

Para 2022 e 2026, 1º e 2º turnos: percentual de Lula e do principal adversário (Jair Bolsonaro em 2022, Flávio Bolsonaro em 2026) nos votos válidos de cada município, vencedor e abstenção. As somas dos municípios conferem com os totais do TSE (2º turno de 2026: Lula 51,78%, Flávio Bolsonaro 48,22%, sem votos do exterior).

### Análise eleitoral no painel

O painel cruza o voto com as necessidades em todas as abas:

- **Mapa e visão geral:** dispersão entre o índice de prioridade (TOPSIS) e o % de Lula no 2º turno de 2026, com a correlação e o voto no quinto menos e no mais prioritário.
- **Perfis:** voto, variação 2022→2026, abstenção e municípios que mudaram de vencedor em cada perfil.
- **Ranking:** % de Lula em 2022 e 2026 e vencedor de 2026 em cada município listado.
- **Simulador:** R$ por habitante alocado aos municípios conforme o vencedor e o quinto de votação de Lula, para mostrar que a diferença vem da necessidade.
- **Eleições:** correlação de Pearson de 12 indicadores com o % de Lula e com a variação entre 2022 e 2026, voto por quinto de prioridade e variação por perfil.

Os agregados são ponderados pelos votos válidos de cada município. As correlações são entre municípios (ecológicas) e não indicam causa nem o comportamento de cada eleitor.

Principais resultados: correlação de 0,73 entre o TOPSIS e o voto em Lula em 2026; Lula teve 41,0% no quinto menos prioritário e 72,1% no mais prioritário; ganhou 0,9 p.p. no total entre 2022 e 2026, mas caiu em 78% dos municípios (mediana de −2,0 p.p.), com alta nos grandes centros (perfil 2, +1,9 p.p.) e maior queda no interior do Sul, Sudeste e Centro-Oeste (perfil 3, −3,3 p.p.).

As votações **não** entram nos indicadores, no TOPSIS, no k-means nem na alocação. Distribuir recursos pelo resultado eleitoral contrariaria o princípio da impessoalidade (art. 37 da Constituição). No painel, aparecem só como camada descritiva e para cruzamento com os perfis.

## 8. Limitações

- Mortalidade infantil instável em municípios pequenos; a suavização puxa essas taxas para a média do estado.
- Indicadores de anos diferentes (Censo 2022, mortalidade infantil 2022–2023, e-Gestor e SINISA 2023, RAIS 2024, IDEB 2025, CNES e Bolsa Família 2026).
- Necessidade relativa, não absoluta.
- Médias municipais escondem desigualdades dentro dos grandes municípios (perfil 2).
- Custos e eficiências do modelo de alocação são hipóteses.
- Os dados foram obtidos de repositórios de terceiros que redistribuem dados oficiais; ver `FONTES.md`.
