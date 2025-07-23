"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import PasoProducto from "./PasoProducto";
import PasoDestinatario from "./PasoDestinatario";
import PasoRemitente from "./PasoRemitente";
import PasoRequiereEmpaque from "./PasoRequiereEmpaque";
import PasoEmpaque from "./PasoEmpaque";
import PasoMedidas from "./PasoMedidas";
import PasoConfirmarEnvio from "./PasoConfirmarEnvio";
import { Usuario, PuntoAtencion } from "../../types";
import type { EmpaqueFormData } from "./PasoEmpaque";
import type { MedidasPayload } from "./PasoMedidas";
import { useToast } from "@/components/ui/use-toast";

interface GenerarGuiaProps {
  user: Usuario;
  selectedPoint: PuntoAtencion;
}

type Step =
  | "producto"
  | "remitente"
  | "destinatario"
  | "requiere-empaque"
  | "empaque"
  | "medidas"
  | "resumen"
  | "confirmar-envio";

interface GuiaFormData {
  nombre_producto: string;
  remitente: any;
  destinatario: any;
  requiere_empaque: boolean | null;
  empaque: EmpaqueFormData | null;
  medidas: MedidasPayload | null;
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

  const handleProductoNext = (producto: string) => {
    setFormData((prev) => ({ ...prev, nombre_producto: producto }));
    setStep("remitente");
  };

  const handleRemitenteNext = (remitente: any) => {
    setFormData((prev) => ({ ...prev, remitente }));
    setStep("destinatario");
  };

  const handleDestinatarioNext = (destinatario: any) => {
    setFormData((prev) => ({ ...prev, destinatario }));
    setStep("requiere-empaque");
  };

  const handleRequiereEmpaqueNext = (requiereEmpaque: boolean) => {
    setFormData((prev) => ({ ...prev, requiere_empaque: requiereEmpaque }));
    setStep(requiereEmpaque ? "empaque" : "medidas");
  };

  const handleEmpaqueNext = (empaque: EmpaqueFormData) => {
    setFormData((prev) => ({ ...prev, empaque }));
    setStep("medidas");
  };

  const handleMedidasNext = (medidas: MedidasPayload) => {
    setFormData((prev) => ({ ...prev, medidas }));
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
      {/* 💰 Mostrar Saldo */}
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
            ? `Saldo disponible: $${saldo.toFixed(2)}`
            : "Saldo no disponible"}
        </span>
      </div>

      {/* Pasos del formulario */}
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
      {step === "requiere-empaque" && (
        <PasoRequiereEmpaque onNext={handleRequiereEmpaqueNext} />
      )}
      {step === "empaque" && <PasoEmpaque onNext={handleEmpaqueNext} />}
      {step === "medidas" && (
        <PasoMedidas
          nombreProducto={formData.nombre_producto}
          onNext={handleMedidasNext}
        />
      )}

      {step === "resumen" && (
        <div className="text-center mt-10 space-y-4">
          <h2 className="text-2xl font-bold">Resumen del Envío</h2>
          <pre className="text-left bg-gray-100 p-4 rounded text-sm overflow-x-auto">
            {JSON.stringify(formData, null, 2)}
          </pre>
          {!puedeGenerarGuia() && (
            <p className="text-red-600 font-medium text-sm">
              ❌ No se puede generar guía. El saldo disponible es insuficiente.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleResumenNext}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              disabled={!puedeGenerarGuia()}
            >
              Generar guía
            </button>
            <button
              onClick={handleReset}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              ← Volver al inicio
            </button>
          </div>
        </div>
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
