-- Supplier pending bills (udhaar), partial payments. Run after schema.sql.
alter table public.purchases add column if not exists paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0);
update public.purchases set paid_amount = total_amount where paid_amount = 0;
alter table public.purchases drop constraint if exists purchases_paid_not_over_total;
alter table public.purchases add constraint purchases_paid_not_over_total check (paid_amount <= total_amount);

create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  purchase_id uuid not null,
  supplier_id uuid,
  date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (purchase_id, owner_id) references public.purchases(id, owner_id) on delete cascade,
  foreign key (supplier_id, owner_id) references public.suppliers(id, owner_id) on delete restrict
);
create index if not exists bill_payments_owner_date_idx on public.bill_payments(owner_id, date desc);
alter table public.bill_payments enable row level security;
drop policy if exists "Owners manage bill payments" on public.bill_payments;
create policy "Owners manage bill payments" on public.bill_payments for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.bill_payments to authenticated;

drop function if exists public.record_purchase(date, uuid, jsonb);
create or replace function public.record_purchase(p_date date, p_supplier_id uuid, p_items jsonb, p_paid numeric default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_purchase_id uuid := gen_random_uuid(); v_line jsonb; v_item_id uuid;
  v_quantity numeric(12,3); v_cost numeric(12,2); v_total numeric(14,2) := 0; v_line_total numeric(14,2); v_paid numeric(14,2);
begin
  if v_owner is null then raise exception 'Sign in is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one purchase item'; end if;
  if p_paid is not null and p_paid < 0 then raise exception 'Paid amount negative nahi ho sakti'; end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers where id = p_supplier_id and owner_id = v_owner) then raise exception 'Supplier not found'; end if;
  insert into public.purchases (id, owner_id, date, supplier_id, total_amount) values (v_purchase_id, v_owner, coalesce(p_date, current_date), p_supplier_id, 0);
  for v_line in select value from jsonb_array_elements(p_items) loop
    v_item_id := (v_line ->> 'item_id')::uuid; v_quantity := (v_line ->> 'quantity')::numeric; v_cost := (v_line ->> 'cost_per_unit')::numeric;
    if v_quantity is null or v_quantity <= 0 or v_cost is null or v_cost < 0 then raise exception 'Quantity must be positive and cost cannot be negative'; end if;
    perform 1 from public.inventory_items where id = v_item_id and owner_id = v_owner for update;
    if not found then raise exception 'Inventory item not found'; end if;
    v_line_total := round(v_quantity * v_cost, 2); v_total := v_total + v_line_total;
    insert into public.purchase_items (owner_id, purchase_id, item_id, quantity, cost_per_unit, total) values (v_owner, v_purchase_id, v_item_id, v_quantity, v_cost, v_line_total);
    update public.inventory_items set current_stock = current_stock + v_quantity, cost_per_unit = v_cost where id = v_item_id and owner_id = v_owner;
  end loop;
  v_paid := least(coalesce(p_paid, v_total), v_total);
  if v_paid < v_total and p_supplier_id is null then raise exception 'Pending bill ke liye supplier chunein'; end if;
  update public.purchases set total_amount = v_total, paid_amount = v_paid where id = v_purchase_id and owner_id = v_owner;
  if v_paid > 0 then
    insert into public.bill_payments (owner_id, purchase_id, supplier_id, date, amount, note) values (v_owner, v_purchase_id, p_supplier_id, coalesce(p_date, current_date), v_paid, 'Purchase ke waqt');
  end if;
  return v_purchase_id;
end; $$;
revoke all on function public.record_purchase(date, uuid, jsonb, numeric) from public;
grant execute on function public.record_purchase(date, uuid, jsonb, numeric) to authenticated;

create or replace function public.pay_bill(p_purchase_id uuid, p_amount numeric, p_date date, p_note text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_due numeric; v_supplier uuid; v_id uuid := gen_random_uuid();
begin
  if v_owner is null then raise exception 'Sign in is required'; end if;
  select total_amount - paid_amount, supplier_id into v_due, v_supplier from public.purchases where id = p_purchase_id and owner_id = v_owner for update;
  if not found then raise exception 'Bill not found'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount zero se zyada honi chahiye'; end if;
  if p_amount > v_due then raise exception 'Amount bill ke baqi (%) se zyada hai', v_due; end if;
  insert into public.bill_payments (id, owner_id, purchase_id, supplier_id, date, amount, note) values (v_id, v_owner, p_purchase_id, v_supplier, coalesce(p_date, current_date), p_amount, coalesce(p_note, ''));
  update public.purchases set paid_amount = paid_amount + p_amount where id = p_purchase_id and owner_id = v_owner;
  return v_id;
end; $$;

create or replace function public.pay_supplier(p_supplier_id uuid, p_amount numeric, p_date date, p_note text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_due numeric; v_left numeric := p_amount; v_pay numeric; v_bill record;
begin
  if v_owner is null then raise exception 'Sign in is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount zero se zyada honi chahiye'; end if;
  select coalesce(sum(total_amount - paid_amount), 0) into v_due from public.purchases where supplier_id = p_supplier_id and owner_id = v_owner;
  if p_amount > v_due then raise exception 'Amount total pending (%) se zyada hai', v_due; end if;
  for v_bill in select id, total_amount - paid_amount as due from public.purchases where supplier_id = p_supplier_id and owner_id = v_owner and paid_amount < total_amount order by date, created_at for update loop
    exit when v_left <= 0;
    v_pay := least(v_left, v_bill.due);
    insert into public.bill_payments (owner_id, purchase_id, supplier_id, date, amount, note) values (v_owner, v_bill.id, p_supplier_id, coalesce(p_date, current_date), v_pay, coalesce(p_note, ''));
    update public.purchases set paid_amount = paid_amount + v_pay where id = v_bill.id and owner_id = v_owner;
    v_left := v_left - v_pay;
  end loop;
end; $$;
revoke all on function public.pay_bill(uuid, numeric, date, text) from public;
grant execute on function public.pay_bill(uuid, numeric, date, text) to authenticated;
revoke all on function public.pay_supplier(uuid, numeric, date, text) from public;
grant execute on function public.pay_supplier(uuid, numeric, date, text) to authenticated;
