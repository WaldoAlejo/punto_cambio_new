import { useState } from "react";
import { toast } from "sonner";
import {
  User,
  PuntoAtencion,
  CambioDivisa,
  DatosCliente,
  DetalleDivisasSimple,
} from "../types";
import { exchangeService } from "../services/exchangeService";
import { ReceiptService } from "../services/receiptService";
import { ExchangeCompleteData } from "../components/exchange/ExchangeSteps";

interface UseExchangeProcessProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onExchangeCreated: (exchange: CambioDivisa) => void;
  onResetForm: () => void;
}

interface ExchangePayload {
  moneda_origen_id: string;
  moneda_destino_id: string;
  monto_origen: number;
  monto_destino: number;
  tasa_cambio: number;
  tipo_operacion: "COMPRA" | "VENTA";
  punto_atencion_id: string;
  datos_cliente: DatosCliente;
  divisas_entregadas: DetalleDivisasSimple;
  divisas_recibidas: DetalleDivisasSimple;
  observacion?: string;
  metodo_entrega: "efectivo" | "transferencia";
  transferencia_numero?: string | null;
  transferencia_banco?: string | null;
  transferencia_imagen_url?: string | null;
  // NUEVOS CAMPOS flujo parcial
  abono_inicial_monto?: number | null;
  abono_inicial_fecha?: string | null;
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
  saldoPendiente?: number | null;
  referenciaCambioPrincipal?: string | null;
};

export const useExchangeProcess = ({
  user,
  selectedPoint,
  onExchangeCreated,
  onResetForm,
}: UseExchangeProcessProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const generateReceiptAndPrint = (exchange: CambioDivisa) => {
    const receiptData = ReceiptService.generateCurrencyExchangeReceipt(
      exchange,
      selectedPoint?.nombre || "N/A",
      user.nombre
    );

    try {
      ReceiptService.printReceipt(receiptData, 2);
    } catch (error) {
      console.warn("Error al imprimir recibo:", error);
      toast.warning(
        "El recibo se generó correctamente pero hubo un problema con la impresión"
      );
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
      const rateValue = parseFloat(data.exchangeData.rate);
      const montoOrigen = parseFloat(data.exchangeData.amount);

      if (
        !data.exchangeData.fromCurrency ||
        !data.exchangeData.toCurrency ||
        isNaN(rateValue) ||
        isNaN(montoOrigen) ||
        !data.exchangeData.operationType
      ) {
        toast.error("Datos incompletos o inválidos para procesar el cambio.");
        setIsProcessing(false);
        return;
      }

      let transferenciaImagenUrl: string | null = null;
      if (data.metodoEntrega === "transferencia" && data.transferenciaImagen) {
        // Aquí podrías implementar la subida del archivo y obtener la URL
        toast.info(
          "El archivo de comprobante de transferencia se debe subir manualmente"
        );
      }

      const exchangePayload: ExchangePayload = {
        moneda_origen_id: data.exchangeData.fromCurrency,
        moneda_destino_id: data.exchangeData.toCurrency,
        monto_origen: montoOrigen,
        monto_destino: data.exchangeData.destinationAmount,
        tasa_cambio: rateValue,
        tipo_operacion: data.exchangeData.operationType as "COMPRA" | "VENTA",
        punto_atencion_id: selectedPoint.id,
        datos_cliente: data.customerData,
        divisas_entregadas: data.divisasEntregadas,
        divisas_recibidas: data.divisasRecibidas,
        observacion: data.exchangeData.observation || undefined,
        metodo_entrega: data.metodoEntrega,
        transferencia_numero:
          data.metodoEntrega === "transferencia"
            ? data.transferenciaNumero || ""
            : undefined,
        transferencia_banco:
          data.metodoEntrega === "transferencia"
            ? data.transferenciaBanco || ""
            : undefined,
        transferencia_imagen_url: transferenciaImagenUrl,
        // --- CAMPOS DE ABONO PARCIAL ---
        abono_inicial_monto: data.abonoInicialMonto ?? null,
        abono_inicial_fecha: data.abonoInicialFecha ?? null,
        saldo_pendiente: data.saldoPendiente ?? null,
        referencia_cambio_principal: data.referenciaCambioPrincipal ?? null,
      };

      const { exchange: createdExchange, error } =
        await exchangeService.createExchange(exchangePayload);

      if (error) {
        toast.error(`Error al crear cambio: ${error}`);
        return;
      }

      if (!createdExchange) {
        toast.error("No se pudo crear el cambio de divisa");
        return;
      }

      // 🎯 LÓGICA MEJORADA: Decidir si auto-completar o quedar pendiente
      const shouldAutoComplete =
        data.metodoEntrega === "efectivo" && // Solo efectivo se completa automáticamente
        !data.saldoPendiente && // No hay saldo pendiente
        !data.abonoInicialMonto; // No es un abono parcial

      if (shouldAutoComplete) {
        // Auto-completar el cambio inmediatamente
        console.log("🚀 Auto-completing exchange for cash transaction");
        const { error: closeError } =
          await exchangeService.closePendingExchange(createdExchange.id);

        if (closeError) {
          toast.warning(
            `⚠️ Cambio creado pero pendiente. Debe completarlo manualmente desde "Cambios Pendientes". Error: ${closeError}`
          );
        } else {
          // Disparar evento para actualizar saldos
          window.dispatchEvent(new CustomEvent("exchangeCompleted"));
          toast.success(
            `✅ Cambio completado automáticamente. Los saldos se han actualizado. Recibo: ${createdExchange.numero_recibo}`
          );
        }
      } else {
        // Quedar pendiente y mostrar explicación
        const reason =
          data.metodoEntrega === "transferencia"
            ? "transferencia bancaria"
            : data.saldoPendiente
            ? "tiene saldo pendiente"
            : "requiere abono parcial";

        toast.info(
          `⏳ Cambio pendiente porque es por ${reason}. Debe completarlo desde "Cambios Pendientes" cuando esté listo.`
        );
      }

      onExchangeCreated(createdExchange);

      // Generar e imprimir recibos
      setTimeout(() => {
        generateReceiptAndPrint(createdExchange);

        // Después de imprimir, resetear formulario y regresar al dashboard
        setTimeout(() => {
          onResetForm();
          toast.success("🎉 Operación completada. Regresando al dashboard...");
        }, 1500);
      }, 100);
    } catch (error) {
      console.error("Error al procesar cambio:", error);
      toast.error("Error inesperado al procesar el cambio");
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    processExchange,
  };
};
