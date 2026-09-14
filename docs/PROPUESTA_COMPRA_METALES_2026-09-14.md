# Propuesta: compra de oro y plata

Estado: primera versión implementada y probada localmente. Pendiente de despliegue y habilitación explícita de puntos. Ver [implementación, pruebas y despliegue](COMPRA_METALES_IMPLEMENTACION_2026-09-14.md). El resto de este documento conserva la propuesta de referencia; el documento de implementación detalla las decisiones y límites de la versión entregada.

## Alcance confirmado

Solo compras. El operador ingresa el precio negociado por gramo; no se impone un precio mínimo comercial. No se añaden precios máximos, autorizaciones por margen ni cotizaciones automáticas sin una regla empresarial expresa. Los valores deben ser positivos, finitos y representables: esto es validación de datos, no una tarifa mínima.

Medios de pago confirmados: efectivo o transferencia bancaria, siguiendo el tratamiento actual de cambios de divisas. Efectivo será la selección inicial porque será el medio predominante. No se introduce control de cuentas bancarias ni validación de disponibilidad bancaria. En esta etapa cada compra usa una sola vía; no se amplía el alcance a pagos mixtos o abonos.

Queda por concretar la lista de puntos directos. El modelo PuntoAtencion tiene activo/es_principal, pero no identifica expresamente propiedad o concesión. Se propone una habilitación explícita por punto, desactivada inicialmente. No deducir elegibilidad a partir de es_principal o del rol del usuario.

No se incluyen ventas, traslados ni fundición. Cada compra sí debe dejar identificadas las piezas recibidas y su ubicación inicial para conciliar adquisición física y pago.

## Flujo del operador

1. Acceder a «Compra de oro y plata» desde una jornada vigente en un punto habilitado.
2. Identificar al vendedor y registrar datos de contacto y procedencia declarada de las piezas.
3. Agregar una línea por pieza o grupo homogéneo: metal, descripción, cantidad de piezas, foto, peso bruto, deducciones no metálicas y peso neto. Piezas con purezas distintas se registran en líneas diferentes.
4. Registrar pureza declarada y resultado estimado de la prueba por separado, método, fecha y responsable. Para oro mostrar quilates y ley; para plata usar ley en milésimas. Los resultados inconclusos quedan en borrador para revisión, sin pago.
5. Introducir «Precio negociado por gramo de esta pieza», según la pureza registrada. Mostrar subtotal por línea y total.
6. Revisar resumen de piezas, peso, pureza, precio y pago. La confirmación registra compra, recepción de piezas, egreso y comprobante interno con un mismo identificador.
7. Consultar historial y reimprimir comprobante. Corregir mediante anulación/reverso autorizado con evidencia, sin borrar ni editar compras pagadas.

## Cálculo sin aplicar pureza dos veces

La modalidad propuesta utiliza precio negociado por gramo de material de la pureza indicada:

```
peso_neto_g = peso_bruto_g - deducciones_no_metalicas_g
subtotal = redondear_centavos(peso_neto_g × precio_negociado_por_gramo)
total_compra = suma(subtotales)
gramos_finos_estimados = peso_neto_g × pureza_milesimas / 1000
```

Ejemplo ficticio: pieza de oro, 10 g netos, ley 750 (18 K), USD 60 por gramo de esa pieza. Pago comercial: USD 600. Contenido fino estimado: 7,5 g. Multiplicar otra vez los USD 600 por 0,75 descontaría la pureza dos veces. Los gramos finos son informativos para esta modalidad de negociación.

La ley medida es el dato de cálculo de contenido fino; una selección nominal de quilates puede proponer una equivalencia, pero no sustituye la evaluación. LBMA documenta, entre otras, las correspondencias 375/9 K, 585/14 K, 750/18 K y 916/22 K. [Fuente: LBMA](https://www.lbma.org.uk/wonders-of-gold/items/purity-of-gold).

Pesos con precisión acorde a la balanza, por ejemplo hasta 0,001 g si el instrumento lo admite; precios unitarios con más decimales que el importe final. Usar Decimal en servidor/BD, transportar decimales como cadenas, recalcular en servidor y fijar el redondeo por línea a dos decimales. No reutilizar funciones que redondean el peso como dinero.

## Registro de evaluación

La aplicación registra la evaluación y su evidencia; no certifica pureza. GIA documentó que un recubrimiento puede producir resultados XRF que sobreestiman la pureza de una pieza. Por eso deben conservarse método, resultado, observaciones y responsable, y distinguir resultado estimado de ensayo confirmado. [Fuente: GIA, Gold-Plated Gold](https://www.gia.edu/gems-gemology/summer-2025-lab-notes-gold-plated-gold0).

El procedimiento físico y la formación del personal corresponden al especialista responsable. Esta propuesta no prescribe preparación ni uso de ácidos.

## Integración técnica propuesta

Crear entidades propias, no representar gramos de metal como saldos monetarios de Moneda:

| Entidad | Propósito |
| --- | --- |
| CompraMetal | Punto, jornada, operador, vendedor, estado, moneda de pago, total y versión |
| DetalleCompraMetal | Metal, pureza, pesos, precio por gramo, subtotal y evidencia de prueba |
| PiezaMetalRecibida | Identificador de pieza/sobre, detalle de origen, ubicación inicial y costo de adquisición |
| PagoCompraMetal | Importe, vía EFECTIVO/TRANSFERENCIA, banco y referencia declarados, comprobante adjunto opcional y responsable del registro |
| EventoCompraMetal | Historial de acciones, reversos y responsables |

Reutilizar autenticación, jornada, apertura operativa, permisos, idempotencia y bloqueos de saldo existentes. Añadir referencia explícita COMPRA_METAL a los movimientos y revisar sus filtros de reportes; una etiqueta nueva no garantiza que todos los reportes actuales la incluyan.

En pago en efectivo: exigir apertura habilitada y conteo de la moneda de pago, comprobar suficiencia y desglose, restar exclusivamente caja. Compra, piezas, movimiento y comprobante deben confirmarse en una transacción. Una impresión fallida permite reimprimir sin repetir el pago. Un doble clic o reintento no duplica la compra.

En transferencia: replicar el egreso de destino de `server/routes/exchanges.ts`. Exigir nombre del banco y número de referencia, con imagen de comprobante opcional como en la ruta actual. El operador registra una transferencia realizada por fuera de la aplicación: guardar los datos no ejecuta ni verifica un pago bancario. No integrar API bancaria, cuentas, conciliación automática ni consulta de fondos en esta etapa.

Registrar el egreso en `Saldo.bancos` de la moneda de pago y el punto, junto con el movimiento de referencia COMPRA_METAL y su descripción bancaria compatible con los reportes existentes. Este valor puede quedar negativo: representa el registro acumulado del sistema, no la disponibilidad real de una cuenta. Mantener intactos `Saldo.cantidad`, `billetes` y `monedas_fisicas`. No rechazar una compra por transferencia por falta de saldo físico ni por el valor del registro bancario; conservar los requisitos de jornada y apertura existentes.

En pantalla, cambiar de efectivo a transferencia oculta el desglose físico y solicita banco/referencia. Volver a efectivo limpia los datos bancarios para evitar enviarlos por accidente. El recibo indica la vía usada; la suma total de compras y sus desgloses efectivo/bancario deben coincidir. El precio por gramo y el total de compra no cambian al elegir el medio de pago.

En anulación: distinguir cancelar un borrador de devolver una compra pagada. Exigir devolución identificada de piezas y evidencia del dinero recuperado; conservar historial. No acreditar caja ni simular una devolución bancaria solo por pulsar «anular».

## Consultas para dirección

Compras por fecha, punto y operador; dinero pagado; gramos netos por metal y pureza; piezas/sobres recibidos; precio promedio ponderado por categoría homogénea; pagos pendientes y anulaciones. El precio histórico de una compra queda congelado. Este alcance no calcula utilidad de venta ni incorpora movimientos de salida de los metales.

## Datos y comprobantes en Ecuador

UAFE incluye a negociadores de joyas, metales y piedras preciosas entre los sujetos obligados. La aplicabilidad concreta y los datos/reportes exigibles a esta empresa deben revisarse con su responsable de cumplimiento; el diseño debe permitir identificación del vendedor, procedencia, evidencia y consulta por operación. [Fuente: UAFE](https://www.uafe.gob.ec/sujetos-obligados/).

El comprobante interno del sistema no se presenta como documento tributario autorizado. Contabilidad debe definir el comprobante fiscal, retenciones e impuestos aplicables antes de cerrar la integración de pago. No se copian porcentajes de consultas históricas del SRI como tarifas actuales ni se confunde compra de joyas usadas con operación minera.

## Implementación y pruebas

Introducir esquema, cálculo y API detrás de habilitación por punto; después formulario, comprobante e integración de caja; finalmente piloto local y despliegue controlado. Migraciones aditivas, sin transformar saldos de divisas existentes. Ningún punto se habilita automáticamente.

Probar: oro/plata, distintas purezas en una compra, descuentos de peso, peso neto inválido, precisión de gramos y precios, redondeo de varias líneas, pureza inconclusa, precio libre válido, punto no habilitado, jornada ausente, apertura pendiente, efectivo insuficiente, desglose inconsistente, doble confirmación, fallo al persistir recibo, reverso autorizado y reportes sin duplicaciones. Para transferencia: banco/referencia obligatorios, comprobante opcional, pago con caja física en cero, registro bancario negativo permitido, efectivo/desglose intactos y ausencia de duplicación en reintentos. El piloto debe comprobar también cambio de vía en el formulario, identificación física de piezas y reimpresión.
