-- Per-slot photo tools and per-member undo/redo. Safe to rerun.
begin;
create or replace function public.ramon_layout_slots(layout_id text)
returns integer language sql immutable set search_path = '' as $$
  select case layout_id
    when '1x1' then 1 when 'portrait-solo' then 1
    when '2x1' then 2 when '1x2' then 2 when 'portrait-pair' then 2 when 'wide-pair' then 2
    when '3x1' then 3 when '1x3' then 3 when 'portrait-trio' then 3 when 'wide-trio' then 3 when 'spotlight' then 3 when 'side-story' then 3 when 'panorama' then 3
    when '4x1' then 4 when '1x4' then 4 when '2x2' then 4 when 'portrait-strip' then 4
    when '5x1' then 5 when '6x1' then 6 when '3x2' then 6 when '2x3' then 6 when 'mosaic' then 6
    when '2x4' then 8 when '4x2' then 8 when '3x3' then 9 else 0 end;
$$;
revoke all on function public.ramon_layout_slots(text) from public, anon, authenticated;

create table if not exists public.ramon_photo_history (
  sequence bigint generated always as identity primary key,
  room_code text not null references public.ramon_rooms(code) on delete cascade,
  actor uuid not null,
  capture_id text not null,
  changes jsonb not null,
  undone jsonb not null default '[]'::jsonb,
  status text not null default 'applied' check(status in ('applied','undone','discarded'))
);
create index if not exists ramon_photo_history_actor on public.ramon_photo_history(room_code,actor,capture_id,sequence);
alter table public.ramon_photo_history enable row level security;
revoke all on public.ramon_photo_history from public, anon, authenticated;

create or replace function public.ramon_photo_action(
  room_code text, capture_id text, operation_id uuid, action text,
  target_slot integer default -1, photo_path text default null, expected_photo text default null,
  other_slot integer default null, other_expected text default null, expected_photos jsonb default null
)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare
  room public.ramon_rooms; photos jsonb; changes jsonb := '[]'::jsonb; applied jsonb := '[]'::jsonb;
  slots integer; slot integer; item jsonb; before_value jsonb; after_value jsonb; journal public.ramon_photo_history;
  has_undo boolean; has_redo boolean;
begin
  select * into room from public.ramon_rooms where code = upper(room_code) and expires_at > now() for update;
  if not found or auth.uid() is null or not (auth.uid() = any(room.members)) then raise exception 'Room unavailable'; end if;
  if capture_id is null or capture_id <> coalesce(room.state->>'captureId','') or room.state->>'phase' not in ('capture','edit') then raise exception 'The photo session changed. Please try again.'; end if;
  if room.state->>'photoMode' is distinct from 'single' then raise exception 'Use Change layout to start a new photo session with photo tools.'; end if;
  if operation_id is null then raise exception 'Missing operation ID'; end if;
  if exists(select 1 from public.ramon_room_edits e where e.room_code = room.code and e.actor = auth.uid() and e.operation_id = ramon_photo_action.operation_id) then return room; end if;
  slots := public.ramon_layout_slots(room.state->>'layout');
  if slots = 0 then raise exception 'Invalid layout'; end if;
  select jsonb_agg(coalesce(room.state->'photos'->i,'null'::jsonb) order by i) into photos from generate_series(0,slots-1) i;
  slot := target_slot;
  if action in ('set','remove','swap') then
    if action = 'set' and slot = -1 then
      select ordinality::integer - 1 into slot from jsonb_array_elements(photos) with ordinality where value = 'null'::jsonb order by ordinality limit 1;
      if slot is null then raise exception 'All slots are filled. Choose a photo to replace.'; end if;
    elsif slot is null or slot < 0 or slot >= slots then raise exception 'Choose a valid photo slot';
    end if;
    before_value := photos->slot;
    if before_value is distinct from coalesce(to_jsonb(expected_photo),'null'::jsonb) then raise exception 'This photo was updated by your partner. Select it again.'; end if;
    if action = 'set' then
      if photo_path is null or split_part(photo_path,'/',1) <> room.code or split_part(photo_path,'/',2) <> auth.uid()::text then raise exception 'Invalid photo owner'; end if;
      if not exists(select 1 from storage.objects where bucket_id = 'room-photos' and name = photo_path) then raise exception 'Upload the photo first'; end if;
      after_value := to_jsonb(photo_path);
    elsif action = 'remove' then after_value := 'null'::jsonb;
    else
      if other_slot is null or other_slot < 0 or other_slot >= slots or other_slot = slot then raise exception 'Choose a different photo slot'; end if;
      if photos->other_slot is distinct from coalesce(to_jsonb(other_expected),'null'::jsonb) then raise exception 'The other photo was updated by your partner. Try again.'; end if;
      after_value := photos->other_slot;
      changes := changes || jsonb_build_array(jsonb_build_object('slot',other_slot,'before',after_value,'after',before_value));
    end if;
    if before_value is distinct from after_value then changes := changes || jsonb_build_array(jsonb_build_object('slot',slot,'before',before_value,'after',after_value)); end if;
  elsif action = 'clear' then
    if expected_photos is null or expected_photos is distinct from room.state->'photos' then raise exception 'Photos changed while confirming. Please review them again.'; end if;
    for slot in 0..slots-1 loop
      if photos->slot <> 'null'::jsonb then changes := changes || jsonb_build_array(jsonb_build_object('slot',slot,'before',photos->slot,'after','null'::jsonb)); end if;
    end loop;
  elsif action in ('undo','redo') then
    if action = 'undo' then
      select * into journal from public.ramon_photo_history h where h.room_code = room.code and h.actor = auth.uid() and h.capture_id = ramon_photo_action.capture_id and status = 'applied' order by sequence desc limit 1;
      changes := coalesce(journal.changes,'[]'::jsonb);
    else
      select * into journal from public.ramon_photo_history h where h.room_code = room.code and h.actor = auth.uid() and h.capture_id = ramon_photo_action.capture_id and status = 'undone' order by sequence limit 1;
      changes := coalesce(journal.undone,'[]'::jsonb);
    end if;
  else raise exception 'Invalid photo action';
  end if;
  for item in select value from jsonb_array_elements(changes) loop
    slot := (item->>'slot')::integer;
    before_value := case when action = 'undo' then item->'after' else item->'before' end;
    after_value := case when action = 'undo' then item->'before' else item->'after' end;
    -- Undo only restores slots whose current photo still matches our own edit.
    if photos->slot = before_value then
      photos := jsonb_set(photos,array[slot::text],after_value);
      applied := applied || jsonb_build_array(item);
    end if;
  end loop;
  if action = 'undo' and journal.sequence is not null then
    update public.ramon_photo_history set status = 'undone', undone = applied where sequence = journal.sequence;
  elsif action = 'redo' and journal.sequence is not null then
    update public.ramon_photo_history set status = 'applied', changes = applied where sequence = journal.sequence;
  elsif action not in ('undo','redo') and jsonb_array_length(applied) > 0 then
    update public.ramon_photo_history h set status = 'discarded' where h.room_code = room.code and h.actor = auth.uid() and h.capture_id = ramon_photo_action.capture_id and status = 'undone';
    insert into public.ramon_photo_history(room_code,actor,capture_id,changes) values(room.code,auth.uid(),ramon_photo_action.capture_id,applied);
  end if;
  delete from public.ramon_photo_history h where h.room_code = room.code and h.actor = auth.uid() and h.sequence not in (
    select sequence from public.ramon_photo_history h2 where h2.room_code = room.code and h2.actor = auth.uid() order by sequence desc limit 30
  );
  select exists(select 1 from public.ramon_photo_history h where h.room_code = room.code and h.actor = auth.uid() and h.capture_id = ramon_photo_action.capture_id and status = 'applied'),
    exists(select 1 from public.ramon_photo_history h where h.room_code = room.code and h.actor = auth.uid() and h.capture_id = ramon_photo_action.capture_id and status = 'undone') into has_undo,has_redo;
  insert into public.ramon_room_edits values(room.code,auth.uid(),operation_id);
  update public.ramon_rooms set state = state || jsonb_build_object(
    'photos',photos,'photoTools',true,
    'phase',case when room.state->>'phase' = 'edit' or exists(select 1 from jsonb_array_elements(photos) where value <> 'null'::jsonb) then 'edit' else 'capture' end,
    'photoHistory',coalesce(state->'photoHistory','{}'::jsonb) || jsonb_build_object(auth.uid()::text,jsonb_build_object('undo',has_undo,'redo',has_redo))
  ), revision = revision + 1 where code = room.code returning * into room;
  return room;
end;
$$;
revoke all on function public.ramon_photo_action(text,text,uuid,text,integer,text,text,integer,text,jsonb) from public, anon;
grant execute on function public.ramon_photo_action(text,text,uuid,text,integer,text,text,integer,text,jsonb) to authenticated;

create or replace function public.ramon_start_single_capture(room_code text, expected_revision integer)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms;
begin
  select * into room from public.ramon_rooms where code = upper(room_code) and expires_at > now() for update;
  if not found or auth.uid() is null or not (auth.uid() = any(room.members)) then raise exception 'Room unavailable'; end if;
  if cardinality(room.members) <> 2 then raise exception 'Wait for your partner'; end if;
  if expected_revision is null or room.revision <> expected_revision then raise exception 'Room changed. Please try again.'; end if;
  if room.state->>'phase' <> 'layout' or coalesce(room.state->>'layoutChosen','false') <> 'true' then raise exception 'Choose a layout first'; end if;
  update public.ramon_rooms set state = state || jsonb_build_object('phase','capture','photoMode','single','photoTools',true,'photoHistory','{}'::jsonb,'photos','[]'::jsonb,'captureId',gen_random_uuid()::text), revision = revision + 1 where code = room.code returning * into room;
  return room;
end;
$$;

-- Keep old complete rooms readable while preventing old tabs from appending
-- into an array whose empty slots now have stable indices.
do $$
begin
  if to_regprocedure('public.ramon_submit_single_photo_legacy(text,text,text)') is null then
    alter function public.ramon_submit_single_photo(text,text,text) rename to ramon_submit_single_photo_legacy;
  end if;
end;
$$;
revoke all on function public.ramon_submit_single_photo_legacy(text,text,text) from public, anon, authenticated;
create or replace function public.ramon_submit_single_photo(room_code text, photo_path text, capture_id text)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.ramon_rooms r where r.code = upper(room_code) and auth.uid() = any(r.members) and r.state->>'photoTools' = 'true') then raise exception 'Photo tools have been upgraded. Refresh this page to continue.'; end if;
  return public.ramon_submit_single_photo_legacy(room_code,photo_path,capture_id);
end;
$$;
revoke all on function public.ramon_submit_single_photo(text,text,text) from public, anon;
grant execute on function public.ramon_submit_single_photo(text,text,text) to authenticated;

create or replace function public.ramon_retake_photo(room_code text, expected_revision integer)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms; count integer; keep integer;
begin
  select * into room from public.ramon_rooms where code = upper(room_code) and expires_at > now() for update;
  if not found or auth.uid() is null or not (auth.uid() = any(room.members)) then raise exception 'Room unavailable'; end if;
  if room.state->>'photoTools' = 'true' then raise exception 'Photo tools have been upgraded. Refresh this page to continue.'; end if;
  if expected_revision is null or room.revision <> expected_revision then raise exception 'Room changed. Please try again.'; end if;
  if room.state->>'phase' <> 'edit' then raise exception 'Finish taking photos first'; end if;
  count := jsonb_array_length(room.state->'photos');
  keep := count - case when room.state->>'photoMode' = 'single' then 1 else 2 end;
  update public.ramon_rooms set state = state || jsonb_build_object('phase','capture','captureId',gen_random_uuid()::text,'photos',coalesce((select jsonb_agg(value order by ordinality) from jsonb_array_elements(state->'photos') with ordinality where ordinality <= keep),'[]'::jsonb)), revision = revision + 1 where code = room.code returning * into room;
  return room;
end;
$$;
commit;
