// ============================================================
// WCONTROL → WIZARD PLATFORM
// Script para RE-SUBIR los archivos de Storage al nuevo proyecto
// Ejecutar con: node 06_subir_storage_wizard.js
// Requiere: npm install @supabase/supabase-js
// ============================================================
// PREREQUISITO: haber ejecutado 04_descargar_storage.js primero.
// PREREQUISITO: haber creado los buckets en Wizard Platform
//               con el script 03_schema_create_para_wizard.sql.
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ── Credenciales Wizard Platform (proyecto DESTINO) ──────────
const WIZARD_URL          = 'PEGA_AQUI_URL_DE_WIZARD_PLATFORM';
const WIZARD_SERVICE_KEY  = 'PEGA_AQUI_SERVICE_ROLE_KEY_DE_WIZARD';

const sb = createClient(WIZARD_URL, WIZARD_SERVICE_KEY, {
  auth: { persistSession: false }
});

const STORAGE_BACKUP = path.join(__dirname, 'storage_backup');
const BUCKETS = ['contratos', 'logos'];

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.pdf':  'application/pdf',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.webp': 'image/webp',
    '.svg':  'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}

function getAllFiles(dir, base = '') {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const relPath  = base ? `${base}/${item}` : item;
    if (fs.statSync(fullPath).isDirectory()) {
      results.push(...getAllFiles(fullPath, relPath));
    } else {
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

async function main() {
  console.log('=== WCONTROL → WIZARD PLATFORM — Restaurar Storage ===\n');

  // Leer manifiesto del respaldo
  const manifestPath = path.join(STORAGE_BACKUP, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ No se encontró manifest.json. Ejecuta primero 04_descargar_storage.js');
    process.exit(1);
  }

  let totalOk = 0;
  let totalErr = 0;

  for (const bucket of BUCKETS) {
    const bucketDir = path.join(STORAGE_BACKUP, bucket);
    const archivos  = getAllFiles(bucketDir);
    console.log(`\n📂 Subiendo a bucket: ${bucket} (${archivos.length} archivos)`);

    for (const { fullPath, relPath } of archivos) {
      const fileBuffer  = fs.readFileSync(fullPath);
      const contentType = getMimeType(fullPath);

      const { error } = await sb.storage.from(bucket).upload(relPath, fileBuffer, {
        contentType,
        upsert: true,
      });

      if (error) {
        console.error(`  ❌ ${relPath}: ${error.message}`);
        totalErr++;
      } else {
        console.log(`  ✓ ${relPath}`);
        totalOk++;
      }
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`  Archivos subidos : ${totalOk}`);
  console.log(`  Errores          : ${totalErr}`);
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
