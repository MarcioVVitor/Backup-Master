import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ChevronDown, ChevronUp, Code, Download, Edit, HardDrive, Plug, Plus, Power, Search, Send, Terminal, Trash2, Upload, Wifi, WifiOff } from "lucide-react";
import { filesize } from "filesize";

interface Firmware {
  id: number;
  name: string;
  manufacturer: string;
  model: string | null;
  version: string | null;
  filename: string;
  objectName: string;
  size: number;
  description: string | null;
  uploadedBy: number | null;
  createdAt: string | null;
}

interface Equipment {
  id: number;
  name: string;
  ip: string;
  manufacturer: string;
  protocol?: string;
  port?: number;
}

interface Manufacturer {
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

export default function FirmwarePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("firmware");
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedFirmware, setSelectedFirmware] = useState<Firmware | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [terminalInput, setTerminalInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  
  // WebSocket terminal state
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnecting, setWsConnecting] = useState(false);
  const [selectedVendorEquipment, setSelectedVendorEquipment] = useState<string>("");
  const [selectedVendorFirmware, setSelectedVendorFirmware] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [isScriptDialogOpen, setIsScriptDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<VendorScript | null>(null);
  const [expandedVendorSection, setExpandedVendorSection] = useState<{vendor: string, section: 'firmware' | 'equipment' | 'script' | null}>({vendor: '', section: null});

  const [formData, setFormData] = useState({
    name: "",
    manufacturer: "",
    model: "",
    version: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exportEquipmentId, setExportEquipmentId] = useState<string>("");

  const { data: firmwareList, isLoading: firmwareLoading } = useQuery<Firmware[]>({
    queryKey: ['/api/firmware'],
    enabled: !!user,
  });

  const { data: manufacturers } = useQuery<Manufacturer[]>({
    queryKey: ['/api/manufacturers'],
    enabled: !!user,
  });

  const { data: equipment } = useQuery<Equipment[]>({
    queryKey: ['/api/equipment'],
    enabled: !!user,
  });

  const { data: customScripts } = useQuery<VendorScript[]>({
    queryKey: ['/api/scripts'],
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const formDataObj = new FormData();
      formDataObj.append('file', selectedFile);
      formDataObj.append('name', formData.name || selectedFile.name);
      formDataObj.append('manufacturer', formData.manufacturer);
      formDataObj.append('model', formData.model);
      formDataObj.append('version', formData.version);
      formDataObj.append('description', formData.description);

      const res = await fetch('/api/firmware', {
        method: 'POST',
        body: formDataObj,
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/firmware'] });
      toast({ title: "Firmware enviado com sucesso" });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao enviar firmware", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/firmware/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/firmware'] });
      toast({ title: "Firmware excluido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir firmware", variant: "destructive" });
    },
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/scripts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scripts'] });
      toast({ title: "Script excluido com sucesso" });
      setExpandedVendorSection({vendor: '', section: null});
    },
    onError: () => {
      toast({ title: "Erro ao excluir script", variant: "destructive" });
    },
  });

  const saveScriptMutation = useMutation({
    mutationFn: async (script: VendorScript) => {
      if (script.id) {
        return apiRequest('PATCH', `/api/scripts/${script.id}`, script);
      } else {
        return apiRequest('POST', '/api/scripts', script);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scripts'] });
      toast({ title: "Script salvo com sucesso" });
      setIsScriptDialogOpen(false);
      setEditingScript(null);
    },
    onError: () => {
      toast({ title: "Erro ao salvar script", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", manufacturer: "", model: "", version: "", description: "" });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (fw: Firmware) => {
    try {
      const response = await fetch(`/api/firmware/${fw.id}/download`, { credentials: 'include' });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fw.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast({ title: "Erro ao baixar firmware", variant: "destructive" });
    }
  };

  const handleExport = async () => {
    if (!selectedFirmware || !exportEquipmentId) {
      toast({ title: "Selecione um equipamento", variant: "destructive" });
      return;
    }

    const eq = equipment?.find(e => e.id === parseInt(exportEquipmentId));
    if (!eq) return;

    setTerminalOpen(true);
    setTerminalOutput(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Iniciando exportacao de firmware...`,
      `[${new Date().toLocaleTimeString()}] Firmware: ${selectedFirmware.name} v${selectedFirmware.version || 'N/A'}`,
      `[${new Date().toLocaleTimeString()}] Destino: ${eq.name} (${eq.ip})`,
      `[${new Date().toLocaleTimeString()}] Status: Aguardando implementacao de transferencia SSH/SFTP`,
    ]);
    setIsExportDialogOpen(false);
    toast({ title: "Exportacao iniciada - veja o terminal" });
  };

  // WebSocket terminal functions
  const connectTerminal = useCallback((equipmentId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    
    setWsConnecting(true);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'connect', equipmentId: parseInt(equipmentId) }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'connected') {
        setWsConnected(true);
        setWsConnecting(false);
        setTerminalOutput(prev => [...prev, `[CONECTADO via ${data.protocol?.toUpperCase()}]`]);
      } else if (data.type === 'output') {
        setTerminalOutput(prev => [...prev, data.data]);
      } else if (data.type === 'status') {
        setTerminalOutput(prev => [...prev, `[STATUS] ${data.message}`]);
      } else if (data.type === 'error') {
        setTerminalOutput(prev => [...prev, `[ERRO] ${data.message}`]);
        setWsConnecting(false);
      } else if (data.type === 'disconnected') {
        setWsConnected(false);
        setTerminalOutput(prev => [...prev, `[DESCONECTADO]`]);
      }
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    };
    
    ws.onclose = () => {
      setWsConnected(false);
      setWsConnecting(false);
    };
    
    ws.onerror = () => {
      setTerminalOutput(prev => [...prev, `[ERRO] Falha na conexao WebSocket`]);
      setWsConnecting(false);
    };
  }, []);
  
  const disconnectTerminal = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'disconnect' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  }, []);
  
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleTerminalCommand = () => {
    if (!terminalInput.trim()) return;
    
    if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', command: terminalInput + '\n' }));
    } else {
      setTerminalOutput(prev => [...prev, `[ERRO] Terminal nao conectado. Selecione um equipamento e clique em Conectar.`]);
    }
    setTerminalInput("");
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTerminalCommand();
    }
  };

  const filteredFirmware = useMemo(() => {
    if (!firmwareList) return [];
    if (!searchQuery.trim()) return firmwareList;
    const query = searchQuery.toLowerCase();
    return firmwareList.filter(fw =>
      fw.name.toLowerCase().includes(query) ||
      fw.manufacturer.toLowerCase().includes(query) ||
      fw.model?.toLowerCase().includes(query) ||
      fw.version?.toLowerCase().includes(query) ||
      fw.filename.toLowerCase().includes(query)
    );
  }, [firmwareList, searchQuery]);

  const filteredManufacturers = useMemo(() => {
    if (!manufacturers) return [];
    if (!vendorSearchQuery.trim()) return manufacturers;
    const query = vendorSearchQuery.toLowerCase();
    return manufacturers.filter(mfr =>
      mfr.label.toLowerCase().includes(query) ||
      mfr.value.toLowerCase().includes(query)
    );
  }, [manufacturers, vendorSearchQuery]);

  const getManufacturerColor = (manufacturer: string): string => {
    const mfr = manufacturers?.find(m => m.value === manufacturer);
    return mfr?.color || "#6b7280";
  };

  const getManufacturerLabel = (manufacturer: string): string => {
    const mfr = manufacturers?.find(m => m.value === manufacturer);
    return mfr?.label || manufacturer;
  };

  const getScriptForManufacturer = (manufacturer: string): VendorScript | undefined => {
    return customScripts?.find(s => s.manufacturer === manufacturer);
  };

  if (authLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6">
          <p className="text-muted-foreground">Faca login para acessar esta pagina.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-6 flex-1 overflow-auto">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <HardDrive className="h-6 w-6" />
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">Firmware</h1>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="firmware" data-testid="tab-firmware">
                <HardDrive className="h-4 w-4 mr-2" />
                Firmware
              </TabsTrigger>
              <TabsTrigger value="vendors" data-testid="tab-vendors">
                <Code className="h-4 w-4 mr-2" />
                Vendors
              </TabsTrigger>
            </TabsList>

            <TabsContent value="firmware" className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar firmware..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-firmware"
                  />
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-firmware">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Firmware
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Firmware</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); uploadMutation.mutate(); }} className="space-y-4">
                      <div>
                        <Label>Arquivo *</Label>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          data-testid="input-firmware-file"
                        />
                      </div>
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Nome do firmware"
                          data-testid="input-firmware-name"
                        />
                      </div>
                      <div>
                        <Label>Fabricante *</Label>
                        <Select
                          value={formData.manufacturer}
                          onValueChange={(v) => setFormData({ ...formData, manufacturer: v })}
                        >
                          <SelectTrigger data-testid="select-firmware-manufacturer">
                            <SelectValue placeholder="Selecione o fabricante" />
                          </SelectTrigger>
                          <SelectContent>
                            {manufacturers?.map((mfr) => (
                              <SelectItem key={mfr.value} value={mfr.value}>
                                {mfr.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Modelo</Label>
                          <Input
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                            placeholder="ex: RB4011"
                            data-testid="input-firmware-model"
                          />
                        </div>
                        <div>
                          <Label>Versao</Label>
                          <Input
                            value={formData.version}
                            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                            placeholder="ex: 7.15.3"
                            data-testid="input-firmware-version"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Descricao</Label>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Descricao opcional"
                          rows={2}
                          data-testid="input-firmware-description"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={!selectedFile || !formData.manufacturer || uploadMutation.isPending}
                          data-testid="button-submit-firmware"
                        >
                          {uploadMutation.isPending ? "Enviando..." : "Enviar"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {firmwareLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : filteredFirmware.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {searchQuery ? "Nenhum firmware encontrado." : "Nenhum firmware cadastrado."}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredFirmware.map((fw) => (
                    <Card key={fw.id} data-testid={`card-firmware-${fw.id}`}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <HardDrive className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium" data-testid={`text-firmware-name-${fw.id}`}>{fw.name}</span>
                                <Badge
                                  variant="secondary"
                                  style={{ backgroundColor: getManufacturerColor(fw.manufacturer) + '20', color: getManufacturerColor(fw.manufacturer) }}
                                >
                                  {getManufacturerLabel(fw.manufacturer)}
                                </Badge>
                                {fw.version && <Badge variant="outline">v{fw.version}</Badge>}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {fw.model && <span>{fw.model} - </span>}
                                <span>{fw.filename}</span>
                                <span className="mx-2">|</span>
                                <span>{filesize(fw.size)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDownload(fw)}
                              title="Baixar"
                              data-testid={`button-download-firmware-${fw.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { setSelectedFirmware(fw); setIsExportDialogOpen(true); }}
                              title="Exportar para equipamento"
                              data-testid={`button-export-firmware-${fw.id}`}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" title="Excluir" data-testid={`button-delete-firmware-${fw.id}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Firmware</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir "{fw.name}"? Esta acao nao pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(fw.id)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="vendors" className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar vendors..."
                    value={vendorSearchQuery}
                    onChange={(e) => setVendorSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-vendors"
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Scripts de Atualizacao por Fabricante</h3>
                  <div className="space-y-2">
                    {filteredManufacturers.map((mfr) => {
                      const script = getScriptForManufacturer(mfr.value);
                      const vendorFirmwareList = firmwareList?.filter(f => f.manufacturer === mfr.value) || [];
                      const vendorEquipmentList = equipment?.filter(e => e.manufacturer === mfr.value) || [];
                      const isSelected = selectedVendor === mfr.value;
                      const isFirmwareExpanded = expandedVendorSection.vendor === mfr.value && expandedVendorSection.section === 'firmware';
                      const isEquipmentExpanded = expandedVendorSection.vendor === mfr.value && expandedVendorSection.section === 'equipment';
                      const isScriptExpanded = expandedVendorSection.vendor === mfr.value && expandedVendorSection.section === 'script';
                      
                      return (
                        <Card 
                          key={mfr.value} 
                          data-testid={`card-vendor-${mfr.value}`}
                          className={isSelected ? "ring-2 ring-primary" : ""}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle 
                                className="text-base flex items-center gap-2 cursor-pointer"
                                onClick={() => setSelectedVendor(isSelected ? "" : mfr.value)}
                              >
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: mfr.color || "#6b7280" }}
                                />
                                {mfr.label}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={() => setExpandedVendorSection(
                                    isFirmwareExpanded ? {vendor: '', section: null} : {vendor: mfr.value, section: 'firmware'}
                                  )}
                                  data-testid={`button-firmware-${mfr.value}`}
                                >
                                  <HardDrive className="h-3 w-3 mr-1" />
                                  {vendorFirmwareList.length} firmware
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={() => setExpandedVendorSection(
                                    isEquipmentExpanded ? {vendor: '', section: null} : {vendor: mfr.value, section: 'equipment'}
                                  )}
                                  data-testid={`button-equipment-${mfr.value}`}
                                >
                                  <Plug className="h-3 w-3 mr-1" />
                                  {vendorEquipmentList.length} equip.
                                </Button>
                                <Button
                                  variant={script && !script.isDefault ? "secondary" : "outline"}
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={() => setExpandedVendorSection(
                                    isScriptExpanded ? {vendor: '', section: null} : {vendor: mfr.value, section: 'script'}
                                  )}
                                  data-testid={`button-script-${mfr.value}`}
                                >
                                  <Code className="h-3 w-3 mr-1" />
                                  Script
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {isFirmwareExpanded && (
                              <div className="p-3 bg-muted/50 rounded-md space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-sm font-medium flex items-center gap-1">
                                    <HardDrive className="h-4 w-4" /> Firmware Disponiveis
                                  </h4>
                                  <Button size="sm" variant="ghost" onClick={() => setExpandedVendorSection({vendor: '', section: null})}>
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                </div>
                                {vendorFirmwareList.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Nenhum firmware cadastrado para este fabricante.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {vendorFirmwareList.map(fw => (
                                      <div key={fw.id} className="flex items-center justify-between gap-2 p-2 bg-background rounded border text-sm">
                                        <div>
                                          <span className="font-medium">{fw.name}</span>
                                          {fw.version && <span className="ml-2 text-muted-foreground">v{fw.version}</span>}
                                        </div>
                                        <div className="flex gap-1">
                                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(fw)} title="Baixar">
                                            <Download className="h-3 w-3" />
                                          </Button>
                                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedFirmware(fw); setIsExportDialogOpen(true); }} title="Exportar">
                                            <Upload className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {isEquipmentExpanded && (
                              <div className="p-3 bg-muted/50 rounded-md space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-sm font-medium flex items-center gap-1">
                                    <Plug className="h-4 w-4" /> Equipamentos
                                  </h4>
                                  <Button size="sm" variant="ghost" onClick={() => setExpandedVendorSection({vendor: '', section: null})}>
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                </div>
                                {vendorEquipmentList.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado para este fabricante.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {vendorEquipmentList.map(eq => (
                                      <div key={eq.id} className="flex items-center justify-between gap-2 p-2 bg-background rounded border text-sm">
                                        <div>
                                          <span className="font-medium">{eq.name}</span>
                                          <span className="ml-2 text-muted-foreground">{eq.ip}</span>
                                          <Badge variant="outline" className="ml-2 text-xs">{eq.protocol?.toUpperCase() || 'SSH'}</Badge>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7"
                                          onClick={() => {
                                            setSelectedVendor(mfr.value);
                                            setSelectedVendorEquipment(eq.id.toString());
                                            setTerminalOutput([]);
                                            connectTerminal(eq.id.toString());
                                          }}
                                          disabled={wsConnecting}
                                          data-testid={`button-connect-eq-${eq.id}`}
                                        >
                                          <Terminal className="h-3 w-3 mr-1" />
                                          Conectar
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {isScriptExpanded && (
                              <div className="p-3 bg-muted/50 rounded-md space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-sm font-medium flex items-center gap-1">
                                    <Code className="h-4 w-4" /> Script de Atualizacao
                                  </h4>
                                  <Button size="sm" variant="ghost" onClick={() => setExpandedVendorSection({vendor: '', section: null})}>
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="p-2 bg-background rounded border">
                                  <p className="text-sm font-medium">{script?.description || "Script padrao"}</p>
                                  <pre className="text-xs text-muted-foreground font-mono mt-1 whitespace-pre-wrap">{script?.command || "N/A"}</pre>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setEditingScript(script || { manufacturer: mfr.value, command: "", description: "" });
                                      setIsScriptDialogOpen(true);
                                    }}
                                    data-testid={`button-edit-script-${mfr.value}`}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Editar Script
                                  </Button>
                                  {script && !script.isDefault && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="destructive" data-testid={`button-delete-script-${mfr.value}`}>
                                          <Trash2 className="h-4 w-4 mr-1" />
                                          Excluir
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir Script</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Tem certeza que deseja excluir o script customizado de {mfr.label}? O script padrao sera usado.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteScriptMutation.mutate(script.id!)}>
                                            Excluir
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {!isFirmwareExpanded && !isEquipmentExpanded && !isScriptExpanded && (
                              <div className="text-sm text-muted-foreground">
                                <p>{script?.description || "Script padrao"}</p>
                                <div className="flex items-center gap-2 text-xs mt-1">
                                  <Code className="h-3 w-3" />
                                  <span className="font-mono truncate">{script?.command?.substring(0, 50) || "N/A"}...</span>
                                </div>
                              </div>
                            )}
                            
                            {isSelected && !isFirmwareExpanded && !isEquipmentExpanded && !isScriptExpanded && (
                              <div className="pt-2 border-t space-y-3">
                                <div>
                                  <Label className="text-xs">Firmware para Atualizacao</Label>
                                  <Select 
                                    value={selectedVendorFirmware} 
                                    onValueChange={setSelectedVendorFirmware}
                                  >
                                    <SelectTrigger className="mt-1" data-testid={`select-firmware-${mfr.value}`}>
                                      <SelectValue placeholder="Selecione o firmware" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {vendorFirmwareList.map(fw => (
                                        <SelectItem key={fw.id} value={fw.id.toString()}>
                                          {fw.name} {fw.version && `v${fw.version}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <Label className="text-xs">Equipamento</Label>
                                  <Select 
                                    value={selectedVendorEquipment} 
                                    onValueChange={setSelectedVendorEquipment}
                                  >
                                    <SelectTrigger className="mt-1" data-testid={`select-equipment-${mfr.value}`}>
                                      <SelectValue placeholder="Selecione o equipamento" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {vendorEquipmentList.map(eq => (
                                        <SelectItem key={eq.id} value={eq.id.toString()}>
                                          {eq.name} ({eq.ip}) - {eq.protocol?.toUpperCase() || "SSH"}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant={wsConnected ? "destructive" : "default"}
                                    onClick={() => {
                                      if (wsConnected) {
                                        disconnectTerminal();
                                      } else if (selectedVendorEquipment) {
                                        setTerminalOpen(true);
                                        setTerminalOutput([]);
                                        connectTerminal(selectedVendorEquipment);
                                      }
                                    }}
                                    disabled={!selectedVendorEquipment || wsConnecting}
                                    data-testid={`button-connect-${mfr.value}`}
                                  >
                                    {wsConnecting ? (
                                      <>Conectando...</>
                                    ) : wsConnected ? (
                                      <><WifiOff className="h-4 w-4 mr-1" /> Desconectar</>
                                    ) : (
                                      <><Wifi className="h-4 w-4 mr-1" /> Conectar CLI</>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingScript(script || { manufacturer: mfr.value, command: "", description: "" });
                                      setIsScriptDialogOpen(true);
                                    }}
                                    data-testid={`button-edit-script-inline-${mfr.value}`}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Editar Script
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Terminal CLI Interativo</h3>
                    {wsConnected && (
                      <Badge variant="default" className="bg-green-600">
                        <Wifi className="h-3 w-3 mr-1" /> Conectado
                      </Badge>
                    )}
                  </div>
                  <Card className="bg-zinc-900 text-zinc-100 overflow-hidden">
                    <div 
                      ref={terminalRef}
                      className="h-[400px] overflow-auto p-3 font-mono text-sm"
                      data-testid="terminal-output"
                    >
                      {terminalOutput.length === 0 ? (
                        <p className="text-zinc-500">
                          Selecione um fabricante, escolha o equipamento e clique em "Conectar CLI" para iniciar uma sessao interativa.
                        </p>
                      ) : (
                        terminalOutput.map((line, i) => (
                          <pre key={i} className="whitespace-pre-wrap break-all">{line}</pre>
                        ))
                      )}
                    </div>
                    <div className="flex items-center gap-2 p-2 border-t border-zinc-700 bg-zinc-800">
                      <span className="text-zinc-400 font-mono text-sm">
                        {wsConnected ? ">" : "$"}
                      </span>
                      <Input
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={wsConnected ? "Digite um comando..." : "Conecte a um equipamento primeiro..."}
                        disabled={!wsConnected}
                        className="flex-1 bg-transparent border-0 text-zinc-100 font-mono text-sm focus-visible:ring-0 placeholder:text-zinc-600"
                        data-testid="input-terminal-command"
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={handleTerminalCommand} 
                        disabled={!wsConnected}
                        className="text-zinc-400"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exportar Firmware para Equipamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedFirmware && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{selectedFirmware.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {getManufacturerLabel(selectedFirmware.manufacturer)} {selectedFirmware.version && `v${selectedFirmware.version}`}
                  </p>
                </div>
              )}
              <div>
                <Label>Equipamento de Destino</Label>
                <Select value={exportEquipmentId} onValueChange={setExportEquipmentId}>
                  <SelectTrigger data-testid="select-export-equipment">
                    <SelectValue placeholder="Selecione o equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipment?.filter(e => e.manufacturer === selectedFirmware?.manufacturer).map((eq) => (
                      <SelectItem key={eq.id} value={eq.id.toString()}>
                        {eq.name} ({eq.ip})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Mostrando apenas equipamentos {selectedFirmware ? getManufacturerLabel(selectedFirmware.manufacturer) : ""}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleExport} disabled={!exportEquipmentId} data-testid="button-confirm-export">
                  <Send className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isScriptDialogOpen} onOpenChange={(open) => { setIsScriptDialogOpen(open); if (!open) setEditingScript(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingScript?.id ? "Editar Script" : "Criar Script"} - {editingScript ? getManufacturerLabel(editingScript.manufacturer) : ""}
              </DialogTitle>
            </DialogHeader>
            {editingScript && (
              <form onSubmit={(e) => { e.preventDefault(); saveScriptMutation.mutate(editingScript); }} className="space-y-4">
                <div>
                  <Label>Descricao</Label>
                  <Input
                    value={editingScript.description || ""}
                    onChange={(e) => setEditingScript({ ...editingScript, description: e.target.value })}
                    placeholder="Descricao do script"
                    data-testid="input-script-description"
                  />
                </div>
                <div>
                  <Label>Comando de Atualizacao *</Label>
                  <Textarea
                    value={editingScript.command}
                    onChange={(e) => setEditingScript({ ...editingScript, command: e.target.value })}
                    placeholder="Comando a ser executado para atualizacao de firmware"
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="input-script-command"
                  />
                  <div className="mt-2 p-3 bg-muted rounded-md text-xs">
                    <p className="font-medium mb-2">Placeholders disponiveis:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li><code className="bg-background px-1 rounded">{"{{SERVER_IP}}"}</code> - IP do servidor NBM (configure em Administracao)</li>
                      <li><code className="bg-background px-1 rounded">{"{{FIRMWARE_FILE}}"}</code> - Nome do arquivo de firmware selecionado</li>
                      <li><code className="bg-background px-1 rounded">{"{{EQUIPMENT_IP}}"}</code> - IP do equipamento de destino</li>
                    </ul>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Extensao do Arquivo</Label>
                    <Input
                      value={editingScript.fileExtension || ""}
                      onChange={(e) => setEditingScript({ ...editingScript, fileExtension: e.target.value })}
                      placeholder=".cfg"
                      data-testid="input-script-extension"
                    />
                  </div>
                  <div>
                    <Label>Timeout (segundos)</Label>
                    <Input
                      type="number"
                      value={editingScript.timeout || 30}
                      onChange={(e) => setEditingScript({ ...editingScript, timeout: parseInt(e.target.value) })}
                      placeholder="30"
                      data-testid="input-script-timeout"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setIsScriptDialogOpen(false); setEditingScript(null); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={!editingScript.command.trim() || saveScriptMutation.isPending} data-testid="button-save-script">
                    {saveScriptMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-t bg-card">
        <button
          onClick={() => setTerminalOpen(!terminalOpen)}
          className="w-full flex items-center justify-between p-3 hover-elevate"
          data-testid="button-toggle-terminal"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <span className="font-medium text-sm">Terminal CLI</span>
          </div>
          {terminalOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>

        {terminalOpen && (
          <div className="border-t">
            <ScrollArea className="h-48 bg-zinc-900 text-zinc-100 p-3 font-mono text-sm">
              {terminalOutput.length === 0 ? (
                <p className="text-zinc-500">Terminal pronto. Comandos serao executados via SSH.</p>
              ) : (
                terminalOutput.map((line, i) => (
                  <p key={i} className="whitespace-pre-wrap">{line}</p>
                ))
              )}
            </ScrollArea>
            <div className="flex items-center gap-2 p-2 border-t bg-zinc-900">
              <span className="text-zinc-400 font-mono text-sm">$</span>
              <Input
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTerminalCommand()}
                placeholder="Digite um comando..."
                className="flex-1 bg-transparent border-0 text-zinc-100 font-mono text-sm focus-visible:ring-0"
                data-testid="input-terminal-command"
              />
              <Button size="icon" variant="ghost" onClick={handleTerminalCommand} className="text-zinc-400">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
