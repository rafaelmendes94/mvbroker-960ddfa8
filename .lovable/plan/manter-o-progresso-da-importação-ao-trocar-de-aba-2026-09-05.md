# Manter o progresso da importação ao trocar de aba

## Problema

Na Importação de Imóveis com IA, tudo o que já foi feito (arquivo lido, mapeamento das colunas, resultado do processamento e a lista de revisão) vive apenas na memória da tela. Ao clicar em outra aba de Importações — ou em qualquer outro item do menu — a tela é descartada e, ao voltar, tudo aparece zerado.

## O que vai mudar

- O progresso da importação passa a ficar guardado fora da tela, então sair e voltar mantém exatamente onde parou: etapa atual, nome do arquivo, linhas lidas, mapeamento das colunas, status escolhido e a lista de revisão com as decisões (criar/atualizar/ignorar).
- Ao voltar, aparece uma faixa no topo indicando que há uma importação em andamento, com o nome do arquivo e um botão "Começar de novo" para limpar tudo de propósito.
- Se o processamento com IA estiver rodando no momento em que a pessoa sai da tela, ele continua até o fim em segundo plano e o resultado estará lá ao voltar.
- Depois de concluir a importação (tela de resultado), o progresso guardado é apagado automaticamente na próxima vez que uma nova importação começar.
- Fechar o navegador ou recarregar a página também mantém a importação, exceto quando a planilha for grande demais para caber no armazenamento local — nesse caso volta para a etapa de envio do arquivo, com aviso.

## Detalhes técnicos

- Criar `src/lib/import-ia-store.ts`: um store singleton (módulo com `useSyncExternalStore` ou um `createStore` simples) contendo todo o estado hoje em `useState` dentro de `ImportIaPage` (`etapa`, `parsed`, `fileName`, `mapping`, `statusPadrao`, `forcarStatus`, `progresso`, `pct`, `itens`, `resultado`, `erro`).
- `ImportIaPage.tsx` deixa de declarar `useState` locais e passa a ler/escrever no store; as funções `handleFile`, `processar` e a execução final atualizam o store diretamente, de modo que continuam rodando mesmo com o componente desmontado.
- Persistência em `sessionStorage` com chave `mvbroker:import-ia`, gravando de forma debounced; `parsed.rows` só é gravado se o JSON serializado ficar abaixo de ~4 MB, senão persiste apenas metadados e, na hidratação sem linhas, volta para a etapa `arquivo` com um toast explicando.
- Banner de retomada e botão "Começar de novo" chamando um `reset()` do store; `reset()` também é chamado ao soltar um novo arquivo.
- Nenhuma alteração nos server functions de importação.
