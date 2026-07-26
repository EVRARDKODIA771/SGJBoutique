-- Ajoute l'événement émis lorsqu'un parfum est créé.
alter type public.notification_event_type
  add value if not exists 'product_created';
