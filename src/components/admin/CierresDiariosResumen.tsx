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
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

  const fetchResumen = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "/api/cierres-diarios/resumen-dia-anterior",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Error al cargar el resumen de cierres");
      }

      const result: ResumenResponse = await response.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error(result.error || "Error desconocido");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumen();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-EC", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatFecha = (fecha: string) => {
    try {
      return format(new Date(fecha), "dd 'de' MMMM 'de' yyyy", { locale: es });
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
          </p>
        </div>
        <Button onClick={fetchResumen} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
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
