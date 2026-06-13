#!/usr/bin/env bash
# =============================================================================
#  MV Broker — atualizar o front na VPS
# -----------------------------------------------------------------------------
#  - Faz git pull do branch main
#  - Reconstrói a imagem Docker injetando as chaves do Supabase self-hosted
#    via --build-arg (Vite congela em build time)
#  - Aplica novas migrations SQL e recarrega schema do PostgREST
#  - Recria o container mvbroker-front (atrás do Traefik via app.yml)
#  - NUNCA sobrescreve .env nem mistura chaves com Lovable Cloud
#
#  Pré-requisito: /opt/mvbroker-infra/app-front/.env configurado
#    (use infra/app.env.example como referência)
#
#  Uso: bash /opt/mvbroker-infra/infra/update.sh
# =============================================================================
set -euo pipefail

REPO_DIR="/opt/mvbroker-infra"
ENV_FILE="$REPO_DIR/app-front/.env"
MIGRATIONS_DIR="$REPO_DIR/supabase/migrations"
APPLIED_FILE="$REPO_DIR/infra/app/.applied_migrations"
BRANCH="${BRANCH:-main}"
EXPECTED_SUPABASE_HOST="supabase.sistemamvbroker.com.br"

# ── 1. Valida .env ────────────────────────────────────────────────────────────
echo "▶ [1/6] Verificando $ENV_FILE"
if [ ! -f "$ENV_FILE" ]; then
  cat <<MSG >&2
✗ $ENV_FILE não existe.
  Crie-o a partir de: $REPO_DIR/infra/app.env.example
MSG
  exit 1
fi

set -a; source "$ENV_FILE"; set +a

: "${VITE_SUPABASE_URL:?VITE_SUPABASE_URL ausente em $ENV_FILE}"
: "${VITE_SUPABASE_PUBLISHABLE_KEY:?VITE_SUPABASE_PUBLISHABLE_KEY ausente em $ENV_FILE}"

case "$VITE_SUPABASE_URL" in
  *"$EXPECTED_SUPABASE_HOST"*) echo "   OK → $VITE_SUPABASE_URL" ;;
  *.supabase.co*)
    echo "✗ .env aponta para Lovable Cloud ($VITE_SUPABASE_URL). Deploy abortado." >&2
    echo "  Edite $ENV_FILE — use https://$EXPECTED_SUPABASE_HOST" >&2
    exit 1 ;;
  *)
    echo "✗ VITE_SUPABASE_URL inválido: '$VITE_SUPABASE_URL'" >&2; exit 1 ;;
esac

# ── 2. Git pull ───────────────────────────────────────────────────────────────
echo "▶ [2/6] git pull origin/$BRANCH"
cd "$REPO_DIR"
git fetch --all --prune
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "   sem mudanças remotas (HEAD=$(git rev-parse --short HEAD))"
else
  git reset --hard "origin/$BRANCH"
  echo "   atualizado → $(git rev-parse --short HEAD)"
fi

# ── 3. Migrations ─────────────────────────────────────────────────────────────
echo "▶ [3/6] Migrations"
touch "$APPLIED_FILE"
MIGRATED=0; ERRORS=0
for sql_file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  filename=$(basename "$sql_file")
  grep -qF "$filename" "$APPLIED_FILE" && continue
  result=$(docker exec -i supabase-db psql -U postgres -d postgres 2>&1 < "$sql_file")
  if [ $? -ne 0 ]; then
    echo "   ❌ ERRO: $filename — $(echo "$result" | tail -1)"
    ERRORS=$((ERRORS + 1))
  else
    echo "   ✅ $filename"
    echo "$filename" >> "$APPLIED_FILE"
    MIGRATED=$((MIGRATED + 1))
  fi
done
echo "   $MIGRATED aplicadas, $ERRORS erros"
if [ "$MIGRATED" -gt 0 ]; then
  docker kill --signal=SIGUSR1 supabase-rest
  echo "   PostgREST schema recarregado"
fi

# ── 4. Build Docker ───────────────────────────────────────────────────────────
echo "▶ [4/6] Build da imagem Docker"
docker build \
  -f "$REPO_DIR/infra/app/Dockerfile" \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
  --build-arg VITE_SUPABASE_PROJECT_ID="${VITE_SUPABASE_PROJECT_ID:-mvbroker}" \
  -t mvbroker-front:latest \
  "$REPO_DIR" 2>&1 | tail -6

# ── 5. Recria container ───────────────────────────────────────────────────────
echo "▶ [5/6] Recriando container mvbroker-front"
cd "$REPO_DIR/infra/app"
docker compose up -d --force-recreate

# ── 6. Health-check ───────────────────────────────────────────────────────────
echo "▶ [6/6] Health-check"
sleep 4
APP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://app.sistemamvbroker.com.br/ || echo "000")
LP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://sistemamvbroker.com.br/ || echo "000")

echo ""
if [ "$APP_STATUS" = "200" ] && [ "$LP_STATUS" = "200" ]; then
  echo "✅ Deploy concluído — commit $(git rev-parse --short HEAD)"
  echo "   https://app.sistemamvbroker.com.br  → HTTP $APP_STATUS"
  echo "   https://sistemamvbroker.com.br       → HTTP $LP_STATUS"
else
  echo "⚠️  Deploy feito mas health check falhou"
  echo "   app.sistemamvbroker.com.br  → HTTP $APP_STATUS"
  echo "   sistemamvbroker.com.br       → HTTP $LP_STATUS"
  echo "   Verifique: docker logs mvbroker-front"
  exit 1
fi
