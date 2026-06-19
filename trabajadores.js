// ============================================================
// trabajadores.js - alta, edición, archivado y borrado de trabajadores
// ============================================================

var editingTrabajadorId = null;
var horarioSemanaActual = {}; // { '1': {entrada,salida,colacion}, ... } claves 0-6 (0=domingo)

const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // Lunes...Domingo

// ---------- LISTA ----------
function renderTrabajadoresList() {
  const cont = document.getElementById('trab-list');
  if (!trabajadoresCache.length) {
    cont.innerHTML = '<div class="empty-state">Aún no has creado ningún trabajador. Usa "+ Nuevo trabajador" para empezar.</div>';
    return;
  }
  const ordenados = [...trabajadoresCache].sort((a, b) => (b.activo - a.activo) || a.nombre.localeCompare(b.nombre));
  cont.innerHTML = ordenados.map(t => {
    const inicial = (t.nombre || '?').trim().charAt(0).toUpperCase();
    return `
      <div class="trab-card ${t.activo ? '' : 'inactivo'}">
        <div class="trab-avatar">${inicial}</div>
        <div class="trab-info">
          <div class="trab-nombre">${t.nombre}${!t.activo ? '<span class="trab-tag">Archivado</span>' : ''}</div>
          <div class="trab-meta">${t.cargo || 'Sin cargo'} · ${t.rut || 'Sin RUT'} · ${fmtPesos(t.sueldo_base)}</div>
        </div>
        <div class="trab-actions">
          <button class="btn-secondary btn-small" onclick="abrirFormTrabajador('${t.id}')">Editar</button>
          <button class="btn-secondary btn-small" onclick="archivarTrabajador('${t.id}', ${!t.activo})">${t.activo ? 'Archivar' : 'Reactivar'}</button>
          <button class="btn-secondary btn-small btn-danger" onclick="eliminarTrabajador('${t.id}')">Eliminar</button>
        </div>
      </div>`;
  }).join('');
}

// ---------- ABRIR / CERRAR FORM ----------
function abrirFormTrabajador(id) {
  document.getElementById('trab-list-card').style.display = 'none';
  document.getElementById('trab-form-wrap').style.display = 'block';

  if (id) {
    const t = getTrabajadorById(id);
    if (!t) { showToast('Trabajador no encontrado', 'error'); return; }
    editingTrabajadorId = id;
    document.getElementById('trab-form-title').textContent = 'Editar trabajador';
    document.getElementById('t-nombre').value = t.nombre || '';
    document.getElementById('t-rut').value = t.rut || '';
    document.getElementById('t-cargo').value = t.cargo || '';
    document.getElementById('t-centro-negocio').value = t.centro_negocio || '';
    document.getElementById('t-tipo-contrato').value = t.tipo_contrato || 'PLAZO FIJO';
    document.getElementById('t-fecha-inicio').value = t.fecha_inicio || '';
    document.getElementById('t-fecha-fin').value = t.fecha_fin || '';
    document.getElementById('t-sueldo-base').value = t.sueldo_base || 0;
    document.getElementById('t-afp').value = t.afp || '';
    document.getElementById('t-tasa-afp').value = t.tasa_afp ?? 10.46;
    document.getElementById('t-afp-adicional').value = t.afp_adicional ?? 0;
    document.getElementById('t-inst-salud').value = t.institucion_salud || 'FONASA';
    document.getElementById('t-plan-salud').value = t.plan_salud ?? 7;
    document.getElementById('t-dias-laborales').value = t.dias_laborales || 'lunes-viernes';
    document.getElementById('t-hrs-semana').value = t.hrs_semana || 44;
    horarioSemanaActual = t.horario_semana && typeof t.horario_semana === 'object' ? { ...t.horario_semana } : {};
  } else {
    editingTrabajadorId = null;
    document.getElementById('trab-form-title').textContent = 'Nuevo trabajador';
    ['t-nombre','t-rut','t-cargo','t-centro-negocio','t-fecha-inicio','t-fecha-fin'].forEach(id2 => document.getElementById(id2).value = '');
    document.getElementById('t-tipo-contrato').value = 'PLAZO FIJO';
    document.getElementById('t-sueldo-base').value = 0;
    document.getElementById('t-afp').value = '';
    document.getElementById('t-tasa-afp').value = 10.46;
    document.getElementById('t-afp-adicional').value = 0;
    document.getElementById('t-inst-salud').value = 'FONASA';
    document.getElementById('t-plan-salud').value = 7;
    document.getElementById('t-dias-laborales').value = 'lunes-viernes';
    document.getElementById('t-hrs-semana').value = 44;
    horarioSemanaActual = {};
  }
  renderHorarioSemanaForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cerrarFormTrabajador() {
  document.getElementById('trab-form-wrap').style.display = 'none';
  document.getElementById('trab-list-card').style.display = 'block';
  editingTrabajadorId = null;
}

// ---------- HORARIO POR DÍA ----------
function renderHorarioSemanaForm() {
  const diasConfig = document.getElementById('t-dias-laborales').value;
  const working = new Set(getDiasLaboralesSet(diasConfig));
  const tbody = document.getElementById('t-horario-body');

  tbody.innerHTML = ORDEN_DIAS.map(diaIdx => {
    if (!working.has(diaIdx)) {
      return `<tr>
        <td class="dia-nombre">${DIAS_NOMBRE[diaIdx]}</td>
        <td colspan="3"><span class="libre-tag">Día libre</span></td>
        <td><span class="hrs-esperadas" style="background:#f0f0ec;color:#999;">—</span></td>
      </tr>`;
    }
    const d = horarioSemanaActual[diaIdx] || {};
    const entrada = d.entrada || '09:00';
    const salida = d.salida || '18:00';
    const colacion = d.colacion ?? 60;
    return `<tr id="trh-${diaIdx}">
      <td class="dia-nombre">${DIAS_NOMBRE[diaIdx]}</td>
      <td><input type="time" value="${entrada}" oninput="onHorarioInputChange(${diaIdx},'entrada',this.value)" /></td>
      <td><input type="time" value="${salida}" oninput="onHorarioInputChange(${diaIdx},'salida',this.value)" /></td>
      <td><input type="number" min="0" step="5" value="${colacion}" oninput="onHorarioInputChange(${diaIdx},'colacion',this.value)" style="width:80px;" /> min</td>
      <td><span class="hrs-esperadas" id="trh-hrs-${diaIdx}">0,00</span></td>
    </tr>`;
  }).join('');

  working.forEach(diaIdx => {
    if (!horarioSemanaActual[diaIdx]) {
      horarioSemanaActual[diaIdx] = { entrada: '09:00', salida: '18:00', colacion: 60 };
    }
  });
  recalcularHorasHorario();
}

function onHorarioInputChange(diaIdx, campo, value) {
  if (!horarioSemanaActual[diaIdx]) horarioSemanaActual[diaIdx] = {};
  horarioSemanaActual[diaIdx][campo] = campo === 'colacion' ? Number(value) : value;
  recalcularHorasHorario();
}

function recalcularHorasHorario() {
  const diasConfig = document.getElementById('t-dias-laborales').value;
  const working = getDiasLaboralesSet(diasConfig);
  let total = 0;
  working.forEach(diaIdx => {
    const d = horarioSemanaActual[diaIdx] || {};
    const horas = Math.max(0, horasEntreTiempos(d.entrada, d.salida) - (d.colacion || 0) / 60);
    total += horas;
    const span = document.getElementById('trh-hrs-' + diaIdx);
    if (span) span.textContent = fmt2(horas);
  });
  document.getElementById('t-total-hrs').textContent = fmt2(total) + ' hrs';
}

// ---------- GUARDAR / ARCHIVAR / ELIMINAR ----------
async function guardarTrabajador() {
  const nombre = document.getElementById('t-nombre').value.trim();
  if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }

  const payload = {
    nombre,
    rut: document.getElementById('t-rut').value.trim(),
    cargo: document.getElementById('t-cargo').value.trim(),
    centro_negocio: document.getElementById('t-centro-negocio').value.trim(),
    tipo_contrato: document.getElementById('t-tipo-contrato').value,
    fecha_inicio: document.getElementById('t-fecha-inicio').value || null,
    fecha_fin: document.getElementById('t-fecha-fin').value || null,
    sueldo_base: Number(document.getElementById('t-sueldo-base').value) || 0,
    afp: document.getElementById('t-afp').value.trim(),
    tasa_afp: Number(document.getElementById('t-tasa-afp').value) || 0,
    afp_adicional: Number(document.getElementById('t-afp-adicional').value) || 0,
    institucion_salud: document.getElementById('t-inst-salud').value.trim(),
    plan_salud: Number(document.getElementById('t-plan-salud').value) || 0,
    dias_laborales: document.getElementById('t-dias-laborales').value,
    hrs_semana: Number(document.getElementById('t-hrs-semana').value) || 0,
    horario_semana: horarioSemanaActual,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (editingTrabajadorId) {
    ({ error } = await sb.from('trabajadores').update(payload).eq('id', editingTrabajadorId));
  } else {
    payload.activo = true;
    ({ error } = await sb.from('trabajadores').insert(payload));
  }

  if (error) { showToast('Error al guardar: ' + error.message, 'error'); return; }

  await cargarTrabajadoresCache();
  renderTrabajadoresList();
  poblarSelectsTrabajador();
  cerrarFormTrabajador();
  showToast('Trabajador guardado ✓');
}

async function archivarTrabajador(id, nuevoEstado) {
  const { error } = await sb.from('trabajadores').update({ activo: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await cargarTrabajadoresCache();
  renderTrabajadoresList();
  poblarSelectsTrabajador();
  showToast(nuevoEstado ? 'Trabajador reactivado ✓' : 'Trabajador archivado ✓');
}

async function eliminarTrabajador(id) {
  const t = getTrabajadorById(id);
  const ok = confirm(`¿Eliminar a "${t ? t.nombre : ''}"?\n\nEsto también borrará TODA su asistencia y liquidaciones guardadas. Esta acción no se puede deshacer.\n\nSi solo quieres ocultarlo de las listas, usa "Archivar" en vez de esto.`);
  if (!ok) return;
  const { error } = await sb.from('trabajadores').delete().eq('id', id);
  if (error) { showToast('Error al eliminar: ' + error.message, 'error'); return; }
  await cargarTrabajadoresCache();
  renderTrabajadoresList();
  poblarSelectsTrabajador();
  showToast('Trabajador eliminado');
}
