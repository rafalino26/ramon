# Together rooms

`/together` provides a two-person room with anonymous authentication, unordered photo sharing, a persistent local camera preview, paired photos in every layout slot, and a shared editor with explicit publishing and controller handoff. The room refreshes every two seconds while visible and every fifteen seconds in a background tab. Camera streams remain on the participant's device. Approved portraits and uploaded stickers are stored in the private `room-photos` bucket.

## Project setup

Ramon includes its project URL and browser-safe publishable key in `src/lib/room-public-config.json`, so a GitHub-connected deployment can run the room feature immediately. Supabase RLS and authenticated room membership enforce data access. To use a different project, override these values in `.env.local` and the deployment environment before building.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Enable Anonymous Sign-Ins and run `supabase/migrations/202611070001_rooms.sql` once in the project's SQL Editor. This project has already been provisioned manually. The migration installs the private bucket, membership checks, atomic join, and revision-checked state updates. The publishable key gives browser access through the authenticated user's permissions. It cannot administer schema or deploy functions.

## Use

Create a room, share its code or invite link, and wait for the second participant. The creator chooses a layout. Both participants can shoot at any time. The camera button captures and shares immediately, while uploads are reviewed before sharing. Each slot contains one portrait per person in server arrival order. The shared layout displays the first portrait immediately with a waiting area for the second. Concurrent submissions are appended under a database row lock, retries are idempotent, and stale capture sessions are rejected. Square/wide slots use side-by-side portraits, while portrait slots stack them vertically. After all slots are filled, the creator has editing control. **Share design changes** publishes a snapshot. **Save & pass control** publishes and gives the other participant editing control. Both can download PNG/JPG. **Retake the last pair** returns the final slot to capture using the last shared design. Unpublished edits are local to the current editor.

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
