export async function onRequestPost({ request, env }) {
  try {
    const { foods } = await request.json();
    if (!foods || !Array.isArray(foods) || foods.length === 0) {
      return new Response(JSON.stringify({ error: 'foods 배열이 필요합니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const foodList = foods.map((f, i) => `${i + 1}. ${f}`).join('\n');

    const prompt = `다음 한국 학교 급식 메뉴의 1인분 영양정보를 JSON 배열로 알려줘.
각 항목은 반드시 이 형식이어야 해:
{"name": "음식명", "kcal": 숫자, "p": 단백질(g), "f": 지방(g), "c": 탄수화물(g), "na": 나트륨(mg)}

음식 목록:
${foodList}

반드시 JSON 배열만 출력해. 설명이나 마크다운 없이 순수 JSON만.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048
        }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return new Response(JSON.stringify({ error: 'Gemini API 호출 실패' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON array from response (handle markdown code blocks)
    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
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
    console.error('nutrition-ai error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
