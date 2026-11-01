# =============================================================================
# Coleta os descritores de tabelas SIDRA e salva em dados/sidra/descritores/
#
# Uso (a partir da raiz do repositorio):
#   Rscript R/sidra_coletar_descritores.R "1612,6579,9514"
#   Rscript R/sidra_coletar_descritores.R          # usa dados/sidra/tabelas.txt
#
# Para cada tabela gera:
#   dados/sidra/descritores/<tabela>.json          -> resposta original da API
#   dados/sidra/descritores/<tabela>/<bloco>.csv   -> cada bloco em formato tabela
# E um resumo da execucao em dados/sidra/status.csv
# =============================================================================

source("R/sidra_descritores.R")

# --- Quais tabelas baixar ----------------------------------------------------
args <- paste(commandArgs(trailingOnly = TRUE), collapse = " ")
if (nchar(trimws(args)) == 0) {
  linhas <- readLines("dados/sidra/tabelas.txt", warn = FALSE, encoding = "UTF-8")
  linhas <- sub("#.*$", "", linhas)                   # ignora comentarios
  args   <- paste(linhas, collapse = " ")
}
tabelas <- unique(regmatches(args, gregexpr("[0-9]+", args))[[1]])
if (length(tabelas) == 0) stop("Nenhuma tabela informada.")
cat("Tabelas:", paste(tabelas, collapse = ", "), "\n\n")

pasta <- "dados/sidra/descritores"
dir.create(pasta, recursive = TRUE, showWarnings = FALSE)

nome_arquivo <- function(x) {
  x <- gsub("^\\.+", "", x)
  x <- gsub("[^A-Za-z0-9_.-]+", "_", x)
  if (x == "") "dados" else x
}

# --- Coleta ------------------------------------------------------------------
status <- data.frame()
for (t in tabelas) {
  cat("Tabela", t, "... ")
  resultado <- tryCatch({
    d <- sidra_descritores(t)
    writeLines(attr(d, "json"), file.path(pasta, paste0(t, ".json")), useBytes = TRUE)

    pasta_t <- file.path(pasta, t)
    unlink(pasta_t, recursive = TRUE)                # remove CSVs antigos
    dir.create(pasta_t, showWarnings = FALSE)
    tabs <- sidra_descritores_tabelas(d)
    for (n in names(tabs)) {
      utils::write.csv(tabs[[n]], file.path(pasta_t, paste0(nome_arquivo(n), ".csv")),
                       row.names = FALSE, fileEncoding = "UTF-8")
    }
    list(ok = TRUE, msg = paste(length(tabs), "blocos:", paste(names(tabs), collapse = ", ")))
  }, error = function(e) list(ok = FALSE, msg = conditionMessage(e)))

  cat(if (resultado$ok) "ok\n" else "ERRO\n", "  ", resultado$msg, "\n", sep = "")
  status <- rbind(status, data.frame(
    tabela   = t,
    ok       = resultado$ok,
    mensagem = gsub("[\r\n]+", " ", resultado$msg),
    coletado_em_utc = format(Sys.time(), "%Y-%m-%d %H:%M:%S", tz = "UTC")
  ))
  Sys.sleep(1)                                        # gentileza com o IBGE
}

utils::write.csv(status, "dados/sidra/status.csv", row.names = FALSE, fileEncoding = "UTF-8")

if (!any(status$ok)) {
  quit(status = 1)   # marca a execucao como falha no GitHub Actions
}
