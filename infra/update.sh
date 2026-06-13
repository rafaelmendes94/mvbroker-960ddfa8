#!/usr/bin/env bash
# =============================================================================
#  MV Broker — atualizar o front na VPS
# -----------------------------------------------------------------------------
#  - Faz git pull do branch main
#  - Reconstrói a imagem Docker injetando as chaves do Supabase self-hosted
#    via --build-arg (Vite congela em build time)
#  - Recria o container mvbroker-front na porta 3000 (atrás do Traefik)
#  - NUNCA sobrescreve o .env nem mistura com Lovable Cloud
#
#  Uso:
#    bash /opt/mvbroker-infra/app-front/update.sh
# =============================================================================
set -euo pipefail

APP_DIR="/opt/mvbroker-infra/app-front"
REPO_DIR="$APP_DIR/repo"          # clone do repositório do Lovable
ENV_FILE="$APP_DIR/.env"          # chaves reais ficam SÓ aqui (fora do git)
IMAGE="mvbroker-front:latest"
CONTAINER="mvbroker-front"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3000}"

echo "▶ [1/6] Verificando .env em $ENV_FILE"
if [ ! -f "$ENV_FILE" ]; then
  cat <<EOF >&2
✗ $ENV_FILE não existe.
  Crie-o com as chaves do Supabase self-hosted:

  VITE_SUPABASE_URL=https://supabase.sistemamvbroker.com.br
  VITE_SUPABASE_PUBLISHABLE_KEY=<anon key do supabase self-host>
  VITE_SUPABASE_PROJECT_ID=mvbroker
  SUPABASE_URL=https://supabase.sistemamvbroker.com.br
  SUPABASE_PUBLISHABLE_KEY=<anon key>
  SUPABASE_SERVICE_ROLE_KEY=<service role key>
EOF
  exit 1
fi

# carrega variáveis no shell sem expor no log
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${VITE_SUPABASE_URL:?VITE_SUPABASE_URL ausente no .env}"
: "${VITE_SUPABASE_PUBLISHABLE_KEY:?VITE_SUPABASE_PUBLISHABLE_KEY ausente no .env}"

echo "▶ [2/6] git pull origin/$BRANCH"
cd "$REPO_DIR"
git fetch --all --prune
git reset --hard "origin/$BRANCH"

echo "▶ [3/6] Build da imagem Docker (injetando build-args)"
docker build \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
  --build-arg VITE_SUPABASE_PROJECT_ID="${VITE_SUPABASE_PROJECT_ID:-mvbroker}" \
  -t "$IMAGE" \
  "$REPO_DIR"

echo "▶ [4/6] Parando container antigo (se existir)"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

echo "▶ [5/6] Subindo novo container na porta $PORT"
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p "${PORT}:3000" \
  --network traefik \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.mvbroker.rule=Host(\`app.sistemamvbroker.com.br\`)" \
  --label "traefik.http.routers.mvbroker.entrypoints=websecure" \
  --label "traefik.http.routers.mvbroker.tls.certresolver=letsencrypt" \
  --label "traefik.http.services.mvbroker.loadbalancer.server.port=3000" \
  "$IMAGE"

echo "▶ [6/6] Health-check"
sleep 3
if curl -fsS -o /dev/null "http://localhost:${PORT}"; then
  echo "✓ Deploy OK em http://localhost:${PORT} (publicado via Traefik em https://app.sistemamvbroker.com.br)"
else
  echo "✗ Container respondeu erro. Logs:"
  docker logs --tail 50 "$CONTAINER"
  exit 1
fi
