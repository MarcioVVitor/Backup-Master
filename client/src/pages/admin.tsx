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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Database, Download, Upload, Package, Clock, FileJson, Archive, Users, Palette, User as UserIcon, Save, Check, X } from "lucide-react";
import type { User } from "@shared/schema";

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

interface Customization {
  logoUrl: string;
  primaryColor: string;
  systemName: string;
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [patchNotes, setPatchNotes] = useState("");
  const [patchVersion, setPatchVersion] = useState("");
  const [customization, setCustomization] = useState<Customization>({ logoUrl: '', primaryColor: '#0077b6', systemName: 'NBM' });

  const { data: systemInfo, isLoading: infoLoading } = useQuery<SystemInfo>({
    queryKey: ['/api/admin/system-info'],
    enabled: !!user,
  });

  const { data: updates } = useQuery<UpdateInfo[]>({
    queryKey: ['/api/admin/updates'],
    enabled: !!user,
  });

  const { data: usersList, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    enabled: !!user,
  });

  const { data: customizationData } = useQuery<Customization>({
    queryKey: ['/api/admin/customization'],
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

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<{ role: string; active: boolean }> }) => {
      return apiRequest('PUT', `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Usuario atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar usuario", variant: "destructive" });
    },
  });

  const saveCustomizationMutation = useMutation({
    mutationFn: async (data: Customization) => {
      return apiRequest('POST', '/api/admin/customization', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/customization'] });
      toast({ title: "Personalizacao salva com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar personalizacao", variant: "destructive" });
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
            <Database className="h-6 w-6" />
            Administracao do Sistema
          </h1>
          <p className="text-muted-foreground">Gerenciamento completo do sistema NBM</p>
        </div>
        <Badge variant="outline" className="text-sm">
          Versao: {systemInfo?.version || '1.0.0'}
        </Badge>
      </div>

      <Tabs defaultValue="backup" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="backup" data-testid="tab-backup">
            <Database className="h-4 w-4 mr-2" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="updates" data-testid="tab-updates">
            <Package className="h-4 w-4 mr-2" />
            Atualizacoes
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="customization" data-testid="tab-customization">
            <Palette className="h-4 w-4 mr-2" />
            Personalizacao
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-500" />
                  Exportar Backup
                </CardTitle>
                <CardDescription>
                  Exporta todos os dados do banco de dados
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
                <div className="flex gap-2">
                  <Button
                    onClick={() => exportDbMutation.mutate()}
                    disabled={exportDbMutation.isPending || isExporting}
                    className="flex-1"
                    data-testid="button-export-database"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Banco de Dados
                  </Button>
                  <Button
                    onClick={() => exportFullMutation.mutate()}
                    disabled={exportFullMutation.isPending || isExporting}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-export-full"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Backup Completo
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-orange-500" />
                  Restaurar Backup
                </CardTitle>
                <CardDescription>
                  Restaure um backup anterior do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                  <FileJson className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Selecione um arquivo .json
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" data-testid="button-restore-database">
                        <Upload className="h-4 w-4 mr-2" />
                        Restaurar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restaurar Backup</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acao ira substituir todos os dados atuais. Deseja continuar?
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="updates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-500" />
                  Registrar Atualizacao
                </CardTitle>
                <CardDescription>
                  Registre uma nova versao ou patch
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
                    <Label htmlFor="notes">Notas</Label>
                    <Textarea
                      id="notes"
                      placeholder="Descreva as mudancas..."
                      value={patchNotes}
                      onChange={(e) => setPatchNotes(e.target.value)}
                      rows={3}
                      required
                      data-testid="textarea-patch-notes"
                    />
                  </div>
                  <Button type="submit" disabled={applyPatchMutation.isPending || !patchVersion || !patchNotes} className="w-full" data-testid="button-apply-patch">
                    {applyPatchMutation.isPending ? "Aplicando..." : "Aplicar"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Historico
                </CardTitle>
                <CardDescription>
                  Atualizacoes aplicadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {!updates?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma atualizacao
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

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                Gerenciamento de Usuarios
              </CardTitle>
              <CardDescription>
                Gerencie usuarios e permissoes do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    {usersList?.map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-4 p-4 border rounded-lg" data-testid={`row-user-${u.id}`}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <UserIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{u.name || u.username}</p>
                            <p className="text-sm text-muted-foreground truncate">{u.email || u.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Select
                            value={u.role || 'viewer'}
                            onValueChange={(value) => updateUserMutation.mutate({ id: u.id, data: { role: value } })}
                          >
                            <SelectTrigger className="w-32" data-testid={`select-role-${u.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="operator">Operador</SelectItem>
                              <SelectItem value="viewer">Visualizador</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Ativo</span>
                            <Switch
                              checked={u.active !== false}
                              onCheckedChange={(checked) => updateUserMutation.mutate({ id: u.id, data: { active: checked } })}
                              data-testid={`switch-active-${u.id}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {!usersList?.length && (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum usuario cadastrado
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-pink-500" />
                Personalizacao do Sistema
              </CardTitle>
              <CardDescription>
                Personalize a aparencia do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); saveCustomizationMutation.mutate(customization); }} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="systemName">Nome do Sistema</Label>
                      <Input
                        id="systemName"
                        placeholder="NBM"
                        value={customization.systemName || customizationData?.systemName || ''}
                        onChange={(e) => setCustomization(prev => ({ ...prev, systemName: e.target.value }))}
                        data-testid="input-system-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="logoUrl">URL do Logotipo</Label>
                      <Input
                        id="logoUrl"
                        placeholder="https://exemplo.com/logo.png"
                        value={customization.logoUrl || customizationData?.logoUrl || ''}
                        onChange={(e) => setCustomization(prev => ({ ...prev, logoUrl: e.target.value }))}
                        data-testid="input-logo-url"
                      />
                      <p className="text-xs text-muted-foreground">
                        Insira a URL de uma imagem para usar como logotipo
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="primaryColor">Cor Principal</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primaryColor"
                          type="color"
                          value={customization.primaryColor || customizationData?.primaryColor || '#0077b6'}
                          onChange={(e) => setCustomization(prev => ({ ...prev, primaryColor: e.target.value }))}
                          className="w-16 h-9 p-1"
                          data-testid="input-primary-color"
                        />
                        <Input
                          value={customization.primaryColor || customizationData?.primaryColor || '#0077b6'}
                          onChange={(e) => setCustomization(prev => ({ ...prev, primaryColor: e.target.value }))}
                          placeholder="#0077b6"
                          className="flex-1"
                          data-testid="input-primary-color-hex"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Pre-visualizacao</Label>
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-3">
                        {(customization.logoUrl || customizationData?.logoUrl) ? (
                          <img 
                            src={customization.logoUrl || customizationData?.logoUrl} 
                            alt="Logo" 
                            className="h-10 w-10 object-contain"
                          />
                        ) : (
                          <div 
                            className="h-10 w-10 rounded flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: customization.primaryColor || customizationData?.primaryColor || '#0077b6' }}
                          >
                            {(customization.systemName || customizationData?.systemName || 'NBM').charAt(0)}
                          </div>
                        )}
                        <span className="font-bold text-lg">
                          {customization.systemName || customizationData?.systemName || 'NBM'}
                        </span>
                      </div>
                      <div 
                        className="h-2 rounded"
                        style={{ backgroundColor: customization.primaryColor || customizationData?.primaryColor || '#0077b6' }}
                      />
                      <Button 
                        type="button" 
                        size="sm"
                        style={{ 
                          backgroundColor: customization.primaryColor || customizationData?.primaryColor || '#0077b6',
                          borderColor: customization.primaryColor || customizationData?.primaryColor || '#0077b6'
                        }}
                      >
                        Botao Exemplo
                      </Button>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={saveCustomizationMutation.isPending}
                  data-testid="button-save-customization"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveCustomizationMutation.isPending ? "Salvando..." : "Salvar Personalizacao"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
