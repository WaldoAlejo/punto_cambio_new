"use client";

import React, { useState } from "react";
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

export default function GenerarGuia({ user, selectedPoint }: GenerarGuiaProps) {
  const [step, setStep] = useState<Step>("producto");
  const [formData, setFormData] = useState<GuiaFormData>({
    nombre_producto: "",
    remitente: null,
    destinatario: null,
    requiere_empaque: null,
    empaque: null,
    medidas: null,
  });

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
    setStep("confirmar-envio");
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
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
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
          <div className="flex flex-col gap-2">
            <button
              onClick={handleResumenNext}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
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
        <PasoConfirmarEnvio formData={formData} onReset={handleReset} />
      )}
    </div>
  );
}
