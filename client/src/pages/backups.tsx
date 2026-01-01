import { useFiles, useDeleteFile } from "@/hooks/use-files";
import { useEquipment } from "@/hooks/use-equipment";
import { Button } from "@/components/ui/button";
import { Download, Trash2, FileText, Calendar, HardDrive, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function BackupsPage() {
  const { data: files, isLoading } = useFiles();
  const { data: equipment } = useEquipment();
  const [searchTerm, setSearchTerm] = useState("");
  const { mutate: deleteFile } = useDeleteFile();
  const { toast } = useToast();

  const getEquipmentName = (id: number | null) => {
    if (!id) return "Desconhecido";
    return equipment?.find(e => e.id === id)?.name || "Desconhecido";
  };

  const filteredFiles = files?.filter(file => 
    file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getEquipmentName(file.equipmentId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id: number) => {
    deleteFile(id, {
      onSuccess: () => toast({ title: "Arquivo excluído", description: "Backup removido com sucesso." }),
      onError: () => toast({ title: "Erro", description: "Não foi possível excluir o arquivo.", variant: "destructive" })
    });
  };

  const handleDownload = (id: number, filename: string) => {
    // In a real app, this would get a signed URL or trigger a download
    // For MVP, we'll assume a direct route
    window.open(`/api/files/${id}/download`, '_blank');
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Backups</h1>
          <p className="text-muted-foreground">Gerencie os arquivos de backup armazenados</p>
        </div>
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar backups..." 
            className="pl-9 md:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFiles?.map((file) => (
          <Card key={file.id} className="group hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base font-medium line-clamp-1" title={file.filename}>
                    {file.filename}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Equipamento:</span>
                  <span className="font-medium">{getEquipmentName(file.equipmentId)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Data:
                  </span>
                  <span>
                    {file.createdAt ? format(new Date(file.createdAt), "dd/MM/yyyy HH:mm") : "-"}
                  </span>
                </div>
                
                <div className="pt-2 flex gap-2">
                  <Button 
                    className="flex-1" 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDownload(file.id, file.filename)}
                  >
                    <Download className="h-4 w-4 mr-2" /> Download
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Backup?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação excluirá permanentemente o arquivo <strong>{file.filename}</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          className="bg-red-600 hover:bg-red-700" 
                          onClick={() => handleDelete(file.id)}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {!filteredFiles?.length && !isLoading && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <HardDrive className="h-12 w-12 mb-4 opacity-20" />
            <p>Nenhum backup encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
