# Wcontrol → Wizard Platform
## Plan completo de respaldo y restauración

**Proyecto origen:** `zkqtcdxhwtonkrluvkbj` (Wcontrol)  
**Fecha:** 2026-06-26  
**Estado:** ⏳ Pendiente de ejecución

---

## Lo que existe en Wcontrol

| Componente | Detalle |
|---|---|
| Tablas | `empresa`, `trabajadores`, `asistencia_mensual`, `liquidaciones` |
| Storage | Buckets `contratos` (privado) y `logos` (público) |
| Auth | Usuario(s) con email/password |
| RLS | Habilitado en todas las tablas (solo autenticados) |
| Funciones SQL | Por confirmar en paso 1 |

---

## FASE 1 — RESPALDO (no eliminar nada hasta verificar)

### Paso 1 · Verificar schema y volumen de datos

1. Abrir **Supabase Dashboard** → proyecto Wcontrol → **SQL Editor**
2. Pegar y ejecutar **`01_schema_completo.sql`**
3. Copiar y guardar el resultado en un archivo local `schema_resultado.txt`
4. **Verificar especialmente:**
   - Tipo de columna `id` en `trabajadores` (¿`uuid` o `bigint`?)
   - Si hay triggers o funciones SQL personalizadas (sección 5 del script)
   - Conteo de filas en la sección 10 (verificación final)

### Paso 2 · Obtener la Service Role Key

1. Dashboard Wcontrol → **Settings → API**
2. Copiar **`service_role` (secret)** — **NO compartir, tiene permisos totales**
3. La necesitas para los pasos 3 y 4

### Paso 3 · Descargar archivos de Storage

```bash
cd F:\Proyectos\Wcontrol\backup
npm install @supabase/supabase-js
```

Editar `04_descargar_storage.js`:
```js
const SERVICE_ROLE_KEY = 'tu-service-role-key-aqui';
```

Ejecutar:
```bash
node 04_descargar_storage.js
```

✅ Verifica que `storage_backup/` tenga todos los contratos y el logo.

### Paso 4 · Exportar usuarios Auth

```bash
node 05_exportar_auth_users.js
```

✅ Verifica que `auth_users_backup.json` liste todos los emails.

> ⚠️ Las contraseñas **no se pueden exportar**. Los usuarios deberán
> hacer "Olvidé mi contraseña" en Wizard Platform o ser recreados manualmente.

### Paso 5 · Exportar datos de tablas

1. SQL Editor de Wcontrol → pegar **`02_export_datos_insert.sql`**
2. Ejecutar **sección por sección** (empresa, trabajadores, asistencia, liquidaciones)
3. Copiar el resultado de cada sección y guardar como:
   - `data_empresa.sql`
   - `data_trabajadores.sql`
   - `data_asistencia_mensual.sql`
   - `data_liquidaciones.sql`

✅ Verificación: la última consulta del script muestra el conteo total de filas.

### Checklist de respaldo completo

- [ ] `schema_resultado.txt` guardado y revisado
- [ ] `auth_users_backup.json` con todos los usuarios
- [ ] `storage_backup/contratos/` con todos los archivos PDF
- [ ] `storage_backup/logos/` con el logo de la empresa
- [ ] `data_empresa.sql` con sentencias INSERT
- [ ] `data_trabajadores.sql` con sentencias INSERT
- [ ] `data_asistencia_mensual.sql` con sentencias INSERT
- [ ] `data_liquidaciones.sql` con sentencias INSERT

---

## FASE 2 — RESTAURACIÓN EN WIZARD PLATFORM

> Solo proceder cuando **todos** los ítems del checklist estén ✅

### Paso 6 · Crear las tablas en Wizard Platform

1. Abrir **Supabase Dashboard** → proyecto Wizard Platform → **SQL Editor**
2. Pegar y ejecutar **`03_schema_create_para_wizard.sql`**
3. Si hay diferencias en el tipo de `id` (confirmado en Paso 1),
   ajustar el script antes de ejecutar

### Paso 7 · Importar los datos

En el SQL Editor de **Wizard Platform**, ejecutar en orden:
1. `data_empresa.sql`
2. `data_trabajadores.sql`
3. `data_asistencia_mensual.sql`
4. `data_liquidaciones.sql`

Verificar conteos:
```sql
SELECT 'empresa'           AS t, COUNT(*) FROM empresa
UNION ALL SELECT 'trabajadores',       COUNT(*) FROM trabajadores
UNION ALL SELECT 'asistencia_mensual', COUNT(*) FROM asistencia_mensual
UNION ALL SELECT 'liquidaciones',      COUNT(*) FROM liquidaciones;
```

### Paso 8 · Re-subir archivos de Storage

Editar `06_subir_storage_wizard.js`:
```js
const WIZARD_URL         = 'https://TU-PROYECTO.supabase.co';
const WIZARD_SERVICE_KEY = 'tu-service-role-key-de-wizard';
```

Ejecutar:
```bash
node 06_subir_storage_wizard.js
```

### Paso 9 · Recrear usuarios Auth

Para cada usuario en `auth_users_backup.json`:

**Opción A (recomendada):** Crear el usuario en Wizard Platform con la misma
contraseña si la conoces:

```
Dashboard → Authentication → Users → Invite user
```

**Opción B:** Crear el usuario y enviar correo de restablecimiento:
- Dashboard → Authentication → Users → Add user → Send confirmation email

### Paso 10 · Actualizar config.js en el código

Reemplazar en el proyecto las credenciales que apunten a Wizard Platform:

```js
// config.js
const SUPABASE_URL     = 'https://TU-NUEVO-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'tu-nueva-anon-key';
```

### Paso 11 · Verificación final antes de borrar Wcontrol

- [ ] Todas las tablas tienen el mismo conteo de filas
- [ ] Los archivos de contratos son accesibles (probar "Ver contrato" en la app)
- [ ] El logo de la empresa se muestra correctamente
- [ ] El login funciona con los usuarios migrados
- [ ] La liquidación de al menos un trabajador carga correctamente
- [ ] La asistencia de al menos un mes carga correctamente

---

## FASE 3 — ELIMINACIÓN DE WCONTROL

Solo después de aprobar **todos** los ítems de la Fase 2:

1. Dashboard Wcontrol → **Settings → General**
2. Scroll hasta el final → **"Delete project"**
3. Escribir el nombre del proyecto para confirmar

> ✅ El respaldo en `F:\Proyectos\Wcontrol\backup\` queda como archivo
> histórico aunque elimines el proyecto de Supabase.

---

## Notas técnicas importantes

### IDs de trabajadores en Storage
Los contratos se guardan en paths `{trabajador_id}/contrato_*.pdf`.
Si los IDs son UUID, se preservan exactamente al hacer INSERT con `ON CONFLICT`.
Si los IDs cambian, los `contrato_path` en la tabla `trabajadores` quedarán
apuntando a rutas incorrectas — en ese caso, re-subir con los nuevos IDs.

### URLs públicas de logos
`logo_url` almacena la URL pública del bucket `logos` de Wcontrol.
Después de migrar, ejecutar este UPDATE para corregir las URLs:
```sql
UPDATE empresa
SET logo_url = REPLACE(
  logo_url,
  'https://zkqtcdxhwtonkrluvkbj.supabase.co',
  'https://TU-NUEVO-PROYECTO.supabase.co'
)
WHERE logo_url IS NOT NULL;
```

### Contraseñas de usuarios
Supabase nunca expone los hashes de contraseñas por seguridad.
Los usuarios necesitarán usar "Olvidé mi contraseña" o ser contactados
para establecer una nueva contraseña en Wizard Platform.
