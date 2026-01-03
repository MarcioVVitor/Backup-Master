import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { 
  Plus, 
  Calendar, 
  Clock, 
  Trash2, 
  Edit, 
  Play,
  Pause,
  Server,
  Search,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BackupPolicy, Manufacturer, Equipment } from "@shared/schema";

const FREQUENCY_OPTIONS = [
  { value: "hourly", label: "A cada hora" },
  { value: "daily", label: "Diariamente" },
  { value: "weekly", label: "Semanalmente" },
  { value: "monthly", label: "Mensalmente" },
];

const DAYS_OF_WEEK = [
  { value: "0", label: "Dom" },
  { value: "1", label: "Seg" },
  { value: "2", label: "Ter" },
  { value: "3", label: "Qua" },
  { value: "4", label: "Qui" },
  { value: "5", label: "Sex" },
  { value: "6", label: "Sab" },
];

interface PolicyFormData {
  name: string;
  description: string;
  frequencyType: string;
  time: string;
  daysOfWeek: string[];
  dayOfMonth: number | null;
  manufacturerFilters: string[];
  modelFilters: string[];
  equipmentIds: number[];
  enabled: boolean;
}

const defaultFormData: PolicyFormData = {
  name: "",
  description: "",
  frequencyType: "daily",
  time: "02:00",
  daysOfWeek: [],
  dayOfMonth: null,
  manufacturerFilters: [],
  modelFilters: [],
  equipmentIds: [],
  enabled: true,
};

export default function SchedulerPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<BackupPolicy | null>(null);
  const [formData, setFormData] = useState<PolicyFormData>(defaultFormData);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: policies = [], isLoading } = useQuery<BackupPolicy[]>({
    queryKey: ["/api/scheduler/policies"],
  });

  const { data: manufacturers = [] } = useQuery<Manufacturer[]>({
    queryKey: ["/api/manufacturers"],
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: PolicyFormData) => {
      return apiRequest("/api/scheduler/policies", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler/policies"] });
      toast({ title: "Política criada", description: "Agendamento criado com sucesso." });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar política.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: PolicyFormData }) => {
      return apiRequest(`/api/scheduler/policies/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler/policies"] });
      toast({ title: "Política atualizada", description: "Agendamento atualizado com sucesso." });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar política.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/scheduler/policies/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler/policies"] });
      toast({ title: "Política excluída", description: "Agendamento removido com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir política.", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/scheduler/policies/${id}/toggle`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler/policies"] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao alternar status.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingPolicy(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (policy: BackupPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      description: policy.description || "",
      frequencyType: policy.frequencyType || "daily",
      time: policy.time || "02:00",
      daysOfWeek: policy.daysOfWeek || [],
      dayOfMonth: policy.dayOfMonth,
      manufacturerFilters: policy.manufacturerFilters || [],
      modelFilters: policy.modelFilters || [],
      equipmentIds: policy.equipmentIds || [],
      enabled: policy.enabled ?? true,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório.", variant: "destructive" });
      return;
    }

    if (editingPolicy) {
      updateMutation.mutate({ id: editingPolicy.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredPolicies = policies.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const uniqueModels = Array.from(
    new Set(equipment.map(e => e.model).filter((m): m is string => m !== null && m !== undefined))
  );

  const getFrequencyLabel = (freq: string | null) => {
    return FREQUENCY_OPTIONS.find(o => o.value === freq)?.label || freq || "Desconhecido";
  };

  const getTargetSummary = (policy: BackupPolicy) => {
    const parts: string[] = [];
    if (policy.manufacturerFilters?.length) {
      parts.push(`${policy.manufacturerFilters.length} fabricante(s)`);
    }
    if (policy.modelFilters?.length) {
      parts.push(`${policy.modelFilters.length} modelo(s)`);
    }
    if (policy.equipmentIds?.length) {
      parts.push(`${policy.equipmentIds.length} equipamento(s)`);
    }
    return parts.length > 0 ? parts.join(", ") : "Todos os equipamentos";
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Scheduler</h1>
            <p className="text-sm text-muted-foreground">Políticas de backup automático</p>
          </div>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-policy">
          <Plus className="h-4 w-4 mr-2" />
          Nova Política
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar políticas..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-policies"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filteredPolicies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhuma política de backup encontrada</p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Política
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPolicies.map((policy) => (
            <Card key={policy.id} className={policy.enabled ? "" : "opacity-60"}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={policy.enabled ?? false}
                    onCheckedChange={() => toggleMutation.mutate(policy.id)}
                    data-testid={`switch-policy-${policy.id}`}
                  />
                  <div>
                    <CardTitle className="text-lg">{policy.name}</CardTitle>
                    {policy.description && (
                      <CardDescription>{policy.description}</CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={policy.enabled ? "default" : "secondary"}>
                    {policy.enabled ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditDialog(policy)}
                    data-testid={`button-edit-policy-${policy.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-500"
                        data-testid={`button-delete-policy-${policy.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Política?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. A política "{policy.name}" será removida permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => deleteMutation.mutate(policy.id)}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Frequência:</span>
                    <span className="font-medium">{getFrequencyLabel(policy.frequencyType)}</span>
                    {policy.time && <span>às {policy.time}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Alvos:</span>
                    <span className="font-medium">{getTargetSummary(policy)}</span>
                  </div>
                  {policy.lastRunAt && (
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Última execução:</span>
                      <span>{new Date(policy.lastRunAt).toLocaleString("pt-BR")}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy ? "Editar Política" : "Nova Política de Backup"}
            </DialogTitle>
            <DialogDescription>
              Configure o agendamento e alvos para backups automáticos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Política</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Backup Diário Mikrotik"
                data-testid="input-policy-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do agendamento"
                data-testid="input-policy-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select
                  value={formData.frequencyType}
                  onValueChange={(v) => setFormData({ ...formData, frequencyType: v })}
                >
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  data-testid="input-time"
                />
              </div>
            </div>

            {formData.frequencyType === "weekly" && (
              <div className="space-y-2">
                <Label>Dias da Semana</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      size="sm"
                      variant={formData.daysOfWeek.includes(day.value) ? "default" : "outline"}
                      onClick={() => {
                        const days = formData.daysOfWeek.includes(day.value)
                          ? formData.daysOfWeek.filter((d) => d !== day.value)
                          : [...formData.daysOfWeek, day.value];
                        setFormData({ ...formData, daysOfWeek: days });
                      }}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {formData.frequencyType === "monthly" && (
              <div className="space-y-2">
                <Label>Dia do Mês</Label>
                <Select
                  value={formData.dayOfMonth?.toString() || "1"}
                  onValueChange={(v) => setFormData({ ...formData, dayOfMonth: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        Dia {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros de Equipamentos
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fabricantes</Label>
                  <ScrollArea className="h-32 border rounded-md p-2">
                    {manufacturers.map((mfr) => (
                      <div key={mfr.value} className="flex items-center gap-2 py-1">
                        <Checkbox
                          checked={formData.manufacturerFilters.includes(mfr.value)}
                          onCheckedChange={(checked) => {
                            const filters = checked
                              ? [...formData.manufacturerFilters, mfr.value]
                              : formData.manufacturerFilters.filter((f) => f !== mfr.value);
                            setFormData({ ...formData, manufacturerFilters: filters });
                          }}
                        />
                        <span className="text-sm">{mfr.label}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                <div className="space-y-2">
                  <Label>Modelos</Label>
                  <ScrollArea className="h-32 border rounded-md p-2">
                    {uniqueModels.map((model) => (
                      <div key={model} className="flex items-center gap-2 py-1">
                        <Checkbox
                          checked={formData.modelFilters.includes(model)}
                          onCheckedChange={(checked) => {
                            const filters = checked
                              ? [...formData.modelFilters, model]
                              : formData.modelFilters.filter((f) => f !== model);
                            setFormData({ ...formData, modelFilters: filters });
                          }}
                        />
                        <span className="text-sm">{model}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Deixe em branco para incluir todos os equipamentos
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.enabled}
                onCheckedChange={(v) => setFormData({ ...formData, enabled: v })}
              />
              <Label>Política ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-policy"
            >
              {editingPolicy ? "Salvar Alterações" : "Criar Política"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
