/* ═══════════════════════════════════════
   오늘급식 v4 — app.js
   관리자가 입력한 localStorage 데이터 기반
   ═══════════════════════════════════════ */
(function () {
  'use strict';

  // ── 유틸 ──
  function $(id) { return document.getElementById(id); }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayLabel() {
    var d = new Date();
    var days = ['일', '월', '화', '수', '목', '금', '토'];
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + days[d.getDay()] + '요일';
  }
  function timeStr() {
    var d = new Date();
    return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  // ── 데이터 로드 ──
  function loadMeals(dateStr) {
    var all = JSON.parse(localStorage.getItem('mealData') || '{}');
    return all[dateStr] || null;
  }

  // ── 상태 ──
  var currentMeal = 'lunch';
  var currentPage = 'home';
  var detailOpen = false;

  // 현재 표시할 날짜 데이터
  var todayData = null;

  // ═══ 스플래시 → 메인 ═══
  $('btn-start').addEventListener('click', function () {
    $('splash').classList.remove('active');
    setTimeout(function () {
      $('splash').style.display = 'none';
      $('main').classList.add('active');
      initApp();
    }, 450);
  });

  // ═══ 앱 초기화 ═══
  function initApp() {
    $('clock').textContent = timeStr();
    setInterval(function () { $('clock').textContent = timeStr(); }, 30000);
    $('today-text').textContent = todayLabel();

    todayData = loadMeals(today());
    renderHome();
    setupTabs();
    setupNav();
    renderCalendar();
    renderFeed();
    renderNutrition();
    renderAllergy();
    setupUpload();

    $('go-photo').addEventListener('click', function () { goPage('photo'); });
    $('btn-bell').addEventListener('click', function () { toast('🔔 새로운 알림이 없습니다'); });
  }

  // ═══ 홈 화면 렌더 ═══
  function renderHome() {
    var grid = $('menu-grid');
    var noData = $('no-data');
    grid.innerHTML = '';

    if (!todayData) {
      grid.style.display = 'none';
      noData.style.display = '';
      $('kcal-val').textContent = '0';
      $('kcal-pct').textContent = '데이터 없음';
      return;
    }

    var menus = todayData[currentMeal] || [];
    if (menus.length === 0) {
      grid.style.display = 'none';
      noData.style.display = '';
      $('kcal-val').textContent = '0';
      $('kcal-pct').textContent = (currentMeal === 'lunch' ? '점심' : '저녁') + ' 정보 없음';
      return;
    }

    noData.style.display = 'none';
    grid.style.display = '';

    var totalKcal = 0;
    menus.forEach(function (m) { totalKcal += (m.kcal || 0); });
    $('kcal-val').textContent = totalKcal;
    var pct = Math.round((totalKcal / 850) * 100);
    $('kcal-pct').textContent = '권장량의 ' + pct + '%';

    menus.forEach(function (m, i) {
      var div = document.createElement('div');
      div.className = 'mc';
      div.style.animationDelay = (i * 0.06) + 's';
      div.innerHTML =
        '<div class="mc-top">' +
          (m.allergy ? '<div class="mc-dot"></div>' : '') +
          '<div class="mc-circ"><span class="mc-em">' + m.emoji + '</span></div>' +
        '</div>' +
        '<div class="mc-bot">' +
          '<div class="mc-name">' + m.name + '</div>' +
          '<div class="mc-kcal">' + m.kcal + ' kcal' + (m.allergy ? ' · ' + m.allergy + '⚠' : '') + '</div>' +
        '</div>';
      div.addEventListener('click', function () { openDetail(m); });
      grid.appendChild(div);
    });
  }

  // ═══ 탭 ═══
  function setupTabs() {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('on');
        this.classList.add('on');
        currentMeal = this.getAttribute('data-meal');
        renderHome();
        renderNutrition();
        renderAllergy();
      });
    }
  }

  // ═══ 상세 ═══
  function openDetail(m) {
    detailOpen = true;
    $('bar-app').classList.add('hide');
    $('bar-detail').classList.add('show');
    $('bnav').style.display = 'none';
    $('detail-title').textContent = m.name;
    $('det-emoji').textContent = m.emoji;
    $('det-name').textContent = m.name;
    var subText = m.kcal + ' kcal';
    if (m.allergy) subText += ' · ' + m.allergy + ' 알레르기 주의';
    $('det-sub').textContent = subText;

    // 성분
    var ingsHtml = '';
    if (m.allergy) {
      var algs = m.allergy.split('·');
      for (var a = 0; a < algs.length; a++) {
        ingsHtml += '<div class="ing-row"><div class="ing-dot w"></div><span class="ing-nm">' +
          algs[a].trim() + ' 함유</span><span class="badge b-w">⚠ ' + algs[a].trim() + '</span></div>';
      }
    }
    ingsHtml += '<div class="ing-row"><div class="ing-dot"></div><span class="ing-nm">' + m.name + ' 기타 재료</span><span class="badge b-ok">재료</span></div>';
    $('det-ings').innerHTML = ingsHtml;

    // 영양 (추정치)
    var protein = Math.round(m.kcal * 0.12 / 4);
    var fat = Math.round(m.kcal * 0.3 / 9);
    var carbs = Math.round(m.kcal * 0.58 / 4);
    var nutsHtml = makeMiniBar('단백질', protein, 55, 'g', false) +
                   makeMiniBar('지방', fat, 44, 'g', fat > 15) +
                   makeMiniBar('탄수화물', carbs, 130, 'g', false);
    $('det-nuts').innerHTML = '<div style="padding:14px">' + nutsHtml + '</div>';

    // 바 애니메이션
    setTimeout(function () {
      var fills = $('det-nuts').querySelectorAll('.nm-fill');
      for (var f = 0; f < fills.length; f++) {
        fills[f].style.width = fills[f].getAttribute('data-w');
      }
    }, 50);

    showPage('detail');
  }

  function makeMiniBar(label, val, max, unit, warn) {
    var pct = Math.min(Math.round((val / max) * 100), 100);
    return '<div class="nm"><div class="nm-top"><span class="nm-lb">' + label +
      '</span><span class="nm-vl">' + val + unit + ' / ' + max + unit +
      '</span></div><div class="nm-track"><div class="nm-fill' + (warn ? ' w' : '') +
      '" data-w="' + pct + '%" style="width:0"></div></div></div>';
  }

  $('btn-back').addEventListener('click', function () {
    detailOpen = false;
    $('bar-detail').classList.remove('show');
    $('bar-app').classList.remove('hide');
    $('bnav').style.display = '';
    showPage(currentPage);
  });

  // ═══ 네비게이션 ═══
  function setupNav() {
    var btns = document.querySelectorAll('.nb');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        goPage(this.getAttribute('data-pg'));
      });
    }
  }

  function goPage(pg) {
    if (detailOpen) {
      detailOpen = false;
      $('bar-detail').classList.remove('show');
      $('bar-app').classList.remove('hide');
      $('bnav').style.display = '';
    }
    currentPage = pg;
    var btns = document.querySelectorAll('.nb');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-pg') === pg);
    }
    showPage(pg);
    $('pages').scrollTop = 0;
  }

  function showPage(pg) {
    var pages = document.querySelectorAll('.pg');
    for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
    $('pg-' + pg).classList.add('active');
  }

  // ═══ 달력 ═══
  function renderCalendar() {
    var row = $('week-row');
    row.innerHTML = '';
    var d = new Date();
    var dayOfWeek = d.getDay();
    var monday = new Date(d);
    monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    var days = ['월', '화', '수', '목', '금'];
    for (var i = 0; i < 5; i++) {
      var dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      var dateStr = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
      var isToday = dateStr === today();

      var el = document.createElement('div');
      el.className = 'wd' + (isToday ? ' on' : '');
      el.setAttribute('data-date', dateStr);
      el.innerHTML = '<small>' + days[i] + '</small><strong>' + dd.getDate() + '</strong>';
      el.addEventListener('click', function () {
        var wds = document.querySelectorAll('.wd');
        for (var w = 0; w < wds.length; w++) wds[w].classList.remove('on');
        this.classList.add('on');
        renderCalDetail(this.getAttribute('data-date'));
      });
      row.appendChild(el);
    }

    renderCalDetail(today());
  }

  function renderCalDetail(dateStr) {
    var d = new Date(dateStr);
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    $('cal-day-title').textContent = dayNames[d.getDay()] + '요일 점심';

    var data = loadMeals(dateStr);
    var list = $('cal-list');
    list.innerHTML = '';

    if (!data || !data.lunch || data.lunch.length === 0) {
      list.innerHTML = '<li style="color:var(--muted)">등록된 급식 정보가 없습니다</li>';
      return;
    }

    data.lunch.forEach(function (m) {
      var li = document.createElement('li');
      li.textContent = m.emoji + '  ' + m.name;
      list.appendChild(li);
    });
  }

  // ═══ 피드 ═══
  function renderFeed() {
    var list = $('feed-list');
    list.innerHTML = '';

    // 최근 7일 검색
    var entries = [];
    var d = new Date();
    for (var i = 0; i < 7; i++) {
      var dd = new Date(d);
      dd.setDate(d.getDate() - i);
      var ds = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
      var data = loadMeals(ds);
      if (data && data.lunch && data.lunch.length > 0) {
        entries.push({ date: ds, menus: data.lunch, isToday: i === 0 });
      }
    }

    if (entries.length === 0) {
      list.innerHTML = '<div class="no-data"><p>📸 급식 사진이 없어요</p><p class="sm">관리자가 급식을 등록하면 여기에 나타나요</p></div>';
      return;
    }

    entries.forEach(function (e) {
      var menuStr = e.menus.map(function (m) { return m.emoji + ' ' + m.name; }).join(' · ');
      var label = e.isToday ? '오늘' : e.date.slice(5);

      var card = document.createElement('div');
      card.className = 'fc';
      card.innerHTML =
        '<div class="fc-ph">' +
          '<span class="fc-tag">' + label + ' 점심</span>' +
          '<div class="fc-ph-ic">' + (e.isToday ? '📷' : '📸') + '</div>' +
          '<small>' + (e.isToday ? '아직 업로드 전이에요' : '실제 사진이 들어갈 자리') + '</small>' +
        '</div>' +
        '<div class="fc-info">' +
          '<p class="fc-menus">' + menuStr + '</p>' +
          '<div class="fc-foot">' +
            '<div class="fc-auth"><div class="fc-av">🍙</div><span>영양사 선생님</span></div>' +
            '<button class="fc-like" data-likes="0">♡ 맛있겠다</button>' +
          '</div>' +
        '</div>';
      list.appendChild(card);
    });

    // 좋아요
    var likeBtns = document.querySelectorAll('.fc-like');
    for (var j = 0; j < likeBtns.length; j++) {
      likeBtns[j].addEventListener('click', function () {
        var n = parseInt(this.getAttribute('data-likes')) + 1;
        this.setAttribute('data-likes', n);
        this.textContent = '❤️ ' + n;
        this.style.color = '#d44';
        toast('❤️ 좋아요!');
      });
    }
  }

  // ═══ 영양 분석 ═══
  function renderNutrition() {
    $('nut-date').textContent = todayLabel() + ' ' + (currentMeal === 'lunch' ? '점심' : '저녁');

    var menus = todayData ? (todayData[currentMeal] || []) : [];
    var totalKcal = 0;
    menus.forEach(function (m) { totalKcal += (m.kcal || 0); });

    $('nut-kcal').textContent = totalKcal;
    $('nut-cnt').textContent = menus.length;

    // 영양소 추정
    var protein = Math.round(totalKcal * 0.15 / 4);
    var fat = Math.round(totalKcal * 0.25 / 9);
    var carbs = Math.round(totalKcal * 0.6 / 4);
    var sodium = Math.round(totalKcal * 1.2);
    var allergyCount = menus.filter(function (m) { return m.allergy; }).length;

    // 코멘트
    var comments = [
      '균형 잡힌 식단으로 칼슘과 단백질이 풍부해요! 🎉',
      '채소가 포함되어 식이섬유 섭취에 좋아요! 🥬',
      '오늘은 적절한 열량 구성이에요. 잘 먹었어요! ✨',
      '다양한 영양소가 골고루 들어있어요! 💪'
    ];
    $('nut-comment').textContent = menus.length > 0
      ? comments[Math.floor(Math.random() * comments.length)]
      : '급식 정보를 등록하면 분석해드려요!';

    // 통계 그리드
    var stats = $('nut-stats');
    stats.innerHTML = '';
    var statData = [
      { v: protein + 'g', l: '단백질', lo: false },
      { v: fat + 'g', l: '지방', lo: fat > 25 },
      { v: carbs + 'g', l: '탄수화물', lo: false },
      { v: totalKcal, l: '칼로리', lo: false },
      { v: allergyCount, l: '알레르기⚠', lo: allergyCount > 0 },
      { v: menus.length, l: '메뉴 수', lo: false }
    ];
    statData.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'st';
      d.innerHTML = '<strong' + (s.lo ? ' class="lo"' : '') + '>' + s.v + '</strong><small>' + s.l + '</small>';
      stats.appendChild(d);
    });

    // 바 차트
    var bars = $('nut-bars');
    bars.innerHTML = '';
    var barData = [
      { l: '단백질', v: protein, m: 55, u: 'g', c: 'var(--g)' },
      { l: '지방', v: fat, m: 44, u: 'g', c: 'var(--amber)' },
      { l: '탄수화물', v: carbs, m: 130, u: 'g', c: 'var(--g2)' },
      { l: '나트륨', v: sodium, m: 2000, u: 'mg', c: 'var(--orange)' }
    ];
    barData.forEach(function (b) {
      var pct = Math.min(Math.round((b.v / b.m) * 100), 100);
      var d = document.createElement('div');
      d.className = 'nm';
      d.innerHTML = '<div class="nm-top"><span class="nm-lb">' + b.l +
        '</span><span class="nm-vl">' + b.v + b.u + ' / ' + b.m + b.u +
        '</span></div><div class="nm-track"><div class="nm-fill" data-w="' + pct +
        '%" style="width:0;background:' + b.c + '"></div></div>';
      bars.appendChild(d);
    });

    setTimeout(function () {
      var fills = bars.querySelectorAll('.nm-fill');
      for (var i = 0; i < fills.length; i++) {
        fills[i].style.width = fills[i].getAttribute('data-w');
      }
    }, 200);
  }

  // ═══ 알레르기 ═══
  function renderAllergy() {
    var menus = todayData ? (todayData[currentMeal] || []) : [];
    var allergens = {};
    menus.forEach(function (m) {
      if (m.allergy) {
        m.allergy.split('·').forEach(function (a) {
          allergens[a.trim()] = true;
        });
      }
    });

    var tags = $('allergy-tags');
    tags.innerHTML = '';
    var keys = Object.keys(allergens);
    keys.forEach(function (a) {
      var s = document.createElement('span');
      s.className = 'atag aw';
      s.textContent = '⚠ ' + a;
      tags.appendChild(s);
    });
    var safeCount = menus.filter(function (m) { return !m.allergy; }).length;
    if (menus.length > 0) {
      var safe = document.createElement('span');
      safe.className = 'atag as';
      safe.textContent = '✓ ' + safeCount + '개 안전';
      tags.appendChild(safe);
    }

    var list = $('allergy-list');
    list.innerHTML = '';
    if (menus.length === 0) {
      list.innerHTML = '<div class="no-data"><p>등록된 급식 정보가 없습니다</p></div>';
      return;
    }
    menus.forEach(function (m) {
      var d = document.createElement('div');
      d.className = 'ac';
      d.innerHTML =
        '<span class="ac-em">' + m.emoji + '</span>' +
        '<div class="ac-info"><div class="ac-nm">' + m.name + '</div>' +
        '<div class="ac-dt">' + m.kcal + ' kcal</div></div>' +
        '<span class="ac-badge ' + (m.allergy ? 'w' : 's') + '">' +
        (m.allergy ? '⚠ ' + m.allergy : '✓ 안전') + '</span>';
      list.appendChild(d);
    });
  }

  // ═══ 업로드 모달 ═══
  function setupUpload() {
    var modal = $('modal-upload');
    var dropZone = $('drop-zone');
    var fileIn = $('file-in');
    var previewBox = $('preview-box');
    var previewImg = $('preview-img');

    $('btn-fab').addEventListener('click', function () { modal.classList.add('show'); });
    $('modal-x').addEventListener('click', function () { closeModal(); });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

    dropZone.addEventListener('click', function () { fileIn.click(); });

    fileIn.addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        previewImg.src = ev.target.result;
        previewBox.style.display = '';
        dropZone.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });

    $('btn-upload-submit').addEventListener('click', function () {
      closeModal();
      toast('✅ 사진이 업로드되었습니다!');
    });

    function closeModal() {
      modal.classList.remove('show');
      fileIn.value = '';
      previewBox.style.display = 'none';
      dropZone.style.display = '';
      $('memo-in').value = '';
    }
  }

})();
