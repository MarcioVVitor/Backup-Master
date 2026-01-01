import { useQuery } from "@tanstack/react-query";
import { useBackupHistory, useFiles } from "@/hooks/use-files";
import { useEquipment } from "@/hooks/use-equipment";
import { StatsCard } from "@/components/StatsCard";
import { Server, HardDrive, AlertCircle, CheckCircle2, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: equipment, isLoading: loadingEquipment } = useEquipment();
  const { data: history, isLoading: loadingHistory } = useBackupHistory();
  const { data: files, isLoading: loadingFiles } = useFiles();

  if (loadingEquipment || loadingHistory || loadingFiles) {
    return (
      <div className="p-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const totalEquipment = equipment?.length || 0;
  const totalBackups = files?.length || 0;
  const failedBackups = history?.filter(h => h.status === 'failed').length || 0;
  const successRate = history?.length ? Math.round(((history.length - failedBackups) / history.length) * 100) : 100;
  const totalStorage = files?.reduce((acc, f) => acc + f.size, 0) || 0;
  const storageFormatted = (totalStorage / (1024 * 1024)).toFixed(2) + ' MB';

  // Prepare chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(date => {
    const dayBackups = history?.filter(h => h.executedAt && new Date(h.executedAt).toISOString().split('T')[0] === date) || [];
    return {
      date: format(new Date(date), 'MMM dd'),
      success: dayBackups.filter(h => h.status === 'success').length,
      failed: dayBackups.filter(h => h.status === 'failed').length,
    };
  });

  return (
    <div className="p-6 md:p-8 space-y-8 animate-enter">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema de backups</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Equipamentos"
          value={totalEquipment}
          description="Total de ativos monitorados"
          icon={Server}
          color="text-blue-500"
        />
        <StatsCard
          title="Backups Totais"
          value={totalBackups}
          description="Arquivos armazenados"
          icon={HardDrive}
          color="text-purple-500"
        />
        <StatsCard
          title="Taxa de Sucesso"
          value={`${successRate}%`}
          description="Últimos 30 dias"
          icon={CheckCircle2}
          color="text-green-500"
        />
        <StatsCard
          title="Armazenamento"
          value={storageFormatted}
          description="Espaço utilizado"
          icon={Activity}
          color="text-orange-500"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
                <Area type="monotone" dataKey="success" stroke="#22c55e" fillOpacity={1} fill="url(#colorSuccess)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Status de Execução</CardTitle>
          </CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
                <Bar dataKey="success" name="Sucesso" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Falha" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Últimos Backups</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.slice(0, 5).map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.equipmentName || 'Desconhecido'}</TableCell>
                  <TableCell>{log.ip}</TableCell>
                  <TableCell>
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      log.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 
                      log.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                    }`}>
                      {log.status === 'success' ? 'Sucesso' : log.status === 'failed' ? 'Falha' : 'Pendente'}
                    </div>
                  </TableCell>
                  <TableCell>{log.duration ? `${log.duration.toFixed(1)}s` : '-'}</TableCell>
                  <TableCell className="text-right">
                    {log.executedAt ? format(new Date(log.executedAt), 'dd/MM/yyyy HH:mm') : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {!history?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum backup registrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
