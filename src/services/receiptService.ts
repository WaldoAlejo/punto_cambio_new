// src/services/receiptService.ts
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

type ServientregaDetails = {
  numeroGuia: string;
  producto: string;
  origen: {
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: string;
  };
  destino: {
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: string;
  };
  paquete: {
    peso: number;
    largo: number;
    ancho: number;
    alto: number;
    valorDeclarado: number;
  };
  costos: {
    flete: number;
    empaque: number;
    empaqueIva: number;
    totalEmpaque: number;
    prima: number;
    iva: number;
    descuento: number;
    total: number;
  };
  tiempoEntrega: string;
  trayecto: string;
  observaciones?: string;
};

export type ReceiptDetails =
  | CurrencyExchangeDetails
  | TransferDetails
  | ServientregaDetails;

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
        SERVIENTREGA: "SG",
        ABONO_PARCIAL: "AP",
        COMPLETAR_CAMBIO: "CC",
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
        ? Number(partialData.initialPayment)
        : Number(exchange.monto_destino);

    const observacionCompleta =
      isInitialPayment && partialData
        ? `ABONO PARCIAL: ${partialData.initialPayment.toLocaleString()} ${
            exchange.monedaDestino?.codigo ?? ""
          }. Pendiente: ${partialData.pendingBalance.toLocaleString()} ${
            exchange.monedaDestino?.codigo ?? ""
          }. Recibido por: ${partialData.receivedBy}. ${
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
        montoDestino: Number(montoMostrar) || 0,
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
        monto: Number(transfer.monto) || 0,
        moneda: transfer.moneda?.nombre || transfer.moneda?.codigo || "",
        origen: transfer.origen?.nombre || "Matriz",
        destino: transfer.destino?.nombre || "",
        estado: transfer.estado,
        descripcion: transfer.descripcion,
      },
    };
  }

  static generateServientregaReceipt(
    guiaData: any,
    tarifaData: any,
    puntoNombre: string,
    usuarioNombre: string,
    numeroRecibo?: string
  ): ReceiptData {
    return {
      numeroRecibo: numeroRecibo || this.generateReceiptNumber("SERVIENTREGA"),
      fecha: new Date().toLocaleString(),
      tipo: "GUÍA SERVIENTREGA",
      puntoAtencion: puntoNombre,
      usuario: usuarioNombre,
      detalles: {
        numeroGuia: guiaData?.numero_guia || "N/A",
        producto: guiaData?.nombre_producto || "PAQUETE",
        origen: {
          nombre: guiaData?.remitente?.nombre || "",
          direccion: guiaData?.remitente?.direccion || "",
          ciudad: guiaData?.remitente?.ciudad || "",
          telefono: guiaData?.remitente?.telefono || "",
        },
        destino: {
          nombre: guiaData?.destinatario?.nombre || "",
          direccion: guiaData?.destinatario?.direccion || "",
          ciudad: guiaData?.destinatario?.ciudad || "",
          telefono: guiaData?.destinatario?.telefono || "",
        },
        paquete: {
          peso: Number(guiaData?.medidas?.peso || 0),
          largo: Number(guiaData?.medidas?.largo || 0),
          ancho: Number(guiaData?.medidas?.ancho || 0),
          alto: Number(guiaData?.medidas?.alto || 0),
          valorDeclarado: Number(guiaData?.medidas?.valor_declarado || 0),
        },
        costos: {
          flete: Number(tarifaData?.flete || 0),
          empaque: Number(tarifaData?.valor_empaque || 0),
          empaqueIva: Number(tarifaData?.valor_empaque_iva || 0),
          totalEmpaque: Number(tarifaData?.total_empaque || 0),
          prima: Number(tarifaData?.prima || 0),
          iva: Number(tarifaData?.tiva || 0),
          descuento: Number(tarifaData?.descuento || 0),
          total: Number(
            tarifaData?.total_transacion || tarifaData?.gtotal || 0
          ),
        },
        tiempoEntrega: tarifaData?.tiempo
          ? `${tarifaData.tiempo} día${tarifaData.tiempo === "1" ? "" : "s"}`
          : "1-2 días",
        trayecto: tarifaData?.trayecto || "NACIONAL",
        observaciones: guiaData?.observaciones || null,
      },
    };
  }

  static formatReceiptForPrinting(
    receipt: ReceiptData,
    copyType: "cliente" | "operador" = "cliente"
  ): string {
    // Formato optimizado para impresoras térmicas (48+ caracteres)
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
    } else if (receipt.tipo === "GUÍA SERVIENTREGA") {
      const detalles = receipt.detalles as ServientregaDetails;
      receiptText += `
GUÍA SERVIENTREGA: ${detalles.numeroGuia}
PRODUCTO: ${detalles.producto}
${halfSeparator}
REMITENTE:
${detalles.origen.nombre}
${detalles.origen.direccion}
${detalles.origen.ciudad}
Tel: ${detalles.origen.telefono}
${halfSeparator}
DESTINATARIO:
${detalles.destino.nombre}
${detalles.destino.direccion}
${detalles.destino.ciudad}
Tel: ${detalles.destino.telefono}
${halfSeparator}
PAQUETE:
Peso: ${detalles.paquete.peso.toFixed(2)} kg
Dimensiones: ${detalles.paquete.largo}x${detalles.paquete.ancho}x${
        detalles.paquete.alto
      } cm
Valor declarado: $${detalles.paquete.valorDeclarado.toFixed(2)}
${halfSeparator}
COSTOS:
Flete: $${detalles.costos.flete.toFixed(2)}
Empaque: $${detalles.costos.empaque.toFixed(2)}
IVA empaque: $${detalles.costos.empaqueIva.toFixed(2)}
Prima (seguro): $${detalles.costos.prima.toFixed(2)}
IVA: $${detalles.costos.iva.toFixed(2)}
${
  detalles.costos.descuento > 0
    ? `Descuento: -$${detalles.costos.descuento.toFixed(2)}`
    : ""
}
${halfSeparator}
TOTAL PAGADO: $${detalles.costos.total.toFixed(2)}
${halfSeparator}
ENTREGA: ${detalles.tiempoEntrega}
TRAYECTO: ${detalles.trayecto}
${
  detalles.observaciones
    ? `${halfSeparator}\nOBSERVACIONES: ${detalles.observaciones}`
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
  receipt.tipo.includes("CAMBIO")
    ? `${(receipt.detalles as CurrencyExchangeDetails).cliente.nombre} ${
        (receipt.detalles as CurrencyExchangeDetails).cliente.apellido
      }
Doc: ${(receipt.detalles as CurrencyExchangeDetails).cliente.cedula}`
    : receipt.tipo === "GUÍA SERVIENTREGA"
    ? `${(receipt.detalles as ServientregaDetails).origen.nombre}
Tel: ${(receipt.detalles as ServientregaDetails).origen.telefono}`
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

    return receiptText.trim();
  }

  static printReceipt(receiptData: ReceiptData, copies: number = 2): void {
    // En un entorno real, aquí se enviaría a la impresora térmica
    // (dejamos logs para debug)
    console.log("Imprimiendo recibo:");
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

            const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Recibo ${receiptData.numeroRecibo} - Copia ${copyLabel}</title>
  <style>
    body { 
      font-family: "Courier New", monospace; 
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
  <div class="receipt">${this.escapeHtml(formattedReceipt).replace(
    /\n/g,
    "<br/>"
  )}</div>
</body>
</html>`;

            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();

            printWindow.onload = () => {
              try {
                printWindow.focus();
                printWindow.print();
                setTimeout(() => {
                  printWindow.close();
                }, 500);
              } catch (e) {
                console.error("Error al imprimir:", e);
              }
            };
          } else {
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
    const clienteReceipt = this.formatReceiptForPrinting(
      receiptData,
      "cliente"
    );
    const operadorReceipt = this.formatReceiptForPrinting(
      receiptData,
      "operador"
    );

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
            <button id="tabCliente" style="
              background: #007bff; 
              color: white; 
              border: none; 
              padding: 8px 16px; 
              margin: 2px;
              border-radius: 4px;
              cursor: pointer;
            ">COPIA CLIENTE</button>
            <button id="tabOperador" style="
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
          "></div>
          
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
          "></div>
          
          <div style="text-align: center;">
            <button id="printBtn" style="
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
    `;

    document.body.appendChild(receiptDiv);

    // Colocamos el texto ya formateado (preservando saltos)
    const clienteEl =
      receiptDiv.querySelector<HTMLDivElement>("#receiptCliente");
    const operadorEl =
      receiptDiv.querySelector<HTMLDivElement>("#receiptOperador");
    if (clienteEl) clienteEl.textContent = clienteReceipt; // evita inyectar HTML
    if (operadorEl) operadorEl.textContent = operadorReceipt; // evita inyectar HTML

    const tabCliente =
      receiptDiv.querySelector<HTMLButtonElement>("#tabCliente");
    const tabOperador =
      receiptDiv.querySelector<HTMLButtonElement>("#tabOperador");
    const printBtn = receiptDiv.querySelector<HTMLButtonElement>("#printBtn");
    const closeBtn =
      receiptDiv.querySelector<HTMLButtonElement>("#closeReceiptBtn");

    const showTab = (type: "cliente" | "operador") => {
      if (!clienteEl || !operadorEl || !tabCliente || !tabOperador) return;
      const active = type === "cliente" ? clienteEl : operadorEl;
      const inactive = type === "cliente" ? operadorEl : clienteEl;
      active.style.display = "block";
      inactive.style.display = "none";
      tabCliente.style.background = type === "cliente" ? "#007bff" : "#6c757d";
      tabOperador.style.background =
        type === "operador" ? "#007bff" : "#6c757d";
    };

    if (tabCliente)
      tabCliente.addEventListener("click", () => showTab("cliente"));
    if (tabOperador)
      tabOperador.addEventListener("click", () => showTab("operador"));
    if (printBtn) printBtn.addEventListener("click", () => window.print());
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        receiptDiv.remove();
        if (onClose) onClose();
      });
    }
  }

  /** Escapa HTML básico para evitar que caracteres especiales rompan el documento al imprimir */
  private static escapeHtml(text: string): string {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
