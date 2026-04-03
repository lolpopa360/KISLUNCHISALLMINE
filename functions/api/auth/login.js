export async function onRequestPost({ request, env }) {
  try {
    const { id, pw } = await request.json();
    if (!id || !pw) return new Response("Bad Request", { status: 400 });

    const rawUsers = await env.GEUBSIK_DB.get("users");
    const users = rawUsers ? JSON.parse(rawUsers) : [];

    const found = users.find(u => u.id === id && u.pw === pw);
    if (!found) {
      return new Response(JSON.stringify({ error: "아이디 또는 비밀번호가 잘못되었습니다" }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({
      id: found.id,
      name: found.name,
      role: found.role
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
