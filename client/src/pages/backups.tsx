import { useFiles, useDeleteFile } from "@/hooks/use-files";
import { useEquipment } from "@/hooks/use-equipment";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Download, Trash2, FileText, Calendar, HardDrive, Search, Eye, Loader2, Server, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Manufacturer, Equipment } from "@shared/schema";

interface BackupContent {
  success: boolean;
  filename: string;
  size: number;
  content: string;
  truncated: boolean;
  totalSize: number;
}

export default function BackupsPage() {
  const { data: files, isLoading } = useFiles();
  const { data: equipment } = useEquipment();
  const { data: manufacturers = [] } = useQuery<Manufacturer[]>({
    queryKey: ["/api/manufacturers"],
  });
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const { mutate: deleteFile } = useDeleteFile();
  const { toast } = useToast();
  const [selectedBackups, setSelectedBackups] = useState<Set<number>>(new Set());
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingBackup, setViewingBackup] = useState<{ id: number; filename: string } | null>(null);
  const [backupContent, setBackupContent] = useState<BackupContent | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const getEquipment = (id: number | null): Equipment | undefined => {
    if (!id) return undefined;
    return equipment?.find(e => e.id === id);
  };

  const getEquipmentName = (id: number | null) => {
    const eq = getEquipment(id);
    return eq?.name || "Desconhecido";
  };

  const getEquipmentManufacturer = (id: number | null) => {
    const eq = getEquipment(id);
    return eq?.manufacturer || "";
  };

  const getEquipmentModel = (id: number | null) => {
    const eq = getEquipment(id);
    return eq?.model || "";
  };

  const uniqueModels = Array.from(
    new Set(
      equipment
        ?.map((e) => e.model)
        .filter((m): m is string => m !== null && m !== undefined)
    )
  );

  const filteredFiles = files?.filter(file => {
    const matchesSearch = 
      file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getEquipmentName(file.equipmentId).toLowerCase().includes(searchTerm.toLowerCase());
    
    const equipManufacturer = getEquipmentManufacturer(file.equipmentId);
    const matchesManufacturer = selectedManufacturer === "all" || equipManufacturer === selectedManufacturer;
    
    const equipModel = getEquipmentModel(file.equipmentId);
    const matchesModel = selectedModel === "all" || equipModel === selectedModel;
    
    return matchesSearch && matchesManufacturer && matchesModel;
  });

  const handleDelete = (id: number) => {
    deleteFile(id, {
      onSuccess: () => {
        toast({ title: "Arquivo excluído", description: "Backup removido com sucesso." });
        setSelectedBackups(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível excluir o arquivo.", variant: "destructive" })
    });
  };

  const handleBulkDelete = async () => {
    setIsDeletingBulk(true);
    const ids = Array.from(selectedBackups);
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of ids) {
      try {
        const response = await fetch(`/api/backups/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }
    
    setIsDeletingBulk(false);
    setBulkDeleteOpen(false);
    setSelectedBackups(new Set());
    
    queryClient.invalidateQueries({ queryKey: ["/api/files"] });
    
    if (successCount > 0) {
      toast({ 
        title: `${successCount} backup(s) excluído(s)`, 
        description: errorCount > 0 ? `${errorCount} falha(s)` : "Backups removidos com sucesso." 
      });
    } else if (errorCount > 0) {
      toast({ 
        title: "Erro ao excluir backups", 
        description: `${errorCount} falha(s) durante a exclusão`,
        variant: "destructive"
      });
    }
  };

  const handleDownload = (id: number, filename: string) => {
    window.open(`/api/backups/${id}/download`, '_blank');
  };

  const handleView = async (id: number, filename: string, full: boolean = true) => {
    setViewingBackup({ id, filename });
    setViewDialogOpen(true);
    setIsLoadingContent(true);
    setBackupContent(null);
    
    try {
      const response = await fetch(`/api/backups/${id}/view?full=${full}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setBackupContent(data);
      } else {
        toast({ title: "Erro ao carregar conteúdo", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao carregar conteúdo", variant: "destructive" });
    } finally {
      setIsLoadingContent(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedBackups(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filteredFiles) return;
    if (selectedBackups.size === filteredFiles.length) {
      setSelectedBackups(new Set());
    } else {
      setSelectedBackups(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const getManufacturerLabel = (value: string) => {
    return manufacturers.find(m => m.value === value)?.label || value;
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Backups</h1>
          <p className="text-muted-foreground">Gerencie os arquivos de backup armazenados</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou equipamento..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-backups"
          />
        </div>
        
        <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
          <SelectTrigger className="w-full md:w-[180px]" data-testid="select-manufacturer">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Fabricante" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Fabricantes</SelectItem>
            {manufacturers.map((mfr) => (
              <SelectItem key={mfr.value} value={mfr.value}>
                {mfr.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-full md:w-[180px]" data-testid="select-model">
            <Server className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Modelo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Modelos</SelectItem>
            {uniqueModels.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredFiles && filteredFiles.length > 0 && (
        <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={selectedBackups.size === filteredFiles.length && filteredFiles.length > 0}
              onCheckedChange={toggleSelectAll}
              data-testid="checkbox-select-all"
            />
            <span className="text-sm text-muted-foreground">
              {selectedBackups.size > 0 
                ? `${selectedBackups.size} de ${filteredFiles.length} selecionado(s)`
                : `${filteredFiles.length} backup(s) disponível(is)`
              }
            </span>
          </div>
          {selectedBackups.size > 0 && (
            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Selecionados ({selectedBackups.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir {selectedBackups.size} Backup(s)?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação excluirá permanentemente os backups selecionados. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeletingBulk}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-red-600 hover:bg-red-700" 
                    onClick={handleBulkDelete}
                    disabled={isDeletingBulk}
                  >
                    {isDeletingBulk ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      'Excluir'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFiles?.map((file) => {
          const eq = getEquipment(file.equipmentId);
          const mfr = manufacturers.find(m => m.value === eq?.manufacturer);
          
          return (
            <Card 
              key={file.id} 
              className={`group transition-colors ${
                selectedBackups.has(file.id) 
                  ? 'border-primary bg-primary/5' 
                  : 'hover:border-primary/50'
              }`}
            >
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex items-center gap-3">
                  <Checkbox 
                    checked={selectedBackups.has(file.id)}
                    onCheckedChange={() => toggleSelection(file.id)}
                    data-testid={`checkbox-backup-${file.id}`}
                  />
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 min-w-0">
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
                  {eq && (
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Fabricante:</span>
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                        style={{ 
                          backgroundColor: mfr?.color ? `${mfr.color}20` : undefined,
                          color: mfr?.color || undefined
                        }}
                      >
                        {mfr?.label || eq.manufacturer}
                      </Badge>
                    </div>
                  )}
                  {eq?.model && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Modelo:</span>
                      <span className="text-xs">{eq.model}</span>
                    </div>
                  )}
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
                      onClick={() => handleView(file.id, file.filename)}
                      data-testid={`button-view-${file.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" /> Visualizar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => handleDownload(file.id, file.filename)}
                      data-testid={`button-download-${file.id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          data-testid={`button-delete-${file.id}`}
                        >
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
          );
        })}
        
        {!filteredFiles?.length && !isLoading && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <HardDrive className="h-12 w-12 mb-4 opacity-20" />
            <p>Nenhum backup encontrado</p>
          </div>
        )}
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingBackup?.filename}
            </DialogTitle>
            <DialogDescription>
              Conteúdo completo do arquivo de backup
              {backupContent && (
                <span className="ml-2 text-muted-foreground">
                  ({(backupContent.totalSize / 1024).toFixed(1)} KB)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] mt-4">
            {isLoadingContent ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando conteúdo...</span>
              </div>
            ) : backupContent ? (
              <pre className="text-sm font-mono bg-muted/50 p-4 rounded-lg whitespace-pre-wrap break-words">
                {backupContent.content}
              </pre>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Não foi possível carregar o conteúdo
              </div>
            )}
          </ScrollArea>
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              variant="outline"
              onClick={() => viewingBackup && handleDownload(viewingBackup.id, viewingBackup.filename)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedBackups.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {selectedBackups.size} selecionado(s)
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {selectedBackups.size === 1 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const id = Array.from(selectedBackups)[0];
                    const file = files?.find(f => f.id === id);
                    if (file) handleView(id, file.filename);
                  }}
                  data-testid="button-fixed-view"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar
                </Button>
              )}
              {selectedBackups.size === 1 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const id = Array.from(selectedBackups)[0];
                    const file = files?.find(f => f.id === id);
                    if (file) handleDownload(id, file.filename);
                  }}
                  data-testid="button-fixed-download"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
              <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive"
                    data-testid="button-fixed-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir ({selectedBackups.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {selectedBackups.size} Backup(s)?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação excluirá permanentemente os backups selecionados. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingBulk}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-red-600 hover:bg-red-700" 
                      onClick={handleBulkDelete}
                      disabled={isDeletingBulk}
                    >
                      {isDeletingBulk ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Excluindo...
                        </>
                      ) : (
                        'Excluir'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="ghost"
                onClick={() => setSelectedBackups(new Set())}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
