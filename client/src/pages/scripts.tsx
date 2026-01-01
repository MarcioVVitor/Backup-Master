import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Code, Pencil, Plus, RotateCcw, Save, Search, Terminal, Trash2 } from "lucide-react";

interface ManufacturerRecord {
  id: number;
  value: string;
  label: string;
  color: string | null;
}

interface VendorScript {
  id?: number;
  manufacturer: string;
  command: string;
  description?: string | null;
  fileExtension?: string | null;
  useShell?: boolean | null;
  timeout?: number | null;
  isDefault?: boolean;
}

export default function ScriptsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingScript, setEditingScript] = useState<VendorScript | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    manufacturer: "",
    command: "",
    description: "",
    fileExtension: ".cfg",
    useShell: true,
    timeout: 30000,
  });

  const { data: customScripts, isLoading } = useQuery<VendorScript[]>({
    queryKey: ['/api/scripts'],
    enabled: !!user,
  });

  const { data: manufacturers } = useQuery<ManufacturerRecord[]>({
    queryKey: ['/api/manufacturers'],
    enabled: !!user,
  });

  const [allScripts, setAllScripts] = useState<Record<string, VendorScript>>({});
  const [loadingScripts, setLoadingScripts] = useState(true);

  const loadAllScripts = async () => {
    if (!manufacturers) return;
    setLoadingScripts(true);
    const scripts: Record<string, VendorScript> = {};
    for (const mfr of manufacturers) {
      try {
        const res = await fetch(`/api/scripts/${mfr.value}`, { credentials: 'include' });
        if (res.ok) {
          scripts[mfr.value] = await res.json();
        }
      } catch {
        // ignore
      }
    }
    setAllScripts(scripts);
    setLoadingScripts(false);
  };

  useEffect(() => {
    if (user && manufacturers) {
      loadAllScripts();
    }
  }, [user, manufacturers]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/scripts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scripts'] });
      loadAllScripts();
      toast({ title: "Script salvo com sucesso" });
      setEditingScript(null);
    },
    onError: () => {
      toast({ title: "Erro ao salvar script", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (manufacturer: string) => {
      return apiRequest('DELETE', `/api/scripts/${manufacturer}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scripts'] });
      loadAllScripts();
      toast({ title: "Script resetado para padrao" });
    },
    onError: () => {
      toast({ title: "Erro ao resetar script", variant: "destructive" });
    },
  });

  const handleEdit = async (manufacturer: string) => {
    try {
      const response = await fetch(`/api/scripts/${manufacturer}`, { credentials: 'include' });
      const script = await response.json();
      setFormData({
        manufacturer: script.manufacturer,
        command: script.command,
        description: script.description || "",
        fileExtension: script.fileExtension || ".cfg",
        useShell: script.useShell ?? true,
        timeout: script.timeout || 30000,
      });
      setEditingScript(script);
    } catch {
      toast({ title: "Erro ao carregar script", variant: "destructive" });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const getScriptForManufacturer = (manufacturer: string): VendorScript | undefined => {
    return allScripts[manufacturer];
  };

  const isScriptCustomized = (manufacturer: string): boolean => {
    return customScripts?.some(s => s.manufacturer === manufacturer) ?? false;
  };

  const filteredManufacturers = useMemo(() => {
    if (!manufacturers) return [];
    if (!searchQuery.trim()) return manufacturers;
    
    const query = searchQuery.toLowerCase();
    return manufacturers.filter(mfr => 
      mfr.label.toLowerCase().includes(query) ||
      mfr.value.toLowerCase().includes(query) ||
      (allScripts[mfr.value]?.description || '').toLowerCase().includes(query)
    );
  }, [manufacturers, searchQuery, allScripts]);

  const resetForm = () => {
    setFormData({
      manufacturer: "",
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
    saveMutation.mutate(formData, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        resetForm();
      }
    });
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
            Scripts de Backup
          </h1>
          <p className="text-muted-foreground">Gerencie os comandos de backup por fabricante</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
            Adicionar
          </Button>
        </div>
      </div>

      {loadingScripts || !manufacturers ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filteredManufacturers.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          Nenhum script encontrado para "{searchQuery}"
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredManufacturers.map((mfr) => {
            const script = getScriptForManufacturer(mfr.value);
            const isCustomized = isScriptCustomized(mfr.value);
            
            return (
              <Card key={mfr.value} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge style={{ backgroundColor: mfr.color || '#6b7280', color: 'white' }}>
                      {mfr.label}
                    </Badge>
                    {isCustomized && (
                      <Badge variant="outline" className="text-xs">
                        Customizado
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{mfr.label}</CardTitle>
                  <CardDescription className="text-xs">
                    {script?.description || `Script de backup para ${mfr.label}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted rounded-md p-2">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {script?.command || 'Carregando...'}
                    </pre>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>Extensao: {script?.fileExtension || '.cfg'}</span>
                    <span>Timeout: {((script?.timeout || 30000) / 1000)}s</span>
                    <span>Shell: {script?.useShell !== false ? 'Sim' : 'Nao'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    Credenciais: usuario, senha e porta do cadastro do equipamento
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(mfr.value)}
                      data-testid={`button-edit-script-${mfr.value}`}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    {isCustomized && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(mfr.value)}
                          data-testid={`button-reset-script-${mfr.value}`}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Resetar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid={`button-delete-script-${mfr.value}`}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Script</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o script customizado de "{mfr.label}"?
                                O script sera resetado para o padrao.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(mfr.value)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingScript} onOpenChange={(open) => !open && setEditingScript(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Editar Script - {formData.manufacturer}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="command">Comando de Backup</Label>
              <Textarea
                id="command"
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                rows={4}
                className="font-mono text-sm"
                required
                data-testid="textarea-script-command"
              />
              <p className="text-xs text-muted-foreground">
                Comando que sera enviado via SSH para exportar a configuracao
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descricao</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descricao opcional do script"
                data-testid="input-script-description"
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fileExtension">Extensao do Arquivo</Label>
                <Input
                  id="fileExtension"
                  value={formData.fileExtension}
                  onChange={(e) => setFormData({ ...formData, fileExtension: e.target.value })}
                  placeholder=".cfg"
                  data-testid="input-script-extension"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (ms)</Label>
                <Input
                  id="timeout"
                  type="number"
                  value={formData.timeout}
                  onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
                  data-testid="input-script-timeout"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="useShell"
                checked={formData.useShell}
                onCheckedChange={(checked) => setFormData({ ...formData, useShell: checked })}
                data-testid="switch-script-useshell"
              />
              <Label htmlFor="useShell">Usar Shell Interativo</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingScript(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-script">
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Novo Script de Backup
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveNew} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-manufacturer">Fabricante</Label>
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
              <Label htmlFor="add-command">Comando de Backup</Label>
              <Textarea
                id="add-command"
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                rows={4}
                className="font-mono text-sm"
                required
                data-testid="textarea-add-script-command"
              />
              <p className="text-xs text-muted-foreground">
                Comando que sera enviado via SSH para exportar a configuracao
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
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-fileExtension">Extensao do Arquivo</Label>
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
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="add-useShell"
                checked={formData.useShell}
                onCheckedChange={(checked) => setFormData({ ...formData, useShell: checked })}
                data-testid="switch-add-script-useshell"
              />
              <Label htmlFor="add-useShell">Usar Shell Interativo</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || !formData.manufacturer} data-testid="button-save-new-script">
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "Salvando..." : "Adicionar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
