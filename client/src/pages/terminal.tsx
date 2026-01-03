import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Terminal as TerminalIcon, 
  Settings, 
  Play, 
  Square, 
  Trash2,
  Palette,
  Check,
  Send,
  Loader2,
  Wifi,
  WifiOff,
  Server,
  ChevronDown
} from "lucide-react";

interface Equipment {
  id: number;
  name: string;
  ip: string;
  port: number;
  manufacturer: string;
  model: string | null;
  username: string;
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
    id: "termius-night",
    name: "Termius Night",
    background: "#0d1117",
    foreground: "#c9d1d9",
    cursor: "#58a6ff",
    selection: "#1f6feb33",
    prompt: "#58a6ff",
    input: "#79c0ff",
    output: "#c9d1d9",
    error: "#f85149",
    system: "#56d364"
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
    id: "solarized-dark",
    name: "Solarized Dark",
    background: "#002b36",
    foreground: "#839496",
    cursor: "#839496",
    selection: "#073642",
    prompt: "#268bd2",
    input: "#2aa198",
    output: "#839496",
    error: "#dc322f",
    system: "#859900"
  },
  {
    id: "one-dark",
    name: "One Dark",
    background: "#282c34",
    foreground: "#abb2bf",
    cursor: "#528bff",
    selection: "#3e4451",
    prompt: "#61afef",
    input: "#c678dd",
    output: "#abb2bf",
    error: "#e06c75",
    system: "#98c379"
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
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    background: "#282828",
    foreground: "#ebdbb2",
    cursor: "#ebdbb2",
    selection: "#3c3836",
    prompt: "#83a598",
    input: "#d3869b",
    output: "#ebdbb2",
    error: "#fb4934",
    system: "#b8bb26"
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    selection: "#45475a",
    prompt: "#89b4fa",
    input: "#cba6f7",
    output: "#cdd6f4",
    error: "#f38ba8",
    system: "#a6e3a1"
  },
  {
    id: "github-dark",
    name: "GitHub Dark",
    background: "#0d1117",
    foreground: "#c9d1d9",
    cursor: "#c9d1d9",
    selection: "#161b22",
    prompt: "#58a6ff",
    input: "#d2a8ff",
    output: "#c9d1d9",
    error: "#ff7b72",
    system: "#7ee787"
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
  }
];

export default function TerminalPage() {
  const { toast } = useToast();
  const [selectedEquipment, setSelectedEquipment] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<TerminalTheme>(TERMINAL_THEMES[0]);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("terminal-theme");
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

  const handleConnect = async () => {
    if (!selectedEquipment) {
      toast({ title: "Selecione um equipamento", variant: "destructive" });
      return;
    }

    const eq = equipment.find(e => e.id.toString() === selectedEquipment);
    if (!eq) return;

    setIsConnecting(true);
    addLine('system', `Conectando a ${eq.name} (${eq.ip}:${eq.port})...`);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/terminal/ws/${eq.id}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        addLine('system', `Conectado a ${eq.name} (${eq.ip})`);
        inputRef.current?.focus();
      };

      ws.onmessage = (event) => {
        const data = event.data;
        if (data.startsWith('ERROR:')) {
          addLine('error', data.substring(6));
        } else {
          addLine('output', data);
        }
      };

      ws.onerror = () => {
        addLine('error', 'Erro na conexão WebSocket');
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onclose = () => {
        addLine('system', 'Conexão encerrada');
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
      };
    } catch (err) {
      addLine('error', 'Falha ao estabelecer conexão');
      setIsConnected(false);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    addLine('system', 'Desconectado');
  };

  const handleSendCommand = () => {
    if (!commandInput.trim()) return;
    
    if (!isConnected || !wsRef.current) {
      addLine('error', 'Não conectado. Conecte-se a um equipamento primeiro.');
      return;
    }

    const command = commandInput.trim();
    addLine('input', `> ${command}`);
    
    wsRef.current.send(command);
    
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    setCommandInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[commandHistory.length - 1 - newIndex] || "");
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[commandHistory.length - 1 - newIndex] || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput("");
      }
    }
  };

  const handleClearTerminal = () => {
    setLines([]);
    addLine('system', 'Terminal limpo');
  };

  const handleThemeChange = (theme: TerminalTheme) => {
    setCurrentTheme(theme);
    localStorage.setItem("terminal-theme", theme.id);
    setThemeDialogOpen(false);
    toast({ title: `Tema alterado para ${theme.name}` });
  };

  const getLineStyle = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return { color: currentTheme.input };
      case 'output': return { color: currentTheme.output };
      case 'error': return { color: currentTheme.error };
      case 'system': return { color: currentTheme.system };
      default: return { color: currentTheme.foreground };
    }
  };

  const selectedEq = equipment.find(e => e.id.toString() === selectedEquipment);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Terminal</h1>
          <p className="text-muted-foreground">Interface CLI interativa para equipamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-theme-settings">
                <Palette className="h-4 w-4 mr-2" />
                Temas
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Personalizar Terminal</DialogTitle>
                <DialogDescription>
                  Escolha um tema para o terminal inspirado no Termius
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4 md:grid-cols-2">
                {TERMINAL_THEMES.map((theme) => (
                  <div
                    key={theme.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      currentTheme.id === theme.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'
                    }`}
                    onClick={() => handleThemeChange(theme)}
                    data-testid={`theme-${theme.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{theme.name}</span>
                      {currentTheme.id === theme.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div 
                      className="rounded-md p-2 font-mono text-xs h-16 overflow-hidden"
                      style={{ backgroundColor: theme.background }}
                    >
                      <div style={{ color: theme.prompt }}>user@host:~$</div>
                      <div style={{ color: theme.input }}>ls -la</div>
                      <div style={{ color: theme.output }}>drwxr-xr-x 2 user</div>
                      <div style={{ color: theme.error }}>Error: not found</div>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-1 max-w-sm">
                <Select value={selectedEquipment} onValueChange={setSelectedEquipment} disabled={isConnected}>
                  <SelectTrigger data-testid="select-terminal-equipment">
                    <SelectValue placeholder="Selecione um equipamento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {equipment.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4" />
                          <span>{eq.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {eq.ip}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {!isConnected ? (
                <Button 
                  onClick={handleConnect} 
                  disabled={!selectedEquipment || isConnecting}
                  data-testid="button-connect"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-2" />
                  )}
                  Conectar
                </Button>
              ) : (
                <Button 
                  variant="destructive" 
                  onClick={handleDisconnect}
                  data-testid="button-disconnect"
                >
                  <WifiOff className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isConnected && (
                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                  Conectado: {selectedEq?.name}
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleClearTerminal}
                data-testid="button-clear-terminal"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={terminalRef}
            className="font-mono text-sm overflow-auto"
            style={{
              backgroundColor: currentTheme.background,
              color: currentTheme.foreground,
              height: '60vh',
              minHeight: '400px',
              padding: '1rem',
              borderRadius: '0 0 0.5rem 0.5rem'
            }}
            onClick={() => inputRef.current?.focus()}
            data-testid="terminal-output"
          >
            {lines.length === 0 ? (
              <div style={{ color: currentTheme.system }} className="opacity-70">
                <p>NBM Terminal v17.0</p>
                <p>Selecione um equipamento e clique em "Conectar" para iniciar.</p>
                <p>Use as setas para cima/baixo para navegar no histórico de comandos.</p>
                <br />
                <p style={{ color: currentTheme.prompt }}>Tema atual: {currentTheme.name}</p>
              </div>
            ) : (
              lines.map((line, index) => (
                <div 
                  key={index} 
                  style={getLineStyle(line.type)}
                  className="whitespace-pre-wrap break-all"
                >
                  {line.content}
                </div>
              ))
            )}
            
            {isConnected && (
              <div className="flex items-center mt-2" style={{ color: currentTheme.prompt }}>
                <span>{selectedEq?.username || 'user'}@{selectedEq?.name || 'host'}:~$ </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent outline-none border-none ml-1"
                  style={{ 
                    color: currentTheme.input,
                    caretColor: currentTheme.cursor
                  }}
                  autoFocus
                  data-testid="input-command"
                />
              </div>
            )}
          </div>
          
          {isConnected && (
            <div 
              className="flex items-center gap-2 p-3 border-t"
              style={{ backgroundColor: currentTheme.background }}
            >
              <Input
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite um comando..."
                className="flex-1 font-mono"
                style={{
                  backgroundColor: 'transparent',
                  color: currentTheme.input,
                  borderColor: currentTheme.selection
                }}
                data-testid="input-command-bar"
              />
              <Button 
                onClick={handleSendCommand}
                disabled={!commandInput.trim()}
                data-testid="button-send-command"
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Atalhos de Teclado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3 text-sm">
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span>Enviar comando</span>
              <Badge variant="outline">Enter</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span>Comando anterior</span>
              <Badge variant="outline">Seta para cima</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span>Próximo comando</span>
              <Badge variant="outline">Seta para baixo</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
