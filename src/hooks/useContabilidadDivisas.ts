import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CambioDivisa, User, PuntoAtencion, MovimientoSaldo } from "../types";
import { movimientosContablesService } from "../services/movimientosContablesService";
import { SaldoActualizado } from "../types";

interface SaldoMoneda {
  moneda_id: string;
  moneda_codigo: string;
  saldo: number;
  billetes?: number;
  monedas_fisicas?: number;
}

interface UseContabilidadDivisasProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

export const useContabilidadDivisas = ({
  user,
  selectedPoint,
}: UseContabilidadDivisasProps) => {
  const [saldos, setSaldos] = useState<SaldoMoneda[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoSaldo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar saldos actuales del punto
  const cargarSaldos = useCallback(async () => {
    if (!selectedPoint) return;

    setIsLoading(true);
    setError(null);

    try {
      const { saldos: saldosData, error: saldosError } =
        await movimientosContablesService.getSaldosActualesPorPunto(
          selectedPoint.id
        );

      if (saldosError) {
        setError(saldosError);
        toast.error(`Error al cargar saldos: ${saldosError}`);
        return;
      }

      if (saldosData) {
        setSaldos(saldosData);
      }
    } catch {
      const errorMessage = "Error inesperado al cargar saldos";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPoint]);

  // Cargar historial de movimientos
  const cargarMovimientos = useCallback(
    async (
      moneda_id?: string,
      limit = 50,
      opts?: { date?: string; from?: string; to?: string }
    ) => {
      if (!selectedPoint) return;

      try {
        const { movimientos: movimientosData, error: movimientosError } =
          await movimientosContablesService.getHistorialMovimientos(
            selectedPoint.id,
            moneda_id,
            limit,
            opts
          );

        if (movimientosError) {
          toast.error(`Error al cargar movimientos: ${movimientosError}`);
          return;
        }

        if (movimientosData) {
          setMovimientos(movimientosData);
        }
      } catch {
        toast.error("Error inesperado al cargar movimientos");
      }
    },
    [selectedPoint]
  );

  // Validar saldo antes de realizar un cambio
  const validarSaldoParaCambio = useCallback(
    async (
      moneda_destino_id: string,
      monto_destino: number
    ): Promise<{ valido: boolean; saldo_actual: number; mensaje?: string }> => {
      if (!selectedPoint) {
        return {
          valido: false,
          saldo_actual: 0,
          mensaje: "No hay punto seleccionado",
        };
      }

      try {
        const { valido, saldo_actual, error } =
          await movimientosContablesService.validarSaldoParaCambio(
            selectedPoint.id,
            moneda_destino_id,
            monto_destino
          );

        return { valido, saldo_actual, mensaje: error || undefined };
      } catch {
        return {
          valido: false,
          saldo_actual: 0,
          mensaje: "Error al validar saldo",
        };
      }
    },
    [selectedPoint]
  );

  // Procesar movimientos contables después de un cambio
  const procesarMovimientosCambio = useCallback(
    async (
      cambio: CambioDivisa
    ): Promise<{
      success: boolean;
      saldos_actualizados?: SaldoActualizado[];
    }> => {
      if (!user || !selectedPoint) {
        toast.error("Usuario o punto no válido");
        return { success: false };
      }

      try {
        const { result, error } =
          await movimientosContablesService.procesarMovimientosCambio(
            cambio,
            user.id
          );

        if (error) {
          toast.error(`Error en contabilidad: ${error}`);
          return { success: false };
        }

        if (result && result.success) {
          // Actualizar saldos locales
          await cargarSaldos();

          // Mostrar resumen de movimientos
          const resumen = result.saldos_actualizados
            .map(
              (s) => `${s.moneda_id}: ${s.saldo_anterior} → ${s.saldo_nuevo}`
            )
            .join(", ");

          toast.success(`✅ Saldos actualizados: ${resumen}`);

          return {
            success: true,
            saldos_actualizados: result.saldos_actualizados,
          };
        }

        return { success: false };
      } catch {
        toast.error("Error inesperado al procesar movimientos contables");
        return { success: false };
      }
    },
    [user, selectedPoint, cargarSaldos]
  );

  // Obtener saldo de una moneda específica
  const getSaldoMoneda = useCallback(
    (moneda_id: string): number => {
      const saldo = saldos.find((s) => s.moneda_id === moneda_id);
      return saldo?.saldo || 0;
    },
    [saldos]
  );

  // Verificar si hay saldo suficiente
  const tieneSaldoSuficiente = useCallback(
    (moneda_id: string, monto: number): boolean => {
      const saldoActual = getSaldoMoneda(moneda_id);
      return saldoActual >= monto;
    },
    [getSaldoMoneda]
  );

  // Cargar datos iniciales
  useEffect(() => {
    if (selectedPoint) {
      cargarSaldos();
      cargarMovimientos();
    }
  }, [selectedPoint, cargarSaldos, cargarMovimientos]);

  return {
    // Estados
    saldos,
    movimientos,
    isLoading,
    error,

    // Funciones
    cargarSaldos,
    cargarMovimientos,
    validarSaldoParaCambio,
    procesarMovimientosCambio,
    getSaldoMoneda,
    tieneSaldoSuficiente,

    // Utilidades
    refresh: () => {
      cargarSaldos();
      cargarMovimientos();
    },
  };
};

export default useContabilidadDivisas;
