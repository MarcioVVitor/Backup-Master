import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Agent } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Terminal as TerminalIcon,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  Cpu,
  HardDrive,
  Clock,
  Globe,
  Send,
  Download,
  Server,
  Network,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  Power,
  RotateCcw,
  Settings,
  AlertTriangle,
  Play,
  Square
} from "lucide-react";
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
import { Link } from "wouter";
import { XTermTerminal } from "@/components/xterm-terminal";

interface DiagnosticsData {
  system: {
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    nodeVersion: string;
    agentVersion: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  };
  cpu: {
    model: string;
    cores: number;
    usage: number;
  };
  network: {
    interfaces: { name: string; ip: string; mac: string }[];
    serverConnection: { connected: boolean; latency: number };
  };
  equipment: {
    total: number;
    reachable: number;
    unreachable: number;
  };
}

export default function AgentConsolePage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [command, setCommand] = useState("");
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [testIp, setTestIp] = useState("");
  const [testPort, setTestPort] = useState("22");
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: agents = [], isLoading: loadingAgents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const onlineAgents = agents.filter(a => a.status === 'online');

  const diagnosticsMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest("GET", `/api/agents/${agentId}/diagnostics`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setDiagnostics(data.diagnostics);
        addTerminalLine("[SYSTEM] Diagnóstico recebido com sucesso");
      } else {
        addTerminalLine(`[ERROR] ${data.message}`);
      }
    },
    onError: (error: any) => {
      addTerminalLine(`[ERROR] Falha ao obter diagnóstico: ${error.message}`);
    },
  });

  const terminalMutation = useMutation({
    mutationFn: async ({ agentId, command }: { agentId: number; command: string }) => {
      const response = await apiRequest("POST", `/api/agents/${agentId}/terminal`, { command });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        addTerminalLine(data.output);
      } else {
        addTerminalLine(`[ERROR] ${data.message}`);
      }
    },
    onError: (error: any) => {
      addTerminalLine(`[ERROR] Falha ao executar comando: ${error.message}`);
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async ({ agentId, targetIp, targetPort }: { agentId: number; targetIp: string; targetPort: number }) => {
      const response = await apiRequest("POST", `/api/agents/${agentId}/test-connection`, { 
        targetIp, 
        targetPort, 
        protocol: 'ssh' 
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.result) {
        const { reachable, latency, error } = data.result;
        if (reachable) {
          addTerminalLine(`[TEST] Conexão OK - Latência: ${latency}ms`);
          toast({ title: "Conexão bem sucedida", description: `Latência: ${latency}ms` });
        } else {
          addTerminalLine(`[TEST] Conexão falhou: ${error}`);
          toast({ title: "Conexão falhou", description: error, variant: "destructive" });
        }
      } else {
        addTerminalLine(`[ERROR] ${data.message}`);
      }
    },
    onError: (error: any) => {
      addTerminalLine(`[ERROR] Teste de conexão falhou: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ agentId, updateType }: { agentId: number; updateType: string }) => {
      const response = await apiRequest("POST", `/api/agents/${agentId}/update`, { updateType });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        addTerminalLine("[UPDATE] Atualização iniciada com sucesso");
        toast({ title: "Atualização iniciada" });
      } else {
        addTerminalLine(`[ERROR] ${data.message}`);
      }
    },
    onError: (error: any) => {
      addTerminalLine(`[ERROR] Falha na atualização: ${error.message}`);
    },
  });

  const adminMutation = useMutation({
    mutationFn: async ({ agentId, action, force }: { agentId: number; action: string; force?: boolean }) => {
      const response = await apiRequest("POST", `/api/agents/${agentId}/admin`, { action, force });
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        const actionLabels: Record<string, string> = {
          reboot: "Reiniciar servidor",
          shutdown: "Desligar servidor",
          restart_service: "Reiniciar serviço do agente",
          restart_agent: "Reiniciar processo do agente",
          service_status: "Status do serviço"
        };
        addTerminalLine(`[ADMIN] ${actionLabels[variables.action] || variables.action}: Comando enviado`);
        if (data.result?.output) {
          addTerminalLine(data.result.output);
        }
        toast({ title: "Comando executado", description: `${actionLabels[variables.action]} enviado com sucesso` });
      } else {
        addTerminalLine(`[ERROR] ${data.message}`);
        toast({ title: "Erro", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: any) => {
      addTerminalLine(`[ERROR] Falha no comando admin: ${error.message}`);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const addTerminalLine = (line: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalHistory(prev => [...prev, `[${timestamp}] ${line}`]);
  };

  const handleCommand = () => {
    if (!command.trim() || !selectedAgentId) return;
    
    const agentId = parseInt(selectedAgentId);
    const cmd = command.trim();
    
    addTerminalLine(`$ ${cmd}`);
    setCommandHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
    
    if (cmd.startsWith('diag') || cmd.startsWith('diagnostics')) {
      diagnosticsMutation.mutate(agentId);
    } else if (cmd.startsWith('ping ') || cmd.startsWith('test ')) {
      const parts = cmd.split(' ');
      const ip = parts[1];
      const port = parseInt(parts[2]) || 22;
      testConnectionMutation.mutate({ agentId, targetIp: ip, targetPort: port });
    } else if (cmd === 'update') {
      updateMutation.mutate({ agentId, updateType: 'full' });
    } else if (cmd === 'clear') {
      setTerminalHistory([]);
    } else if (cmd === 'help') {
      addTerminalLine(`
Comandos disponíveis:
  diag, diagnostics  - Exibir diagnóstico do sistema
  ping <ip> [porta]  - Testar conexão com equipamento
  test <ip> [porta]  - Testar conexão com equipamento
  update             - Atualizar o agente
  clear              - Limpar terminal
  help               - Exibir esta ajuda
  <comando linux>    - Executar comando no servidor do agente
      `);
    } else {
      terminalMutation.mutate({ agentId, command: cmd });
    }
    
    setCommand("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else {
        setHistoryIndex(-1);
        setCommand("");
      }
    }
  };

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  useEffect(() => {
    if (selectedAgentId) {
      addTerminalLine(`Conectado ao agente #${selectedAgentId}`);
      addTerminalLine("Digite 'help' para ver os comandos disponíveis");
    }
  }, [selectedAgentId]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const selectedAgent = agents.find(a => a.id === parseInt(selectedAgentId));

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
        <div className="flex items-center gap-3">
          <Link href="/agents">
            <Button variant="ghost" size="icon" data-testid="button-back-agents">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <TerminalIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Console do Agente</h1>
            <p className="text-sm text-muted-foreground">Diagnóstico, terminal e gerenciamento remoto</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-[250px]" data-testid="select-agent">
              <SelectValue placeholder="Selecione um agente" />
            </SelectTrigger>
            <SelectContent>
              {onlineAgents.length === 0 ? (
                <SelectItem value="none" disabled>Nenhum agente online</SelectItem>
              ) : (
                onlineAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      {agent.name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedAgentId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Server className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Selecione um Agente</h2>
            <p className="text-muted-foreground mb-4">
              Escolha um agente online para acessar o console de diagnóstico e terminal.
            </p>
            {onlineAgents.length === 0 && (
              <Badge variant="outline" className="text-amber-500 border-amber-500">
                <WifiOff className="h-3 w-3 mr-1" />
                Nenhum agente online
              </Badge>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="terminal" className="w-full">
          <TabsList className="grid w-full grid-cols-4" data-testid="tabs-agent-console">
            <TabsTrigger value="terminal" data-testid="tab-terminal">
              <TerminalIcon className="h-4 w-4 mr-2" />
              Terminal
            </TabsTrigger>
            <TabsTrigger value="diagnostics" data-testid="tab-diagnostics">
              <Activity className="h-4 w-4 mr-2" />
              Diagnóstico
            </TabsTrigger>
            <TabsTrigger value="tools" data-testid="tab-tools">
              <Network className="h-4 w-4 mr-2" />
              Ferramentas
            </TabsTrigger>
            <TabsTrigger value="admin" data-testid="tab-admin">
              <Settings className="h-4 w-4 mr-2" />
              Administração
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="mt-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <TerminalIcon className="h-5 w-5" />
                  Terminal SSH Interativo
                </CardTitle>
                <CardDescription>
                  Shell interativo conectado diretamente ao servidor do agente via SSH
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[500px]" data-testid="terminal-container">
                  <XTermTerminal
                    agentId={parseInt(selectedAgentId)}
                    agentName={onlineAgents.find(a => a.id === parseInt(selectedAgentId))?.name || "Agente"}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnostics" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      Sistema
                    </CardTitle>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => diagnosticsMutation.mutate(parseInt(selectedAgentId))}
                      disabled={diagnosticsMutation.isPending}
                      data-testid="button-refresh-diagnostics"
                    >
                      {diagnosticsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {diagnostics ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hostname</span>
                        <span className="font-mono">{diagnostics.system.hostname}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plataforma</span>
                        <span>{diagnostics.system.platform} ({diagnostics.system.arch})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Uptime</span>
                        <span>{formatUptime(diagnostics.system.uptime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Versão do Agente</span>
                        <Badge variant="outline">{diagnostics.system.agentVersion}</Badge>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Clique em atualizar para obter diagnóstico
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    CPU & Memória
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {diagnostics ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CPU</span>
                        <span>{diagnostics.cpu.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cores</span>
                        <span>{diagnostics.cpu.cores}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Uso CPU</span>
                        <Badge variant={diagnostics.cpu.usage > 80 ? "destructive" : "secondary"}>
                          {diagnostics.cpu.usage.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Memória</span>
                        <span>
                          {formatBytes(diagnostics.memory.used)} / {formatBytes(diagnostics.memory.total)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Uso Memória</span>
                        <Badge variant={diagnostics.memory.usedPercent > 80 ? "destructive" : "secondary"}>
                          {diagnostics.memory.usedPercent.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Aguardando diagnóstico...
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Rede
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {diagnostics?.network ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Conexão com Servidor</span>
                        {diagnostics.network.serverConnection.connected ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {diagnostics.network.serverConnection.latency}ms
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Desconectado
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">Interfaces:</div>
                      {diagnostics.network.interfaces.map((iface, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="font-mono">{iface.name}</span>
                          <span className="font-mono">{iface.ip}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Aguardando diagnóstico...
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Equipamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {diagnostics?.equipment ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span>{diagnostics.equipment.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Alcançáveis</span>
                        <Badge className="bg-green-500">{diagnostics.equipment.reachable}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Inalcançáveis</span>
                        <Badge variant="destructive">{diagnostics.equipment.unreachable}</Badge>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Aguardando diagnóstico...
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tools" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Teste de Conexão
                  </CardTitle>
                  <CardDescription>
                    Testar conectividade com um equipamento através do agente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label>IP do Equipamento</Label>
                      <Input 
                        value={testIp}
                        onChange={(e) => setTestIp(e.target.value)}
                        placeholder="192.168.1.1"
                        data-testid="input-test-ip"
                      />
                    </div>
                    <div>
                      <Label>Porta</Label>
                      <Input 
                        value={testPort}
                        onChange={(e) => setTestPort(e.target.value)}
                        placeholder="22"
                        data-testid="input-test-port"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => testConnectionMutation.mutate({
                      agentId: parseInt(selectedAgentId),
                      targetIp: testIp,
                      targetPort: parseInt(testPort) || 22
                    })}
                    disabled={testConnectionMutation.isPending || !testIp}
                    className="w-full"
                    data-testid="button-test-connection"
                  >
                    {testConnectionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wifi className="h-4 w-4 mr-2" />
                    )}
                    Testar Conexão
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Atualização do Agente
                  </CardTitle>
                  <CardDescription>
                    Atualizar o agente para a versão mais recente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span className="text-muted-foreground">Versão Atual</span>
                      <Badge variant="outline">{(selectedAgent?.config as any)?.version || '1.0.0'}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className="bg-green-500">Online</Badge>
                    </div>
                  </div>
                  <Button 
                    onClick={() => updateMutation.mutate({
                      agentId: parseInt(selectedAgentId),
                      updateType: 'full'
                    })}
                    disabled={updateMutation.isPending}
                    variant="outline"
                    className="w-full"
                    data-testid="button-update-agent"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Atualizar Agente
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="admin" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Controle do Servidor
                  </CardTitle>
                  <CardDescription>
                    Gerenciar o servidor onde o agente está instalado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full"
                          data-testid="button-reboot-server"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reiniciar Servidor
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Reiniciar Servidor
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja reiniciar o servidor do agente? O agente ficará offline durante o reboot.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => adminMutation.mutate({
                              agentId: parseInt(selectedAgentId),
                              action: 'reboot'
                            })}
                          >
                            Reiniciar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          className="w-full"
                          data-testid="button-shutdown-server"
                        >
                          <Power className="h-4 w-4 mr-2" />
                          Desligar Servidor
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Desligar Servidor
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            <strong>ATENÇÃO:</strong> Esta ação irá desligar o servidor completamente. Será necessário acesso físico ou IPMI/iLO para ligar novamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => adminMutation.mutate({
                              agentId: parseInt(selectedAgentId),
                              action: 'shutdown'
                            })}
                          >
                            Desligar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Controle do Serviço NBM Agent
                  </CardTitle>
                  <CardDescription>
                    Gerenciar o serviço do agente NBM Cloud
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => adminMutation.mutate({
                        agentId: parseInt(selectedAgentId),
                        action: 'restart_service'
                      })}
                      disabled={adminMutation.isPending}
                      className="w-full"
                      data-testid="button-restart-service"
                    >
                      {adminMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Reiniciar Serviço
                    </Button>

                    <Button 
                      variant="outline"
                      onClick={() => adminMutation.mutate({
                        agentId: parseInt(selectedAgentId),
                        action: 'service_status'
                      })}
                      disabled={adminMutation.isPending}
                      className="w-full"
                      data-testid="button-service-status"
                    >
                      {adminMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Activity className="h-4 w-4 mr-2" />
                      )}
                      Status do Serviço
                    </Button>
                  </div>

                  <div className="pt-2 border-t">
                    <Button 
                      variant="secondary"
                      onClick={() => adminMutation.mutate({
                        agentId: parseInt(selectedAgentId),
                        action: 'restart_agent'
                      })}
                      disabled={adminMutation.isPending}
                      className="w-full"
                      data-testid="button-restart-agent"
                    >
                      {adminMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-2" />
                      )}
                      Reiniciar Processo do Agente
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <TerminalIcon className="h-5 w-5" />
                    Comandos Rápidos
                  </CardTitle>
                  <CardDescription>
                    Executar comandos administrativos comuns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        terminalMutation.mutate({ 
                          agentId: parseInt(selectedAgentId), 
                          command: 'df -h' 
                        });
                        addTerminalLine("$ df -h");
                      }}
                      disabled={terminalMutation.isPending}
                      data-testid="button-cmd-disk"
                    >
                      <HardDrive className="h-4 w-4 mr-2" />
                      Disco
                    </Button>

                    <Button 
                      variant="outline"
                      onClick={() => {
                        terminalMutation.mutate({ 
                          agentId: parseInt(selectedAgentId), 
                          command: 'free -h' 
                        });
                        addTerminalLine("$ free -h");
                      }}
                      disabled={terminalMutation.isPending}
                      data-testid="button-cmd-memory"
                    >
                      <Cpu className="h-4 w-4 mr-2" />
                      Memória
                    </Button>

                    <Button 
                      variant="outline"
                      onClick={() => {
                        terminalMutation.mutate({ 
                          agentId: parseInt(selectedAgentId), 
                          command: 'uptime' 
                        });
                        addTerminalLine("$ uptime");
                      }}
                      disabled={terminalMutation.isPending}
                      data-testid="button-cmd-uptime"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Uptime
                    </Button>

                    <Button 
                      variant="outline"
                      onClick={() => {
                        terminalMutation.mutate({ 
                          agentId: parseInt(selectedAgentId), 
                          command: 'ip addr show' 
                        });
                        addTerminalLine("$ ip addr show");
                      }}
                      disabled={terminalMutation.isPending}
                      data-testid="button-cmd-network"
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      Rede
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
