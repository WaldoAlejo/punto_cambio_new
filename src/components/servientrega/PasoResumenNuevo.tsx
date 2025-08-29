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
import {
  Loader2,
  Calculator,
  Wallet,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import type { FormDataGuia } from "@/types/servientrega";
import {
  procesarRespuestaTarifa,
  formatearPayloadGuia,
  procesarRespuestaGuia,
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
  valor_empaque_iva?: number;
  total_empaque?: number;
  seguro?: number;
  tiempo: string | null;
  peso_vol?: number;
  trayecto?: string;
  descuento?: number;
  tarifa0?: number;
  tarifa12?: number;
  // Campos adicionales de Servientrega
  gtotal?: number;
  total_transacion?: number; // Este es el valor real a cobrar
  peso_cobrar?: number;
  tiva?: number;
  prima?: number;
}

interface TarifaServientrega {
  flete: number;
  valor_declarado: string;
  tiempo: string;
  valor_empaque: string;
  valor_empaque_iva: string;
  total_empaque: string;
  trayecto: string;
  prima: number;
  peso: string;
  volumen: number;
  peso_cobrar: string;
  descuento: number;
  tarifa0: number;
  tarifa12: number;
  tiva: number;
  gtotal: number;
  total_transacion: string;
}

interface GuiaGenerada {
  guia: string;
  guia_64: string;
  proceso: string;
  flete: number;
  valor_empaque: number;
  tiva: number;
  total_transacion: number;
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
  const [tarifaServientrega, setTarifaServientrega] =
    useState<TarifaServientrega | null>(null);
  const [loading, setLoading] = useState(false);
  const [saldo, setSaldo] = useState<SaldoInfo | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [showTarifaModal, setShowTarifaModal] = useState(false);
  const [generandoGuia, setGenerandoGuia] = useState(false);
  const [guiaGenerada, setGuiaGenerada] = useState<GuiaGenerada | null>(null);

  // Estados del formulario
  const [contenido, setContenido] = useState(
    formData.contenido || formData.nombre_producto || ""
  );
  // TEMPORALMENTE DESACTIVADO - Forzar entrega a domicilio
  const [retiroOficina, setRetiroOficina] = useState(false);
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
    console.log("🔄 Iniciando cálculo de tarifa...");

    // Validar datos requeridos
    if (!formData.remitente || !formData.destinatario || !formData.medidas) {
      console.error("❌ Faltan datos requeridos para calcular tarifa");
      toast.error("Faltan datos para calcular la tarifa");
      return;
    }

    setLoading(true);
    try {
      // Usar función centralizada para formatear payload
      const payload = construirPayloadTarifa(formData);
      console.log("📤 Payload para tarifa:", payload);

      // Llamar a nuestro backend que se encarga de la comunicación con Servientrega
      const res = await axiosInstance.post("/servientrega/tarifa", payload);
      const data = res.data;

      console.log("📥 Respuesta de tarifa:", data);

      // La respuesta de Servientrega es un array con un objeto
      const tarifaData = Array.isArray(data) ? data[0] : data;

      // Guardar respuesta completa de Servientrega para el modal
      setTarifaServientrega(tarifaData);

      // Usar función centralizada para procesar respuesta
      const tarifaCalculada = procesarRespuestaTarifa(tarifaData);

      // Agregar el seguro del formData si no viene en la respuesta
      if (!tarifaCalculada.seguro && formData.medidas.valor_seguro) {
        tarifaCalculada.seguro = Number(formData.medidas.valor_seguro);
      }

      console.log("📊 Tarifa calculada:", tarifaCalculada);
      setTarifa(tarifaCalculada as TarifaResponse);

      // Actualizar formData con los costos calculados
      // Usar total_transacion como valor principal (es el valor real a cobrar)
      const totalCalculado =
        tarifaCalculada.total_transacion || tarifaCalculada.gtotal || 0;

      console.log("💰 Total calculado:", totalCalculado);
      console.log("📊 Desglose de costos:", {
        flete: tarifaCalculada.flete,
        valor_empaque: tarifaCalculada.valor_empaque,
        seguro: tarifaCalculada.seguro,
        tiva: tarifaCalculada.tiva,
        gtotal: tarifaCalculada.gtotal,
        total_transacion: tarifaCalculada.total_transacion,
      });

      // Actualizar el formData en el componente padre
      formData.resumen_costos = {
        costo_empaque: tarifaCalculada.valor_empaque || 0,
        valor_seguro: tarifaCalculada.seguro || 0,
        flete: tarifaCalculada.flete || 0,
        total: totalCalculado,
      };

      toast.success("Tarifa calculada exitosamente");
    } catch (error: any) {
      console.error("❌ Error al calcular tarifa:", error);

      // Mostrar error más específico
      let errorMessage = "Error al calcular la tarifa";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.errores) {
        errorMessage = `Errores de validación: ${error.response.data.errores
          .map((e: any) => e.message)
          .join(", ")}`;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      console.error("📋 Detalles del error:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Generar guía después de confirmar tarifa
  const generarGuia = async () => {
    if (!contenido.trim()) {
      toast.error("El contenido es obligatorio");
      return;
    }

    // TEMPORALMENTE DESACTIVADO - Validación de agencia para retiro en oficina
    // if (retiroOficina && !nombreAgencia.trim()) {
    //   toast.error(
    //     "Debe especificar el nombre de la agencia para retiro en oficina"
    //   );
    //   return;
    // }

    setGenerandoGuia(true);
    try {
      // Usar función centralizada para formatear payload
      const payload = formatearPayloadGuia({
        formData,
        contenido: contenido.trim(),
        retiro_oficina: retiroOficina,
        nombre_agencia_retiro_oficina: retiroOficina
          ? nombreAgencia.trim()
          : undefined,
        pedido: pedido.trim() || "PRUEBA",
        factura: factura.trim() || "PRUEBA",
      });

      // Agregar información del punto de atención y valor total
      const payloadCompleto = {
        ...payload,
        punto_atencion_id: formData.punto_atencion_id,
        valor_total: total, // Usar el total calculado
      };

      console.log("📤 Payload para generar guía:", payloadCompleto);

      const res = await axiosInstance.post(
        "/servientrega/generar-guia",
        payloadCompleto
      );
      const data = procesarRespuestaGuia(res.data);

      console.log("📥 Respuesta de generar guía procesada:", data);

      if (data?.guia && data?.guia_64) {
        setGuiaGenerada(data);
        toast.success(`✅ Guía generada exitosamente: ${data.guia}`);

        // Actualizar saldo después de generar la guía
        await obtenerSaldo();
      } else {
        toast.error("No se pudo generar la guía. Verifica los datos.");
      }
    } catch (error) {
      console.error("❌ Error al generar guía:", error);
      toast.error("Error al generar la guía. Intenta nuevamente.");
    } finally {
      setGenerandoGuia(false);
    }
  };

  // ✅ Cargar datos al montar
  useEffect(() => {
    console.log("🚀 Iniciando cálculo de tarifa y saldo...");
    console.log("📋 FormData recibido:", formData);
    calcularTarifa();
    obtenerSaldo();
  }, []);

  // ✅ Manejar envío del formulario
  const handleSubmit = () => {
    if (!contenido.trim()) {
      toast.error("El contenido es obligatorio");
      return;
    }

    // TEMPORALMENTE DESACTIVADO - Validación de agencia para retiro en oficina
    // if (retiroOficina && !nombreAgencia.trim()) {
    //   toast.error(
    //     "Debe especificar el nombre de la agencia para retiro en oficina"
    //   );
    //   return;
    // }

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

  // Usar total_transacion de Servientrega como valor principal
  const total = tarifa
    ? tarifa.total_transacion ||
      tarifa.gtotal ||
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
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Costos</h3>
            {tarifa ? (
              <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Flete:</span>
                  <span>${Number(tarifa.flete || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Empaque:</span>
                  <span>${Number(tarifa.valor_empaque || 0).toFixed(2)}</span>
                </div>
                {tarifa.seguro && Number(tarifa.seguro) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Seguro:</span>
                    <span>${Number(tarifa.seguro).toFixed(2)}</span>
                  </div>
                )}
                {tarifa.tiva && Number(tarifa.tiva) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>IVA:</span>
                    <span>${Number(tarifa.tiva).toFixed(2)}</span>
                  </div>
                )}
                {tarifa.descuento && Number(tarifa.descuento) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Descuento:</span>
                    <span>-${Number(tarifa.descuento).toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center">
                  <div className="flex justify-between font-semibold text-lg w-full">
                    <span>Total:</span>
                    <span className="text-blue-600">
                      ${Number(total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  {tarifaServientrega && !guiaGenerada && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTarifaModal(true)}
                      className="flex-1 mr-2"
                    >
                      Ver detalles completos
                    </Button>
                  )}
                </div>

                {/* Información adicional */}
                <div className="mt-3 pt-2 border-t border-blue-200">
                  {tarifa.peso_vol && Number(tarifa.peso_vol) > 0 && (
                    <div className="text-xs text-gray-500 text-center">
                      Peso volumétrico: {Number(tarifa.peso_vol).toFixed(2)} kg
                    </div>
                  )}
                  {tarifa.tiempo && (
                    <div className="text-xs text-gray-500 text-center mt-1">
                      Tiempo estimado: {tarifa.tiempo}
                    </div>
                  )}
                  {tarifa.trayecto && (
                    <div className="text-xs text-gray-500 text-center mt-1">
                      Trayecto: {tarifa.trayecto}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-gray-500 mb-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Calculando tarifa...
                    </>
                  ) : (
                    "Calculando costos..."
                  )}
                </div>
                {!loading && (
                  <div className="space-y-2">
                    <Button
                      onClick={calcularTarifa}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      Calcular tarifa
                    </Button>
                    <div className="text-xs text-gray-500 text-center">
                      Los costos se calcularán automáticamente
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Formulario adicional - Solo mostrar si no se ha generado la guía */}
          {!guiaGenerada && (
            <>
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

                {/* TEMPORALMENTE DESACTIVADO - Mostrar información de retiro de oficina si ya se seleccionó */}
                {/* TODO: Reactivar cuando se implemente completamente la funcionalidad de entrega en oficina */}
                {false &&
                  formData.retiro_oficina &&
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

                {/* TEMPORALMENTE DESACTIVADO - Solo mostrar checkbox si no se ha seleccionado agencia previamente */}
                {/* TODO: Reactivar cuando se implemente completamente la funcionalidad de entrega en oficina */}
                {false && !formData.retiro_oficina && (
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

                {/* INFORMACIÓN TEMPORAL - Solo entrega a domicilio disponible */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-600 font-medium">
                      🏠 Entrega a domicilio
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    El paquete será entregado en la dirección del destinatario
                    especificada anteriormente.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Actualmente solo está disponible la entrega a domicilio.
                  </p>
                </div>

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
                    <Label htmlFor="factura">
                      Número de factura (opcional)
                    </Label>
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
                    loading || !contenido.trim()
                    // TEMPORALMENTE DESACTIVADO - Validación de agencia
                    // || (retiroOficina && !nombreAgencia.trim())
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalles de tarifa */}
      <TarifaModal
        isOpen={showTarifaModal}
        onClose={() => setShowTarifaModal(false)}
        tarifa={tarifaServientrega}
        onConfirm={() => {
          setShowTarifaModal(false);
          generarGuia();
        }}
        loading={generandoGuia}
        saldoDisponible={saldo?.disponible}
        puntoAtencionNombre={formData.punto_atencion_id} // ← corregido aquí
      />

      {/* Modal/Card de guía generada */}
      {guiaGenerada && (
        <Card className="w-full max-w-2xl mx-auto mt-6 shadow-lg border rounded-xl">
          <CardHeader>
            <CardTitle className="text-green-600 flex items-center gap-2">
              <CheckCircle className="h-6 w-6" />
              ¡Guía generada exitosamente!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-green-800">
                  Número de guía: {guiaGenerada.guia}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  {guiaGenerada.proceso}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Flete:</span>
                <span className="font-medium ml-2">
                  ${guiaGenerada.flete?.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Empaque:</span>
                <span className="font-medium ml-2">
                  ${guiaGenerada.valor_empaque?.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">IVA:</span>
                <span className="font-medium ml-2">
                  ${guiaGenerada.tiva?.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Total:</span>
                <span className="font-bold text-green-600 ml-2">
                  ${guiaGenerada.total_transacion?.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-6">
              <Button
                onClick={() => {
                  if (guiaGenerada.guia_64) {
                    const pdfURL = `data:application/pdf;base64,${guiaGenerada.guia_64}`;
                    window.open(pdfURL, "_blank");
                  }
                }}
                disabled={!guiaGenerada.guia_64}
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                Ver PDF de la guía
              </Button>
              <Button
                onClick={() => {
                  setGuiaGenerada(null);
                  setTarifa(null);
                  setTarifaServientrega(null);
                  setContenido("");
                  setPedido("");
                  setFactura("");
                  setRetiroOficina(false);
                  setNombreAgencia("");
                }}
                className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                variant="secondary"
              >
                Generar otra guía
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function construirPayloadTarifa(formData: any) {
  return {
    tipo: "obtener_tarifa_nacional",
    ciu_ori: formData.remitente?.ciudad || "",
    provincia_ori: formData.remitente?.provincia || "",
    ciu_des: formData.destinatario?.ciudad || "",
    provincia_des: formData.destinatario?.provincia || "",
    valor_seguro: String(formData.medidas?.valor_seguro ?? ""),
    valor_declarado: String(formData.medidas?.valor_declarado ?? ""),
    peso: String(formData.medidas?.peso ?? ""),
    alto: String(formData.medidas?.alto ?? ""),
    ancho: String(formData.medidas?.ancho ?? ""),
    largo: String(formData.medidas?.largo ?? ""),
    recoleccion: formData.medidas?.recoleccion ? "SI" : "NO",
    nombre_producto: formData.nombre_producto || "",
    empaque: formData.empaque || "",
    // Las credenciales se manejan en el backend
  };
}
