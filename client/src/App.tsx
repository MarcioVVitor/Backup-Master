import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { I18nProvider, useI18n } from "@/contexts/i18n-context";
import { CompanyProvider } from "@/contexts/company-context";
import { CompanySelector } from "@/components/company-selector";
import { DynamicBackground } from "@/components/dynamic-backgrounds";

import Home from "@/pages/home";
import Equipment from "@/pages/equipment";
import Backups from "@/pages/backups";
import BackupExecute from "@/pages/backup-execute";
import Execute from "@/pages/execute";
import Scripts from "@/pages/scripts";
import Manufacturers from "@/pages/manufacturers";
import Admin from "@/pages/admin";
import Firmware from "@/pages/firmware";
import TerminalPage from "@/pages/terminal";
import Scheduler from "@/pages/scheduler";
import Agents from "@/pages/agents";
import ServerPage from "@/pages/server";
import Login from "@/pages/login";
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
  SidebarFooter,
} from "@/components/ui/sidebar";
import { 
  Home as HomeIcon, 
  Server, 
  HardDrive, 
  Play, 
  LogOut, 
  Sun, 
  Moon, 
  Search, 
  Terminal, 
  Factory, 
  Settings,
  FileCode,
  TerminalSquare,
  Calendar,
  Network,
  Cloud
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ThemeToggle() {
  const { isDark, toggleDark } = useTheme();

  return (
    <Button size="icon" variant="ghost" onClick={toggleDark}>
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const { background, logoUrl, systemName } = useTheme();
  const { t } = useI18n();
  
  const { data: serverAdminCheck } = useQuery<{ isServerAdmin: boolean; serverRole: string | null }>({
    queryKey: ["/api/server/check-admin"],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="animate-pulse">{t.common.loading}</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const baseMenuItems = [
    { title: t.menu.dashboard, url: "/", icon: HomeIcon },
    { title: t.menu.manufacturers, url: "/manufacturers", icon: Factory },
    { title: t.menu.equipment, url: "/equipment", icon: Server },
    { title: t.menu.scripts, url: "/scripts", icon: Terminal },
    { title: t.menu.executeBackup, url: "/backup-execute", icon: Play },
    { title: t.menu.backups, url: "/backups", icon: HardDrive },
    { title: t.menu.scheduler, url: "/scheduler", icon: Calendar },
    { title: t.menu.firmware, url: "/firmware", icon: FileCode },
    { title: t.menu.terminal, url: "/terminal", icon: TerminalSquare },
    { title: t.menu.agents, url: "/agents", icon: Network },
    { title: t.menu.administration, url: "/admin", icon: Settings },
  ];
  
  const menuItems = serverAdminCheck?.isServerAdmin 
    ? [...baseMenuItems, { title: "NBM CLOUD Server", url: "/server", icon: Cloud }]
    : baseMenuItems;

  const backgroundStyle = background?.type === "gradient" 
    ? { background: background.value }
    : {};

  return (
    <SidebarProvider>
      {background?.type === "dynamic" && (
        <DynamicBackground type={background.value} />
      )}
      <div 
        className="flex h-screen w-full bg-background"
        style={backgroundStyle}
      >
        <Sidebar className="border-r border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="w-8 h-8 rounded-lg object-contain"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Server className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-none">{systemName || "NBM CLOUD"}</span>
                <span className="text-[10px] text-muted-foreground">Network Backup Management</span>
              </div>
            </div>
          </SidebarHeader>
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder={`${t.common.search}...`}
                className="h-9 pl-8 text-sm bg-muted/50 border-0 focus-visible:ring-1"
              />
            </div>
          </div>
          <SidebarContent className="px-2">
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                {(user?.username || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.username}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(() => window.location.reload())}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 items-center justify-between gap-4 px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-sm font-semibold">
                {menuItems.find(m => m.url === location)?.title || 'NBM'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <CompanySelector />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/10">
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
      <Route path="/backup-execute" component={BackupExecute} />
      <Route path="/scheduler" component={Scheduler} />
      <Route path="/backups" component={Backups} />
      <Route path="/scripts" component={Scripts} />
      <Route path="/manufacturers" component={Manufacturers} />
      <Route path="/firmware" component={Firmware} />
      <Route path="/terminal" component={TerminalPage} />
      <Route path="/execute" component={Execute} />
      <Route path="/agents" component={Agents} />
      <Route path="/admin" component={Admin} />
      <Route path="/server" component={ServerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <CompanyProvider>
            <TooltipProvider>
              <AppLayout>
                <Router />
              </AppLayout>
              <Toaster />
            </TooltipProvider>
          </CompanyProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
