import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { transferApprovalService } from "../../services/transferApprovalService";
import { Transferencia } from "../../types";

const TransferApprovals = () => {
  const [pendingTransfers, setPendingTransfers] = useState<Transferencia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [observaciones, setObservaciones] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    loadPendingTransfers();
  }, []);

  const loadPendingTransfers = async () => {
    try {
      setIsLoading(true);
      const { transfers, error } =
        await transferApprovalService.getPendingTransfers();

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else {
        setPendingTransfers(transfers);
      }
    } catch (error) {
      console.error("Error loading pending transfers:", error);
      toast({
        title: "Error",
        description: "Error al cargar las transferencias pendientes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTransferTypeLabel = (type: string) => {
    const types = {
      ENTRE_PUNTOS: "Entre Puntos",
      DEPOSITO_MATRIZ: "Depósito Matriz",
      RETIRO_GERENCIA: "Retiro Gerencia",
      DEPOSITO_GERENCIA: "Depósito Gerencia",
    };
    return types[type as keyof typeof types] || type;
  };

  const handleApprove = async (transferId: string) => {
    if (processingIds.has(transferId)) return;

    try {
      setProcessingIds((prev) => new Set(prev).add(transferId));

      const { error } = await transferApprovalService.approveTransfer(
        transferId,
        {
          observaciones: observaciones[transferId] || undefined,
        }
      );

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else {
        setPendingTransfers((prev) => prev.filter((t) => t.id !== transferId));
        toast({
          title: "Transferencia aprobada",
          description: "La transferencia ha sido aprobada exitosamente",
        });
        
        // Disparar evento para actualizar saldos
        window.dispatchEvent(new CustomEvent('transferApproved'));
        
        setObservaciones((prev) => {
          const newObs = { ...prev };
          delete newObs[transferId];
          return newObs;
        });
      }
    } catch (error) {
      console.error("Error approving transfer:", error);
      toast({
        title: "Error",
        description: "Error al aprobar la transferencia",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(transferId);
        return newSet;
      });
    }
  };

  const handleReject = async (transferId: string) => {
    if (processingIds.has(transferId)) return;

    try {
      setProcessingIds((prev) => new Set(prev).add(transferId));

      const { error } = await transferApprovalService.rejectTransfer(
        transferId,
        {
          observaciones: observaciones[transferId] || undefined,
        }
      );

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else {
        setPendingTransfers((prev) => prev.filter((t) => t.id !== transferId));
        toast({
          title: "Transferencia rechazada",
          description: "La transferencia ha sido rechazada",
          variant: "destructive",
        });
        setObservaciones((prev) => {
          const newObs = { ...prev };
          delete newObs[transferId];
          return newObs;
        });
      }
    } catch (error) {
      console.error("Error rejecting transfer:", error);
      toast({
        title: "Error",
        description: "Error al rechazar la transferencia",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(transferId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            Cargando transferencias pendientes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Aprobación de Transferencias
        </h1>
        <div className="flex gap-2">
          <Badge variant="secondary">
            {pendingTransfers.length} transferencias pendientes
          </Badge>
          <Button onClick={loadPendingTransfers} variant="outline" size="sm">
            Actualizar
          </Button>
        </div>
      </div>

      {pendingTransfers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            No hay transferencias pendientes de aprobación
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingTransfers.map((transfer) => (
            <Card key={transfer.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {getTransferTypeLabel(transfer.tipo_transferencia)}
                    </CardTitle>
                    <CardDescription>
                      Recibo: {transfer.numero_recibo || "Sin número"} •
                      Solicitado por: {transfer.usuarioSolicitante?.nombre}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-yellow-50 text-yellow-800"
                  >
                    {transfer.estado}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Detalles de la Transferencia
                    </p>
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="font-medium">Monto:</span>{" "}
                        {transfer.monto} {transfer.moneda?.codigo}
                      </p>
                      {transfer.tipo_transferencia === "ENTRE_PUNTOS" &&
                        transfer.origen && (
                          <p>
                            <span className="font-medium">De:</span>{" "}
                            {transfer.origen.nombre} →{" "}
                            <span className="font-medium">A:</span>{" "}
                            {transfer.destino?.nombre}
                          </p>
                        )}
                      {transfer.tipo_transferencia !== "ENTRE_PUNTOS" && (
                        <p>
                          <span className="font-medium">Destino:</span>{" "}
                          {transfer.destino?.nombre}
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Fecha:</span>{" "}
                        {new Date(transfer.fecha).toLocaleString("es-ES")}
                      </p>
                    </div>
                  </div>

                  {transfer.descripcion && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">
                        Descripción
                      </p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {transfer.descripcion}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`obs-${transfer.id}`}>
                      Observaciones (opcional)
                    </Label>
                    <Textarea
                      id={`obs-${transfer.id}`}
                      placeholder="Agregar observaciones sobre la aprobación o rechazo..."
                      value={observaciones[transfer.id] || ""}
                      onChange={(e) =>
                        setObservaciones((prev) => ({
                          ...prev,
                          [transfer.id]: e.target.value,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      onClick={() => handleApprove(transfer.id)}
                      disabled={processingIds.has(transfer.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processingIds.has(transfer.id)
                        ? "Procesando..."
                        : "Aprobar"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(transfer.id)}
                      disabled={processingIds.has(transfer.id)}
                    >
                      {processingIds.has(transfer.id)
                        ? "Procesando..."
                        : "Rechazar"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransferApprovals;
