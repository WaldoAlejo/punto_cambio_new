// server/types/express-augment.d.ts
import "express";

declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      username?: string;
      punto_atencion_id?: string | null;
      role?: string;
    }

    // Agregamos "user" al Request (lo setea tu middleware authenticateToken)
    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
