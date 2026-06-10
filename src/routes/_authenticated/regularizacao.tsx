import { createFileRoute } from "@tanstack/react-router";
import { useAssinatura } from "@/hooks/use-assinatura";
import { RegularizacaoPanel } from "@/components/RegularizacaoPanel";

export const Route = createFileRoute("/_authenticated/regularizacao")({
  head: () => ({ meta: [{ title: "Regularização — MV Broker" }] }),
  component: RegularizacaoPage,
});

function RegularizacaoPage() {
  const { assinatura } = useAssinatura();
  return <RegularizacaoPanel assinatura={assinatura} />;
}
