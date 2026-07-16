## O que vou fazer

### 1. Galeria com arrastar e soltar (imóvel e empreendimentos)
Substituir as setas ↑↓ por drag & drop usando `@dnd-kit/core` + `@dnd-kit/sortable` (leve, já padrão do stack).

Arquivos afetados:
- `src/components/imoveis/ImovelGaleria.tsx` — remover botões de seta; envolver o grid num `DndContext` + `SortableContext`. Ao soltar, atualizar `ordem` de todas as imagens em lote (uma chamada `upsert`). Manter capa/excluir.
- `src/components/forms/GaleriaUpload.tsx` — mesma mudança para as galerias de edifício/condomínio/empreendimento/loteamento (tabela `estrutura_imagens`).

Mobile: `TouchSensor` + `PointerSensor` para funcionar no toque.

### 2. Tela do Condomínio (`/empreendimentos/condominio/:id`) — mostrar tudo
Hoje o `EspelhoSheet` só exibe nome, endereço e a tabela de unidades. Vou:

- Buscar todos os campos do cadastro (descrição, infraestrutura, `tipo_condominio`, `numero_lotes`, `portaria`, `seguranca`, `area_total`, `valor_condominio`, `valor_iptu`, ativo, código interno, coordenadas).
- Renderizar um bloco “Sobre o condomínio” com descrição + grade de campos preenchidos + chips de infraestrutura.
- Aplicar a mesma expansão para `edificio`, `empreendimento` e `loteamento` (mesmo componente, campos por tipo vindos do `SPECIFIC` de `EstruturaPage.tsx`).

Arquivos: `src/components/empreendimentos/EspelhoSheet.tsx` (+ pequeno helper novo `src/lib/espelho-fields.ts` reaproveitando o dicionário `SPECIFIC`).

### 3. Aba “Mídia” não mostra as imagens
Hoje é um placeholder. Vou trocar por uma galeria real (carrega de `estrutura_imagens` com URLs assinadas, mesma lógica já existente em `GaleriaUpload.load()`), com lightbox simples ao clicar.

### 4. Upload de Implantação em PDF
- Migração (nova): adicionar coluna `implantacao_pdf_path text` nas 4 tabelas de estrutura (`edificios`, `condominios`, `empreendimentos`, `loteamentos`) e criar bucket privado `estrutura-arquivos` com policies (upload/read para authenticated; leitura pública via signed URL no espelho).
- `EstruturaPage.tsx` — no formulário de cadastro/edição, adicionar campo “Implantação (PDF)” com upload/remover. Grava caminho no registro.
- `EspelhoSheet.tsx` — aba “Implantação” exibe o PDF via `<iframe>` embutido em signed URL + botão “Abrir em nova aba / Baixar”. Fallback se não houver PDF.

### 5. Cards dos imóveis vinculados iguais aos de Oportunidades
No `EspelhoSheet` (na visão “Blocos”, que é a lista de cards), substituir o `ImovelCard` interno pelo mesmo layout de `OportunidadeCard` (mesma altura, badges de vista_mar/decorado, preço em destaque, ícones de dormitórios/banheiros/vagas/área). Extrair `OportunidadeCard` para `src/components/imoveis/OportunidadeCard.tsx` e reutilizar nos dois lugares — precisará também trazer os campos extras (`bairro`, `banheiros`, `vista_mar`, `decorado`, `padrao`, `bonus`, `area_privativa`) no `IMOVEL_SELECT`.

### Ordem de execução
1. Migração (nova coluna + bucket + policies) — aguardar aprovação.
2. Instalar `@dnd-kit/core` e `@dnd-kit/sortable`.
3. Refatorar `OportunidadeCard` para componente compartilhado.
4. Atualizar `ImovelGaleria` e `GaleriaUpload` com drag & drop.
5. Atualizar `EspelhoSheet` (informações completas, galeria real, PDF de implantação, cards estilo oportunidades).
6. Atualizar `EstruturaPage` (campo de upload de PDF).
7. Typecheck.
