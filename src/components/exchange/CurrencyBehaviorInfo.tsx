import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Moneda } from "../../types";
import { obtenerDescripcionComportamiento } from "../../utils/currencyCalculations";

interface CurrencyBehaviorInfoProps {
  monedaOrigen?: Moneda;
  monedaDestino?: Moneda;
  tipoOperacion: "COMPRA" | "VENTA";
}

type ModoCalculo = "MULTIPLICA" | "DIVIDE";

/**
 * Normaliza el modo de cálculo y da un fallback seguro.
 */
const normalizarComportamiento = (valor?: string | null): ModoCalculo => {
  if (valor === "DIVIDE") return "DIVIDE";
  return "MULTIPLICA"; // fallback por defecto
};

const CurrencyBehaviorInfo = ({
  monedaOrigen,
  monedaDestino,
  tipoOperacion,
}: CurrencyBehaviorInfoProps) => {
  // Si falta alguna moneda, no mostramos nada (evita parpadeos/errores)
  if (!monedaOrigen || !monedaDestino) return null;

  // Determina moneda que controla el cálculo según tipo de operación
  const monedaControladora =
    tipoOperacion === "COMPRA" ? monedaOrigen : monedaDestino;

  // Obtiene el comportamiento correcto (compra sobre origen, venta sobre destino)
  const comportamientoRaw =
    tipoOperacion === "COMPRA"
      ? monedaOrigen.comportamiento_compra
      : monedaDestino.comportamiento_venta;

  const comportamiento = normalizarComportamiento(comportamientoRaw);

  const operacionTexto = tipoOperacion === "COMPRA" ? "comprar" : "vender";
  const accionTexto = comportamiento === "MULTIPLICA" ? "multiplica" : "divide";

  const codigoControladora =
    monedaControladora.codigo || monedaControladora.nombre || "—";

  return (
    <Alert className="bg-blue-50 border-blue-200">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-sm text-blue-800">
        <strong>Comportamiento de cálculo:</strong> Al {operacionTexto}{" "}
        {codigoControladora} se <strong>{accionTexto}</strong> por la tasa de
        cambio.
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
