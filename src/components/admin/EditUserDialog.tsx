import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";
import { Usuario } from "../../types";
import { userService } from "../../services/userService";

interface Props {
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
}: Props) => {
  const [formData, setFormData] = useState(initialFormState(user));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isOpen) setFormData(initialFormState(user));
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { user: updated, error } = await userService.updateUser(
        user.id,
        formData
      );
      if (error || !updated) {
        toast({
          title: "Error",
          description: error || "Error al actualizar usuario",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Usuario actualizado",
        description: `Usuario ${updated.nombre} actualizado correctamente`,
      });
      onUserUpdated();
      onClose();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err && "message" in err
          ? String((err as { message?: string }).message)
          : "Error interno del servidor";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Modifica la información del usuario{" "}
            <span className="font-semibold">{user?.nombre}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Formulario con scroll interno */}
        <div className="flex-1 overflow-y-auto pr-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={loading} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="nombre">Nombre Completo</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        nombre: e.target.value,
                      }))
                    }
                    placeholder="Nombre completo"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="correo">Email</Label>
                  <Input
                    id="correo"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        telefono: e.target.value,
                      }))
                    }
                    placeholder="Teléfono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rol">Rol</Label>
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
                      <SelectItem value="ADMINISTRATIVO">
                        Administrativo
                      </SelectItem>
                      <SelectItem value="CONCESION">Concesión</SelectItem>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                      {currentUser.rol === "SUPER_USUARIO" && (
                        <SelectItem value="SUPER_USUARIO">
                          Super Usuario
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>
          </form>
        </div>

        {/* Footer fijo */}
        <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t bg-white">
          <div className="flex gap-2 justify-end w-full">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;
