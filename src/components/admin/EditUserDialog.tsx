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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Usuario, PuntoAtencion } from "../../types";
import { userService } from "../../services/userService";
import { PointSelectModal } from "../management/PointSelectModal";

interface EditUserDialogProps {
  user: Usuario;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
  currentUser: Usuario;
}


const initialFormState = (user: Usuario) => ({
  nombre: user.nombre || "",
  username: user.username || "",
  correo: user.correo || "",
  telefono: user.telefono || "",
  rol: user.rol,
  punto_atencion_id: user.punto_atencion_id || "",
  punto_atencion_nombre: user.punto_atencion_id ? user.punto_atencion_id : "",
});


const EditUserDialog = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
  currentUser,
}: EditUserDialogProps) => {
  const [formData, setFormData] = useState(initialFormState(user));
  const [isLoading, setIsLoading] = useState(false);
  const [showPointModal, setShowPointModal] = useState(false);

  // Resetear el form cuando cambie usuario o se abra/cierre el modal
  useEffect(() => {
    if (user && isOpen) setFormData(initialFormState(user));
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { user: updatedUser, error } = await userService.updateUser(
        user.id,
        formData
      );

      if (error || !updatedUser) {
        toast({
          title: "Error",
          description: error || "Error al actualizar usuario",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Usuario actualizado",
        description: `Usuario ${updatedUser.nombre} actualizado exitosamente`,
      });

      onUserUpdated();
      onClose();
    } catch (error: unknown) {
      // Solución tipada para el mensaje de error
      let msg = "Error interno del servidor";
      if (typeof error === "object" && error && "message" in error) {
        msg = String((error as { message?: string }).message);
      }
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
      console.error("Error updating user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Modifica la información del usuario{" "}
            <span className="font-semibold">{user?.nombre}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <fieldset disabled={isLoading} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input
                value={formData.nombre}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                }
                placeholder="Nombre completo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Input
                value={formData.username}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="Nombre de usuario"
                required
                disabled={formData.rol !== "CONCESION"}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.correo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, correo: e.target.value }))
                }
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={formData.telefono}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, telefono: e.target.value }))
                }
                placeholder="Teléfono"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={formData.rol}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    rol: value as Usuario["rol"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERADOR">Operador</SelectItem>
                  <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                  <SelectItem value="CONCESION">Concesión</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  {currentUser.rol === "SUPER_USUARIO" && (
                    <SelectItem value="SUPER_USUARIO">Super Usuario</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {/* Solo para CONCESION: permitir cambiar punto de atención */}
            {formData.rol === "CONCESION" && (
              <div className="space-y-2">
                <Label>Punto de Atención</Label>
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-medium">
                    {formData.punto_atencion_id ? `ID: ${formData.punto_atencion_id}` : "No asignado"}
                  </span>
                  <Button type="button" size="sm" onClick={() => setShowPointModal(true)}>
                    Cambiar Punto
                  </Button>
                </div>
                <div className="text-xs text-gray-500">
                  Selecciona el punto de atención para este usuario de concesión.
                </div>
                <PointSelectModal
                  open={showPointModal}
                  onClose={() => setShowPointModal(false)}
                  onSelect={(point: PuntoAtencion) => {
                    setFormData((prev) => ({ ...prev, punto_atencion_id: point.id }));
                    setShowPointModal(false);
                  }}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Actualizando..." : "Actualizar Usuario"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;
