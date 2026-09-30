-- Pozo Común — esquema de base de datos para Supabase
-- Ejecutar en el SQL Editor de tu proyecto Supabase (una sola vez).

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz default now()
);

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points integer not null,
  days integer[] not null,              -- 0=domingo ... 6=sábado
  type text not null default 'custom' check (type in ('custom','gym','run')),
  kind text not null default 'boolean' check (kind in ('boolean','quantity')),
  unit text,
  target numeric,
  step numeric,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references habits(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  log_date date not null,
  amount numeric,
  points integer not null,
  created_at timestamptz default now(),
  unique (habit_id, user_id, log_date)
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null check (type in ('strength','cardio')),
  exercise_name text,
  sets jsonb,
  duration_min numeric,
  distance_km numeric,
  log_date date not null default current_date,
  created_at timestamptz default now()
);

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cost_points integer not null,
  emoji text default '🎁',
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid references rewards(id),
  redeemed_by uuid references users(id),
  points_spent integer not null,
  redeemed_at timestamptz default now()
);

-- Datos iniciales -----------------------------------------------------

insert into users (name, role) values
  ('Nico', 'admin'),
  ('Compañero/a', 'member');

insert into habits (name, points, days, type, kind, unit, target, step) values
  ('Ir al gimnasio', 10, '{1,3,5}', 'gym', 'boolean', null, null, null),
  ('Salir a correr', 10, '{2,4}', 'run', 'boolean', null, null, null),
  ('Tomar agua', 4, '{0,1,2,3,4,5,6}', 'custom', 'quantity', 'vasos', 8, 1),
  ('Leer', 6, '{1,2,3,4,5}', 'custom', 'quantity', 'min', 20, 10),
  ('Dormir 7+ horas', 5, '{0,1,2,3,4,5,6}', 'custom', 'quantity', 'horas', 7, 1);

insert into rewards (name, description, cost_points, emoji) values
  ('Permitido / Gaseosa', 'Una Coca-Cola sin culpa', 30, '🥤'),
  ('Elegir el juego de la noche', 'Vos decidís a qué jugamos hoy', 25, '🎮'),
  ('Elegir qué comer', 'Elegís el menú de la próxima comida juntos', 35, '🍽️'),
  ('Elegir la película', 'Decidís qué vemos el próximo finde', 40, '🎬'),
  ('Desayuno en la cama', 'El otro te lo prepara y te lo lleva', 45, '🛏️'),
  ('Masaje de 15 min', 'El otro te da un masaje a tu elección', 50, '💆'),
  ('El otro hace las tareas de hoy', 'Un día libre de tareas domésticas', 55, '🧺'),
  ('Noche libre de tareas', 'El otro se encarga de todo esta noche', 60, '🌙'),
  ('Comodín: perdón un hábito', 'Un hábito fallado de hoy no resta puntos', 70, '🃏'),
  ('Salida sorpresa', 'El otro organiza un plan sorpresa para los dos', 90, '🌅');

-- Realtime --------------------------------------------------------------
-- Habilitá Realtime para estas tablas desde Database > Replication en el
-- panel de Supabase (o descomentá y corré esto si tu proyecto lo permite):
-- alter publication supabase_realtime add table habit_logs, workouts, redemptions, habits, rewards;

-- Seguridad ---------------------------------------------------------------
-- Para esta app de uso privado entre dos personas, dejamos RLS desactivado
-- (por defecto en tablas nuevas) para simplificar el MVP. Si vas a compartir
-- el link más ampliamente, activá RLS y agregá policies, o sumá Supabase Auth.
