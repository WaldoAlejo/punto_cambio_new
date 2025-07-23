"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface PasoResumenProps {
  formData: any;
  onBack: () => void;
  onConfirm: () => void;
}

interface TarifaResponse {
  flete: number;
  valor_declarado: string;
  tiempo: string;
  valor_empaque: string;
}

const Campo = ({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) => (
  <div className="flex justify-between border-b py-1 text-sm">
    <span className="font-medium text-gray-600">{label}</span>
    <span className="text-right text-gray-900">{value || "-"}</span>
  </div>
);

const Seccion = ({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) => (
  <div className="mb-4">
    <h3 className="text-md font-semibold text-primary mb-2">{titulo}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">{children}</div>
  </div>
);

export default function PasoResumen({
  formData,
  onBack,
  onConfirm,
}: PasoResumenProps) {
  const { remitente, destinatario, medidas } = formData;
  const [tarifa, setTarifa] = useState<TarifaResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTarifa = async () => {
      setLoading(true);
      try {
        const isInternacional = destinatario.pais?.toUpperCase() !== "ECUADOR";

        const payload = {
          tipo: isInternacional
            ? "obtener_tarifa_internacional"
            : "obtener_tarifa_nacional",
          pais_ori: "ECUADOR",
          ciu_ori: remitente.ciudad || "",
          provincia_ori: remitente.provincia || "",
          pais_des: destinatario.pais || "ECUADOR",
          ciu_des: destinatario.ciudad || "",
          provincia_des: destinatario.provincia || "",
          valor_seguro: medidas?.valor_seguro?.toString() || "0",
          valor_declarado: medidas?.valor_declarado?.toString() || "0",
          peso: medidas?.peso?.toString() || "0",
          alto: medidas?.alto?.toString() || "0",
          ancho: medidas?.ancho?.toString() || "0",
          largo: medidas?.largo?.toString() || "0",
          recoleccion: "NO",
          nombre_producto: formData.nombre_producto || "",
          empaque: formData.requiere_empaque
            ? formData.empaque?.detalle || ""
            : "",
        };

        const res = await axios.post("/api/servientrega/tarifa", payload);
        const resultado = Array.isArray(res.data) ? res.data[0] : res.data;
        setTarifa(resultado);
      } catch (err) {
        console.error("Error al obtener tarifa:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTarifa();
  }, [formData]);

  const calcularTotal = (): string => {
    if (!tarifa) return "";
    const flete = Number(tarifa.flete) || 0;
    const empaque = parseFloat(tarifa.valor_empaque) || 0;
    return (flete + empaque).toFixed(2);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Resumen de la Guía</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Seccion titulo="📦 Producto">
          <Campo label="Nombre del producto" value={formData.nombre_producto} />
          <Campo
            label="Contenido"
            value={formData.contenido || formData.nombre_producto}
          />
        </Seccion>

        <Seccion titulo="🧍 Remitente">
          <Campo label="Nombre" value={remitente?.nombre} />
          <Campo label="Cédula" value={remitente?.identificacion} />
          <Campo label="Dirección" value={remitente?.direccion} />
          <Campo
            label="Ciudad"
            value={`${remitente?.ciudad} - ${remitente?.provincia}`}
          />
          <Campo label="Teléfono" value={remitente?.telefono} />
          <Campo label="Email" value={remitente?.email} />
        </Seccion>

        <Seccion titulo="🎯 Destinatario">
          <Campo label="Nombre" value={destinatario?.nombre} />
          <Campo label="Cédula" value={destinatario?.identificacion} />
          <Campo label="Dirección" value={destinatario?.direccion} />
          <Campo
            label="Ciudad"
            value={`${destinatario?.ciudad} - ${destinatario?.provincia}`}
          />
          <Campo label="Teléfono" value={destinatario?.telefono} />
          <Campo label="País" value={destinatario?.pais} />
          {formData.retiro_oficina && (
            <Campo
              label="Agencia retiro en oficina"
              value={formData.nombre_agencia_retiro_oficina}
            />
          )}
        </Seccion>

        <Seccion titulo="📐 Medidas y valores">
          <Campo
            label="Valor declarado"
            value={`$${medidas?.valor_declarado}`}
          />
          <Campo label="Valor asegurado" value={`$${medidas?.valor_seguro}`} />
          <Campo label="Peso físico (kg)" value={medidas?.peso} />
          <Campo label="Peso volumétrico (kg)" value={medidas?.peso_vol} />
          <Campo label="Alto (cm)" value={medidas?.alto} />
          <Campo label="Ancho (cm)" value={medidas?.ancho} />
          <Campo label="Largo (cm)" value={medidas?.largo} />
        </Seccion>

        {tarifa && (
          <>
            <Separator />
            <Seccion titulo="💰 Tarifa estimada">
              <Campo
                label="Flete"
                value={`$${Number(tarifa.flete).toFixed(2)}`}
              />
              <Campo
                label="Valor Empaque"
                value={`$${Number(tarifa.valor_empaque).toFixed(2)}`}
              />
              <Campo
                label="Valor Declarado"
                value={`$${tarifa.valor_declarado}`}
              />
              <Campo
                label="Tiempo estimado"
                value={`${tarifa.tiempo} día(s)`}
              />
              <Campo
                label="Total estimado a pagar"
                value={`$${calcularTotal()}`}
              />
            </Seccion>
          </>
        )}

        {loading && (
          <p className="text-sm text-gray-500">Calculando tarifa...</p>
        )}

        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={onBack}>
            ← Atrás
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={loading || !tarifa}
          >
            Confirmar y generar guía
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
