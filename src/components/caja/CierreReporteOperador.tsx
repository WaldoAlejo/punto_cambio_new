/**
 * CierreReporteOperador.tsx
 * 
 * Componente que muestra un reporte completo del cierre de caja
 * para que el operador revise ANTES de confirmar el cierre definitivo.
 * 
 * Esto permite la "primera verificación" solicitada por el administrador.
 */

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Printer,
  AlertCircle,
  CheckCircle,
  FileText,
  Calculator,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DetalleCierre {
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  saldo_apertura: number;
  ingresos_periodo: number;
  egresos_periodo: number;
  saldo_cierre: number;
  conteo_fisico: number;
  billetes: number;
  monedas: number;
  bancos_teorico?: number;
  conteo_bancos?: number;
  diferencia: number;
  diferencia_bancos?: number;
  movimientos_periodo: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  detalles: DetalleCierre[];
  observaciones: string;
  puntoNombre: string;
  operadorNombre: string;
  loading?: boolean;
}

function n2(v?: unknown): string {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return n.toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CierreReporteOperador({
  open,
  onClose,
  onConfirm,
  detalles,
  observaciones,
  puntoNombre,
  operadorNombre,
  loading = false,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);

  // Validaciones
  const validaciones = detalles.map((d) => {
    const tol = d.codigo === "USD" ? 1.0 : 0.01;
    const diffEfectivo = Math.abs(d.diferencia);
    const diffBancos = Math.abs(d.diferencia_bancos || 0);
    const desgloseOk = Math.abs((d.billetes + d.monedas) - d.conteo_fisico) <= 0.01;
    
    return {
      moneda_id: d.moneda_id,
      codigo: d.codigo,
      efectivoOk: diffEfectivo <= tol,
      bancosOk: diffBancos <= tol,
      desgloseOk,
      completado: d.conteo_fisico > 0 || d.movimientos_periodo === 0,
    };
  });

  const todasValidas = validaciones.every((v) => 
    v.efectivoOk && v.bancosOk && v.desgloseOk && v.completado
  );

  const hayIncompletos = validaciones.some((v) => !v.completado);
  const hayDiferencias = validaciones.some((v) => !v.efectivoOk || !v.bancosOk);
  const hayDesgloseInvalido = validaciones.some((v) => !v.desgloseOk);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const fechaHora = format(new Date(), "dd/MM/yyyy HH:mm:ss");
    const fechaSolo = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reporte de Cierre de Caja - ${puntoNombre}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
      .no-print { display: none; }
    }
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0; color: #666; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .info-item { padding: 10px; background: #f5f5f5; border-radius: 5px; }
    .info-label { font-weight: bold; color: #555; font-size: 12px; }
    .info-value { font-size: 14px; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 12px; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; }
    td:first-child, th:first-child { text-align: left; }
    .diferencia-positiva { color: #16a34a; }
    .diferencia-negativa { color: #dc2626; }
    .totales { background: #f9fafb; font-weight: bold; }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; margin-bottom: 10px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    .firma-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
    .firma-box { border-top: 1px solid #333; padding-top: 10px; text-align: center; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 5px; margin: 10px 0; }
    .error { background: #fee2e2; border: 1px solid #ef4444; padding: 10px; border-radius: 5px; margin: 10px 0; }
    .success { background: #d1fae5; border: 1px solid #10b981; padding: 10px; border-radius: 5px; margin: 10px 0; }
    .no-print { margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px; text-align: center; }
    .btn { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px; margin: 0 5px; }
    .btn:hover { background: #1d4ed8; }
    .btn-secondary { background: #6b7280; }
    .btn-secondary:hover { background: #4b5563; }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn" onclick="window.print(); setTimeout(()=>window.close(), 500)">🖨️ Imprimir / Guardar PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">✕ Cerrar</button>
  </div>

  <div class="header">
    <h1>🧾 REPORTE DE CIERRE DE CAJA</h1>
    <p>Punto de Atención: <strong>${puntoNombre}</strong></p>
    <p>Fecha: ${fechaSolo}</p>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">Operador</div>
      <div class="info-value">${operadorNombre}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Fecha y Hora de Cierre</div>
      <div class="info-value">${fechaHora}</div>
    </div>
  </div>

  ${!todasValidas ? `
  <div class="${hayDiferencias ? 'error' : 'warning'}">
    <strong>⚠️ Validaciones Pendientes:</strong>
    <ul>
      ${hayIncompletos ? '<li>Hay monedas sin conteo físico registrado</li>' : ''}
      ${hayDiferencias ? '<li>Hay diferencias fuera de la tolerancia permitida</li>' : ''}
      ${hayDesgloseInvalido ? '<li>El desglose de billetes + monedas no coincide con el conteo físico</li>' : ''}
    </ul>
  </div>
  ` : `
  <div class="success">
    <strong>✅ Todas las validaciones pasaron correctamente</strong>
  </div>
  `}

  <div class="section">
    <div class="section-title">📊 Detalle por Divisa</div>
    <table>
      <thead>
        <tr>
          <th>Divisa</th>
          <th>Apertura</th>
          <th>Ingresos</th>
          <th>Egresos</th>
          <th>Teórico</th>
          <th>Conteo Físico</th>
          <th>Billetes</th>
          <th>Monedas</th>
          <th>Diferencia</th>
        </tr>
      </thead>
      <tbody>
        ${detalles.map(d => {
          const diffClass = d.diferencia > 0 ? 'diferencia-positiva' : d.diferencia < 0 ? 'diferencia-negativa' : '';
          return `
        <tr>
          <td><strong>${d.codigo}</strong> ${d.simbolo}<br><small>${d.nombre}</small></td>
          <td>${n2(d.saldo_apertura)}</td>
          <td>${n2(d.ingresos_periodo)}</td>
          <td>${n2(d.egresos_periodo)}</td>
          <td>${n2(d.saldo_cierre)}</td>
          <td><strong>${n2(d.conteo_fisico)}</strong></td>
          <td>${n2(d.billetes)}</td>
          <td>${n2(d.monedas)}</td>
          <td class="${diffClass}">${d.diferencia > 0 ? '+' : ''}${n2(d.diferencia)}</td>
        </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  ${detalles.some(d => d.bancos_teorico !== undefined) ? `
  <div class="section">
    <div class="section-title">🏦 Detalle de Bancos</div>
    <table>
      <thead>
        <tr>
          <th>Divisa</th>
          <th>Teórico Bancos</th>
          <th>Conteo Bancos</th>
          <th>Diferencia</th>
        </tr>
      </thead>
      <tbody>
        ${detalles.filter(d => d.bancos_teorico !== undefined).map(d => {
          const diffBancos = (d.conteo_bancos || 0) - (d.bancos_teorico || 0);
          const diffClass = diffBancos > 0 ? 'diferencia-positiva' : diffBancos < 0 ? 'diferencia-negativa' : '';
          return `
        <tr>
          <td><strong>${d.codigo}</strong></td>
          <td>${n2(d.bancos_teorico)}</td>
          <td>${n2(d.conteo_bancos)}</td>
          <td class="${diffClass}">${diffBancos > 0 ? '+' : ''}${n2(diffBancos)}</td>
        </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${observaciones ? `
  <div class="section">
    <div class="section-title">📝 Observaciones</div>
    <p style="background: #f9fafb; padding: 10px; border-radius: 5px;">${observaciones.replace(/\n/g, '<br>')}</p>
  </div>
  ` : ''}

  <div class="firma-grid">
    <div class="firma-box">
      <p><strong>Firma del Operador</strong></p>
      <p style="font-size: 12px; color: #666;">${operadorNombre}</p>
    </div>
    <div class="firma-box">
      <p><strong>Vo. Bo. Supervisor</strong></p>
      <p style="font-size: 12px; color: #666;">Administración</p>
    </div>
  </div>

  <div style="margin-top: 30px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 10px;">
    Documento generado el ${fechaHora} | Sistema Punto Cambio
  </div>
</body>
</html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleConfirmar = () => {
    setConfirmando(true);
    onConfirm();
  };

  const totalIngresos = detalles.reduce((s, d) => s + (d.ingresos_periodo || 0), 0);
  const totalEgresos = detalles.reduce((s, d) => s + (d.egresos_periodo || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6 text-blue-600" />
            Reporte de Cierre de Caja
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">Punto de Atención</p>
              <p className="font-medium">{puntoNombre}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Operador</p>
              <p className="font-medium">{operadorNombre}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha</p>
              <p className="font-medium">
                {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              {todasValidas ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Listo para cerrar
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Validaciones pendientes
                </Badge>
              )}
            </div>
          </div>

          {/* Alertas */}
          {hayIncompletos && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Conteos incompletos</AlertTitle>
              <AlertDescription>
                Hay monedas sin conteo físico registrado. Debes ingresar el conteo de billetes y monedas para cada divisa.
              </AlertDescription>
            </Alert>
          )}

          {hayDiferencias && (
            <Alert variant="destructive" className="bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Diferencias fuera de tolerancia</AlertTitle>
              <AlertDescription>
                Hay diferencias que superan la tolerancia permitida (USD: ±$1.00, Otras: ±$0.01).
                Revisa los conteos o contacta al administrador.
              </AlertDescription>
            </Alert>
          )}

          {hayDesgloseInvalido && (
            <Alert className="bg-amber-50 border-amber-300">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">
                Desglose incorrecto
              </AlertTitle>
              <AlertDescription className="text-amber-700">
                El desglose de billetes + monedas no coincide con el conteo físico total.
              </AlertDescription>
            </Alert>
          )}

          {todasValidas && (
            <Alert className="bg-green-50 border-green-300">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">
                ✅ Primera Verificación Completada
              </AlertTitle>
              <AlertDescription className="text-green-700">
                Todos los conteos están correctos. Puedes imprimir este reporte y proceder con el cierre definitivo.
              </AlertDescription>
            </Alert>
          )}

          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <p className="text-sm text-blue-600">Total Ingresos</p>
              <p className="text-2xl font-bold text-blue-800">${n2(totalIngresos)}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <p className="text-sm text-red-600">Total Egresos</p>
              <p className="text-2xl font-bold text-red-800">${n2(totalEgresos)}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-sm text-green-600">Neto del Día</p>
              <p className="text-2xl font-bold text-green-800">${n2(totalIngresos - totalEgresos)}</p>
            </div>
          </div>

          {/* Tabla de Detalles */}
          <div className="section">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Detalle por Divisa
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Divisa</TableHead>
                    <TableHead className="text-right">Apertura</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Egresos</TableHead>
                    <TableHead className="text-right">Teórico</TableHead>
                    <TableHead className="text-right bg-yellow-50">Conteo Físico</TableHead>
                    <TableHead className="text-right">Billetes</TableHead>
                    <TableHead className="text-right">Monedas</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalles.map((d) => {
                    const val = validaciones.find((v) => v.moneda_id === d.moneda_id);
                    const diffClass = d.diferencia > 0 ? "text-green-600" : d.diferencia < 0 ? "text-red-600" : "";
                    
                    return (
                      <TableRow key={d.moneda_id} className={val?.efectivoOk ? "" : "bg-red-50"}>
                        <TableCell>
                          <div className="font-medium">{d.codigo} {d.simbolo}</div>
                          <div className="text-xs text-gray-500">{d.nombre}</div>
                        </TableCell>
                        <TableCell className="text-right">{n2(d.saldo_apertura)}</TableCell>
                        <TableCell className="text-right text-green-600">+{n2(d.ingresos_periodo)}</TableCell>
                        <TableCell className="text-right text-red-600">-{n2(d.egresos_periodo)}</TableCell>
                        <TableCell className="text-right font-medium">{n2(d.saldo_cierre)}</TableCell>
                        <TableCell className="text-right bg-yellow-50/50 font-bold">{n2(d.conteo_fisico)}</TableCell>
                        <TableCell className="text-right">{n2(d.billetes)}</TableCell>
                        <TableCell className="text-right">{n2(d.monedas)}</TableCell>
                        <TableCell className={`text-right font-bold ${diffClass}`}>
                          {d.diferencia > 0 ? "+" : ""}{n2(d.diferencia)}
                        </TableCell>
                        <TableCell className="text-center">
                          {val?.efectivoOk ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Rev.
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Observaciones */}
          {observaciones && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">📝 Observaciones</h3>
              <p className="text-sm whitespace-pre-wrap">{observaciones}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir Reporte
          </Button>
          <Button variant="outline" onClick={onClose}>
            Volver y Corregir
          </Button>
          <Button 
            onClick={handleConfirmar} 
            disabled={loading || confirmando || (!todasValidas && !confirmando)}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            {loading || confirmando ? (
              <>Procesando...</>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Confirmar Cierre Definitivo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
