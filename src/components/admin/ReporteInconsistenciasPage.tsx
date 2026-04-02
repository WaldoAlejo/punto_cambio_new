import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, RefreshCw, AlertTriangle, Download } from "lucide-react";
import axiosInstance from "@/services/axiosInstance";

interface Inconsistencia {
  punto_id: string;
  punto_nombre: string;
  fecha_cierre: string;
  fecha_apertura: string;
  moneda_codigo: string;
  moneda_nombre: string;
  cierre_dia_anterior: number;
  apertura_dia_actual: number;
  diferencia: number;
  cuadre_cierre_id: string;
  cuadre_apertura_id: string;
}

export default function ReporteInconsistenciasPage() {
  const [desde, setDesde] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [hasta, setHasta] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [inconsistencias, setInconsistencias] = useState<Inconsistencia[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const consultar = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosInstance.get("/validacion-cierre/reporte-inconsistencias", {
        params: { desde, hasta }
      });
      
      if (response.data?.success) {
        setInconsistencias(response.data.data.inconsistencias);
        setTotal(response.data.data.total_inconsistencias);
      } else {
        setError(response.data?.error || "Error al consultar");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    consultar();
  }, []);

  const formatMoney = (amount: number) => {
    return amount.toLocaleString("es-EC", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const exportarCSV = () => {
    const headers = [
      "Punto",
      "Fecha Cierre",
      "Fecha Apertura",
      "Moneda",
      "Cierre Día Anterior",
      "Apertura Día Actual",
      "Diferencia"
    ].join(";");

    const rows = inconsistencias.map(inc => [
      inc.punto_nombre,
      inc.fecha_cierre,
      inc.fecha_apertura,
      inc.moneda_codigo,
      formatMoney(inc.cierre_dia_anterior),
      formatMoney(inc.apertura_dia_actual),
      formatMoney(inc.diferencia)
    ].join(";"));

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inconsistencias_${desde}_${hasta}.csv`;
    link.click();
  };

  // Agrupar por punto
  const porPunto = inconsistencias.reduce((acc, inc) => {
    if (!acc[inc.punto_nombre]) {
      acc[inc.punto_nombre] = [];
    }
    acc[inc.punto_nombre].push(inc);
    return acc;
  }, {} as Record<string, Inconsistencia[]>);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Reporte de Inconsistencias
        </h1>
        <p className="text-gray-600">
          Lista de todas las inconsistencias encontradas entre cierres y aperturas de caja.
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="desde">Desde</Label>
              <Input
                id="desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hasta">Hasta</Label>
              <Input
                id="hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={consultar}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {loading ? "Consultando..." : "Consultar"}
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                onClick={exportarCSV}
                disabled={inconsistencias.length === 0}
                variant="outline"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Resumen */}
      {total > 0 && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">
            Se encontraron {total} inconsistencia(s)
          </AlertTitle>
          <AlertDescription className="text-red-700">
            Se detectaron diferencias entre los cierres y las aperturas de los días siguientes.
          </AlertDescription>
        </Alert>
      )}

      {total === 0 && !loading && (
        <Alert className="bg-green-50 border-green-200">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">No hay inconsistencias</AlertTitle>
          <AlertDescription className="text-green-700">
            No se encontraron diferencias entre cierres y aperturas en el período seleccionado.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabla por punto */}
      {Object.entries(porPunto).map(([puntoNombre, incs]) => (
        <Card key={puntoNombre}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{puntoNombre}</span>
              <Badge variant="destructive">{incs.length} inconsistencia(s)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha Cierre</TableHead>
                  <TableHead>Fecha Apertura</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Cierre</TableHead>
                  <TableHead className="text-right">Apertura</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incs.map((inc, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{inc.fecha_cierre}</TableCell>
                    <TableCell>{inc.fecha_apertura}</TableCell>
                    <TableCell className="font-medium">
                      {inc.moneda_codigo}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(inc.cierre_dia_anterior)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(inc.apertura_dia_actual)}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${
                      inc.diferencia > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {inc.diferencia > 0 ? "+" : ""}
                      {formatMoney(inc.diferencia)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
