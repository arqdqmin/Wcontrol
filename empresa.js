// ============================================================
// empresa.js - logo de la empresa (Supabase Storage)
// ============================================================

var logoFileSeleccionado = null;

const LOGO_IMG_STYLE = 'width:100%; height:100%; max-width:100%; max-height:100%; object-fit:contain; display:block;';

function setLogoPreviewImg(src) {
  const box = document.getElementById('emp-logo-preview');
  if (!box) return;
  box.innerHTML = '';
  const img = document.createElement('img');
  img.src = src;
  img.alt = 'Logo';
  img.style.cssText = LOGO_IMG_STYLE;
  box.appendChild(img);
}

function onLogoFileSelected() {
  const input = document.getElementById('emp-logo-file');
  logoFileSeleccionado = input.files[0] || null;
  if (logoFileSeleccionado) {
    const url = URL.createObjectURL(logoFileSeleccionado);
    setLogoPreviewImg(url);
  }
}

function renderLogoPreview() {
  const box = document.getElementById('emp-logo-preview');
  if (!box) return;
  if (empresaCache && empresaCache.logo_url) {
    setLogoPreviewImg(empresaCache.logo_url);
  } else {
    box.innerHTML = 'Sin logo';
  }
}

async function subirLogoEmpresa() {
  if (!logoFileSeleccionado) { showToast('Primero elige una imagen', 'error'); return; }
  const ext = (logoFileSeleccionado.name.split('.').pop() || 'png').toLowerCase();
  const path = `logo-${Date.now()}.${ext}`;

  const { error: upErr } = await sb.storage.from('logos').upload(path, logoFileSeleccionado, { upsert: true });
  if (upErr) {
    const esBucketFaltante = /bucket/i.test(upErr.message) && /not found/i.test(upErr.message);
    const msg = esBucketFaltante
      ? 'El bucket "logos" no existe todavía en Supabase. Ve a SQL Editor en tu proyecto y vuelve a correr schema.sql completo (es seguro, no borra nada) — eso crea el bucket automáticamente.'
      : 'Error al subir el logo: ' + upErr.message;
    showToast(msg, 'error');
    return;
  }

  const { data: urlData } = sb.storage.from('logos').getPublicUrl(path);

  const oldPath = empresaCache ? empresaCache.logo_path : null;
  const { error: dbErr } = await sb.from('empresa').update({
    logo_path: path, logo_url: urlData.publicUrl, updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (dbErr) { showToast('El logo se subió pero no se pudo guardar la referencia: ' + dbErr.message, 'error'); return; }

  if (oldPath && oldPath !== path) {
    await sb.storage.from('logos').remove([oldPath]);
  }

  empresaCache.logo_path = path;
  empresaCache.logo_url = urlData.publicUrl;
  logoFileSeleccionado = null;
  document.getElementById('emp-logo-file').value = '';
  renderLogoPreview();
  showToast('Logo actualizado ✓');
}

async function quitarLogoEmpresa() {
  if (!empresaCache || !empresaCache.logo_path) { showToast('No hay logo cargado', 'error'); return; }
  const ok = confirm('¿Quitar el logo de la empresa?');
  if (!ok) return;

  await sb.storage.from('logos').remove([empresaCache.logo_path]);
  const { error } = await sb.from('empresa').update({
    logo_path: null, logo_url: null, updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) { showToast('Error al quitar el logo: ' + error.message, 'error'); return; }

  empresaCache.logo_path = null;
  empresaCache.logo_url = null;
  renderLogoPreview();
  showToast('Logo eliminado');
}
