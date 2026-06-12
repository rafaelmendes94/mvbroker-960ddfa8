# Guia Completo — Setup de Sistema Auto-Hospedado

Mesmos moldes do CarPost. Use como checklist no projeto novo.

---

## 1. Infraestrutura na VPS

**Stack base**
- Ubuntu 22.04+ com Docker + Docker Compose
- Supabase self-hosted em `/opt/supabase/docker/` (clone oficial de `supabase/supabase`)
- Traefik v2.11 como reverse proxy (substitui Nginx + Certbot)
- Cloudflare gerenciando DNS (modo **DNS Only**, nuvem cinza)

**Portas**
- `80` / `443` → Traefik
- `5433` → Postgres (Supabase interno)
- `8000` → Kong (API Gateway do Supabase, exposto só na rede Docker)

---

## 2. DNS na Cloudflare

No domínio novo (ex.: `meusistema.com.br`):

```
A    app.meusistema.com.br        → IP_DA_VPS   (DNS Only)
A    *.meusistema.com.br          → IP_DA_VPS   (DNS Only — wildcard)
A    supabase.meusistema.com.br   → IP_DA_VPS   (DNS Only)
```

Gere um **API Token Cloudflare** com permissão `Zone:DNS:Edit` no domínio (necessário pro challenge DNS-01 do wildcard).

---

## 3. Traefik (SSL automático)

Estrutura em `scripts/traefik/`:

- `docker-compose.traefik.yml` — sobe Traefik + container Nginx que serve o SPA
- `traefik.yml` — config estática com 3 cert resolvers:
  - `letsencrypt` (DNS-01 Cloudflare) → wildcard `*.dominio.com.br`
  - `letsencrypt-alpn` (TLS-ALPN-01) → domínios personalizados dos clientes
  - `letsencrypt-http` (HTTP-01) → fallback
- `dynamic/supabase.yml` — roteia `supabase.dominio.com.br` → Kong (porta 8000)
- `dynamic/custom-domains.yml` — gerado automaticamente pelo `sync-domains.sh`
- `nginx-app.conf` — config do Nginx que serve `dist/`
- `sync-domains.sh` — lê `store_domains` do Postgres e gera config Traefik dos domínios personalizados verificados (rodar via cron a cada 5min)

**Setup:**

```bash
docker network create carpost-net
cp .env.traefik.example .env.traefik   # preencher CF_DNS_API_TOKEN
docker compose --env-file .env.traefik -f docker-compose.traefik.yml up -d
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
3. Aplica só migrações novas — usa tabela `_migrations_applied` para controlar quais já rodaram
4. Copia edge functions pra `/opt/supabase/docker/volumes/functions/` e reinicia o container `supabase-edge-functions`
5. `npm run build` → gera `dist/` que o Nginx serve

Requer `.env.local` no servidor com:

```
DATABASE_URL=postgresql://postgres:SENHA@localhost:5433/postgres
```

---

## 5. Configuração do projeto Lovable

**`.env` (commitado, só chaves públicas):**

```
VITE_SUPABASE_PROJECT_ID="<ref>"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon_key>"
VITE_SUPABASE_URL="https://supabase.dominio.com.br"
```

**`.gitignore`** — garanta que ficam de fora:
`.env.local`, `.env.traefik`, `letsencrypt/`, `node_modules/`, `dist/`.

**`src/integrations/supabase/client.ts`** — já lê de `import.meta.env.VITE_SUPABASE_*`. Funciona igual em Lovable Cloud e self-hosted, basta as envs do build apontarem pro Supabase da VPS.

---

## 6. Edge Functions — padrão self-hosted

**`supabase/functions/main/index.ts`** — roteador central obrigatório no self-hosted. Recebe `/functions/v1/<nome>` e despacha pro worker correspondente. Copie esse arquivo igual.

**`supabase/config.toml`** — liste todas as functions chamadas por webhooks externos com `verify_jwt = false` (Mercado Pago, Asaas, Instagram OAuth, etc).

**Secrets em DB, não em `.env`:** chaves de APIs externas (AI, Meta, Asaas, etc) ficam na tabela `system_settings` e são lidas via helper `supabase/functions/_shared/get-system-secret.ts`. Permite gerenciar pelo Super Admin sem CLI.

---

## 7. Banco de dados — invariantes obrigatórias

Toda migração que cria tabela em `public` precisa:

```sql
CREATE TABLE public.x (...);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.x TO authenticated;
GRANT ALL ON public.x TO service_role;
-- GRANT SELECT TO anon só se houver política pública

ALTER TABLE public.x ENABLE ROW LEVEL SECURITY;
CREATE POLICY ...;
```

- **Multi-tenant:** use sempre helper `is_store_member(auth.uid(), store_id)` ou `owns_store(...)` nas policies.
- **Storage:** todo path começa com `{store_id}/`.

---

## 8. Workflow de atualização

1. Edita no Lovable → commit automático pro GitHub
2. SSH na VPS: `cd /var/www/seuapp && ./scripts/deploy.sh`
3. Deploy aplica só o que mudou (migrações novas + functions + build)
4. Arquivos sensíveis (`.env.local`, `.env.traefik`) ficam só na VPS, nunca no Git

---

## 9. Checklist resumido pro projeto novo

- [ ] VPS com Docker + rede `<projeto>-net` criada
- [ ] Supabase self-hosted rodando em `/opt/supabase/docker/`
- [ ] DNS Cloudflare: A `app`, A `*`, A `supabase` + API Token
- [ ] Copiar pasta `scripts/traefik/` adaptando nomes (`carpost-*` → `seuapp-*`) e domínio
- [ ] Copiar `scripts/deploy.sh` adaptando caminhos
- [ ] Subir Traefik: `docker compose -f docker-compose.traefik.yml up -d`
- [ ] Cron de 5min: `*/5 * * * * bash /caminho/scripts/traefik/sync-domains.sh`
- [ ] No Lovable novo: configurar `.env` com URL `https://supabase.seudominio.com.br` e anon key do Supabase da VPS
- [ ] Copiar `supabase/functions/main/index.ts` e o padrão `_shared/get-system-secret.ts`
- [ ] Conectar Git no novo projeto Lovable
- [ ] No servidor: `git clone`, criar `.env.local` com `DATABASE_URL`, rodar `./scripts/deploy.sh`
