## Objetivo

Fazer o espelho refletir **exatamente** o que foi cadastrado nos imóveis vinculados ao empreendimento (Qd, Lt, Bl, Un, Box, Nº), e organizar as células por:

- **Edifício** → agrupado por **Andar**
- **Condomínio** → agrupado por **Bloco** (com fallback para Quadra quando não houver bloco)
- **Loteamento** → agrupado por **Quadra**

O "Criar grade / Importar CSV / Nova unidade" da aba deixa de ser fonte de verdade. A grade é o próprio cadastro dos imóveis.

## Como fica na tela

Aba **Tabela** do empreendimento:

```
Andar 12
 ├─ [1201]  [1202]  [1203]  [1204]
Andar 11
 ├─ [1101]  [1102]  [1103]  [1104]
...
```

```
Bloco A
 ├─ [A-101] [A-102] [A-103]
Bloco B
 ├─ [B-201] [B-202]
Sem bloco
 ├─ [Qd 3 · Lt 12]
```

```
Quadra 1
 ├─ [Lt 01] [Lt 02] [Lt 03] [Lt 04]
Quadra 2
 ├─ [Lt 01] [Lt 02]
```

- Cada célula mostra o identificador real cadastrado no imóvel (unidade, ou "Qd X · Lt Y", ou "Box Z").
- Cor da célula = `status_imovel` do imóvel real (disponível / reservado / vendido / indisponível).
- Clicar abre popover com Qd, Lt, Bl, Andar, Un, Box, valor, área, dormitórios, vagas, foto de capa e botão **Abrir imóvel**.
- Contadores no topo (Unidades / Indisponíveis / Disponíveis / Reservados / Vendidos) passam a contar os imóveis reais.

## Extração de Bloco e Andar a partir do campo `unidade`

Como não existem colunas dedicadas, será feita uma heurística sobre `unidade` (string livre já cadastrada):

**Bloco** (para condomínio):
1. Regex de prefixo: `^(Bloco|Bl|Torre|T)\s*[-.]?\s*([A-Za-z0-9]+)` → captura o token.
2. Separador comum: `^([A-Z0-9]{1,3})\s*[-/·]\s*\d+` → ex. `A-101`, `B/302`, `T2 · 405`.
3. Fallback: usa `quadra` do imóvel se existir (em condomínios que numeram por quadra).
4. Se nada bater → grupo "Sem bloco".

**Andar** (para edifício):
1. Regex explícito: `(\d+)\s*º?\s*(andar|and)` → pega o número.
2. Padrão separado: `^(\d+)\s*[-/·]\s*\d+` → primeira parte é o andar.
3. Numérico puro 3–4 dígitos (`101`, `1204`): andar = tudo menos os 2 últimos dígitos.
4. Numérico puro com 1–2 dígitos: andar = 1 (térreo/único).
5. Se `unidade` estiver vazia → cai no grupo "Sem andar".

Toda a lógica fica isolada em `src/lib/espelho-grouping.ts` para poder ser ajustada depois sem tocar no componente.

## Alterações de código

### Novo arquivo: `src/lib/espelho-grouping.ts`
- Tipos `ImovelEspelho` (subset de `imoveis`) e `GrupoEspelho` (`{ chave, label, ordem, imoveis }`).
- Funções puras:
  - `extrairBloco(unidade, quadraFallback)`
  - `extrairAndar(unidade)`
  - `agruparImoveis(tipo, imoveis)` — devolve `GrupoEspelho[]` já ordenado (desc para andares, alfabético para blocos, numérico para quadras).
  - `rotuloCelula(tipo, imovel)` — monta o texto da célula ("1201", "A-101", "Lt 03", "Qd 2 · Lt 05", "Box 12").
  - `statusCelula(imovel)` — mapeia `status_imovel` para `UnitStatus` reusando o `STATUS_CONFIG` já existente.

### `src/components/empreendimentos/EspelhoSheet.tsx`
- Trocar a query de `espelho_unidades` por:
  ```
  supabase.from("imoveis")
    .select("id, titulo, codigo_interno, quadra, lote, unidade, box, numero, preco, area_total, dormitorios, vagas, suites, status_imovel, foto_capa_url, <fk>_id")
    .eq("<fk>_id", empreendimentoId)
    .or("arquivado.is.null,arquivado.eq.false")
  ```
  onde `<fk>` = `edificio` / `condominio` / `loteamento`.
- Alimentar `stats` a partir da nova lista.
- Substituir `byGroup` (que hoje usa `grupo` inteiro) por `agruparImoveis(tipo, imoveis)`.
- No render de cada grupo, usar `grupo.label` ("Andar 12", "Bloco A", "Quadra 1", "Sem bloco").
- Remover a toolbar admin (`CriarGradeDialog`, `ImportarCsvDialog`, `NovaUnidadeDialog`) da aba Tabela. Manter apenas botão **+ Novo imóvel** que leva para `/imoveis/novo` já com o empreendimento pré-selecionado (via query string).
- Célula (`UnitCell`) simplifica: recebe `ImovelEspelho`, mostra rótulo, status colorido; popover exibe todos os campos reais e link **Abrir imóvel** (`/imoveis/$id/editar`).
- Remover `saveUnit` / `deleteUnit` / `ImovelLinkSection` (não fazem mais sentido — edita-se no cadastro do imóvel).
- Estado vazio: "Nenhum imóvel cadastrado neste {edifício/condomínio/loteamento}. Cadastre imóveis para vê-los aqui."

### `src/lib/espelho.ts`
- Manter `STATUS_CONFIG`, `TIPO_LABELS`, `fmtBRL` (ainda usados).
- Marcar `generateSkeleton`, `parseEspelhoCSV`, `CSV_TEMPLATE`, `CSV_HEADERS` como legado (deixar para não quebrar `EstruturaPage` que ainda chama `generateSkeleton` no auto-gera de edifício). Não remover neste plano.

### `src/components/estruturas/EstruturaPage.tsx`
- Nenhuma mudança de comportamento. O botão "Espelho" continua levando para `/empreendimentos/$tipo/$id` que agora mostra a nova visão.

### Banco de dados
- **Nenhuma migração**. Continua usando `imoveis` como está.
- A trigger `fn_espelho_sync_imovel` permanece funcionando (mantém `espelho_unidades` populado como dado secundário), mas o front deixa de consumi-la — não precisamos mexer para essa entrega.

## Detalhes técnicos

- Query única por render (sem N+1). A `foto_capa_url` já está materializada no imóvel na maioria dos casos; se não, o popover cai no ícone genérico (evita cascata de signed URLs).
- Ordenação dentro do grupo: numérico natural sobre a `unidade` ou `lote` (usar `localeCompare(..., "pt-BR", { numeric: true })`).
- Ordem dos grupos:
  - Andar: `desc` (maior no topo, mantém padrão atual).
  - Bloco: alfabético asc; "Sem bloco" por último.
  - Quadra: numérico asc; "Sem quadra" por último.
- Popover reaproveita o layout atual de `Info` / `fmtBRL`.

## Fora do escopo

- Adicionar colunas `bloco`/`andar` ao cadastro (usuário optou pela extração via `unidade`).
- Refazer os fluxos de "Criar grade" / "Importar CSV" para outro contexto — hoje serão apenas ocultos.
- Editar dados do imóvel direto no popover (continua sendo pelo cadastro `/imoveis/$id/editar`).
