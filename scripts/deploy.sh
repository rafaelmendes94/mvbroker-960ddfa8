#!/usr/bin/env bash
# /var/www/mvbroker/scripts/deploy.sh
# Atualiza o app a partir do GitHub sem tocar em .env, node_modules cache, nem keys.
# Uso: bash /var/www/mvbroker/scripts/deploy.sh

set -euo pipefail

APP_DIR="/var/www/mvbroker"
APP_NAME="mvbroker"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo "▶ [1/6] Protegendo .env e arquivos sensíveis"
# Garante que envs da VPS nunca sejam sobrescritas pelo Git/Lovable.
# Importante: `git reset --hard` pode trocar arquivo rastreado; por isso fazemos
# backup ANTES e restauramos DEPOIS do reset.
ENV_BACKUP_DIR="/tmp/mvbroker-env-backup-$(date +%s)"
mkdir -p "$ENV_BACKUP_DIR"
for env_file in .env .env.local .dev.vars; do
  if [ -f "$env_file" ]; then
    cp -p "$env_file" "$ENV_BACKUP_DIR/$env_file"
    cp -p "$env_file" "$env_file.backup.$(date +%Y%m%d_%H%M%S)"
    git update-index --skip-worktree "$env_file" 2>/dev/null || true
  fi
done

echo "▶ [2/6] Buscando atualizações do GitHub (branch: $BRANCH)"
git fetch --all --prune
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

SKIP_PULL=0
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "ℹ️  Working tree já está em $LOCAL — pulando git reset, mas seguindo com build."
  SKIP_PULL=1
else
  echo "   Local : $LOCAL"
  echo "   Remoto: $REMOTE"
fi

# Stash qualquer alteração local (não deveria ter, mas garante)
git stash push -u -m "deploy-autostash-$(date +%s)" 2>/dev/null || true

if [ "$SKIP_PULL" = "0" ]; then
  echo "▶ [3/6] Aplicando pull"
  git reset --hard "origin/$BRANCH"
else
  echo "▶ [3/6] Pulando reset (sem mudanças remotas)"
fi

echo "▶ [3.1/6] Restaurando envs locais da VPS"
for env_file in .env .env.local .dev.vars; do
  if [ -f "$ENV_BACKUP_DIR/$env_file" ]; then
    cp -p "$ENV_BACKUP_DIR/$env_file" "$env_file"
    git update-index --skip-worktree "$env_file" 2>/dev/null || true
  fi
done

if [ -n "${EXPECTED_SUPABASE_URL:-}" ]; then
  CURRENT_SUPABASE_URL="$(grep -E '^VITE_SUPABASE_URL=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\"' || true)"
  if [ "$CURRENT_SUPABASE_URL" != "$EXPECTED_SUPABASE_URL" ]; then
    echo "❌ .env não aponta para $EXPECTED_SUPABASE_URL. Build cancelado."
    echo "   Para ignorar essa checagem, rode sem EXPECTED_SUPABASE_URL definido."
    exit 1
  fi
fi


echo "▶ [4/6] Verificando dependências (só instala se package.json/lock mudou)"
if [ "$SKIP_PULL" = "1" ]; then
  CHANGED_FILES=""
else
  CHANGED_FILES=$(git diff --name-only "$LOCAL" "$REMOTE")
fi
if echo "$CHANGED_FILES" | grep -qE '^(package\.json|package-lock\.json|bun\.lockb)$'; then
  echo "   Mudanças em dependências detectadas → npm install"
  npm install --no-audit --no-fund
else
  echo "   Sem mudanças em dependências, pulando install"
fi

echo "▶ [5/6] Migrations: ignorado (banco gerenciado pelo Lovable Cloud)"
# O app aponta para o Supabase do Lovable Cloud (VITE_SUPABASE_URL no .env).
# As migrations já são aplicadas lá automaticamente quando aprovadas no chat.
# Não rodar contra o Postgres local do Docker (supabase-db) — está vazio e quebra.

echo "▶ [6/6] Build + restart PM2"
# Carrega .env para o ambiente atual para que tanto o `npm run build` (Vite SSR)
# quanto o PM2 (runtime Node/SSR) enxerguem SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY
# do Supabase auto-hospedado na VPS. Nunca cai para Lovable Cloud.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
npm run build

# Garante que o PM2 está rodando o servidor SSR correto (.output/server/index.mjs),
# não o `vite preview`. Se o processo já existe com outro script, ele é trocado.
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
fi
PORT="${PORT:-3000}" HOST="${HOST:-0.0.0.0}" pm2 start .output/server/index.mjs \
  --name "$APP_NAME" \
  --update-env \
  --time
pm2 save

echo ""
echo "✅ Deploy concluído!"
echo "   $(date)"
echo "   $LOCAL → $REMOTE"
curl -sI https://app.sistemamvbroker.com.br/ | head -1
