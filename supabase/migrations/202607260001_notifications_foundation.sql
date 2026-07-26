-- JDE Parfum
-- Fondation des notifications mobiles Android.
--
-- L'identité technique utilise exclusivement les UUID Supabase.
-- L'e-mail éventuel reste une simple valeur d'affichage dans title/body/data.

do $$
begin
  create type public.notification_event_type as enum (
    'sale_declared',
    'product_updated',
    'product_deleted',
    'stock_depleted',
    'access_requested',
    'admin_authorized',
    'company_session_opened',
    'supplier_restocked'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.push_platform as enum (
    'android',
    'ios'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.push_delivery_status as enum (
    'pending',
    'sent',
    'delivered',
    'failed',
    'invalid_token'
  );
exception
  when duplicate_object then null;
end;
$$;

/*
 * Un utilisateur peut connecter plusieurs téléphones.
 * Un Expo Push Token ne peut appartenir qu'à un seul UUID à la fois.
 */
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  expo_push_token text not null unique,
  platform public.push_platform not null,
  device_name text,
  app_version text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_devices_token_not_empty
    check (length(trim(expo_push_token)) > 0)
);

create index if not exists push_devices_user_active_idx
  on public.push_devices(user_id, is_active);

create index if not exists push_devices_last_seen_idx
  on public.push_devices(last_seen_at desc);

/*
 * Notification métier commune à tous ses destinataires.
 *
 * actor_user_id :
 *   personne ayant réalisé l'action.
 *
 * subject_user_id :
 *   personne concernée par une demande ou une autorisation d'accès.
 *
 * L'e-mail, le code métier, le nom du parfum et le nom du fournisseur
 * sont conservés comme instantané dans data, jamais comme identité.
 */
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_type public.notification_event_type not null,
  title text not null,
  body text not null,
  route text not null,
  actor_user_id uuid
    references auth.users(id)
    on delete set null,
  subject_user_id uuid
    references auth.users(id)
    on delete set null,
  product_id uuid
    references public.products(id)
    on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint notifications_title_not_empty
    check (length(trim(title)) > 0),

  constraint notifications_body_not_empty
    check (length(trim(body)) > 0),

  constraint notifications_route_is_internal
    check (route like '/%'),

  constraint notifications_data_is_object
    check (jsonb_typeof(data) = 'object')
);

create index if not exists notifications_created_at_idx
  on public.notifications(created_at desc);

create index if not exists notifications_event_created_idx
  on public.notifications(event_type, created_at desc);

create index if not exists notifications_product_created_idx
  on public.notifications(product_id, created_at desc)
  where product_id is not null;

/*
 * Une ligne par utilisateur destinataire.
 * La clé primaire empêche les doublons pour une même notification.
 */
create table if not exists public.notification_recipients (
  notification_id uuid not null
    references public.notifications(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  read_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),

  primary key (notification_id, user_id)
);

create index if not exists notification_recipients_user_date_idx
  on public.notification_recipients(user_id, created_at desc);

create index if not exists notification_recipients_unread_idx
  on public.notification_recipients(user_id, created_at desc)
  where read_at is null;

/*
 * Suivi de l'envoi à chaque téléphone.
 * Cette table permettra au backend de désactiver un token invalide
 * et de contrôler ultérieurement les reçus Expo.
 */
create table if not exists public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null
    references public.notifications(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  push_device_id uuid not null
    references public.push_devices(id)
    on delete cascade,
  status public.push_delivery_status not null default 'pending',
  expo_ticket_id text,
  error_code text,
  error_message text,
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  receipt_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (notification_id, push_device_id)
);

create index if not exists push_deliveries_pending_idx
  on public.push_deliveries(status, created_at)
  where status in ('pending', 'failed');

create index if not exists push_deliveries_ticket_idx
  on public.push_deliveries(expo_ticket_id)
  where expo_ticket_id is not null;

/*
 * Réutilisation de la fonction update_updated_at déjà créée
 * par la migration d'authentification.
 */
drop trigger if exists push_devices_update_timestamp
on public.push_devices;

create trigger push_devices_update_timestamp
before update on public.push_devices
for each row
execute function public.update_updated_at();

drop trigger if exists push_deliveries_update_timestamp
on public.push_deliveries;

create trigger push_deliveries_update_timestamp
before update on public.push_deliveries
for each row
execute function public.update_updated_at();

/*
 * Enregistre ou réactive le téléphone de l'utilisateur connecté.
 *
 * L'utilisateur doit être approuvé, mais aucune comparaison d'e-mail
 * et aucune clé secrète ne sont utilisées côté application.
 */
create or replace function public.register_my_push_device(
  supplied_expo_push_token text,
  supplied_platform public.push_platform,
  supplied_device_name text default null,
  supplied_app_version text default null
)
returns public.push_devices
language plpgsql
security definer
set search_path = public
as $function$
declare
  registered_device public.push_devices;
  cleaned_token text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.admin_memberships membership
    where membership.user_id = auth.uid()
      and membership.status = 'approved'
  ) then
    raise exception 'Approved administrative access required';
  end if;

  cleaned_token := nullif(trim(supplied_expo_push_token), '');

  if cleaned_token is null then
    raise exception 'Expo push token is required';
  end if;

  if cleaned_token !~ '^Expo(nent)?PushToken\[[^]]+\]$' then
    raise exception 'Invalid Expo push token';
  end if;

  insert into public.push_devices (
    user_id,
    expo_push_token,
    platform,
    device_name,
    app_version,
    is_active,
    last_seen_at
  )
  values (
    auth.uid(),
    cleaned_token,
    supplied_platform,
    nullif(trim(supplied_device_name), ''),
    nullif(trim(supplied_app_version), ''),
    true,
    now()
  )
  on conflict (expo_push_token)
  do update set
    user_id = auth.uid(),
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    is_active = true,
    last_seen_at = now()
  returning *
  into registered_device;

  return registered_device;
end;
$function$;

/*
 * Désactive uniquement un token appartenant à l'utilisateur connecté.
 */
create or replace function public.unregister_my_push_device(
  supplied_expo_push_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  affected_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.push_devices
  set
    is_active = false,
    last_seen_at = now()
  where user_id = auth.uid()
    and expo_push_token = trim(supplied_expo_push_token);

  get diagnostics affected_rows = row_count;

  return affected_rows > 0;
end;
$function$;

/*
 * Marque comme lue une notification dont l'utilisateur est destinataire.
 */
create or replace function public.mark_my_notification_read(
  target_notification_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  affected_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.notification_recipients
  set read_at = coalesce(read_at, now())
  where notification_id = target_notification_id
    and user_id = auth.uid();

  get diagnostics affected_rows = row_count;

  return affected_rows > 0;
end;
$function$;

/*
 * RLS : chaque utilisateur ne voit que ses propres appareils
 * et les notifications qui lui sont personnellement destinées.
 * Le backend utilise SUPABASE_SECRET_KEY pour créer et envoyer.
 */
alter table public.push_devices enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.push_deliveries enable row level security;

drop policy if exists "Users can read their own push devices"
on public.push_devices;

create policy "Users can read their own push devices"
on public.push_devices
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Recipients can read their notifications"
on public.notifications;

create policy "Recipients can read their notifications"
on public.notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.notification_recipients recipient
    where recipient.notification_id = notifications.id
      and recipient.user_id = auth.uid()
  )
);

drop policy if exists "Users can read their notification recipients"
on public.notification_recipients;

create policy "Users can read their notification recipients"
on public.notification_recipients
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read their push deliveries"
on public.push_deliveries;

create policy "Users can read their push deliveries"
on public.push_deliveries
for select
to authenticated
using (user_id = auth.uid());

/*
 * Aucune écriture directe depuis le frontend.
 * Les mutations autorisées passent par les fonctions contrôlées ci-dessus.
 */
revoke all
on public.push_devices
from anon, authenticated;

revoke all
on public.notifications
from anon, authenticated;

revoke all
on public.notification_recipients
from anon, authenticated;

revoke all
on public.push_deliveries
from anon, authenticated;

grant select
on public.push_devices
to authenticated;

grant select
on public.notifications
to authenticated;

grant select
on public.notification_recipients
to authenticated;

grant select
on public.push_deliveries
to authenticated;

revoke all
on function public.register_my_push_device(
  text,
  public.push_platform,
  text,
  text
)
from public;

revoke all
on function public.unregister_my_push_device(text)
from public;

revoke all
on function public.mark_my_notification_read(uuid)
from public;

grant execute
on function public.register_my_push_device(
  text,
  public.push_platform,
  text,
  text
)
to authenticated;

grant execute
on function public.unregister_my_push_device(text)
to authenticated;

grant execute
on function public.mark_my_notification_read(uuid)
to authenticated;
