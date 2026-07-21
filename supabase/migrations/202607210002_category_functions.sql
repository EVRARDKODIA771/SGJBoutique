create or replace function public.create_category(
  category_name text,
  category_description text default null
)
returns public.categories
language plpgsql
security definer
set search_path = public
as $function$
declare
  new_category public.categories;
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

  if nullif(trim(category_name), '') is null then
    raise exception
      'Category name is required';
  end if;

  insert into public.categories (
    name,
    description
  )
  values (
    trim(category_name),
    nullif(
      trim(category_description),
      ''
    )
  )
  returning *
  into new_category;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'category_created',
    'category',
    new_category.id,
    to_jsonb(new_category)
  );

  return new_category;
end;
$function$;


create or replace function public.update_category(
  category_id uuid,
  category_updates jsonb
)
returns public.categories
language plpgsql
security definer
set search_path = public
as $function$
declare
  existing_category public.categories;
  updated_category public.categories;
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
  into existing_category
  from public.categories
  where id = category_id
  for update;

  if not found then
    raise exception 'Category not found';
  end if;

  if category_updates = '{}'::jsonb then
    raise exception
      'At least one modification is required';
  end if;

  if category_updates ? 'name'
     and nullif(
       trim(category_updates ->> 'name'),
       ''
     ) is null then
    raise exception
      'Category name is required';
  end if;

  update public.categories
  set
    name = case
      when category_updates ? 'name'
      then trim(
        category_updates ->> 'name'
      )
      else name
    end,

    description = case
      when category_updates ? 'description'
      then nullif(
        trim(
          category_updates
            ->> 'description'
        ),
        ''
      )
      else description
    end,

    is_active = case
      when category_updates ? 'is_active'
      then (
        category_updates ->> 'is_active'
      )::boolean
      else is_active
    end,

    updated_at = now()

  where id = category_id
  returning *
  into updated_category;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'category_updated',
    'category',
    updated_category.id,
    jsonb_build_object(
      'before',
      to_jsonb(existing_category),
      'after',
      to_jsonb(updated_category)
    )
  );

  return updated_category;
end;
$function$;


revoke all
on function public.create_category(
  text,
  text
)
from public;

grant execute
on function public.create_category(
  text,
  text
)
to authenticated;


revoke all
on function public.update_category(
  uuid,
  jsonb
)
from public;

grant execute
on function public.update_category(
  uuid,
  jsonb
)
to authenticated;
