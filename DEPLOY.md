# Deploy Self-Hosted — MV Broker

Tutorial **completo e testado** para subir o app numa VPS Ubuntu usando
Docker + Traefik (SSL automático Let's Encrypt) + Supabase self-hosted.

> Stack final na VPS:
> - **Traefik** (container) → recebe 80/443, faz SSL automático, roteia por hostname
> - **mvbroker-front** (container Docker) → build do app TanStack Start (porta 3000 interna)
> - **Supabase self-hosted** (containers oficiais) → Postgres + Kong + Studio
> - Tudo na rede docker compartilhada `web`
>
> O app **nunca** aponta pro Lovable Cloud — só pro Supabase desta VPS.

---

## 0. Pré-requisitos

- VPS Ubuntu 22.04+ com IP público
- Domínio com DNS apontando pra VPS:
  ```
  A   sistemamvbroker.com.br          → IP_DA_VPS
  A   www.sistemamvbroker.com.br      → IP_DA_VPS
  A   app.sistemamvbroker.com.br      → IP_DA_VPS
  A   supabase.sistemamvbroker.com.br → IP_DA_VPS
  ```
  Espere propagar: `dig +short app.sistemamvbroker.com.br`

---

## 1. Bootstrap da VPS (uma vez)

Como `root`:

```bash
curl -fsSL https://raw.githubusercontent.com/rafaelmendes94/mvbroker-2309b0aa/main/infra/bootstrap.sh | bash
```

Isso instala Docker, Compose, git, ufw, cria a rede `web` e clona o repo em
`/opt/mvbroker-infra`.

---

## 2. Subir Traefik

```bash
cd /opt/mvbroker-infra/infra
cp .env.example .env
nano .env   # preencha LETSENCRYPT_EMAIL e o resto

docker compose -f traefik/docker-compose.yml up -d
docker logs -f traefik   # ctrl+c quando ver "starting"
```

A regra de roteamento do app **já está no repo** em
`infra/traefik/dynamic/app.yml` (faz `app.sistemamvbroker.com.br` →
container `mvbroker-front:3000`). Traefik recarrega sozinho.

---

## 3. Subir Supabase self-hosted

```bash
cd /opt/mvbroker-infra/infra/supabase
curl -fsSL https://raw.githubusercontent.com/supabase/supabase/master/docker/docker-compose.yml -o docker-compose.supabase.yml
curl -fsSL https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/api/kong.yml --create-dirs -o volumes/api/kong.yml

docker compose --env-file ../.env \
  -f docker-compose.supabase.yml \
  -f docker-compose.override.yml up -d
```

Studio em https://supabase.sistemamvbroker.com.br (login no `.env`).

---

## 4. Subir o APP (Docker, atrás do Traefik)

O repo do app fica em `/opt/mvbroker-infra/app-front` e é buildado num
container Docker servido pela porta 3000 na rede `web`.

### 4.1 Estrutura na VPS

```bash
mkdir -p /opt/mvbroker-infra/app-front
cd /opt/mvbroker-infra/app-front

# Clone do repositório
git clone https://github.com/rafaelmendes94/mvbroker-2309b0aa.git repo

# .env de produção (NUNCA commitado, fica só na VPS)
nano .env.production
```

Conteúdo mínimo do `.env.production`:

```env
VITE_SUPABASE_URL=https://supabase.sistemamvbroker.com.br
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY do infra/.env>
SUPABASE_URL=https://supabase.sistemamvbroker.com.br
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

### 4.2 Script `deploy.sh`

Crie `/opt/mvbroker-infra/app-front/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/mvbroker-infra/app-front"
REPO_DIR="$APP_DIR/repo"
IMAGE="mvbroker-front:latest"
CONTAINER="mvbroker-front"
NETWORK="${NETWORK:-web}"
BRANCH="${BRANCH:-main}"

echo "=== Deploy $(date) | branch=$BRANCH ==="

# 1. Puxa código novo
cd "$REPO_DIR"
git fetch --all --prune
git reset --hard "origin/$BRANCH"
echo "Commit: $(git rev-parse --short HEAD) - $(git log -1 --pretty=%s)"

# 2. Copia .env de produção pro contexto de build (necessário pro Vite ler VITE_*)
cp "$APP_DIR/.env.production" "$REPO_DIR/.env.production"

# 3. Dockerfile gerado (SSR Node — TanStack Start + Nitro node-server)
cat > "$REPO_DIR/Dockerfile" <<'EOF'
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lockb* package-lock.json* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
RUN bun run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output
EXPOSE 3000
ENV HOST=0.0.0.0 PORT=3000
CMD ["node", ".output/server/index.mjs"]
EOF

# 4. Build da imagem
docker build -t "$IMAGE" "$REPO_DIR"

# 5. Recria container na rede `web` (mesma do Traefik)
docker rm -f "$CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  --network "$NETWORK" \
  -p 3000:3000 \
  --env-file "$APP_DIR/.env.production" \
  "$IMAGE"

echo "Deploy OK porta 3000"
docker ps | grep "$CONTAINER"
```

```bash
chmod +x /opt/mvbroker-infra/app-front/deploy.sh
```

### 4.3 Primeiro deploy

```bash
NETWORK=web /opt/mvbroker-infra/app-front/deploy.sh
```

Validação:

```bash
docker ps | grep mvbroker-front
docker logs --tail 30 mvbroker-front       # tem que aparecer "Listening on http://localhost:3000"
curl -I http://localhost:3000              # 200
curl -I https://app.sistemamvbroker.com.br # 200 (via Traefik+SSL)
```

---

## 5. Criar super admin

Depois do app subir uma vez (pra criar tabelas via migrations do Lovable):

```bash
cd /opt/mvbroker-infra/infra
bash seed-admin.sh
```

---

## 6. Atualização contínua (toda vez que o Lovable fizer commit)

```bash
NETWORK=web /opt/mvbroker-infra/app-front/deploy.sh
```

Só isso. O script:
1. Faz `git pull` em `repo/`
2. Reinjeta `.env.production` (suas chaves self-hosted **nunca** vêm do Git)
3. Rebuilda imagem Docker
4. Recria o container na rede `web`

Traefik detecta automaticamente — `app.sistemamvbroker.com.br` continua
respondendo, com SSL renovado sozinho.

---

## 7. Troubleshooting

| Sintoma | Causa / Fix |
|---|---|
| `network mvbroker-infra_default not found` | Use `NETWORK=web` no comando de deploy |
| Traefik 404 em `app.sistemamvbroker.com.br` | Confira `/opt/mvbroker-infra/infra/traefik/dynamic/app.yml` existe e Traefik está na rede `web` |
| `/app/dist not found` no build | Dockerfile antigo (SPA). Use o do `deploy.sh` acima (SSR `.output/`) |
| `.env.production: No such file` | Crie o arquivo em `/opt/mvbroker-infra/app-front/.env.production` antes do primeiro deploy |
| App responde mas tela branca/erro Supabase | `.env.production` está apontando pro Lovable Cloud. Tem que ser `https://supabase.sistemamvbroker.com.br` |
| Cert SSL não emitiu | DNS ainda não propagou OU porta 80/443 bloqueada no firewall (`ufw status`) |

---

## 8. Invariantes

- ❌ Nunca commitar `.env*` com chaves self-hosted
- ❌ Nunca apontar `VITE_SUPABASE_URL` pra `*.supabase.co` (Lovable Cloud) em produção
- ❌ Nunca rodar migrations do Lovable contra o Postgres da VPS pelo `deploy.sh` (são gerenciadas pelo Supabase self-hosted via Studio/SQL)
- ✅ Toda mudança de código vem do Lovable → GitHub → `deploy.sh` na VPS
- ✅ Toda mudança de segredo é feita só na VPS, editando `.env.production`
