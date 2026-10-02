-- Daily demand
create table if not exists public.daily_demands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null default current_date,
  note text not null default '',
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  unique (id, owner_id)
);
create table if not exists public.demand_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  demand_id uuid not null,
  item_id uuid not null,
  quantity numeric(12,3) not null check (quantity > 0),
  foreign key (demand_id, owner_id) references public.daily_demands(id, owner_id) on delete cascade,
  foreign key (item_id, owner_id) references public.inventory_items(id, owner_id) on delete restrict
);
create index if not exists daily_demands_owner_date_idx on public.daily_demands(owner_id, date desc);
create index if not exists demand_items_demand_idx on public.demand_items(owner_id, demand_id);
alter table public.daily_demands enable row level security;
alter table public.demand_items enable row level security;
drop policy if exists "Owners manage demands" on public.daily_demands;
create policy "Owners manage demands" on public.daily_demands for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage demand items" on public.demand_items;
create policy "Owners manage demand items" on public.demand_items for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.daily_demands, public.demand_items to authenticated;

create or replace function public.save_demand(p_date date, p_note text, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_id uuid := gen_random_uuid(); v_line jsonb; v_qty numeric;
begin
  if v_owner is null then raise exception 'Sign in is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Kam az kam ek item add karein'; end if;
  insert into public.daily_demands (id, owner_id, date, note) values (v_id, v_owner, coalesce(p_date, current_date), coalesce(p_note, ''));
  for v_line in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_line ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Quantity zero se zyada honi chahiye'; end if;
    perform 1 from public.inventory_items where id = (v_line ->> 'item_id')::uuid and owner_id = v_owner;
    if not found then raise exception 'Inventory item not found'; end if;
    insert into public.demand_items (owner_id, demand_id, item_id, quantity) values (v_owner, v_id, (v_line ->> 'item_id')::uuid, v_qty);
  end loop;
  return v_id;
end; $$;

create or replace function public.complete_demand(p_demand_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_status text; v_line record; v_stock numeric; v_name text;
begin
  if v_owner is null then raise exception 'Sign in is required'; end if;
  select status into v_status from public.daily_demands where id = p_demand_id and owner_id = v_owner for update;
  if not found then raise exception 'Demand not found'; end if;
  if v_status <> 'open' then raise exception 'Ye demand pehle se Done hai'; end if;
  for v_line in select item_id, quantity from public.demand_items where demand_id = p_demand_id and owner_id = v_owner loop
    select current_stock, name into v_stock, v_name from public.inventory_items where id = v_line.item_id and owner_id = v_owner for update;
    if v_stock < v_line.quantity then raise exception 'Stock kam hai: % (hai %, chahiye %)', v_name, v_stock, v_line.quantity; end if;
    update public.inventory_items set current_stock = current_stock - v_line.quantity where id = v_line.item_id and owner_id = v_owner;
    insert into public.stock_adjustments (owner_id, item_id, quantity, type, reason) values (v_owner, v_line.item_id, v_line.quantity, 'remove', 'Other');
  end loop;
  update public.daily_demands set status = 'done', done_at = now() where id = p_demand_id and owner_id = v_owner;
end; $$;

revoke all on function public.save_demand(date, text, jsonb) from public;
grant execute on function public.save_demand(date, text, jsonb) to authenticated;
revoke all on function public.complete_demand(uuid) from public;
grant execute on function public.complete_demand(uuid) to authenticated;

-- Staff: employees and attendance
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  phone text not null default '',
  role text not null default '',
  salary numeric(12,2) not null default 0 check (salary >= 0),
  salary_type text not null default 'monthly' check (salary_type in ('monthly','daily')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  employee_id uuid not null,
  date date not null,
  status text not null check (status in ('on_time','late','absent','leave')),
  late_minutes integer not null default 0 check (late_minutes >= 0),
  created_at timestamptz not null default now(),
  unique (employee_id, date),
  foreign key (employee_id, owner_id) references public.employees(id, owner_id) on delete cascade
);
create index if not exists attendance_owner_date_idx on public.attendance(owner_id, date);
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
drop policy if exists "Owners manage employees" on public.employees;
create policy "Owners manage employees" on public.employees for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage attendance" on public.attendance;
create policy "Owners manage attendance" on public.attendance for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.employees, public.attendance to authenticated;

-- Staff: joining date, daily paid flag, hiring list, advances
alter table public.employees add column if not exists join_date date;
alter table public.attendance add column if not exists paid boolean not null default false;
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  phone text not null default '',
  role text not null default '',
  expected_salary numeric(12,2) not null default 0 check (expected_salary >= 0),
  salary_type text not null default 'monthly' check (salary_type in ('monthly','daily')),
  join_date date,
  status text not null default 'pending' check (status in ('pending','joined','rejected')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.advances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  employee_id uuid not null,
  date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (employee_id, owner_id) references public.employees(id, owner_id) on delete cascade
);
create index if not exists advances_owner_date_idx on public.advances(owner_id, date desc);
alter table public.candidates enable row level security;
alter table public.advances enable row level security;
drop policy if exists "Owners manage candidates" on public.candidates;
create policy "Owners manage candidates" on public.candidates for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage advances" on public.advances;
create policy "Owners manage advances" on public.advances for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.candidates, public.advances to authenticated;

-- Market purchase (daily fresh items, not stocked) and expenses
create table if not exists public.market_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null default current_date,
  note text not null default '',
  status text not null default 'open' check (status in ('open','bought')),
  total_spent numeric(14,2) not null default 0 check (total_spent >= 0),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create table if not exists public.market_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 100),
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null default '',
  amount numeric(14,2) not null default 0 check (amount >= 0),
  foreign key (list_id, owner_id) references public.market_lists(id, owner_id) on delete cascade
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null default current_date,
  category text not null check (length(trim(category)) between 1 and 60),
  amount numeric(14,2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists market_lists_owner_date_idx on public.market_lists(owner_id, date desc);
create index if not exists market_items_list_idx on public.market_items(owner_id, list_id);
create index if not exists expenses_owner_date_idx on public.expenses(owner_id, date desc);
alter table public.market_lists enable row level security;
alter table public.market_items enable row level security;
alter table public.expenses enable row level security;
drop policy if exists "Owners manage market lists" on public.market_lists;
create policy "Owners manage market lists" on public.market_lists for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage market items" on public.market_items;
create policy "Owners manage market items" on public.market_items for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage expenses" on public.expenses;
create policy "Owners manage expenses" on public.expenses for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.market_lists, public.market_items, public.expenses to authenticated;

create or replace function public.save_market_list(p_date date, p_note text, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_id uuid := gen_random_uuid(); v_line jsonb;
begin
  if v_owner is null then raise exception 'Sign in is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Kam az kam ek item add karein'; end if;
  insert into public.market_lists (id, owner_id, date, note) values (v_id, v_owner, coalesce(p_date, current_date), coalesce(p_note, ''));
  for v_line in select value from jsonb_array_elements(p_items) loop
    if coalesce((v_line ->> 'quantity')::numeric, 0) <= 0 then raise exception 'Quantity zero se zyada honi chahiye'; end if;
    insert into public.market_items (owner_id, list_id, name, quantity, unit) values (v_owner, v_id, trim(v_line ->> 'name'), (v_line ->> 'quantity')::numeric, coalesce(trim(v_line ->> 'unit'), ''));
  end loop;
  return v_id;
end; $$;

create or replace function public.complete_market_list(p_list_id uuid, p_amounts jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_line jsonb;
begin
  if v_owner is null then raise exception 'Sign in is required'; end if;
  perform 1 from public.market_lists where id = p_list_id and owner_id = v_owner for update;
  if not found then raise exception 'List not found'; end if;
  for v_line in select value from jsonb_array_elements(coalesce(p_amounts, '[]'::jsonb)) loop
    if coalesce((v_line ->> 'amount')::numeric, 0) < 0 then raise exception 'Amount negative nahi ho sakti'; end if;
    update public.market_items set amount = coalesce((v_line ->> 'amount')::numeric, 0) where id = (v_line ->> 'id')::uuid and list_id = p_list_id and owner_id = v_owner;
  end loop;
  update public.market_lists set status = 'bought', total_spent = (select coalesce(sum(amount), 0) from public.market_items where list_id = p_list_id and owner_id = v_owner) where id = p_list_id and owner_id = v_owner;
end; $$;

revoke all on function public.save_market_list(date, text, jsonb) from public;
grant execute on function public.save_market_list(date, text, jsonb) to authenticated;
revoke all on function public.complete_market_list(uuid, jsonb) from public;
grant execute on function public.complete_market_list(uuid, jsonb) to authenticated;
