import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Usuario } from "../../types";
import { userService } from "../../services/userService";

interface ResetPasswordDialogProps {
  user: Usuario;
  isOpen: boolean;
  onClose: () => void;
}

const ResetPasswordDialog = ({
  user,
  isOpen,
  onClose,
}: ResetPasswordDialogProps) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = () => {
    if (!password || !confirmPassword) {
      return "Todos los campos son obligatorios";
    }
    if (password !== confirmPassword) {
      return "Las contraseñas no coinciden";
    }
    if (password.length < 8) {
      return "La contraseña debe tener al menos 8 caracteres";
    }
    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!regex.test(password)) {
      return "Debe contener mayúscula, minúscula, número y símbolo (@$!%*?&)";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validatePassword();
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { success, error } = await userService.resetUserPassword(
        user.id,
        password
      );
      if (!success) {
        toast({
          title: "Error",
          description: error || "Error al resetear contraseña",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Contraseña reseteada",
        description: `Contraseña de ${user.nombre} actualizada correctamente`,
      });
      setPassword("");
      setConfirmPassword("");
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resetear Contraseña</DialogTitle>
          <DialogDescription>
            Establecer una nueva contraseña para <strong>{user?.nombre}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs text-gray-600 bg-yellow-50 p-3 rounded border border-yellow-200">
            <p>
              <strong>Requisitos:</strong>
            </p>
            <ul className="list-disc list-inside mt-1">
              <li>Mínimo 8 caracteres</li>
              <li>1 mayúscula, 1 minúscula</li>
              <li>1 número y 1 símbolo (@$!%*?&)</li>
            </ul>
          </div>

          <div className="space-y-1">
            <Label>Nueva Contraseña</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ej: MiClave@123"
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Confirmar Contraseña</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetir contraseña"
              required
            />
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Reseteando..." : "Resetear Contraseña"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordDialog;
