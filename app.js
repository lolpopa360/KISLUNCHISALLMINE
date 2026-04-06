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
    initFeedDateNav();

    $('goto-photo').addEventListener('click', function () { goPage('photo'); });
    $('btn-bell').addEventListener('click', function () { toast('🔔 새로운 알림이 없습니다'); });
    var bp = $('btn-profile');
    if(bp) bp.addEventListener('click', function () { goPage('profile'); renderProfile(); });
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
  
  async function openCalSheet(dateStr, data) {
    cbsSelectedDate = dateStr;
    calSheetBackdrop = $('cal-sheet-backdrop');
    calBottomSheet = $('cal-bottom-sheet');
    if(!calBottomSheet) return;
    
    var dObj = new Date(dateStr);
    var dayNames = ['일','월','화','수','목','금','토'];
    $('cbs-date-title').textContent = (dObj.getMonth() + 1) + '월 ' + dObj.getDate() + '일 (' + dayNames[dObj.getDay()] + ')';

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
        div.className = 'cbs-meal-item';
        if(isDanger) { div.style.border = '1.5px solid var(--red)'; div.style.background = '#ffebee'; }
        
        // 이모지(m.emoji) 완전 제거 후 깔끔한 타이포그래피 유지
        div.innerHTML = '<div style="width:6px; height:6px; background:var(--text); border-radius:50%; margin: 8px 12px 0 4px; flex-shrink:0;"></div>' + 
                        '<div style="flex:1;">' + m.name + ' <span style="color:var(--text-3); font-size:12px; margin-left:6px;">' + (m.kcal||0) + 'kcal</span></div>' + 
                        (isDanger ? '<span style="color:var(--red); font-size:13px; font-weight:800;">🚨 알레르기 위험</span>' : '');
        div.style.alignItems = 'flex-start';
        targetUl.appendChild(div);
      });
    }

    makeMealItems(data ? data.lunch : [], lList);
    makeMealItems(data ? data.dinner : [], dList);

    calSheetBackdrop.classList.add('show');
    calBottomSheet.classList.add('show');
  }

  function closeCalSheet() {
    if(!calBottomSheet) return;
    calSheetBackdrop.classList.remove('show');
    calBottomSheet.classList.remove('show');
  }

  if($('cbs-close-btn')) $('cbs-close-btn').addEventListener('click', closeCalSheet);
  if($('cal-sheet-backdrop')) $('cal-sheet-backdrop').addEventListener('click', closeCalSheet);

  var sheetStartY = 0;
  var sheetCurrentY = 0;
  var handleArea = $('cbs-handle-area');
  if(handleArea) {
      handleArea.addEventListener('touchstart', function(e) { sheetStartY = e.touches[0].clientY; }, {passive:true});
      handleArea.addEventListener('touchmove', function(e) {
        sheetCurrentY = e.touches[0].clientY;
        if (sheetCurrentY - sheetStartY > 30) closeCalSheet();
      }, {passive:true});
  }

  var currentNutritionDate = todayStr();

  var btnNutrition = $('btn-cbs-nutrition');
  if(btnNutrition) {
      btnNutrition.addEventListener('click', function() {
        closeCalSheet();
        currentNutritionDate = cbsSelectedDate;
        goPage('nutrition');
      });
  }

  // ═══ PHOTO FEED ═══
  var feedDate = todayStr();

  function initFeedDateNav() {
    var dateInput = $('feed-date');
    dateInput.value = feedDate;
    dateInput.addEventListener('change', function() {
      feedDate = this.value;
      renderFeed();
    });
    $('feed-prev').addEventListener('click', function() {
      var d = new Date(feedDate);
      d.setDate(d.getDate() - 1);
      feedDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      $('feed-date').value = feedDate;
      renderFeed();
    });
    $('feed-next').addEventListener('click', function() {
      var d = new Date(feedDate);
      d.setDate(d.getDate() + 1);
      feedDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      $('feed-date').value = feedDate;
      renderFeed();
    });
  }

  async function renderFeed() {
    var list = $('feed-list');
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

  // ═══ NUTRITION ═══
  function renderNutrition() {
    var dObj = new Date(currentNutritionDate);
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    var lbl = (dObj.getMonth() + 1) + '월 ' + dObj.getDate() + '일 (' + dayNames[dObj.getDay()] + ')';
    
    $('nut-date-text').textContent = lbl + ' ' + (currentMeal === 'lunch' ? '점심' : '저녁');

    var data = loadMeals(currentNutritionDate);
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

    // AI Smart Coach Logic (Dietary Advice)
    var smartComments = [];
    if (totalKcal === 0) {
      smartComments.push('급식 정보가 등록되지 않았습니다.');
    } else {
      if (totalKcal > 1000) smartComments.push('오늘 식단은 전체 열량이 다소 높은 편입니다! 점심/저녁 한 끼에 너무 많은 양을 드시지 않도록 양 조절에 신경 써주시면 완벽할 거예요. 🏃‍♂️');
      else if (totalKcal < 600) smartComments.push('전체 열량이 조금 가볍게 구성된 식단입니다. 활동량이 많은 날이라면 간식으로 단백질 바나 우유를 더 챙겨 드셔도 좋습니다. 🔋');
      
      if (menus.some(m => m.name.includes('돈까스') || m.name.includes('튀김') || m.name.includes('치킨'))) {
        smartComments.push('오늘은 바삭한 튀김 메뉴가 포함되어 지방 비율이 높을 수 있어요. 국물을 조금 남기거나 야채를 먼저 드시는 것을 추천합니다! 🥗');
      } else if (menus.some(m => m.name.includes('샐러드') || m.name.includes('무침') || m.name.includes('나물'))) {
        smartComments.push('건강한 채소 메뉴가 골고루 배합되어 식이섬유가 풍부합니다. 포만감이 오래가고 소화에 아주 좋은 식단이에요! ✨');
      } else {
         smartComments.push('전반적으로 영양소 분배가 적절히 들어간 균형 잡힌 식단입니다. 천천히 씹어 드시며 맛을 온전히 즐겨보세요! 🍽️');
      }
    }
    $('nut-comment').textContent = smartComments[smartComments.length-1];

    // Radar Chart Logic (Hexagon)
    var canvas = $('nut-radar');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width; var h = canvas.height;
    var cx = w / 2; var cy = h / 2;
    var radius = 140;

    // Data Calculation (0.0 ~ 1.0)
    var seed = currentNutritionDate.charCodeAt(currentNutritionDate.length-1) || 0;
    var rFloat = function(min, max, offset) { return min + ((seed + offset) % 100) / 100 * (max - min); };
    
    var dataVals = [
      Math.min((totalKcal ? carbs / 130 : 0) + rFloat(0, 0.2, 1), 1.0),   // 탄수화물
      Math.min((totalKcal ? protein / 55 : 0) + rFloat(0, 0.3, 2), 1.0),  // 단백질
      Math.min((totalKcal ? fat / 44 : 0) + rFloat(0, 0.2, 3), 1.0),      // 지방
      Math.min((totalKcal ? sodium / 2000 : 0) + rFloat(0, 0.4, 4), 1.0), // 나트륨
      rFloat(0.5, totalKcal ? 0.9 : 0, 5),                                // 비타민
      rFloat(0.4, totalKcal ? 0.8 : 0, 6)                                 // 칼슘
    ];
    if(totalKcal === 0) dataVals = [0,0,0,0,0,0];

    var labels = ['탄수화물', '단백질', '지방', '나트륨', '비타민', '칼슘'];

    ctx.clearRect(0,0,w,h);
    // Draw Web (Background)
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e2e8f0'; // Tailwind Slate-200
    for (var level = 1; level <= 4; level++) {
       ctx.beginPath();
       for (var i = 0; i < 6; i++) {
          var angle = (Math.PI / 3) * i - Math.PI/2;
          var r = radius * (level / 4);
          var x = cx + r * Math.cos(angle);
          var y = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
       }
       ctx.closePath(); ctx.stroke();
    }
    // Draw Axis lines & Labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px -apple-system, system-ui, sans-serif';
    for (var i = 0; i < 6; i++) {
        var angle = (Math.PI / 3) * i - Math.PI/2;
        var lx = cx + radius * Math.cos(angle);
        var ly = cy + radius * Math.sin(angle);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lx, ly); ctx.stroke();
        
        ctx.fillStyle = '#64748b'; // Slate-500
        var tx = cx + (radius + 40) * Math.cos(angle);
        var ty = cy + (radius + 40) * Math.sin(angle);
        ctx.fillText(labels[i], tx, ty);
    }

    // Draw Data Area
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
        var angle = (Math.PI / 3) * i - Math.PI/2;
        var r = radius * dataVals[i];
        var x = cx + r * Math.cos(angle);
        var y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.4)'; // Emerald-500 transparent
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#10b981'; // Emerald-500
    ctx.stroke();

    // Draw Data Dots
    for (var i = 0; i < 6; i++) {
        var angle = (Math.PI / 3) * i - Math.PI/2;
        var r = radius * dataVals[i];
        var x = cx + r * Math.cos(angle);
        var y = cy + r * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI*2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#10b981'; ctx.stroke();
    }

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
    // Bars replaced by Hexagon Chart
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
      var isDanger = false;
      if (m.allergy && currentUser && currentUser.allergies) {
        var mAllergies = m.allergy.split('·').map(function(a){return a.trim()});
        for (var k = 0; k < mAllergies.length; k++) {
          if (currentUser.allergies.includes(mAllergies[k])) {
            isDanger = true; break;
          }
        }
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
    }
  }

  // ═══ PROFILE ═══
  const ALLERGY_LIST = ['난류', '우유', '메밀', '땅콩', '대두', '밀', '고등어', '게', '새우', '돼지고기', '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣'];

  function renderProfile() {
    var pName = $('profile-name');
    var pRole = $('profile-role');
    var pIni = $('profile-initial');
    if (pName) pName.textContent = currentUser ? currentUser.name : 'Unknown';
    if (pRole) pRole.textContent = currentUser ? (currentUser.role === 'admin' ? '👨‍🍳 관리자' : '🧑‍🎓 학생') : '';
    if (pIni) pIni.textContent = currentUser ? currentUser.name.charAt(0) : '👤';

    var adminBtn = $('admin-access-btn');
    if (adminBtn) {
      if (currentUser && currentUser.role === 'admin') {
        adminBtn.style.display = 'block';
      } else {
        adminBtn.style.display = 'none';
      }
    }

    var grid = $('allergy-toggle-grid');
    if (grid) {
      grid.innerHTML = '';
      var myAllergies = (currentUser && currentUser.allergies) || [];

      for (var i = 0; i < ALLERGY_LIST.length; i++) {
        var al = ALLERGY_LIST[i];
        var btn = document.createElement('div');
        btn.className = 'allergy-toggle' + (myAllergies.includes(al) ? ' active' : '');
        btn.textContent = al;
        (function(button) {
            button.addEventListener('click', function() {
                this.classList.toggle('active');
            });
        })(btn);
        grid.appendChild(btn);
      }
    }
  }

  var btnSaveProfile = $('btn-save-profile');
  if (btnSaveProfile) {
      btnSaveProfile.addEventListener('click', async function() {
          var originalText = this.textContent;
          this.textContent = '저장 중...';
          
          var selected = [];
          var toggles = $$('.allergy-toggle.active');
          for(var i=0; i<toggles.length; i++) {
              selected.push(toggles[i].textContent);
          }

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
                  renderNutrition();
                  renderAllergy();
              } else {
                  toast('❌ 저장 실패');
              }
          } catch(e) {
              toast('❌ 네트워크 연결 오류');
          }
          this.textContent = originalText;
      });
  }

  // ═══ UPLOAD ═══
  function setupUpload() {
    var modal = $('upload-modal');
    var dropZone = $('upload-drop');
    var fileInput = $('upload-file');
    var previewBox = $('upload-preview');
    var previewImg = $('upload-preview-img');

    $('btn-fab').addEventListener('click', function () { 
      $('upload-date').value = todayStr();
      modal.classList.add('show'); 
    });
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
        
        var uploadDate = $('upload-date').value || todayStr();
        
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            date: uploadDate, 
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
