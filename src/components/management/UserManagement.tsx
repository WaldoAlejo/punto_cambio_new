
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { userService } from '../../services/userService';
import { pointService } from '../../services/pointService';
import { Usuario, PuntoAtencion } from '../../types';
import { Plus, Edit, ToggleLeft, ToggleRight, Key } from 'lucide-react';

export const UserManagement = () => {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nombre: '',
    correo: '',
    telefono: '',
    rol: 'OPERADOR' as const,
    punto_atencion_id: ''
  });

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
          variant: "destructive"
        });
      } else {
        setUsers(usersResult.users);
      }

      if (pointsResult.error) {
        toast({
          title: "Error",
          description: pointsResult.error,
          variant: "destructive"
        });
      } else {
        setPoints(pointsResult.points);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.username || !formData.password || !formData.nombre) {
      toast({
        title: "Error",
        description: "Complete los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    const { user, error } = await userService.createUser(formData);
    
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      });
    } else if (user) {
      setUsers([...users, user]);
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Usuario creado",
        description: "El usuario se creó exitosamente"
      });
    }
  };

  const handleToggleUser = async (userId: string) => {
    const { user, error } = await userService.toggleUserStatus(userId);
    
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      });
    } else if (user) {
      setUsers(users.map(u => u.id === userId ? user : u));
      toast({
        title: "Estado actualizado",
        description: `Usuario ${user.activo ? 'activado' : 'desactivado'} exitosamente`
      });
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      nombre: '',
      correo: '',
      telefono: '',
      rol: 'OPERADOR',
      punto_atencion_id: ''
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Usuario *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="Nombre de usuario"
                />
              </div>
              <div>
                <Label htmlFor="password">Contraseña *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="Contraseña"
                />
              </div>
              <div>
                <Label htmlFor="nombre">Nombre Completo *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <Label htmlFor="correo">Correo</Label>
                <Input
                  id="correo"
                  type="email"
                  value={formData.correo}
                  onChange={(e) => setFormData({...formData, correo: e.target.value})}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                  placeholder="Número de teléfono"
                />
              </div>
              <div>
                <Label htmlFor="rol">Rol</Label>
                <Select value={formData.rol} onValueChange={(value: any) => setFormData({...formData, rol: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERADOR">Operador</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                    <SelectItem value="CONCESION">Concesión</SelectItem>
                    <SelectItem value="SUPER_USUARIO">Super Usuario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="punto">Punto de Atención</Label>
                <Select value={formData.punto_atencion_id} onValueChange={(value) => setFormData({...formData, punto_atencion_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar punto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {points.map(point => (
                      <SelectItem key={point.id} value={point.id}>
                        {point.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser}>
                  Crear Usuario
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-medium">{user.nombre}</h3>
                      <p className="text-sm text-gray-500">@{user.username}</p>
                    </div>
                    <Badge variant={user.activo ? "default" : "secondary"}>
                      {user.activo ? "Activo" : "Inactivo"}
                    </Badge>
                    <Badge variant="outline">
                      {user.rol.replace('_', ' ')}
                    </Badge>
                  </div>
                  {user.correo && (
                    <p className="text-sm text-gray-600 mt-1">{user.correo}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleUser(user.id)}
                  >
                    {user.activo ? (
                      <ToggleRight className="h-4 w-4" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
