import React, { useMemo, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Badge } from "@/components/ui/badge";
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
  servicio: z.enum(
    [
      "YAGANASTE",
      "BANCO_GUAYAQUIL",
      "WESTERN",
      "PRODUBANCO",
      "BANCO_PACIFICO",
      "INSUMOS_OFICINA",
      "INSUMOS_LIMPIEZA",
      "OTROS",
    ],
    { required_error: "Selecciona un servicio o categoría" }
  ),
  tipo_movimiento: z.enum(["INGRESO", "EGRESO"], {
    required_error: "Selecciona el tipo de movimiento",
  }),
  monto: z.coerce
    .number({ invalid_type_error: "Debe ser un número" })
    .gt(0, { message: "Debe ser un número mayor a 0" }),
  metodo_ingreso: z.enum(["EFECTIVO", "BANCO", "MIXTO"], {
    required_error: "Selecciona cómo entra el dinero",
  }),
  billetes: z.coerce
    .number({ invalid_type_error: "Debe ser un número" })
    .nonnegative({ message: "Debe ser un número no negativo" })
    .optional(),
  monedas_fisicas: z.coerce
    .number({ invalid_type_error: "Debe ser un número" })
    .nonnegative({ message: "Debe ser un número no negativo" })
    .optional(),
  numero_referencia: z.string().trim().optional(),
  descripcion: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ServiciosExternosFormProps {
  onMovimientoCreado?: () => void;
}

export default function ServiciosExternosForm({
  onMovimientoCreado,
}: ServiciosExternosFormProps) {
  const { user } = useAuth();
  const puntoAtencionId = user?.punto_atencion_id || null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    watch,
    setValue,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      servicio: undefined,
      tipo_movimiento: "INGRESO",
      metodo_ingreso: "EFECTIVO",
      monto: undefined as unknown as number,
      billetes: undefined as unknown as number,
      monedas_fisicas: undefined as unknown as number,
      numero_referencia: "",
      descripcion: "",
    },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const servicioActual = watch("servicio");
  const tipoActual = watch("tipo_movimiento");
  const metodoIngresoActual = watch("metodo_ingreso");

  const esInsumo = useMemo(
    () => !!SERVICIOS.find((s) => s.value === servicioActual && s.isInsumo),
    [servicioActual]
  );

  // Si es Insumo, forzar EGRESO automáticamente y bloquear el Select de tipo
  useEffect(() => {
    if (esInsumo && tipoActual !== "EGRESO") {
      setValue("tipo_movimiento", "EGRESO", { shouldValidate: true });
    }
  }, [esInsumo, tipoActual, setValue]);

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
        punto_atencion_id: puntoAtencionId,
        servicio: values.servicio,
        tipo_movimiento: values.tipo_movimiento,
        metodo_ingreso: values.metodo_ingreso,
        monto: values.monto,
        billetes: values.billetes || undefined,
        monedas_fisicas: values.monedas_fisicas || undefined,
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

      // Llamar callback para actualizar saldos
      if (onMovimientoCreado) {
        onMovimientoCreado();
      }

      // Reset limpio: tipo por defecto según si es insumo
      reset({
        servicio: undefined,
        tipo_movimiento: esInsumo ? "EGRESO" : "INGRESO",
        metodo_ingreso: "EFECTIVO",
        monto: undefined as unknown as number,
        billetes: undefined as unknown as number,
        monedas_fisicas: undefined as unknown as number,
        numero_referencia: "",
        descripcion: "",
      });
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Error al registrar movimiento",
        variant: "destructive",
      });
    }
  };

  // Formatear monto a 2 decimales al salir del input (sin romper el valor numérico)
  const onMontoBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
    const raw = e.target.value?.replace(",", ".") ?? "";
    const num = parseFloat(raw);
    if (!isNaN(num) && isFinite(num) && num > 0) {
      const fixed = Number(num.toFixed(2));
      // Actualiza el valor RHF y también el input visible
      setValue("monto", fixed, { shouldValidate: true, shouldDirty: true });
      e.target.value = fixed.toFixed(2);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Servicio / Categoría */}
      <div>
        <div className="flex items-center gap-2">
          <Label>Servicio / Categoría</Label>
          {esInsumo && (
            <Badge variant="secondary" className="text-xs">
              Insumo • EGRESO forzado
            </Badge>
          )}
        </div>
        <Controller
          name="servicio"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => field.onChange(v as ServicioExterno)}
            >
              <SelectTrigger className="mt-1" aria-invalid={!!errors.servicio}>
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
          )}
        />
        {errors.servicio && (
          <p className="text-sm text-red-500 mt-1">{errors.servicio.message}</p>
        )}
      </div>

      {/* Tipo */}
      <div>
        <Label>Tipo</Label>
        <Controller
          name="tipo_movimiento"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => field.onChange(v as TipoMovimiento)}
              disabled={esInsumo}
            >
              <SelectTrigger
                className="mt-1"
                aria-invalid={!!errors.tipo_movimiento}
              >
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INGRESO">
                  Ingreso (Cliente paga servicio)
                </SelectItem>
                <SelectItem value="EGRESO">
                  Egreso (Punto paga/repone servicio)
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {esInsumo && (
          <p className="text-xs text-muted-foreground mt-1">
            Esta categoría es de Insumos, el movimiento se registra como{" "}
            <b>EGRESO</b>.
          </p>
        )}
        {!esInsumo && tipoMovimiento && (
          <p className="text-xs text-muted-foreground mt-1">
            {tipoMovimiento === "INGRESO" ? (
              <>📥 <b>INGRESO</b>: Cliente paga el servicio. Reduce saldo asignado, aumenta efectivo.</>
            ) : (
              <>📤 <b>EGRESO</b>: El punto paga o repone el servicio. Aumenta saldo asignado, reduce efectivo.</>
            )}
          </p>
        )}
        {errors.tipo_movimiento && (
          <p className="text-sm text-red-500 mt-1">
            {errors.tipo_movimiento.message}
          </p>
        )}
      </div>

      {/* Monto */}
      <div>
        <Label>Monto (USD)</Label>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal"
          placeholder="0.00"
          aria-invalid={!!errors.monto}
          {...register("monto")}
          onBlur={onMontoBlur}
        />
        {errors.monto && (
          <p className="text-sm text-red-500 mt-1">{errors.monto.message}</p>
        )}
      </div>

      {/* Método de Ingreso */}
      <div>
        <Label>¿Cómo entra el dinero?</Label>
        <Controller
          name="metodo_ingreso"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => field.onChange(v)}
            >
              <SelectTrigger className="mt-1" aria-invalid={!!errors.metodo_ingreso}>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EFECTIVO">Efectivo (Billetes y Monedas)</SelectItem>
                <SelectItem value="BANCO">Depósito Bancario</SelectItem>
                <SelectItem value="MIXTO">Mixto (Efectivo + Banco)</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.metodo_ingreso && (
          <p className="text-sm text-red-500 mt-1">{errors.metodo_ingreso.message}</p>
        )}
      </div>

      {/* Billetes (mostrar si es EFECTIVO o MIXTO) */}
      {(metodoIngresoActual === "EFECTIVO" || metodoIngresoActual === "MIXTO") && (
        <div>
          <Label>Billetes (USD)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={!!errors.billetes}
            {...register("billetes")}
          />
          {errors.billetes && (
            <p className="text-sm text-red-500 mt-1">{errors.billetes.message}</p>
          )}
        </div>
      )}

      {/* Monedas Físicas (mostrar si es EFECTIVO o MIXTO) */}
      {(metodoIngresoActual === "EFECTIVO" || metodoIngresoActual === "MIXTO") && (
        <div>
          <Label>Monedas (USD)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={!!errors.monedas_fisicas}
            {...register("monedas_fisicas")}
          />
          {errors.monedas_fisicas && (
            <p className="text-sm text-red-500 mt-1">{errors.monedas_fisicas.message}</p>
          )}
        </div>
      )}

      {/* Referencia */}
      <div>
        <Label>N° referencia (opcional)</Label>
        <Input
          placeholder="Referencia / Comprobante"
          {...register("numero_referencia")}
        />
      </div>

      {/* Descripción */}
      <div className="md:max-w-[720px]">
        <Label>Descripción (opcional)</Label>
        <Textarea
          placeholder="Detalle del movimiento"
          rows={3}
          {...register("descripcion")}
        />
      </div>

      {/* Submit */}
      <div className="pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar movimiento"}
        </Button>
      </div>
    </form>
  );
}
