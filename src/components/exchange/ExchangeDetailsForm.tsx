import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CurrencyDetailForm from "./CurrencyDetailForm";
import { DetalleDivisasSimple, Moneda } from "../../types";
import { ExchangeFormData } from "./ExchangeForm";

export interface ExchangeDetailsFormProps {
  fromCurrency: Moneda | null;
  toCurrency: Moneda | null;
  fromCurrencyName: string;
  toCurrencyName: string;
  exchangeData: ExchangeFormData; // Datos del formulario de cambio (origen)
  onBack: () => void;
  onComplete: () => void;

  // Detalle de lo que el OPERADOR entrega al cliente (destino)
  onDivisasRecibidasChange: (data: DetalleDivisasSimple) => void;
  divisasRecibidas: DetalleDivisasSimple;

  // Método de entrega al cliente (DESTINO)
  metodoEntrega: "efectivo" | "transferencia";
  onMetodoEntregaChange: (value: "efectivo" | "transferencia") => void;
  transferenciaNumero: string;
  onTransferenciaNumeroChange: (value: string) => void;
  transferenciaBanco: string;
  onTransferenciaBancoChange: (value: string) => void;
  transferenciaImagen: File | null;
  onTransferenciaImagenChange: (file: File | null) => void;

  // Abono parcial (opcionales)
  abonoInicialMonto?: number | null;
  onAbonoInicialMontoChange?: (v: number | null) => void;
  abonoInicialFecha?: string | null;
  onAbonoInicialFechaChange?: (v: string | null) => void;
  abonoInicialRecibidoPor?: string | null; // Solo lectura (usuario logueado)
  onAbonoInicialRecibidoPorChange?: (v: string | null) => void;
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
  exchangeData,
  onBack,
  onComplete,
  onDivisasRecibidasChange,
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
  // Si no hay ninguna moneda, mostrar mensaje claro
  if (!fromCurrency && !toCurrency) {
    return (
      <div className="text-center text-red-500 p-6">
        No se han encontrado monedas de origen ni destino para este cambio.
      </div>
    );
  }

  // Totales y helpers numéricos
  const toFixed2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "0.00");
  const parseSafe = (v?: string | number | null) => {
    if (typeof v === "number") return v;
    const n = parseFloat(String(v ?? "0"));
    return Number.isFinite(n) ? n : 0;
  };
  const fmtRate = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n.toFixed(4) : "-";
  };

  // Total que el operador entrega al cliente (DESTINO)
  const totalDestino = useMemo(() => {
    // `divisasRecibidas.total` debería venir consolidado desde CurrencyDetailForm,
    // pero calculamos a prueba de balas por si viene des-sincronizado.
    const billetes = parseSafe((divisasRecibidas as any)?.billetes);
    const monedas = parseSafe((divisasRecibidas as any)?.monedas);
    const total = parseSafe((divisasRecibidas as any)?.total);
    const recompute = billetes + monedas;
    // Si total no cuadra, preferimos recomputar
    return Number.isFinite(total) && Math.abs(total - recompute) < 0.005
      ? total
      : recompute;
  }, [divisasRecibidas]);

  // Total que el cliente entrega al operador (ORIGEN)
  const totalOrigen = useMemo(() => {
    const billetes = parseSafe(exchangeData?.amountBilletes);
    const monedas = parseSafe(exchangeData?.amountMonedas);
    const total = parseSafe(exchangeData?.totalAmountEntregado);
    const recompute = billetes + monedas;
    return Number.isFinite(total) && Math.abs(total - recompute) < 0.005
      ? total
      : recompute;
  }, [exchangeData]);

  // Limpiar campos de transferencia si se cambia a efectivo (evita “faltan datos” por valores residuales)
  useEffect(() => {
    if (metodoEntrega === "efectivo") {
      onTransferenciaNumeroChange("");
      onTransferenciaBancoChange("");
      onTransferenciaImagenChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodoEntrega]);

  // Cambio parcial activado si han tocado abono/saldo
  const cambioParcialActivado =
    abonoInicialMonto != null || saldoPendiente != null;

  // Autocalcular saldo pendiente = totalDestino - abonoInicialMonto (nunca negativo)
  useEffect(() => {
    if (!cambioParcialActivado) return;
    if (!onSaldoPendienteChange) return;

    const abono = parseSafe(abonoInicialMonto);
    const pendienteCalc = Math.max(
      0,
      Number((totalDestino - abono).toFixed(2))
    );
    onSaldoPendienteChange(pendienteCalc);
  }, [
    cambioParcialActivado,
    abonoInicialMonto,
    totalDestino,
    onSaldoPendienteChange,
  ]);

  // Validaciones UI
  const transferenciaInvalida =
    metodoEntrega === "transferencia" &&
    (transferenciaNumero.trim() === "" || transferenciaBanco.trim() === "");

  const abonoInvalido =
    cambioParcialActivado &&
    (abonoInicialMonto == null ||
      !Number.isFinite(Number(abonoInicialMonto)) ||
      Number(abonoInicialMonto) <= 0 ||
      Number(abonoInicialMonto) >= Number(totalDestino));

  const botonDisabled =
    !fromCurrency || !toCurrency || transferenciaInvalida || abonoInvalido;

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
        {metodoEntrega === "transferencia" && (
          <p className="text-xs text-blue-600 mt-2">
            Nota: Las transferencias del operador al cliente{" "}
            <span className="font-semibold">no afectan el stock físico</span>.
          </p>
        )}
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

      {/* Resumen de divisas que el CLIENTE ENTREGA al operador (ORIGEN) */}
      {fromCurrency && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="font-semibold mb-3">
            💰 Divisas que el Cliente Entrega ({fromCurrencyName})
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">💴 Billetes:</span>
              <div className="font-bold text-blue-700">
                {toFixed2(parseSafe(exchangeData.amountBilletes))}
              </div>
            </div>
            <div>
              <span className="text-gray-600">🪙 Monedas:</span>
              <div className="font-bold text-blue-700">
                {toFixed2(parseSafe(exchangeData.amountMonedas))}
              </div>
            </div>
            <div>
              <span className="text-gray-600">💰 Total:</span>
              <div className="font-bold text-blue-700">
                {toFixed2(totalOrigen)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            <div>Tasa billetes: {fmtRate(exchangeData.rateBilletes)}</div>
            <div>Tasa monedas: {fmtRate(exchangeData.rateMonedas)}</div>
          </div>
        </div>
      )}

      {/* Divisas que el OPERADOR ENTREGA al cliente (DESTINO) */}
      {toCurrency && (
        <CurrencyDetailForm
          currency={toCurrency}
          title={`💵 Divisas que el Operador Entrega al Cliente (${toCurrencyName})`}
          onDetailData={onDivisasRecibidasChange}
          initialData={divisasRecibidas}
        />
      )}

      {/* Resumen total destino / helper para parciales */}
      {toCurrency && (
        <div className="rounded-lg border p-3 bg-gray-50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total a entregar al cliente:</span>
            <span className="font-semibold">
              {toCurrency?.simbolo} {toFixed2(totalDestino)}
            </span>
          </div>
        </div>
      )}

      {/* Activar cambio parcial */}
      <div className="border rounded-xl p-3 space-y-3 bg-blue-50">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="cambio-parcial"
            checked={cambioParcialActivado}
            onChange={(e) => {
              if (e.target.checked) {
                onAbonoInicialMontoChange?.(0);
                onSaldoPendienteChange?.(0);
                onAbonoInicialFechaChange?.(
                  new Date().toISOString().split("T")[0]
                );
              } else {
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
          Use esta opción cuando el cliente hace un abono inicial y queda un
          saldo pendiente para completar más tarde. (Regla: el abono debe ser{" "}
          <span className="font-semibold">&gt; 0</span> y{" "}
          <span className="font-semibold">&lt; total a entregar</span>).
        </p>
      </div>

      {/* Campos para abono parcial */}
      {cambioParcialActivado && (
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
                  value={
                    abonoInicialMonto == null || Number.isNaN(abonoInicialMonto)
                      ? ""
                      : abonoInicialMonto
                  }
                  min={0}
                  step="0.01"
                  placeholder="Ingrese abono inicial"
                  onChange={(e) =>
                    onAbonoInicialMontoChange(
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                />
                {abonoInvalido && (
                  <p className="text-xs text-red-600 mt-1">
                    El abono debe ser mayor a 0 y menor que el total a entregar
                    ({toCurrency?.simbolo} {toFixed2(totalDestino)}).
                  </p>
                )}
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
                  placeholder="Se auto-completará con el usuario actual"
                  className="bg-gray-100"
                />
              </div>
            )}
            {onSaldoPendienteChange && (
              <div>
                <Label>Saldo pendiente</Label>
                <Input
                  type="number"
                  value={
                    saldoPendiente == null || Number.isNaN(saldoPendiente)
                      ? ""
                      : saldoPendiente
                  }
                  min={0}
                  step="0.01"
                  readOnly
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Se calcula automáticamente: Total a entregar - Abono inicial ={" "}
                  {toCurrency?.simbolo}{" "}
                  {toFixed2(
                    Math.max(0, totalDestino - parseSafe(abonoInicialMonto))
                  )}
                </p>
              </div>
            )}
            {onReferenciaCambioPrincipalChange && (
              <div className="md:col-span-2">
                <Label>Referencia de cambio principal (opcional)</Label>
                <Input
                  type="text"
                  value={referenciaCambioPrincipal ?? ""}
                  onChange={(e) =>
                    onReferenciaCambioPrincipalChange(
                      e.target.value ? e.target.value : null
                    )
                  }
                  placeholder="Referencia transacción principal"
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
          disabled={botonDisabled}
        >
          Completar Cambio
        </Button>
      </div>
    </div>
  );
};

export default ExchangeDetailsForm;
