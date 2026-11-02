# =============================================================================
# Funcoes comuns a todos os conectores (HTTP, gravacao de arquivos, registro)
#
# Pacotes: httr2, jsonlite, tibble
#   install.packages(c("httr2", "jsonlite", "tibble"))
# =============================================================================

AGENTE <- "conector-painel-municipios-R"

# -----------------------------------------------------------------------------
# Requisicao HTTP generica. Nunca para o script por erro HTTP: devolve o status
# e o texto para quem chamou decidir.
#   url      -> endereco
#   query    -> lista de parametros (?a=1&b=2)
#   headers  -> lista de cabecalhos (ex.: chave de API)
#   metodo   -> "GET" ou "HEAD"
# Retorna: list(status, texto, tipo, cabecalhos)
# -----------------------------------------------------------------------------
http_requisitar <- function(url, query = list(), headers = list(), metodo = "GET",
                            timeout = 60, tentativas = 3) {
  req <- httr2::request(url) |>
    httr2::req_user_agent(AGENTE) |>
    httr2::req_timeout(timeout) |>
    httr2::req_method(metodo) |>
    httr2::req_retry(
      max_tries   = tentativas,
      is_transient = function(resp) httr2::resp_status(resp) %in% c(429, 500, 502, 503, 504),
      backoff     = function(i) 2^i               # espera 2, 4, 8... segundos
    ) |>
    httr2::req_error(is_error = function(resp) FALSE)

  query <- query[!vapply(query, function(v) is.null(v) || (length(v) == 1 && is.na(v)), logical(1))]
  if (length(query)   > 0) req <- httr2::req_url_query(req, !!!query)
  if (length(headers) > 0) req <- httr2::req_headers(req, !!!headers)

  resp <- tryCatch(httr2::req_perform(req), error = function(e) e)
  if (inherits(resp, "error")) {
    return(list(status = NA_integer_, texto = conditionMessage(resp), tipo = NA_character_,
                cabecalhos = list()))
  }

  texto <- ""
  if (metodo != "HEAD" && httr2::resp_has_body(resp)) {
    texto <- httr2::resp_body_string(resp, encoding = "UTF-8")
    texto <- trimws(sub("^﻿", "", texto))  # remove BOM
  }
  list(
    status     = httr2::resp_status(resp),
    texto      = texto,
    tipo       = tryCatch(httr2::resp_content_type(resp), error = function(e) NA_character_),
    cabecalhos = httr2::resp_headers(resp)
  )
}

# Mesma coisa, mas exige JSON e ja converte. Para o script com mensagem clara.
http_json <- function(url, ..., simplificar = TRUE) {
  r <- http_requisitar(url, ...)
  if (is.na(r$status) || r$status >= 400) {
    stop(sprintf("HTTP %s em %s: %s", r$status, url, substr(r$texto, 1, 300)), call. = FALSE)
  }
  if (!grepl("^[\\{\\[]", r$texto)) {
    stop(sprintf("Resposta nao e JSON em %s: %s", url, substr(r$texto, 1, 300)), call. = FALSE)
  }
  jsonlite::fromJSON(r$texto, simplifyVector = simplificar, flatten = simplificar)
}

# Verifica se um arquivo existe no servidor sem baixa-lo (HEAD).
# Retorna data.frame: url, status, tamanho_bytes, modificado_em
http_verificar <- function(urls, pausa = 0.3) {
  linhas <- lapply(urls, function(u) {
    r <- http_requisitar(u, metodo = "HEAD", timeout = 30, tentativas = 2)
    # Alguns servidores nao aceitam HEAD; tenta GET pedindo so o 1o byte
    # (sem isso, baixaria arquivos de varios GB inteiros)
    if (!is.na(r$status) && r$status %in% c(403, 405, 501)) {
      r <- http_requisitar(u, headers = list(Range = "bytes=0-0"), timeout = 30, tentativas = 1)
      tam <- r$cabecalhos[["content-range"]]
      if (!is.null(tam)) r$cabecalhos[["content-length"]] <- sub(".*/", "", tam)
    }
    Sys.sleep(pausa)
    h <- r$cabecalhos
    data.frame(
      url           = u,
      status        = r$status,
      tamanho_bytes = if (!is.null(h[["content-length"]])) as.numeric(h[["content-length"]]) else NA_real_,
      modificado_em = if (!is.null(h[["last-modified"]])) h[["last-modified"]] else NA_character_,
      erro          = if (is.na(r$status)) substr(r$texto, 1, 200) else ""
    )
  })
  do.call(rbind, linhas)
}

# Baixa um arquivo para o disco (zip, csv, dbc...).
http_baixar <- function(url, destino, timeout = 3600, tentativas = 3) {
  dir.create(dirname(destino), recursive = TRUE, showWarnings = FALSE)
  if (grepl("^ftp://", url)) {
    curl::curl_download(url, destino, quiet = TRUE)
  } else {
    resp <- httr2::request(url) |>
      httr2::req_user_agent(AGENTE) |>
      httr2::req_timeout(timeout) |>
      httr2::req_retry(max_tries = tentativas) |>
      httr2::req_perform(path = destino)
  }
  invisible(destino)
}

# -----------------------------------------------------------------------------
# Gravacao
# -----------------------------------------------------------------------------
# Colunas que sao listas (JSON aninhado) viram texto JSON para caber no CSV.
achatar_listas <- function(df) {
  for (n in names(df)) {
    if (is.list(df[[n]])) {
      df[[n]] <- vapply(df[[n]], function(v) {
        if (is.null(v) || length(v) == 0) NA_character_
        else as.character(jsonlite::toJSON(v, auto_unbox = TRUE))
      }, character(1))
    }
  }
  df
}

salvar_csv <- function(df, caminho) {
  dir.create(dirname(caminho), recursive = TRUE, showWarnings = FALSE)
  df <- achatar_listas(as.data.frame(df))
  if (grepl("\\.gz$", caminho)) {
    con <- gzfile(caminho, "w", encoding = "UTF-8")
    on.exit(close(con))
    utils::write.csv(df, con, row.names = FALSE)
  } else {
    utils::write.csv(df, caminho, row.names = FALSE, fileEncoding = "UTF-8")
  }
  message("  salvo: ", caminho, " (", nrow(df), " linhas)")
  invisible(caminho)
}

salvar_texto <- function(texto, caminho) {
  dir.create(dirname(caminho), recursive = TRUE, showWarnings = FALSE)
  con <- if (grepl("\\.gz$", caminho)) gzfile(caminho, "w") else file(caminho, "w")
  on.exit(close(con))
  writeLines(texto, con, useBytes = TRUE)
  invisible(caminho)
}

# Registro do que deu certo/errado: dados/fontes/<fonte>/status.csv
registrar <- function(fonte, item, ok, mensagem = "") {
  caminho <- file.path("dados/fontes", fonte, "status.csv")
  dir.create(dirname(caminho), recursive = TRUE, showWarnings = FALSE)
  linha <- data.frame(
    item = item, ok = ok,
    mensagem = substr(gsub("[\r\n]+", " ", mensagem), 1, 300),
    em_utc = format(Sys.time(), "%Y-%m-%d %H:%M:%S", tz = "UTC")
  )
  anterior <- if (file.exists(caminho)) utils::read.csv(caminho, colClasses = "character") else NULL
  if (!is.null(anterior)) anterior <- anterior[anterior$item != item, , drop = FALSE]
  utils::write.csv(rbind(anterior, linha), caminho, row.names = FALSE, fileEncoding = "UTF-8")
  message(if (ok) "  OK   " else "  ERRO ", fonte, " / ", item, if (!ok) paste(":", mensagem) else "")
}

# Executa uma etapa e registra o resultado sem derrubar o script
etapa <- function(fonte, item, expr) {
  ok <- tryCatch({ force(expr); TRUE }, error = function(e) {
    registrar(fonte, item, FALSE, conditionMessage(e)); FALSE
  })
  if (ok) registrar(fonte, item, TRUE, "ok")
  invisible(ok)
}
