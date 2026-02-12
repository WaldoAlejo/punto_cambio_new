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
import { toast } from "sonner";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { transferService } from "../../services/transferService";
import { Transferencia } from "../../types";
import { CheckCircle2, Loader2, Package, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const TransferAcceptance = () => {
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const { selectedPoint } = useAuth();
  const [pendingTransfers, setPendingTransfers] = useState<Transferencia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPendingTransfers();
    
    // Recargar cada 30 segundos
    const interval = setInterval(() => {
      loadPendingTransfers();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadPendingTransfers = async () => {
    try {
      setIsLoading(true);
      const { transfers, error } =
        await transferService.getPendingAcceptanceTransfers(selectedPoint?.id);

      if (error) {
        toast.error(`Error al cargar transferencias: ${error}`);
      } else {
        setPendingTransfers(transfers);
      }
    } catch (error) {
      console.error("Error loading pending transfers:", error);
      toast.error("Error al cargar las transferencias pendientes");
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

  const handleAccept = (transfer: Transferencia) => {
    if (processingIds.has(transfer.id)) return;

    showConfirmation(
      "Confirmar recepción",
      `¿Confirma que ha recibido el efectivo de ${transfer.monto.toLocaleString()} ${
        transfer.moneda?.codigo
      } desde ${transfer.origen?.nombre || "Origen"}?`,
      async () => {
        try {
          setProcessingIds((prev) => new Set(prev).add(transfer.id));

          const { error } = await transferService.acceptTransfer(
            transfer.id,
            observaciones[transfer.id] || undefined
          );

          if (error) {
            toast.error(`Error al aceptar transferencia: ${error}`);
          } else {
            setPendingTransfers((prev) =>
              prev.filter((t) => t.id !== transfer.id)
            );
            toast.success("✅ Transferencia aceptada. Monto agregado a tu saldo.");

            // Disparar evento para actualizar saldos
            window.dispatchEvent(new CustomEvent("transferAccepted"));

            setObservaciones((prev) => {
              const newObs = { ...prev };
              delete newObs[transfer.id];
              return newObs;
            });
          }
        } catch (error) {
          console.error("Error accepting transfer:", error);
          toast.error("Error al aceptar la transferencia");
        } finally {
          setProcessingIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(transfer.id);
            return newSet;
          });
        }
      }
    );
  };

  const handleReject = (transfer: Transferencia) => {
    if (processingIds.has(transfer.id)) return;

    showConfirmation(
      "Rechazar transferencia",
      `¿Está seguro de rechazar esta transferencia de ${transfer.monto.toLocaleString()} ${
        transfer.moneda?.codigo
      }? El dinero será devuelto al punto ${transfer.origen?.nombre || "origen"}.`,
      async () => {
        try {
          setProcessingIds((prev) => new Set(prev).add(transfer.id));

          const { error } = await transferService.rejectPendingTransfer(
            transfer.id,
            observaciones[transfer.id] || undefined
          );

          if (error) {
            toast.error(`Error al rechazar transferencia: ${error}`);
          } else {
            setPendingTransfers((prev) =>
              prev.filter((t) => t.id !== transfer.id)
            );
            toast.success("❌ Transferencia rechazada. Monto devuelto al punto origen.");

            // Limpiar observaciones
            setObservaciones((prev) => {
              const newObs = { ...prev };
              delete newObs[transfer.id];
              return newObs;
            });
          }
        } catch (error) {
          console.error("Error rejecting transfer:", error);
          toast.error("Error al rechazar la transferencia");
        } finally {
          setProcessingIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(transfer.id);
            return newSet;
          });
        }
      },
      "Rechazar",
      "destructive"
    );
  };

  return (
    <div className="space-y-6">
      <ConfirmationDialog />
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Transferencias Pendientes de Recibir
          </h2>
          <p className="text-muted-foreground">
            Transferencias en tránsito hacia tu punto de atención
          </p>
        </div>
        <Button
          onClick={loadPendingTransfers}
          variant="outline"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando...
            </>
          ) : (
            "Actualizar"
          )}
        </Button>
      </div>

      {isLoading && pendingTransfers.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : pendingTransfers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No hay transferencias pendientes de recibir
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Cuando otros puntos te envíen transferencias, aparecerán aquí
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingTransfers.map((transfer) => (
            <Card key={transfer.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">
                      {transfer.monto.toLocaleString()} {transfer.moneda?.simbolo || transfer.moneda?.codigo}
                    </CardTitle>
                    <CardDescription>
                      De: <strong>{transfer.origen?.nombre || "Origen no especificado"}</strong>
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-blue-600">
                    EN TRÁNSITO
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    <p className="font-medium">
                      {getTransferTypeLabel(transfer.tipo_transferencia)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fecha de envío</p>
                    <p className="font-medium">
                      {new Date(transfer.fecha).toLocaleString()}
                    </p>
                  </div>
                  {transfer.numero_recibo && (
                    <div>
                      <p className="text-muted-foreground">N° Recibo</p>
                      <p className="font-medium">{transfer.numero_recibo}</p>
                    </div>
                  )}
                  {transfer.descripcion && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Descripción</p>
                      <p className="font-medium">{transfer.descripcion}</p>
                    </div>
                  )}
                </div>

                {transfer.detalle_divisas && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-2">Detalle del efectivo:</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Billetes</p>
                        <p className="font-medium">
                          {transfer.detalle_divisas.billetes.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monedas</p>
                        <p className="font-medium">
                          {transfer.detalle_divisas.monedas.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium">
                          {transfer.detalle_divisas.total.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {transfer.responsable_movilizacion && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-2">Responsable de movilización:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Nombre</p>
                        <p className="font-medium">
                          {transfer.responsable_movilizacion.nombre}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cédula</p>
                        <p className="font-medium">
                          {transfer.responsable_movilizacion.cedula}
                        </p>
                      </div>
                      {transfer.responsable_movilizacion.telefono && (
                        <div>
                          <p className="text-muted-foreground">Teléfono</p>
                          <p className="font-medium">
                            {transfer.responsable_movilizacion.telefono}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor={`observaciones-${transfer.id}`}>
                    Observaciones (opcional)
                  </Label>
                  <Textarea
                    id={`observaciones-${transfer.id}`}
                    placeholder="Ej: Efectivo recibido completo, sin faltantes"
                    value={observaciones[transfer.id] || ""}
                    onChange={(e) =>
                      setObservaciones((prev) => ({
                        ...prev,
                        [transfer.id]: e.target.value,
                      }))
                    }
                    rows={2}
                    disabled={processingIds.has(transfer.id)}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={() => handleReject(transfer)}
                    disabled={processingIds.has(transfer.id)}
                    variant="destructive"
                  >
                    {processingIds.has(transfer.id) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Rechazar
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleAccept(transfer)}
                    disabled={processingIds.has(transfer.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {processingIds.has(transfer.id) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirmar Recepción
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransferAcceptance;
