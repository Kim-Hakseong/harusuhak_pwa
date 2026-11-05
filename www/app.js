/**
 * 하루수학 (HaruSuhak) 메인 애플리케이션 로직
 * - 일일 문제 스케줄러 및 파라메트릭 변수 변형 출제 제어
 * - 브라우저 학습 기록(localStorage) 저장, 연속 학습(Streak), 주간 스탬프 진행률
 * - 웹브라우저 개발/테스트 워크벤치(날짜 시뮬레이터, 시드 변형기, 모바일 뷰포트 프레임)
 */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

  // ---------------------------------------------------------------------------
  // 1. 상태 관리 및 로컬 스토리지 연동
  // ---------------------------------------------------------------------------
  let level = localStorage.getItem('hs_level') || 'middle';
  if (!HaruProblemBank.CURRICULUM_PACKS[level]) level = 'middle';

  let progress = safeParseJSON(localStorage.getItem('hs_progress'), {});
  let history = safeParseJSON(localStorage.getItem('hs_history'), {});
  let practiceLog = safeParseJSON(localStorage.getItem('hs_practice_log'), []);
  let variationSolvedCount = Number(localStorage.getItem('hs_variation_count') || 0);

  // 현재 화면 제어 상태
  let activeTab = 'home'; // 'home' | 'curriculum' | 'history' | 'settings'
  let bankFilter = 'all';
  let bankSearchQuery = '';
  let historyFilter = 'all'; // 'all' | 'wrong'

  // 개발/테스트용 날짜 시뮬레이션 오프셋 (기본 0 = 실제 오늘)
  let simDateObj = null; // null이면 실제 오늘 날짜 사용
  let currentVariant = 0; // 0이면 오늘의 공식 문제, 1 이상이면 숫자 변형 연습 문제
  let customTemplateId = null; // 교육과정 문제은행에서 특정 유형을 직접 선택한 경우

  let currentProblem = null;
  let selectedOption = null;
  let isAnswered = false;
  let deferredInstallPrompt = null;
  const Platform = window.HaruPlatform;

  function safeParseJSON(str, fallback) {
    try {
      return str ? JSON.parse(str) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. 날짜 및 주간 키 계산 유틸리티
  // ---------------------------------------------------------------------------
  function getActiveDate() {
    if (simDateObj) {
      return new Date(simDateObj.getTime());
    }
    return new Date();
  }

  function formatDateKey(d = getActiveDate()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getMondayWeekKey(d = getActiveDate()) {
    const copy = new Date(d.getTime());
    copy.setHours(0, 0, 0, 0);
    const diff = (copy.getDay() + 6) % 7; // 월=0 ... 일=6
    copy.setDate(copy.getDate() - diff);
    return formatDateKey(copy);
  }

  function getDayIndexOfWeek(d = getActiveDate()) {
    return (d.getDay() + 6) % 7; // 0(월) ~ 6(일)
  }

  function isSimulatedDate() {
    if (!simDateObj) return false;
    return formatDateKey(simDateObj) !== formatDateKey(new Date());
  }

  // 연속 학습 일수 계산 (현재 활성 날짜 기준 역산)
  function calcStreak() {
    let count = 0;
    const d = getActiveDate();
    d.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const k = formatDateKey(d);
      const solvedAnyLevelOnDate = Object.keys(history).some(key => key.endsWith('_' + k));
      if (solvedAnyLevelOnDate) {
        count++;
      } else if (i === 0) {
        // 오늘 아직 안 풀었더라도 어제까지 연속 기록이 있는지 확인
        const yesterday = new Date(d.getTime());
        yesterday.setDate(yesterday.getDate() - 1);
        const yKey = formatDateKey(yesterday);
        if (!Object.keys(history).some(key => key.endsWith('_' + yKey))) {
          break;
        }
      } else {
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // 3. 문제 생성 및 홈 화면 렌더링
  // ---------------------------------------------------------------------------
  function renderAll() {
    renderHeaderAndDevBar();
    renderHomeView();
    renderCurriculumBankView();
    renderHistoryView();
    renderSettingsView();
  }

  function renderHeaderAndDevBar() {
    const activeDate = getActiveDate();
    const dKey = formatDateKey(activeDate);
    $('streak').textContent = `✦ 연속 학습 ${calcStreak()}일`;

    // 날짜 표시
    const dateStr = activeDate.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    $('date-label').textContent = dateStr;

    const simBadge = $('sim-indicator');
    if (isSimulatedDate()) {
      simBadge.textContent = `🧪 테스트 날짜: ${dKey}`;
      simBadge.classList.add('show');
    } else {
      simBadge.classList.remove('show');
    }

    const dateInput = $('dev-date-picker');
    if (dateInput) dateInput.value = dKey;
  }

  function renderHomeView() {
    const pack = HaruProblemBank.CURRICULUM_PACKS[level];
    const activeDate = getActiveDate();
    const dKey = formatDateKey(activeDate);
    const dayIdx = getDayIndexOfWeek(activeDate);
    const wkKey = `${getMondayWeekKey(activeDate)}_${level}`;
    const doneDays = progress[wkKey] || [];

    // 수준 전환 탭 활성화 표시
    document.querySelectorAll('.level-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === level);
    });

    // 주간 카드 업데이트
    $('level-pill').textContent = `${pack.level} · ${pack.targetGrade}`;
    $('concept-title').textContent = pack.title;
    $('concept-desc').textContent = pack.desc;
    $('progress-text').textContent = `${doneDays.length} / 7일`;
    $('progress-bar').style.width = `${(doneDays.length / 7) * 100}%`;

    // 주간 요일별 스탬프 캘린더 렌더링
    const daysGrid = $('week-days-grid');
    daysGrid.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isDone = doneDays.includes(i);
      const isCurrent = i === dayIdx && !customTemplateId;
      btn.className = `day-chip${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`;
      btn.innerHTML = `
        <span>${DAY_NAMES[i]}</span>
        <span class="day-dot">${isDone ? '✓' : i + 1}</span>
      `;
      btn.title = `${DAY_NAMES[i]}요일 문제 보기`;
      btn.onclick = () => {
        // 해당 요일로 날짜 이동
        const target = getActiveDate();
        const currentDayIdx = getDayIndexOfWeek(target);
        target.setDate(target.getDate() + (i - currentDayIdx));
        simDateObj = target;
        currentVariant = 0;
        customTemplateId = null;
        renderAll();
        toast(`${DAY_NAMES[i]}요일 (${formatDateKey(target)}) 문제로 이동했어요`);
      };
      daysGrid.appendChild(btn);
    }

    // 현재 조건에 맞는 문제 생성
    currentProblem = HaruProblemBank.generateProblem({
      level,
      dayIdx,
      dateKey: dKey,
      variant: currentVariant,
      templateId: customTemplateId
    });

    // 메타데이터 표시
    $('day-label').textContent = customTemplateId
      ? `선택 유형 · ${currentProblem.templateId}`
      : `DAY ${dayIdx + 1} / 7 (${DAY_NAMES[dayIdx]}요일)`;

    $('std-badge').textContent = currentProblem.standardCode;
    $('unit-badge').textContent = currentProblem.unit;
    $('diff-badge').textContent = currentProblem.difficulty;
    $('source-ref-text').textContent = `📚 출처: ${currentProblem.sourceRef}`;

    const varTag = $('variant-tag');
    if (currentVariant === 0 && !customTemplateId) {
      varTag.textContent = '오늘의 공식 문제';
      varTag.style.background = '#e8f5e9';
      varTag.style.color = '#1b5e20';
    } else {
      varTag.textContent = `변형 출제 #${currentVariant + 1}`;
      varTag.style.background = '#eef2ff';
      varTag.style.color = '#3730a3';
    }

    $('question-text').textContent = currentProblem.question;

    // 도형·그래프 그림 (figure.js). 그림이 없는 템플릿은 영역을 숨긴다
    const figEl = $('question-figure');
    const figSvg = renderFigure(currentProblem);
    figEl.innerHTML = figSvg;
    figEl.style.display = figSvg ? '' : 'none';

    // 힌트 초기화
    $('hint-box').classList.remove('show');
    $('hint-box').textContent = `💡 힌트: ${currentProblem.hint}`;

    // 오늘의 공식 문제인지 확인하여 기존 풀이 기록 복원
    const historyKey = `${level}_${dKey}`;
    const savedRecord = (currentVariant === 0 && !customTemplateId) ? history[historyKey] : null;
    selectedOption = null;
    isAnswered = savedRecord !== undefined && savedRecord !== null;

    // 4지선다 보기 생성
    const optionsEl = $('options');
    optionsEl.innerHTML = '';
    currentProblem.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = String.fromCharCode(65 + idx);
      const label = document.createElement('span');
      label.textContent = optText;
      btn.append(letter, label);

      btn.onclick = () => {
        if (isAnswered) return;
        selectedOption = idx;
        document.querySelectorAll('#options .option').forEach(el => el.classList.remove('selected'));
        btn.classList.add('selected');
        $('check-btn').disabled = false;
      };
      optionsEl.appendChild(btn);
    });

    // 피드백 영역 초기화 또는 복원
    const feedbackEl = $('feedback');
    feedbackEl.className = 'feedback';
    feedbackEl.innerHTML = '';

    if (isAnswered) {
      const savedChoice = typeof savedRecord === 'object' ? savedRecord.choice : Number(savedRecord);
      showSolutionFeedback(currentProblem, savedChoice);
      $('check-btn').disabled = true;
      $('check-btn').textContent = '오늘 공식 학습 완료 ✓';
    } else {
      $('check-btn').disabled = true;
      $('check-btn').textContent = '정답 확인';
    }

    // 하단 1분 개념 카드 업데이트 (현재 문제의 개념과 연동)
    $('mini-title').textContent = `${currentProblem.unit} 핵심 개념`;
    $('mini-desc').textContent = currentProblem.conceptSummary;
    $('formula').textContent = currentProblem.formula;
    $('example').textContent = `성취기준 ${currentProblem.standardCode}: ${currentProblem.standardName}`;

    // 개발/테스트 인스펙터 업데이트
    const inspector = $('dev-inspector');
    if (inspector) {
      const varsStr = Object.entries(currentProblem.variablesInfo)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      inspector.textContent =
        `[문항ID] ${currentProblem.templateId} | [성취기준] ${currentProblem.standardCode} | [시드] ${currentProblem.seedString}\n` +
        `[동적 생성 변수] ${varsStr} | [정답 보기] ${String.fromCharCode(65 + currentProblem.answerIndex)}번`;
    }
  }

  function showSolutionFeedback(problem, chosenIdx) {
    const optionButtons = document.querySelectorAll('#options .option');
    optionButtons.forEach((btn, i) => {
      btn.disabled = true;
      if (i === problem.answerIndex) {
        btn.classList.add('correct');
      } else if (i === chosenIdx) {
        btn.classList.add('wrong');
      }
    });

    const isCorrect = chosenIdx === problem.answerIndex;
    const correctLetter = String.fromCharCode(65 + problem.answerIndex);
    const stepsHtml = problem.steps
      .map((s, idx) => `<div class="step-item"><span class="step-num">STEP ${idx + 1}</span>${s}</div>`)
      .join('');

    const feedbackEl = $('feedback');
    feedbackEl.className = 'feedback show';
    feedbackEl.innerHTML = `
      <div class="feedback-header ${isCorrect ? 'is-correct' : 'is-wrong'}">
        <span>${isCorrect ? '🎉 정답이야! 정확하게 풀었어.' : `🌱 아쉽지만 오답이야. 정답은 ${correctLetter}번이야!`}</span>
      </div>
      ${renderFigure(problem) ? `<div class="feedback-figure">${renderFigure(problem)}</div>` : ''}
      <div class="solution-steps">${stepsHtml}</div>
      <div class="std-summary-box">
        <strong>📌 한국 교육과정 성취기준 ${problem.standardCode}</strong><br>
        ${problem.standardName}<br>
        <span style="color:#555b51">💡 같은 유형을 숫자를 바꿔 한 번 더 풀어보면 개념이 완벽히 내 것이 돼!</span>
      </div>
    `;
  }

  // 문제 그림 SVG 문자열 (그림 스펙이 없거나 figure.js 미로드 시 빈 문자열)
  function renderFigure(problem) {
    if (!problem || !problem.figure || !window.HaruFigure) return '';
    return window.HaruFigure.render(problem.figure);
  }

  // ---------------------------------------------------------------------------
  // 4. 정답 제출 및 변형 문제 생성 핸들러
  // ---------------------------------------------------------------------------
  function handleCheckAnswer() {
    if (selectedOption === null || isAnswered) return;

    const dKey = formatDateKey(getActiveDate());
    const dayIdx = getDayIndexOfWeek(getActiveDate());
    const isCorrect = selectedOption === currentProblem.answerIndex;

    // 1) 오늘의 공식 문제(variant === 0, customTemplateId === null)인 경우 일일 학습 완료 기록
    if (currentVariant === 0 && !customTemplateId) {
      const historyKey = `${level}_${dKey}`;
      history[historyKey] = {
        choice: selectedOption,
        answerIndex: currentProblem.answerIndex,
        isCorrect,
        templateId: currentProblem.templateId,
        dateKey: dKey
      };
      localStorage.setItem('hs_history', JSON.stringify(history));

      const wkKey = `${getMondayWeekKey(getActiveDate())}_${level}`;
      progress[wkKey] = progress[wkKey] || [];
      if (!progress[wkKey].includes(dayIdx)) {
        progress[wkKey].push(dayIdx);
      }
      localStorage.setItem('hs_progress', JSON.stringify(progress));
    } else {
      // 변형 문제 연습 횟수 증가
      variationSolvedCount++;
      localStorage.setItem('hs_variation_count', String(variationSolvedCount));
    }

    // 2) 상세 풀이 로그(오답노트 및 학습 이력용) 저장
    practiceLog.unshift({
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      dateKey: dKey,
      timestamp: new Date().toISOString(),
      level,
      levelName: currentProblem.levelName,
      templateId: currentProblem.templateId,
      standardCode: currentProblem.standardCode,
      unit: currentProblem.unit,
      variant: currentVariant,
      question: currentProblem.question,
      selectedText: currentProblem.options[selectedOption],
      correctText: currentProblem.options[currentProblem.answerIndex],
      isCorrect
    });
    if (practiceLog.length > 100) practiceLog = practiceLog.slice(0, 100);
    localStorage.setItem('hs_practice_log', JSON.stringify(practiceLog));

    isAnswered = true;
    showSolutionFeedback(currentProblem, selectedOption);

    $('check-btn').disabled = true;
    $('check-btn').textContent = (currentVariant === 0 && !customTemplateId)
      ? '오늘 공식 학습 완료 ✓'
      : '변형 문제 확인 완료 ✓';

    // 상단 연속 학습 및 주간 스탬프 즉시 갱신
    const wkKey = `${getMondayWeekKey(getActiveDate())}_${level}`;
    const doneDays = progress[wkKey] || [];
    $('progress-text').textContent = `${doneDays.length} / 7일`;
    $('progress-bar').style.width = `${(doneDays.length / 7) * 100}%`;
    $('streak').textContent = `✦ 연속 학습 ${calcStreak()}일`;

    // 요일 스탬프 갱신
    const chips = document.querySelectorAll('#week-days-grid .day-chip');
    if (chips[dayIdx] && doneDays.includes(dayIdx)) {
      chips[dayIdx].classList.add('done');
      const dot = chips[dayIdx].querySelector('.day-dot');
      if (dot) dot.textContent = '✓';
    }

    renderHistoryView();
    Platform.haptic(isCorrect ? 'success' : 'error');
    toast(isCorrect ? '정답입니다! 훌륭해요 🎯' : '해설을 읽고 변형 문제로 복습해 보세요 💪');
  }

  function generateNewVariation() {
    currentVariant += 1;
    renderHomeView();
    $('question-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast(`숫자와 조건을 바꾼 변형 문제 #${currentVariant + 1} 출제!`);
  }

  // ---------------------------------------------------------------------------
  // 5. 탭 2: 한국 교육과정 문제은행 브라우저 렌더링
  // ---------------------------------------------------------------------------
  function renderCurriculumBankView() {
    const container = $('bank-list');
    if (!container) return;

    document.querySelectorAll('.filter-chip[data-bank-filter]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.bankFilter === bankFilter);
    });

    let templates = bankFilter === 'all'
      ? HaruProblemBank.getAllTemplates()
      : HaruProblemBank.getAllTemplates(bankFilter).map(t => ({
          ...t,
          level: bankFilter,
          levelName: HaruProblemBank.CURRICULUM_PACKS[bankFilter].level
        }));

    // 검색어 필터링 적용 (단원명, 성취기준 코드, 내용, 공식 등)
    if (bankSearchQuery.trim()) {
      const q = bankSearchQuery.trim().toLowerCase();
      templates = templates.filter(t =>
        (t.unit && t.unit.toLowerCase().includes(q)) ||
        (t.standardCode && t.standardCode.toLowerCase().includes(q)) ||
        (t.standardName && t.standardName.toLowerCase().includes(q)) ||
        (t.sourceRef && t.sourceRef.toLowerCase().includes(q)) ||
        (t.levelName && t.levelName.toLowerCase().includes(q)) ||
        (t.formula && t.formula.toLowerCase().includes(q))
      );
    }

    const countInfo = $('bank-count-info');
    if (countInfo) {
      countInfo.textContent = bankSearchQuery.trim()
        ? `검색 결과: 총 ${templates.length}개 유형 발견`
        : `현재 필터: 총 ${templates.length}개 유형 탐색 가능`;
    }

    if (templates.length === 0) {
      container.innerHTML = `
        <div class="bank-card" style="text-align:center;padding:32px 16px;color:var(--muted)">
          검색 조건에 맞는 문제 유형을 찾을 수 없습니다.<br>다른 키워드나 필터를 선택해 보세요.
        </div>
      `;
      return;
    }

    container.innerHTML = templates
      .map(t => `
        <div class="bank-card">
          <div class="bank-card-top">
            <span class="std-badge">${t.standardCode}</span>
            <span class="unit-badge">${t.levelName} · ${t.unit}</span>
            <span class="diff-badge">${t.difficulty}</span>
          </div>
          <h4>${t.standardName}</h4>
          <p>
            <strong>핵심 공식:</strong> <code>${t.formula}</code><br>
            <strong>참고 자료:</strong> ${t.sourceRef}
          </p>
          <div class="bank-card-actions">
            <button type="button" class="small-action-btn primary-lite" data-action="solve-template" data-level="${t.level}" data-id="${t.id}" data-day="${t.dayIndex}">
              ✏️ 이 유형 문제 풀기
            </button>
            <button type="button" class="small-action-btn" data-action="mutate-template" data-level="${t.level}" data-id="${t.id}" data-day="${t.dayIndex}">
              🎲 새 변수로 변형 출제
            </button>
          </div>
        </div>
      `)
      .join('');

    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.onclick = () => {
        const targetLevel = btn.dataset.level;
        const tId = btn.dataset.id;
        const action = btn.dataset.action;

        level = targetLevel;
        localStorage.setItem('hs_level', level);
        customTemplateId = tId;
        currentVariant = action === 'mutate-template' ? Math.floor(Math.random() * 50) + 1 : 0;

        setTab('home');
        renderAll();
        toast(`${tId} 유형 문제를 불러왔어요`);
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 6. 탭 3: 학습 기록 & 오답노트 렌더링
  // ---------------------------------------------------------------------------
  function renderHistoryView() {
    const totalDaily = Object.keys(history).length;
    const totalLogged = practiceLog.length;
    const correctLogged = practiceLog.filter(item => item.isCorrect).length;
    const accuracy = totalLogged > 0 ? Math.round((correctLogged / totalLogged) * 100) : 0;

    $('stat-streak').textContent = `${calcStreak()}일`;
    $('stat-daily').textContent = `${totalDaily}회`;
    $('stat-variation').textContent = `${variationSolvedCount}회`;
    $('stat-accuracy').textContent = `${accuracy}%`;

    document.querySelectorAll('.filter-chip[data-history-filter]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.historyFilter === historyFilter);
    });

    const listEl = $('history-list');
    const filtered = historyFilter === 'wrong'
      ? practiceLog.filter(item => !item.isCorrect)
      : practiceLog;

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="history-item" style="text-align:center;color:var(--muted);padding:28px 16px">
          ${historyFilter === 'wrong'
            ? '🎉 아직 기록된 오답이 없어요! 문제를 풀고 틀린 문제가 생기면 이곳에서 변형 문제로 복습할 수 있어요.'
            : '아직 풀이 기록이 없어요. 오늘의 문제를 풀어 첫 기록을 남겨 보세요!'}
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map(item => `
        <div class="history-item">
          <div class="history-item-head">
            <span>${item.dateKey} · <strong>${item.standardCode}</strong> ${item.unit}</span>
            <span class="status-pill ${item.isCorrect ? 'ok' : 'no'}">
              ${item.isCorrect ? '정답 ✓' : '오답 ✗'}
            </span>
          </div>
          <div class="history-q">${item.question}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
            내 선택: <strong>${item.selectedText}</strong>
            ${!item.isCorrect ? ` | 정답: <strong style="color:var(--correct-ink)">${item.correctText}</strong>` : ''}
          </div>
          <button type="button" class="small-action-btn" data-retry-level="${item.level}" data-retry-id="${item.templateId}">
            🔄 숫자 바꿔 유사 문제로 다시 도전
          </button>
        </div>
      `)
      .join('');

    listEl.querySelectorAll('button[data-retry-id]').forEach(btn => {
      btn.onclick = () => {
        level = btn.dataset.retryLevel || level;
        localStorage.setItem('hs_level', level);
        customTemplateId = btn.dataset.retryId;
        currentVariant = Math.floor(Math.random() * 90) + 1;
        setTab('home');
        renderAll();
        toast('오답 복습용 숫자 변형 문제를 만들었어요');
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 7. 탭 4: 설정 및 PWA/모바일 환경 제어
  // ---------------------------------------------------------------------------
  function renderSettingsView() {
    $('level-select').value = level;
    const swStatus = $('sw-status');
    if (swStatus) {
      if ('serviceWorker' in navigator) {
        swStatus.textContent = navigator.onLine
          ? '정상 작동 중 (오프라인 캐시 준비 완료)'
          : '오프라인 모드 (캐시된 데이터로 동작 중)';
      } else {
        swStatus.textContent = '현재 브라우저 환경에서 Service Worker 미지원';
      }
    }
  }

  function setTab(tabName) {
    activeTab = tabName;
    ['home', 'curriculum', 'history', 'settings'].forEach(t => {
      const view = $(`view-${t}`);
      const nav = $(`nav-${t}`);
      if (view) view.classList.toggle('active', t === tabName);
      if (nav) nav.classList.toggle('active', t === tabName);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      t.style.display = 'none';
    }, 2400);
  }

  // ---------------------------------------------------------------------------
  // 8. 이벤트 바인딩 및 초기화
  // ---------------------------------------------------------------------------
  function initEvents() {
    // 상단 수준 전환 탭
    document.querySelectorAll('.level-tab').forEach(btn => {
      btn.onclick = () => {
        level = btn.dataset.level;
        localStorage.setItem('hs_level', level);
        currentVariant = 0;
        customTemplateId = null;
        renderAll();
        toast(`${HaruProblemBank.CURRICULUM_PACKS[level].level} 과정으로 전환했어요`);
      };
    });

    // 힌트 토글
    $('hint-btn').onclick = () => {
      $('hint-box').classList.toggle('show');
    };

    // 정답 확인 및 숫자 변형 문제 풀기
    $('check-btn').onclick = handleCheckAnswer;
    $('mutate-btn').onclick = generateNewVariation;

    // 오늘의 공식 문제로 돌아가기 버튼 (변형 문제 풀이 중일 때)
    $('today-origin-btn').onclick = () => {
      simDateObj = null;
      currentVariant = 0;
      customTemplateId = null;
      renderAll();
      toast('오늘 날짜의 공식 문제로 돌아왔어요');
    };

    // 하단 내비게이션
    $('nav-home').onclick = () => setTab('home');
    $('nav-curriculum').onclick = () => setTab('curriculum');
    $('nav-history').onclick = () => setTab('history');
    $('nav-settings').onclick = () => setTab('settings');

    // 교육과정 문제은행 필터 및 실시간 검색
    const searchInput = $('bank-search-input');
    if (searchInput) {
      searchInput.oninput = e => {
        bankSearchQuery = e.target.value;
        renderCurriculumBankView();
      };
    }

    document.querySelectorAll('.filter-chip[data-bank-filter]').forEach(btn => {
      btn.onclick = () => {
        bankFilter = btn.dataset.bankFilter;
        renderCurriculumBankView();
      };
    });

    // 기록/오답 필터
    document.querySelectorAll('.filter-chip[data-history-filter]').forEach(btn => {
      btn.onclick = () => {
        historyFilter = btn.dataset.historyFilter;
        renderHistoryView();
      };
    });

    // 개발/테스트 워크벤치 토글 및 컨트롤
    $('dev-toggle-btn').onclick = () => {
      $('dev-workbench').classList.toggle('show');
    };

    $('dev-prev-day').onclick = () => {
      const d = getActiveDate();
      d.setDate(d.getDate() - 1);
      simDateObj = d;
      currentVariant = 0;
      customTemplateId = null;
      renderAll();
      toast(`날짜 이동: ${formatDateKey(d)}`);
    };

    $('dev-next-day').onclick = () => {
      const d = getActiveDate();
      d.setDate(d.getDate() + 1);
      simDateObj = d;
      currentVariant = 0;
      customTemplateId = null;
      renderAll();
      toast(`날짜 이동: ${formatDateKey(d)}`);
    };

    $('dev-today-btn').onclick = () => {
      simDateObj = null;
      currentVariant = 0;
      customTemplateId = null;
      renderAll();
      toast('실제 오늘 날짜로 돌아왔어요');
    };

    $('dev-date-picker').onchange = e => {
      if (!e.target.value) return;
      const parts = e.target.value.split('-').map(Number);
      simDateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      currentVariant = 0;
      customTemplateId = null;
      renderAll();
      toast(`테스트 날짜 설정: ${e.target.value}`);
    };

    $('dev-mutate-seed').onclick = generateNewVariation;

    $('dev-frame-toggle').onclick = () => {
      document.body.classList.toggle('mobile-frame-mode');
      const isFrame = document.body.classList.contains('mobile-frame-mode');
      toast(isFrame ? '📱 모바일 기기 프레임 미리보기 활성화' : '🖥️ 전체 브라우저 화면으로 전환');
    };

    // 설정 탭 이벤트
    $('level-select').onchange = e => {
      level = e.target.value;
      localStorage.setItem('hs_level', level);
      currentVariant = 0;
      customTemplateId = null;
      renderAll();
      toast('학습 수준을 변경했어요');
    };

    $('frame-mode-btn').onclick = () => {
      document.body.classList.toggle('mobile-frame-mode');
      const isFrame = document.body.classList.contains('mobile-frame-mode');
      toast(isFrame ? '📱 모바일 기기 프레임 모드 켜짐' : '🖥️ 기본 반응형 화면 모드 켜짐');
    };

    $('export-btn').onclick = () => {
      const backup = {
        exportedAt: new Date().toISOString(),
        level,
        progress,
        history,
        practiceLog,
        variationSolvedCount
      };
      const fileName = `harusuhak_backup_${formatDateKey()}.json`;
      Platform.share(fileName, JSON.stringify(backup, null, 2))
        .then(done => {
          if (done) toast(Platform.isNative ? '백업 파일을 공유할 수 있어요' : '학습 기록 JSON 백업 파일을 저장했어요');
        })
        .catch(() => toast('백업 파일을 만들지 못했어요. 다시 시도해 주세요'));
    };

    $('reset-btn').onclick = async () => {
      const ok = await Platform.dialog({
        title: '학습 기록 초기화',
        message: '이 기기에 저장된 모든 학습 기록과 오답노트를 초기화할까요?\n되돌릴 수 없어요.',
        confirmText: '초기화',
        cancelText: '취소',
        danger: true
      });
      if (ok) {
        progress = {};
        history = {};
        practiceLog = [];
        variationSolvedCount = 0;
        localStorage.removeItem('hs_progress');
        localStorage.removeItem('hs_history');
        localStorage.removeItem('hs_practice_log');
        localStorage.removeItem('hs_variation_count');
        currentVariant = 0;
        customTemplateId = null;
        renderAll();
        toast('모든 학습 기록을 초기화했어요');
      }
    };

    // PWA 홈 화면 설치 이벤트
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const installBtn = $('pwa-install-btn');
      if (installBtn) installBtn.style.display = 'block';
    });

    $('pwa-install-btn').onclick = async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
      } else {
        Platform.dialog({
          title: '📱 모바일 홈 화면 설치 방법',
          message:
            '• iPhone (Safari): 하단 [공유] 버튼 → [홈 화면에 추가] 선택\n' +
            '• Android (Chrome): 우측 상단 메뉴(⋮) → [앱 설치] 또는 [홈 화면에 추가] 선택'
        });
      }
    };

    // Service Worker 등록
    if (!Platform.isNative && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 9. iOS 앱(네이티브) 전용 처리 · 매일 알림 · 앱 정보 · 개발 도구 진입
  // ---------------------------------------------------------------------------
  function initPlatform() {
    // 네이티브: PWA 설치·모바일 프레임·SW 상태 카드는 의미가 없으므로 DOM에서 제거
    if (Platform.isNative) {
      ['pwa-card', 'pwa-install-btn', 'frame-mode-btn', 'dev-frame-toggle'].forEach(id => {
        const el = $(id);
        if (el) el.remove();
      });
      const sub = document.querySelector('#view-settings .sub');
      if (sub) sub.textContent = '학습 수준, 매일 알림, 학습 데이터를 관리합니다.';
    }

    // 🧪 개발 도구 버튼은 기본 숨김. 로고 7회 연속 탭(1.5초 이내) 또는 웹 ?dev=1 로 표시
    const devBtn = $('dev-toggle-btn');
    const showDev = () => {
      if (devBtn) devBtn.style.display = '';
    };
    if (devBtn) devBtn.style.display = 'none';
    if (!Platform.isNative && /[?&]dev=1\b/.test(location.search)) showDev();
    const logo = document.querySelector('.logo');
    if (logo) {
      let taps = 0;
      let last = 0;
      logo.addEventListener('click', () => {
        const now = Date.now();
        taps = now - last <= 1500 ? taps + 1 : 1;
        last = now;
        if (taps >= 7) {
          taps = 0;
          showDev();
          toast('개발 도구를 표시했어요');
        }
      });
    }

    initNotifyCard();
    initAboutCard();
    initUpdateCheck();
    initBackButton();

    // 포그라운드 복귀 시 날짜가 바뀌었으면 오늘의 문제로 갱신
    let lastDateKey = formatDateKey(new Date());
    Platform.onForeground(() => {
      const nowKey = formatDateKey(new Date());
      if (nowKey !== lastDateKey) {
        lastDateKey = nowKey;
        if (!simDateObj) {
          currentVariant = 0;
          customTemplateId = null;
        }
        renderAll();
      }
    });
  }

  function initNotifyCard() {
    const card = $('notify-card');
    if (!card || !Platform.notify.available()) return;
    card.style.display = '';
    const toggle = $('notify-toggle');
    const timeInput = $('notify-time');
    const status = $('notify-status');
    const isOn = () => localStorage.getItem('hs_notify_on') === '1';
    const getTime = () => localStorage.getItem('hs_notify_time') || '08:00';
    const paint = () => {
      toggle.checked = isOn();
      timeInput.value = getTime();
      timeInput.disabled = !isOn();
      status.textContent = isOn() ? `매일 ${getTime()}에 알려 드려요` : '꺼져 있어요';
    };
    const apply = async () => {
      const [h, m] = getTime().split(':').map(Number);
      await Platform.notify.schedule(h, m);
    };
    paint();

    toggle.onchange = async () => {
      if (toggle.checked) {
        // 권한은 토글을 켤 때만 요청
        const granted = await Platform.notify.requestPermission().catch(() => false);
        if (!granted) {
          localStorage.setItem('hs_notify_on', '0');
          paint();
          Platform.dialog({
            title: '알림 권한이 필요해요',
            message: '설정 앱 → 하루수학 → 알림에서 알림을 허용하면 매일 알림을 받을 수 있어요.'
          });
          return;
        }
        localStorage.setItem('hs_notify_on', '1');
        await apply().catch(() => {});
        toast(`매일 ${getTime()}에 알려 드릴게요`);
      } else {
        localStorage.setItem('hs_notify_on', '0');
        await Platform.notify.cancel().catch(() => {});
        toast('매일 알림을 껐어요');
      }
      paint();
    };

    timeInput.onchange = async () => {
      if (!/^\d{2}:\d{2}$/.test(timeInput.value)) return;
      localStorage.setItem('hs_notify_time', timeInput.value);
      if (isOn()) {
        await apply().catch(() => {});
        toast(`알림 시간을 ${timeInput.value}로 바꿨어요`);
      }
      paint();
    };
  }

  // 오픈소스 라이선스 고지 (MIT 조건: 복사본에 저작권·허가 고지 포함)
  const LICENSE_TEXT = `하루수학 (원작 웹앱)
Copyright (c) 2026 정한결, 정재상
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

──────────

Capacitor 및 공식 플러그인 (App, Filesystem, Haptics, Local Notifications, Share, Splash Screen, Status Bar)
Copyright (c) 2017-present Drifty Co. / Ionic
MIT License — 위 MIT License 와 같은 조건

──────────

Lucide 아이콘 (하단 탭)
Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
ISC License

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;

  // 새 버전 알림: 실행·복귀 시 12시간에 한 번 스토어 조회, "나중에"를 누른 버전은 다음 날 다시 묻는다
  function initUpdateCheck() {
    if (!Platform.isNative) return;
    const CHECK_EVERY = 12 * 60 * 60 * 1000;
    let lastCheck = 0;
    let showing = false;
    const run = async () => {
      if (showing || Date.now() - lastCheck < CHECK_EVERY) return;
      lastCheck = Date.now();
      let info = null;
      try {
        info = await Platform.update.check();
      } catch (e) {
        return; // 오프라인 등 — 조용히 넘어간다
      }
      if (!info || !info.available) return;
      const today = formatDateKey(new Date());
      if (localStorage.getItem('hs_update_later') === `${info.version}|${today}`) return;
      showing = true;
      const ok = await Platform.dialog({
        title: '새 버전이 나왔어요',
        message: `하루수학 ${info.version ? info.version + ' ' : ''}버전으로 업데이트할 수 있어요. 지금 업데이트할까요?`,
        confirmText: '업데이트',
        cancelText: '나중에'
      });
      showing = false;
      if (ok) {
        Platform.update.open(info.immediate).catch(() => {});
      } else {
        localStorage.setItem('hs_update_later', `${info.version}|${today}`);
      }
    };
    run();
    Platform.onForeground(run);
  }

  // Android 뒤로 가기: 모달 닫기 → 홈 탭으로 → 앱 종료
  function initBackButton() {
    Platform.onBackButton(() => {
      const modal = document.querySelector('.hs-modal-overlay');
      if (modal) {
        modal.click();
        return;
      }
      if (activeTab !== 'home') {
        setTab('home');
        return;
      }
      Platform.exitApp();
    });
  }

  function initAboutCard() {
    const cfg = Platform.config;
    const licBtn = $('license-btn');
    if (licBtn) licBtn.onclick = () => Platform.dialog({ title: '오픈소스 라이선스', message: LICENSE_TEXT, confirmText: '닫기' });
    Platform.appInfo().then(info => {
      const ver = $('about-version');
      if (ver) ver.textContent = info.version === 'web' ? '하루수학 (웹)' : `하루수학 버전 ${info.version} (${info.build})`;

      const rateBtn = $('rate-btn');
      if (rateBtn && Platform.review.available()) {
        rateBtn.style.display = '';
        if (window.Capacitor && window.Capacitor.getPlatform() === 'android') rateBtn.textContent = '⭐ Play 스토어에서 평가하기';
        rateBtn.onclick = () => Platform.review.open();
      }
      const fbBtn = $('feedback-btn');
      if (fbBtn && cfg.SUPPORT_EMAIL) {
        fbBtn.style.display = '';
        fbBtn.onclick = () => {
          const subject = encodeURIComponent('[하루수학] 피드백');
          const body = encodeURIComponent(`앱 ${info.version} · iOS ${info.osVersion || '-'} · ${info.model}\n\n`);
          Platform.openExternal(`mailto:${cfg.SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
        };
      }
    });
  }

  initEvents();
  initPlatform();
  renderAll();
})();
