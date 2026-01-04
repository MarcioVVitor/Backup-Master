import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/contexts/i18n-context";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Building2, 
  Network, 
  Plus, 
  RefreshCw, 
  Settings, 
  Users,
  Activity,
  Power,
  Wrench,
  ChevronRight,
  Search,
  ShieldX
} from "lucide-react";
import type { Company, Agent } from "@shared/schema";

const companyFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  slug: z.string().min(2, "Slug deve ter pelo menos 2 caracteres").regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minusculas, numeros e hifens"),
  description: z.string().optional(),
  maxUsers: z.number().min(1).default(10),
  maxEquipment: z.number().min(1).default(100),
  maxAgents: z.number().min(1).default(5),
  active: z.boolean().default(true),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

export default function ServerPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: adminCheck, isLoading: adminCheckLoading } = useQuery<{ isServerAdmin: boolean; serverRole: string | null }>({
    queryKey: ["/api/server/check-admin"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalCompanies: number;
    activeCompanies: number;
    totalAgents: number;
    onlineAgents: number;
    offlineAgents: number;
  }>({
    queryKey: ["/api/server/stats"],
  });

  const { data: companiesData, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/server/companies"],
  });

  const { data: agentsData, isLoading: agentsLoading } = useQuery<(Agent & { companyName: string | null })[]>({
    queryKey: ["/api/server/agents"],
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      return await apiRequest("POST", "/api/server/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/server/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/server/stats"] });
      setCreateDialogOpen(false);
      toast({ title: "Empresa criada com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar empresa", description: error.message, variant: "destructive" });
    },
  });

  const restartAgentMutation = useMutation({
    mutationFn: async (agentId: number) => {
      return await apiRequest("POST", `/api/server/agents/${agentId}/restart`);
    },
    onSuccess: () => {
      toast({ title: "Comando de reinicio enviado" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao reiniciar agente", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      maxUsers: 10,
      maxEquipment: 100,
      maxAgents: 5,
      active: true,
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    createCompanyMutation.mutate(data);
  };

  const filteredCompanies = companiesData?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAgents = agentsData?.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.companyName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (adminCheckLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Verificando permissoes...</div>
      </div>
    );
  }

  if (!adminCheck?.isServerAdmin) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 p-6">
        <div className="p-4 rounded-full bg-destructive/10">
          <ShieldX className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Esta area e restrita a administradores do NBM CLOUD Server. 
          Entre em contato com o suporte se voce acredita que deveria ter acesso.
        </p>
        <Button onClick={() => setLocation("/")} data-testid="button-go-home">
          Voltar ao Inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b bg-background">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">NBM CLOUD Server</h1>
            <p className="text-sm text-muted-foreground">Gerenciamento de empresas e proxies</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Empresas</p>
                  <p className="text-2xl font-bold" data-testid="text-total-companies">
                    {statsLoading ? "-" : stats?.totalCompanies || 0}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats?.activeCompanies || 0} ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Proxies</p>
                  <p className="text-2xl font-bold" data-testid="text-total-agents">
                    {statsLoading ? "-" : stats?.totalAgents || 0}
                  </p>
                </div>
                <Network className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Online</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-online-agents">
                    {statsLoading ? "-" : stats?.onlineAgents || 0}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Offline</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="text-offline-agents">
                    {statsLoading ? "-" : stats?.offlineAgents || 0}
                  </p>
                </div>
                <Power className="h-8 w-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="companies" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="companies" data-testid="tab-companies">
                <Building2 className="h-4 w-4 mr-2" />
                Empresas
              </TabsTrigger>
              <TabsTrigger value="agents" data-testid="tab-agents">
                <Network className="h-4 w-4 mr-2" />
                Proxies
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                  data-testid="input-search"
                />
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-company">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Empresa
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Empresa</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome da Empresa</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Acme Corp" data-testid="input-company-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="slug"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Slug (identificador unico)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="acme-corp" data-testid="input-company-slug" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descricao</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Descricao opcional" data-testid="input-company-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="maxUsers"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Usuarios</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                  data-testid="input-max-users"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="maxEquipment"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Equipam.</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field}
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                  data-testid="input-max-equipment"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="maxAgents"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Agentes</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field}
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                  data-testid="input-max-agents"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="active"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-active"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Empresa Ativa</FormLabel>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={createCompanyMutation.isPending} data-testid="button-submit-company">
                          {createCompanyMutation.isPending ? "Criando..." : "Criar Empresa"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <TabsContent value="companies" className="space-y-4">
            {companiesLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Carregando empresas...
                </CardContent>
              </Card>
            ) : filteredCompanies?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma empresa encontrada
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredCompanies?.map((company) => (
                  <Card key={company.id} className="hover-elevate" data-testid={`card-company-${company.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{company.name}</h3>
                              <Badge variant={company.active ? "default" : "secondary"} className="text-xs">
                                {company.active ? "Ativa" : "Inativa"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{company.slug}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right text-sm">
                            <p><Users className="h-3 w-3 inline mr-1" />{company.maxUsers} usuarios</p>
                            <p className="text-muted-foreground">{company.maxEquipment} equipamentos</p>
                          </div>
                          <Button variant="ghost" size="icon">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            {agentsLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Carregando proxies...
                </CardContent>
              </Card>
            ) : filteredAgents?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum proxy encontrado
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredAgents?.map((agent) => (
                  <Card key={agent.id} data-testid={`card-agent-${agent.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${agent.status === 'online' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            <Network className={`h-5 w-5 ${agent.status === 'online' ? 'text-green-500' : 'text-red-500'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{agent.name}</h3>
                              <Badge variant={agent.status === 'online' ? "default" : "destructive"} className="text-xs">
                                {agent.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {agent.siteName} {agent.companyName && `- ${agent.companyName}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => restartAgentMutation.mutate(agent.id)}
                            disabled={restartAgentMutation.isPending}
                            data-testid={`button-restart-agent-${agent.id}`}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Reiniciar
                          </Button>
                          <Button variant="outline" size="sm" data-testid={`button-maintenance-agent-${agent.id}`}>
                            <Wrench className="h-3 w-3 mr-1" />
                            Manutencao
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
