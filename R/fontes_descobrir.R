# =============================================================================
# Descoberta: baixa os CATALOGOS de cada fonte oficial (o que existe, onde
# esta, tamanho e data) e salva em dados/fontes/<fonte>/.
# Nao baixa os dados em si; serve para saber exatamente o que pedir depois.
#
# Uso: Rscript R/fontes_descobrir.R "todas"
#      Rscript R/fontes_descobrir.R "transparencia,tse"
# Fontes: transparencia, datasus, tse, inep
# (A SIDRA/IBGE tem workflow proprio: sidra-descritores.yml)
# =============================================================================

for (f in list.files("R/conectores", pattern = "\\.R$", full.names = TRUE)) source(f)

entrada <- tolower(paste(commandArgs(trailingOnly = TRUE), collapse = " "))
todas   <- c("transparencia", "datasus", "tse", "inep")
fontes  <- if (!nzchar(trimws(entrada)) || grepl("todas", entrada)) todas else
             intersect(todas, trimws(strsplit(entrada, "[,; ]+")[[1]]))
if (length(fontes) == 0) stop("Fonte desconhecida. Use: ", paste(todas, collapse = ", "))
message("Fontes: ", paste(fontes, collapse = ", "))
base <- "dados/fontes"

# --- Portal da Transparencia: endpoints e parametros (sem chave) ---------------
if ("transparencia" %in% fontes) {
  message("\n== Portal da Transparencia ==")
  etapa("transparencia", "catalogo", {
    cat_t <- transp_catalogo()
    salvar_texto(cat_t$especificacao, file.path(base, "transparencia/openapi.json"))
    salvar_csv(cat_t$endpoints,  file.path(base, "transparencia/endpoints.csv"))
    salvar_csv(cat_t$parametros, file.path(base, "transparencia/parametros.csv"))
  })
}

# --- DATASUS: listagem das principais pastas do FTP ----------------------------
if ("datasus" %in% fontes) {
  message("\n== DATASUS ==")
  etapa("datasus", "catalogo_ftp", {
    salvar_csv(datasus_catalogo(), file.path(base, "datasus/arquivos_ftp.csv"))
  })
}

# --- TSE: catalogo CKAN completo ---------------------------------------------
if ("tse" %in% fontes) {
  message("\n== TSE ==")
  etapa("tse", "catalogo_ckan", {
    salvar_csv(tse_catalogo(), file.path(base, "tse/catalogo.csv"))
  })
}

# --- INEP: links das paginas oficiais + teste dos enderecos padronizados -----
if ("inep" %in% fontes) {
  message("\n== INEP ==")
  salvar_csv(INEP_BASES, file.path(base, "inep/bases_pda.csv"))
  etapa("inep", "links_paginas", {
    salvar_csv(inep_links(), file.path(base, "inep/links_paginas.csv"))
  })
  etapa("inep", "enderecos_padrao", {
    cand <- inep_candidatos()
    ver  <- http_verificar(cand$url)
    salvar_csv(merge(cand, ver, by = "url", sort = FALSE), file.path(base, "inep/enderecos_testados.csv"))
  })
}

message("\nConcluido. Veja dados/fontes/<fonte>/status.csv")
