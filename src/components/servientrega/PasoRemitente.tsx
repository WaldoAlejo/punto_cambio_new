"use client";

import React, { useEffect, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Usuario, PuntoAtencion } from "../../types";
import { Remitente } from "@/types/servientrega"; // Usa tu tipado global

interface PasoRemitenteProps {
  user: Usuario;
  selectedPoint: PuntoAtencion;
  onNext: (remitente: Remitente) => void;
}

export default function PasoRemitente({
  selectedPoint,
  onNext,
}: PasoRemitenteProps) {
  // Considera Ecuador como default para país, pero puedes escalarlo fácilmente
  const [formData, setFormData] = useState<Remitente>({
    identificacion: "",
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    ciudad: "",
    provincia: "",
    codigo_postal: "170150",
    pais: "ECUADOR",
  });

  const [extraDireccion, setExtraDireccion] = useState({
    callePrincipal: "",
    numeracion: "",
    calleSecundaria: "",
    referencia: "",
  });

  const [loading, setLoading] = useState(false);
  const [ciudadValida, setCiudadValida] = useState(false);
  const [cedulaQuery, setCedulaQuery] = useState("");
  const [cedulaResultados, setCedulaResultados] = useState<any[]>([]);
  const [buscandoCedula, setBuscandoCedula] = useState(false);
  const [remitenteExistente, setRemitenteExistente] =
    useState<Remitente | null>(null);

  // Autocompletar ciudad/provincia/país desde el punto seleccionado
  useEffect(() => {
    if (selectedPoint?.ciudad && selectedPoint?.provincia) {
      setFormData((prev) => ({
        ...prev,
        ciudad: selectedPoint.ciudad,
        provincia: selectedPoint.provincia,
        pais: "ECUADOR", // Default
      }));
      setCiudadValida(true);
    }
  }, [selectedPoint]);

  // Búsqueda predictiva de remitente
  useEffect(() => {
    const query = cedulaQuery.trim();
    if (query.length >= 3) {
      setBuscandoCedula(true);
      console.log("🔍 Buscando remitente con cédula:", query);
      axiosInstance
        .get(`/servientrega/remitente/buscar/${encodeURIComponent(query)}`)
        .then((res) => {
          console.log("✅ Resultados de búsqueda:", res.data);
          setCedulaResultados(res.data.remitentes || []);
        })
        .catch((err) => {
          console.error("❌ Error en búsqueda de remitente:", err);
          setCedulaResultados([]);
        })
        .finally(() => setBuscandoCedula(false));
    } else {
      setCedulaResultados([]);
    }
  }, [cedulaQuery]);

  const seleccionarRemitente = (rem: any) => {
    setFormData({
      identificacion: rem.cedula || rem.identificacion,
      nombre: rem.nombre,
      telefono: rem.telefono,
      email: rem.email || "",
      direccion: rem.direccion || "",
      ciudad: rem.ciudad || "",
      provincia: rem.provincia || "",
      codigo_postal: rem.codigo_postal || "170150",
      pais: rem.pais || "ECUADOR",
    });

    if (rem.direccion) {
      const partes = rem.direccion.split(",").map((p: string) => p.trim());
      setExtraDireccion({
        callePrincipal: partes[0]?.split("#")[0]?.trim() || "",
        numeracion: partes[0]?.includes("#")
          ? partes[0].split("#")[1]?.trim() || ""
          : "",
        calleSecundaria: partes[1]?.replace(/^y\s*/i, "").trim() || "",
        referencia: partes[2]?.replace(/^Ref:\s*/i, "").trim() || "",
      });
    }

    setRemitenteExistente(rem);
    setCedulaResultados([]);
  };

  const validarIdentificacion = (id: string): boolean => {
    const cleanId = id.trim();
    if (!cleanId) return false;
    if (/^\d{10}$/.test(cleanId)) {
      const provincia = parseInt(cleanId.substring(0, 2));
      if (provincia < 1 || provincia > 24) return false;
      const digitoVerificador = parseInt(cleanId[9]);
      const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
      let suma = 0;
      for (let i = 0; i < 9; i++) {
        let val = parseInt(cleanId[i]) * coef[i];
        if (val >= 10) val -= 9;
        suma += val;
      }
      return digitoVerificador === (10 - (suma % 10)) % 10;
    }
    if (/^\d{13}$/.test(cleanId))
      return validarIdentificacion(cleanId.substring(0, 10));
    return /^[A-Za-z0-9]{6,}$/.test(cleanId);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleExtraDireccionChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setExtraDireccion((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleContinue = async () => {
    const { identificacion, nombre, telefono, email, ciudad, pais } = formData;
    if (!identificacion || !nombre || !telefono || !email || !ciudad || !pais) {
      toast.error("Completa todos los campos obligatorios.");
      return;
    }
    if (!validarIdentificacion(identificacion)) {
      toast.error("Número de identificación inválido.");
      return;
    }

    const direccionFinal = [
      extraDireccion.callePrincipal.trim(),
      extraDireccion.numeracion && `#${extraDireccion.numeracion.trim()}`,
      extraDireccion.calleSecundaria &&
        `y ${extraDireccion.calleSecundaria.trim()}`,
      extraDireccion.referencia && `Ref: ${extraDireccion.referencia.trim()}`,
    ]
      .filter(Boolean)
      .join(", ");

    // Validar campos requeridos
    if (!formData.identificacion?.trim()) {
      toast.error("La identificación es requerida");
      return;
    }

    // Validar formato de cédula (básico)
    const cedula = formData.identificacion.trim();
    if (cedula.length < 10 || !/^\d+$/.test(cedula)) {
      toast.error("La identificación debe tener al menos 10 dígitos");
      return;
    }
    if (!formData.nombre?.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!formData.telefono?.trim()) {
      toast.error("El teléfono es requerido");
      return;
    }
    if (!direccionFinal.trim()) {
      toast.error("La dirección es requerida");
      return;
    }

    // Prepara objeto para el backend (usa identificacion y pais)
    const remitenteFinal: Remitente = {
      identificacion: formData.identificacion.trim(),
      nombre: formData.nombre.trim(),
      direccion: direccionFinal.trim(),
      telefono: formData.telefono.trim(),
      email: formData.email?.trim() || "",
      ciudad: formData.ciudad?.trim() || "",
      provincia: formData.provincia?.trim() || "",
      codigo_postal: formData.codigo_postal?.trim() || "170150",
      pais: formData.pais?.trim() || "ECUADOR",
    };
    const payload = {
      cedula: formData.identificacion.trim(),
      nombre: formData.nombre.trim(),
      direccion: direccionFinal.trim(),
      telefono: formData.telefono.trim(),
      ...(formData.email?.trim() && { email: formData.email.trim() }),
      ...(formData.ciudad?.trim() && { ciudad: formData.ciudad.trim() }),
      ...(formData.provincia?.trim() && {
        provincia: formData.provincia.trim(),
      }),
      ...(formData.codigo_postal?.trim() && {
        codigo_postal: formData.codigo_postal.trim(),
      }),
    };

    console.log("📤 Enviando datos del remitente:", payload);
    setLoading(true);

    try {
      if (remitenteExistente) {
        await axiosInstance.put(
          `/servientrega/remitente/actualizar/${formData.identificacion.trim()}`,
          payload
        );
      } else {
        await axiosInstance.post("/servientrega/remitente/guardar", payload);
      }
      toast.success("Remitente guardado correctamente.");
      onNext({ ...remitenteFinal, direccion: direccionFinal.trim() });
    } catch (err) {
      console.error("❌ Error al guardar remitente:", err);
      console.error("❌ Datos que se intentaron enviar:", payload);
      toast.error("Hubo un problema al guardar el remitente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Información del Remitente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Identificación */}
        <div className="relative">
          <Input
            name="identificacion"
            placeholder="Cédula, RUC o Pasaporte"
            value={formData.identificacion}
            onChange={(e) => {
              const value = e.target.value.trimStart();
              setFormData((prev) => ({ ...prev, identificacion: value }));
              setCedulaQuery(value);
            }}
          />
          {buscandoCedula && (
            <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-gray-400" />
          )}
          {cedulaResultados.length > 0 && (
            <div className="absolute bg-white border rounded-md shadow-md w-full max-h-40 overflow-y-auto z-10">
              {cedulaResultados.map((r, idx) => (
                <div
                  key={idx}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => seleccionarRemitente(r)}
                >
                  {(r.cedula || r.identificacion) + " - " + r.nombre}
                </div>
              ))}
            </div>
          )}
        </div>

        <Input
          name="nombre"
          placeholder="Nombre completo"
          value={formData.nombre}
          onChange={handleChange}
        />
        <Input
          name="telefono"
          placeholder="Teléfono"
          value={formData.telefono}
          onChange={handleChange}
        />
        <Input
          name="email"
          placeholder="Correo electrónico"
          value={formData.email}
          onChange={handleChange}
        />

        {/* Dirección desglosada */}
        <Input
          name="callePrincipal"
          placeholder="Calle principal"
          value={extraDireccion.callePrincipal}
          onChange={handleExtraDireccionChange}
        />
        <Input
          name="numeracion"
          placeholder="Numeración"
          value={extraDireccion.numeracion}
          onChange={handleExtraDireccionChange}
        />
        <Input
          name="calleSecundaria"
          placeholder="Calle secundaria"
          value={extraDireccion.calleSecundaria}
          onChange={handleExtraDireccionChange}
        />
        <Input
          name="referencia"
          placeholder="Referencia"
          value={extraDireccion.referencia}
          onChange={handleExtraDireccionChange}
        />

        {/* Ciudad y Provincia */}
        <Input
          name="ciudad"
          value={`${formData.ciudad} - ${formData.provincia}`}
          readOnly
        />

        {/* País (opcional en este flujo, pero preparado para el futuro) */}
        <Input name="pais" placeholder="País" value={formData.pais} readOnly />

        <Button
          disabled={loading || !ciudadValida}
          onClick={handleContinue}
          className="w-full"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            "Continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
