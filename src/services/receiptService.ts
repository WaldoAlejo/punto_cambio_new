import { CambioDivisa, Transferencia } from "../types";

type CurrencyExchangeDetails = {
  tipoOperacion: string;
  montoOrigen: number;
  monedaOrigen: string;
  montoDestino: number;
  monedaDestino: string;
  tasaCambio: number;
  observacion?: string | null;
  cliente: {
    nombre: string;
    apellido: string;
    cedula: string;
    telefono: string;
  };
  divisasEntregadas: {
    billetes: number;
    monedas: number;
    total: number;
  };
  divisasRecibidas: {
    billetes: number;
    monedas: number;
    total: number;
  };
};

type TransferDetails = {
  tipoTransferencia: string;
  monto: number;
  moneda: string;
  origen: string;
  destino: string;
  estado: string;
  descripcion?: string | null;
};

export type ReceiptDetails = CurrencyExchangeDetails | TransferDetails;

export interface ReceiptData {
  numeroRecibo: string;
  fecha: string;
  tipo: string;
  puntoAtencion: string;
  usuario: string;
  detalles: ReceiptDetails;
}

export class ReceiptService {
  static generateReceiptNumber(tipo: string): string {
    const timestamp = Date.now();
    const prefix =
      {
        CAMBIO_DIVISA: "CD",
        TRANSFERENCIA: "TR",
        MOVIMIENTO: "MV",
        DEPOSITO: "DP",
        RETIRO: "RT",
      }[tipo] || "RC";

    return `${prefix}-${timestamp}`;
  }

  static generatePartialExchangeReceipt(
    exchange: CambioDivisa,
    puntoNombre: string,
    usuarioNombre: string,
    isInitialPayment: boolean,
    partialData?: {
      initialPayment: number;
      pendingBalance: number;
      receivedBy: string;
      observations: string;
    }
  ): ReceiptData {
    const tipo = isInitialPayment
      ? "CAMBIO PARCIAL - ABONO INICIAL"
      : "CAMBIO COMPLETADO";

    // Para abonos parciales, mostrar el monto del abono
    const montoMostrar =
      isInitialPayment && partialData
        ? partialData.initialPayment
        : exchange.monto_destino;

    const observacionCompleta =
      isInitialPayment && partialData
        ? `ABONO PARCIAL: ${partialData.initialPayment.toLocaleString()} ${
            exchange.monedaDestino?.codigo
          }. Pendiente: ${partialData.pendingBalance.toLocaleString()}. Recibido por: ${
            partialData.receivedBy
          }. ${
            partialData.observations ? `Obs: ${partialData.observations}` : ""
          }`
        : `CAMBIO COMPLETADO. ${exchange.observacion || ""}`;

    return {
      numeroRecibo:
        exchange.numero_recibo || this.generateReceiptNumber("CAMBIO_DIVISA"),
      fecha: new Date().toLocaleString(),
      tipo,
      puntoAtencion: puntoNombre,
      usuario: usuarioNombre,
      detalles: {
        tipoOperacion: exchange.tipo_operacion,
        montoOrigen: exchange.monto_origen,
        monedaOrigen: exchange.monedaOrigen?.codigo || "",
        montoDestino: montoMostrar,
        monedaDestino: exchange.monedaDestino?.codigo || "",
        tasaCambio: exchange.tasa_cambio,
        observacion: observacionCompleta,
        cliente: {
          nombre: exchange.datos_cliente?.nombre || "",
          apellido: exchange.datos_cliente?.apellido || "",
          cedula: exchange.datos_cliente?.cedula || "",
          telefono: exchange.datos_cliente?.telefono || "",
        },
        divisasEntregadas: {
          billetes: 0,
          monedas: 0,
          total: exchange.monto_origen,
        },
        divisasRecibidas: {
          billetes: 0,
          monedas: 0,
          total: montoMostrar,
        },
      },
    };
  }

  static generateCurrencyExchangeReceipt(
    exchange: CambioDivisa,
    puntoNombre: string,
    usuarioNombre: string
  ): ReceiptData {
    return {
      numeroRecibo:
        exchange.numero_recibo || this.generateReceiptNumber("CAMBIO_DIVISA"),
      fecha: new Date(exchange.fecha).toLocaleString(),
      tipo: "CAMBIO DE DIVISA",
      puntoAtencion: puntoNombre,
      usuario: usuarioNombre,
      detalles: {
        tipoOperacion: exchange.tipo_operacion,
        montoOrigen: exchange.monto_origen,
        monedaOrigen: exchange.monedaOrigen?.codigo || "",
        montoDestino: exchange.monto_destino,
        monedaDestino: exchange.monedaDestino?.codigo || "",
        tasaCambio: exchange.tasa_cambio,
        observacion: exchange.observacion,
        cliente: {
          nombre: exchange.datos_cliente?.nombre || "",
          apellido: exchange.datos_cliente?.apellido || "",
          cedula: exchange.datos_cliente?.cedula || "",
          telefono: exchange.datos_cliente?.telefono || "",
        },
        divisasEntregadas: {
          billetes: exchange.divisas_entregadas?.billetes || 0,
          monedas: exchange.divisas_entregadas?.monedas || 0,
          total: exchange.divisas_entregadas?.total || 0,
        },
        divisasRecibidas: {
          billetes: exchange.divisas_recibidas?.billetes || 0,
          monedas: exchange.divisas_recibidas?.monedas || 0,
          total: exchange.divisas_recibidas?.total || 0,
        },
      },
    };
  }

  static generateTransferReceipt(
    transfer: Transferencia,
    puntoNombre: string,
    usuarioNombre: string
  ): ReceiptData {
    return {
      numeroRecibo:
        transfer.numero_recibo || this.generateReceiptNumber("TRANSFERENCIA"),
      fecha: new Date(transfer.fecha).toLocaleString(),
      tipo: "TRANSFERENCIA",
      puntoAtencion: puntoNombre,
      usuario: usuarioNombre,
      detalles: {
        tipoTransferencia: transfer.tipo_transferencia,
        monto: transfer.monto,
        moneda: transfer.moneda?.codigo || "",
        origen: transfer.origen?.nombre || "Matriz",
        destino: transfer.destino?.nombre || "",
        estado: transfer.estado,
        descripcion: transfer.descripcion,
      },
    };
  }

  static formatReceiptForPrinting(receipt: ReceiptData): string {
    const separator = "================================";
    const halfSeparator = "----------------";

    let receiptText = `
${separator}
        PUNTO CAMBIO
${separator}
Recibo: ${receipt.numeroRecibo}
Fecha: ${receipt.fecha}
Tipo: ${receipt.tipo}
${halfSeparator}
Punto: ${receipt.puntoAtencion}
Operador: ${receipt.usuario}
${halfSeparator}
`;

    if (receipt.tipo.includes("CAMBIO")) {
      const detalles = receipt.detalles as CurrencyExchangeDetails;
      receiptText += `
DATOS DEL CLIENTE:
Nombre: ${detalles.cliente.nombre} ${detalles.cliente.apellido}
Cédula: ${detalles.cliente.cedula}
Teléfono: ${detalles.cliente.telefono}
${halfSeparator}
OPERACIÓN: ${detalles.tipoOperacion}
${receipt.tipo.includes("PARCIAL") ? "*** CAMBIO PARCIAL ***" : ""}
Entrega: ${detalles.montoOrigen.toLocaleString()} ${detalles.monedaOrigen}
Recibe: ${detalles.montoDestino.toLocaleString()} ${detalles.monedaDestino}
Tasa: ${detalles.tasaCambio}
${halfSeparator}`;

      if (receipt.tipo.includes("ABONO INICIAL")) {
        receiptText += `
ABONO INICIAL RECIBIDO
Monto entregado por cliente: ${detalles.montoOrigen.toLocaleString()} ${
          detalles.monedaOrigen
        }
Pendiente por entregar: ${detalles.montoDestino.toLocaleString()} ${
          detalles.monedaDestino
        }

*** CLIENTE DEBE REGRESAR PARA ***
*** COMPLETAR LA OPERACIÓN ***
`;
      } else if (receipt.tipo.includes("COMPLETADO")) {
        receiptText += `
OPERACIÓN COMPLETADA
Monto final entregado: ${detalles.montoDestino.toLocaleString()} ${
          detalles.monedaDestino
        }

*** OPERACIÓN FINALIZADA ***
`;
      } else {
        receiptText += `
DETALLE DIVISAS ENTREGADAS:
Billetes: ${detalles.divisasEntregadas.billetes.toLocaleString()} ${
          detalles.monedaOrigen
        }
Monedas: ${detalles.divisasEntregadas.monedas.toLocaleString()} ${
          detalles.monedaOrigen
        }
Total: ${detalles.divisasEntregadas.total.toLocaleString()} ${
          detalles.monedaOrigen
        }
${halfSeparator}
DETALLE DIVISAS RECIBIDAS:
Billetes: ${detalles.divisasRecibidas.billetes.toLocaleString()} ${
          detalles.monedaDestino
        }
Monedas: ${detalles.divisasRecibidas.monedas.toLocaleString()} ${
          detalles.monedaDestino
        }
Total: ${detalles.divisasRecibidas.total.toLocaleString()} ${
          detalles.monedaDestino
        }
`;
      }

      receiptText += `${
        detalles.observacion
          ? `${halfSeparator}\nObservaciones: ${detalles.observacion}`
          : ""
      }
`;
    } else if (receipt.tipo === "TRANSFERENCIA") {
      const detalles = receipt.detalles as TransferDetails;
      receiptText += `
TIPO DE TRANSFERENCIA: ${detalles.tipoTransferencia}
${halfSeparator}
MONTO: ${detalles.monto.toLocaleString()} ${detalles.moneda}
${
  detalles.origen !== "Matriz" ? `ORIGEN: ${detalles.origen}` : "ORIGEN: Matriz"
}
DESTINO: ${detalles.destino}
ESTADO: ${detalles.estado}
${
  detalles.descripcion
    ? `${halfSeparator}\nDESCRIPCIÓN: ${detalles.descripcion}`
    : ""
}
`;
    }

    receiptText += `
${separator}
FIRMAS DE RESPONSABILIDAD:

Cliente: ____________________
${
  receipt.tipo === "CAMBIO DE DIVISA"
    ? `${(receipt.detalles as CurrencyExchangeDetails).cliente.nombre} ${
        (receipt.detalles as CurrencyExchangeDetails).cliente.apellido
      }
Doc: ${(receipt.detalles as CurrencyExchangeDetails).cliente.cedula}`
    : ""
}

Operador: ___________________
${receipt.usuario}

${separator}
Gracias por su preferencia
Este comprobante es válido como
evidencia de la operación realizada
${separator}

`;

    return receiptText;
  }

  static printReceipt(receiptData: ReceiptData, copies: number = 2): void {
    const formattedReceipt = this.formatReceiptForPrinting(receiptData);

    // En un entorno real, aquí se enviaría a la impresora térmica
    console.log("Imprimiendo recibo:");
    console.log(formattedReceipt);

    for (let i = 1; i <= copies; i++) {
      console.log(`--- Copia ${i} ---`);
      if (typeof window !== "undefined" && "print" in window) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Recibo ${receiptData.numeroRecibo}</title>
                <style>
                  body { font-family: monospace; font-size: 12px; margin: 20px; }
                  .receipt { white-space: pre-line; }
                </style>
              </head>
              <body>
                <div class="receipt">${formattedReceipt}</div>
                <script>
                  window.print(); 
                  setTimeout(() => {
                    window.close();
                  }, 1000);
                </script>
              </body>
            </html>
          `);
        }
      }
    }
  }
}
