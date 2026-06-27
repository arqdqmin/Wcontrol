-- ============================================================
-- WCONTROL → WIZARD PLATFORM
-- Script de creación de tablas para restaurar en el nuevo proyecto
-- Ejecutar en: Wizard Platform > SQL Editor
-- ============================================================
-- IMPORTANTE: Ajusta los tipos según lo que confirmes en el paso
-- 01_schema_completo.sql (especialmente si id es uuid o bigint).
-- Este script asume uuid (tipo habitual en Supabase).
-- ============================================================


-- ============================================================
-- EXTENSIONES necesarias
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- TABLA: empresa
-- ============================================================
CREATE TABLE IF NOT EXISTS public.empresa (
  id            integer PRIMARY KEY,
  rut           text,
  nombre        text,
  direccion     text,
  logo_path     text,
  logo_url      text,
  updated_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE public.empresa IS 'Fila única con los datos de la empresa (id=1 siempre)';


-- ============================================================
-- TABLA: trabajadores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trabajadores (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre             text NOT NULL,
  rut                text,
  cargo              text,
  centro_negocio     text,
  tipo_contrato      text DEFAULT 'PLAZO FIJO',
  fecha_inicio       date,
  fecha_fin          date,
  indefinido         boolean DEFAULT false,
  domicilio          text,
  telefono           text,
  correo             text,
  banco              text,
  tipo_cuenta        text,
  numero_cuenta      text,
  sueldo_base        numeric DEFAULT 0,
  afp                text,
  tasa_afp           numeric DEFAULT 10.46,
  afp_adicional      numeric DEFAULT 0,
  institucion_salud  text DEFAULT 'FONASA',
  plan_salud         numeric DEFAULT 7,
  dias_laborales     text DEFAULT 'lunes-viernes',
  hrs_semana         numeric DEFAULT 44,
  horario_semana     jsonb,
  contrato_path      text,
  contrato_nombre    text,
  activo             boolean DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

COMMENT ON TABLE public.trabajadores IS 'Registro de trabajadores de la empresa';


-- ============================================================
-- TABLA: asistencia_mensual
-- ============================================================
CREATE TABLE IF NOT EXISTS public.asistencia_mensual (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trabajador_id   uuid NOT NULL REFERENCES public.trabajadores(id) ON DELETE CASCADE,
  anio            integer NOT NULL,
  mes             integer NOT NULL CHECK (mes BETWEEN 0 AND 11),
  dias_data       jsonb NOT NULL DEFAULT '[]',
  resumen         jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  CONSTRAINT uq_asistencia_trabajador_mes UNIQUE (trabajador_id, anio, mes)
);

COMMENT ON TABLE public.asistencia_mensual IS 'Registro diario de asistencia por trabajador y mes';


-- ============================================================
-- TABLA: liquidaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS public.liquidaciones (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trabajador_id   uuid NOT NULL REFERENCES public.trabajadores(id) ON DELETE CASCADE,
  anio            integer NOT NULL,
  mes             integer NOT NULL CHECK (mes BETWEEN 0 AND 11),
  datos           jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  CONSTRAINT uq_liquidacion_trabajador_mes UNIQUE (trabajador_id, anio, mes)
);

COMMENT ON TABLE public.liquidaciones IS 'Liquidaciones de sueldo mensuales por trabajador';


-- ============================================================
-- ÍNDICES adicionales de rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_trabajadores_activo    ON public.trabajadores (activo);
CREATE INDEX IF NOT EXISTS idx_asistencia_trabajador  ON public.asistencia_mensual (trabajador_id, anio, mes);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_trabajador ON public.liquidaciones (trabajador_id, anio, mes);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Habilitar RLS en todas las tablas
ALTER TABLE public.empresa           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trabajadores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_mensual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidaciones     ENABLE ROW LEVEL SECURITY;

-- Política: solo usuarios autenticados pueden acceder
-- (replica el modelo de Wcontrol donde solo hay un usuario admin)

CREATE POLICY "Autenticados leen empresa"
  ON public.empresa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados editan empresa"
  ON public.empresa FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen trabajadores"
  ON public.trabajadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados editan trabajadores"
  ON public.trabajadores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen asistencia"
  ON public.asistencia_mensual FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados editan asistencia"
  ON public.asistencia_mensual FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen liquidaciones"
  ON public.liquidaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados editan liquidaciones"
  ON public.liquidaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- STORAGE — buckets
-- ============================================================
-- Ejecutar esto solo si el bucket no existe aún en Wizard Platform
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('contratos', 'contratos', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png']),
  ('logos',     'logos',     true,  5242880,  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para contratos (privado, solo autenticados)
CREATE POLICY "Autenticados leen contratos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contratos');
CREATE POLICY "Autenticados suben contratos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratos');
CREATE POLICY "Autenticados eliminan contratos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contratos');

-- Políticas de storage para logos (público para lectura)
CREATE POLICY "Publico lee logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'logos');
CREATE POLICY "Autenticados suben logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Autenticados eliminan logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos');


-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
SELECT table_name, (SELECT COUNT(*) FROM information_schema.columns c
  WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS columnas
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
