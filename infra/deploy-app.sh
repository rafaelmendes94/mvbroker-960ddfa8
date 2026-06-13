#!/usr/bin/env bash
# infra/deploy-app.sh
# Deploy do frontend MV Broker na VPS self-hosted.
# Faz git pull, valida .env, aplica migrations, builda imagem Docker e recria container.
# Nunca sobrescreve .env — chaves da VPS nunca se misturam com Lovable Cloud.
#
# Pré-requisito: /opt/mvbroker-infra/app-front/.env configurado a partir de infra/app.env.example
# Uso: bash /opt/mvbroker-infra/infra/deploy-app.sh

set -euo pipefail

REPO_DIR="/opt/mvbroker-infra"
ENV_FILE="$REPO_DIR/app-front/.env"
MIGRATIONS_DIR="$REPO_DIR/supabase/migrations"
APPLIED_FILE="$REPO_DIR/infra/app/.applied_migrations"
BRANCH="${BRANCH:-main}"
EXPECTED_SUPABASE_HOST="supabase.sistemamvbroker.com.br"

cd "$REPO_DIR"

# ── 1. Protege .env do git pull ─────────────────────────────────────────────
echo "▶ [1/6] Protegendo .env contra git pull"
for f in .env .env.local .dev.vars; do
  [ -f "$f" ] && git update-index --skip-worktree "$f" 2>/dev/null || true
done

# ── 2. Git pull ──────────────────────────────────────────────────────────────
echo "▶ [2/6] git pull origin/$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git ls-remote origin "refs/heads/$BRANCH" | cut -f1)"
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "   sem mudanças remotas (HEAD=$LOCAL)"
else
  git pull origin "$BRANCH"
  echo "   atualizado para $(git rev-parse --short HEAD)"
fi

# ── 3. Valida que .env aponta pro Supabase self-hosted desta VPS ─────────────
echo "▶ [3/6] Validando .env"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE não existe."
  echo "   Crie a partir de: $REPO_DIR/infra/app.env.example"
  exit 1
fi
SUPA_URL="$(grep -E '^VITE_SUPABASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' || true)"
case "$SUPA_URL" in
  *"$EXPECTED_SUPABASE_HOST"*) echo "   OK → $SUPA_URL" ;;
  *.supabase.co*)
    echo "❌ .env aponta para Lovable Cloud ($SUPA_URL). Deploy abortado."
    echo "   Edite $ENV_FILE — use https://$EXPECTED_SUPABASE_HOST"
    exit 1 ;;
  *)
    echo "❌ VITE_SUPABASE_URL inválido ou ausente: '$SUPA_URL'"
    exit 1 ;;
esac
ANON_KEY="$(grep -E '^VITE_SUPABASE_PUBLISHABLE_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' || true)"
if [ -z "$ANON_KEY" ]; then
  echo "❌ VITE_SUPABASE_PUBLISHABLE_KEY ausente em $ENV_FILE"
  exit 1
fi

# ── 4. Migrations ────────────────────────────────────────────────────────────
echo "▶ [4/6] Migrations"
touch "$APPLIED_FILE"
MIGRATED=0; ERRORS=0
for sql_file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  filename=$(basename "$sql_file")
  if grep -qF "$filename" "$APPLIED_FILE"; then
    continue
  fi
  result=$(docker exec -i supabase-db psql -U postgres -d postgres 2>&1 < "$sql_file")
  if [ $? -ne 0 ]; then
    echo "   ❌ ERRO: $filename — ${result##*$'\n'}"
    ERRORS=$((ERRORS + 1))
  else
    echo "   ✅ $filename"
    echo "$filename" >> "$APPLIED_FILE"
    MIGRATED=$((MIGRATED + 1))
  fi
done
echo "   migrations: $MIGRATED aplicadas, $ERRORS erros"
if [ "$MIGRATED" -gt 0 ]; then
  docker kill --signal=SIGUSR1 supabase-rest
  echo "   PostgREST schema recarregado"
fi

# ── 5. Build Docker ──────────────────────────────────────────────────────────
echo "▶ [5/6] Build da imagem Docker"
docker build \
  -f "$REPO_DIR/infra/app/Dockerfile" \
  --build-arg VITE_SUPABASE_URL="$SUPA_URL" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" \
  -t mvbroker-front:latest \
  "$REPO_DIR" 2>&1 | tail -6

# ── 6. Recria container ──────────────────────────────────────────────────────
echo "▶ [6/6] Recriando container mvbroker-front"
cd "$REPO_DIR/infra/app"
docker compose up -d --force-recreate

# ── Health check ─────────────────────────────────────────────────────────────
sleep 3
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://app.sistemamvbroker.com.br/ || echo "000")
if [ "$STATUS" = "200" ]; then
  echo ""
  echo "✅ Deploy concluído — commit $(git -C "$REPO_DIR" rev-parse --short HEAD)"
  echo "   https://app.sistemamvbroker.com.br  → HTTP $STATUS"
  echo "   https://sistemamvbroker.com.br       → $(curl -s -o /dev/null -w "%{http_code}" https://sistemamvbroker.com.br/)"
else
  echo "⚠️  Deploy feito mas health check retornou HTTP $STATUS"
  echo "   Verifique: docker logs mvbroker-front"
  exit 1
fi
