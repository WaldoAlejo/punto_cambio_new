/**
 * Utilidades para validación de identificación ecuatoriana (Cédula y RUC)
 */

/**
 * Valida una identificación ecuatoriana (Cédula, RUC Persona Natural, RUC Sociedad Privada, RUC Entidad Pública)
 * También permite pasaportes (mínimo 6 caracteres alfanuméricos)
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

  if (tercerDigito < 6) {
    // Persona Natural: Cédula (10) o RUC (13)
    if (len === 13 && !cleanId.endsWith("001")) {
       // Técnicamente puede terminar en 002, 003... pero el 99% es 001
       // Para ser más permisivos con RUCs de personas naturales permitimos que termine en cualquier cosa > 0
       if (parseInt(cleanId.substring(10), 10) === 0) return false;
    }
    
    // Algoritmo de cédula (módulo 10)
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
    // Entidad Pública
    if (len !== 13) return false;
    if (parseInt(cleanId.substring(9), 10) === 0) return false;
    
    const d9 = parseInt(cleanId[8], 10);
    const coef = [3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 8; i++) {
      suma += parseInt(cleanId[i], 10) * coef[i];
    }
    const check = (11 - (suma % 11)) % 11;
    // Si el residuo es 0, el dígito verificador es 0
    const finalCheck = (suma % 11) === 0 ? 0 : check;
    return finalCheck === d9;
    
  } else if (tercerDigito === 9) {
    // Sociedad Privada o Extranjera
    if (len !== 13) return false;
    if (parseInt(cleanId.substring(10), 10) === 0) return false;
    
    const d10 = parseInt(cleanId[9], 10);
    const coef = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      suma += parseInt(cleanId[i], 10) * coef[i];
    }
    const check = (11 - (suma % 11)) % 11;
    const finalCheck = (suma % 11) === 0 ? 0 : check;
    return finalCheck === d10;
  }

  return false;
}
