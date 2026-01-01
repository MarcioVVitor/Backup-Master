import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Download, Trash2, Eye, HardDrive, Search, Upload, FileText } from "lucide-react";
import { filesize } from "filesize";
import { SUPPORTED_MANUFACTURERS } from "@shared/schema";

interface BackupRecord {
  id: number;
  filename: string;
  size: number;
  status: string | null;
  createdAt: string | null;
  equipmentName?: string;
  manufacturer?: string;
  ip?: string;
}

const manufacturerColors: Record<string, string> = {
  mikrotik: "bg-red-500 text-white",
  huawei: "bg-pink-500 text-white",
  cisco: "bg-blue-600 text-white",
  nokia: "bg-indigo-700 text-white",
  zte: "bg-cyan-500 text-white",
  datacom: "bg-teal-500 text-white",
  "datacom-dmos": "bg-teal-600 text-white",
  juniper: "bg-green-600 text-white",
};

export default function BackupsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("");
  const [viewContent, setViewContent] = useState<{ filename: string; content: string; truncated: boolean } | null>(null);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: backupsData, isLoading } = useQuery<{ success: boolean; total: number; backups: BackupRecord[] }>({
    queryKey: ['/api/backups'],
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/backups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: "Backup excluido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir backup", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/backups', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: "Backup enviado com sucesso" });
      setUploadDialogOpen(false);
      setSelectedFile(null);
    },
    onError: () => {
      toast({ title: "Erro ao enviar backup", variant: "destructive" });
    },
  });

  const handleDownload = (backup: BackupRecord) => {
    window.open(`/api/backups/${backup.id}/download`, '_blank');
  };

  const handleView = async (backup: BackupRecord) => {
    setIsViewLoading(true);
    try {
      const response = await fetch(`/api/backups/${backup.id}/view`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setViewContent({
          filename: data.filename,
          content: data.content,
          truncated: data.truncated,
        });
      } else {
        toast({ title: "Erro ao visualizar backup", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao visualizar backup", variant: "destructive" });
    } finally {
      setIsViewLoading(false);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const filteredBackups = backupsData?.backups?.filter((b) => {
    const matchSearch = b.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.equipmentName?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchManufacturer = !manufacturerFilter || b.manufacturer === manufacturerFilter;
    return matchSearch && matchManufacturer;
  }) || [];

  if (authLoading) {
    return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  }

  if (!user) {
    window.location.href = '/api/login';
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="h-6 w-6" />
            Backups
          </h1>
          <p className="text-muted-foreground">Visualize e gerencie os backups</p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-backup">
          <Upload className="mr-2 h-4 w-4" />
          Upload Manual
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar backups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-backups"
          />
        </div>
        <Select value={manufacturerFilter || "all"} onValueChange={(v) => setManufacturerFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48" data-testid="select-manufacturer-filter">
            <SelectValue placeholder="Todos Fabricantes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Fabricantes</SelectItem>
            {SUPPORTED_MANUFACTURERS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : !filteredBackups.length ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhum backup encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBackups.map((backup) => (
                  <TableRow key={backup.id} data-testid={`row-backup-${backup.id}`}>
                    <TableCell className="font-medium">{backup.equipmentName || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {backup.filename}
                      </div>
                    </TableCell>
                    <TableCell>
                      {backup.manufacturer ? (
                        <Badge className={manufacturerColors[backup.manufacturer] || 'bg-gray-500 text-white'}>
                          {backup.manufacturer}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{filesize(backup.size)}</TableCell>
                    <TableCell>
                      <Badge variant={backup.status === 'success' ? 'default' : 'destructive'}>
                        {backup.status === 'success' ? 'Sucesso' : 'Erro'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {backup.createdAt ? new Date(backup.createdAt).toLocaleString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleView(backup)}
                        disabled={isViewLoading}
                        data-testid={`button-view-backup-${backup.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDownload(backup)}
                        data-testid={`button-download-backup-${backup.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(backup.id)}
                        data-testid={`button-delete-backup-${backup.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload de Backup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              data-testid="input-file-upload"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={!selectedFile || uploadMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadMutation.isPending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewContent} onOpenChange={() => setViewContent(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewContent?.filename}
            </DialogTitle>
          </DialogHeader>
          {viewContent?.truncated && (
            <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 p-2 rounded-md">
              Conteudo truncado (mostrando primeiros 50KB)
            </div>
          )}
          <pre className="bg-muted p-4 rounded-md text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap">
            {viewContent?.content}
          </pre>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewContent(null)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
