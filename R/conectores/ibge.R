# =============================================================================
# Conector: API de Servico de Dados do IBGE (servicodados.ibge.gov.br)
# Arquivo enviado por Cesar (ibge_api.R), incorporado sem alteracoes de logica.
# Usado por R/fontes_descobrir.R (fonte "ibge").
# =============================================================================

# =============================================================================
# ibge_api.R — Funções em R para a API de Serviço de Dados do IBGE
# Documentação oficial: https://servicodados.ibge.gov.br/api/docs/
#
# Como usar:
#   1. Instale os pacotes (só na primeira vez):
#        install.packages(c("httr2", "jsonlite"))
#   2. Carregue este arquivo:
#        source("ibge_api.R")
#   3. Chame as funções (exemplos no final do arquivo).
#
# APIs cobertas:
#   Localidades (v1) · Agregados/SIDRA (v3) · Nomes (v2) · Notícias (v3)
#   Calendário (v3) · Países (v1) · Pesquisas (v1) · Projeções (v1)
#   CNAE (v2) · Malhas geográficas (v3)
#   + ibge_get(), que acessa QUALQUER endpoint da documentação.
# =============================================================================

library(httr2)
library(jsonlite)

IBGE_URL_BASE <- "https://servicodados.ibge.gov.br/api"


# -----------------------------------------------------------------------------
# 0. Função base — todas as outras usam esta
# -----------------------------------------------------------------------------
#' Faz uma requisição GET à API do IBGE e devolve o resultado.
#'
#' @param caminho   Parte da URL depois da versão. Ex.: "localidades/estados"
#' @param versao    Versão da API: "v1", "v2", "v3"...
#' @param query     Lista com os parâmetros da URL (?chave=valor). NULL é ignorado.
#' @param simplificar TRUE = tenta virar data.frame; FALSE = lista "crua".
#' @param como_texto TRUE = devolve o texto bruto (útil para GeoJSON/SVG).
ibge_get <- function(caminho, versao = "v1", query = list(),
                     simplificar = TRUE, como_texto = FALSE) {

  req <- request(IBGE_URL_BASE) |>
    req_url_path_append(versao, caminho) |>
    req_url_query(!!!query) |>
    req_user_agent("ibge_api.R (R/httr2)") |>
    req_retry(max_tries = 3) |>          # tenta de novo se a API falhar
    req_timeout(60)

  resp <- req_perform(req)
  texto <- resp_body_string(resp, encoding = "UTF-8")

  if (como_texto) return(texto)
  if (!nzchar(texto)) return(NULL)

  fromJSON(texto, simplifyVector = simplificar, flatten = simplificar)
}

# Auxiliar: junta vetores com "|" (padrão do IBGE para vários itens)
.junta <- function(x) if (is.null(x)) NULL else paste(x, collapse = "|")

# Auxiliar: datas no formato que Notícias/Calendário exigem (MM-DD-AAAA)
.data_ibge <- function(x) {
  if (is.null(x)) return(NULL)
  format(as.Date(x), "%m-%d-%Y")
}


# -----------------------------------------------------------------------------
# 1. LOCALIDADES (v1) — regiões, UFs, municípios, distritos...
# -----------------------------------------------------------------------------
#' @param nivel "regioes", "estados", "mesorregioes", "microrregioes",
#'   "regioes-intermediarias", "regioes-imediatas", "municipios",
#'   "distritos", "subdistritos"
#' @param id    Código(s) ou sigla(s). Ex.: "DF", 53, c(33, 35)
#' @param nivelado TRUE = colunas "achatadas" (view=nivelado), mais fácil de ler
ibge_localidades <- function(nivel = "estados", id = NULL,
                             ordenar = "nome", nivelado = FALSE) {
  caminho <- paste(c("localidades", nivel, .junta(id)), collapse = "/")
  ibge_get(caminho, "v1",
           query = list(orderBy = ordenar,
                        view = if (nivelado) "nivelado" else NULL))
}

#' Municípios de uma ou mais UFs. Ex.: ibge_municipios_uf("DF")
ibge_municipios_uf <- function(uf, nivelado = FALSE) {
  caminho <- paste0("localidades/estados/", .junta(uf), "/municipios")
  ibge_get(caminho, "v1",
           query = list(orderBy = "nome",
                        view = if (nivelado) "nivelado" else NULL))
}


# -----------------------------------------------------------------------------
# 2. AGREGADOS (v3) — tabelas do SIDRA (Censo, PNAD, PIB, IPCA...)
# -----------------------------------------------------------------------------
#' Lista/procura tabelas. Ex.: ibge_agregados_lista(periodicidade = "P5")
#' @param periodicidade "P1" anual, "P5" mensal, "P8" trimestral...
#' @param nivel nível territorial, ex.: "N6" (município)
ibge_agregados_lista <- function(assunto = NULL, periodicidade = NULL,
                                 nivel = NULL) {
  ibge_get("agregados", "v3",
           query = list(assunto = assunto, periodicidade = periodicidade,
                        nivel = nivel))
}

#' Metadados de uma tabela (variáveis, classificações, níveis territoriais)
ibge_agregados_metadados <- function(agregado) {
  ibge_get(paste0("agregados/", agregado, "/metadados"), "v3",
           simplificar = FALSE)
}

#' Períodos disponíveis de uma tabela
ibge_agregados_periodos <- function(agregado) {
  ibge_get(paste0("agregados/", agregado, "/periodos"), "v3")
}

#' Localidades disponíveis numa tabela para um nível. Ex.: nivel = "N3"
ibge_agregados_localidades <- function(agregado, nivel = "N3") {
  ibge_get(paste0("agregados/", agregado, "/localidades/", .junta(nivel)), "v3")
}

#' Valores de uma tabela, já em formato data.frame "longo".
#'
#' @param agregado  Número da tabela SIDRA. Ex.: 6579 (estimativa populacional)
#' @param periodos  "-6" = últimos 6; "2022"; c(2021, 2022); "all"
#' @param variaveis Código(s) da variável; "allxp" = todas exceto percentuais
#' @param localidades Ex.: "N1[all]" (Brasil), "N3[all]" (UFs),
#'   "N6[5300108]" (Brasília), "N6[N3[53]]" (municípios do DF)
#' @param classificacao Ex.: "2[4,5]" (sexo: homens e mulheres). Opcional.
ibge_agregados_valores <- function(agregado, periodos = "-6",
                                   variaveis = "allxp",
                                   localidades = "N1[all]",
                                   classificacao = NULL) {
  caminho <- sprintf("agregados/%s/periodos/%s/variaveis/%s",
                     agregado, .junta(periodos), .junta(variaveis))
  bruto <- ibge_get(caminho, "v3",
                    query = list(localidades = .junta(localidades),
                                 classificacao = .junta(classificacao)),
                    simplificar = FALSE)
  .achatar_agregados(bruto)
}

# Transforma a resposta aninhada do SIDRA numa tabela simples
.achatar_agregados <- function(bruto) {
  linhas <- list()
  for (v in bruto) {
    for (r in v$resultados) {
      # texto das categorias de classificação (ex.: "Sexo: Homens")
      classif <- vapply(r$classificacoes, function(cl) {
        paste0(cl$nome, ": ", paste(unlist(cl$categoria), collapse = ", "))
      }, character(1))
      classif <- if (length(classif)) paste(classif, collapse = " | ") else NA

      for (s in r$series) {
        valores <- unlist(s$serie)
        if (!length(valores)) next
        linhas[[length(linhas) + 1]] <- data.frame(
          variavel_id     = v$id,
          variavel        = v$variavel,
          unidade         = v$unidade,
          classificacao   = classif,
          nivel           = s$localidade$nivel$id,
          localidade_id   = s$localidade$id,
          localidade      = s$localidade$nome,
          periodo         = names(valores),
          valor_texto     = unname(valores),
          # "-", "..", "X" etc. viram NA
          valor           = suppressWarnings(as.numeric(unname(valores))),
          stringsAsFactors = FALSE
        )
      }
    }
  }
  if (!length(linhas)) return(data.frame())
  do.call(rbind, linhas)
}


# -----------------------------------------------------------------------------
# 3. NOMES (v2) — frequência de nomes nos Censos
# -----------------------------------------------------------------------------
#' Frequência por década. Ex.: ibge_nomes(c("maria", "joao"))
#' @param sexo "M" ou "F" (opcional)
#' @param localidade código IBGE (UF ou município). Opcional.
#' @param por_uf TRUE = total por UF (groupBy=UF)
ibge_nomes <- function(nomes, sexo = NULL, localidade = NULL, por_uf = FALSE) {
  caminho <- paste0("censos/nomes/", .junta(tolower(nomes)))
  bruto <- ibge_get(caminho, "v2",
                    query = list(sexo = sexo, localidade = localidade,
                                 groupBy = if (por_uf) "UF" else NULL),
                    simplificar = FALSE)
  if (por_uf) return(fromJSON(toJSON(bruto, auto_unbox = TRUE), flatten = TRUE))
  .achatar_res(bruto, chave = "nome")
}

#' Ranking dos nomes mais comuns. Ex.: ibge_nomes_ranking(decada = 1980)
ibge_nomes_ranking <- function(decada = NULL, sexo = NULL, localidade = NULL) {
  bruto <- ibge_get("censos/nomes/ranking", "v2",
                    query = list(decada = decada, sexo = sexo,
                                 localidade = localidade),
                    simplificar = FALSE)
  .achatar_res(bruto, chave = NULL)
}

# A API de nomes devolve [{..., res: [...]}]; aqui vira uma tabela única
.achatar_res <- function(bruto, chave) {
  partes <- lapply(bruto, function(item) {
    res <- fromJSON(toJSON(item$res, auto_unbox = TRUE))
    if (!length(res)) return(NULL)
    if (!is.null(chave)) res[[chave]] <- item[[chave]]
    res$localidade <- if (is.null(item$localidade)) NA else item$localidade
    res$sexo <- if (is.null(item$sexo)) NA else item$sexo
    res
  })
  do.call(rbind, Filter(Negate(is.null), partes))
}


# -----------------------------------------------------------------------------
# 4. NOTÍCIAS (v3) — Agência de Notícias do IBGE
# -----------------------------------------------------------------------------
#' Ex.: ibge_noticias(busca = "desemprego", qtd = 20)
#' @param tipo "noticia" ou "release"
#' @param de, ate datas (ex.: "2026-10-01" ou Sys.Date())
ibge_noticias <- function(busca = NULL, tipo = NULL, qtd = 10, pagina = 1,
                          de = NULL, ate = NULL) {
  ibge_get("noticias", "v3",
           query = list(busca = busca, tipo = tipo, qtd = qtd, page = pagina,
                        de = .data_ibge(de), ate = .data_ibge(ate)))
}


# -----------------------------------------------------------------------------
# 5. CALENDÁRIO (v3) — datas de divulgação
# -----------------------------------------------------------------------------
#' Ex.: ibge_calendario(qtd = 20)  ou  ibge_calendario(produto = 9173)
ibge_calendario <- function(produto = NULL, qtd = 10, de = NULL, ate = NULL) {
  caminho <- paste(c("calendario", produto), collapse = "/")
  ibge_get(caminho, "v3",
           query = list(qtd = qtd, de = .data_ibge(de), ate = .data_ibge(ate)))
}


# -----------------------------------------------------------------------------
# 6. PAÍSES (v1) — dados internacionais
# -----------------------------------------------------------------------------
#' Ex.: ibge_paises("BR") ; ibge_paises(c("BR", "AR"))
#' Códigos: ISO-ALPHA-2 ("BR") ou M49. Sem código = todos os países.
ibge_paises <- function(paises = NULL) {
  ibge_get(paste(c("paises", .junta(paises)), collapse = "/"), "v1",
           simplificar = FALSE)
}

#' Lista de indicadores disponíveis para países
ibge_paises_lista_indicadores <- function() {
  ibge_get("paises/indicadores", "v1")
}

#' Valores de indicadores. Ex.: ibge_paises_indicadores("BR", 77827)
ibge_paises_indicadores <- function(paises, indicadores) {
  caminho <- sprintf("paises/%s/indicadores/%s",
                     .junta(paises), .junta(indicadores))
  ibge_get(caminho, "v1", simplificar = FALSE)
}


# -----------------------------------------------------------------------------
# 7. PESQUISAS (v1) — indicadores usados no portal Cidades@
# -----------------------------------------------------------------------------
#' Lista as pesquisas
ibge_pesquisas <- function() ibge_get("pesquisas", "v1")

#' Indicadores de uma pesquisa
ibge_pesquisas_indicadores <- function(pesquisa) {
  ibge_get(paste0("pesquisas/", pesquisa, "/indicadores"), "v1",
           simplificar = FALSE)
}

#' Resultados de indicador(es) para localidade(s).
#' Ex.: ibge_pesquisas_resultados(indicadores = 29171, localidades = 5300108)
ibge_pesquisas_resultados <- function(indicadores, localidades) {
  caminho <- sprintf("pesquisas/indicadores/%s/resultados/%s",
                     .junta(indicadores), .junta(localidades))
  ibge_get(caminho, "v1", simplificar = FALSE)
}


# -----------------------------------------------------------------------------
# 8. PROJEÇÕES (v1) — projeção da população em tempo real
# -----------------------------------------------------------------------------
#' Sem localidade = Brasil. Ex.: ibge_projecao_populacao(53) (DF)
ibge_projecao_populacao <- function(localidade = NULL) {
  ibge_get(paste(c("projecoes/populacao", localidade), collapse = "/"), "v1",
           simplificar = FALSE)
}


# -----------------------------------------------------------------------------
# 9. CNAE (v2) — classificação de atividades econômicas
# -----------------------------------------------------------------------------
#' @param nivel "secoes", "divisoes", "grupos", "classes", "subclasses"
#' @param id    código (opcional). Ex.: ibge_cnae("classes", "62015")
ibge_cnae <- function(nivel = "secoes", id = NULL) {
  ibge_get(paste(c("cnae", nivel, .junta(id)), collapse = "/"), "v2")
}


# -----------------------------------------------------------------------------
# 10. MALHAS GEOGRÁFICAS (v3) — mapas em GeoJSON
# -----------------------------------------------------------------------------
#' Devolve o GeoJSON como texto. Para virar mapa use o pacote sf:
#'   mapa <- sf::read_sf(ibge_malhas("estados", "DF", divisao = "municipio"))
#'
#' @param tipo  "paises", "regioes", "estados", "municipios" ...
#' @param id    Ex.: "BR", "DF", 5300108
#' @param divisao subdivisões internas: "UF", "regiao", "mesorregiao",
#'   "microrregiao", "regiao-intermediaria", "regiao-imediata", "municipio"
#' @param qualidade "minima", "intermediaria" ou "maxima"
ibge_malhas <- function(tipo = "paises", id = "BR", divisao = NULL,
                        qualidade = "minima") {
  ibge_get(paste("malhas", tipo, .junta(id), sep = "/"), "v3",
           query = list(formato = "application/vnd.geo+json",
                        intrarregiao = divisao, qualidade = qualidade),
           como_texto = TRUE)
}


# =============================================================================
# EXEMPLOS — selecione e rode linha a linha (Ctrl+Enter no RStudio)
# =============================================================================
if (FALSE) {

  # Localidades
  ufs <- ibge_localidades("estados")
  df_mun <- ibge_municipios_uf("DF", nivelado = TRUE)
  brasilia <- ibge_localidades("municipios", 5300108)

  # SIDRA: população estimada (tabela 6579) por UF, últimos 3 anos
  pop <- ibge_agregados_valores(6579, periodos = "-3",
                                variaveis = 9324, localidades = "N3[all]")
  head(pop)

  # SIDRA: IPCA (tabela 1737), variação mensal (var. 63), Brasil, últimos 12
  ipca <- ibge_agregados_valores(1737, periodos = "-12", variaveis = 63)

  # Descobrir variáveis de uma tabela antes de consultar
  meta <- ibge_agregados_metadados(6579)
  str(meta$variaveis)

  # Nomes
  ibge_nomes(c("maria", "joao"))
  ibge_nomes_ranking(decada = 1980, sexo = "F")

  # Notícias e calendário
  ibge_noticias(busca = "PNAD", qtd = 5)
  ibge_calendario(qtd = 5)

  # Países, CNAE, projeção
  ibge_paises("BR")
  ibge_cnae("secoes")
  ibge_projecao_populacao()

  # Mapa do DF (precisa do pacote sf)
  # install.packages("sf")
  mapa <- sf::read_sf(ibge_malhas("estados", "DF"))
  plot(sf::st_geometry(mapa))

  # Qualquer outro endpoint da documentação:
  ibge_get("localidades/regioes-imediatas", "v1")
}
