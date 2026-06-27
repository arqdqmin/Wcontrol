-- ============================================================
-- WCONTROL — EXPORT DE DATOS COMO SENTENCIAS INSERT
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Proyecto: zkqtcdxhwtonkrluvkbj
-- Fecha respaldo: 2026-06-26
-- ============================================================
-- Genera sentencias INSERT listas para pegar en Wizard Platform.
-- Copia el resultado de cada bloque por separado.
-- ============================================================


-- ============================================================
-- TABLA: empresa
-- ============================================================
SELECT
  'INSERT INTO empresa (id, rut, nombre, direccion, logo_path, logo_url, updated_at) VALUES ('
  || id || ', '
  || quote_nullable(rut) || ', '
  || quote_nullable(nombre) || ', '
  || quote_nullable(direccion) || ', '
  || quote_nullable(logo_path) || ', '
  || quote_nullable(logo_url) || ', '
  || quote_literal(updated_at::text) || ') ON CONFLICT (id) DO UPDATE SET '
  || 'rut=EXCLUDED.rut, nombre=EXCLUDED.nombre, direccion=EXCLUDED.direccion, '
  || 'logo_path=EXCLUDED.logo_path, logo_url=EXCLUDED.logo_url, updated_at=EXCLUDED.updated_at;'
FROM empresa
ORDER BY id;


-- ============================================================
-- TABLA: trabajadores
-- ============================================================
SELECT
  'INSERT INTO trabajadores ('
  || 'id, nombre, rut, cargo, centro_negocio, tipo_contrato, '
  || 'fecha_inicio, fecha_fin, indefinido, domicilio, telefono, correo, '
  || 'banco, tipo_cuenta, numero_cuenta, sueldo_base, '
  || 'afp, tasa_afp, afp_adicional, institucion_salud, plan_salud, '
  || 'dias_laborales, hrs_semana, horario_semana, '
  || 'contrato_path, contrato_nombre, activo, updated_at'
  || ') VALUES ('
  || quote_literal(id::text) || ', '
  || quote_nullable(nombre) || ', '
  || quote_nullable(rut) || ', '
  || quote_nullable(cargo) || ', '
  || quote_nullable(centro_negocio) || ', '
  || quote_nullable(tipo_contrato) || ', '
  || quote_nullable(fecha_inicio::text) || ', '
  || quote_nullable(fecha_fin::text) || ', '
  || indefinido || ', '
  || quote_nullable(domicilio) || ', '
  || quote_nullable(telefono) || ', '
  || quote_nullable(correo) || ', '
  || quote_nullable(banco) || ', '
  || quote_nullable(tipo_cuenta) || ', '
  || quote_nullable(numero_cuenta) || ', '
  || COALESCE(sueldo_base, 0) || ', '
  || quote_nullable(afp) || ', '
  || COALESCE(tasa_afp, 0) || ', '
  || COALESCE(afp_adicional, 0) || ', '
  || quote_nullable(institucion_salud) || ', '
  || COALESCE(plan_salud, 0) || ', '
  || quote_nullable(dias_laborales) || ', '
  || COALESCE(hrs_semana, 0) || ', '
  || quote_nullable(horario_semana::text) || '::jsonb, '
  || quote_nullable(contrato_path) || ', '
  || quote_nullable(contrato_nombre) || ', '
  || COALESCE(activo, true) || ', '
  || quote_literal(updated_at::text)
  || ') ON CONFLICT (id) DO UPDATE SET '
  || 'nombre=EXCLUDED.nombre, rut=EXCLUDED.rut, cargo=EXCLUDED.cargo, activo=EXCLUDED.activo, '
  || 'sueldo_base=EXCLUDED.sueldo_base, updated_at=EXCLUDED.updated_at;'
FROM trabajadores
ORDER BY nombre;


-- ============================================================
-- TABLA: asistencia_mensual
-- ============================================================
SELECT
  'INSERT INTO asistencia_mensual ('
  || 'id, trabajador_id, anio, mes, dias_data, resumen, updated_at'
  || ') VALUES ('
  || quote_literal(id::text) || ', '
  || quote_literal(trabajador_id::text) || ', '
  || anio || ', '
  || mes || ', '
  || quote_literal(dias_data::text) || '::jsonb, '
  || quote_nullable(resumen::text) || '::jsonb, '
  || quote_literal(updated_at::text)
  || ') ON CONFLICT (trabajador_id, anio, mes) DO UPDATE SET '
  || 'dias_data=EXCLUDED.dias_data, resumen=EXCLUDED.resumen, updated_at=EXCLUDED.updated_at;'
FROM asistencia_mensual
ORDER BY trabajador_id, anio, mes;


-- ============================================================
-- TABLA: liquidaciones
-- ============================================================
SELECT
  'INSERT INTO liquidaciones ('
  || 'id, trabajador_id, anio, mes, datos, updated_at'
  || ') VALUES ('
  || quote_literal(id::text) || ', '
  || quote_literal(trabajador_id::text) || ', '
  || anio || ', '
  || mes || ', '
  || quote_literal(datos::text) || '::jsonb, '
  || quote_literal(updated_at::text)
  || ') ON CONFLICT (trabajador_id, anio, mes) DO UPDATE SET '
  || 'datos=EXCLUDED.datos, updated_at=EXCLUDED.updated_at;'
FROM liquidaciones
ORDER BY trabajador_id, anio, mes;


-- ============================================================
-- VERIFICACIÓN: conteo de filas respaldadas
-- ============================================================
SELECT 'empresa'           AS tabla, COUNT(*) AS filas FROM empresa
UNION ALL
SELECT 'trabajadores',       COUNT(*) FROM trabajadores
UNION ALL
SELECT 'asistencia_mensual', COUNT(*) FROM asistencia_mensual
UNION ALL
SELECT 'liquidaciones',      COUNT(*) FROM liquidaciones
UNION ALL
SELECT 'storage.objects',    COUNT(*) FROM storage.objects WHERE bucket_id IN ('contratos','logos')
UNION ALL
SELECT 'auth.users',         COUNT(*) FROM auth.users;
