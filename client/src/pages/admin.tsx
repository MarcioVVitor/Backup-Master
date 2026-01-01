import { useUsers, useUpdateUserRole } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, User as UserIcon } from "lucide-react";

export default function AdminPage() {
  const { data: users, isLoading } = useUsers();
  const { mutate: updateUser } = useUpdateUserRole();
  const { toast } = useToast();

  const handleRoleChange = (userId: number, role: string) => {
    updateUser({ id: userId, role, isAdmin: role === 'admin' }, {
      onSuccess: () => toast({ title: "Permissão atualizada" })
    });
  };

  const handleAdminToggle = (userId: number, isAdmin: boolean) => {
    const user = users?.find(u => u.id === userId);
    if (user) {
      updateUser({ id: userId, role: user.role || 'viewer', isAdmin }, {
        onSuccess: () => toast({ title: "Status de admin atualizado" })
      });
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Administração</h1>
        <p className="text-muted-foreground">Gestão de usuários e configurações do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Gerencie quem tem acesso ao sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-muted rounded-full">
                        <UserIcon className="h-4 w-4" />
                      </div>
                      {user.username}
                    </div>
                  </TableCell>
                  <TableCell>{user.email || "-"}</TableCell>
                  <TableCell>
                    <Select defaultValue={user.role || 'viewer'} onValueChange={(val) => handleRoleChange(user.id, val)}>
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="operator">Operador</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={!!user.isAdmin} 
                      onCheckedChange={(val) => handleAdminToggle(user.id, val)} 
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
