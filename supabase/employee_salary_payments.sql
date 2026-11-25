-- Employee attendance compatibility and monthly salary payment history.
alter table public.attendance
  add column if not exists paid boolean not null default false;

create unique index if not exists attendance_employee_id_date_key
  on public.attendance(employee_id, date);

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  employee_id uuid not null,
  date date not null default current_date,
  salary_month date,
  amount numeric(12,2) not null check (amount > 0),
  is_settlement boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (employee_id, owner_id) references public.employees(id, owner_id) on delete cascade
);

alter table public.salary_payments add column if not exists salary_month date;
update public.salary_payments set salary_month = date_trunc('month', date)::date where salary_month is null;
alter table public.salary_payments alter column salary_month set default date_trunc('month', current_date)::date;
alter table public.salary_payments alter column salary_month set not null;
alter table public.salary_payments drop constraint if exists salary_payments_month_first_day;
alter table public.salary_payments add constraint salary_payments_month_first_day
  check (salary_month = date_trunc('month', salary_month)::date);
alter table public.salary_payments add column if not exists is_settlement boolean not null default false;

create index if not exists salary_payments_owner_date_idx
  on public.salary_payments(owner_id, date desc);
create index if not exists salary_payments_owner_employee_month_idx
  on public.salary_payments(owner_id, employee_id, salary_month);

alter table public.salary_payments enable row level security;
drop policy if exists "Owners manage salary payments" on public.salary_payments;
create policy "Owners manage salary payments"
  on public.salary_payments
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.salary_payments to authenticated;
