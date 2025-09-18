import React, { useState } from "react";
import { scheduleService } from "../../services/scheduleService";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/button";
import { toast } from "react-hot-toast";

interface Props {
  usuarioId: string; // ID del usuario a liberar del punto
  destinoPuntoId?: string; // Punto destino opcional; si no existe, se libera el punto
  onDone?: () => void; // Callback tras éxito
}

const FreePointButton: React.FC<Props> = ({
  usuarioId,
  destinoPuntoId,
  onDone,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const canUse = user && (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO");

  const handleClick = async () => {
    if (!canUse) {
      toast.error("No tiene permisos para esta acción");
      return;
    }

    setLoading(true);
    try {
      const { error } = await scheduleService.reassignPoint({
        usuario_id: usuarioId,
        finalizar: !destinoPuntoId, // si no se indica destino, cancelamos jornada y liberamos punto
        destino_punto_atencion_id: destinoPuntoId,
        motivo: destinoPuntoId ? "REASIGNACION_ADMIN" : "CANCELACION_ADMIN",
        observaciones: "Liberar punto por selección equivocada",
      });

      if (error) {
        toast.error(error);
      } else {
        toast.success(
          destinoPuntoId
            ? "Jornada reasignada correctamente"
            : "Jornada cancelada y punto liberado"
        );
        onDone?.();
      }
    } catch {
      toast.error("Error al liberar punto");
    } finally {
      setLoading(false);
    }
  };

  if (!canUse) return null;

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      size="sm"
      className="bg-red-600 hover:bg-red-700 text-white"
      title={
        destinoPuntoId
          ? "Reasignar jornada a otro punto"
          : "Liberar punto actual"
      }
    >
      {loading
        ? "Procesando..."
        : destinoPuntoId
        ? "Reasignar Punto"
        : "Liberar Punto"}
    </Button>
  );
};

export default FreePointButton;
