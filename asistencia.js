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

// ---------- SEMANAS (lunes a domingo) ----------
function getLunesDeSemana(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const diaSemana = fecha.getDay(); // 0=domingo..6=sábado
  const diasDesdeLunes = (diaSemana + 6) % 7; // lunes=0
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() - diasDesdeLunes);
  return lunes;
}
function fechaKeyLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDateCorta(d) {
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}

// ---------- CÁLCULO POR DÍA ----------
// Regla 1: si la permanencia total (entrada a salida real) es <= 5 horas,
// la colación se considera 0.
// Regla 2: si el día NO es parte del horario semanal contratado del
// trabajador (no hay "esperado" para ese día), todas las horas trabajadas
// son "extra directa": NO se usan para compensar horas de descuento de la
// semana, pasan completas y directas a la liquidación.
function computarDia(d) {
  if (d.tipo === 'ausente') {
    const esp = d.esperado ? Math.max(0, horasEntreTiempos(d.esperado.entrada, d.esperado.salida) - (d.esperado.colacion || 0) / 60) : 0;
    return { hrsNormales: 0, hrsExtra: 0, hrsExtraDirecta: 0, hrsDesc: esp };
  }
  if (d.tipo === 'libre' || d.tipo === 'feriado') {
    return { hrsNormales: 0, hrsExtra: 0, hrsExtraDirecta: 0, hrsDesc: 0 };
  }

  const permanenciaTotal = horasEntreTiempos(d.entradaReal, d.salidaReal);
  const colacionConfigurada = d.esperado ? (d.esperado.colacion || 0) : 0;
  const colacion = permanenciaTotal <= 5 ? 0 : colacionConfigurada;
  const horasReales = Math.max(0, permanenciaTotal - colacion / 60);

  if (!d.esperado) {
    // Día fuera del horario semanal contratado (no aplica para ningún tipo):
    // todo lo trabajado es extra directa, no compensa descuentos de la semana.
    return { hrsNormales: 0, hrsExtra: 0, hrsExtraDirecta: horasReales, hrsDesc: 0 };
  }

  if (d.tipo === 'extra') {
    return { hrsNormales: 0, hrsExtra: horasReales, hrsExtraDirecta: 0, hrsDesc: 0 };
  }

  if (d.tipo === 'normferiado') {
    // Día normalmente laboral que cae en feriado: lo trabajado es 100% extra,
    // y si no se cubre el horario esperado, esa diferencia igual se descuenta.
    const horasEsperadas = Math.max(0, horasEntreTiempos(d.esperado.entrada, d.esperado.salida) - (d.esperado.colacion || 0) / 60);
    const hrsDesc = Math.max(0, horasEsperadas - horasReales);
    return { hrsNormales: 0, hrsExtra: horasReales, hrsExtraDirecta: 0, hrsDesc };
  }

  // tipo === 'normal', día contemplado en el horario semanal
  const horasEsperadas = Math.max(0, horasEntreTiempos(d.esperado.entrada, d.esperado.salida) - (d.esperado.colacion || 0) / 60);
  if (horasReales >= horasEsperadas) {
    return { hrsNormales: horasEsperadas, hrsExtra: horasReales - horasEsperadas, hrsExtraDirecta: 0, hrsDesc: 0 };
  }
  return { hrsNormales: horasReales, hrsExtra: 0, hrsExtraDirecta: 0, hrsDesc: horasEsperadas - horasReales };
}

// ---------- RESUMEN SEMANAL (lunes a domingo) ----------
// Las horas extra solo compensan horas de descuento DENTRO de la misma
// semana. Si en una semana las extras no alcanzan a cubrir el descuento,
// ese remanente de descuento pasa directo a la liquidación; si sobran
// extras tras cubrir el descuento, esas pasan directo como extra.
function computarSemanasAsis() {
  const semanas = {};
  diasDataAsis.forEach(d => {
    const c = computarDia(d);
    const lunes = getLunesDeSemana(d.fecha);
    const key = fechaKeyLocal(lunes);
    if (!semanas[key]) {
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      semanas[key] = { key, lunes, domingo, normales: 0, extra: 0, extraDirecta: 0, desc: 0 };
    }
    semanas[key].normales += c.hrsNormales;
    semanas[key].extra += c.hrsExtra;
    semanas[key].extraDirecta += c.hrsExtraDirecta;
    semanas[key].desc += c.hrsDesc;
  });
  const ordenadas = Object.values(semanas).sort((a, b) => a.lunes - b.lunes);
  ordenadas.forEach(s => {
    s.neto = s.extra - s.desc;
    // La extra directa (fuera del horario semanal) nunca compensa descuentos:
    // se suma completa, aparte del neteo entre extra contemplada y descuento.
    s.extraFinal = Math.max(0, s.neto) + s.extraDirecta;
    s.descFinal = Math.max(0, -s.neto);
  });
  return ordenadas;
}

function computarResumenAsis() {
  let diasTrab = 0, hrsNorm = 0, hrsAusCompletas = 0, hrsNoRealizadas = 0, diasAusentes = 0;
  diasDataAsis.forEach(d => {
    const c = computarDia(d);
    hrsNorm += c.hrsNormales;
    if (d.tipo === 'ausente') {
      hrsAusCompletas += c.hrsDesc;
      diasAusentes++;
    } else if (c.hrsDesc > 0) {
      hrsNoRealizadas += c.hrsDesc;
    }
    if ((d.tipo === 'normal' || d.tipo === 'extra' || d.tipo === 'normferiado') && (c.hrsNormales + c.hrsExtra + c.hrsExtraDirecta) > 0) diasTrab++;
  });

  const semanas = computarSemanasAsis();
  const hrsExt = semanas.reduce((s, w) => s + w.extraFinal, 0);
  const hrsDescTotal = semanas.reduce((s, w) => s + w.descFinal, 0);

  const t = trabajadorActualAsis;
  const valHora = (t && t.hrs_semana) ? ((t.sueldo_base / 30) * 28) / (t.hrs_semana * 4) : 0;

  return {
    diasTrab, hrsNorm, hrsExt, hrsAusCompletas, hrsNoRealizadas, hrsDescTotal, diasAusentes, valHora,
    semanas: semanas.map(s => ({
      lunes: fechaKeyLocal(s.lunes), domingo: fechaKeyLocal(s.domingo),
      normales: s.normales, extra: s.extra, extraDirecta: s.extraDirecta, desc: s.desc, neto: s.neto,
    })),
  };
}

// ---------- RENDER TABLA ----------
const TIPO_LABELS = { normal: 'Normal', extra: 'Extra', normferiado: 'Norm/Feriado', ausente: 'Ausente', libre: 'Libre', feriado: 'Feriado' };
const TIPO_TAG_CLASS = { normal: 'tag-normal', extra: 'tag-extra', normferiado: 'tag-normferiado', ausente: 'tag-ausente', libre: 'tag-libre', feriado: 'tag-feriado' };

function renderTablaAsis() {
  const tbody = document.getElementById('a-tabla-dias');
  let semanaActualKey = null;
  let html = '';

  diasDataAsis.forEach((d, i) => {
    const lunes = getLunesDeSemana(d.fecha);
    const key = fechaKeyLocal(lunes);
    if (key !== semanaActualKey) {
      semanaActualKey = key;
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      html += `<tr class="semana-divisor"><td colspan="10">Semana del ${fmtDateCorta(lunes)} al ${fmtDateCorta(domingo)}</td></tr>`;
    }

    const c = computarDia(d);
    const hrsExtraDia = c.hrsExtra + c.hrsExtraDirecta;
    const disabledTimes = (d.tipo === 'ausente' || d.tipo === 'libre' || d.tipo === 'feriado');
    const esperadoTxt = d.esperado ? `${d.esperado.entrada}–${d.esperado.salida}` : '—';
    const filaClase = d.tipo === 'ausente' ? 'fila-ausente' : (d.tipo === 'libre' || d.tipo === 'feriado' ? 'fila-libre' : '');
    html += `<tr class="${filaClase}">
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
      <td>${hrsExtraDia > 0 ? `<span class="hrs-badge hrs-extra">${fmt2(hrsExtraDia)}</span>` : '—'}</td>
      <td>${c.hrsDesc > 0 ? `<span class="hrs-badge hrs-desc">${fmt2(c.hrsDesc)}</span>` : '—'}</td>
      <td><span class="tag-dia ${TIPO_TAG_CLASS[d.tipo]}">${TIPO_LABELS[d.tipo]}</span></td>
    </tr>`;
  });

  tbody.innerHTML = html;

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

  renderResumenSemanal(r.semanas);
}

function renderResumenSemanal(semanas) {
  const tbody = document.getElementById('a-tabla-semanas');
  if (!tbody) return;
  if (!semanas.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999;">Sin datos</td></tr>';
    return;
  }
  tbody.innerHTML = semanas.map(s => {
    const lunesD = new Date(s.lunes + 'T00:00:00');
    const domingoD = new Date(s.domingo + 'T00:00:00');
    const netoClase = s.neto >= 0 ? 'hrs-normal' : 'hrs-desc';
    const netoTxto = (s.neto >= 0 ? '+' : '') + fmt2(s.neto);
    return `<tr>
      <td>${fmtDateCorta(lunesD)} – ${fmtDateCorta(domingoD)}</td>
      <td>${fmt2(s.normales)}</td>
      <td>${fmt2(s.extra)}</td>
      <td>${s.extraDirecta > 0 ? `<span class="hrs-badge hrs-extra">${fmt2(s.extraDirecta)}</span>` : '—'}</td>
      <td>${fmt2(s.desc)}</td>
      <td><span class="hrs-badge ${netoClase}">${netoTxto}</span></td>
    </tr>`;
  }).join('');
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
