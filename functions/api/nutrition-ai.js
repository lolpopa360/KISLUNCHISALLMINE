export async function onRequestPost({ request, env }) {
  try {
    const { foods } = await request.json();
    if (!foods || !Array.isArray(foods) || foods.length === 0) {
      return new Response(JSON.stringify({ error: 'foods 배열이 필요합니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = env.API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const foodList = foods.map((f, i) => `${i + 1}. ${f}`).join('\n');

    const prompt = `너는 한국 학교 급식 영양사야. 다음 급식 메뉴의 1인분(학교 급식 기준 배식량) 영양성분을 정확하게 알려줘.

참고 기준:
- 밥류: 1공기(210g) 기준
- 국/찌개: 1그릇(250ml) 기준
- 반찬: 학교 급식 1인 배식량 기준 (약 60~80g)
- 나트륨은 한국 음식 특성상 정확하게 (김치류 500~700mg, 국류 800~1200mg 등)
- 식품의약품안전처 식품영양성분 데이터베이스 기준으로 답변

각 항목을 이 JSON 형식으로:
{"name":"음식명","kcal":숫자,"p":단백질g,"f":지방g,"c":탄수화물g,"na":나트륨mg}

음식 목록:
${foodList}

JSON 배열만 출력. 설명 없이.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2048
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: 'AI API 호출 실패', status: res.status, detail: errText.substring(0, 500) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';

    // Extract JSON array from response
    const jsonMatch = text.trim().match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'AI 응답 파싱 실패', raw: text }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const results = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
