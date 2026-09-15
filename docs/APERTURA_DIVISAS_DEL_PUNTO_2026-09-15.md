# Apertura: nombres completos y divisas del punto

Los títulos, botones y avisos locales de apertura muestran el nombre de la divisa del catálogo, en lugar de sus siglas. Los códigos internos se conservan para los cálculos y requisitos.

La lista de pendientes de apertura por etapas muestra por defecto divisas con saldo o historial del punto: movimientos de importe distinto de cero, asignaciones iniciales con importe, cambios y transferencias de origen/destino. Un registro de saldo o asignación inicial en cero, sin otra actividad, no incluye la divisa. Se conserva el historial aunque su saldo actual sea cero.

También se conservan las divisas obligatorias de la apertura y los conteos registrados. Dólar estadounidense y euro siguen siendo obligatorios por la política vigente, incluso sin actividad. No se modifican los requisitos de apertura ni el bloqueo de operaciones con divisas sin contar.

El botón «Contar una divisa recibida por primera vez» permite mostrar las restantes cuando sean necesarias. Se conservan en la instantánea de apertura para poder contarlas sin modificar saldos ni eliminar evidencia histórica. Las aperturas antiguas sin modalidad por etapas mantienen su política de conteo completo. Si el backend no incorpora el filtro, el frontend conserva la lista completa por compatibilidad.

## Verificación y despliegue

Integración local: inclusión de saldo, historial con saldo cero, exclusión de filas sin actividad y actividad de otros puntos, y filtro al recuperar una apertura existente. Regresiones frontend: nombres, filtro, obligatoriedad, conteos registrados, saldo mínimo y acceso a otras divisas.

320 pruebas de integración y 11 regresiones frontend aprobadas. TypeScript de frontend/backend y build de Vite correctos. No se ejecutaron consultas ni cambios en producción ni pruebas visuales en navegador.

Desplegar frontend y backend juntos. No requiere migración SQL. Para jornadas abiertas, actualizar la pantalla de apertura para recuperar el filtro.
