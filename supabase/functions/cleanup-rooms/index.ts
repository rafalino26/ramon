// Supabase Edge Runtime provides Deno. No browser or Next.js secret is involved.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
export {};

Deno.serve(async (request) => {
  const secret = Deno.env.get("ROOM_CLEANUP_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !url || !serviceKey)
    return new Response("Cleanup configuration missing", { status: 503 });
  if (
    request.method !== "POST" ||
    request.headers.get("x-cleanup-secret") !== secret
  )
    return new Response("Unauthorized", { status: 401 });
  const call = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(url + path, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok)
      throw new Error(`Cleanup request failed (${response.status})`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
  try {
    const cutoff = encodeURIComponent(new Date().toISOString());
    const rooms: { code: string; members: string[] }[] = await call(
      `/rest/v1/ramon_rooms?select=code,members&expires_at=lt.${cutoff}&limit=20`,
    );
    let removed = 0;
    for (const room of rooms) {
      for (const member of room.members) {
        const prefix = `${room.code}/${member}`;
        for (;;) {
          const files: { name: string }[] = await call(
            "/storage/v1/object/list/room-photos",
            "POST",
            {
              prefix,
              limit: 100,
              offset: 0,
              sortBy: { column: "name", order: "asc" },
            },
          );
          if (!files.length) break;
          await call("/storage/v1/object/room-photos", "DELETE", {
            prefixes: files.map((file) => `${prefix}/${file.name}`),
          });
        }
      }
      await call(
        `/rest/v1/ramon_rooms?code=eq.${room.code}&expires_at=lt.${cutoff}`,
        "DELETE",
      );
      removed++;
    }
    return Response.json({ removed });
  } catch (cause) {
    // Keep the room row after a partial failure so the next scheduled run can retry.
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Cleanup failed" },
      { status: 500 },
    );
  }
});
