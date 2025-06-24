
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
  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    return currency ? currency.codigo : "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambios Recientes</CardTitle>
        <CardDescription>Últimas operaciones realizadas</CardDescription>
      </CardHeader>
      <CardContent>
        {exchanges.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay cambios registrados
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {exchanges.map((exchange) => (
              <div key={exchange.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      exchange.tipo_operacion === "COMPRA"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {exchange.tipo_operacion}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(exchange.fecha).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-medium">
                    {exchange.datos_cliente?.nombre}{" "}
                    {exchange.datos_cliente?.apellido}
                  </p>
                  <p>
                    {exchange.monto_origen}{" "}
                    {getCurrencyName(exchange.moneda_origen_id)} →{" "}
                    {exchange.monto_destino.toFixed(2)}{" "}
                    {getCurrencyName(exchange.moneda_destino_id)}
                  </p>
                  <p className="text-gray-600">
                    Tasa: {exchange.tasa_cambio}
                  </p>
                  {exchange.numero_recibo && (
                    <p className="text-gray-600 text-xs">
                      Recibo: {exchange.numero_recibo}
                    </p>
                  )}
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
