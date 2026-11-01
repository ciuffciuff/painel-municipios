# =============================================================================
# Coleta os descritores de tabelas SIDRA e salva em dados/sidra/
#
# Uso (a partir da raiz do repositorio):
#   Rscript R/sidra_coletar_descritores.R "1612,6579"     # tabelas especificas
#   Rscript R/sidra_coletar_descritores.R "todas"         # catalogo inteiro
#   Rscript R/sidra_coletar_descritores.R "todas forcar"  # refaz tudo do zero
#   Rscript R/sidra_coletar_descritores.R                 # usa dados/sidra/tabelas.txt
#
# No modo "todas", tabelas ja tentadas antes (ver status.csv) sao puladas,
# entao a coleta pode ser feita em varias execucoes ate terminar.
#
# Saidas:
#   dados/sidra/catalogo.csv                    -> todas as tabelas do IBGE
#   dados/sidra/descritores/<tabela>.json.gz    -> resposta original (compactada)
#   dados/sidra/consolidado/<bloco>.csv.gz      -> cada bloco, todas as tabelas
#                                                 juntas, com a coluna "tabela"
#   dados/sidra/status.csv                      -> resultado de cada tabela
#   dados/sidra/pendentes.txt                   -> quantas faltam (modo "todas")
#
# Dica: no R, read.csv("dados/sidra/consolidado/geral.csv.gz") le direto.
# =============================================================================

source("R/sidra_descritores.R")

inicio  <- Sys.time()
limite  <- as.numeric(Sys.getenv("LIMITE_MINUTOS", "300"))   # tempo maximo
pausa   <- as.numeric(Sys.getenv("PAUSA_SEGUNDOS", "0.5"))   # entre requisicoes
base    <- "dados/sidra"
p_json  <- file.path(base, "descritores")
p_cons  <- file.path(base, "consolidado")
p_stat  <- file.path(base, "status.csv")
dir.create(p_json, recursive = TRUE, showWarnings = FALSE)
dir.create(p_cons, recursive = TRUE, showWarnings = FALSE)

# --- Le a entrada --------------------------------------------------------------
entrada <- paste(commandArgs(trailingOnly = TRUE), collapse = " ")
if (nchar(trimws(entrada)) == 0) {
  linhas  <- readLines(file.path(base, "tabelas.txt"), warn = FALSE, encoding = "UTF-8")
  entrada <- paste(sub("#.*$", "", linhas), collapse = " ")
}
entrada     <- tolower(entrada)
modo_todas  <- grepl("todas", entrada)
modo_forcar <- grepl("forcar", entrada)

status <- if (file.exists(p_stat) && !modo_forcar) {
  utils::read.csv(p_stat, colClasses = "character", encoding = "UTF-8")
} else {
  data.frame(tabela = character(), ok = character(), mensagem = character(),
             coletado_em_utc = character())
}

if (modo_todas) {
  cat("Baixando catalogo de tabelas do IBGE...\n")
  catalogo <- tryCatch(sidra_catalogo(), error = function(e) {
    cat("Catalogo indisponivel:", conditionMessage(e), "\n"); NULL
  })
  if (!is.null(catalogo)) {
    utils::write.csv(catalogo, file.path(base, "catalogo.csv"),
                     row.names = FALSE, fileEncoding = "UTF-8")
    tabelas <- catalogo$tabela
  } else {
    # Sem catalogo (servicodados.ibge.gov.br nao responde aos servidores do
    # GitHub): testa todos os numeros de 1 ate SIDRA_MAX_TABELA direto no
    # apisidra. Numeros sem tabela ficam no status.csv como erro.
    maximo  <- as.integer(Sys.getenv("SIDRA_MAX_TABELA", "10500"))
    tabelas <- as.character(seq_len(maximo))
    cat("Usando a faixa 1 a", maximo, "\n")
  }
  cat("Catalogo:", length(tabelas), "tabelas\n")
  tabelas <- setdiff(tabelas, status$tabela)        # pula as ja tentadas
} else {
  tabelas <- unique(regmatches(entrada, gregexpr("[0-9]+", entrada))[[1]])
}
if (length(tabelas) == 0) cat("Nada novo a coletar.\n")
cat("A coletar nesta execucao:", length(tabelas), "\n\n")

salvar_status <- function() {
  utils::write.csv(status, p_stat, row.names = FALSE, fileEncoding = "UTF-8")
}

# --- Coleta --------------------------------------------------------------------
feitas <- character()
for (t in tabelas) {
  minutos <- as.numeric(difftime(Sys.time(), inicio, units = "mins"))
  if (minutos > limite) {
    cat("\nLimite de", limite, "minutos atingido; o restante fica para a proxima execucao.\n")
    break
  }

  resultado <- tryCatch({
    d   <- sidra_descritores(t)
    con <- gzfile(file.path(p_json, paste0(t, ".json.gz")), "w")
    writeLines(attr(d, "json"), con, useBytes = TRUE)
    close(con)
    list(ok = TRUE, msg = "ok")
  }, error = function(e) list(ok = FALSE, msg = conditionMessage(e)))

  cat(t, if (resultado$ok) "ok" else paste("ERRO:", substr(resultado$msg, 1, 120)), "\n")
  status <- status[status$tabela != t, ]
  status <- rbind(status, data.frame(
    tabela = t, ok = as.character(resultado$ok),
    mensagem = substr(gsub("[\r\n]+", " ", resultado$msg), 1, 300),
    coletado_em_utc = format(Sys.time(), "%Y-%m-%d %H:%M:%S", tz = "UTC")
  ))
  feitas <- c(feitas, t)
  if (length(feitas) %% 100 == 0) salvar_status()  # salva o progresso
  Sys.sleep(pausa)
}
salvar_status()

pendentes <- if (modo_todas) length(setdiff(tabelas, feitas)) else 0
writeLines(as.character(pendentes), file.path(base, "pendentes.txt"))
cat("\nColetadas agora:", length(feitas), "| Pendentes:", pendentes, "\n")

# --- Consolida todos os JSON em tabelas unicas por bloco ------------------------
cat("\nConsolidando...\n")
arquivos <- list.files(p_json, pattern = "\\.json\\.gz$", full.names = TRUE)
blocos   <- list()
for (f in arquivos) {
  t <- sub("\\.json\\.gz$", "", basename(f))
  r <- tryCatch({
    con   <- gzfile(f, "r", encoding = "UTF-8")
    texto <- paste(readLines(con, warn = FALSE), collapse = "\n")
    close(con)
    sidra_descritores_tabelas(jsonlite::fromJSON(texto, simplifyVector = TRUE))
  }, error = function(e) { cat("  falha ao ler", t, ":", conditionMessage(e), "\n"); NULL })

  for (n in names(r)) {
    df <- as.data.frame(lapply(r[[n]], as.character), check.names = FALSE,
                        stringsAsFactors = FALSE)
    df <- cbind(tabela = rep(t, nrow(df)), df)
    if (is.null(blocos[[n]])) blocos[[n]] <- list()
    blocos[[n]][[length(blocos[[n]]) + 1]] <- df
  }
}

unlink(list.files(p_cons, full.names = TRUE))
for (n in names(blocos)) {
  df  <- jsonlite::rbind_pages(blocos[[n]])
  nom <- gsub("[^A-Za-z0-9_.-]+", "_", sub("^\\.+", "", n))
  if (nom == "") nom <- "dados"
  con <- gzfile(file.path(p_cons, paste0(nom, ".csv.gz")), "w", encoding = "UTF-8")
  utils::write.csv(df, con, row.names = FALSE)
  close(con)
  cat(" ", nom, ":", nrow(df), "linhas\n")
}

if (length(feitas) > 0 && !any(status$ok[status$tabela %in% feitas] == "TRUE")) {
  quit(status = 1)   # nenhuma tabela deu certo: marca falha no Actions
}
