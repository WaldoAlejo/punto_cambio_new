-- Only new openings explicitly marked apertura_por_etapas are affected.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION enforce_staged_opening_count() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  opening RECORD;
  expected JSONB;
  counted JSONB;
  tolerance NUMERIC;
  incident_allowed BOOLEAN := false;
  incident JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.cantidad IS NOT DISTINCT FROM OLD.cantidad
       AND NEW.billetes IS NOT DISTINCT FROM OLD.billetes
       AND NEW.monedas_fisicas IS NOT DISTINCT FROM OLD.monedas_fisicas THEN
      RETURN NEW;
    END IF;
  ELSE
    IF NEW.cantidad = 0 AND NEW.billetes = 0 AND NEW.monedas_fisicas = 0 THEN RETURN NEW; END IF;
  END IF;
  SELECT a.* INTO opening FROM "AperturaCaja" a JOIN "Jornada" j ON j.id = a.jornada_id
  WHERE a.punto_atencion_id = NEW.punto_atencion_id
    AND j.estado IN ('ACTIVO', 'ALMUERZO') AND j.fecha_salida IS NULL
    AND a.saldo_esperado::jsonb @> '[{"apertura_por_etapas":true}]'
  ORDER BY a.hora_inicio_conteo DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT value INTO expected FROM jsonb_array_elements(opening.saldo_esperado::jsonb)
    WHERE value->>'moneda_id' = NEW.moneda_id LIMIT 1;
  SELECT value INTO counted FROM jsonb_array_elements(COALESCE(opening.conteo_fisico::jsonb, '[]'))
    WHERE value->>'moneda_id' = NEW.moneda_id LIMIT 1;
  tolerance := CASE WHEN expected->>'codigo' = 'USD' THEN opening.tolerancia_usd ELSE opening.tolerancia_otras END;
  IF opening.metodo_verificacion IN ('INCIDENCIA_OPERADOR', 'INCIDENCIA_APROBADA') AND expected->>'obligatoria_inicio' = 'true' THEN
    BEGIN
      incident := split_part(split_part(opening.observaciones_operador, '[INCIDENCIA_APERTURA]', 2), '[/INCIDENCIA_APERTURA]', 1)::jsonb;
      incident_allowed := COALESCE((incident->'monedas_afectadas') ? (expected->>'codigo'), false);
    EXCEPTION WHEN OTHERS THEN incident_allowed := false;
    END;
  END IF;
  IF opening.estado <> 'ABIERTA' OR expected IS NULL OR counted IS NULL
     OR counted->>'total' IS NULL
     OR (abs((counted->>'total')::numeric - (expected->>'cantidad')::numeric) > tolerance AND NOT incident_allowed) THEN
    RAISE EXCEPTION 'PENDING_CURRENCY_COUNT: complete el conteo de la divisa en Apertura de Caja antes de mover efectivo';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER staged_opening_cash_guard
BEFORE INSERT OR UPDATE OF cantidad, billetes, monedas_fisicas ON "Saldo"
FOR EACH ROW EXECUTE FUNCTION enforce_staged_opening_count();

CREATE OR REPLACE FUNCTION enforce_staged_opening_before_close() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE opening RECORD;
BEGIN
  IF NEW.estado = OLD.estado AND NEW.fecha_salida IS NOT DISTINCT FROM OLD.fecha_salida
     AND NEW.punto_atencion_id = OLD.punto_atencion_id THEN RETURN NEW; END IF;
  IF NEW.estado NOT IN ('COMPLETADO', 'CANCELADO') AND NEW.fecha_salida IS NULL
     AND NEW.punto_atencion_id = OLD.punto_atencion_id THEN RETURN NEW; END IF;
  SELECT a.* INTO opening FROM "AperturaCaja" a WHERE a.jornada_id = OLD.id
    AND a.saldo_esperado::jsonb @> '[{"apertura_por_etapas":true}]';
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM "Saldo" s WHERE s.punto_atencion_id = OLD.punto_atencion_id AND s.cantidad <> 0
    AND (opening.estado <> 'ABIERTA' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(opening.conteo_fisico::jsonb, '[]')) c
      WHERE c->>'moneda_id' = s.moneda_id AND c->>'total' IS NOT NULL
    ))) THEN
    RAISE EXCEPTION 'PENDING_CURRENCY_COUNT: complete las divisas pendientes con existencia fisica antes de cerrar la jornada';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER staged_opening_close_guard
BEFORE UPDATE OF estado, fecha_salida, punto_atencion_id ON "Jornada"
FOR EACH ROW EXECUTE FUNCTION enforce_staged_opening_before_close();
COMMIT;
