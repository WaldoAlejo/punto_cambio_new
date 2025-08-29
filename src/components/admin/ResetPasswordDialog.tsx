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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }

    // Validar contraseña fuerte
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

    if (password.length < 8) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 8 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (!passwordRegex.test(password)) {
      toast({
        title: "Error",
        description:
          "La contraseña debe contener al menos: 1 mayúscula, 1 minúscula, 1 número y 1 símbolo (@$!%*?&)",
        variant: "destructive",
      });
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
        description: `Contraseña de ${user.nombre} reseteada exitosamente`,
      });

      setPassword("");
      setConfirmPassword("");
      onClose();
    } catch (error) {
      console.error("Error resetting password:", error);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetear Contraseña</DialogTitle>
          <DialogDescription>
            Establecer nueva contraseña para {user?.nombre}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs text-gray-600 bg-yellow-50 p-3 rounded">
            <p>
              <strong>Requisitos de contraseña:</strong>
            </p>
            <ul className="list-disc list-inside mt-1">
              <li>Mínimo 8 caracteres</li>
              <li>Al menos 1 mayúscula (A-Z)</li>
              <li>Al menos 1 minúscula (a-z)</li>
              <li>Al menos 1 número (0-9)</li>
              <li>Al menos 1 símbolo (@$!%*?&)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label>Nueva Contraseña</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mín. 8 caracteres: A-z, 0-9, @$!%*?&"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Confirmar Contraseña</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar contraseña"
              required
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Reseteando..." : "Resetear Contraseña"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordDialog;
