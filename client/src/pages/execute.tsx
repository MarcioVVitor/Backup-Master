import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Play, CheckCircle, XCircle, Loader2, Server } from "lucide-react";
import type { Equipment } from "@shared/schema";

export default function ExecutePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [results, setResults] = useState<Record<number, { status: 'pending' | 'success' | 'error'; message?: string }>>({});

  const { data: equipmentList, isLoading } = useQuery<Equipment[]>({
    queryKey: ['/api/equipment'],
    enabled: !!user,
  });

  const executeMutation = useMutation({
    mutationFn: async (equipmentId: number) => {
      const response = await apiRequest(`/api/backup/execute/${equipmentId}`, { method: 'POST' });
      return response;
    },
    onSuccess: (data, equipmentId) => {
      setResults((prev) => ({
        ...prev,
        [equipmentId]: { status: 'success', message: 'Backup realizado com sucesso' },
      }));
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
    onError: (error: any, equipmentId) => {
      setResults((prev) => ({
        ...prev,
        [equipmentId]: { status: 'error', message: error.message || 'Erro ao executar backup' },
      }));
    },
  });

  const handleToggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === (equipmentList?.length || 0)) {
      setSelectedIds([]);
    } else {
      setSelectedIds(equipmentList?.map((e) => e.id) || []);
    }
  };

  const handleExecute = async () => {
    if (selectedIds.length === 0) {
      toast({ title: "Selecione ao menos um equipamento", variant: "destructive" });
      return;
    }

    setResults({});
    
    for (const id of selectedIds) {
      setResults((prev) => ({ ...prev, [id]: { status: 'pending' } }));
    }

    for (const id of selectedIds) {
      try {
        await executeMutation.mutateAsync(id);
      } catch (e) {
        // Error already handled in onError
      }
    }

    toast({ title: "Execução de backups finalizada" });
  };

  const isExecuting = Object.values(results).some((r) => r.status === 'pending');

  if (authLoading || !user) {
    return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Play className="h-6 w-6" />
            Executar Backup
          </h1>
          <p className="text-muted-foreground">Execute backups manualmente</p>
        </div>
        <Button 
          onClick={handleExecute} 
          disabled={isExecuting || selectedIds.length === 0}
          data-testid="button-execute-backup"
        >
          {isExecuting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Executar ({selectedIds.length})
            </>
          )}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !equipmentList?.length ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhum equipamento cadastrado. Cadastre equipamentos primeiro.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.length === equipmentList.length}
              onCheckedChange={handleSelectAll}
              id="select-all"
              data-testid="checkbox-select-all"
            />
            <label htmlFor="select-all" className="text-sm cursor-pointer">
              Selecionar todos ({equipmentList.length} equipamentos)
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {equipmentList.map((equip) => (
              <Card 
                key={equip.id} 
                className={`cursor-pointer transition-colors ${
                  selectedIds.includes(equip.id) ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handleToggle(equip.id)}
                data-testid={`card-equipment-${equip.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.includes(equip.id)}
                        onCheckedChange={() => handleToggle(equip.id)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`checkbox-equipment-${equip.id}`}
                      />
                      <Server className="h-4 w-4" />
                      <CardTitle className="text-base">{equip.name}</CardTitle>
                    </div>
                    {results[equip.id] && (
                      <>
                        {results[equip.id].status === 'pending' && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                        {results[equip.id].status === 'success' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {results[equip.id].status === 'error' && (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{equip.manufacturer}</Badge>
                    <span className="text-sm text-muted-foreground">{equip.ip}</span>
                  </div>
                  {results[equip.id]?.message && (
                    <p className={`text-xs mt-2 ${
                      results[equip.id].status === 'error' ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {results[equip.id].message}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
