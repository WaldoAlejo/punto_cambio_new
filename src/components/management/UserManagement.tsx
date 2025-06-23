
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { userService } from "@/services/userService";
import { pointService }  from "@/services/pointService";
import { Usuario, CreateUserData, PuntoAtencion } from "@/types";
import { Users, Plus, ToggleLeft, ToggleRight } from "lucide-react";

export const UserManagement = () => {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateUserData>({
    username: "",
    password: "",
    nombre: "",
    correo: "",
    telefono: "",
    rol: "OPERADOR",
    punto_atencion_id: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersResult, pointsResult] = await Promise.all([
        userService.getAllUsers(),
        pointService.getAllPoints()
      ]);

      if (usersResult.error) {
        toast({
          title: "Error",
          description: usersResult.error,
          variant: "destructive",
        });
      } else {
        setUsers(usersResult.users);
      }

      if (pointsResult.error) {
        toast({
          title: "Error",
          description: pointsResult.error,
          variant: "destructive",
        });
      } else {
        setPoints(pointsResult.points);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const userData = {
        ...formData,
        punto_atencion_id: formData.punto_atencion_id || undefined,
        correo: formData.correo || undefined,
        telefono: formData.telefono || undefined,
      };

      const result = await userService.createUser(userData);
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: "Usuario creado correctamente",
        });
        setDialogOpen(false);
        setFormData({
          username: "",
          password: "",
          nombre: "",
          correo: "",
          telefono: "",
          rol: "OPERADOR",
          punto_atencion_id: "",
        });
        loadData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al crear usuario",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      const result = await userService.toggleUserStatus(userId);
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: "Estado del usuario actualizado",
        });
        loadData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al actualizar usuario",
        variant: "destructive",
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "SUPER_USUARIO":
        return "default";
      case "ADMIN":
        return "secondary";
      case "OPERADOR":
        return "outline";
      default:
        return "destructive";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2">Cargando usuarios...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <CardTitle>Gestión de Usuarios</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">Usuario</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="nombre">Nombre Completo</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="correo">Correo</Label>
                    <Input
                      id="correo"
                      type="email"
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rol">Rol</Label>
                    <Select value={formData.rol} onValueChange={(value) => setFormData({ ...formData, rol: value as any })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPERADOR">Operador</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="SUPER_USUARIO">Super Usuario</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="punto_atencion">Punto de Atención</Label>
                    <Select value={formData.punto_atencion_id} onValueChange={(value) => setFormData({ ...formData, punto_atencion_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar punto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin asignar</SelectItem>
                        {points.map((point) => (
                          <SelectItem key={point.id} value={point.id}>
                            {point.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Crear Usuario
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Punto de Atención</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>{user.nombre}</TableCell>
                <TableCell>
                  <Badge variant={getRoleColor(user.rol)}>{user.rol}</Badge>
                </TableCell>
                <TableCell>
                  {user.puntoAtencion?.nombre || "Sin asignar"}
                </TableCell>
                <TableCell>
                  <Badge variant={user.activo ? "default" : "destructive"}>
                    {user.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(user.id)}
                  >
                    {user.activo ? (
                      <ToggleRight className="h-4 w-4" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
