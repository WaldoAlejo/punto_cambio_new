import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import useCuadreCaja from "@/hooks/useCuadreCaja";
import { AlertCircle, CheckCircle, RefreshCw, Calculator } from "lucide-react";

interface Props {
  pointId?: string;
}

function n2(v?: unknown): string {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CuadreCajaMejorado({ pointId }: Props) {
  const { user } = useAuth();
  const [fecha, setFecha] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [allowMismatch, setAllowMismatch] = useState(false);

  const {
    loading,
    saving,
    error,
    cuadre,
    contabilidad,
    estado,
    diferencias,
    puedeCerrar,
    refresh,
    updateConteo,
    resetConteos,
    guardarParcial,
    guardarCerrado,
  } = useCuadreCaja({ fecha, pointId, withContabilidad: !!pointId });

  // Calcular totales para mostrar
  const totalIngresos = estado.detalles.reduce(
    (sum, d) => sum + (d.ingresos_periodo || 0),
    0
  );
  const totalEgresos = estado.detalles.reduce(
    (sum, d) => sum + (d.egresos_periodo || 0),
    0
  );

  const hayFueraTolerancia = diferencias.some((d) => d.fueraDeTolerancia);
  const hayInconsistencias = estado.detalles.some((d) => {
    const sumaDesglose = (d.billetes || 0) + (d.monedas || 0);
    return Math.abs(sumaDesglose - (d.conteo_fisico || 0)) > 0.01;
  });

  const onGuardarParcial = async () => {
    const resp = await guardarParcial({ allowMismatch });
    if (resp?.success) {
      alert(`Cierre parcial guardado correctamente`);
    }
  };

  const onGuardarCerrado = async () => {
    if (hayFueraTolerancia && !allowMismatch) {
      alert(
        "Hay diferencias fuera de tolerancia. Activa 'Permitir diferencia' si deseas continuar de todas formas."
      );
      return;
    }
    const resp = await guardarCerrado({ allowMismatch });
    if (resp?.success) {
      alert(`Cierre de caja realizado correctamente`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Cuadre de Caja</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Fecha:</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-40"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => refresh()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>

          <Button variant="outline" onClick={resetConteos}>
            Reset Conteos
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hayFueraTolerancia && (
        <Alert variant="destructive" className="bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Diferencias Detectadas</AlertTitle>
          <AlertDescription>
            Hay monedas con diferencias fuera de la tolerancia permitida.
            Revisa los conteos físicos o activa "Permitir diferencia" si es
            correcto.
          </AlertDescription>
        </Alert>
      )}

      {hayInconsistencias && (
        <Alert className="bg-amber-50 border-amber-300">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">
            Inconsistencia en Desglose
          </AlertTitle>
          <AlertDescription className="text-amber-700">
            El desglose de billetes + monedas no coincide con el conteo físico
            en algunas monedas. Ajusta los valores para que cuadren.
          </AlertDescription>
        </Alert>
      )}

      {!hayFueraTolerancia && estado.detalles.length > 0 && (
        <Alert className="bg-green-50 border-green-300">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Todo Cuadrado</AlertTitle>
          <AlertDescription className="text-green-700">
            Todos los saldos están dentro de la tolerancia permitida. Puedes
            proceder con el cierre.
          </AlertDescription>
        </Alert>
      )}

      {/* Resumen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Resumen del Día</span>
            <Badge variant={hayFueraTolerancia ? "destructive" : "default"}>
              {hayFueraTolerancia
                ? "Con Diferencias"
                : estado.detalles.length > 0
                ? "Cuadrado"
                : "Sin Datos"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-600">Total Ingresos</div>
              <div className="text-xl font-bold text-blue-800">
                ${n2(totalIngresos)}
              </div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-sm text-red-600">Total Egresos</div>
              <div className="text-xl font-bold text-red-800">
                ${n2(totalEgresos)}
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm text-green-600">Neto del Día</div>
              <div className="text-xl font-bold text-green-800">
                ${n2(totalIngresos - totalEgresos)}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">Monedas</div>
              <div className="text-xl font-bold text-gray-800">
                {estado.detalles.length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Cuadre */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalle por Moneda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Apertura</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Egresos</TableHead>
                  <TableHead className="text-right">Teórico</TableHead>
                  <TableHead className="text-right bg-yellow-50">
                    Conteo Físico
                  </TableHead>
                  <TableHead className="text-right bg-yellow-50">
                    Billetes
                  </TableHead>
                  <TableHead className="text-right bg-yellow-50">
                    Monedas
                  </TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estado.detalles.map((detalle) => {
                  const diferencia = diferencias.find(
                    (d) => d.moneda_id === detalle.moneda_id
                  );
                  const sumaDesglose =
                    (detalle.billetes || 0) + (detalle.monedas || 0);
                  const desgloseOk =
                    Math.abs(sumaDesglose - (detalle.conteo_fisico || 0)) <=
                    0.01;

                  return (
                    <TableRow
                      key={detalle.moneda_id}
                      className={
                        diferencia?.fueraDeTolerancia ? "bg-red-50" : ""
                      }
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>
                            {detalle.codigo} {detalle.simbolo}
                          </span>
                          <span className="text-xs text-gray-500">
                            {detalle.nombre}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        ${n2(detalle.saldo_apertura)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        +${n2(detalle.ingresos_periodo)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        -${n2(detalle.egresos_periodo)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${n2(detalle.saldo_cierre)}
                      </TableCell>
                      <TableCell className="text-right bg-yellow-50/50 p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={detalle.conteo_fisico || ""}
                          onChange={(e) =>
                            updateConteo(detalle.moneda_id, {
                              conteo_fisico: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-28 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right bg-yellow-50/50 p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={detalle.billetes || ""}
                          onChange={(e) =>
                            updateConteo(detalle.moneda_id, {
                              billetes: parseFloat(e.target.value) || 0,
                            })
                          }
                          className={`w-24 text-right ${
                            !desgloseOk ? "border-red-500" : ""
                          }`}
                        />
                      </TableCell>
                      <TableCell className="text-right bg-yellow-50/50 p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={detalle.monedas || ""}
                          onChange={(e) =>
                            updateConteo(detalle.moneda_id, {
                              monedas: parseFloat(e.target.value) || 0,
                            })
                          }
                          className={`w-24 text-right ${
                            !desgloseOk ? "border-red-500" : ""
                          }`}
                        />
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          diferencia && diferencia.diff > 0
                            ? "text-green-600"
                            : diferencia && diferencia.diff < 0
                            ? "text-red-600"
                            : ""
                        }`}
                      >
                        {diferencia && diferencia.diff > 0 ? "+" : ""}
                        {n2(diferencia?.diff)}
                        {!desgloseOk && (
                          <div className="text-xs text-red-500">
                            Desglose: ${n2(sumaDesglose)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {diferencia?.fueraDeTolerancia ? (
                          <Badge variant="destructive" className="text-xs">
                            Fuera Tol
                          </Badge>
                        ) : diferencia && Math.abs(diferencia.diff) > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-yellow-100"
                          >
                            OK
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-100"
                          >
                            Cuadrado
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Instrucciones */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="instrucciones">
          <AccordionTrigger>Instrucciones para el Cuadre</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm text-gray-600 p-2">
              <p>
                <strong>1. Conteo Físico:</strong> Ingresa el total de dinero
                físico contado (billetes + monedas) en la columna "Conteo
                Físico".
              </p>
              <p>
                <strong>2. Desglose:</strong> Divide el conteo entre
                "Billetes" y "Monedas". La suma debe ser igual al conteo
                físico.
              </p>
              <p>
                <strong>3. Diferencia:</strong> El sistema calcula automáticamente
                la diferencia entre el saldo teórico (apertura + ingresos -
                egresos) y el conteo físico.
              </p>
              <p>
                <strong>4. Tolerancia:</strong>
              </p>
              <ul className="list-disc list-inside ml-4">
                <li>USD: ±$1.00 de tolerancia</li>
                <li>Otras monedas: ±$0.01 de tolerancia</li>
              </ul>
              <p>
                <strong>5. Cierre:</strong> Si todo está cuadrado, puedes hacer
                el cierre. Si hay diferencias, investiga antes de cerrar o
                activa "Permitir diferencia" si es justificable.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Observaciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Observaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[80px] p-3 border rounded-md text-sm"
            placeholder="Ingresa observaciones sobre el cierre de caja..."
            value={estado.observaciones}
            onChange={(e) =>
              estado.observaciones !== undefined &&
              // @ts-ignore - la función no está expuesta en el hook pero sí existe
              estado.setObservaciones?.(e.target.value)
            }
          />
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allowMismatch"
            checked={allowMismatch}
            onChange={(e) => setAllowMismatch(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="allowMismatch" className="text-sm cursor-pointer">
            Permitir cerrar con diferencias (requiere justificación)
          </Label>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onGuardarParcial}
            disabled={saving}
          >
            Guardar Parcial
          </Button>
          <Button
            onClick={onGuardarCerrado}
            disabled={saving || (!puedeCerrar && !allowMismatch)}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? "Procesando..." : "Cerrar Caja"}
          </Button>
        </div>
      </div>
    </div>
  );
}
