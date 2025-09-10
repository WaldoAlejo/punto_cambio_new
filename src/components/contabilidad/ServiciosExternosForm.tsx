import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  crearMovimientoServicioExterno,
  ServicioExterno,
  TipoMovimiento,
} from "@/services/externalServicesService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  servicio: z.enum([
    "YAGANASTE",
    "BANCO_GUAYAQUIL",
    "WESTERN",
    "PRODUBANCO",
    "BANCO_PACIFICO",
  ]),
  tipo_movimiento: z.enum(["INGRESO", "EGRESO"]),
  monto: z
    .string()
    .refine(
      (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
      "Monto inválido"
    ),
  numero_referencia: z.string().optional(),
  comprobante_url: z.string().url().optional().or(z.literal("")),
  descripcion: z.string().min(3, "Ingrese una novedad/observación"),
});

type FormValues = z.infer<typeof schema>;

export default function ServiciosExternosForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const puntoAtencionId = user?.punto_atencion_id ?? "";

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo_movimiento: "INGRESO" as TipoMovimiento },
  });

  const onSubmit = async (values: FormValues) => {
    if (!puntoAtencionId) {
      toast({
        title: "Punto no asignado",
        description: "Asigne un punto de atención antes de operar",
        variant: "destructive",
      });
      return;
    }
    try {
      await crearMovimientoServicioExterno({
        punto_atencion_id: puntoAtencionId,
        servicio: values.servicio as ServicioExterno,
        tipo_movimiento: values.tipo_movimiento as TipoMovimiento,
        monto: parseFloat(values.monto),
        descripcion: values.descripcion,
        numero_referencia: values.numero_referencia,
        comprobante_url: values.comprobante_url || undefined,
      });
      toast({
        title: "Movimiento registrado",
        description: "Se actualizó el saldo y contabilidad",
      });
      reset({
        monto: "",
        numero_referencia: "",
        comprobante_url: "",
        descripcion: "",
        tipo_movimiento: "INGRESO",
      });
    } catch (e: any) {
      toast({
        title: "Error",
        description:
          e?.response?.data?.message || e.message || "No se pudo registrar",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Servicio</Label>
          <Select onValueChange={(v) => control.setValue("servicio", v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione servicio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="YAGANASTE">YaGanaste</SelectItem>
              <SelectItem value="BANCO_GUAYAQUIL">Banco Guayaquil</SelectItem>
              <SelectItem value="WESTERN">Western</SelectItem>
              <SelectItem value="PRODUBANCO">Produbanco</SelectItem>
              <SelectItem value="BANCO_PACIFICO">Banco del Pacífico</SelectItem>
            </SelectContent>
          </Select>
          {errors.servicio && (
            <p className="text-sm text-red-500">{errors.servicio.message}</p>
          )}
        </div>
        <div>
          <Label>Tipo</Label>
          <Select
            onValueChange={(v) => control.setValue("tipo_movimiento", v as any)}
            defaultValue="INGRESO"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INGRESO">Ingreso</SelectItem>
              <SelectItem value="EGRESO">Egreso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Monto (USD)</Label>
          <Input placeholder="0.00" {...register("monto")} />
          {errors.monto && (
            <p className="text-sm text-red-500">{errors.monto.message}</p>
          )}
        </div>
        <div>
          <Label>Nº Referencia</Label>
          <Input placeholder="Opcional" {...register("numero_referencia")} />
        </div>
        <div className="md:col-span-2">
          <Label>Comprobante URL</Label>
          <Input
            placeholder="https://... (opcional)"
            {...register("comprobante_url")}
          />
          {errors.comprobante_url && (
            <p className="text-sm text-red-500">
              {errors.comprobante_url.message}
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          <Label>Novedad / Observación</Label>
          <Textarea
            placeholder="¿Qué se hizo y por qué?"
            {...register("descripcion")}
          />
          {errors.descripcion && (
            <p className="text-sm text-red-500">{errors.descripcion.message}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          Guardar movimiento
        </Button>
      </div>
    </form>
  );
}
