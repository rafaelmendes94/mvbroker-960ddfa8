import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, Home, Building, Building2 } from "lucide-react";
import { MvBrokerImportPage } from "@/components/import/MvBrokerImport";
import { ImportPage } from "@/components/import/ImportPage";
import {
  IMOVEIS_FIELDS_UNIQUE,
  CONDOMINIOS_FIELDS,
  EDIFICIOS_FIELDS,
} from "@/lib/import-schemas";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ImportacoesModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importações</DialogTitle>
          <DialogDescription>
            Importe dados em massa via CSV ou Excel.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="mv-broker" className="mt-2">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto">
            <TabsTrigger value="mv-broker" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> MV Broker
            </TabsTrigger>
            <TabsTrigger value="imoveis" className="gap-2">
              <Home className="h-4 w-4" /> Imóveis
            </TabsTrigger>
            <TabsTrigger value="condominios" className="gap-2">
              <Building className="h-4 w-4" /> Condomínios
            </TabsTrigger>
            <TabsTrigger value="edificios" className="gap-2">
              <Building2 className="h-4 w-4" /> Edifícios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mv-broker" className="mt-4">
            <MvBrokerImportPage />
          </TabsContent>
          <TabsContent value="imoveis" className="mt-4">
            <ImportPage
              title="Importar Imóveis"
              description="Envie o arquivo e faça o mapeamento das colunas para os campos do sistema."
              table="imoveis"
              fields={IMOVEIS_FIELDS_UNIQUE}
              templateName="modelo-imoveis"
              showMapper
            />
          </TabsContent>
          <TabsContent value="condominios" className="mt-4">
            <ImportPage
              title="Importar Condomínios"
              description="Envie um CSV ou Excel com a lista de condomínios."
              table="condominios"
              fields={CONDOMINIOS_FIELDS}
              templateName="modelo-condominios"
            />
          </TabsContent>
          <TabsContent value="edificios" className="mt-4">
            <ImportPage
              title="Importar Edifícios"
              description="Envie um CSV ou Excel com a lista de edifícios."
              table="edificios"
              fields={EDIFICIOS_FIELDS}
              templateName="modelo-edificios"
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
