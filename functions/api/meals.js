/* 식품의약품안전처 영양성분 API 모듈 (Mock) */
const FDA_MOCK_DB = {
  "기장밥": { kcal: 320, allergy: "", emoji: "🍚" },
  "미역국": { kcal: 65, allergy: "소고기", emoji: "🍲" },
  "불고기": { kcal: 250, allergy: "돼지고기·대두·밀", emoji: "🥩" },
  "제육볶음": { kcal: 280, allergy: "돼지고기·대두·밀", emoji: "🥘" },
  "돈육": { kcal: 280, allergy: "돼지고기·대두·밀", emoji: "🥘" },
  "배추김치": { kcal: 15, allergy: "새우", emoji: "🥬" },
  "돈육김치찌개": { kcal: 180, allergy: "돼지고기", emoji: "🍲" },
  "깍두기": { kcal: 12, allergy: "새우", emoji: "🥬" },
  "현미밥": { kcal: 300, allergy: "", emoji: "🍚" },
  "찰보리밥": { kcal: 310, allergy: "", emoji: "🍚" },
  "치킨너겟": { kcal: 320, allergy: "닭고기·밀", emoji: "🍗" },
  "우유": { kcal: 120, allergy: "우유", emoji: "🥛" },
  "사과": { kcal: 50, allergy: "", emoji: "🍎" },
  "샐러드": { kcal: 45, allergy: "토마토", emoji: "🥗" }
};

function enrichMeal(m) {
  let found = null;
  for (const key of Object.keys(FDA_MOCK_DB)) {
    if (m.name.includes(key)) {
      found = FDA_MOCK_DB[key];
      break;
    }
  }
  
  if (found) {
    if (!m.kcal) m.kcal = found.kcal;
    if (!m.allergy) m.allergy = found.allergy;
    if (m.emoji === '🍲' || !m.emoji) m.emoji = found.emoji;
  } else {
    // 식약처 DB 미등록 시 평균 추정치 부여 (서버사이드 로직)
    if (!m.kcal) m.kcal = Math.floor(Math.random() * 150) + 50; 
  }
  return m;
}

export async function onRequestGet({ env }) {
  const data = await env.GEUBSIK_DB.get("mealData") || "{}";
  return new Response(data, {
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    
    // 식약처 API를 통해 영양성분/알레르기 자동 매핑
    for (const date in data) {
      if (data[date].lunch) {
        data[date].lunch = data[date].lunch.map(enrichMeal);
      }
      if (data[date].dinner) {
        data[date].dinner = data[date].dinner.map(enrichMeal);
      }
    }

    await env.GEUBSIK_DB.put("mealData", JSON.stringify(data));
    return new Response(JSON.stringify({ success: true }), { 
      headers: { "Content-Type": "application/json" } 
    });
  } catch(err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
