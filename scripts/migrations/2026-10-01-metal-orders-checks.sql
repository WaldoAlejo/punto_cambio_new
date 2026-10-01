-- Run after 2026-10-01-metal-orders.sql, in the same deployment transaction.
ALTER TABLE "OrdenEvaluacionMetal" ADD CONSTRAINT "OrdenEvaluacionMetal_values_check" CHECK (
  estado IN ('PENDIENTE_AUTORIZACION','AUTORIZADA','EVALUADA','COMPRADA','DEVUELTA','ANULADA') AND
  anio >= 2026 AND secuencia > 0 AND (oferta_total IS NULL OR oferta_total > 0) AND
  (estado = 'PENDIENTE_AUTORIZACION' OR estado = 'ANULADA' OR (autorizacion_foto IS NOT NULL AND autorizada_en IS NOT NULL)) AND
  (estado NOT IN ('EVALUADA','COMPRADA') OR (oferta_total IS NOT NULL AND moneda_id IS NOT NULL AND evaluada_en IS NOT NULL))
);
ALTER TABLE "JoyaOrdenEvaluacion" ADD CONSTRAINT "JoyaOrdenEvaluacion_values_check" CHECK (
  posicion > 0 AND piezas > 0 AND peso_recibido > 0 AND
  (metal IS NULL OR metal IN ('ORO','PLATA')) AND (metodo IS NULL OR metodo IN ('ACIDO','XRF','OTRO')) AND
  (pureza IS NULL OR (pureza > 0 AND pureza <= 1000)) AND (deducciones IS NULL OR deducciones >= 0) AND
  (peso_final IS NULL OR (peso_final > 0 AND peso_final = peso_recibido - deducciones)) AND
  (subtotal IS NULL OR subtotal > 0)
);
