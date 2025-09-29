import { CambioDivisa, Transferencia } from "../types";

type CurrencyExchangeDetails = {
  tipoOperacion: string;
  montoOrigen: number;
  monedaOrigen: string;
  montoDestino: number;
  monedaDestino: string;

  // Tasas diferenciadas
  tasaCambioBilletes: number;
  tasaCambioMonedas: number;

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

    // Generar número de recibo específico según el tipo
    const numeroRecibo = isInitialPayment
      ? exchange.numero_recibo_abono ||
        this.generateReceiptNumber("ABONO_PARCIAL")
      : exchange.numero_recibo_completar ||
        this.generateReceiptNumber("COMPLETAR_CAMBIO");

    return {
      numeroRecibo,
      fecha: new Date().toLocaleString(),
      tipo,
      puntoAtencion: puntoNombre,
      usuario: usuarioNombre,
      detalles: {
        tipoOperacion: exchange.tipo_operacion,
        montoOrigen: Number(exchange.monto_origen) || 0,
        monedaOrigen:
          exchange.monedaOrigen?.nombre || exchange.monedaOrigen?.codigo || "",
        montoDestino: montoMostrar,
        monedaDestino:
          exchange.monedaDestino?.nombre ||
          exchange.monedaDestino?.codigo ||
          "",
        tasaCambioBilletes: Number(exchange.tasa_cambio_billetes) || 0,
        tasaCambioMonedas: Number(exchange.tasa_cambio_monedas) || 0,
        observacion: observacionCompleta,
        cliente: {
          nombre: exchange.datos_cliente?.nombre || "",
          apellido: exchange.datos_cliente?.apellido || "",
          cedula: exchange.datos_cliente?.cedula || "",
          telefono: exchange.datos_cliente?.telefono || "",
        },
        divisasEntregadas: {
          billetes: Number(exchange.divisas_entregadas_billetes) || 0,
          monedas: Number(exchange.divisas_entregadas_monedas) || 0,
          total: Number(exchange.divisas_entregadas_total) || 0,
        },
        divisasRecibidas: {
          billetes: Number(exchange.divisas_recibidas_billetes) || 0,
          monedas: Number(exchange.divisas_recibidas_monedas) || 0,
          total: Number(exchange.divisas_recibidas_total) || 0,
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
        montoOrigen: Number(exchange.monto_origen) || 0,
        monedaOrigen:
          exchange.monedaOrigen?.nombre || exchange.monedaOrigen?.codigo || "",
        montoDestino: Number(exchange.monto_destino) || 0,
        monedaDestino:
          exchange.monedaDestino?.nombre ||
          exchange.monedaDestino?.codigo ||
          "",

        // Tasas diferenciadas
        tasaCambioBilletes: Number(exchange.tasa_cambio_billetes) || 0,
        tasaCambioMonedas: Number(exchange.tasa_cambio_monedas) || 0,

        observacion: exchange.observacion,
        cliente: {
          nombre: exchange.datos_cliente?.nombre || "",
          apellido: exchange.datos_cliente?.apellido || "",
          cedula: exchange.datos_cliente?.cedula || "",
          telefono: exchange.datos_cliente?.telefono || "",
        },
        divisasEntregadas: {
          billetes: exchange.divisas_entregadas_billetes || 0,
          monedas: exchange.divisas_entregadas_monedas || 0,
          total: exchange.divisas_entregadas_total || 0,
        },
        divisasRecibidas: {
          billetes: exchange.divisas_recibidas_billetes || 0,
          monedas: exchange.divisas_recibidas_monedas || 0,
          total: exchange.divisas_recibidas_total || 0,
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
        moneda: transfer.moneda?.nombre || transfer.moneda?.codigo || "",
        origen: transfer.origen?.nombre || "Matriz",
        destino: transfer.destino?.nombre || "",
        estado: transfer.estado,
        descripcion: transfer.descripcion,
      },
    };
  }

  static formatReceiptForPrinting(
    receipt: ReceiptData,
    copyType: "cliente" | "operador" = "cliente"
  ): string {
    // Formato optimizado para impresoras térmicas (48 caracteres)
    const separator = "================================================";
    const halfSeparator = "------------------------";
    const copyLabel =
      copyType === "cliente" ? "COPIA CLIENTE" : "COPIA OPERADOR";

    let receiptText = `
${separator}
                PUNTO CAMBIO
                ${copyLabel}
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

TASAS DE CAMBIO:
Billetes: ${detalles.tasaCambioBilletes.toFixed(4)}
Monedas: ${detalles.tasaCambioMonedas.toFixed(4)}
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

    // Sección de firmas diferenciada por tipo de copia
    if (copyType === "cliente") {
      receiptText += `
${separator}
FIRMA DE RESPONSABILIDAD:

Cliente: ____________________
${
  receipt.tipo === "CAMBIO DE DIVISA"
    ? `${(receipt.detalles as CurrencyExchangeDetails).cliente.nombre} ${
        (receipt.detalles as CurrencyExchangeDetails).cliente.apellido
      }
Doc: ${(receipt.detalles as CurrencyExchangeDetails).cliente.cedula}`
    : ""
}

Fecha: ___/___/______

${separator}
*** COPIA PARA EL CLIENTE ***
Conserve este comprobante como
evidencia de la operación realizada
${separator}

`;
    } else {
      receiptText += `
${separator}
FIRMA DE RESPONSABILIDAD:

Operador: ___________________
${receipt.usuario}

Fecha: ___/___/______

Supervisor: _________________
(Si aplica)

${separator}
*** COPIA PARA ARCHIVO ***
Comprobante interno de la operación
${separator}

`;
    }

    return receiptText;
  }

  static printReceipt(receiptData: ReceiptData, copies: number = 2): void {
    // En un entorno real, aquí se enviaría a la impresora térmica
    console.log("Imprimiendo recibo:");

    // Generar las dos copias diferenciadas
    const copyTypes: ("cliente" | "operador")[] = ["cliente", "operador"];

    for (let i = 0; i < Math.min(copies, 2); i++) {
      const copyType = copyTypes[i];
      const formattedReceipt = this.formatReceiptForPrinting(
        receiptData,
        copyType
      );

      console.log(`--- Copia ${i + 1} (${copyType.toUpperCase()}) ---`);
      console.log(formattedReceipt);

      if (typeof window !== "undefined" && "print" in window) {
        try {
          const printWindow = window.open("", "_blank", "width=800,height=600");

          if (printWindow) {
            const copyLabel = copyType === "cliente" ? "Cliente" : "Operador";
            printWindow.document.write(`
              <html>
                <head>
                  <title>Recibo ${receiptData.numeroRecibo} - Copia ${copyLabel}</title>
                  <style>
                    body { 
                      font-family: 'Courier New', monospace; 
                      font-size: 11px; 
                      margin: 5px; 
                      line-height: 1.1;
                      background: white;
                    }
                    .receipt { 
                      white-space: pre-line; 
                      max-width: 350px;
                      width: 100%;
                    }
                    @media print {
                      body { 
                        margin: 0; 
                        padding: 0;
                        font-size: 9px;
                      }
                      .receipt { 
                        font-size: 9px; 
                        max-width: 300px;
                        width: 100%;
                      }
                      @page {
                        margin: 0;
                        size: 80mm auto;
                      }
                    }
                  </style>
                </head>
                <body>
                  <div class="receipt">${formattedReceipt}</div>
                  <script>
                    window.onload = function() {
                      setTimeout(() => {
                        window.print(); 
                        setTimeout(() => {
                          window.close();
                        }, 2000);
                      }, 500);
                    };
                  </script>
                </body>
              </html>
            `);
            printWindow.document.close();
          } else {
            // Si el popup fue bloqueado, mostrar alerta
            console.warn(
              `ADVERTENCIA: Popup bloqueado para copia ${copyType}. Verifique la configuración del navegador.`
            );
            alert(
              `ADVERTENCIA: El navegador bloqueó la ventana de impresión.\n\nPor favor:\n1. Permita popups para este sitio\n2. O use Ctrl+P para imprimir manualmente`
            );
          }
        } catch (error) {
          console.error(
            `ERROR: Error al abrir ventana de impresión para copia ${copyType}:`,
            error
          );
          alert(
            `ERROR: Error al imprimir copia ${copyType}. Verifique la configuración del navegador.`
          );
        }
      }
    }
  }

  // Método alternativo para mostrar el recibo en la misma ventana
  static showReceiptInCurrentWindow(
    receiptData: ReceiptData,
    onClose?: () => void
  ): void {
    // Mostrar ambas copias en tabs
    const clienteReceipt = this.formatReceiptForPrinting(
      receiptData,
      "cliente"
    );
    const operadorReceipt = this.formatReceiptForPrinting(
      receiptData,
      "operador"
    );

    // Crear un div temporal para mostrar el recibo
    const receiptDiv = document.createElement("div");
    receiptDiv.innerHTML = `
      <div style="
        position: fixed; 
        top: 0; 
        left: 0; 
        width: 100%; 
        height: 100%; 
        background: rgba(0,0,0,0.8); 
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: center;
      ">
        <div style="
          background: white; 
          padding: 20px; 
          border-radius: 8px;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        ">
          <div style="margin-bottom: 20px;">
            <button id="tabCliente" onclick="showTab('cliente')" style="
              background: #007bff; 
              color: white; 
              border: none; 
              padding: 8px 16px; 
              margin: 2px;
              border-radius: 4px;
              cursor: pointer;
            ">COPIA CLIENTE</button>
            <button id="tabOperador" onclick="showTab('operador')" style="
              background: #6c757d; 
              color: white; 
              border: none; 
              padding: 8px 16px; 
              margin: 2px;
              border-radius: 4px;
              cursor: pointer;
            ">COPIA OPERADOR</button>
          </div>
          
          <div id="receiptCliente" style="
            font-family: 'Courier New', monospace; 
            font-size: 11px; 
            white-space: pre-line;
            margin-bottom: 20px;
            display: block;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            max-width: 350px;
            line-height: 1.2;
          ">${clienteReceipt}</div>
          
          <div id="receiptOperador" style="
            font-family: 'Courier New', monospace; 
            font-size: 11px; 
            white-space: pre-line;
            margin-bottom: 20px;
            display: none;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            max-width: 350px;
            line-height: 1.2;
          ">${operadorReceipt}</div>
          
          <div style="text-align: center;">
            <button onclick="window.print()" style="
              background: #28a745; 
              color: white; 
              border: none; 
              padding: 10px 20px; 
              margin: 5px;
              border-radius: 4px;
              cursor: pointer;
            ">IMPRIMIR</button>
            <button id="closeReceiptBtn" style="
              background: #dc3545; 
              color: white; 
              border: none; 
              padding: 10px 20px; 
              margin: 5px;
              border-radius: 4px;
              cursor: pointer;
            ">CERRAR</button>
          </div>
        </div>
      </div>
      
      <script>
        function showTab(type) {
          // Ocultar ambos recibos
          document.getElementById('receiptCliente').style.display = 'none';
          document.getElementById('receiptOperador').style.display = 'none';
          
          // Resetear botones
          document.getElementById('tabCliente').style.background = '#6c757d';
          document.getElementById('tabOperador').style.background = '#6c757d';
          
          // Mostrar el seleccionado
          if (type === 'cliente') {
            document.getElementById('receiptCliente').style.display = 'block';
            document.getElementById('tabCliente').style.background = '#007bff';
          } else {
            document.getElementById('receiptOperador').style.display = 'block';
            document.getElementById('tabOperador').style.background = '#007bff';
          }
        }
      </script>
    `;

    document.body.appendChild(receiptDiv);

    // Agregar event listener para el botón de cerrar
    const closeBtn = document.getElementById("closeReceiptBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        receiptDiv.remove();
        if (onClose) {
          onClose();
        }
      });
    }
  }
}
