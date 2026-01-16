import { useBackupHistory, useFiles } from "@/hooks/use-files";
import { useEquipment } from "@/hooks/use-equipment";
import { useAgents } from "@/hooks/use-agents";
import { useI18n } from "@/contexts/i18n-context";
import { StatsCard } from "@/components/StatsCard";
import { Server, HardDrive, CheckCircle2, Activity, Wifi, WifiOff, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, differenceInMinutes } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const MANUFACTURER_COLORS: Record<string, string> = {
  mikrotik: "#cc0000",
  huawei: "#e20b17",
  cisco: "#049fd9",
  nokia: "#005aff",
  zte: "#004b9e",
  datacom: "#ff6600",
  "datacom-dmos": "#ff8c00",
  juniper: "#00a86b",
  default: "#6b7280"
};

export default function Home() {
  const { data: equipment, isLoading: loadingEquipment } = useEquipment();
  const { data: history, isLoading: loadingHistory } = useBackupHistory();
  const { data: files, isLoading: loadingFiles } = useFiles();
  const { data: agents, isLoading: loadingAgents } = useAgents();
  const { t } = useI18n();

  if (loadingEquipment || loadingHistory || loadingFiles || loadingAgents) {
    return (
      <div className="p-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[350px] w-full rounded-xl" />
          <Skeleton className="h-[350px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const totalEquipment = equipment?.length || 0;
  const totalBackups = files?.length || 0;
  const failedBackups = history?.filter(h => h.status === 'failed').length || 0;
  const successRate = history?.length ? Math.round(((history.length - failedBackups) / history.length) * 100) : 100;
  const totalStorage = files?.reduce((acc, f) => acc + f.size, 0) || 0;
  const storageFormatted = totalStorage >= 1024 * 1024 * 1024 
    ? (totalStorage / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
    : (totalStorage / (1024 * 1024)).toFixed(2) + ' MB';

  const onlineAgents = agents?.filter(a => {
    if (a.status === 'online') return true;
    if (a.lastHeartbeat) {
      const minutesAgo = differenceInMinutes(new Date(), new Date(a.lastHeartbeat));
      return minutesAgo < 5;
    }
    return false;
  }).length || 0;
  const totalAgents = agents?.length || 0;

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
      total: dayBackups.length,
    };
  });

  const manufacturerStats = equipment?.reduce((acc, eq) => {
    const mfr = eq.manufacturer?.toLowerCase() || 'other';
    acc[mfr] = (acc[mfr] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const manufacturerChartData = Object.entries(manufacturerStats)
    .map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
      color: MANUFACTURER_COLORS[name] || MANUFACTURER_COLORS.default
    }))
    .sort((a, b) => b.value - a.value);

  const todayBackups = history?.filter(h => {
    if (!h.executedAt) return false;
    const today = new Date().toISOString().split('T')[0];
    return new Date(h.executedAt).toISOString().split('T')[0] === today;
  }).length || 0;

  const durationsWithValue = history?.filter(h => h.duration && h.duration > 0) || [];
  const avgDuration = durationsWithValue.length > 0
    ? durationsWithValue.reduce((acc, h) => acc + (h.duration || 0), 0) / durationsWithValue.length
    : 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t.dashboard.title}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">{t.dashboard.subtitle}</p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t.dashboard.totalEquipment}
          value={totalEquipment}
          description={`${totalAgents} ${t.agents?.title || 'Agents'}`}
          icon={Server}
          color="text-blue-500"
        />
        <StatsCard
          title={t.dashboard.totalBackups}
          value={totalBackups}
          description={`${todayBackups} hoje`}
          icon={HardDrive}
          color="text-purple-500"
        />
        <StatsCard
          title={t.backups.statusSuccess}
          value={`${successRate}%`}
          description={`${failedBackups} ${t.backups.statusFailed}`}
          icon={CheckCircle2}
          color="text-green-500"
        />
        <StatsCard
          title="Armazenamento"
          value={storageFormatted}
          description={avgDuration > 0 ? `${avgDuration.toFixed(1)}s média` : '-'}
          icon={Activity}
          color="text-orange-500"
        />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              {t.dashboard.recentBackups}
            </CardTitle>
            <CardDescription>Últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
                <Area type="monotone" dataKey="success" name={t.backups.statusSuccess} stroke="#22c55e" fillOpacity={1} fill="url(#colorSuccess)" />
                <Area type="monotone" dataKey="failed" name={t.backups.statusFailed} stroke="#ef4444" fillOpacity={1} fill="url(#colorFailed)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-500" />
              Por Fabricante
            </CardTitle>
            <CardDescription>{totalEquipment} {t.equipment.title || 'equipment'}</CardDescription>
          </CardHeader>
          <CardContent>
            {manufacturerChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={manufacturerChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {manufacturerChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Sem dados
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-500" />
              {t.agents?.title || 'Agents'}
            </CardTitle>
            <CardDescription>
              {onlineAgents}/{totalAgents} {t.agents?.online || 'online'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {agents && agents.length > 0 ? (
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {agents.slice(0, 8).map((agent) => {
                  const isOnline = agent.status === 'online' || (agent.lastHeartbeat && differenceInMinutes(new Date(), new Date(agent.lastHeartbeat)) < 5);
                  return (
                    <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid={`agent-status-${agent.id}`}>
                      <div className="flex items-center gap-3">
                        {isOnline ? (
                          <Wifi className="h-4 w-4 text-green-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.siteName || agent.publicIp || '-'}</p>
                        </div>
                      </div>
                      <Badge variant={isOnline ? "default" : "secondary"}>
                        {isOnline ? (t.agents?.online || 'Online') : (t.agents?.offline || 'Offline')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                {t.agents?.noAgents || 'No agents registered'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              {t.dashboard.systemStatus}
            </CardTitle>
            <CardDescription>Sucesso vs Falha</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} barCategoryGap="20%">
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
                <Bar dataKey="success" name={t.backups.statusSuccess} fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name={t.backups.statusFailed} fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle>{t.dashboard.recentBackups}</CardTitle>
          <CardDescription>Últimas execuções de backup</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.equipment.equipmentName}</TableHead>
                <TableHead>{t.equipment.ipAddress}</TableHead>
                <TableHead>{t.equipment.manufacturer}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="text-right">{t.common.date}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.slice(0, 10).map((log) => (
                <TableRow key={log.id} data-testid={`history-row-${log.id}`}>
                  <TableCell className="font-medium">{log.equipmentName || t.common.none}</TableCell>
                  <TableCell className="font-mono text-sm">{log.ip}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-xs">
                      {log.manufacturer || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status === 'success' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                      {log.status === 'success' ? t.backups.statusSuccess : log.status === 'failed' ? t.backups.statusFailed : t.backups.statusPending}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.duration ? `${log.duration.toFixed(1)}s` : '-'}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {log.executedAt ? format(new Date(log.executedAt), 'dd/MM/yyyy HH:mm') : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {!history?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t.dashboard.noRecentBackups}
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
