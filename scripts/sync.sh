#!/usr/bin/env bash
# =========================================================
#  MV Broker — sincronização de trabalho em dois lugares
#  (Lovable  <->  GitHub  <->  máquina local / VPS)
#
#  Uso:
#    ./scripts/sync.sh pull      # traz o que foi feito no Lovable
#    ./scripts/sync.sh push "msg" # envia o que você fez por fora
#    ./scripts/sync.sh status    # mostra diferenças
# =========================================================
set -euo pipefail

BRANCH="${BRANCH:-main}"
cd "$(dirname "$0")/.."

# Nunca deixe o .env local ser sobrescrito ou enviado
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "⚠️  .env está rastreado pelo git. Removendo do índice (o arquivo local é mantido)..."
  git rm --cached .env >/dev/null
  git commit -m "chore: remove .env do versionamento" >/dev/null || true
fi

cmd="${1:-status}"

case "$cmd" in
  pull)
    echo "→ Buscando alterações do GitHub (feitas no Lovable ou por outros)..."
    git fetch origin "$BRANCH"
    git pull --rebase origin "$BRANCH"
    echo "✅ Atualizado. Rode 'bun install' se package.json mudou."
    ;;
  push)
    msg="${2:-chore: alterações locais}"
    echo "→ Enviando alterações locais..."
    git add -A
    git commit -m "$msg" || echo "(nada novo para commitar)"
    git fetch origin "$BRANCH"
    git pull --rebase origin "$BRANCH"
    git push origin "HEAD:$BRANCH"
    echo "✅ Enviado. O Lovable sincroniza automaticamente em alguns segundos."
    ;;
  status)
    git fetch origin "$BRANCH" >/dev/null 2>&1 || true
    echo "── Alterações locais ──"; git status --short
    echo "── Commits só no GitHub (Lovable) ──"; git log --oneline "HEAD..origin/$BRANCH" || true
    echo "── Commits só aqui ──"; git log --oneline "origin/$BRANCH..HEAD" || true
    ;;
  *)
    echo "Uso: ./scripts/sync.sh [pull|push \"mensagem\"|status]"; exit 1
    ;;
esac
