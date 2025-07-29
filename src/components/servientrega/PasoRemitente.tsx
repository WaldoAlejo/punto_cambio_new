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
  selectedPoint: PuntoAtencion; // Punto de atención con sesión iniciada
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
  pais: string;
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
    codpais: 63,
    pais: "Ecuador",
    pais_iso: "EC",
    phone_code: "593",
  });

  const [loading, setLoading] = useState(false);
  const [validatingCity, setValidatingCity] = useState(false); // ✅ Estado para mostrar loader de validación
  const [ciudadValida, setCiudadValida] = useState(false); // ✅ Estado para habilitar botón

  // ✅ Validar ciudad desde backend al cargar el componente
  useEffect(() => {
    if (selectedPoint?.id) {
      setValidatingCity(true); // 🔄 Mostrar loader de validación
      axios
        .get(`/api/servientrega/validar-ciudad/${selectedPoint.id}`)
        .then((res) => {
          if (res.data.valido) {
            const [ciudad, provincia] = res.data.ciudad.split("-");
            setFormData((prev) => ({
              ...prev,
              ciudad: ciudad,
              provincia: provincia,
              codpais: 63,
              pais: "Ecuador",
              pais_iso: "EC",
              phone_code: "593",
            }));
            setCiudadValida(true);
          } else {
            setCiudadValida(false);
            toast.error(
              res.data.mensaje || "La ciudad no es válida en Servientrega"
            );
          }
        })
        .catch(() => {
          setCiudadValida(false);
          toast.error("Error al validar la ciudad del punto de atención");
        })
        .finally(() => {
          setValidatingCity(false); // 🔄 Ocultar loader de validación
        });
    }
  }, [selectedPoint]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleContinue = () => {
    const { identificacion, nombre, direccion, telefono, email, ciudad } =
      formData;

    if (
      !identificacion ||
      !nombre ||
      !direccion ||
      !telefono ||
      !email ||
      !ciudad
    ) {
      toast.error("Por favor completa todos los campos obligatorios.");
      return;
    }

    if (!ciudadValida) {
      toast.error(
        "No puedes continuar: La ciudad no ha sido validada correctamente."
      );
      return;
    }

    setLoading(true);
    onNext(formData);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Información del Remitente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {validatingCity && (
          <div className="flex items-center justify-center text-sm text-gray-600 mb-2">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Validando ciudad del punto de atención...
          </div>
        )}

        <Input
          name="identificacion"
          placeholder="Cédula o Pasaporte"
          value={formData.identificacion}
          onChange={handleChange}
        />
        <Input
          name="nombre"
          placeholder="Nombre completo"
          value={formData.nombre}
          onChange={handleChange}
        />
        <Input
          name="direccion"
          placeholder="Dirección"
          value={formData.direccion}
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

        {/* País fijo */}
        <Input
          name="pais"
          value={`${formData.pais} (+${formData.phone_code})`}
          readOnly
        />

        {/* Ciudad y provincia desde validación backend */}
        <Input
          name="ciudad"
          value={`${formData.ciudad} - ${formData.provincia}`}
          readOnly
        />

        <Button
          disabled={loading || !ciudadValida || validatingCity} // ✅ Bloqueado si ciudad inválida o en validación
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
