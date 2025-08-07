"use client";

import React, { useEffect, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getCredenciales, SERVIENTREGA_CONFIG } from "@/config/servientrega";

interface PasoResumenProps {
  formData: any;
  onBack: () => void;
  onConfirm: () => void;
}

interface TarifaResponse {
  flete: number | string;
  valor_declarado: number | string;
  valor_empaque: number | string;
  seguro?: number | string;
  tiempo: string | null;
  peso_vol?: string | number;
}

// Usar configuración centralizada
const { DEFAULT_EMPAQUE, DEFAULT_CP_ORI, DEFAULT_CP_DES } = SERVIENTREGA_CONFIG;

const Campo = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number | undefined;
  highlight?: boolean;
}) => (
  <div className="flex justify-between py-1 text-sm border-b last:border-0">
    <span className="font-medium text-gray-600">{label}</span>
    <span
      className={`text-right ${
        highlight ? "text-red-600 font-bold" : "text-gray-900"
      }`}
    >
      {value !== undefined && value !== null && value !== "" ? value : "-"}
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
  <div className="mb-6 border rounded-lg p-4 bg-gray-50">
    <h3 className="text-md font-semibold text-primary mb-3">{titulo}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
      {children}
    </div>
  </div>
);

export default function PasoResumen({
  formData,
  onBack,
  onConfirm,
}: PasoResumenProps) {
  const { remitente, destinatario, medidas, punto_atencion_id } = formData;
  const [tarifa, setTarifa] = useState<TarifaResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Desglose dirección para presentación más clara
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

  // Calcula peso volumétrico
  const calcularPesoVolumetrico = () => {
    const alto = Number(medidas?.alto || 0);
    const ancho = Number(medidas?.ancho || 0);
    const largo = Number(medidas?.largo || 0);
    return alto > 0 && ancho > 0 && largo > 0
      ? (alto * ancho * largo) / 5000
      : 0;
  };

  const pesoFisico = Number(medidas?.peso || 0);
  const pesoVolumetrico = Number(tarifa?.peso_vol || calcularPesoVolumetrico());
  const pesoFacturable = Math.max(pesoFisico, pesoVolumetrico);

  // Calcula tarifa usando backend
  useEffect(() => {
    const fetchTarifa = async () => {
      setLoading(true);
      try {
        const isInternacional =
          (destinatario?.pais || "").toUpperCase() !== "ECUADOR";
        const credenciales = getCredenciales();

        const payload = {
          tipo: isInternacional
            ? "obtener_tarifa_internacional"
            : "obtener_tarifa_nacional",
          pais_ori: remitente?.pais || "ECUADOR",
          ciu_ori: (remitente?.ciudad || "").toUpperCase(),
          provincia_ori: (remitente?.provincia || "").toUpperCase(),
          pais_des: destinatario?.pais || "ECUADOR",
          ciu_des: (destinatario?.ciudad || "").toUpperCase(),
          provincia_des: (destinatario?.provincia || "").toUpperCase(),
          valor_seguro: (medidas?.valor_seguro ?? "0").toString(),
          valor_declarado: (medidas?.valor_declarado ?? "0").toString(),
          peso: pesoFacturable.toString(),
          alto: (medidas?.alto ?? 0).toString(),
          ancho: (medidas?.ancho ?? 0).toString(),
          largo: (medidas?.largo ?? 0).toString(),
          recoleccion: "NO",
          nombre_producto:
            formData?.nombre_producto || SERVIENTREGA_CONFIG.DEFAULT_PRODUCTO,
          empaque: formData.requiere_empaque
            ? formData.empaque?.tipo_empaque || DEFAULT_EMPAQUE
            : DEFAULT_EMPAQUE,
          usuingreso: credenciales.usuingreso,
          contrasenha: credenciales.contrasenha,
          ...(isInternacional && {
            codigo_postal_ori: remitente?.codigo_postal || DEFAULT_CP_ORI,
            codigo_postal_des: destinatario?.codigo_postal || DEFAULT_CP_DES,
          }),
        };

        console.log("📤 Payload para tarifa (PasoResumen):", payload);

        const res = await axiosInstance.post("/servientrega/tarifa", payload);
        const resultado = Array.isArray(res.data) ? res.data[0] : res.data;

        console.log("📥 Respuesta de tarifa (PasoResumen):", res.data);
        if (!resultado || resultado.flete === undefined) {
          toast.error("No se pudo calcular la tarifa. Verifica los datos.");
          setTarifa(null);
          return;
        }
        setTarifa({
          ...resultado,
          flete: Number(resultado.flete) || 0,
          valor_empaque: Number(resultado.valor_empaque) || 0,
          valor_declarado: Number(resultado.valor_declarado) || 0,
          seguro: resultado.seguro
            ? Number(resultado.seguro)
            : medidas?.valor_seguro || 0,
          peso_vol: resultado.peso_vol
            ? Number(resultado.peso_vol)
            : calcularPesoVolumetrico(),
        });
      } catch (err) {
        console.error("Error al obtener tarifa:", err);
        toast.error("Error al calcular la tarifa. Intenta nuevamente.");
        setTarifa(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTarifa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  // Total calculado
  const calcularTotal = (): string => {
    if (!tarifa) return "0.00";
    const flete = Number(tarifa.flete) || 0;
    const empaque = Number(tarifa.valor_empaque) || 0;
    return (flete + empaque).toFixed(2);
  };

  // Valida saldo antes de permitir confirmar
  const validarSaldoAntesConfirmar = async () => {
    if (!punto_atencion_id) {
      toast.error("No se ha identificado el punto de atención.");
      return;
    }
    try {
      const { data } = await axiosInstance.get(
        `/servientrega/saldo/validar/${punto_atencion_id}`
      );
      if (data?.estado === "OK") {
        onConfirm();
      } else {
        toast.error(
          data?.mensaje || "Saldo insuficiente para generar esta guía."
        );
      }
    } catch (err) {
      console.error("Error al validar saldo:", err);
      toast.error("No se pudo validar el saldo disponible.");
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle className="text-xl">Resumen de la Guía</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Seccion titulo="📦 Producto">
          <Campo
            label="Nombre del producto"
            value={formData?.nombre_producto || "N/A"}
          />
          <Campo
            label="Contenido"
            value={formData?.contenido || formData?.nombre_producto || "N/A"}
          />
        </Seccion>

        <Seccion titulo="🧍 Remitente">
          <Campo label="Nombre" value={remitente?.nombre} />
          <Campo
            label="Cédula"
            value={remitente?.identificacion || remitente?.cedula}
          />
          <Campo
            label="Ciudad"
            value={`${remitente?.ciudad} - ${remitente?.provincia}`}
          />
          <Campo label="Teléfono" value={remitente?.telefono} />
          <Campo label="Email" value={remitente?.email} />
          <Campo label="Dirección" value={remitente?.direccion} />
        </Seccion>

        <Seccion titulo="🎯 Destinatario">
          <Campo label="Nombre" value={destinatario?.nombre} />
          <Campo
            label="Cédula"
            value={destinatario?.identificacion || destinatario?.cedula}
          />
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
          <Campo label="Dirección" value={destinatario?.direccion} />
        </Seccion>

        <Seccion titulo="📐 Medidas y valores">
          <Campo
            label="Valor declarado"
            value={`$${medidas?.valor_declarado}`}
          />
          <Campo
            label="Valor asegurado"
            value={`$${tarifa?.seguro ?? medidas?.valor_seguro ?? 0}`}
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
          <Campo
            label="Medidas (cm)"
            value={`${medidas?.alto} x ${medidas?.ancho} x ${medidas?.largo}`}
          />
        </Seccion>

        {tarifa && (
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
              value={`$${Number(tarifa.valor_declarado).toFixed(2)}`}
            />
            <Campo
              label="Seguro calculado"
              value={`$${tarifa.seguro ?? medidas?.valor_seguro ?? 0}`}
            />
            <Campo
              label="Tiempo estimado"
              value={tarifa.tiempo ? `${tarifa.tiempo} día(s)` : "N/A"}
            />
            <Campo
              label="Total estimado a pagar"
              value={`$${calcularTotal()}`}
              highlight
            />
          </Seccion>
        )}

        {loading && (
          <p className="text-sm text-gray-500">Calculando tarifa...</p>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            ← Atrás
          </Button>
          <Button
            onClick={validarSaldoAntesConfirmar}
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
