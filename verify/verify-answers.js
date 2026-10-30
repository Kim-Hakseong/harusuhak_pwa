/**
 * 하루수학 정답 독립 검증기 (verifier-first)
 * 실행: node verify/verify-answers.js [--rounds 50] [--json out.json]
 *
 * 원칙
 * - 입력(문제 지문·입력 변수)만 읽고 정답을 다시 계산한다. generate()가 돌려준 결과값(넓이·해·중심각 등)은 절대 읽지 않는다.
 * - 56개 템플릿 각각에 대해 "정답 보기 1개만 통과하고 나머지 3개는 모두 탈락"해야 PASS.
 * - 이 파일은 problem-bank.js 수정 작업 중 변경 금지(동결). 변경이 필요하면 BLOCKED.md에 사유를 적고 사람 승인 후.
 */
'use strict';
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const ROUNDS = Number((args[args.indexOf('--rounds') + 1]) || 50);
const JSON_OUT = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const BANK = args.includes('--bank') ? args[args.indexOf('--bank') + 1] : path.join(__dirname, '..', 'problem-bank.js');

require(path.resolve(BANK));
const B = global.HaruProblemBank;

// ---------------------------------------------------------------- helpers
const norm = s => String(s).replace(/−/g, '-').replace(/–/g, '-');
function N(s) {
  if (typeof s === 'number') return s;
  const m = norm(s).replace(/,(?=\d{3})/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}
function allNums(s) {
  let t = norm(s).replace(/,(?=\d{3})/g, '').replace(/-\s+(?=\d)/g, '-');
  const out = [];
  const re = /(-?)(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(t))) {
    let sign = m[1];
    if (sign) {
      const prev = t.slice(0, m.index).replace(/\s+$/, '');
      if (/[\d)]$/.test(prev)) sign = '';
    }
    out.push(parseFloat(sign + m[2]));
  }
  return out;
}
const eq = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
const arrEq = (a, b) => a.length === b.length && a.every((v, i) => eq(v, b[i]));
const byNums = expected => opt => arrEq(allNums(opt), expected);
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
const frac = s => { const m = norm(s).match(/(-?\d+)\s*\/\s*(\d+)/); return [Number(m[1]), Number(m[2])]; };
const red = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
const C = (n, r) => { let v = 1; for (let i = 0; i < r; i++) v = v * (n - i) / (i + 1); return Math.round(v); };
const stripSp = s => norm(s).replace(/\s+/g, '');

// 다항식 "2x³ − 3x² + x − 1" → {3:2, 2:-3, 1:1, 0:-1}
function parsePoly(str) {
  let s = norm(str).replace(/^.*?=/, '').replace(/\s+/g, '').replace(/²/g, '^2').replace(/³/g, '^3');
  if (!s) return {};
  if (!/^[+-]/.test(s)) s = '+' + s;
  const terms = s.match(/[+-][^+-]+/g) || [];
  const poly = {};
  for (const t of terms) {
    const m = t.match(/^([+-])(\d*)(?:(x)(?:\^(\d+))?)?$/);
    if (!m) throw new Error('poly parse fail: ' + str + ' @ ' + t);
    const sign = m[1] === '-' ? -1 : 1;
    const coef = m[2] === '' ? 1 : Number(m[2]);
    const pow = m[3] ? (m[4] ? Number(m[4]) : 1) : 0;
    poly[pow] = (poly[pow] || 0) + sign * coef;
  }
  return poly;
}
const evalPoly = (p, x) => Object.entries(p).reduce((acc, [k, c]) => acc + c * Math.pow(x, Number(k)), 0);
const derivPoly = p => { const d = {}; for (const [k, c] of Object.entries(p)) if (Number(k) > 0) d[Number(k) - 1] = c * Number(k); return d; };

// "ax + by = c" (a,b 생략·부호 허용)
function parseLinear2(str) {
  const s = stripSp(str);
  const m = s.match(/^(-?\d*)x([+-]\d*)y=(-?\d+)$/);
  if (!m) throw new Error('linear2 parse fail: ' + str);
  const a = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
  const b = m[2] === '+' ? 1 : m[2] === '-' ? -1 : Number(m[2]);
  return [a, b, Number(m[3])];
}

// ---------------------------------------------------------------- oracles
// 각 oracle(vars, question) → matcher(optionString) → boolean
const ORACLES = {
  'BAS-01': v => {
    const [n1, d1] = frac(v.분수1), [n2, d2] = frac(v.분수2);
    const a = n1 * d2, b = n2 * d1;
    if (a === b) return o => o.trim() === '두 분수의 크기가 같다';
    const bigger = a > b ? v.분수1 : v.분수2;
    const diff = Math.abs(a - b) / (d1 * d2);
    return o => {
      const m = norm(o).match(/^(\d+\/\d+)(?:이|가) (\d+)\/(\d+)만큼 더 크다$/);
      return !!m && m[1] === bigger && eq(Number(m[2]) / Number(m[3]), diff);
    };
  },
  'BAS-02': v => {
    const [a, b] = Object.entries(v).filter(([k]) => k !== '최대공약수').map(([, x]) => N(x));
    const g = gcd(a, b); return byNums([g, 1, a / g, b / g]);
  },
  'BAS-03': v => {
    const [n1, d1] = frac(v.첫째분수), [n2, d2] = frac(v.둘째분수);
    const [n, d] = red(n1 * d2 + n2 * d1, d1 * d2);
    return o => {
      const x = allNums(o);
      if (d === 1) return arrEq(x, [n]);
      if (n < d) return arrEq(x, [n, d]);
      const w = Math.floor(n / d), r = n - w * d;
      return arrEq(x, [n, d]) || arrEq(x, [w, r, d, n, d]) || arrEq(x, [w, r, d]);
    };
  },
  'BAS-04': v => byNums([100 * N(v.비교하는양) / N(v.기준량)]),
  'BAS-05': v => byNums([(N(v.윗변) + N(v.아랫변)) * N(v.높이) / 2]),
  'BAS-06': (v, q) => {
    const [m, n] = norm(v.비).split(':').map(Number);
    const total = N(v.전체구슬);
    const want = /더 적게/.test(q) ? Math.min(m, n) : Math.max(m, n);
    return byNums([total * want / (m + n)]);
  },
  'BAS-07': v => {
    const scores = norm(v.기존점수).split(',').map(Number);
    return byNums([N(v.목표평균) * (scores.length + 1) - scores.reduce((a, b) => a + b, 0)]);
  },
  'BAS-08': v => { const [n, d] = frac(v.한병용량); return byNums([N(v.전체양) / (n / d)]); },
  'BAS-09': v => {
    const t = N(v.전체리본), p = N(v.한명분), q = Math.floor(t / p + 1e-9);
    return byNums([q, Math.round((t - q * p) * 100) / 100]);
  },
  'BAS-10': v => { const r = N(v.반지름), pi = N(v.원주율); return byNums([Math.round(pi * r * r * 100) / 100]); },
  'BAS-11': v => { const a = N(v.가로), b = N(v.세로), c = N(v.높이); return byNums([a * b * c, 2 * (a * b + b * c + c * a)]); },
  'BAS-12': v => byNums([N(v.대각선1) * N(v.대각선2) / 2]),
  'BAS-13': (v, q) => {
    const m = norm(q).match(/1개 만들 때 성냥개비 (\d+)개, 2개 만들 때 (\d+)개, 3개 만들 때 (\d+)개/);
    const a1 = Number(m[1]), a2 = Number(m[2]), a3 = Number(m[3]);
    if (a3 - a2 !== a2 - a1) return () => false; // 지문 자체가 등차가 아님
    const k = a2 - a1, c = a1 - k, n = N(v.도형수);
    return byNums(c === 0 ? [k * n + c, k] : [k * n + c, k, c]);
  },
  'BAS-14': v => { const t = N(v.전교생), p = N(v.축구비율); return byNums([t * p / 100, 360 * p / 100]); },

  'MID-01': (v, q) => {
    const m = stripSp(q).match(/(-?\d*)\(x([+-]\d+)\)=(-?\d*)x([+-]\d+)?/);
    const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
    const b = Number(m[2]);
    const c = m[3] === '' ? 1 : m[3] === '-' ? -1 : Number(m[3]);
    const d = m[4] ? Number(m[4]) : 0;
    return byNums([(d - a * b) / (a - c)]);
  },
  'MID-02': v => { const n = N(v.자연수); let c = 0; for (let i = 1; i <= n; i++) if (n % i === 0) c++; return byNums([c]); },
  'MID-03': v => { const v1 = N(v.갈때속력), v2 = N(v.올때속력), T = N(v.총시간); return byNums([T / (1 / v1 + 1 / v2)]); },
  'MID-04': (v, q) => {
    const m = stripSp(q).match(/y=(-?\d*)x([+-]\d+)/);
    const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
    const b = Number(m[2]);
    return byNums([-b / a + b]);
  },
  'MID-05': v => {
    const [a1, b1, c1] = parseLinear2(v.식1), [a2, b2, c2] = parseLinear2(v.식2);
    const det = a1 * b2 - a2 * b1;
    const x = (c1 * b2 - c2 * b1) / det, y = (a1 * c2 - a2 * c1) / det;
    return byNums([x, y, x + y]);
  },
  'MID-06': (v, q) => {
    if (/직각을 낀 두 변/.test(q)) { const a = N(v.밑변), b = N(v.높이); return byNums([Math.sqrt(a * a + b * b)]); }
    const c = N(v.빗변), a = N(v.한변); return byNums([Math.sqrt(c * c - a * a)]);
  },
  'MID-07': (v, q) => {
    const m = stripSp(q).match(/\(x([+-]\d+)\)\^?2?²?([+-]\d+)?/) || stripSp(q).match(/\(x([+-]\d+)\)²([+-]\d+)?/);
    const h = -Number(m[1]), k = m[2] ? Number(m[2]) : 0;
    return byNums([h, k, h]);
  },
  'MID-08': (v, q) => {
    const expr = norm(q).match(/\[(.+)\]/)[1].replace(/²/g, '**2').replace(/×/g, '*').replace(/÷/g, '/');
    // eslint-disable-next-line no-new-func
    return byNums([Function('return (' + expr + ')')()]);
  },
  'MID-09': (v, q) => {
    const m = stripSp(q).match(/(-?\d*)x([+-]\d+)?([<>≤≥])(-?\d*)x([+-]\d+)?/);
    const a = m[1] === '' ? 1 : Number(m[1]), b = m[2] ? Number(m[2]) : 0, op = m[3];
    const c = m[4] === '' ? 1 : Number(m[4]), d = m[5] ? Number(m[5]) : 0;
    const k = a - c; if (k === 0) return () => false;
    let bound = (d - b) / k;
    const flip = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
    const op2 = k < 0 ? flip[op] : op;
    return o => stripSp(o) === `x${op2}${bound}`;
  },
  'MID-10': (v, q) => {
    const m = stripSp(q).match(/\((\d+)x\^(\d+)y\^(\d+)\)\^(\d+)×\(x\^(\d+)y\)/);
    const coef = Math.pow(Number(m[1]), Number(m[4]));
    const ex = Number(m[2]) * Number(m[4]) + Number(m[5]);
    const ey = Number(m[3]) * Number(m[4]) + 1;
    return byNums([coef, ex, ey, ex + ey]);
  },
  'MID-11': (v, q) => {
    const m = stripSp(q).match(/x²([+-]\d*)?x([+-]\d+)/);
    const b = m[1] ? (m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1])) : 1;
    const c = Number(m[2]);
    return o => {
      const mm = stripSp(o).match(/^\(x([+-]\d+)\)\(x([+-]\d+)\)$/);
      if (!mm) return false;
      const r = Number(mm[1]), s = Number(mm[2]);
      return r + s === b && r * s === c;
    };
  },
  'MID-12': v => { const n = N(v.무리수); const a = Math.floor(Math.sqrt(n)); if (a * a === n) return () => false; return byNums([a, n, a]); },
  'MID-13': v => { const c = N(v.빗변), ang = N(v.예각); return byNums([Math.round(c * Math.sin(ang * Math.PI / 180) * 100) / 100]); },
  'MID-14': v => {
    const s = N(v.목표합); let cnt = 0;
    for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) if (i + j === s) cnt++;
    const g = gcd(cnt, 36);
    return o => { const n = allNums(o); return arrEq(n, [cnt, 36, cnt]) || arrEq(n, [cnt / g, 36 / g, cnt]); };
  },

  'HIG-01': v => { const p = parsePoly(v.다항식); const r = -Number(stripSp(v.나누는식).match(/x([+-]\d+)/)[1]); return byNums([evalPoly(p, r)]); },
  'HIG-02': (v, q) => {
    const m = stripSp(q).match(/x²([+-]\d*)x\+k([+-]\d+)?=0/);
    const b = m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
    const s = m[2] ? Number(m[2]) : 0;
    const bound = b * b / 4 - s;  // k < bound
    const maxInt = Number.isInteger(bound) ? bound - 1 : Math.floor(bound);
    return byNums([maxInt, bound]);
  },
  'HIG-03': (v, q) => {
    const m = stripSp(q).match(/x²([+-]\d*)x([+-]\d+)=0/);
    const b = m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1]), c = Number(m[2]);
    const sum = -b, prod = c;
    return byNums([sum * sum - 2 * prod]);
  },
  'HIG-04': (v, q) => {
    const qs = norm(q);
    const iv = qs.match(/(-?\d+)\s*≤\s*x\s*≤\s*(-?\d+)/);
    const lo = Number(iv[1]), hi = Number(iv[2]);
    const p = parsePoly(qs.match(/f\(x\)\s*=\s*([^의]+?)\s+의/)[1]);
    const xs = [lo, hi];
    const a = p[2] || 0, b = p[1] || 0;
    const vx = -b / (2 * a); if (vx > lo && vx < hi) xs.push(vx);
    const vals = xs.map(x => evalPoly(p, x));
    const M = Math.max(...vals), mn = Math.min(...vals);
    return byNums([M, mn, M + mn]);
  },
  'HIG-05': (v, q) => {
    const m = norm(q).match(/1학년 학생 (\d+)명과 2학년 학생 (\d+)명.*?1학년 대표 (\d+)명과 2학년 대표 (\d+)명/);
    return byNums([C(Number(m[1]), Number(m[3])) * C(Number(m[2]), Number(m[4]))]);
  },
  'HIG-06': (v, q) => {
    const m = norm(q).match(/a_(\d+) = (-?\d+), 제\d+항 a_(\d+) = (-?\d+) 일 때, 제(\d+)항/);
    const p = Number(m[1]), ap = Number(m[2]), qq = Number(m[3]), aq = Number(m[4]), t = Number(m[5]);
    const d = (aq - ap) / (qq - p), a1 = ap - (p - 1) * d;
    return byNums([a1 + (t - 1) * d]);
  },
  'HIG-07': v => { const p = parsePoly(v.함수); return byNums([evalPoly(derivPoly(p), N(v.접점x좌표))]); },
  'HIG-08': (v, q) => {
    const m = stripSp(q).match(/\((-?\d+)([+-]\d*)i\)÷\((-?\d+)([+-]\d*)i\)/);
    const a = Number(m[1]), b = m[2] === '+' ? 1 : m[2] === '-' ? -1 : Number(m[2]);
    const c = Number(m[3]), d = m[4] === '+' ? 1 : m[4] === '-' ? -1 : Number(m[4]);
    const den = c * c + d * d;
    const re = (a * c + b * d) / den, im = (b * c - a * d) / den;
    return o => {
      if (eq(im, 0) && /^-?\d+(?:\.\d+)?$/.test(stripSp(o))) return eq(Number(stripSp(o)), re);
      const mm = stripSp(o).match(/^(-?\d+(?:\.\d+)?)([+-])(\d*(?:\.\d+)?)i$/);
      if (!mm) return false;
      const oi = (mm[2] === '-' ? -1 : 1) * (mm[3] === '' ? 1 : Number(mm[3]));
      return eq(Number(mm[1]), re) && eq(oi, im);
    };
  },
  'HIG-09': (v, q) => {
    const m = norm(q).match(/A\((-?\d+), (-?\d+)\), B\((-?\d+), (-?\d+)\)를 (\d+) : (\d+) ?으?로 내분/);
    const [x1, y1, x2, y2, mm, nn] = m.slice(1).map(Number);
    return byNums([(mm * x2 + nn * x1) / (mm + nn), (mm * y2 + nn * y1) / (mm + nn)]);
  },
  'HIG-10': v => {
    const m = stripSp(v.방정식).match(/\(x([+-]\d+)\)²\+\(y([+-]\d+)\)²=(\d+)/);
    return byNums([-Number(m[1]), -Number(m[2]), Math.sqrt(Number(m[3]))]);
  },
  'HIG-11': v => {
    const pred = s => {
      const t = stripSp(s);
      let m;
      if ((m = t.match(/^x([<>])(-?\d+)$/))) return x => (m[1] === '>' ? x > Number(m[2]) : x < Number(m[2]));
      if ((m = t.match(/^x=(-?\d+)$/))) return x => eq(x, Number(m[1]));
      if ((m = t.match(/^x²([+-]\d+)=0$/))) return x => eq(x * x + Number(m[1]), 0);
      if ((m = t.match(/^\|x\|=(\d+)$/))) return x => eq(Math.abs(x), Number(m[1]));
      if (t === 'xy=0') return (x, y) => eq(x * y, 0);
      if (t === 'x=0,y=0' || t === 'x=0이고y=0') return (x, y) => eq(x, 0) && eq(y, 0);
      if ((m = t.match(/^x²\+y²=0$/))) return (x, y) => eq(x * x + y * y, 0);
      if ((m = t.match(/^y=(-?\d+)$/))) return (x, y) => eq(y, Number(m[1]));
      return null;
    };
    const P = pred(v.조건p), Q = pred(v.조건q);
    if (!P || !Q) return { unsupported: `조건 형식 미지원: ${v.조건p} / ${v.조건q}` };
    const grid = []; for (let x = -6; x <= 6; x += 0.5) for (let y = -6; y <= 6; y += 0.5) grid.push([x, y]);
    const pq = grid.every(([x, y]) => !P(x, y) || Q(x, y)), qp = grid.every(([x, y]) => !Q(x, y) || P(x, y));
    const ans = pq && qp ? '필요충분조건이다' : pq ? '충분조건이지만 필요조건은 아니다' : qp ? '필요조건이지만 충분조건은 아니다' : '필요조건도 충분조건도 아니다';
    return o => o.trim() === ans;
  },
  'HIG-12': v => byNums([Math.round(Math.log(N(v.진수1) / N(v.진수2)) / Math.log(N(v.밑)) * 1e6) / 1e6]),
  'HIG-13': v => { const a = N(v.첫째항a), r = N(v.공비r), n = N(v.항수n); return byNums([a * (Math.pow(r, n) - 1) / (r - 1)]); },
  'HIG-14': v => {
    const p = parsePoly(v.함수); const d = derivPoly(p);
    const A = d[2] || 0, Bc = d[1] || 0, Cc = d[0] || 0;
    const disc = Bc * Bc - 4 * A * Cc; if (disc <= 0) return () => false;
    const r1 = (-Bc - Math.sqrt(disc)) / (2 * A), r2 = (-Bc + Math.sqrt(disc)) / (2 * A);
    const [xl, xr] = r1 < r2 ? [r1, r2] : [r2, r1];
    const leading = p[3] || 0;
    const [xmax, xmin] = leading > 0 ? [xl, xr] : [xr, xl];
    return byNums([evalPoly(p, xmax), xmax, evalPoly(p, xmin), xmin]);
  },

  'LIF-01': v => {
    const P = N(v.정가), d1 = N(v['1차할인']) / 100, d2 = N(v['2차추가할인']) / 100;
    const fin = P * (1 - d1) * (1 - d2);
    return byNums([fin, Math.round((1 - (1 - d1) * (1 - d2)) * 100)]);
  },
  'LIF-02': v => {
    const P = N(v.원금) * 10000, r = N(v.연이율) / 100;
    const ci = P * (Math.pow(1 + r, 2) - 1), si = P * r * 2;
    return byNums([Math.round(ci), Math.round(ci - si)]);
  },
  'LIF-03': v => {
    const a = allNums(v.A상품), b = allNums(v.B상품);
    const ua = a[1] / a[0] * 100, ub = b[1] / b[0] * 100;
    if (eq(ua, ub)) return o => /같다/.test(o) && allNums(o).includes(ua);
    const cheaper = ua < ub ? 'A' : 'B', diff = Math.abs(ua - ub);
    return o => { const m = norm(o).match(/^([AB]) 상품이 100g당 ([\d,]+)원 더 저렴하다$/); return !!m && m[1] === cheaper && eq(N(m[2]), diff); };
  },
  'LIF-04': v => {
    const m = norm(v.처음소금물).match(/(\d+)g \((\d+)%\)/);
    const w = Number(m[1]), c0 = Number(m[2]), c1 = N(v.목표농도);
    return byNums([w * c0 / c1 - w]);
  },
  'LIF-05': v => { const L = N(v.총주행거리) / N(v.연비); return byNums([L * N(v.리터당가격), L]); },
  'LIF-06': v => {
    const base = N(v.일반기본료), per = N(v.회당요금), pass = N(v.정기권);
    const x = (pass - base) / per; // 정기권이 더 저렴: base+per*n > pass → n > x
    const n = Number.isInteger(x) ? x + 1 : Math.ceil(x);
    return byNums([n]);
  },
  'LIF-07': v => { const a = N(v.작년비율), b = N(v.올해비율); return byNums([b - a, Math.round((b - a) / a * 1000) / 10]); },
  'LIF-08': (v, q) => {
    const K = N(v.기준율), u = N(v.우대율) / 100, D = N(v.환전달러);
    const spread = Number(norm(q).match(/스프레드\)가 ([\d,]+)원/)[1].replace(/,/g, ''));
    return byNums([(K + spread * (1 - u)) * D, spread * u * D]);
  },
  'LIF-09': v => {
    const mbps = N(v.통신속도), gb = N(v.파일용량), MBps = mbps / 8, sec = gb * 1000 / MBps;
    const mn = Math.floor(sec / 60), s = sec - mn * 60;
    let exp;
    const r2 = x => Math.round(x * 100) / 100;
    if (sec < 60) exp = [r2(sec), MBps]; else if (eq(s, 0)) exp = [mn, MBps]; else exp = [mn, r2(s), MBps];
    const r1 = x => Math.round(x * 10) / 10;
    return o => { const n = allNums(o).map(r1); return arrEq(n, exp.map(r1)); };
  },
  'LIF-10': v => { const t = N(v.결제총액), r = N(v.부가세율) / 100; const sup = t / (1 + r); return byNums([Math.round(sup), Math.round(t - sup)]); },
  'LIF-11': v => {
    const va = v.충전기A.match(/(\d+)V-(\d+)A/).slice(1).map(Number), vb = v.충전기B.match(/(\d+)V-(\d+)A/).slice(1).map(Number);
    const WA = va[0] * va[1], WB = vb[0] * vb[1], ratio = Math.round(WB / WA * 10) / 10;
    return o => /^충전기 B/.test(o) && arrEq(allNums(o), [WB, WA, ratio]);
  },
  'LIF-12': v => {
    const h = N(norm(v.키).match(/\(([\d.]+)m\)/)[1]), w = N(v.체중);
    const bmi = Math.round(w / (h * h) * 10) / 10;
    const cat = bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '과체중' : '비만';
    return o => allNums(o)[0] !== undefined && eq(allNums(o)[0], bmi) && o.includes(cat);
  },
  'LIF-13': (v, q) => {
    const n = N(v.명목금리) / 100, i = N(v.물가상승률) / 100;
    const principal = N(norm(q).match(/([\d,]+)만 원을 가입/)[1].replace(/,/g, '')); // 만 원 단위
    const real = Math.round((n - i) * 100);
    const loss = Math.round(principal - principal * (1 + n) / (1 + i));
    return byNums([real, loss]);
  },
  'LIF-14': (v, q) => {
    const P = N(v.상품가격), pct = Number(norm(q).match(/즉시 (\d+)% 할인/)[1]) / 100, interest = N(v.할부예치이자);
    const save = P * pct;
    if (save > interest) return o => /^일시불/.test(o) && arrEq(allNums(o), [save, interest, save - interest]);
    if (save < interest) return o => /^무이자 할부/.test(o) && allNums(o).includes(interest);
    return o => /동일/.test(o);
  }
};

// ---------------------------------------------------------------- lint (형식 결함)
const JOSA_FINAL = { 0: 1, 1: 1, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1, 9: 0 }; // 숫자 읽기 받침 유무
function hasFinal(ch) {
  if (/\d/.test(ch)) return !!JOSA_FINAL[ch];
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[a-zA-Z]/.test(ch)) return /[lmnr]/i.test(ch) ? true : false; // 대략
  return null;
}
function lint(text) {
  const t = String(text);
  const issues = [];
  if (/\d\.\d{4,}/.test(t)) issues.push('부동소수 잔여물(' + t.match(/\d\.\d{4,}/)[0] + ')');
  if (/\+\s*-\d/.test(norm(t))) issues.push('"+ -" 부호 잔여물');
  if (/(?:^|[^\d.])1i\b/.test(t)) issues.push('"1i" 표기(→ i)');
  if (/\b0i\b/.test(t)) issues.push('"0i" 표기(허수부 0)');
  if (/\(\s*\)/.test(t)) issues.push('빈 괄호 "( )"');
  if (/\b(\d+) : \1\b/.test(norm(t)) && /내분/.test(t)) issues.push('내분비 m:m(중점) 퇴화');
  const gb = norm(t).match(/(\d+) GB\((\d{1,3}(?:,\d{3})*) MB\)/);
  if (gb && Number(gb[1]) * 1000 !== Number(gb[2].replace(/,/g, ''))) issues.push('GB↔MB 환산 불일치 지문');
  // 조사: 숫자/한글 뒤 이/가·을/를·은/는·과/와
  const UNITS = ['권','개','명','원','번','점','장','병','루','대','컵','통','쌍','%'];
  const re = /([0-9가-힣])(이|가|을|를|은|는|과|와) /g; let m;
  while ((m = re.exec(t))) {
    if (!/\d/.test(m[1]) && !UNITS.includes(m[1])) continue;
    if (/[가-힣]{2,}$/.test(t.slice(0, m.index + 1)) && !UNITS.includes(m[1])) continue;
    const f = hasFinal(m[1]); if (f === null) continue;
    const need = { 이: true, 가: false, 을: true, 를: false, 은: true, 는: false, 과: true, 와: false }[m[2]];
    if (f !== need) issues.push(`조사 오류 "${m[1]}${m[2]}"`);
  }
  // 조사 (으)로 / 을(를) 류 병기도 결함
  if (/\(으\)로|을\(를\)|이\(가\)/.test(t)) issues.push('조사 병기 "(으)로/을(를)" 미해결');
  return issues;
}

// ---------------------------------------------------------------- run
const templates = B.getAllTemplates();
const report = { rounds: ROUNDS, templates: [], totals: { pass: 0, fail: 0, ambiguous: 0, unsupported: 0, lintQuestion: 0, lintOptions: 0 } };
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);

for (const tpl of templates) {
  const oracle = ORACLES[tpl.id];
  const row = { id: tpl.id, unit: tpl.unit, pass: 0, fail: 0, ambiguous: 0, unsupported: 0, lint: {}, examples: [] };
  for (let v = 0; v < ROUNDS; v++) {
    const dateKey = `2026-${String(1 + (v % 12)).padStart(2, '0')}-${String(1 + ((v * 7) % 28)).padStart(2, '0')}`;
    const p = B.generateProblem({ templateId: tpl.id, dateKey, variant: v });
    // lint
    for (const iss of lint(p.question)) { row.lint[iss] = (row.lint[iss] || 0) + 1; report.totals.lintQuestion++; }
    for (const o of p.options) for (const iss of lint(o)) { row.lint[iss] = (row.lint[iss] || 0) + 1; report.totals.lintOptions++; }
    // near-duplicate options (괄호 설명 제거 후)
    const core = p.options.map(o => stripSp(o.replace(/\([^()]*(오산|착오|오인)[^()]*\)/g, '').replace(/약\s*/g, '')));
    if (new Set(core).size < 4) { row.lint['보기 실질 중복(설명 괄호 제외)'] = (row.lint['보기 실질 중복(설명 괄호 제외)'] || 0) + 1; }
    if (!oracle) { row.unsupported++; continue; }
    let matcher;
    try { matcher = oracle(p.variablesInfo || {}, p.question); } catch (e) { row.unsupported++; row.examples.length < 3 && row.examples.push({ dateKey, variant: v, error: 'oracle parse: ' + e.message, question: p.question }); continue; }
    if (matcher && matcher.unsupported) { row.unsupported++; row.examples.length < 3 && row.examples.push({ dateKey, variant: v, error: matcher.unsupported }); continue; }
    const hits = p.options.map((o, i) => (matcher(o) ? i : -1)).filter(i => i >= 0);
    const SEVERE = /부동소수|1i|0i|\+ -|빈 괄호/;
    const ansIssues = lint(p.options[p.answerIndex]).filter(x => SEVERE.test(x));
    const brokenOpt = p.options.some(o => /\(\s*\)/.test(o));
    if (ansIssues.length || brokenOpt) {
      row.fail++; row.examples.length < 3 && row.examples.push({ dateKey, variant: v, kind: 'format', issues: ansIssues.concat(brokenOpt ? ['보기에 빈 괄호'] : []), options: p.options, answerIndex: p.answerIndex });
    } else if (hits.length === 1 && hits[0] === p.answerIndex) row.pass++;
    else if (hits.length > 1 && hits.includes(p.answerIndex)) { row.ambiguous++; row.examples.length < 3 && row.examples.push({ dateKey, variant: v, kind: 'ambiguous', question: p.question, options: p.options, answerIndex: p.answerIndex, hits }); }
    else { row.fail++; row.examples.length < 3 && row.examples.push({ dateKey, variant: v, kind: 'fail', question: p.question, options: p.options, answerIndex: p.answerIndex, oracleHits: hits, vars: p.variablesInfo }); }
  }
  report.totals.pass += row.pass; report.totals.fail += row.fail; report.totals.ambiguous += row.ambiguous; report.totals.unsupported += row.unsupported;
  report.templates.push(row);
  const status = row.fail ? 'FAIL' : row.ambiguous ? 'AMBIG' : row.unsupported ? 'N/A ' : 'PASS';
  const lintStr = Object.entries(row.lint).map(([k, n]) => `${k}×${n}`).join(', ');
  console.log(`${status}  ${pad(tpl.id, 7)} pass ${pad(row.pass, 3)} fail ${pad(row.fail, 3)} ambig ${pad(row.ambiguous, 3)} n/a ${pad(row.unsupported, 3)} ${lintStr ? ' | lint: ' + lintStr : ''}`);
}

console.log('\n=== 합계 ===');
console.log(report.totals);
if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2)); console.log('JSON →', JSON_OUT); }
process.exit(report.totals.fail || report.totals.ambiguous ? 1 : 0);
