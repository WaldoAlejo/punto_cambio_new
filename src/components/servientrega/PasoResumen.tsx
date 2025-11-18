// src/components/servientrega/PasoResumen.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Wallet, AlertTriangle, Calculator } from "lucide-react";
import TarifaModal from "./TarifaModal";

/** Tipos mínimos locales (ajusta si ya los tienes tipados globalmente) */
interface Remitente {
  identificacion?: string;
  nombre?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  ciudad?: string;
  provincia?: string;
  codigo_postal?: string;
  pais?: string;
}
interface Destinatario extends Remitente {
  codpais?: number;
}
interface Medidas {
  alto: number;
  ancho: number;
  largo: number;
  peso: number;
  valor_declarado: number;
  valor_seguro?: number;
  recoleccion?: boolean;
}
interface FormDataGuia {
  remitente: Remitente;
  destinatario: Destinatario;
  medidas: Medidas;
  punto_atencion_id?: string | number;
  nombre_producto?: string; // Texto que viene del PasoProducto
  requiere_empaque?: boolean;
  empaque?: { tipo_empaque: string };
  contenido?: string;
  retiro_oficina?: boolean;
  nombre_agencia_retiro_oficina?: string;
  pedido?: string;
  factura?: string;
}

interface PasoResumenProps {
  formData: FormDataGuia;
  onBack: () => void;
  onConfirm: (tarifaData: TarifaResponseUI) => void; // Pasar la tarifa calculada
}

/** Respuesta que mostramos en la UI */
interface TarifaResponseUI {
  flete: number;
  valor_declarado: number;
  valor_empaque: number;
  seguro?: number;
  tiempo: string | null;
  peso_vol?: number;
  descuento?: number;
  tarifa0?: number;
  tarifa12?: number;
  tiva?: number;
  gtotal?: number;
  total_transacion?: number;
  trayecto?: string;
}

/** Para pintar campos */
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

/** Helpers de negocio */
const DEFAULT_EMPAQUE = "AISLANTE DE HUMEDAD";
const DEFAULT_CP_ORI = "170150";
const DEFAULT_CP_DES = "110111";
const UMBRAL_SALDO_BAJO = 2.0;

/** Normaliza el nombre del producto según documentación */
function mapProducto(
  nombre?: string
): "DOCUMENTO UNITARIO" | "MERCANCIA PREMIER" {
  const raw = (nombre || "").toUpperCase();
  if (raw.includes("DOC")) return "DOCUMENTO UNITARIO";
  return "MERCANCIA PREMIER";
}

/** Calcula peso volumétrico localmente */
function calcPesoVol({ alto = 0, ancho = 0, largo = 0 }: Partial<Medidas>) {
  const a = Number(alto) || 0;
  const b = Number(ancho) || 0;
  const c = Number(largo) || 0;
  return a > 0 && b > 0 && c > 0 ? (a * b * c) / 5000 : 0;
}

export default function PasoResumen({
  formData,
  onBack,
  onConfirm,
}: PasoResumenProps) {
  const { remitente, destinatario, medidas, punto_atencion_id } = formData;

  /** Estado UI */
  const [tarifa, setTarifa] = useState<TarifaResponseUI | null>(null);
  const [tarifaCruda, setTarifaCruda] = useState<any>(null); // para el modal
  const [loadingTarifa, setLoadingTarifa] = useState(false);

  const [saldo, setSaldo] = useState<{
    disponible: number;
    estado: "OK" | "SALDO_BAJO" | "ERROR";
    mensaje?: string;
  } | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  const [showTarifaModal, setShowTarifaModal] = useState(false);

  /** Cálculos de peso */
  const pesoFisico = Number(medidas?.peso || 0);
  const pesoVolumetrico = useMemo(
    () => Number(tarifa?.peso_vol || calcPesoVol(medidas)),
    [tarifa?.peso_vol, medidas]
  );
  const pesoFacturable = Math.max(pesoFisico, pesoVolumetrico);

  /** Total mostrado (preferimos total_transacion > gtotal > suma simple) */
  const total = useMemo(() => {
    if (!tarifa) return 0;
    if (tarifa.total_transacion && Number(tarifa.total_transacion) > 0) {
      return Number(tarifa.total_transacion);
    }
    if (tarifa.gtotal && Number(tarifa.gtotal) > 0) {
      return Number(tarifa.gtotal);
    }
    const flete = Number(tarifa.flete || 0);
    const empaque = Number(tarifa.valor_empaque || 0);
    const seguro = Number(tarifa.seguro || 0);
    const iva = Number(tarifa.tiva || 0);
    return flete + empaque + seguro + iva;
  }, [tarifa]);

  const saldoSuficiente = saldo ? saldo.disponible >= total : false;
  const saldoBajo = saldo?.estado === "SALDO_BAJO";

  /** Cargar saldo */
  const obtenerSaldo = async () => {
    if (!punto_atencion_id) return;
    setLoadingSaldo(true);
    try {
      const { data } = await axiosInstance.get(
        `/servientrega/saldo/${punto_atencion_id}`
      );
      const disponible = Number(data.disponible || 0);
      const estado = disponible < UMBRAL_SALDO_BAJO ? "SALDO_BAJO" : "OK";
      setSaldo({
        disponible,
        estado,
        mensaje:
          estado === "SALDO_BAJO"
            ? "Saldo bajo. Se recomienda solicitar más saldo."
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

  /** Cargar tarifa */
  const fetchTarifa = async () => {
    if (!remitente || !destinatario || !medidas) {
      toast.error("Faltan datos para calcular la tarifa.");
      return;
    }
    setLoadingTarifa(true);
    try {
      const isInternacional =
        (destinatario?.pais || "ECUADOR").toUpperCase() !== "ECUADOR";
      const nombre_producto = mapProducto(formData?.nombre_producto);

      // Tipo según doc: usamos "obtener_tarifa_nacional" incluso cuando haya país destino distinto
      const payload: any = {
        tipo: "obtener_tarifa_nacional",
        // Origen
        ciu_ori: (remitente?.ciudad || "").toUpperCase(),
        provincia_ori: (remitente?.provincia || "").toUpperCase(),
        // Destino
        ciu_des: (destinatario?.ciudad || "").toUpperCase(),
        provincia_des: (destinatario?.provincia || "").toUpperCase(),
        // Valores
        valor_seguro: String(medidas?.valor_seguro ?? "0"),
        valor_declarado: String(medidas?.valor_declarado ?? "0"),
        peso: String(pesoFacturable),
        alto: String(medidas?.alto ?? 0),
        ancho: String(medidas?.ancho ?? 0),
        largo: String(medidas?.largo ?? 0),
        recoleccion: "NO",
        nombre_producto, // "DOCUMENTO UNITARIO" | "MERCANCIA PREMIER"
      };

      // Solo agregar empaque si el usuario lo requiere
      if (formData.requiere_empaque) {
        payload.empaque = formData.empaque?.tipo_empaque || DEFAULT_EMPAQUE;
      }

      // Para “internacional” (doc usa mismo tipo pero añadimos país/códigos postales)
      if (isInternacional) {
        payload.pais_ori = remitente?.pais || "ECUADOR";
        payload.pais_des = destinatario?.pais || "ECUADOR";
        payload.codigo_postal_ori = remitente?.codigo_postal || DEFAULT_CP_ORI;
        payload.codigo_postal_des =
          destinatario?.codigo_postal || DEFAULT_CP_DES;
      }

      console.log("📤 Payload tarifa (PasoResumen):", payload);
      const res = await axiosInstance.post("/servientrega/tarifa", payload);
      const raw = Array.isArray(res.data) ? res.data[0] : res.data;
      setTarifaCruda(raw);

      if (!raw || raw.flete === undefined) {
        console.error("❌ Respuesta inválida de Servientrega:", raw);
        toast.error("No se pudo calcular la tarifa. Verifica los datos.");
        setTarifa(null);
        return;
      }

      // Normalización
      const tarifaUI: TarifaResponseUI = {
        flete: Number(raw.flete || 0),
        valor_declarado: Number(raw.valor_declarado || 0),
        valor_empaque: Number(raw.valor_empaque || 0),
        seguro: Number(raw.prima || raw.seguro || 0),
        tiempo: raw.tiempo || "1-2 días hábiles",
        peso_vol: Number(raw.peso_vol || raw.volumen || calcPesoVol(medidas)),
        descuento: Number(raw.descuento || 0),
        tarifa0: Number(raw.tarifa0 || 0),
        tarifa12: Number(raw.tarifa12 || 0),
        tiva: Number(raw.tiva || 0),
        gtotal: Number(raw.gtotal || 0),
        total_transacion: Number(raw.total_transacion || 0),
        trayecto: raw.trayecto || "",
      };

      setTarifa(tarifaUI);
      toast.success("Tarifa calculada exitosamente.");
    } catch (err) {
      console.error("❌ Error al obtener tarifa:", err);
      toast.error("Error al calcular la tarifa. Intenta nuevamente.");
      setTarifa(null);
    } finally {
      setLoadingTarifa(false);
    }
  };

  /** Validar saldo antes de confirmar */
  const validarSaldoAntesConfirmar = async () => {
    if (!punto_atencion_id) {
      toast.error("No se ha identificado el punto de atención.");
      return;
    }
    if (!tarifa) {
      toast.error("Aún no se ha calculado la tarifa.");
      return;
    }

    // Calcular el monto total de la transacción
    const montoTotal = tarifa.total_transacion || tarifa.gtotal || 0;

    try {
      const { data } = await axiosInstance.get(
        `/servientrega/saldo/validar/${punto_atencion_id}?monto=${montoTotal}`
      );

      console.log("🔍 Validación de saldo:", data);

      if (data?.estado === "OK") {
        if (tarifa) {
          onConfirm(tarifa);
        }
      } else {
        // Mostrar mensaje específico según el estado
        let mensaje =
          data?.mensaje || "Saldo insuficiente para generar esta guía.";

        if (data?.estado === "SIN_SALDO") {
          mensaje =
            "No hay saldo asignado para este punto de atención. Contacte al administrador.";
        } else if (data?.estado === "SALDO_AGOTADO") {
          mensaje = "El saldo disponible se ha agotado. Solicite una recarga.";
        } else if (data?.estado === "SALDO_INSUFICIENTE") {
          mensaje = `Saldo insuficiente. Disponible: $${data.disponible?.toFixed(
            2
          )}, Requerido: $${montoTotal.toFixed(2)}`;
        }

        toast.error(mensaje);
      }
    } catch (err) {
      console.error("Error al validar saldo:", err);
      toast.error("No se pudo validar el saldo disponible.");
    }
  };

  /** Efectos iniciales */
  useEffect(() => {
    fetchTarifa();
    obtenerSaldo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  return (
    <Card className="w-full max-w-5xl mx-auto mt-4 sm:mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle className="text-xl">Resumen de la Guía</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Panel de saldo */}
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

        {/* Producto */}
        <Seccion titulo="📦 Producto">
          <Campo
            label="Nombre del producto"
            value={mapProducto(formData?.nombre_producto)}
          />
          <Campo
            label="Contenido"
            value={
              formData?.contenido || mapProducto(formData?.nombre_producto)
            }
          />
        </Seccion>

        {/* Remitente */}
        <Seccion titulo="🧍 Remitente">
          <Campo label="Nombre" value={remitente?.nombre} />
          <Campo label="Cédula" value={remitente?.identificacion} />
          <Campo
            label="Ciudad"
            value={`${remitente?.ciudad} - ${remitente?.provincia}`}
          />
          <Campo label="Teléfono" value={remitente?.telefono} />
          <Campo label="Email" value={remitente?.email} />
          <Campo label="Dirección" value={remitente?.direccion} />
        </Seccion>

        {/* Destinatario */}
        <Seccion titulo="🎯 Destinatario">
          <Campo label="Nombre" value={destinatario?.nombre} />
          <Campo label="Cédula" value={destinatario?.identificacion} />
          <Campo
            label="Ciudad"
            value={`${destinatario?.ciudad} - ${destinatario?.provincia}`}
          />
          <Campo label="Teléfono" value={destinatario?.telefono} />
          <Campo label="País" value={destinatario?.pais} />
          <Campo label="Dirección" value={destinatario?.direccion} />
        </Seccion>

        {/* Medidas */}
        <Seccion titulo="📐 Medidas y valores">
          <Campo
            label="Valor declarado"
            value={`$${Number(medidas?.valor_declarado || 0).toFixed(2)}`}
          />
          <Campo
            label="Valor asegurado"
            value={`$${Number(medidas?.valor_seguro || 0).toFixed(2)}`}
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

        {/* Costos */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Costos
          </h3>

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
              {(tarifa.seguro || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Seguro:</span>
                  <span>${Number(tarifa.seguro).toFixed(2)}</span>
                </div>
              )}
              {(tarifa.tiva || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>IVA:</span>
                  <span>${Number(tarifa.tiva).toFixed(2)}</span>
                </div>
              )}
              {(tarifa.descuento || 0) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Descuento:</span>
                  <span>- ${Number(tarifa.descuento).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <div className="flex justify-between font-semibold text-lg w-full">
                  <span>Total:</span>
                  <span className="text-blue-600">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Ver detalle crudo de Servientrega */}
              {tarifaCruda && (
                <div className="flex justify-end mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTarifaModal(true)}
                  >
                    Ver detalles completos
                  </Button>
                </div>
              )}

              {/* Info adicional */}
              <div className="mt-3 pt-2 border-t border-blue-200 text-center text-xs text-gray-500">
                {tarifa.peso_vol && (
                  <div>
                    Peso volumétrico: {Number(tarifa.peso_vol).toFixed(2)} kg
                  </div>
                )}
                {tarifa.tiempo && <div>Tiempo estimado: {tarifa.tiempo}</div>}
                {tarifa.trayecto && <div>Trayecto: {tarifa.trayecto}</div>}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-gray-500 mb-2">
                {loadingTarifa ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Calculando tarifa...
                  </>
                ) : (
                  "Calculando costos..."
                )}
              </div>
              {!loadingTarifa && (
                <div className="space-y-2">
                  <Button
                    onClick={fetchTarifa}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Recalcular tarifa
                  </Button>
                  <div className="text-xs text-gray-500">
                    Los costos se calcularán automáticamente
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            ← Atrás
          </Button>
          <Button
            onClick={validarSaldoAntesConfirmar}
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={loadingTarifa || !tarifa}
          >
            Confirmar y continuar
          </Button>
        </div>
      </CardContent>

      {/* Modal detalle crudo (usa tu componente existente) */}
      <TarifaModal
        isOpen={showTarifaModal}
        onClose={() => setShowTarifaModal(false)}
        tarifa={tarifaCruda}
        onConfirm={() => setShowTarifaModal(false)}
        loading={false}
        saldoDisponible={saldo?.disponible}
        puntoAtencionNombre={String(punto_atencion_id ?? "")}
      />
    </Card>
  );
}
