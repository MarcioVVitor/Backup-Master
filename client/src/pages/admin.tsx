import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUsers, useUpdateUserRole } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Shield, 
  User as UserIcon, 
  Settings, 
  Database, 
  Download, 
  Upload, 
  Server,
  Palette,
  Save,
  RefreshCw,
  HardDrive,
  Users,
  Loader2
} from "lucide-react";

export default function AdminPage() {
  const { data: users, isLoading: usersLoading, error: usersError } = useUsers();
  const { mutate: updateUser } = useUpdateUserRole();
  const { toast } = useToast();
  
  if (usersError) {
    console.error("Admin page error:", usersError);
  }
  
  const [serverIp, setServerIp] = useState("");
  const [systemName, setSystemName] = useState("NBM");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [logoUrl, setLogoUrl] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);

  const { data: customization, isLoading: customLoading } = useQuery({
    queryKey: ["/api/admin/customization"],
  });

  const { data: systemInfo } = useQuery({
    queryKey: ["/api/admin/system-info"],
  });

  useEffect(() => {
    if (customization) {
      const c = customization as any;
      if (c.serverIp) setServerIp(c.serverIp);
      if (c.systemName) setSystemName(c.systemName);
      if (c.primaryColor) setPrimaryColor(c.primaryColor);
      if (c.logoUrl) setLogoUrl(c.logoUrl);
    }
  }, [customization]);

  const saveCustomization = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/admin/customization", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customization"] });
      toast({ title: "Configurações salvas com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    }
  });

  const exportDatabase = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/export-database", {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nbm-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Backup exportado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao exportar backup", variant: "destructive" });
    }
  });

  const exportFull = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/export-full", {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nbm-full-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Backup completo exportado" });
    },
    onError: () => {
      toast({ title: "Erro ao exportar backup completo", variant: "destructive" });
    }
  });

  const importDatabase = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("backup", file);
      const response = await fetch("/api/admin/import-database", {
        method: "POST",
        credentials: "include",
        body: formData
      });
      if (!response.ok) throw new Error("Import failed");
      return response.json();
    },
    onSuccess: () => {
      setImportDialogOpen(false);
      setBackupFile(null);
      queryClient.invalidateQueries();
      toast({ title: "Backup importado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao importar backup", variant: "destructive" });
    }
  });

  const handleRoleChange = (userId: number, role: string) => {
    updateUser({ id: userId, role, isAdmin: role === 'admin' }, {
      onSuccess: () => toast({ title: "Permissão atualizada" })
    });
  };

  const handleAdminToggle = (userId: number, isAdmin: boolean) => {
    const user = users?.find(u => u.id === userId);
    if (user) {
      updateUser({ id: userId, role: user.role || 'viewer', isAdmin }, {
        onSuccess: () => toast({ title: "Status de admin atualizado" })
      });
    }
  };

  const handleSaveConfig = () => {
    saveCustomization.mutate({
      serverIp,
      systemName,
      primaryColor,
      logoUrl
    });
  };

  const handleImport = () => {
    if (backupFile) {
      importDatabase.mutate(backupFile);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Administração</h1>
        <p className="text-muted-foreground">Gestão de usuários e configurações do sistema</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="backup" data-testid="tab-backup">
            <Database className="h-4 w-4 mr-2" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Server className="h-4 w-4 mr-2" />
            Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>Gerencie quem tem acesso ao sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-muted rounded-full">
                            <UserIcon className="h-4 w-4" />
                          </div>
                          {user.username}
                        </div>
                      </TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>
                        <Select 
                          defaultValue={user.role || 'viewer'} 
                          onValueChange={(val) => handleRoleChange(user.id, val)}
                        >
                          <SelectTrigger className="w-[130px] h-8" data-testid={`select-role-${user.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="operator">Operador</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch 
                          checked={!!user.isAdmin} 
                          onCheckedChange={(val) => handleAdminToggle(user.id, val)}
                          data-testid={`switch-admin-${user.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Personalização
              </CardTitle>
              <CardDescription>Configure a aparência e identidade do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="systemName">Nome do Sistema</Label>
                  <Input 
                    id="systemName"
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    placeholder="NBM - Network Backup Manager"
                    data-testid="input-system-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serverIp">IP do Servidor</Label>
                  <Input 
                    id="serverIp"
                    value={serverIp}
                    onChange={(e) => setServerIp(e.target.value)}
                    placeholder="172.17.255.250"
                    data-testid="input-server-ip"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Cor Principal</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="primaryColor"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-16 h-9 p-1 cursor-pointer"
                      data-testid="input-primary-color"
                    />
                    <Input 
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">URL do Logo</Label>
                  <Input 
                    id="logoUrl"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://exemplo.com/logo.png"
                    data-testid="input-logo-url"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button 
                  onClick={handleSaveConfig} 
                  disabled={saveCustomization.isPending}
                  data-testid="button-save-config"
                >
                  {saveCustomization.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Exportar Backup
                </CardTitle>
                <CardDescription>Faça backup dos dados do sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Exporte os dados do banco de dados para um arquivo JSON que pode ser restaurado posteriormente.
                </p>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={() => exportDatabase.mutate()} 
                    disabled={exportDatabase.isPending}
                    className="w-full"
                    data-testid="button-export-db"
                  >
                    {exportDatabase.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4 mr-2" />
                    )}
                    Exportar Banco de Dados
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => exportFull.mutate()} 
                    disabled={exportFull.isPending}
                    className="w-full"
                    data-testid="button-export-full"
                  >
                    {exportFull.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <HardDrive className="h-4 w-4 mr-2" />
                    )}
                    Exportar Backup Completo
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Importar Backup
                </CardTitle>
                <CardDescription>Restaure dados de um backup anterior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Importe um arquivo de backup para restaurar os dados do sistema. Esta ação substituirá os dados atuais.
                </p>
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full" data-testid="button-import-dialog">
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Backup
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Importar Backup</DialogTitle>
                      <DialogDescription>
                        Selecione um arquivo de backup para restaurar. Esta ação irá sobrescrever os dados existentes.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="backupFile">Arquivo de Backup</Label>
                        <Input 
                          id="backupFile"
                          type="file"
                          accept=".json"
                          onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
                          data-testid="input-backup-file"
                        />
                      </div>
                      {backupFile && (
                        <p className="text-sm text-muted-foreground">
                          Arquivo selecionado: {backupFile.name}
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleImport} 
                        disabled={!backupFile || importDatabase.isPending}
                        data-testid="button-confirm-import"
                      >
                        {importDatabase.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Importar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Informações do Sistema
              </CardTitle>
              <CardDescription>Detalhes sobre o servidor e ambiente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Versão do Sistema</p>
                  <p className="text-lg font-semibold" data-testid="text-version">
                    {(systemInfo as any)?.version || "17.0.0"}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Node.js</p>
                  <p className="text-lg font-semibold" data-testid="text-node-version">
                    {(systemInfo as any)?.nodeVersion || "N/A"}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Ambiente</p>
                  <p className="text-lg font-semibold" data-testid="text-environment">
                    {(systemInfo as any)?.environment || "production"}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Banco de Dados</p>
                  <p className="text-lg font-semibold" data-testid="text-database">
                    PostgreSQL
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total de Equipamentos</p>
                  <p className="text-lg font-semibold" data-testid="text-equipment-count">
                    {(systemInfo as any)?.equipmentCount || "0"}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total de Backups</p>
                  <p className="text-lg font-semibold" data-testid="text-backup-count">
                    {(systemInfo as any)?.backupCount || "0"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
