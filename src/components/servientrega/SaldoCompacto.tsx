"use client";

import React, { useState, useEffect } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";

interface SaldoCompactoProps {
  puntoAtencionId: string;
  showSolicitar?: boolean;
}

interface SaldoInfo {
  disponible: number;
  estado: "OK" | "SALDO_BAJO" | "ERROR";
  mensaje?: string;
}

const UMBRAL_SALDO_BAJO = 2.0;

export default function SaldoCompacto({
  puntoAtencionId,
  showSolicitar = true,
}: SaldoCompactoProps) {
  const [saldo, setSaldo] = useState<SaldoInfo | null>(null);
  const [loading, setLoading] = useState(false);

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
        estado,
        mensaje: estado === "SALDO_BAJO" ? `Saldo bajo` : undefined,
      });
    } catch (error) {
      console.error("❌ Error al obtener saldo:", error);
      setSaldo({
        disponible: 0,
        estado: "ERROR",
        mensaje: "Error al consultar saldo",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Solicitar saldo rápido
  const solicitarSaldoRapido = async () => {
    try {
      await axiosInstance.post("/servientrega/solicitar-saldo", {
        punto_atencion_id: puntoAtencionId,
        monto_requerido: 50, // Monto por defecto
        observaciones: "Solicitud rápida desde listado de guías",
      });
      toast.success("Solicitud de saldo enviada");
    } catch (error) {
      toast.error("Error al solicitar saldo");
    }
  };

  useEffect(() => {
    obtenerSaldo();
  }, [puntoAtencionId]);

  if (!saldo) return null;

  const getSaldoColor = () => {
    switch (saldo.estado) {
      case "OK":
        return "text-green-600";
      case "SALDO_BAJO":
        return "text-yellow-600";
      case "ERROR":
        return "text-red-600";
      default:
        return "text-gray-500";
    }
  };

  const getSaldoIcon = () => {
    switch (saldo.estado) {
      case "OK":
        return CheckCircle;
      case "SALDO_BAJO":
        return AlertTriangle;
      case "ERROR":
        return XCircle;
      default:
        return Wallet;
    }
  };

  const IconComponent = getSaldoIcon();
  const colorClass = getSaldoColor();
  const saldoBajo = saldo.estado === "SALDO_BAJO";
  const sinSaldo = saldo.disponible === 0;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border-2 ${
        saldoBajo
          ? "bg-yellow-50 border-yellow-200"
          : saldo.estado === "ERROR"
          ? "bg-red-50 border-red-200"
          : "bg-green-50 border-green-200"
      }`}
    >
      <div className="flex items-center gap-3">
        <IconComponent className={`h-5 w-5 ${colorClass}`} />
        <div>
          <div className={`font-semibold ${colorClass}`}>
            ${saldo.disponible.toFixed(2)}
          </div>
          <div className="text-xs text-gray-600">Saldo disponible</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {saldo.mensaje && (
          <span className={`text-xs ${colorClass}`}>{saldo.mensaje}</span>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={obtenerSaldo}
          disabled={loading}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>

        {showSolicitar && (saldoBajo || sinSaldo) && (
          <Button
            variant="outline"
            size="sm"
            onClick={solicitarSaldoRapido}
            className="text-xs px-2 py-1 h-8"
          >
            <Send className="h-3 w-3 mr-1" />
            Solicitar
          </Button>
        )}
      </div>
    </div>
  );
}
