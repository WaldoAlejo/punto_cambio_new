-- Additive: structured gold/silver recognition checklist per purchased piece.
-- Nullable so purchases registered before this change stay valid unchanged.
ALTER TABLE "DetalleCompraMetal" ADD COLUMN IF NOT EXISTS "evaluacion" JSONB;
