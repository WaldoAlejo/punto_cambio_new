import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { format, subDays, addDays, isToday, isYesterday, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import axiosInstance from "@/services/axiosInstance";
import { toast } from "@/hooks/use-toast";
import { contabilidadDiariaService } from "@/services/contabilidadDiariaService";

interface SaldoDivisa {
  moneda_codigo: string;
  moneda_nombre: string;
  saldo_apertura: number;
  saldo_cierre: number;
  conteo_fisico: number;
  diferencia: number;
}

interface ResumenPunto {
  punto_id: string;
  punto_nombre: string;
  tiene_cierre: boolean;
  fecha_cierre?: string;
  hora_cierre?: string;
  usuario_cierre?: string;
  saldos_por_divisa: SaldoDivisa[];
}

interface Estadisticas {
  total_puntos: number;
  puntos_con_cierre: number;
  puntos_sin_cierre: number;
  porcentaje_cumplimiento: number;
}

interface Moneda {
  codigo: string;
  nombre: string;
}

interface ResumenResponse {
  success: boolean;
  data?: {
    fecha_consultada: string;
    estadisticas: Estadisticas;
    monedas_disponibles: Moneda[];
    resumen_por_punto: ResumenPunto[];
  };
  error?: string;
}

const CierresDiariosResumen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResumenResponse["data"] | null>(null);
  const [selectedMoneda, setSelectedMoneda] = useState<string>("TODAS");
  // Por defecto mostramos el DÍA ANTERIOR (así el admin ve los cierres del día que ya pasó)
  const [selectedDate, setSelectedDate] = useState<Date>(subDays(new Date(), 1));
  const [printingPoint, setPrintingPoint] = useState<string | null>(null);

  const fetchResumen = async (date?: Date) => {
    setLoading(true);
    setError(null);
    try {
      const fechaConsulta = date || selectedDate;
      const fechaStr = format(fechaConsulta, "yyyy-MM-dd");
      
      const { data: result } = await axiosInstance.get<ResumenResponse>(
        `/cierres-diarios/resumen-por-fecha?fecha=${fechaStr}`
      );

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
    fetchResumen();
  }, [selectedDate]);

  // Función para imprimir el balance de un punto específico
  const handlePrintBalance = async (puntoId: string, puntoNombre: string) => {
    setPrintingPoint(puntoId);
    try {
      const fechaStr = format(selectedDate, "yyyy-MM-dd");
      const resultado = await contabilidadDiariaService.getResumenCierre(puntoId, fechaStr);

      if (resultado.success && resultado.resumen) {
        printBalance(resultado.resumen, puntoNombre);
      } else {
        toast({
          title: "Error",
          description: resultado.error || "No se pudo obtener el balance",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al obtener balance:", error);
      toast({
        title: "Error",
        description: "Error al cargar el balance para imprimir",
        variant: "destructive",
      });
    } finally {
      setPrintingPoint(null);
    }
  };

  // Función de impresión (adaptada de DailyClose.tsx)
  const printBalance = (resumenCierre: unknown, puntoNombre: string) => {
    if (!resumenCierre || typeof resumenCierre !== 'object') {
      toast({
        title: "Error",
        description: "Datos de balance inválidos",
        variant: "destructive",
      });
      return;
    }

    const rc = resumenCierre as Record<string, unknown>;
    const transacciones = rc.transacciones as Record<string, unknown[]> | undefined;
    const balance = rc.balance as Record<string, { por_moneda?: unknown[] }> | undefined;

    const cambios = transacciones?.cambios_divisas || [];
    const servicios = transacciones?.servicios_externos || [];
    const balanceCambios = balance?.cambios_divisas?.por_moneda || [];
    const balanceServicios = balance?.servicios_externos?.por_moneda || [];
    const fecha = String(rc.fecha || format(selectedDate, "yyyy-MM-dd"));

    const fmt = (n: unknown) => Number(n ?? 0).toFixed(2);
    const fmtRate = (n: unknown) => Number(n ?? 0).toFixed(3);
    const safe = (s: unknown) => {
      if (s == null) return "";
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const rowsCambios = cambios
      .map((c: unknown) => {
        const cambio = c as Record<string, unknown>;
        let hora = "";
        try {
          const fechaObj = new Date(String(cambio.fecha));
          hora = isNaN(fechaObj.getTime()) ? String(cambio.fecha) : fechaObj.toLocaleTimeString();
        } catch {
          hora = String(cambio.fecha);
        }
        const mo = cambio.moneda_origen as Record<string, string> | undefined;
        const md = cambio.moneda_destino as Record<string, string> | undefined;
        const tasaB = Number((cambio.tasa_cambio_billetes as number) || 0) > 0 ? `B ${fmtRate(cambio.tasa_cambio_billetes)}` : "";
        const tasaM = Number((cambio.tasa_cambio_monedas as number) || 0) > 0 ? `M ${fmtRate(cambio.tasa_cambio_monedas)}` : "";
        const tasa = [tasaB, tasaM].filter(Boolean).join(" | ");

        return `<tr>
          <td>${hora}</td>
          <td>${safe(cambio.numero_recibo) || "—"}</td>
          <td>${safe(cambio.tipo_operacion)}</td>
          <td>${safe((cambio.usuario as Record<string, string>)?.nombre || (cambio.usuario as Record<string, string>)?.username) || "—"}</td>
          <td>${safe(mo?.codigo) || "—"} ${safe(mo?.nombre) ? `(${safe(mo?.nombre)})` : ""}</td>
          <td style="text-align:right">${fmt(cambio.monto_origen)}</td>
          <td>${safe(md?.codigo) || "—"} ${safe(md?.nombre) ? `(${safe(md?.nombre)})` : ""}</td>
          <td style="text-align:right">${fmt(cambio.monto_destino)}</td>
          <td>${tasa || "—"}</td>
        </tr>`;
      })
      .join("");

    const rowsServicios = servicios
      .map((s: unknown) => {
        const serv = s as Record<string, unknown>;
        let hora = "";
        try {
          const fechaObj = new Date(String(serv.fecha));
          hora = isNaN(fechaObj.getTime()) ? String(serv.fecha) : fechaObj.toLocaleTimeString();
        } catch {
          hora = String(serv.fecha);
        }
        return `<tr>
          <td>${hora}</td>
          <td>${safe(serv.servicio)}</td>
          <td>${safe(serv.tipo_movimiento)}</td>
          <td>${safe((serv.usuario as Record<string, string>)?.nombre || (serv.usuario as Record<string, string>)?.username) || "—"}</td>
          <td>${safe(serv.moneda) || "—"}</td>
          <td style="text-align:right">${fmt(serv.monto)}</td>
          <td>${safe(serv.numero_referencia) || "—"}</td>
        </tr>`;
      })
      .join("");

    const rowsBalanceCambios = (balanceCambios as unknown[])
      .map((r: unknown) => {
        const row = r as Record<string, unknown>;
        const mon = row.moneda as Record<string, string> | undefined;
        return `<tr>
          <td>${safe(mon?.codigo) || "—"}</td>
          <td>${safe(mon?.nombre) || ""}</td>
          <td style="text-align:right">${fmt(row.ingresos)}</td>
          <td style="text-align:right">${fmt(row.egresos)}</td>
          <td style="text-align:right;font-weight:bold">${fmt(row.neto)}</td>
        </tr>`;
      })
      .join("");

    const rowsBalanceServicios = (balanceServicios as unknown[])
      .map((r: unknown) => {
        const row = r as Record<string, unknown>;
        const mon = row.moneda as Record<string, string> | undefined;
        return `<tr>
          <td>${safe(mon?.codigo) || "—"}</td>
          <td>${safe(mon?.nombre) || ""}</td>
          <td style="text-align:right">${fmt(row.ingresos)}</td>
          <td style="text-align:right">${fmt(row.egresos)}</td>
          <td style="text-align:right;font-weight:bold">${fmt(row.neto)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Balance diario - ${puntoNombre} - ${fecha}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; margin: 0; }
    h1, h2 { margin: 0 0 8px 0; }
    h1 { font-size: 24px; }
    h2 { font-size: 18px; }
    .muted { color: #555; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; background: #fafafa; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; text-align: left; }
    th { background: #f5f5f5; font-weight: bold; }
    .section { margin-top: 18px; }
    .no-print { margin-bottom: 12px; padding: 12px; background: #f0f0f0; border-radius: 4px; }
    .btn-print { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .btn-print:hover { background: #1d4ed8; }
    .btn-close { background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-left: 8px; }
    @media print { .no-print { display: none !important; } body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print(); setTimeout(()=>window.close(),500)">🖨️ Imprimir / Guardar PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Cerrar</button>
  </div>

  <h1>Balance diario - ${safe(puntoNombre)}</h1>
  <div class="muted">Fecha: ${safe(fecha)} | Punto: ${safe(puntoNombre)}</div>

  <div class="grid">
    <div class="card">
      <h2>Cambios de divisas</h2>
      <div class="muted">Cantidad: ${cambios.length}</div>
    </div>
    <div class="card">
      <h2>Servicios externos</h2>
      <div class="muted">Cantidad: ${servicios.length}</div>
    </div>
  </div>

  <div class="section">
    <h2>Balance por moneda (Cambios)</h2>
    <table>
      <thead>
        <tr>
          <th>Moneda</th>
          <th>Nombre</th>
          <th style="text-align:right">Ingresos</th>
          <th style="text-align:right">Egresos</th>
          <th style="text-align:right">Neto</th>
        </tr>
      </thead>
      <tbody>
        ${rowsBalanceCambios || "<tr><td colspan='5' style='text-align:center;color:#666'>Sin datos</td></tr>"}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Balance por moneda (Servicios externos)</h2>
    <table>
      <thead>
        <tr>
          <th>Moneda</th>
          <th>Nombre</th>
          <th style="text-align:right">Ingresos</th>
          <th style="text-align:right">Egresos</th>
          <th style="text-align:right">Neto</th>
        </tr>
      </thead>
      <tbody>
        ${rowsBalanceServicios || "<tr><td colspan='5' style='text-align:center;color:#666'>Sin datos</td></tr>"}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Cambios (cliente entrega / cliente recibe)</h2>
    <table>
      <thead>
        <tr>
          <th>Hora</th>
          <th>Recibo</th>
          <th>Operación</th>
          <th>Operador</th>
          <th>Moneda entrega</th>
          <th style="text-align:right">Monto</th>
          <th>Moneda recibe</th>
          <th style="text-align:right">Monto</th>
          <th>Tasa</th>
        </tr>
      </thead>
      <tbody>
        ${rowsCambios || "<tr><td colspan='9' style='text-align:center;color:#666'>Sin cambios</td></tr>"}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Servicios externos</h2>
    <table>
      <thead>
        <tr>
          <th>Hora</th>
          <th>Servicio</th>
          <th>Tipo</th>
          <th>Operador</th>
          <th>Moneda</th>
          <th style="text-align:right">Monto</th>
          <th>Ref</th>
        </tr>
      </thead>
      <tbody>
        ${rowsServicios || "<tr><td colspan='7' style='text-align:center;color:#666'>Sin movimientos</td></tr>"}
      </tbody>
    </table>
  </div>

  <div class="section muted" style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd;">
    Generado desde el módulo de cierre diario | ${new Date().toLocaleString()}
  </div>
</body>
</html>`;

    const win = window.open("about:blank", "print_balance", "width=1024,height=768,scrollbars=yes,resizable=yes");
    
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // Popup bloqueado, usar iframe
      let iframe = document.getElementById("print-iframe-admin") as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "print-iframe-admin";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);
      }
      
      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();
        setTimeout(() => {
          try {
            iframe?.contentWindow?.print();
          } catch (e) {
            console.error("Error al imprimir desde iframe:", e);
          }
        }, 500);
      }
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try {
        win.focus();
      } catch (e) {
        console.log("No se pudo hacer focus:", e);
      }
    }, 100);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-EC", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatFecha = (fecha: string) => {
    try {
      // Parsear la fecha como YYYY-MM-DD y crear fecha en UTC para evitar problemas de timezone
      const [year, month, day] = fecha.split('-').map(Number);
      const dateObj = new Date(Date.UTC(year, month - 1, day));
      return format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: es });
    } catch {
      return fecha;
    }
  };

  const filteredPuntos = data?.resumen_por_punto.map((punto) => {
    if (selectedMoneda === "TODAS") {
      return punto;
    }
    return {
      ...punto,
      saldos_por_divisa: punto.saldos_por_divisa.filter(
        (saldo) => saldo.moneda_codigo === selectedMoneda
      ),
    };
  });

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
        <Button onClick={fetchResumen} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Resumen de Cierres Diarios
          </h1>
          <p className="text-gray-600 mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {formatFecha(data.fecha_consultada)}
            {isToday(new Date(data.fecha_consultada)) && (
              <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                Hoy
              </Badge>
            )}
            {isYesterday(new Date(data.fecha_consultada)) && (
              <Badge variant="outline" className="ml-2 bg-gray-50 text-gray-700 border-gray-200">
                Ayer
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Navegación de fechas */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="h-8 w-8 p-0"
              title="Día anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(subDays(new Date(), 1))}
              className="px-3 text-sm font-medium"
              disabled={isYesterday(selectedDate)}
              title="Ver cierres de ayer (por defecto)"
            >
              Ayer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="h-8 w-8 p-0"
              title="Día siguiente"
              disabled={isToday(selectedDate) || isAfter(selectedDate, subDays(new Date(), 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => fetchResumen()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Puntos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.estadisticas.total_puntos}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
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
            <CardTitle className="text-sm font-medium text-gray-600">
              Sin Cierre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {data.estadisticas.puntos_sin_cierre}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
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

      {/* Filtro por Moneda */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>Detalle por Punto de Atención</CardTitle>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Filtrar por divisa:
              </label>
              <Select value={selectedMoneda} onValueChange={setSelectedMoneda}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas las divisas</SelectItem>
                  {data.monedas_disponibles.map((moneda) => (
                    <SelectItem key={moneda.codigo} value={moneda.codigo}>
                      {moneda.codigo} - {moneda.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Punto de Atención</TableHead>
                  <TableHead>Divisa</TableHead>
                  <TableHead className="text-right">Saldo Apertura</TableHead>
                  <TableHead className="text-right">Saldo Cierre</TableHead>
                  <TableHead className="text-right">Conteo Físico</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead>Hora Cierre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPuntos?.map((punto) => {
                  // Si no tiene cierre, mostrar una fila indicando el problema
                  if (!punto.tiene_cierre) {
                    return (
                      <TableRow
                        key={punto.punto_id}
                        className="bg-red-50 hover:bg-red-100"
                      >
                        <TableCell>
                          <Badge
                            variant="destructive"
                            className="flex items-center gap-1 w-fit"
                          >
                            <XCircle className="h-3 w-3" />
                            Sin Cierre
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {punto.punto_nombre}
                        </TableCell>
                        <TableCell colSpan={7} className="text-red-600">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            No se realizó el cierre de caja
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-gray-400 text-xs">-</span>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // Si tiene cierre pero no hay saldos (después del filtro)
                  if (punto.saldos_por_divisa.length === 0) {
                    return (
                      <TableRow key={punto.punto_id} className="bg-gray-50">
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1 w-fit"
                          >
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            Con Cierre
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {punto.punto_nombre}
                        </TableCell>
                        <TableCell colSpan={7} className="text-gray-500">
                          Sin movimientos en la divisa seleccionada
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintBalance(punto.punto_id, punto.punto_nombre)}
                            disabled={printingPoint === punto.punto_id}
                            className="flex items-center gap-1"
                          >
                            {printingPoint === punto.punto_id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Printer className="h-3 w-3" />
                            )}
                            {printingPoint === punto.punto_id ? "Cargando..." : "Imprimir"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // Mostrar cada divisa en una fila
                  return punto.saldos_por_divisa.map((saldo, index) => (
                    <TableRow
                      key={`${punto.punto_id}-${saldo.moneda_codigo}`}
                      className="hover:bg-green-50"
                    >
                      {index === 0 && (
                        <>
                          <TableCell rowSpan={punto.saldos_por_divisa.length}>
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1 w-fit border-green-600 text-green-600"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Con Cierre
                            </Badge>
                          </TableCell>
                          <TableCell
                            rowSpan={punto.saldos_por_divisa.length}
                            className="font-medium"
                          >
                            {punto.punto_nombre}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Badge variant="secondary">{saldo.moneda_codigo}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(saldo.saldo_apertura)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(saldo.saldo_cierre)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(saldo.conteo_fisico)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          saldo.diferencia !== 0
                            ? saldo.diferencia > 0
                              ? "text-green-600"
                              : "text-red-600"
                            : "text-gray-600"
                        }`}
                      >
                        {saldo.diferencia > 0 ? "+" : ""}
                        {formatCurrency(saldo.diferencia)}
                      </TableCell>
                      {index === 0 && (
                        <>
                          <TableCell rowSpan={punto.saldos_por_divisa.length}>
                            {punto.hora_cierre || "-"}
                          </TableCell>
                          <TableCell rowSpan={punto.saldos_por_divisa.length}>
                            {punto.usuario_cierre || "-"}
                          </TableCell>
                          <TableCell rowSpan={punto.saldos_por_divisa.length} className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintBalance(punto.punto_id, punto.punto_nombre)}
                              disabled={printingPoint === punto.punto_id}
                              className="flex items-center gap-1"
                            >
                              {printingPoint === punto.punto_id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Printer className="h-3 w-3" />
                              )}
                              {printingPoint === punto.punto_id ? "Cargando..." : "Imprimir"}
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ));
                })}
              </TableBody>
            </Table>
          </div>

          {filteredPuntos?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay datos para mostrar
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CierresDiariosResumen;
