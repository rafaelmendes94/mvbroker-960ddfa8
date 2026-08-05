# Trabalhando em dois lugares (Lovable + fora do Lovable)

O projeto está conectado ao GitHub, então o sync é **bidirecional**:
o que você faz no Lovable vai para o GitHub, e o que você envia para o
GitHub volta para o Lovable automaticamente.

Repositório: `https://github.com/rafaelmendes94/mvbroker-960ddfa8.git`

## Regra de ouro

Trabalhe em **um lugar por vez**. Antes de começar por fora, puxe o que o
Lovable fez. Antes de pedir algo no Lovable, garanta que você já enviou
suas alterações locais.

## Comandos

```bash
./scripts/sync.sh status          # ver o que está diferente
./scripts/sync.sh pull            # trazer o que foi feito no Lovable
./scripts/sync.sh push "mensagem" # enviar o que você fez por fora
```

## Ambiente / chaves

- O `.env` **não é versionado** (fica só na máquina/VPS).
- O `.env.example` lista apenas os nomes das variáveis.
- Na VPS, as variáveis vêm do `infra/app.env` via `infra/update.sh` —
  o deploy não sobrescreve suas chaves.

Se o `.env` já tiver sido commitado alguma vez, rode uma vez:

```bash
git rm --cached .env && git commit -m "chore: remove .env do versionamento"
```

O `scripts/sync.sh` faz isso sozinho na primeira execução.

## Banco de dados

As migrations continuam sendo aplicadas na VPS (`infra/update.sh`),
porque o Supabase é self-hosted. Novas migrations criadas no Lovable
chegam pelo git em `supabase/migrations/` e são aplicadas no próximo deploy.

## Se der conflito

1. `./scripts/sync.sh pull` e resolva o conflito localmente
2. `./scripts/sync.sh push "fix: resolve conflito"`
3. O Lovable passa a usar a versão resolvida
