## Feature: Minha Tabela (PDF compartilhado)

### Backend
- **Bucket de Storage** `tabela` (privado), acesso via signed URL.
- **Tabela** `public.tabela_atual` (singleton, sempre 1 linha):
  - `id uuid pk`, `file_path text`, `file_name text`, `size_bytes bigint`, `uploaded_by uuid`, `uploaded_at timestamptz default now()`.
  - GRANTs: `SELECT` para `authenticated`; `ALL` para `service_role`.
  - RLS: SELECT permitido a qualquer autenticado; INSERT/UPDATE/DELETE só `super_admin` ou `secretaria` (via `has_role`).
- **Política Storage** no bucket `tabela`:
  - Upload/Update/Delete só `super_admin`/`secretaria`.
  - Leitura via signed URL — sem policy pública.
- Cada novo upload **substitui** a linha existente (upsert) e remove o arquivo anterior do bucket → fica só a última versão.

### Frontend
- **Nova rota** `/_authenticated/tabela.tsx` (página admin) — visível só para `super_admin`/`secretaria`:
  - Card "Minha Tabela" com:
    - Info da versão atual (nome, tamanho, data, quem subiu).
    - Botão "Baixar atual" (signed URL).
    - Dropzone/input para subir novo PDF (`accept=application/pdf`, max 20MB).
    - Ao subir: upload no bucket → upsert em `tabela_atual` → remove arquivo antigo → toast.
- **Item no `AppSidebar`** "Tabela" (FileText icon) dentro do grupo Administração, gated por role.
- **Dashboard** (`/_authenticated/dashboard.tsx`):
  - Botão "Baixar tabela em PDF" visível só quando o usuário tem **plano ativo** (usa `get_minha_assinatura` → `status = 'ativa'`) **e** existe registro em `tabela_atual`.
  - Ao clicar: gera signed URL (60s) e abre/baixa.

### Arquivos
- Migration: cria tabela + RLS + GRANTs + policies de storage.
- `src/routes/_authenticated/tabela.tsx` (nova página admin).
- `src/components/dashboard/BaixarTabelaButton.tsx` (botão reusável).
- Editar `src/components/layout/AppSidebar.tsx` (novo item).
- Editar `src/routes/_authenticated/dashboard.tsx` (montar botão).

### Permissões
- Upload/gestão: `super_admin`, `secretaria`.
- Download: qualquer autenticado **com assinatura ativa**.
