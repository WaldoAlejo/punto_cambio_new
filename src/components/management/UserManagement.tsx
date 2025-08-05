import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Usuario, PuntoAtencion } from "../../types";
import { userService } from "../../services/userService";
import { pointService } from "../../services/pointService";
import EditUserDialog from "../../components/admin/EditUserDialog";
import ResetPasswordDialog from "../../components/admin/ResetPasswordDialog";
import { Edit, Key, UserPlus, UserX, UserCheck } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";

export const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const [users, setUsers] = useState<Usuario[]>([]);
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<Usuario | null>(
    null
  );
  const [formData, setFormData] = useState({
    username: "",
    correo: "",
    nombre: "",
    rol: "OPERADOR" as Usuario["rol"],
    password: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersResult, pointsResult] = await Promise.all([
        userService.getAllUsers(),
        pointService.getAllPoints(),
      ]);

      setUsers(usersResult.users);
      setPoints(pointsResult.points);
    } catch (err) {
      console.error("Error loading data:", err);
      const errorMessage = "Error al cargar datos";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.nombre || !formData.password) {
      toast.error("Los campos usuario, nombre y contraseña son obligatorios");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      const { user: newUser } = await userService.createUser({
        username: formData.username,
        password: formData.password,
        nombre: formData.nombre,
        correo: formData.correo,
        rol: formData.rol,
      });

      if (!newUser) {
        toast.error("Error al crear usuario");
        return;
      }

      await loadData();
      setFormData({
        username: "",
        correo: "",
        nombre: "",
        rol: "OPERADOR",
        password: "",
      });
      setShowForm(false);

      toast.success(`✅ Usuario ${newUser.nombre} creado exitosamente`);
    } catch (err) {
      console.error("Error creating user:", err);
      toast.error(
        "Error al crear usuario. Verifique que el nombre de usuario no esté en uso."
      );
    }
  };

  const handleToggleUserStatus = (user: Usuario) => {
    if (user.id === currentUser?.id) {
      toast.error("No puedes desactivar tu propio usuario");
      return;
    }

    const action = user.activo ? "desactivar" : "activar";
    showConfirmation(
      `Confirmar ${action} usuario`,
      `¿Está seguro de que desea ${action} al usuario ${user.nombre}?`,
      async () => {
        try {
          await userService.toggleUserStatus(user.id);
          await loadData();
          toast.success(
            `✅ Usuario ${user.nombre} ${
              user.activo ? "desactivado" : "activado"
            } exitosamente`
          );
        } catch (err) {
          console.error("Error toggling user status:", err);
          toast.error("Error al cambiar el estado del usuario");
        }
      }
    );
  };

  const getRoleLabel = (rol: string) => {
    const roles: Record<string, string> = {
      SUPER_USUARIO: "Super Usuario",
      ADMIN: "Administrador",
      OPERADOR: "Operador",
      CONCESION: "Concesión",
    };
    return roles[rol] || rol;
  };

  // Solo ADMIN o SUPER_USUARIO pueden ver el componente
  if (currentUser.rol !== "ADMIN" && currentUser.rol !== "SUPER_USUARIO") {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">
            No tiene permisos para acceder a esta sección
          </p>
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
          <Button onClick={loadData} className="mt-4" variant="outline">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Gestión de Usuarios
        </h1>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? "Cancelar" : "Nuevo Usuario"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Usuario</CardTitle>
            <CardDescription>
              Complete la información del nuevo usuario
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Completo</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        nombre: e.target.value,
                      }))
                    }
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select
                    value={formData.rol}
                    onValueChange={(value: Usuario["rol"]) =>
                      setFormData((prev) => ({ ...prev, rol: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPERADOR">Operador</SelectItem>
                      <SelectItem value="CONCESION">Concesión</SelectItem>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                      <SelectItem value="SUPER_USUARIO">
                        Super Usuario
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Usuario</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                    placeholder="Nombre de usuario"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.correo}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        correo: e.target.value,
                      }))
                    }
                    placeholder="email@ejemplo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Contraseña Temporal</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
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
          <CardDescription>
            Lista de todos los usuarios registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No hay usuarios registrados
              </p>
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
                    <TableCell className="font-medium">
                      {userItem.nombre}
                    </TableCell>
                    <TableCell>{userItem.username}</TableCell>
                    <TableCell>{userItem.correo}</TableCell>
                    <TableCell>{getRoleLabel(userItem.rol)}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          userItem.activo
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {userItem.activo ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(userItem.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingUser(userItem)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setResetPasswordUser(userItem)}
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={userItem.activo ? "destructive" : "default"}
                          onClick={() => handleToggleUserStatus(userItem)}
                          disabled={userItem.id === currentUser?.id}
                        >
                          {userItem.activo ? (
                            <>
                              <UserX className="h-4 w-4 mr-1" />
                              Desactivar
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-1" />
                              Activar
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Diálogos */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          isOpen={true}
          onClose={() => setEditingUser(null)}
          onUserUpdated={loadData}
          currentUser={currentUser}
        />
      )}
      {resetPasswordUser && (
        <ResetPasswordDialog
          user={resetPasswordUser}
          isOpen={true}
          onClose={() => setResetPasswordUser(null)}
        />
      )}

      <ConfirmationDialog />
    </div>
  );
};

export default UserManagement;
