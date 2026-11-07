-- Both participants may advance the lobby and choose/change a layout.
-- Revision checks prevent a concurrent choice or photo from being overwritten.
create or replace function public.ramon_layout_action(room_code text, expected_revision integer, action text, layout_id text default null)
returns public.ramon_rooms language plpgsql security definer set search_path = '' as $$
declare room public.ramon_rooms; next_state jsonb;
begin
  select * into room from public.ramon_rooms where code = upper(room_code) and expires_at > now() for update;
  if not found or auth.uid() is null or not (auth.uid() = any(room.members)) then raise exception 'Room unavailable'; end if;
  if cardinality(room.members) <> 2 then raise exception 'Wait for your partner to join'; end if;
  if expected_revision is null or room.revision <> expected_revision then raise exception 'Room changed. Please try again.'; end if;
  next_state := room.state;
  if action = 'continue' then
    if room.state->>'phase' <> 'lobby' then raise exception 'The room has already continued'; end if;
    next_state := next_state || '{"phase":"layout","layoutChosen":false}'::jsonb;
  elsif action = 'change' then
    if room.state->>'phase' not in ('capture', 'edit') then raise exception 'The room is already choosing a layout'; end if;
    next_state := next_state || jsonb_build_object('phase', 'layout', 'photos', '[]'::jsonb, 'layoutChosen', true, 'captureId', gen_random_uuid()::text);
  elsif action = 'select' then
    if room.state->>'phase' <> 'layout' then raise exception 'Open the layout picker first'; end if;
    if layout_id is null or not (layout_id = any(array['4x1','3x1','2x1','3x2','1x2','2x3','2x2','1x1','5x1','6x1','1x3','1x4','2x4','4x2','3x3','portrait-solo','portrait-pair','portrait-trio','portrait-strip','wide-pair','wide-trio','spotlight','side-story','mosaic','panorama'])) then raise exception 'Invalid layout'; end if;
    next_state := next_state || jsonb_build_object('layout', layout_id, 'layoutChosen', true);
  elsif action = 'start' then
    if room.state->>'phase' <> 'layout' or coalesce(room.state->>'layoutChosen', 'false') <> 'true' then raise exception 'Choose a layout first'; end if;
    next_state := next_state || jsonb_build_object('phase', 'capture', 'photos', '[]'::jsonb, 'captureId', gen_random_uuid()::text);
  else raise exception 'Invalid layout action';
  end if;
  update public.ramon_rooms set state = next_state, revision = revision + 1 where code = room.code returning * into room;
  return room;
end;
$$;
revoke all on function public.ramon_layout_action(text, integer, text, text) from public, anon;
grant execute on function public.ramon_layout_action(text, integer, text, text) to authenticated;
