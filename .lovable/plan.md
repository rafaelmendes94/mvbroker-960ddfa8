# Baixar fotos em ZIP + tags na listagem de imóveis

## 1. Botão "Baixar fotos" (ZIP) na página do imóvel

Na página pública/interna do imóvel (`/imovel/:id`), adicionar um botão "Baixar fotos" ao lado dos botões de PDF comercial / Material completo / Drive.

Comportamento:
- Baixa todas as fotos já carregadas na galeria do imóvel.
- Junta tudo num único arquivo `.zip` nomeado com o código/título do imóvel.
- Mostra progresso simples ("Baixando 5/32...") e desabilita o botão durante o processo.
- Se o imóvel não tiver fotos, o botão não aparece.

Reusa a mesma abordagem de ZIP que já existe na listagem de imóveis (biblioteca JSZip já instalada), sem adicionar dependência nova.

## 2. Tags na listagem principal de imóveis

Nos cards da listagem (`/imoveis`), exibir tags de destaque sobre a foto, além das que já existem (tipo de proprietário, Mar, Decorado):

- Exclusividade — quando o imóvel está marcado como exclusivo (mesmo sem termo anexado). Hoje a tag só aparece quando existe o arquivo do termo.
- Ex. Assinada — mantida como está, quando existe o termo em PDF (clicável para abrir).
- Bônus — quando há valor de bônus cadastrado, com o valor e validade quando houver.

As tags ficam agrupadas no rodapé da imagem junto com "Mar"/"Dec.", com cores distintas e leitura clara no mobile. Também aplicadas na visualização em lista/linha, para manter o padrão.

## Detalhes técnicos

- `src/routes/imovel.$id.tsx`: novo botão nos arrays `downloads` e `atalhos`; download em série das URLs já assinadas (`data.images`), `fetch` → `blob` → `JSZip` → `zip.generateAsync` → link temporário. Erros por imagem são ignorados individualmente.
- `src/pages/Properties.tsx`: no card (`PropertyCard`) e na linha da visualização em lista, renderizar as tags a partir de `property.exclusivityTerm`, `property.exclusivityTermUrl` e `property.bonus`/`bonusExpiry` (campos já mapeados de `exclusividade`, `termo_exclusividade_path`, `bonus`, `validade_bonus`).
- Nenhuma alteração de banco, permissões ou lógica de negócio.
