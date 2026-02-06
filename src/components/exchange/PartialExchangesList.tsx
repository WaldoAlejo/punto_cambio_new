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

export interface PartialExchange {
  id: string;
  fecha: string; // ISO
  tipo_operacion: "COMPRA" | "VENTA";
  estado: "PENDIENTE" | "COMPLETADO" | string;

  monto_origen: number;
  monto_destino: number;

  // Tasas que devuelve el backend
  tasa_cambio_billetes: number | null;
  tasa_cambio_monedas: number | null;

  // Campo string "Nombre Apellido"
  cliente: string | null;

  // Totales y parciales
  abono_inicial_monto: number | null;
  abono_inicial_fecha: string | null; // ISO
  saldo_pendiente: number | null;

  // Relacionadas
  monedaOrigen: { id: string; nombre: string; codigo: string; simbolo: string };
  monedaDestino: {
    id: string;
    nombre: string;
    codigo: string;
    simbolo: string;
  };
  usuario?: { id: string; nombre: string | null; username: string };
  puntoAtencion?: { id: string; nombre: string };
  abonoInicialRecibidoPorUsuario?: {
    id: string;
    nombre: string | null;
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

  const getClientName = (e: PartialExchange) =>
    (e.cliente && e.cliente.trim()) || "Cliente";

  const tasaTexto = (e: PartialExchange) => {
    const tb = Number(e.tasa_cambio_billetes || 0);
    const tm = Number(e.tasa_cambio_monedas || 0);
    if (tb > 0 && tm > 0) return `B: ${tb.toFixed(4)} | M: ${tm.toFixed(4)}`;
    if (tb > 0) return `Billetes: ${tb.toFixed(4)}`;
    if (tm > 0) return `Monedas: ${tm.toFixed(4)}`;
    return "—";
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-EC", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (
    amount?: number | null,
    moneda?: { simbolo: string }
  ) => {
    const n = typeof amount === "number" ? amount : 0;
    const sym = moneda?.simbolo ?? "";
    return `${sym}${n.toFixed(2)}`;
  };

  const handleCompletePartial = async (exchange: PartialExchange) => {
    const saldo = Number(exchange.saldo_pendiente || 0);
    showConfirmation(
      "Completar Cambio Parcial",
      `¿Confirma que desea completar este cambio parcial?

Cliente: ${getClientName(exchange)}
Saldo pendiente: ${formatCurrency(saldo, exchange.monedaDestino)}

Esta acción marcará el cambio como COMPLETADO y actualizará la contabilidad.`,
      async () => {
        try {
          setCompletingId(exchange.id);

          const resp = await fetch(
            `/api/exchanges/${exchange.id}/complete-partial`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
              },
              body: JSON.stringify({
                // el backend toma el usuario del token; no es necesario enviar más campos
              }),
            }
          );

          const data = await resp.json().catch(() => ({}));
          if (!resp.ok || data?.success === false) {
            throw new Error(data?.error || "Error al completar cambio parcial");
          }

          toast.success(
            data?.message || "Cambio parcial completado exitosamente"
          );
          onCompleted(exchange.id);
          // Actualiza saldos en tiempo real (si tienes un listener)
          try {
            window.dispatchEvent(new CustomEvent("saldosUpdated"));
          } catch {
            // noop: CustomEvent may be unavailable in some runtimes
          }
        } catch (err: unknown) {
          console.error("Error completing partial exchange:", err);
          const msg =
            err instanceof Error
              ? err.message
              : typeof err === "string"
              ? err
              : "Error al completar el cambio parcial";
          toast.error(msg);
        } finally {
          setCompletingId(null);
        }
      },
      "default"
    );
  };

  if (!exchanges || exchanges.length === 0) {
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
                    {getClientName(exchange)}
                  </h3>
                  {/* Si necesitas cédula u otros datos, agrega aquí cuando el backend los incluya */}
                </div>
                <div className="text-right">
                  <Badge
                    variant="outline"
                    className="bg-yellow-50 text-yellow-700 border-yellow-200"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {exchange.estado || "Pendiente"}
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
                    Tasa: {tasaTexto(exchange)}
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
                    {formatDate(exchange.abono_inicial_fecha || undefined)}
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
                {showPointName && exchange.puntoAtencion?.nombre && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {exchange.puntoAtencion.nombre}
                  </div>
                )}
                {showUserName &&
                  (exchange.usuario?.nombre || exchange.usuario?.username) && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Operador:{" "}
                      {exchange.usuario?.nombre || exchange.usuario?.username}
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
