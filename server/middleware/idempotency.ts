import type { Request, Response, NextFunction, RequestHandler } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma.js";

type IdempotencyOptions = {
  route: string;
  ttlMs?: number;
};

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",");
  return `{${body}}`;
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function getIdempotencyKey(req: Request): string | null {
  const raw = req.header("idempotency-key") ?? req.header("Idempotency-Key");
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 256);
}

export function idempotency(options: IdempotencyOptions) {
  const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;

  const handler: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const key = getIdempotencyKey(req);
    if (!key) return next();

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
        requestId: req.requestId,
      });
    }
    const method = req.method.toUpperCase();
    const route = options.route;

    const requestHash = sha256(
      `${method}|${route}|${stableStringify(req.body ?? null)}`
    );

    const now = new Date();
    const expiresAt = new Date(Date.now() + ttlMs);

    const uniqueWhere = {
      key_route_method_user_id: {
        key,
        route,
        method,
        user_id: userId,
      },
    } as const;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await prisma.idempotencyKey.create({
          data: {
            key,
            route,
            method,
            user_id: userId,
            request_hash: requestHash,
            status: "IN_PROGRESS",
            expires_at: expiresAt,
          },
          select: { id: true },
        });
        break;
      } catch (error: unknown) {
        const existing = await prisma.idempotencyKey.findUnique({
          where: uniqueWhere,
        });

        if (!existing) {
          return next(error as Error);
        }

        if (existing.expires_at <= now && attempt === 0) {
          await prisma.idempotencyKey.delete({ where: { id: existing.id } });
          continue;
        }

        if (existing.request_hash !== requestHash) {
          return res.status(409).json({
            success: false,
            error:
              "Idempotency-Key ya fue usado con un payload diferente para este endpoint",
            requestId: req.requestId,
          });
        }

        if (existing.status === "COMPLETED" && existing.response_status) {
          res.setHeader("Idempotency-Replayed", "true");
          return res
            .status(existing.response_status)
            .json(existing.response_body ?? { success: true });
        }

        res.setHeader("Retry-After", "2");
        return res.status(409).json({
          success: false,
          error:
            "Ya hay una solicitud en proceso con este Idempotency-Key. Reintenta en unos segundos.",
          requestId: req.requestId,
        });
      }
    }

    // Capture response payload (best-effort)
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    let capturedBody: unknown = undefined;

    res.json = ((body?: unknown) => {
      capturedBody = body;
      return originalJson(body as never);
    }) as typeof res.json;

    res.send = ((body?: unknown) => {
      capturedBody = body;
      return originalSend(body as never);
    }) as typeof res.send;

    res.on("finish", async () => {
      try {
        // Normalize non-JSON responses
        const bodyForDb =
          capturedBody !== undefined
            ? typeof capturedBody === "string"
              ? { raw: capturedBody }
              : capturedBody
            : null;

        await prisma.idempotencyKey.update({
          where: uniqueWhere,
          data: {
            status: "COMPLETED",
            response_status: res.statusCode,
            response_body: bodyForDb as any,
          },
        });
      } catch {
        // ignore
      }
    });

    return next();
  };

  return handler;
}
