-- CLMIS DATABASE SCHEMA
-- Run in Supabase SQL Editor.
-- Never expose the Supabase service-role key in frontend code.

create extension if not exists pgcrypto;

create type public.user_role as enum ('student','teacher','admin');
create type public.assessment_stage as enum ('pre','mid','post');
create type public.difficulty_level as enum ('easy','intermediate','advanced');
create type public.question_status as enum ('active','inactive');
create type public.competency_level as enum ('basic','intermediate','advanced','not_yet_classified');
create type public.intervention_status as enum ('assigned','in_progress','completed');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_number text unique,
  full_name text not null,
  age integer check (age is null or age between 10 and 100),
  gender text check (gender in ('Male','Female') or gender is null),
  grade_level text,
  section text,
  email text,
  role public.user_role not null default 'student',
  device_ownership text,
  device_used text,
  internet_access text,
  daily_device_usage text,
  computer_experience text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_schedules (
  id uuid primary key default gen_random_uuid(),
  stage public.assessment_stage not null,
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  stage public.assessment_stage not null,
  domain text not null,
  difficulty public.difficulty_level not null,
  question_text text not null,
  choices jsonb not null,
  correct_answer text not null,
  explanation text,
  status public.question_status not null default 'active',
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  stage public.assessment_stage not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(5,2) not null default 0,
  correct_count integer not null default 0,
  competency public.competency_level not null default 'not_yet_classified',
  status text not null default 'in_progress' check (status in ('in_progress','submitted','expired','authorized_retake')),
  unique(student_id, stage)
);

create table if not exists public.attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  question_order integer not null,
  displayed_choices jsonb not null,
  selected_answer text,
  is_correct boolean,
  saved_at timestamptz,
  unique(attempt_id, question_id)
);

create table if not exists public.domain_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  domain text not null,
  correct_count integer not null default 0,
  question_count integer not null default 4,
  score numeric(5,2) not null default 0,
  unique(attempt_id, domain)
);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  domain text not null,
  title text not null,
  description text,
  resource_url text,
  status public.intervention_status not null default 'assigned',
  assigned_by uuid references public.profiles(id),
  teacher_remarks text,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.retake_authorizations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  stage public.assessment_stage not null,
  authorized_by uuid not null references public.profiles(id),
  reason text,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_section on public.profiles(section);
create index if not exists idx_questions_stage_domain on public.questions(stage,domain);
create index if not exists idx_attempts_student on public.assessment_attempts(student_id);
create index if not exists idx_notifications_recipient on public.notifications(recipient_id);

-- Automatically create a profile after authentication.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name','New User'),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role,'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Keep updated_at current.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute procedure public.touch_updated_at();

drop trigger if exists questions_touch on public.questions;
create trigger questions_touch before update on public.questions
for each row execute procedure public.touch_updated_at();

-- Helper role function.
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- RLS.
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.attempt_questions enable row level security;
alter table public.domain_scores enable row level security;
alter table public.interventions enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.assessment_schedules enable row level security;
alter table public.audit_logs enable row level security;
alter table public.retake_authorizations enable row level security;

-- Profiles
create policy "profiles self read" on public.profiles for select using (
  id = auth.uid() or public.current_role() in ('teacher','admin')
);
create policy "profiles self update" on public.profiles for update using (
  id = auth.uid() or public.current_role() in ('teacher','admin')
);
create policy "profiles admin insert" on public.profiles for insert with check (
  id = auth.uid() or public.current_role() in ('teacher','admin')
);

-- Questions: students can read active questions needed by assessment;
-- answer keys must NOT be selected to the browser in production.
create policy "questions authorized read" on public.questions for select using (
  status = 'active' or public.current_role() in ('teacher','admin')
);
create policy "questions teacher admin write" on public.questions for all using (
  public.current_role() in ('teacher','admin')
) with check (
  public.current_role() in ('teacher','admin')
);

-- Attempts
create policy "attempt own or staff read" on public.assessment_attempts for select using (
  student_id = auth.uid() or public.current_role() in ('teacher','admin')
);
create policy "attempt own create" on public.assessment_attempts for insert with check (
  student_id = auth.uid()
);
create policy "attempt own update or staff" on public.assessment_attempts for update using (
  student_id = auth.uid() or public.current_role() in ('teacher','admin')
);

-- Attempt answers
create policy "attempt questions own/staff" on public.attempt_questions for all using (
  exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_id
      and (a.student_id = auth.uid() or public.current_role() in ('teacher','admin'))
  )
);

-- Domain scores
create policy "domain scores own/staff" on public.domain_scores for select using (
  exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_id
      and (a.student_id = auth.uid() or public.current_role() in ('teacher','admin'))
  )
);

-- Interventions
create policy "interventions own/staff" on public.interventions for select using (
  student_id = auth.uid() or public.current_role() in ('teacher','admin')
);
create policy "interventions staff write" on public.interventions for all using (
  public.current_role() in ('teacher','admin')
) with check (
  public.current_role() in ('teacher','admin')
);

-- Notifications
create policy "notifications own" on public.notifications for select using (recipient_id = auth.uid());
create policy "notifications own update" on public.notifications for update using (recipient_id = auth.uid());

-- Announcements
create policy "announcements authenticated read" on public.announcements for select using (auth.uid() is not null);
create policy "announcements staff write" on public.announcements for all using (
  public.current_role() in ('teacher','admin')
) with check (public.current_role() in ('teacher','admin'));

-- Schedules
create policy "schedules authenticated read" on public.assessment_schedules for select using (auth.uid() is not null);
create policy "schedules staff write" on public.assessment_schedules for all using (
  public.current_role() in ('teacher','admin')
) with check (public.current_role() in ('teacher','admin'));

-- Audit logs
create policy "audit staff read" on public.audit_logs for select using (public.current_role() in ('teacher','admin'));
create policy "audit authenticated insert" on public.audit_logs for insert with check (actor_id = auth.uid());

-- Retakes
create policy "retakes own/staff read" on public.retake_authorizations for select using (
  student_id = auth.uid() or public.current_role() in ('teacher','admin')
);
create policy "retakes staff write" on public.retake_authorizations for all using (
  public.current_role() in ('teacher','admin')
) with check (public.current_role() in ('teacher','admin'));

-- Initial question seed from the supplied CLMIS assessment.
insert into public.questions(stage,domain,difficulty,question_text,choices,correct_answer)
select 'pre','Microsoft Office Skills','easy',
'Which Microsoft application is primarily used for creating documents?',
'["Excel","Word","PowerPoint","Access"]','Word'
where not exists (
  select 1 from public.questions where question_text='Which Microsoft application is primarily used for creating documents?'
);

insert into public.questions(stage,domain,difficulty,question_text,choices,correct_answer)
select 'pre','Microsoft Office Skills','easy',
'Which Microsoft application is commonly used to create presentations?',
'["Word","Excel","PowerPoint","OneNote"]','PowerPoint'
where not exists (
  select 1 from public.questions where question_text='Which Microsoft application is commonly used to create presentations?'
);

insert into public.questions(stage,domain,difficulty,question_text,choices,correct_answer)
select 'pre','Microsoft Office Skills','easy',
'What symbol is used to begin a formula in Microsoft Excel?',
'["#","=","@","%"]','='
where not exists (
  select 1 from public.questions where question_text='What symbol is used to begin a formula in Microsoft Excel?'
);

insert into public.questions(stage,domain,difficulty,question_text,choices,correct_answer)
select 'pre','Microsoft Office Skills','easy',
'Which Excel function is used to calculate the total of numbers?',
'["COUNT","SUM","MAX","AVERAGE"]','SUM'
where not exists (
  select 1 from public.questions where question_text='Which Excel function is used to calculate the total of numbers?'
);

-- The remaining supplied questions can be imported through the Teacher Question Bank.
-- This avoids silently changing the source assessment content.
