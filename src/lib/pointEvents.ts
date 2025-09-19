// src/lib/events/pointEvents.ts
import { PuntoAtencion } from "@/types";

export const POINT_SELECTED_EVENT = "pointSelected" as const;

export type PointSelectedDetail = {
  point: Pick<PuntoAtencion, "id" | "nombre" | "ciudad" | "direccion"> &
    Partial<PuntoAtencion>;
};

export function emitPointSelected(point: PointSelectedDetail["point"]) {
  const ev = new CustomEvent<PointSelectedDetail>(POINT_SELECTED_EVENT, {
    detail: { point },
  });
  window.dispatchEvent(ev);
}
