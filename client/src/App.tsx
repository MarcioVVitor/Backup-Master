import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import Home from "@/pages/home";
import Equipment from "@/pages/equipment";
import Backups from "@/pages/backups";
import Execute from "@/pages/execute";
import Scripts from "@/pages/scripts";
import Manufacturers from "@/pages/manufacturers";
import Admin from "@/pages/admin";
import Firmware from "@/pages/firmware";
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
import { Home as HomeIcon, Server, HardDrive, Play, LogOut, Sun, Moon, Search, Terminal, Factory, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ThemeToggle() {
  const { isDark, toggleDark } = useTheme();

  return (
    <Button size="icon" variant="ghost" onClick={toggleDark} data-testid="button-theme-toggle">
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function MacOSTrafficLights() {
  return (
    <div className="flex items-center gap-2 mr-3">
      <div className="w-3 h-3 rounded-full bg-[#FF5F57] border border-[#E0443E]" />
      <div className="w-3 h-3 rounded-full bg-[#FEBC2E] border border-[#DEA123]" />
      <div className="w-3 h-3 rounded-full bg-[#28C840] border border-[#1AAB29]" />
    </div>
  );
}

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
    { title: "Scripts", url: "/scripts", icon: Terminal },
    { title: "Fabricantes", url: "/manufacturers", icon: Factory },
    { title: "Firmware", url: "/firmware", icon: HardDrive },
    { title: "Executar", url: "/execute", icon: Play },
    { title: "Administracao", url: "/admin", icon: Settings },
  ];

  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <Sidebar className="border-r-0">
          <SidebarHeader className="p-3 pt-4">
            <MacOSTrafficLights />
            <div className="mt-4 px-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Server className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-semibold text-sm block">NBM</span>
                  <span className="text-[10px] text-muted-foreground">Network Backup Manager</span>
                </div>
              </div>
            </div>
          </SidebarHeader>
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Buscar..." 
                className="h-8 pl-8 text-sm bg-muted/50 border-0"
                data-testid="input-search-global"
              />
            </div>
          </div>
          <SidebarContent className="px-2">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-2">
              Menu
            </div>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase()}`} className="rounded-md">
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <div className="mt-auto p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium">
                {(user?.name || user?.email || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user?.name || user?.username}</div>
                <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => window.location.href = '/api/logout'}
                data-testid="button-logout-sidebar"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Sidebar>
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="h-4 w-px bg-border" />
              <span className="text-sm font-medium">
                {menuItems.find(m => m.url === location)?.title || 'NBM'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
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
      <Route path="/scripts" component={Scripts} />
      <Route path="/manufacturers" component={Manufacturers} />
      <Route path="/firmware" component={Firmware} />
      <Route path="/execute" component={Execute} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppLayout>
            <Router />
          </AppLayout>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
