import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Upload, 
  Trash2, 
  FileCode, 
  Download, 
  Search,
  Filter,
  Loader2,
  X,
  RotateCcw,
  Play,
  Server,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Palette,
  Square,
  Send,
  Wifi,
  WifiOff
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

const MANUFACTURERS = [
  { value: "mikrotik", label: "Mikrotik" },
  { value: "huawei", label: "Huawei" },
  { value: "cisco", label: "Cisco" },
  { value: "nokia", label: "Nokia" },
  { value: "zte", label: "ZTE" },
  { value: "datacom", label: "Datacom" },
  { value: "datacom-dmos", label: "Datacom DMOS" },
  { value: "juniper", label: "Juniper" },
];

interface Firmware {
  id: number;
  name: string;
  version: string;
  manufacturer: string;
  filename: string;
  size: number;
  createdAt: string;
}

interface VendorScript {
  id: number;
  name: string;
  manufacturer: string;
  command: string;
  description: string | null;
  fileExtension: string;
  timeout: number;
  isDefault: boolean;
}

interface Equipment {
  id: number;
  name: string;
  ip: string;
  port?: number;
  manufacturer: string;
  model: string | null;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: Date;
}

interface TerminalTheme {
  id: string;
  name: string;
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  prompt: string;
  input: string;
  output: string;
  error: string;
  system: string;
}

const TERMINAL_THEMES: TerminalTheme[] = [
  {
    id: "termius-dark",
    name: "Termius Dark",
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    cursor: "#ffffff",
    selection: "#264f78",
    prompt: "#569cd6",
    input: "#9cdcfe",
    output: "#d4d4d4",
    error: "#f14c4c",
    system: "#6a9955"
  },
  {
    id: "dracula",
    name: "Dracula",
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    selection: "#44475a",
    prompt: "#bd93f9",
    input: "#ff79c6",
    output: "#f8f8f2",
    error: "#ff5555",
    system: "#50fa7b"
  },
  {
    id: "nord",
    name: "Nord",
    background: "#2e3440",
    foreground: "#d8dee9",
    cursor: "#d8dee9",
    selection: "#434c5e",
    prompt: "#88c0d0",
    input: "#81a1c1",
    output: "#d8dee9",
    error: "#bf616a",
    system: "#a3be8c"
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    background: "#1a1b26",
    foreground: "#a9b1d6",
    cursor: "#c0caf5",
    selection: "#33467c",
    prompt: "#7aa2f7",
    input: "#bb9af7",
    output: "#a9b1d6",
    error: "#f7768e",
    system: "#9ece6a"
  },
  {
    id: "monokai",
    name: "Monokai",
    background: "#272822",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    selection: "#49483e",
    prompt: "#a6e22e",
    input: "#f92672",
    output: "#f8f8f2",
    error: "#f92672",
    system: "#e6db74"
  },
  {
    id: "matrix",
    name: "Matrix",
    background: "#000000",
    foreground: "#00ff41",
    cursor: "#00ff41",
    selection: "#003b00",
    prompt: "#00cc33",
    input: "#00ff41",
    output: "#00ff41",
    error: "#ff0000",
    system: "#39ff14"
  },
  {
    id: "retro-green",
    name: "Retro Green",
    background: "#0a0a0a",
    foreground: "#00ff00",
    cursor: "#00ff00",
    selection: "#003300",
    prompt: "#00cc00",
    input: "#00ff00",
    output: "#00ff00",
    error: "#ff0000",
    system: "#00ff00"
  },
  {
    id: "retro-amber",
    name: "Retro Amber",
    background: "#0a0a0a",
    foreground: "#ffb000",
    cursor: "#ffb000",
    selection: "#332200",
    prompt: "#ff8c00",
    input: "#ffb000",
    output: "#ffb000",
    error: "#ff4444",
    system: "#ffcc00"
  }
];

export default function FirmwarePage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [firmwareName, setFirmwareName] = useState("");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("all");
  
  const [recoveryManufacturer, setRecoveryManufacturer] = useState("all");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("");
  const [selectedScript, setSelectedScript] = useState<VendorScript | null>(null);
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<TerminalTheme>(TERMINAL_THEMES[0]);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>([]);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("firmware-terminal-theme");
    if (savedTheme) {
      const theme = TERMINAL_THEMES.find(t => t.id === savedTheme);
      if (theme) setCurrentTheme(theme);
    }
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines(prev => [...prev, { type, content, timestamp: new Date() }]);
  }, []);

  const handleConnect = async (equipmentId: string) => {
    const eq = equipment.find(e => e.id.toString() === equipmentId);
    if (!eq) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setTerminalOpen(true);
    setIsConnecting(true);
    setLines([]);
    addLine('system', `Conectando a ${eq.name} (${eq.ip})...`);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'connect', equipmentId: eq.id }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            setIsConnected(true);
            setIsConnecting(false);
            addLine('system', `Conectado via ${data.protocol?.toUpperCase() || 'SSH'}`);
            inputRef.current?.focus();
          } else if (data.type === 'status') {
            addLine('system', data.message);
          } else if (data.type === 'output') {
            const outputLines = data.data.split('\n').filter((l: string) => l.length > 0);
            outputLines.forEach((line: string) => {
              addLine('output', line);
            });
          } else if (data.type === 'error') {
            addLine('error', data.message);
            setIsConnecting(false);
          } else if (data.type === 'disconnected') {
            addLine('system', 'Desconectado');
            setIsConnected(false);
          }
        } catch {
          addLine('output', event.data);
        }
      };

      ws.onerror = () => {
        addLine('error', 'Erro na conexao WebSocket');
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onclose = () => {
        addLine('system', 'Conexao encerrada');
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
      };
    } catch (err) {
      addLine('error', 'Falha ao estabelecer conexao');
      setIsConnected(false);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'disconnect' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsRecoveryRunning(false);
    setTerminalOpen(false);
    setLines([]);
  };

  const handleSendCommand = () => {
    if (!commandInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    addLine('input', `$ ${commandInput}`);
    wsRef.current.send(JSON.stringify({ type: 'input', command: commandInput + '\n' }));
    setCommandInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendCommand();
    }
  };

  const handleThemeChange = (theme: TerminalTheme) => {
    setCurrentTheme(theme);
    localStorage.setItem("firmware-terminal-theme", theme.id);
    setThemeDialogOpen(false);
  };

  const { data: firmware = [], isLoading, error } = useQuery<Firmware[]>({
    queryKey: ["/api/firmware"],
  });

  const { data: scripts = [] } = useQuery<VendorScript[]>({
    queryKey: ["/api/scripts"],
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const uploadFirmware = useMutation({
    mutationFn: async (data: { file: File; name: string; version: string; manufacturer: string }) => {
      const formData = new FormData();
      formData.append("file", data.file);
      formData.append("name", data.name);
      formData.append("version", data.version);
      formData.append("manufacturer", data.manufacturer);
      
      const response = await fetch("/api/firmware", {
        method: "POST",
        credentials: "include",
        body: formData
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firmware"] });
      setUploadDialogOpen(false);
      resetForm();
      toast({ title: "Firmware enviado com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erro ao enviar firmware", variant: "destructive" });
    }
  });

  const deleteFirmware = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/firmware/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) throw new Error("Delete failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firmware"] });
      toast({ title: "Firmware excluído" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir firmware", variant: "destructive" });
    }
  });

  const [isRecoveryRunning, setIsRecoveryRunning] = useState(false);

  const startRecoveryExecution = useCallback((equipmentId: number, scriptId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    
    setLines([]);
    setTerminalOpen(true);
    setIsRecoveryRunning(true);
    setIsConnecting(true);
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      setLines(prev => [...prev, { 
        type: 'system', 
        content: 'Conectado ao servidor, iniciando recuperação...', 
        timestamp: new Date() 
      }]);
      ws.send(JSON.stringify({ 
        type: 'execute_recovery', 
        equipmentId, 
        scriptId 
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'output') {
          const outputLines = data.data.split('\n').filter((l: string) => l.length > 0);
          outputLines.forEach((line: string) => {
            setLines(prev => [...prev, { type: 'output', content: line, timestamp: new Date() }]);
          });
          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          }
        } else if (data.type === 'recovery_start') {
          setIsConnecting(false);
          setIsConnected(true);
          setLines(prev => [...prev, { 
            type: 'system', 
            content: data.message, 
            timestamp: new Date() 
          }]);
        } else if (data.type === 'connected') {
          setIsConnecting(false);
          setIsConnected(true);
        } else if (data.type === 'recovery_complete') {
          setIsRecoveryRunning(false);
          toast({ title: "Recuperação concluída com sucesso" });
          setLines(prev => [...prev, { 
            type: 'system', 
            content: '=== RECUPERACAO FINALIZADA ===', 
            timestamp: new Date() 
          }]);
        } else if (data.type === 'recovery_error' || data.type === 'error') {
          setIsRecoveryRunning(false);
          setLines(prev => [...prev, { 
            type: 'error', 
            content: data.message, 
            timestamp: new Date() 
          }]);
          toast({ title: data.message, variant: "destructive" });
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };
    
    ws.onerror = () => {
      setIsConnected(false);
      setIsConnecting(false);
      setIsRecoveryRunning(false);
      setLines(prev => [...prev, { 
        type: 'error', 
        content: 'Erro de conexão WebSocket', 
        timestamp: new Date() 
      }]);
      toast({ title: "Erro de conexão WebSocket", variant: "destructive" });
    };
    
    ws.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      setIsRecoveryRunning(false);
      setLines(prev => [...prev, { 
        type: 'system', 
        content: 'Conexão encerrada', 
        timestamp: new Date() 
      }]);
    };
  }, [toast]);

  const resetForm = () => {
    setSelectedFile(null);
    setFirmwareName("");
    setFirmwareVersion("");
    setManufacturer("");
  };

  const handleDelete = (id: number) => {
    if (confirm("Excluir este firmware?")) {
      deleteFirmware.mutate(id);
    }
  };

  const handleUpload = () => {
    if (selectedFile && firmwareName && firmwareVersion && manufacturer) {
      uploadFirmware.mutate({
        file: selectedFile,
        name: firmwareName,
        version: firmwareVersion,
        manufacturer
      });
    }
  };

  const handleDownload = async (fw: Firmware) => {
    try {
      const response = await fetch(`/api/firmware/${fw.id}/download`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fw.filename || `${fw.name}-${fw.version}.bin`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Download iniciado" });
    } catch (err) {
      toast({ title: "Erro ao baixar firmware", variant: "destructive" });
    }
  };

  const handleExecuteRecovery = () => {
    if (selectedEquipment && selectedScript) {
      setRecoveryDialogOpen(false);
      startRecoveryExecution(parseInt(selectedEquipment), selectedScript.id);
    }
  };

  const filteredFirmware = firmware.filter((fw) => {
    const matchesSearch = fw.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (fw.version || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = filterManufacturer === "all" || fw.manufacturer === filterManufacturer;
    return matchesSearch && matchesManufacturer;
  });

  const updateScripts = scripts.filter(s => {
    const nameLC = s.name.toLowerCase();
    const descLC = (s.description || '').toLowerCase();
    const isUpdateName = nameLC.includes('atualiza') || nameLC.includes('update') || 
                         nameLC.includes('firmware') || nameLC.includes('upgrade');
    const isUpdateDesc = descLC.includes('atualiza') || descLC.includes('update') || 
                         descLC.includes('firmware') || descLC.includes('upgrade');
    const isBackup = nameLC.includes('backup') || descLC.includes('backup');
    const isRecovery = nameLC.includes('recupera') || nameLC.includes('recovery');
    return (isUpdateName || isUpdateDesc) && !isBackup && !isRecovery;
  });

  const filteredRecoveryScripts = recoveryManufacturer === "all" 
    ? updateScripts 
    : updateScripts.filter(s => s.manufacturer === recoveryManufacturer);

  const filteredEquipment = selectedScript 
    ? equipment.filter(e => e.manufacturer === selectedScript.manufacturer)
    : equipment;

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="text-center py-12">
          <p className="text-red-500">Erro ao carregar firmwares</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.firmware.title}</h1>
          <p className="text-muted-foreground">{t.firmware.subtitle}</p>
        </div>
      </div>

      <Tabs defaultValue="repository" className="space-y-4">
        <TabsList>
          <TabsTrigger value="repository" data-testid="tab-repository">
            <FileCode className="h-4 w-4 mr-2" />
            {t.firmware.repository}
          </TabsTrigger>
          <TabsTrigger value="recovery" data-testid="tab-recovery">
            <RotateCcw className="h-4 w-4 mr-2" />
            {t.firmware.recovery}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="repository" className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
            <div className="flex flex-col gap-4 md:flex-row md:items-center flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={t.firmware.searchFirmware} 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-firmware"
                />
                {searchTerm && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-manufacturer">
                    <SelectValue placeholder={t.firmware.selectManufacturer} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.firmware.allManufacturers}</SelectItem>
                    {MANUFACTURERS.map((mfr) => (
                      <SelectItem key={mfr.value} value={mfr.value}>
                        {mfr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-upload-firmware">
                  <Upload className="h-4 w-4 mr-2" /> {t.firmware.uploadFirmware}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload de Firmware</DialogTitle>
                  <DialogDescription>
                    Envie um novo arquivo de firmware para o repositório
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="firmwareName">Nome do Firmware</Label>
                    <Input 
                      id="firmwareName"
                      value={firmwareName}
                      onChange={(e) => setFirmwareName(e.target.value)}
                      placeholder="Ex: RouterOS"
                      data-testid="input-firmware-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firmwareVersion">Versão</Label>
                    <Input 
                      id="firmwareVersion"
                      value={firmwareVersion}
                      onChange={(e) => setFirmwareVersion(e.target.value)}
                      placeholder="Ex: 7.12.1"
                      data-testid="input-firmware-version"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Fabricante</Label>
                    <Select value={manufacturer} onValueChange={setManufacturer}>
                      <SelectTrigger data-testid="select-manufacturer">
                        <SelectValue placeholder="Selecione o fabricante" />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUFACTURERS.map((mfr) => (
                          <SelectItem key={mfr.value} value={mfr.value}>
                            {mfr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firmwareFile">Arquivo</Label>
                    <Input 
                      id="firmwareFile"
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      data-testid="input-firmware-file"
                    />
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground">
                        {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setUploadDialogOpen(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleUpload} 
                    disabled={!selectedFile || !firmwareName || !firmwareVersion || !manufacturer || uploadFirmware.isPending}
                    data-testid="button-confirm-upload"
                  >
                    {uploadFirmware.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Enviar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              <div className="col-span-full flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFirmware.length > 0 ? (
              filteredFirmware.map((fw) => (
                <Card key={fw.id} data-testid={`card-firmware-${fw.id}`}>
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2 space-y-0">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                        <FileCode className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{fw.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{fw.version}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fabricante:</span>
                        <span className="font-medium uppercase">{fw.manufacturer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tamanho:</span>
                        <span>{((fw.size || 0) / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Data:</span>
                        <span>{fw.createdAt ? format(new Date(fw.createdAt), "dd/MM/yyyy") : "-"}</span>
                      </div>
                      <div className="pt-3 flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownload(fw)}
                          data-testid={`button-download-${fw.id}`}
                        >
                          <Download className="h-4 w-4 mr-2" /> Download
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500" 
                          onClick={() => handleDelete(fw.id)}
                          data-testid={`button-delete-${fw.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum firmware disponível</p>
                <p className="text-sm mt-1">Clique em "Upload Firmware" para adicionar</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Scripts de Atualização / Recuperação
              </CardTitle>
              <CardDescription>
                Selecione um script para executar a recuperação ou atualização de firmware em um equipamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={recoveryManufacturer} onValueChange={setRecoveryManufacturer}>
                    <SelectTrigger className="w-[180px]" data-testid="select-recovery-manufacturer">
                      <SelectValue placeholder="Filtrar por fabricante" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os fabricantes</SelectItem>
                      {MANUFACTURERS.map((mfr) => (
                        <SelectItem key={mfr.value} value={mfr.value}>
                          {mfr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredRecoveryScripts.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRecoveryScripts.map((script) => (
                    <Card 
                      key={script.id} 
                      className={`cursor-pointer transition-all ${
                        selectedScript?.id === script.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedScript(selectedScript?.id === script.id ? null : script)}
                      data-testid={`card-script-${script.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="uppercase font-bold text-[10px]">
                            {script.manufacturer}
                          </Badge>
                          {selectedScript?.id === script.id && (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <CardTitle className="text-base mt-2">{script.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {script.description || "Sem descrição"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-muted rounded-md p-2 font-mono text-xs overflow-hidden">
                          <code className="line-clamp-3">{script.command}</code>
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                          <span>Ext: <span className="font-medium text-foreground">{script.fileExtension}</span></span>
                          <span>Timeout: <span className="font-medium text-foreground">{script.timeout}ms</span></span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum script de atualização encontrado</p>
                  <p className="text-sm mt-1">Adicione scripts na página de Scripts</p>
                </div>
              )}

              {selectedScript && (
                <div className="mt-6 p-4 border rounded-lg bg-muted/20">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Executar em Equipamento
                  </h3>
                  <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Selecione o Equipamento</Label>
                      <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                        <SelectTrigger data-testid="select-equipment">
                          <SelectValue placeholder="Escolha um equipamento..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredEquipment.map((eq) => (
                            <SelectItem key={eq.id} value={eq.id.toString()}>
                              {eq.name} ({eq.ip}) - {eq.manufacturer.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {filteredEquipment.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Nenhum equipamento {selectedScript.manufacturer.toUpperCase()} encontrado
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Dialog open={recoveryDialogOpen} onOpenChange={setRecoveryDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            disabled={!selectedEquipment}
                            data-testid="button-execute-recovery"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Executar Recuperação
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirmar Execução</DialogTitle>
                          <DialogDescription>
                            Você está prestes a executar o script de recuperação no equipamento selecionado.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-3">
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">Script:</p>
                            <p className="font-medium">{selectedScript.name}</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">Equipamento:</p>
                            <p className="font-medium">
                              {filteredEquipment.find(e => e.id.toString() === selectedEquipment)?.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {filteredEquipment.find(e => e.id.toString() === selectedEquipment)?.ip}
                            </p>
                          </div>
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              <AlertCircle className="h-4 w-4 inline mr-2" />
                              Esta ação pode reiniciar o equipamento. Certifique-se de que isso não afetará serviços críticos.
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setRecoveryDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleExecuteRecovery}
                            disabled={isRecoveryRunning}
                            data-testid="button-confirm-recovery"
                          >
                            {isRecoveryRunning ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4 mr-2" />
                            )}
                            Confirmar Execução
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                      </Dialog>
                      <Button 
                        variant="outline"
                        disabled={!selectedEquipment}
                        onClick={() => handleConnect(selectedEquipment)}
                        data-testid="button-open-terminal"
                      >
                        <Terminal className="h-4 w-4 mr-2" />
                        Terminal CLI
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {terminalOpen && (
                <Card className="mt-6" style={{ backgroundColor: currentTheme.background }}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0" style={{ borderBottom: `1px solid ${currentTheme.selection}` }}>
                    <div className="flex items-center gap-3">
                      <Terminal className="h-5 w-5" style={{ color: currentTheme.prompt }} />
                      <CardTitle className="text-base" style={{ color: currentTheme.foreground }}>
                        {isRecoveryRunning ? 'Execução de Recuperação' : 'Terminal CLI'} - {equipment.find(e => e.id.toString() === selectedEquipment)?.name || selectedScript?.name || 'Equipamento'}
                      </CardTitle>
                      <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
                        {isRecoveryRunning ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Executando...</>
                        ) : isConnected ? (
                          <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
                        ) : isConnecting ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Conectando...</>
                        ) : (
                          <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
                        )}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid="button-terminal-theme">
                            <Palette className="h-4 w-4" style={{ color: currentTheme.foreground }} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Tema do Terminal</DialogTitle>
                            <DialogDescription>
                              Escolha um tema para personalizar o terminal
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid grid-cols-2 gap-2 py-4 max-h-80 overflow-auto">
                            {TERMINAL_THEMES.map((theme) => (
                              <div
                                key={theme.id}
                                className={`p-3 rounded-lg cursor-pointer border-2 transition-all ${
                                  currentTheme.id === theme.id ? 'border-primary' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: theme.background }}
                                onClick={() => handleThemeChange(theme)}
                                data-testid={`theme-${theme.id}`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium" style={{ color: theme.foreground }}>
                                    {theme.name}
                                  </span>
                                  {currentTheme.id === theme.id && (
                                    <CheckCircle2 className="h-4 w-4" style={{ color: theme.system }} />
                                  )}
                                </div>
                                <div className="font-mono text-xs space-y-1">
                                  <div style={{ color: theme.prompt }}>$ command</div>
                                  <div style={{ color: theme.output }}>output text</div>
                                  <div style={{ color: theme.error }}>error msg</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                      {isConnected && !isRecoveryRunning && (
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={handleDisconnect}
                          data-testid="button-disconnect"
                        >
                          <Square className="h-4 w-4" style={{ color: currentTheme.error }} />
                        </Button>
                      )}
                      <Button 
                        size="icon" 
                        variant="ghost"
                        disabled={isRecoveryRunning}
                        onClick={() => {
                          handleDisconnect();
                          setTerminalOpen(false);
                          setLines([]);
                        }}
                        data-testid="button-close-terminal"
                        title={isRecoveryRunning ? "Aguarde a execução terminar" : "Fechar terminal"}
                      >
                        <X className="h-4 w-4" style={{ color: isRecoveryRunning ? currentTheme.selection : currentTheme.foreground }} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div 
                      ref={terminalRef}
                      className="h-80 overflow-auto p-4 font-mono text-sm"
                      style={{ backgroundColor: currentTheme.background }}
                      onClick={() => inputRef.current?.focus()}
                      data-testid="terminal-output"
                    >
                      {lines.map((line, index) => (
                        <div 
                          key={index} 
                          className="whitespace-pre-wrap break-all"
                          style={{ 
                            color: line.type === 'input' ? currentTheme.input :
                                   line.type === 'error' ? currentTheme.error :
                                   line.type === 'system' ? currentTheme.system :
                                   currentTheme.output
                          }}
                        >
                          {line.content}
                        </div>
                      ))}
                      {lines.length === 0 && !isConnecting && !isConnected && !isRecoveryRunning && (
                        <div style={{ color: currentTheme.system }}>
                          Selecione um script e equipamento, então clique em "Executar" para iniciar a recuperação...
                        </div>
                      )}
                    </div>
                    <div 
                      className="flex items-center gap-2 p-3 border-t"
                      style={{ 
                        backgroundColor: currentTheme.selection,
                        borderColor: currentTheme.selection
                      }}
                    >
                      <span style={{ color: currentTheme.prompt }} className="font-mono">$</span>
                      <Input
                        ref={inputRef}
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isConnected ? "Digite um comando..." : "Conecte-se primeiro..."}
                        disabled={!isConnected}
                        className="flex-1 font-mono border-0 bg-transparent focus-visible:ring-0"
                        style={{ color: currentTheme.input }}
                        data-testid="input-terminal-command"
                      />
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={handleSendCommand}
                        disabled={!isConnected || !commandInput.trim()}
                        data-testid="button-send-command"
                      >
                        <Send className="h-4 w-4" style={{ color: currentTheme.prompt }} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
