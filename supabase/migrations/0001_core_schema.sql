-- SMA Negeri 2 Cimalaka QR attendance MVP
-- School policy values below are provisional and remain configurable.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'teacher', 'student');
create type public.attendance_type as enum ('check_in', 'check_out');
create type public.attendance_method as enum ('qr', 'manual');
create type public.attendance_status as enum ('present', 'late');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique,
  name text not null,
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  login_id text not null unique,
  name text not null,
  class_name text not null,
  nis text unique,
  nisn text unique,
  account_claimed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_claim_consistency check (
    (account_claimed and user_id is not null) or
    (not account_claimed and user_id is null)
  )
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  teacher_id text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance_settings (
  id boolean primary key default true check (id),
  timezone text not null default 'Asia/Jakarta',
  qr_expiration_seconds integer not null default 300 check (qr_expiration_seconds between 60 and 3600),
  check_in_start time not null default '06:00',
  check_in_end time not null default '07:15',
  check_out_start time not null default '14:00',
  check_out_end time not null default '17:00',
  late_after time,
  require_check_in_before_check_out boolean not null default false,
  is_provisional boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.attendance_settings (id) values (true) on conflict do nothing;

create table public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  attendance_type public.attendance_type not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  constraint qr_expiry_after_creation check (expires_at > created_at)
);

create unique index one_active_qr_token
  on public.qr_tokens (is_active)
  where is_active;

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  attendance_date date not null,
  type public.attendance_type not null,
  recorded_at timestamptz not null default now(),
  method public.attendance_method not null,
  qr_token_id uuid references public.qr_tokens(id),
  recorded_by uuid not null references auth.users(id),
  status public.attendance_status not null default 'present',
  notes text,
  created_at timestamptz not null default now(),
  constraint qr_method_has_token check (
    (method = 'qr' and qr_token_id is not null) or
    (method = 'manual' and qr_token_id is null)
  ),
  constraint one_attendance_per_type_per_day unique (student_id, attendance_date, type)
);

create index attendance_date_idx on public.attendance (attendance_date desc);
create index attendance_student_date_idx on public.attendance (student_id, attendance_date desc);
create index students_class_idx on public.students (class_name);
create index qr_tokens_expiry_idx on public.qr_tokens (expires_at) where is_active;

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.attendance_settings enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.attendance enable row level security;

create policy "profile owner reads own profile" on public.profiles
  for select using (id = auth.uid());
create policy "admin reads all profiles" on public.profiles
  for select using (public.current_app_role() = 'admin');

create policy "staff reads students" on public.students
  for select using (public.current_app_role() in ('admin', 'teacher'));
create policy "student reads own master record" on public.students
  for select using (user_id = auth.uid());
create policy "admin manages students" on public.students
  for all using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "staff reads teachers" on public.teachers
  for select using (public.current_app_role() in ('admin', 'teacher'));
create policy "admin manages teachers" on public.teachers
  for all using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "authenticated reads attendance settings" on public.attendance_settings
  for select using (auth.uid() is not null);
create policy "admin updates attendance settings" on public.attendance_settings
  for update using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "staff reads qr tokens" on public.qr_tokens
  for select using (public.current_app_role() in ('admin', 'teacher'));

create policy "staff reads all attendance" on public.attendance
  for select using (public.current_app_role() in ('admin', 'teacher'));
create policy "student reads own attendance" on public.attendance
  for select using (
    exists (select 1 from public.students s where s.id = student_id and s.user_id = auth.uid())
  );

-- Inserts and security-sensitive mutations are intentionally not granted through
-- direct client RLS policies. Implement them as server-side RPC/Edge Function
-- transactions that derive identity from auth.uid(), hash QR tokens, validate
-- local-time rules, and map unique violations to a duplicate-attendance result.

