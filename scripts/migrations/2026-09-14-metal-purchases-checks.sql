-- Run after the additive metal purchase schema, in the same deployment transaction.
ALTER TABLE "CompraMetal" ADD CONSTRAINT "CompraMetal_payment_check" CHECK (
  total > 0 AND billetes >= 0 AND monedas >= 0 AND estado IN ('PAGADA','REVERSADA') AND
  ((medio_pago = 'EFECTIVO' AND billetes + monedas = total AND banco IS NULL AND referencia IS NULL AND comprobante IS NULL)
   OR (medio_pago = 'TRANSFERENCIA' AND billetes = 0 AND monedas = 0 AND length(trim(banco)) > 0 AND banco IS NOT NULL AND length(trim(referencia)) > 0 AND referencia IS NOT NULL))
);
ALTER TABLE "DetalleCompraMetal" ADD CONSTRAINT "DetalleCompraMetal_values_check" CHECK (
  metal IN ('ORO','PLATA') AND piezas > 0 AND peso_bruto > 0 AND deducciones >= 0 AND
  peso_neto = peso_bruto - deducciones AND peso_neto > 0 AND pureza > 0 AND pureza <= 1000 AND
  precio_gramo > 0 AND subtotal = round(peso_neto * precio_gramo, 2) AND subtotal > 0 AND
  gramos_finos = round(peso_neto * pureza / 1000, 6) AND metodo IN ('ACIDO','XRF','OTRO')
);
