import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Building2, 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Users,
  Server,
  Network,
  UserPlus
} from "lucide-react";
import type { Company, User } from "@shared/schema";

interface CompanyWithUsers extends Company {
  userCount?: number;
  equipmentCount?: number;
  agentCount?: number;
}

interface CompanyUser {
  id: number;
  userId: number;
  companyId: number;
  role: string;
  isDefault: boolean;
  user?: {
    id: number;
    username: string;
    name: string | null;
    email: string | null;
  };
}

export default function Companies() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithUsers | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    active: true,
    maxUsers: 100,
    maxEquipment: 1000,
    maxAgents: 50,
  });

  const [addUserData, setAddUserData] = useState({
    username: "",
    role: "admin",
  });

  const { data: companies = [], isLoading } = useQuery<CompanyWithUsers[]>({
    queryKey: ["/api/companies"],
  });

  const { data: companyUsers = [] } = useQuery<CompanyUser[]>({
    queryKey: ["/api/companies", selectedCompany?.id, "users"],
    enabled: !!selectedCompany && isUsersOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/companies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Empresa criada com sucesso" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao criar empresa", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => 
      apiRequest("PATCH", `/api/companies/${selectedCompany?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsEditOpen(false);
      resetForm();
      toast({ title: "Empresa atualizada com sucesso" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao atualizar empresa", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/companies/${selectedCompany?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsDeleteOpen(false);
      setSelectedCompany(null);
      toast({ title: "Empresa excluída com sucesso" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao excluir empresa", description: e.message, variant: "destructive" });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: (data: typeof addUserData) => 
      apiRequest("POST", `/api/companies/${selectedCompany?.id}/users`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", selectedCompany?.id, "users"] });
      setIsAddUserOpen(false);
      setAddUserData({ username: "", role: "admin" });
      toast({ title: "Usuário adicionado com sucesso" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao adicionar usuário", description: e.message, variant: "destructive" });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: (userId: number) => 
      apiRequest("DELETE", `/api/companies/${selectedCompany?.id}/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", selectedCompany?.id, "users"] });
      toast({ title: "Usuário removido com sucesso" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao remover usuário", description: e.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      active: true,
      maxUsers: 100,
      maxEquipment: 1000,
      maxAgents: 50,
    });
  };

  const openEdit = (company: CompanyWithUsers) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      slug: company.slug,
      description: company.description || "",
      active: company.active ?? true,
      maxUsers: company.maxUsers ?? 100,
      maxEquipment: company.maxEquipment ?? 1000,
      maxAgents: company.maxAgents ?? 50,
    });
    setIsEditOpen(true);
  };

  const openUsers = (company: CompanyWithUsers) => {
    setSelectedCompany(company);
    setIsUsersOpen(true);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Building2 className="h-6 w-6" />
            Empresas
          </h1>
          <p className="text-muted-foreground">
            Gerenciamento de empresas e seus administradores
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-company">
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Empresas Cadastradas
          </CardTitle>
          <CardDescription>
            Lista de todas as empresas registradas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma empresa cadastrada</p>
              <p className="text-sm">Clique em "Nova Empresa" para adicionar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Limites</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{company.name}</div>
                        {company.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {company.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {company.slug}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={company.active ? "default" : "secondary"}>
                        {company.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {company.maxUsers}
                        </span>
                        <span className="flex items-center gap-1">
                          <Server className="h-3 w-3" />
                          {company.maxEquipment}
                        </span>
                        <span className="flex items-center gap-1">
                          <Network className="h-3 w-3" />
                          {company.maxAgents}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-company-menu-${company.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openUsers(company)}>
                            <Users className="h-4 w-4 mr-2" />
                            Usuários
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(company)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => { setSelectedCompany(company); setIsDeleteOpen(true); }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>
              Cadastre uma nova empresa no sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ 
                    ...formData, 
                    name: e.target.value,
                    slug: generateSlug(e.target.value),
                  });
                }}
                placeholder="Ex: Empresa XYZ"
                data-testid="input-company-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug (identificador único)</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="empresa-xyz"
                data-testid="input-company-slug"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da empresa..."
                data-testid="input-company-description"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max. Usuários</Label>
                <Input
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 0 })}
                  data-testid="input-max-users"
                />
              </div>
              <div className="space-y-2">
                <Label>Max. Equipamentos</Label>
                <Input
                  type="number"
                  value={formData.maxEquipment}
                  onChange={(e) => setFormData({ ...formData, maxEquipment: parseInt(e.target.value) || 0 })}
                  data-testid="input-max-equipment"
                />
              </div>
              <div className="space-y-2">
                <Label>Max. Agentes</Label>
                <Input
                  type="number"
                  value={formData.maxAgents}
                  onChange={(e) => setFormData({ ...formData, maxAgents: parseInt(e.target.value) || 0 })}
                  data-testid="input-max-agents"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                data-testid="switch-company-active"
              />
              <Label>Empresa ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending || !formData.name || !formData.slug}
              data-testid="button-save-company"
            >
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>
              Atualize as informações da empresa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Empresa XYZ"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="empresa-xyz"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da empresa..."
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max. Usuários</Label>
                <Input
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max. Equipamentos</Label>
                <Input
                  type="number"
                  value={formData.maxEquipment}
                  onChange={(e) => setFormData({ ...formData, maxEquipment: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max. Agentes</Label>
                <Input
                  type="number"
                  value={formData.maxAgents}
                  onChange={(e) => setFormData({ ...formData, maxAgents: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label>Empresa ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => updateMutation.mutate(formData)}
              disabled={updateMutation.isPending || !formData.name || !formData.slug}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Empresa</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a empresa "{selectedCompany?.name}"? 
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUsersOpen} onOpenChange={setIsUsersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários de {selectedCompany?.name}
            </DialogTitle>
            <DialogDescription>
              Gerencie os usuários com acesso a esta empresa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setIsAddUserOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Usuário
              </Button>
            </div>
            {companyUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum usuário vinculado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-center">Padrão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyUsers.map((cu) => (
                    <TableRow key={cu.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{cu.user?.username || `User #${cu.userId}`}</div>
                          {cu.user?.email && (
                            <div className="text-sm text-muted-foreground">{cu.user.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cu.role === "admin" ? "default" : "secondary"}>
                          {cu.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {cu.isDefault && <Badge variant="outline">Padrão</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeUserMutation.mutate(cu.userId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Usuário</DialogTitle>
            <DialogDescription>
              Vincule um usuário existente à empresa {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username (ID Replit)</Label>
              <Input
                value={addUserData.username}
                onChange={(e) => setAddUserData({ ...addUserData, username: e.target.value })}
                placeholder="Ex: marciovvitor"
                data-testid="input-add-user-username"
              />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <select 
                className="w-full h-9 px-3 rounded-md border border-input bg-background"
                value={addUserData.role}
                onChange={(e) => setAddUserData({ ...addUserData, role: e.target.value })}
              >
                <option value="admin">Administrador</option>
                <option value="operator">Operador</option>
                <option value="viewer">Visualizador</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => addUserMutation.mutate(addUserData)}
              disabled={addUserMutation.isPending || !addUserData.username}
            >
              {addUserMutation.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
