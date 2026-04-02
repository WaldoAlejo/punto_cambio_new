import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { AlertCircle, CheckCircle, RefreshCw, ArrowRightLeft, Calendar } from "lucide-react";
import axiosInstance from "@/services/axiosInstance";

interface ComparacionMoneda {
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  cierre_dia_anterior: number | null;
  apertura_dia_actual: number | null;
  diferencia: number | null;
  consistente: boolean;
}

interface ValidacionData {
  punto: {
    id: string;
    nombre: string;
  };
  fecha_cierre: string;
  fecha_apertura: string;
  cuadre_cierre_id: string | null;
  cuadre_apertura_id: string | null;
  apertura_caja_id: string | null;
  estado: string;
  comparacion_monedas: ComparacionMoneda[];
  resumen: {
    total_monedas: number;
    consistentes: number;
    inconsistentes: number;
    faltantes: number;
    todas_consistentes: boolean;
    hay_inconsistencias: boolean;
  };
}

interface PuntoAtencion {
  id: string;
  nombre: string;
}

export default function ValidacionCierrePage() {
  const { user } = useAuth();
  const [fecha, setFecha] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [puntoId, setPuntoId] = useState<string>("");
  const [puntos, setPuntos] = useState<PuntoAtencion[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ValidacionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cargar puntos de atención
  useEffect(() => {
    const cargarPuntos = async () => {
      try {
        const response = await axiosInstance.get("/puntos-atencion");
        if (response.data?.success) {
          setPuntos(response.data.data || []);
          // Si es operador, seleccionar su punto por defecto
          if (user?.punto_atencion_id && user?.rol === "OPERADOR") {
            setPuntoId(user.punto_atencion_id);
          }
        }
      } catch (err) {
        console.error("Error cargando puntos:", err);
      }
    };
    cargarPuntos();
  }, [user]);

  const consultar = async () => {
    if (!puntoId) {
      setError("Selecciona un punto de atención");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await axiosInstance.get("/validacion-cierre/comparacion", {
        params: { fecha, punto_id: puntoId }
      });
      
      if (response.data?.success) {
        setData(response.data.data);
      } else {
        setError(response.data?.error || "Error al consultar");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number | null) => {
    if (amount === null || amount === undefined) return "N/A";
    return amount.toLocaleString("es-EC", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getEstadoBadge = (consistente: boolean, cierre: number | null, apertura: number | null) => {
    if (cierre === null || apertura === null) {
      return <Badge variant="outline" className="bg-gray-100">Sin datos</Badge>;
    }
    if (consistente) {
      return <Badge variant="outline" className="bg-green-100 text-green-800">✅ Consistente</Badge>;
    }
    return <Badge variant="outline" className="bg-red-100 text-red-800">❌ Inconsistente</Badge>;
  };

  const esAdmin = ["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"].includes(user?.rol || "");

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Validación de Cierre de Caja
        </h1>
        <p className="text-gray-600">
          Compara el cierre de un día con la apertura del día siguiente para detectar inconsistencias.
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Punto de atención */}
            <div className="space-y-2">
              <Label htmlFor="punto">Punto de Atención</Label>
              <Select
                value={puntoId}
                onValueChange={setPuntoId}
                disabled={user?.rol === "OPERADOR"}
              >
                <SelectTrigger id="punto">
                  <SelectValue placeholder="Selecciona un punto" />
                </SelectTrigger>
                <SelectContent>
                  {puntos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha de Cierre</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            {/* Botón consultar */}
            <div className="flex items-end">
              <Button
                onClick={consultar}
                disabled={loading || !puntoId}
                className="w-full"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                )}
                {loading ? "Consultando..." : "Comparar"}
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

      {/* Resultados */}
      {data && (
        <div className="space-y-6">
          {/* Resumen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Resumen de Comparación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Punto</p>
                  <p className="text-lg font-semibold">{data.punto.nombre}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Fecha Cierre</p>
                  <p className="text-lg font-semibold">{data.fecha_cierre}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Fecha Apertura</p>
                  <p className="text-lg font-semibold">{data.fecha_apertura}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Estado</p>
                  <p className="text-lg font-semibold">{data.estado}</p>
                </div>
              </div>

              {/* Alerta de consistencia */}
              <div className="mt-4">
                {data.resumen.todas_consistentes ? (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Todo consistente</AlertTitle>
                    <AlertDescription className="text-green-700">
                      El cierre del {data.fecha_cierre} coincide con la apertura del {data.fecha_apertura}.
                    </AlertDescription>
                  </Alert>
                ) : data.resumen.hay_inconsistencias ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Hay inconsistencias</AlertTitle>
                    <AlertDescription>
                      Se encontraron {data.resumen.inconsistentes} moneda(s) con diferencias entre el cierre y la apertura.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Faltan datos</AlertTitle>
                    <AlertDescription>
                      No se encontró información completa para comparar.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabla de comparación */}
          <Card>
            <CardHeader>
              <CardTitle>Detalle por Moneda</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Moneda</TableHead>
                    <TableHead className="text-right">Cierre {data.fecha_cierre}</TableHead>
                    <TableHead className="text-right">Apertura {data.fecha_apertura}</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.comparacion_monedas.map((moneda) => (
                    <TableRow key={moneda.moneda_id}>
                      <TableCell className="font-medium">
                        {moneda.codigo} - {moneda.nombre}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(moneda.cierre_dia_anterior)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(moneda.apertura_dia_actual)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${
                        moneda.diferencia && moneda.diferencia !== 0
                          ? moneda.diferencia > 0
                            ? "text-green-600"
                            : "text-red-600"
                          : ""
                      }`}>
                        {moneda.diferencia !== null
                          ? `${moneda.diferencia > 0 ? "+" : ""}${formatMoney(moneda.diferencia)}`
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {getEstadoBadge(
                          moneda.consistente,
                          moneda.cierre_dia_anterior,
                          moneda.apertura_dia_actual
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* IDs de referencia (solo para admins) */}
          {esAdmin && (
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle className="text-sm text-gray-600">Referencias del Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Cuadre Cierre ID: {data.cuadre_cierre_id || "N/A"}</p>
                  <p>Cuadre Apertura ID: {data.cuadre_apertura_id || "N/A"}</p>
                  <p>Apertura Caja ID: {data.apertura_caja_id || "N/A"}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
