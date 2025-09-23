import { useState } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  CheckCircle,
  Clock,
  User,
  MapPin,
  Calendar,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirmationDialog } from "../../hooks/useConfirmationDialog";

interface PartialExchange {
  id: string;
  fecha: string;
  cliente_nombre: string;
  cliente_apellido: string;
  cliente_cedula: string;
  monto_origen: number;
  monto_destino: number;
  tasa_cambio: number;
  abono_inicial_monto: number;
  abono_inicial_fecha: string;
  saldo_pendiente: number;
  monedaOrigen: {
    id: string;
    codigo: string;
    simbolo: string;
  };
  monedaDestino: {
    id: string;
    codigo: string;
    simbolo: string;
  };
  usuario: {
    id: string;
    nombre: string;
    username: string;
  };
  puntoAtencion: {
    id: string;
    nombre: string;
  };
  abonoInicialRecibidoPorUsuario?: {
    id: string;
    nombre: string;
    username: string;
  };
}

interface PartialExchangesListProps {
  exchanges: PartialExchange[];
  onCompleted: (id: string) => void;
  showPointName?: boolean;
  showUserName?: boolean;
}

const PartialExchangesList = ({
  exchanges,
  onCompleted,
  showPointName = false,
  showUserName = false,
}: PartialExchangesListProps) => {
  const [completingId, setCompletingId] = useState<string | null>(null);
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();

  const handleCompletePartial = async (exchange: PartialExchange) => {
    showConfirmation(
      "Completar Cambio Parcial",
      `¿Confirma que desea completar este cambio parcial?
      
Cliente: ${exchange.cliente_nombre} ${exchange.cliente_apellido}
Saldo pendiente: ${
        exchange.monedaDestino.simbolo
      }${exchange.saldo_pendiente.toFixed(2)}

Esta acción marcará el cambio como completado y actualizará la contabilidad.`,
      async () => {
        try {
          setCompletingId(exchange.id);

          const response = await fetch(
            `/api/exchanges/${exchange.id}/complete-partial`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
              body: JSON.stringify({
                completado_por_usuario_id: null, // Se usará el usuario actual del token
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error || "Error al completar cambio parcial"
            );
          }

          const data = await response.json();

          if (data.success) {
            toast.success(
              data.message || "Cambio parcial completado exitosamente"
            );
            onCompleted(exchange.id);

            // Disparar evento para actualizar saldos
            window.dispatchEvent(new CustomEvent("saldosUpdated"));
          } else {
            throw new Error(data.error || "Error desconocido");
          }
        } catch (error: any) {
          console.error("Error completing partial exchange:", error);
          toast.error(error.message || "Error al completar el cambio parcial");
        } finally {
          setCompletingId(null);
        }
      },
      "default"
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-EC", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number, currency: { simbolo: string }) => {
    return `${currency.simbolo}${amount.toFixed(2)}`;
  };

  if (exchanges.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">
          No hay cambios parciales pendientes
        </p>
        <p className="text-sm">
          Los cambios con saldo pendiente aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {exchanges.map((exchange) => (
        <div
          key={exchange.id}
          className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              {/* Header con cliente y fecha */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">
                    {exchange.cliente_nombre} {exchange.cliente_apellido}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Cédula: {exchange.cliente_cedula}
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant="outline"
                    className="bg-yellow-50 text-yellow-700 border-yellow-200"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Pendiente
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {formatDate(exchange.fecha)}
                  </p>
                </div>
              </div>

              {/* Información del cambio */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Cambio Original
                  </p>
                  <p className="font-medium">
                    {formatCurrency(
                      exchange.monto_origen,
                      exchange.monedaOrigen
                    )}{" "}
                    →{" "}
                    {formatCurrency(
                      exchange.monto_destino,
                      exchange.monedaDestino
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tasa: {exchange.tasa_cambio.toFixed(4)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Abono Inicial</p>
                  <p className="font-medium text-green-600">
                    {formatCurrency(
                      exchange.abono_inicial_monto,
                      exchange.monedaDestino
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(exchange.abono_inicial_fecha)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Saldo Pendiente
                  </p>
                  <p className="font-bold text-lg text-orange-600">
                    <DollarSign className="h-4 w-4 inline mr-1" />
                    {formatCurrency(
                      exchange.saldo_pendiente,
                      exchange.monedaDestino
                    )}
                  </p>
                </div>
              </div>

              {/* Información adicional */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {showPointName && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {exchange.puntoAtencion.nombre}
                  </div>
                )}
                {showUserName && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Operador:{" "}
                    {exchange.usuario.nombre || exchange.usuario.username}
                  </div>
                )}
                {exchange.abonoInicialRecibidoPorUsuario && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Recibido por:{" "}
                    {exchange.abonoInicialRecibidoPorUsuario.nombre ||
                      exchange.abonoInicialRecibidoPorUsuario.username}
                  </div>
                )}
              </div>
            </div>

            {/* Botón de acción */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => handleCompletePartial(exchange)}
                disabled={completingId === exchange.id}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {completingId === exchange.id ? "Completando..." : "Completar"}
              </Button>
            </div>
          </div>
        </div>
      ))}

      <ConfirmationDialog />
    </div>
  );
};

export default PartialExchangesList;
