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

## Novedades de esta versión

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
