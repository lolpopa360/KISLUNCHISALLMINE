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
  // ── 베트남 시간 (UTC+7) 기준 날짜/시간 유틸 ──
  var VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  function nowVN() {
    return new Date(Date.now() + VN_OFFSET_MS);
  }
  function toDateStr(d) {
    return d.getUTCFullYear() + '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(d.getUTCDate()).padStart(2, '0');
  }

  function todayStr() {
    var d = nowVN();
    // 저녁 8시(20시) 이후면 내일 날짜 반환
    if (d.getUTCHours() >= 20) {
      d = new Date(d.getTime() + 86400000);
    }
    // 주말(토/일)이면 월요일로 이동
    var dow = d.getUTCDay();
    if (dow === 0) d = new Date(d.getTime() + 86400000);
    if (dow === 6) d = new Date(d.getTime() + 2 * 86400000);
    return toDateStr(d);
  }
  function isTomorrowOnHome() {
    var d = nowVN();
    if (d.getUTCHours() >= 20) return true;
    var dow = d.getUTCDay();
    return dow === 0 || dow === 6;
  }
  function todayLabel() {
    var d = nowVN();
    var days = ['일', '월', '화', '수', '목', '금', '토'];
    return d.getUTCFullYear() + '년 ' + (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일 ' + days[d.getUTCDay()] + '요일';
  }
  function clockStr() {
    var d = nowVN();
    return d.getUTCHours() + ':' + String(d.getUTCMinutes()).padStart(2, '0');
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

  // Check existing session — but always load app directly
  var existingSession = getDB('session', null);
  if (existingSession) {
    currentUser = existingSession;
  }

  async function loadDataAndInit() {
    try {
      const res = await fetch('/api/meals');
      if (res.ok) cachedMeals = await res.json();
    } catch (e) {
      console.warn('API error, fallback to offline', e);
    }
    initApp();
  }

  // Always skip auth and show main app directly
  authScreen.classList.remove('active');
  authScreen.style.display = 'none';
  mainScreen.classList.add('active');
  loadDataAndInit();

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
        renderProfile();
        renderHome();
        renderAllergy();
        goPage('profile');
      }, 300);
      toast('✅ 환영합니다, ' + data.name + '님!');
    } catch(err) {
      btn.textContent = originalBtnText;
      toast('❌ 서버 연결 불안정: ' + err.message);
    }
  }

  // LOGOUT — no reload, just reset state
  $('btn-logout').addEventListener('click', function () {
    if (!confirm('로그아웃 하시겠어요?')) return;
    localStorage.removeItem('session');
    currentUser = null;
    renderProfile();
    renderHome();
    renderAllergy();
    toast('로그아웃되었습니다');
  });

  // ═══ THEME ═══
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    setDB('theme', theme);
    var btnLight = $('theme-light');
    var btnDark = $('theme-dark');
    if (btnLight) btnLight.classList.toggle('active', theme === 'light');
    if (btnDark) btnDark.classList.toggle('active', theme === 'dark');
  }

  // Apply saved theme on load
  applyTheme(getDB('theme', 'light'));

  // ═══ APP INIT ═══
  function initApp() {
    // 1. 필수 UI 인터랙션 우선 설정 (데이터 로딩과 무관하게 작동해야 함)
    setupNav();
    setupTabs();

    // Theme toggle buttons
    var btnLight = $('theme-light');
    var btnDark = $('theme-dark');
    if (btnLight) btnLight.addEventListener('click', function() { applyTheme('light'); });
    if (btnDark) btnDark.addEventListener('click', function() { applyTheme('dark'); });

    var clk = $('clock');
    if (clk) {
      clk.textContent = clockStr();
      setInterval(function () { clk.textContent = clockStr(); }, 30000);
    }

    var wt = $('welcome-text');
    if (wt) wt.textContent = currentUser ? '안녕하세요, ' + currentUser.name + '님!' : '안녕하세요!';
    
    var dd = $('date-display');
    if (dd) dd.textContent = todayLabel();

    // 2. 비즈니스 로직 렌더링
    renderHome();
    renderCalendar();
    renderFeed();
    renderAllergy();
    renderProfile();
    setupUpload();
    initFeedDateNav();

    // 3. 부가 기능 이벤트 리스너 (요소 존재 여부 상시 체크)
    var htl = $('home-toggle-lunch');
    var htd = $('home-toggle-dinner');
    if (htl && htd) {
      htl.addEventListener('click', function() {
        htl.classList.add('active'); htd.classList.remove('active');
        renderHomeNutrition(todayStr(), 'lunch');
      });
      htd.addEventListener('click', function() {
        htd.classList.add('active'); htl.classList.remove('active');
        renderHomeNutrition(todayStr(), 'dinner');
      });
    }

    var gp = $('goto-photo');
    if (gp) gp.addEventListener('click', function () { goPage('photo'); });

    var bb = $('btn-bell');
    if (bb) bb.addEventListener('click', function () { toast('🔔 새로운 알림이 없습니다'); });

    var bp = $('btn-profile');
    if (bp) bp.addEventListener('click', function () { goPage('profile'); renderProfile(); });

    // Go to auth from profile page
    var bga = $('btn-goto-auth');
    if (bga) bga.addEventListener('click', function () {
      mainScreen.classList.remove('active');
      authScreen.style.display = '';
      authScreen.classList.add('active');
    });

    // Skip/back from auth screen
    var asb = $('auth-skip-btn');
    if (asb) asb.addEventListener('click', function () {
      authScreen.classList.remove('active');
      authScreen.style.display = 'none';
      mainScreen.classList.add('active');
    });
  }

  // ═══ HOME ═══
  function renderHome() {
    var dateStr = todayStr();
    var data = loadMeals(dateStr);
    var grid = $('menu-grid');
    var empty = $('empty-state');
    
    // 타이틀 및 날짜 표시 업데이트
    var hmt = $('home-meal-title');
    var dd = $('date-display');
    if (isTomorrowOnHome()) {
      var _vnNow = nowVN();
      var _isWeekend = _vnNow.getUTCDay() === 0 || _vnNow.getUTCDay() === 6;
      if (hmt) hmt.textContent = _isWeekend ? '📅 월요일 식단' : '🌙 내일의 식단';
      var _next = new Date(_vnNow.getTime() + 86400000);
      var days = ['일','월','화','수','목','금','토'];
      if (dd) dd.textContent = _next.getUTCFullYear() + '년 ' + (_next.getUTCMonth() + 1) + '월 ' + _next.getUTCDate() + '일 ' + days[_next.getUTCDay()] + '요일';
    } else {
      if (hmt) hmt.textContent = '☀️ 오늘의 식단';
      if (dd) dd.textContent = todayLabel();
    }

    grid.innerHTML = '';

    if (!data) {
      grid.style.display = 'none';
      empty.style.display = '';
      renderHomeNutrition(dateStr, currentMeal);
      return;
    }

    var menus = data[currentMeal] || [];
    if (menus.length === 0) {
      grid.style.display = 'none';
      empty.style.display = '';
      renderHomeNutrition(dateStr, currentMeal);
      return;
    }

    empty.style.display = 'none';
    grid.style.display = '';

    var totalKcal = 0;
    for (var i = 0; i < menus.length; i++) totalKcal += (menus[i].kcal || 0);
    // kcal-num/desc 대신 home-insight 카드가 역할을 수행함 (renderNutrition 호출 시 업데이트됨)

    for (var j = 0; j < menus.length; j++) {
      var m = menus[j];
      var card = document.createElement('div');
      var isDanger = false;
      var dangerMatched = [];
      if (m.allergy && currentUser && currentUser.allergies) {
        var mAllergies = m.allergy.split('·').map(function(a){return a.trim()});
        for (var k = 0; k < mAllergies.length; k++) {
          if (currentUser.allergies.includes(mAllergies[k])) {
            isDanger = true;
            dangerMatched.push(mAllergies[k]);
          }
        }
      }
      card.className = 'menu-card' + (isDanger ? ' danger' : '');
      card.innerHTML =
        '<div class="mc-visual">' +
          (m.allergy ? '<div class="mc-allergy-badge"></div>' : '') +
          '<div class="mc-ring"><span class="mc-emoji">' + m.emoji + '</span></div>' +
        '</div>' +
        '<div class="mc-info">' +
          '<div class="mc-name">' + m.name + '</div>' +
          '<div class="mc-sub">' + m.kcal + ' kcal' + (m.allergy ? ' · ' + m.allergy + ' ⚠' : '') + '</div>' +
          (isDanger ? '<div class="danger-badge">🚨 ' + dangerMatched.join(', ') + ' 주의!</div>' : '') +
        '</div>';
      (function (menu) {
        card.addEventListener('click', function () { openDetail(menu); });
      })(m);
      grid.appendChild(card);
    }

    // 홈 화면 영양 렌더링 (간소화)
    renderHomeNutrition(dateStr, currentMeal);
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
        renderAllergy();
        
        // 홈 인사이트 카드의 토글 버튼도 동기화 (UI 일관성)
        var htl = $('home-toggle-lunch');
        var htd = $('home-toggle-dinner');
        if (htl && htd) {
          if (currentMeal === 'lunch') {
            htl.classList.add('active'); htd.classList.remove('active');
          } else {
            htd.classList.add('active'); htl.classList.remove('active');
          }
        }
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

    // Close bottom sheet if open
    var _bs = $('cal-bottom-sheet');
    var _bd = $('cal-sheet-backdrop');
    if (_bs) _bs.classList.remove('show');
    if (_bd) _bd.classList.remove('show');

    var navBtns = $$('.nav-item');
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].classList.toggle('active', navBtns[i].getAttribute('data-page') === pg);
    }

    // Show/hide FAB on photo page (admin only)
    var isAdmin = currentUser && currentUser.role === 'admin';
    $('btn-fab').style.display = (pg === 'photo' && isAdmin) ? '' : 'none';

    showOnlyPage(pg);
    $('main-scroll').scrollTop = 0;
    $('app').scrollTop = 0;
  }

  function showOnlyPage(pg) {
    var pages = $$('.page');
    for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
    var target = $('page-' + pg);
    if (target) target.classList.add('active');
  }

  // ═══ CALENDAR (MONTHLY) ═══
  var calCurrentDate = new Date();

  function renderCalendar() {
    var year = calCurrentDate.getFullYear();
    var month = calCurrentDate.getMonth();
    var monthTitle = $('cal-month-title');
    if(monthTitle) monthTitle.textContent = year + '.' + String(month + 1).padStart(2, '0');

    var grid = $('cal-grid');
    if(!grid) return;
    grid.innerHTML = '';

    var firstDay = new Date(year, month, 1);
    var startDayOfWeek = firstDay.getDay(); 
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    // 1일 요일만큼 빈 칸
    for (var i = 0; i < startDayOfWeek; i++) {
      var emptyCell = document.createElement('div');
      emptyCell.className = 'cal-cell empty';
      grid.appendChild(emptyCell);
    }

    // 날짜 렌더링
    var tsStr = todayStr();
    for (var d = 1; d <= daysInMonth; d++) {
      var currentCellDate = new Date(year, month, d);
      var currentDow = currentCellDate.getDay();
      var ds = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      var isToday = ds === tsStr;

      var cell = document.createElement('div');
      cell.className = 'cal-cell' + (isToday ? ' today' : '');
      if (currentDow === 0) cell.classList.add('sunday');
      if (currentDow === 6) cell.classList.add('saturday');

      var mealData = loadMeals(ds);
      var hasLunch = mealData && mealData.lunch && mealData.lunch.length > 0;
      var hasDinner = mealData && mealData.dinner && mealData.dinner.length > 0;

      cell.innerHTML = '<div class="cal-cell-day">' + d + '</div>' +
        '<div class="cal-indicator-dots">' +
        (hasLunch ? '<div class="cal-dot lunch"></div>' : '') +
        (hasDinner ? '<div class="cal-dot dinner"></div>' : '') +
        '</div>';

      (function(dateString, data) {
         cell.addEventListener('click', function() {
           openCalSheet(dateString, data);
         });
      })(ds, mealData);

      grid.appendChild(cell);
    }
  }

  var btnCalPrev = $('cal-prev-btn');
  if(btnCalPrev) btnCalPrev.addEventListener('click', function() {
    calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
    renderCalendar();
  });
  
  var btnCalNext = $('cal-next-btn');
  if(btnCalNext) btnCalNext.addEventListener('click', function() {
    calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
    renderCalendar();
  });

  // ═══ CALENDAR BOTTOM SHEET ═══
  var calSheetBackdrop = $('cal-sheet-backdrop');
  var calBottomSheet = $('cal-bottom-sheet');
  var cbsSelectedDate = '';
  
  function dateStrToLabel(dateStr) {
    // parse without UTC shift: YYYY-MM-DD
    var parts = dateStr.split('-');
    var y = parseInt(parts[0]), mo = parseInt(parts[1]) - 1, d = parseInt(parts[2]);
    var dObj = new Date(y, mo, d);
    var dayNames = ['일','월','화','수','목','금','토'];
    return mo + 1 + '월 ' + d + '일 (' + dayNames[dObj.getDay()] + ')';
  }

  function dateStrShift(dateStr, delta) {
    var parts = dateStr.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
    d.setDate(d.getDate() + delta);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  async function openCalSheet(dateStr, data) {
    cbsSelectedDate = dateStr;
    calSheetBackdrop = $('cal-sheet-backdrop');
    calBottomSheet = $('cal-bottom-sheet');
    if(!calBottomSheet) return;

    $('cbs-date-title').textContent = dateStrToLabel(dateStr);

    var lList = $('cbs-lunch-list');
    var dList = $('cbs-dinner-list');
    if(lList) lList.innerHTML = ''; 
    if(dList) dList.innerHTML = '';

    // 사진 연동
    var photoBox = $('cbs-today-photo');
    if (photoBox) {
      photoBox.style.display = 'none';
      photoBox.innerHTML = '';
      try {
        const res = await fetch('/api/photos?date=' + dateStr);
        if (res.ok) {
          const photos = await res.json();
          if (photos.length > 0) {
            photoBox.style.display = 'block';
            photoBox.innerHTML = '<img src="' + photos[0].img + '" style="width:100%; height:200px; object-fit:cover; display:block;" alt="오늘의 특식 사진">';
          }
        }
      } catch(e) { console.warn('Photo fetch failed'); }
    }

    function makeMealItems(mealArr, targetUl) {
      if (!targetUl) return;
      if (!mealArr || mealArr.length === 0) {
        targetUl.innerHTML = '<div class="cbs-empty">등록된 급식/석식 정보가 없습니다.</div>';
        return;
      }
      mealArr.forEach(function(m) {
        var isDanger = false;
        if (m.allergy && currentUser && currentUser.allergies) {
           var mAllgs = m.allergy.split('·').map(function(a){return a.trim()});
           for(var k=0; k<mAllgs.length; k++) {
             if(currentUser.allergies.includes(mAllgs[k])){ isDanger=true; break; }
           }
        }
        var div = document.createElement('div');
        div.className = 'cbs-meal-item' + (isDanger ? ' cbs-danger' : '');
        div.innerHTML = '<span>' + m.name + '</span>' + 
                        '<span class="kcal">' + (m.kcal||0) + 'kcal</span>' + 
                        (isDanger ? '<div class="cbs-danger-badge">🚨</div>' : '');
        targetUl.appendChild(div);
      });
    }

    makeMealItems(data ? data.lunch : [], lList);
    makeMealItems(data ? data.dinner : [], dList);

    // 영양 정보 렌더링 (기본: 점심)
    renderSheetNutrition(dateStr, 'lunch');

    // 토글 버튼 이벤트
    var cbsToggleLunch = $('cbs-toggle-lunch');
    var cbsToggleDinner = $('cbs-toggle-dinner');
    if (cbsToggleLunch && cbsToggleDinner) {
      cbsToggleLunch.onclick = function() {
        cbsToggleLunch.classList.add('active'); cbsToggleDinner.classList.remove('active');
        renderSheetNutrition(cbsSelectedDate, 'lunch');
      };
      cbsToggleDinner.onclick = function() {
        cbsToggleDinner.classList.add('active'); cbsToggleLunch.classList.remove('active');
        renderSheetNutrition(cbsSelectedDate, 'dinner');
      };
      // 리셋 토글 상태
      cbsToggleLunch.classList.add('active');
      cbsToggleDinner.classList.remove('active');
    }

    calSheetBackdrop.classList.add('show');
    calBottomSheet.classList.add('show');
    var content = calBottomSheet.querySelector('.cbs-content');
    if (content) content.scrollTop = 0;
  }

  function renderSheetNutrition(dateStr, mealType) {
    var data = loadMeals(dateStr);
    var menus = data ? (data[mealType] || []) : [];

    var totalKcal = 0, p = 0, f = 0, c = 0;
    menus.forEach(m => {
      totalKcal += (m.kcal || 0);
      p += (m.p || 0);
      f += (m.f || 0);
      c += (m.c || 0);
    });

    var kcalEl = $('cbs-kcal');
    if (kcalEl) kcalEl.textContent = totalKcal;

    var commentEl = $('cbs-comment');
    if (commentEl) commentEl.textContent = getMealTip(menus);

    var barsEl = $('cbs-macro-bars');
    if (barsEl) {
      var protein = p || Math.round(totalKcal * 0.12 / 4);
      var fat = f || Math.round(totalKcal * 0.3 / 9);
      var carbs = c || Math.round(totalKcal * 0.58 / 4);

      barsEl.innerHTML =
        makeSimpleBar('탄수화물', carbs, 130, 'g', '#FF6D3B') +
        makeSimpleBar('단백질', protein, 55, 'g', '#2E7D32') +
        makeSimpleBar('지방', fat, 44, 'g', fat > 30 ? '#ef4444' : '#78716c');
    }
  }

  function closeCalSheet() {
    if(!calBottomSheet) return;
    calSheetBackdrop.classList.remove('show');
    calBottomSheet.classList.remove('show');
    $('app').scrollTop = 0;
  }

  if($('cbs-close-btn')) $('cbs-close-btn').addEventListener('click', closeCalSheet);
  if($('cal-sheet-backdrop')) $('cal-sheet-backdrop').addEventListener('click', closeCalSheet);

  // Prev/Next day buttons
  if($('cbs-prev-day')) $('cbs-prev-day').addEventListener('click', function() {
    openCalSheet(dateStrShift(cbsSelectedDate, -1), loadMeals(dateStrShift(cbsSelectedDate, -1)));
  });
  if($('cbs-next-day')) $('cbs-next-day').addEventListener('click', function() {
    openCalSheet(dateStrShift(cbsSelectedDate, 1), loadMeals(dateStrShift(cbsSelectedDate, 1)));
  });

  // Swipe: down to close, left/right to navigate days
  var sheetStartY = 0, sheetStartX = 0;
  var handleArea = $('cbs-handle-area');
  if(handleArea) {
    handleArea.addEventListener('touchstart', function(e) {
      sheetStartY = e.touches[0].clientY;
    }, {passive:true});
    handleArea.addEventListener('touchmove', function(e) {
      if (e.touches[0].clientY - sheetStartY > 60) closeCalSheet();
    }, {passive:true});
  }

  // Horizontal swipe anywhere on the sheet content
  var sheetContent = document.querySelector('.cal-bottom-sheet .cbs-content');
  if(sheetContent) {
    sheetContent.addEventListener('touchstart', function(e) {
      sheetStartX = e.touches[0].clientX;
      sheetStartY = e.touches[0].clientY;
    }, {passive:true});
    sheetContent.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - sheetStartX;
      var dy = e.changedTouches[0].clientY - sheetStartY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        // horizontal swipe
        var delta = dx < 0 ? 1 : -1; // swipe left = next day, right = prev day
        openCalSheet(dateStrShift(cbsSelectedDate, delta), loadMeals(dateStrShift(cbsSelectedDate, delta)));
      }
    }, {passive:true});
  }

  // ═══ PHOTO FEED ═══
  var feedDate = todayStr();

  function initFeedDateNav() {
    var dateInput = $('feed-date');
    if (!dateInput) return;
    dateInput.value = feedDate;
    dateInput.addEventListener('change', function() {
      feedDate = this.value;
      renderFeed();
    });
    $('feed-prev').addEventListener('click', function() {
      feedDate = dateStrShift(feedDate, -1);
      $('feed-date').value = feedDate;
      renderFeed();
    });
    $('feed-next').addEventListener('click', function() {
      feedDate = dateStrShift(feedDate, 1);
      $('feed-date').value = feedDate;
      renderFeed();
    });
  }

  async function renderFeed() {
    var list = $('feed-list');
    if (!list) return;
    list.innerHTML = '<div class="empty-state"><p>사진을 불러오는 중...</p></div>';
    
    try {
      const res = await fetch('/api/photos?date=' + feedDate);
      if (res.ok) {
        const photos = await res.json();
        if (photos.length === 0) {
          list.innerHTML = '<div class="empty-state"><p>📸 이 날짜에 올라온 사진이 없어요</p></div>';
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

  // ═══ HOME NUTRITION (Simple + Radar) ═══
  function renderHomeNutrition(dateStr, mealType) {
    var data = loadMeals(dateStr);
    var menus = data ? (data[mealType] || []) : [];

    var totalKcal = 0, p = 0, f = 0, c = 0, na = 0;
    menus.forEach(function(m) {
      totalKcal += (m.kcal || 0);
      p += (m.p || 0);
      f += (m.f || 0);
      c += (m.c || 0);
      na += (m.na || 0);
    });

    var kcalEl = $('home-kcal');
    if (kcalEl) kcalEl.textContent = totalKcal;

    var commentEl = $('home-comment');
    if (commentEl) commentEl.textContent = getMealTip(menus);

    // Macro bars (use actual data or estimate from kcal)
    var barsEl = $('home-macro-bars');
    if (barsEl) {
      var protein = p || Math.round(totalKcal * 0.12 / 4);
      var fat = f || Math.round(totalKcal * 0.3 / 9);
      var carbs = c || Math.round(totalKcal * 0.58 / 4);

      barsEl.innerHTML =
        makeSimpleBar('탄수화물', carbs, 130, 'g', '#FF6D3B') +
        makeSimpleBar('단백질', protein, 55, 'g', '#2E7D32') +
        makeSimpleBar('지방', fat, 44, 'g', fat > 30 ? '#ef4444' : '#78716c');
    }

    // Hexagon Radar Chart — crisp on retina
    var canvas = $('home-radar');
    if (!canvas) return;
    var dpr = Math.round(window.devicePixelRatio || 1);
    var logicalSize = 240;
    // Only resize if needed to avoid layout thrash
    if (canvas.width !== logicalSize * dpr) {
      canvas.width = logicalSize * dpr;
      canvas.height = logicalSize * dpr;
      canvas.style.width = logicalSize + 'px';
      canvas.style.height = logicalSize + 'px';
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // reset + scale
    var w = logicalSize, h = logicalSize;
    var cx = w / 2, cy = h / 2;
    var radius = 88;

    var protein2 = p || Math.round(totalKcal * 0.12 / 4);
    var fat2 = f || Math.round(totalKcal * 0.3 / 9);
    var carbs2 = c || Math.round(totalKcal * 0.58 / 4);
    var na2 = na || (totalKcal > 0 ? 800 : 0);

    var dataVals = [
      Math.min(carbs2 / 120, 1.0),
      Math.min(protein2 / 50, 1.0),
      Math.min(fat2 / 40, 1.0),
      Math.min(na2 / 1800, 1.0),
      totalKcal > 0 ? 0.7 : 0,
      totalKcal > 0 ? 0.6 : 0
    ];
    if (totalKcal === 0) dataVals = [0, 0, 0, 0, 0, 0];
    var labels = ['탄수화물', '단백질', '지방', '나트륨', '비타민', '칼슘'];

    ctx.clearRect(0, 0, w, h);

    // Grid hexagons
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e2e8f0';
    for (var level = 1; level <= 4; level++) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
        var r = (radius / 4) * level;
        var x = cx + r * Math.cos(angle);
        var y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }

    // Axis lines
    ctx.strokeStyle = '#e2e8f0';
    for (var i = 0; i < 6; i++) {
      var angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      ctx.stroke();
    }

    // Data polygon
    if (totalKcal > 0) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
        var r = radius * dataVals[i];
        var x = cx + r * Math.cos(angle);
        var y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 109, 59, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#FF6D3B';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Data points
      for (var i = 0; i < 6; i++) {
        var angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
        var r = radius * dataVals[i];
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(angle), cy + r * Math.sin(angle), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FF6D3B';
        ctx.fill();
      }
    }

    // Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    for (var i = 0; i < 6; i++) {
      var angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
      var r = radius + 22;
      var lx = cx + r * Math.cos(angle);
      var ly = cy + r * Math.sin(angle);
      ctx.fillText(labels[i], lx, ly + 4);
    }
  }

  function makeSimpleBar(label, val, max, unit, color) {
    var pct = Math.min(Math.round((val / max) * 100), 100);
    return '<div class="simple-bar">' +
      '<div class="simple-bar-head"><span>' + label + '</span><span class="simple-bar-val">' + val + unit + '</span></div>' +
      '<div class="simple-bar-track"><div class="simple-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div></div>';
  }

  // ═══ NUTRITION (Detailed — Calendar) ═══
  function getMealTip(menus) {
    if (!menus || menus.length === 0) return "급식 정보가 아직 등록되지 않았어요.";

    var kcal = menus.reduce((acc, m) => acc + (m.kcal || 0), 0);
    var tips = [];
    var names = menus.map(m => m.name).join(' ');

    var hasMeats = /고기|불고기|닭|돈육|스테이크|햄|너겟|까스|살|Beef|Chicken|Pork/.test(names);
    var hasGreens = /샐러드|나물|무침|쌈|야채|채소|겉절이|Salad/.test(names);
    var hasFried = /튀김|까스|칩|치킨|강정|Fried/.test(names);
    var hasSodium = /국|개|탕|찌개|볶음|조림|Soup|Stew/.test(names);

    if (kcal > 950) tips.push("오늘은 든든한 식단! 밥을 조금 줄이면 딱 좋아요 🏃‍♂️");
    else if (kcal < 550) tips.push("가벼운 식단이에요~ 간식으로 우유나 견과류 챙겨요! 🥛");

    if (hasFried) tips.push("바삭한 튀김이 있네요! 나물 먼저 먹으면 속이 편해요 🥗");
    if (!hasGreens) tips.push("채소가 좀 아쉬운 날, 간식으로 과일 어때요? 🍎");
    if (hasMeats && hasGreens) tips.push("고기랑 채소가 딱 좋은 조합! 맛있게 먹어요 ✨");
    if (hasSodium && !hasGreens) tips.push("국물은 건더기 위주로 먹으면 나트륨 걱정 끝! 💧");

    if (tips.length === 0) tips.push("골고루 갖춰진 좋은 식단이에요, 맛있게 드세요! 🍽️");

    return tips[tips.length - 1];
  }

  function renderNutrition(dateStr, containerPrefix, mealType) {
    var radarEl = $(containerPrefix + '-radar');
    if (!radarEl) return;

    var data = loadMeals(dateStr);
    var menus = data ? (data[mealType || currentMeal] || []) : [];

    var totalKcal = 0, p = 0, f = 0, c = 0, na = 0;
    menus.forEach(m => {
      totalKcal += (m.kcal || 0);
      p += (m.p || 0);
      f += (m.f || 0);
      c += (m.c || 0);
      na += (m.na || 0);
    });
    
    var kcalEl = $(containerPrefix + '-kcal');
    if (kcalEl) kcalEl.textContent = totalKcal;
    
    var commentEl = $(containerPrefix + '-comment');
    if (commentEl) commentEl.textContent = getMealTip(menus);

    // Radar Chart Logic — DPR-scaled for crispness
    var canvas = radarEl;
    var dpr = Math.round(window.devicePixelRatio || 1);
    var logicalSize = (containerPrefix === 'home' || containerPrefix.startsWith('cbs')) ? 240 : 300;
    if (canvas.width !== logicalSize * dpr) {
      canvas.width = logicalSize * dpr;
      canvas.height = logicalSize * dpr;
      canvas.style.width = logicalSize + 'px';
      canvas.style.height = logicalSize + 'px';
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var w = logicalSize; var h = logicalSize;
    var cx = w / 2; var cy = h / 2;
    var radius = (containerPrefix === 'home' || containerPrefix.startsWith('cbs')) ? 88 : 120;

    // Data Mapping
    var dataVals = [
      Math.min(c / 120, 1.0),   // 탄수화물
      Math.min(p / 50, 1.0),    // 단백질
      Math.min(f / 40, 1.0),    // 지방
      Math.min(na / 1800, 1.0), // 나트륨
      totalKcal > 0 ? 0.7 : 0,  // 비타민 (추정)
      totalKcal > 0 ? 0.6 : 0   // 칼슘 (추정)
    ];
    if(totalKcal === 0) dataVals = [0,0,0,0,0,0];

    var labels = ['탄수화물', '단백질', '지방', '나트륨', '비타민', '칼슘'];
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    ctx.clearRect(0,0,w,h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0';
    
    for (var level = 1; level <= 4; level++) {
       ctx.beginPath();
       for (var i = 0; i < 6; i++) {
         var angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
         var r = (radius / 4) * level;
         var x = cx + r * Math.cos(angle);
         var y = cy + r * Math.sin(angle);
         if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
       }
       ctx.closePath(); ctx.stroke();
    }

    if (totalKcal > 0) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
        var r = radius * dataVals[i];
        var x = cx + r * Math.cos(angle);
        var y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(46, 125, 50, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = 3; ctx.stroke();
    }

    // Labels
    ctx.fillStyle = isDark ? '#cbd5e1' : '#64748b';
    ctx.font = '700 12px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    for (var i = 0; i < 6; i++) {
      var angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
      var r = radius + 20;
      var lx = cx + r * Math.cos(angle);
      var ly = cy + r * Math.sin(angle);
      ctx.fillText(labels[i], lx, ly + 5);
    }

    // Stats Grid
    var statGrid = $(containerPrefix + '-stat-grid');
    if (statGrid) {
      statGrid.innerHTML = '';
      var stats = [
        { v: Math.round(p) + 'g', l: '단백질', lo: false },
        { v: Math.round(f) + 'g', l: '지방', lo: f > 30 },
        { v: Math.round(c) + 'g', l: '탄수화물', lo: false },
        { v: String(totalKcal), l: '칼로리', lo: false },
        { v: Math.round(na) + 'mg', l: '나트륨', lo: na > 1500 },
        { v: String(menus.length), l: '메뉴 수', lo: false }
      ];
      stats.forEach(function(s) {
        var cell = document.createElement('div');
        cell.className = 'stat-cell';
        cell.innerHTML = '<div class="stat-val' + (s.lo ? ' lo' : '') + '">' + s.v + '</div><span class="stat-lbl">' + s.l + '</span>';
        statGrid.appendChild(cell);
      });
    }
  }

  // ═══ ALLERGY ═══
  function renderAllergy() {
    var data = loadMeals(todayStr());
    var menus = data ? (data[currentMeal] || []) : [];
    var allergens = {};
    menus.forEach(function(m) {
      if (m.allergy) {
        m.allergy.split('·').forEach(function(p) { allergens[p.trim()] = true; });
      }
    });

    var tags = $('allergy-tags');
    if (tags) {
      tags.innerHTML = '';
      Object.keys(allergens).forEach(function(k) {
        var tag = document.createElement('span');
        tag.className = 'allergy-tag tag-warn';
        tag.textContent = '⚠ ' + k;
        tags.appendChild(tag);
      });
      var safeCount = menus.filter(m => !m.allergy).length;
      if (menus.length > 0) {
        var st = document.createElement('span');
        st.className = 'allergy-tag tag-safe';
        st.textContent = '✓ ' + safeCount + '개 안전';
        tags.appendChild(st);
      }
    }

    var cards = $('allergy-cards');
    if (cards) {
      cards.innerHTML = '';
      if (menus.length === 0) {
        cards.innerHTML = '<div class="empty-state"><p>등록된 급식 정보가 없습니다</p></div>';
        return;
      }
      menus.forEach(function(m) {
        var item = document.createElement('div');
        var isDanger = false;
        if (m.allergy && currentUser && currentUser.allergies) {
          var mAllgs = m.allergy.split('·').map(a => a.trim());
          isDanger = mAllgs.some(a => currentUser.allergies.includes(a));
        }
        item.className = 'allergy-item';
        if(isDanger) { item.style.border = '1.5px solid var(--red)'; item.style.background = '#ffebee'; }
        item.innerHTML =
          '<span class="allergy-emoji">' + m.emoji + '</span>' +
          '<div class="allergy-info"><div class="allergy-name">' + m.name + '</div>' +
          '<div class="allergy-detail">' + m.kcal + ' kcal</div></div>' +
          '<span class="allergy-badge ' + (isDanger ? 'ab-warn' : (m.allergy ? 'ab-warn' : 'ab-safe')) + '" style="' + (isDanger ? 'background:var(--red);color:#fff;' : '') + '">' +
          (isDanger ? '🚨 섭취 위험' : (m.allergy ? '⚠ ' + m.allergy : '✓ 안전')) + '</span>';
        cards.appendChild(item);
      });
    }
  }

  // ═══ PROFILE ═══
  const ALLERGY_LIST = ['난류', '우유', '메밀', '땅콩', '대두', '밀', '고등어', '게', '새우', '돼지고기', '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣'];

  function renderProfile() {
    var anonSection = $('profile-anon');
    var loggedInSection = $('profile-loggedin');

    if (currentUser) {
      // Show logged-in state
      if (anonSection) anonSection.style.display = 'none';
      if (loggedInSection) loggedInSection.style.display = '';

      if ($('profile-name')) $('profile-name').textContent = currentUser.name;
      if ($('profile-role')) $('profile-role').textContent = currentUser.role === 'admin' ? '👨‍🍳 관리자' : '🧑‍🎓 학생';
      if ($('profile-initial')) $('profile-initial').textContent = currentUser.name.charAt(0);

      var adminBtn = $('admin-access-btn');
      if (adminBtn) adminBtn.style.display = (currentUser.role === 'admin') ? 'block' : 'none';
    } else {
      // Show anonymous state
      if (anonSection) anonSection.style.display = '';
      if (loggedInSection) loggedInSection.style.display = 'none';
      return; // No need to render allergy grid
    }

    var grid = $('allergy-toggle-grid');
    if (grid) {
      grid.innerHTML = '';
      var myAllergies = (currentUser && currentUser.allergies) || [];
      ALLERGY_LIST.forEach(function(al) {
        var btn = document.createElement('div');
        btn.className = 'allergy-toggle' + (myAllergies.includes(al) ? ' active' : '');
        btn.textContent = al;
        btn.onclick = function() { this.classList.toggle('active'); };
        grid.appendChild(btn);
      });
    }
  }

  var btnSaveProfile = $('btn-save-profile');
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async function() {
      var btn = this;
      var orig = btn.textContent;
      btn.textContent = '저장 중...';
      
      var selected = Array.from($$('.allergy-toggle.active')).map(t => t.textContent);
      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentUser.id, allergies: selected })
        });
        if(res.ok) {
          currentUser.allergies = selected;
          setDB('session', currentUser);
          toast('✅ 맞춤 알레르기 설정 저장 완료');
          renderHome();
          renderAllergy();
        } else { toast('❌ 저장 실패'); }
      } catch(e) { toast('❌ 네트워크 오류'); }
      btn.textContent = orig;
    });
  }

  // ═══ UPLOAD ═══
  function setupUpload() {
    var modal = $('upload-modal');
    var dropZone = $('upload-drop');
    var fileInput = $('upload-file');
    var previewBox = $('upload-preview');
    var previewImg = $('upload-preview-img');

    if ($('btn-fab')) {
      $('btn-fab').addEventListener('click', function () {
        if (!currentUser || currentUser.role !== 'admin') {
          toast('📸 사진 업로드는 관리자만 가능합니다');
          return;
        }
        if ($('upload-date')) $('upload-date').value = todayStr();
        modal.classList.add('show');
      });
    }
    
    function closeUpload() {
      modal.classList.remove('show');
      fileInput.value = '';
      previewBox.style.display = 'none';
      dropZone.style.display = '';
      if($('upload-memo')) $('upload-memo').value = '';
    }

    if ($('upload-close')) $('upload-close').addEventListener('click', closeUpload);
    modal.onclick = function(e){ if(e.target === modal) closeUpload(); };
    if (dropZone) dropZone.onclick = function(){ fileInput.click(); };

    if (fileInput) {
      fileInput.onchange = function() {
        var file = this.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
          previewImg.src = e.target.result;
          previewBox.style.display = '';
          dropZone.style.display = 'none';
        };
        reader.readAsDataURL(file);
      };
    }

    if ($('upload-submit')) {
      $('upload-submit').onclick = async function() {
        if (!previewImg.src) return;
        var btn = this;
        var orig = btn.textContent;
        btn.textContent = '업로드 중...';
        
        try {
          const res = await fetch('/api/photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              date: $('upload-date').value || todayStr(), 
              photoBase64: previewImg.src, 
              user: currentUser ? currentUser.name : '익명'
            })
          });
          if (res.ok) {
            toast('✅ 성공적으로 업로드되었습니다!');
            closeUpload();
            renderFeed();
          } else { toast('❌ 업로드 실패'); }
        } catch(e) { toast('❌ 네트워크 오류'); }
        btn.textContent = orig;
      };
    }
  }

})();
