export async function onRequestPost({ request, env }) {
  try {
    const { name, id, pw, role, adminCode } = await request.json();
    if (!name || !id || !pw) return new Response("Bad Request", { status: 400 });

    if (role === 'admin' && adminCode !== 'KIS_lunch_admin(yang)') {
      return new Response(JSON.stringify({ error: "관리자 인증 코드가 올바르지 않습니다." }), { 
        status: 403, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const rawUsers = await env.GEUBSIK_DB.get("users");
    const users = rawUsers ? JSON.parse(rawUsers) : [];

    if (users.find(u => u.id === id)) {
      return new Response(JSON.stringify({ error: "이미 사용 중인 아이디입니다." }), { 
        status: 409, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const newUser = {
      name, id, pw, role: role || 'student',
      createdAt: new Date().toISOString().split('T')[0]
    };
    users.push(newUser);
    await env.GEUBSIK_DB.put("users", JSON.stringify(users));

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
