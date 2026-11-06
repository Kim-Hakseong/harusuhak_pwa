/**
 * 스토어 스크린샷 raw 캡처 (산출물 — 디버그용 캡처 아님)
 * 실행: NODE_PATH=<playwright>/node_modules node scripts/capture-raw.js http://localhost:8081 store/screenshots/raw
 * - iPhone 6.9" 해상도: 440×956 CSS px × 3 = 1320×2868
 * - iOS 앱과 같은 화면이 되도록 Capacitor 를 네이티브로 흉내(스텁) → PWA 카드 제거, 매일 알림 카드 표시
 * - Android: HARU_PLATFORM=android → getPlatform 'android', 412×892 CSS px × 3 = 1236×2676(9:19.5), 파일명 android-0N-*.png
 * - 시계 고정(2026-11-04 수 09:00) + 샘플 학습 기록 주입(9일 연속, 오답 2개). ?dev=1 사용 안 함
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8081';
const OUT = path.resolve(process.argv[3] || 'store/screenshots/raw');
fs.mkdirSync(OUT, { recursive: true });

const PLATFORM = process.env.HARU_PLATFORM === 'android' ? 'android' : 'ios';
const PREFIX = PLATFORM === 'android' ? 'android' : 'iphone';
const VIEWPORT = PLATFORM === 'android' ? { width: 412, height: 892 } : { width: 440, height: 956 };

const NATIVE_STUB = plat => {
  const ok = v => Promise.resolve(v);
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => plat,
    Plugins: {
      App: { getInfo: () => ok({ version: '1.0.0', build: '1' }), addListener: () => ok({ remove() {} }) },
      Haptics: { notification: () => ok() },
      StatusBar: { setStyle: () => ok() },
      Share: { share: () => ok() },
      Filesystem: { writeFile: () => ok({ uri: 'file:///tmp/x.json' }) },
      LocalNotifications: {
        checkPermissions: () => ok({ display: 'granted' }),
        requestPermissions: () => ok({ display: 'granted' }),
        schedule: () => ok(),
        cancel: () => ok()
      }
    }
  };
};

// 페이지 안에서 실제 문제은행으로 샘플 기록 생성
const SEED = () => {
  const B = window.HaruProblemBank;
  const level = 'middle';
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const monday = d => { const c = new Date(d); c.setHours(0, 0, 0, 0); c.setDate(c.getDate() - ((c.getDay() + 6) % 7)); return fmt(c); };
  const history = {}, progress = {}, log = [];
  const today = new Date();
  const wrongDays = [2, 6]; // 며칠 전 문제를 틀린 것으로
  for (let ago = 9; ago >= 1; ago--) {
    const d = new Date(today); d.setDate(d.getDate() - ago);
    const dk = fmt(d);
    const dayIdx = (d.getDay() + 6) % 7;
    const p = B.generateProblem({ level, dayIdx, dateKey: dk, variant: 0 });
    const wrong = wrongDays.includes(ago);
    const choice = wrong ? (p.answerIndex + 1) % 4 : p.answerIndex;
    history[`${level}_${dk}`] = { choice, answerIndex: p.answerIndex, isCorrect: !wrong, templateId: p.templateId, dateKey: dk };
    const wk = `${monday(d)}_${level}`;
    (progress[wk] = progress[wk] || []).push(dayIdx);
    log.unshift({
      id: `${dk}_seed`, dateKey: dk, timestamp: d.toISOString(), level, levelName: p.levelName,
      templateId: p.templateId, standardCode: p.standardCode, unit: p.unit, variant: 0,
      question: p.question, selectedText: p.options[choice], correctText: p.options[p.answerIndex], isCorrect: !wrong
    });
  }
  localStorage.setItem('hs_level', level);
  localStorage.setItem('hs_history', JSON.stringify(history));
  localStorage.setItem('hs_progress', JSON.stringify(progress));
  localStorage.setItem('hs_practice_log', JSON.stringify(log));
  localStorage.setItem('hs_variation_count', '23');
  localStorage.setItem('hs_notify_on', '1');
  localStorage.setItem('hs_notify_time', '08:00');
};

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
  const ctx = await browser.newContext({
    viewport: VIEWPORT, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    locale: 'ko-KR', serviceWorkers: 'block'
  });
  await ctx.addInitScript(NATIVE_STUB, PLATFORM);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-11-04T09:00:00+09:00'));
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'networkidle' });

  const shot = async name => {
    await page.waitForTimeout(250);
    const file = name.replace(/^iphone-/, `${PREFIX}-`);
    await page.screenshot({ path: path.join(OUT, file), type: 'png' });
    console.log('saved', file);
  };
  const scrollTo = async (sel, offset = 16) => {
    await page.evaluate(([s, o]) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o); }, [sel, offset]);
  };

  // 1. 홈 — 오늘의 문제
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('iphone-01-home.png');

  // 2. 변형 문제 — 숫자 바꿔 새 문제 + 정답 확인 후 풀이
  await page.click('#mutate-btn');
  await page.waitForTimeout(300);
  const ans = await page.evaluate(() => {
    const t = document.querySelector('#question-text').textContent;
    const p = window.HaruProblemBank.generateProblem({ level: 'middle', dayIdx: (new Date().getDay() + 6) % 7, dateKey: '2026-11-04', variant: 1 });
    if (p.question !== t) throw new Error('변형 문제 정답 계산 불일치');
    return p.answerIndex;
  });
  await page.click(`#options button >> nth=${ans}`);
  await page.click('#check-btn');
  await page.waitForSelector('#feedback.show');
  await page.waitForTimeout(2600); // 토스트 사라질 때까지
  await scrollTo('#question-card', 12);
  await shot('iphone-02-variation.png');

  // 3. 그림 문제 — 교육과정 탭에서 MID-06(피타고라스) 불러오기
  await page.click('#nav-curriculum');
  await page.click('#view-curriculum [data-action="solve-template"][data-id="MID-06"]');
  await page.waitForSelector('#question-figure svg');
  await page.waitForTimeout(2600);
  await scrollTo('.source-ref', 150);
  await shot('iphone-03-figure.png');

  // 4. 교육과정 탭
  await page.click('#nav-curriculum');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('iphone-04-curriculum.png');

  // 5. 오답노트 (기록 탭, 오답 필터)
  await page.click('#nav-history');
  const wrongChip = await page.$('.filter-chip[data-history-filter="wrong"]');
  if (wrongChip) await wrongChip.click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('iphone-05-wrong-notes.png');

  // 6. 설정 (iOS 앱 화면 — 매일 알림·앱 정보)
  await page.click('#nav-settings');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('iphone-06-settings.png');

  await browser.close();
  if (errors.length) { console.error('page errors:', errors); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
