import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { permissionService } from "@/services/permissionService";
import type { PermisoTipo } from "@/types";

const tipos: PermisoTipo[] = ["PERSONAL", "SALUD", "OFICIAL", "OTRO"];

export default function PermissionRequest() {
  const { user, selectedPoint } = useAuth();
  const [tipo, setTipo] = useState<PermisoTipo>("PERSONAL");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fileName, setFileName] = useState<string>("");
  const [fileUrl, setFileUrl] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fechaInicio || !fechaFin) {
      toast({
        title: "Error",
        description: "Seleccione fechas válidas",
        variant: "destructive",
      });
      return;
    }
    try {
      setSubmitting(true);
      const { success } = await permissionService.create({
        tipo,
        fecha_inicio: new Date(fechaInicio).toISOString(),
        fecha_fin: new Date(fechaFin).toISOString(),
        descripcion: descripcion || undefined,
        archivo_url: fileUrl || undefined,
        archivo_nombre: fileName || undefined,
        punto_atencion_id: selectedPoint?.id,
      });
      if (success) {
        toast({
          title: "Solicitud enviada",
          description: "Tu permiso quedó en estado pendiente",
        });
        setDescripcion("");
        setFileName("");
        setFileUrl("");
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitud de Permiso</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <select
                className="border rounded p-2 w-full"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as PermisoTipo)}
              >
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Fecha inicio</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div>
              <Label>Fecha fin</Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <Label>Archivo (URL en Cloud Storage)</Label>
              <Input
                placeholder="https://storage.googleapis.com/tu-bucket/permiso.pdf"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
            </div>
            <div>
              <Label>Nombre del archivo</Label>
              <Input
                placeholder="permiso.pdf"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
