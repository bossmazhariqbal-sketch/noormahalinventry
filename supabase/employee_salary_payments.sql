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
  amount numeric(12,2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (employee_id, owner_id) references public.employees(id, owner_id) on delete cascade
);

create index if not exists salary_payments_owner_date_idx
  on public.salary_payments(owner_id, date desc);

alter table public.salary_payments enable row level security;
drop policy if exists "Owners manage salary payments" on public.salary_payments;
create policy "Owners manage salary payments"
  on public.salary_payments
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.salary_payments to authenticated;
