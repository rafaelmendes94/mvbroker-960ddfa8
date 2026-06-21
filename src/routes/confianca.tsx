import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Lock, Database, UserCheck, Mail, FileText, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/confianca")({
  head: () => ({
    meta: [
      { title: "Central de Confiança — MV Broker" },
      { name: "description", content: "Como o MV Broker trata segurança, privacidade e proteção de dados dos seus clientes e imóveis." },
      { property: "og:title", content: "Central de Confiança — MV Broker" },
      { property: "og:description", content: "Segurança, privacidade e proteção de dados no MV Broker." },
    ],
  }),
  component: TrustPage,
});

function Section({
  icon: Icon, title, children,
}: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-6 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-primary/10 text-primary p-2">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}

function TrustPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-foreground">MV Broker</Link>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Acessar</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
            <Shield className="h-3.5 w-3.5" /> Central de Confiança
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Segurança e privacidade no MV Broker</h1>
          <p className="text-muted-foreground">
            Esta página é mantida pelo time do MV Broker para responder perguntas comuns sobre segurança,
            privacidade e tratamento de dados na plataforma. O conteúdo é editorial e não representa uma
            certificação independente.
          </p>
        </div>

        <Section icon={Lock} title="Acesso e autenticação">
          <p>
            O acesso à plataforma exige autenticação por e-mail e senha. Sessões são gerenciadas pelo
            provedor de autenticação da nossa infraestrutura, com tokens de curta duração e renovação
            automática.
          </p>
          <p>
            Cada usuário tem papéis e permissões específicas (super admin, secretaria, imobiliária,
            corretor) que controlam o que pode ver, criar, editar ou excluir.
          </p>
        </Section>

        <Section icon={Database} title="Armazenamento e isolamento de dados">
          <p>
            Os dados de imóveis, clientes, empreendimentos e usuários ficam em um banco de dados gerenciado
            com políticas de segurança no nível de linha (RLS) ativadas. Isso significa que cada requisição
            é avaliada contra o papel e o vínculo do usuário antes de retornar qualquer registro.
          </p>
          <p>
            Arquivos (fotos de imóveis, documentos, plantas) são armazenados em buckets privados, servidos
            por URLs assinadas com validade limitada.
          </p>
        </Section>

        <Section icon={UserCheck} title="Dados que coletamos">
          <p>
            Coletamos apenas o necessário para operar o sistema: nome, e-mail, telefone e papel do usuário;
            dados dos imóveis cadastrados pela imobiliária; e dados de clientes registrados pelos corretores
            (com base nas obrigações de cada conta).
          </p>
          <p>
            Não vendemos dados pessoais. O acesso a dados de clientes está restrito ao corretor responsável,
            sua imobiliária e administradores da plataforma.
          </p>
        </Section>

        <Section icon={FileText} title="Retenção e exclusão">
          <p>
            Registros podem ser arquivados pelos próprios usuários e excluídos por administradores. A
            exclusão de conta de usuário ou imobiliária pode ser solicitada pelos canais abaixo.
          </p>
          <p>
            Logs de auditoria (quem acessou ou alterou o quê) são mantidos para investigação de incidentes
            e podem ser consultados pelos administradores da conta.
          </p>
        </Section>

        <Section icon={AlertCircle} title="Comunicação de incidentes e vulnerabilidades">
          <p>
            Se você encontrou uma falha de segurança ou suspeita de acesso indevido, escreva para o
            contato abaixo descrevendo o cenário. Vamos responder o quanto antes e, quando aplicável,
            comunicar pessoas e organizações afetadas.
          </p>
        </Section>

        <Section icon={Mail} title="Contato">
          <p>
            Dúvidas sobre privacidade, exclusão de dados ou relato de incidente: fale com o administrador
            da sua imobiliária ou com o time do MV Broker pelo canal informado no cadastro da sua conta.
          </p>
        </Section>

        <p className="text-xs text-muted-foreground text-center pt-4">
          Este conteúdo é editado pelo MV Broker e pode ser atualizado sem aviso prévio.
        </p>
      </main>
    </div>
  );
}
