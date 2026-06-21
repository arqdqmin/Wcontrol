// ============================================================
// app.js - inicialización, autenticación y utilidades compartidas
// ============================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var trabajadoresCache = [];   // todos los trabajadores (incluye inactivos)
var empresaCache = null;      // fila única de la tabla empresa

// ---------- UTILIDADES COMPARTIDAS ----------
function fmt2(n) {
  return (n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPesos(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-CL');
}
function fmt(n) {
  return Math.round(n || 0).toLocaleString('es-CL');
}
function fmtDate(d) {
  if (!d) return '';
  const p = d.split('-');
  if (p.length !== 3) return d;
  return p[2] + '/' + p[1] + '/' + p[0];
}
function horasEntreTiempos(t1, t2) {
  if (!t1 || !t2) return 0;
  const [h1, m1] = t1.split(':').map(Number);
  const [h2, m2] = t2.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  return Math.max(0, mins / 60);
}
function getDiasLaboralesSet(config) {
  if (config === 'martes-sabado') return [2,3,4,5,6];
  if (config === 'lunes-viernes') return [1,2,3,4,5];
  if (config === 'lunes-sabado')  return [1,2,3,4,5,6];
  return [1,2,3,4,5];
}
const DIAS_CORTO    = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DIAS_NOMBRE   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MESES_NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

var toastTimer = null;
function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast visible' + (type === 'error' ? ' error' : '');
  clearTimeout(toastTimer);
  const duracion = type === 'error' ? 6000 : 3000;
  toastTimer = setTimeout(() => { el.classList.remove('visible'); }, duracion);
}

// ---------- AUTENTICACIÓN ----------
async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errBox = document.getElementById('login-error');
  errBox.classList.remove('visible');

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Ingresando...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = 'Ingresar';

  if (error) {
    errBox.textContent = 'Correo o contraseña incorrectos.';
    errBox.classList.add('visible');
    return;
  }
  await onLoginSuccess();
}

async function logout() {
  await sb.auth.signOut();
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

async function onLoginSuccess() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  await cargarEmpresa();
  await cargarTrabajadoresCache();
  renderTrabajadoresList();
  poblarSelectsTrabajador();
}

async function checkSession() {
  const { data } = await sb.auth.getSession();
  if (data && data.session) {
    await onLoginSuccess();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
  }
}

// ---------- TABS ----------
function switchTab(tabId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
}

// ---------- EMPRESA ----------
async function cargarEmpresa() {
  const { data, error } = await sb.from('empresa').select('*').eq('id', 1).single();
  if (error) {
    showToast('No se pudo cargar la empresa: ' + error.message, 'error');
    return;
  }
  empresaCache = data;
  document.getElementById('emp-rut').value = data.rut || '';
  document.getElementById('emp-nombre').value = data.nombre || '';
  document.getElementById('emp-direccion').value = data.direccion || '';
  if (typeof renderLogoPreview === 'function') renderLogoPreview();
}

async function guardarEmpresa() {
  const payload = {
    id: 1,
    rut: document.getElementById('emp-rut').value.trim(),
    nombre: document.getElementById('emp-nombre').value.trim(),
    direccion: document.getElementById('emp-direccion').value.trim(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('empresa').upsert(payload);
  if (error) { showToast('Error al guardar empresa: ' + error.message, 'error'); return; }
  empresaCache = payload;
  showToast('Datos de empresa guardados ✓');
}

// ---------- TRABAJADORES (cache compartida) ----------
async function cargarTrabajadoresCache() {
  const { data, error } = await sb.from('trabajadores').select('*').order('nombre');
  if (error) {
    showToast('No se pudieron cargar los trabajadores: ' + error.message, 'error');
    trabajadoresCache = [];
    return;
  }
  trabajadoresCache = data || [];
}

function poblarSelectsTrabajador() {
  const activos = trabajadoresCache.filter(t => t.activo);
  ['a-trabajador', 'l-trabajador'].forEach(selId => {
    const sel = document.getElementById(selId);
    const prev = sel.value;
    sel.innerHTML = '<option value="">— Selecciona —</option>' +
      activos.map(t => `<option value="${t.id}">${t.nombre}${t.cargo ? ' (' + t.cargo + ')' : ''}</option>`).join('');
    if (prev && activos.some(t => t.id === prev)) sel.value = prev;
  });
}

function getTrabajadorById(id) {
  return trabajadoresCache.find(t => String(t.id) === String(id)) || null;
}

window.addEventListener('DOMContentLoaded', checkSession);
