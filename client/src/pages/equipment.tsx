import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment } from "@/hooks/use-equipment";
import { useManufacturers } from "@/hooks/use-settings";
import { useI18n } from "@/contexts/i18n-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Plus, Search, Pencil, Trash2, Server, ArrowUpDown, ChevronDown, ChevronRight, FolderOpen, ChevronLeft, Key } from "lucide-react";
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
import { insertEquipmentSchema, type InsertEquipment, type Equipment, type Agent, type Credential } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewToggle, type ViewMode } from "@/components/view-toggle";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface EquipmentAgentMapping {
  id: number;
  equipmentId: number;
  agentId: number;
  priority: number;
  createdAt: string;
}

const ITEMS_PER_PAGE = 30;

export default function EquipmentPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortField, setSortField] = useState<"name" | "ip" | "manufacturer" | "protocol">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState<"none" | "manufacturer" | "protocol">("none");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const { data: equipment, isLoading } = useEquipment();
  const { data: manufacturers } = useManufacturers();
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });
  const { data: equipmentAgentMappings = [] } = useQuery<EquipmentAgentMapping[]>({
    queryKey: ["/api/equipment-agents"],
  });
  const { data: credentials = [] } = useQuery<Credential[]>({
    queryKey: ["/api/credentials"],
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { t } = useI18n();
  
  const getLinkedAgentId = (equipmentId: number): number | null => {
    const mapping = equipmentAgentMappings.find(m => m.equipmentId === equipmentId);
    return mapping?.agentId || null;
  };

  const filteredAndSortedEquipment = useMemo(() => {
    let result = equipment?.filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.ip.includes(searchTerm) ||
      e.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "ip":
          comparison = a.ip.localeCompare(b.ip);
          break;
        case "manufacturer":
          comparison = a.manufacturer.localeCompare(b.manufacturer);
          break;
        case "protocol":
          comparison = (a.protocol || "").localeCompare(b.protocol || "");
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [equipment, searchTerm, sortField, sortOrder]);

  const groupedEquipment = useMemo(() => {
    if (groupBy === "none") {
      return { all: filteredAndSortedEquipment };
    }

    return filteredAndSortedEquipment.reduce((acc, item) => {
      const key = groupBy === "manufacturer" ? item.manufacturer : (item.protocol || "unknown");
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, Equipment[]>);
  }, [filteredAndSortedEquipment, groupBy]);

  const totalPages = Math.ceil(filteredAndSortedEquipment.length / ITEMS_PER_PAGE);
  const paginatedEquipment = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedEquipment.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedEquipment, currentPage]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const handleGroupByChange = (val: "none" | "manufacturer" | "protocol") => {
    setGroupBy(val);
    if (val !== "none") {
      const allKeys = new Set(filteredAndSortedEquipment.map(e => val === "manufacturer" ? e.manufacturer : (e.protocol || "unknown")));
      setExpandedGroups(allKeys);
    } else {
      setExpandedGroups(new Set());
    }
  };

  const renderEquipmentCard = (item: Equipment) => {
    const mfr = manufacturers?.find(m => m.value === item.manufacturer);
    return (
      <Card key={item.id} className="hover-elevate cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="uppercase text-[10px]">
              {mfr?.label || item.manufacturer}
            </Badge>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
              item.enabled 
                ? "bg-green-50/50 text-green-700 dark:bg-green-900/20 dark:text-green-300" 
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${item.enabled ? "bg-green-500" : "bg-gray-400"}`} />
              {item.enabled ? t.common.enabled : t.common.disabled}
            </div>
          </div>
          <CardTitle className="text-lg mt-2">{item.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">IP:</span>
              <span className="font-mono">{item.ip}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.equipment.protocol}:</span>
              <span className="uppercase">{item.protocol}:{item.port}</span>
            </div>
            {item.model && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.equipment.model}:</span>
                <span>{item.model}</span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="ghost" size="sm" onClick={() => setEditingId(item.id)}>
              <Pencil className="h-4 w-4 mr-1" />
              {t.common.edit}
            </Button>
            <DeleteButton id={item.id} name={item.name} />
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEquipmentListItem = (item: Equipment) => {
    const mfr = manufacturers?.find(m => m.value === item.manufacturer);
    return (
      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-4">
          <div className={`h-2 w-2 rounded-full ${item.enabled ? "bg-green-500" : "bg-gray-400"}`} />
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-sm text-muted-foreground font-mono">{item.ip}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline">{mfr?.label || item.manufacturer}</Badge>
          <span className="text-xs text-muted-foreground uppercase">{item.protocol}:{item.port}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(item.id)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <DeleteButton id={item.id} name={item.name} />
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("name")}>
              <div className="flex items-center gap-2">
                {t.common.name}
                {sortField === "name" && <ArrowUpDown className="h-4 w-4" />}
              </div>
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("ip")}>
              <div className="flex items-center gap-2">
                {t.equipment.ipAddress}
                {sortField === "ip" && <ArrowUpDown className="h-4 w-4" />}
              </div>
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("manufacturer")}>
              <div className="flex items-center gap-2">
                {t.equipment.manufacturer}
                {sortField === "manufacturer" && <ArrowUpDown className="h-4 w-4" />}
              </div>
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("protocol")}>
              <div className="flex items-center gap-2">
                {t.equipment.protocol}
                {sortField === "protocol" && <ArrowUpDown className="h-4 w-4" />}
              </div>
            </TableHead>
            <TableHead>{t.common.status}</TableHead>
            <TableHead className="text-right">{t.common.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedEquipment.map((item) => (
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
          {!paginatedEquipment.length && !isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                {t.equipment.noEquipment}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderGroupedContent = () => {
    const groups = Object.entries(groupedEquipment);
    if (groups.length === 1 && groups[0][0] === "all") {
      if (viewMode === "cards") {
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedEquipment.map(renderEquipmentCard)}
          </div>
        );
      } else if (viewMode === "list") {
        return (
          <div className="space-y-2">
            {paginatedEquipment.map(renderEquipmentListItem)}
          </div>
        );
      } else {
        return renderTableView();
      }
    }

    return (
      <div className="space-y-4">
        {groups.map(([groupName, groupItems]) => {
          const mfr = manufacturers?.find(m => m.value === groupName);
          const isExpanded = expandedGroups.has(groupName);
          
          return (
            <Collapsible key={groupName} open={isExpanded} onOpenChange={() => toggleGroup(groupName)}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 h-12 px-4 bg-muted/50 hover:bg-muted">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <FolderOpen className="h-4 w-4" />
                  <span className="font-medium">
                    {groupBy === "manufacturer" ? (mfr?.label || groupName) : groupName.toUpperCase()}
                  </span>
                  <Badge variant="secondary" className="ml-2">
                    {groupItems.length}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                {viewMode === "cards" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupItems.map(renderEquipmentCard)}
                  </div>
                ) : viewMode === "list" ? (
                  <div className="space-y-2">
                    {groupItems.map(renderEquipmentListItem)}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
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
                        {groupItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="font-mono text-xs">{item.ip}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{manufacturers?.find(m => m.value === item.manufacturer)?.label || item.manufacturer}</Badge>
                            </TableCell>
                            <TableCell className="uppercase text-xs">{item.protocol}:{item.port}</TableCell>
                            <TableCell>
                              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                                item.enabled ? "bg-green-50/50 text-green-700" : "bg-gray-100 text-gray-600"
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${item.enabled ? "bg-green-500" : "bg-gray-400"}`} />
                                {item.enabled ? t.common.enabled : t.common.disabled}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => setEditingId(item.id)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <DeleteButton id={item.id} name={item.name} />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  };

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

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          <Select value={groupBy} onValueChange={handleGroupByChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Agrupar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem agrupamento</SelectItem>
              <SelectItem value="manufacturer">Por Fabricante</SelectItem>
              <SelectItem value="protocol">Por Protocolo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredAndSortedEquipment.length} equipamentos
        </div>
      </div>

      {renderGroupedContent()}

      {groupBy === "none" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <CreateEquipmentDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        manufacturers={manufacturers || []}
        agents={agents}
        credentials={credentials}
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
          credentials={credentials}
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
  linkedAgentId,
  credentials
}: { 
  onSubmit: (data: InsertEquipment, agentId?: number | null) => void, 
  defaultValues?: Partial<InsertEquipment>,
  isPending: boolean,
  manufacturers: { value: string, label: string }[],
  agents?: Agent[],
  equipmentId?: number,
  linkedAgentId?: number | null,
  credentials?: Credential[]
}) {
  const { t } = useI18n();
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(linkedAgentId || null);
  const [credentialMode, setCredentialMode] = useState<"manual" | "saved">(
    defaultValues?.credentialId ? "saved" : "manual"
  );
  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(
    defaultValues?.credentialId || null
  );
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<InsertEquipment>({
    resolver: zodResolver(insertEquipmentSchema),
    defaultValues: defaultValues || {
      port: 22,
      protocol: 'ssh',
      enabled: true
    }
  });
  
  const watchedManufacturer = watch("manufacturer");
  
  const filteredCredentials = useMemo(() => {
    if (!credentials) return [];
    if (watchedManufacturer) {
      return credentials.filter(c => !c.manufacturer || c.manufacturer === watchedManufacturer || c.manufacturer === "generic");
    }
    return credentials;
  }, [credentials, watchedManufacturer]);
  
  const handleFormSubmit = (data: InsertEquipment) => {
    if (credentialMode === "saved" && selectedCredentialId) {
      data.credentialId = selectedCredentialId;
      data.username = undefined;
      data.password = undefined;
      data.enablePassword = undefined;
    } else {
      data.credentialId = null;
    }
    onSubmit(data, selectedAgentId);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.common.name}</Label>
          <Input {...register("name")} placeholder="Router Core 01" data-testid="input-equipment-name" />
          {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
        </div>
        <div className="space-y-2">
          <Label>{t.equipment.ipAddress}</Label>
          <Input {...register("ip")} placeholder="192.168.1.1" data-testid="input-equipment-ip" />
          {errors.ip && <span className="text-xs text-red-500">{errors.ip.message}</span>}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.equipment.manufacturer}</Label>
          <Select onValueChange={(val) => setValue("manufacturer", val)} defaultValue={defaultValues?.manufacturer}>
            <SelectTrigger data-testid="select-equipment-manufacturer">
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
          <Input {...register("model")} placeholder="CCR1036" data-testid="input-equipment-model" />
        </div>
      </div>

      {credentials && credentials.length > 0 && (
        <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Credenciais de Acesso</Label>
          </div>
          <div className="flex gap-4">
            <Button
              type="button"
              variant={credentialMode === "saved" ? "default" : "outline"}
              size="sm"
              onClick={() => setCredentialMode("saved")}
              data-testid="button-credential-saved"
            >
              <Key className="h-4 w-4 mr-2" />
              Usar credencial salva
            </Button>
            <Button
              type="button"
              variant={credentialMode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setCredentialMode("manual")}
              data-testid="button-credential-manual"
            >
              Digitar manualmente
            </Button>
          </div>
          
          {credentialMode === "saved" && (
            <div className="space-y-2">
              <Select
                value={selectedCredentialId?.toString() || "none"}
                onValueChange={(val) => setSelectedCredentialId(val === "none" ? null : parseInt(val))}
              >
                <SelectTrigger data-testid="select-credential">
                  <SelectValue placeholder="Selecione uma credencial..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {filteredCredentials.map(cred => (
                    <SelectItem key={cred.id} value={cred.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Key className="h-3 w-3" />
                        <span>{cred.name}</span>
                        <span className="text-xs text-muted-foreground">({cred.username})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredCredentials.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma credencial disponível para este fabricante. 
                  <a href="/credentials" className="text-primary hover:underline ml-1">Criar credencial</a>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {(credentialMode === "manual" || !credentials || credentials.length === 0) && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.equipment.username}</Label>
              <Input {...register("username")} placeholder="admin" data-testid="input-equipment-username" />
            </div>
            <div className="space-y-2">
              <Label>{t.equipment.password}</Label>
              <Input {...register("password")} type="password" placeholder="••••••" data-testid="input-equipment-password" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Senha Enable (Cisco/ZTE)</Label>
            <Input {...register("enablePassword")} type="password" placeholder="Senha para modo privilegiado (Cisco, ZTE)" data-testid="input-equipment-enable-password" />
          </div>
        </>
      )}

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

function CreateEquipmentDialog({ open, onOpenChange, manufacturers, agents, credentials }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  manufacturers: { value: string; label: string }[];
  agents: Agent[];
  credentials: Credential[];
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
          credentials={credentials}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditEquipmentDialog({ open, onOpenChange, id, equipment, manufacturers, agents, linkedAgentId, credentials }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  id: number; 
  equipment: Equipment; 
  manufacturers: { value: string; label: string }[];
  agents: Agent[];
  linkedAgentId: number | null;
  credentials: Credential[];
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
          credentials={credentials}
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
