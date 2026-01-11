import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment } from "@/hooks/use-equipment";
import { useManufacturers } from "@/hooks/use-settings";
import { useI18n } from "@/contexts/i18n-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Plus, Search, Pencil, Trash2, Server } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEquipmentSchema, type InsertEquipment, type Equipment, type Agent } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface EquipmentAgentMapping {
  id: number;
  equipmentId: number;
  agentId: number;
  priority: number;
  createdAt: string;
}

export default function EquipmentPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: equipment, isLoading } = useEquipment();
  const { data: manufacturers } = useManufacturers();
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });
  const { data: equipmentAgentMappings = [] } = useQuery<EquipmentAgentMapping[]>({
    queryKey: ["/api/equipment-agents"],
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { t } = useI18n();
  
  const getLinkedAgentId = (equipmentId: number): number | null => {
    const mapping = equipmentAgentMappings.find(m => m.equipmentId === equipmentId);
    return mapping?.agentId || null;
  };

  const filteredEquipment = equipment?.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.ip.includes(searchTerm)
  );

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.equipment.title}</h1>
          <p className="text-muted-foreground">{t.equipment.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search + "..."}
              className="pl-9 w-[250px] bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t.equipment.addEquipment}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.name}</TableHead>
              <TableHead>{t.equipment.ipAddress}</TableHead>
              <TableHead>{t.equipment.manufacturer}</TableHead>
              <TableHead>{t.equipment.protocol}</TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEquipment?.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="font-mono text-xs">{item.ip}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs font-medium">
                    {manufacturers?.find(m => m.value === item.manufacturer)?.label || item.manufacturer}
                  </span>
                </TableCell>
                <TableCell className="uppercase text-xs text-muted-foreground">{item.protocol}:{item.port}</TableCell>
                <TableCell>
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${
                    item.enabled 
                      ? "bg-green-50/50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800" 
                      : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${item.enabled ? "bg-green-500" : "bg-gray-400"}`} />
                    {item.enabled ? t.common.enabled : t.common.disabled}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditingId(item.id)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <DeleteButton id={item.id} name={item.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!filteredEquipment?.length && !isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {t.equipment.noEquipment}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateEquipmentDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        manufacturers={manufacturers || []}
        agents={agents}
      />
      
      {editingId && (
        <EditEquipmentDialog 
          open={!!editingId} 
          onOpenChange={(open) => !open && setEditingId(null)}
          id={editingId}
          manufacturers={manufacturers || []}
          equipment={equipment?.find(e => e.id === editingId)!}
          agents={agents}
          linkedAgentId={getLinkedAgentId(editingId)}
        />
      )}
    </div>
  );
}

interface EquipmentFormData extends InsertEquipment {
  selectedAgentId?: number | null;
}

function EquipmentForm({ 
  onSubmit, 
  defaultValues, 
  isPending, 
  manufacturers,
  agents,
  equipmentId,
  linkedAgentId
}: { 
  onSubmit: (data: InsertEquipment, agentId?: number | null) => void, 
  defaultValues?: Partial<InsertEquipment>,
  isPending: boolean,
  manufacturers: { value: string, label: string }[],
  agents?: Agent[],
  equipmentId?: number,
  linkedAgentId?: number | null
}) {
  const { t } = useI18n();
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(linkedAgentId || null);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<InsertEquipment>({
    resolver: zodResolver(insertEquipmentSchema),
    defaultValues: defaultValues || {
      port: 22,
      protocol: 'ssh',
      enabled: true
    }
  });
  
  const handleFormSubmit = (data: InsertEquipment) => {
    onSubmit(data, selectedAgentId);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.common.name}</Label>
          <Input {...register("name")} placeholder="Router Core 01" />
          {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
        </div>
        <div className="space-y-2">
          <Label>{t.equipment.ipAddress}</Label>
          <Input {...register("ip")} placeholder="192.168.1.1" />
          {errors.ip && <span className="text-xs text-red-500">{errors.ip.message}</span>}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.equipment.manufacturer}</Label>
          <Select onValueChange={(val) => setValue("manufacturer", val)} defaultValue={defaultValues?.manufacturer}>
            <SelectTrigger>
              <SelectValue placeholder={t.common.select + "..."} />
            </SelectTrigger>
            <SelectContent>
              {manufacturers.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.manufacturer && <span className="text-xs text-red-500">{errors.manufacturer.message}</span>}
        </div>
        <div className="space-y-2">
          <Label>{t.equipment.model}</Label>
          <Input {...register("model")} placeholder="CCR1036" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.equipment.username}</Label>
          <Input {...register("username")} placeholder="admin" />
        </div>
        <div className="space-y-2">
          <Label>{t.equipment.password}</Label>
          <Input {...register("password")} type="password" placeholder="••••••" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Senha Enable (Cisco/ZTE)</Label>
        <Input {...register("enablePassword")} type="password" placeholder="Senha para modo privilegiado (Cisco, ZTE)" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.equipment.port}</Label>
          <Input 
            type="number" 
            {...register("port", { valueAsNumber: true })} 
            placeholder="22" 
          />
        </div>
        <div className="space-y-2">
          <Label>{t.equipment.protocol}</Label>
          <Select onValueChange={(val) => setValue("protocol", val)} defaultValue={defaultValues?.protocol || 'ssh'}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ssh">SSH</SelectItem>
              <SelectItem value="telnet">Telnet</SelectItem>
              <SelectItem value="api">API</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {agents && agents.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Agente Proxy (Opcional)
          </Label>
          <Select 
            onValueChange={(val) => setSelectedAgentId(val === "none" ? null : parseInt(val))} 
            defaultValue={linkedAgentId ? linkedAgentId.toString() : "none"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um agente..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum (conexão direta)</SelectItem>
              {agents.map(agent => (
                <SelectItem key={agent.id} value={agent.id.toString()}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${agent.status === "online" ? "bg-green-500" : "bg-gray-400"}`} />
                    {agent.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Vincule um agente para executar backups via proxy em redes privadas
          </p>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? t.common.saving : t.equipment.saveEquipment}
        </Button>
      </div>
    </form>
  );
}

function CreateEquipmentDialog({ open, onOpenChange, manufacturers, agents }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  manufacturers: { value: string; label: string }[];
  agents: Agent[];
}) {
  const { t } = useI18n();
  const { mutate, isPending } = useCreateEquipment();
  const { toast } = useToast();

  const handleSubmit = async (data: InsertEquipment, agentId?: number | null) => {
    mutate(data, {
      onSuccess: async (newEquipment: any) => {
        if (agentId && newEquipment?.id) {
          try {
            await apiRequest("POST", `/api/equipment/${newEquipment.id}/agents`, { agentId, priority: 1 });
            queryClient.invalidateQueries({ queryKey: ["/api/equipment-agents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
          } catch (e) {
            console.error("Failed to link agent:", e);
          }
        }
        toast({ title: t.common.success, description: t.equipment.createSuccess });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: t.common.error, description: t.equipment.createError, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.equipment.addEquipment}</DialogTitle>
        </DialogHeader>
        <EquipmentForm 
          onSubmit={handleSubmit} 
          isPending={isPending} 
          manufacturers={manufacturers}
          agents={agents}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditEquipmentDialog({ open, onOpenChange, id, equipment, manufacturers, agents, linkedAgentId }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  id: number; 
  equipment: Equipment; 
  manufacturers: { value: string; label: string }[];
  agents: Agent[];
  linkedAgentId: number | null;
}) {
  const { t } = useI18n();
  const { mutate, isPending } = useUpdateEquipment();
  const { toast } = useToast();

  const handleSubmit = async (data: InsertEquipment, agentId?: number | null) => {
    mutate({ id, ...data }, {
      onSuccess: async () => {
        if (linkedAgentId && linkedAgentId !== agentId) {
          try {
            await apiRequest("DELETE", `/api/equipment/${id}/agents/${linkedAgentId}`);
          } catch (e) {
            console.error("Failed to unlink old agent:", e);
          }
        }
        
        if (agentId && agentId !== linkedAgentId) {
          try {
            await apiRequest("POST", `/api/equipment/${id}/agents`, { agentId, priority: 1 });
          } catch (e) {
            console.error("Failed to link new agent:", e);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/equipment-agents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
        toast({ title: t.common.success, description: t.equipment.updateSuccess });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: t.common.error, description: t.equipment.updateError, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.equipment.editEquipment}</DialogTitle>
        </DialogHeader>
        <EquipmentForm 
          onSubmit={handleSubmit} 
          defaultValues={equipment} 
          isPending={isPending} 
          manufacturers={manufacturers}
          agents={agents}
          equipmentId={id}
          linkedAgentId={linkedAgentId}
        />
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ id, name }: { id: number, name: string }) {
  const { t } = useI18n();
  const { mutate, isPending } = useDeleteEquipment();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleDelete = () => {
    mutate(id, {
      onSuccess: () => {
        toast({ title: t.common.delete, description: `${name} ${t.equipment.removed}` });
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.equipment.deleteEquipment}?</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">
          {t.equipment.confirmDelete} <strong>{name}</strong>? {t.equipment.confirmDeleteMessage}
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? t.common.deleting : t.common.delete}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
