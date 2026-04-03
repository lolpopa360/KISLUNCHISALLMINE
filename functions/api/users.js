export async function onRequestGet({ env }) {
  const data = await env.GEUBSIK_DB.get("users") || "[]";
  return new Response(data, {
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    await env.GEUBSIK_DB.put("users", JSON.stringify(data));
    return new Response(JSON.stringify({ success: true }), { 
      headers: { "Content-Type": "application/json" } 
    });
  } catch(err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
