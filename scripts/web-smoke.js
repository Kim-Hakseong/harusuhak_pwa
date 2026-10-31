/**
 * 웹 회귀 스모크 (스크린샷 없음 — DOM·콘솔만 검사)
 * 실행: NODE_PATH=<playwright 설치 경로>/node_modules node scripts/web-smoke.js http://localhost:8080
 * - 콘솔 에러·페이지 에러 0
 * - 기존 기능: 4개 탭, 문제·보기 4개, 정답 확인 → 풀이, 변형 문제, 교육과정 목록, 기록 탭, 설정(수준·백업·초기화 모달)
 * - 웹 전용: PWA 설치 카드 유지, 🧪 버튼 기본 숨김 · ?dev=1 표시, 매일 알림 카드 숨김
 * - 그림: 그림 템플릿 문제에서 #question-figure 에 SVG 표시
 */
'use strict';
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8080';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });

  check('문제 지문 렌더', (await page.textContent('#question-text')).trim().length > 10);
  check('보기 4개', (await page.$$('#options button, #options .option')).length === 4);
  check('🧪 버튼 기본 숨김', !(await page.isVisible('#dev-toggle-btn')));
  check('PWA 카드 유지(웹)', await page.$('#pwa-card') !== null);
  check('매일 알림 카드 숨김(웹)', !(await page.isVisible('#notify-card')));
  check('HaruPlatform.isNative = false', (await page.evaluate(() => window.HaruPlatform.isNative)) === false);

  // 하단 탭 아이콘: 4개 모두 같은 크기의 SVG
  const navIcons = await page.$$eval('.bottom-nav .nav-icon', els => els.map(e => {
    const r = e.getBoundingClientRect();
    return `${e.tagName.toLowerCase()}:${Math.round(r.width)}x${Math.round(r.height)}`;
  }));
  check('하단 탭 아이콘 4개 동일 크기 SVG', navIcons.length === 4 && new Set(navIcons).size === 1 && navIcons[0].startsWith('svg:'), navIcons.join(' '));

  // 정답 확인 → 풀이 표시
  await page.click('#options button >> nth=0');
  await page.click('#check-btn');
  await page.waitForSelector('#feedback.show', { timeout: 3000 });
  check('정답 확인 후 풀이 표시', (await page.$$('#feedback .step-item')).length >= 2);

  // 변형 문제
  const q1 = await page.textContent('#question-text');
  await page.click('#mutate-btn');
  await page.waitForTimeout(200);
  check('변형 문제 생성', (await page.textContent('#question-text')) !== q1 || (await page.textContent('#variant-tag')).includes('변형'));

  // 그림: 그림 템플릿을 교육과정 탭에서 직접 불러오기 대신 엔진으로 확인 + 화면 렌더 확인
  const figOk = await page.evaluate(() => {
    const p = HaruProblemBank.generateProblem({ templateId: 'MID-06', variant: 3 });
    const svg = HaruFigure.render(p.figure);
    return svg.startsWith('<svg') && /var\(--ink\)/.test(svg);
  });
  check('figure.js SVG 생성(CSS 변수 사용)', figOk);

  // 탭 전환
  for (const t of ['curriculum', 'history', 'settings', 'home']) {
    await page.click(`#nav-${t}`);
    check(`탭 전환: ${t}`, await page.isVisible(`#view-${t}`));
  }

  // 교육과정 탭에서 그림 템플릿 문제 불러오기 → #question-figure 에 SVG
  await page.click('#nav-curriculum');
  const loaded = await page.evaluate(() => {
    const btn = document.querySelector('#view-curriculum [data-action="solve-template"][data-id="MID-06"]');
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (loaded) {
    await page.waitForTimeout(300);
    const figVisible = await page.isVisible('#question-figure svg');
    check('교육과정 → 그림 템플릿 문제에 그림 표시', figVisible);
  } else {
    check('교육과정 → 그림 템플릿 버튼 탐색', false, '버튼을 찾지 못함');
  }

  // 설정: 백업 다운로드(웹)
  await page.click('#nav-settings');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
    page.click('#export-btn')
  ]);
  check('백업 JSON 다운로드(웹)', download && /harusuhak_backup_.*\.json/.test(download.suggestedFilename()));

  // 초기화: 커스텀 모달(취소)
  await page.click('#reset-btn');
  check('초기화 → 커스텀 모달 표시', await page.isVisible('.hs-modal-overlay'));
  await page.click('.hs-modal-overlay .secondary-btn:not(.hs-modal-danger)');
  check('모달 취소로 닫힘', !(await page.isVisible('.hs-modal-overlay')));

  // 앱 정보 카드
  check('앱 정보 카드: by TECHSENSE', (await page.textContent('#about-card')).includes('by TECHSENSE'));

  // ?dev=1 → 🧪 버튼 표시
  await page.goto(`${BASE}/index.html?dev=1`, { waitUntil: 'networkidle' });
  check('?dev=1 → 🧪 버튼 표시', await page.isVisible('#dev-toggle-btn'));

  // 로고 7탭 → 🧪 버튼 표시
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 7; i++) await page.click('.logo');
  check('로고 7탭 → 🧪 버튼 표시', await page.isVisible('#dev-toggle-btn'));

  check('콘솔/페이지 에러 0', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n=== 웹 스모크: ${results.length - fail}/${results.length} PASS ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
