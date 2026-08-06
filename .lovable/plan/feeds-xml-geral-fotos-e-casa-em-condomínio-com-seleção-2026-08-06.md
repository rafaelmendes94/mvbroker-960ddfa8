# Feeds XML: Geral, Fotos e Casa em Condomínio (com seleção)

## O que muda

Na tela **Feeds XML** (menu lateral), passam a existir 4 feeds prontos, disponíveis tanto para o perfil **Admin** quanto **Secretária**:

1. **XML Geral** — todos os imóveis liberados para exportação (já existe).
2. **XML Fotos** — somente imóveis que tenham pelo menos 1 foto.
3. **XML Casa em Condomínio** — somente imóveis de casa em condomínio/loteamento.
4. **XML Personalizado** — seleção manual de imóveis (já existe).

Cada card mostra a URL pública, com botões **Copiar URL**, **Abrir** e **Baixar XML**.

## Seleção por condições

Acima dos cards entra um bloco **"Montar meu XML"** com caixas de seleção:

- Somente com fotos
- Somente com vídeo
- Somente casa em condomínio
- Somente exclusivos
- Somente disponíveis

Ao marcar/desmarcar, a URL do feed é montada na hora (ex.: `.../api/public/feed/filtro.xml?fotos=1&casa_condominio=1`) e ficam disponíveis os mesmos botões Copiar / Abrir / Baixar. Sem nenhuma marcação, equivale ao XML Geral.

## Detalhes técnicos

- Novas rotas públicas:
  - `src/routes/api/public/feed/fotos[.]xml.ts` — imóveis não arquivados, `exportacao_liberada = true`, status disponível/reservado, com ao menos 1 registro em `imovel_imagens`.
  - `src/routes/api/public/feed/casa-condominio[.]xml.ts` — mesmo filtro base + imóvel de casa em condomínio.
  - `src/routes/api/public/feed/filtro[.]xml.ts` — mesma base, aplicando os parâmetros de query (`fotos`, `video`, `casa_condominio`, `exclusivo`, `disponivel`).
- Regra "casa em condomínio": `tipo_imovel` contendo "cond" (ex.: Casa de Condomínio / casa_condominio) **ou** `tipo_imovel` do grupo casa/sobrado com `condominio_id` ou `loteamento_id` preenchido.
- Para evitar 3 cópias do mesmo código, a lógica comum (buscar imóveis, imagens, nomes de edifício/condomínio, montar XML) vai para um helper `src/lib/feed-base.server.ts` reutilizado pelas rotas novas e pela `foto-video.xml`. As fotos continuam saindo pelo proxy público `/api/public/img/imoveis/...`.
- UI: `src/routes/_authenticated/carteiras.index.tsx` ganha os novos cards e o bloco de seleção (componente `src/components/feeds/FeedFiltroCard.tsx`).
- Acesso: `/carteiras` já é liberado para `super_admin` e `secretaria` em `src/lib/permissions.ts` — nenhuma mudança de permissão necessária.
