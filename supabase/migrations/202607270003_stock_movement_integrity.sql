-- Empêche définitivement les mouvements de stock incohérents.
-- La base conserve une quantité négative pour une sortie, tandis que
-- l'interface affiche sa valeur absolue à l'utilisateur.

create or replace function public.validate_stock_movement_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  movement_name text;
begin
  movement_name := new.movement_type::text;

  if new.quantity_change is null
     or new.quantity_change = 0 then
    raise exception
      'Stock movement quantity must be different from zero';
  end if;

  if movement_name in (
    'sale',
    'damage',
    'loss'
  ) and new.quantity_change > 0 then
    raise exception
      'A stock exit must decrease the stock';
  end if;

  if movement_name in (
    'initial',
    'purchase',
    'return'
  ) and new.quantity_change < 0 then
    raise exception
      'A stock entry must increase the stock';
  end if;

  if new.quantity_before is null
     or new.quantity_after is null then
    raise exception
      'Stock quantities before and after are required';
  end if;

  if new.quantity_before < 0
     or new.quantity_after < 0 then
    raise exception
      'Stock quantity cannot be negative';
  end if;

  if new.quantity_after <>
     new.quantity_before +
       new.quantity_change then
    raise exception
      'Inconsistent stock movement: after must equal before plus change';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_stock_movement_integrity
  on public.stock_movements;

create trigger validate_stock_movement_integrity
before insert or update on public.stock_movements
for each row
execute function public.validate_stock_movement_integrity();

revoke all
on function public.validate_stock_movement_integrity()
from public, anon, authenticated;
