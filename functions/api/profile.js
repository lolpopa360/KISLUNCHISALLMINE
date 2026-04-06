export async function onRequestPut({ request, env }) {
  try {
    const { id, allergies } = await request.json();
    if (!id || !Array.isArray(allergies)) return new Response("Bad Request", { status: 400 });

    const rawUsers = await env.GEUBSIK_DB.get("users");
    const users = rawUsers ? JSON.parse(rawUsers) : [];

    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      // 404를 내뱉지 않고 새 유저로 간주하여 데이터베이스에 추가 (Upsert 로직)
      users.push({ id: id, name: id === 'admin' ? '영양사선생님' : '알 수 없는 사용자', allergies: allergies });
    } else {
      users[userIndex].allergies = allergies;
    }

    await env.GEUBSIK_DB.put("users", JSON.stringify(users));

    return new Response(JSON.stringify({ success: true, allergies }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
