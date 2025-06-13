import { CambioDivisa, Transferencia } from '../types';

export interface ReceiptData {
  numeroRecibo: string;
  fecha: string;
  tipo: string;
  puntoAtencion: string;
  usuario: string;
  detalles: any;
}

export class ReceiptService {
  static generateReceiptNumber(tipo: string): string {
    const timestamp = Date.now();
    const prefix = {
      'CAMBIO_DIVISA': 'CD',
      'TRANSFERENCIA': 'TR',
      'MOVIMIENTO': 'MV',
      'DEPOSITO': 'DP',
      'RETIRO': 'RT'
    }[tipo] || 'RC';
    
    return `${prefix}-${timestamp}`;
  }

  static generateCurrencyExchangeReceipt(exchange: CambioDivisa, puntoNombre: string, usuarioNombre: string): ReceiptData {
    return {
      numeroRecibo: exchange.numero_recibo || this.generateReceiptNumber('CAMBIO_DIVISA'),
      fecha: new Date(exchange.fecha).toLocaleString(),
      tipo: 'CAMBIO DE DIVISA',
      puntoAtencion: puntoNombre,
      usuario: usuarioNombre,
      detalles: {
        tipoOperacion: exchange.tipo_operacion,
        montoOrigen: exchange.monto_origen,
        monedaOrigen: exchange.monedaOrigen?.codigo || '',
        montoDestino: exchange.monto_destino,
        monedaDestino: exchange.monedaDestino?.codigo || '',
        tasaCambio: exchange.tasa_cambio,
        observacion: exchange.observacion
      }
    };
  }

  static generateTransferReceipt(transfer: Transferencia, puntoNombre: string, usuarioNombre: string): ReceiptData {
    return {
      numeroRecibo: transfer.numero_recibo || this.generateReceiptNumber('TRANSFERENCIA'),
      fecha: new Date(transfer.fecha).toLocaleString(),
      tipo: 'TRANSFERENCIA',
      puntoAtencion: puntoNombre,
      usuario: usuarioNombre,
      detalles: {
        tipoTransferencia: transfer.tipo_transferencia,
        monto: transfer.monto,
        moneda: transfer.moneda?.codigo || '',
        origen: transfer.origen?.nombre || 'Matriz',
        destino: transfer.destino?.nombre || '',
        estado: transfer.estado,
        descripcion: transfer.descripcion
      }
    };
  }

  static formatReceiptForPrinting(receipt: ReceiptData): string {
    const separator = '================================';
    const halfSeparator = '----------------';
    
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

    if (receipt.tipo === 'CAMBIO DE DIVISA') {
      receiptText += `
Operación: ${receipt.detalles.tipoOperacion}
Entrega: ${receipt.detalles.montoOrigen} ${receipt.detalles.monedaOrigen}
Recibe: ${receipt.detalles.montoDestino} ${receipt.detalles.monedaDestino}
Tasa: ${receipt.detalles.tasaCambio}
${receipt.detalles.observacion ? `Obs: ${receipt.detalles.observacion}` : ''}
`;
    } else if (receipt.tipo === 'TRANSFERENCIA') {
      receiptText += `
Tipo: ${receipt.detalles.tipoTransferencia}
Monto: ${receipt.detalles.monto} ${receipt.detalles.moneda}
${receipt.detalles.origen !== 'Matriz' ? `Origen: ${receipt.detalles.origen}` : ''}
Destino: ${receipt.detalles.destino}
Estado: ${receipt.detalles.estado}
${receipt.detalles.descripcion ? `Desc: ${receipt.detalles.descripcion}` : ''}
`;
    }

    receiptText += `
${separator}
Gracias por su preferencia
${separator}

`;

    return receiptText;
  }

  static printReceipt(receiptData: ReceiptData, copies: number = 2): void {
    const formattedReceipt = this.formatReceiptForPrinting(receiptData);
    
    // En un entorno real, aquí se enviaría a la impresora térmica
    console.log('Imprimiendo recibo:');
    console.log(formattedReceipt);
    
    // Simular impresión de múltiples copias
    for (let i = 1; i <= copies; i++) {
      console.log(`--- Copia ${i} ---`);
      if (window && 'print' in window) {
        // Crear una ventana temporal para imprimir
        const printWindow = window.open('', '_blank');
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
                <script>window.print(); window.close();</script>
              </body>
            </html>
          `);
        }
      }
    }
  }
}
