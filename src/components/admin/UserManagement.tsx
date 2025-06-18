
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User } from '../../types';
import { userService } from '../../services/userService';

interface UserManagementProps {
  user: User;
}

const UserManagement = ({ user }: UserManagementProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    correo: '',
    nombre: '',
    rol: 'OPERADOR' as User['rol'],
    password: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { users: fetchedUsers, error } = await userService.getAllUsers();
      
      if (error) {
        setError(error);
        toast({
          title: "Error",
          description: error,
          variant: "destructive"
        });
        return;
      }

      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      const errorMessage = "Error al cargar usuarios";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.correo || !formData.nombre || !formData.password) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive"
      });
      return;
    }

    try {
      const { user: newUser, error } = await userService.createUser({
        username: formData.username,
        password: formData.password,
        nombre: formData.nombre,
        correo: formData.correo,
        rol: formData.rol
      });

      if (error || !newUser) {
        toast({
          title: "Error",
          description: error || "Error al crear usuario",
          variant: "destructive"
        });
        return;
      }

      // Actualizar la lista de usuarios
      await loadUsers();
      
      // Reset form
      setFormData({
        username: '',
        correo: '',
        nombre: '',
        rol: 'OPERADOR',
        password: ''
      });
      setShowForm(false);

      toast({
        title: "Usuario creado",
        description: `Usuario ${newUser.nombre} creado exitosamente`,
      });
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive"
      });
    }
  };

  const toggleUserStatus = async (userId: string) => {
    try {
      const { success, error } = await userService.toggleUserStatus(userId);
      
      if (!success) {
        toast({
          title: "Error",
          description: error || "Error al actualizar usuario",
          variant: "destructive"
        });
        return;
      }

      // Recargar la lista de usuarios
      await loadUsers();
      
      const targetUser = users.find(u => u.id === userId);
      toast({
        title: "Estado actualizado",
        description: `Usuario ${targetUser?.nombre} ${targetUser?.activo ? 'desactivado' : 'activado'}`,
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive"
      });
    }
  };

  const getRoleLabel = (rol: string) => {
    const roles = {
      'SUPER_USUARIO': 'Super Usuario',
      'ADMIN': 'Administrador',
      'OPERADOR': 'Operador',
      'CONCESION': 'Concesión'
    };
    return roles[rol as keyof typeof roles] || rol;
  };

  if (user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">No tiene permisos para acceder a esta sección</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">Error al cargar usuarios</p>
          <p className="text-gray-500 mt-2">{error}</p>
          <Button 
            onClick={loadUsers} 
            className="mt-4"
            variant="outline"
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? 'Cancelar' : 'Nuevo Usuario'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Usuario</CardTitle>
            <CardDescription>Complete la información del nuevo usuario</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Completo</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select 
                    value={formData.rol} 
                    onValueChange={(value: User['rol']) => setFormData(prev => ({ ...prev, rol: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPERADOR">Operador</SelectItem>
                      <SelectItem value="CONCESION">Concesión</SelectItem>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                      {user.rol === 'SUPER_USUARIO' && (
                        <SelectItem value="SUPER_USUARIO">Super Usuario</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Usuario</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Nombre de usuario"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.correo}
                    onChange={(e) => setFormData(prev => ({ ...prev, correo: e.target.value }))}
                    placeholder="email@ejemplo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Contraseña Temporal</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Contraseña temporal"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Usuario
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Usuarios del Sistema</CardTitle>
          <CardDescription>Lista de todos los usuarios registrados</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No hay usuarios registrados</p>
              <p className="text-gray-400 mt-2">
                Cree el primer usuario haciendo clic en "Nuevo Usuario"
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userItem) => (
                  <TableRow key={userItem.id}>
                    <TableCell className="font-medium">{userItem.nombre}</TableCell>
                    <TableCell>{userItem.username}</TableCell>
                    <TableCell>{userItem.correo}</TableCell>
                    <TableCell>{getRoleLabel(userItem.rol)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        userItem.activo 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {userItem.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(userItem.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={userItem.activo ? "destructive" : "default"}
                        onClick={() => toggleUserStatus(userItem.id)}
                      >
                        {userItem.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
