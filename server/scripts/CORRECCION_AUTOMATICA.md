# 🔧 Corrección Automática de Signos

## ✅ Estado Actual

**TODOS los scripts ahora corrigen automáticamente los signos incorrectos** antes de realizar cualquier operación.

---

## 📋 Scripts con Corrección Automática

### 1. ✅ `validar-backend.ts`

**Cuándo corrige:** Al inicio, antes de validar

**Qué corrige:**

- EGRESOS con montos positivos → Convierte a negativos

**Flujo:**

```
1. 🔧 Corrige signos incorrectos automáticamente
2. ✅ Valida signos de movimientos
3. ✅ Valida tipos de movimiento
4. ✅ Compara backend vs scripts
5. ✅ Genera reporte
```

**Uso:**

```bash
npx tsx server/scripts/validar-backend.ts
```

---

### 2. ✅ `actualizar-saldos.ts`

**Cuándo corrige:** Al inicio, antes de calcular

**Qué corrige:**

- EGRESOS con montos positivos → Convierte a negativos

**Flujo:**

```
1. 🔧 Corrige signos incorrectos automáticamente
2. 📊 Calcula saldos reales
3. 📋 Muestra preview de cambios
4. ⚠️  Pide confirmación
5. 💾 Actualiza tabla Saldo
```

**Uso:**

```bash
npx tsx server/scripts/actualizar-saldos.ts
```

---

### 3. ✅ `calcular-saldos.ts`

**Cuándo corrige:** Al inicio, antes de calcular

**Qué corrige:**

- EGRESOS con montos positivos → Convierte a negativos

**Flujo:**

```
1. 🔧 Corrige signos incorrectos automáticamente
2. 📊 Calcula saldos reales
3. 📋 Compara con valores esperados
4. 📝 Muestra detalles de discrepancias
```

**Uso:**

```bash
npx tsx server/scripts/calcular-saldos.ts
```

---

## 🔍 Lógica de Corrección

### Código Implementado

```typescript
async function corregirSignosIncorrectos(): Promise<number> {
  console.log("\n🔍 Verificando y corrigiendo signos de movimientos...\n");

  // Buscar EGRESOS con montos positivos
  const egresosPositivos = await prisma.movimientoSaldo.findMany({
    where: {
      tipo_movimiento: "EGRESO",
      monto: {
        gt: 0,
      },
    },
    include: {
      puntoAtencion: { select: { nombre: true } },
      moneda: { select: { codigo: true } },
    },
  });

  if (egresosPositivos.length === 0) {
    console.log("✅ No se encontraron EGRESOS con signos incorrectos.\n");
    return 0;
  }

  console.log(
    `⚠️  Se encontraron ${egresosPositivos.length} EGRESOS con montos positivos:\n`
  );

  // Mostrar los primeros 10
  const mostrar = egresosPositivos.slice(0, 10);
  for (const mov of mostrar) {
    console.log(
      `   - ${mov.puntoAtencion.nombre} - ${mov.moneda.codigo} - $${Number(
        mov.monto
      ).toFixed(2)}`
    );
  }

  if (egresosPositivos.length > 10) {
    console.log(`   ... y ${egresosPositivos.length - 10} más\n`);
  }

  // Corregir automáticamente
  console.log("🔧 Corrigiendo signos...\n");

  let corregidos = 0;
  for (const mov of egresosPositivos) {
    try {
      await prisma.movimientoSaldo.update({
        where: { id: mov.id },
        data: {
          monto: -Math.abs(Number(mov.monto)),
        },
      });
      corregidos++;
    } catch (error) {
      console.error(`❌ Error corrigiendo movimiento ${mov.id}:`, error);
    }
  }

  console.log(`✅ Se corrigieron ${corregidos} movimientos.\n`);
  return corregidos;
}
```

### Qué Hace

1. **Busca** EGRESOS con `monto > 0`
2. **Muestra** los primeros 10 encontrados
3. **Corrige** automáticamente usando `-Math.abs(monto)`
4. **Reporta** cuántos fueron corregidos

---

## 📊 Ejemplo de Salida

### Cuando Encuentra Problemas

```
🔍 Verificando y corrigiendo signos de movimientos...

⚠️  Se encontraron 26 EGRESOS con montos positivos:

   - SCALA - USD - $1,260.00
   - SANTA FE - USD - $600.00
   - EL BOSQUE - USD - $230.00
   - PLAZA - USD - $150.00
   - COTOCOLLAO - USD - $100.00
   ... y 21 más

🔧 Corrigiendo signos...

✅ Se corrigieron 26 movimientos.
```

### Cuando NO Encuentra Problemas

```
🔍 Verificando y corrigiendo signos de movimientos...

✅ No se encontraron EGRESOS con signos incorrectos.
```

---

## 🎯 Beneficios

### ✅ Automático

- No requiere intervención manual
- Se ejecuta al inicio de cada script
- Transparente para el usuario

### ✅ Seguro

- Solo corrige EGRESOS positivos
- Usa `-Math.abs()` para garantizar signo negativo
- Maneja errores individualmente

### ✅ Informativo

- Muestra qué encontró
- Reporta qué corrigió
- Transparencia total

### ✅ Consistente

- Misma lógica en todos los scripts
- Garantiza datos limpios
- Previene errores de cálculo

---

## 🔄 Flujo Completo

```
Usuario ejecuta script
        ↓
🔍 Busca EGRESOS positivos
        ↓
    ¿Encontró?
    /        \
  SÍ         NO
   ↓          ↓
Muestra    Continúa
   ↓          ↓
Corrige    Ejecuta
   ↓       operación
Reporta      ↓
   ↓       Termina
Continúa
   ↓
Ejecuta operación
   ↓
Termina
```

---

## 💡 Notas Importantes

### ¿Por Qué Es Seguro?

1. **El backend ya usa `Math.abs()`** para EGRESOS, así que la corrección no cambia los cálculos
2. **Solo afecta EGRESOS positivos**, que son incorrectos por definición
3. **Mejora la calidad de datos** sin afectar la funcionalidad

### ¿Cuándo Se Ejecuta?

- **Siempre** al inicio de cada script
- **Antes** de cualquier cálculo
- **Automáticamente**, sin preguntar

### ¿Qué Pasa Si No Hay Problemas?

- Muestra mensaje de confirmación
- Continúa con la operación normal
- No hay impacto en el rendimiento

---

## ✅ Conclusión

**Todos los scripts ahora son "auto-reparadores":**

1. ✅ Detectan problemas de signos
2. ✅ Los corrigen automáticamente
3. ✅ Reportan lo que hicieron
4. ✅ Continúan con su operación normal

**No necesitas hacer nada especial** - simplemente ejecuta el script y él se encargará de mantener los datos limpios.

---

**Última actualización:** 3 de octubre, 2025
