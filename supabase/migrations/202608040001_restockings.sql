-- SGJ Boutique - ravitaillements et allocation FIFO des ventes.

do $$
begin
  create type public.restocking_status as enum ('active', 'completed');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.restockings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  restocking_date date not null,
  supplier_id uuid not null references public.suppliers(id),
  invoice_number text not null check (length(trim(invoice_number)) > 0),
  status public.restocking_status not null default 'active',
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  forced_completion boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restocking_items (
  id uuid primary key default gen_random_uuid(),
  restocking_id uuid not null references public.restockings(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  initial_quantity integer not null check (initial_quantity > 0),
  remaining_quantity integer not null check (remaining_quantity >= 0),
  purchase_price integer not null check (purchase_price >= 0),
  sale_price integer not null check (sale_price >= 0),
  created_at timestamptz not null default now(),
  unique (restocking_id, product_id)
);

create table if not exists public.sale_allocations (
  id uuid primary key default gen_random_uuid(),
  stock_movement_id uuid not null references public.stock_movements(id) on delete cascade,
  restocking_item_id uuid not null references public.restocking_items(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  purchase_price_snapshot integer not null check (purchase_price_snapshot >= 0),
  sale_price_snapshot integer not null check (sale_price_snapshot >= 0),
  created_at timestamptz not null default now(),
  unique (stock_movement_id, restocking_item_id)
);

alter table public.stock_movements
  add column if not exists restocking_id uuid references public.restockings(id),
  add column if not exists restocking_item_id uuid references public.restocking_items(id);

create index if not exists restockings_supplier_date_idx
  on public.restockings(supplier_id, restocking_date desc);
create index if not exists restockings_status_date_idx
  on public.restockings(status, restocking_date desc);
create index if not exists restocking_items_fifo_idx
  on public.restocking_items(product_id, created_at, id)
  where remaining_quantity > 0;
create index if not exists sale_allocations_movement_idx
  on public.sale_allocations(stock_movement_id);

alter table public.restockings enable row level security;
alter table public.restocking_items enable row level security;
alter table public.sale_allocations enable row level security;
revoke all on public.restockings, public.restocking_items, public.sale_allocations
  from anon, authenticated;

-- Le dépôt de démonstration est volontairement remis à zéro. Les fournisseurs,
-- catégories, comptes et notifications sont conservés.
delete from public.stock_movements;
delete from public.product_suppliers;
delete from public.products;

alter type public.notification_event_type
  add value if not exists 'restocking_forced_completed';

create or replace function public.allocate_sale_fifo(
  target_movement_id uuid,
  target_product_id uuid,
  sold_quantity integer,
  sold_unit_price integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quantity_left integer := sold_quantity;
  item record;
  allocated integer;
  affected_restocking uuid;
begin
  if sold_quantity <= 0 then
    raise exception 'Sale quantity must be positive';
  end if;

  for item in
    select
      ri.id,
      ri.restocking_id,
      ri.remaining_quantity,
      ri.purchase_price
    from public.restocking_items ri
    join public.restockings r on r.id = ri.restocking_id
    where ri.product_id = target_product_id
      and ri.remaining_quantity > 0
      and r.status = 'active'
    order by r.restocking_date asc, r.created_at asc, ri.created_at asc
    for update of ri
  loop
    exit when quantity_left = 0;
    allocated := least(quantity_left, item.remaining_quantity);

    update public.restocking_items
    set remaining_quantity = remaining_quantity - allocated
    where id = item.id;

    insert into public.sale_allocations (
      stock_movement_id,
      restocking_item_id,
      quantity,
      purchase_price_snapshot,
      sale_price_snapshot
    ) values (
      target_movement_id,
      item.id,
      allocated,
      item.purchase_price,
      sold_unit_price
    );

    quantity_left := quantity_left - allocated;
  end loop;

  if quantity_left > 0 then
    raise exception 'Insufficient active restocking stock';
  end if;

  for affected_restocking in
    select distinct ri.restocking_id
    from public.sale_allocations sa
    join public.restocking_items ri on ri.id = sa.restocking_item_id
    where sa.stock_movement_id = target_movement_id
  loop
    if not exists (
      select 1 from public.restocking_items
      where restocking_id = affected_restocking
        and remaining_quantity > 0
    ) then
      update public.restockings
      set status = 'completed', completed_at = now(), forced_completion = false,
          updated_at = now()
      where id = affected_restocking and status = 'active';
    end if;
  end loop;
end;
$$;

revoke all on function public.allocate_sale_fifo(uuid, uuid, integer, integer)
  from public, anon, authenticated;

create or replace function public.allocate_inserted_sale_fifo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.movement_type = 'sale' then
    perform public.allocate_sale_fifo(
      new.id,
      new.product_id,
      abs(new.quantity_change),
      coalesce(new.unit_price, 0)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists allocate_inserted_sale_fifo on public.stock_movements;
create trigger allocate_inserted_sale_fifo
after insert on public.stock_movements
for each row execute function public.allocate_inserted_sale_fifo();

revoke all on function public.allocate_inserted_sale_fifo()
  from public, anon, authenticated;
