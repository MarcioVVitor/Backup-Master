import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Server, HardDrive, Clock, CheckCircle, LogIn, Database, Activity } from "lucide-react";
import { filesize } from "filesize";

interface Stats {
  totalEquipment: number;
  totalBackups: number;
  successRate: number;
  totalSize: number;
  recentBackups: number;
  manufacturerStats: { manufacturer: string; count: number }[];
}

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['/api/stats'],
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Server className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">NBM - Network Backup Manager</CardTitle>
            <CardDescription>
              Sistema de backup automatizado para equipamentos de rede
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground text-sm">
              Suporta: Huawei, Mikrotik, Cisco, Nokia, ZTE, Datacom, Juniper
            </p>
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-login"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Entrar com Replit
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-welcome">
            Bem-vindo, {user.name || user.email?.split('@')[0] || user.username || 'Usuario'}
          </h1>
          <p className="text-muted-foreground">Network Backup Manager v17.0</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipamentos</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-equipment-count">
                {stats?.totalEquipment || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Backups</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-backup-count">
                  {stats?.totalBackups || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.totalSize ? filesize(stats.totalSize) : '0 B'} armazenados
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-success-rate">
                {stats?.successRate || 100}%
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ultimas 24h</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-recent-backups">
                {stats?.recentBackups || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">backups realizados</p>
          </CardContent>
        </Card>
      </div>

      {stats?.manufacturerStats && stats.manufacturerStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Equipamentos por Fabricante</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.manufacturerStats.map((stat) => (
                <Badge key={stat.manufacturer} variant="secondary" className="text-sm">
                  {stat.manufacturer}: {stat.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/equipment">
          <Card className="cursor-pointer hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Equipamentos
              </CardTitle>
              <CardDescription>
                Gerenciar equipamentos cadastrados
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/backups">
          <Card className="cursor-pointer hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Backups
              </CardTitle>
              <CardDescription>
                Visualizar e gerenciar backups
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/execute">
          <Card className="cursor-pointer hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Executar Backup
              </CardTitle>
              <CardDescription>
                Executar backup manual
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
