"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Calculator, Wallet, AlertTriangle } from "lucide-react";
import type { FormDataGuia } from "@/types/servientrega";
import {
  formatearPayloadTarifa,
  procesarRespuestaTarifa,
} from "@/config/servientrega";
import TarifaModal from "./TarifaModal";

interface PasoResumenProps {
  formData: FormDataGuia;
  onNext: (data: {
    contenido: string;
    retiro_oficina: boolean;
    nombre_agencia_retiro_oficina?: string;
    pedido?: string;
    factura?: string;
  }) => void;
}

interface TarifaResponse {
  flete: number;
  valor_declarado: number;
  valor_empaque: number;
  seguro?: number;
  tiempo: string | null;
  peso_vol?: number;
  // Campos adicionales de Servientrega
  gtotal?: number;
  peso_cobrar?: number;
  tiva?: number;
  prima?: number;
}

interface SaldoInfo {
  disponible: number;
  estado: "OK" | "SALDO_BAJO" | "ERROR";
  mensaje?: string;
}

const UMBRAL_SALDO_BAJO = 2.0;

export default function PasoResumenNuevo({
  formData,
  onNext,
}: PasoResumenProps) {
  const [tarifa, setTarifa] = useState<TarifaResponse | null>(null);
  const [tarifaServientrega, setTarifaServientrega] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saldo, setSaldo] = useState<SaldoInfo | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [showTarifaModal, setShowTarifaModal] = useState(false);

  // Estados del formulario
  const [contenido, setContenido] = useState(
    formData.contenido || formData.nombre_producto || ""
  );
  const [retiroOficina, setRetiroOficina] = useState(
    formData.retiro_oficina || false
  );
  const [nombreAgencia, setNombreAgencia] = useState(
    formData.nombre_agencia_retiro_oficina || ""
  );
  const [pedido, setPedido] = useState(formData.pedido || "");
  const [factura, setFactura] = useState(formData.factura || "");

  // ✅ Obtener saldo disponible
  const obtenerSaldo = async () => {
    if (!formData.punto_atencion_id) return;

    setLoadingSaldo(true);
    try {
      const { data } = await axiosInstance.get(
        `/servientrega/saldo/${formData.punto_atencion_id}`
      );

      const disponible = Number(data.disponible || 0);
      const estado = disponible < UMBRAL_SALDO_BAJO ? "SALDO_BAJO" : "OK";

      setSaldo({
        disponible,
        estado,
        mensaje:
          estado === "SALDO_BAJO"
            ? `Saldo bajo. Se recomienda solicitar más saldo.`
            : undefined,
      });
    } catch (error) {
      console.error("❌ Error al obtener saldo:", error);
      setSaldo({
        disponible: 0,
        estado: "ERROR",
        mensaje: "Error al consultar el saldo",
      });
    } finally {
      setLoadingSaldo(false);
    }
  };

  // ✅ Calcular tarifa
  const calcularTarifa = async () => {
    setLoading(true);
    try {
      // Usar función centralizada para formatear payload
      const payload = formatearPayloadTarifa({
        remitente: formData.remitente,
        destinatario: formData.destinatario,
        medidas: formData.medidas,
        empaque: formData.empaque,
        nombre_producto: formData.nombre_producto,
        recoleccion: formData.medidas.recoleccion,
      });

      console.log("📤 Payload para tarifa:", payload);

      const res = await axiosInstance.post("/servientrega/tarifa", payload);
      const data = res.data;

      console.log("📥 Respuesta de tarifa:", data);

      // Guardar respuesta completa de Servientrega para el modal
      if (Array.isArray(data) && data.length > 0) {
        setTarifaServientrega(data[0]);
      } else if (typeof data === 'object') {
        setTarifaServientrega(data);
      }

      // Usar función centralizada para procesar respuesta
      const tarifaCalculada = procesarRespuestaTarifa(data);

      // Agregar el seguro del formData si no viene en la respuesta
      if (!tarifaCalculada.seguro && formData.medidas.valor_seguro) {
        tarifaCalculada.seguro = Number(formData.medidas.valor_seguro);
      }

      setTarifa(tarifaCalculada as TarifaResponse);

      // Actualizar formData con los costos calculados
      const total =
        tarifaCalculada.flete +
        tarifaCalculada.valor_empaque +
        (tarifaCalculada.seguro || 0);

      // Actualizar el formData en el componente padre
      formData.resumen_costos = {
        costo_empaque: tarifaCalculada.valor_empaque,
        valor_seguro: tarifaCalculada.seguro || 0,
        flete: tarifaCalculada.flete,
        total: total,
      };

      toast.success("Tarifa calculada exitosamente");
    } catch (error) {
      console.error("❌ Error al calcular tarifa:", error);
      toast.error("Error al calcular la tarifa");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Cargar datos al montar
  useEffect(() => {
    calcularTarifa();
    obtenerSaldo();
  }, []);

  // ✅ Manejar envío del formulario
  const handleSubmit = () => {
    if (!contenido.trim()) {
      toast.error("El contenido es obligatorio");
      return;
    }

    if (retiroOficina && !nombreAgencia.trim()) {
      toast.error(
        "Debe especificar el nombre de la agencia para retiro en oficina"
      );
      return;
    }

    onNext({
      contenido: contenido.trim(),
      retiro_oficina: retiroOficina,
      nombre_agencia_retiro_oficina: retiroOficina
        ? nombreAgencia.trim()
        : undefined,
      pedido: pedido.trim() || undefined,
      factura: factura.trim() || undefined,
    });
  };

  // Usar gtotal de Servientrega si está disponible, sino calcular manualmente
  const total = tarifa
    ? tarifa.gtotal ||
      tarifa.flete +
        tarifa.valor_empaque +
        (tarifa.seguro || 0) +
        (tarifa.tiva || 0)
    : 0;
  const saldoSuficiente = saldo ? saldo.disponible >= total : false;
  const saldoBajo = saldo?.estado === "SALDO_BAJO";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Información del saldo */}
      <Card
        className={`${
          saldoBajo
            ? "border-yellow-300 bg-yellow-50"
            : saldo?.estado === "ERROR"
            ? "border-red-300 bg-red-50"
            : "border-green-300 bg-green-50"
        }`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Wallet
                className={`h-5 w-5 ${
                  saldoBajo
                    ? "text-yellow-600"
                    : saldo?.estado === "ERROR"
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              />
              <span>Saldo Disponible</span>
            </div>
            {loadingSaldo && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <div
                className={`text-2xl font-bold ${
                  saldoBajo
                    ? "text-yellow-600"
                    : saldo?.estado === "ERROR"
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                ${saldo?.disponible?.toFixed(2) || "0.00"}
              </div>
              {saldo?.mensaje && (
                <p
                  className={`text-sm ${
                    saldoBajo ? "text-yellow-600" : "text-red-600"
                  }`}
                >
                  {saldo.mensaje}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Costo estimado:</p>
              <p
                className={`text-lg font-semibold ${
                  saldoSuficiente ? "text-green-600" : "text-red-600"
                }`}
              >
                ${total.toFixed(2)}
              </p>
              {!saldoSuficiente && total > 0 && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Saldo insuficiente
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de la guía */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resumen de la Guía
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Información del remitente */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Remitente</h3>
            <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
              <p>
                <strong>Nombre:</strong> {formData.remitente?.nombre || "-"}
              </p>
              <p>
                <strong>Cédula:</strong> {formData.remitente?.cedula || "-"}
              </p>
              <p>
                <strong>Teléfono:</strong> {formData.remitente?.telefono || "-"}
              </p>
              <p>
                <strong>Dirección:</strong>{" "}
                {formData.remitente?.direccion || "-"}
              </p>
            </div>
          </div>

          {/* Información del destinatario */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Destinatario</h3>
            <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
              <p>
                <strong>Nombre:</strong> {formData.destinatario?.nombre || "-"}
              </p>
              <p>
                <strong>Cédula:</strong> {formData.destinatario?.cedula || "-"}
              </p>
              <p>
                <strong>Teléfono:</strong>{" "}
                {formData.destinatario?.telefono || "-"}
              </p>
              <p>
                <strong>Dirección:</strong>{" "}
                {formData.destinatario?.direccion || "-"}
              </p>
              <p>
                <strong>Ciudad:</strong> {formData.destinatario?.ciudad || "-"}
              </p>
            </div>
          </div>

          {/* Información del paquete */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Paquete</h3>
            <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
              <p>
                <strong>Producto:</strong> {formData.nombre_producto || "-"}
              </p>
              <p>
                <strong>Peso:</strong> {formData.medidas?.peso || 0} kg
              </p>
              <p>
                <strong>Dimensiones:</strong> {formData.medidas?.largo || 0} x{" "}
                {formData.medidas?.ancho || 0} x {formData.medidas?.alto || 0}{" "}
                cm
              </p>
              <p>
                <strong>Valor declarado:</strong> $
                {Number(formData.medidas?.valor_declarado || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Costos */}
          {tarifa && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Costos</h3>
              <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Flete:</span>
                  <span>${tarifa.flete.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Empaque:</span>
                  <span>${tarifa.valor_empaque.toFixed(2)}</span>
                </div>
                {tarifa.seguro && tarifa.seguro > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Seguro:</span>
                    <span>${tarifa.seguro.toFixed(2)}</span>
                  </div>
                )}
                {tarifa.tiva && tarifa.tiva > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>IVA:</span>
                    <span>${tarifa.tiva.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total:</span>
                    <span className="text-blue-600">${total.toFixed(2)}</span>
                  </div>
                  {tarifaServientrega && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTarifaModal(true)}
                      className="ml-4"
                    >
                      Ver detalles
                    </Button>
                  )}
                </div>
                {tarifa.gtotal && tarifa.gtotal !== total && (
                  <div className="flex justify-between text-xs text-orange-600 mt-1">
                    <span>Total Servientrega:</span>
                    <span>${tarifa.gtotal.toFixed(2)}</span>
                  </div>
                )}
                {tarifa.peso_vol && tarifa.peso_vol > 0 && (
                  <div className="text-xs text-gray-500 text-center mt-2">
                    Peso volumétrico: {tarifa.peso_vol} kg
                  </div>
                )}
                {tarifa.tiempo && (
                  <div className="text-xs text-gray-500 text-center">
                    Tiempo estimado: {tarifa.tiempo}
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Formulario adicional */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800">
              Información Adicional
            </h3>

            <div className="space-y-2">
              <Label htmlFor="contenido">Contenido del paquete *</Label>
              <Input
                id="contenido"
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="Describe el contenido del paquete"
                required
              />
            </div>

            {/* Mostrar información de retiro de oficina si ya se seleccionó */}
            {formData.retiro_oficina &&
              formData.nombre_agencia_retiro_oficina && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-600 font-medium">
                      📍 Retiro en oficina
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <strong>Agencia:</strong>{" "}
                    {formData.nombre_agencia_retiro_oficina}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    El paquete será entregado en la agencia seleccionada
                  </p>
                </div>
              )}

            {/* Solo mostrar checkbox si no se ha seleccionado agencia previamente */}
            {!formData.retiro_oficina && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="retiro-oficina"
                    checked={retiroOficina}
                    onCheckedChange={(checked) =>
                      setRetiroOficina(checked as boolean)
                    }
                  />
                  <Label htmlFor="retiro-oficina">Retiro en oficina</Label>
                </div>

                {retiroOficina && (
                  <div className="space-y-2">
                    <Label htmlFor="nombre-agencia">
                      Nombre de la agencia *
                    </Label>
                    <Input
                      id="nombre-agencia"
                      value={nombreAgencia}
                      onChange={(e) => setNombreAgencia(e.target.value)}
                      placeholder="Nombre de la agencia para retiro"
                      required
                    />
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pedido">Número de pedido (opcional)</Label>
                <Input
                  id="pedido"
                  value={pedido}
                  onChange={(e) => setPedido(e.target.value)}
                  placeholder="Ej: PED-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="factura">Número de factura (opcional)</Label>
                <Input
                  id="factura"
                  value={factura}
                  onChange={(e) => setFactura(e.target.value)}
                  placeholder="Ej: FAC-001"
                />
              </div>
            </div>
          </div>

          {/* Botón de continuar */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSubmit}
              disabled={
                loading ||
                !contenido.trim() ||
                (retiroOficina && !nombreAgencia.trim())
              }
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculando...
                </>
              ) : (
                "Continuar a Confirmación"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalles de tarifa */}
      <TarifaModal
        isOpen={showTarifaModal}
        onClose={() => setShowTarifaModal(false)}
        tarifa={tarifaServientrega}
        onConfirm={() => {
          setShowTarifaModal(false);
          handleSubmit();
        }}
        loading={loading}
      />
    </div>
  );
}
