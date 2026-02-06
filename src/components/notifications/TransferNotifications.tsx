import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { transferApprovalService } from "../../services/transferApprovalService";
import { transferService } from "../../services/transferService";
import { ApiError } from "../../services/apiService";

interface TransferNotificationsProps {
  onNotificationClick: () => void;
  userRole?: string;
}

const BASE_INTERVAL_MS = 30_000; // 30s normal
const MAX_INTERVAL_MS = 120_000; // 120s tope en backoff
const ERR_INTERVAL_MS = 45_000; // fallback si no es 429

const TransferNotifications = ({
  onNotificationClick,
  userRole,
}: TransferNotificationsProps) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const timerRef = useRef<number | undefined>(undefined);
  const backoffRef = useRef<number>(BASE_INTERVAL_MS);
  const mountedRef = useRef<boolean>(false);
  const fetchingRef = useRef<boolean>(false);

  // Determinar si es admin o operador
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_USUARIO";
  const isOperador = userRole === "OPERADOR" || userRole === "CONCESION";

  useEffect(() => {
    mountedRef.current = true;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };

    const scheduleNext = (ms: number) => {
      if (!mountedRef.current) return;
      clearTimer();
      timerRef.current = window.setTimeout(run, ms) as unknown as number;
    };

    const run = async () => {
      if (!mountedRef.current) return;

      // No hagas requests si la pestaña está oculta; retenta luego
      if (document.hidden) {
        return scheduleNext(backoffRef.current);
      }

      // Evita solapamientos
      if (fetchingRef.current) {
        return scheduleNext(backoffRef.current);
      }

      fetchingRef.current = true;

      try {
        let totalCount = 0;

        // Admins: ver transferencias PENDIENTES de aprobación (flujo antiguo)
        if (isAdmin) {
          const { transfers, error } =
            await transferApprovalService.getPendingTransfers();

          if (error) {
            backoffRef.current = ERR_INTERVAL_MS;
            console.warn("Error fetching pending transfers:", error);
          } else {
            totalCount += transfers.length;
          }
        }

        // Operadores: ver transferencias EN_TRANSITO pendientes de aceptación
        if (isOperador) {
          const { transfers, error } =
            await transferService.getPendingAcceptanceTransfers();

          if (error) {
            backoffRef.current = ERR_INTERVAL_MS;
            console.warn("Error fetching pending acceptance transfers:", error);
          } else {
            totalCount += transfers.length;
          }
        }

        setPendingCount(totalCount);
        backoffRef.current = BASE_INTERVAL_MS; // reset en éxito
      } catch (e: unknown) {
        if (e instanceof ApiError && e.status === 429) {
          backoffRef.current = Math.min(
            backoffRef.current * 2,
            MAX_INTERVAL_MS
          );
          console.warn(
            `[TransferNotifications] 429 received. Backing off to ${backoffRef.current}ms`
          );
        } else {
          backoffRef.current = ERR_INTERVAL_MS;
          console.error("Error in fetchPendingTransfers:", e);
        }
      } finally {
        fetchingRef.current = false;
        setIsLoading(false);
        scheduleNext(backoffRef.current);
      }
    };

    // Primer disparo inmediato
    run();

    // Reintenta al volver a foco/visibilidad
    const onFocus = () => run();
    const onVis = () => {
      if (!document.hidden) run();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mountedRef.current = false;
      clearTimer();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isAdmin, isOperador]);

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="h-8 w-8 p-0">
        <Bell className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onNotificationClick}
      className="relative h-8 w-8 p-0"
      aria-label={`Notificaciones de transferencias pendientes: ${pendingCount}`}
      title={`Transferencias pendientes: ${pendingCount}`}
    >
      <Bell className="h-4 w-4" />
      {pendingCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-xs"
        >
          {pendingCount}
        </Badge>
      )}
    </Button>
  );
};

export default TransferNotifications;
