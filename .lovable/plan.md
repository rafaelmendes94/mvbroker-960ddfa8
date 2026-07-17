## XML "Foto + Vídeo" automático

Novo feed único e público (mesmo link para admin e usuários) que inclui automaticamente todos os imóveis que **tenham pelo menos 1 foto cadastrada** E **tenham `link_video` preenchido** E estejam com `exportacao_liberada = true` e não arquivados. Não precisa seleção manual — o sistema detecta.

### Backend

**Novo arquivo:** `src/routes/api/public/feed/foto-video.xml.ts`
- Rota pública `GET /api/public/feed/foto-video.xml`
- Reaproveita helpers/geradores de XML já usados em `geral.$id.ts` (mesmo formato de saída)
- Query base em `imoveis` com filtros:
  - `arquivado = false`
  - `exportacao_liberada = true`
  - `link_video` não nulo e diferente de `''`
  - `EXISTS (select 1 from imovel_imagens where imovel_id = imoveis.id)` (garante ≥ 1 foto)
- Retorna `Content-Type: application/xml`

### Frontend

**`src/pages/Properties.tsx`** — na toolbar de XML, adicionar um botão/link **"XML Foto + Vídeo"** visível para todos os roles, ao lado dos botões existentes (XML Geral / Meu XML). Mostra a URL pública `.../api/public/feed/foto-video.xml` com botões "Copiar link" e "Baixar".

Reaproveita o mesmo componente/dialog de exibição de URL já usado no `MeuXmlDialog` (só sem o seletor de imóveis, pois a seleção é automática).

### Sem migração

Não precisa alterar banco — usa colunas e tabela já existentes (`imoveis.link_video`, `imovel_imagens`).
