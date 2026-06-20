# Control de Personal — The Wizard Coffee SPA

Aplicación web (estática, sin servidor propio) para gestionar trabajadores,
registrar su asistencia mensual y generar sus liquidaciones de sueldo. Toda
la información se guarda en **Supabase** y la app se aloja gratis en
**GitHub Pages**.

## Qué hace

- **Pestaña Trabajadores**: creas una ficha por cada trabajador (nombre, RUT,
  cargo, sueldo base, AFP, salud, días laborales y horario esperado por día).
  Puedes editar, archivar o eliminar a cada uno.
- **Pestaña Asistencia**: eliges un trabajador y un mes, y se genera
  automáticamente la planilla de días según su horario configurado. Marcas
  cada día como Normal / Extra / Ausente / Libre / Feriado y ajustas horas
  reales. Se guarda en Supabase, mes por mes, por trabajador.
- **Pestaña Liquidación**: eliges un trabajador y un mes. Si ya generaste su
  Asistencia de ese mes, los días/horas se autocompletan; si no, los ingresas
  a mano. Calcula y guarda la liquidación, y la deja lista para imprimir o
  guardar como PDF.

Cada trabajador tiene su propio historial de meses guardados, visible en
ambas pestañas.

## Novedades de esta versión — corrección de bugs críticos reportados (Mayo 2026)

Reescribí por completo la consolidación mensual/semanal en una sola función
(`consolidarResumenMensual`), que reemplaza todo lo anterior. Corrige los 3
problemas reportados:

1. **Semanas parciales de inicio/fin de mes** (ej. el mes empieza un
   viernes): antes la meta de 42h se aplicaba completa aunque la semana solo
   tuviera 1 o 2 días dentro del mes, dando descuentos absurdos como "-36".
   Ahora la meta se prorratea según cuántos días contractuales de esa semana
   sí caen dentro del mes (ej. 2 de 5 días → meta de 16,8h en vez de 42h). En
   "Resumen semanal" vas a ver una ⚠️ en las semanas detectadas como
   parciales, con el detalle de días/meta usada.
2. **Licuadora no se aplicaba correctamente**: ahora extra y descuento de la
   misma semana nunca se muestran "sueltos" — uno de los dos siempre queda
   en 0 una vez aplicada la compensación. Agregué dos columnas nuevas a la
   tabla ("→ Extra final" y "→ Descuento final") para que sea inconfundible
   cuál es el resultado que efectivamente se usa en la liquidación, separado
   de las columnas de horas "en bruto" (antes de compensar).
3. **Desfase entre la pantalla diaria y el resumen semanal**: ahora ambos se
   calculan en una sola pasada, reutilizando exactamente el mismo cálculo
   por día — estructuralmente ya no es posible que la tabla diaria y el
   resumen semanal muestren números distintos para los mismos días.

## Novedades de la versión anterior

- **Refactor de la compensación semanal (`consolidarSemana`)**: antes el
  sistema comparaba la suma de horas extra diarias contra la suma de horas
  de descuento diarias. Ahora calcula la deuda de la semana de arriba hacia
  abajo: meta semanal fija (ej. 42h) menos las horas ordinarias
  efectivamente trabajadas, y recién ahí usa las horas extra para cubrir esa
  deuda. Esto evita arrastrar pequeños errores de redondeo de la suma día a
  día y deja el cálculo legal más preciso. Las horas extra "fuera de
  horario" (ej. domingos) siguen sin entrar a esta compensación, tal como
  ya funcionaba.

## Novedades de la versión anterior

- **Corrección del cálculo de colación en turnos cortos**: antes, al
  calcular las horas reales trabajadas (verdes) y las de descuento (rojas),
  el sistema descontaba la colación que estuviera *configurada* en el
  horario del trabajador (que podía no ser 1 hora), incluso en turnos
  cortos. Ahora hay una función dedicada (`calcularDiaTrabajo`) que sigue
  estrictamente la regla legal: si la permanencia real (entrada a salida)
  es de 5 horas o menos, no se descuenta colación; si es mayor a 5 horas,
  se descuenta siempre 1 hora fija — sin importar lo que esté configurado
  en la ficha del trabajador. Esto aplica tanto a los días trabajados como
  al cálculo teórico de un día de ausencia completa.

> Nota: el horario *planificado* del trabajador (Trabajadores →
> Configuración de jornada) sigue usando la colación que tú configures ahí
> para calcular la meta de horas esperadas del día — solo cambió cómo se
> calcula la colación de la asistencia *real*.

## Novedades de la versión anterior

- **Horas extra fuera del horario semanal contratado**: si un trabajador
  trabaja un día que NO es parte de su horario semanal normal (por ejemplo,
  vino en su día libre), esas horas ya no se usan para compensar horas de
  descuento de esa semana — pasan completas y directas a la liquidación como
  horas extra. Esto se distingue ahora en el "Resumen semanal" con la
  columna "Extra fuera de horario".

## Novedades de la versión anterior

- **Nuevo tipo de día "Norm/Feriado"**: para un día que normalmente es
  laboral pero cae en feriado. Las horas trabajadas ese día se pagan 100%
  como hora extra, y si no se alcanzó a cubrir el horario habitual, esa
  diferencia igual aparece como horas de descuento.
- **Regla de colación**: si la permanencia total del día (de entrada a
  salida real) es de 5 horas o menos, no se descuenta colación.
- **Registro diario por semanas**: la tabla de asistencia ahora muestra un
  separador por cada semana (lunes a domingo), y se agregó una sección
  "Resumen semanal" — antes de "Datos para la liquidación" — con horas
  normales, extra, descuento y el neto (extra − descuento) de cada semana.
- **Compensación semanal de horas extra/descuento**: para cuadrar las horas
  semanales del contrato, las horas extra de una semana solo cubren las
  horas de descuento de esa misma semana. Si no alcanzan a cubrirlas, el
  remanente de descuento pasa directo a la liquidación; si sobran extras
  tras cubrir el descuento, esas pasan directo como extra. Esto reemplaza el
  cálculo anterior (que sumaba todo el mes de corrido) tanto en el resumen
  del mes como en lo que se autocompleta en Liquidación.

> Nota: la regla de colación (punto 2) la apliqué solo al cálculo de horas
> reales trabajadas en Asistencia, no al horario configurado en la ficha del
> trabajador (Trabajadores → Configuración de jornada). Si también la
> necesitas ahí, dime y la agrego.

## Novedades de la versión anterior

- **Pestaña Empresa** (nueva, en la barra superior): ahí están el RUT, nombre y
  dirección de la empresa, y el **logo** que aparece en las liquidaciones.
- **Contrato en PDF**: en la ficha de cada trabajador puedes subir su
  contrato de trabajo (PDF). Queda guardado y se puede ver/reemplazar en
  cualquier momento, tanto desde el formulario como desde un botón "📄
  Contrato" en la lista de trabajadores.
- **Más datos de ficha**: domicilio, teléfono, correo y datos bancarios
  (banco, tipo y número de cuenta). Son solo de referencia, no se usan en el
  cálculo de la liquidación.
- **Contrato indefinido**: casilla bajo "Fin contrato" — si la marcas, el
  campo de fecha se deshabilita y queda guardado como indefinido.
- En **Liquidación**, los datos de empresa/trabajador ya no se muestran como
  formularios grandes — ahora aparece solo un resumen compacto ("Liquidando
  a: nombre, RUT, sueldo base, AFP, salud, período") y la lista de
  liquidaciones guardadas aparece apenas eliges el trabajador, sin necesidad
  de presionar "Cargar datos" primero.
- Al imprimir la **Asistencia**, solo se imprime desde "Registro diario"
  hacia abajo (la tabla de días y los datos para la liquidación); el
  selector de período y el resumen de arriba ya no salen en el papel/PDF.

### Si ya tenías el proyecto funcionando (migración)

Si ya habías ejecutado `schema.sql` antes, **no hace falta borrar nada**:
vuelve a abrir el SQL Editor de Supabase y ejecuta el archivo `schema.sql`
completo de nuevo — el bloque final de "MIGRACIÓN" agrega las columnas y los
buckets de almacenamiento nuevos sin tocar tus datos existentes. Es seguro
correrlo más de una vez.

Después solo asegúrate de subir los archivos actualizados (`index.html`,
`styles.css`, `app.js`, `empresa.js`, `trabajadores.js`, `asistencia.js`,
`liquidacion.js`) a tu repositorio de GitHub, reemplazando los anteriores.

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto nuevo
   (gratis).
2. Ve a **SQL Editor** → **New query**, pega todo el contenido del archivo
   `schema.sql` de esta carpeta, y ejecútalo. Esto crea las 4 tablas
   (`empresa`, `trabajadores`, `asistencia_mensual`, `liquidaciones`) con la
   seguridad ya configurada (solo tú, con sesión iniciada, puedes leer/escribir).
3. Ve a **Authentication → Users → Add user**, y crea un usuario con tu
   correo y una contraseña. Esa va a ser la contraseña con la que entras a la
   app (puedes crear más de uno si en el futuro alguien más de confianza
   necesita acceso).
4. Ve a **Project Settings → API** y copia dos valores:
   - **Project URL**
   - **anon public** key

## 2. Configurar la app

Abre el archivo `config.js` y reemplaza estas dos líneas con los valores que
copiaste:

```js
const SUPABASE_URL = "TU_SUPABASE_URL_AQUI";
const SUPABASE_ANON_KEY = "TU_SUPABASE_ANON_KEY_AQUI";
```

Guarda el archivo.

## 3. Subir a GitHub Pages

1. Crea un repositorio nuevo en GitHub (puede ser privado).
2. Sube todos los archivos de esta carpeta (`index.html`, `styles.css`,
   `config.js`, `app.js`, `empresa.js`, `trabajadores.js`, `asistencia.js`,
   `liquidacion.js`) a la raíz del repositorio.
3. Ve a **Settings → Pages**, en "Source" elige la rama `main` y carpeta `/
   (root)`, guarda.
4. En un par de minutos GitHub te da una URL tipo
   `https://tu-usuario.github.io/tu-repo/` — esa es tu app, accesible desde
   cualquier navegador o celular.

> Nota sobre seguridad: aunque el repositorio sea público o la URL sea
> conocida, nadie puede leer ni modificar los datos sin iniciar sesión con el
> usuario que creaste en el paso 1 — la base de datos lo exige a nivel de
> Supabase (Row Level Security), no solo a nivel de pantalla de login.

## 4. Primer uso

1. Entra a la URL, inicia sesión con el correo/contraseña que creaste.
2. En la pestaña **Trabajadores**, revisa/edita los datos de la empresa
   arriba, y crea tu primer trabajador con "+ Nuevo trabajador".
3. Ve a **Asistencia**, selecciona ese trabajador, el mes y año, y presiona
   "Cargar / Generar".
4. Ve a **Liquidación** cuando quieras generar su liquidación de ese mes.

## Cosas a tener en cuenta (decisiones que tomé y puedes ajustar)

- En Asistencia, el campo **"Horas descontadas"** que se traspasa a
  Liquidación combina las **ausencias de día completo** y las **salidas
  anticipadas/atrasos** de días trabajados, ya que en Liquidación solo existe
  un campo para eso. Si prefieres tratarlas distinto, dímelo y lo separamos.
- Los datos de la empresa (RUT, nombre, dirección) son compartidos por todos
  los trabajadores — se editan una sola vez en la pestaña Trabajadores.
- "Eliminar" un trabajador borra también toda su asistencia y liquidaciones
  guardadas (hay una confirmación antes de hacerlo). Si solo quieres dejar de
  verlo en las listas activas pero conservar su historial, usa "Archivar".
- Cada mes de asistencia y cada liquidación se guarda una sola vez por
  trabajador/mes/año — si vuelves a guardar el mismo mes, se sobrescribe (así
  puedes corregir errores sin duplicar registros).

## Si algo falla

- Pantalla de login no entra: revisa que el correo/contraseña sean
  exactamente los que creaste en Supabase Authentication.
- "No se pudo cargar la empresa/trabajadores": revisa que `config.js` tenga
  la URL y la key correctas, y que hayas ejecutado `schema.sql` completo.
- Si necesitas agregar más usuarios con acceso, créalos en Supabase
  Authentication → Users, no hace falta tocar el código.
