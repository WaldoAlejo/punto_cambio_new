"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PasoResumenProps {
  formData: any;
  onBack: () => void;
  onConfirm: () => void;
}

interface TarifaResponse {
  flete: number;
  valor_declarado: string;
  valor_empaque: string;
  seguro?: string;
  tiempo: string | null;
  peso_vol?: string;
}

const DEFAULT_EMPAQUE = "AISLANTE DE HUMEDAD";
const DEFAULT_CP_ORI = "170150";
const DEFAULT_CP_DES = "110111";

const Campo = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number | undefined;
  highlight?: boolean;
}) => (
  <div className="flex justify-between border-b py-1 text-sm">
    <span className="font-medium text-gray-600">{label}</span>
    <span
      className={`text-right ${
        highlight ? "text-red-600 font-bold" : "text-gray-900"
      }`}
    >
      {value || "-"}
    </span>
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

  // 📌 Descomponer dirección
  const descomponerDireccion = (direccion: string) => {
    if (!direccion)
      return {
        callePrincipal: "-",
        numeracion: "-",
        calleSecundaria: "-",
        referencia: "-",
      };
    const partes = direccion.split(",").map((p) => p.trim());
    return {
      callePrincipal: partes[0]?.split("#")[0]?.trim() || "-",
      numeracion: partes[0]?.includes("#")
        ? partes[0].split("#")[1]?.trim() || "-"
        : "-",
      calleSecundaria: partes[1]?.replace(/^y\s*/i, "").trim() || "-",
      referencia: partes[2]?.replace(/^Ref:\s*/i, "").trim() || "-",
    };
  };

  // 📌 Calcular peso volumétrico (cm³ / 5000)
  const calcularPesoVolumetrico = () => {
    const alto = parseFloat(medidas?.alto || "0");
    const ancho = parseFloat(medidas?.ancho || "0");
    const largo = parseFloat(medidas?.largo || "0");
    if (alto > 0 && ancho > 0 && largo > 0) {
      return (alto * ancho * largo) / 5000;
    }
    return 0;
  };

  // 📌 Peso a facturar: el mayor entre físico y volumétrico
  const pesoFisico = parseFloat(medidas?.peso || "0");
  const pesoVolumetrico = parseFloat(
    tarifa?.peso_vol || calcularPesoVolumetrico().toFixed(2)
  );
  const pesoFacturable = Math.max(pesoFisico, pesoVolumetrico);

  useEffect(() => {
    const fetchTarifa = async () => {
      setLoading(true);
      try {
        const isInternacional = destinatario.pais?.toUpperCase() !== "ECUADOR";

        const payload = {
          tipo: isInternacional
            ? "obtener_tarifa_internacional"
            : "obtener_tarifa_nacional",
          pais_ori: remitente.pais || "ECUADOR",
          ciu_ori: remitente.ciudad || "",
          provincia_ori: remitente.provincia || "",
          pais_des: destinatario.pais || "ECUADOR",
          ciu_des: destinatario.ciudad || "",
          provincia_des: destinatario.provincia || "",
          valor_seguro: medidas?.valor_seguro?.toString() || "0",
          valor_declarado: medidas?.valor_declarado?.toString() || "0",
          peso: pesoFacturable.toString(), // 🔥 Usamos el peso mayor
          alto: medidas?.alto?.toString() || "0",
          ancho: medidas?.ancho?.toString() || "0",
          largo: medidas?.largo?.toString() || "0",
          recoleccion: "NO",
          nombre_producto: formData.nombre_producto || "",
          empaque: formData.requiere_empaque
            ? formData.empaque?.detalle || DEFAULT_EMPAQUE
            : DEFAULT_EMPAQUE,
          ...(isInternacional && {
            codigo_postal_ori: remitente.codigo_postal || DEFAULT_CP_ORI,
            codigo_postal_des: destinatario.codigo_postal || DEFAULT_CP_DES,
          }),
        };

        const res = await axios.post("/api/servientrega/tarifa", payload);
        const resultado = Array.isArray(res.data) ? res.data[0] : res.data;

        if (!resultado || resultado.flete === undefined) {
          toast.error("No se pudo calcular la tarifa. Verifica los datos.");
          return;
        }

        // Agregar cálculo de peso volumétrico si la API no lo devuelve
        if (!resultado.peso_vol) {
          resultado.peso_vol = calcularPesoVolumetrico().toFixed(2);
        }

        setTarifa(resultado);
      } catch (err) {
        console.error("Error al obtener tarifa:", err);
        toast.error("Error al calcular la tarifa. Intenta nuevamente.");
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

  const direccionRemitente = descomponerDireccion(remitente?.direccion || "");
  const direccionDestinatario = descomponerDireccion(
    destinatario?.direccion || ""
  );

  return (
    <Card className="w-full max-w-3xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Resumen de la Guía</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Producto */}
        <Seccion titulo="📦 Producto">
          <Campo label="Nombre del producto" value={formData.nombre_producto} />
          <Campo
            label="Contenido"
            value={formData.contenido || formData.nombre_producto}
          />
        </Seccion>

        {/* Remitente */}
        <Seccion titulo="🧍 Remitente">
          <Campo label="Nombre" value={remitente?.nombre} />
          <Campo label="Cédula" value={remitente?.identificacion} />
          <Campo
            label="Calle principal"
            value={direccionRemitente.callePrincipal}
          />
          <Campo label="Numeración" value={direccionRemitente.numeracion} />
          <Campo
            label="Calle secundaria"
            value={direccionRemitente.calleSecundaria}
          />
          <Campo label="Referencia" value={direccionRemitente.referencia} />
          <Campo
            label="Ciudad"
            value={`${remitente?.ciudad} - ${remitente?.provincia}`}
          />
          <Campo label="Teléfono" value={remitente?.telefono} />
          <Campo label="Email" value={remitente?.email} />
        </Seccion>

        {/* Destinatario */}
        <Seccion titulo="🎯 Destinatario">
          <Campo label="Nombre" value={destinatario?.nombre} />
          <Campo label="Cédula" value={destinatario?.identificacion} />
          <Campo
            label="Calle principal"
            value={direccionDestinatario.callePrincipal}
          />
          <Campo label="Numeración" value={direccionDestinatario.numeracion} />
          <Campo
            label="Calle secundaria"
            value={direccionDestinatario.calleSecundaria}
          />
          <Campo label="Referencia" value={direccionDestinatario.referencia} />
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

        {/* Medidas */}
        <Seccion titulo="📐 Medidas y valores">
          <Campo
            label="Valor declarado"
            value={`$${medidas?.valor_declarado}`}
          />
          <Campo
            label="Valor asegurado"
            value={`$${tarifa?.seguro || medidas?.valor_seguro}`}
          />
          <Campo label="Peso físico (kg)" value={pesoFisico} />
          <Campo
            label="Peso volumétrico (kg)"
            value={pesoVolumetrico.toFixed(2)}
          />
          <Campo
            label="Peso facturable (kg)"
            value={pesoFacturable.toFixed(2)}
            highlight={
              pesoFacturable === pesoVolumetrico && pesoVolumetrico > pesoFisico
            }
          />
          <Campo label="Alto (cm)" value={medidas?.alto} />
          <Campo label="Ancho (cm)" value={medidas?.ancho} />
          <Campo label="Largo (cm)" value={medidas?.largo} />
        </Seccion>

        {/* Tarifa */}
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
                label="Seguro calculado"
                value={`$${tarifa.seguro || medidas?.valor_seguro}`}
              />
              <Campo
                label="Tiempo estimado"
                value={tarifa.tiempo ? `${tarifa.tiempo} día(s)` : "N/A"}
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

        {/* Botones */}
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
