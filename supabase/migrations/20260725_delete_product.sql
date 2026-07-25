create or replace function public.delete_product(
  target_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  selected_product public.products;
  image_paths jsonb;
begin
  if not public.has_admin_access(
    array[
      'owner',
      'admin',
      'manager',
      'stock_agent'
    ]::public.admin_role[]
  ) then
    raise exception
      'Administrative access required';
  end if;

  select *
  into selected_product
  from public.products
  where id = target_product_id
  for update;

  if not found then
    raise exception
      'Product not found';
  end if;

  select coalesce(
    jsonb_agg(storage_path)
      filter (
        where storage_path is not null
      ),
    '[]'::jsonb
  )
  into image_paths
  from public.product_images
  where product_id = target_product_id;

  /*
   * Suppression des données dépendantes.
   * Toute cette partie est transactionnelle.
   */
  delete from public.product_suppliers
  where product_id = target_product_id;

  delete from public.stock_movements
  where product_id = target_product_id;

  delete from public.product_images
  where product_id = target_product_id;

  delete from public.products
  where id = target_product_id;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'product_deleted',
    'product',
    target_product_id,
    jsonb_build_object(
      'sku',
      selected_product.sku,
      'name',
      selected_product.name,
      'deleted_by',
      auth.uid()
    )
  );

  return jsonb_build_object(
    'id',
    target_product_id,
    'sku',
    selected_product.sku,
    'name',
    selected_product.name,
    'storage_paths',
    image_paths
  );
end;
$function$;

revoke all
on function public.delete_product(uuid)
from public;

grant execute
on function public.delete_product(uuid)
to authenticated;
