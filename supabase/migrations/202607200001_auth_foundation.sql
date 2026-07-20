-- SGJ Boutique
-- Authentification renforcée de l'application de gestion

create extension if not exists pgcrypto with schema extensions;

create type public.admin_role as enum (
  'owner',
  'admin',
  'manager',
  'stock_agent',
  'viewer'
);

create type public.admin_status as enum (
  'pending',
  'approved',
  'suspended',
  'revoked'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null default 'viewer',
  status public.admin_status not null default 'pending',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  suspended_at timestamptz,
  revoked_at timestamptz
);

create table public.company_security (
  id boolean primary key default true check (id = true),
  password_hash text,
  password_updated_at timestamptz,
  password_updated_by uuid references auth.users(id),
  session_duration_minutes integer not null default 480
    check (session_duration_minutes between 15 and 1440),
  max_attempts integer not null default 5
    check (max_attempts between 3 and 10),
  lockout_minutes integer not null default 15
    check (lockout_minutes between 1 and 1440),
  created_at timestamptz not null default now()
);

insert into public.company_security (id) values (true);

create table public.company_password_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  successful boolean not null,
  attempted_at timestamptz not null default now()
);

create table public.company_access_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index company_attempts_user_date_idx
  on public.company_password_attempts(user_id, attempted_at desc);

create index company_sessions_user_expiry_idx
  on public.company_access_sessions(user_id, expires_at desc);

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_update_timestamp
before update on public.profiles
for each row execute function public.update_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.has_valid_company_session(
  requested_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_access_sessions session
    where session.user_id = requested_user
      and session.revoked_at is null
      and session.expires_at > now()
  );
$$;

create or replace function public.has_admin_access(
  allowed_roles public.admin_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_memberships membership
    where membership.user_id = auth.uid()
      and membership.status = 'approved'
      and (
        allowed_roles is null
        or membership.role = any(allowed_roles)
      )
  )
  and public.has_valid_company_session(auth.uid());
$$;

create or replace function public.request_admin_access()
returns public.admin_status
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status public.admin_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.admin_memberships (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select status into current_status
  from public.admin_memberships
  where user_id = auth.uid();

  return current_status;
end;
$$;

create or replace function public.verify_company_password(
  supplied_password text,
  supplied_device_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  security_config public.company_security%rowtype;
  recent_failures integer;
  membership_status public.admin_status;
  new_session_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into security_config
  from public.company_security
  where id = true;

  if security_config.password_hash is null then
    return jsonb_build_object('granted', false, 'reason', 'not_configured');
  end if;

  select count(*) into recent_failures
  from public.company_password_attempts
  where user_id = auth.uid()
    and successful = false
    and attempted_at >
      now() - make_interval(mins => security_config.lockout_minutes);

  if recent_failures >= security_config.max_attempts then
    return jsonb_build_object('granted', false, 'reason', 'temporarily_locked');
  end if;

  if extensions.crypt(
    supplied_password,
    security_config.password_hash
  ) <> security_config.password_hash then

    insert into public.company_password_attempts (user_id, successful)
    values (auth.uid(), false);

    return jsonb_build_object('granted', false, 'reason', 'access_denied');
  end if;

  insert into public.company_password_attempts (user_id, successful)
  values (auth.uid(), true);

  select status into membership_status
  from public.admin_memberships
  where user_id = auth.uid();

  if membership_status is distinct from 'approved' then
    return jsonb_build_object('granted', false, 'reason', 'not_authorized');
  end if;

  insert into public.company_access_sessions (
    user_id,
    device_label,
    expires_at
  )
  values (
    auth.uid(),
    nullif(trim(supplied_device_label), ''),
    now() + make_interval(mins => security_config.session_duration_minutes)
  )
  returning id into new_session_id;

  return jsonb_build_object(
    'granted', true,
    'reason', 'approved',
    'session_id', new_session_id,
    'expires_at',
    now() + make_interval(mins => security_config.session_duration_minutes)
  );
end;
$$;

create or replace function public.set_company_password(
  new_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  existing_hash text;
begin
  if length(new_password) < 12 then
    raise exception 'Company password must contain at least 12 characters';
  end if;

  if not exists (
    select 1
    from public.admin_memberships
    where user_id = auth.uid()
      and role = 'owner'
      and status = 'approved'
  ) then
    raise exception 'Owner access required';
  end if;

  select password_hash into existing_hash
  from public.company_security
  where id = true;

  if existing_hash is not null
     and not public.has_valid_company_session(auth.uid()) then
    raise exception 'A valid company session is required';
  end if;

  update public.company_security
  set password_hash = extensions.crypt(
        new_password,
        extensions.gen_salt('bf', 12)
      ),
      password_updated_at = now(),
      password_updated_by = auth.uid()
  where id = true;

  update public.company_access_sessions
  set revoked_at = now()
  where revoked_at is null;
end;
$$;

create or replace function public.approve_admin_user(
  target_user uuid,
  assigned_role public.admin_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_admin_access(array['owner']::public.admin_role[]) then
    raise exception 'Owner access required';
  end if;

  insert into public.admin_memberships (
    user_id,
    role,
    status,
    approved_at,
    approved_by
  )
  values (
    target_user,
    assigned_role,
    'approved',
    now(),
    auth.uid()
  )
  on conflict (user_id) do update
  set role = excluded.role,
      status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      suspended_at = null,
      revoked_at = null;
end;
$$;

create or replace function public.revoke_my_company_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  update public.company_access_sessions
  set revoked_at = now()
  where user_id = auth.uid()
    and revoked_at is null;
$$;

alter table public.profiles enable row level security;
alter table public.admin_memberships enable row level security;
alter table public.company_security enable row level security;
alter table public.company_password_attempts enable row level security;
alter table public.company_access_sessions enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can read their own administrative status"
on public.admin_memberships for select
to authenticated
using (user_id = auth.uid());

revoke all on public.company_security from anon, authenticated;
revoke all on public.company_password_attempts from anon, authenticated;
revoke all on public.company_access_sessions from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.admin_memberships to authenticated;

grant execute on function public.request_admin_access() to authenticated;
grant execute on function public.verify_company_password(text, text) to authenticated;
grant execute on function public.set_company_password(text) to authenticated;
grant execute on function public.approve_admin_user(uuid, public.admin_role) to authenticated;
grant execute on function public.revoke_my_company_sessions() to authenticated;
grant execute on function public.has_admin_access(public.admin_role[]) to authenticated;
