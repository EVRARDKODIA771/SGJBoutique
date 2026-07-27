-- JDE Parfum
-- Accès entreprise biométrique révocable par appareil.

create table if not exists public.company_biometric_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists company_biometric_credentials_user_idx
  on public.company_biometric_credentials(user_id, created_at desc);

alter table public.company_biometric_credentials
  enable row level security;

revoke all on public.company_biometric_credentials
  from anon, authenticated;

create or replace function public.revoke_biometrics_after_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_user_id uuid;
  should_revoke boolean := false;
begin
  affected_user_id :=
    case
      when tg_op = 'DELETE' then old.user_id
      else new.user_id
    end;

  if tg_op = 'DELETE' then
    should_revoke := true;
  elsif new.status is distinct from 'approved' then
    should_revoke := true;
  end if;

  if should_revoke then
    update public.company_biometric_credentials
    set revoked_at = now()
    where user_id = affected_user_id
      and revoked_at is null;

    update public.company_access_sessions
    set revoked_at = now()
    where user_id = affected_user_id
      and revoked_at is null;
  end if;

  return case
    when tg_op = 'DELETE' then old
    else new
  end;
end;
$$;

drop trigger if exists revoke_biometrics_on_membership_change
  on public.admin_memberships;

create trigger revoke_biometrics_on_membership_change
after update of status or delete
on public.admin_memberships
for each row
execute function public.revoke_biometrics_after_membership_change();
