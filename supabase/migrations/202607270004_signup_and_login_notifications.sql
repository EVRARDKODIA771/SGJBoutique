alter type public.notification_event_type
  add value if not exists 'login_attempted';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    phone
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data
        ->> 'full_name',
      ''
    ),
    new.phone
  )
  on conflict (id) do update
  set full_name =
    excluded.full_name,
      phone = excluded.phone;

  return new;
end;
$$;
