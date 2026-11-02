# =============================================================================
# Painel de Municípios: perfis de necessidade, prioridade e alocação de orçamento
# Reproduz em R o que o painel web faz: indicadores, necessidade, TOPSIS,
# k-means e programação linear (eficiência e equidade).
#
# Entrada: municipios.csv (baixe na aba "Fontes" do painel ou peça a César/Claude).
# Pacotes: tidyverse, cluster, lpSolve. Instale uma vez com:
#   install.packages(c("tidyverse", "cluster", "lpSolve"))
# =============================================================================

library(tidyverse)
library(cluster)   # silhouette()
library(lpSolve)   # lp()

set.seed(42)

# -----------------------------------------------------------------------------
# 1. Ler a base
# -----------------------------------------------------------------------------
mun <- read_csv("municipios.csv", show_col_types = FALSE)
glimpse(mun)   # 5.570 linhas, uma por município

# -----------------------------------------------------------------------------
# 2. Indicadores e sentido de cada um
#    +1 = quanto maior, melhor; -1 = quanto maior, pior
# -----------------------------------------------------------------------------
ind <- tribble(
  ~var,               ~dim,          ~sentido,
  "tmi",              "saude",       -1,   # mortalidade infantil 2022–2023 (suavizada)
  "cob_esf",          "saude",        1,
  "ubs_10k",          "saude",        1,
  "dist_hospital_km", "saude",       -1,
  "alfab",            "educacao",     1,
  "ideb_ai",          "educacao",     1,
  "agua_rede",        "saneamento",   1,
  "esgoto_adeq",      "saneamento",   1,
  "lixo_coleta",      "saneamento",   1,
  "renda_pc",         "renda",        1,
  "emprego_1000",     "renda",        1,
  "bf_cob",           "renda",       -1
)

# -----------------------------------------------------------------------------
# 3. Necessidade: posição percentual de 0 (melhor do país) a 100 (pior)
#    percent_rank() faz o mesmo que rank(pct = TRUE) do Python, a menos de empates
# -----------------------------------------------------------------------------
for (i in seq_len(nrow(ind))) {
  v <- ind$var[i]; s <- ind$sentido[i]
  mun[[paste0("n_", v)]] <- 100 * percent_rank(-s * mun[[v]])
}
for (d in unique(ind$dim)) {
  cols <- paste0("n_", ind$var[ind$dim == d])
  mun[[paste0("nec_", d, "_r")]] <- rowMeans(mun[cols])
}

# -----------------------------------------------------------------------------
# 4. TOPSIS (pesos iguais por dimensão)
# -----------------------------------------------------------------------------
X <- as.matrix(mun[paste0("n_", ind$var)]) / 100      # 0 = melhor, 1 = pior
w <- 1 / 4 / table(ind$dim)[ind$dim]                  # 1/4 por dimensão, dividido pelos indicadores
V <- sweep(X, 2, as.numeric(w), "*")
ideal <- apply(V, 2, min); anti <- apply(V, 2, max)
d_ideal <- sqrt(rowSums(sweep(V, 2, ideal)^2))
d_anti  <- sqrt(rowSums(sweep(V, 2, anti)^2))
mun$topsis_r <- 100 * d_ideal / (d_ideal + d_anti)    # 100 = mais prioritário

# -----------------------------------------------------------------------------
# 5. k-means: escolha de k e agrupamento
# -----------------------------------------------------------------------------
Z <- scale(X)
amostra <- sample(nrow(Z), 4000)                      # silhueta numa amostra, para ser rápido
selecao <- map_dfr(3:9, function(k) {
  km <- kmeans(Z, centers = k, nstart = 20, iter.max = 100)
  sil <- silhouette(km$cluster[amostra], dist(Z[amostra, ]))
  tibble(k = k, silhueta = mean(sil[, "sil_width"]), inercia = km$tot.withinss)
})
print(selecao)
# A silhueta é baixa para qualquer k: as necessidades variam de forma contínua.
# Escolhemos k = 6 porque separa perfis com políticas diferentes.

km <- kmeans(Z, centers = 6, nstart = 50, iter.max = 100)
# Numera os grupos do menos ao mais necessitado (TOPSIS médio)
ordem <- tibble(cl = km$cluster, t = mun$topsis_r) |>
  group_by(cl) |> summarise(t = mean(t)) |> arrange(t) |> mutate(grupo_r = row_number())
mun$grupo_r <- ordem$grupo_r[match(km$cluster, ordem$cl)]
# Os números dos grupos podem trocar em relação ao painel (inicialização aleatória);
# compare pelos perfis:
mun |> group_by(grupo_r) |>
  summarise(n = n(), across(c(starts_with("nec_") & ends_with("_r"), topsis_r), mean)) |> print()

# -----------------------------------------------------------------------------
# 6. Grupos para otimização: região × perfil, com o déficit em pessoas-equivalentes
#    (usamos o "grupo" e as necessidades do painel para obter o mesmo resultado)
# -----------------------------------------------------------------------------
dims <- c("saude", "educacao", "saneamento", "renda")
grupos <- mun |>
  mutate(gid = paste(regiao, grupo, sep = "_")) |>
  group_by(gid, regiao, grupo) |>
  summarise(pop = sum(pop2025),
            across(all_of(paste0("nec_", dims)), ~ sum(pop2025 * .x / 100), .names = "gap_{str_remove(.col, 'nec_')}"),
            .groups = "drop")
for (d in dims) grupos[[paste0("nec_", d)]] <- 100 * grupos[[paste0("gap_", d)]] / grupos$pop

# -----------------------------------------------------------------------------
# 7. Programação linear (eficiência) com lpSolve
#    Variáveis y[g, p, s]: déficit reduzido (milhares) no grupo g, política p, segmento s
#    Segmentos com eficiência 100%, 70%, 40% modelam retornos decrescentes.
# -----------------------------------------------------------------------------
pol <- tibble(politica = dims, custo = c(300, 250, 900, 500), peso = 1, piso_pct = 10)
geral <- list(orcamento_bi = 20, piso_regional_pct = 50, teto_per_capita = 250, equidade = 1)
seg <- c(1, 0.7, 0.4)

vars <- expand_grid(gi = seq_len(nrow(grupos)), pi = seq_len(nrow(pol)), si = seq_along(seg)) |>
  mutate(gid = grupos$gid[gi], regiao = grupos$regiao[gi], politica = pol$politica[pi],
         gap = map2_dbl(gi, politica, ~ grupos[[paste0("gap_", .y)]][.x]) / 1e3,
         nec = map2_dbl(gi, politica, ~ grupos[[paste0("nec_", .y)]][.x]),
         custo = pol$custo[pi] / seg[si] / 1e3,                # R$ milhões por mil pessoas-equivalentes
         valor = pol$peso[pi] * (nec / 50)^geral$equidade,
         ub = gap / length(seg))

B <- geral$orcamento_bi * 1e3                                 # R$ milhões
nv <- nrow(vars)
A <- list(); dir <- c(); rhs <- c()
add <- function(row, d, r) { A[[length(A) + 1]] <<- row; dir <<- c(dir, d); rhs <<- c(rhs, r) }

add(vars$custo, "<=", B)                                                         # orçamento
for (p in pol$politica) add(vars$custo * (vars$politica == p), ">=", B * 0.10)    # piso por política
gap_total <- sum(vars$gap) ; share <- tapply(vars$gap, vars$regiao, sum)
for (r in names(share)) add(vars$custo * (vars$regiao == r), ">=",               # piso regional
                            geral$piso_regional_pct / 100 * B * share[r] / gap_total)
for (g in seq_len(nrow(grupos))) add(vars$custo * (vars$gi == g), "<=",          # teto de absorção
                                     geral$teto_per_capita * grupos$pop[g] / 1e6)
for (j in seq_len(nv)) { row <- numeric(nv); row[j] <- 1; add(row, "<=", vars$ub[j]) }  # limite de cada segmento

sol <- lp("max", vars$valor, do.call(rbind, A), dir, rhs)
stopifnot(sol$status == 0)
vars$y <- sol$solution
vars$gasto_mi <- vars$y * vars$custo

alocacao <- vars |> group_by(regiao, politica) |> summarise(gasto_bi = sum(gasto_mi) / 1e3, .groups = "drop")
alocacao |> pivot_wider(names_from = politica, values_from = gasto_bi) |> print()
cat("Total alocado (R$ bi):", sum(vars$gasto_mi) / 1e3, "\n")
cat("Objetivo:", sol$objval, " (o painel e o Python dão 80.271,6)\n")

# Preço-sombra do orçamento: ganho no objetivo por R$ 1 milhão a mais
sol2 <- lp("max", vars$valor, do.call(rbind, A), dir, rhs, compute.sens = TRUE)
cat("Preço-sombra do orçamento:", sol2$duals[1], "\n")

# -----------------------------------------------------------------------------
# 8. Mortalidade infantil: já está na base (colunas tmi, tmi_bruta, obitos_inf, nascidos)
#    Para recalcular direto do DATASUS (precisa de internet para o FTP):
# -----------------------------------------------------------------------------
# install.packages("remotes"); remotes::install_github("rfsaldanha/microdatasus")
# library(microdatasus)
# obitos <- fetch_datasus(year_start = 2022, year_end = 2023, information_system = "SIM-DOINF")
# nasc   <- fetch_datasus(year_start = 2022, year_end = 2023, information_system = "SINASC")
# tmi <- count(obitos, cod6 = as.integer(CODMUNRES), name = "obitos") |>
#   left_join(count(nasc, cod6 = as.integer(CODMUNRES), name = "nascidos"), by = "cod6") |>
#   mutate(tmi_bruta = 1000 * obitos / nascidos)
# Suavização bayesiana empírica (Marshall, 1991), por estado:
# tmi <- tmi |> mutate(uf = cod6 %/% 10000) |> group_by(uf) |>
#   mutate(r = obitos / nascidos, m = sum(obitos) / sum(nascidos),
#          s2 = pmax(sum(nascidos * (r - m)^2) / sum(nascidos) - m / mean(nascidos), 0),
#          tmi = 1000 * (m + s2 / (s2 + m / nascidos) * (r - m))) |> ungroup()
