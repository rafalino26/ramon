import { createClient } from "@supabase/supabase-js";
import type { EditorDesign } from "./editor-design";
import publicConfig from "./room-public-config.json";

export interface RoomState {
  phase: "lobby" | "capture" | "edit";
  layout: string;
  photos: string[];
  design: EditorDesign | null;
  captureId?: string;
}
export interface Room {
  code: string;
  members: string[];
  names: string[];
  editor: string;
  revision: number;
  state: RoomState;
  expires_at: string;
}
export function createRoomClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || publicConfig.url;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    publicConfig.publishableKey;
  if (!url || !key)
    throw new Error(
      "Room configuration is missing. Set the Supabase environment variables.",
    );
  return createClient(url, key);
}
export type RoomClient = ReturnType<typeof createRoomClient>;
export async function roomIdentity(client: RoomClient) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.user.id;
  const result = await client.auth.signInAnonymously();
  if (result.error) throw result.error;
  return result.data.user!.id;
}
export async function roomRpc(
  client: RoomClient,
  name: string,
  args: Record<string, unknown>,
): Promise<Room> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  if (!data || !Array.isArray(data.members) || !data.state)
    throw new Error("The room response is invalid.");
  return data as Room;
}
export function saveRoom(
  client: RoomClient,
  room: Room,
  state: RoomState,
  editor = room.editor,
) {
  return roomRpc(client, "ramon_save_room", {
    room_code: room.code,
    expected_revision: room.revision,
    next_state: state,
    next_editor: editor,
  });
}
