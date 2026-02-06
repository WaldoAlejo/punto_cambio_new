import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { exchangeService } from "@/services/exchangeService";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CambioDivisa, Moneda } from "../../types";

type CambioDivisaView = CambioDivisa & {
  cliente?: string | null;
  datos_cliente?: {
    nombre?: string | null;
    apellido?: string | null;
  } | null;
  tasa_cambio_billetes?: number | string | null;
  tasa_cambio_monedas?: number | string | null;
  puntoAtencion?: { nombre?: string | null } | null;
  usuario?: { nombre?: string | null } | null;
};

interface ExchangeListProps {
  exchanges: CambioDivisa[];
  currencies: Moneda[];
  onReprintReceipt?: (exchange: CambioDivisa) => void;
  onDeleted?: (id: string) => void;
  showPointName?: boolean;
  showUserName?: boolean;
}

const ExchangeList = ({
  exchanges,
  currencies,
  onReprintReceipt,
  onDeleted,
  showPointName = false,
  showUserName = false,
}: ExchangeListProps) => {
  const { user } = useAuth();
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();

  const canDelete = user?.rol === "ADMIN" || user?.rol === "SUPER_USUARIO";

  if (!exchanges || !currencies) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cambios Recientes</CardTitle>
          <CardDescription>Últimas operaciones realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            Error: No se pudo cargar la información.
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCurrencyCode = (currencyId: string) => {
    const c = currencies.find((m) => m.id === currencyId);
    return c ? c.codigo : "—";
  };

  const formatMonto = (valor: number | string | null | undefined): string => {
    const num =
      typeof valor === "number"
        ? valor
        : valor !== null && valor !== undefined
        ? Number(valor)
        : NaN;
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  // Acepta Date | string | number | null | undefined
  const formatFecha = (value?: unknown) => {
    if (value == null) return "Sin fecha";
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) return "Sin fecha";
    return d.toLocaleString();
  };

  const getClienteNombre = (ex: CambioDivisa): string => {
    // En /exchanges (GET) viene `cliente` (string). En la creación puede venir `datos_cliente`.
    const view = ex as unknown as CambioDivisaView;
    const nombreFromDatos =
      view.datos_cliente &&
      [
        view.datos_cliente?.nombre || "",
        view.datos_cliente?.apellido || "",
      ]
        .filter(Boolean)
        .join(" ");
    return view.cliente || nombreFromDatos || "Cliente";
  };

  const getTasaTexto = (ex: CambioDivisa): string => {
    const view = ex as unknown as CambioDivisaView;
    const tb = Number(view.tasa_cambio_billetes || 0);
    const tm = Number(view.tasa_cambio_monedas || 0);
    if (tb > 0 && tm > 0) return `B: ${tb} | M: ${tm}`;
    if (tb > 0) return `Billetes: ${tb}`;
    if (tm > 0) return `Monedas: ${tm}`;
    return "—";
  };

  const getEstadoPill = (estado?: string) => {
    const base =
      "px-2 py-0.5 rounded text-xs font-medium border inline-flex items-center";
    if (estado === "COMPLETADO") {
      return `${base} bg-green-50 text-green-700 border-green-200`;
    }
    if (estado === "PENDIENTE") {
      return `${base} bg-yellow-50 text-yellow-700 border-yellow-200`;
    }
    return `${base} bg-gray-50 text-gray-700 border-gray-200`;
  };

  const handleDelete = (id: string) => {
    if (!canDelete) return;
    showConfirmation(
      "Eliminar cambio",
      "¿Eliminar este cambio? Esto revertirá saldos con un ajuste.",
      async () => {
        const { success, error } = await exchangeService.deleteExchange(id);
        if (success) {
          onDeleted?.(id);
          try {
            window.dispatchEvent(new CustomEvent("saldosUpdated"));
          } catch {
            // noop: CustomEvent may be unavailable in some runtimes
          }
          toast.success("Cambio eliminado correctamente");
        } else {
          toast.error(error || "No se pudo eliminar");
        }
      },
      "destructive"
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">💱 Cambios Recientes</CardTitle>
        <CardDescription className="text-sm">
          Últimas operaciones de cambio de divisas realizadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {exchanges.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No hay cambios registrados
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {exchanges.map((exchange) => {
              const view = exchange as unknown as CambioDivisaView;

              return (
                <div
                  key={exchange.id}
                  className="border rounded-lg p-3 bg-muted/20"
                >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        exchange.tipo_operacion === "COMPRA"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                      title="Tipo de operación"
                    >
                      {exchange.tipo_operacion}
                    </span>
                    <span
                      className={getEstadoPill(exchange.estado)}
                      title="Estado"
                    >
                      {exchange.estado || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatFecha(exchange.fecha)}
                    </span>
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(exchange.id)}
                        title="Eliminar cambio"
                        aria-label="Eliminar cambio"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <p className="font-medium text-sm">
                    {getClienteNombre(exchange)}
                  </p>

                  <p className="text-muted-foreground">
                    Cliente entregó: {formatMonto(exchange.monto_origen)}{" "}
                    {getCurrencyCode(exchange.moneda_origen_id)}
                  </p>

                  <p className="text-muted-foreground">
                    Cliente recibió: {formatMonto(exchange.monto_destino)}{" "}
                    {getCurrencyCode(exchange.moneda_destino_id)}
                  </p>

                  <div className="flex justify-between items-center pt-1">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>Tasa: {getTasaTexto(exchange)}</span>
                      {showPointName && view.puntoAtencion?.nombre && (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                            Punto: {view.puntoAtencion.nombre}
                          </span>
                        )}
                      {showUserName && view.usuario?.nombre && (
                        <span className="inline-flex items-center text-xs px-2 py-0.5 bg-slate-50 text-slate-700 rounded border border-slate-200">
                          Operador: {view.usuario.nombre}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {exchange.numero_recibo ? (
                        <span className="text-muted-foreground">
                          #{exchange.numero_recibo}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">#—</span>
                      )}
                      {onReprintReceipt && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReprintReceipt(exchange)}
                          className="h-6 px-2 text-xs"
                          title="Reimprimir recibo"
                          aria-label="Reimprimir recibo"
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <ConfirmationDialog />
    </Card>
  );
};

export default ExchangeList;
