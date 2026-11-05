/**
 * 스토어 스크린샷 내보내기 (산출물 — 디버그용 캡처 아님)
 * 순서: scripts/capture-raw.js 로 raw 캡처 → 이 스크립트가 store/screenshots 편집기(Next.js)를 띄워
 *       "Export bundle" 을 눌러 zip 을 받고 → output/{ko,en}/ 에 넣고 → 투명 채널 제거(RGB)
 * 실행: NODE_PATH=<playwright·sharp 설치 경로>/node_modules node scripts/export-shots.js
 * 편집기 의존성은 실행 중에만 설치하고 끝나면 지운다 (node_modules, .next, public/screenshots/raw)
 */
'use strict';
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const ED = path.resolve(__dirname, '..', 'store', 'screenshots');
const PORT = 3010;
const sh = (cmd, cwd = ED) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } });

(async () => {
  sh('pnpm install --frozen-lockfile');
  fs.rmSync(path.join(ED, 'public/screenshots/raw'), { recursive: true, force: true });
  fs.mkdirSync(path.join(ED, 'public/screenshots/raw'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ED, 'raw'))) fs.copyFileSync(path.join(ED, 'raw', f), path.join(ED, 'public/screenshots/raw', f));

  const dev = spawn('pnpm', ['exec', 'next', 'dev', '-p', String(PORT)], { cwd: ED, stdio: 'ignore', detached: true });
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`http://localhost:${PORT}`)).ok) break; } catch (e) { /* 아직 기동 중 */ }
      await new Promise(r => setTimeout(r, 1000));
    }
    const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(4000);
    const [dl] = await Promise.all([
      p.waitForEvent('download', { timeout: 300000 }),
      p.getByRole('button', { name: /Export bundle/ }).click()
    ]);
    const zip = path.join(ED, 'export', 'iphone.zip');
    fs.mkdirSync(path.dirname(zip), { recursive: true });
    await dl.saveAs(zip);
    await b.close();
    sh(`unzip -q -o "${zip}" -d export/unzip`);
    for (const loc of ['ko', 'en']) {
      const src = path.join(ED, 'export/unzip/ios/iphone/1320x2868', loc);
      const out = path.join(ED, 'output', loc);
      fs.mkdirSync(out, { recursive: true });
      for (const f of fs.readdirSync(src).filter(x => x.endsWith('.png'))) {
        const buf = await sharp(path.join(src, f)).flatten({ background: '#F6F7F1' }).removeAlpha().png().toBuffer();
        fs.writeFileSync(path.join(out, f), buf);
        const m = await sharp(buf).metadata();
        console.log(`${loc}/${f} ${m.width}x${m.height} alpha=${m.hasAlpha}`);
      }
    }
  } finally {
    try { process.kill(-dev.pid); } catch (e) { /* 이미 종료 */ }
    for (const d of ['export', 'node_modules', '.next', 'public/screenshots/raw']) fs.rmSync(path.join(ED, d), { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exit(1); });
