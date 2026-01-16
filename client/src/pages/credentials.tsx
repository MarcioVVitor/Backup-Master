import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Plus, Search, Pencil, Trash2, Key, Eye, EyeOff, FolderOpen, Lock, Unlock } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCredentialSchema, insertCredentialGroupSchema, type InsertCredential, type InsertCredentialGroup, type Credential, type CredentialGroup } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManufacturers } from "@/hooks/use-settings";

const SUPPORTED_MANUFACTURERS = [
  "mikrotik", "huawei", "cisco", "nokia", "zte", "datacom", "datacom-dmos", "juniper", "generic"
];

export default function CredentialsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState<string>("all");
  const [isCreateCredentialOpen, setIsCreateCredentialOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [editingCredentialId, setEditingCredentialId] = useState<number | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState<{[key: number]: boolean}>({});
  const { t } = useI18n();
  const { toast } = useToast();
  const { data: manufacturers = [] } = useManufacturers();

  const { data: credentials = [], isLoading: credentialsLoading } = useQuery<Credential[]>({
    queryKey: ["/api/credentials"],
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery<CredentialGroup[]>({
    queryKey: ["/api/credential-groups"],
  });

  const filteredCredentials = useMemo(() => {
    return credentials.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesManufacturer = filterManufacturer === "all" || c.manufacturer === filterManufacturer;
      
      return matchesSearch && matchesManufacturer;
    });
  }, [credentials, searchTerm, filterManufacturer]);

  const createCredentialMutation = useMutation({
    mutationFn: async (data: InsertCredential) => {
      const res = await apiRequest("POST", "/api/credentials", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      setIsCreateCredentialOpen(false);
      toast({ title: "Credencial criada com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar credencial", description: err.message, variant: "destructive" });
    },
  });

  const updateCredentialMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertCredential> }) => {
      const res = await apiRequest("PUT", `/api/credentials/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      setEditingCredentialId(null);
      toast({ title: "Credencial atualizada com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar credencial", description: err.message, variant: "destructive" });
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/credentials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      toast({ title: "Credencial excluída" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir credencial", description: err.message, variant: "destructive" });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: InsertCredentialGroup) => {
      const res = await apiRequest("POST", "/api/credential-groups", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credential-groups"] });
      setIsCreateGroupOpen(false);
      toast({ title: "Grupo criado com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar grupo", description: err.message, variant: "destructive" });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertCredentialGroup> }) => {
      const res = await apiRequest("PUT", `/api/credential-groups/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credential-groups"] });
      setEditingGroupId(null);
      toast({ title: "Grupo atualizado com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar grupo", description: err.message, variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/credential-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credential-groups"] });
      toast({ title: "Grupo excluído" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir grupo", description: err.message, variant: "destructive" });
    },
  });

  const getGroupName = (groupId: number | null) => {
    if (!groupId) return "-";
    const group = groups.find(g => g.id === groupId);
    return group?.name || "-";
  };

  const getMfLabel = (value: string) => {
    const mf = manufacturers.find(m => m.value === value);
    return mf?.label || value;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="h-8 w-8" />
            Cofre de Credenciais
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie credenciais reutilizáveis para seus equipamentos de rede
          </p>
        </div>
      </div>

      <Tabs defaultValue="credentials" className="space-y-4">
        <TabsList>
          <TabsTrigger value="credentials" data-testid="tab-credentials">
            <Lock className="h-4 w-4 mr-2" />
            Credenciais ({credentials.length})
          </TabsTrigger>
          <TabsTrigger value="groups" data-testid="tab-groups">
            <FolderOpen className="h-4 w-4 mr-2" />
            Grupos ({groups.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar credenciais..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-credentials"
              />
            </div>
            <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-manufacturer">
                <SelectValue placeholder="Fabricante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos fabricantes</SelectItem>
                {SUPPORTED_MANUFACTURERS.map((mf) => (
                  <SelectItem key={mf} value={mf}>
                    {getMfLabel(mf)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={isCreateCredentialOpen} onOpenChange={setIsCreateCredentialOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-credential">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Credencial
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Credencial</DialogTitle>
                </DialogHeader>
                <CredentialForm
                  groups={groups}
                  manufacturers={manufacturers}
                  onSubmit={(data) => createCredentialMutation.mutate(data)}
                  isLoading={createCredentialMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentialsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredCredentials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma credencial encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCredentials.map((cred) => (
                      <TableRow key={cred.id} data-testid={`row-credential-${cred.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{cred.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{cred.username}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase text-xs">
                            {getMfLabel(cred.manufacturer || "generic")}
                          </Badge>
                        </TableCell>
                        <TableCell>{getGroupName(cred.groupId)}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {cred.description || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingCredentialId(cred.id)}
                              data-testid={`button-edit-credential-${cred.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  data-testid={`button-delete-credential-${cred.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir credencial?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir a credencial "{cred.name}"?
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteCredentialMutation.mutate(cred.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <div className="flex items-center gap-4">
            <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-group">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Grupo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Novo Grupo de Credenciais</DialogTitle>
                </DialogHeader>
                <GroupForm
                  onSubmit={(data) => createGroupMutation.mutate(data)}
                  isLoading={createGroupMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupsLoading ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center">
                  Carregando...
                </CardContent>
              </Card>
            ) : groups.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum grupo criado ainda
                </CardContent>
              </Card>
            ) : (
              groups.map((group) => {
                const credCount = credentials.filter(c => c.groupId === group.id).length;
                return (
                  <Card key={group.id} className="hover-elevate" data-testid={`card-group-${group.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FolderOpen className="h-5 w-5" />
                          {group.name}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingGroupId(group.id)}
                            data-testid={`button-edit-group-${group.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                data-testid={`button-delete-group-${group.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir grupo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o grupo "{group.name}"?
                                  As credenciais do grupo não serão excluídas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteGroupMutation.mutate(group.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {group.description || "Sem descrição"}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="secondary">
                          {credCount} credencial{credCount !== 1 ? "ais" : ""}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {editingCredentialId && (
        <EditCredentialDialog
          credentialId={editingCredentialId}
          credentials={credentials}
          groups={groups}
          manufacturers={manufacturers}
          onClose={() => setEditingCredentialId(null)}
          onSubmit={(data) => updateCredentialMutation.mutate({ id: editingCredentialId, data })}
          isLoading={updateCredentialMutation.isPending}
        />
      )}

      {editingGroupId && (
        <EditGroupDialog
          groupId={editingGroupId}
          groups={groups}
          onClose={() => setEditingGroupId(null)}
          onSubmit={(data) => updateGroupMutation.mutate({ id: editingGroupId, data })}
          isLoading={updateGroupMutation.isPending}
        />
      )}
    </div>
  );
}

function CredentialForm({
  groups,
  manufacturers,
  onSubmit,
  isLoading,
  defaultValues,
}: {
  groups: CredentialGroup[];
  manufacturers: { value: string; label: string }[];
  onSubmit: (data: InsertCredential) => void;
  isLoading: boolean;
  defaultValues?: Partial<Credential>;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showEnablePassword, setShowEnablePassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InsertCredential>({
    defaultValues: {
      name: defaultValues?.name || "",
      username: defaultValues?.username || "",
      password: "",
      enablePassword: "",
      manufacturer: defaultValues?.manufacturer || "generic",
      model: defaultValues?.model || "",
      description: defaultValues?.description || "",
      groupId: defaultValues?.groupId || null,
    },
  });

  const selectedGroup = watch("groupId");
  const selectedManufacturer = watch("manufacturer");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          placeholder="Ex: Credencial Mikrotik Padrão"
          {...register("name", { required: "Nome obrigatório" })}
          data-testid="input-credential-name"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="username">Usuário *</Label>
          <Input
            id="username"
            placeholder="admin"
            {...register("username", { required: "Usuário obrigatório" })}
            data-testid="input-credential-username"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha *</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={defaultValues ? "••••••••" : "Senha"}
              {...register("password", { required: !defaultValues ? "Senha obrigatória" : false })}
              data-testid="input-credential-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="enablePassword">Senha Enable (opcional)</Label>
        <div className="relative">
          <Input
            id="enablePassword"
            type={showEnablePassword ? "text" : "password"}
            placeholder="Senha de enable/privilege"
            {...register("enablePassword")}
            data-testid="input-credential-enable-password"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full"
            onClick={() => setShowEnablePassword(!showEnablePassword)}
          >
            {showEnablePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="manufacturer">Fabricante</Label>
          <Select
            value={selectedManufacturer || "generic"}
            onValueChange={(val) => setValue("manufacturer", val)}
          >
            <SelectTrigger data-testid="select-credential-manufacturer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {manufacturers.map((mf) => (
                <SelectItem key={mf.value} value={mf.value}>
                  {mf.label}
                </SelectItem>
              ))}
              <SelectItem value="generic">Genérico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Modelo (opcional)</Label>
          <Input
            id="model"
            placeholder="Ex: RB1100AHx4"
            {...register("model")}
            data-testid="input-credential-model"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="groupId">Grupo (opcional)</Label>
        <Select
          value={selectedGroup?.toString() || "none"}
          onValueChange={(val) => setValue("groupId", val === "none" ? null : parseInt(val))}
        >
          <SelectTrigger data-testid="select-credential-group">
            <SelectValue placeholder="Selecionar grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem grupo</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id.toString()}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Input
          id="description"
          placeholder="Descrição da credencial"
          {...register("description")}
          data-testid="input-credential-description"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="button-save-credential">
          {isLoading ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function GroupForm({
  onSubmit,
  isLoading,
  defaultValues,
}: {
  onSubmit: (data: InsertCredentialGroup) => void;
  isLoading: boolean;
  defaultValues?: Partial<CredentialGroup>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InsertCredentialGroup>({
    defaultValues: {
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          placeholder="Ex: Roteadores Core"
          {...register("name", { required: "Nome obrigatório" })}
          data-testid="input-group-name"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Input
          id="description"
          placeholder="Descrição do grupo"
          {...register("description")}
          data-testid="input-group-description"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="button-save-group">
          {isLoading ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditCredentialDialog({
  credentialId,
  credentials,
  groups,
  manufacturers,
  onClose,
  onSubmit,
  isLoading,
}: {
  credentialId: number;
  credentials: Credential[];
  groups: CredentialGroup[];
  manufacturers: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (data: Partial<InsertCredential>) => void;
  isLoading: boolean;
}) {
  const credential = credentials.find((c) => c.id === credentialId);
  if (!credential) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Credencial</DialogTitle>
        </DialogHeader>
        <CredentialForm
          groups={groups}
          manufacturers={manufacturers}
          onSubmit={onSubmit}
          isLoading={isLoading}
          defaultValues={credential}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditGroupDialog({
  groupId,
  groups,
  onClose,
  onSubmit,
  isLoading,
}: {
  groupId: number;
  groups: CredentialGroup[];
  onClose: () => void;
  onSubmit: (data: Partial<InsertCredentialGroup>) => void;
  isLoading: boolean;
}) {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Grupo</DialogTitle>
        </DialogHeader>
        <GroupForm
          onSubmit={onSubmit}
          isLoading={isLoading}
          defaultValues={group}
        />
      </DialogContent>
    </Dialog>
  );
}
