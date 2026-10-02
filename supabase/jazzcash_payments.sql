create table if not exists public.jazzcash_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null default current_date,
  channel text not null check (channel in ('jazzcash', 'qr')),
  amount numeric(14,2) not null check (amount > 0),
  transaction_ref text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists jazzcash_payments_owner_date_idx
  on public.jazzcash_payments(owner_id, date desc);

alter table public.jazzcash_payments enable row level security;
drop policy if exists "Owners manage JazzCash payments" on public.jazzcash_payments;
create policy "Owners manage JazzCash payments"
  on public.jazzcash_payments for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.jazzcash_payments to authenticated;