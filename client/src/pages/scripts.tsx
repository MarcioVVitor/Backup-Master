import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Code, Pencil, RotateCcw, Save, Terminal } from "lucide-react";
import { SUPPORTED_MANUFACTURERS } from "@shared/schema";

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

export default function ScriptsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingScript, setEditingScript] = useState<VendorScript | null>(null);
  const [formData, setFormData] = useState({
    manufacturer: "",
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

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/scripts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scripts'] });
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
    return scripts?.find(s => s.manufacturer === manufacturer);
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
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SUPPORTED_MANUFACTURERS.map((mfr) => {
            const script = getScriptForManufacturer(mfr.value);
            const isCustomized = script && !('isDefault' in script);
            
            return (
              <Card key={mfr.value} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={manufacturerColors[mfr.value] || 'bg-gray-500 text-white'}>
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
                    <code className="text-xs font-mono break-all">
                      {script?.command || 'Carregando...'}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Extensao: {script?.fileExtension || '.cfg'}</span>
                    <span>Shell: {script?.useShell !== false ? 'Sim' : 'Nao'}</span>
                  </div>
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(mfr.value)}
                        data-testid={`button-reset-script-${mfr.value}`}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Resetar
                      </Button>
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
    </div>
  );
}
