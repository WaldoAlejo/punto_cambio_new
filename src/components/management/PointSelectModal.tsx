import { useEffect, useState } from "react";
import { PuntoAtencion } from "../../types";
import { pointService } from "../../services/pointService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PointSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (point: PuntoAtencion) => void;
}

export const PointSelectModal = ({ open, onClose, onSelect }: PointSelectModalProps) => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      pointService.getAllPoints().then((res) => {
        setPoints(res.points || []);
        setLoading(false);
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Para crear un usuario de concesión debes seleccionar el punto de atención correspondiente. Este punto será el único en el que podrá operar el usuario.
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="text-center py-8">Cargando puntos...</div>
        ) : (
          <div className="space-y-2">
            {points.map((point) => (
              <div key={point.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-semibold">{point.nombre}</div>
                  <div className="text-xs text-gray-500">{point.ciudad} - {point.direccion}</div>
                </div>
                <Button size="sm" onClick={() => onSelect(point)}>
                  Asignar
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
