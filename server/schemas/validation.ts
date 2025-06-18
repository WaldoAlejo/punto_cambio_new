
import { z } from 'zod';

// Schema para login
export const loginSchema = z.object({
  username: z.string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(50, 'El nombre de usuario no puede exceder 50 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guiones bajos'),
  password: z.string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña no puede exceder 100 caracteres')
});

// Schema para crear usuario
export const createUserSchema = z.object({
  username: z.string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(50, 'El nombre de usuario no puede exceder 50 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guiones bajos'),
  password: z.string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña no puede exceder 100 caracteres'),
  nombre: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  correo: z.string()
    .email('Formato de correo inválido')
    .optional()
    .nullable(),
  telefono: z.string()
    .regex(/^[\d\-\+\(\)\s]+$/, 'Formato de teléfono inválido')
    .optional()
    .nullable(),
  rol: z.enum(['ADMIN', 'OPERADOR', 'SUPER_USUARIO'], {
    errorMap: () => ({ message: 'Rol inválido. Debe ser ADMIN, OPERADOR o SUPER_USUARIO' })
  }),
  punto_atencion_id: z.string().uuid('ID de punto de atención inválido').optional().nullable()
});

// Schema para crear punto de atención
export const createPointSchema = z.object({
  nombre: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  direccion: z.string()
    .min(5, 'La dirección debe tener al menos 5 caracteres')
    .max(255, 'La dirección no puede exceder 255 caracteres'),
  ciudad: z.string()
    .min(2, 'La ciudad debe tener al menos 2 caracteres')
    .max(100, 'La ciudad no puede exceder 100 caracteres'),
  provincia: z.string()
    .min(2, 'La provincia debe tener al menos 2 caracteres')
    .max(100, 'La provincia no puede exceder 100 caracteres'),
  codigo_postal: z.string()
    .regex(/^[\d\-\s]+$/, 'Formato de código postal inválido')
    .optional()
    .nullable(),
  telefono: z.string()
    .regex(/^[\d\-\+\(\)\s]+$/, 'Formato de teléfono inválido')
    .optional()
    .nullable()
});

// Schema para crear moneda
export const createCurrencySchema = z.object({
  nombre: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres'),
  simbolo: z.string()
    .min(1, 'El símbolo es requerido')
    .max(5, 'El símbolo no puede exceder 5 caracteres'),
  codigo: z.string()
    .min(3, 'El código debe tener al menos 3 caracteres')
    .max(3, 'El código debe tener exactamente 3 caracteres')
    .regex(/^[A-Z]+$/, 'El código debe estar en mayúsculas'),
  orden_display: z.number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .optional()
});

// Tipos derivados de los schemas
export type LoginRequest = z.infer<typeof loginSchema>;
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type CreatePointRequest = z.infer<typeof createPointSchema>;
export type CreateCurrencyRequest = z.infer<typeof createCurrencySchema>;
