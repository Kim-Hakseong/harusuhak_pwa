/**
 * 하루수학 플랫폼 어댑터 (HaruPlatform)
 * - 네이티브(Capacitor iOS)와 웹 브라우저의 차이를 이 파일 하나로 감싼다.
 * - 네이티브 플러그인은 window.Capacitor.Plugins 로 접근 (빌드 도구 없음).
 * - 웹에서는 모든 네이티브 기능이 안전한 대체 동작(no-op / 다운로드 / HTML 모달)으로 떨어진다.
 */
(function (global) {
  'use strict';

  const Cap = global.Capacitor;
  const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  const plugin = name => (isNative && Cap.Plugins ? Cap.Plugins[name] : null);
  const config = Object.assign({ SUPPORT_EMAIL: '', APP_STORE_ID: '' }, global.HARU_CONFIG || {});
  const NOTIFY_ID = 1;

  // ---------------------------------------------------------------- 햅틱
  function haptic(kind) {
    const H = plugin('Haptics');
    if (!H) return;
    const type = kind === 'success' ? 'SUCCESS' : kind === 'error' ? 'ERROR' : 'WARNING';
    H.notification({ type }).catch(() => {});
  }

  // ---------------------------------------------------------------- 파일 공유(백업)
  async function share(name, text) {
    const FS = plugin('Filesystem');
    const SH = plugin('Share');
    if (FS && SH) {
      const { uri } = await FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
      try {
        await SH.share({ title: name, url: uri });
      } catch (e) {
        // 사용자가 공유 시트를 닫은 경우는 실패가 아니다
        if (!/cancel/i.test(String(e && e.message))) throw e;
        return false;
      }
      return true;
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  // ---------------------------------------------------------------- 커스텀 모달 (alert/confirm 대체)
  // opts: { title, message, confirmText, cancelText(없으면 확인 버튼만), danger }
  function dialog(opts) {
    return new Promise(resolve => {
      const o = Object.assign({ title: '', message: '', confirmText: '확인', cancelText: null, danger: false }, opts);
      const overlay = document.createElement('div');
      overlay.className = 'hs-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      const card = document.createElement('div');
      card.className = 'settings-card hs-modal-card';
      if (o.title) {
        const h = document.createElement('h4');
        h.textContent = o.title;
        card.appendChild(h);
      }
      const p = document.createElement('p');
      p.className = 'hs-modal-message';
      p.textContent = o.message;
      card.appendChild(p);
      const row = document.createElement('div');
      row.className = 'hs-modal-actions';
      const close = val => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };
      const onKey = e => {
        if (e.key === 'Escape') close(false);
      };
      if (o.cancelText) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'secondary-btn';
        cancel.textContent = o.cancelText;
        cancel.onclick = () => close(false);
        row.appendChild(cancel);
      }
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = o.danger ? 'secondary-btn hs-modal-danger' : 'primary';
      ok.textContent = o.confirmText;
      ok.onclick = () => close(true);
      row.appendChild(ok);
      card.appendChild(row);
      overlay.appendChild(card);
      overlay.addEventListener('click', e => {
        if (e.target === overlay) close(false);
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
      ok.focus();
    });
  }

  // ---------------------------------------------------------------- 매일 알림
  const notify = {
    available: () => !!plugin('LocalNotifications'),
    async requestPermission() {
      const LN = plugin('LocalNotifications');
      if (!LN) return false;
      const cur = await LN.checkPermissions();
      if (cur.display === 'granted') return true;
      const res = await LN.requestPermissions();
      return res.display === 'granted';
    },
    async schedule(hour, minute) {
      const LN = plugin('LocalNotifications');
      if (!LN) return false;
      await notify.cancel();
      await LN.schedule({
        notifications: [{
          id: NOTIFY_ID,
          title: '하루수학',
          body: '오늘의 한 문제가 준비되었어요. 3분만 풀어 볼까요?',
          schedule: { on: { hour, minute }, allowWhileIdle: true },
          // Android: 정확한 알람 권한을 요청하지 않는다(몇 분 오차 허용). iOS는 무시
          isExactNotification: false
        }]
      });
      return true;
    },
    async cancel() {
      const LN = plugin('LocalNotifications');
      if (!LN) return;
      await LN.cancel({ notifications: [{ id: NOTIFY_ID }] });
    }
  };

  // ---------------------------------------------------------------- 포그라운드 복귀
  function onForeground(cb) {
    const A = plugin('App');
    if (A) {
      A.addListener('appStateChange', s => {
        if (s && s.isActive) cb();
      });
    } else {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') cb();
      });
    }
  }

  // ---------------------------------------------------------------- 앱 정보
  async function appInfo() {
    const ua = navigator.userAgent || '';
    const iosMatch = ua.match(/OS (\d+)[_.](\d+)/);
    const osVersion = iosMatch ? `${iosMatch[1]}.${iosMatch[2]}` : '';
    const model = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : 'Web';
    const A = plugin('App');
    if (A) {
      try {
        const info = await A.getInfo();
        return { version: info.version, build: info.build, osVersion, model };
      } catch (e) { /* 아래 웹 값으로 */ }
    }
    return { version: 'web', build: '', osVersion, model };
  }

  // ---------------------------------------------------------------- 스토어 새 버전 확인
  // iOS: App Store 조회(대한민국 스토어) → 스토어 페이지 열기 / Android: Play 인앱 즉시 업데이트(끝나면 새 버전으로 재실행)
  const update = {
    async check() {
      const AU = plugin('AppUpdate');
      if (!AU) return null;
      const info = await AU.getAppUpdateInfo({ country: 'kr' });
      return {
        available: info.updateAvailability === 2, // UPDATE_AVAILABLE
        version: info.availableVersionName || '',
        immediate: !!info.immediateUpdateAllowed
      };
    },
    async open(immediate) {
      const AU = plugin('AppUpdate');
      if (!AU) return;
      if (Cap.getPlatform() === 'android' && immediate) {
        await AU.performImmediateUpdate();
        return;
      }
      if (Cap.getPlatform() === 'ios' && !config.APP_STORE_ID) return; // iOS 는 앱 ID 필수
      await AU.openAppStore(config.APP_STORE_ID ? { appId: config.APP_STORE_ID } : {});
    }
  };

  // ---------------------------------------------------------------- 스토어 평가 페이지
  // iOS: 리뷰 작성 화면(앱 ID 필요) / Android: Play 스토어 앱 페이지
  const review = {
    available: () => isNative && (Cap.getPlatform() === 'android' || !!config.APP_STORE_ID),
    open() {
      if (Cap.getPlatform() === 'android') {
        const AU = plugin('AppUpdate');
        if (AU) AU.openAppStore({}).catch(() => {});
        return;
      }
      openExternal(`itms-apps://itunes.apple.com/app/id${config.APP_STORE_ID}?action=write-review`);
    }
  };

  // ---------------------------------------------------------------- Android 뒤로 가기 버튼 (iOS 에는 없음)
  function onBackButton(cb) {
    const A = plugin('App');
    if (A && Cap.getPlatform() === 'android') A.addListener('backButton', cb);
  }

  function exitApp() {
    const A = plugin('App');
    if (A && A.exitApp) A.exitApp();
  }

  function openExternal(url) {
    // WKWebView 는 mailto:/itms-apps: 링크를 시스템에 넘긴다
    global.location.href = url;
  }

  // ---------------------------------------------------------------- 네이티브 초기화
  function initNative() {
    if (!isNative) return;
    const SB = plugin('StatusBar');
    if (SB) SB.setStyle({ style: 'LIGHT' }).catch(() => {});
    document.documentElement.classList.add('is-native');
  }
  initNative();

  global.HaruPlatform = { isNative, config, haptic, share, dialog, notify, update, review, onForeground, onBackButton, exitApp, appInfo, openExternal };
})(typeof window !== 'undefined' ? window : globalThis);
