# =============================================================================
# Conector: Portal de Dados Abertos do TSE
#   Catalogo (API CKAN): https://dadosabertos.tse.jus.br/api/3/action/...
#   Arquivos:            https://cdn.tse.jus.br/estatistica/sead/odsele/...
#
# O catalogo lista todos os conjuntos (candidatos, resultados, eleitorado,
# prestacao de contas...) e o endereco de cada arquivo. Os arquivos sao zips
# com um CSV por UF (separador ";", codificacao latin1).
# =============================================================================

TSE_CKAN <- "https://dadosabertos.tse.jus.br/api/3/action"

# Todos os conjuntos de dados e seus arquivos (um por linha)
tse_catalogo <- function(por_pagina = 500, pausa = 0.5) {
  inicio <- 0; total <- Inf; linhas <- list()
  while (inicio < total) {
    r <- http_json(paste0(TSE_CKAN, "/package_search"),
                   query = list(rows = por_pagina, start = inicio), simplificar = FALSE)
    if (!isTRUE(r$success)) stop("A API do TSE respondeu sem sucesso.")
    total <- r$result$count
    pacotes <- r$result$results
    if (length(pacotes) == 0) break
    for (p in pacotes) {
      for (rec in p$resources) {
        linhas[[length(linhas) + 1]] <- data.frame(
          conjunto      = p$name %||% "",
          titulo        = p$title %||% "",
          grupo         = paste(vapply(p$groups, function(g) g$title %||% "", ""), collapse = "; "),
          arquivo       = rec$name %||% "",
          formato       = rec$format %||% "",
          tamanho_bytes = suppressWarnings(as.numeric(rec$size %||% NA)),
          url           = rec$url %||% "",
          atualizado_em = rec$last_modified %||% (rec$created %||% "")
        )
      }
    }
    inicio <- inicio + length(pacotes)
    Sys.sleep(pausa)
  }
  do.call(rbind, linhas)
}

`%||%` <- function(a, b) if (is.null(a)) b else a

# Procura no catalogo por palavra-chave (ex.: "votacao_candidato_munzona")
tse_buscar <- function(catalogo, termo) {
  alvo <- paste(catalogo$conjunto, catalogo$titulo, catalogo$arquivo, catalogo$url)
  catalogo[grepl(termo, alvo, ignore.case = TRUE), ]
}

# Baixa um zip e devolve os caminhos dos CSVs extraidos
tse_baixar <- function(url, pasta = file.path(tempdir(), "tse")) {
  zip <- file.path(pasta, basename(url))
  http_baixar(url, zip)
  if (grepl("\\.zip$", zip, ignore.case = TRUE)) utils::unzip(zip, exdir = pasta) else zip
}

# Le um CSV do TSE no formato padrao
tse_ler_csv <- function(arquivo) {
  utils::read.csv2(arquivo, fileEncoding = "latin1", colClasses = "character",
                   check.names = FALSE)
}
