import { z } from "zod";
import { RequestHandler } from "express";
type RequestProperty = "body" | "params" | "query";
export declare const validate: (schema: z.ZodSchema, property?: RequestProperty) => RequestHandler;
export declare const sanitizeInput: RequestHandler;
export {};
