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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, CambioDivisa } from "../../types";
import { exchangeService } from "../../services/exchangeService";
import { ReceiptService } from "../../services/receiptService";

interface PendingExchangesListProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface PartialPaymentData {
  initialPayment: number;
  pendingBalance: number;
  receivedBy: string;
  observations: string;
}

const PendingExchangesList = ({
  user,
  selectedPoint,
}: PendingExchangesListProps) => {
  const [pendingExchanges, setPendingExchanges] = useState<CambioDivisa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState<CambioDivisa | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [partialPayment, setPartialPayment] = useState<PartialPaymentData>({
    initialPayment: 0,
    pendingBalance: 0,
    receivedBy: user?.nombre || "",
    observations: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadPendingExchanges();
  }, [selectedPoint]);

  const loadPendingExchanges = async () => {
    if (!selectedPoint) return;
    
    setIsLoading(true);
    try {
      const { exchanges, error } = await exchangeService.getPendingExchangesByPoint(selectedPoint.id);
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
        return;
      }
      setPendingExchanges(exchanges || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar cambios pendientes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePartialPayment = (exchange: CambioDivisa) => {
    setSelectedExchange(exchange);
    setPartialPayment({
      initialPayment: 0,
      pendingBalance: exchange.monto_destino,
      receivedBy: user?.nombre || "",
      observations: "",
    });
    setIsDialogOpen(true);
  };

  const updatePendingBalance = (payment: number) => {
    if (selectedExchange) {
      const pending = selectedExchange.monto_destino - payment;
      setPartialPayment(prev => ({
        ...prev,
        pendingBalance: pending > 0 ? pending : 0,
      }));
    }
  };

  const handleSubmitPartialPayment = async () => {
    if (!selectedExchange || !partialPayment.initialPayment || partialPayment.initialPayment <= 0) {
      toast({
        title: "Error",
        description: "Debe ingresar un abono válido",
        variant: "destructive",
      });
      return;
    }

    if (partialPayment.initialPayment >= selectedExchange.monto_destino) {
      toast({
        title: "Error",
        description: "El abono no puede ser mayor o igual al monto total",
        variant: "destructive",
      });
      return;
    }

    if (!partialPayment.receivedBy.trim()) {
      toast({
        title: "Error",
        description: "Debe especificar quién recibe el abono",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Generar e imprimir recibo del abono parcial
      const receiptData = ReceiptService.generatePartialExchangeReceipt(
        selectedExchange,
        selectedPoint?.nombre || "N/A",
        user.nombre,
        true
      );

      try {
        ReceiptService.printReceipt(receiptData, 2);
      } catch (printError) {
        console.warn("Error al imprimir recibo:", printError);
      }

      toast({
        title: "Abono registrado",
        description: `Abono de ${partialPayment.initialPayment} registrado exitosamente`,
      });

      setIsDialogOpen(false);
      await loadPendingExchanges();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar el abono parcial",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const completeExchange = async (exchange: CambioDivisa) => {
    try {
      const { error } = await exchangeService.closePendingExchange(exchange.id);

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Cambio completado",
        description: "El cambio de divisa ha sido completado",
      });

      await loadPendingExchanges();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al completar el cambio",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando cambios pendientes...</div>
        </CardContent>
      </Card>
    );
  }

  if (pendingExchanges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cambios Pendientes</CardTitle>
          <CardDescription>No hay cambios parciales pendientes</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Cambios Pendientes</CardTitle>
          <CardDescription>
            {pendingExchanges.length} cambio(s) con pagos pendientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingExchanges.map((exchange) => (
              <div key={exchange.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">
                      Cliente: {exchange.datos_cliente?.nombre} {exchange.datos_cliente?.apellido}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Documento: {exchange.datos_cliente?.documento}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                    {exchange.estado}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <strong>Cambio:</strong> {exchange.monto_origen} {exchange.monedaOrigen?.codigo} 
                    → {exchange.monto_destino} {exchange.monedaDestino?.codigo}
                  </div>
                  <div>
                    <strong>Recibo:</strong> {exchange.numero_recibo}
                  </div>
                  <div>
                    <strong>Fecha:</strong> {new Date(exchange.fecha).toLocaleDateString("es-ES")}
                  </div>
                  <div>
                    <strong>Saldo Pendiente:</strong> {exchange.monto_destino} {exchange.monedaDestino?.codigo}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handlePartialPayment(exchange)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Registrar Abono
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => completeExchange(exchange)}
                    className="border-green-300 text-green-700 hover:bg-green-50"
                  >
                    Completar Pago
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Abono Parcial</DialogTitle>
          </DialogHeader>
          {selectedExchange && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <p><strong>Cliente:</strong> {selectedExchange.datos_cliente?.nombre} {selectedExchange.datos_cliente?.apellido}</p>
                <p><strong>Monto Total:</strong> {selectedExchange.monto_destino} {selectedExchange.monedaDestino?.codigo}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialPayment">Abono Inicial *</Label>
                <Input
                  id="initialPayment"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedExchange.monto_destino - 0.01}
                  value={partialPayment.initialPayment}
                  onChange={(e) => {
                    const payment = parseFloat(e.target.value) || 0;
                    setPartialPayment(prev => ({ ...prev, initialPayment: payment }));
                    updatePendingBalance(payment);
                  }}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receivedBy">Recibido por *</Label>
                <Input
                  id="receivedBy"
                  value={partialPayment.receivedBy}
                  onChange={(e) => setPartialPayment(prev => ({ ...prev, receivedBy: e.target.value }))}
                  placeholder="Nombre del responsable"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm">
                  <strong>Saldo Pendiente:</strong> {partialPayment.pendingBalance.toFixed(2)} {selectedExchange.monedaDestino?.codigo}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Observaciones</Label>
                <Textarea
                  id="observations"
                  value={partialPayment.observations}
                  onChange={(e) => setPartialPayment(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitPartialPayment}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? "Procesando..." : "Registrar Abono"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendingExchangesList;