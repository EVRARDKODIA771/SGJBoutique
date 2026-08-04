-- Distingue une tentative de connexion d'une authentification réussie.
alter type public.notification_event_type
  add value if not exists 'login_succeeded';
