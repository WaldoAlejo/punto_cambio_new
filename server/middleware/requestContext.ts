import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

function safeRequestId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  // Avoid unbounded header sizes
  return trimmed.slice(0, 128);
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = safeRequestId(req.header("x-request-id"));
  const requestId = incoming ?? randomUUID();

  req.requestId = requestId;
  req.requestStartAt = Date.now();

  res.setHeader("X-Request-Id", requestId);
  next();
}
