# =============================================================================
# Conector R para a API SIDRA/IBGE - Descritores de Tabela
# Endpoint: https://apisidra.ibge.gov.br/DescritoresTabela/t/<tabela>
#
# Pacotes necessarios (instale uma unica vez):
#   install.packages(c("httr2", "jsonlite", "tibble"))
#
# Requer R >= 4.1 (usa o pipe nativo |>)
# =============================================================================


# -----------------------------------------------------------------------------
# 1) Funcao principal: baixa os descritores de UMA tabela
# -----------------------------------------------------------------------------
# Argumentos:
#   tabela     -> numero da tabela SIDRA (ex.: 1612, "6579")
#   timeout    -> segundos maximos de espera pela resposta
#   tentativas -> quantas vezes tentar de novo se a API falhar temporariamente
#
# Retorna: uma lista (o JSON convertido para R), com os atributos
#          "tabela" e "url" guardados para referencia.
sidra_descritores <- function(tabela, timeout = 60, tentativas = 3) {

  # --- Validacao da entrada --------------------------------------------------
  tabela <- trimws(as.character(tabela))
  if (length(tabela) != 1 || is.na(tabela) || !grepl("^[0-9]+$", tabela)) {
    stop("'tabela' deve ser UM numero inteiro positivo, ex.: 1612")
  }

  url <- paste0("https://apisidra.ibge.gov.br/DescritoresTabela/t/", tabela)

  # --- Requisicao HTTP -------------------------------------------------------
  resp <- httr2::request(url) |>
    httr2::req_user_agent("conector-sidra-R") |>
    httr2::req_timeout(timeout) |>
    httr2::req_retry(max_tries = tentativas) |>          # repete em erros 429/503
    httr2::req_error(is_error = function(resp) FALSE) |> # tratamos o erro abaixo
    httr2::req_perform()

  status <- httr2::resp_status(resp)
  texto  <- httr2::resp_body_string(resp, encoding = "UTF-8")
  texto  <- trimws(sub("^﻿", "", texto))            # remove BOM, se houver

  if (status >= 400) {
    stop(sprintf("A API respondeu com erro HTTP %d para a tabela %s.\nResposta: %s",
                 status, tabela, substr(texto, 1, 300)))
  }

  # A SIDRA as vezes devolve uma mensagem de texto (nao JSON) quando a
  # tabela nao existe. Verificamos isso antes de converter.
  if (!grepl("^[\\{\\[]", texto)) {
    stop(sprintf("A API nao devolveu JSON para a tabela %s.\nResposta: %s",
                 tabela, substr(texto, 1, 300)))
  }

  # --- Conversao JSON -> R ---------------------------------------------------
  dados <- jsonlite::fromJSON(texto, simplifyVector = TRUE)

  attr(dados, "tabela") <- tabela
  attr(dados, "url")    <- url
  attr(dados, "json")   <- texto                        # JSON original
  class(dados) <- c("sidra_descritores", class(dados))
  dados
}


# -----------------------------------------------------------------------------
# 2) Impressao amigavel no console
# -----------------------------------------------------------------------------
print.sidra_descritores <- function(x, ...) {
  cat("Descritores da tabela SIDRA", attr(x, "tabela"), "\n")
  cat("URL:", attr(x, "url"), "\n\n")
  cat("Elementos retornados:\n")
  for (n in names(x)) {
    el <- x[[n]]
    tamanho <- if (is.data.frame(el)) {
      sprintf("data.frame %d x %d", nrow(el), ncol(el))
    } else if (is.list(el)) {
      sprintf("lista com %d itens", length(el))
    } else if (length(el) == 1) {
      paste0('"', substr(as.character(el), 1, 70), '"')
    } else {
      sprintf("vetor %s de tamanho %d", class(el)[1], length(el))
    }
    cat(" -", n, ":", tamanho, "\n")
  }
  cat("\nUse sidra_descritores_tabelas() para obter tudo em formato de tabela.\n")
  invisible(x)
}


# -----------------------------------------------------------------------------
# 3) Converte o resultado em uma lista de tibbles (tabelas "retangulares")
# -----------------------------------------------------------------------------
# Percorre o JSON inteiro. Cada bloco que for uma tabela vira um tibble.
# Tabelas aninhadas (ex.: categorias dentro de classificacoes) viram tibbles
# proprios, com colunas "pai_*" para ligar cada linha ao registro de origem.
# Valores soltos (ex.: nome da tabela) vao para o tibble "geral".
sidra_descritores_tabelas <- function(desc) {

  saida <- list()
  geral <- list()

  coletar <- function(x, nome) {

    if (is.data.frame(x)) {
      x <- jsonlite::flatten(x)                  # abre data.frames aninhados
      cols_lista <- names(x)[vapply(x, is.list, logical(1))]
      cols_pai   <- names(x)[vapply(x, is.atomic, logical(1)) &
                               grepl("^(id|codigo|nome)$", names(x),
                                     ignore.case = TRUE)]

      for (col in cols_lista) {
        filhos <- x[[col]]
        eh_tabela <- vapply(filhos, is.data.frame, logical(1))

        if (any(eh_tabela)) {
          # Coluna com tabelas dentro: vira uma tabela filha
          partes <- list()
          for (i in seq_along(filhos)) {
            f <- filhos[[i]]
            if (is.data.frame(f) && nrow(f) > 0) {
              f$.linha_pai <- i
              for (p in cols_pai) f[[paste0("pai_", p)]] <- x[[p]][i]
              partes[[length(partes) + 1]] <- f
            }
          }
          if (length(partes) > 0) {
            coletar(jsonlite::rbind_pages(partes), paste(nome, col, sep = "."))
          }
          x[[col]] <- NULL
        } else {
          # Coluna com vetores simples: junta os valores em um texto
          x[[col]] <- vapply(filhos, function(v) paste(unlist(v), collapse = "; "),
                             character(1))
        }
      }
      saida[[nome]] <<- tibble::as_tibble(x)

    } else if (is.list(x)) {
      nomes <- names(x)
      if (is.null(nomes)) nomes <- as.character(seq_along(x))
      for (k in seq_along(x)) {
        novo_nome <- if (nome == "") nomes[k] else paste(nome, nomes[k], sep = ".")
        coletar(x[[k]], novo_nome)
      }

    } else if (is.atomic(x) && length(x) == 1) {
      geral[[nome]] <<- x

    } else if (is.atomic(x) && length(x) > 1) {
      saida[[nome]] <<- tibble::tibble(valor = x)
    }
  }

  class(desc) <- setdiff(class(desc), "sidra_descritores")
  if (is.data.frame(desc)) coletar(desc, "dados") else coletar(desc, "")

  if (length(geral) > 0) {
    saida <- c(list(geral = tibble::as_tibble(geral)), saida)
  }
  saida
}


# -----------------------------------------------------------------------------
# 4) Varias tabelas de uma vez (continua mesmo se alguma falhar)
# -----------------------------------------------------------------------------
sidra_descritores_varias <- function(tabelas, pausa = 1, ...) {
  resultado <- list()
  for (t in tabelas) {
    resultado[[as.character(t)]] <- tryCatch(
      sidra_descritores(t, ...),
      error = function(e) {
        warning("Tabela ", t, ": ", conditionMessage(e), call. = FALSE)
        NULL
      }
    )
    Sys.sleep(pausa)   # gentileza com o servidor do IBGE
  }
  resultado
}




# -----------------------------------------------------------------------------
# 5) Catalogo de TODAS as tabelas SIDRA (API de agregados do IBGE)
# -----------------------------------------------------------------------------
# Retorna um data.frame com uma linha por tabela:
#   pesquisa_id, pesquisa, tabela, nome_tabela
sidra_catalogo <- function(timeout = 300, tentativas = 5) {
  url <- "https://servicodados.ibge.gov.br/api/v3/agregados"

  resp <- httr2::request(url) |>
    httr2::req_user_agent("conector-sidra-R") |>
    httr2::req_timeout(timeout) |>
    httr2::req_retry(max_tries = tentativas) |>
    httr2::req_error(is_error = function(resp) FALSE) |>
    httr2::req_perform()

  status <- httr2::resp_status(resp)
  texto  <- trimws(sub("^﻿", "", httr2::resp_body_string(resp, encoding = "UTF-8")))
  if (status >= 400 || !grepl("^[\\{\\[]", texto)) {
    stop(sprintf("Falha ao baixar o catalogo (HTTP %d): %s", status, substr(texto, 1, 300)))
  }

  pesq <- jsonlite::fromJSON(texto, simplifyVector = TRUE)
  linhas <- list()
  for (i in seq_len(nrow(pesq))) {
    ag <- pesq$agregados[[i]]
    if (is.data.frame(ag) && nrow(ag) > 0) {
      linhas[[length(linhas) + 1]] <- data.frame(
        pesquisa_id = as.character(pesq$id[i]),
        pesquisa    = pesq$nome[i],
        tabela      = as.character(ag$id),
        nome_tabela = ag$nome
      )
    }
  }
  catalogo <- do.call(rbind, linhas)
  catalogo[!duplicated(catalogo$tabela), ]
}
