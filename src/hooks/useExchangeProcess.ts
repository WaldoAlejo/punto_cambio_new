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
    showSuccessMessage = true,
    onReceiptClose?: () => void
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

      // Siempre mostrar en la ventana actual como fallback/confirmación
      setTimeout(() => {
        ReceiptService.showReceiptInCurrentWindow(receiptData, onReceiptClose);
      }, 1000);

      return { success: true, showModal: true }; // Impresión exitosa pero se muestra modal
    } catch (error) {
      console.warn("❌ Error al imprimir recibo:", error);

      // Si falla la impresión, mostrar en ventana actual
      ReceiptService.showReceiptInCurrentWindow(receiptData, onReceiptClose);

      toast.error(
        "❌ Error al imprimir recibo. Se muestra en pantalla. Puede usar el botón 'Reimprimir' para intentar nuevamente."
      );

      return { success: false, showModal: true }; // Impresión falló y se muestra modal
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

      // Bloquear monedas iguales
      if (data.exchangeData.fromCurrency === data.exchangeData.toCurrency) {
        toast.error(
          "La moneda de origen y la de destino no pueden ser iguales."
        );
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

      // 🔍 VALIDACIÓN DE SALDOS ANTES DE PROCESAR
      console.log("🔍 Validando saldo antes del cambio...");
      const {
        valido,
        saldo_actual,
        error: errorSaldo,
      } = await movimientosContablesService.validarSaldoParaCambio(
        selectedPoint.id,
        data.exchangeData.toCurrency, // Moneda que vamos a entregar
        data.exchangeData.totalAmountRecibido // Monto que vamos a entregar
      );

      if (!valido) {
        toast.error(
          `❌ Saldo insuficiente: ${
            errorSaldo || "No hay suficiente saldo para realizar este cambio"
          }`
        );
        toast.info(`💰 Saldo actual: ${saldo_actual}`);
        setIsProcessing(false);
        return;
      }

      console.log(
        `✅ Saldo validado. Disponible: ${saldo_actual}, Requerido: ${data.exchangeData.totalAmountRecibido}`
      );

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
          // 📊 PROCESAR MOVIMIENTOS CONTABLES
          console.log("📊 Procesando movimientos contables...");
          try {
            const { result: contabilidadResult, error: contabilidadError } =
              await movimientosContablesService.procesarMovimientosCambio(
                createdExchange,
                user.id
              );

            if (contabilidadError) {
              console.error("❌ Error en contabilidad:", contabilidadError);
              toast.warning(
                `⚠️ Cambio completado pero error en contabilidad: ${contabilidadError}`
              );
            } else if (contabilidadResult && contabilidadResult.success) {
              console.log(
                "✅ Movimientos contables procesados:",
                contabilidadResult
              );

              // Mostrar resumen de saldos actualizados
              const resumen = contabilidadResult.saldos_actualizados
                .map(
                  (s) =>
                    `${s.moneda_id}: ${s.saldo_anterior.toFixed(
                      2
                    )} → ${s.saldo_nuevo.toFixed(2)}`
                )
                .join(", ");

              toast.success(
                `✅ Cambio completado. Saldos actualizados: ${resumen}`
              );
            }
          } catch (contabilidadErr) {
            console.error(
              "❌ Error inesperado en contabilidad:",
              contabilidadErr
            );
            toast.warning(
              "⚠️ Cambio completado pero error al actualizar saldos"
            );
          }

          // Disparar evento para actualizar saldos en la UI
          window.dispatchEvent(new CustomEvent("exchangeCompleted"));
          window.dispatchEvent(new CustomEvent("saldosUpdated"));
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
        // Función que se ejecuta cuando se cierra el modal del recibo
        const handleReceiptClose = () => {
          onResetForm();
          toast.success(
            "🎉 Operación completada exitosamente. Regresando al dashboard..."
          );

          // Regresar al dashboard si se proporcionó la función
          if (onReturnToDashboard) {
            setTimeout(() => {
              onReturnToDashboard();
            }, 1000);
          }
        };

        const printResult = generateReceiptAndPrint(
          createdExchange,
          true,
          handleReceiptClose
        );

        // Como siempre se muestra el modal, el usuario debe cerrarlo manualmente
        // El callback handleReceiptClose se ejecutará cuando el usuario cierre el modal
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
      // Para reimprimir, no regresar al dashboard automáticamente
      generateReceiptAndPrint(exchange, false); // No mostrar mensaje de éxito automático, sin callback de cierre
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
