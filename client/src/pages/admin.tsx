import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Database, Download, HardDrive, RefreshCw, Settings, Upload, Package, CheckCircle, AlertCircle, Clock, FileJson, Archive } from "lucide-react";

interface SystemInfo {
  version: string;
  dbSize: string;
  totalEquipment: number;
  totalBackups: number;
  totalScripts: number;
  lastBackup: string | null;
}

interface UpdateInfo {
  id: number;
  version: string;
  description: string;
  appliedAt: string;
  appliedBy: string;
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [patchNotes, setPatchNotes] = useState("");
  const [patchVersion, setPatchVersion] = useState("");

  const { data: systemInfo, isLoading: infoLoading } = useQuery<SystemInfo>({
    queryKey: ['/api/admin/system-info'],
    enabled: !!user,
  });

  const { data: updates } = useQuery<UpdateInfo[]>({
    queryKey: ['/api/admin/updates'],
    enabled: !!user,
  });

  const exportDbMutation = useMutation({
    mutationFn: async () => {
      setIsExporting(true);
      setExportProgress(10);
      const response = await fetch('/api/admin/export-database', {
        method: 'POST',
        credentials: 'include',
      });
      setExportProgress(50);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      setExportProgress(80);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nbm-database-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setExportProgress(100);
      return true;
    },
    onSuccess: () => {
      toast({ title: "Backup do banco de dados exportado com sucesso" });
      setIsExporting(false);
      setExportProgress(0);
    },
    onError: () => {
      toast({ title: "Erro ao exportar banco de dados", variant: "destructive" });
      setIsExporting(false);
      setExportProgress(0);
    },
  });

  const exportFullMutation = useMutation({
    mutationFn: async () => {
      setIsExporting(true);
      setExportProgress(10);
      const response = await fetch('/api/admin/export-full', {
        method: 'POST',
        credentials: 'include',
      });
      setExportProgress(50);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      setExportProgress(80);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nbm-full-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setExportProgress(100);
      return true;
    },
    onSuccess: () => {
      toast({ title: "Backup completo exportado com sucesso" });
      setIsExporting(false);
      setExportProgress(0);
    },
    onError: () => {
      toast({ title: "Erro ao exportar backup completo", variant: "destructive" });
      setIsExporting(false);
      setExportProgress(0);
    },
  });

  const importDbMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('backup', file);
      const response = await fetch('/api/admin/import-database', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) throw new Error('Import failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Banco de dados restaurado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao restaurar banco de dados", variant: "destructive" });
    },
  });

  const applyPatchMutation = useMutation({
    mutationFn: async (data: { version: string; description: string }) => {
      return apiRequest('POST', '/api/admin/apply-patch', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/updates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-info'] });
      toast({ title: "Atualizacao aplicada com sucesso" });
      setPatchVersion("");
      setPatchNotes("");
    },
    onError: () => {
      toast({ title: "Erro ao aplicar atualizacao", variant: "destructive" });
    },
  });

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importDbMutation.mutate(file);
    }
  };

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
            <Settings className="h-6 w-6" />
            Administracao do Sistema
          </h1>
          <p className="text-muted-foreground">Backup, restauracao e atualizacoes do sistema</p>
        </div>
        <Badge variant="outline" className="text-sm">
          Versao: {systemInfo?.version || '1.0.0'}
        </Badge>
      </div>

      <Tabs defaultValue="backup" className="space-y-4">
        <TabsList>
          <TabsTrigger value="backup" data-testid="tab-backup">
            <Database className="h-4 w-4 mr-2" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="restore" data-testid="tab-restore">
            <Upload className="h-4 w-4 mr-2" />
            Restaurar
          </TabsTrigger>
          <TabsTrigger value="updates" data-testid="tab-updates">
            <Package className="h-4 w-4 mr-2" />
            Atualizacoes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-500" />
                  Backup do Banco de Dados
                </CardTitle>
                <CardDescription>
                  Exporta todos os dados do banco de dados (equipamentos, backups, scripts, fabricantes)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {infoLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Equipamentos:</div>
                    <div className="font-medium">{systemInfo?.totalEquipment || 0}</div>
                    <div className="text-muted-foreground">Backups:</div>
                    <div className="font-medium">{systemInfo?.totalBackups || 0}</div>
                    <div className="text-muted-foreground">Scripts:</div>
                    <div className="font-medium">{systemInfo?.totalScripts || 0}</div>
                  </div>
                )}
                {isExporting && (
                  <div className="space-y-2">
                    <Progress value={exportProgress} />
                    <p className="text-xs text-muted-foreground text-center">Exportando...</p>
                  </div>
                )}
                <Button
                  onClick={() => exportDbMutation.mutate()}
                  disabled={exportDbMutation.isPending || isExporting}
                  className="w-full"
                  data-testid="button-export-database"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Banco de Dados
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-green-500" />
                  Backup Completo do Sistema
                </CardTitle>
                <CardDescription>
                  Exporta todos os dados incluindo configuracoes para migracao completa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Inclui:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Banco de dados completo</li>
                    <li>Scripts customizados</li>
                    <li>Configuracoes de fabricantes</li>
                    <li>Historico de atualizacoes</li>
                  </ul>
                </div>
                {isExporting && (
                  <div className="space-y-2">
                    <Progress value={exportProgress} />
                    <p className="text-xs text-muted-foreground text-center">Exportando...</p>
                  </div>
                )}
                <Button
                  onClick={() => exportFullMutation.mutate()}
                  disabled={exportFullMutation.isPending || isExporting}
                  className="w-full"
                  data-testid="button-export-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Backup Completo
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="restore" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-orange-500" />
                Restaurar Backup
              </CardTitle>
              <CardDescription>
                Restaure um backup anterior do sistema. Isso substituira todos os dados atuais.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                <FileJson className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione um arquivo de backup (.json) para restaurar
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" data-testid="button-restore-database">
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar Arquivo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restaurar Backup</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja restaurar um backup? Isso ira substituir todos os dados atuais do sistema. Esta acao nao pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleFileImport}
                            className="hidden"
                            data-testid="input-import-file"
                          />
                          Continuar
                        </label>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {importDbMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Restaurando backup...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-500" />
                  Aplicar Atualizacao
                </CardTitle>
                <CardDescription>
                  Registre uma nova versao ou patch do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); applyPatchMutation.mutate({ version: patchVersion, description: patchNotes }); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="version">Versao</Label>
                    <Input
                      id="version"
                      placeholder="Ex: 1.2.0"
                      value={patchVersion}
                      onChange={(e) => setPatchVersion(e.target.value)}
                      required
                      data-testid="input-patch-version"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas da Atualizacao</Label>
                    <Textarea
                      id="notes"
                      placeholder="Descreva as mudancas e melhorias..."
                      value={patchNotes}
                      onChange={(e) => setPatchNotes(e.target.value)}
                      rows={4}
                      required
                      data-testid="textarea-patch-notes"
                    />
                  </div>
                  <Button type="submit" disabled={applyPatchMutation.isPending || !patchVersion || !patchNotes} className="w-full" data-testid="button-apply-patch">
                    <Upload className="h-4 w-4 mr-2" />
                    {applyPatchMutation.isPending ? "Aplicando..." : "Aplicar Atualizacao"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Historico de Atualizacoes
                </CardTitle>
                <CardDescription>
                  Registro de todas as atualizacoes aplicadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {!updates?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma atualizacao registrada
                    </p>
                  ) : (
                    updates.map((update) => (
                      <div key={update.id} className="border rounded-md p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">v{update.version}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(update.appliedAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{update.description}</p>
                        <p className="text-xs text-muted-foreground">Por: {update.appliedBy}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
