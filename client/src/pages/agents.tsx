import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Agent } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Key, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  AlertCircle,
  Copy,
  Check,
  Server,
  Activity,
  Download,
  Terminal,
  FileText,
  MoreHorizontal,
  Settings,
  RotateCcw,
  Power
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es, fr, de } from "date-fns/locale";
import { Link } from "wouter";

const dateLocales: Record<string, any> = {
  pt: ptBR,
  en: enUS,
  es: es,
  fr: fr,
  de: de,
};

export default function AgentsPage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isTokenOpen, setIsTokenOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    siteName: "",
    ipAddress: "",
    description: "",
  });

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/agents", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setIsCreateOpen(false);
      setFormData({ name: "", siteName: "", ipAddress: "", description: "" });
      toast({ title: t.agents.createSuccess });
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return await apiRequest("PATCH", `/api/agents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setIsEditOpen(false);
      setSelectedAgent(null);
      toast({ title: t.agents.updateSuccess });
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setIsDeleteOpen(false);
      setSelectedAgent(null);
      toast({ title: t.agents.deleteSuccess });
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest("POST", `/api/agents/${agentId}/tokens`, {
        name: "default",
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    setFormData({ name: "", siteName: "", ipAddress: "", description: "" });
    setIsCreateOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    setSelectedAgent(agent);
    setFormData({
      name: agent.name,
      siteName: agent.siteName,
      ipAddress: agent.ipAddress || "",
      description: agent.description || "",
    });
    setIsEditOpen(true);
  };

  const handleDelete = (agent: Agent) => {
    setSelectedAgent(agent);
    setIsDeleteOpen(true);
  };

  const handleGenerateToken = (agent: Agent) => {
    setSelectedAgent(agent);
    setGeneratedToken(null);
    setCopied(false);
    setIsTokenOpen(true);
  };

  const copyToken = async () => {
    if (generatedToken) {
      await navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return (
          <Badge variant="default" className="bg-green-500">
            <Wifi className="w-3 h-3 mr-1" />
            {t.agents.online}
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="secondary">
            <WifiOff className="w-3 h-3 mr-1" />
            {t.agents.offline}
          </Badge>
        );
      case "connecting":
        return (
          <Badge variant="outline">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            {t.agents.connecting}
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            {t.agents.error}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: dateLocales[language] || enUS,
    });
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 page-header">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">{t.agents.title}</h1>
          <p className="text-sm sm:text-base text-muted-foreground" data-testid="text-page-subtitle">{t.agents.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/agent-console">
            <Button variant="outline" data-testid="button-agent-console">
              <Terminal className="w-4 h-4 mr-2" />
              Console
            </Button>
          </Link>
          <Button onClick={handleCreate} data-testid="button-add-agent">
            <Plus className="w-4 h-4 mr-2" />
            {t.agents.addAgent}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            {t.agents.title}
          </CardTitle>
          <CardDescription>{t.agents.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !agents || agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t.agents.noAgents}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.agents.agentName}</TableHead>
                  <TableHead>{t.agents.siteName}</TableHead>
                  <TableHead>{t.agents.status}</TableHead>
                  <TableHead>{t.agents.ipAddress}</TableHead>
                  <TableHead>{t.agents.lastHeartbeat}</TableHead>
                  <TableHead>{t.agents.version}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id} data-testid={`row-agent-${agent.id}`}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>{agent.siteName}</TableCell>
                    <TableCell>{getStatusBadge(agent.status)}</TableCell>
                    <TableCell>{agent.ipAddress || "-"}</TableCell>
                    <TableCell>{formatDate(agent.lastHeartbeat)}</TableCell>
                    <TableCell>{agent.version || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {agent.status === 'online' && (
                          <Link href="/agent-console">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Console"
                              data-testid={`button-console-${agent.id}`}
                            >
                              <Terminal className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleGenerateToken(agent)}
                          title={t.agents.generateToken}
                          data-testid={`button-token-${agent.id}`}
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(agent)}
                          title={t.agents.editAgent}
                          data-testid={`button-edit-${agent.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(agent)}
                          title={t.agents.deleteAgent}
                          data-testid={`button-delete-${agent.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            {t.agents.downloadAgent}
          </CardTitle>
          <CardDescription>{t.agents.downloadDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                {t.agents.installInstructions}
              </h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>1. {t.agents.step1}</p>
                <p>2. {t.agents.step2}</p>
                <p>3. {t.agents.step3}</p>
                <p>4. {t.agents.step4}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <Button
                variant="default"
                onClick={() => window.open('/api/agents/download/package', '_blank')}
                data-testid="button-download-package"
              >
                <Download className="w-4 h-4 mr-2" />
                {t.agents.downloadPackage}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => window.open('/api/agents/download/install-script', '_blank')}
                data-testid="button-download-script"
              >
                <FileText className="w-4 h-4 mr-2" />
                {t.agents.downloadScript}
              </Button>
            </div>

            <div className="p-4 bg-muted rounded-md">
              <h4 className="font-medium mb-2">{t.agents.quickInstall}</h4>
              <pre className="text-xs bg-background p-3 rounded overflow-x-auto whitespace-pre-wrap">
                {t.agents.quickInstallCode}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.agents.addAgent}</DialogTitle>
            <DialogDescription>{t.agents.subtitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t.agents.agentName}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t.agents.agentName}
                data-testid="input-agent-name"
              />
            </div>
            <div>
              <Label htmlFor="siteName">{t.agents.siteName}</Label>
              <Input
                id="siteName"
                value={formData.siteName}
                onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                placeholder={t.agents.siteNamePlaceholder}
                data-testid="input-site-name"
              />
            </div>
            <div>
              <Label htmlFor="ipAddress">{t.agents.proxyIp}</Label>
              <Input
                id="ipAddress"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                placeholder={t.agents.proxyIpPlaceholder}
                data-testid="input-ip-address"
              />
            </div>
            <div>
              <Label htmlFor="description">{t.agents.description}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t.agents.description}
                data-testid="input-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name || !formData.siteName || createMutation.isPending}
              data-testid="button-save-agent"
            >
              {createMutation.isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.agents.editAgent}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">{t.agents.agentName}</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-agent-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-siteName">{t.agents.siteName}</Label>
              <Input
                id="edit-siteName"
                value={formData.siteName}
                onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                placeholder={t.agents.siteNamePlaceholder}
                data-testid="input-edit-site-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-ipAddress">{t.agents.proxyIp}</Label>
              <Input
                id="edit-ipAddress"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                placeholder={t.agents.proxyIpPlaceholder}
                data-testid="input-edit-ip-address"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">{t.agents.description}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-edit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => selectedAgent && updateMutation.mutate({ id: selectedAgent.id, data: formData })}
              disabled={!formData.name || !formData.siteName || updateMutation.isPending}
              data-testid="button-update-agent"
            >
              {updateMutation.isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.agents.deleteAgent}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.agents.confirmDelete}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedAgent && deleteMutation.mutate(selectedAgent.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t.common.deleting : t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isTokenOpen} onOpenChange={setIsTokenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              {t.agents.generateToken}
            </DialogTitle>
            <DialogDescription>
              {selectedAgent?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!generatedToken ? (
              <div className="text-center py-4">
                <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  {t.agents.tokenWarning}
                </p>
                <Button
                  onClick={() => selectedAgent && generateTokenMutation.mutate(selectedAgent.id)}
                  disabled={generateTokenMutation.isPending}
                  data-testid="button-generate-token"
                >
                  {generateTokenMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4 mr-2" />
                  )}
                  {t.agents.generateToken}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <Label className="text-xs text-muted-foreground">{t.agents.tokenGenerated}</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 text-xs break-all bg-background p-2 rounded border">
                      {generatedToken}
                    </code>
                    <Button size="icon" variant="outline" onClick={copyToken} data-testid="button-copy-token">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {t.agents.tokenWarning}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTokenOpen(false)}>
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
