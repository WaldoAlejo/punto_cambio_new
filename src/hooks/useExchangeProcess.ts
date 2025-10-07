import { useState } from "react";
import { toast } from "sonner";
import { User, PuntoAtencion, CambioDivisa, DatosCliente } from "../types";
import { exchangeService } from "../services/exchangeService";
import { ReceiptService } from "../services/receiptService";
import { ExchangeCompleteData } from "../components/exchange/ExchangeSteps";
import { movimientosContablesService } from "../services/movimientosContablesService";

interface UseExchangeProcessProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onExchangeCreated: (exchange: CambioDivisa) => void;
  onResetForm: () => void;
  onReturnToDashboard?: () => void;
}

interface ExchangePayload {
  moneda_origen_id: string;
  moneda_destino_id: string;
  monto_origen: number;
  monto_destino: number;

  // Tasas diferenciadas
  tasa_cambio_billetes: number;
  tasa_cambio_monedas: number;

  // Detalles de divisas entregadas (por el cliente)
  divisas_entregadas_billetes: number;
  divisas_entregadas_monedas: number;
  divisas_entregadas_total: number;

  // Detalles de divisas recibidas (por el cliente)
  divisas_recibidas_billetes: number;
  divisas_recibidas_monedas: number;
  divisas_recibidas_total: number;

  tipo_operacion: "COMPRA" | "VENTA";
  punto_atencion_id: string;
  datos_cliente: DatosCliente;
  observacion?: string;
  metodo_entrega: "efectivo" | "transferencia";
  transferencia_numero?: string | null;
  transferencia_banco?: string | null;
  transferencia_imagen_url?: string | null;

  // flujo parcial
  abono_inicial_monto?: number | null;
  abono_inicial_fecha?: string | null;
  abono_inicial_recibido_por?: string | null;
  saldo_pendiente?: number | null;
  referencia_cambio_principal?: string | null;
}

type ExchangeCompleteDataExtend = ExchangeCompleteData & {
  metodoEntrega: "efectivo" | "transferencia";
  transferenciaNumero?: string;
  transferenciaBanco?: string;
  transferenciaImagen?: File | null;
  abonoInicialMonto?: number | null;
  abonoInicialFecha?: string | null;
  abonoInicialRecibidoPor?: string | null;
  saldoPendiente?: number | null;
  referenciaCambioPrincipal?: string | null;
};

// --- Utilidades locales (no cambian el flujo actual) ---
const parseNum = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const s = v.replace(/\s+/g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const trimOrEmpty = (v?: string | null) => (v ?? "").trim();

export const useExchangeProcess = ({
  user,
  selectedPoint,
  onExchangeCreated,
  onResetForm,
  onReturnToDashboard,
}: UseExchangeProcessProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const generateReceiptAndPrint = (
    exchange: CambioDivisa,
    showSuccessMessage = true,
    onReceiptClose?: () => void
  ) => {
    const receiptData = ReceiptService.generateCurrencyExchangeReceipt(
      exchange,
      selectedPoint?.nombre || "N/A",
      user.nombre
    );

    try {
      ReceiptService.printReceipt(receiptData, 2);
      if (showSuccessMessage) {
        toast.success("✅ Recibo enviado a impresora correctamente");
      }
      // Fallback/confirmación visual
      setTimeout(() => {
        ReceiptService.showReceiptInCurrentWindow(receiptData, onReceiptClose);
      }, 800);

      return { success: true, showModal: true };
    } catch (error) {
      console.warn("❌ Error al imprimir recibo:", error);
      ReceiptService.showReceiptInCurrentWindow(receiptData, onReceiptClose);
      toast.error(
        "❌ Error al imprimir recibo. Se muestra en pantalla. Puede usar 'Reimprimir'."
      );
      return { success: false, showModal: true };
    }
  };

  const processExchange = async (data: ExchangeCompleteDataExtend) => {
    if (isProcessing) return;

    if (!user) {
      toast.error("Usuario no válido, reintente sesión.");
      return;
    }
    if (!selectedPoint) {
      toast.error("Debe seleccionar un punto de atención");
      return;
    }

    setIsProcessing(true);

    try {
      // --- Normalizar tasas y montos recibidos del paso anterior ---
      const rateBilletes = parseNum(data.exchangeData.rateBilletes);
      const rateMonedas = parseNum(data.exchangeData.rateMonedas);

      const amountBilletes = parseNum(data.exchangeData.amountBilletes);
      const amountMonedas = parseNum(data.exchangeData.amountMonedas);

      const totalEntregado = parseNum(data.exchangeData.totalAmountEntregado); // MONEDA ORIGEN
      const totalRecibido = parseNum(data.exchangeData.totalAmountRecibido); // MONEDA DESTINO

      const fromCurrency = trimOrEmpty(data.exchangeData.fromCurrency);
      const toCurrency = trimOrEmpty(data.exchangeData.toCurrency);
      const opType = trimOrEmpty(data.exchangeData.operationType) as
        | "COMPRA"
        | "VENTA"
        | "";

      // Validaciones estrictas para evitar “faltan datos”
      if (!fromCurrency || !toCurrency) {
        toast.error("Debe seleccionar monedas de origen y destino.");
        setIsProcessing(false);
        return;
      }
      if (fromCurrency === toCurrency) {
        toast.error(
          "La moneda de origen y la de destino no pueden ser iguales."
        );
        setIsProcessing(false);
        return;
      }
      if (!opType) {
        toast.error("Debe seleccionar el tipo de operación (COMPRA/VENTA).");
        setIsProcessing(false);
        return;
      }

      // Al menos una vía de entrega (billetes/monedas) con monto > 0
      if (amountBilletes <= 0 && amountMonedas <= 0) {
        toast.error("Debe ingresar un monto en billetes o monedas.");
        setIsProcessing(false);
        return;
      }

      if (totalEntregado <= 0 || totalRecibido <= 0) {
        toast.error("Montos totales inválidos. Verifique los valores.");
        setIsProcessing(false);
        return;
      }

      // Transferencia: validar banco y número
      if (data.metodoEntrega === "transferencia") {
        const banco = trimOrEmpty(data.transferenciaBanco);
        const numero = trimOrEmpty(data.transferenciaNumero);
        if (!banco) {
          toast.error("Debe indicar el banco de la transferencia.");
          setIsProcessing(false);
          return;
        }
        if (!numero) {
          toast.error("Debe indicar el número/referencia de la transferencia.");
          setIsProcessing(false);
          return;
        }
      }

      // Adjuntos de transferencia: no subimos aquí (mantener flujo actual)
      let transferenciaImagenUrl: string | null = null;
      if (data.metodoEntrega === "transferencia" && data.transferenciaImagen) {
        // Mantener mensaje actual (sin crear feature nuevo)
        toast.info(
          "El comprobante de transferencia se debe subir manualmente."
        );
      }

      // --- Cliente: blindaje (documento = cédula si viene vacío) ---
      const sanitizedCliente: DatosCliente = {
        nombre: trimOrEmpty(data.customerData?.nombre),
        apellido: trimOrEmpty(data.customerData?.apellido),
        cedula: trimOrEmpty(data.customerData?.cedula),
        telefono: trimOrEmpty(data.customerData?.telefono),
        documento:
          trimOrEmpty(data.customerData?.documento) ||
          trimOrEmpty(data.customerData?.cedula) ||
          "",
      };

      if (
        !sanitizedCliente.nombre ||
        !sanitizedCliente.apellido ||
        !sanitizedCliente.cedula
      ) {
        toast.error(
          "Complete los datos del cliente (nombre, apellido, cédula)."
        );
        setIsProcessing(false);
        return;
      }

      // 🔍 VALIDACIÓN DE SALDOS ANTES DE PROCESAR (para la moneda que ENTREGAMOS)
      const saldoCheck =
        await movimientosContablesService.validarSaldoParaCambio(
          selectedPoint.id,
          toCurrency,
          totalRecibido
        );

      if (!saldoCheck?.valido) {
        toast.error(
          `❌ Saldo insuficiente: ${
            saldoCheck?.error || "No hay saldo disponible en la moneda destino."
          }`
        );
        if (typeof saldoCheck?.saldo_actual === "number") {
          toast.info(`💰 Saldo actual: ${saldoCheck.saldo_actual}`);
        }
        setIsProcessing(false);
        return;
      }

      // --- Armar payload exacto para backend ---
      const exchangePayload: ExchangePayload = {
        moneda_origen_id: fromCurrency,
        moneda_destino_id: toCurrency,
        monto_origen: totalEntregado, // ORIGEN
        monto_destino: totalRecibido, // DESTINO

        tasa_cambio_billetes: rateBilletes,
        tasa_cambio_monedas: rateMonedas,

        // ENTREGADAS por el cliente (ORIGEN)
        divisas_entregadas_billetes: amountBilletes,
        divisas_entregadas_monedas: amountMonedas,
        divisas_entregadas_total: totalEntregado,

        // RECIBIDAS por el cliente (DESTINO)
        divisas_recibidas_billetes: parseNum(data.divisasRecibidas?.billetes),
        divisas_recibidas_monedas: parseNum(data.divisasRecibidas?.monedas),
        divisas_recibidas_total: parseNum(data.divisasRecibidas?.total),

        tipo_operacion: opType as "COMPRA" | "VENTA",
        punto_atencion_id: selectedPoint.id,
        datos_cliente: sanitizedCliente,
        observacion: trimOrEmpty(data.exchangeData.observation) || undefined,
        metodo_entrega: data.metodoEntrega,
        transferencia_numero:
          data.metodoEntrega === "transferencia"
            ? trimOrEmpty(data.transferenciaNumero) || null
            : undefined,
        transferencia_banco:
          data.metodoEntrega === "transferencia"
            ? trimOrEmpty(data.transferenciaBanco) || null
            : undefined,
        transferencia_imagen_url: transferenciaImagenUrl,

        abono_inicial_monto:
          data.abonoInicialMonto !== undefined ? data.abonoInicialMonto : null,
        abono_inicial_fecha:
          data.abonoInicialFecha !== undefined ? data.abonoInicialFecha : null,
        abono_inicial_recibido_por:
          data.abonoInicialRecibidoPor !== undefined &&
          data.abonoInicialMonto &&
          data.abonoInicialMonto > 0
            ? user.id // Siempre enviar el ID del usuario actual
            : null,
        saldo_pendiente:
          data.saldoPendiente !== undefined ? data.saldoPendiente : null,
        referencia_cambio_principal:
          trimOrEmpty(data.referenciaCambioPrincipal) || null,
      };

      // --- Crear cambio ---
      const { exchange: createdExchange, error } =
        await exchangeService.createExchange(exchangePayload);

      if (error) {
        toast.error(`Error al crear cambio: ${error}`);
        setIsProcessing(false);
        return;
      }
      if (!createdExchange) {
        toast.error("No se pudo crear el cambio de divisa");
        setIsProcessing(false);
        return;
      }

      // Notificar de inmediato para refrescar saldos y listas, incluso si queda pendiente
      try {
        window.dispatchEvent(new CustomEvent("saldosUpdated"));
      } catch {}

      // 🎯 Verificar el estado del cambio creado
      // El backend ya crea el cambio como COMPLETADO si:
      // - No hay saldo pendiente (saldo_pendiente === 0 o null)
      // - Es efectivo sin abono inicial
      const isAlreadyCompleted = createdExchange.estado === "COMPLETADO";
      const isPending = createdExchange.estado === "PENDIENTE";

      if (isAlreadyCompleted) {
        // El backend ya lo completó, solo notificamos
        window.dispatchEvent(new CustomEvent("exchangeCompleted"));
        window.dispatchEvent(new CustomEvent("saldosUpdated"));
        toast.success("✅ Cambio completado exitosamente.");
      } else if (isPending) {
        // Cambio pendiente (transferencia, saldo pendiente o abono)
        const reason =
          data.metodoEntrega === "transferencia"
            ? "transferencia bancaria"
            : data.saldoPendiente
            ? "tiene saldo pendiente"
            : "tiene abono parcial";
        toast.info(
          `⏳ Cambio pendiente porque es por ${reason}. Complételo luego en "Cambios Pendientes".`
        );
      }

      onExchangeCreated(createdExchange);

      // Recibos (impresión + modal)
      setTimeout(() => {
        const handleReceiptClose = () => {
          onResetForm();
          toast.success(
            "🎉 Operación completada exitosamente. Regresando al dashboard..."
          );
          if (onReturnToDashboard) {
            setTimeout(() => onReturnToDashboard(), 800);
          }
        };

        generateReceiptAndPrint(createdExchange, true, handleReceiptClose);
      }, 120);
    } catch (err) {
      console.error("Error al procesar cambio:", err);
      toast.error("Error inesperado al procesar el cambio.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Reimpresión sin tocar lógica del flujo
  const reprintReceipt = (exchange: CambioDivisa) => {
    if (!selectedPoint) {
      toast.error("No hay punto de atención seleccionado");
      return;
    }
    try {
      generateReceiptAndPrint(exchange, false);
      toast.success("🖨️ Recibo reenviado a impresora");
    } catch (error) {
      console.error("Error al reimprimir recibo:", error);
      toast.error("Error al reimprimir recibo");
    }
  };

  return {
    isProcessing,
    processExchange,
    reprintReceipt,
  };
};
