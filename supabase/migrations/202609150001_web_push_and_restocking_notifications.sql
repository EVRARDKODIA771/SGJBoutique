alter type public.notification_event_type
  add value if not exists 'restocking_created';

alter type public.notification_event_type
  add value if not exists 'restocking_completed';

alter type public.notification_event_type
  add value if not exists 'supplier_created';

alter type public.notification_event_type
  add value if not exists 'supplier_updated';

alter type public.notification_event_type
  add value if not exists 'category_created';

alter type public.notification_event_type
  add value if not exists 'category_updated';

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  user_agent text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_push_endpoint_not_empty check (length(trim(endpoint)) > 0)
);

create index if not exists web_push_subscriptions_user_active_idx
  on public.web_push_subscriptions(user_id, is_active);

drop trigger if exists web_push_subscriptions_update_timestamp
on public.web_push_subscriptions;

create trigger web_push_subscriptions_update_timestamp
before update on public.web_push_subscriptions
for each row execute function public.update_updated_at();

alter table public.web_push_subscriptions enable row level security;

drop policy if exists "Users can read their own web push subscriptions"
on public.web_push_subscriptions;

create policy "Users can read their own web push subscriptions"
on public.web_push_subscriptions for select to authenticated
using (user_id = auth.uid());

revoke all on public.web_push_subscriptions from anon, authenticated;
grant select on public.web_push_subscriptions to authenticated;
