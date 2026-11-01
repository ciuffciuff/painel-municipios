# =============================================================================
# Executa os pedidos de dados/fontes/transparencia/pedidos.csv na API do
# Portal da Transparencia e salva em dados/fontes/transparencia/resultados/.
#
# Precisa da chave na variavel de ambiente TRANSPARENCIA_CHAVE.
# Uso: Rscript R/transparencia_coletar.R            (todos os pedidos)
#      Rscript R/transparencia_coletar.R "emendas_2025,bpc_202608"
# =============================================================================

for (f in list.files("R/conectores", pattern = "\\.R$", full.names = TRUE)) source(f)

if (!nzchar(Sys.getenv("TRANSPARENCIA_CHAVE"))) {
  stop("Segredo TRANSPARENCIA_CHAVE nao configurado. Cadastre a chave em ",
       "portaldatransparencia.gov.br/api-de-dados/cadastrar-email e salve em ",
       "Settings > Secrets and variables > Actions do repositorio.")
}

# Garante o catalogo para validar endpoints e parametros
if (!file.exists("dados/fontes/transparencia/endpoints.csv")) {
  cat_t <- transp_catalogo()
  salvar_csv(cat_t$endpoints,  "dados/fontes/transparencia/endpoints.csv")
  salvar_csv(cat_t$parametros, "dados/fontes/transparencia/parametros.csv")
}

arquivo <- "dados/fontes/transparencia/pedidos.csv"
filtro  <- trimws(strsplit(paste(commandArgs(trailingOnly = TRUE), collapse = ","), ",")[[1]])
filtro  <- filtro[nzchar(filtro)]
if (length(filtro)) {
  ped <- utils::read.csv(arquivo, colClasses = "character")
  ped <- ped[ped$nome %in% filtro, ]
  if (nrow(ped) == 0) stop("Nenhum pedido com esses nomes em ", arquivo)
  arquivo <- tempfile(fileext = ".csv")
  utils::write.csv(ped, arquivo, row.names = FALSE)
}

transp_executar_pedidos(arquivo)
