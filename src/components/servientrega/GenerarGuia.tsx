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

interface GuiaFormData {
  nombre_producto: string;
  remitente: any;
  destinatario: any;
  requiere_empaque: boolean | null;
  empaque: any;
  medidas: any;
}

interface SaldoResponse {
  disponible: number;
}

const UMBRAL_SALDO_BAJO = 5;

export default function GenerarGuia({ user, selectedPoint }: GenerarGuiaProps) {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("producto");
  const [formData, setFormData] = useState<GuiaFormData>({
    nombre_producto: "",
    remitente: null,
    destinatario: null,
    requiere_empaque: null,
    empaque: null,
    medidas: null,
  });

  const [saldo, setSaldo] = useState<number | null>(null);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);

  const obtenerSaldo = async () => {
    try {
      setCargandoSaldo(true);
      const res = await axios.get<SaldoResponse>(
        `/api/servientrega/saldo/${selectedPoint.id}`
      );
      setSaldo(res.data.disponible ?? 0);
    } catch (error) {
      console.error("Error al obtener saldo:", error);
    } finally {
      setCargandoSaldo(false);
    }
  };

  useEffect(() => {
    obtenerSaldo();
  }, [selectedPoint.id]);

  const puedeGenerarGuia = () => saldo !== null && saldo > 0;

  const handleProductoNext = (producto: {
    nombre: string;
    esDocumento: boolean;
  }) => {
    setFormData((prev) => ({
      ...prev,
      nombre_producto: producto.nombre,
      requiere_empaque: !producto.esDocumento,
    }));
    setStep("remitente");
  };

  const handleRemitenteNext = (remitente: any) => {
    setFormData((prev) => ({ ...prev, remitente }));
    setStep("destinatario");
  };

  const handleDestinatarioNext = (destinatario: any) => {
    setFormData((prev) => ({ ...prev, destinatario }));
    setStep("empaque-medidas");
  };

  const handleEmpaqueYMedidasNext = (data: {
    requiere_empaque: boolean;
    empaque: any;
    medidas: any;
  }) => {
    setFormData((prev) => ({
      ...prev,
      requiere_empaque: data.requiere_empaque,
      empaque: data.empaque,
      medidas: data.medidas,
    }));
    setStep("resumen");
  };

  const handleResumenNext = () => {
    if (puedeGenerarGuia()) {
      setStep("confirmar-envio");
    } else {
      toast({
        title: "Saldo insuficiente",
        description:
          "No se puede generar la guía. El saldo del punto de atención es 0 o negativo.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setFormData({
      nombre_producto: "",
      remitente: null,
      destinatario: null,
      requiere_empaque: null,
      empaque: null,
      medidas: null,
    });
    setStep("producto");
    obtenerSaldo();
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 space-y-4">
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
          onNext={handleEmpaqueYMedidasNext}
        />
      )}
      {step === "resumen" && (
        <PasoResumen
          formData={formData}
          onConfirm={handleResumenNext}
          onBack={handleReset}
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
