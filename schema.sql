-- ============================================================
-- Esquema de base de datos para Control de Asistencia y
-- Liquidaciones - The Wizard Coffee SPA
-- Ejecutar completo en Supabase: Project > SQL Editor > New query
-- ============================================================

-- Extensión necesaria para generar UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabla: empresa (una sola fila con los datos de la empresa)
-- ------------------------------------------------------------
create table if not exists empresa (
  id int primary key default 1,
  rut text default '',
  nombre text default '',
  direccion text default '',
  updated_at timestamptz default now(),
  constraint empresa_single_row check (id = 1)
);

insert into empresa (id, rut, nombre, direccion)
values (1, '77.555.667-6', 'THE WIZARD COFFEE SPA', 'HOMERO ÁVILA 850')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Tabla: trabajadores
-- ------------------------------------------------------------
create table if not exists trabajadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rut text default '',
  cargo text default '',
  centro_negocio text default '',
  tipo_contrato text default 'PLAZO FIJO',
  fecha_inicio date,
  fecha_fin date,
  sueldo_base numeric default 0,
  afp text default '',
  tasa_afp numeric default 10.46,
  afp_adicional numeric default 0,
  institucion_salud text default 'FONASA',
  plan_salud numeric default 7,
  dias_laborales text default 'lunes-viernes',
  hrs_semana numeric default 44,
  horario_semana jsonb default '{}'::jsonb,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Tabla: asistencia_mensual (un registro por trabajador/mes/año)
-- ------------------------------------------------------------
create table if not exists asistencia_mensual (
  id uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references trabajadores(id) on delete cascade,
  anio int not null,
  mes int not null, -- 0 = enero ... 11 = diciembre
  dias_data jsonb not null default '[]'::jsonb,
  resumen jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (trabajador_id, anio, mes)
);

-- ------------------------------------------------------------
-- Tabla: liquidaciones (un registro por trabajador/mes/año)
-- ------------------------------------------------------------
create table if not exists liquidaciones (
  id uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references trabajadores(id) on delete cascade,
  anio int not null,
  mes int not null,
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (trabajador_id, anio, mes)
);

-- ------------------------------------------------------------
-- Seguridad: Row Level Security
-- Solo usuarios autenticados (con sesión iniciada) pueden
-- leer/escribir. El público (anon sin sesión) no puede acceder.
-- ------------------------------------------------------------
alter table empresa enable row level security;
alter table trabajadores enable row level security;
alter table asistencia_mensual enable row level security;
alter table liquidaciones enable row level security;

drop policy if exists "auth_all_empresa" on empresa;
create policy "auth_all_empresa" on empresa
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_trabajadores" on trabajadores;
create policy "auth_all_trabajadores" on trabajadores
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_asistencia" on asistencia_mensual;
create policy "auth_all_asistencia" on asistencia_mensual
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_liquidaciones" on liquidaciones;
create policy "auth_all_liquidaciones" on liquidaciones
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
