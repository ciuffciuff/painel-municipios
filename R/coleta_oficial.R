# =============================================================================
# Coleta direta nas fontes oficiais (versão institucional) + mortalidade infantil
#
# Este script baixa os dados do Painel de Municípios direto do IBGE (SIDRA),
# do DATASUS (SIM, SINASC e CNES) e do TSE, sem passar por repositórios de terceiros.
# Precisa de internet com acesso a apisidra.ibge.gov.br, ftp.datasus.gov.br e
# cdn.tse.jus.br. Rode no seu computador, no RStudio.
#
# Saída: dados/oficial/*.csv, um arquivo por fonte, todos com a coluna cod_ibge (7 dígitos).
# Depois, rode python/build_data.py com OFICIAL=1 (ou junte em R) para refazer o painel.
#
# Pacotes (instale uma vez):
#   install.packages(c("tidyverse", "sidrar", "remotes", "janitor"))
#   remotes::install_github("rfsaldanha/microdatasus")
# =============================================================================

# Arquivos grandes (o do TSE tem ~550 MB): o padrão do R desiste após 60 s
options(timeout = 3600)

library(tidyverse)
library(sidrar)
library(microdatasus)

dir.create("dados/oficial", recursive = TRUE, showWarnings = FALSE)
# Executa um bloco; se der erro, avisa e continua com o próximo
# (assim uma tabela com problema não impede as outras de serem salvas)
falhas <- character()
tentar <- function(nome, expr) {
  message("\n== ", nome, " ==")
  tryCatch(expr, error = function(e) {
    message("FALHOU: ", nome, " -> ", conditionMessage(e))
    falhas <<- c(falhas, paste0(nome, ": ", conditionMessage(e)))
  })
  invisible(NULL)
}

salvar <- function(df, nome) {
  write_csv(df, file.path("dados/oficial", paste0(nome, ".csv")))
  message("Salvo: ", nome, " (", nrow(df), " linhas)")
}

# -----------------------------------------------------------------------------
# 1. IBGE / SIDRA
#    Confira o número e as variáveis de cada tabela antes de rodar:
#    info_sidra(6579, wb = TRUE) abre a descrição no navegador.
# -----------------------------------------------------------------------------
sidra_mun <- function(tabela, periodo, variavel = "allxp", classif = NULL) {
  api <- paste0("/t/", tabela, "/n6/all/v/", variavel, "/p/", periodo, if (!is.null(classif)) paste0("/", classif))
  get_sidra(api = api) |>
    janitor::clean_names() |>
    transmute(cod_ibge = as.integer(municipio_codigo), variavel, valor)
}

# População estimada 2025 (tabela 6579)
tentar("IBGE população 2025", {
pop <- sidra_mun(6579, 2025) |> select(cod_ibge, pop2025 = valor)
salvar(pop, "ibge_populacao_2025")
})

# Rendimento domiciliar per capita médio, Censo 2022 (tabela 10295; confira a variável da média)
tentar("IBGE renda per capita 2022", {
renda <- sidra_mun(10295, 2022)
salvar(renda, "ibge_renda_pc_2022_bruto")   # filtre a variável de rendimento médio
})

# Alfabetização 15 anos ou mais, Censo 2022 (tabela 9542 — confirmar com info_sidra)
tentar("IBGE alfabetização 2022", {
alfab <- sidra_mun(9542, 2022)
salvar(alfab, "ibge_alfabetizacao_2022_bruto")
})

# Saneamento, Censo 2022: água, esgoto e lixo por domicílio.
# As tabelas do universo do Censo 2022 sobre características dos domicílios
# estão no SIDRA, grupo "Censo Demográfico 2022 – Características dos domicílios".
# Procure com search_sidra("esgotamento sanitário") e preencha os números abaixo.
# tab_agua <- ...; tab_esgoto <- ...; tab_lixo <- ...

# PIB dos Municípios 2023 (tabela 5938, variável 37 = PIB a preços correntes)
tentar("IBGE PIB 2023", {
pib <- sidra_mun(5938, 2023, variavel = "37") |> select(cod_ibge, pib_mil_reais = valor)
salvar(pib, "ibge_pib_2023")
})

# -----------------------------------------------------------------------------
# 2. Mortalidade infantil (SIM + SINASC, DATASUS)
#    Taxa = óbitos de menores de 1 ano ÷ nascidos vivos × 1.000, por município de residência.
#    Usamos a soma de 3 anos (2022–2024) porque, em municípios pequenos,
#    a taxa de um ano só oscila muito (poucos nascimentos).
# -----------------------------------------------------------------------------
anos <- 2022:2024

tentar("DATASUS mortalidade infantil", {
obitos_inf <- fetch_datasus(year_start = min(anos), year_end = max(anos),
                            information_system = "SIM-DOINF",
                            vars = c("CODMUNRES", "DTOBITO", "IDADE")) |>
  count(cod6 = as.integer(substr(CODMUNRES, 1, 6)), name = "obitos_inf")

nascidos <- map_dfr(anos, function(a) {
  fetch_datasus(year_start = a, year_end = a, information_system = "SINASC",
                vars = c("CODMUNRES")) |>
    count(cod6 = as.integer(substr(CODMUNRES, 1, 6)), name = "nascidos")
}) |> group_by(cod6) |> summarise(nascidos = sum(nascidos))

tmi <- nascidos |>
  left_join(obitos_inf, by = "cod6") |>
  mutate(obitos_inf = replace_na(obitos_inf, 0),
         tmi = 1000 * obitos_inf / nascidos)
# O DATASUS usa o código de 6 dígitos; o painel usa o de 7.
# A junção é feita pelo código de 6 dígitos (cod_ibge %/% 10).
salvar(tmi, "datasus_mortalidade_infantil_2022_2024")
})

# Atenção: SIM-DOINF já traz só óbitos de menores de 1 ano. O ano mais recente
# pode estar como "preliminar" no DATASUS; registre a data da coleta.
# Para corrigir sub-registro, o Ministério da Saúde publica fatores de correção
# por UF (busca ativa); sem eles, a taxa direta subestima no Norte e Nordeste.

# -----------------------------------------------------------------------------
# 3. CNES: estabelecimentos (UBS e hospitais) e equipes de Saúde da Família
# -----------------------------------------------------------------------------
tentar("CNES estabelecimentos", {
# O mês mais recente pode ainda não estar publicado: tenta out, set e ago/2026
cnes_mes <- function(sistema, ...) {
  for (m in 10:8) {
    d <- tryCatch(fetch_datasus(year_start = 2026, month_start = m, year_end = 2026,
                                month_end = m, information_system = sistema, ...),
                  error = function(e) NULL)
    if (!is.null(d) && nrow(d) > 0) { message(sistema, ": usando 2026-", m); return(d) }
  }
  stop("Nenhum mês de ago a out/2026 disponível para ", sistema)
}
cnes_st <- cnes_mes("CNES-ST", vars = c("CODUFMUN", "TP_UNID"))
# TP_UNID: 01 = posto de saúde, 02 = centro de saúde/UBS, 05 = hospital geral, 07 = hospital especializado
estab <- cnes_st |>
  mutate(cod6 = as.integer(CODUFMUN)) |>
  group_by(cod6) |>
  summarise(ubs = sum(TP_UNID %in% c("01", "02")), hospitais = sum(TP_UNID %in% c("05", "07")))
salvar(estab, "cnes_estabelecimentos_2026_10")
})

tentar("CNES equipes", {
cnes_ep <- cnes_mes("CNES-EP")
# Confira no dicionário do CNES-EP o código do tipo de equipe eSF (TIPO_EQP) e o campo de desativação.
salvar(cnes_ep |> count(CODUFMUN, TIPO_EQP), "cnes_equipes_2026_10_bruto")
})

# -----------------------------------------------------------------------------
# 4. TSE: votação para Presidente por município (2022 e 2026)
#    Arquivo oficial: votacao_candidato_munzona_<ano>.zip (um CSV por UF, separador ";",
#    codificação latin1). O TSE usa código de município próprio: a correspondência
#    com o IBGE está no arquivo de municípios do próprio TSE.
# -----------------------------------------------------------------------------
baixar_tse <- function(ano) {
  url <- sprintf("https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_%d.zip", ano)
  zip <- tempfile(fileext = ".zip"); download.file(url, zip, mode = "wb")
  arq <- unzip(zip, exdir = tempdir())
  arq <- arq[grepl("_BRASIL\\.csv$|_BR\\.csv$", arq)][1]
  read_csv2(arq, locale = locale(encoding = "latin1"), show_col_types = FALSE) |>
    filter(DS_CARGO == "Presidente") |>
    group_by(ano = ano, turno = NR_TURNO, cod_tse = CD_MUNICIPIO, municipio = NM_MUNICIPIO, uf = SG_UF, candidato = NM_URNA_CANDIDATO) |>
    summarise(votos = sum(QT_VOTOS_NOMINAIS), .groups = "drop")
}
tentar("TSE presidente", {
votos <- bind_rows(baixar_tse(2022), baixar_tse(2026))
salvar(votos, "tse_presidente_municipio_2022_2026")
})
# Confira: a soma nacional deve dar Lula 50,90% (2022, 2º turno) e 51,78% (2026, 2º turno).

# -----------------------------------------------------------------------------
# 5. INEP (IDEB 2025), MTE (RAIS 2024) e CGU (Bolsa Família)
#    - IDEB: planilha "divulgacao_anos_iniciais_municipios_2025.xlsx" em
#      gov.br/inep → Ideb → Resultados (download manual).
#    - RAIS: microdados no FTP do PDET (ftp.mtps.gov.br/pdet/microdados/RAIS) ou
#      basedosdados (tabela br_me_rais.microdados_vinculos).
#    - Bolsa Família: portaldatransparencia.gov.br/download-de-dados/novo-bolsa-familia
#      (um CSV por mês; agregue por código SIAFI e converta para IBGE).
# -----------------------------------------------------------------------------
writeLines(c(paste("Coleta em", Sys.time()), if (length(falhas)) paste("FALHA:", falhas) else "Todas as etapas OK"),
           "dados/oficial/LEIA-ME_coleta.txt")
message("Coleta concluída. Registre a data de hoje no FONTES.md: ", Sys.Date())
if (length(falhas)) message("Etapas com falha:\n", paste(falhas, collapse = "\n"))
