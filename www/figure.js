/**
 * 하루수학 SVG 피겨 렌더러 (HaruFigure)
 * - 입력: generate()가 돌려준 figure 스펙 객체 → 출력: SVG 문자열 (의존성 0)
 * - 색은 styles.css 의 CSS 변수만 사용 (--ink, --muted, --line, --soft, --accent, --accent-dark, --paper)
 * - 원칙: 정답은 그림에 쓰지 않는다. 미지수는 '?'로 표기하고,
 *   spec.mask(정답에 등장하는 숫자 목록)에 걸리는 라벨 숫자도 '?'로 가린다.
 * 브라우저(window)와 Node(global) 양쪽에서 동작한다 (verify/figure-leak-check.js 가 Node에서 사용).
 */
(function (global) {
  'use strict';

  const W = 320;
  const H = 200;
  let clipSeq = 0;

  // ---------------------------------------------------------------- 공통 도우미
  const r1 = v => Math.round(v * 10) / 10;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 마스크: 라벨 안 숫자 토큰이 정답 숫자와 같으면 '?'로 바꾼다
  function masker(mask) {
    const set = new Set((mask || []).map(Number));
    return s => String(s).replace(/[−-]?\d+(?:\.\d+)?/g, tok => (set.has(Number(tok.replace('−', '-'))) ? '?' : tok));
  }

  const STYLE = {
    ink: 'stroke:var(--ink);stroke-width:2;fill:none;stroke-linejoin:round;stroke-linecap:round',
    thin: 'stroke:var(--muted);stroke-width:1.2;fill:none',
    dash: 'stroke:var(--muted);stroke-width:1.2;fill:none;stroke-dasharray:4 4',
    axis: 'stroke:var(--muted);stroke-width:1.2;fill:none',
    shape: 'stroke:var(--ink);stroke-width:2;fill:var(--soft);stroke-linejoin:round',
    accent: 'stroke:var(--ink);stroke-width:2;fill:var(--accent);stroke-linejoin:round',
    band: 'stroke:none;fill:var(--accent);fill-opacity:0.35',
    dot: 'stroke:var(--paper);stroke-width:1.5;fill:var(--ink)',
    curve: 'stroke:var(--ink);stroke-width:2.2;fill:none;stroke-linecap:round'
  };

  function ctx(spec) {
    const m = masker(spec.mask);
    const parts = [];
    return {
      add: s => parts.push(s),
      line: (x1, y1, x2, y2, st = STYLE.ink) => parts.push(`<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" style="${st}"/>`),
      poly: (pts, st = STYLE.shape) => parts.push(`<polygon points="${pts.map(p => `${r1(p[0])},${r1(p[1])}`).join(' ')}" style="${st}"/>`),
      path: (d, st = STYLE.curve, extra = '') => parts.push(`<path d="${d}" style="${st}"${extra}/>`),
      dot: (x, y, rad = 3.5) => parts.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${rad}" style="${STYLE.dot}"/>`),
      text: (x, y, s, opt = {}) => {
        const anchor = opt.anchor || 'middle';
        const color = opt.muted ? 'var(--muted)' : 'var(--ink)';
        const weight = opt.bold ? 'font-weight:700;' : '';
        parts.push(`<text x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}" dominant-baseline="middle" style="fill:${color};${weight}font-size:${opt.size || 12}px">${esc(m(s))}</text>`);
      },
      svg: label => `<svg class="figure-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(label)}" style="font-family:inherit;font-size:12px;display:block">${parts.join('')}</svg>`
    };
  }

  // 좌표축(원점 ox, oy) — 눈금 숫자는 그리지 않는다
  function axes(c, ox, oy, opt = {}) {
    const x0 = opt.x0 ?? 14, x1 = opt.x1 ?? W - 14, y0 = opt.y0 ?? 12, y1 = opt.y1 ?? H - 12;
    c.line(x0, oy, x1, oy, STYLE.axis);
    c.line(ox, y1, ox, y0, STYLE.axis);
    c.poly([[x1, oy], [x1 - 7, oy - 4], [x1 - 7, oy + 4]], 'fill:var(--muted);stroke:none');
    c.poly([[ox, y0], [ox - 4, y0 + 7], [ox + 4, y0 + 7]], 'fill:var(--muted);stroke:none');
    c.text(x1 - 4, oy + 12, 'x', { muted: true });
    c.text(ox + 10, y0 + 4, 'y', { muted: true });
    c.text(ox - 9, oy + 11, 'O', { muted: true, size: 11 });
  }

  // 수학 좌표 → 화면 좌표 (영역에 맞춰 x·y 각각 축척)
  function mapper(xmin, xmax, ymin, ymax, box = { l: 24, r: W - 24, t: 18, b: H - 18 }, uniform = false) {
    let sx = (box.r - box.l) / (xmax - xmin);
    let sy = (box.b - box.t) / (ymax - ymin);
    if (uniform) sx = sy = Math.min(sx, sy);
    const cx = (box.l + box.r) / 2 - ((xmin + xmax) / 2) * sx;
    const cy = (box.t + box.b) / 2 + ((ymin + ymax) / 2) * sy;
    return { X: x => cx + x * sx, Y: y => cy - y * sy, sx, sy };
  }

  function curvePath(f, xa, xb, M, n = 80) {
    let d = '';
    for (let i = 0; i <= n; i++) {
      const x = xa + ((xb - xa) * i) / n;
      d += `${i ? 'L' : 'M'}${r1(M.X(x))},${r1(M.Y(f(x)))}`;
    }
    return d;
  }

  function clipped(c, d, st) {
    const id = `hf-clip-${++clipSeq}`;
    c.add(`<clipPath id="${id}"><rect x="6" y="6" width="${W - 12}" height="${H - 12}"/></clipPath>`);
    c.path(d, st, ` clip-path="url(#${id})"`);
  }

  // ---------------------------------------------------------------- 타입별 렌더러
  const R = {};

  // 사다리꼴: top, bottom, height (넓이 '?')
  R.trapezoid = (s, c) => {
    const k = 220 / s.bottom;
    const bw = s.bottom * k;
    const tw = s.top * k;
    const hp = Math.max(70, Math.min(120, s.height * k));
    const x0 = 50, yb = 165, yt = yb - hp;
    const tx = x0 + (bw - tw) * 0.35;
    c.poly([[x0, yb], [x0 + bw, yb], [tx + tw, yt], [tx, yt]]);
    c.line(tx, yt, tx, yb, STYLE.dash);
    c.add(`<rect x="${r1(tx)}" y="${r1(yb - 9)}" width="9" height="9" style="${STYLE.thin}"/>`);
    c.text(tx + tw / 2, yt - 10, `${s.top}cm`);
    c.text(x0 + bw / 2, yb + 15, `${s.bottom}cm`);
    c.text(tx - 4, (yt + yb) / 2, `${s.height}cm`, { anchor: 'end' });
    c.text(x0 + bw / 2 + 10, (yt + yb) / 2 + 4, '넓이 = ?', { bold: true });
    return c.svg('사다리꼴');
  };

  // 원: r (넓이 '?')
  R.circle = (s, c) => {
    const cx = 160, cy = 100, rr = 72;
    c.add(`<circle cx="${cx}" cy="${cy}" r="${rr}" style="${STYLE.shape}"/>`);
    c.line(cx, cy, cx + rr, cy, STYLE.ink);
    c.dot(cx, cy, 3);
    c.text(cx + rr / 2, cy - 11, `${s.r} cm`);
    c.text(cx, cy + 34, s.unknown === 'circumference' ? '둘레 = ?' : '넓이 = ?', { bold: true });
    return c.svg('원');
  };

  // 직육면체: w(가로), d(세로), h(높이)
  R.cuboid = (s, c) => {
    const k = Math.min(200 / (s.w + s.d * 0.6), 150 / (s.h + s.d * 0.45));
    const Wd = s.w * k, Hh = s.h * k, ox = s.d * k * 0.6, oy = -s.d * k * 0.45;
    const x0 = (W - (Wd + ox)) / 2, y0 = 178;
    const A = [x0, y0], B = [x0 + Wd, y0], C = [x0 + Wd, y0 - Hh], D = [x0, y0 - Hh];
    const off = p => [p[0] + ox, p[1] + oy];
    c.poly([D, C, off(C), off(D)], STYLE.accent);
    c.poly([B, off(B), off(C), C]);
    c.poly([A, B, C, D]);
    const hb = off(A);
    c.line(A[0], A[1], hb[0], hb[1], STYLE.dash);
    c.line(hb[0], hb[1], off(B)[0], off(B)[1], STYLE.dash);
    c.line(hb[0], hb[1], off(D)[0], off(D)[1], STYLE.dash);
    c.text((A[0] + B[0]) / 2, y0 + 12, `${s.w} cm`);
    c.text(B[0] + ox / 2 + 8, y0 + oy / 2 + 6, `${s.d} cm`, { anchor: 'start' });
    c.text(x0 - 6, y0 - Hh / 2, `${s.h} cm`, { anchor: 'end' });
    return c.svg('직육면체');
  };

  // 마름모: d1(가로 대각선), d2(세로 대각선) (넓이 '?')
  R.rhombus = (s, c) => {
    const k = Math.min(240 / s.d1, 160 / s.d2);
    const hx = (s.d1 * k) / 2, hy = (s.d2 * k) / 2, cx = 150, cy = 100;
    c.poly([[cx - hx, cy], [cx, cy - hy], [cx + hx, cy], [cx, cy + hy]]);
    c.line(cx - hx, cy, cx + hx, cy, STYLE.dash);
    c.line(cx, cy - hy, cx, cy + hy, STYLE.dash);
    c.text(cx + hx / 2, cy + 12, `${s.d1} cm`);
    c.text(cx + 6, cy - hy / 2, `${s.d2} cm`, { anchor: 'start' });
    c.text(W - 18, 22, '넓이 = ?', { anchor: 'end', bold: true });
    return c.svg('마름모');
  };

  // 원그래프: percent, label (중심각 '?')
  R.pie = (s, c) => {
    const cx = 120, cy = 100, rr = 78;
    const a0 = -Math.PI / 2, a1 = a0 + (s.percent / 100) * Math.PI * 2;
    const P = a => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    const [x0, y0] = P(a0), [x1, y1] = P(a1);
    const large = s.percent > 50 ? 1 : 0;
    c.add(`<circle cx="${cx}" cy="${cy}" r="${rr}" style="${STYLE.shape}"/>`);
    c.path(`M${cx},${cy}L${r1(x0)},${r1(y0)}A${rr},${rr} 0 ${large} 1 ${r1(x1)},${r1(y1)}Z`, STYLE.accent);
    const am = (a0 + a1) / 2, ar = 20;
    c.path(`M${r1(cx + ar * Math.cos(a0))},${r1(cy + ar * Math.sin(a0))}A${ar},${ar} 0 ${large} 1 ${r1(cx + ar * Math.cos(a1))},${r1(cy + ar * Math.sin(a1))}`, STYLE.thin);
    c.text(cx + 34 * Math.cos(am), cy + 34 * Math.sin(am), '?°', { bold: true });
    c.add(`<rect x="222" y="86" width="12" height="12" rx="2" style="${STYLE.accent}"/>`);
    c.text(240, 92, `${s.label} ${s.percent}%`, { anchor: 'start' });
    c.add(`<rect x="222" y="108" width="12" height="12" rx="2" style="${STYLE.shape}"/>`);
    c.text(240, 114, '나머지', { anchor: 'start', muted: true });
    return c.svg('원그래프');
  };

  // 일차함수 그래프: slope, intercept (두 절편은 p, q 로만 표기)
  R['line-graph'] = (s, c) => {
    const q = s.intercept, p = -s.intercept / s.slope;
    const M = mapper(-Math.abs(p) * 1.6, Math.abs(p) * 1.6, -Math.abs(q) * 1.4, Math.abs(q) * 1.4);
    axes(c, M.X(0), M.Y(0));
    const f = x => s.slope * x + q;
    clipped(c, curvePath(f, -Math.abs(p) * 1.6, Math.abs(p) * 1.6, M, 2), STYLE.curve);
    c.dot(M.X(p), M.Y(0));
    c.dot(M.X(0), M.Y(q));
    c.text(M.X(p), M.Y(0) + (q > 0 ? 14 : -12), s.xLabel || '?', { bold: true });
    c.text(M.X(0) + (p > 0 ? -12 : 12), M.Y(q), s.yLabel || '?', { bold: true });
    return c.svg('일차함수 그래프');
  };

  // 직각삼각형: sides {a: 세로 변, b: 가로 변, c: 빗변} — 값 또는 '?' 또는 ''(표기 안 함), shape:[a, b] 비율, angle(빗변·가로 변 사이 각)
  R['right-triangle'] = (s, c) => {
    const [sa, sb] = s.shape;
    const k = Math.min(210 / sb, 140 / sa);
    const x0 = 70, y0 = 172, bx = x0 + sb * k, ty = y0 - sa * k;
    c.poly([[x0, y0], [bx, y0], [x0, ty]]);
    c.add(`<rect x="${x0}" y="${r1(y0 - 11)}" width="11" height="11" style="${STYLE.thin}"/>`);
    const lab = v => (v === '?' ? '?' : `${v} cm`);
    if (s.sides.a !== '' && s.sides.a != null) c.text(x0 - 8, (y0 + ty) / 2, lab(s.sides.a), { anchor: 'end', bold: s.sides.a === '?' });
    if (s.sides.b !== '' && s.sides.b != null) c.text((x0 + bx) / 2, y0 + 14, lab(s.sides.b), { bold: s.sides.b === '?' });
    if (s.sides.c !== '' && s.sides.c != null) c.text((x0 + bx) / 2 + 12, (y0 + ty) / 2 - 8, lab(s.sides.c), { anchor: 'start', bold: s.sides.c === '?' });
    if (s.angle) {
      const ang = Math.atan2(y0 - ty, bx - x0), ar = 26;
      c.path(`M${r1(bx - ar)},${y0}A${ar},${ar} 0 0 1 ${r1(bx - ar * Math.cos(ang))},${r1(y0 - ar * Math.sin(ang))}`, STYLE.thin);
      c.text(bx - ar - 18, y0 - 9, s.angle);
    }
    return c.svg('직각삼각형');
  };

  // 이차함수 y = a(x − h)² + k 개형 (꼭짓점·축은 '?')
  R.parabola = (s, c) => {
    const ox = 160, oy = 100;
    axes(c, ox, oy);
    const vx = ox + Math.sign(s.h) * 62, vy = oy - Math.sign(s.k) * 42;
    const wdt = 64 / Math.sqrt(Math.abs(s.a)), dir = s.a > 0 ? -1 : 1;
    let d = '';
    for (let i = 0; i <= 60; i++) {
      const t = -1.4 + (2.8 * i) / 60;
      d += `${i ? 'L' : 'M'}${r1(vx + t * wdt)},${r1(vy + dir * t * t * 70)}`;
    }
    clipped(c, d, STYLE.curve);
    c.line(vx, 14, vx, H - 14, STYLE.dash);
    c.dot(vx, vy);
    c.text(vx + 8, vy + (s.a > 0 ? 14 : -14), '(?, ?)', { anchor: 'start', bold: true });
    c.text(vx + 6, 22, 'x = ?', { anchor: 'start', muted: true });
    return c.svg('이차함수 그래프');
  };

  // 이차함수 구간 최대·최소: poly {a, b, c}, lo, hi
  R['parabola-interval'] = (s, c) => {
    const f = x => s.poly.a * x * x + s.poly.b * x + s.poly.c;
    const xa = s.lo - 1.5, xb = s.hi + 1.2;
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i <= 60; i++) { const y = f(xa + ((xb - xa) * i) / 60); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    const pad = (ymax - ymin) * 0.12 || 1;
    const M = mapper(xa, xb, ymin - pad, ymax + pad, { l: 20, r: W - 20, t: 18, b: H - 34 });
    c.add(`<rect x="${r1(M.X(s.lo))}" y="14" width="${r1(M.X(s.hi) - M.X(s.lo))}" height="${H - 46}" style="${STYLE.band}"/>`);
    c.line(M.X(s.lo), 14, M.X(s.lo), H - 32, STYLE.dash);
    c.line(M.X(s.hi), 14, M.X(s.hi), H - 32, STYLE.dash);
    c.path(curvePath(f, xa, xb, M), STYLE.curve);
    // 구간 끝값은 지문에 있으므로 그림엔 숫자 없이 '구간'만 표기 (끝값이 정답 숫자와 겹치는 경우 방지)
    c.text((M.X(s.lo) + M.X(s.hi)) / 2, H - 20, '주어진 구간', { muted: true });
    // 구간 안 최대·최소 위치에 점만 찍고 값은 '?'
    const vx = -s.poly.b / (2 * s.poly.a);
    const cands = [s.lo, s.hi].concat(vx > s.lo && vx < s.hi ? [vx] : []);
    const ys = cands.map(f);
    const iMax = ys.indexOf(Math.max(...ys)), iMin = ys.indexOf(Math.min(...ys));
    c.dot(M.X(cands[iMax]), M.Y(ys[iMax]));
    c.dot(M.X(cands[iMin]), M.Y(ys[iMin]));
    c.text(M.X(cands[iMax]) + (cands[iMax] === s.hi ? -8 : 8), M.Y(ys[iMax]) - 4, '최댓값 ?', { anchor: cands[iMax] === s.hi ? 'end' : 'start', bold: true });
    c.text(M.X(cands[iMin]), M.Y(ys[iMin]) + 14, '최솟값 ?', { bold: true });
    return c.svg('이차함수 구간 그래프');
  };

  // 선분의 내분점: A, B (좌표 배열), m, n — P는 '?'
  R['segment-division'] = (s, c) => {
    const [x1, y1] = s.A, [x2, y2] = s.B;
    const px = (s.m * x2 + s.n * x1) / (s.m + s.n), py = (s.m * y2 + s.n * y1) / (s.m + s.n);
    const xs = [x1, x2, 0], ys = [y1, y2, 0];
    const M = mapper(Math.min(...xs) - 1.5, Math.max(...xs) + 1.5, Math.min(...ys) - 1.5, Math.max(...ys) + 1.5, undefined, true);
    axes(c, M.X(0), M.Y(0));
    c.line(M.X(x1), M.Y(y1), M.X(x2), M.Y(y2), STYLE.ink);
    c.dot(M.X(x1), M.Y(y1));
    c.dot(M.X(x2), M.Y(y2));
    c.add(`<circle cx="${r1(M.X(px))}" cy="${r1(M.Y(py))}" r="4.5" style="stroke:var(--ink);stroke-width:2;fill:var(--accent)"/>`);
    // 선분에 수직 방향으로 라벨을 띄운다
    const dx = M.X(x2) - M.X(x1), dy = M.Y(y2) - M.Y(y1), L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L * 14, ny = dx / L * 14;
    c.text(M.X(x1) - nx, M.Y(y1) - ny, 'A', { bold: true });
    c.text(M.X(x2) - nx, M.Y(y2) - ny, 'B', { bold: true });
    c.text(M.X(px) - nx * 1.6, M.Y(py) - ny * 1.6, 'P(?, ?)', { bold: true });
    // 비 m : n 은 숫자 대신 눈금으로 — 선분을 m + n 등분해 짧은 수직 눈금을 긋는다(숫자가 정답과 겹치는 문제 방지)
    const k = s.m + s.n;
    for (let i = 1; i < k; i++) {
      const tx = M.X(x1) + (dx * i) / k, ty = M.Y(y1) + (dy * i) / k;
      c.line(tx - nx * 0.4, ty - ny * 0.4, tx + nx * 0.4, ty + ny * 0.4, STYLE.thin);
    }
    return c.svg('선분의 내분점');
  };

  // 좌표평면 위의 원: center [a, b], r — 중심·반지름 '?'
  R['coord-circle'] = (s, c) => {
    const [a, b] = s.center, r = s.r;
    const M = mapper(Math.min(a - r, 0) - 1, Math.max(a + r, 0) + 1, Math.min(b - r, 0) - 1, Math.max(b + r, 0) + 1, undefined, true);
    axes(c, M.X(0), M.Y(0));
    c.add(`<circle cx="${r1(M.X(a))}" cy="${r1(M.Y(b))}" r="${r1(r * M.sx)}" style="stroke:var(--ink);stroke-width:2;fill:var(--accent);fill-opacity:0.3"/>`);
    c.line(M.X(a), M.Y(b), M.X(a + r), M.Y(b), STYLE.ink);
    c.dot(M.X(a), M.Y(b));
    c.text(M.X(a), M.Y(b) + 14, '(?, ?)', { bold: true });
    c.text(M.X(a + r / 2), M.Y(b) - 10, 'r = ?', { bold: true });
    return c.svg('좌표평면 위의 원');
  };

  // 삼차함수: poly {a3, a1, a0} (x² 항 없음), crit [극대 x, 극소 x] — 극점 위치만 점, 값 '?'
  R.cubic = (s, c) => {
    const f = x => s.poly.a3 * x ** 3 + s.poly.a1 * x + s.poly.a0;
    const span = Math.max(Math.abs(s.crit[0]), Math.abs(s.crit[1])) * 2;
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i <= 60; i++) { const y = f(-span + (2 * span * i) / 60); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0);
    const pad = (ymax - ymin) * 0.08;
    const M = mapper(-span, span, ymin - pad, ymax + pad);
    axes(c, M.X(0), M.Y(0));
    c.path(curvePath(f, -span, span, M), STYLE.curve);
    const [xM, xm] = s.crit;
    c.dot(M.X(xM), M.Y(f(xM)));
    c.dot(M.X(xm), M.Y(f(xm)));
    c.text(M.X(xM), M.Y(f(xM)) - 13, '극대 ?', { bold: true });
    c.text(M.X(xm), M.Y(f(xm)) + 14, '극소 ?', { bold: true });
    return c.svg('삼차함수 그래프');
  };

  function render(spec) {
    if (!spec || !R[spec.type]) return '';
    return R[spec.type](spec, ctx(spec));
  }

  global.HaruFigure = { render, types: Object.keys(R) };
})(typeof window !== 'undefined' ? window : globalThis);
