import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/importacoes/")({
  component: () => (
    <div className="text-sm text-muted-foreground">
      Selecione uma aba acima para começar a importação.
    </div>
  ),
});
