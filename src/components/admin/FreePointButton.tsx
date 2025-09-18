import React, { useState } from "react";
import { scheduleService } from "../../services/scheduleService";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/button";
import { toast } from "react-hot-toast";

interface Props {
  usuarioId: string; // usuario a liberar del punto
  destinoPuntoId?: string; // opcional, si no se pasa se usa el punto principal
  onDone?: () => void; // callback tras éxito
}

/**
 * Botón para ADMIN/SUPER que envía la jornada activa del usuario al punto principal
 * (o a un punto destino), liberando así el punto en el que se quedó por error.
 */
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
        // Para liberar completamente y forzar nueva selección al reingreso:
        finalizar: !destinoPuntoId, // si no se indica destino, cancelamos jornada y limpiamos punto
        destino_punto_atencion_id: destinoPuntoId, // si se envía, reasigna en lugar de cancelar
        motivo: destinoPuntoId ? "REASIGNACION_ADMIN" : "CANCELACION_ADMIN",
        observaciones: "Liberar punto por selección equivocada",
      });
      if (error) {
        toast.error(error);
      } else {
        toast.success(
          destinoPuntoId
            ? "Jornada reasignada"
            : "Jornada cancelada y punto liberado"
        );
        onDone?.();
      }
    } catch (e) {
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
      variant="destructive"
      size="sm"
      title="Mover jornada al punto principal para liberar"
    >
      {loading ? "Liberando..." : "Liberar Punto"}
    </Button>
  );
};

export default FreePointButton;
