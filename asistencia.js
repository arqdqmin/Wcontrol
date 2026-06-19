// ============================================================
// asistencia.js - planilla mensual de asistencia por trabajador
// ============================================================

var trabajadorActualAsis = null;
var diasDataAsis = [];
var registroIdAsis = null;
var mesActualAsis = 0;
var anioActualAsis = 2026;

function onTrabajadorChangeAsis() {
  document.getElementById('a-planilla-wrap').style.display = 'none';
  document.getElementById('a-status').textContent = '';
  const id = document.getElementById('a-trabajador').value;
  if (id) cargarHistAsis(id); else document.getElementById('a-hist-card').style.display = 'none';
}

// ---------- GENERAR DÍAS DEL MES SEGÚN HORARIO DEL TRABAJADOR ----------
function generarDiasMes(t, anio, mes) {
  const dias = [];
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const working = new Set(getDiasLaboralesSet(t.dias_laborales));
  for (let day = 1; day <= diasEnMes; day++) {
    const fechaObj = new Date(anio, mes, day);
    const diaSemana = fechaObj.getDay();
    const esLaboral = working.has(diaSemana);
    const esperado = (esLaboral && t.horario_semana && t.horario_semana[diaSemana]) ? t.horario_semana[diaSemana] : null;
    dias.push({
      fecha: `${anio}-${String(mes + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      diaSemana,
      esperado,
      tipo: esLaboral ? 'normal' : 'libre',
      entradaReal: esperado ? esperado.entrada : '',
      salidaReal: esperado ? esperado.salida : '',
    });
  }
  return dias;
}

// ---------- CARGAR / GENERAR ----------
async function cargarAsistencia() {
  const trabajadorId = document.getElementById('a-trabajador').value;
  if (!trabajadorId) { showToast('Selecciona un trabajador', 'error'); return; }
  const t = getTrabajadorById(trabajadorId);
  if (!t) { showToast('Trabajador no encontrado', 'error'); return; }

  trabajadorActualAsis = t;
  mesActualAsis = Number(document.getElementById('a-mes').value);
  anioActualAsis = Number(document.getElementById('a-anio').value);

  const { data, error } = await sb.from('asistencia_mensual').select('*')
    .eq('trabajador_id', trabajadorId).eq('anio', anioActualAsis).eq('mes', mesActualAsis)
    .maybeSingle();

  if (error) { showToast('Error al cargar: ' + error.message, 'error'); return; }

  if (data) {
    diasDataAsis = data.dias_data;
    registroIdAsis = data.id;
    document.getElementById('a-status').textContent = `Cargado un registro ya guardado (última actualización ${new Date(data.updated_at).toLocaleString('es-CL')}).`;
  } else {
    diasDataAsis = generarDiasMes(t, anioActualAsis, mesActualAsis);
    registroIdAsis = null;
    document.getElementById('a-status').textContent = 'Planilla nueva generada según el horario del trabajador — aún no guardada.';
  }

  document.getElementById('a-titulo-registro').textContent = `Registro diario — ${t.nombre} — ${MESES_NOMBRES[mesActualAsis]} ${anioActualAsis}`;
  document.getElementById('a-planilla-wrap').style.display = 'block';
  renderTablaAsis();
  cargarHistAsis(trabajadorId);
}

// ---------- CÁLCULO POR DÍA ----------
function computarDia(d) {
  if (d.tipo === 'ausente') {
    const esp = d.esperado ? Math.max(0, horasEntreTiempos(d.esperado.entrada, d.esperado.salida) - (d.esperado.colacion || 0) / 60) : 0;
    return { hrsNormales: 0, hrsExtra: 0, hrsDesc: esp };
  }
  if (d.tipo === 'libre' || d.tipo === 'feriado') {
    return { hrsNormales: 0, hrsExtra: 0, hrsDesc: 0 };
  }
  const colacion = d.esperado ? (d.esperado.colacion || 0) : 0;
  const horasReales = Math.max(0, horasEntreTiempos(d.entradaReal, d.salidaReal) - colacion / 60);

  if (d.tipo === 'extra') {
    return { hrsNormales: 0, hrsExtra: horasReales, hrsDesc: 0 };
  }
  // tipo === 'normal'
  if (!d.esperado) {
    // día sin horario contractual pero marcado como trabajado -> 100% extra
    return { hrsNormales: 0, hrsExtra: horasReales, hrsDesc: 0 };
  }
  const horasEsperadas = Math.max(0, horasEntreTiempos(d.esperado.entrada, d.esperado.salida) - (d.esperado.colacion || 0) / 60);
  if (horasReales >= horasEsperadas) {
    return { hrsNormales: horasEsperadas, hrsExtra: horasReales - horasEsperadas, hrsDesc: 0 };
  }
  return { hrsNormales: horasReales, hrsExtra: 0, hrsDesc: horasEsperadas - horasReales };
}

function computarResumenAsis() {
  let diasTrab = 0, hrsNorm = 0, hrsExt = 0, hrsAusCompletas = 0, hrsNoRealizadas = 0, diasAusentes = 0;
  diasDataAsis.forEach(d => {
    const c = computarDia(d);
    hrsNorm += c.hrsNormales;
    hrsExt += c.hrsExtra;
    if (d.tipo === 'ausente') {
      hrsAusCompletas += c.hrsDesc;
      diasAusentes++;
    } else if (c.hrsDesc > 0) {
      hrsNoRealizadas += c.hrsDesc;
    }
    if ((d.tipo === 'normal' || d.tipo === 'extra') && (c.hrsNormales + c.hrsExtra) > 0) diasTrab++;
  });
  const t = trabajadorActualAsis;
  const valHora = (t && t.hrs_semana) ? ((t.sueldo_base / 30) * 28) / (t.hrs_semana * 4) : 0;
  const hrsDescTotal = hrsAusCompletas + hrsNoRealizadas;
  return { diasTrab, hrsNorm, hrsExt, hrsAusCompletas, hrsNoRealizadas, hrsDescTotal, diasAusentes, valHora };
}

// ---------- RENDER TABLA ----------
const TIPO_LABELS = { normal: 'Normal', extra: 'Extra', ausente: 'Ausente', libre: 'Libre', feriado: 'Feriado' };
const TIPO_TAG_CLASS = { normal: 'tag-normal', extra: 'tag-extra', ausente: 'tag-ausente', libre: 'tag-libre', feriado: 'tag-feriado' };

function renderTablaAsis() {
  const tbody = document.getElementById('a-tabla-dias');
  tbody.innerHTML = diasDataAsis.map((d, i) => {
    const c = computarDia(d);
    const disabledTimes = (d.tipo === 'ausente' || d.tipo === 'libre' || d.tipo === 'feriado');
    const esperadoTxt = d.esperado ? `${d.esperado.entrada}–${d.esperado.salida}` : '—';
    const filaClase = d.tipo === 'ausente' ? 'fila-ausente' : (d.tipo === 'libre' || d.tipo === 'feriado' ? 'fila-libre' : '');
    return `<tr class="${filaClase}">
      <td>${fmtDate(d.fecha)}</td>
      <td>${DIAS_CORTO[d.diaSemana]}</td>
      <td>
        <select class="tipo-select" onchange="cambiarTipoAsis(${i}, this.value)">
          ${Object.keys(TIPO_LABELS).map(k => `<option value="${k}" ${d.tipo === k ? 'selected' : ''}>${TIPO_LABELS[k]}</option>`).join('')}
        </select>
      </td>
      <td><input type="time" class="time-input" value="${d.entradaReal || ''}" ${disabledTimes ? 'disabled' : ''} onchange="cambiarHoraAsis(${i},'entradaReal',this.value)" /></td>
      <td><input type="time" class="time-input" value="${d.salidaReal || ''}" ${disabledTimes ? 'disabled' : ''} onchange="cambiarHoraAsis(${i},'salidaReal',this.value)" /></td>
      <td class="horario-ref">${esperadoTxt}</td>
      <td>${c.hrsNormales > 0 ? `<span class="hrs-badge hrs-normal">${fmt2(c.hrsNormales)}</span>` : '—'}</td>
      <td>${c.hrsExtra > 0 ? `<span class="hrs-badge hrs-extra">${fmt2(c.hrsExtra)}</span>` : '—'}</td>
      <td>${c.hrsDesc > 0 ? `<span class="hrs-badge hrs-desc">${fmt2(c.hrsDesc)}</span>` : '—'}</td>
      <td><span class="tag-dia ${TIPO_TAG_CLASS[d.tipo]}">${TIPO_LABELS[d.tipo]}</span></td>
    </tr>`;
  }).join('');

  const r = computarResumenAsis();
  document.getElementById('ar-dias').textContent = r.diasTrab;
  document.getElementById('ar-hnorm').textContent = fmt2(r.hrsNorm);
  document.getElementById('ar-hext').textContent = fmt2(r.hrsExt);
  document.getElementById('ar-hdesc').textContent = fmt2(r.hrsDescTotal);

  document.getElementById('a-liq-dias').textContent = r.diasTrab + ' días';
  document.getElementById('a-liq-hrs-desc').textContent = fmt2(r.hrsDescTotal) + ' hrs';
  document.getElementById('a-liq-val-hora').textContent = fmtPesos(r.valHora);
  document.getElementById('a-liq-hrs-ext').textContent = fmt2(r.hrsExt) + ' hrs';
  document.getElementById('a-liq-ausencias').textContent = r.diasAusentes + ' días';
}

function cambiarTipoAsis(i, val) {
  diasDataAsis[i].tipo = val;
  if (val === 'ausente' || val === 'libre' || val === 'feriado') {
    diasDataAsis[i].entradaReal = '';
    diasDataAsis[i].salidaReal = '';
  } else if (!diasDataAsis[i].entradaReal && diasDataAsis[i].esperado) {
    diasDataAsis[i].entradaReal = diasDataAsis[i].esperado.entrada;
    diasDataAsis[i].salidaReal = diasDataAsis[i].esperado.salida;
  }
  renderTablaAsis();
}

function cambiarHoraAsis(i, campo, val) {
  diasDataAsis[i][campo] = val;
  renderTablaAsis();
}

// ---------- GUARDAR ----------
async function guardarAsistencia() {
  if (!trabajadorActualAsis) { showToast('Carga un trabajador primero', 'error'); return; }
  const resumen = computarResumenAsis();
  const payload = {
    trabajador_id: trabajadorActualAsis.id,
    anio: anioActualAsis,
    mes: mesActualAsis,
    dias_data: diasDataAsis,
    resumen,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from('asistencia_mensual')
    .upsert(payload, { onConflict: 'trabajador_id,anio,mes' })
    .select().single();

  if (error) { showToast('Error al guardar: ' + error.message, 'error'); return; }
  registroIdAsis = data.id;
  document.getElementById('a-status').textContent = `Guardado correctamente (${new Date().toLocaleString('es-CL')}).`;
  showToast('Asistencia guardada ✓');
  cargarHistAsis(trabajadorActualAsis.id);
}

// ---------- HISTORIAL ----------
async function cargarHistAsis(trabajadorId) {
  const { data, error } = await sb.from('asistencia_mensual').select('anio,mes,updated_at')
    .eq('trabajador_id', trabajadorId).order('anio', { ascending: false }).order('mes', { ascending: false });
  const card = document.getElementById('a-hist-card');
  const list = document.getElementById('a-hist-list');
  if (error || !data || !data.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  list.innerHTML = data.map(r => `
    <div class="hist-item" onclick="document.getElementById('a-mes').value='${r.mes}'; document.getElementById('a-anio').value='${r.anio}'; cargarAsistencia();">
      <span>${MESES_NOMBRES[r.mes]} ${r.anio}</span>
      <span class="hist-meta">Actualizado ${new Date(r.updated_at).toLocaleDateString('es-CL')}</span>
    </div>`).join('');
}
