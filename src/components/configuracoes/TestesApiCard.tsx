import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, PlugZap, MapPin, Sparkles } from "lucide-react";
import { testGoogleMaps, testLovableAi } from "@/lib/api-test.functions";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; status: number; latency_ms: number; detail: string } | null;

export function TestesApiCard() {
  const runMaps = useServerFn(testGoogleMaps);
  const runAi = useServerFn(testLovableAi);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [mapsResult, setMapsResult] = useState<Result>(null);
  const [aiResult, setAiResult] = useState<Result>(null);

  async function handleMaps() {
    setMapsLoading(true);
    setMapsResult(null);
    try {
      setMapsResult(await runMaps());
    } catch (e: any) {
      setMapsResult({ ok: false, status: 0, latency_ms: 0, detail: e?.message ?? "Erro" });
    } finally {
      setMapsLoading(false);
    }
  }

  async function handleAi() {
    setAiLoading(true);
    setAiResult(null);
    try {
      setAiResult(await runAi());
    } catch (e: any) {
      setAiResult({ ok: false, status: 0, latency_ms: 0, detail: e?.message ?? "Erro" });
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PlugZap className="h-4 w-4 text-primary" />
          Testes de API externa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Dispare uma chamada real para validar se as chaves estão funcionando. Apenas super administradores.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ApiTestRow
            icon={<MapPin className="h-4 w-4" />}
            title="Google Maps (Geocoding)"
            loading={mapsLoading}
            result={mapsResult}
            onTest={handleMaps}
          />
          <ApiTestRow
            icon={<Sparkles className="h-4 w-4" />}
            title="Gemini API (Google AI Studio)"
            loading={aiLoading}
            result={aiResult}
            onTest={handleAi}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ApiTestRow({
  icon, title, loading, result, onTest,
}: {
  icon: React.ReactNode;
  title: string;
  loading: boolean;
  result: Result;
  onTest: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon} {title}
        </div>
        <Button size="sm" variant="outline" onClick={onTest} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Testar"}
        </Button>
      </div>
      {result && (
        <div
          className={cn(
            "rounded-md border p-2 text-xs flex items-start gap-2",
            result.ok
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          {result.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <div className="font-semibold">
              {result.ok ? "Funcionando" : "Falhou"} · HTTP {result.status} · {result.latency_ms}ms
            </div>
            <div className="break-words opacity-90">{result.detail}</div>
          </div>
        </div>
      )}
    </div>
  );
}
