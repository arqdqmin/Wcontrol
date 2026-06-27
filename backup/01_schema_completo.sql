-- ============================================================
-- WCONTROL — RESPALDO COMPLETO DE SCHEMA
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Proyecto: zkqtcdxhwtonkrluvkbj
-- Fecha respaldo: 2026-06-26
-- ============================================================
-- Este script NO modifica datos. Solo consulta.
-- Copia el resultado de cada sección y guárdalo.
-- ============================================================


-- ============================================================
-- SECCIÓN 1: COLUMNAS DE TODAS LAS TABLAS (public)
-- ============================================================
SELECT
  t.table_name,
  c.ordinal_position  AS pos,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.character_maximum_length,
  c.column_default,
  c.is_nullable,
  c.is_identity,
  c.identity_generation
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;


-- ============================================================
-- SECCIÓN 2: CONSTRAINTS (PK, FK, UNIQUE, CHECK)
-- ============================================================
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name  AS foreign_table,
  ccu.column_name AS foreign_column,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = rc.unique_constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;


-- ============================================================
-- SECCIÓN 3: ÍNDICES
-- ============================================================
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- ============================================================
-- SECCIÓN 4: TRIGGERS
-- ============================================================
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement,
  action_orientation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;


-- ============================================================
-- SECCIÓN 5: FUNCIONES SQL PERSONALIZADAS (schema public)
-- ============================================================
SELECT
  p.proname                            AS function_name,
  pg_get_function_arguments(p.oid)    AS arguments,
  pg_get_function_result(p.oid)       AS return_type,
  pg_get_functiondef(p.oid)           AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;


-- ============================================================
-- SECCIÓN 6: POLÍTICAS RLS (Row Level Security)
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual         AS using_expression,
  with_check   AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ============================================================
-- SECCIÓN 7: ESTADO RLS POR TABLA (habilitado / deshabilitado)
-- ============================================================
SELECT
  relname   AS table_name,
  relrowsecurity   AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
ORDER BY relname;


-- ============================================================
-- SECCIÓN 8: STORAGE — buckets existentes
-- ============================================================
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
ORDER BY name;


-- ============================================================
-- SECCIÓN 9: STORAGE — listado de todos los archivos
-- ============================================================
SELECT
  bucket_id,
  name,
  metadata,
  created_at,
  updated_at
FROM storage.objects
WHERE bucket_id IN ('contratos', 'logos')
ORDER BY bucket_id, name;


-- ============================================================
-- SECCIÓN 10: USUARIOS AUTH (requiere service_role o Dashboard)
-- ============================================================
-- Si tienes acceso al schema auth:
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at;
