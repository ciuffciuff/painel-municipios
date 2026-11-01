# =============================================================================
# Conector: dados abertos do INEP (download.inep.gov.br)
#
# O INEP nao tem API: publica arquivos (zip, xlsx) nas paginas de "Dados
# abertos" do gov.br. O Plano de Dados Abertos do INEP 2025-2027 (Quadro 1)
# lista as bases publicas; INEP_BASES abaixo segue esse inventario.
#
# O conector:
#   1. le as paginas oficiais e extrai todos os links de download (inep_links);
#   2. testa os enderecos padronizados por ano (inep_candidatos + http_verificar);
#   3. baixa os arquivos (inep_baixar).
# =============================================================================

INEP_GOVBR <- "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos"
INEP_DL    <- "https://download.inep.gov.br"

# Bases publicas do inventario do PDA Inep 2025-2027 e paginas onde aparecem
INEP_BASES <- data.frame(
  base = c(
    "Microdados do Censo Escolar da Educacao Basica",
    "Indicadores Educacionais da Educacao Basica",
    "Microdados do Censo da Educacao Superior",
    "Indicadores de Qualidade da Educacao Superior",
    "Microdados do Enade",
    "Microdados do IDD",
    "Microdados do Encceja",
    "Microdados do Enem",
    "Microdados do Enem por Escola",
    "Microdados do Saeb",
    "Microdados da ANA",
    "Ideb (resultados)",
    "Sinopses Estatisticas"
  ),
  pagina = c(
    "/microdados/censo-escolar",
    "/indicadores-educacionais",
    "/microdados/censo-da-educacao-superior",
    "/indicadores-educacionais",
    "/microdados/enade",
    "/microdados/idd",
    "/microdados/encceja",
    "/microdados/enem",
    "/microdados/enem-por-escola",
    "/microdados/saeb",
    "/microdados/ana",
    "/microdados/ideb",
    "/sinopses-estatisticas"
  ),
  # Padrao do endereco do arquivo; {ano} e trocado pelo ano. NA = sem padrao fixo.
  padrao = c(
    "/dados_abertos/microdados_censo_escolar_{ano}.zip",
    NA,
    "/microdados/microdados_censo_da_educacao_superior_{ano}.zip",
    NA,
    "/microdados/microdados_enade_{ano}.zip",
    NA,
    "/microdados/microdados_encceja_{ano}.zip",
    "/microdados/microdados_enem_{ano}.zip",
    NA,
    "/microdados/microdados_saeb_{ano}.zip",
    NA,
    "/ideb/resultados/divulgacao_anos_iniciais_municipios_{ano}.zip",
    NA
  ),
  stringsAsFactors = FALSE
)

# Extrai links de download de uma lista de paginas do gov.br
inep_links <- function(paginas = unique(c("/microdados", INEP_BASES$pagina)), pausa = 1) {
  saida <- list()
  for (p in paginas) {
    url <- paste0(INEP_GOVBR, p)
    r <- http_requisitar(url, timeout = 60)
    if (is.na(r$status) || r$status >= 400) {
      message("  pagina indisponivel (", r$status, "): ", url); next
    }
    links <- regmatches(r$texto, gregexpr("https?://download\\.inep\\.gov\\.br/[^\"'<> ]+", r$texto))[[1]]
    links <- unique(gsub("&amp;", "&", links))
    if (length(links)) saida[[length(saida) + 1]] <- data.frame(pagina = url, url = links)
    Sys.sleep(pausa)
  }
  if (length(saida) == 0) return(data.frame(pagina = character(), url = character()))
  d <- do.call(rbind, saida)
  d$arquivo <- basename(d$url)
  d$ano     <- regmatches(d$arquivo, regexpr("(19|20)\\d{2}", d$arquivo))[seq_len(nrow(d))]
  d[!duplicated(d$url), ]
}

# Enderecos esperados pelo padrao, para os anos pedidos
inep_candidatos <- function(anos = 2015:as.integer(format(Sys.Date(), "%Y"))) {
  b <- INEP_BASES[!is.na(INEP_BASES$padrao), ]
  d <- do.call(rbind, lapply(seq_len(nrow(b)), function(i) {
    data.frame(base = b$base[i], ano = anos,
               url = paste0(INEP_DL, vapply(anos, function(a) gsub("{ano}", a, b$padrao[i], fixed = TRUE), "")))
  }))
  # Ideb: alem dos anos iniciais, anos finais e ensino medio
  ideb <- d[grepl("anos_iniciais", d$url), ]
  extra <- rbind(transform(ideb, url = sub("anos_iniciais", "anos_finais", url)),
                 transform(ideb, url = sub("anos_iniciais", "ensino_medio", url)))
  d <- rbind(d, extra)
  # Ideb so existe em anos impares
  d[!(grepl("/ideb/", d$url) & d$ano %% 2 == 0), ]
}

inep_baixar <- function(url, pasta = file.path(tempdir(), "inep")) {
  destino <- file.path(pasta, basename(url))
  http_baixar(url, destino)
  if (grepl("\\.zip$", destino, ignore.case = TRUE)) utils::unzip(destino, exdir = pasta) else destino
}
