import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CambioDivisa, Moneda } from "../../types";

interface ExchangeListProps {
  exchanges: CambioDivisa[];
  currencies: Moneda[];
}

const ExchangeList = ({ exchanges, currencies }: ExchangeListProps) => {
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

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    return currency ? currency.codigo : "??";
  };

  // Tipado correcto y robusto
  const formatMonto = (valor: number | string | null | undefined): string => {
    const num = typeof valor === "number" ? valor : Number(valor);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Cambios Recientes</CardTitle>
        <CardDescription className="text-sm">
          Últimas operaciones realizadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {exchanges.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No hay cambios registrados
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {exchanges.map((exchange) => (
              <div
                key={exchange.id}
                className="border rounded-lg p-3 bg-muted/20"
              >
                <div className="flex justify-between items-start mb-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      exchange.tipo_operacion === "COMPRA"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {exchange.tipo_operacion}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {exchange.fecha
                      ? new Date(exchange.fecha).toLocaleDateString()
                      : "Sin fecha"}
                  </span>
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-medium text-sm">
                    {exchange.datos_cliente?.nombre || ""}{" "}
                    {exchange.datos_cliente?.apellido || ""}
                  </p>
                  <p className="text-muted-foreground">
                    {formatMonto(exchange.monto_origen)}{" "}
                    {getCurrencyName(exchange.moneda_origen_id)} →{" "}
                    {formatMonto(exchange.monto_destino)}{" "}
                    {getCurrencyName(exchange.moneda_destino_id)}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Tasa: {exchange.tasa_cambio}
                    </span>
                    {exchange.numero_recibo && (
                      <span className="text-muted-foreground">
                        #{exchange.numero_recibo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExchangeList;
