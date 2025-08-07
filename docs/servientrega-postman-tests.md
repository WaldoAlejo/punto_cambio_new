# 🧪 Pruebas de API Servientrega - Postman

## 📋 Configuración Inicial

### Variables de Entorno en Postman:

```json
{
  "base_url": "http://localhost:3000/api",
  "token": "tu_token_de_autenticacion"
}
```

### Headers Globales:

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}"
}
```

## 🎯 Endpoint de Tarifas

### URL:

```
POST {{base_url}}/servientrega/tarifa
```

## 📦 Casos de Prueba

### 1. ✅ Envío Básico Quito → Guayaquil

```json
{
  "tipo": "obtener_tarifa_nacional",
  "ciu_ori": "QUITO",
  "provincia_ori": "PICHINCHA",
  "ciu_des": "GUAYAQUIL",
  "provincia_des": "GUAYAS",
  "valor_seguro": "5.0",
  "valor_declarado": "50.0",
  "peso": "2",
  "alto": "15",
  "ancho": "20",
  "largo": "25",
  "recoleccion": "NO",
  "nombre_producto": "PREMIER",
  "empaque": "SOBRE",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

**Respuesta Esperada:**

```json
[
  {
    "flete": 8.5,
    "valor_declarado": "50.0",
    "tiempo": "1",
    "valor_empaque": "0.30"
  }
]
```

### 2. 📦 Envío con Caja Cuenca → Manta

```json
{
  "tipo": "obtener_tarifa_nacional",
  "ciu_ori": "CUENCA",
  "provincia_ori": "AZUAY",
  "ciu_des": "MANTA",
  "provincia_des": "MANABI",
  "valor_seguro": "15.0",
  "valor_declarado": "200.0",
  "peso": "5",
  "alto": "25",
  "ancho": "30",
  "largo": "35",
  "recoleccion": "NO",
  "nombre_producto": "PREMIER",
  "empaque": "CAJA",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

### 3. 🚚 Envío con Recolección Ambato → Loja

```json
{
  "tipo": "obtener_tarifa_nacional",
  "ciu_ori": "AMBATO",
  "provincia_ori": "TUNGURAHUA",
  "ciu_des": "LOJA",
  "provincia_des": "LOJA",
  "valor_seguro": "8.0",
  "valor_declarado": "80.0",
  "peso": "3",
  "alto": "20",
  "ancho": "25",
  "largo": "30",
  "recoleccion": "SI",
  "nombre_producto": "PREMIER",
  "empaque": "AISLANTE DE HUMEDAD",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

### 4. 📄 Documentos Livianos Guayaquil → Quito

```json
{
  "tipo": "obtener_tarifa_nacional",
  "ciu_ori": "GUAYAQUIL",
  "provincia_ori": "GUAYAS",
  "ciu_des": "QUITO",
  "provincia_des": "PICHINCHA",
  "valor_seguro": "2.0",
  "valor_declarado": "10.0",
  "peso": "0.5",
  "alto": "5",
  "ancho": "25",
  "largo": "35",
  "recoleccion": "NO",
  "nombre_producto": "PREMIER",
  "empaque": "SOBRE",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

### 5. 📦 Paquete Pesado Machala → Riobamba

```json
{
  "tipo": "obtener_tarifa_nacional",
  "ciu_ori": "MACHALA",
  "provincia_ori": "EL ORO",
  "ciu_des": "RIOBAMBA",
  "provincia_des": "CHIMBORAZO",
  "valor_seguro": "25.0",
  "valor_declarado": "500.0",
  "peso": "10",
  "alto": "40",
  "ancho": "50",
  "largo": "60",
  "recoleccion": "NO",
  "nombre_producto": "PREMIER",
  "empaque": "CAJA",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

### 6. 🧪 Prueba con Empaque "SOBRE"

```json
{
  "tipo": "obtener_tarifa_nacional",
  "ciu_ori": "QUITO",
  "provincia_ori": "PICHINCHA",
  "ciu_des": "GUAYAQUIL",
  "provincia_des": "GUAYAS",
  "valor_seguro": "5.0",
  "valor_declarado": "50.0",
  "peso": "1",
  "alto": "5",
  "ancho": "25",
  "largo": "35",
  "recoleccion": "NO",
  "nombre_producto": "PREMIER",
  "empaque": "SOBRE",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

### 7. 🧪 Prueba con Empaque "CAJA"

```json
{
  "tipo": "obtener_tarifa_nacional",
  "ciu_ori": "CUENCA",
  "provincia_ori": "AZUAY",
  "ciu_des": "QUITO",
  "provincia_des": "PICHINCHA",
  "valor_seguro": "8.0",
  "valor_declarado": "120.0",
  "peso": "4",
  "alto": "25",
  "ancho": "30",
  "largo": "35",
  "recoleccion": "NO",
  "nombre_producto": "PREMIER",
  "empaque": "CAJA",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

## 🌍 Casos de Prueba Internacionales

### 8. 🇨🇴 Envío Ecuador → Colombia

```json
{
  "tipo": "obtener_tarifa_internacional",
  "pais_ori": "ECUADOR",
  "ciu_ori": "GUAYAQUIL",
  "provincia_ori": "GUAYAS",
  "pais_des": "COLOMBIA",
  "ciu_des": "BOGOTA",
  "provincia_des": "CUNDINAMARCA",
  "valor_seguro": "12.5",
  "valor_declarado": "100.0",
  "peso": "5",
  "alto": "20",
  "ancho": "25",
  "largo": "30",
  "recoleccion": "NO",
  "nombre_producto": "PREMIER",
  "empaque": "AISLANTE DE HUMEDAD",
  "codigo_postal_ori": "170150",
  "codigo_postal_des": "110111",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

### 9. 🇺🇸 Envío Ecuador → Estados Unidos

```json
{
  "tipo": "obtener_tarifa_internacional",
  "pais_ori": "ECUADOR",
  "ciu_ori": "QUITO",
  "provincia_ori": "PICHINCHA",
  "pais_des": "ESTADOS UNIDOS",
  "ciu_des": "MIAMI",
  "provincia_des": "FLORIDA",
  "valor_seguro": "25.0",
  "valor_declarado": "200.0",
  "peso": "3",
  "alto": "15",
  "ancho": "20",
  "largo": "25",
  "recoleccion": "NO",
  "nombre_producto": "PREMIER",
  "empaque": "CAJA",
  "codigo_postal_ori": "170150",
  "codigo_postal_des": "33101",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

### 10. 🇵🇪 Envío Ecuador → Perú

```json
{
  "tipo": "obtener_tarifa_internacional",
  "pais_ori": "ECUADOR",
  "ciu_ori": "CUENCA",
  "provincia_ori": "AZUAY",
  "pais_des": "PERU",
  "ciu_des": "LIMA",
  "provincia_des": "LIMA",
  "valor_seguro": "15.0",
  "valor_declarado": "150.0",
  "peso": "4",
  "alto": "25",
  "ancho": "30",
  "largo": "35",
  "recoleccion": "NO",
  "nombre_producto": "PREMIER",
  "empaque": "CAJA",
  "codigo_postal_ori": "170150",
  "codigo_postal_des": "15001",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

## 🏙️ Ciudades y Provincias Válidas

| Ciudad     | Provincia  | Código |
| ---------- | ---------- | ------ |
| QUITO      | PICHINCHA  | QUI    |
| GUAYAQUIL  | GUAYAS     | GYE    |
| CUENCA     | AZUAY      | CUE    |
| AMBATO     | TUNGURAHUA | AMB    |
| MANTA      | MANABI     | MAN    |
| LOJA       | LOJA       | LOJ    |
| MACHALA    | EL ORO     | MAC    |
| RIOBAMBA   | CHIMBORAZO | RIO    |
| IBARRA     | IMBABURA   | IBA    |
| ESMERALDAS | ESMERALDAS | ESM    |

## 🌍 Países y Destinos Internacionales

### 🇨🇴 Colombia

| Ciudad    | Provincia/Estado | Código Postal |
| --------- | ---------------- | ------------- |
| BOGOTA    | CUNDINAMARCA     | 110111        |
| MEDELLIN  | ANTIOQUIA        | 050001        |
| CALI      | VALLE DEL CAUCA  | 760001        |
| CARTAGENA | BOLIVAR          | 130001        |

### 🇺🇸 Estados Unidos

| Ciudad      | Estado     | Código Postal |
| ----------- | ---------- | ------------- |
| MIAMI       | FLORIDA    | 33101         |
| NEW YORK    | NEW YORK   | 10001         |
| LOS ANGELES | CALIFORNIA | 90001         |
| HOUSTON     | TEXAS      | 77001         |

### 🇵🇪 Perú

| Ciudad   | Provincia   | Código Postal |
| -------- | ----------- | ------------- |
| LIMA     | LIMA        | 15001         |
| AREQUIPA | AREQUIPA    | 04001         |
| TRUJILLO | LA LIBERTAD | 13001         |
| CUSCO    | CUSCO       | 08001         |

## 📋 Parámetros Obligatorios

### ✅ Campos Requeridos (Nacional):

- `tipo`: "obtener_tarifa_nacional"
- `ciu_ori`: Ciudad origen (MAYÚSCULAS)
- `provincia_ori`: Provincia origen (MAYÚSCULAS)
- `ciu_des`: Ciudad destino (MAYÚSCULAS)
- `provincia_des`: Provincia destino (MAYÚSCULAS)
- `valor_seguro`: Valor del seguro (string)
- `valor_declarado`: Valor declarado (string)
- `peso`: Peso en kg (string)
- `alto`: Alto en cm (string)
- `ancho`: Ancho en cm (string)
- `largo`: Largo en cm (string)
- `recoleccion`: "SI" o "NO"
- `nombre_producto`: "PREMIER", "ESTANDAR", "EXPRESS"
- `empaque`: Tipo de empaque
- `usuingreso`: Usuario de prueba
- `contrasenha`: Contraseña de prueba

### ✅ Campos Adicionales (Internacional):

- `tipo`: "obtener_tarifa_internacional"
- `pais_ori`: País origen (ej: "ECUADOR")
- `pais_des`: País destino (ej: "COLOMBIA")
- `codigo_postal_ori`: Código postal origen
- `codigo_postal_des`: Código postal destino
- Todos los campos nacionales también aplican

### 📦 Tipos de Empaque Válidos:

- "SOBRE" ✅ (Funciona)
- "CAJA" ✅ (Funciona)
- "AISLANTE DE HUMEDAD" ✅ (Funciona - Respuesta confirmada)
- "BOLSA" ⚠️ (Por probar)

### 🔍 **Respuesta Real de Servientrega:**

```json
[
  {
    "flete": 0,
    "valor_declarado": "10.0",
    "tiempo": null,
    "valor_empaque": 0.336,
    "trayecto": null,
    "prima": 0.1,
    "peso": "3",
    "volumen": 3,
    "peso_cobrar": 3,
    "descuento": null,
    "tarifa0": 0,
    "tarifa12": 0.1,
    "tiva": 0.015,
    "gtotal": 0.451
  }
]
```

### 💡 **Campos Importantes:**

- `gtotal`: Total real a cobrar
- `prima`: Seguro/prima
- `tiva`: IVA
- `volumen`: Peso volumétrico
- `peso_cobrar`: Peso a cobrar

## 🔍 Debugging

### Si recibes valores en cero:

1. **Verifica credenciales**: `usuingreso` y `contrasenha`
2. **Ciudades exactas**: Deben estar en la BD de Servientrega
3. **Formato correcto**: Todos los números como strings
4. **Peso mínimo**: Mínimo 0.5 kg
5. **Dimensiones válidas**: Todas mayores a 0

### Logs en Consola:

- Busca `📤 Payload para tarifa:` para ver qué se envía
- Busca `📥 Respuesta de tarifa:` para ver qué se recibe

## 🧪 Script de Prueba Automática (Postman)

```javascript
// Pre-request Script
pm.environment.set("timestamp", new Date().toISOString());

// Test Script
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response has tarifa data", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData).to.be.an("array");
  pm.expect(jsonData[0]).to.have.property("flete");
  pm.expect(jsonData[0]).to.have.property("valor_empaque");
});

pm.test("Flete is greater than 0", function () {
  var jsonData = pm.response.json();
  pm.expect(parseFloat(jsonData[0].flete)).to.be.above(0);
});
```

## 📊 Resultados Esperados

### Rangos Típicos:

- **Flete**: $3.00 - $25.00 (según distancia y peso)
- **Valor empaque**: $0.30 - $5.00 (según tipo)
- **Tiempo**: 1-3 días hábiles
- **Peso volumétrico**: Calculado automáticamente

### ⚠️ Errores Comunes:

- Ciudad no encontrada → Verificar ortografía exacta
- Credenciales inválidas → Verificar usuario/contraseña
- Peso/dimensiones inválidas → Verificar valores > 0
- Formato incorrecto → Verificar que números sean strings
