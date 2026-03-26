import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import useCuadreCaja from "@/hooks/useCuadreCaja";
import { AlertCircle, CheckCircle, RefreshCw, Calculator, Banknote, Coins, ArrowRight } from "lucide-react";

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

function formatMoney(amount: number): string {
  return amount.toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CuadreCajaConDesglose({ pointId }: Props) {
  const { user } = useAuth();
  const [fecha, setFecha] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [allowMismatch, setAllowMismatch] = useState(false);
  const [monedaExpandida, setMonedaExpandida] = useState<string | null>(null);

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
    setObservaciones,
    updateConteo,
    updateDesgloseBillete,
    updateDesgloseMoneda,
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

      {/* Formularios de conteo por moneda */}
      {estado.detalles.map((detalle) => {
        const diferencia = diferencias.find(
          (d) => d.moneda_id === detalle.moneda_id
        );
        const isExpandida = monedaExpandida === detalle.moneda_id;

        return (
          <Card 
            key={detalle.moneda_id} 
            className={`overflow-hidden ${diferencia?.fueraDeTolerancia ? 'border-red-300' : ''}`}
          >
            <CardHeader 
              className="bg-gray-50 pb-4 cursor-pointer"
              onClick={() => setMonedaExpandida(isExpandida ? null : detalle.moneda_id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-blue-600" />
                  <CardTitle>
                    {detalle.codigo} - {detalle.nombre}
                  </CardTitle>
                  {diferencia?.fueraDeTolerancia && (
                    <Badge variant="destructive" className="text-xs">
                      Fuera de Tolerancia
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Saldo teórico</div>
                  <div className="text-xl font-bold">
                    {detalle.simbolo} {formatMoney(detalle.saldo_cierre)}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Resumen rápido */}
              <div className={`p-4 rounded-lg ${
                diferencia?.fueraDeTolerancia
                  ? "bg-red-50 border border-red-200"
                  : (detalle.conteo_fisico || 0) === detalle.saldo_cierre
                  ? "bg-green-50 border border-green-200"
                  : "bg-blue-50 border border-blue-200"
              }`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Apertura</div>
                    <div className="text-lg font-medium">
                      {detalle.simbolo} {formatMoney(detalle.saldo_apertura)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Ingresos/Egresos</div>
                    <div className="text-lg font-medium">
                      <span className="text-green-600">+{formatMoney(detalle.ingresos_periodo || 0)}</span>
                      {" / "}
                      <span className="text-red-600">-{formatMoney(detalle.egresos_periodo || 0)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Conteo Físico</div>
                    <div className={`text-lg font-bold ${
                      diferencia?.fueraDeTolerancia ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {detalle.simbolo} {formatMoney(detalle.conteo_fisico || 0)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Diferencia</div>
                    <div className={`text-lg font-bold ${
                      (diferencia?.diff || 0) > 0
                        ? "text-green-600"
                        : (diferencia?.diff || 0) < 0
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}>
                      {(diferencia?.diff || 0) > 0 ? "+" : ""}
                      {formatMoney(diferencia?.diff || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Billetes */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Billetes
                  <span className="text-sm font-normal text-gray-500">
                    (Total: {detalle.simbolo} {formatMoney(detalle.billetes)})
                  </span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {detalle.desglose.billetes.map((billete) => (
                    <div key={billete.denominacion} className="space-y-1">
                      <Label className="text-xs text-gray-500">
                        {detalle.simbolo}{billete.denominacion}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={billete.cantidad || ""}
                        onChange={(e) =>
                          updateDesgloseBillete(
                            detalle.moneda_id,
                            billete.denominacion,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="text-center"
                        placeholder="0"
                        disabled={saving}
                      />
                      <div className="text-xs text-right text-gray-500">
                        = {detalle.simbolo} {formatMoney(billete.denominacion * billete.cantidad)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Monedas */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Monedas
                  <span className="text-sm font-normal text-gray-500">
                    (Total: {detalle.simbolo} {formatMoney(detalle.monedas)})
                  </span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {detalle.desglose.monedas.map((moneda) => (
                    <div key={moneda.denominacion} className="space-y-1">
                      <Label className="text-xs text-gray-500">
                        {moneda.denominacion >= 1
                          ? `${detalle.simbolo}${moneda.denominacion}`
                          : `${(moneda.denominacion * 100).toFixed(0)}¢`}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={moneda.cantidad || ""}
                        onChange={(e) =>
                          updateDesgloseMoneda(
                            detalle.moneda_id,
                            moneda.denominacion,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="text-center"
                        placeholder="0"
                        disabled={saving}
                      />
                      <div className="text-xs text-right text-gray-500">
                        = {detalle.simbolo} {formatMoney(moneda.denominacion * moneda.cantidad)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bancos (si aplica) */}
              {(detalle.bancos_teorico || 0) > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">Bancos / Transferencias</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="text-sm text-gray-500">Teórico Bancos</div>
                        <div className="text-lg font-medium">
                          {detalle.simbolo} {formatMoney(detalle.bancos_teorico || 0)}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-500">Conteo Bancos</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={detalle.conteo_bancos || ""}
                          onChange={(e) =>
                            updateConteo(detalle.moneda_id, {
                              conteo_bancos: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="text-right"
                          placeholder="0.00"
                          disabled={saving}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Instrucciones */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="instrucciones">
          <AccordionTrigger>Instrucciones para el Cuadre</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm text-gray-600 p-2">
              <p>
                <strong>1. Conteo por Denominación:</strong> Ingresa la cantidad de billetes y monedas
                para cada denominación. El sistema calculará automáticamente el total.
              </p>
              <p>
                <strong>2. Verificación:</strong> El total calculado debe coincidir con el saldo teórico
                (apertura + ingresos - egresos).
              </p>
              <p>
                <strong>3. Diferencia:</strong> El sistema calcula automáticamente la diferencia entre
                el saldo teórico y el conteo físico.
              </p>
              <p>
                <strong>4. Tolerancia:</strong>
              </p>
              <ul className="list-disc list-inside ml-4">
                <li>USD: ±$1.00 de tolerancia</li>
                <li>Otras monedas: ±$0.01 de tolerancia</li>
              </ul>
              <p>
                <strong>5. Cierre:</strong> Si todo está cuadrado, puedes hacer el cierre. Si hay
                diferencias, investiga antes de cerrar o activa "Permitir diferencia" si es justificable.
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
            onChange={(e) => setObservaciones(e.target.value)}
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
