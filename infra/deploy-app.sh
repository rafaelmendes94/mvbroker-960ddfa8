#!/usr/bin/env bash
# /var/www/mvbroker/infra/deploy-app.sh
# Atualiza SÓ o código a partir do GitHub. Nunca toca em .env nem mistura
# Lovable Cloud com o Supabase self-hosted desta VPS.
#
# Uso: bash /var/www/mvbroker/infra/deploy-app.sh

set -euo pipefail

APP_DIR="/var/www/mvbroker"
APP_NAME="mvbroker"
BRANCH="${BRANCH:-main}"
# Garante que o .env aponte pro Supabase desta VPS:
EXPECTED_SUPABASE_HOST="supabase.sistemamvbroker.com.br"

cd "$APP_DIR"

echo "▶ [1/7] Backup do .env (chaves NUNCA são sobrescritas)"
STAMP="$(date +%Y%m%d_%H%M%S)"
BKP_DIR="/tmp/mvbroker-env-$STAMP"
mkdir -p "$BKP_DIR"
for f in .env .env.local .dev.vars; do
  if [ -f "$f" ]; then
    cp -p "$f" "$BKP_DIR/$f"
    git update-index --skip-worktree "$f" 2>/dev/null || true
  fi
done

echo "▶ [2/7] git fetch origin/$BRANCH"
git fetch --all --prune
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/$BRANCH)"

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "   sem mudanças remotas (HEAD=$LOCAL), seguindo só com build/restart"
  SKIP_PULL=1
else
  echo "   $LOCAL → $REMOTE"
  SKIP_PULL=0
fi

git stash push -u -m "deploy-$STAMP" 2>/dev/null || true
[ "$SKIP_PULL" = "0" ] && git reset --hard "origin/$BRANCH"

echo "▶ [3/7] Restaurando .env da VPS"
for f in .env .env.local .dev.vars; do
  if [ -f "$BKP_DIR/$f" ]; then
    cp -p "$BKP_DIR/$f" "$f"
    git update-index --skip-worktree "$f" 2>/dev/null || true
  fi
done

echo "▶ [4/7] Validando que .env NÃO aponta pro Lovable Cloud"
if [ ! -f .env ]; then
  echo "❌ .env não existe em $APP_DIR. Crie a partir de infra/app.env.example."
  exit 1
fi
URL="$(grep -E '^VITE_SUPABASE_URL=' .env | tail -1 | cut -d= -f2- | tr -d '\"' || true)"
case "$URL" in
  *"$EXPECTED_SUPABASE_HOST"*) echo "   OK → $URL" ;;
  *.supabase.co*)
    echo "❌ .env aponta para Lovable Cloud ($URL). Deploy abortado."
    echo "   Edite /var/www/mvbroker/.env e use https://$EXPECTED_SUPABASE_HOST"
    exit 1 ;;
  *)
    echo "❌ VITE_SUPABASE_URL inválido ou ausente: '$URL'"
    echo "   Esperado conter: $EXPECTED_SUPABASE_HOST"
    exit 1 ;;
esac

echo "▶ [5/7] Dependências"
if [ "$SKIP_PULL" = "0" ] && git diff --name-only "$LOCAL" "$REMOTE" | grep -qE '^(package\.json|package-lock\.json|bun\.lockb)$'; then
  echo "   package.json mudou → npm install"
  npm install --no-audit --no-fund
else
  echo "   sem mudanças, pulando install"
fi

echo "▶ [6/7] Build (carrega .env desta VPS)"
set -a; . ./.env; set +a
npm run build

echo "▶ [7/7] PM2 restart"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
fi
PORT="${PORT:-3000}" HOST="${HOST:-0.0.0.0}" pm2 start .output/server/index.mjs \
  --name "$APP_NAME" --update-env --time
pm2 save

echo ""
echo "✅ Deploy concluído em $(date)"
echo "   Commit: $(git rev-parse --short HEAD)"
curl -sI "https://app.sistemamvbroker.com.br/" | head -1 || true
