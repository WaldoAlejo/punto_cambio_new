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
import { Usuario } from "../../types";
import { userService } from "../../services/userService";

interface EditUserDialogProps {
  user: Usuario;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
  currentUser: Usuario;
}

const initialFormState = (user: Usuario) => ({
  nombre: user.nombre || "",
  correo: user.correo || "",
  telefono: user.telefono || "",
  rol: user.rol,
  punto_atencion_id: user.punto_atencion_id || "",
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
                  <SelectItem value="CONCESION">Concesión</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  {currentUser.rol === "SUPER_USUARIO" && (
                    <SelectItem value="SUPER_USUARIO">Super Usuario</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {/* Puedes agregar más campos si tu modelo lo necesita */}
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
