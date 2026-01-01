import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Server, HardDrive, Clock, CheckCircle, LogIn } from "lucide-react";

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
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
              <Server className="h-16 w-16 text-primary" />
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
            Bem-vindo, {user.name || user.email?.split('@')[0] || user.username || 'Usuário'}
          </h1>
          <p className="text-muted-foreground">Network Backup Manager v17.0</p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = '/api/logout'} data-testid="button-logout">
          Sair
        </Button>
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
              <div className="text-2xl font-bold" data-testid="text-backup-count">
                {stats?.totalBackups || 0}
              </div>
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
              <div className="text-2xl font-bold text-green-600" data-testid="text-success-rate">
                {stats?.successRate || 100}%
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-status">
              Online
            </div>
          </CardContent>
        </Card>
      </div>

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
