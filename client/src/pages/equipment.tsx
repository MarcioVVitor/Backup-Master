import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Server } from "lucide-react";
import { SUPPORTED_MANUFACTURERS, type Equipment } from "@shared/schema";

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

export default function EquipmentPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    ip: "",
    manufacturer: "",
    model: "",
    username: "",
    password: "",
    port: 22,
    protocol: "ssh",
    enabled: true,
  });

  const { data: equipmentList, isLoading } = useQuery<Equipment[]>({
    queryKey: ['/api/equipment'],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/equipment', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: "Equipamento adicionado com sucesso" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao adicionar equipamento", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest('PUT', `/api/equipment/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      toast({ title: "Equipamento atualizado com sucesso" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar equipamento", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/equipment/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({ title: "Equipamento excluido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir equipamento", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      ip: "",
      manufacturer: "",
      model: "",
      username: "",
      password: "",
      port: 22,
      protocol: "ssh",
      enabled: true,
    });
    setEditingEquipment(null);
  };

  const handleEdit = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setFormData({
      name: equipment.name,
      ip: equipment.ip,
      manufacturer: equipment.manufacturer,
      model: equipment.model || "",
      username: equipment.username || "",
      password: "",
      port: equipment.port || 22,
      protocol: equipment.protocol || "ssh",
      enabled: equipment.enabled ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEquipment) {
      updateMutation.mutate({ id: editingEquipment.id, data: formData });
    } else {
      createMutation.mutate(formData);
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
            <Server className="h-6 w-6" />
            Equipamentos
          </h1>
          <p className="text-muted-foreground">Gerencie os equipamentos de rede</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-equipment">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingEquipment ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-equipment-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ip">IP</Label>
                  <Input
                    id="ip"
                    value={formData.ip}
                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                    required
                    data-testid="input-equipment-ip"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Fabricante</Label>
                  <Select
                    value={formData.manufacturer}
                    onValueChange={(value) => setFormData({ ...formData, manufacturer: value })}
                  >
                    <SelectTrigger data-testid="select-manufacturer">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_MANUFACTURERS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    data-testid="input-equipment-model"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario SSH</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    data-testid="input-equipment-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha SSH</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingEquipment ? "(deixe vazio para manter)" : ""}
                    data-testid="input-equipment-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Porta</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    data-testid="input-equipment-port"
                  />
                </div>
                <div className="space-y-2 flex items-center gap-4 pt-6">
                  <Label htmlFor="enabled">Habilitado</Label>
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                    data-testid="switch-equipment-enabled"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-equipment">
                  {editingEquipment ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : !equipmentList?.length ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhum equipamento cadastrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Porta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipmentList.map((equip) => (
                  <TableRow key={equip.id} data-testid={`row-equipment-${equip.id}`}>
                    <TableCell className="font-medium">{equip.name}</TableCell>
                    <TableCell className="font-mono text-sm">{equip.ip}</TableCell>
                    <TableCell>
                      <Badge className={manufacturerColors[equip.manufacturer] || 'bg-gray-500 text-white'}>
                        {equip.manufacturer}
                      </Badge>
                    </TableCell>
                    <TableCell>{equip.model || "-"}</TableCell>
                    <TableCell>{equip.port}</TableCell>
                    <TableCell>
                      <Badge variant={equip.enabled ? "default" : "secondary"}>
                        {equip.enabled ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(equip)}
                        data-testid={`button-edit-equipment-${equip.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(equip.id)}
                        data-testid={`button-delete-equipment-${equip.id}`}
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
    </div>
  );
}
