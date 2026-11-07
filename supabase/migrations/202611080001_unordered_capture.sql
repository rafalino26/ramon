-- Run once in SQL Editor. Photos are appended atomically in arrival order.
create or replace function public.ramon_submit_photo(room_code text, photo_path text, pair_index integer, capture_id text default '')
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms; photo_count integer; slots integer;
begin
  select * into room from public.ramon_rooms where code = upper(room_code) and expires_at > now() for update;
  if not found or auth.uid() is null or not (auth.uid() = any(room.members)) then raise exception 'Room unavailable'; end if;
  if photo_path = any(array(select jsonb_array_elements_text(room.state->'photos'))) then return room; end if;
  if room.state->>'phase' <> 'capture' or cardinality(room.members) <> 2 then raise exception 'This room is not accepting photos'; end if;
  if capture_id is null or coalesce(room.state->>'captureId', '') <> capture_id then raise exception 'This capture session changed. Take a new photo.'; end if;
  if split_part(photo_path, '/', 1) <> room.code or split_part(photo_path, '/', 2) <> auth.uid()::text then raise exception 'Invalid photo owner'; end if;
  if not exists(select 1 from storage.objects where bucket_id = 'room-photos' and name = photo_path) then raise exception 'Upload the photo first'; end if;
  photo_count := jsonb_array_length(room.state->'photos');
  if pair_index is null or pair_index <> photo_count / 2 then raise exception 'This pair is complete. Take a new photo for the next slot.'; end if;
  if photo_count % 2 = 1 and split_part(room.state->'photos'->>(photo_count - 1), '/', 2) = auth.uid()::text then
    raise exception 'Your portrait is already in this pair. Wait for your partner.';
  end if;
  slots := case room.state->>'layout'
    when '1x1' then 1 when 'portrait-solo' then 1
    when '2x1' then 2 when '1x2' then 2 when 'portrait-pair' then 2 when 'wide-pair' then 2
    when '3x1' then 3 when '1x3' then 3 when 'portrait-trio' then 3 when 'wide-trio' then 3 when 'spotlight' then 3 when 'side-story' then 3 when 'panorama' then 3
    when '4x1' then 4 when '1x4' then 4 when '2x2' then 4 when 'portrait-strip' then 4
    when '5x1' then 5
    when '6x1' then 6 when '3x2' then 6 when '2x3' then 6 when 'mosaic' then 6
    when '2x4' then 8 when '4x2' then 8 when '3x3' then 9
    else 0 end;
  if slots = 0 or photo_count >= slots * 2 then raise exception 'Invalid or completed layout'; end if;
  update public.ramon_rooms set
    state = jsonb_set(jsonb_set(state, '{photos}', (state->'photos') || jsonb_build_array(photo_path)), '{phase}', to_jsonb(case when photo_count + 1 = slots * 2 then 'edit'::text else 'capture'::text end)),
    editor = case when photo_count + 1 = slots * 2 then members[1] else editor end,
    revision = revision + 1
    where code = room.code returning * into room;
  return room;
end;
$$;
revoke all on function public.ramon_submit_photo(text, text, integer, text) from public, anon;
grant execute on function public.ramon_submit_photo(text, text, integer, text) to authenticated;
