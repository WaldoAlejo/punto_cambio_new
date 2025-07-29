"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Usuario, PuntoAtencion } from "../../types";

interface PasoRemitenteProps {
  user: Usuario;
  selectedPoint: PuntoAtencion;
  onNext: (remitente: RemitenteFormData) => void;
}

interface RemitenteFormData {
  identificacion: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  ciudad: string;
  provincia: string;
  codpais: number;
  pais_iso: string;
  phone_code: string;
}

export default function PasoRemitente({
  user,
  selectedPoint,
  onNext,
}: PasoRemitenteProps) {
  const [formData, setFormData] = useState<RemitenteFormData>({
    identificacion: "",
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    ciudad: "",
    provincia: "",
    codpais: 63, // Ecuador implícito
    pais_iso: "EC",
    phone_code: "593",
  });

  const [extraDireccion, setExtraDireccion] = useState({
    callePrincipal: "",
    numeracion: "",
    calleSecundaria: "",
    referencia: "",
  });

  const [loading, setLoading] = useState(false);
  const [validatingCity, setValidatingCity] = useState(false);
  const [ciudadValida, setCiudadValida] = useState(false);

  const [cedulaQuery, setCedulaQuery] = useState("");
  const [cedulaResultados, setCedulaResultados] = useState<RemitenteFormData[]>(
    []
  );
  const [buscandoCedula, setBuscandoCedula] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  const [remitenteExistente, setRemitenteExistente] =
    useState<RemitenteFormData | null>(null);

  // ✅ Autocompletar ciudad/provincia según punto de atención
  useEffect(() => {
    if (selectedPoint?.ciudad && selectedPoint?.provincia) {
      setFormData((prev) => ({
        ...prev,
        ciudad: selectedPoint.ciudad,
        provincia: selectedPoint.provincia,
      }));
      setCiudadValida(true);
    }
  }, [selectedPoint]);

  // 🔍 Búsqueda predictiva de remitente
  useEffect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);

    if (cedulaQuery.length >= 3) {
      const timer = setTimeout(() => {
        setBuscandoCedula(true);
        axios
          .get(`/api/servientrega/remitente/buscar/${cedulaQuery}`)
          .then((res) => setCedulaResultados(res.data.remitentes || []))
          .catch(() => setCedulaResultados([]))
          .finally(() => setBuscandoCedula(false));
      }, 400);
      setDebounceTimer(timer);
    } else {
      setCedulaResultados([]);
    }
  }, [cedulaQuery]);

  const seleccionarRemitente = (rem: RemitenteFormData) => {
    setFormData((prev) => ({
      ...prev,
      identificacion: rem.identificacion,
      nombre: rem.nombre,
      telefono: rem.telefono,
      email: rem.email,
      direccion: rem.direccion,
    }));
    setRemitenteExistente(rem);
    setCedulaResultados([]);
  };

  // ✅ Validación de cédula, RUC y pasaporte
  const validarIdentificacion = (id: string): boolean => {
    if (!id) return false;
    if (/^\d{10}$/.test(id)) {
      const provincia = parseInt(id.substring(0, 2));
      if (provincia < 1 || provincia > 24) return false;
      const digitoVerificador = parseInt(id[9]);
      const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
      let suma = 0;
      for (let i = 0; i < 9; i++) {
        let valor = parseInt(id[i]) * coeficientes[i];
        if (valor >= 10) valor -= 9;
        suma += valor;
      }
      const digitoCalculado = (10 - (suma % 10)) % 10;
      return digitoCalculado === digitoVerificador;
    }
    if (/^\d{13}$/.test(id)) return validarIdentificacion(id.substring(0, 10));
    if (/^[A-Za-z0-9]{6,}$/.test(id)) return true;
    return false;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleExtraDireccionChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setExtraDireccion((prev) => ({ ...prev, [name]: value }));
  };

  const handleContinue = async () => {
    const { identificacion, nombre, telefono, email, ciudad } = formData;
    if (!identificacion || !nombre || !telefono || !email || !ciudad) {
      toast.error("Por favor completa todos los campos obligatorios.");
      return;
    }
    if (!validarIdentificacion(identificacion)) {
      toast.error(
        "Número de identificación inválido (Cédula, RUC o Pasaporte)."
      );
      return;
    }

    const direccionFinal = [
      extraDireccion.callePrincipal,
      `#${extraDireccion.numeracion}`,
      `y ${extraDireccion.calleSecundaria}`,
      `Ref: ${extraDireccion.referencia}`,
    ]
      .filter((item) => item && item.trim() !== "")
      .join(", ");

    const remitenteFinal = { ...formData, direccion: direccionFinal };

    try {
      if (remitenteExistente) {
        await axios.put(
          `/api/servientrega/remitente/actualizar/${formData.identificacion}`,
          remitenteFinal
        );
      } else {
        await axios.post("/api/servientrega/remitente/guardar", remitenteFinal);
      }
    } catch {
      toast.error("Hubo un problema al guardar el remitente.");
    }

    setLoading(true);
    onNext(remitenteFinal);
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
              handleChange(e);
              setCedulaQuery(e.target.value);
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
                  {r.identificacion} - {r.nombre}
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

        {/* Dirección */}
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

        {/* Ciudad y Provincia bloqueadas */}
        <Input
          name="ciudad"
          value={`${formData.ciudad} - ${formData.provincia}`}
          readOnly
        />

        <Button
          disabled={loading || !ciudadValida}
          onClick={handleContinue}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...
            </>
          ) : (
            "Continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
