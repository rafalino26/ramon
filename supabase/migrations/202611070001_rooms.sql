-- Run once in Supabase SQL Editor. Application access goes through the RPCs below.
create table if not exists public.ramon_rooms (
  code text primary key,
  members uuid[] not null,
  names text[] not null,
  editor uuid not null,
  revision integer not null default 0,
  state jsonb not null default '{"phase":"lobby","layout":"2x2","photos":[],"design":null}'::jsonb,
  expires_at timestamptz not null default now() + interval '24 hours',
  check (cardinality(members) between 1 and 2),
  check (cardinality(names) = cardinality(members)),
  check (editor = any(members))
);
alter table public.ramon_rooms enable row level security;
revoke all on public.ramon_rooms from anon, authenticated;

create or replace function public.ramon_room_member(room_code text, include_expired boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.ramon_rooms r
    where r.code = room_code and auth.uid() = any(r.members)
    and (include_expired or r.expires_at > now()));
$$;

create or replace function public.ramon_create_room(display_name text)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(trim(display_name)) not between 1 and 32 then raise exception 'Enter a name (1-32 characters)'; end if;
  if (select count(*) from public.ramon_rooms where auth.uid() = any(members) and expires_at > now()) >= 5 then
    raise exception 'You already have five active rooms';
  end if;
  insert into public.ramon_rooms(code, members, names, editor)
  values (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), array[auth.uid()], array[trim(display_name)], auth.uid())
  returning * into room;
  return room;
end;
$$;

create or replace function public.ramon_join_room(room_code text, display_name text)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(trim(display_name)) not between 1 and 32 then raise exception 'Enter a name (1-32 characters)'; end if;
  select * into room from public.ramon_rooms where code = upper(room_code) and expires_at > now() for update;
  if not found then raise exception 'Room not found or expired'; end if;
  if auth.uid() = any(room.members) then return room; end if;
  if cardinality(room.members) >= 2 then raise exception 'This room already has two people'; end if;
  update public.ramon_rooms set members = array_append(members, auth.uid()), names = array_append(names, trim(display_name)), revision = revision + 1
    where code = room.code returning * into room;
  return room;
end;
$$;

create or replace function public.ramon_get_room(room_code text)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms;
begin
  select * into room from public.ramon_rooms
    where code = upper(room_code) and auth.uid() = any(members) and expires_at > now();
  if not found then raise exception 'Room unavailable. Rejoin with its code.'; end if;
  return room;
end;
$$;

-- Revision checks prevent an older browser response from overwriting newer work.
-- Only the current controller can publish changes or pass control to their partner.
create or replace function public.ramon_save_room(room_code text, expected_revision integer, next_state jsonb, next_editor uuid)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms;
begin
  select * into room from public.ramon_rooms where code = upper(room_code) and expires_at > now() for update;
  if not found or auth.uid() is null or not (auth.uid() = any(room.members)) then raise exception 'Room unavailable'; end if;
  if room.editor <> auth.uid() then raise exception 'Your partner currently has control'; end if;
  if room.revision <> expected_revision then raise exception 'Room changed. Refresh and try again.'; end if;
  if next_editor is null or not (next_editor = any(room.members)) then raise exception 'Invalid controller'; end if;
  if next_state is null or jsonb_typeof(next_state) <> 'object' or octet_length(next_state::text) > 65536 then
    raise exception 'Room state must be an object smaller than 64 KB';
  end if;
  update public.ramon_rooms set state = next_state, editor = next_editor, revision = revision + 1
    where code = room.code returning * into room;
  return room;
end;
$$;

revoke all on function public.ramon_room_member(text, boolean) from public, anon;
revoke all on function public.ramon_create_room(text) from public, anon;
revoke all on function public.ramon_join_room(text, text) from public, anon;
revoke all on function public.ramon_get_room(text) from public, anon;
revoke all on function public.ramon_save_room(text, integer, jsonb, uuid) from public, anon;
grant execute on function public.ramon_room_member(text, boolean), public.ramon_create_room(text), public.ramon_join_room(text, text), public.ramon_get_room(text), public.ramon_save_room(text, integer, jsonb, uuid) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('room-photos', 'room-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Object paths are CODE/USER_ID/FILE_ID. Files are immutable, avoiding cached replacements.
create policy "Room members can read active room photos" on storage.objects for select to authenticated
using (bucket_id = 'room-photos' and public.ramon_room_member((storage.foldername(name))[1]));
create policy "Room members can upload their own photos" on storage.objects for insert to authenticated
with check (bucket_id = 'room-photos' and public.ramon_room_member((storage.foldername(name))[1]) and (storage.foldername(name))[2] = auth.uid()::text);
create policy "Room members can clean up their own photos" on storage.objects for delete to authenticated
using (bucket_id = 'room-photos' and public.ramon_room_member((storage.foldername(name))[1], true) and (storage.foldername(name))[2] = auth.uid()::text);
