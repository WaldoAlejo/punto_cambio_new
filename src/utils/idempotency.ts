/**
 * Utilidades para manejo de idempotencia en peticiones HTTP
 * Previene duplicados por doble clic o race conditions
 */

/**
 * Genera un UUID v4 compatible con todos los navegadores
 * No depende de crypto.randomUUID() que puede no estar disponible
 */
export function generateUUID(): string {
  // Usar crypto.getRandomValues si está disponible (más seguro)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    
    // Set version (4) and variant bits
    array[6] = (array[6] & 0x0f) | 0x40;
    array[8] = (array[8] & 0x3f) | 0x80;
    
    const hex = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  
  // Fallback para navegadores antiguos
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Genera una clave de idempotencia única para una operación
 * Incluye timestamp para garantizar unicidad incluso si se genera
 * la misma operación en momentos diferentes
 */
export function generateIdempotencyKey(prefix?: string): string {
  const uuid = generateUUID();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  if (prefix) {
    return `${prefix}-${uuid}-${timestamp}-${random}`;
  }
  
  return `${uuid}-${timestamp}-${random}`;
}

/**
 * Almacenamiento en memoria de claves de idempotencia recientes
 * Previene reenvío accidental dentro de la misma sesión
 */
const recentKeys = new Map<string, number>();
const KEY_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Limpia las claves antiguas del almacenamiento en memoria
 */
function cleanupOldKeys(): void {
  const now = Date.now();
  for (const [key, timestamp] of recentKeys.entries()) {
    if (now - timestamp > KEY_TTL_MS) {
      recentKeys.delete(key);
    }
  }
}

/**
 * Verifica si una clave de idempotencia ya fue usada recientemente
 * Útil para prevenir doble clic en el mismo componente
 */
export function wasKeyUsedRecently(key: string): boolean {
  cleanupOldKeys();
  return recentKeys.has(key);
}

/**
 * Marca una clave de idempotencia como usada
 */
export function markKeyAsUsed(key: string): void {
  recentKeys.set(key, Date.now());
}

/**
 * Genera una nueva clave de idempotencia y la marca como usada
 */
export function generateAndTrackKey(prefix?: string): string {
  const key = generateIdempotencyKey(prefix);
  markKeyAsUsed(key);
  return key;
}

/**
 * Hook para React que proporciona funciones de idempotencia
 * Garantiza que cada operación tenga una clave única
 */
export function useIdempotency() {
  return {
    generateKey: generateIdempotencyKey,
    generateAndTrackKey,
    wasKeyUsedRecently,
    markKeyAsUsed,
  };
}
