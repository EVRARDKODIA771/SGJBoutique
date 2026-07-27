-- Fige les prix utilisés au moment de chaque vente afin que le bénéfice
-- historique ne change pas lorsqu'un parfum est modifié plus tard.
alter table public.stock_movements
  add column if not exists purchase_price_snapshot integer;

create or replace function public.snapshot_stock_movement_prices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_purchase_price integer;
  product_sale_price integer;
begin
  if new.movement_type <> 'sale' then
    return new;
  end if;

  select
    purchase_price,
    sale_price
  into
    product_purchase_price,
    product_sale_price
  from public.products
  where id = new.product_id;

  new.unit_price :=
    coalesce(new.unit_price, product_sale_price, 0);

  new.purchase_price_snapshot :=
    coalesce(
      new.purchase_price_snapshot,
      product_purchase_price,
      0
    );

  return new;
end;
$$;

drop trigger if exists snapshot_stock_movement_prices
  on public.stock_movements;

create trigger snapshot_stock_movement_prices
before insert on public.stock_movements
for each row
execute function public.snapshot_stock_movement_prices();

-- Les anciennes ventes n'avaient pas de prix d'achat figé. On initialise
-- leur historique avec les prix actuellement enregistrés sur le parfum.
update public.stock_movements as movement
set
  unit_price = coalesce(
    movement.unit_price,
    product.sale_price,
    0
  ),
  purchase_price_snapshot = coalesce(
    movement.purchase_price_snapshot,
    product.purchase_price,
    0
  )
from public.products as product
where
  movement.product_id = product.id
  and movement.movement_type = 'sale'
  and (
    movement.unit_price is null
    or movement.purchase_price_snapshot is null
  );

revoke all on function public.snapshot_stock_movement_prices()
  from public, anon, authenticated;
