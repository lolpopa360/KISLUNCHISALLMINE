export async function onRequestPost({ request, env }) {
  try {
    const { id, pw } = await request.json();
    if (!id || !pw) return new Response("Bad Request", { status: 400 });

    // 1. 관리자 전용 시크릿 로그인 (환경변수 또는 영구 하드코딩)
    // 소스코드에는 기본값만 두고, 실제 배포시 Cloudflare 대시보드 - 환경 변수(Environment Variables)에서 ADMIN_ID, ADMIN_PW를 설정 가능
    const ADMIN_ID = env.ADMIN_ID || "admin";
    const ADMIN_PW = env.ADMIN_PW || "kis1234!";

    if (id === ADMIN_ID && pw === ADMIN_PW) {
      return new Response(JSON.stringify({
        id: ADMIN_ID,
        name: "영양사선생님",
        role: "admin"
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 2. 일반 학생 로그인 확인
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
