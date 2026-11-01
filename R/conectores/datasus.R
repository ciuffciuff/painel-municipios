# =============================================================================
# Conector: FTP do DATASUS (ftp.datasus.gov.br)
#
# O DATASUS publica os microdados (SIM, SINASC, CNES, SIH, SIA...) em arquivos
# .dbc, um por UF e por ano ou mes. Este conector:
#   - lista o conteudo de pastas do FTP (nome, tamanho, data, endereco);
#   - baixa arquivos;
#   - le .dbc (requer o pacote read.dbc).
# Para baixar e ja ler varios anos/UFs de uma vez, o pacote microdatasus
# (usado em R/coleta_oficial.R) continua sendo o mais pratico.
#
# Pacotes: curl (e read.dbc para ler os arquivos)
# =============================================================================

DATASUS_FTP <- "ftp://ftp.datasus.gov.br"

# Pastas mais usadas (caminho relativo a /dissemin/publicos/)
DATASUS_PASTAS <- c(
  "SIM/CID10/DORES",          # obitos por residencia (DOUFAAAA.dbc)
  "SIM/CID10/DOFET",          # obitos fetais e infantis (DOINF, DOFET)
  "SIM/PRELIM/DORES",         # obitos preliminares
  "SINASC/1996_/Dados/DNRES", # nascidos vivos (DNUFAAAA.dbc)
  "SINASC/PRELIM/DNRES",      # nascidos vivos preliminares
  "CNES/200508_/Dados/ST",    # estabelecimentos (STUFAAMM.dbc)
  "CNES/200508_/Dados/EP",    # equipes de saude (EPUFAAMM.dbc)
  "CNES/200508_/Dados/LT",    # leitos
  "CNES/200508_/Dados/PF",    # profissionais
  "SIHSUS/200801_/Dados",     # internacoes hospitalares (RDUFAAMM.dbc)
  "SINAN/DADOS/FINAIS",       # agravos de notificacao
  "SINAN/DADOS/PRELIM"
)

# Converte a listagem do FTP (formato Unix ou Windows/IIS) em tabela
.datasus_ler_listagem <- function(linhas, pasta) {
  linhas <- linhas[nzchar(trimws(linhas))]
  saida <- lapply(linhas, function(l) {
    # Windows/IIS: "06-17-21  11:45AM       1234567 DOAC2019.dbc"  ou  "<DIR> nome"
    m <- regmatches(l, regexec("^(\\d{2}-\\d{2}-\\d{2,4})\\s+(\\d{1,2}:\\d{2}[AP]M)\\s+(<DIR>|\\d+)\\s+(.+)$", l))[[1]]
    if (length(m) == 5) {
      return(data.frame(nome = m[5], tipo = if (m[4] == "<DIR>") "pasta" else "arquivo",
                        tamanho_bytes = suppressWarnings(as.numeric(m[4])),
                        data = paste(m[2], m[3])))
    }
    # Unix: "-rw-r--r--   1 ftp ftp  1234567 Jun 17  2021 DOAC2019.dbc"
    p <- strsplit(trimws(l), "\\s+")[[1]]
    if (length(p) >= 9 && grepl("^[dl-]", p[1])) {
      return(data.frame(nome = paste(p[9:length(p)], collapse = " "),
                        tipo = if (substr(p[1], 1, 1) == "d") "pasta" else "arquivo",
                        tamanho_bytes = suppressWarnings(as.numeric(p[5])),
                        data = paste(p[6], p[7], p[8])))
    }
    # So o nome (listagem simples)
    data.frame(nome = trimws(l), tipo = NA_character_, tamanho_bytes = NA_real_, data = NA_character_)
  })
  d <- do.call(rbind, saida)
  if (is.null(d)) return(data.frame())
  d$pasta <- pasta
  d$url   <- paste0(DATASUS_FTP, "/dissemin/publicos/", pasta, "/", d$nome)
  d[, c("pasta", "nome", "tipo", "tamanho_bytes", "data", "url")]
}

# Lista uma pasta. pasta e relativa a /dissemin/publicos/ (ex.: "SIM/CID10/DORES")
datasus_listar <- function(pasta = "", timeout = 120) {
  url <- paste0(DATASUS_FTP, "/dissemin/publicos/", sub("/?$", "/", pasta))
  url <- sub("publicos//$", "publicos/", url)
  h <- curl::new_handle(connecttimeout = 30, timeout = timeout, ftp_use_epsv = FALSE)
  r <- curl::curl_fetch_memory(url, handle = h)
  if (r$status_code >= 400) stop("FTP respondeu ", r$status_code, " em ", url)
  linhas <- strsplit(rawToChar(r$content), "\r?\n")[[1]]
  .datasus_ler_listagem(linhas, sub("/$", "", pasta))
}

# Lista todas as pastas de DATASUS_PASTAS (e a raiz) num unico data.frame
datasus_catalogo <- function(pastas = DATASUS_PASTAS, pausa = 1) {
  partes <- list()
  for (p in c("", pastas)) {
    message("  listando /", p)
    d <- tryCatch(datasus_listar(p), error = function(e) {
      message("    falhou: ", conditionMessage(e)); NULL
    })
    if (!is.null(d) && nrow(d) > 0) partes[[length(partes) + 1]] <- d
    Sys.sleep(pausa)
  }
  if (length(partes) == 0) stop("Nenhuma pasta do FTP do DATASUS pode ser listada.")
  do.call(rbind, partes)
}

# Baixa um arquivo (url completa ou caminho relativo a /dissemin/publicos/)
datasus_baixar <- function(arquivo, destino = file.path(tempdir(), basename(arquivo))) {
  url <- if (grepl("^ftp://", arquivo)) arquivo else paste0(DATASUS_FTP, "/dissemin/publicos/", arquivo)
  http_baixar(url, destino)
}

# Le um .dbc (baixa antes, se for endereco)
datasus_ler_dbc <- function(arquivo) {
  if (!requireNamespace("read.dbc", quietly = TRUE)) {
    stop("Instale o pacote read.dbc: install.packages('read.dbc')")
  }
  if (grepl("^ftp://", arquivo) || !file.exists(arquivo)) arquivo <- datasus_baixar(arquivo)
  read.dbc::read.dbc(arquivo)
}
