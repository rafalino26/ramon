# Together rooms

`/together` provides a two-person room with anonymous authentication, unordered photo sharing, a persistent local camera preview, one photo in every layout slot, and a collaborative editor with automatic saving. Supabase Realtime delivers committed room changes to members. A snapshot is fetched after subscription/reconnection and every fifteen seconds as a recovery check. When Realtime disconnects, visible tabs poll every two seconds. Camera streams remain on the participant's device. Shared photos and uploaded stickers are stored in the private `room-photos` bucket.

## Project setup

Ramon includes its project URL and browser-safe publishable key in `src/lib/room-public-config.json`, so a GitHub-connected deployment can run the room feature immediately. Supabase RLS and authenticated room membership enforce data access. To use a different project, override these values in `.env.local` and the deployment environment before building.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Enable Anonymous Sign-Ins and run `supabase/migrations/202611070001_rooms.sql` once in the project's SQL Editor. This project has already been provisioned manually. The migration installs the private bucket, membership checks, atomic join, and revision-checked state updates. The publishable key gives browser access through the authenticated user's permissions. It cannot administer schema or deploy functions.

Then apply the follow-up migrations in order: `202611080001_unordered_capture.sql`, `202611080002_shared_layout.sql`, and `202611080003_single_photo_slots.sql`. The latest migration adds a dedicated start/submit API for single-photo slots. Existing paired rooms remain readable; use **Change layout** and start capture again to switch those rooms to single-photo slots.

Apply `202611080004_collaborative_editor.sql` for automatic collaborative editing. This migration grants authenticated members SELECT access to their own unexpired rooms under RLS, enables the room table in the Realtime publication, and adds atomic property/sticker operations with retry receipts. Direct writes remain restricted to RPCs. Receipts are deleted with their room. Existing rooms and designs are supported.

Apply `202611080005_photo_workspace.sql` for stable nullable photo slots, replacement/deletion, swapping, clear-all, and per-member photo undo/redo. The journal retains thirty actions per participant and is deleted with its room. Existing single-photo rooms gain the tools on their next photo action. Old paired rooms keep their original capture behavior until participants choose a layout and start again. Refresh older browser tabs after upgrading the schema.

## Use

Create a room, share its code or invite link, and wait for the second participant. An invitation opens a Join-only form with the room code already filled and read-only; Create room is available on the plain `/together` page. Either participant presses **Continue** after both have joined. Both can then choose from the same illustrated layout gallery used by the solo photobooth. Either participant can start capture or use **Change layout** during capture/editing. If photos exist, an explicit confirmation clears the shared photos and unshared edits while retaining the last published styling. Layout changes use revision checks so a simultaneous selection or arriving photo cannot be silently overwritten.

Both participants can shoot at any time, including consecutive photos by the same person. The camera button captures and shares immediately, while uploads are reviewed before sharing. Each accepted photo fills one empty slot in server arrival order: a six-slot layout requires six photos in total. The app never combines two participants' photos into one slot in a new capture. Concurrent submissions are appended under a database row lock, retries of the same uploaded path are idempotent, and stale capture sessions are rejected. A race for the last slot accepts exactly one submission. An uploaded file is retained after an ambiguous network failure because its submission may already have committed; abandoned files are handled by the cleanup job when deployed.

After the first photo is shared, both participants can decorate. Each participant switches independently between **Camera & photos** and **Decorate together**. Photo slots stay numbered when a photo is deleted. Choose any slot to replace it, use **Move earlier/later** to exchange positions, or delete it directly. Replacement keeps the current photo until the upload succeeds. **Undo photo** and **Redo photo** affect the participant's own actions and skip slots subsequently changed by the partner. **Clear photos** requires confirmation against the reviewed photo snapshot. The normal photobooth camera component supplies front/back switching, an available-device/lens selector, automatic portrait view on phones, wide view, countdown/cancel, and all camera filters. Physical lens availability follows the device and browser permissions. See [MediaDevices.enumerateDevices](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices).

Design changes are batched briefly and saved automatically. Distinct properties and sticker IDs merge independently. The last server-accepted edit wins when both change the same property, including caption text. Design undo/redo tracks local actions and uses expected values to preserve newer partner edits. Deleting a sticker wins over a delayed geometry update. Retry receipts prevent a lost response from reapplying an old edit. Pending edits remain in memory during connection loss and retry automatically, with an explicit sync status. Keep the page open until **All changes saved** appears. A room/layout change clears edits that are still syncing.

Both participants can download PNG/JPG after at least one photo is shared, including intentionally empty slots, as in the solo photobooth. Downloads wait until all referenced photo and sticker assets have loaded. The editor explains that empty photo spaces remain blank in exports. **Retake the last photo** is a visible button that selects the final filled slot and opens the camera tools. Styling and pending design changes survive photo replacements and tab switches. A hidden editor pauses export encoding while keeping its collaborative session alive. Older paired rooms retain **Retake the last pair** until they start a new capture. Old browser tabs are prevented from publishing full snapshots after collaborative editing begins. The implementation follows Supabase's [Postgres Changes guide](https://supabase.com/docs/guides/realtime/postgres-changes).

Room membership belongs to the anonymous browser identity. Rejoining in that browser preserves membership. Clearing site data creates a new identity, which cannot take an already occupied seat. Leaving the page does not release the seat, so the original participant can reconnect. The room code can be entered again after a reload. No live video/audio is transmitted.

## Expiration and physical cleanup

Database and Storage policies deny access after 24 hours. Physical deletion needs the scheduled cleanup function deployed separately. Until that job is deployed, expired rows and photo files continue consuming storage.

1. Deploy the contents of `supabase/functions/cleanup-rooms/index.ts` as the `cleanup-rooms` Edge Function in this Supabase project. Disable the platform JWT check for this function, which checks its own dedicated secret.
2. Generate a long random value privately and set it as the function secret `ROOM_CLEANUP_SECRET`. The function rejects requests when this is missing or does not match. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the hosted runtime automatically. Do not put the service role key into Next.js or send it to chat.
3. Store that same dedicated cleanup secret in Supabase Vault under `ramon_cleanup_secret`.
4. Run `supabase/schedule-cleanup.sql` in SQL Editor. It schedules hourly deletion of expired rooms and all files under their participant folders, including abandoned uploads. A partial failure leaves the room record for the next run to retry. Each invocation handles at most twenty rooms.
5. Check Cron history and function logs after deployment. The job has not been deployed by the application build.

Official references are [Edge Function environment variables](https://supabase.com/docs/guides/functions/secrets) and [scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).

## Verification

`tests/browser/rooms.spec.ts` exercises two independent browser sessions with a simulated backend by default. Set `RAMON_LIVE_ROOM_TEST=1` to run the same flow against the configured Supabase project. Live tests create anonymous users, a room, and temporary photos that are removed by the scheduled expiry cleanup when deployed. Use a test project for repeated runs.

Before public launch, enable Supabase's recommended CAPTCHA protection for anonymous sign-ins and monitor storage and auth quotas. The initial implementation intentionally uses publishable credentials only in the browser and cannot configure project-wide CAPTCHA, hosting environment variables, or scheduled functions itself.
