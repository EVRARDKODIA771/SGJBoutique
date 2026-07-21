create or replace function public.update_product(
  product_id uuid,
  product_updates jsonb
)
returns public.products
language plpgsql
security definer
set search_path = public
as $function$
declare
  existing_product public.products;
  updated_product public.products;
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
  into existing_product
  from public.products
  where id = product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if existing_product.status = 'archived' then
    raise exception
      'Archived products cannot be modified';
  end if;

  if product_updates = '{}'::jsonb then
    raise exception
      'At least one modification is required';
  end if;

  if product_updates ? 'name'
     and nullif(
       trim(product_updates ->> 'name'),
       ''
     ) is null then
    raise exception
      'Product name is required';
  end if;

  if product_updates ? 'purchase_price'
     and (
       product_updates ->> 'purchase_price'
     )::integer < 0 then
    raise exception
      'Purchase price cannot be negative';
  end if;

  if product_updates ? 'sale_price'
     and (
       product_updates ->> 'sale_price'
     )::integer < 0 then
    raise exception
      'Sale price cannot be negative';
  end if;

  if product_updates ? 'low_stock_threshold'
     and (
       product_updates ->> 'low_stock_threshold'
     )::integer < 0 then
    raise exception
      'Stock threshold cannot be negative';
  end if;

  if product_updates ? 'volume_ml'
     and product_updates ->> 'volume_ml'
       is not null
     and (
       product_updates ->> 'volume_ml'
     )::integer <= 0 then
    raise exception
      'Volume must be greater than zero';
  end if;

  if product_updates ? 'admin_rating'
     and product_updates ->> 'admin_rating'
       is not null
     and (
       product_updates ->> 'admin_rating'
     )::numeric not between 0 and 5 then
    raise exception
      'Rating must be between zero and five';
  end if;

  if product_updates ? 'status'
     and (
       product_updates ->> 'status'
     ) not in ('draft', 'active') then
    raise exception
      'Status must be draft or active';
  end if;

  update public.products
  set
    name = case
      when product_updates ? 'name'
      then trim(
        product_updates ->> 'name'
      )
      else name
    end,

    brand = case
      when product_updates ? 'brand'
      then nullif(
        trim(
          product_updates ->> 'brand'
        ),
        ''
      )
      else brand
    end,

    category_id = case
      when product_updates ? 'category_id'
      then nullif(
        product_updates ->> 'category_id',
        ''
      )::uuid
      else category_id
    end,

    public_description = case
      when product_updates
        ? 'public_description'
      then nullif(
        trim(
          product_updates
            ->> 'public_description'
        ),
        ''
      )
      else public_description
    end,

    internal_comment = case
      when product_updates
        ? 'internal_comment'
      then nullif(
        trim(
          product_updates
            ->> 'internal_comment'
        ),
        ''
      )
      else internal_comment
    end,

    purchase_price = case
      when product_updates
        ? 'purchase_price'
      then (
        product_updates
          ->> 'purchase_price'
      )::integer
      else purchase_price
    end,

    sale_price = case
      when product_updates
        ? 'sale_price'
      then (
        product_updates
          ->> 'sale_price'
      )::integer
      else sale_price
    end,

    low_stock_threshold = case
      when product_updates
        ? 'low_stock_threshold'
      then (
        product_updates
          ->> 'low_stock_threshold'
      )::integer
      else low_stock_threshold
    end,

    volume_ml = case
      when product_updates ? 'volume_ml'
      then (
        product_updates ->> 'volume_ml'
      )::integer
      else volume_ml
    end,

    admin_rating = case
      when product_updates
        ? 'admin_rating'
      then (
        product_updates
          ->> 'admin_rating'
      )::numeric
      else admin_rating
    end,

    status = case
      when product_updates ? 'status'
      then (
        product_updates ->> 'status'
      )::public.product_status
      else status
    end,

    updated_by = auth.uid(),
    updated_at = now()

  where id = product_id
  returning *
  into updated_product;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'product_updated',
    'product',
    updated_product.id,
    jsonb_build_object(
      'before',
      to_jsonb(existing_product),
      'after',
      to_jsonb(updated_product)
    )
  );

  return updated_product;
end;
$function$;


create or replace function public.archive_product(
  product_id uuid
)
returns public.products
language plpgsql
security definer
set search_path = public
as $function$
declare
  existing_product public.products;
  archived_product public.products;
begin
  if not public.has_admin_access(
    array[
      'owner',
      'admin',
      'manager'
    ]::public.admin_role[]
  ) then
    raise exception
      'Administrative access required';
  end if;

  select *
  into existing_product
  from public.products
  where id = product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if existing_product.status = 'archived' then
    raise exception
      'Product is already archived';
  end if;

  update public.products
  set
    status = 'archived',
    updated_by = auth.uid(),
    updated_at = now()
  where id = product_id
  returning *
  into archived_product;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'product_archived',
    'product',
    archived_product.id,
    jsonb_build_object(
      'previous_status',
      existing_product.status,
      'stock_quantity',
      existing_product.stock_quantity
    )
  );

  return archived_product;
end;
$function$;


revoke all
on function public.update_product(
  uuid,
  jsonb
)
from public;

grant execute
on function public.update_product(
  uuid,
  jsonb
)
to authenticated;


revoke all
on function public.archive_product(
  uuid
)
from public;

grant execute
on function public.archive_product(
  uuid
)
to authenticated;
