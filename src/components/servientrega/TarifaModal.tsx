"use client";

import React, { useEffect, useMemo, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Package,
  Clock,
  MapPin,
  DollarSign,
  CheckCircle,
  Info,
  AlertTriangle,
  Loader2,
} from "lucide-react";

type NumStr = number | string | null | undefined;

interface TarifaServientrega {
  flete?: NumStr;
  valor_declarado?: NumStr;
  tiempo?: string;
  valor_empaque?: NumStr;
  valor_empaque_iva?: NumStr;
  total_empaque?: NumStr;
  trayecto?: string;
  prima?: NumStr;
  peso?: NumStr;
  volumen?: NumStr;
  peso_cobrar?: NumStr;
  descuento?: NumStr;
  tarifa0?: NumStr;
  tarifa12?: NumStr;
  tiva?: NumStr;
  gtotal?: NumStr;
  total_transacion?: NumStr;
}

interface PuntoAtencion {
  id: string;
  nombre: string;
  ciudad?: string;
  provincia?: string;
}

interface TarifaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  tarifa: TarifaServientrega | null;
  loading?: boolean;

  // Saldo
  saldoDisponible?: number;

  // NUEVO: si ya tienes el nombre, lo sigues pasando
  puntoAtencionNombre?: string;

  // NUEVO: si solo tienes el id, pásalo y el modal resolverá el nombre
  puntoAtencionId?: string;
}

function toNumber(v: NumStr, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(v: NumStr): string {
  const n = toNumber(v, 0);
  return `$${n.toFixed(2)}`;
}

function pluralDias(tiempo?: string): string {
  if (!tiempo) return "1-2 días";
  return `${tiempo} día${tiempo === "1" ? "" : "s"}`;
}

function getTrayectoColor(trayecto?: string) {
  switch ((trayecto || "").toUpperCase()) {
    case "REGIONAL":
      return "bg-blue-100 text-blue-800";
    case "NACIONAL":
      return "bg-green-100 text-green-800";
    case "INTERNACIONAL":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/** Cache simple en memoria para no pedir los puntos muchas veces en la misma sesión */
const puntosCache: { list?: PuntoAtencion[]; at?: number } = {};

async function fetchPuntos(): Promise<PuntoAtencion[]> {
  // Reutiliza 60s
  const now = Date.now();
  if (puntosCache.list && puntosCache.at && now - puntosCache.at < 60_000) {
    return puntosCache.list;
  }
  const { data } = await axiosInstance.get("/servientrega/remitente/puntos");
  const list: PuntoAtencion[] = (data?.puntos || []).map((p: any) => ({
    id: p.id,
    nombre: p.nombre,
    ciudad: p.ciudad,
    provincia: p.provincia,
  }));
  puntosCache.list = list;
  puntosCache.at = now;
  return list;
}

export default function TarifaModal({
  isOpen,
  onClose,
  onConfirm,
  tarifa,
  loading = false,
  saldoDisponible,
  puntoAtencionNombre,
  puntoAtencionId,
}: TarifaModalProps) {
  const [paNombre, setPaNombre] = useState<string | undefined>(
    puntoAtencionNombre
  );
  const [resolviendoNombre, setResolviendoNombre] = useState(false);

  // Intenta resolver el nombre si:
  // - el modal está abierto
  // - no nos pasaron el nombre ya listo
  // - sí tenemos un id de punto
  useEffect(() => {
    let mounted = true;

    async function resolveNombre() {
      if (!isOpen || paNombre || !puntoAtencionId) return;
      setResolviendoNombre(true);
      try {
        const puntos = await fetchPuntos();
        const match = puntos.find((p) => p.id === puntoAtencionId);
        if (mounted) {
          setPaNombre(match?.nombre || undefined);
        }
      } catch (e) {
        // Silencioso en UI; puedes loguear si quieres
        console.warn("No se pudo resolver nombre del punto:", e);
      } finally {
        if (mounted) setResolviendoNombre(false);
      }
    }

    resolveNombre();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, puntoAtencionId]);

  const totalTransaccion = toNumber(tarifa?.total_transacion);
  const gtotal = toNumber(tarifa?.gtotal);
  const costoEnvio = totalTransaccion > 0 ? totalTransaccion : gtotal;

  const saldoDespues = useMemo(() => {
    if (saldoDisponible === undefined) return undefined;
    return saldoDisponible - costoEnvio;
  }, [saldoDisponible, costoEnvio]);

  if (!tarifa) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calculator className="h-6 w-6 text-primary" />
            Cotización de Envío Servientrega
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header principal */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-gray-600">
                      Total Final
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {formatCurrency(costoEnvio)}
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                    <span className="text-sm font-medium text-gray-600">
                      Tiempo Estimado
                    </span>
                  </div>
                  <div className="text-xl font-semibold text-orange-600">
                    {pluralDias(tarifa?.tiempo)}
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium text-gray-600">
                      Trayecto
                    </span>
                  </div>
                  <Badge className={getTrayectoColor(tarifa?.trayecto)}>
                    {tarifa?.trayecto || "—"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Desglose de costos */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Desglose de Costos
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Flete base:</span>
                  <span className="font-medium">
                    {formatCurrency(tarifa?.flete)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Empaque:</span>
                  <span className="font-medium">
                    {formatCurrency(tarifa?.valor_empaque)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">IVA empaque:</span>
                  <span className="font-medium">
                    {formatCurrency(tarifa?.valor_empaque_iva)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total empaque:</span>
                  <span className="font-medium">
                    {formatCurrency(tarifa?.total_empaque)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Prima (seguro):</span>
                  <span className="font-medium">
                    {formatCurrency(tarifa?.prima)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">IVA (flete/servicios):</span>
                  <span className="font-medium">
                    {formatCurrency(tarifa?.tiva)}
                  </span>
                </div>

                {toNumber(tarifa?.descuento) > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>Descuento:</span>
                    <span className="font-medium">
                      -{formatCurrency(tarifa?.descuento)}
                    </span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(tarifa?.gtotal)}</span>
                </div>

                <div className="flex justify-between items-center text-xl font-bold text-primary">
                  <span>Total a pagar:</span>
                  <span>{formatCurrency(costoEnvio)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información adicional */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Info className="h-5 w-5" />
                Información del Envío
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Peso real:</span>
                    <span className="font-medium">
                      {toNumber(tarifa?.peso).toFixed(2)} kg
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Peso a cobrar:</span>
                    <span className="font-medium">
                      {toNumber(tarifa?.peso_cobrar).toFixed(2)} kg
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Volumen:</span>
                    <span className="font-medium">
                      {toNumber(tarifa?.volumen).toFixed(3)} m³
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valor declarado:</span>
                    <span className="font-medium">
                      {formatCurrency(tarifa?.valor_declarado)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Tarifa sin IVA:</span>
                    <span className="font-medium">
                      {formatCurrency(tarifa?.tarifa0)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Tarifa con IVA:</span>
                    <span className="font-medium">
                      {formatCurrency(tarifa?.tarifa12)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información del saldo */}
          {saldoDisponible !== undefined && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Información de Saldo
                </h3>

                <div className="space-y-3">
                  {(paNombre || puntoAtencionId) && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Punto de atención:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {paNombre ? paNombre : "Resolviendo..."}
                        </span>
                        {resolviendoNombre && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {puntoAtencionId && (
                          <Badge
                            variant="outline"
                            title={`ID: ${puntoAtencionId}`}
                          >
                            ID
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Saldo disponible:</span>
                    <span className="font-medium text-blue-600">
                      {formatCurrency(saldoDisponible)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Costo del envío:</span>
                    <span className="font-medium text-orange-600">
                      {formatCurrency(costoEnvio)}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">
                      Saldo después del envío:
                    </span>
                    <span
                      className={`font-bold ${
                        saldoDespues !== undefined && saldoDespues >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(saldoDespues)}
                    </span>
                  </div>

                  {saldoDespues !== undefined && saldoDespues < 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium text-sm">
                          Saldo insuficiente
                        </span>
                      </div>
                      <p className="text-xs text-red-700 mt-1">
                        No tienes saldo suficiente para este envío. Contacta al
                        administrador.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mensaje de confirmación */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Cotización válida</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Esta cotización es válida por 24 horas. El saldo se descontará
              únicamente cuando se genere la guía.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {onConfirm && (
            <Button
              onClick={onConfirm}
              disabled={
                loading ||
                (saldoDisponible !== undefined &&
                  saldoDespues !== undefined &&
                  saldoDespues < 0)
              }
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando guía...
                </>
              ) : (
                "Confirmar y generar guía"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
