import { useFirmware, useDeleteFirmware } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, FileCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function FirmwarePage() {
  const { data: firmware, isLoading } = useFirmware();
  const { mutate: deleteFirmware } = useDeleteFirmware();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm("Excluir este firmware?")) {
      deleteFirmware(id, {
        onSuccess: () => toast({ title: "Firmware excluído" })
      });
    }
  };

  // Note: Upload functionality would require ObjectUploader component
  // For now we just show the list structure as requested

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Firmware</h1>
          <p className="text-muted-foreground">Repositório de imagens de sistema</p>
        </div>
        <Button>
          <Upload className="h-4 w-4 mr-2" /> Upload Firmware
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {firmware?.map((fw) => (
          <Card key={fw.id}>
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                  <FileCode className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{fw.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{fw.version}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fabricante:</span>
                  <span className="font-medium uppercase">{fw.manufacturer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tamanho:</span>
                  <span>{(fw.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data:</span>
                  <span>{fw.createdAt ? format(new Date(fw.createdAt), "dd/MM/yyyy") : "-"}</span>
                </div>
                <div className="pt-2 flex justify-end">
                   <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(fw.id)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
         {!firmware?.length && !isLoading && (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <p>Nenhum firmware disponível</p>
          </div>
        )}
      </div>
    </div>
  );
}
