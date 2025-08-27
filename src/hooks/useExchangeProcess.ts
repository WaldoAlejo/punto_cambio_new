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
  onReturnToDashboard,
}: UseExchangeProcessProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const generateReceiptAndPrint = (
    exchange: CambioDivisa,
    showSuccessMessage = true
  ) => {
    const receiptData = ReceiptService.generateCurrencyExchangeReceipt(
      exchange,
      selectedPoint?.nombre || "N/A",
      user.nombre
    );

    try {
      console.log("🖨️ Intentando imprimir recibo...");
      ReceiptService.printReceipt(receiptData, 2);

      if (showSuccessMessage) {
        toast.success("✅ Recibo enviado a impresora correctamente");
      }

      // Como fallback, también mostrar en la ventana actual
      setTimeout(() => {
        ReceiptService.showReceiptInCurrentWindow(receiptData);
      }, 1000);

      return true; // Impresión exitosa
    } catch (error) {
      console.warn("❌ Error al imprimir recibo:", error);

      // Si falla la impresión, mostrar en ventana actual
      ReceiptService.showReceiptInCurrentWindow(receiptData);

      toast.error(
        "❌ Error al imprimir recibo. Se muestra en pantalla. Puede usar el botón 'Reimprimir' para intentar nuevamente."
      );

      return false; // Impresión falló
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
      const rateBilletes = parseFloat(data.exchangeData.rateBilletes);
      const rateMonedas = parseFloat(data.exchangeData.rateMonedas);
      const amountBilletes = parseFloat(
        data.exchangeData.amountBilletes || "0"
      );
      const amountMonedas = parseFloat(data.exchangeData.amountMonedas || "0");

      if (
        !data.exchangeData.fromCurrency ||
        !data.exchangeData.toCurrency ||
        isNaN(rateBilletes) ||
        isNaN(rateMonedas) ||
        (amountBilletes === 0 && amountMonedas === 0) ||
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
        monto_origen: data.exchangeData.totalAmountEntregado,
        monto_destino: data.exchangeData.totalAmountRecibido,

        // Tasas diferenciadas
        tasa_cambio_billetes: rateBilletes,
        tasa_cambio_monedas: rateMonedas,

        // Detalles de divisas entregadas (por el cliente)
        divisas_entregadas_billetes: amountBilletes,
        divisas_entregadas_monedas: amountMonedas,
        divisas_entregadas_total: data.exchangeData.totalAmountEntregado,

        // Detalles de divisas recibidas (por el cliente)
        divisas_recibidas_billetes: data.divisasRecibidas.billetes,
        divisas_recibidas_monedas: data.divisasRecibidas.monedas,
        divisas_recibidas_total: data.divisasRecibidas.total,

        tipo_operacion: data.exchangeData.operationType as "COMPRA" | "VENTA",
        punto_atencion_id: selectedPoint.id,
        datos_cliente: data.customerData,
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
        const printSuccess = generateReceiptAndPrint(createdExchange);

        // Después de imprimir, resetear formulario y regresar al dashboard
        setTimeout(() => {
          onResetForm();

          if (printSuccess) {
            toast.success(
              "🎉 Operación completada exitosamente. Regresando al dashboard..."
            );
          } else {
            toast.info(
              "🎉 Operación completada. Use 'Reimprimir' si necesita el recibo nuevamente."
            );
          }

          // Regresar al dashboard si se proporcionó la función
          if (onReturnToDashboard) {
            setTimeout(() => {
              onReturnToDashboard();
            }, 2000);
          }
        }, 1500);
      }, 100);
    } catch (error) {
      console.error("Error al procesar cambio:", error);
      toast.error("Error inesperado al procesar el cambio");
    } finally {
      setIsProcessing(false);
    }
  };

  // Función para reimprimir recibos
  const reprintReceipt = (exchange: CambioDivisa) => {
    if (!selectedPoint) {
      toast.error("No hay punto de atención seleccionado");
      return;
    }

    try {
      generateReceiptAndPrint(exchange, false); // No mostrar mensaje de éxito automático
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
