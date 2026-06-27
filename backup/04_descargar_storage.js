// ============================================================
// WCONTROL — Script para descargar todos los archivos de Storage
// Ejecutar con: node 04_descargar_storage.js
// Requiere: npm install @supabase/supabase-js
// ============================================================
// Descarga todos los archivos de los buckets 'contratos' y 'logos'
// a una carpeta local ./storage_backup/
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Credenciales Wcontrol (proyecto origen) ──────────────────
// IMPORTANTE: usa la SERVICE ROLE KEY (no la anon key) para
// poder listar y descargar todos los archivos sin restricciones.
// La encuentras en: Supabase Dashboard > Settings > API > service_role
const SUPABASE_URL     = 'https://zkqtcdxhwtonkrluvkbj.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcXRjZHhod3RvbmtybHV2a2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTgzNTAzMSwiZXhwIjoyMDk3NDExMDMxfQ.u01YOr3Wcfj1VyLuNmuaxSx7a1AUdbm7kF4BwMPr0BY';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const BUCKETS       = ['contratos', 'logos'];
const OUTPUT_FOLDER = path.join(__dirname, 'storage_backup');

// ── Utilidades ────────────────────────────────────────────────
function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    mkdirp(path.dirname(destPath));
    const file = fs.createWriteStream(destPath);
    https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} para ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { fs.unlink(destPath, () => {}); reject(err); });
  });
}

async function listAllFiles(bucket, prefix = '') {
  const { data, error } = await sb.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
  });
  if (error) throw new Error(`Error listando ${bucket}/${prefix}: ${error.message}`);

  const files = [];
  for (const item of data || []) {
    if (item.id === null) {
      // Es una carpeta — recursión
      const sub = await listAllFiles(bucket, prefix ? `${prefix}/${item.name}` : item.name);
      files.push(...sub);
    } else {
      files.push(prefix ? `${prefix}/${item.name}` : item.name);
    }
  }
  return files;
}

// ── Script principal ──────────────────────────────────────────
async function main() {
  console.log('=== WCONTROL — Respaldo de Storage ===\n');
  mkdirp(OUTPUT_FOLDER);

  const manifest = [];
  let totalArchivos = 0;
  let totalErrores = 0;

  for (const bucket of BUCKETS) {
    console.log(`\n📂 Bucket: ${bucket}`);
    const bucketDir = path.join(OUTPUT_FOLDER, bucket);
    mkdirp(bucketDir);

    let archivos;
    try {
      archivos = await listAllFiles(bucket);
    } catch (err) {
      console.error(`  ❌ No se pudo listar el bucket: ${err.message}`);
      continue;
    }

    console.log(`  Archivos encontrados: ${archivos.length}`);

    for (const filePath of archivos) {
      const destPath = path.join(bucketDir, filePath.replace(/\//g, path.sep));

      // Generar URL firmada (válida por 1 hora)
      const { data: urlData, error: urlErr } = await sb.storage
        .from(bucket).createSignedUrl(filePath, 3600);

      if (urlErr) {
        console.error(`  ❌ Sin URL para ${filePath}: ${urlErr.message}`);
        totalErrores++;
        manifest.push({ bucket, path: filePath, status: 'ERROR', error: urlErr.message });
        continue;
      }

      try {
        await downloadFile(urlData.signedUrl, destPath);
        console.log(`  ✓ ${filePath}`);
        totalArchivos++;
        manifest.push({ bucket, path: filePath, status: 'OK', localPath: destPath });
      } catch (err) {
        console.error(`  ❌ Error descargando ${filePath}: ${err.message}`);
        totalErrores++;
        manifest.push({ bucket, path: filePath, status: 'ERROR', error: err.message });
      }
    }
  }

  // Guardar manifiesto
  const manifestPath = path.join(OUTPUT_FOLDER, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n=== RESUMEN ===`);
  console.log(`  Archivos descargados : ${totalArchivos}`);
  console.log(`  Errores              : ${totalErrores}`);
  console.log(`  Manifiesto guardado  : ${manifestPath}`);
  console.log(`\nCarpeta de respaldo: ${OUTPUT_FOLDER}`);
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
