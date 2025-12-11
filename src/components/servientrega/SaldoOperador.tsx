"use client";

import React, { useState, useEffect } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Wallet,
  AlertTriangle,
  Send,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SaldoOperadorProps {
  puntoAtencionId: string;
  puntoAtencionNombre: string;
}

interface SaldoInfo {
  disponible: number;
  billetes?: number;
  monedas_fisicas?: number;
  estado: "OK" | "SALDO_BAJO" | "ERROR";
  mensaje?: string;
}

const UMBRAL_SALDO_BAJO = 2.0; // $2.00

export default function SaldoOperador({
  puntoAtencionId,
  puntoAtencionNombre,
}: SaldoOperadorProps) {
  const [saldo, setSaldo] = useState<SaldoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [solicitudOpen, setSolicitudOpen] = useState(false);
  const [montoSolicitado, setMontoSolicitado] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  // ✅ Obtener saldo disponible
  const obtenerSaldo = async () => {
    if (!puntoAtencionId) return;

    setLoading(true);
    try {
      const { data } = await axiosInstance.get(
        `/servientrega/saldo/${puntoAtencionId}`
      );

      const disponible = Number(data.disponible || 0);
      const estado = disponible < UMBRAL_SALDO_BAJO ? "SALDO_BAJO" : "OK";

      setSaldo({
        disponible,
        billetes: Number(data.billetes ?? 0),
        monedas_fisicas: Number(data.monedas_fisicas ?? 0),
        estado,
        mensaje:
          estado === "SALDO_BAJO"
            ? `Saldo bajo. Se recomienda solicitar más saldo.`
            : undefined,
      });

      console.log("💰 Saldo obtenido:", { disponible, estado });
    } catch (error) {
      console.error("❌ Error al obtener saldo:", error);
      setSaldo({
        disponible: 0,
        billetes: 0,
        monedas_fisicas: 0,
        estado: "ERROR",
        mensaje: "Error al consultar el saldo",
      });
      toast.error("Error al consultar el saldo");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Solicitar saldo al administrador
  const solicitarSaldo = async () => {
    if (!montoSolicitado || Number(montoSolicitado) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    setEnviandoSolicitud(true);
    try {
      await axiosInstance.post("/servientrega/solicitar-saldo", {
        punto_atencion_id: puntoAtencionId,
        monto_solicitado: Number(montoSolicitado),
        observaciones: observaciones.trim() || "",
        creado_por: "Operador",
      });

      toast.success("Solicitud de saldo enviada al administrador");
      setSolicitudOpen(false);
      setMontoSolicitado("");
      setObservaciones("");

      // Actualizar saldo después de solicitar
      setTimeout(obtenerSaldo, 1000);
    } catch (error) {
      console.error("❌ Error al solicitar saldo:", error);
      toast.error("Error al enviar la solicitud de saldo");
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // ✅ Cargar saldo al montar el componente
  useEffect(() => {
    obtenerSaldo();
  }, [puntoAtencionId]);

  // ✅ Determinar color y icono según el estado del saldo
  const getSaldoDisplay = () => {
    if (!saldo)
      return { color: "text-gray-500", icon: Wallet, bg: "bg-gray-50" };

    switch (saldo.estado) {
      case "OK":
        return {
          color: "text-green-600",
          icon: CheckCircle,
          bg: "bg-green-50 border-green-200",
        };
      case "SALDO_BAJO":
        return {
          color: "text-yellow-600",
          icon: AlertTriangle,
          bg: "bg-yellow-50 border-yellow-200",
        };
      case "ERROR":
        return {
          color: "text-red-600",
          icon: XCircle,
          bg: "bg-red-50 border-red-200",
        };
      default:
        return { color: "text-gray-500", icon: Wallet, bg: "bg-gray-50" };
    }
  };

  const { color, icon: IconComponent, bg } = getSaldoDisplay();
  const saldoBajo = saldo?.estado === "SALDO_BAJO";
  const sinSaldo = saldo?.disponible === 0;

  return (
    <>
      <Card className={`w-full ${bg} border-2`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <IconComponent className={`h-5 w-5 ${color}`} />
              <span>Saldo Disponible</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={obtenerSaldo}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Información del saldo */}
          <div className="text-center">
            <div className={`text-3xl font-bold ${color}`}>
              {loading ? "..." : `$${saldo?.disponible?.toFixed(2) || "0.00"}`}
            </div>
            <p className="text-sm text-gray-600 mt-1">{puntoAtencionNombre}</p>
            {saldo?.mensaje && (
              <p className={`text-sm mt-2 ${color}`}>{saldo.mensaje}</p>
            )}
          </div>
          {saldo?.billetes !== undefined && saldo?.monedas_fisicas !== undefined && (
            <div className="flex flex-col items-center mt-2 text-xs text-gray-700">
              <div>
                <span className="font-semibold">Billetes:</span> ${saldo.billetes?.toFixed(2)}
              </div>
              <div>
                <span className="font-semibold">Monedas:</span> ${saldo.monedas_fisicas?.toFixed(2)}
              </div>
            </div>
          )}

          {/* Alertas y acciones */}
          {sinSaldo && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-3 text-center">
              <p className="text-red-700 font-medium text-sm">
                ⚠️ Sin saldo disponible
              </p>
              <p className="text-red-600 text-xs mt-1">
                No puedes generar guías sin saldo
              </p>
            </div>
          )}

          {saldoBajo && !sinSaldo && (
            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 text-center">
              <p className="text-yellow-700 font-medium text-sm">
                ⚠️ Saldo bajo
              </p>
              <p className="text-yellow-600 text-xs mt-1">
                Se recomienda solicitar más saldo
              </p>
            </div>
          )}

          {/* Botón para solicitar saldo */}
          {(saldoBajo || sinSaldo) && (
            <Button
              onClick={() => setSolicitudOpen(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={enviandoSolicitud}
            >
              <Send className="mr-2 h-4 w-4" />
              Solicitar Saldo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Modal para solicitar saldo */}
      <AlertDialog open={solicitudOpen} onOpenChange={setSolicitudOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar Saldo</AlertDialogTitle>
            <AlertDialogDescription>
              Envía una solicitud al administrador para asignar más saldo a tu
              punto de atención.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="monto">Monto a solicitar ($)</Label>
              <Input
                id="monto"
                type="number"
                min="1"
                step="0.01"
                placeholder="Ej: 100.00"
                value={montoSolicitado}
                onChange={(e) => setMontoSolicitado(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones (opcional)</Label>
              <Textarea
                id="observaciones"
                placeholder="Motivo de la solicitud, urgencia, etc."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <p>
                <strong>Punto:</strong> {puntoAtencionNombre}
              </p>
              <p>
                <strong>Saldo actual:</strong> $
                {saldo?.disponible?.toFixed(2) || "0.00"}
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={solicitarSaldo}
              disabled={enviandoSolicitud || !montoSolicitado}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {enviandoSolicitud ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Solicitud
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
