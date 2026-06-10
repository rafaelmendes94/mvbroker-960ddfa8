# Módulo de Imóveis — MV BROKER

Este é o maior módulo do sistema. Vou entregá-lo em **fases sequenciais** para garantir qualidade. Antes de começar, preciso confirmar alguns pontos.

---

## Fase 1 — Banco de dados e fundação
- Migration única criando:
  - `imoveis` (~70+ campos: identificação, dimensões, vínculos a edifício/condomínio/empreendimento, endereço, geolocalização, valores, responsável, características, publicação, XML, controle interno)
  - `imovel_caracteristicas` (M2M com `system_options` para infraestrutura, condições de pagamento, etc)
  - `imovel_tags` (tags livres)
  - `imovel_imagens` (galeria, reaproveitando padrão de `estrutura_imagens`)
  - `imovel_logs` (auditoria/histórico por imóvel)
- Trigger para gerar **código interno automático** (ex: `MV-000123`).
- Trigger `updated_at`.
- RLS:
  - SELECT: todos os autenticados
  - INSERT/UPDATE/DELETE: apenas `super_admin` e `secretaria`
- GRANTs corretos + service_role.
- Categorias novas em `system_options` via seed: `padrao_imovel`, `condicoes_pagamento`, `tipo_proprietario`, `posicao_predio`, `posicao_solar`, `vista`, `destaque_categoria`, `infraestrutura`, `portais_xml`.

## Fase 2 — Listagem e navegação
- Sidebar: menu **Imóveis** com submenus (Todos, Novo, Ativos, Reservados, Vendidos, Suspensos).
- Rota `/_authenticated/imoveis.tsx` com:
  - Filtros (código, título, cidade, bairro, tipo, status, proprietário, corretor, imobiliária, publicar XML, ativo no site)
  - Toggle Tabela / Cards
  - Ações: visualizar, editar, duplicar, arquivar, excluir
  - Paginação e busca
- Rotas filtradas por status reaproveitando o mesmo componente.

## Fase 3 — Cadastro em 12 abas
Rota `/_authenticated/imoveis.novo` e `/_authenticated/imoveis.$id.editar` usando shadcn `Tabs`:
1. Identificação
2. Vinculação (autocomplete de edifício/condomínio/empreendimento + herança automática)
3. Endereço (CepAutoFill + MapPicker com pin arrastável e reverse geocoding)
4. Valores e Condições (cálculo automático de comissão; multi-select em badges)
5. Origem e Responsável (+ upload do termo de exclusividade)
6. Características (selects dinâmicos do `system_options`, switches, tags livres)
7. Descrição (textarea + botão **Gerar com IA** via server function `generate-description` usando Lovable AI Gateway / `google/gemini-3-flash-preview`)
8. Vídeos e Materiais
9. Galeria (reutilizando `GaleriaUpload`)
10. Controle Interno
11. XML e Portais
12. Histórico (read-only de `imovel_logs`)

Validação Zod por aba, salvamento incremental (draft).

## Fase 4 — Ações avançadas
- **Duplicar**: server function que clona imóvel + imagens + características, gera novo código.
- **Arquivar / Excluir** com confirmação.
- Auditoria em todas as ações (criação, alteração, exclusão, upload, publicação XML) via `audit.ts`.

## Fase 5 — Dashboard de imóveis
- KPIs: Total, Disponíveis, Reservados, Vendidos, Suspensos.
- Gráficos (recharts já no projeto) por Tipo, Cidade, Origem, Status.
- Adicionado ao topo da listagem ou em `/imoveis` como aba "Dashboard".

## Fase 6 — IA de descrição
- Server function `src/lib/imovel-ia.functions.ts` chamando Lovable AI Gateway (modelo `google/gemini-3-flash-preview`), recebendo o objeto do imóvel e retornando descrição imobiliária profissional em PT-BR.
- Trata erros 429/402 com mensagens claras.

---

## Detalhes técnicos
- Stack: TanStack Start + Supabase, padrões já estabelecidos no projeto (`EstruturaPage`, `CepAutoFill`, `MapPicker`, `GaleriaUpload`, `useSystemOptions`, `RoleGate`, `audit.ts`).
- Storage: bucket `imoveis` (já existe) para galeria + `exclusividades` para termos.
- Toda escrita protegida por RLS + verificação no client com `RoleGate`.

---

## Perguntas antes de começar

1. **Tamanho da entrega**: posso ir em 1 mensagem grande (todas as 6 fases, ~25-30 arquivos novos, demora mais) ou prefere fase-a-fase com sua aprovação entre elas?
2. **Código interno**: formato `MV-000001` (sequencial global) ou `MV-{ano}-{seq}` (ex: `MV-2026-0001`)?
3. **Editor rico da descrição**: instalo `@tiptap/react` (mais robusto, +~200KB) ou uso `Textarea` simples com markdown e preview? A IA gera texto puro de qualquer forma.
4. **Filtros "Corretor" e "Imobiliária"** na listagem: ainda não existe vínculo de imóvel → corretor/imobiliária. Adiciono as colunas `corretor_id` e `imobiliaria_id` em `imoveis` agora (recomendado) ou deixo para depois?
