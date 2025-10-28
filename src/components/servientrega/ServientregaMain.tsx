// src/components/servientrega/ServientregaMain.tsx
import React, { useState } from "react";
import { User, PuntoAtencion } from "../../types";
import PasoProducto from "./PasoProducto";
import PasoRemitente from "./PasoRemitente";
import PasoDestinatario from "./PasoDestinatario";
import PasoEmpaqueYMedidas from "./PasoEmpaqueYMedidas";
import PasoResumen from "./PasoResumen"; // ← unificado
import PasoConfirmarEnvio from "./PasoConfirmarEnvio";
import ListadoGuias from "./ListadoGuias";
import SaldoOperador from "./SaldoOperador";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, FileText } from "lucide-react";
import type {
  Remitente,
  Destinatario,
  Medidas,
  Empaque,
  FormDataGuia as FormDataGuiaType,
} from "@/types/servientrega";

interface ServientregaMainProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface ProductoSeleccionado {
  nombre_producto: string;
  esDocumento: boolean;
}

// Usar el tipo importado
type FormDataGuia = FormDataGuiaType;

type Paso =
  | "menu"
  | "producto"
  | "remitente"
  | "destinatario"
  | "empaque"
  | "resumen"
  | "confirmar"
  | "listado";

export default function ServientregaMain({
  user: _user,
  selectedPoint,
}: ServientregaMainProps) {
  const [pasoActual, setPasoActual] = useState<Paso>("menu");
  const [formData, setFormData] = useState<Partial<FormDataGuia>>({
    punto_atencion_id: selectedPoint?.id || "",
    nombre_producto: "",
    contenido: "",
    retiro_oficina: false,
    requiere_empaque: false,
    resumen_costos: {
      costo_empaque: 0,
      valor_seguro: 0,
      flete: 0,
      total: 0,
    },
  });

  const resetForm = () => {
    setFormData({
      punto_atencion_id: selectedPoint?.id || "",
      nombre_producto: "",
      contenido: "",
      retiro_oficina: false,
      requiere_empaque: false,
      resumen_costos: {
        costo_empaque: 0,
        valor_seguro: 0,
        flete: 0,
        total: 0,
      },
    });
    setPasoActual("menu");
  };

  const handleProductoNext = (producto: ProductoSeleccionado) => {
    setFormData((prev) => ({
      ...prev,
      nombre_producto: producto.nombre_producto,
      contenido: producto.nombre_producto,
    }));
    setPasoActual("remitente");
  };

  const handleRemitenteNext = (remitente: Remitente) => {
    setFormData((prev) => ({
      ...prev,
      remitente,
    }));
    setPasoActual("destinatario");
  };

  const handleDestinatarioNext = (
    destinatario: Destinatario,
    retiro_oficina: boolean,
    nombre_agencia?: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      destinatario,
      retiro_oficina,
      ...(nombre_agencia && { nombre_agencia_retiro_oficina: nombre_agencia }),
    }));
    setPasoActual("empaque");
  };

  const handleEmpaqueNext = (data: { medidas: Medidas; empaque?: Empaque }) => {
    setFormData((prev) => ({
      ...prev,
      medidas: data.medidas,
      empaque: data.empaque,
      requiere_empaque: !!data.empaque,
    }));
    setPasoActual("resumen");
  };

  // PasoResumen → “Confirmar y continuar”
  const handleResumenConfirm = (tarifaData: any) => {
    // Guardar los costos de tarifa en formData
    setFormData((prev) => ({
      ...prev,
      resumen_costos: {
        flete: tarifaData.flete || 0,
        valor_empaque: tarifaData.valor_empaque || 0,
        seguro: tarifaData.seguro || 0,
        tiva: tarifaData.tiva || 0,
        total: tarifaData.total_transacion || tarifaData.gtotal || 0,
        gtotal: tarifaData.gtotal || 0,
        total_transaccion: tarifaData.total_transacion || 0,
      },
    }));
    setPasoActual("confirmar");
  };

  // PasoConfirmarEnvio → éxito
  const handleGuiaGenerada = () => {
    resetForm();
  };

  const renderPaso = () => {
    switch (pasoActual) {
      case "menu":
        return (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Información del saldo */}
            {selectedPoint && (
              <div className="max-w-md mx-auto">
                <SaldoOperador
                  puntoAtencionId={selectedPoint.id}
                  puntoAtencionNombre={selectedPoint.nombre}
                />
              </div>
            )}

            {/* Menú principal */}
            <Card className="w-full max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="text-center">Servientrega</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => setPasoActual("producto")}
                  className="w-full h-16 text-lg"
                  variant="outline"
                >
                  <Package className="mr-3 h-6 w-6" />
                  Generar Nueva Guía
                </Button>
                <Button
                  onClick={() => setPasoActual("listado")}
                  className="w-full h-16 text-lg"
                  variant="outline"
                >
                  <FileText className="mr-3 h-6 w-6" />
                  Ver Guías Generadas
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case "producto":
        return <PasoProducto onNext={handleProductoNext} />;

      case "remitente":
        return (
          <PasoRemitente
            user={_user}
            selectedPoint={selectedPoint!}
            onNext={handleRemitenteNext}
          />
        );

      case "destinatario":
        return <PasoDestinatario onNext={handleDestinatarioNext} />;

      case "empaque":
        return (
          <PasoEmpaqueYMedidas
            nombre_producto={formData.nombre_producto || ""}
            esDocumento={
              formData.nombre_producto?.toUpperCase().includes("DOCUMENTO") ||
              false
            }
            paisDestino={formData.destinatario?.pais || ""}
            ciudadDestino={formData.destinatario?.ciudad || ""}
            provinciaDestino={formData.destinatario?.provincia || ""}
            paisOrigen={formData.remitente?.pais || "ECUADOR"}
            ciudadOrigen={formData.remitente?.ciudad || ""}
            provinciaOrigen={formData.remitente?.provincia || ""}
            onNext={handleEmpaqueNext}
          />
        );

      case "resumen":
        return (
          <PasoResumen
            formData={formData as FormDataGuia}
            onBack={() => setPasoActual("empaque")}
            onConfirm={handleResumenConfirm}
          />
        );

      case "confirmar":
        return (
          <PasoConfirmarEnvio
            formData={formData as FormDataGuia}
            onReset={resetForm}
            onSuccess={handleGuiaGenerada}
          />
        );

      case "listado":
        return <ListadoGuias />;

      default:
        return null;
    }
  };

  const showBackButton = pasoActual !== "menu" && pasoActual !== "listado";

  return (
    <div className="container mx-auto p-4">
      {showBackButton && (
        <Button
          onClick={() => {
            switch (pasoActual) {
              case "producto":
                setPasoActual("menu");
                break;
              case "remitente":
                setPasoActual("producto");
                break;
              case "destinatario":
                setPasoActual("remitente");
                break;
              case "empaque":
                setPasoActual("destinatario");
                break;
              case "resumen":
                setPasoActual("empaque");
                break;
              case "confirmar":
                setPasoActual("resumen");
                break;
              default:
                setPasoActual("menu");
            }
          }}
          variant="ghost"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      )}

      {pasoActual === "listado" && (
        <Button
          onClick={() => setPasoActual("menu")}
          variant="ghost"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Menú
        </Button>
      )}

      {renderPaso()}
    </div>
  );
}
