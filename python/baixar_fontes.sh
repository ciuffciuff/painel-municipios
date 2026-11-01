#!/usr/bin/env bash
# Baixa os repositórios públicos que redistribuem os dados oficiais usados no painel.
# Uso: bash python/baixar_fontes.sh   (cria a pasta fontes/ na raiz do projeto)
set -euo pipefail
mkdir -p fontes && cd fontes
for r in \
  Osodnil/tcc-fea-usp-gasto-publico-educacao-saeb-ideb \
  pedropaulofernandes88-stack/saude-brasil-insights \
  fabiodiehl0402/aps-cnes-ine \
  zxcortes/Saneamento-censo-2022-Analise_de_Dados \
  TreferDG/analise-bolsa-familia \
  DanielNego/projeto-bi-pib-municipios \
  rafapolo/rais \
  JeffAirData/brasil-eleicoes-para-presidente-2022-2026; do
  d=${r#*/}
  [ -d "$d" ] || git clone --depth 1 "https://github.com/$r.git" "$d"
done
