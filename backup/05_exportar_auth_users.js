// ============================================================
// WCONTROL — Exportar usuarios de Auth
// Ejecutar con: node 05_exportar_auth_users.js
// Requiere: npm install @supabase/supabase-js
// ============================================================
// Usa la Admin API con service_role key para listar todos
// los usuarios registrados en Supabase Auth.
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL     = 'https://zkqtcdxhwtonkrluvkbj.supabase.co';
const SERVICE_ROLE_KEY = 'PEGA_AQUI_TU_SERVICE_ROLE_KEY';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  console.log('=== WCONTROL — Export de usuarios Auth ===\n');

  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error('Error al obtener usuarios:', error.message);
    process.exit(1);
  }

  const usuarios = data.users.map(u => ({
    id:                  u.id,
    email:               u.email,
    email_confirmed_at:  u.email_confirmed_at,
    created_at:          u.created_at,
    last_sign_in_at:     u.last_sign_in_at,
    role:                u.role,
    user_metadata:       u.user_metadata,
    app_metadata:        u.app_metadata,
  }));

  const outputPath = path.join(__dirname, 'auth_users_backup.json');
  fs.writeFileSync(outputPath, JSON.stringify(usuarios, null, 2), 'utf8');

  console.log(`Usuarios exportados: ${usuarios.length}`);
  usuarios.forEach(u => console.log(`  - ${u.email} (${u.id})`));
  console.log(`\nGuardado en: ${outputPath}`);
  console.log('\n⚠️  NOTA: Las contraseñas NO se pueden exportar (hash interno de Supabase).');
  console.log('    Los usuarios deberán recibir un correo de restablecimiento de contraseña');
  console.log('    o ser recreados manualmente en Wizard Platform.');
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
