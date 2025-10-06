#!/usr/bin/env tsx
/**
 * Script de Migración: Convertir fechas UTC a hora local de Ecuador
 *
 * Este script convierte todas las fechas almacenadas en UTC a hora local de Ecuador (UTC-5)
 * en todas las tablas de la base de datos.
 *
 * IMPORTANTE: Este script modifica datos en la base de datos.
 * Se recomienda hacer un backup antes de ejecutarlo.
 *
 * Uso:
 *   npx tsx server/scripts/migrar-fechas-ecuador.ts
 */
export {};
