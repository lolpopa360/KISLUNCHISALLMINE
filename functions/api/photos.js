export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const date = url.searchParams.get('date');
    if (!date) return new Response("Missing date", { status: 400 });

    const key = `PHOTO_${date}`;
    const data = await env.GEUBSIK_DB.get(key, { type: "json" }) || [];
    return new Response(JSON.stringify(data), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  if (request.method === 'POST') {
    try {
      const reqData = await request.json();
      const { date, photoBase64, user } = reqData;
      if (!date || !photoBase64) return new Response("Bad Request", { status: 400 });

      const key = `PHOTO_${date}`;
      let existing = await env.GEUBSIK_DB.get(key, { type: "json" }) || [];
      
      existing.unshift({
        user: user || '익명',
        img: photoBase64,
        ts: Date.now()
      });

      // Keep max 20 photos per date to avoid KV 25MB limit on a single key
      if (existing.length > 20) existing = existing.slice(0, 20);

      await env.GEUBSIK_DB.put(key, JSON.stringify(existing));
      return new Response(JSON.stringify({ success: true, count: existing.length }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch(err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
