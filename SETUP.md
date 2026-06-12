# Guia Completo — Setup de Sistema Auto-Hospedado

Mesmos moldes do CarPost. Use como checklist ao subir este projeto (ou um clone) numa VPS própria.

---

## 1. Infraestrutura na VPS

**Stack base**
- Ubuntu 22.04+ com Docker + Docker Compose
- Supabase self-hosted em `/opt/supabase/docker/` (clone oficial do `supabase/supabase`)
- Traefik v2.11 como reverse proxy (substitui Nginx + Certbot)
- Cloudflare gerenciando DNS (modo **DNS Only**, nuvem cinza)

**Portas**
- `80 / 443` → Traefik
- `5433` → Postgres (Supabase interno)
- `8000` → Kong (API Gateway do Supabase, exposto só na rede Docker)

---

## 2. DNS na Cloudflare

No domínio (ex.: `meusistema.com.br`):

```
A   app.meusistema.com.br       → IP_DA_VPS   (DNS Only)
A   supabase.meusistema.com.br  → IP_DA_VPS   (DNS Only)
```

---

## 3. Traefik (SSL automático)

Estrutura em `scripts/traefik/`:

- `docker-compose.traefik.yml` — sobe Traefik + container Nginx que serve o SPA
- `traefik.yml` — config estática com cert resolver `letsencrypt-http` (HTTP-01) para `app.dominio` e `supabase.dominio`
- `dynamic/supabase.yml` — roteia `supabase.dominio.com.br` → Kong (8000)
- `nginx-app.conf` — config do Nginx que serve `dist/`

**Setup:**

```bash
docker network create app-net
docker compose -f docker-compose.traefik.yml up -d
```

---

## 4. Deploy automatizado (`scripts/deploy.sh`)

Fluxo no servidor após push pro Git:

```bash
./scripts/deploy.sh
```

Faz, em ordem:

1. `git pull origin main`
2. `npm install`
3. Aplica só migrações novas — usa tabela `_migrations_applied` para controlar o que já rodou
4. Copia edge functions pra `/opt/supabase/docker/volumes/functions/` e reinicia `supabase-edge-functions`
5. `npm run build` → gera `dist/` que o Nginx serve

Requer `.env.local` no servidor com:

```
DATABASE_URL=postgresql://postgres:SENHA@localhost:5433/postgres
```

---

## 5. Configuração do projeto Lovable

**`.env` (somente na VPS; não commitar)**

```
VITE_SUPABASE_PROJECT_ID="<ref>"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon_key>"
VITE_SUPABASE_URL="https://supabase.dominio.com.br"
```

**`.gitignore`** — garanta que ficam fora:

```
.env
.env.*
!.env.example
.env.local
.dev.vars
letsencrypt/
node_modules/
dist/
```

**`src/integrations/supabase/client.ts`** já lê de `import.meta.env.VITE_SUPABASE_*` — funciona igual em Lovable Cloud e self-hosted, basta as envs do build apontarem pro Supabase da VPS.

---

## 6. Edge Functions — padrão self-hosted

- **`supabase/functions/main/index.ts`** — roteador central **obrigatório** no self-hosted. Recebe `/functions/v1/<nome>` e despacha pro worker correspondente. Copie igual.
- **`supabase/config.toml`** — liste todas as functions chamadas por webhooks externos com `verify_jwt = false` (Mercado Pago, Asaas, Instagram OAuth, etc).
- **Secrets em DB, não em `.env`** — chaves de APIs externas ficam em `system_settings`, lidas via `supabase/functions/_shared/get-system-secret.ts`. Permite gerenciar pelo Super Admin sem CLI.

---

## 7. Banco — invariantes obrigatórias

Toda migração que cria tabela em `public` precisa:

```sql
CREATE TABLE public.x (...);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.x TO authenticated;
GRANT ALL ON public.x TO service_role;
-- GRANT SELECT ON public.x TO anon;  -- só se houver política pública
ALTER TABLE public.x ENABLE ROW LEVEL SECURITY;
CREATE POLICY ...;
```

Multi-tenant: use sempre helper `is_store_member(auth.uid(), store_id)` ou `owns_store(...)` nas policies.
Storage: todo path começa com `{store_id}/`.

---

## 8. Workflow de atualização

1. Edita no Lovable → commit automático pro GitHub
2. SSH na VPS: `cd /var/www/seuapp && ./scripts/deploy.sh`
3. Deploy aplica só o que mudou (migrações novas + functions + build)

Arquivo sensível (`.env.local`) fica **só na VPS**, nunca no Git.

---

## 9. Checklist resumido pro projeto novo

- [ ] VPS com Docker + rede `<projeto>-net` criada
- [ ] Supabase self-hosted rodando em `/opt/supabase/docker/`
- [ ] DNS Cloudflare: `A app`, `A supabase`
- [ ] Copiar `scripts/traefik/` adaptando nomes e domínio
- [ ] Copiar `scripts/deploy.sh` adaptando caminhos
- [ ] Subir Traefik: `docker compose -f docker-compose.traefik.yml up -d`
- [ ] No Lovable: `.env` com URL `https://supabase.seudominio.com.br` e anon key da VPS
- [ ] Copiar `supabase/functions/main/index.ts` e `_shared/get-system-secret.ts`
- [ ] Conectar Git no projeto Lovable
- [ ] No servidor: `git clone`, criar `.env.local` com `DATABASE_URL`, rodar `./scripts/deploy.sh`
