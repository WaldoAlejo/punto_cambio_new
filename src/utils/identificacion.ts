/**
 * Utilidades para validación de identificación ecuatoriana (Cédula y RUC)
 */

/**
 * Valida una identificación ecuatoriana (Cédula, RUC Persona Natural, RUC Sociedad Privada, RUC Entidad Pública)
 * También permite pasaportes (mínimo 6 caracteres alfanuméricos)
 * 
 * NOTA: Esta validación es permisiva con el dígito verificador para aceptar RUCs antiguos
 * y especiales que pueden no seguir el algoritmo estándar. Solo valida el formato básico.
 */
export function validarIdentificacion(id: string): boolean {
  const cleanId = (id || "").trim();
  
  if (!cleanId) return false;

  // Si no son solo números, validar como pasaporte genérico
  if (!/^\d+$/.test(cleanId)) {
    return /^[A-Za-z0-9]{6,}$/.test(cleanId);
  }

  const len = cleanId.length;

  // Solo cédulas (10) o RUCs (13) son válidos si son solo números
  if (len !== 10 && len !== 13) return false;

  const provincia = parseInt(cleanId.substring(0, 2), 10);
  
  // El código de provincia debe estar entre 1 y 24 (o 30 para residentes en el exterior)
  if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;

  const tercerDigito = parseInt(cleanId[2], 10);

  // Validación según tipo de identificación
  if (tercerDigito < 6) {
    // Persona Natural: Cédula (10) o RUC (13)
    // Validar que los últimos 3 dígitos no sean 000 (para RUC)
    if (len === 13 && parseInt(cleanId.substring(10), 10) === 0) return false;
    
    // Para cédulas y RUCs de persona natural, validamos el dígito verificador
    // usando el algoritmo de módulo 10
    const d10 = parseInt(cleanId[9], 10);
    const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let val = parseInt(cleanId[i], 10) * coef[i];
      if (val >= 10) val -= 9;
      suma += val;
    }
    const check = (10 - (suma % 10)) % 10;
    return check === d10;
    
  } else if (tercerDigito === 6) {
    // Entidad Pública - RUC (13 dígitos)
    // Formato: 2 dígitos provincia + 6 + 6 dígitos secuencial + dígito verificador + 3 dígitos establecimiento
    if (len !== 13) return false;
    
    // Los últimos 3 dígitos no pueden ser 000
    if (parseInt(cleanId.substring(10), 10) === 0) return false;
    
    // Aceptamos cualquier dígito verificador (posición 9) para ser permisivos
    // ya que hay RUCs antiguos que no siguen el algoritmo estándar
    return true;
    
  } else if (tercerDigito === 9) {
    // Sociedad Privada o Extranjera - RUC (13 dígitos)
    // Formato: 2 dígitos provincia + 9 + 6 dígitos secuencial + dígito verificador + 3 dígitos establecimiento
    if (len !== 13) return false;
    
    // Los últimos 3 dígitos no pueden ser 000
    if (parseInt(cleanId.substring(10), 10) === 0) return false;
    
    // Aceptamos cualquier dígito verificador (posición 9) para ser permisivos
    // ya que hay RUCs antiguos que no siguen el algoritmo estándar
    return true;
  }

  return false;
}
