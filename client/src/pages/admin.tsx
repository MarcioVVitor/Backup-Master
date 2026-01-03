import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
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
  Edit,
  RefreshCw,
  CheckCircle,
  Clock,
  ArrowUpCircle,
  FileText,
  GitBranch,
  Monitor,
  Image,
  Check,
  Globe
} from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { THEMES } from "@/lib/themes";
import { BACKGROUND_OPTIONS } from "@/lib/os-themes";
import { LANGUAGES } from "@/lib/i18n";

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

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseDate: string | null;
  changelog: string[];
  downloadUrl: string | null;
}

interface UpdateHistory {
  id: number;
  version: string;
  appliedAt: string;
  appliedBy: string;
  status: 'success' | 'failed' | 'pending';
  changelog: string | null;
}

const PERMISSION_LEVELS = [
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema", icon: Shield, color: "text-red-500" },
  { value: "operator", label: "Operador", description: "Pode executar backups e gerenciar equipamentos", icon: Edit, color: "text-blue-500" },
  { value: "viewer", label: "Visualizador", description: "Apenas visualização", icon: Eye, color: "text-green-500" },
];

interface ThemeConfigSectionProps {
  serverIp: string;
  setServerIp: (value: string) => void;
  systemName: string;
  setSystemName: (value: string) => void;
  primaryColor: string;
  setPrimaryColor: (value: string) => void;
  logoUrl: string;
  setLogoUrl: (value: string) => void;
  handleSaveConfig: () => void;
  isSaving: boolean;
}

function ThemeConfigSection({
  serverIp,
  setServerIp,
  systemName,
  setSystemName: setSystemNameLocal,
  primaryColor,
  setPrimaryColor,
  logoUrl,
  setLogoUrl: setLogoUrlLocal,
  handleSaveConfig,
  isSaving
}: ThemeConfigSectionProps) {
  const { 
    themeId, 
    setTheme, 
    backgroundId, 
    setBackground, 
    setLogoUrl: setGlobalLogoUrl,
    setSystemName: setGlobalSystemName 
  } = useTheme();
  const { language, setLanguage, t } = useI18n();

  const handleSystemNameChange = (value: string) => {
    setSystemNameLocal(value);
    setGlobalSystemName(value);
  };

  const handleLogoUrlChange = (value: string) => {
    setLogoUrlLocal(value);
    setGlobalLogoUrl(value);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t.admin.config}
          </CardTitle>
          <CardDescription>{t.admin.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="systemName">{t.admin.systemName}</Label>
              <Input 
                id="systemName"
                value={systemName}
                onChange={(e) => handleSystemNameChange(e.target.value)}
                placeholder="NBM - Network Backup Manager"
                data-testid="input-system-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serverIp">{t.admin.serverIp}</Label>
              <Input 
                id="serverIp"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                placeholder="172.17.255.250"
                data-testid="input-server-ip"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryColor">{t.admin.primaryColor}</Label>
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
              <Label htmlFor="logoUrl">{t.admin.logoUrl}</Label>
              <Input 
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => handleLogoUrlChange(e.target.value)}
                placeholder="https://exemplo.com/logo.png"
                data-testid="input-logo-url"
              />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSaveConfig} 
              disabled={isSaving}
              data-testid="button-save-config"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t.admin.saveConfig}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t.admin.language}
          </CardTitle>
          <CardDescription>{t.admin.selectLanguage}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {LANGUAGES.map((lang) => (
              <div
                key={lang.code}
                className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${
                  language === lang.code 
                    ? 'border-primary bg-primary/5' 
                    : 'border-transparent bg-muted/30 hover:bg-muted/50'
                }`}
                onClick={() => setLanguage(lang.code)}
                data-testid={`language-option-${lang.code}`}
              >
                {language === lang.code && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
                <span className="text-2xl mb-2 block">{lang.flag}</span>
                <p className="font-medium text-sm">{lang.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            {t.admin.themes}
          </CardTitle>
          <CardDescription>{t.admin.selectLanguage}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {THEMES.map((theme) => (
              <div
                key={theme.id}
                className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  themeId === theme.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-transparent bg-muted/30 hover:bg-muted/50'
                }`}
                onClick={() => setTheme(theme.id)}
                data-testid={`theme-option-${theme.id}`}
              >
                {themeId === theme.id && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div 
                  className="h-12 rounded-md mb-2 border"
                  style={{ background: theme.preview.background }}
                >
                  <div className="flex h-full">
                    <div 
                      className="w-1/4 rounded-l-md"
                      style={{ background: theme.preview.sidebar }}
                    />
                    <div className="flex-1 flex items-center justify-center gap-1 p-1">
                      <div 
                        className="w-6 h-2 rounded-full"
                        style={{ background: theme.preview.primary }}
                      />
                      <div 
                        className="w-4 h-2 rounded-full"
                        style={{ background: theme.preview.accent }}
                      />
                    </div>
                  </div>
                </div>
                <p className="font-medium text-sm">{theme.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{theme.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            {t.admin.backgrounds}
          </CardTitle>
          <CardDescription>{t.admin.selectLanguage}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {BACKGROUND_OPTIONS.map((bg) => (
              <div
                key={bg.id}
                className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  backgroundId === bg.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-transparent bg-muted/30 hover:bg-muted/50'
                }`}
                onClick={() => setBackground(bg.id)}
                data-testid={`background-option-${bg.id}`}
              >
                {backgroundId === bg.id && (
                  <div className="absolute top-2 right-2 z-10">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div 
                  className="h-16 rounded-md mb-2 border flex items-center justify-center overflow-hidden"
                  style={bg.type === "gradient" ? { background: bg.value } : { background: '#1a1a2e' }}
                >
                  {bg.type === "static" && bg.id === "none" && (
                    <span className="text-xs text-muted-foreground">Nenhum</span>
                  )}
                  {bg.type === "dynamic" && (
                    <div className="text-xs text-white/80 font-medium">
                      {bg.value === "earth-rotation" && "Terra"}
                      {bg.value === "animated-stars" && "Estrelas"}
                      {bg.value === "matrix-rain" && "Matrix"}
                    </div>
                  )}
                </div>
                <p className="font-medium text-xs text-center">{bg.name}</p>
                <Badge 
                  variant="outline" 
                  className="mt-1 text-[10px] w-full justify-center"
                >
                  {bg.type === "static" ? "Estatico" : bg.type === "gradient" ? "Gradiente" : "Animado"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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

  const { data: updateInfo, isLoading: updateLoading, refetch: refetchUpdate } = useQuery<UpdateInfo>({
    queryKey: ["/api/admin/updates/check"],
    refetchOnWindowFocus: false,
  });

  const { data: updateHistory = [] } = useQuery<UpdateHistory[]>({
    queryKey: ["/api/admin/updates/history"],
  });

  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [uploadedUpdateFile, setUploadedUpdateFile] = useState<File | null>(null);
  const [uploadedManifest, setUploadedManifest] = useState<{ version: string; changelog: string[] } | null>(null);
  const [isUploadingUpdate, setIsUploadingUpdate] = useState(false);

  const applyUpdate = useMutation({
    mutationFn: async () => {
      setIsApplyingUpdate(true);
      const response = await fetch("/api/admin/updates/apply", {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Falha ao aplicar atualização");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setIsApplyingUpdate(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/updates/check"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/updates/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-info"] });
      toast({ 
        title: "Atualização aplicada com sucesso", 
        description: data.message || `Sistema atualizado para versão ${data.version}` 
      });
    },
    onError: (err: Error) => {
      setIsApplyingUpdate(false);
      toast({ title: err.message || "Erro ao aplicar atualização", variant: "destructive" });
    }
  });

  const handleUpdateFileSelect = async (e: { target: { files: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.zip') && !file.name.endsWith('.tar.gz')) {
      toast({ title: "Formato inválido. Use arquivos .zip ou .tar.gz", variant: "destructive" });
      return;
    }
    
    setUploadedUpdateFile(file);
    setUploadedManifest({
      version: file.name.replace(/\.(zip|tar\.gz)$/, '').replace('nbm-update-', ''),
      changelog: ['Atualização via arquivo local']
    });
  };

  const applyFileUpdate = useMutation({
    mutationFn: async () => {
      if (!uploadedUpdateFile) throw new Error("Nenhum arquivo selecionado");
      
      setIsUploadingUpdate(true);
      const formData = new FormData();
      formData.append('file', uploadedUpdateFile);
      
      const response = await fetch("/api/admin/updates/upload", {
        method: "POST",
        credentials: "include",
        body: formData
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Falha ao aplicar atualização");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setIsUploadingUpdate(false);
      setUploadedUpdateFile(null);
      setUploadedManifest(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/updates/check"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/updates/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-info"] });
      toast({ 
        title: "Atualização aplicada com sucesso", 
        description: data.message || `Sistema atualizado para versão ${data.version}` 
      });
    },
    onError: (err: Error) => {
      setIsUploadingUpdate(false);
      toast({ title: err.message || "Erro ao aplicar atualização", variant: "destructive" });
    }
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

  const { t } = useI18n();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.admin.title}</h1>
        <p className="text-muted-foreground">{t.admin.subtitle}</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            {t.admin.users}
          </TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings className="h-4 w-4 mr-2" />
            {t.admin.config}
          </TabsTrigger>
          <TabsTrigger value="backup" data-testid="tab-backup">
            <Database className="h-4 w-4 mr-2" />
            {t.admin.backup}
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Server className="h-4 w-4 mr-2" />
            {t.admin.system}
          </TabsTrigger>
          <TabsTrigger value="updates" data-testid="tab-updates">
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            {t.admin.updates}
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
          <ThemeConfigSection 
            serverIp={serverIp}
            setServerIp={setServerIp}
            systemName={systemName}
            setSystemName={setSystemName}
            primaryColor={primaryColor}
            setPrimaryColor={setPrimaryColor}
            logoUrl={logoUrl}
            setLogoUrl={setLogoUrl}
            handleSaveConfig={handleSaveConfig}
            isSaving={saveCustomization.isPending}
          />
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

        <TabsContent value="updates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5" />
                  Verificar Atualizações
                </CardTitle>
                <CardDescription>Verifique se há novas versões disponíveis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Versão Atual</p>
                    <p className="text-2xl font-bold" data-testid="text-current-version">
                      v{updateInfo?.currentVersion || systemInfo?.version || "17.0.0"}
                    </p>
                  </div>
                  <GitBranch className="h-8 w-8 text-muted-foreground" />
                </div>

                {updateLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Verificando atualizações...</span>
                  </div>
                ) : updateInfo?.hasUpdate ? (
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <ArrowUpCircle className="h-5 w-5" />
                      <span className="font-semibold">Nova versão disponível!</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Versão Disponível</p>
                        <p className="text-xl font-bold" data-testid="text-latest-version">
                          v{updateInfo.latestVersion}
                        </p>
                      </div>
                      {updateInfo.releaseDate && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Data de Lançamento</p>
                          <p className="text-sm font-medium">
                            {new Date(updateInfo.releaseDate).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button 
                      className="w-full"
                      onClick={() => applyUpdate.mutate()}
                      disabled={isApplyingUpdate || applyUpdate.isPending}
                      data-testid="button-apply-update"
                    >
                      {isApplyingUpdate ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Aplicando atualização...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Aplicar Atualização
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">Sistema está atualizado!</span>
                  </div>
                )}

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => refetchUpdate()}
                  disabled={updateLoading}
                  data-testid="button-check-updates"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${updateLoading ? 'animate-spin' : ''}`} />
                  Verificar Atualizações
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Changelog
                </CardTitle>
                <CardDescription>Novidades e correções na versão disponível</CardDescription>
              </CardHeader>
              <CardContent>
                {updateInfo?.changelog && updateInfo.changelog.length > 0 ? (
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {updateInfo.changelog.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nenhuma atualização disponível no momento.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Atualização via Arquivo
              </CardTitle>
              <CardDescription>Faça upload de um pacote de atualização quando o modo online não estiver disponível</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  uploadedUpdateFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
              >
                {uploadedUpdateFile ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">{uploadedUpdateFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(uploadedUpdateFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    {uploadedManifest && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium">Versão detectada: v{uploadedManifest.version}</p>
                      </div>
                    )}
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setUploadedUpdateFile(null);
                          setUploadedManifest(null);
                        }}
                        disabled={isUploadingUpdate}
                        data-testid="button-cancel-file-update"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => applyFileUpdate.mutate()}
                        disabled={isUploadingUpdate || applyFileUpdate.isPending}
                        data-testid="button-apply-file-update"
                      >
                        {isUploadingUpdate ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Aplicando...
                          </>
                        ) : (
                          <>
                            <ArrowUpCircle className="h-4 w-4 mr-2" />
                            Aplicar Atualização
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Arraste um arquivo ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formatos aceitos: .zip, .tar.gz
                    </p>
                    <Input
                      type="file"
                      accept=".zip,.tar.gz"
                      className="hidden"
                      id="update-file-input"
                      onChange={handleUpdateFileSelect}
                      data-testid="input-update-file"
                    />
                    <Button 
                      variant="outline" 
                      asChild
                    >
                      <label htmlFor="update-file-input" className="cursor-pointer">
                        Selecionar Arquivo
                      </label>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico de Atualizações
              </CardTitle>
              <CardDescription>Registro de todas as atualizações aplicadas</CardDescription>
            </CardHeader>
            <CardContent>
              {updateHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versão</TableHead>
                      <TableHead>Data de Aplicação</TableHead>
                      <TableHead>Aplicado por</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {updateHistory.map((update) => (
                      <TableRow key={update.id} data-testid={`row-update-${update.id}`}>
                        <TableCell className="font-medium">v{update.version}</TableCell>
                        <TableCell>
                          {new Date(update.appliedAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>{update.appliedBy}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={update.status === 'success' ? 'default' : update.status === 'failed' ? 'destructive' : 'outline'}
                          >
                            {update.status === 'success' ? 'Sucesso' : update.status === 'failed' ? 'Falhou' : 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">
                  Nenhuma atualização foi aplicada ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
