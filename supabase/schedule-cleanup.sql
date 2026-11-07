-- First deploy cleanup-rooms with JWT verification disabled and configure its
-- ROOM_CLEANUP_SECRET. Save the same secret in Supabase Vault as ramon_cleanup_secret.
-- The function authenticates this dedicated secret itself.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('ramon-cleanup-expired-rooms', '0 * * * *', $$
  select net.http_post(
    url := 'https://noqjvfdmqgzjcbagxhor.supabase.co/functions/v1/cleanup-rooms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ramon_cleanup_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
$$);
