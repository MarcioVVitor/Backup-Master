import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Factory, Plus, Pencil, Trash2, Save } from "lucide-react";

interface Manufacturer {
  id: number;
  value: string;
  label: string;
  color: string | null;
  createdAt: string;
}

export default function ManufacturersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    value: "",
    label: "",
    color: "#6b7280",
  });

  const { data: manufacturers, isLoading } = useQuery<Manufacturer[]>({
    queryKey: ['/api/manufacturers'],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/manufacturers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manufacturers'] });
      toast({ title: "Fabricante criado com sucesso" });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Erro ao criar fabricante", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      return apiRequest('PATCH', `/api/manufacturers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manufacturers'] });
      toast({ title: "Fabricante atualizado com sucesso" });
      setEditingId(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar fabricante", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/manufacturers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manufacturers'] });
      toast({ title: "Fabricante excluido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir fabricante", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ value: "", label: "", color: "#6b7280" });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEdit = (mfr: Manufacturer) => {
    setFormData({
      value: mfr.value,
      label: mfr.label,
      color: mfr.color || "#6b7280",
    });
    setEditingId(mfr.id);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { label: formData.label, color: formData.color } });
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
            <Factory className="h-6 w-6" />
            Fabricantes
          </h1>
          <p className="text-muted-foreground">Gerencie os fabricantes de equipamentos</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-manufacturer">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Fabricante</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="value">Identificador (slug)</Label>
                <Input
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="ex: cisco, mikrotik"
                  required
                  data-testid="input-manufacturer-value"
                />
                <p className="text-xs text-muted-foreground">Usado internamente, sem espacos ou caracteres especiais</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Nome de Exibicao</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="ex: Cisco, Mikrotik"
                  required
                  data-testid="input-manufacturer-label"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Cor</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-16 h-9 p-1"
                    data-testid="input-manufacturer-color"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#6b7280"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-new-manufacturer">
                  <Save className="h-4 w-4 mr-1" />
                  {createMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {manufacturers?.map((mfr) => (
            <Card key={mfr.id} data-testid={`card-manufacturer-${mfr.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge style={{ backgroundColor: mfr.color || '#6b7280', color: 'white' }}>
                    {mfr.label}
                  </Badge>
                </div>
                <CardTitle className="text-base">{mfr.label}</CardTitle>
                <p className="text-xs text-muted-foreground font-mono">{mfr.value}</p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(mfr)}
                    data-testid={`button-edit-manufacturer-${mfr.id}`}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" data-testid={`button-delete-manufacturer-${mfr.id}`}>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Fabricante</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir o fabricante "{mfr.label}"? 
                          Equipamentos existentes com este fabricante nao serao afetados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(mfr.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fabricante</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-value">Identificador</Label>
              <Input
                id="edit-value"
                value={formData.value}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">O identificador nao pode ser alterado</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-label">Nome de Exibicao</Label>
              <Input
                id="edit-label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                required
                data-testid="input-edit-manufacturer-label"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-color">Cor</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="edit-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-16 h-9 p-1"
                  data-testid="input-edit-manufacturer-color"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-manufacturer">
                <Save className="h-4 w-4 mr-1" />
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
