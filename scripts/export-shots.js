/**
 * 스토어 스크린샷 내보내기 (산출물 — 디버그용 캡처 아님)
 * 순서: scripts/capture-raw.js 로 raw 캡처 → 이 스크립트가 store/screenshots 편집기(Next.js)를 띄워
 *       "Export bundle" 을 눌러 zip 을 받고 → output 폴더에 넣고 → 투명 채널 제거(RGB)
 * 실행: NODE_PATH=<playwright·sharp 설치 경로>/node_modules node scripts/export-shots.js
 *   iOS(기본)  : iPhone 1320×2868 6장 → store/screenshots/output/{ko,en}/
 *   Android    : HARU_PLATFORM=android → Android Phone 1080×1920 6장 + Feature Graphic 1024×500
 *                → store/screenshots/output-android/{ko,en}/  (raw 는 android-0N-*.png 필요)
 * 편집기 의존성은 실행 중에만 설치하고 끝나면 지운다 (node_modules, .next, public/screenshots/raw)
 */
'use strict';
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const ED = path.resolve(__dirname, '..', 'store', 'screenshots');
const PROJECT = path.join(ED, 'app-store-screenshots.json');
const PORT = 3010;
const ANDROID = process.env.HARU_PLATFORM === 'android';
const sh = (cmd, cwd = ED) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } });

// Feature Graphic 문구 (앱 이름 아래 한 줄)
const FEATURE_TAGLINE = {
  ko: '하루 한 문제로 수학 습관 완성\n140개 유형 · 난이도 하·중·상',
  en: 'One math problem a day\n140 types · Easy to Hard'
};

const readProject = () => JSON.parse(fs.readFileSync(PROJECT, 'utf8'));
const writeProject = p => fs.writeFileSync(PROJECT, JSON.stringify(p, null, 2) + '\n');

// iPhone 슬라이드 문구·레이아웃을 그대로 Android Phone 덱으로 복제 (raw 파일만 android-*)
function androidSlides(project) {
  return project.slidesByDevice.iphone.map(s => ({
    ...s,
    id: s.id.replace(/^iphone-/, 'android-'),
    screenshot: s.screenshot.replace('/raw/iphone-', '/raw/android-')
  }));
}

function withDevice(project, device) {
  const slidesByDevice = {
    ...project.slidesByDevice,
    android: androidSlides(project),
    'feature-graphic': [{ id: 'feature-graphic-01', layout: 'feature-graphic', headline: FEATURE_TAGLINE }]
  };
  return { ...project, device, orientation: 'portrait', slidesByDevice };
}

async function waitForEditor() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORT}`)).ok) return; } catch (e) { /* 아직 기동 중 */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('편집기 기동 시간 초과');
}

// 현재 device 덱을 Export bundle 로 내려받아 압축을 푼 폴더를 돌려준다
async function exportBundle(ctx, name) {
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 180000 });
  await p.getByRole('button', { name: /Export bundle/ }).waitFor({ timeout: 180000 });
  await p.waitForTimeout(6000);
  const [dl] = await Promise.all([
    p.waitForEvent('download', { timeout: 300000 }),
    p.getByRole('button', { name: /Export bundle/ }).click()
  ]);
  const zip = path.join(ED, 'export', `${name}.zip`);
  fs.mkdirSync(path.dirname(zip), { recursive: true });
  await dl.saveAs(zip);
  await p.close();
  const dir = path.join(ED, 'export', name);
  sh(`unzip -q -o "${zip}" -d "${dir}"`);
  return dir;
}

// 압축 푼 폴더 안 <...>/<WxH>/<locale>/*.png 를 out/<locale>/<prefix><파일> 로 RGB 변환 저장
async function collect(dir, size, outRoot, prefix = '') {
  const walk = d => fs.readdirSync(d, { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = walk(dir).filter(f => f.endsWith('.png') && f.split(path.sep).includes(size));
  if (!files.length) throw new Error(`${size} PNG 없음: ${dir}`);
  for (const f of files) {
    const loc = path.basename(path.dirname(f));
    const out = path.join(outRoot, loc);
    fs.mkdirSync(out, { recursive: true });
    const buf = await sharp(f).flatten({ background: '#F6F7F1' }).removeAlpha().png().toBuffer();
    const target = path.join(out, prefix + path.basename(f));
    fs.writeFileSync(target, buf);
    const m = await sharp(buf).metadata();
    console.log(`${path.relative(ED, target)} ${m.width}x${m.height} alpha=${m.hasAlpha}`);
  }
}

(async () => {
  const original = readProject();
  sh('pnpm install --frozen-lockfile');
  fs.rmSync(path.join(ED, 'public/screenshots/raw'), { recursive: true, force: true });
  fs.mkdirSync(path.join(ED, 'public/screenshots/raw'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ED, 'raw'))) fs.copyFileSync(path.join(ED, 'raw', f), path.join(ED, 'public/screenshots/raw', f));

  if (ANDROID) writeProject(withDevice(original, 'android'));
  const dev = spawn('pnpm', ['exec', 'next', 'dev', '-p', String(PORT)], { cwd: ED, stdio: 'ignore', detached: true, shell: process.platform === 'win32' });
  try {
    await waitForEditor();
    const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
    if (ANDROID) {
      const outRoot = path.join(ED, 'output-android');
      fs.rmSync(outRoot, { recursive: true, force: true });
      await collect(await exportBundle(ctx, 'android'), '1080x1920', outRoot, 'phone-');
      writeProject(withDevice(original, 'feature-graphic'));
      await collect(await exportBundle(ctx, 'feature'), '1024x500', outRoot);
    } else {
      await collect(await exportBundle(ctx, 'iphone'), '1320x2868', path.join(ED, 'output'));
    }
    await b.close();
  } finally {
    try { process.kill(-dev.pid); } catch (e) { /* 이미 종료 */ }
    if (process.platform === 'win32') { try { execSync(`taskkill /PID ${dev.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { /* 이미 종료 */ } }
    // Android 덱은 남기되 편집기 기본 화면은 원래 기기로 되돌린다
    writeProject(ANDROID ? withDevice(original, original.device) : original);
    for (const d of ['export', 'node_modules', '.next', 'public/screenshots/raw']) fs.rmSync(path.join(ED, d), { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exit(1); });
