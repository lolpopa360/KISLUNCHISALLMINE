export async function onRequestPut({ request, env }) {
  try {
    const { id, allergies } = await request.json();
    if (!id || !Array.isArray(allergies)) return new Response("Bad Request", { status: 400 });

    const rawUsers = await env.GEUBSIK_DB.get("users");
    const users = rawUsers ? JSON.parse(rawUsers) : [];

    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return new Response(JSON.stringify({ error: "유저를 찾을 수 없습니다." }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    users[userIndex].allergies = allergies;
    await env.GEUBSIK_DB.put("users", JSON.stringify(users));

    return new Response(JSON.stringify({ success: true, allergies }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
