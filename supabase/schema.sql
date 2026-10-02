create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (owner_id, name),
  unique (id, owner_id)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  phone text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  category_id uuid,
  unit text not null check (length(trim(unit)) between 1 and 20),
  current_stock numeric(12,3) not null default 0 check (current_stock >= 0),
  minimum_stock numeric(12,3) not null default 0 check (minimum_stock >= 0),
  cost_per_unit numeric(12,2) not null default 0 check (cost_per_unit >= 0),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (category_id, owner_id) references public.categories(id, owner_id) on delete restrict
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null default current_date,
  supplier_id uuid,
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (supplier_id, owner_id) references public.suppliers(id, owner_id) on delete restrict
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  purchase_id uuid not null,
  item_id uuid not null,
  quantity numeric(12,3) not null check (quantity > 0),
  cost_per_unit numeric(12,2) not null check (cost_per_unit >= 0),
  total numeric(14,2) not null check (total >= 0),
  foreign key (purchase_id, owner_id) references public.purchases(id, owner_id) on delete cascade,
  foreign key (item_id, owner_id) references public.inventory_items(id, owner_id) on delete restrict
);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null,
  quantity numeric(12,3) not null check (quantity > 0),
  type text not null check (type in ('add', 'remove')),
  reason text not null check (reason in ('Wastage', 'Damage', 'Manual Correction', 'Other')),
  created_at timestamptz not null default now(),
  foreign key (item_id, owner_id) references public.inventory_items(id, owner_id) on delete restrict
);

create index if not exists inventory_items_owner_name_idx on public.inventory_items(owner_id, name);
create index if not exists purchases_owner_date_idx on public.purchases(owner_id, date desc);
create index if not exists purchase_items_purchase_idx on public.purchase_items(owner_id, purchase_id);
create index if not exists stock_adjustments_item_idx on public.stock_adjustments(owner_id, item_id, created_at desc);

alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.stock_adjustments enable row level security;

drop policy if exists "Owners manage categories" on public.categories;
create policy "Owners manage categories" on public.categories for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage suppliers" on public.suppliers;
create policy "Owners manage suppliers" on public.suppliers for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage inventory" on public.inventory_items;
create policy "Owners manage inventory" on public.inventory_items for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage purchases" on public.purchases;
create policy "Owners manage purchases" on public.purchases for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage purchase items" on public.purchase_items;
create policy "Owners manage purchase items" on public.purchase_items for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage stock adjustments" on public.stock_adjustments;
create policy "Owners manage stock adjustments" on public.stock_adjustments for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create or replace function public.record_purchase(p_date date, p_supplier_id uuid, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_purchase_id uuid := gen_random_uuid();
  v_line jsonb;
  v_item_id uuid;
  v_quantity numeric(12,3);
  v_cost numeric(12,2);
  v_total numeric(14,2) := 0;
  v_line_total numeric(14,2);
begin
  if v_owner is null then raise exception 'Sign in is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one purchase item';
  end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers where id = p_supplier_id and owner_id = v_owner) then
    raise exception 'Supplier not found';
  end if;

  insert into public.purchases (id, owner_id, date, supplier_id, total_amount)
  values (v_purchase_id, v_owner, coalesce(p_date, current_date), p_supplier_id, 0);

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_line ->> 'item_id')::uuid;
    v_quantity := (v_line ->> 'quantity')::numeric;
    v_cost := (v_line ->> 'cost_per_unit')::numeric;
    if v_quantity is null or v_quantity <= 0 or v_cost is null or v_cost < 0 then raise exception 'Quantity must be positive and cost cannot be negative'; end if;

    perform 1 from public.inventory_items where id = v_item_id and owner_id = v_owner for update;
    if not found then raise exception 'Inventory item not found'; end if;
    v_line_total := round(v_quantity * v_cost, 2);
    v_total := v_total + v_line_total;
    insert into public.purchase_items (owner_id, purchase_id, item_id, quantity, cost_per_unit, total)
    values (v_owner, v_purchase_id, v_item_id, v_quantity, v_cost, v_line_total);
    update public.inventory_items set current_stock = current_stock + v_quantity, cost_per_unit = v_cost where id = v_item_id and owner_id = v_owner;
  end loop;

  update public.purchases set total_amount = v_total where id = v_purchase_id and owner_id = v_owner;
  return v_purchase_id;
end;
$$;

create or replace function public.adjust_stock(p_item_id uuid, p_quantity numeric, p_type text, p_reason text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_adjustment_id uuid := gen_random_uuid();
  v_stock numeric(12,3);
begin
  if v_owner is null then raise exception 'Sign in is required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  if p_type not in ('add', 'remove') then raise exception 'Invalid adjustment type'; end if;
  if p_reason not in ('Wastage', 'Damage', 'Manual Correction', 'Other') then raise exception 'Invalid adjustment reason'; end if;

  select current_stock into v_stock from public.inventory_items where id = p_item_id and owner_id = v_owner for update;
  if not found then raise exception 'Inventory item not found'; end if;
  if p_type = 'remove' and v_stock < p_quantity then raise exception 'Adjustment cannot reduce stock below zero'; end if;

  update public.inventory_items set current_stock = current_stock + case when p_type = 'add' then p_quantity else -p_quantity end where id = p_item_id and owner_id = v_owner;
  insert into public.stock_adjustments (id, owner_id, item_id, quantity, type, reason) values (v_adjustment_id, v_owner, p_item_id, p_quantity, p_type, p_reason);
  return v_adjustment_id;
end;
$$;

revoke all on function public.record_purchase(date, uuid, jsonb) from public;
grant execute on function public.record_purchase(date, uuid, jsonb) to authenticated;
revoke all on function public.adjust_stock(uuid, numeric, text, text) from public;
grant execute on function public.adjust_stock(uuid, numeric, text, text) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.categories, public.suppliers, public.inventory_items, public.purchases, public.purchase_items, public.stock_adjustments to authenticated;