import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Code, Copy, Pencil, Plus, Save, Search, Terminal, Trash2 } from "lucide-react";

interface ManufacturerRecord {
  id: number;
  value: string;
  label: string;
  color: string | null;
}

interface VendorScript {
  id: number;
  manufacturer: string;
  name: string;
  command: string;
  description?: string | null;
  fileExtension?: string | null;
  useShell?: boolean | null;
  timeout?: number | null;
  isDefault?: boolean | null;
  updatedAt?: string | null;
}

export default function ScriptsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingScript, setEditingScript] = useState<VendorScript | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [formData, setFormData] = useState({
    manufacturer: "",
    name: "",
    command: "",
    description: "",
    fileExtension: ".cfg",
    useShell: true,
    timeout: 30000,
  });

  const { data: scripts, isLoading } = useQuery<VendorScript[]>({
    queryKey: ['/api/scripts'],
    enabled: !!user,
  });

  const { data: manufacturers } = useQuery<ManufacturerRecord[]>({
    queryKey: ['/api/manufacturers'],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/scripts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scripts'] });
      toast({ title: "Script criado com sucesso" });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao criar script", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      return apiRequest('PATCH', `/api/scripts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scripts'] });
      toast({ title: "Script atualizado com sucesso" });
      setEditingScript(null);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar script", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/scripts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scripts'] });
      toast({ title: "Script excluido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir script", variant: "destructive" });
    },
  });

  const handleEdit = (script: VendorScript) => {
    setFormData({
      manufacturer: script.manufacturer,
      name: script.name,
      command: script.command,
      description: script.description || "",
      fileExtension: script.fileExtension || ".cfg",
      useShell: script.useShell ?? true,
      timeout: script.timeout || 30000,
    });
    setEditingScript(script);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScript) return;
    updateMutation.mutate({
      id: editingScript.id,
      data: {
        name: formData.name,
        command: formData.command,
        description: formData.description,
        fileExtension: formData.fileExtension,
        useShell: formData.useShell,
        timeout: formData.timeout,
      }
    });
  };

  const handleDuplicate = (script: VendorScript) => {
    setFormData({
      manufacturer: script.manufacturer,
      name: script.name + " (copia)",
      command: script.command,
      description: script.description || "",
      fileExtension: script.fileExtension || ".cfg",
      useShell: script.useShell ?? true,
      timeout: script.timeout || 30000,
    });
    setIsAddDialogOpen(true);
  };

  const filteredScripts = useMemo(() => {
    if (!scripts) return [];
    let result = scripts;
    
    if (selectedManufacturer !== "all") {
      result = result.filter(s => s.manufacturer === selectedManufacturer);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.manufacturer.toLowerCase().includes(query) ||
        (s.description || '').toLowerCase().includes(query) ||
        s.command.toLowerCase().includes(query)
      );
    }
    
    return result.sort((a, b) => {
      if (a.manufacturer !== b.manufacturer) {
        return a.manufacturer.localeCompare(b.manufacturer);
      }
      return a.name.localeCompare(b.name);
    });
  }, [scripts, searchQuery, selectedManufacturer]);

  const scriptsByManufacturer = useMemo(() => {
    const grouped: Record<string, VendorScript[]> = {};
    filteredScripts.forEach(script => {
      if (!grouped[script.manufacturer]) {
        grouped[script.manufacturer] = [];
      }
      grouped[script.manufacturer].push(script);
    });
    return grouped;
  }, [filteredScripts]);

  const resetForm = () => {
    setFormData({
      manufacturer: "",
      name: "",
      command: "",
      description: "",
      fileExtension: ".cfg",
      useShell: true,
      timeout: 30000,
    });
  };

  const handleAddNew = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.manufacturer || !formData.name || !formData.command) {
      toast({ title: "Preencha todos os campos obrigatorios", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const getManufacturerColor = (value: string): string => {
    return manufacturers?.find(m => m.value === value)?.color || '#6b7280';
  };

  const getManufacturerLabel = (value: string): string => {
    return manufacturers?.find(m => m.value === value)?.label || value;
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
            <Terminal className="h-6 w-6" />
            Scripts
          </h1>
          <p className="text-muted-foreground">Gerencie scripts de backup, atualizacao e comandos personalizados por fabricante</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
            <SelectTrigger className="w-40" data-testid="select-filter-manufacturer">
              <SelectValue placeholder="Fabricante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {manufacturers?.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar scripts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-search-scripts"
            />
          </div>
          <Button onClick={handleAddNew} data-testid="button-add-script">
            <Plus className="mr-2 h-4 w-4" />
            Novo Script
          </Button>
        </div>
      </div>

      {isLoading || !manufacturers ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : filteredScripts.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          {searchQuery || selectedManufacturer !== "all" 
            ? "Nenhum script encontrado com os filtros aplicados" 
            : "Nenhum script cadastrado. Clique em 'Novo Script' para adicionar."}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(scriptsByManufacturer).map(([manufacturer, mfrScripts]) => (
            <div key={manufacturer}>
              <div className="flex items-center gap-2 mb-4">
                <Badge 
                  style={{ backgroundColor: getManufacturerColor(manufacturer), color: 'white' }}
                  className="text-sm"
                >
                  {getManufacturerLabel(manufacturer)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {mfrScripts.length} script{mfrScripts.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mfrScripts.map((script) => (
                  <Card key={script.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{script.name}</CardTitle>
                        {script.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Padrao
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs line-clamp-2">
                        {script.description || `Script para ${getManufacturerLabel(manufacturer)}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-muted rounded-md p-2 max-h-24 overflow-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                          {script.command.length > 150 ? script.command.substring(0, 150) + '...' : script.command}
                        </pre>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>Ext: {script.fileExtension || '.cfg'}</span>
                        <span>Timeout: {((script.timeout || 30000) / 1000)}s</span>
                        <span>Shell: {script.useShell !== false ? 'Sim' : 'Nao'}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(script)}
                          data-testid={`button-edit-script-${script.id}`}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDuplicate(script)}
                          data-testid={`button-duplicate-script-${script.id}`}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Duplicar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid={`button-delete-script-${script.id}`}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Script</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o script "{script.name}" de {getManufacturerLabel(manufacturer)}?
                                Esta acao nao pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(script.id)}>
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
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editingScript} onOpenChange={(open) => !open && setEditingScript(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Editar Script
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Fabricante</Label>
                <Input 
                  value={getManufacturerLabel(formData.manufacturer)} 
                  disabled 
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome do Script *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Script de Backup"
                  required
                  data-testid="input-edit-script-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-command">Comando *</Label>
              <Textarea
                id="edit-command"
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                rows={8}
                className="font-mono text-sm"
                required
                data-testid="textarea-edit-script-command"
              />
              <p className="text-xs text-muted-foreground">
                Placeholders disponiveis: {"{{EQUIPMENT_IP}}"}, {"{{SERVER_IP}}"}, {"{{FIRMWARE_FILE}}"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descricao</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descricao do script"
                data-testid="input-edit-script-description"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edit-fileExtension">Extensao</Label>
                <Input
                  id="edit-fileExtension"
                  value={formData.fileExtension}
                  onChange={(e) => setFormData({ ...formData, fileExtension: e.target.value })}
                  placeholder=".cfg"
                  data-testid="input-edit-script-extension"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-timeout">Timeout (ms)</Label>
                <Input
                  id="edit-timeout"
                  type="number"
                  value={formData.timeout}
                  onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
                  data-testid="input-edit-script-timeout"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <div className="flex items-center gap-3 h-9">
                  <Switch
                    id="edit-useShell"
                    checked={formData.useShell}
                    onCheckedChange={(checked) => setFormData({ ...formData, useShell: checked })}
                    data-testid="switch-edit-script-useshell"
                  />
                  <Label htmlFor="edit-useShell">Shell Interativo</Label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingScript(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-edit-script">
                <Save className="h-4 w-4 mr-1" />
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Novo Script
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveNew} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-manufacturer">Fabricante *</Label>
                <Select
                  value={formData.manufacturer}
                  onValueChange={(value) => setFormData({ ...formData, manufacturer: value })}
                >
                  <SelectTrigger data-testid="select-add-script-manufacturer">
                    <SelectValue placeholder="Selecione o fabricante" />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturers?.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-name">Nome do Script *</Label>
                <Input
                  id="add-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Script de Backup, Script de Reboot"
                  required
                  data-testid="input-add-script-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-command">Comando *</Label>
              <Textarea
                id="add-command"
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                rows={8}
                className="font-mono text-sm"
                required
                placeholder="show running-config"
                data-testid="textarea-add-script-command"
              />
              <p className="text-xs text-muted-foreground">
                Placeholders disponiveis: {"{{EQUIPMENT_IP}}"}, {"{{SERVER_IP}}"}, {"{{FIRMWARE_FILE}}"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-description">Descricao</Label>
              <Input
                id="add-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descricao opcional do script"
                data-testid="input-add-script-description"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="add-fileExtension">Extensao</Label>
                <Input
                  id="add-fileExtension"
                  value={formData.fileExtension}
                  onChange={(e) => setFormData({ ...formData, fileExtension: e.target.value })}
                  placeholder=".cfg"
                  data-testid="input-add-script-extension"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-timeout">Timeout (ms)</Label>
                <Input
                  id="add-timeout"
                  type="number"
                  value={formData.timeout}
                  onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
                  data-testid="input-add-script-timeout"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <div className="flex items-center gap-3 h-9">
                  <Switch
                    id="add-useShell"
                    checked={formData.useShell}
                    onCheckedChange={(checked) => setFormData({ ...formData, useShell: checked })}
                    data-testid="switch-add-script-useshell"
                  />
                  <Label htmlFor="add-useShell">Shell Interativo</Label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || !formData.manufacturer || !formData.name || !formData.command} 
                data-testid="button-save-new-script"
              >
                <Save className="h-4 w-4 mr-1" />
                {createMutation.isPending ? "Criando..." : "Criar Script"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
