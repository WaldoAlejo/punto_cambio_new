"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { Separator } from "@/components/ui/separator";

interface Empaque {
  articulo: string;
  valorventa: string;
}

interface Props {
  nombreProducto: string;
  esDocumento: boolean;
  paisDestino: string;
  ciudadDestino: string;
  provinciaDestino: string;
  onNext: (data: {
    medidas: {
      alto: number;
      ancho: number;
      largo: number;
      peso: number;
      valor_declarado: number;
      valor_seguro: number;
      recoleccion: boolean;
    };
    empaque?: {
      tipo_empaque: string;
      cantidad: number;
      descripcion: string;
      costo_unitario: number;
      costo_total: number;
    };
    resumen_costos: {
      costo_empaque: number;
      valor_seguro: number;
      flete: number;
      total: number;
    };
  }) => void;
}

export default function PasoEmpaqueYMedidas({
  nombreProducto,
  esDocumento,
  paisDestino,
  ciudadDestino,
  provinciaDestino,
  onNext,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [empaques, setEmpaques] = useState<Empaque[]>([]);
  const [loadingEmpaques, setLoadingEmpaques] = useState(true);
  const [flete, setFlete] = useState<number>(0);
  const [loadingFlete, setLoadingFlete] = useState(false);

  const [medidas, setMedidas] = useState({
    alto: "",
    ancho: "",
    largo: "",
    peso: "",
    valor_declarado: "",
    recoleccion: false,
  });

  const [requiereEmpaque, setRequiereEmpaque] = useState(true);
  const [empaque, setEmpaque] = useState({
    tipo_empaque: "",
    cantidad: 1,
    descripcion: "",
    costo_unitario: 0,
    costo_total: 0,
  });

  const esInternacional = paisDestino?.toUpperCase() !== "ECUADOR";

  // 📦 Cargar empaques disponibles
  useEffect(() => {
    const fetchEmpaques = async () => {
      try {
        setLoadingEmpaques(true);
        const { data } = await axios.post("/api/servientrega/empaques", {});
        if (data?.fetch) {
          setEmpaques(data.fetch);
        } else {
          toast.error("No se pudieron cargar los empaques.");
        }
      } catch {
        toast.error("Error al obtener la lista de empaques.");
      } finally {
        setLoadingEmpaques(false);
      }
    };
    fetchEmpaques();
  }, []);

  // ✅ Forzar empaque en internacional y mostrar toast
  useEffect(() => {
    if (esInternacional && empaques.length > 0) {
      toast.info(
        "En envíos internacionales debes seleccionar un empaque. Se aplicará el empaque por defecto si no eliges uno."
      );
      const defaultEmpaque =
        empaques.find((emp) => emp.articulo.toUpperCase().includes("SOBRE")) ||
        empaques[0];
      if (defaultEmpaque) {
        const costoUnitario = parseFloat(defaultEmpaque.valorventa) || 0;
        setEmpaque({
          tipo_empaque: defaultEmpaque.articulo,
          cantidad: 1,
          descripcion: `${defaultEmpaque.articulo} ($${costoUnitario.toFixed(
            2
          )})`,
          costo_unitario: costoUnitario,
          costo_total: costoUnitario,
        });
      }
      setRequiereEmpaque(true);
    }
  }, [esInternacional, empaques]);

  // 📐 Calcular costo total de empaque
  useEffect(() => {
    setEmpaque((prev) => ({
      ...prev,
      costo_total: prev.costo_unitario * prev.cantidad,
    }));
  }, [empaque.cantidad, empaque.costo_unitario]);

  // 🚚 Calcular flete automáticamente
  useEffect(() => {
    const calcularFlete = async () => {
      if (!medidas.peso || !ciudadDestino || !provinciaDestino) return;
      setLoadingFlete(true);

      try {
        const payload = {
          tipo: esInternacional
            ? "obtener_tarifa_internacional"
            : "obtener_tarifa_nacional",
          pais_ori: "ECUADOR",
          ciu_ori: "QUITO",
          provincia_ori: "PICHINCHA",
          pais_des: paisDestino,
          ciu_des: ciudadDestino,
          provincia_des: provinciaDestino,
          valor_seguro: medidas.valor_declarado || "0",
          valor_declarado: medidas.valor_declarado || "0",
          peso: medidas.peso,
          alto: medidas.alto || "0",
          ancho: medidas.ancho || "0",
          largo: medidas.largo || "0",
          recoleccion: medidas.recoleccion ? "SI" : "NO",
          nombre_producto: nombreProducto || "",
          empaque: requiereEmpaque ? empaque.tipo_empaque : "",
        };

        const res = await axios.post("/api/servientrega/tarifa", payload);
        if (Array.isArray(res.data) && res.data[0]?.flete !== undefined) {
          const fleteValor = parseFloat(res.data[0].flete) || 0;
          setFlete(fleteValor);

          if (fleteValor <= 0) {
            toast.error("No se pudo calcular el flete. Verifica los datos.");
          }
        } else {
          toast.error("Error al calcular el flete. Intenta nuevamente.");
        }
      } catch {
        toast.error("Error al calcular el flete.");
      } finally {
        setLoadingFlete(false);
      }
    };
    calcularFlete();
  }, [
    medidas.peso,
    medidas.alto,
    medidas.ancho,
    medidas.largo,
    medidas.valor_declarado,
    medidas.recoleccion,
    ciudadDestino,
    provinciaDestino,
    paisDestino,
    empaque.tipo_empaque,
    requiereEmpaque,
  ]);

  // ✏️ Manejo de inputs
  const handleMedidaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (
      ["alto", "ancho", "largo", "peso", "valor_declarado"].includes(name) &&
      !/^\d*\.?\d*$/.test(value)
    )
      return;
    setMedidas((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmpaqueSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    const empaqueData = empaques.find((emp) => emp.articulo === selected);
    if (empaqueData) {
      const costoUnitario = parseFloat(empaqueData.valorventa) || 0;
      setEmpaque({
        tipo_empaque: empaqueData.articulo,
        cantidad: 1,
        descripcion: `${empaqueData.articulo} ($${costoUnitario.toFixed(2)})`,
        costo_unitario: costoUnitario,
        costo_total: costoUnitario,
      });
    }
  };

  const handleCantidadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, parseInt(e.target.value) || 1);
    setEmpaque((prev) => ({ ...prev, cantidad: value }));
  };

  const toggleRecoleccion = () => {
    setMedidas((prev) => ({ ...prev, recoleccion: !prev.recoleccion }));
  };

  const calcularResumenCostos = () => {
    const valorSeguro = parseFloat(medidas.valor_declarado || "0");
    const costoEmpaque = requiereEmpaque ? empaque.costo_total : 0;
    return {
      costo_empaque: costoEmpaque,
      valor_seguro: valorSeguro,
      flete,
      total: costoEmpaque + valorSeguro + flete,
    };
  };

  const handleContinue = () => {
    if (flete <= 0) {
      toast.error("No puedes continuar sin un flete válido.");
      return;
    }

    const { alto, ancho, largo, peso, valor_declarado, recoleccion } = medidas;
    const resumenCostos = calcularResumenCostos();

    if (!valor_declarado || parseFloat(valor_declarado) <= 0) {
      toast.error("Debes ingresar un valor declarado válido.");
      return;
    }
    if (!esDocumento && (!alto || !ancho || !largo || !peso)) {
      toast.error("Debes ingresar todas las medidas y el peso.");
      return;
    }

    const payload = {
      medidas: {
        alto: esDocumento ? 0 : parseFloat(alto),
        ancho: esDocumento ? 0 : parseFloat(ancho),
        largo: esDocumento ? 0 : parseFloat(largo),
        peso: esDocumento ? 0 : parseFloat(peso),
        valor_declarado: parseFloat(valor_declarado),
        valor_seguro: parseFloat(valor_declarado),
        recoleccion,
      },
      empaque: requiereEmpaque
        ? {
            tipo_empaque: empaque.tipo_empaque,
            cantidad: empaque.cantidad,
            descripcion: empaque.descripcion,
            costo_unitario: empaque.costo_unitario,
            costo_total: empaque.costo_total,
          }
        : undefined,
      resumen_costos: resumenCostos,
    };

    setLoading(true);
    onNext(payload);
  };

  const resumenCostos = calcularResumenCostos();

  return (
    <Card className="w-full max-w-xl mx-auto mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle>Detalles del paquete - {nombreProducto}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Campos de medidas */}
        {!esDocumento && (
          <div className="grid grid-cols-2 gap-4">
            {["alto", "ancho", "largo", "peso"].map((campo) => (
              <div key={campo}>
                <Label htmlFor={campo} className="font-medium capitalize">
                  {campo} {campo === "peso" ? "(kg)" : "(cm)"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  name={campo}
                  placeholder={`Ingrese ${campo}`}
                  value={(medidas as any)[campo]}
                  onChange={handleMedidaChange}
                  type="number"
                  min="0"
                  step="0.1"
                />
              </div>
            ))}
          </div>
        )}

        {/* Valor declarado */}
        <div>
          <Label htmlFor="valor_declarado" className="font-medium">
            Valor declarado (USD) <span className="text-red-500">*</span>
          </Label>
          <Input
            name="valor_declarado"
            placeholder="Ej: 50.00"
            value={medidas.valor_declarado}
            onChange={handleMedidaChange}
            type="number"
            min="0"
            step="0.01"
          />
        </div>

        {/* Seguro automático */}
        {medidas.valor_declarado && (
          <div className="text-sm text-gray-600">
            Seguro calculado automáticamente:{" "}
            <span className="font-semibold text-green-600">
              ${parseFloat(medidas.valor_declarado || "0").toFixed(2)}
            </span>
          </div>
        )}

        {/* Empaque */}
        <div className="flex items-center justify-between mt-4">
          <Label className="font-medium">
            ¿Requiere empaque y embalaje?
            {esInternacional && (
              <span className="text-red-500 ml-1">
                (Obligatorio internacional)
              </span>
            )}
          </Label>
          <Switch
            checked={requiereEmpaque}
            onCheckedChange={setRequiereEmpaque}
            disabled={esInternacional}
          />
        </div>

        {requiereEmpaque && (
          <>
            <hr className="my-4" />
            <div>
              <Label htmlFor="tipo_empaque">
                Seleccione el tipo de empaque{" "}
                <span className="text-red-500">*</span>
              </Label>
              <select
                id="tipo_empaque"
                className="w-full border rounded p-2 mt-1"
                value={empaque.tipo_empaque}
                onChange={handleEmpaqueSelect}
                disabled={loadingEmpaques}
              >
                <option value="">-- Seleccione un empaque --</option>
                {empaques.map((emp, idx) => (
                  <option key={idx} value={emp.articulo}>
                    {emp.articulo} (${emp.valorventa})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <Label htmlFor="cantidad">
                  Cantidad <span className="text-red-500">*</span>
                </Label>
                <Input
                  name="cantidad"
                  type="number"
                  min="1"
                  value={empaque.cantidad}
                  onChange={handleCantidadChange}
                />
              </div>
              <div className="flex flex-col justify-end">
                <span className="text-sm text-gray-600">
                  Costo total del empaque:
                </span>
                <span className="font-semibold text-green-600 text-lg">
                  ${empaque.costo_total.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Resumen de costos */}
        <Separator className="my-4" />
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">
            💰 Resumen de costos
          </h4>
          <div className="flex justify-between text-sm border-b py-1">
            <span>Costo de empaque:</span>
            <span className="font-medium">
              ${resumenCostos.costo_empaque.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm border-b py-1">
            <span>Seguro (valor declarado):</span>
            <span className="font-medium">
              ${resumenCostos.valor_seguro.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm border-b py-1">
            <span>Flete estimado:</span>
            <span className="font-medium">
              {loadingFlete ? "Calculando..." : `$${flete.toFixed(2)}`}
            </span>
          </div>
          <div className="flex justify-between text-base font-semibold mt-2">
            <span>Total estimado:</span>
            <span className="text-green-700">
              ${resumenCostos.total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Botón continuar */}
        <Button
          className="w-full mt-5"
          onClick={handleContinue}
          disabled={loading || loadingFlete || flete <= 0}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Procesando...
            </>
          ) : loadingFlete ? (
            "Calculando flete..."
          ) : (
            "Continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
