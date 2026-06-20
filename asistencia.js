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

// ---------- FUNCIÓN BASE DE CÁLCULO DIARIO ----------
// Recibe la hora de entrada, hora de salida y la jornada teórica esperada
// para ese día, y devuelve la permanencia, la colación a descontar, las
// horas verdes (trabajo efectivo) y las horas rojas (deuda/descuento).
//
// Regla legal de colación (excepción para turnos cortos):
//   - permanencia <= 5.0 horas  -> colacionADescuentar = 0.0
//   - permanencia >  5.0 horas  -> colacionADescuentar = 1.0 (fija, NO la
//     colación configurada en el horario del trabajador)
// Nota: esta regla rige el cálculo de la asistencia REAL (turnos cortos).
// El horario teórico/planificado del trabajador (Trabajadores → jornada)
// sigue usando la colación que tú configuraste ahí.
function calcularDiaTrabajo(horaEntrada, horaSalida, horasTeoricasMeta) {
  // 2. Permanencia total (diferencia exacta en horas decimales)
  const permanenciaTotal = horasEntreTiempos(horaEntrada, horaSalida);

  // 3. Regla automática de colación
  const colacionADescuentar = permanenciaTotal <= 5.0 ? 0.0 : 1.0;

  // 4. Variables de salida
  // Horas verdes: nunca pueden superar la permanencia física en el local.
  const horasVerdes = Math.max(0, Math.min(permanenciaTotal, permanenciaTotal - colacionADescuentar));
  let horasRojas = (horasTeoricasMeta || 0) - horasVerdes;
  if (horasRojas < 0) horasRojas = 0.0; // las horas de más se manejan como extra, no acá

  return { permanenciaTotal, colacionADescuentar, horasVerdes, horasRojas };
}

// ---------- CÁLCULO POR DÍA (usa calcularDiaTrabajo como motor) ----------
function computarDia(d) {
  if (d.tipo === 'ausente') {
    // Día completo de ausencia: se calcula cuánto habría correspondido
    // trabajar ese día (con la misma regla de colación, aplicada al
    // horario teórico completo), para fijar el descuento.
    if (!d.esperado) return { hrsNormales: 0, hrsExtra: 0, hrsExtraDirecta: 0, hrsDesc: 0 };
    const calcTeorico = calcularDiaTrabajo(d.esperado.entrada, d.esperado.salida, 0);
    return { hrsNormales: 0, hrsExtra: 0, hrsExtraDirecta: 0, hrsDesc: calcTeorico.horasVerdes };
  }
  if (d.tipo === 'libre' || d.tipo === 'feriado') {
    return { hrsNormales: 0, hrsExtra: 0, hrsExtraDirecta: 0, hrsDesc: 0 };
  }

  // Jornada teórica esperada para este día (neta, según el horario
  // configurado para el trabajador en ese día de la semana).
  const horasTeoricasMeta = d.esperado ? Math.max(0, horasEntreTiempos(d.esperado.entrada, d.esperado.salida) - (d.esperado.colacion || 0) / 60) : 0;
  const calc = calcularDiaTrabajo(d.entradaReal, d.salidaReal, horasTeoricasMeta);
  const horasReales = calc.horasVerdes;

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
    return { hrsNormales: 0, hrsExtra: horasReales, hrsExtraDirecta: 0, hrsDesc: calc.horasRojas };
  }

  // tipo === 'normal', día contemplado en el horario semanal
  if (horasReales >= horasTeoricasMeta) {
    return { hrsNormales: horasTeoricasMeta, hrsExtra: horasReales - horasTeoricasMeta, hrsExtraDirecta: 0, hrsDesc: 0 };
  }
  return { hrsNormales: horasReales, hrsExtra: 0, hrsExtraDirecta: 0, hrsDesc: calc.horasRojas };
}

// ---------- UTILIDAD: redondeo libre de ruido de punto flotante ----------
function redondear(n) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

// ---------- LICUADORA: compensación de extra contra deuda semanal ----------
// Recibe los totales YA SUMADOS de una semana (o de una semana parcial, con
// su meta ya proporcionada) y compensa la deuda de horas con las horas
// extra ganadas esos mismos días contractuales.
function consolidarSemana(totalHorasVerdesTrabajadas, totalHorasExtrasDiarias, horasMetaSemanal) {
  const V = totalHorasVerdesTrabajadas || 0;
  const E = totalHorasExtrasDiarias || 0;
  const M = horasMetaSemanal || 0;

  // 1. Deuda teórica de la semana (o de la porción de semana que corresponda)
  const deudaTeorica = redondear(M - V);

  if (deudaTeorica <= 0) {
    // Cumplió (o superó) la jornada ordinaria: no hay deuda que cubrir.
    return { horasExtraFinales: redondear(E), horasDescuentoFinal: 0 };
  }

  // 2. Licuadora: la extra amortigua la deuda primero
  if (E >= deudaTeorica) {
    return { horasExtraFinales: redondear(E - deudaTeorica), horasDescuentoFinal: 0 };
  }

  // Se sacrifica toda la extra y aun así queda deuda
  return { horasExtraFinales: 0, horasDescuentoFinal: redondear(deudaTeorica - E) };
}

// ============================================================
// CONSOLIDACIÓN MENSUAL — FUENTE ÚNICA DE VERDAD
// ============================================================
// Recibe el array completo de registros diarios del mes y el trabajador, y
// en una sola pasada:
//   1. Calcula cada día UNA SOLA VEZ (computarDia), nunca se recalcula con
//      una lógica distinta en otra parte — así la pantalla diaria y el
//      resumen semanal jamás pueden desincronizarse entre sí.
//   2. Agrupa esos cálculos por semana (lunes a domingo) con reduce().
//   3. Si la semana queda "mocha" por el inicio/fin de mes (no están todos
//      los días contractuales del trabajador dentro de este mes), la meta
//      semanal (ej. 42h) se prorratea según cuántos días contractuales de
//      esa semana sí caen dentro del mes.
//   4. Aplica la licuadora (consolidarSemana) por semana, dejando las horas
//      extra "fuera de horario" (domingos, días no contractuales) congeladas
//      aparte — nunca entran a la licuadora.
function consolidarResumenMensual(diasData, trabajador) {
  // 1) Un único cálculo por día — esto es lo que usa también la tabla diaria.
  const diasCalculados = diasData.map(dia => ({ dia, calculo: computarDia(dia) }));

  const diasContratoSemana = trabajador ? getDiasLaboralesSet(trabajador.dias_laborales).length : 0;
  const horasMetaSemanalCompleta = (trabajador && trabajador.hrs_semana) ? trabajador.hrs_semana : 0;

  // 2) Agrupar por semana con reduce — una sola pasada, un solo criterio.
  const semanasPorClave = diasCalculados.reduce((acc, { dia, calculo }) => {
    const lunes = getLunesDeSemana(dia.fecha);
    const key = fechaKeyLocal(lunes);
    if (!acc[key]) {
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      acc[key] = { key, lunes, domingo, normales: 0, extra: 0, extraDirecta: 0, desc: 0, diasContractualesPresentes: 0 };
    }
    acc[key].normales += calculo.hrsNormales;
    acc[key].extra += calculo.hrsExtra;
    acc[key].extraDirecta += calculo.hrsExtraDirecta;
    acc[key].desc += calculo.hrsDesc;
    if (dia.esperado) acc[key].diasContractualesPresentes += 1;
    return acc;
  }, {});

  // 3) Meta proporcional para semanas mochas + licuadora, semana por semana.
  const semanas = Object.values(semanasPorClave)
    .sort((a, b) => a.lunes - b.lunes)
    .map(s => {
      const normales = redondear(s.normales);
      const extra = redondear(s.extra);
      const extraDirecta = redondear(s.extraDirecta);
      const desc = redondear(s.desc);

      const esParcial = diasContratoSemana > 0 && s.diasContractualesPresentes < diasContratoSemana;
      const proporcion = diasContratoSemana > 0 ? Math.min(1, s.diasContractualesPresentes / diasContratoSemana) : 0;
      const horasMetaSemanal = redondear(horasMetaSemanalCompleta * proporcion);

      const { horasExtraFinales, horasDescuentoFinal } = consolidarSemana(normales, extra, horasMetaSemanal);

      return {
        lunes: fechaKeyLocal(s.lunes), domingo: fechaKeyLocal(s.domingo),
        normales, extra, extraDirecta, desc,
        diasContractualesPresentes: s.diasContractualesPresentes, diasContratoSemana, esParcial, horasMetaSemanal,
        horasExtraFinales, horasDescuentoFinal,
        // Lo que efectivamente pasa a Liquidación: la extra "fuera de horario"
        // (domingos) se suma siempre completa, congelada, sin pasar por la licuadora.
        extraFinal: redondear(horasExtraFinales + extraDirecta),
        descFinal: horasDescuentoFinal,
      };
    });

  // 4) Totales del mes — SUMAN exactamente lo mismo que cada día calculado
  //    arriba (mismo array, mismo computarDia, sin reprocesar nada distinto).
  const hrsNorm = redondear(diasCalculados.reduce((acc, { calculo }) => acc + calculo.hrsNormales, 0));
  const hrsExt = redondear(semanas.reduce((acc, s) => acc + s.extraFinal, 0));
  const hrsDescTotal = redondear(semanas.reduce((acc, s) => acc + s.descFinal, 0));

  let diasTrab = 0, hrsAusCompletas = 0, hrsNoRealizadas = 0, diasAusentes = 0;
  diasCalculados.forEach(({ dia, calculo }) => {
    if (dia.tipo === 'ausente') {
      hrsAusCompletas += calculo.hrsDesc;
      diasAusentes += 1;
    } else if (calculo.hrsDesc > 0) {
      hrsNoRealizadas += calculo.hrsDesc;
    }
    if ((dia.tipo === 'normal' || dia.tipo === 'extra' || dia.tipo === 'normferiado') &&
        (calculo.hrsNormales + calculo.hrsExtra + calculo.hrsExtraDirecta) > 0) {
      diasTrab += 1;
    }
  });

  const valHora = (trabajador && trabajador.hrs_semana)
    ? ((trabajador.sueldo_base / 30) * 28) / (trabajador.hrs_semana * 4)
    : 0;

  return {
    diasCalculados, // mismo cálculo reutilizado por la tabla diaria
    diasTrab, hrsNorm, hrsExt,
    hrsAusCompletas: redondear(hrsAusCompletas), hrsNoRealizadas: redondear(hrsNoRealizadas),
    hrsDescTotal, diasAusentes, valHora, semanas,
  };
}

// Wrapper sobre el estado actual de la pantalla de Asistencia.
function computarResumenAsis() {
  return consolidarResumenMensual(diasDataAsis, trabajadorActualAsis);
}

// ---------- RENDER TABLA ----------
const TIPO_LABELS = { normal: 'Normal', extra: 'Extra', normferiado: 'Norm/Feriado', ausente: 'Ausente', libre: 'Libre', feriado: 'Feriado' };
const TIPO_TAG_CLASS = { normal: 'tag-normal', extra: 'tag-extra', normferiado: 'tag-normferiado', ausente: 'tag-ausente', libre: 'tag-libre', feriado: 'tag-feriado' };

function renderTablaAsis() {
  const tbody = document.getElementById('a-tabla-dias');
  let semanaActualKey = null;
  let html = '';

  // Una sola fuente de verdad: el mismo cálculo se usa para cada fila Y
  // para el resumen semanal/mensual de abajo — no se vuelve a calcular
  // con otra ruta de código en ningún otro lugar.
  const r = computarResumenAsis();

  diasDataAsis.forEach((d, i) => {
    const lunes = getLunesDeSemana(d.fecha);
    const key = fechaKeyLocal(lunes);
    if (key !== semanaActualKey) {
      semanaActualKey = key;
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      html += `<tr class="semana-divisor"><td colspan="10">Semana del ${fmtDateCorta(lunes)} al ${fmtDateCorta(domingo)}</td></tr>`;
    }

    const c = r.diasCalculados[i].calculo;
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
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999;">Sin datos</td></tr>';
    return;
  }
  tbody.innerHTML = semanas.map(s => {
    const lunesD = new Date(s.lunes + 'T00:00:00');
    const domingoD = new Date(s.domingo + 'T00:00:00');
    const metaTxt = s.esParcial
      ? `<span title="Semana parcial: solo ${s.diasContractualesPresentes} de ${s.diasContratoSemana} días contractuales caen en este mes">${s.diasContractualesPresentes}/${s.diasContratoSemana} días · ${fmt2(s.horasMetaSemanal)}h ⚠️</span>`
      : `${s.diasContractualesPresentes}/${s.diasContratoSemana} días · ${fmt2(s.horasMetaSemanal)}h`;
    return `<tr>
      <td>${fmtDateCorta(lunesD)} – ${fmtDateCorta(domingoD)}</td>
      <td class="horario-ref">${metaTxt}</td>
      <td>${fmt2(s.normales)}</td>
      <td>${fmt2(s.extra)}</td>
      <td>${s.extraDirecta > 0 ? `<span class="hrs-badge hrs-extra">${fmt2(s.extraDirecta)}</span>` : '—'}</td>
      <td>${fmt2(s.desc)}</td>
      <td>${s.horasExtraFinales > 0 ? `<span class="hrs-badge hrs-normal">+${fmt2(s.horasExtraFinales)}</span>` : '—'}</td>
      <td>${s.horasDescuentoFinal > 0 ? `<span class="hrs-badge hrs-desc">-${fmt2(s.horasDescuentoFinal)}</span>` : '—'}</td>
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
