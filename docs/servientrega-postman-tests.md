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

## 🎯 Endpoint de Generación de Guías

### URL:

```
POST {{base_url}}/servientrega/generar-guia
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

## 📋 Casos de Prueba - Generación de Guías

### 11. 📦 Generar Guía Nacional Básica

```json
{
  "tipo": "GeneracionGuia",
  "nombre_producto": "PREMIER",
  "ciudad_origen": "GUAYAQUIL-GUAYAS",
  "cedula_remitente": "0123456789",
  "nombre_remitente": "Juan Pérez",
  "direccion_remitente": "Av. 9 de Octubre 123",
  "telefono_remitente": "0987654321",
  "codigo_postal_remitente": "090101",
  "cedula_destinatario": "0987654321",
  "nombre_destinatario": "María García",
  "direccion_destinatario": "Av. Amazonas 456",
  "telefono_destinatario": "0912345678",
  "ciudad_destinatario": "QUITO-PICHINCHA",
  "pais_destinatario": "ECUADOR",
  "codigo_postal_destinatario": "170101",
  "contenido": "Documentos importantes",
  "retiro_oficina": "NO",
  "nombre_agencia_retiro_oficina": "",
  "pedido": "PED001",
  "factura": "FAC001",
  "valor_declarado": 100,
  "valor_asegurado": 10,
  "peso_fisico": 2,
  "peso_volumentrico": 0,
  "piezas": 1,
  "alto": 15,
  "ancho": 20,
  "largo": 25,
  "tipo_guia": "1",
  "alianza": "PUNTO_CAMBIO",
  "alianza_oficina": "PUNTO_CAMBIO_INICIAL_XR",
  "mail_remite": "remitente@email.com",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

### 12. 📦 Generar Guía con Retiro en Oficina

```json
{
  "tipo": "GeneracionGuia",
  "nombre_producto": "PREMIER",
  "ciudad_origen": "CUENCA-AZUAY",
  "cedula_remitente": "0123456789",
  "nombre_remitente": "Carlos López",
  "direccion_remitente": "Calle Larga 789",
  "telefono_remitente": "0987654321",
  "codigo_postal_remitente": "010101",
  "cedula_destinatario": "0987654321",
  "nombre_destinatario": "Ana Rodríguez",
  "direccion_destinatario": "Av. 6 de Diciembre 321",
  "telefono_destinatario": "0912345678",
  "ciudad_destinatario": "QUITO-PICHINCHA",
  "pais_destinatario": "ECUADOR",
  "codigo_postal_destinatario": "170101",
  "contenido": "Productos electrónicos",
  "retiro_oficina": "SI",
  "nombre_agencia_retiro_oficina": "QUITO_CENTRO_HISTORICO",
  "pedido": "PED002",
  "factura": "FAC002",
  "valor_declarado": 500,
  "valor_asegurado": 50,
  "peso_fisico": 5,
  "peso_volumentrico": 0,
  "piezas": 1,
  "alto": 25,
  "ancho": 30,
  "largo": 35,
  "tipo_guia": "1",
  "alianza": "PUNTO_CAMBIO",
  "alianza_oficina": "PUNTO_CAMBIO_INICIAL_XR",
  "mail_remite": "remitente@email.com",
  "usuingreso": "PRUEBA",
  "contrasenha": "s12345ABCDe"
}
```

**Respuesta Esperada de Generación de Guía:**

```json
[
  {
    "flete": 2.64,
    "valor_declarado": 150,
    "tiempo": "1",
    "valor_empaque": 0.336,
    "trayecto": "LOCAL",
    "prima": 1.5,
    "peso": 2,
    "volumen": 1,
    "peso_cobrar": 2,
    "descuento": 0,
    "tarifa0": 0,
    "tarifa12": 5.93,
    "tiva": 0.7116,
    "gtotal": 6.9776
  }
]
{
  "fetch": {
    "proceso": "Guia Generada Correctamente",
    "guia": "1010000155",
    "guia_pdf": "https://servientrega-ecuador-prueba.appsiscore.com/app/ws/aliados/autoscan/1010000155.pdf",
    "guia_64": "JVBERi0xLjMKMyAwIG9iago8PC9UeXBlIC9QYWdlCi9QYXJlbnQgMSAwIFIKL1Jlc291cmNlcyAyIDAgUgovQ29udGVudHMgNCAwIFI+PgplbmRvYmoK..."
  }
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

### ✅ Campos Requeridos (Generación de Guía):

- `tipo`: "GeneracionGuia"
- `nombre_producto`: Tipo de producto
- `ciudad_origen`: "CIUDAD-PROVINCIA" (formato específico)
- `cedula_remitente`: Cédula del remitente
- `nombre_remitente`: Nombre completo del remitente
- `direccion_remitente`: Dirección del remitente
- `telefono_remitente`: Teléfono del remitente
- `codigo_postal_remitente`: Código postal del remitente
- `cedula_destinatario`: Cédula del destinatario
- `nombre_destinatario`: Nombre completo del destinatario
- `direccion_destinatario`: Dirección del destinatario
- `telefono_destinatario`: Teléfono del destinatario
- `ciudad_destinatario`: "CIUDAD-PROVINCIA" (formato específico)
- `pais_destinatario`: País del destinatario
- `codigo_postal_destinatario`: Código postal del destinatario
- `contenido`: Descripción del contenido
- `retiro_oficina`: "SI" o "NO"
- `nombre_agencia_retiro_oficina`: Nombre de la agencia (si aplica)
- `pedido`: Número de pedido
- `factura`: Número de factura
- `valor_declarado`: Valor declarado (número)
- `valor_asegurado`: Valor asegurado (número)
- `peso_fisico`: Peso físico (número)
- `peso_volumentrico`: Peso volumétrico (número, 0 para auto-cálculo)
- `piezas`: Número de piezas
- `alto`: Alto en cm (número)
- `ancho`: Ancho en cm (número)
- `largo`: Largo en cm (número)
- `tipo_guia`: "1" (valor fijo)
- `alianza`: Nombre de la alianza
- `alianza_oficina`: Código de la oficina
- `mail_remite`: Email del remitente
- `usuingreso`: Usuario de prueba
- `contrasenha`: Contraseña de prueba

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
