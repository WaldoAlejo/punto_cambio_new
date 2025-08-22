import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CurrencyDetailForm from "./CurrencyDetailForm";
import { DetalleDivisasSimple, Moneda } from "../../types";

export interface ExchangeDetailsFormProps {
  fromCurrency: Moneda | null;
  toCurrency: Moneda | null;
  fromCurrencyName: string;
  toCurrencyName: string;
  onBack: () => void;
  onComplete: () => void;
  onDivisasEntregadasChange: (data: DetalleDivisasSimple) => void;
  onDivisasRecibidasChange: (data: DetalleDivisasSimple) => void;
  divisasEntregadas: DetalleDivisasSimple;
  divisasRecibidas: DetalleDivisasSimple;

  // Métodos de entrega
  metodoEntrega: "efectivo" | "transferencia";
  onMetodoEntregaChange: (value: "efectivo" | "transferencia") => void;
  transferenciaNumero: string;
  onTransferenciaNumeroChange: (value: string) => void;
  transferenciaBanco: string;
  onTransferenciaBancoChange: (value: string) => void;
  transferenciaImagen: File | null;
  onTransferenciaImagenChange: (file: File | null) => void;

  // NUEVOS CAMPOS DE ABONO PARCIAL
  abonoInicialMonto?: number | null;
  onAbonoInicialMontoChange?: (v: number | null) => void;
  abonoInicialFecha?: string | null;
  onAbonoInicialFechaChange?: (v: string | null) => void;
  abonoInicialRecibidoPor?: string | null; // Solo lectura, el usuario logueado
  onAbonoInicialRecibidoPorChange?: (v: string | null) => void; // Opcional, no recomendado usar
  saldoPendiente?: number | null;
  onSaldoPendienteChange?: (v: number | null) => void;
  referenciaCambioPrincipal?: string | null;
  onReferenciaCambioPrincipalChange?: (v: string | null) => void;
}

const ExchangeDetailsForm = ({
  fromCurrency,
  toCurrency,
  fromCurrencyName,
  toCurrencyName,
  onBack,
  onComplete,
  onDivisasEntregadasChange,
  onDivisasRecibidasChange,
  divisasEntregadas,
  divisasRecibidas,
  metodoEntrega,
  onMetodoEntregaChange,
  transferenciaNumero,
  onTransferenciaNumeroChange,
  transferenciaBanco,
  onTransferenciaBancoChange,
  transferenciaImagen,
  onTransferenciaImagenChange,
  // Abonos parciales
  abonoInicialMonto,
  onAbonoInicialMontoChange,
  abonoInicialFecha,
  onAbonoInicialFechaChange,
  abonoInicialRecibidoPor,
  saldoPendiente,
  onSaldoPendienteChange,
  referenciaCambioPrincipal,
  onReferenciaCambioPrincipalChange,
}: ExchangeDetailsFormProps) => {
  // Validación para no dejar la pantalla en blanco
  if (!fromCurrency && !toCurrency) {
    return (
      <div className="text-center text-red-500 p-6">
        No se han encontrado monedas de origen ni destino para este cambio.
      </div>
    );
  }

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onTransferenciaImagenChange(e.target.files[0]);
    } else {
      onTransferenciaImagenChange(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Selector de método de entrega al cliente */}
      <div>
        <Label>¿Cómo se entregará el dinero al cliente?</Label>
        <div className="flex gap-4 mt-1">
          <button
            type="button"
            className={`px-4 py-2 rounded border ${
              metodoEntrega === "efectivo"
                ? "bg-green-100 border-green-400"
                : "border-gray-300"
            }`}
            onClick={() => onMetodoEntregaChange("efectivo")}
          >
            💵 Efectivo (en el punto)
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded border ${
              metodoEntrega === "transferencia"
                ? "bg-blue-100 border-blue-400"
                : "border-gray-300"
            }`}
            onClick={() => onMetodoEntregaChange("transferencia")}
          >
            🏦 Transferencia bancaria
          </button>
        </div>
      </div>

      {/* Si entrega es transferencia, pedir datos de transferencia */}
      {metodoEntrega === "transferencia" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Número de Transferencia *</Label>
            <Input
              value={transferenciaNumero}
              onChange={(e) => onTransferenciaNumeroChange(e.target.value)}
              placeholder="Ingrese número o código de transferencia"
              required={metodoEntrega === "transferencia"}
            />
          </div>
          <div className="space-y-2">
            <Label>Banco de Destino *</Label>
            <Input
              value={transferenciaBanco}
              onChange={(e) => onTransferenciaBancoChange(e.target.value)}
              placeholder="Ingrese el banco"
              required={metodoEntrega === "transferencia"}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Comprobante de Transferencia (opcional)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleImagenChange}
            />
            {transferenciaImagen && (
              <div className="text-xs text-gray-600 mt-1">
                Archivo seleccionado: {transferenciaImagen.name}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Divisas que el CLIENTE ENTREGA al operador */}
      {metodoEntrega === "efectivo" && fromCurrency && (
        <CurrencyDetailForm
          currency={fromCurrency}
          title={`💰 Divisas que el Cliente Entrega (${fromCurrencyName})`}
          onDetailData={onDivisasEntregadasChange}
          initialData={divisasEntregadas}
        />
      )}

      {/* Divisas que el OPERADOR ENTREGA al cliente */}
      {toCurrency && (
        <CurrencyDetailForm
          currency={toCurrency}
          title={`💵 Divisas que el Operador Entrega al Cliente (${toCurrencyName})`}
          onDetailData={onDivisasRecibidasChange}
          initialData={divisasRecibidas}
        />
      )}

      {/* === CHECKBOX PARA ACTIVAR CAMBIO PARCIAL === */}
      <div className="border rounded-xl p-3 space-y-3 bg-blue-50">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="cambio-parcial"
            checked={abonoInicialMonto !== null || saldoPendiente !== null}
            onChange={(e) => {
              if (e.target.checked) {
                // Activar modo parcial
                onAbonoInicialMontoChange?.(0);
                onSaldoPendienteChange?.(0);
                onAbonoInicialFechaChange?.(
                  new Date().toISOString().split("T")[0]
                );
              } else {
                // Desactivar modo parcial
                onAbonoInicialMontoChange?.(null);
                onSaldoPendienteChange?.(null);
                onAbonoInicialFechaChange?.(null);
                onReferenciaCambioPrincipalChange?.(null);
              }
            }}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <Label
            htmlFor="cambio-parcial"
            className="font-semibold text-blue-700 cursor-pointer"
          >
            ✅ Activar cambio parcial (con abono inicial)
          </Label>
        </div>
        <p className="text-sm text-blue-600">
          Active esta opción cuando el cliente haga un abono inicial y quede con
          saldo pendiente para completar más tarde.
        </p>
      </div>

      {/* === CAMPOS PARA ABONO PARCIAL === */}
      {(abonoInicialMonto !== null || saldoPendiente !== null) && (
        <div className="border rounded-xl p-3 space-y-2 bg-yellow-50">
          <Label className="font-semibold">
            📋 Detalles del cambio parcial
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {onAbonoInicialMontoChange && (
              <div>
                <Label>Monto del abono inicial</Label>
                <Input
                  type="number"
                  value={abonoInicialMonto ?? ""}
                  min={0}
                  step="0.01"
                  placeholder="Ingrese abono inicial"
                  onChange={(e) =>
                    onAbonoInicialMontoChange(
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                />
              </div>
            )}
            {onAbonoInicialFechaChange && (
              <div>
                <Label>Fecha de abono inicial</Label>
                <Input
                  type="date"
                  value={abonoInicialFecha ?? ""}
                  onChange={(e) =>
                    onAbonoInicialFechaChange(
                      e.target.value ? e.target.value : null
                    )
                  }
                />
              </div>
            )}
            {abonoInicialRecibidoPor !== undefined && (
              <div>
                <Label>Recibido por (usuario)</Label>
                <Input
                  type="text"
                  value={abonoInicialRecibidoPor ?? ""}
                  readOnly
                />
              </div>
            )}
            {onSaldoPendienteChange && (
              <div>
                <Label>Saldo pendiente</Label>
                <Input
                  type="number"
                  value={saldoPendiente ?? ""}
                  min={0}
                  step="0.01"
                  placeholder="Ingrese saldo pendiente"
                  onChange={(e) =>
                    onSaldoPendienteChange(
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                />
              </div>
            )}
            {onReferenciaCambioPrincipalChange && (
              <div className="md:col-span-2">
                <Label>Referencia de cambio principal</Label>
                <Input
                  type="text"
                  value={referenciaCambioPrincipal ?? ""}
                  onChange={(e) =>
                    onReferenciaCambioPrincipalChange(
                      e.target.value ? e.target.value : null
                    )
                  }
                  placeholder="Referencia transacción principal (opcional)"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botones de navegación */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button
          onClick={onComplete}
          className="flex-1"
          disabled={
            !fromCurrency ||
            !toCurrency ||
            (metodoEntrega === "transferencia" &&
              (transferenciaNumero.trim() === "" ||
                transferenciaBanco.trim() === "")) ||
            (abonoInicialMonto !== undefined &&
              abonoInicialMonto !== null &&
              abonoInicialMonto < 0)
          }
        >
          Completar Cambio
        </Button>
      </div>
    </div>
  );
};

export default ExchangeDetailsForm;
