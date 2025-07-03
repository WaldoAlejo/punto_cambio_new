import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input as _Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Save, X } from "lucide-react";
import { User, PuntoAtencion, SalidaEspontanea } from "../../types";
import {
  spontaneousExitService,
  SpontaneousExit,
} from "../../services/spontaneousExitService";
import { useToast } from "@/hooks/use-toast";

interface SpontaneousExitFormProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onExitRegistered: (exit: SalidaEspontanea) => void; // <-- Tipo correcto
  onCancel: () => void;
}

const motivoOptions = [
  { value: "BANCO", label: "Banco" },
  { value: "DILIGENCIA_PERSONAL", label: "Diligencia Personal" },
  { value: "TRAMITE_GOBIERNO", label: "Trámite de Gobierno" },
  { value: "EMERGENCIA_MEDICA", label: "Emergencia Médica" },
  { value: "OTRO", label: "Otro" },
];

// Adaptador para convertir SpontaneousExit (del backend) a SalidaEspontanea (esperado en frontend)
function adaptExitToSalidaEspontanea(
  exit: SpontaneousExit,
  userFallback: User,
  selectedPoint?: PuntoAtencion | null
): SalidaEspontanea {
  return {
    ...exit,
    usuario: {
      id: exit.usuario.id,
      nombre: exit.usuario.nombre,
      username: exit.usuario.username,
      rol: userFallback.rol,
      activo: userFallback.activo,
      created_at: userFallback.created_at,
      updated_at: userFallback.updated_at,
      correo: userFallback.correo,
      telefono: userFallback.telefono,
      punto_atencion_id: userFallback.punto_atencion_id,
    },
    puntoAtencion:
      selectedPoint &&
      exit.puntoAtencion &&
      selectedPoint.id === exit.puntoAtencion.id
        ? selectedPoint
        : {
            id: exit.puntoAtencion.id,
            nombre: exit.puntoAtencion.nombre,
            direccion: "",
            ciudad: "",
            provincia: "",
            codigo_postal: "",
            telefono: "",
            activo: true,
            created_at: "",
            updated_at: "",
          },
    // Puedes adaptar usuarioAprobador si lo necesitas, igual a usuario
    usuarioAprobador: exit.usuarioAprobador
      ? {
          id: exit.usuarioAprobador.id,
          nombre: exit.usuarioAprobador.nombre,
          username: exit.usuarioAprobador.username,
          rol: "ADMIN",
          activo: true,
          created_at: "",
          updated_at: "",
          correo: "",
          telefono: "",
          punto_atencion_id: "",
        }
      : undefined,
  };
}

const SpontaneousExitForm = ({
  user,
  selectedPoint,
  onExitRegistered,
  onCancel,
}: SpontaneousExitFormProps) => {
  const [motivo, setMotivo] = useState<
    | ""
    | "BANCO"
    | "DILIGENCIA_PERSONAL"
    | "TRAMITE_GOBIERNO"
    | "EMERGENCIA_MEDICA"
    | "OTRO"
  >("");
  const [descripcion, setDescripcion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!motivo) {
      toast({
        title: "Error",
        description: "Por favor seleccione el motivo",
        variant: "destructive",
      });
      return;
    }
    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "No hay punto de atención seleccionado",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const exitData = {
        motivo,
        descripcion: descripcion || undefined,
      };

      const { exit, error } = await spontaneousExitService.createExit(exitData);

      if (error || !exit) {
        throw new Error(error || "Error desconocido al registrar salida");
      }

      toast({
        title: "Salida registrada",
        description: `Salida espontánea registrada exitosamente`,
      });

      setMotivo("");
      setDescripcion("");
      // Aquí adaptamos la salida antes de entregarla al padre
      onExitRegistered(adaptExitToSalidaEspontanea(exit, user, selectedPoint));
    } catch (error) {
      console.error("Error registering spontaneous exit:", error);
      toast({
        title: "Error",
        description: "Error al registrar la salida espontánea",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Registrar Salida Espontánea
        </CardTitle>
        <CardDescription>
          Registre una salida espontánea indicando el motivo y una breve
          descripción
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Select
              value={motivo}
              onValueChange={(v) => setMotivo(v as typeof motivo)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione el motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (Opcional)</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción adicional del motivo de la salida..."
              rows={3}
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? "Registrando..." : "Registrar Salida"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default SpontaneousExitForm;
