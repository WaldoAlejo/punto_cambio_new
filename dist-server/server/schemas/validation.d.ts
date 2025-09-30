import { z } from "zod";
export declare const loginSchema: z.ZodObject<{
    username: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export declare const createUserSchema: z.ZodObject<{
    username: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
    nombre: z.ZodString;
    correo: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    telefono: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rol: z.ZodEnum<["ADMIN", "OPERADOR", "SUPER_USUARIO", "CONCESION", "ADMINISTRATIVO"]>;
    punto_atencion_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    rol: "OPERADOR" | "ADMIN" | "SUPER_USUARIO" | "CONCESION" | "ADMINISTRATIVO";
    username: string;
    password: string;
    nombre: string;
    punto_atencion_id?: string | null | undefined;
    correo?: string | null | undefined;
    telefono?: string | null | undefined;
}, {
    rol: "OPERADOR" | "ADMIN" | "SUPER_USUARIO" | "CONCESION" | "ADMINISTRATIVO";
    username: string;
    password: string;
    nombre: string;
    punto_atencion_id?: string | null | undefined;
    correo?: string | null | undefined;
    telefono?: string | null | undefined;
}>;
export declare const createPointSchema: z.ZodObject<{
    nombre: z.ZodString;
    direccion: z.ZodString;
    ciudad: z.ZodString;
    provincia: z.ZodString;
    codigo_postal: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    telefono: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    nombre: string;
    direccion: string;
    ciudad: string;
    provincia: string;
    telefono?: string | null | undefined;
    codigo_postal?: string | null | undefined;
}, {
    nombre: string;
    direccion: string;
    ciudad: string;
    provincia: string;
    telefono?: string | null | undefined;
    codigo_postal?: string | null | undefined;
}>;
export declare const createCurrencySchema: z.ZodObject<{
    nombre: z.ZodString;
    simbolo: z.ZodString;
    codigo: z.ZodString;
    orden_display: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    nombre: string;
    simbolo: string;
    codigo: string;
    orden_display?: number | undefined;
}, {
    nombre: string;
    simbolo: string;
    codigo: string;
    orden_display?: number | undefined;
}>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type CreatePointRequest = z.infer<typeof createPointSchema>;
export type CreateCurrencyRequest = z.infer<typeof createCurrencySchema>;
