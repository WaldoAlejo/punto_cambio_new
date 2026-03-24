/**
 * CierresAdminMejorado.tsx
 * 
 * Dashboard mejorado para administradores que muestra:
 * - Estado de cierres de todos los puntos
 * - Quién cerró y quién no
 * - Diferencias detectadas
 * - Reportes imprimibles por punto
 */

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Printer,
  Eye,
  MapPin,
  Clock,
  User,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { format, subDays, addDays, isToday, isYesterday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import axiosInstance from "@/services/axiosInstance";
import { toast } from "@/hooks/use-toast";
import { cierreReporteService, ReporteCierreAdmin } from "@/services/cierreReporteService";

interface DetalleCierre {
  moneda_codigo: string;
  moneda_nombre: string;
  saldo_apertura: number;
  saldo_cierre: number;
  conteo_fisico: number;
  diferencia: number;
  billetes: number;
  monedas: number;
}

interface PuntoCierre {
  punto_id: string;
  punto_nombre: string;
  ciudad: string;
  tiene_cierre: boolean;
  cierre?: {
    cuadre_id: string;
    usuario_id: string;
    usuario_nombre: string;
    fecha_cierre: string;
    estado: string;
    observaciones: string | null;
    detalles: DetalleCierre[];
    totales: {
      ingresos: number;
      egresos: number;
    };
  };
  jornada?: {
    hora_inicio: string;
    hora_salida: string | null;
    estado: string;
  };
}

function n2(v?: unknown): string {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return n.toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CierresAdminMejorado() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReporteCierreAdmin | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(subDays(new Date(), 1));
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<PuntoCierre | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const fetchData = async (date?: Date) => {
    setLoading(true);
    setError(null);
    try {
      const fechaConsulta = date || selectedDate;
      const fechaStr = format(fechaConsulta, "yyyy-MM-dd");
      
      const result = await cierreReporteService.getReporteAdmin(fechaStr);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error(result.error || "Error desconocido");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar el resumen de cierres"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const handlePrintCierre = async (punto: PuntoCierre) => {
    if (!punto.cierre) return;
    
    setPrintingId(punto.punto_id);
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "No se pudo abrir la ventana de impresión",
          variant: "destructive",
        });
        return;
      }

      const fechaHora = format(parseISO(punto.cierre.fecha_cierre), "dd/MM/yyyy HH:mm:ss");
      const fechaSolo = format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: es });

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reporte de Cierre - ${punto.punto_nombre}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
      .no-print { display: none; }
    }
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 5px 0; color: #666; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
    .info-item { padding: 10px; background: #f5f5f5; border-radius: 5px; text-align: center; }
    .info-label { font-weight: bold; color: #555; font-size: 11px; text-transform: uppercase; }
    .info-value { font-size: 14px; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; }
    td:first-child, th:first-child { text-align: left; }
    .diferencia-positiva { color: #16a34a; font-weight: bold; }
    .diferencia-negativa { color: #dc2626; font-weight: bold; }
    .totales { background: #f9fafb; font-weight: bold; }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; margin-bottom: 10px; color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; }
    .firma-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 50px; }
    .firma-box { border-top: 1px solid #333; padding-top: 10px; text-align: center; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 5px; margin: 10px 0; }
    .success { background: #d1fae5; border: 1px solid #10b981; padding: 10px; border-radius: 5px; margin: 10px 0; }
    .no-print { margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px; text-align: center; }
    .btn { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px; margin: 0 5px; }
    .btn:hover { background: #1d4ed8; }
    .btn-secondary { background: #6b7280; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn" onclick="window.print(); setTimeout(()=>window.close(), 500)">🖨️ Imprimir / Guardar PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">✕ Cerrar</button>
  </div>

  <div class="header">
    <h1>🧾 REPORTE DE CIERRE DE CAJA</h1>
    <p><strong>${punto.punto_nombre}</strong> - ${punto.ciudad}</p>
    <p>Fecha: ${fechaSolo}</p>
  </div>

  <div class="success">
    <strong>✅ Cierre Completado</strong> - Este punto de atención realizó el cierre correctamente.
  </div>

  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">Operador</div>
      <div class="info-value">${punto.cierre.usuario_nombre}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Hora de Cierre</div>
      <div class="info-value">${fechaHora}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Estado</div>
      <div class="info-value">
        <span class="badge badge-success">${punto.cierre.estado}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📊 Detalle por Divisa</div>
    <table>
      <thead>
        <tr>
          <th>Divisa</th>
          <th>Apertura</th>
          <th>Saldo Teórico</th>
          <th>Conteo Físico</th>
          <th>Billetes</th>
          <th>Monedas</th>
          <th>Diferencia</th>
        </tr>
      </thead>
      <tbody>
        ${punto.cierre.detalles.map(d => {
          const diffClass = d.diferencia > 0 ? 'diferencia-positiva' : d.diferencia < 0 ? 'diferencia-negativa' : '';
          const badgeClass = Math.abs(d.diferencia) > (d.moneda_codigo === 'USD' ? 1 : 0.01) ? 'badge-warning' : 'badge-success';
          return `
        <tr>
          <td><strong>${d.moneda_codigo}</strong><br><small>${d.moneda_nombre}</small></td>
          <td>${n2(d.saldo_apertura)}</td>
          <td>${n2(d.saldo_cierre)}</td>
          <td><strong>${n2(d.conteo_fisico)}</strong></td>
          <td>${n2(d.billetes)}</td>
          <td>${n2(d.monedas)}</td>
          <td class="${diffClass}">
            ${d.diferencia > 0 ? '+' : ''}${n2(d.diferencia)}
            ${Math.abs(d.diferencia) > 0.01 ? `<br><span class="badge ${badgeClass}">REVISAR</span>` : ''}
          </td>
        </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">💰 Totales del Día</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Total Ingresos</div>
        <div class="info-value" style="color: #16a34a; font-size: 18px;">$${n2(punto.cierre.totales.ingresos)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Total Egresos</div>
        <div class="info-value" style="color: #dc2626; font-size: 18px;">$${n2(punto.cierre.totales.egresos)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Neto</div>
        <div class="info-value" style="font-size: 18px;">$${n2(punto.cierre.totales.ingresos - punto.cierre.totales.egresos)}</div>
      </div>
    </div>
  </div>

  ${punto.cierre.observaciones ? `
  <div class="section">
    <div class="section-title">📝 Observaciones del Operador</div>
    <p style="background: #f9fafb; padding: 10px; border-radius: 5px; white-space: pre-wrap;">${punto.cierre.observaciones}</p>
  </div>
  ` : ''}

  <div class="firma-grid">
    <div class="firma-box">
      <p><strong>Operador</strong></p>
      <p style="font-size: 12px; color: #666;">${punto.cierre.usuario_nombre}</p>
    </div>
    <div class="firma-box">
      <p><strong>Supervisor</strong></p>
      <p style="font-size: 12px; color: #666;">Firma y sello</p>
    </div>
    <div class="firma-box">
      <p><strong>Administración</strong></p>
      <p style="font-size: 12px; color: #666;">Vo. Bo.</p>
    </div>
  </div>

  <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px;">
    Documento generado el ${new Date().toLocaleString()} | Sistema Punto Cambio | Reporte de Cierre de Caja
  </div>
</body>
</html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error("Error al imprimir:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el reporte",
        variant: "destructive",
      });
    } finally {
      setPrintingId(null);
    }
  };

  const formatFecha = (fechaStr: string) => {
    try {
      const [year, month, day] = fechaStr.split('-').map(Number);
      const dateObj = new Date(Date.UTC(year, month - 1, day));
      return format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: es });
    } catch {
      return fechaStr;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => fetchData()} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const puntosConCierre = data.puntos.filter((p) => p.tiene_cierre);
  const puntosSinCierre = data.puntos.filter((p) => !p.tiene_cierre);
  const puntosConDiferencias = data.puntos.filter(
    (p) => p.cierre?.detalles.some((d) => Math.abs(d.diferencia) > (d.moneda_codigo === "USD" ? 1 : 0.01))
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Control de Cierres de Caja
          </h1>
          <p className="text-gray-600 mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {formatFecha(data.fecha_consultada)}
            {isToday(parseISO(data.fecha_consultada)) && (
              <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                Hoy
              </Badge>
            )}
            {isYesterday(parseISO(data.fecha_consultada)) && (
              <Badge variant="outline" className="ml-2 bg-gray-50 text-gray-700 border-gray-200">
                Ayer
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(subDays(new Date(), 1))}
              className="px-3 text-sm font-medium"
              disabled={isYesterday(selectedDate)}
            >
              Ayer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="h-8 w-8 p-0"
              disabled={isToday(selectedDate)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => fetchData()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Puntos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.estadisticas.total_puntos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-600">
              Con Cierre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {data.estadisticas.puntos_con_cierre}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-600">
              Sin Cierre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {data.estadisticas.puntos_sin_cierre}
            </div>
            {data.estadisticas.puntos_sin_cierre > 0 && (
              <p className="text-xs text-red-500 mt-1">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Requieren atención
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Cumplimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {data.estadisticas.porcentaje_cumplimiento}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta si hay puntos sin cierre */}
      {puntosSinCierre.length > 0 && (
        <Alert variant="destructive" className="bg-red-50 border-red-300">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-red-800">
            ⚠️ Hay {puntosSinCierre.length} punto(s) sin realizar el cierre
          </AlertTitle>
          <AlertDescription className="text-red-700">
            Los siguientes puntos no han cerrado caja: {puntosSinCierre.map(p => p.punto_nombre).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="todos" className="w-full">
        <TabsList>
          <TabsTrigger value="todos">
            Todos ({data.puntos.length})
          </TabsTrigger>
          <TabsTrigger value="con-cierre" className="text-green-700">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Con Cierre ({puntosConCierre.length})
          </TabsTrigger>
          <TabsTrigger value="sin-cierre" className="text-red-700">
            <XCircle className="h-4 w-4 mr-1" />
            Sin Cierre ({puntosSinCierre.length})
          </TabsTrigger>
          {puntosConDiferencias.length > 0 && (
            <TabsTrigger value="con-diferencias" className="text-amber-700">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Con Diferencias ({puntosConDiferencias.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="todos" className="mt-4">
          <TablaCierres 
            puntos={data.puntos} 
            onVerDetalle={setPuntoSeleccionado}
            onPrint={handlePrintCierre}
            printingId={printingId}
          />
        </TabsContent>

        <TabsContent value="con-cierre" className="mt-4">
          <TablaCierres 
            puntos={puntosConCierre} 
            onVerDetalle={setPuntoSeleccionado}
            onPrint={handlePrintCierre}
            printingId={printingId}
          />
        </TabsContent>

        <TabsContent value="sin-cierre" className="mt-4">
          <TablaCierres 
            puntos={puntosSinCierre} 
            onVerDetalle={setPuntoSeleccionado}
            onPrint={handlePrintCierre}
            printingId={printingId}
          />
        </TabsContent>

        {puntosConDiferencias.length > 0 && (
          <TabsContent value="con-diferencias" className="mt-4">
            <TablaCierres 
              puntos={puntosConDiferencias} 
              onVerDetalle={setPuntoSeleccionado}
              onPrint={handlePrintCierre}
              printingId={printingId}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Modal de Detalle */}
      {puntoSeleccionado && (
        <Dialog open={!!puntoSeleccionado} onOpenChange={() => setPuntoSeleccionado(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {puntoSeleccionado.punto_nombre}
              </DialogTitle>
            </DialogHeader>
            
            {puntoSeleccionado.tiene_cierre && puntoSeleccionado.cierre ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Operador:</span>
                    <span className="font-medium">{puntoSeleccionado.cierre.usuario_nombre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Cierre:</span>
                    <span className="font-medium">
                      {format(parseISO(puntoSeleccionado.cierre.fecha_cierre), "HH:mm:ss")}
                    </span>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Divisa</TableHead>
                      <TableHead className="text-right">Apertura</TableHead>
                      <TableHead className="text-right">Teórico</TableHead>
                      <TableHead className="text-right">Conteo</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {puntoSeleccionado.cierre.detalles.map((d) => {
                      const tol = d.moneda_codigo === "USD" ? 1 : 0.01;
                      const fueraTol = Math.abs(d.diferencia) > tol;
                      return (
                        <TableRow key={d.moneda_codigo} className={fueraTol ? "bg-red-50" : ""}>
                          <TableCell>
                            <div className="font-medium">{d.moneda_codigo}</div>
                            <div className="text-xs text-gray-500">{d.moneda_nombre}</div>
                          </TableCell>
                          <TableCell className="text-right">{n2(d.saldo_apertura)}</TableCell>
                          <TableCell className="text-right">{n2(d.saldo_cierre)}</TableCell>
                          <TableCell className="text-right font-medium">{n2(d.conteo_fisico)}</TableCell>
                          <TableCell className={`text-right font-bold ${d.diferencia > 0 ? 'text-green-600' : d.diferencia < 0 ? 'text-red-600' : ''}`}>
                            {d.diferencia > 0 ? '+' : ''}{n2(d.diferencia)}
                          </TableCell>
                          <TableCell className="text-center">
                            {fueraTol ? (
                              <Badge variant="destructive">Revisar</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-100">OK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {puntoSeleccionado.cierre.observaciones && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Observaciones del Operador</h4>
                    <p className="text-sm text-gray-700">{puntoSeleccionado.cierre.observaciones}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => handlePrintCierre(puntoSeleccionado)} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Imprimir Reporte
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <XCircle className="h-16 w-16 text-red-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Sin Cierre</h3>
                <p className="text-gray-500 mt-2">
                  Este punto de atención no ha realizado el cierre de caja para la fecha seleccionada.
                </p>
                {puntoSeleccionado.jornada && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg inline-block text-left">
                    <p className="text-sm">
                      <strong>Inicio de jornada:</strong>{" "}
                      {format(parseISO(puntoSeleccionado.jornada.hora_inicio), "HH:mm:ss")}
                    </p>
                    <p className="text-sm">
                      <strong>Estado:</strong>{" "}
                      <Badge variant={puntoSeleccionado.jornada.estado === "COMPLETADO" ? "default" : "destructive"}>
                        {puntoSeleccionado.jornada.estado}
                      </Badge>
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Sub-componente para la tabla
interface TablaCierresProps {
  puntos: PuntoCierre[];
  onVerDetalle: (punto: PuntoCierre) => void;
  onPrint: (punto: PuntoCierre) => void;
  printingId: string | null;
}

function TablaCierres({ puntos, onVerDetalle, onPrint, printingId }: TablaCierresProps) {
  if (puntos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-300" />
        <p>No hay puntos en esta categoría</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead>
              <TableHead>Punto de Atención</TableHead>
              <TableHead>Operador</TableHead>
              <TableHead>Hora Cierre</TableHead>
              <TableHead className="text-right">Divisas</TableHead>
              <TableHead className="text-center">Diferencias</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {puntos.map((punto) => {
              const diferencias = punto.cierre?.detalles.filter(
                (d) => Math.abs(d.diferencia) > (d.moneda_codigo === "USD" ? 1 : 0.01)
              ) || [];
              
              return (
                <TableRow 
                  key={punto.punto_id}
                  className={!punto.tiene_cierre ? "bg-red-50" : diferencias.length > 0 ? "bg-amber-50" : ""}
                >
                  <TableCell>
                    {punto.tiene_cierre ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Cerrado
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Pendiente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{punto.punto_nombre}</div>
                    <div className="text-xs text-gray-500">{punto.ciudad}</div>
                  </TableCell>
                  <TableCell>
                    {punto.cierre?.usuario_nombre || "-"}
                  </TableCell>
                  <TableCell>
                    {punto.cierre ? (
                      format(parseISO(punto.cierre.fecha_cierre), "HH:mm:ss")
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {punto.cierre ? (
                      <span className="font-medium">{punto.cierre.detalles.length}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {punto.cierre ? (
                      diferencias.length > 0 ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {diferencias.length}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100">
                          Ninguna
                        </Badge>
                      )
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onVerDetalle(punto)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {punto.cierre && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPrint(punto)}
                          disabled={printingId === punto.punto_id}
                        >
                          {printingId === punto.punto_id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
