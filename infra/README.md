# Infra MV Broker — VPS do zero

Stack na sua VPS (Ubuntu 22/24):

| Domínio                         | Serviço                                  |
|---------------------------------|------------------------------------------|
| `sistemamvbroker.com.br`        | Landing page (nginx estático)            |
| `app.sistemamvbroker.com.br`    | App TanStack (PM2 em `/var/www/mvbroker`)|
| `supabase.sistemamvbroker.com.br` | Supabase self-hosted (Studio + API)    |

Traefik na frente de tudo, SSL automático Let's Encrypt.
**Nada de Lovable Cloud aqui.** O app aponta exclusivamente pro Supabase da VPS.

---

## 0. DNS (antes de começar)

Crie no seu provedor de DNS, todos apontando pro IP da VPS:

```
A   sistemamvbroker.com.br          → IP_DA_VPS
A   www.sistemamvbroker.com.br      → IP_DA_VPS
A   app.sistemamvbroker.com.br      → IP_DA_VPS
A   supabase.sistemamvbroker.com.br → IP_DA_VPS
```

Espere propagar (`dig +short app.sistemamvbroker.com.br` tem que retornar o IP).

---

## 1. Bootstrap (uma vez só, VPS limpa)

```bash
# Na VPS, como root:
curl -fsSL https://raw.githubusercontent.com/rafaelmendes94/mvbroker-960ddfa8/main/infra/bootstrap.sh | bash
```

Isso instala: Docker, Docker Compose plugin, Node 20, npm, PM2, git, ufw e clona o repo em `/opt/mvbroker-infra`.

---

## 2. Subir Traefik + Supabase + Landing

```bash
cd /opt/mvbroker-infra/infra

# 2.1 Copie e edite o .env (define senhas/keys do Supabase self-hosted)
cp .env.example .env
nano .env   # preencha tudo que está marcado com CHANGE_ME

# 2.2 Sobe Traefik
docker compose -f traefik/docker-compose.yml up -d

# 2.3 Sobe Supabase
cd supabase
# baixa o compose oficial do Supabase (uma vez)
curl -fsSL https://raw.githubusercontent.com/supabase/supabase/master/docker/docker-compose.yml -o docker-compose.supabase.yml
curl -fsSL https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/api/kong.yml --create-dirs -o volumes/api/kong.yml
# usa o nosso override que coloca atrás do Traefik
docker compose --env-file ../.env -f docker-compose.supabase.yml -f docker-compose.override.yml up -d
cd ..

# 2.4 Sobe Landing
docker compose -f landing/docker-compose.yml up -d
```

Em ~1 min você tem HTTPS válido em:
- https://supabase.sistemamvbroker.com.br  (Studio, login: ver `.env`)
- https://sistemamvbroker.com.br           (landing)

---

## 3. Subir o APP (PM2, sem Docker)

O app fica em `/var/www/mvbroker` (já é assim hoje) e roda via PM2 na porta 3000.
Traefik faz reverse proxy pra ele.

```bash
# Clona o repo no lugar certo (uma vez)
mkdir -p /var/www && cd /var/www
git clone https://github.com/rafaelmendes94/mvbroker-960ddfa8.git mvbroker
cd mvbroker

# Cria .env apontando pro SEU Supabase (NUNCA pro Lovable Cloud)
cp infra/app.env.example .env
nano .env   # SUPABASE_URL=https://supabase.sistemamvbroker.com.br etc.

# Instala e builda
npm install
npm run build
PORT=3000 HOST=0.0.0.0 pm2 start .output/server/index.mjs --name mvbroker --time
pm2 save
pm2 startup systemd -u root --hp /root
```

O Traefik já está configurado pra mandar `app.sistemamvbroker.com.br` → `127.0.0.1:3000`
(via arquivo dinâmico `traefik/dynamic/app.yml`).

---

## 4. Criar super admin (patrique.corretor@gmail.com / Mv2026@)

Depois que o Supabase subiu **e** o app rodou pelo menos uma vez (pra criar tabelas via migrations do Lovable),
rode na VPS:

```bash
cd /opt/mvbroker-infra/infra
bash seed-admin.sh
```

Isso cria o usuário no `auth.users` do Supabase self-hosted e dá `super_admin` em `public.user_roles`.

---

## 5. Deploy diário (só código, NÃO mexe em chaves)

Toda vez que você fizer push no GitHub:

```bash
bash /var/www/mvbroker/infra/deploy-app.sh
```

O que o script faz:
1. Faz backup do `.env` antes de qualquer coisa
2. `git fetch` + `git reset --hard origin/main`
3. Restaura o `.env` original (suas chaves do Supabase self-hosted **nunca** são sobrescritas)
4. Valida que `VITE_SUPABASE_URL` aponta pro seu Supabase (não pro Lovable Cloud) — aborta se não
5. `npm install` (só se `package.json` mudou)
6. `npm run build`
7. Restart PM2

Se alguém tentar commitar um `.env` apontando pro Lovable Cloud, o deploy **falha** antes do build.
