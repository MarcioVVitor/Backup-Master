import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import Home from "@/pages/home";
import Equipment from "@/pages/equipment";
import Backups from "@/pages/backups";
import Execute from "@/pages/execute";
import NotFound from "@/pages/not-found";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Home as HomeIcon, Server, HardDrive, Play, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading || !user) {
    return <>{children}</>;
  }

  const menuItems = [
    { title: "Dashboard", url: "/", icon: HomeIcon },
    { title: "Equipamentos", url: "/equipment", icon: Server },
    { title: "Backups", url: "/backups", icon: HardDrive },
    { title: "Executar", url: "/execute", icon: Play },
  ];

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Server className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">NBM</span>
            </div>
            <span className="text-xs text-muted-foreground">Network Backup Manager</span>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <div className="mt-auto p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => window.location.href = '/api/logout'}
              data-testid="button-logout-sidebar"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </Sidebar>
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center gap-4 p-2 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <span className="text-sm text-muted-foreground">
              {user?.email || user?.username || 'Usuário'}
            </span>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/equipment" component={Equipment} />
      <Route path="/backups" component={Backups} />
      <Route path="/execute" component={Execute} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppLayout>
          <Router />
        </AppLayout>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
