-- Atomic property/sticker edits from either member, delivered through Realtime.
begin;

grant select on public.ramon_rooms to authenticated;
drop policy if exists "Members read their active rooms" on public.ramon_rooms;
create policy "Members read their active rooms" on public.ramon_rooms for select to authenticated
using (auth.uid() = any(members) and expires_at > now());
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ramon_rooms') then
    alter publication supabase_realtime add table public.ramon_rooms;
  end if;
end;
$$;

-- Receipts make retries safe even when a successful response was lost.
-- Room cleanup also removes these receipts through the foreign key.
create table if not exists public.ramon_room_edits (
  room_code text not null references public.ramon_rooms(code) on delete cascade,
  actor uuid not null,
  operation_id uuid not null,
  primary key (room_code, actor, operation_id)
);
alter table public.ramon_room_edits enable row level security;
revoke all on public.ramon_room_edits from public, anon, authenticated;

create or replace function public.ramon_check_design(design jsonb, room_code text)
returns void language plpgsql set search_path = '' as $$
declare sticker jsonb; entry record; number_value numeric; source text;
begin
  if jsonb_typeof(design) <> 'object' or octet_length(design::text) > 49152 then raise exception 'Invalid design'; end if;
  if not coalesce(design->>'frame' = any(array['default','thin','rounded','polaroid','circle','film','postcard','double','inset']),false)
    or not coalesce(design->>'pattern' = any(array['none','dots','hearts','stars','stripes','checker','grid']),false)
    or not coalesce(design->>'photoShape' = any(array['square','rounded','circle']),false) then raise exception 'Invalid frame'; end if;
  if not coalesce(design->>'borderColor' ~ '^#[0-9a-fA-F]{6}$',false) or not coalesce(design->>'patternColor' ~ '^#[0-9a-fA-F]{6}$',false) then raise exception 'Invalid colour'; end if;
  if jsonb_typeof(design->'padding') is distinct from 'number' or (design->>'padding')::numeric not between 0 and 64
    or jsonb_typeof(design->'gap') is distinct from 'number' or (design->>'gap')::numeric not between 0 and 40 then raise exception 'Invalid spacing'; end if;
  if jsonb_typeof(design->'caption') is distinct from 'object' or jsonb_typeof(design->'caption'->'text') is distinct from 'string'
    or length(design->'caption'->>'text') > 48 or not coalesce(design->'caption'->>'font' = any(array['sans','playful','serif']),false)
    or not coalesce(design->'caption'->>'color' ~ '^#[0-9a-fA-F]{6}$',false)
    or jsonb_typeof(design->'caption'->'size') is distinct from 'number' or (design->'caption'->>'size')::numeric not between 10 and 26 then raise exception 'Invalid caption'; end if;
  if jsonb_typeof(design->'effects') is distinct from 'object' or not coalesce(design->'effects'->>'preset' = any(array['normal','b&w','vintage','vivid','cool','warm','soft','fade','noir','cream','dreamy','retro']),false) then raise exception 'Invalid filter'; end if;
  for entry in select key,value from jsonb_each(design->'effects') where key <> 'preset' loop
    if jsonb_typeof(entry.value) <> 'number' or (entry.value::text)::numeric not between 0 and 200 then raise exception 'Invalid filter value'; end if;
  end loop;
  if jsonb_typeof(design->'stickers') is distinct from 'array' or jsonb_array_length(design->'stickers') > 24 then raise exception 'The design supports up to 24 stickers'; end if;
  if (select count(*) from jsonb_array_elements(design->'stickers')) <> (select count(distinct value->>'id') from jsonb_array_elements(design->'stickers')) then raise exception 'Invalid sticker IDs'; end if;
  for sticker in select value from jsonb_array_elements(design->'stickers') loop
    if jsonb_typeof(sticker) <> 'object' or not coalesce(sticker->>'id' ~ '^[a-zA-Z0-9_-]{1,64}$',false)
      or jsonb_typeof(sticker->'name') is distinct from 'string' or length(sticker->>'name') > 100
      or jsonb_typeof(sticker->'flipped') is distinct from 'boolean' then raise exception 'Invalid sticker'; end if;
    for entry in select key,value from jsonb_each(sticker) where key = any(array['x','y','size','rotation']) loop
      if jsonb_typeof(entry.value) <> 'number' then raise exception 'Invalid sticker geometry'; end if;
      number_value := (entry.value::text)::numeric;
      if (entry.key in ('x','y') and number_value not between 0 and 1)
        or (entry.key = 'size' and number_value not between 0.08 and 0.8)
        or (entry.key = 'rotation' and number_value not between -180 and 180) then raise exception 'Invalid sticker geometry'; end if;
    end loop;
    if not (sticker ?& array['x','y','size','rotation','src']) then raise exception 'Incomplete sticker'; end if;
    source := sticker->>'src';
    if not coalesce(source ~ '^/stickers/[a-zA-Z0-9_/-]+\.(svg|webp|png)$',false) then
      if split_part(source,'/',1) is distinct from room_code or not exists(select 1 from storage.objects where bucket_id = 'room-photos' and name = source) then raise exception 'Invalid sticker upload'; end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.ramon_check_design(jsonb,text) from public, anon, authenticated;

create or replace function public.ramon_apply_design(room_code text, capture_id text, operation_id uuid, changes jsonb)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms; design jsonb; change jsonb; path text[]; slot integer; current_value jsonb; stickers jsonb; ordered jsonb; item jsonb;
begin
  select * into room from public.ramon_rooms where code = upper(room_code) and expires_at > now() for update;
  if not found or auth.uid() is null or not (auth.uid() = any(room.members)) then raise exception 'Room unavailable'; end if;
  if room.state->>'phase' <> 'edit' or capture_id is null or capture_id <> coalesce(room.state->>'captureId','') then raise exception 'The photo session changed. Rejoin the editor.'; end if;
  if operation_id is null then raise exception 'Missing operation ID'; end if;
  if exists(select 1 from public.ramon_room_edits e where e.room_code = room.code and e.actor = auth.uid() and e.operation_id = ramon_apply_design.operation_id) then return room; end if;
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) not between 1 and 128 or octet_length(changes::text) > 49152 then raise exception 'Invalid design changes'; end if;
  design := coalesce(nullif(room.state->'design','null'::jsonb),'{"frame":"rounded","borderColor":"#ffffff","pattern":"none","patternColor":"#ac83cc","padding":16,"gap":8,"photoShape":"square","effects":{"preset":"normal","intensity":100,"brightness":100,"contrast":100,"saturation":100},"caption":{"text":"","font":"playful","color":"#76578c","size":16},"stickers":[]}'::jsonb);
  for change in select value from jsonb_array_elements(changes) loop
    if jsonb_typeof(change->'path') is distinct from 'array' or not (change ? 'value') then raise exception 'Invalid change'; end if;
    path := array(select jsonb_array_elements_text(change->'path'));
    if path[1] = 'stickers' and cardinality(path) in (2,3) then
      if not coalesce(path[2] ~ '^[a-zA-Z0-9_-]{1,64}$',false) then raise exception 'Invalid sticker ID'; end if;
      select ordinality::integer - 1 into slot from jsonb_array_elements(design->'stickers') with ordinality where value->>'id' = path[2];
      if cardinality(path) = 3 and not (path[3] = any(array['src','name','x','y','size','rotation','flipped'])) then raise exception 'Invalid sticker property'; end if;
      current_value := case when slot is null then 'null'::jsonb when cardinality(path) = 3 then design->'stickers'->slot->path[3] else design->'stickers'->slot end;
      if change ? 'expected' and current_value is distinct from change->'expected' then continue; end if;
      if cardinality(path) = 3 then
        -- A delayed drag cannot recreate a sticker removed by the partner.
        if slot is not null then design := jsonb_set(design,array['stickers',slot::text,path[3]],change->'value'); end if;
      elsif change->'value' = 'null'::jsonb then
        if slot is not null then design := jsonb_set(design,'{stickers}',(design->'stickers') - slot); end if;
      elsif slot is null then
        -- A simultaneous add at the limit must not block subsequent edits.
        if jsonb_array_length(design->'stickers') >= 24 then continue; end if;
        if change->'value'->>'id' is distinct from path[2] then raise exception 'Invalid sticker ID'; end if;
        design := jsonb_set(design,'{stickers}',(design->'stickers') || jsonb_build_array(change->'value'));
      end if;
    elsif path = array['stickerOrder'] then
      stickers := design->'stickers';
      select coalesce(jsonb_agg(value->'id'),'[]'::jsonb) into current_value from jsonb_array_elements(stickers);
      if change ? 'expected' and current_value is distinct from change->'expected' then continue; end if;
      if jsonb_typeof(change->'value') <> 'array' then raise exception 'Invalid sticker order'; end if;
      ordered := '[]'::jsonb;
      for item in select value from jsonb_array_elements(change->'value') loop
        if not exists(select 1 from jsonb_array_elements(ordered) where value->'id' = item) then
          select ordered || coalesce(jsonb_agg(value),'[]'::jsonb) into ordered from jsonb_array_elements(stickers) where value->'id' = item;
        end if;
      end loop;
      select ordered || coalesce(jsonb_agg(s.value),'[]'::jsonb) into ordered from jsonb_array_elements(stickers) s where not exists(select 1 from jsonb_array_elements(ordered) o where o.value->'id' = s.value->'id');
      design := jsonb_set(design,'{stickers}',ordered);
    elsif (cardinality(path) = 1 and path[1] = any(array['frame','borderColor','pattern','patternColor','padding','gap','photoShape']))
      or (cardinality(path) = 2 and path[1] = 'caption' and path[2] = any(array['text','font','color','size']))
      or (cardinality(path) = 2 and path[1] = 'effects' and path[2] = any(array['preset','intensity','brightness','contrast','saturation'])) then
      if change ? 'expected' and (design #> path) is distinct from change->'expected' then continue; end if;
      design := jsonb_set(design,path,change->'value');
    else raise exception 'Invalid design property';
    end if;
  end loop;
  perform public.ramon_check_design(design,room.code);
  insert into public.ramon_room_edits values(room.code,auth.uid(),operation_id);
  update public.ramon_rooms set state = state || jsonb_build_object('design',design,'collaborative',true), revision = revision + 1 where code = room.code returning * into room;
  return room;
end;
$$;

create or replace function public.ramon_retake_photo(room_code text, expected_revision integer)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms; count integer; keep integer;
begin
  select * into room from public.ramon_rooms where code = upper(room_code) and expires_at > now() for update;
  if not found or auth.uid() is null or not (auth.uid() = any(room.members)) then raise exception 'Room unavailable'; end if;
  if expected_revision is null or room.revision <> expected_revision then raise exception 'Room changed. Please try again.'; end if;
  if room.state->>'phase' <> 'edit' then raise exception 'Finish taking photos first'; end if;
  count := jsonb_array_length(room.state->'photos');
  keep := count - case when room.state->>'photoMode' = 'single' then 1 else 2 end;
  update public.ramon_rooms set state = state || jsonb_build_object('phase','capture','captureId',gen_random_uuid()::text,'photos',coalesce((select jsonb_agg(value order by ordinality) from jsonb_array_elements(state->'photos') with ordinality where ordinality <= keep),'[]'::jsonb)), revision = revision + 1 where code = room.code returning * into room;
  return room;
end;
$$;

-- Old browser tabs cannot overwrite a design after collaborative edits begin.
create or replace function public.ramon_save_room(room_code text, expected_revision integer, next_state jsonb, next_editor uuid)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms;
begin
  select * into room from public.ramon_rooms where code = upper(room_code) and expires_at > now() for update;
  if not found or auth.uid() is null or not (auth.uid() = any(room.members)) then raise exception 'Room unavailable'; end if;
  if room.state->>'collaborative' = 'true' then raise exception 'Collaborative editing is enabled. Refresh this page.'; end if;
  if room.editor <> auth.uid() then raise exception 'Your partner currently has control'; end if;
  if expected_revision is null or room.revision <> expected_revision then raise exception 'Room changed. Refresh and try again.'; end if;
  if next_editor is null or not (next_editor = any(room.members)) then raise exception 'Invalid controller'; end if;
  if next_state is null or jsonb_typeof(next_state) <> 'object' or octet_length(next_state::text) > 65536 then raise exception 'Room state must be an object smaller than 64 KB'; end if;
  update public.ramon_rooms set state = next_state, editor = next_editor, revision = revision + 1 where code = room.code returning * into room;
  return room;
end;
$$;
revoke all on function public.ramon_apply_design(text,text,uuid,jsonb), public.ramon_retake_photo(text,integer) from public, anon;
grant execute on function public.ramon_apply_design(text,text,uuid,jsonb), public.ramon_retake_photo(text,integer) to authenticated;
commit;
