import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Server, LogIn, UserPlus } from "lucide-react";

async function loginUser(credentials: { username: string; password: string }) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(credentials),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erro ao fazer login");
  }
  
  return response.json();
}

async function registerUser(data: { username: string; password: string; name?: string; email?: string }) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erro ao registrar");
  }
  
  return response.json();
}

export default function Login() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({ username: "", password: "", confirmPassword: "", name: "", email: "" });
  
  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      toast({ title: "Login realizado", description: `Bem-vindo, ${data.user.username}!` });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    },
  });
  
  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (data) => {
      toast({ 
        title: data.user.isAdmin ? "Conta de administrador criada" : "Conta criada",
        description: `Bem-vindo, ${data.user.username}!` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro no registro", description: error.message, variant: "destructive" });
    },
  });
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.username || !loginData.password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    loginMutation.mutate(loginData);
  };
  
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.username || !registerData.password) {
      toast({ title: "Preencha usuario e senha", variant: "destructive" });
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      toast({ title: "As senhas nao conferem", variant: "destructive" });
      return;
    }
    registerMutation.mutate({
      username: registerData.username,
      password: registerData.password,
      name: registerData.name || undefined,
      email: registerData.email || undefined,
    });
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Server className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{t.login.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t.login.subtitle}</p>
        </div>
        
        <Card>
          <Tabs defaultValue="login">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="tab-login">
                  <LogIn className="h-4 w-4 mr-2" />
                  {t.common.connect}
                </TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t.common.add}
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent>
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">{t.admin.username}</Label>
                    <Input
                      id="login-username"
                      data-testid="input-login-username"
                      placeholder={t.admin.username}
                      value={loginData.username}
                      onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t.admin.password}</Label>
                    <Input
                      id="login-password"
                      data-testid="input-login-password"
                      type="password"
                      placeholder={t.admin.password}
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    data-testid="button-login"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? t.common.loading : t.common.connect}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="mt-0">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Usuario *</Label>
                    <Input
                      id="register-username"
                      data-testid="input-register-username"
                      placeholder="Escolha um usuario"
                      value={registerData.username}
                      onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nome</Label>
                    <Input
                      id="register-name"
                      data-testid="input-register-name"
                      placeholder="Seu nome completo"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-mail</Label>
                    <Input
                      id="register-email"
                      data-testid="input-register-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Senha *</Label>
                    <Input
                      id="register-password"
                      data-testid="input-register-password"
                      type="password"
                      placeholder="Escolha uma senha"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">Confirmar Senha *</Label>
                    <Input
                      id="register-confirm"
                      data-testid="input-register-confirm"
                      type="password"
                      placeholder="Repita a senha"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    data-testid="button-register"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "Registrando..." : "Criar Conta"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    O primeiro usuario registrado sera o administrador do sistema.
                  </p>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground mt-6">
          Suporta: Huawei, Mikrotik, Cisco, Nokia, ZTE, Datacom, Juniper
        </p>
      </div>
    </div>
  );
}
