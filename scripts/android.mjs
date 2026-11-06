#!/usr/bin/env node
// 하루수학 Android 빌드 스크립트 (Windows·macOS·Linux 공통)
//   node scripts/android.mjs config   → ~/.haku-env 의 SUPPORT_EMAIL 만으로 www/config.js 생성
//   node scripts/android.mjs sync     → config + cap sync android + config.js 주입 + 미리보기 삭제
//   node scripts/android.mjs debug    → sync + assembleDebug + adb install -r + 실행
//   node scripts/android.mjs release  → sync + bundleRelease(업로드 키 서명) → build/HaruSuhak-release.aab
// 비밀값(키스토어 경로·비밀번호)은 ~/.haku-env 에서 읽어 Gradle 환경 변수로만 넘긴다. 파일·로그에 쓰지 않는다.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_ID = 'kr.harusuhak.app';
const IS_WIN = platform() === 'win32';
const ANDROID_DIR = join(ROOT, 'android');
const PUBLIC_DIR = join(ANDROID_DIR, 'app', 'src', 'main', 'assets', 'public');

// ~/.haku-env 를 KEY=VALUE 로 읽는다(따옴표 제거). 없으면 빈 객체
function readHakuEnv() {
  const file = join(homedir(), '.haku-env');
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8').split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const body = line.replace(/^export\s+/, '');
        const i = body.indexOf('=');
        return [body.slice(0, i).trim(), body.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')];
      })
  );
}

// JAVA_HOME·ANDROID_HOME 이 비어 있으면 Android Studio 기본 설치 경로로 채운다
function toolEnv() {
  const env = { ...process.env };
  if (!env.ANDROID_HOME) {
    const sdk = IS_WIN ? join(homedir(), 'AppData', 'Local', 'Android', 'Sdk')
      : platform() === 'darwin' ? join(homedir(), 'Library', 'Android', 'sdk') : join(homedir(), 'Android', 'Sdk');
    if (existsSync(sdk)) env.ANDROID_HOME = sdk;
  }
  if (!env.JAVA_HOME) {
    const jbr = IS_WIN ? 'C:\\Program Files\\Android\\Android Studio\\jbr'
      : '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
    if (existsSync(jbr)) env.JAVA_HOME = jbr;
  }
  return env;
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: IS_WIN, cwd: ROOT, env: toolEnv(), ...opts });
  if (res.status !== 0) {
    throw new Error(`실패: ${cmd} ${args.join(' ')} (exit ${res.status})`);
  }
}

function adbPath() {
  const sdk = toolEnv().ANDROID_HOME;
  const adb = sdk ? join(sdk, 'platform-tools', IS_WIN ? 'adb.exe' : 'adb') : 'adb';
  return existsSync(adb) ? adb : 'adb';
}

function genConfig() {
  const email = readHakuEnv().SUPPORT_EMAIL || '';
  // iOS gen_config 와 같은 형식. Android 는 APP_STORE_ID 를 쓰지 않는다
  writeFileSync(join(ROOT, 'www', 'config.js'),
    `// 빌드 시 scripts/android.mjs 가 생성 (gitignore)\nwindow.HARU_CONFIG = { SUPPORT_EMAIL: ${JSON.stringify(email)}, APP_STORE_ID: "" };\n`);
  console.log(`config.js 생성 (SUPPORT_EMAIL ${email ? '있음' : '없음'})`);
}

function syncWeb() {
  genConfig();
  run('pnpm', ['cap', 'sync', 'android']);
  // 개발용 미리보기는 배포 번들에서 제외
  rmSync(join(PUBLIC_DIR, '_figure_preview.html'), { force: true });
  // config.js 는 네이티브 번들에만 주입 (웹 index.html 은 참조하지 않음)
  const indexFile = join(PUBLIC_DIR, 'index.html');
  const html = readFileSync(indexFile, 'utf8');
  const tag = '<script src="platform.js"></script>';
  const injected = html.includes('src="config.js"') ? html
    : html.replace(tag, `<script src="config.js"></script>\n  ${tag}`);
  if (!injected.includes('src="config.js"')) throw new Error('config.js 주입 실패');
  writeFileSync(indexFile, injected);
  console.log('웹 자산 동기화 완료 (config.js 주입, _figure_preview.html 제외)');
}

function gradle(task, extraEnv = {}) {
  const wrapper = IS_WIN ? `"${join(ANDROID_DIR, 'gradlew.bat')}"` : './gradlew';
  run(wrapper, [task, '--no-daemon'], { cwd: ANDROID_DIR, env: { ...toolEnv(), ...extraEnv } });
}

function debug() {
  syncWeb();
  gradle('assembleDebug');
  const apk = join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const adb = adbPath();
  run(adb, ['install', '-r', apk]);
  run(adb, ['shell', 'monkey', '-p', APP_ID, '-c', 'android.intent.category.LAUNCHER', '1']);
}

function signingEnv() {
  const env = readHakuEnv();
  const keys = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
  const missing = keys.filter(k => !env[k]);
  if (missing.length) throw new Error(`~/.haku-env 에 없음: ${missing.join(', ')}`);
  if (!existsSync(env.ANDROID_KEYSTORE_PATH)) throw new Error('ANDROID_KEYSTORE_PATH 파일이 없습니다');
  return Object.fromEntries(keys.map(k => [k, env[k]]));
}

function release() {
  const sign = signingEnv();
  syncWeb();
  gradle('bundleRelease', sign);
  const aab = join(ANDROID_DIR, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  mkdirSync(join(ROOT, 'build'), { recursive: true });
  const out = join(ROOT, 'build', 'HaruSuhak-release.aab');
  copyFileSync(aab, out);
  console.log(`${out} ${statSync(out).size} B`);
}

const MODES = { config: genConfig, sync: syncWeb, debug, release };
const mode = process.argv[2];
if (!MODES[mode]) {
  console.error('사용법: node scripts/android.mjs <config|sync|debug|release>');
  process.exit(2);
}
try {
  MODES[mode]();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
