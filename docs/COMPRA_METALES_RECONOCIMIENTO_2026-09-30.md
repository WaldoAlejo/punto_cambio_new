# Compra de oro y plata: reconocimiento guiado y ayudas visuales

Fecha: 2026-09-30. Implementado en el repositorio; no aplicado a producción.

Basado en la capacitación «Reconocimiento de oro — Pasos para reconocer el oro» (Rashell Silva), entregada por Punto Cambio.

## Qué cambia para el operador

- Botón **«Guía visual de reconocimiento de oro y plata»** con pestañas: Proceso (7 pasos), Herramientas, Quilates y ácido, Tipos de oro, Plata, No comprar y Créditos.
- Cada pieza tiene una **lista de verificación visual** de 8 pasos, con tarjetas de imagen para cada resultado posible:
  1. Color del oro (amarillo, rojo o blanco, con su composición).
  2. Sello con lupa (10K–24K, 750/585/417, 925), más la revisión de broche, uniones y soldaduras.
  3. Color uniforme.
  4. Imán.
  5. Piedra o lija.
  6. Lima.
  7. Ácido: ácido usado, reacción e intensidad.
  8. Material no comercial.
- **Selector de quilates** que llena la pureza, y un botón «Usar pureza respaldada por las pruebas».
- **Veredicto en vivo** por pieza: *Apta*, *Requiere justificación* o *No comprar*, con los motivos.
- **Confirmación de seguridad** (ácido no vencido y guantes) cuando alguna pieza usa ácido.
- El campo de observaciones pasa a ser opcional. La revisión y el recibo muestran el resumen del reconocimiento.

## Reglas (`server/utils/metalEvaluation.ts`)

El frontend y el servidor usan el mismo archivo. El servidor es quien decide.

- **Se rechaza la compra** si:
  - El imán atrae la pieza.
  - El color no es uniforme.
  - La piedra, la lija o la lima dejan ver otro metal.
  - Se registra un material no comercial: acero, titanio, níquel, gold filled o enchapado.
  - Hay efervescencia.
  - En oro, la reacción es verde, blanca, dorada o amarillenta.
  - En plata, no hay reacción (posible acero) o la reacción es verde, dorada o amarillenta.
  - Una pieza dorada tiene sello 925.
  - Falta la revisión con lupa o la de broche y uniones.
  - Con método ácido, falta la piedra, el ácido usado o la reacción.
  - No hay sello y no se usó la lima.
- **Pureza respaldada**: la tabla de la capacitación asigna una ley a cada reacción:
  - Blanco lechoso: 417.
  - Café y lechoso: 500.
  - Café: 585.
  - Poco café: 667.
  - Sin reacción: 750. Puede subir solo con un sello de 750 o más.

  Si el sello indica menos ley, se toma el valor más bajo. En plata se usa el valor del sello, o 925 si no hay sello.
- Si la pureza pagada supera la respaldada, se exige una **justificación** de al menos 15 caracteres. Sin ella, la compra no se confirma.
- Con método XRF u otro, no se exigen la piedra ni el ácido; el tope lo da el sello, si existe.
- Cada línea guarda en `DetalleCompraMetal.evaluacion` (JSONB): la lista de verificación, el resultado, la pureza máxima respaldada, los avisos y la confirmación de seguridad.

## Imágenes (`public/metal-guide/`)

- **Material de la capacitación:** ácidos, piedra, lija, limas, lupa y fotos reales de reacciones de 18K, 14K, 10K, oro blanco rodinado e intensidad.
  - No se copiaron las imágenes con marca de agua de terceros (© gemologiamllopis.com) ni las capturas de pantalla; los sellos y su ubicación se dibujaron como SVG propios.
  - Antes de publicar, la empresa debe confirmar que tiene derecho a usar las fotos de la capacitación.
- **Wikimedia Commons (CC BY-SA):** piedras de toque, juego de ácidos, sello 925, oro blanco 750, oro rodinado e imanes de neodimio.
  - La atribución está en la pestaña Créditos. CC BY-SA exige mantenerla.
- **Ilustraciones SVG propias** (`MetalIllustrations.tsx`): reacciones sobre la piedra, sellos, imán, lima, desgaste, ubicación del sello y composición de aleaciones.

### Fotografías de resultados (ampliación)

- El catálogo `src/components/metals/metalPhotos.ts` reúne 42 fotos, con su autor, licencia y enlace de origen. La pestaña Créditos se genera desde ese catálogo.
- Cada prueba (pesaje, color, sello, imán, piedra/lija, lima, ácido y material) muestra cuatro grupos de fotos:
  - Cómo se hace.
  - ✓ Resultado bueno.
  - ◐ Oro de menor ley (solo en el ácido).
  - ✕ Resultado malo.
- Dónde se ven:
  - En la pestaña «Bueno vs malo (fotos)» de la guía.
  - En cada paso de la guía de Proceso.
  - Dentro de la lista de verificación de cada pieza, en «📷 Ver fotos».
- Al tocar una foto se amplía con su crédito.
- Las fotos nuevas provienen de Wikimedia Commons, Flickr y Museums Victoria, todas con licencias CC BY, CC BY-SA o CC0, que permiten uso comercial.
  - Muchas son del joyero Mauro Cateb: lijas, limas, limaduras de oro 750 y blanco, ácidos, balanza y mosquetón.
  - Otras muestran el imán atrayendo, el cobre reaccionando verde o azul con ácido nítrico, el oro intacto junto al cobre disuelto, piezas bañadas gastadas, latón y el sello «18ct» dentro de un aro.
- Los sellos de piezas chapadas (GF, GP, HGE, RGP, 1/20, STEEL) se dibujan como SVG.
- No se encontraron fotos con licencia abierta de alguien frotando una pieza sobre la piedra de toque. Para ese paso se usan la foto de la piedra con marcas y la del lijado. Conviene reemplazarlas por fotos propias tomadas en un punto de Punto Cambio.
- Peso total de `public/metal-guide/`: 1,8 MB. Las imágenes se cargan de forma diferida (lazy loading).

## Despliegue

Es aditivo: una columna JSONB que admite nulos, por lo que las compras anteriores siguen siendo válidas.

- Si la migración de metales del 2026-09-14 **aún no se aplicó**, `metal-purchases-migration.mjs` ya incluye este SQL.
- Si **ya se aplicó**, ejecute:

```bash
node scripts/db/metal-evaluation-migration.mjs                                   # simulación
node scripts/db/metal-evaluation-migration.mjs --env-file .env.production --execute
node scripts/db/metal-evaluation-migration.mjs --env-file .env.production --check
```

Después: `npm run build` y reiniciar PM2, como en el documento del 2026-09-14. Aplique la migración **antes** de iniciar el backend nuevo, porque el backend guarda la columna `evaluacion`.

## Pruebas

- `node --import tsx scripts/tests/integration-local.mjs`: **342 correctas, 0 fallos**.
  - 17 pruebas nuevas: rechazos, justificación, plata/acero, XRF, seguridad y persistencia del reconocimiento.
- Navegador (clúster temporal, usuario ficticio):
  - Una pieza 18K sale *Apta*.
  - Pagarla como 24K pide justificación.
  - Una reacción verde da *No comprar*.
  - Una compra completa genera un recibo con el resumen del reconocimiento.
