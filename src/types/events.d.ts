// src/types/events.d.ts
import type { PointSelectedDetail } from "@/lib/events/pointEvents";

declare global {
  interface WindowEventMap {
    pointSelected: CustomEvent<PointSelectedDetail>;
  }
}

export {};
