/*
 * Fonctions administratives de gestion des fournisseurs.
 *
 * Ces fonctions sont appelées par :
 * apps/backend/src/routes/supplierRoutes.js
 */

create or replace function public.create_supplier(
  supplier_name text,
  supplier_phone text default null,
  supplier_email text default null,
  supplier_address text default null,
  supplier_comment text default null
)
returns public.suppliers
language plpgsql
security definer
set search_path = public
as $function$
declare
  created_supplier public.suppliers;
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

  if supplier_name is null
     or trim(supplier_name) = '' then
    raise exception 'Supplier name is required';
  end if;

  insert into public.suppliers (
    name,
    phone,
    email,
    address,
    comment
  )
  values (
    trim(supplier_name),
    nullif(trim(supplier_phone), ''),
    nullif(lower(trim(supplier_email)), ''),
    nullif(trim(supplier_address), ''),
    nullif(trim(supplier_comment), '')
  )
  returning *
  into created_supplier;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'supplier_created',
    'supplier',
    created_supplier.id,
    jsonb_build_object(
      'name',
      created_supplier.name
    )
  );

  return created_supplier;
end;
$function$;


/*
 * Modifie un fournisseur existant.
 *
 * supplier_updates peut contenir :
 * name
 * phone
 * email
 * address
 * comment
 * is_active
 */
create or replace function public.update_supplier(
  supplier_id uuid,
  supplier_updates jsonb
)
returns public.suppliers
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_supplier public.suppliers;
  updated_supplier public.suppliers;
  update_key text;
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

  if supplier_updates is null
     or supplier_updates = '{}'::jsonb then
    raise exception 'At least one modification is required';
  end if;

  for update_key in
    select jsonb_object_keys(
      supplier_updates
    )
  loop
    if update_key not in (
      'name',
      'phone',
      'email',
      'address',
      'comment',
      'is_active'
    ) then
      raise exception
        'Unsupported supplier field: %',
        update_key;
    end if;
  end loop;

  select *
  into current_supplier
  from public.suppliers
  where id = supplier_id
  for update;

  if not found then
    raise exception 'Supplier not found';
  end if;

  if supplier_updates ? 'name' then
    if supplier_updates->>'name' is null
       or trim(
         supplier_updates->>'name'
       ) = '' then
      raise exception
        'Supplier name is required';
    end if;
  end if;

  if supplier_updates ? 'is_active'
     and jsonb_typeof(
       supplier_updates->'is_active'
     ) <> 'boolean' then
    raise exception
      'is_active must be a boolean';
  end if;

  update public.suppliers
  set
    name = case
      when supplier_updates ? 'name'
        then trim(
          supplier_updates->>'name'
        )
      else name
    end,

    phone = case
      when supplier_updates ? 'phone'
        then nullif(
          trim(
            supplier_updates->>'phone'
          ),
          ''
        )
      else phone
    end,

    email = case
      when supplier_updates ? 'email'
        then nullif(
          lower(
            trim(
              supplier_updates->>'email'
            )
          ),
          ''
        )
      else email
    end,

    address = case
      when supplier_updates ? 'address'
        then nullif(
          trim(
            supplier_updates->>'address'
          ),
          ''
        )
      else address
    end,

    comment = case
      when supplier_updates ? 'comment'
        then nullif(
          trim(
            supplier_updates->>'comment'
          ),
          ''
        )
      else comment
    end,

    is_active = case
      when supplier_updates ? 'is_active'
        then (
          supplier_updates->>'is_active'
        )::boolean
      else is_active
    end,

    updated_at = now()
  where id = supplier_id
  returning *
  into updated_supplier;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'supplier_updated',
    'supplier',
    updated_supplier.id,
    jsonb_build_object(
      'before',
      to_jsonb(current_supplier),
      'after',
      to_jsonb(updated_supplier),
      'submitted_updates',
      supplier_updates
    )
  );

  return updated_supplier;
end;
$function$;


/*
 * Les fonctions ne doivent être exécutées
 * que par un utilisateur Supabase connecté.
 */
revoke all on function public.create_supplier(
  text,
  text,
  text,
  text,
  text
) from public;

revoke all on function public.create_supplier(
  text,
  text,
  text,
  text,
  text
) from anon;

grant execute on function public.create_supplier(
  text,
  text,
  text,
  text,
  text
) to authenticated;


revoke all on function public.update_supplier(
  uuid,
  jsonb
) from public;

revoke all on function public.update_supplier(
  uuid,
  jsonb
) from anon;

grant execute on function public.update_supplier(
  uuid,
  jsonb
) to authenticated;
