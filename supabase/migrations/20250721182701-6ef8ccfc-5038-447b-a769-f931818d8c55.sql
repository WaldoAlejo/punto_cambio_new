-- Crear tabla para saldos iniciales por punto de atención
CREATE TABLE public.SaldoInicial (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  punto_atencion_id UUID NOT NULL REFERENCES public.PuntoAtencion(id) ON DELETE CASCADE,
  moneda_id UUID NOT NULL REFERENCES public.Moneda(id) ON DELETE CASCADE,
  cantidad_inicial NUMERIC NOT NULL DEFAULT 0,
  fecha_asignacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  asignado_por UUID NOT NULL REFERENCES public.Usuario(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(punto_atencion_id, moneda_id, activo) DEFERRABLE INITIALLY DEFERRED
);

-- Crear índices para mejorar rendimiento
CREATE INDEX idx_saldo_inicial_punto ON public.SaldoInicial(punto_atencion_id);
CREATE INDEX idx_saldo_inicial_moneda ON public.SaldoInicial(punto_atencion_id, moneda_id);
CREATE INDEX idx_saldo_inicial_activo ON public.SaldoInicial(activo) WHERE activo = true;

-- Crear tabla para movimientos de saldo detallados
CREATE TABLE public.MovimientoSaldo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  punto_atencion_id UUID NOT NULL REFERENCES public.PuntoAtencion(id) ON DELETE CASCADE,
  moneda_id UUID NOT NULL REFERENCES public.Moneda(id) ON DELETE CASCADE,
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('VENTA', 'COMPRA', 'TRANSFERENCIA_ENTRADA', 'TRANSFERENCIA_SALIDA', 'AJUSTE', 'SALDO_INICIAL')),
  monto NUMERIC NOT NULL,
  saldo_anterior NUMERIC NOT NULL,
  saldo_nuevo NUMERIC NOT NULL,
  usuario_id UUID NOT NULL REFERENCES public.Usuario(id),
  referencia_id UUID, -- ID de la operación relacionada (CambioDivisa, Transferencia, etc.)
  tipo_referencia TEXT, -- 'CAMBIO_DIVISA', 'TRANSFERENCIA', 'AJUSTE_MANUAL'
  descripcion TEXT,
  fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear índices para MovimientoSaldo
CREATE INDEX idx_movimiento_saldo_punto ON public.MovimientoSaldo(punto_atencion_id);
CREATE INDEX idx_movimiento_saldo_moneda ON public.MovimientoSaldo(punto_atencion_id, moneda_id);
CREATE INDEX idx_movimiento_saldo_fecha ON public.MovimientoSaldo(fecha);
CREATE INDEX idx_movimiento_saldo_referencia ON public.MovimientoSaldo(referencia_id, tipo_referencia);

-- Crear vista para resumen de saldos por punto
CREATE OR REPLACE VIEW public.VistaSaldosPorPunto AS
SELECT 
  pa.id as punto_atencion_id,
  pa.nombre as punto_nombre,
  pa.ciudad,
  m.id as moneda_id,
  m.nombre as moneda_nombre,
  m.simbolo as moneda_simbolo,
  m.codigo as moneda_codigo,
  COALESCE(si.cantidad_inicial, 0) as saldo_inicial,
  COALESCE(s.cantidad, 0) as saldo_actual,
  COALESCE(s.billetes, 0) as billetes,
  COALESCE(s.monedas_fisicas, 0) as monedas_fisicas,
  (COALESCE(s.cantidad, 0) - COALESCE(si.cantidad_inicial, 0)) as diferencia,
  s.updated_at as ultima_actualizacion,
  si.fecha_asignacion as fecha_saldo_inicial
FROM public.PuntoAtencion pa
CROSS JOIN public.Moneda m
LEFT JOIN public.SaldoInicial si ON pa.id = si.punto_atencion_id AND m.id = si.moneda_id AND si.activo = true
LEFT JOIN public.Saldo s ON pa.id = s.punto_atencion_id AND m.id = s.moneda_id
WHERE pa.activo = true AND m.activo = true
ORDER BY pa.nombre, m.orden_display, m.nombre;

-- Función para registrar movimientos de saldo automáticamente
CREATE OR REPLACE FUNCTION public.registrar_movimiento_saldo()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo para actualizaciones donde cambió la cantidad
  IF TG_OP = 'UPDATE' AND OLD.cantidad IS DISTINCT FROM NEW.cantidad THEN
    INSERT INTO public.MovimientoSaldo (
      punto_atencion_id,
      moneda_id,
      tipo_movimiento,
      monto,
      saldo_anterior,
      saldo_nuevo,
      usuario_id,
      descripcion
    ) VALUES (
      NEW.punto_atencion_id,
      NEW.moneda_id,
      'AJUSTE',
      NEW.cantidad - OLD.cantidad,
      OLD.cantidad,
      NEW.cantidad,
      NEW.punto_atencion_id, -- Usar punto_atencion_id como fallback para usuario_id
      'Actualización automática de saldo'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para registrar movimientos automáticamente
CREATE TRIGGER trigger_registrar_movimiento_saldo
  AFTER UPDATE ON public.Saldo
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_movimiento_saldo();

-- Función para calcular saldo después de movimiento
CREATE OR REPLACE FUNCTION public.calcular_saldo_despues_movimiento(
  p_punto_atencion_id UUID,
  p_moneda_id UUID,
  p_monto NUMERIC,
  p_tipo_movimiento TEXT
) RETURNS NUMERIC AS $$
DECLARE
  saldo_actual NUMERIC;
  nuevo_saldo NUMERIC;
BEGIN
  -- Obtener saldo actual
  SELECT COALESCE(cantidad, 0) INTO saldo_actual
  FROM public.Saldo
  WHERE punto_atencion_id = p_punto_atencion_id AND moneda_id = p_moneda_id;
  
  -- Calcular nuevo saldo según tipo de movimiento
  CASE p_tipo_movimiento
    WHEN 'COMPRA', 'TRANSFERENCIA_ENTRADA' THEN
      nuevo_saldo := saldo_actual + p_monto;
    WHEN 'VENTA', 'TRANSFERENCIA_SALIDA' THEN
      nuevo_saldo := saldo_actual - p_monto;
    WHEN 'AJUSTE', 'SALDO_INICIAL' THEN
      nuevo_saldo := p_monto;
    ELSE
      nuevo_saldo := saldo_actual;
  END CASE;
  
  RETURN nuevo_saldo;
END;
$$ LANGUAGE plpgsql;

-- Crear función para obtener saldo con historial
CREATE OR REPLACE FUNCTION public.obtener_saldo_con_historial(
  p_punto_atencion_id UUID,
  p_moneda_id UUID
) RETURNS TABLE (
  saldo_inicial NUMERIC,
  saldo_actual NUMERIC,
  total_ventas NUMERIC,
  total_compras NUMERIC,
  total_transferencias_entrada NUMERIC,
  total_transferencias_salida NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(si.cantidad_inicial, 0) as saldo_inicial,
    COALESCE(s.cantidad, 0) as saldo_actual,
    COALESCE(SUM(CASE WHEN ms.tipo_movimiento = 'VENTA' THEN ABS(ms.monto) ELSE 0 END), 0) as total_ventas,
    COALESCE(SUM(CASE WHEN ms.tipo_movimiento = 'COMPRA' THEN ms.monto ELSE 0 END), 0) as total_compras,
    COALESCE(SUM(CASE WHEN ms.tipo_movimiento = 'TRANSFERENCIA_ENTRADA' THEN ms.monto ELSE 0 END), 0) as total_transferencias_entrada,
    COALESCE(SUM(CASE WHEN ms.tipo_movimiento = 'TRANSFERENCIA_SALIDA' THEN ABS(ms.monto) ELSE 0 END), 0) as total_transferencias_salida
  FROM public.PuntoAtencion pa
  CROSS JOIN public.Moneda m
  LEFT JOIN public.SaldoInicial si ON pa.id = si.punto_atencion_id AND m.id = si.moneda_id AND si.activo = true
  LEFT JOIN public.Saldo s ON pa.id = s.punto_atencion_id AND m.id = s.moneda_id
  LEFT JOIN public.MovimientoSaldo ms ON pa.id = ms.punto_atencion_id AND m.id = ms.moneda_id
  WHERE pa.id = p_punto_atencion_id AND m.id = p_moneda_id
  GROUP BY si.cantidad_inicial, s.cantidad;
END;
$$ LANGUAGE plpgsql;