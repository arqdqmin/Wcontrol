// ============================================================
// liquidacion.js - generación y cálculo de liquidación de sueldo
// ============================================================

var trabajadorActualLiq = null;
var mesActualLiq = 0;
var anioActualLiq = 2026;
var registroIdLiq = null;
var lastCalc = null;

// ---------- AL CAMBIAR EL TRABAJADOR: mostrar historial de inmediato ----------
function onTrabajadorChangeLiq() {
  const trabajadorId = document.getElementById('l-trabajador').value;
  document.getElementById('l-form-wrap').style.display = 'none';
  document.getElementById('l-status').textContent = '';
  if (trabajadorId) {
    cargarHistLiq(trabajadorId);
  } else {
    document.getElementById('l-hist-card').style.display = 'none';
  }
}

// ---------- CARGAR DATOS DEL TRABAJADOR / PERÍODO ----------
async function cargarTrabajadorLiq() {
  const trabajadorId = document.getElementById('l-trabajador').value;
  if (!trabajadorId) { showToast('Selecciona un trabajador', 'error'); return; }
  const t = getTrabajadorById(trabajadorId);
  if (!t) { showToast('Trabajador no encontrado', 'error'); return; }

  trabajadorActualLiq = t;
  mesActualLiq = document.getElementById('l-mes').selectedIndex;
  anioActualLiq = Number(document.getElementById('l-anio').value);

  document.getElementById('lr-nombre').textContent = t.nombre || '';
  document.getElementById('lr-cargo').textContent = t.cargo ? `(${t.cargo})` : '';
  document.getElementById('lr-rut').textContent = t.rut || '—';
  document.getElementById('lr-sbase').textContent = fmtPesos(t.sueldo_base);
  document.getElementById('lr-afp').textContent = t.afp || '—';
  document.getElementById('lr-salud').textContent = t.institucion_salud || '—';
  document.getElementById('lr-periodo').textContent = `${MESES_NOMBRES[mesActualLiq]} ${anioActualLiq}`;

  const { data: liqExist } = await sb.from('liquidaciones').select('*')
    .eq('trabajador_id', trabajadorId).eq('anio', anioActualLiq).eq('mes', mesActualLiq).maybeSingle();

  if (liqExist) {
    registroIdLiq = liqExist.id;
    const d = liqExist.datos || {};
    document.getElementById('d-trab').value = d.dTrab ?? 0;
    document.getElementById('d-lic').value = d.dLic ?? 0;
    document.getElementById('d-aus').value = d.dAus ?? 0;
    document.getElementById('d-vac').value = d.dVac ?? 0;
    document.getElementById('hrs-desc').value = d.hrsDesc ?? 0;
    document.getElementById('hrs-ext').value = d.hrsExt ?? 0;
    document.getElementById('val-hora').value = d.valHora ?? 0;
    document.getElementById('l-status').textContent = `Editando una liquidación ya guardada (actualizada ${new Date(liqExist.updated_at).toLocaleString('es-CL')}).`;
  } else {
    registroIdLiq = null;
    // Importante: se pide dias_data (el registro diario crudo), NO el
    // "resumen" guardado. El resumen es una foto fija calculada con la
    // lógica vigente al momento de guardar la Asistencia — si luego
    // corregimos algo en el cálculo (como hicimos varias veces), los meses
    // guardados antes de esa corrección quedarían con un resumen
    // desactualizado. Recalculando en vivo desde dias_data con la función
    // vigente, la Liquidación siempre refleja la lógica más reciente, sin
    // importar cuándo se guardó esa Asistencia.
    const { data: asis } = await sb.from('asistencia_mensual').select('dias_data')
      .eq('trabajador_id', trabajadorId).eq('anio', anioActualLiq).eq('mes', mesActualLiq).maybeSingle();
    if (asis && asis.dias_data && asis.dias_data.length) {
      const r = consolidarResumenMensual(asis.dias_data, t);
      document.getElementById('d-trab').value = r.diasTrab ?? 0;
      document.getElementById('d-aus').value = r.diasAusentes ?? 0;
      document.getElementById('hrs-desc').value = Number((r.hrsDescTotal ?? 0).toFixed(2));
      document.getElementById('hrs-ext').value = Number((r.hrsExt ?? 0).toFixed(2));
      document.getElementById('val-hora').value = Math.round(r.valHora ?? 0);
      document.getElementById('l-status').textContent = 'Días y horas recalculados en vivo desde el Registro diario de Asistencia de este mes (puedes ajustarlos).';
    } else {
      document.getElementById('d-trab').value = 0;
      document.getElementById('d-aus').value = 0;
      document.getElementById('hrs-desc').value = 0;
      document.getElementById('hrs-ext').value = 0;
      document.getElementById('val-hora').value = 0;
      document.getElementById('l-status').textContent = 'No hay Asistencia guardada para este mes — ingresa los días y horas manualmente.';
    }
    document.getElementById('d-lic').value = 0;
    document.getElementById('d-vac').value = 0;
  }

  document.getElementById('l-form-wrap').style.display = 'block';
  document.getElementById('resultado-box').classList.remove('visible');
  document.getElementById('btn-validar').classList.remove('visible');
  lastCalc = null;
  cargarHistLiq(trabajadorId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- CÁLCULO ----------
function calcularLiq() {
  const t = trabajadorActualLiq;
  if (!t) { showToast('Carga un trabajador primero', 'error'); return; }

  const sbase = t.sueldo_base || 0;
  const dTrab = Number(document.getElementById('d-trab').value) || 0;
  const hrsDesc = Number(document.getElementById('hrs-desc').value) || 0;
  const hrsExt = Number(document.getElementById('hrs-ext').value) || 0;
  const valHora = Number(document.getElementById('val-hora').value) || 0;
  const tasaAfp = t.tasa_afp || 0;
  const afpAdic = t.afp_adicional || 0;
  const planSalud = t.plan_salud || 0;

  const montoHrsDesc = Math.round(hrsDesc * valHora);
  const montoHrsExt = Math.round(hrsExt * valHora * 1.5);
  const sueldoProp = Math.round((sbase / 30) * dTrab) - montoHrsDesc;
  const gratifMensual = Math.round((sueldoProp + montoHrsExt) / 4);
  const totalImponible = sueldoProp + montoHrsExt + gratifMensual;
  const totalAfp = Math.round(totalImponible * (tasaAfp + afpAdic) / 100);
  const aporteSalud = Math.round(totalImponible * planSalud / 100);
  const leyesSociales = totalAfp + aporteSalud;
  const baseTributable = totalImponible - leyesSociales;
  const sueldoLiquido = baseTributable;

  lastCalc = {
    sbase, dTrab, hrsDesc, hrsExt, valHora, tasaAfp, afpAdic, planSalud,
    montoHrsDesc, montoHrsExt, sueldoProp, gratifMensual, totalImponible,
    totalAfp, aporteSalud, leyesSociales, baseTributable, sueldoLiquido,
  };

  document.getElementById('r-hrs-lbl').textContent = `Descuento ${fmt2(hrsDesc)} hrs`;
  document.getElementById('r-hrs').textContent = '-' + fmtPesos(montoHrsDesc);
  document.getElementById('r-hrs').className = 'res-val negativo';
  document.getElementById('r-prop').textContent = fmtPesos(sueldoProp);
  document.getElementById('r-ext-lbl').textContent = `Horas extra (${fmt2(hrsExt)} hrs x1,5)`;
  document.getElementById('r-ext').textContent = fmtPesos(montoHrsExt);
  document.getElementById('r-grat').textContent = fmtPesos(gratifMensual);
  document.getElementById('r-imp').textContent = fmtPesos(totalImponible);
  document.getElementById('r-afp-lbl').textContent = (t.afp || 'AFP') + ` (${fmt2(tasaAfp + afpAdic)}%)`;
  document.getElementById('r-afp').textContent = '-' + fmtPesos(totalAfp);
  document.getElementById('r-sal-lbl').textContent = (t.institucion_salud || 'Salud') + ` (${fmt2(planSalud)}%)`;
  document.getElementById('r-sal').textContent = '-' + fmtPesos(aporteSalud);
  document.getElementById('r-desc').textContent = '-' + fmtPesos(leyesSociales);
  document.getElementById('r-liq').textContent = fmtPesos(sueldoLiquido);

  document.getElementById('resultado-box').classList.add('visible');
  document.getElementById('btn-validar').classList.add('visible');
}

// ---------- VISTA DE IMPRESIÓN + GUARDADO ----------
function mostrarImpresionLiq() {
  if (!lastCalc) { showToast('Primero calcula la liquidación', 'error'); return; }
  const t = trabajadorActualLiq;
  const c = lastCalc;
  const mesNombre = MESES_NOMBRES[mesActualLiq];

  const logoHtml = (empresaCache && empresaCache.logo_url)
    ? `<img src="${empresaCache.logo_url}" alt="Logo" style="width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;display:block;" />`
    : 'LOGO';

  const html = `
    <div class="liq-header">
      <div class="liq-logo">${logoHtml}</div>
      <div>
        <div class="liq-empresa-nombre">${(empresaCache && empresaCache.nombre) || ''}</div>
        <div class="liq-empresa-dir">RUT ${(empresaCache && empresaCache.rut) || ''} — ${(empresaCache && empresaCache.direccion) || ''}</div>
      </div>
    </div>
    <div class="liq-titulo">LIQUIDACIÓN DE SUELDO — ${mesNombre.toUpperCase()} ${anioActualLiq}</div>
    <div class="liq-info-grid">
      <div class="liq-lbl">Trabajador</div><div class="liq-val">${t.nombre || ''}</div>
      <div class="liq-lbl">RUT</div><div class="liq-val">${t.rut || ''}</div>
      <div class="liq-lbl">Cargo</div><div class="liq-val">${t.cargo || ''}</div>
      <div class="liq-lbl">Centro de negocio</div><div class="liq-val">${t.centro_negocio || ''}</div>
      <div class="liq-lbl">Tipo de contrato</div><div class="liq-val">${t.indefinido ? 'Indefinido' : (t.tipo_contrato || '')}</div>
      <div class="liq-lbl">Inicio contrato</div><div class="liq-val">${fmtDate(t.fecha_inicio)}</div>
      <div class="liq-lbl">AFP</div><div class="liq-val">${t.afp || ''}</div>
      <div class="liq-lbl">Salud</div><div class="liq-val">${t.institucion_salud || ''}</div>
    </div>
    <div class="haberes-desc">
      <div>
        <div class="hd-title">Haberes</div>
        <div class="hd-row"><span class="hd-lbl">Sueldo base proporcional (${c.dTrab} días)</span><span class="hd-val">${fmtPesos(c.sueldoProp)}</span></div>
        <div class="hd-row"><span class="hd-lbl">Horas extra (${fmt2(c.hrsExt)} hrs x1,5)</span><span class="hd-val">${fmtPesos(c.montoHrsExt)}</span></div>
        <div class="hd-row"><span class="hd-lbl">Gratificación mensual</span><span class="hd-val">${fmtPesos(c.gratifMensual)}</span></div>
        <div class="hd-row bold"><span class="hd-lbl">Total imponible</span><span class="hd-val">${fmtPesos(c.totalImponible)}</span></div>
      </div>
      <div>
        <div class="hd-title">Descuentos</div>
        <div class="hd-row"><span class="hd-lbl">Horas descontadas (${fmt2(c.hrsDesc)} hrs)</span><span class="hd-val">${fmtPesos(c.montoHrsDesc)}</span></div>
        <div class="hd-row"><span class="hd-lbl">${t.afp || 'AFP'} (${fmt2(c.tasaAfp + c.afpAdic)}%)</span><span class="hd-val">${fmtPesos(c.totalAfp)}</span></div>
        <div class="hd-row"><span class="hd-lbl">${t.institucion_salud || 'Salud'} (${fmt2(c.planSalud)}%)</span><span class="hd-val">${fmtPesos(c.aporteSalud)}</span></div>
        <div class="hd-row bold"><span class="hd-lbl">Total leyes sociales</span><span class="hd-val">${fmtPesos(c.leyesSociales)}</span></div>
      </div>
    </div>
    <div class="totales-box">
      <div class="tot-row"><span class="tot-lbl">Total imponible</span><span class="tot-val">${fmtPesos(c.totalImponible)}</span></div>
      <div class="tot-row"><span class="tot-lbl">Total descuentos</span><span class="tot-val">-${fmtPesos(c.leyesSociales)}</span></div>
      <div class="tot-row"><span class="tot-lbl">Días trabajados</span><span class="tot-val">${c.dTrab}</span></div>
      <div class="tot-row"><span class="tot-lbl">Días de ausencia</span><span class="tot-val">${document.getElementById('d-aus').value || 0}</span></div>
    </div>
    <div class="liquido-box">
      <div class="liquido-lbl">Sueldo líquido a pagar</div>
      <div class="liquido-val">${fmtPesos(c.sueldoLiquido)}</div>
    </div>
    <p class="cert-text">Certifico haber recibido conforme la presente liquidación de sueldo correspondiente al período señalado.</p>
    <div class="firma-line"></div>
    <div class="firma-lbl">Firma trabajador</div>
  `;
  document.getElementById('liq-content').innerHTML = html;

  guardarLiquidacionDB();

  document.getElementById('liq-panel-datos').style.display = 'none';
  document.getElementById('vista-impresion').classList.add('visible');
}

async function guardarLiquidacionDB() {
  if (!lastCalc || !trabajadorActualLiq) return;
  const c = lastCalc;
  const datos = {
    dTrab: c.dTrab,
    dLic: Number(document.getElementById('d-lic').value) || 0,
    dAus: Number(document.getElementById('d-aus').value) || 0,
    dVac: Number(document.getElementById('d-vac').value) || 0,
    hrsDesc: c.hrsDesc, hrsExt: c.hrsExt, valHora: c.valHora,
    montoHrsDesc: c.montoHrsDesc, montoHrsExt: c.montoHrsExt, sueldoProp: c.sueldoProp,
    gratifMensual: c.gratifMensual, totalImponible: c.totalImponible, totalAfp: c.totalAfp,
    aporteSalud: c.aporteSalud, leyesSociales: c.leyesSociales, baseTributable: c.baseTributable,
    sueldoLiquido: c.sueldoLiquido,
  };
  const payload = {
    trabajador_id: trabajadorActualLiq.id, anio: anioActualLiq, mes: mesActualLiq,
    datos, updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from('liquidaciones').upsert(payload, { onConflict: 'trabajador_id,anio,mes' }).select().single();
  if (error) { showToast('Liquidación calculada, pero no se pudo guardar: ' + error.message, 'error'); return; }
  registroIdLiq = data.id;
  showToast('Liquidación guardada ✓');
}

function volverDatosLiq() {
  document.getElementById('vista-impresion').classList.remove('visible');
  document.getElementById('liq-panel-datos').style.display = 'block';
}

// ---------- HISTORIAL ----------
async function cargarHistLiq(trabajadorId) {
  const { data, error } = await sb.from('liquidaciones').select('anio,mes,updated_at,datos')
    .eq('trabajador_id', trabajadorId).order('anio', { ascending: false }).order('mes', { ascending: false });
  const card = document.getElementById('l-hist-card');
  const list = document.getElementById('l-hist-list');
  if (error || !data || !data.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  list.innerHTML = data.map(r => `
    <div class="hist-item" onclick="document.getElementById('l-mes').selectedIndex=${r.mes}; document.getElementById('l-anio').value='${r.anio}'; cargarTrabajadorLiq();">
      <span>${MESES_NOMBRES[r.mes]} ${r.anio}</span>
      <span class="hist-meta">${r.datos && r.datos.sueldoLiquido ? fmtPesos(r.datos.sueldoLiquido) + ' · ' : ''}${new Date(r.updated_at).toLocaleDateString('es-CL')}</span>
    </div>`).join('');
}
