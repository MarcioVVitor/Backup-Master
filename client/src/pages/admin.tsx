import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  User as UserIcon, 
  Settings, 
  Database, 
  Download, 
  Upload, 
  Server,
  Palette,
  Save,
  HardDrive,
  Users,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Shield,
  Eye,
  Edit
} from "lucide-react";

interface User {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  role: string | null;
  isAdmin: boolean;
  createdAt: string | null;
}

interface SystemInfo {
  version: string;
  nodeVersion: string;
  environment: string;
  equipmentCount: number;
  backupCount: number;
}

interface Customization {
  serverIp: string;
  systemName: string;
  primaryColor: string;
  logoUrl: string;
}

const PERMISSION_LEVELS = [
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema", icon: Shield, color: "text-red-500" },
  { value: "operator", label: "Operador", description: "Pode executar backups e gerenciar equipamentos", icon: Edit, color: "text-blue-500" },
  { value: "viewer", label: "Visualizador", description: "Apenas visualização", icon: Eye, color: "text-green-500" },
];

export default function AdminPage() {
  const { toast } = useToast();
  
  const [serverIp, setServerIp] = useState("");
  const [systemName, setSystemName] = useState("NBM");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [logoUrl, setLogoUrl] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  const { data: customization } = useQuery<Customization>({
    queryKey: ["/api/admin/customization"],
  });

  const { data: systemInfo } = useQuery<SystemInfo>({
    queryKey: ["/api/admin/system-info"],
  });

  useEffect(() => {
    if (customization) {
      if (customization.serverIp) setServerIp(customization.serverIp);
      if (customization.systemName) setSystemName(customization.systemName);
      if (customization.primaryColor) setPrimaryColor(customization.primaryColor);
      if (customization.logoUrl) setLogoUrl(customization.logoUrl);
    }
  }, [customization]);

  const createUser = useMutation({
    mutationFn: async (data: { username: string; password: string; email?: string; role: string; isAdmin: boolean }) => {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreateUserOpen(false);
      resetCreateForm();
      toast({ title: "Usuário criado com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erro ao criar usuário", variant: "destructive" });
    }
  });

  const deleteUser = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to delete user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Usuário removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover usuário", variant: "destructive" });
    }
  });

  const updateUserRole = useMutation({
    mutationFn: async (data: { id: number; role: string; isAdmin: boolean }) => {
      const response = await fetch(`/api/admin/users/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: data.role, isAdmin: data.isAdmin })
      });
      if (!response.ok) throw new Error("Failed to update user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Usuário atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar usuário", variant: "destructive" });
    }
  });

  const saveCustomization = useMutation({
    mutationFn: async (data: Partial<Customization>) => {
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

  const resetCreateForm = () => {
    setNewUsername("");
    setNewPassword("");
    setNewEmail("");
    setNewRole("viewer");
    setNewIsAdmin(false);
  };

  const handleCreateUser = () => {
    if (newUsername && newPassword) {
      createUser.mutate({
        username: newUsername,
        password: newPassword,
        email: newEmail || undefined,
        role: newRole,
        isAdmin: newIsAdmin
      });
    }
  };

  const handleDeleteUser = (id: number, username: string) => {
    if (confirm(`Tem certeza que deseja remover o usuário "${username}"?`)) {
      deleteUser.mutate(id);
    }
  };

  const handleRoleChange = (userId: number, role: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      updateUserRole.mutate({ id: userId, role, isAdmin: user.isAdmin });
    }
  };

  const handleAdminToggle = (userId: number, isAdmin: boolean) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      updateUserRole.mutate({ id: userId, role: user.role || "viewer", isAdmin });
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

  const getRoleBadge = (role: string | null) => {
    const level = PERMISSION_LEVELS.find(l => l.value === role);
    if (!level) return <Badge variant="outline">Desconhecido</Badge>;
    const Icon = level.icon;
    return (
      <Badge variant="outline" className={`${level.color} border-current`}>
        <Icon className="h-3 w-3 mr-1" />
        {level.label}
      </Badge>
    );
  };

  const isAccessDenied = usersError && (usersError as any)?.message?.includes("403");

  return (
    <div className="p-6 md:p-8 space-y-6">
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
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Usuários</CardTitle>
                <CardDescription>Gerencie quem tem acesso ao sistema</CardDescription>
              </div>
              <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-user">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      Adicione um novo usuário ao sistema com as permissões desejadas
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="newUsername">Nome de Usuário</Label>
                      <Input 
                        id="newUsername"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="usuario123"
                        data-testid="input-new-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Senha</Label>
                      <Input 
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Senha segura"
                        data-testid="input-new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newEmail">Email (opcional)</Label>
                      <Input 
                        id="newEmail"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        data-testid="input-new-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nível de Permissão</Label>
                      <div className="space-y-2">
                        {PERMISSION_LEVELS.map((level) => {
                          const Icon = level.icon;
                          return (
                            <div 
                              key={level.value}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                newRole === level.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                              }`}
                              onClick={() => setNewRole(level.value)}
                              data-testid={`option-role-${level.value}`}
                            >
                              <Icon className={`h-5 w-5 ${level.color}`} />
                              <div className="flex-1">
                                <p className="font-medium text-sm">{level.label}</p>
                                <p className="text-xs text-muted-foreground">{level.description}</p>
                              </div>
                              <div className={`w-4 h-4 rounded-full border-2 ${
                                newRole === level.value ? 'border-primary bg-primary' : 'border-muted-foreground'
                              }`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">Acesso Administrativo</p>
                        <p className="text-xs text-muted-foreground">Permite gerenciar outros usuários</p>
                      </div>
                      <Switch 
                        checked={newIsAdmin} 
                        onCheckedChange={setNewIsAdmin}
                        data-testid="switch-new-admin"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setCreateUserOpen(false); resetCreateForm(); }}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateUser} 
                      disabled={!newUsername || !newPassword || createUser.isPending}
                      data-testid="button-confirm-create-user"
                    >
                      {createUser.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Criar Usuário
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : isAccessDenied ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
                  <p className="text-lg font-medium">Acesso Restrito</p>
                  <p className="text-muted-foreground">Apenas administradores podem gerenciar usuários</p>
                </div>
              ) : users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Permissão</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-muted rounded-full">
                              <UserIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <p>{user.username}</p>
                              {user.name && <p className="text-xs text-muted-foreground">{user.name}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email || "-"}</TableCell>
                        <TableCell>
                          <Select 
                            defaultValue={user.role || "viewer"} 
                            onValueChange={(val) => handleRoleChange(user.id, val)}
                          >
                            <SelectTrigger className="w-[140px] h-8" data-testid={`select-role-${user.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PERMISSION_LEVELS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                  {level.label}
                                </SelectItem>
                              ))}
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
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum usuário encontrado</p>
                  <p className="text-sm">Clique em "Novo Usuário" para adicionar</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Níveis de Permissão
              </CardTitle>
              <CardDescription>Entenda o que cada nível de acesso permite</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {PERMISSION_LEVELS.map((level) => {
                  const Icon = level.icon;
                  return (
                    <div key={level.value} className="p-4 rounded-lg border bg-muted/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`h-5 w-5 ${level.color}`} />
                        <p className="font-semibold">{level.label}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{level.description}</p>
                    </div>
                  );
                })}
              </div>
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
                    {systemInfo?.version || "17.0.0"}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Node.js</p>
                  <p className="text-lg font-semibold" data-testid="text-node-version">
                    {systemInfo?.nodeVersion || "N/A"}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Ambiente</p>
                  <p className="text-lg font-semibold" data-testid="text-environment">
                    {systemInfo?.environment || "production"}
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
                    {systemInfo?.equipmentCount || "0"}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total de Backups</p>
                  <p className="text-lg font-semibold" data-testid="text-backup-count">
                    {systemInfo?.backupCount || "0"}
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
