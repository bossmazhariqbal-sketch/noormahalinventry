-- Employee attendance fixes + monthly salary payment history.
-- Safe to run more than once. Run in Supabase > SQL Editor AFTER schema.sql and demand_staff.sql.
begin;

-- 1) attendance: one row per employee per date (the app saves with upsert on employee_id,date).
alter table public.attendance
  add column if not exists paid boolean not null default false;

-- Remove old duplicates first (keep the newest row), otherwise the unique index cannot be created.
delete from public.attendance a
using public.attendance b
where a.employee_id = b.employee_id
  and a.date = b.date
  and (a.created_at, a.id) < (b.created_at, b.id);

create unique index if not exists attendance_employee_id_date_key
  on public.attendance(employee_id, date);

-- Keep data consistent: only On time / Late days can be Paid; late minutes only on Late days.
update public.attendance set late_minutes = 0 where status <> 'late' and late_minutes <> 0;
update public.attendance set paid = false where paid and status not in ('on_time', 'late');
alter table public.attendance drop constraint if exists attendance_paid_requires_present;
alter table public.attendance add constraint attendance_paid_requires_present
  check (not paid or status in ('on_time', 'late'));
alter table public.attendance drop constraint if exists attendance_late_minutes_only_when_late;
alter table public.attendance add constraint attendance_late_minutes_only_when_late
  check (status = 'late' or late_minutes = 0);

-- 2) monthly salary payments (partial or full), always tied to one employee of the same owner.
create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  employee_id uuid not null,
  date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (employee_id, owner_id) references public.employees(id, owner_id) on delete cascade
);

-- Which salary month the payment is for (a payment on 1 March can settle February).
alter table public.salary_payments add column if not exists salary_month date;
update public.salary_payments set salary_month = date_trunc('month', date)::date where salary_month is null;
alter table public.salary_payments alter column salary_month set default date_trunc('month', current_date)::date;
alter table public.salary_payments alter column salary_month set not null;
alter table public.salary_payments drop constraint if exists salary_payments_month_first_day;
alter table public.salary_payments add constraint salary_payments_month_first_day
  check (salary_month = date_trunc('month', salary_month)::date);

create index if not exists salary_payments_owner_date_idx
  on public.salary_payments(owner_id, date desc);
create index if not exists salary_payments_owner_employee_month_idx
  on public.salary_payments(owner_id, employee_id, salary_month);

-- 3) security: row level security + grants (signed-in owner only).
alter table public.salary_payments enable row level security;
drop policy if exists "Owners manage salary payments" on public.salary_payments;
create policy "Owners manage salary payments"
  on public.salary_payments
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke all on public.salary_payments from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.salary_payments to authenticated;

commit;

-- Optional checks (run separately):
--   select employee_id, date, count(*) from public.attendance group by 1, 2 having count(*) > 1;  -- should return no rows
--   select relrowsecurity from pg_class where oid = 'public.salary_payments'::regclass;           -- should be true
