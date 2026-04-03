/* ═══════════════════════════════════════════════
   급식뭐지 — App Logic
   localStorage 기반 인증 + 관리자 데이터 렌더링
   ═══════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── DB ──
  function getDB(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function setDB(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  // ── DOM ──
  function $(id) { return document.getElementById(id); }
  function $$(sel) { return document.querySelectorAll(sel); }

  // ── Utils ──
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayLabel() {
    var d = new Date();
    var days = ['일', '월', '화', '수', '목', '금', '토'];
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + days[d.getDay()] + '요일';
  }
  function clockStr() {
    var d = new Date();
    return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  let cachedMeals = {};
  function loadMeals(dateStr) {
    return cachedMeals[dateStr] || null;
  }

  // ── State ──
  var currentMeal = 'lunch';
  var currentPage = 'home';
  var detailOpen = false;
  var currentUser = null;

  // ═══ AUTH SYSTEM ═══
  var authScreen = $('auth-screen');
  var mainScreen = $('main-screen');
  var formLogin = $('form-login');
  var formSignup = $('form-signup');

  // Check existing session
  var existingSession = getDB('session', null);
  
  async function loadDataAndInit() {
    try {
      const res = await fetch('/api/meals');
      if (res.ok) cachedMeals = await res.json();
    } catch (e) {
      console.warn('API error, fallback to offline', e);
    }
    initApp();
  }

  if (existingSession) {
    currentUser = existingSession;
    authScreen.classList.remove('active');
    authScreen.style.display = 'none';
    mainScreen.classList.add('active');
    loadDataAndInit();
  }

  // Toggle forms
  $('goto-signup').addEventListener('click', function () {
    formLogin.style.display = 'none';
    formSignup.style.display = '';
  });
  $('goto-login').addEventListener('click', function () {
    formSignup.style.display = 'none';
    formLogin.style.display = '';
  });

  // Role selector
  var selectedRole = 'student';
  var roleBtns = $$('.role-btn');
  for (var r = 0; r < roleBtns.length; r++) {
    roleBtns[r].addEventListener('click', function () {
      for (var i = 0; i < roleBtns.length; i++) roleBtns[i].classList.remove('active');
      this.classList.add('active');
      selectedRole = this.getAttribute('data-role');
      var codeGroup = $('signup-admin-code-group');
      if (codeGroup) {
        codeGroup.style.display = selectedRole === 'admin' ? '' : 'none';
        if (selectedRole !== 'admin') $('signup-admin-code').value = '';
      }
    });
  }

  // SIGNUP
  $('btn-signup').addEventListener('click', async function () {
    var name = $('signup-name').value.trim();
    var id = $('signup-id').value.trim();
    var pw = $('signup-pw').value;
    var adminInput = $('signup-admin-code');
    var adminCode = adminInput ? adminInput.value.trim() : '';

    if (!name || !id || !pw) { toast('모든 항목을 입력해주세요'); return; }
    if (pw.length < 4) { toast('비밀번호는 4자 이상이어야 해요'); return; }
    if (selectedRole === 'admin' && !adminCode) { toast('관리자 보안 코드를 입력해주세요'); return; }

    var originalBtnText = this.textContent;
    this.textContent = '처리중...';
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, id, pw, role: selectedRole, adminCode })
      });
      const data = await res.json();
      this.textContent = originalBtnText;

      if (!res.ok) { toast('❌ ' + (data.error || '회원가입에 실패했습니다')); return; }

      toast('🎉 회원가입 완료! 로그인해주세요');
      formSignup.style.display = 'none';
      formLogin.style.display = '';
      $('login-id').value = id;
    } catch(err) {
      this.textContent = originalBtnText;
      toast('❌ 서버 연결 오류');
    }
  });

  // LOGIN
  $('btn-login').addEventListener('click', doLogin);
  $('login-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

  async function doLogin() {
    var id = $('login-id').value.trim();
    var pw = $('login-pw').value;

    if (!id || !pw) { toast('아이디와 비밀번호를 입력하세요'); return; }

    var btn = $('btn-login');
    var originalBtnText = btn.textContent;
    btn.textContent = '로그인 중...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pw })
      });
      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch(e) {
        toast('❌ 서버 구조체 오류: ' + res.status + ' ' + responseText.substring(0, 50));
        btn.textContent = originalBtnText;
        return;
      }
      btn.textContent = originalBtnText;

      if (!res.ok) { toast('❌ ' + (data.error || '아이디 또는 비밀번호가 잘못되었습니다')); return; }

      currentUser = { id: data.id, name: data.name, role: data.role };
      setDB('session', currentUser);

      authScreen.classList.remove('active');
      setTimeout(function () {
        authScreen.style.display = 'none';
        mainScreen.classList.add('active');
        loadDataAndInit();
      }, 400);
      toast('✅ 환영합니다, ' + data.name + '님!');
    } catch(err) {
      btn.textContent = originalBtnText;
      toast('❌ 서버 연결 불안정: ' + err.message);
    }
  }

  // LOGOUT
  $('btn-logout').addEventListener('click', function () {
    if (!confirm('로그아웃 하시겠어요?')) return;
    localStorage.removeItem('session');
    location.reload();
  });

  // ═══ APP INIT ═══
  function initApp() {
    $('clock').textContent = clockStr();
    setInterval(function () { $('clock').textContent = clockStr(); }, 30000);

    $('welcome-text').textContent = '안녕하세요, ' + (currentUser ? currentUser.name : '') + '님! 👋';
    $('date-display').textContent = todayLabel();

    renderHome();
    setupTabs();
    setupNav();
    renderCalendar();
    renderFeed();
    renderNutrition();
    renderAllergy();
    setupUpload();

    $('goto-photo').addEventListener('click', function () { goPage('photo'); });
    $('btn-bell').addEventListener('click', function () { toast('🔔 새로운 알림이 없습니다'); });
  }

  // ═══ HOME ═══
  function renderHome() {
    var data = loadMeals(todayStr());
    var grid = $('menu-grid');
    var empty = $('empty-state');
    grid.innerHTML = '';

    if (!data) {
      grid.style.display = 'none';
      empty.style.display = '';
      $('kcal-num').textContent = '0';
      $('kcal-desc').textContent = '데이터 없음';
      return;
    }

    var menus = data[currentMeal] || [];
    if (menus.length === 0) {
      grid.style.display = 'none';
      empty.style.display = '';
      $('kcal-num').textContent = '0';
      $('kcal-desc').textContent = (currentMeal === 'lunch' ? '점심' : '저녁') + ' 정보 없음';
      return;
    }

    empty.style.display = 'none';
    grid.style.display = '';

    var totalKcal = 0;
    for (var i = 0; i < menus.length; i++) totalKcal += (menus[i].kcal || 0);
    $('kcal-num').textContent = totalKcal;
    $('kcal-desc').textContent = '권장량의 ' + Math.round((totalKcal / 850) * 100) + '%';

    for (var j = 0; j < menus.length; j++) {
      var m = menus[j];
      var card = document.createElement('div');
      card.className = 'menu-card';
      card.innerHTML =
        '<div class="mc-visual">' +
          (m.allergy ? '<div class="mc-allergy-badge"></div>' : '') +
          '<div class="mc-ring"><span class="mc-emoji">' + m.emoji + '</span></div>' +
        '</div>' +
        '<div class="mc-info">' +
          '<div class="mc-name">' + m.name + '</div>' +
          '<div class="mc-sub">' + m.kcal + ' kcal' + (m.allergy ? ' · ' + m.allergy + ' ⚠' : '') + '</div>' +
        '</div>';
      (function (menu) {
        card.addEventListener('click', function () { openDetail(menu); });
      })(m);
      grid.appendChild(card);
    }
  }

  // ═══ TABS ═══
  function setupTabs() {
    var tabs = $$('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
        this.classList.add('active');
        currentMeal = this.getAttribute('data-meal');
        renderHome();
        renderNutrition();
        renderAllergy();
      });
    }
  }

  // ═══ DETAIL ═══
  function openDetail(m) {
    detailOpen = true;
    $('appbar-home').style.display = 'none';
    $('appbar-detail').classList.add('show');
    $('bottom-nav').style.display = 'none';
    $('detail-bar-title').textContent = m.name;
    $('detail-emoji').textContent = m.emoji;
    $('detail-name').textContent = m.name;

    var sub = m.kcal + ' kcal';
    if (m.allergy) sub += ' · ' + m.allergy + ' 알레르기 주의';
    $('detail-sub').textContent = sub;

    // Ingredients
    var ingsHtml = '';
    if (m.allergy) {
      var parts = m.allergy.split('·');
      for (var a = 0; a < parts.length; a++) {
        ingsHtml += '<div class="ing-row"><div class="ing-dot warn"></div>' +
          '<span class="ing-name">' + parts[a].trim() + ' 함유</span>' +
          '<span class="ing-badge badge-warn">⚠ ' + parts[a].trim() + '</span></div>';
      }
    }
    ingsHtml += '<div class="ing-row"><div class="ing-dot"></div>' +
      '<span class="ing-name">' + m.name + '</span>' +
      '<span class="ing-badge badge-ok">주재료</span></div>';
    $('detail-ings').innerHTML = ingsHtml;

    // Nutrition bars
    var protein = Math.round(m.kcal * 0.12 / 4);
    var fat = Math.round(m.kcal * 0.3 / 9);
    var carbs = Math.round(m.kcal * 0.58 / 4);

    var barsHtml = '<div class="bar-group">';
    barsHtml += makeBar('단백질', protein, 55, 'g', false);
    barsHtml += makeBar('지방', fat, 44, 'g', fat > 15);
    barsHtml += makeBar('탄수화물', carbs, 130, 'g', false);
    barsHtml += '</div>';
    $('detail-nuts').innerHTML = barsHtml;

    setTimeout(function () {
      var fills = $('detail-nuts').querySelectorAll('.bar-fill');
      for (var f = 0; f < fills.length; f++) {
        fills[f].style.width = fills[f].getAttribute('data-w');
      }
    }, 80);

    showOnlyPage('detail');
    $('main-scroll').scrollTop = 0;
  }

  function makeBar(label, val, max, unit, warn) {
    var pct = Math.min(Math.round((val / max) * 100), 100);
    return '<div class="bar-item"><div class="bar-meta"><span class="bar-label">' + label +
      '</span><span class="bar-value">' + val + unit + ' / ' + max + unit +
      '</span></div><div class="bar-track"><div class="bar-fill' + (warn ? ' warn' : '') +
      '" data-w="' + pct + '%"></div></div></div>';
  }

  $('btn-back').addEventListener('click', function () {
    detailOpen = false;
    $('appbar-detail').classList.remove('show');
    $('appbar-home').style.display = '';
    $('bottom-nav').style.display = '';
    showOnlyPage(currentPage);
  });

  // ═══ NAVIGATION ═══
  function setupNav() {
    var navBtns = $$('.nav-item');
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].addEventListener('click', function () {
        goPage(this.getAttribute('data-page'));
      });
    }
  }

  function goPage(pg) {
    if (detailOpen) {
      detailOpen = false;
      $('appbar-detail').classList.remove('show');
      $('appbar-home').style.display = '';
      $('bottom-nav').style.display = '';
    }
    currentPage = pg;

    var navBtns = $$('.nav-item');
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].classList.toggle('active', navBtns[i].getAttribute('data-page') === pg);
    }

    // Show/hide FAB on photo page
    $('btn-fab').style.display = (pg === 'photo') ? '' : 'none';

    showOnlyPage(pg);
    $('main-scroll').scrollTop = 0;
  }

  function showOnlyPage(pg) {
    var pages = $$('.page');
    for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
    var target = $('page-' + pg);
    if (target) target.classList.add('active');
  }

  // ═══ CALENDAR ═══
  function renderCalendar() {
    var strip = $('week-strip');
    strip.innerHTML = '';

    var now = new Date();
    var dow = now.getDay();
    var monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));

    var labels = ['월', '화', '수', '목', '금'];
    for (var i = 0; i < 5; i++) {
      var dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      var ds = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
      var isToday = ds === todayStr();

      var el = document.createElement('div');
      el.className = 'week-day' + (isToday ? ' active' : '');
      el.setAttribute('data-date', ds);
      el.innerHTML = '<small>' + labels[i] + '</small><strong>' + dd.getDate() + '</strong>';
      el.addEventListener('click', function () {
        var wds = $$('.week-day');
        for (var w = 0; w < wds.length; w++) wds[w].classList.remove('active');
        this.classList.add('active');
        renderCalendarDetail(this.getAttribute('data-date'));
      });
      strip.appendChild(el);
    }

    renderCalendarDetail(todayStr());
  }

  function renderCalendarDetail(dateStr) {
    var d = new Date(dateStr);
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    $('cal-title').textContent = dayNames[d.getDay()] + '요일 점심';

    var data = loadMeals(dateStr);
    var list = $('cal-list');
    list.innerHTML = '';

    if (!data || !data.lunch || data.lunch.length === 0) {
      var li = document.createElement('li');
      li.textContent = '등록된 급식 정보가 없습니다';
      li.style.color = 'var(--ink-3)';
      list.appendChild(li);
      return;
    }

    for (var i = 0; i < data.lunch.length; i++) {
      var item = document.createElement('li');
      item.textContent = data.lunch[i].emoji + '  ' + data.lunch[i].name;
      list.appendChild(item);
    }
  }

  // ═══ PHOTO FEED ═══
  async function renderFeed() {
    var list = $('feed-list');
    list.innerHTML = '<div class="empty-state"><p>사진을 불러오는 중...</p></div>';
    
    try {
      const res = await fetch('/api/photos?date=' + todayStr());
      if (res.ok) {
        const photos = await res.json();
        if (photos.length === 0) {
          list.innerHTML = '<div class="empty-state"><p>📸 아직 올라온 사진이 없어요</p></div>';
          var tz = $('photo-teaser');
          if(tz) tz.style.display = 'none';
          return;
        }
        
        list.innerHTML = '';
        var teaserContainer = $('photo-teaser');
        if(teaserContainer) teaserContainer.style.display = '';
        var teaserBody = teaserContainer ? teaserContainer.querySelector('.teaser-empty') : null;
        if(teaserBody) teaserBody.innerHTML = '';
        
        for (var i = 0; i < photos.length; i++) {
          var p = photos[i];
          
          if (i === 0 && teaserBody) {
            var teaserImg = document.createElement('img');
            teaserImg.src = p.img;
            teaserImg.style.width = '100%';
            teaserImg.style.borderRadius = 'var(--radius-md)';
            teaserImg.style.marginTop = '12px';
            teaserBody.appendChild(teaserImg);
          }

          var card = document.createElement('div');
          card.className = 'feed-card';
          var dt = new Date(p.ts || Date.now());
          var timeStr = dt.getHours() + ':' + String(dt.getMinutes()).padStart(2, '0');
          
          card.innerHTML =
            '<div class="feed-header"><div class="feed-avatar"></div>' +
            '<div class="feed-meta"><strong>' + p.user + '</strong><span>' + timeStr + '</span></div></div>' +
            '<img src="' + p.img + '" class="feed-img" alt="">';
          list.appendChild(card);
        }
      }
    } catch(e) {
      list.innerHTML = '<div class="empty-state"><p>❌ 사진을 불러오지 못했습니다</p></div>';
    }
  }

  // ═══ NUTRITION ═══
  function renderNutrition() {
    $('nut-date-text').textContent = todayLabel() + ' ' + (currentMeal === 'lunch' ? '점심' : '저녁');

    var data = loadMeals(todayStr());
    var menus = data ? (data[currentMeal] || []) : [];

    var totalKcal = 0;
    for (var i = 0; i < menus.length; i++) totalKcal += (menus[i].kcal || 0);
    $('nut-kcal').textContent = totalKcal;
    $('nut-cnt').textContent = menus.length;

    var protein = Math.round(totalKcal * 0.15 / 4);
    var fat = Math.round(totalKcal * 0.25 / 9);
    var carbs = Math.round(totalKcal * 0.6 / 4);
    var sodium = Math.round(totalKcal * 1.2);
    var allergyCount = 0;
    for (var a = 0; a < menus.length; a++) { if (menus[a].allergy) allergyCount++; }

    var comments = [
      '균형 잡힌 식단으로 칼슘과 단백질이 풍부해요! 🎉',
      '채소가 포함되어 식이섬유 섭취에 좋아요! 🥬',
      '오늘은 적절한 열량 구성이에요. 잘 먹었어요! ✨',
      '다양한 영양소가 골고루 들어있어요! 💪'
    ];
    $('nut-comment').textContent = menus.length > 0
      ? comments[Math.floor(Math.random() * comments.length)]
      : '급식 정보가 등록되면 분석해드려요!';

    // Stats
    var statGrid = $('stat-grid');
    statGrid.innerHTML = '';
    var stats = [
      { v: protein + 'g', l: '단백질', lo: false },
      { v: fat + 'g', l: '지방', lo: fat > 25 },
      { v: carbs + 'g', l: '탄수화물', lo: false },
      { v: String(totalKcal), l: '칼로리', lo: false },
      { v: String(allergyCount), l: '알레르기⚠', lo: allergyCount > 0 },
      { v: String(menus.length), l: '메뉴 수', lo: false }
    ];
    for (var s = 0; s < stats.length; s++) {
      var cell = document.createElement('div');
      cell.className = 'stat-cell';
      cell.innerHTML = '<div class="stat-val' + (stats[s].lo ? ' lo' : '') + '">' + stats[s].v + '</div><span class="stat-lbl">' + stats[s].l + '</span>';
      statGrid.appendChild(cell);
    }

    // Bars
    var bars = $('nut-bars');
    bars.innerHTML = '';
    var barData = [
      { l: '단백질', v: protein, m: 55, u: 'g', c: 'var(--green)' },
      { l: '지방', v: fat, m: 44, u: 'g', c: 'var(--amber)' },
      { l: '탄수화물', v: carbs, m: 130, u: 'g', c: '#10b981' },
      { l: '나트륨', v: sodium, m: 2000, u: 'mg', c: 'var(--orange)' }
    ];
    for (var b = 0; b < barData.length; b++) {
      var pct = Math.min(Math.round((barData[b].v / barData[b].m) * 100), 100);
      var item = document.createElement('div');
      item.className = 'bar-item';
      item.innerHTML =
        '<div class="bar-meta"><span class="bar-label">' + barData[b].l +
        '</span><span class="bar-value">' + barData[b].v + barData[b].u + ' / ' + barData[b].m + barData[b].u +
        '</span></div><div class="bar-track"><div class="bar-fill" data-w="' + pct +
        '%" style="width:0;background:' + barData[b].c + '"></div></div>';
      bars.appendChild(item);
    }
    setTimeout(function () {
      var fills = bars.querySelectorAll('.bar-fill');
      for (var f = 0; f < fills.length; f++) fills[f].style.width = fills[f].getAttribute('data-w');
    }, 200);
  }

  // ═══ ALLERGY ═══
  function renderAllergy() {
    var data = loadMeals(todayStr());
    var menus = data ? (data[currentMeal] || []) : [];

    var allergens = {};
    for (var i = 0; i < menus.length; i++) {
      if (menus[i].allergy) {
        var parts = menus[i].allergy.split('·');
        for (var p = 0; p < parts.length; p++) allergens[parts[p].trim()] = true;
      }
    }

    var tags = $('allergy-tags');
    tags.innerHTML = '';
    var keys = Object.keys(allergens);
    for (var k = 0; k < keys.length; k++) {
      var tag = document.createElement('span');
      tag.className = 'allergy-tag tag-warn';
      tag.textContent = '⚠ ' + keys[k];
      tags.appendChild(tag);
    }
    var safeCount = 0;
    for (var sc = 0; sc < menus.length; sc++) { if (!menus[sc].allergy) safeCount++; }
    if (menus.length > 0) {
      var safeTag = document.createElement('span');
      safeTag.className = 'allergy-tag tag-safe';
      safeTag.textContent = '✓ ' + safeCount + '개 안전';
      tags.appendChild(safeTag);
    }

    var cards = $('allergy-cards');
    cards.innerHTML = '';
    if (menus.length === 0) {
      cards.innerHTML = '<div class="empty-state"><p>등록된 급식 정보가 없습니다</p></div>';
      return;
    }
    for (var c = 0; c < menus.length; c++) {
      var m = menus[c];
      var item = document.createElement('div');
      item.className = 'allergy-item';
      item.innerHTML =
        '<span class="allergy-emoji">' + m.emoji + '</span>' +
        '<div class="allergy-info"><div class="allergy-name">' + m.name + '</div>' +
        '<div class="allergy-detail">' + m.kcal + ' kcal</div></div>' +
        '<span class="allergy-badge ' + (m.allergy ? 'ab-warn' : 'ab-safe') + '">' +
        (m.allergy ? '⚠ ' + m.allergy : '✓ 안전') + '</span>';
      cards.appendChild(item);
    }
  }

  // ═══ UPLOAD ═══
  function setupUpload() {
    var modal = $('upload-modal');
    var dropZone = $('upload-drop');
    var fileInput = $('upload-file');
    var previewBox = $('upload-preview');
    var previewImg = $('upload-preview-img');

    $('btn-fab').addEventListener('click', function () { modal.classList.add('show'); });
    $('upload-close').addEventListener('click', closeUpload);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeUpload(); });

    dropZone.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
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

    $('upload-submit').addEventListener('click', async function () {
      var btn = this;
      if (!previewImg.src) return;
      
      var origText = btn.textContent;
      btn.textContent = '사진 최적화 및 업로드 중...';
      
      try {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.src = previewImg.src;
        
        await new Promise(r => img.onload = r);
        
        var maxW = 800;
        var scale = maxW / img.width;
        if (scale > 1) scale = 1;
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        var base64 = canvas.toDataURL('image/jpeg', 0.8);
        
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            date: todayStr(), 
            photoBase64: base64, 
            user: currentUser ? currentUser.name : '익명'
          })
        });
        
        if (res.ok) {
          toast('✅ 사진이 안전하게 업로드되었습니다!');
          closeUpload();
          renderFeed();
        } else {
          var errText = await res.text();
          toast('❌ 업로드 실패: ' + res.status + ' ' + errText.substring(0, 80));
        }
      } catch(e) {
        toast('❌ 서버 연결 오류: ' + e.message);
      }
      btn.textContent = origText;
    });

    function closeUpload() {
      modal.classList.remove('show');
      fileInput.value = '';
      previewBox.style.display = 'none';
      dropZone.style.display = '';
      $('upload-memo').value = '';
    }
  }

})();
