import React, { useMemo, useEffect, useState } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
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
  requiereConfirmacion?: boolean;
}[] = [
  { value: "YAGANASTE", label: "YaGanaste", requiereConfirmacion: true },
  { value: "BANCO_GUAYAQUIL", label: "Banco Guayaquil", requiereConfirmacion: true },
  { value: "WESTERN", label: "Western Union", requiereConfirmacion: true },
  { value: "PRODUBANCO", label: "Produbanco", requiereConfirmacion: true },
  { value: "BANCO_PACIFICO", label: "Banco del Pacífico", requiereConfirmacion: true },
  { value: "SERVIENTREGA", label: "Servientrega", requiereConfirmacion: true },
  // Insumos (EGRESO)
  { value: "INSUMOS_OFICINA", label: "Insumos de oficina", isInsumo: true },
  { value: "INSUMOS_LIMPIEZA", label: "Insumos de limpieza", isInsumo: true },
  // OTROS ahora NO es Insumo (permite INGRESO/EGRESO)
  { value: "OTROS", label: "Otros" },
];

const MENSAJES_AYUDA: Record<ServicioExterno, { INGRESO: string; EGRESO: string }> = {
  WESTERN: {
    INGRESO: "El cliente ENVÍA dinero por Western Union (paga comisión). El dinero ENTRA al punto de cambio.",
    EGRESO: "El cliente RECIBE/RETIRA dinero de Western Union. El dinero SALE del punto de cambio.",
  },
  YAGANASTE: {
    INGRESO: "El cliente realiza un depósito o pago a través de YaGanaste. El dinero ENTRA al punto de cambio.",
    EGRESO: "El cliente realiza un retiro de YaGanaste. El dinero SALE del punto de cambio.",
  },
  BANCO_GUAYAQUIL: {
    INGRESO: "Transacción de ingreso vía Banco Guayaquil. El dinero ENTRA al punto de cambio.",
    EGRESO: "Transacción de egreso vía Banco Guayaquil. El dinero SALE del punto de cambio.",
  },
  PRODUBANCO: {
    INGRESO: "Transacción de ingreso vía Produbanco. El dinero ENTRA al punto de cambio.",
    EGRESO: "Transacción de egreso vía Produbanco. El dinero SALE del punto de cambio.",
  },
  BANCO_PACIFICO: {
    INGRESO: "Transacción de ingreso vía Banco del Pacífico. El dinero ENTRA al punto de cambio.",
    EGRESO: "Transacción de egreso vía Banco del Pacífico. El dinero SALE del punto de cambio.",
  },
  SERVIENTREGA: {
    INGRESO: "El cliente realiza un envío de dinero por Servientrega. El dinero ENTRA al punto de cambio.",
    EGRESO: "El cliente cobra/reclama un envío de dinero por Servientrega. El dinero SALE del punto de cambio.",
  },
  INSUMOS_OFICINA: {
    INGRESO: "Compra de insumos de oficina. El dinero SALE del punto de cambio.",
    EGRESO: "Compra de insumos de oficina. El dinero SALE del punto de cambio.",
  },
  INSUMOS_LIMPIEZA: {
    INGRESO: "Compra de insumos de limpieza. El dinigo SALE del punto de cambio.",
    EGRESO: "Compra de insumos de limpieza. El dinero SALE del punto de cambio.",
  },
  OTROS: {
    INGRESO: "Movimiento de entrada. El dinero ENTRA al punto de cambio.",
    EGRESO: "Movimiento de salida. El dinero SALE del punto de cambio.",
  },
};

const schema = z.object({
  servicio: z.enum(
    [
      "YAGANASTE",
      "BANCO_GUAYAQUIL",
      "WESTERN",
      "PRODUBANCO",
      "BANCO_PACIFICO",
      "SERVIENTREGA",
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
  saldoActual?: number;
}

export default function ServiciosExternosForm({
  onMovimientoCreado,
  saldoActual,
}: ServiciosExternosFormProps) {
  const { user } = useAuth();
  const puntoAtencionId = user?.punto_atencion_id || null;

  // Estado para el diálogo de confirmación
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formDataToSubmit, setFormDataToSubmit] = useState<FormValues | null>(null);

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
  const montoActual = watch("monto");

  const esInsumo = useMemo(
    () => !!SERVICIOS.find((s) => s.value === servicioActual && s.isInsumo),
    [servicioActual]
  );

  const requiereConfirmacion = useMemo(
    () => !!SERVICIOS.find((s) => s.value === servicioActual && s.requiereConfirmacion),
    [servicioActual]
  );

  const servicioInfo = useMemo(
    () => SERVICIOS.find((s) => s.value === servicioActual),
    [servicioActual]
  );

  // Si es Insumo, forzar EGRESO automáticamente y bloquear el Select de tipo
  useEffect(() => {
    if (esInsumo && tipoActual !== "EGRESO") {
      setValue("tipo_movimiento", "EGRESO", { shouldValidate: true });
    }
  }, [esInsumo, tipoActual, setValue]);

  // Auto-completar billetes cuando es EFECTIVO y cambia el monto (si no hay desglose manual)
  useEffect(() => {
    if (metodoIngresoActual === "EFECTIVO" && montoActual && montoActual > 0) {
      const billetesActual = watch("billetes") || 0;
      const monedasActual = watch("monedas_fisicas") || 0;
      
      // Solo auto-completar si no hay desglose manual ingresado
      if (billetesActual === 0 && monedasActual === 0) {
        setValue("billetes", montoActual, { shouldValidate: false });
      }
    }
  }, [metodoIngresoActual, montoActual, setValue, watch]);

  // Función para corregir/validar el desglose de efectivo
  const corregirDesgloseEfectivo = (values: FormValues): 
    | { success: true; billetes: number; monedas: number }
    | { success: false; error: string } => {
    let billetes = values.billetes ?? 0;
    let monedas = values.monedas_fisicas ?? 0;

    // Si es EFECTIVO, validar/corregir el desglose
    if (values.metodo_ingreso === "EFECTIVO") {
      // Si no viene desglose, asumir todo en billetes
      if (billetes === 0 && monedas === 0) {
        billetes = values.monto;
        monedas = 0;
      } else {
        // Validar que billetes + monedas = monto
        const sumaEfectivo = billetes + monedas;
        if (Math.abs(sumaEfectivo - values.monto) > 0.01) {
          return {
            success: false,
            error: `El desglose de efectivo (billetes: $${billetes.toFixed(2)} + monedas: $${monedas.toFixed(2)} = $${sumaEfectivo.toFixed(2)}) debe ser igual al monto ($${values.monto.toFixed(2)})`,
          };
        }
      }
    }

    // Si es BANCO, forzar billetes y monedas a 0
    if (values.metodo_ingreso === "BANCO") {
      billetes = 0;
      monedas = 0;
    }

    return { success: true, billetes, monedas };
  };

  // Función para validar antes de enviar
  const onSubmitPreValidation = (values: FormValues) => {
    if (!puntoAtencionId) {
      toast({
        title: "Punto no asignado",
        description: "Inicia jornada para tener un punto de atención asignado.",
        variant: "destructive",
      });
      return;
    }

    // Validar/corregir desglose antes de guardar en el diálogo
    const resultado = corregirDesgloseEfectivo(values);
    if (!resultado.success) {
      toast({
        title: "Error de validación",
        description: resultado.error,
        variant: "destructive",
      });
      return;
    }

    // Crear valores corregidos para el diálogo/envío
    const valoresCorregidos = {
      ...values,
      billetes: resultado.billetes,
      monedas_fisicas: resultado.monedas,
    };

    // Si requiere confirmación, mostrar el diálogo con valores corregidos
    if (requiereConfirmacion) {
      setFormDataToSubmit(valoresCorregidos);
      setShowConfirmDialog(true);
      return;
    }

    // Si no requiere confirmación, enviar directamente
    onSubmit(valoresCorregidos);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      // Calcular billetes y monedas según el método de ingreso
      const resultado = corregirDesgloseEfectivo(values);
      if (!resultado.success) {
        toast({
          title: "Error de validación",
          description: resultado.error,
          variant: "destructive",
        });
        return;
      }

      const { billetes, monedas } = resultado;

      const payload = {
        punto_atencion_id: puntoAtencionId!,
        servicio: values.servicio,
        tipo_movimiento: values.tipo_movimiento,
        metodo_ingreso: values.metodo_ingreso,
        monto: values.monto,
        billetes: billetes > 0 ? billetes : undefined,
        monedas_fisicas: monedas > 0 ? monedas : undefined,
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

      // Cerrar diálogo si estaba abierto
      setShowConfirmDialog(false);
      setFormDataToSubmit(null);
    } catch (e: unknown) {
      toast({
        title: "Error",
        description:
          e instanceof Error ? e.message : "Error al registrar movimiento",
        variant: "destructive",
      });
    }
  };

  const handleConfirm = () => {
    if (formDataToSubmit) {
      onSubmit(formDataToSubmit);
    }
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
    setFormDataToSubmit(null);
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

  // Obtener mensaje de ayuda según servicio y tipo seleccionados
  const mensajeAyuda = useMemo(() => {
    if (!servicioActual || !tipoActual) return null;
    return MENSAJES_AYUDA[servicioActual]?.[tipoActual] || null;
  }, [servicioActual, tipoActual]);

  // Calcular si hay saldo suficiente para egreso
  const tieneSaldoSuficiente = useMemo(() => {
    if (tipoActual !== "EGRESO" || !saldoActual || !montoActual) return true;
    return saldoActual >= montoActual;
  }, [tipoActual, saldoActual, montoActual]);

  return (
    <>
      <form onSubmit={handleSubmit(onSubmitPreValidation)} className="space-y-4" noValidate>
        {/* Servicio / Categoría */}
        <div>
          <div className="flex items-center gap-2">
            <Label>Servicio / Categoría</Label>
            {esInsumo && (
              <Badge variant="secondary" className="text-xs">
                Insumo • EGRESO forzado
              </Badge>
            )}
            {requiereConfirmacion && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                Requiere confirmación
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
          <Label>Tipo de Movimiento</Label>
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
                    INGRESO (Entra dinero al punto)
                  </SelectItem>
                  <SelectItem value="EGRESO">
                    EGRESO (Sale dinero del punto)
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
          {errors.tipo_movimiento && (
            <p className="text-sm text-red-500 mt-1">
              {errors.tipo_movimiento.message}
            </p>
          )}
        </div>

        {/* Alert contextual con mensaje de ayuda */}
        {mensajeAyuda && (
          <Alert className={tipoActual === "EGRESO" ? "border-amber-500 bg-amber-50" : "border-blue-500 bg-blue-50"}>
            <Info className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">
              {tipoActual === "INGRESO" ? "📥 Movimiento de Entrada" : "📤 Movimiento de Salida"}
            </AlertTitle>
            <AlertDescription className="text-sm mt-1">
              {mensajeAyuda}
            </AlertDescription>
          </Alert>
        )}

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

      {/* Diálogo de Confirmación */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Movimiento
            </DialogTitle>
            <DialogDescription>
              Por favor verifica que la información sea correcta antes de continuar.
            </DialogDescription>
          </DialogHeader>

          {formDataToSubmit && servicioActual && (
            <div className="space-y-4 py-4">
              {/* Resumen del movimiento */}
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Servicio:</span>
                  <span className="font-medium">{servicioInfo?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tipo:</span>
                  <Badge variant={formDataToSubmit.tipo_movimiento === "INGRESO" ? "default" : "destructive"}>
                    {formDataToSubmit.tipo_movimiento === "INGRESO" ? "INGRESO" : "EGRESO"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Monto:</span>
                  <span className="font-bold text-lg">
                    ${formDataToSubmit.monto.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Desglose de efectivo (si aplica) */}
              {(formDataToSubmit.metodo_ingreso === "EFECTIVO" || formDataToSubmit.metodo_ingreso === "MIXTO") && (
                <Alert className="border-blue-500 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-sm font-semibold">
                    Desglose de Efectivo
                  </AlertTitle>
                  <AlertDescription className="text-sm mt-1">
                    <div className="flex justify-between mb-1">
                      <span>Billetes:</span>
                      <span className="font-medium">${(formDataToSubmit.billetes || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Monedas:</span>
                      <span className="font-medium">${(formDataToSubmit.monedas_fisicas || 0).toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 mt-1 flex justify-between">
                      <span>Total efectivo:</span>
                      <span className="font-bold">
                        ${((formDataToSubmit.billetes || 0) + (formDataToSubmit.monedas_fisicas || 0)).toFixed(2)}
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Explicación de qué va a pasar */}
              <Alert className={formDataToSubmit.tipo_movimiento === "EGRESO" ? "border-amber-500 bg-amber-50" : "border-green-500 bg-green-50"}>
                {formDataToSubmit.tipo_movimiento === "INGRESO" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <AlertTitle className="text-sm font-semibold">
                  {formDataToSubmit.tipo_movimiento === "INGRESO" 
                    ? "El dinero ENTRARÁ al punto de cambio" 
                    : "El dinero SALDRÁ del punto de cambio"}
                </AlertTitle>
                <AlertDescription className="text-sm mt-1">
                  {MENSAJES_AYUDA[servicioActual]?.[formDataToSubmit.tipo_movimiento]}
                </AlertDescription>
              </Alert>

              {/* Validación de saldo para EGRESO */}
              {formDataToSubmit.tipo_movimiento === "EGRESO" && saldoActual !== undefined && (
                <Alert variant={tieneSaldoSuficiente ? "default" : "destructive"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm font-semibold">
                    Validación de Saldo
                  </AlertTitle>
                  <AlertDescription className="text-sm mt-1">
                    <div className="flex justify-between mb-1">
                      <span>Saldo disponible:</span>
                      <span className={tieneSaldoSuficiente ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        ${saldoActual.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Monto a descontar:</span>
                      <span className="font-medium">${formDataToSubmit.monto.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 mt-1 flex justify-between">
                      <span>Saldo después:</span>
                      <span className={tieneSaldoSuficiente ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        ${(saldoActual - formDataToSubmit.monto).toFixed(2)}
                      </span>
                    </div>
                    {!tieneSaldoSuficiente && (
                      <p className="text-red-600 font-medium mt-2">
                        ⚠️ Saldo insuficiente para realizar este egreso
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={isSubmitting || (formDataToSubmit?.tipo_movimiento === "EGRESO" && !tieneSaldoSuficiente)}
            >
              {isSubmitting ? "Guardando..." : "Confirmar y Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
