"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import PasoProducto from "./PasoProducto";
import PasoDestinatario from "./PasoDestinatario";
import PasoRemitente from "./PasoRemitente";
import PasoEmpaqueYMedidas from "./PasoEmpaqueYMedidas";
import PasoConfirmarEnvio from "./PasoConfirmarEnvio";
import PasoResumen from "./PasoResumen";
import { Usuario, PuntoAtencion } from "../../types";
import { useToast } from "@/components/ui/use-toast";
import { FormDataGuia } from "./PasoConfirmarEnvio"; // ✅ Importar tipo correcto

interface GenerarGuiaProps {
  user: Usuario;
  selectedPoint: PuntoAtencion;
}

type Step =
  | "producto"
  | "remitente"
  | "destinatario"
  | "empaque-medidas"
  | "resumen"
  | "confirmar-envio";

interface SaldoResponse {
  disponible: number;
}

const UMBRAL_SALDO_BAJO = 5;

export default function GenerarGuia({ user, selectedPoint }: GenerarGuiaProps) {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("producto");
  const [formData, setFormData] = useState<FormDataGuia>({
    nombre_producto: "",
    contenido: "",
    retiro_oficina: false,
    punto_atencion_id: selectedPoint.id,
    remitente: {} as any,
    destinatario: {} as any,
    medidas: {} as any,
    requiere_empaque: false,
    resumen_costos: {
      costo_empaque: 0,
      valor_seguro: 0,
      flete: 0,
      total: 0,
    },
  });

  const [saldo, setSaldo] = useState<number | null>(null);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);

  // ========================
  // 💰 Obtener saldo actual
  // ========================
  const obtenerSaldo = async () => {
    try {
      setCargandoSaldo(true);
      const res = await axios.get<SaldoResponse>(
        `/api/servientrega/saldo/${selectedPoint.id}`
      );
      setSaldo(res.data.disponible ?? 0);
    } catch (error) {
      console.error("Error al obtener saldo:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el saldo actual.",
        variant: "destructive",
      });
    } finally {
      setCargandoSaldo(false);
    }
  };

  useEffect(() => {
    obtenerSaldo();
  }, [selectedPoint.id]);

  const puedeGenerarGuia = () => typeof saldo === "number" && saldo > 0;

  // ========================
  // 📦 Flujo de pasos
  // ========================
  const handleProductoNext = (producto: {
    nombre: string;
    esDocumento: boolean;
  }) => {
    setFormData((prev) => ({
      ...prev,
      nombre_producto: producto.nombre,
      contenido: producto.nombre,
      requiere_empaque: !producto.esDocumento,
    }));
    setStep("remitente");
  };

  const handleRemitenteNext = (remitente: any) => {
    setFormData((prev) => ({ ...prev, remitente }));
    setStep("destinatario");
  };

  const handleDestinatarioNext = (
    destinatario: any,
    retiroOficina: boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      destinatario,
      retiro_oficina: retiroOficina,
    }));
    setStep("empaque-medidas");
  };

  const handleEmpaqueYMedidasNext = (data: {
    medidas: any;
    empaque?: any;
    resumen_costos: any;
  }) => {
    setFormData((prev) => ({
      ...prev,
      empaque: data.empaque || null,
      medidas: data.medidas,
      resumen_costos: data.resumen_costos, // ✅ Ahora siempre está presente
    }));
    setStep("resumen");
  };

  const handleResumenNext = () => {
    if (!puedeGenerarGuia()) {
      toast({
        title: "Saldo insuficiente",
        description:
          "No se puede generar la guía. El saldo del punto de atención es 0 o negativo.",
        variant: "destructive",
      });
      return;
    }
    setStep("confirmar-envio");
  };

  const handleReset = () => {
    setFormData({
      nombre_producto: "",
      contenido: "",
      retiro_oficina: false,
      punto_atencion_id: selectedPoint.id,
      remitente: {} as any,
      destinatario: {} as any,
      medidas: {} as any,
      requiere_empaque: false,
      resumen_costos: {
        costo_empaque: 0,
        valor_seguro: 0,
        flete: 0,
        total: 0,
      },
    });
    setStep("producto");
    obtenerSaldo();
  };

  // ========================
  // 🎨 Renderizado
  // ========================
  return (
    <div className="w-full max-w-3xl mx-auto p-4 space-y-4">
      {/* Saldo */}
      <div className="text-right">
        <span
          className={`text-sm font-medium ${
            saldo !== null && saldo < UMBRAL_SALDO_BAJO
              ? "text-red-600"
              : "text-green-700"
          }`}
        >
          {cargandoSaldo
            ? "Cargando saldo..."
            : saldo !== null
            ? `Saldo disponible: $${Number(saldo).toFixed(2)}`
            : "Saldo no disponible"}
        </span>
      </div>

      {/* Pasos */}
      {step === "producto" && <PasoProducto onNext={handleProductoNext} />}
      {step === "remitente" && (
        <PasoRemitente
          user={user}
          selectedPoint={selectedPoint}
          onNext={handleRemitenteNext}
        />
      )}
      {step === "destinatario" && (
        <PasoDestinatario onNext={handleDestinatarioNext} />
      )}
      {step === "empaque-medidas" && (
        <PasoEmpaqueYMedidas
          nombreProducto={formData.nombre_producto}
          esDocumento={!formData.requiere_empaque}
          paisDestino={formData.destinatario?.pais || "ECUADOR"}
          ciudadDestino={formData.destinatario?.ciudad || ""}
          provinciaDestino={formData.destinatario?.provincia || ""}
          onNext={handleEmpaqueYMedidasNext}
        />
      )}
      {step === "resumen" && (
        <PasoResumen
          formData={formData}
          onConfirm={handleResumenNext}
          onBack={() => setStep("empaque-medidas")}
        />
      )}
      {step === "confirmar-envio" && (
        <PasoConfirmarEnvio
          formData={formData}
          onReset={handleReset}
          onSuccess={obtenerSaldo}
        />
      )}
    </div>
  );
}
