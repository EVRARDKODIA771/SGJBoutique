/*
 * Association entre les parfums et leurs fournisseurs.
 */

create or replace function public.upsert_product_supplier(
  target_product_id uuid,
  target_supplier_id uuid,
  target_supplier_reference text default null,
  target_last_purchase_price integer default null
)
returns public.product_suppliers
language plpgsql
security definer
set search_path = public
as $function$
declare
  selected_product public.products;
  selected_supplier public.suppliers;
  saved_association public.product_suppliers;
begin
  if not public.has_admin_access(
    array[
      'owner',
      'admin',
      'manager',
      'stock_agent'
    ]::public.admin_role[]
  ) then
    raise exception 'Administrative access required';
  end if;

  if target_last_purchase_price is not null
     and target_last_purchase_price < 0 then
    raise exception
      'Last purchase price cannot be negative';
  end if;

  select *
  into selected_product
  from public.products
  where id = target_product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  select *
  into selected_supplier
  from public.suppliers
  where id = target_supplier_id;

  if not found then
    raise exception 'Supplier not found';
  end if;

  if selected_supplier.is_active = false then
    raise exception 'Supplier is inactive';
  end if;

  insert into public.product_suppliers (
    product_id,
    supplier_id,
    supplier_reference,
    last_purchase_price
  )
  values (
    target_product_id,
    target_supplier_id,
    nullif(
      trim(target_supplier_reference),
      ''
    ),
    target_last_purchase_price
  )
  on conflict (
    product_id,
    supplier_id
  )
  do update
  set
    supplier_reference =
      excluded.supplier_reference,

    last_purchase_price =
      excluded.last_purchase_price
  returning *
  into saved_association;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'product_supplier_saved',
    'product',
    target_product_id,
    jsonb_build_object(
      'product_id',
      target_product_id,
      'supplier_id',
      target_supplier_id,
      'supplier_name',
      selected_supplier.name,
      'supplier_reference',
      saved_association.supplier_reference,
      'last_purchase_price',
      saved_association.last_purchase_price
    )
  );

  return saved_association;
end;
$function$;


/*
 * Retire un fournisseur d’un parfum.
 * Le fournisseur lui-même n’est pas supprimé.
 */
create or replace function public.remove_product_supplier(
  target_product_id uuid,
  target_supplier_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  removed_association public.product_suppliers;
begin
  if not public.has_admin_access(
    array[
      'owner',
      'admin',
      'manager',
      'stock_agent'
    ]::public.admin_role[]
  ) then
    raise exception 'Administrative access required';
  end if;

  delete from public.product_suppliers
  where product_id = target_product_id
    and supplier_id = target_supplier_id
  returning *
  into removed_association;

  if not found then
    raise exception
      'Product supplier association not found';
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'product_supplier_removed',
    'product',
    target_product_id,
    jsonb_build_object(
      'product_id',
      target_product_id,
      'supplier_id',
      target_supplier_id,
      'supplier_reference',
      removed_association.supplier_reference,
      'last_purchase_price',
      removed_association.last_purchase_price
    )
  );

  return true;
end;
$function$;


/*
 * Autorisations d’exécution.
 */

revoke all on function public.upsert_product_supplier(
  uuid,
  uuid,
  text,
  integer
) from public;

revoke all on function public.upsert_product_supplier(
  uuid,
  uuid,
  text,
  integer
) from anon;

grant execute on function public.upsert_product_supplier(
  uuid,
  uuid,
  text,
  integer
) to authenticated;


revoke all on function public.remove_product_supplier(
  uuid,
  uuid
) from public;

revoke all on function public.remove_product_supplier(
  uuid,
  uuid
) from anon;

grant execute on function public.remove_product_supplier(
  uuid,
  uuid
) to authenticated;
