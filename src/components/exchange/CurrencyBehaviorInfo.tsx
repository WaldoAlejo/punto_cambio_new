import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Moneda } from "../../types";
import { obtenerDescripcionComportamiento } from "../../utils/currencyCalculations";

interface CurrencyBehaviorInfoProps {
  monedaOrigen?: Moneda;
  monedaDestino?: Moneda;
  tipoOperacion: "COMPRA" | "VENTA";
}

const CurrencyBehaviorInfo = ({
  monedaOrigen,
  monedaDestino,
  tipoOperacion,
}: CurrencyBehaviorInfoProps) => {
  if (!monedaOrigen || !monedaDestino) {
    return null;
  }

  // Determinar qué divisa controla el comportamiento
  const monedaControladora =
    tipoOperacion === "COMPRA" ? monedaOrigen : monedaDestino;
  const comportamiento =
    tipoOperacion === "COMPRA"
      ? monedaOrigen.comportamiento_compra
      : monedaDestino.comportamiento_venta;

  const operacionTexto = tipoOperacion === "COMPRA" ? "comprar" : "vender";
  const accionTexto = comportamiento === "MULTIPLICA" ? "multiplica" : "divide";

  return (
    <Alert className="bg-blue-50 border-blue-200">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-sm text-blue-800">
        <strong>Comportamiento de cálculo:</strong> Al {operacionTexto}{" "}
        {monedaControladora.codigo} se {accionTexto} por la tasa de cambio.
        <br />
        <span className="text-xs text-blue-600 mt-1 block">
          {obtenerDescripcionComportamiento(monedaOrigen)} |{" "}
          {obtenerDescripcionComportamiento(monedaDestino)}
        </span>
      </AlertDescription>
    </Alert>
  );
};

export default CurrencyBehaviorInfo;
