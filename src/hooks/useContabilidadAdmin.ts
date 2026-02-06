import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { User, SaldoConsolidado, MovimientoSaldo } from "@/types";
import { movimientosContablesService } from "@/services/movimientosContablesService";
import { pointService } from "@/services/pointService";

interface UseContabilidadAdminProps {
  user: User;
}

interface MovimientoConsolidado extends MovimientoSaldo {
  punto_nombre: string;
}

export const useContabilidadAdmin = ({
  user: _user,
}: UseContabilidadAdminProps) => {
  type AdminPoint = { id: string; nombre: string };

  const isAdminPoint = useCallback((value: unknown): value is AdminPoint => {
    if (typeof value !== "object" || value === null) return false;
    const record = value as Record<string, unknown>;
    return typeof record.id === "string" && typeof record.nombre === "string";
  }, []);
  const [saldosConsolidados, setSaldosConsolidados] = useState<
    SaldoConsolidado[]
  >([]);
  const [movimientosConsolidados, setMovimientosConsolidados] = useState<
    MovimientoConsolidado[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = _user?.rol === "ADMIN" || _user?.rol === "SUPER_USUARIO";

  // Cargar saldos consolidados de todos los puntos
  const cargarSaldosConsolidados = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!isAdmin) {
        setSaldosConsolidados([]);
        setIsLoading(false);
        return;
      }
      // Primero obtener todos los puntos (solo para admins)
      const { points, error: pointsError } =
        await pointService.getAllPointsForAdmin();

      if (pointsError) {
        setError(pointsError);
        toast.error(`Error al cargar puntos: ${pointsError}`);
        return;
      }

      if (!points || points.length === 0) {
        setSaldosConsolidados([]);
        return;
      }

      // Obtener saldos de cada punto
      const saldosPromises = points.filter(isAdminPoint).map(async (punto) => {
        const { saldos, error: saldosError } =
          await movimientosContablesService.getSaldosActualesPorPunto(punto.id);

        if (saldosError) {
          console.error(
            `Error al cargar saldos del punto ${punto.nombre}:`,
            saldosError
          );
          return [];
        }

        return (saldos || []).map((saldo) => ({
          ...saldo,
          punto_nombre: punto.nombre,
          punto_id: punto.id,
        }));
      });

      const resultados = await Promise.all(saldosPromises);
      const saldosConsolidados = resultados.flat();

      setSaldosConsolidados(saldosConsolidados);
    } catch {
      const errorMessage = "Error inesperado al cargar saldos consolidados";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, isAdminPoint]);

  // Cargar movimientos consolidados de todos los puntos
  const cargarMovimientosConsolidados = useCallback(
    async (
      moneda_id?: string,
      limit = 100,
      opts?: { date?: string; from?: string; to?: string }
    ) => {
      try {
        if (!isAdmin) {
          setMovimientosConsolidados([]);
          return;
        }
        // Obtener todos los puntos (solo para admins)
        const { points, error: pointsError } =
          await pointService.getAllPointsForAdmin();

        if (pointsError) {
          setError(pointsError);
          return;
        }

        if (!points || points.length === 0) {
          setMovimientosConsolidados([]);
          return;
        }

        // Obtener movimientos de cada punto
        const movimientosPromises = points.map(async (punto) => {
          const { movimientos, error: movimientosError } =
            await movimientosContablesService.getHistorialMovimientos(
              punto.id,
              moneda_id,
              limit,
              opts
            );

          if (movimientosError) {
            console.error(
              `Error al cargar movimientos del punto ${punto.nombre}:`,
              movimientosError
            );
            return [];
          }

          return (movimientos || []).map((movimiento) => ({
            ...movimiento,
            punto_nombre: punto.nombre,
            punto_id: punto.id,
          }));
        });

        const resultados = await Promise.all(movimientosPromises);
        const movimientosConsolidados = resultados.flat();

        // Ordenar por fecha descendente
        movimientosConsolidados.sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );

        setMovimientosConsolidados(movimientosConsolidados.slice(0, limit));
      } catch {
        const errorMessage =
          "Error inesperado al cargar movimientos consolidados";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    },
    [isAdmin]
  );

  // Cargar datos iniciales
  useEffect(() => {
    cargarSaldosConsolidados();
    cargarMovimientosConsolidados();
  }, [cargarSaldosConsolidados, cargarMovimientosConsolidados]);

  const refresh = useCallback(() => {
    cargarSaldosConsolidados();
    cargarMovimientosConsolidados();
  }, [cargarSaldosConsolidados, cargarMovimientosConsolidados]);

  return {
    saldosConsolidados,
    movimientosConsolidados,
    isLoading,
    error,
    refresh,
    cargarSaldosConsolidados,
    cargarMovimientosConsolidados,
  };
};

export default useContabilidadAdmin;
