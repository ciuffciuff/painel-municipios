# =============================================================================
# Conector: API de Dados do Portal da Transparencia (CGU)
# Documentacao: https://api.portaldatransparencia.gov.br/swagger-ui/index.html
#
# A API exige uma chave gratuita (cadastro com conta gov.br):
#   https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email
# A chave vai no cabecalho "chave-api-dados". Aqui ela e lida da variavel de
# ambiente TRANSPARENCIA_CHAVE (no GitHub: Settings > Secrets > Actions).
# NUNCA escreva a chave dentro do codigo.
#
# Limite de uso informado pela CGU: cerca de 90 requisicoes/minuto durante o
# dia (mais de madrugada). Por isso ha uma pausa entre as chamadas.
# =============================================================================

TRANSP_BASE <- "https://api.portaldatransparencia.gov.br"

# -----------------------------------------------------------------------------
# Catalogo de endpoints, lido da especificacao OpenAPI (nao precisa de chave)
# Retorna list(endpoints = data.frame, parametros = data.frame, especificacao = texto)
# -----------------------------------------------------------------------------
transp_catalogo <- function() {
  candidatos <- paste0(TRANSP_BASE, c("/v3/api-docs", "/v2/api-docs", "/api-de-dados/v3/api-docs"))
  texto <- NULL
  for (u in candidatos) {
    r <- http_requisitar(u)
    if (!is.na(r$status) && r$status < 400 && grepl("^\\{", r$texto)) { texto <- r$texto; break }
  }
  if (is.null(texto)) stop("Nao encontrei a especificacao OpenAPI em: ", paste(candidatos, collapse = ", "))

  esp <- jsonlite::fromJSON(texto, simplifyVector = FALSE)
  ends <- list(); pars <- list()
  for (caminho in names(esp$paths)) {
    for (metodo in names(esp$paths[[caminho]])) {
      op <- esp$paths[[caminho]][[metodo]]
      if (!is.list(op) || is.null(op$responses)) next
      ps <- op$parameters
      nomes <- vapply(ps, function(p) p$name %||% "", character(1))
      obrig <- vapply(ps, function(p) isTRUE(p$required), logical(1))
      ends[[length(ends) + 1]] <- data.frame(
        caminho      = caminho,
        metodo       = toupper(metodo),
        grupo        = paste(unlist(op$tags), collapse = "; "),
        resumo       = op$summary %||% "",
        parametros   = paste(nomes, collapse = ", "),
        obrigatorios = paste(nomes[obrig], collapse = ", "),
        paginado     = "pagina" %in% nomes
      )
      for (p in ps) {
        pars[[length(pars) + 1]] <- data.frame(
          caminho     = caminho,
          parametro   = p$name %||% "",
          local       = p$`in` %||% "",
          obrigatorio = isTRUE(p$required),
          tipo        = (p$schema$type %||% p$type) %||% "",
          formato     = (p$schema$format %||% p$format) %||% "",
          descricao   = gsub("[\r\n]+", " ", p$description %||% "")
        )
      }
    }
  }
  list(endpoints = do.call(rbind, ends), parametros = do.call(rbind, pars), especificacao = texto)
}

`%||%` <- function(a, b) if (is.null(a)) b else a

# Carrega o catalogo salvo pelo workflow (se existir) para validar parametros
.transp_endpoints <- function() {
  f <- "dados/fontes/transparencia/endpoints.csv"
  if (file.exists(f)) utils::read.csv(f, stringsAsFactors = FALSE) else NULL
}

# -----------------------------------------------------------------------------
# Consulta generica a QUALQUER endpoint, com paginacao automatica
#   caminho      -> ex.: "/api-de-dados/emendas" (ou so "emendas")
#   ...          -> parametros da consulta, ex.: ano = 2025
#   max_paginas  -> limite de seguranca
# Retorna: data.frame com todas as paginas juntas
# -----------------------------------------------------------------------------
transp_get <- function(caminho, ..., chave = Sys.getenv("TRANSPARENCIA_CHAVE"),
                       max_paginas = 1000, pausa = 0.7) {
  if (!nzchar(chave)) {
    stop("Chave da API ausente. Defina TRANSPARENCIA_CHAVE (cadastro em ",
         "portaldatransparencia.gov.br/api-de-dados/cadastrar-email).", call. = FALSE)
  }
  if (!grepl("^/", caminho)) caminho <- paste0("/api-de-dados/", caminho)
  params <- list(...)

  # Validacao contra o catalogo oficial, quando disponivel
  cat_ends <- .transp_endpoints()
  paginado <- TRUE
  if (!is.null(cat_ends)) {
    linha <- cat_ends[cat_ends$caminho == caminho & cat_ends$metodo == "GET", ]
    if (nrow(linha) == 0) {
      stop("Endpoint nao existe no catalogo: ", caminho,
           ". Veja dados/fontes/transparencia/endpoints.csv", call. = FALSE)
    }
    validos <- trimws(strsplit(linha$parametros[1], ",")[[1]])
    obrig   <- setdiff(trimws(strsplit(linha$obrigatorios[1], ",")[[1]]), c("", "pagina"))
    desconhecidos <- setdiff(names(params), validos)
    faltando      <- setdiff(obrig, names(params))
    if (length(desconhecidos)) stop("Parametro(s) inexistente(s) em ", caminho, ": ",
                                    paste(desconhecidos, collapse = ", "),
                                    ". Validos: ", linha$parametros[1], call. = FALSE)
    if (length(faltando)) stop("Parametro(s) obrigatorio(s) faltando em ", caminho, ": ",
                               paste(faltando, collapse = ", "), call. = FALSE)
    paginado <- isTRUE(as.logical(linha$paginado[1]))
  }

  url <- paste0(TRANSP_BASE, caminho)
  paginas <- list()
  for (p in seq_len(if (paginado) max_paginas else 1)) {
    q <- if (paginado) c(params, list(pagina = p)) else params
    r <- http_requisitar(url, query = q, headers = list(`chave-api-dados` = chave,
                                                         Accept = "application/json"))
    if (is.na(r$status) || r$status >= 400) {
      stop(sprintf("HTTP %s em %s (pagina %d): %s", r$status, caminho, p,
                   substr(r$texto, 1, 300)), call. = FALSE)
    }
    if (!nzchar(r$texto) || r$texto %in% c("[]", "{}")) break
    d <- jsonlite::fromJSON(r$texto, simplifyVector = TRUE, flatten = TRUE)
    if (is.data.frame(d)) {
      if (nrow(d) == 0) break
    } else if (is.list(d) && length(d) > 0) {
      d <- as.data.frame(achatar_listas(tibble::as_tibble(lapply(d, function(v) if (length(v) == 1) v else list(v)))))
    } else break
    paginas[[length(paginas) + 1]] <- d
    Sys.sleep(pausa)
  }
  if (length(paginas) == 0) return(data.frame())
  jsonlite::rbind_pages(paginas)
}

# -----------------------------------------------------------------------------
# Atalhos para os temas pedidos. Os nomes dos parametros sao conferidos com o
# catalogo oficial (endpoints.csv) toda vez que transp_get roda; se a CGU mudar
# algo, a mensagem de erro mostra os parametros validos.
# -----------------------------------------------------------------------------

# Transferencias de programas sociais por municipio (mesAno = "AAAAMM")
transp_bolsa_familia_municipio <- function(mesAno, codigoIbge, ...)
  transp_get("/api-de-dados/novo-bolsa-familia-por-municipio", mesAno = mesAno, codigoIbge = codigoIbge, ...)

transp_bpc_municipio <- function(mesAno, codigoIbge, ...)
  transp_get("/api-de-dados/bpc-por-municipio", mesAno = mesAno, codigoIbge = codigoIbge, ...)

# Emendas parlamentares (filtros opcionais: nomeAutor, codigoFuncao, ...)
transp_emendas <- function(ano, ...)
  transp_get("/api-de-dados/emendas", ano = ano, ...)

# Despesas por orgao (ex.: orgaoSuperior = "26000" = Ministerio da Educacao)
transp_despesas_orgao <- function(ano, ...)
  transp_get("/api-de-dados/despesas/por-orgao", ano = ano, ...)

# -----------------------------------------------------------------------------
# Executa uma lista de pedidos (arquivo CSV) - usado pelo GitHub Actions
# Colunas do CSV: nome, caminho, parametros, por_municipio
#   parametros    -> estilo URL: "ano=2025&codigoFuncao=10"
#   por_municipio -> TRUE para repetir a consulta para cada um dos 5.570
#                    municipios (o codigo vai no parametro informado em
#                    param_municipio, padrao "codigoIbge")
# -----------------------------------------------------------------------------
transp_executar_pedidos <- function(arquivo = "dados/fontes/transparencia/pedidos.csv",
                                    saida = "dados/fontes/transparencia/resultados",
                                    municipios = "dados/municipios.csv") {
  ped <- utils::read.csv(arquivo, stringsAsFactors = FALSE, colClasses = "character")
  ped <- ped[nzchar(trimws(ped$nome)) & !grepl("^#", ped$nome), ]
  for (i in seq_len(nrow(ped))) {
    nome <- ped$nome[i]
    message("Pedido: ", nome)
    etapa("transparencia", nome, {
      pares  <- strsplit(strsplit(ped$parametros[i], "&", fixed = TRUE)[[1]], "=", fixed = TRUE)
      params <- stats::setNames(lapply(pares, function(p) utils::URLdecode(p[2])),
                                vapply(pares, `[`, "", 1))
      params <- params[nzchar(names(params))]

      if (isTRUE(as.logical(ped$por_municipio[i]))) {
        campo <- if ("param_municipio" %in% names(ped) && nzchar(ped$param_municipio[i]))
                   ped$param_municipio[i] else "codigoIbge"
        cods  <- utils::read.csv(municipios, colClasses = "character")$cod
        partes <- list()
        for (k in seq_along(cods)) {
          a <- c(list(ped$caminho[i]), params, stats::setNames(list(cods[k]), campo))
          d <- do.call(transp_get, a)
          if (nrow(d) > 0) partes[[length(partes) + 1]] <- d
          if (k %% 500 == 0) message("  ", k, " de ", length(cods), " municipios")
        }
        d <- if (length(partes)) jsonlite::rbind_pages(partes) else data.frame()
      } else {
        d <- do.call(transp_get, c(list(ped$caminho[i]), params))
      }
      salvar_csv(d, file.path(saida, paste0(nome, ".csv.gz")))
    })
  }
}
