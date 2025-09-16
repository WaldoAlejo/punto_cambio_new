import React, { useMemo, useEffect } from "react";
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
import { useAuth } from "@/hooks/useAuth";
import {
  crearMovimientoServicioExterno,
  ServicioExterno,
  TipoMovimiento,
} from "@/services/externalServicesService";
import { toast } from "@/hooks/use-toast";

const SERVICIOS: {
  value: ServicioExterno;
  label: string;
  isInsumo?: boolean;
}[] = [
  { value: "YAGANASTE", label: "YaGanaste" },
  { value: "BANCO_GUAYAQUIL", label: "Banco Guayaquil" },
  { value: "WESTERN", label: "Western Union" },
  { value: "PRODUBANCO", label: "Produbanco" },
  { value: "BANCO_PACIFICO", label: "Banco del Pacífico" },
  // Insumos (EGRESO)
  { value: "INSUMOS_OFICINA", label: "Insumos de oficina", isInsumo: true },
  { value: "INSUMOS_LIMPIEZA", label: "Insumos de limpieza", isInsumo: true },
  // OTROS ahora NO es Insumo (permite INGRESO/EGRESO)
  { value: "OTROS", label: "Otros" },
];

const schema = z.object({
  servicio: z.enum([
    "YAGANASTE",
    "BANCO_GUAYAQUIL",
    "WESTERN",
    "PRODUBANCO",
    "BANCO_PACIFICO",
    "INSUMOS_OFICINA",
    "INSUMOS_LIMPIEZA",
    "OTROS",
  ]),
  tipo_movimiento: z.enum(["INGRESO", "EGRESO"]),
  monto: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
    .refine((v) => isFinite(v) && v > 0, {
      message: "Debe ser un número mayor a 0",
    }),
  numero_referencia: z.string().optional(),
  descripcion: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ServiciosExternosForm() {
  const { user } = useAuth();

  // ✅ usar solo el nombre correcto del backend
  const puntoAtencionId = user?.punto_atencion_id || null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo_movimiento: "INGRESO" as TipoMovimiento },
  });

  const servicioActual = watch("servicio");
  const esInsumo = useMemo(
    () => !!SERVICIOS.find((s) => s.value === servicioActual && s.isInsumo),
    [servicioActual]
  );

  // Si es Insumo, forzar EGRESO automáticamente
  useEffect(() => {
    if (esInsumo)
      setValue("tipo_movimiento", "EGRESO", { shouldValidate: true });
  }, [esInsumo, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!puntoAtencionId) {
      toast({
        title: "Punto no asignado",
        description: "Inicia jornada para tener un punto de atención asignado.",
        variant: "destructive",
      });
      return;
    }
    try {
      const payload = {
        punto_atencion_id: puntoAtencionId, // el backend siempre valida el punto del operador
        servicio: values.servicio,
        tipo_movimiento: values.tipo_movimiento,
        monto: values.monto,
        descripcion: values.descripcion || undefined,
        numero_referencia: values.numero_referencia || undefined,
      };

      const resp = await crearMovimientoServicioExterno(payload);
      if (!resp?.success) {
        throw new Error(resp?.message || "No se pudo registrar el movimiento");
      }

      toast({
        title: "Movimiento registrado",
        description: "Se guardó el movimiento correctamente.",
      });
      reset({ tipo_movimiento: esInsumo ? "EGRESO" : "INGRESO" } as any);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Error al registrar movimiento",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Servicio / Categoría</Label>
        <Select
          onValueChange={(v) =>
            setValue("servicio", v as ServicioExterno, { shouldValidate: true })
          }
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecciona" />
          </SelectTrigger>
          <SelectContent>
            {SERVICIOS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.servicio && (
          <p className="text-sm text-red-500">{errors.servicio.message}</p>
        )}
      </div>

      <div>
        <Label>Tipo</Label>
        <Select
          onValueChange={(v) =>
            setValue("tipo_movimiento", v as TipoMovimiento, {
              shouldValidate: true,
            })
          }
          defaultValue="INGRESO"
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecciona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INGRESO">Ingreso</SelectItem>
            <SelectItem value="EGRESO">Egreso</SelectItem>
          </SelectContent>
        </Select>
        {esInsumo && (
          <p className="text-xs text-muted-foreground mt-1">
            Para categorías de Insumos el movimiento se registra como EGRESO.
          </p>
        )}
        {errors.tipo_movimiento && (
          <p className="text-sm text-red-500">
            {errors.tipo_movimiento.message}
          </p>
        )}
      </div>

      <div>
        <Label>Monto (USD)</Label>
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register("monto")}
        />
        {errors.monto && (
          <p className="text-sm text-red-500">{errors.monto.message}</p>
        )}
      </div>

      <div>
        <Label>N° referencia (opcional)</Label>
        <Input
          placeholder="Referencia / Comprobante"
          {...register("numero_referencia")}
        />
      </div>

      <div className="md:max-w-[720px]">
        <Label>Descripción (opcional)</Label>
        <Textarea
          placeholder="Detalle del movimiento"
          rows={3}
          {...register("descripcion")}
        />
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar movimiento"}
        </Button>
      </div>
    </form>
  );
}
