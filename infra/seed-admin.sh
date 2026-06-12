#!/usr/bin/env bash
# Cria o super admin no Supabase self-hosted.
# Pré-requisito: Supabase já rodando, .env preenchido, e o app já rodou ao menos
# uma vez (pra criar tabelas public.profiles e public.user_roles via migrations).
#
# Uso: cd /opt/mvbroker-infra/infra && bash seed-admin.sh
set -euo pipefail

cd "$(dirname "$0")"
[ -f .env ] || { echo "❌ infra/.env não existe. cp .env.example .env e preencha."; exit 1; }
set -a; . ./.env; set +a

: "${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY não definido no .env}"
: "${DOMAIN_SUPABASE:?DOMAIN_SUPABASE não definido no .env}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL não definido no .env}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD não definido no .env}"

API="https://${DOMAIN_SUPABASE}"

echo "▶ Criando usuário ${ADMIN_EMAIL} (Auth Admin API)"
CREATE_RES="$(curl -sS -X POST "${API}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Patrique (Super Admin)\"}}")"

USER_ID="$(echo "$CREATE_RES" | jq -r '.id // .user.id // empty')"
if [ -z "$USER_ID" ]; then
  echo "ℹ️  Talvez já exista. Buscando por email…"
  LIST_RES="$(curl -sS "${API}/auth/v1/admin/users?email=${ADMIN_EMAIL}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")"
  USER_ID="$(echo "$LIST_RES" | jq -r '.users[0].id // empty')"
fi

[ -n "$USER_ID" ] || { echo "❌ Não consegui obter user_id. Resposta:"; echo "$CREATE_RES"; exit 1; }
echo "   user_id = $USER_ID"

echo "▶ Dando role super_admin via PostgREST"
curl -sS -X POST "${API}/rest/v1/user_roles" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  -d "{\"user_id\":\"${USER_ID}\",\"role\":\"super_admin\"}" \
  && echo "" || true

echo ""
echo "✅ Super admin pronto."
echo "   Login: ${ADMIN_EMAIL}"
echo "   Senha: ${ADMIN_PASSWORD}"
echo "   URL:   https://app.sistemamvbroker.com.br"
