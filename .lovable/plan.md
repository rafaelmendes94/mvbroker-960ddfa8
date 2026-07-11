## Diagnóstico da lentidão

Investigando o carregamento, achei 4 gargalos claros — os 3 primeiros afetam **tanto Lovable quanto VPS**:

### 1. Bucket `imoveis` é privado → tudo usa signed URL
Cada tela de imóveis (galeria, drawer, tabela, home) faz:
- 1 SELECT em `imovel_imagens`
- **N chamadas HTTP** ao Storage (`createSignedUrl`, uma por foto) para gerar URL temporária de 1h
- URLs assinadas **não são cacheáveis** pelo browser/CDN entre sessões, e expiram

Só a home dispara 6 signed URLs em série a cada visita. Uma galeria com 20 fotos = 20 round-trips extras antes do primeiro pixel.

### 2. Fotos originais servidas em qualquer tamanho
Upload comprime para WebP mas mantém **até 2000px** no maior lado. Essas mesmas fotos gigantes são servidas em cards de ~300px na home e listagem → megabytes desnecessários por card.

Não existe versão "thumb" nem "medium" salva para imóveis (só o FileUploader genérico gera, mas ele não é usado no fluxo de fotos de imóveis).

### 3. Landing (`/`) está com URL de imagem quebrada
Em `src/routes/index.tsx` linha ~182, o `capa` é preenchido com `im.url` — que na tabela `imovel_imagens` é só o **path bruto do storage** (`uuid/1781...jpg`), não uma URL. O `<img src>` cai em 404 silencioso e fica só o mock do Unsplash aparecendo (o que explica por que "os imóveis reais quase não aparecem").

### 4. Hero da landing sem preload
`bg-mv.png` e `bg-mobilemv.png` são pintados via CSS `background-image` inline, sem `<link rel="preload">` — LCP demora.

---

## Plano de correção (rápido, sem quebrar nada)

### Passo 1 — Home: usar URL pública correta + preload do hero
- Trocar `im.url` cru por `supabase.storage.from("imoveis").getPublicUrl(path).data.publicUrl` **em uma única chamada local** (é só string, não faz HTTP).
- Como o bucket é privado, também preciso liberar leitura pública das fotos **só** pela política existente ou expor via signed URL longa em cache. Solução mais simples e segura: **tornar o bucket `imoveis` público** (o path já é UUID imprevisível; é o padrão do mercado para fotos de anúncio) e passar a usar `getPublicUrl` em todos os call sites.
- Adicionar `<link rel="preload" as="image" href={bgDesktop} fetchpriority="high">` no `head()` do `/`.

### Passo 2 — Trocar signed URL por URL pública nos 4 call sites
Arquivos afetados:
- `src/routes/index.tsx` (home)
- `src/components/imoveis/ImovelDrawer.tsx` (linha 38)
- `src/components/imoveis/ImovelGaleria.tsx` (linha 29–34, o `Promise.all` de N HTTP calls)
- `src/lib/storage.ts` (helper `getSignedUrl` fica para documentos privados)

Ganho: **1 request de rede a menos por foto** em toda tela que lista imagens. Galeria de 20 fotos abre imediata.

### Passo 3 — Gerar thumb + medium no upload de fotos do imóvel
Alterar `ImovelGaleria.handleUpload` para gerar 3 versões (thumb 400px, medium 1200px, full 2000px) e salvar `storage_path_thumb` / `storage_path_medium` na tabela `imovel_imagens`. Migration adiciona as duas colunas (nullable, back-compat).

Depois, usar `thumb` em listagens/cards e `medium` em drawer/preview; `full` só no lightbox.

### Passo 4 — Cache HTTP forte
Bucket público do Supabase já serve com `Cache-Control: max-age=3600`. Aumentar para `31536000, immutable` no upload (`cacheControl: "31536000"`). O path já contém timestamp, então nunca precisa invalidar.

### Passo 5 (VPS) — Cache no Traefik
Adicionar middleware de cache no `traefik/dynamic/app.yml` para as rotas `/storage/v1/object/public/imoveis/*` (assets imutáveis, TTL longo). Impacto forte no self-hosted onde não tem CDN na frente.

---

## Ordem de execução sugerida

1. **Passo 1 + 2 juntos** (uma única leva de edits) — resolve 80% da lentidão percebida sem migration.
2. **Passo 4** (uma linha em cada `upload`) — grátis, só afeta uploads novos.
3. **Passo 3** (thumb/medium) — melhoria maior mas exige migration + reprocessar fotos antigas (opcional: script one-off que roda no primeiro load).
4. **Passo 5** (VPS) — mexe em `infra/`; me confirma antes que aí eu edito.

---

## Perguntas antes de executar

1. Posso tornar o bucket `imoveis` **público**? (Recomendado — é o padrão para fotos de anúncio, o path é UUID e nada muda de segurança real. Se preferir manter privado, faço com signed URLs longas em cache local no lugar.)
2. Quer que eu inclua o Passo 3 (thumb/medium) agora ou deixamos para depois? Ele exige migration e reprocessamento das fotos existentes.
3. Passo 5 (Traefik/VPS) — mexo agora nos arquivos de `infra/`? (Você tem memória "nunca modificar `infra/`", por isso pergunto.)
