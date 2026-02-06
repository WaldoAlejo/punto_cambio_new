-- Hardening constraints (safe mode): all constraints are added as NOT VALID
-- so they do NOT scan historical rows on creation.
--
-- After running the fix scripts and validating with validate-all, you can validate them with:
--   ALTER TABLE "Saldo" VALIDATE CONSTRAINT "saldo_breakdown_caja_matches";
--   ALTER TABLE "ServicioExternoSaldo" VALIDATE CONSTRAINT "servicioexternosaldo_cantidad_matches";
--   ALTER TABLE "ServicioExternoMovimiento" VALIDATE CONSTRAINT "servicioexternomovimiento_metodo_matches";

/* =====================
 * Saldo
 * ===================== */
DO $$
BEGIN
  ALTER TABLE "Saldo"
    ADD CONSTRAINT "saldo_breakdown_nonnegative"
    CHECK (
      cantidad >= 0
      AND billetes >= 0
      AND monedas_fisicas >= 0
      AND bancos >= 0
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Saldo"
    ADD CONSTRAINT "saldo_breakdown_caja_matches"
    CHECK (cantidad = (billetes + monedas_fisicas)) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

/* =====================
 * ServicioExternoSaldo
 * ===================== */
DO $$
BEGIN
  ALTER TABLE "ServicioExternoSaldo"
    ADD CONSTRAINT "servicioexternosaldo_components_nonnegative"
    CHECK (
      cantidad >= 0
      AND billetes >= 0
      AND monedas_fisicas >= 0
      AND bancos >= 0
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ServicioExternoSaldo"
    ADD CONSTRAINT "servicioexternosaldo_cantidad_matches"
    CHECK (cantidad = (billetes + monedas_fisicas + bancos)) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

/* =====================
 * ServicioExternoMovimiento
 * ===================== */
DO $$
BEGIN
  ALTER TABLE "ServicioExternoMovimiento"
    ADD CONSTRAINT "servicioexternomovimiento_components_nonnegative"
    CHECK (
      COALESCE(billetes, 0) >= 0
      AND COALESCE(monedas_fisicas, 0) >= 0
      AND COALESCE(bancos, 0) >= 0
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ServicioExternoMovimiento"
    ADD CONSTRAINT "servicioexternomovimiento_metodo_matches"
    CHECK (
      CASE
        WHEN metodo_ingreso = 'EFECTIVO' THEN
          COALESCE(bancos, 0) = 0
          AND (COALESCE(billetes, 0) + COALESCE(monedas_fisicas, 0)) = monto
        WHEN metodo_ingreso = 'BANCO' THEN
          COALESCE(billetes, 0) = 0
          AND COALESCE(monedas_fisicas, 0) = 0
          AND COALESCE(bancos, 0) = monto
        WHEN metodo_ingreso = 'MIXTO' THEN
          (COALESCE(billetes, 0) + COALESCE(monedas_fisicas, 0) + COALESCE(bancos, 0)) = monto
        ELSE
          true
      END
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
