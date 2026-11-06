/**
 * 고등 수학 HIG-15 ~ HIG-35 정답 oracle (verifier-first)
 * - verify/verify-tiers.js 가 동결 검증기 helpers(H)를 넘겨 부른다.
 * - 각 oracle 은 문제 지문(q)과 variablesInfo(v)의 '입력값'만 읽고 정답을 다시 계산한다.
 *   generate()가 만든 정답·중간 결과는 읽지 않는다.
 * - matcher(option) 은 정답 보기에만 true.
 */
'use strict';

module.exports = H => {
  const { norm, allNums, eq, arrEq, byNums, stripSp } = H;

  // ------------------------------------------------------------ 공통 도구
  const SUP = { '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5' };
  const sup = s => String(s).replace(/[²³⁴⁵]/g, c => SUP[c]);

  // 다항식 문자열 → {차수: 계수}. 변수 문자는 x·t·k 등 한 글자. "f(x) =", "x =" 같은 좌변은 버린다.
  function poly(str, v = 'x') {
    let s = sup(norm(str)).replace(/\s+/g, '');
    if (s.includes('=')) s = s.slice(s.lastIndexOf('=') + 1);
    s = s.split(v).join('x');
    if (!/^[+-]/.test(s)) s = '+' + s;
    const terms = s.match(/[+-][^+-]+/g) || [];
    const p = {};
    for (const t of terms) {
      const m = t.match(/^([+-])(\d*)(?:(x)(?:\^(\d+))?)?$/);
      if (!m || (m[2] === '' && !m[3])) throw new Error('poly parse fail: ' + str + ' @ ' + t);
      const coef = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
      const pow = m[3] ? (m[4] ? Number(m[4]) : 1) : 0;
      p[pow] = (p[pow] || 0) + coef;
    }
    return p;
  }
  const deg = p => Math.max(0, ...Object.keys(p).filter(k => p[k] !== 0).map(Number));
  const at = (p, x) => Object.entries(p).reduce((a, [k, c]) => a + c * Math.pow(x, Number(k)), 0);
  const der = p => { const d = {}; for (const [k, c] of Object.entries(p)) if (Number(k) > 0) d[k - 1] = c * k; return d; };
  const mul = (a, b) => { const r = {}; for (const [i, x] of Object.entries(a)) for (const [j, y] of Object.entries(b)) { const k = Number(i) + Number(j); r[k] = (r[k] || 0) + x * y; } return r; };
  const polyEq = (a, b) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); return [...ks].every(k => eq(a[k] || 0, b[k] || 0)); };
  // (x − c) 로 나눈 몫 (나머지 0 가정)
  function divLinear(p, c) {
    const n = deg(p); const q = {}; let carry = 0;
    for (let k = n; k >= 1; k--) { carry = (p[k] || 0) + carry * c; q[k - 1] = carry; }
    return q;
  }

  // 실근(중근은 한 번) — 도함수의 근으로 구간을 나눠 이분법
  function realRoots(p) {
    const n = deg(p);
    if (n === 0) return [];
    if (n === 1) return [-(p[0] || 0) / p[1]];
    const lead = p[n];
    const bound = 1 + Math.max(...Object.keys(p).map(k => Math.abs((p[k] || 0) / lead)));
    const crit = realRoots(der(p)).sort((a, b) => a - b);
    const pts = [-bound, ...crit, bound];
    const roots = [];
    for (const c of crit) if (Math.abs(at(p, c)) < 1e-9) roots.push(c);
    for (let i = 0; i + 1 < pts.length; i++) {
      let lo = pts[i], hi = pts[i + 1];
      let flo = at(p, lo), fhi = at(p, hi);
      if (Math.abs(flo) < 1e-9 || Math.abs(fhi) < 1e-9 || flo * fhi > 0) continue;
      for (let it = 0; it < 200; it++) { const mid = (lo + hi) / 2, fm = at(p, mid); if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; } }
      roots.push((lo + hi) / 2);
    }
    return roots.sort((a, b) => a - b).filter((r, i, arr) => i === 0 || Math.abs(r - arr[i - 1]) > 1e-7);
  }

  // 보기 하나의 수 값: 정수·소수·분수 p/q·근호 k√m·k√m/n (단위 글자는 무시)
  function val(o) {
    const s = stripSp(o).replace(/[가-힣]+$/g, '');
    const m = s.match(/^(-)?(\d+(?:\.\d+)?)?(?:√(\d+))?(?:\/(\d+))?$/);
    if (!m || (m[2] === undefined && m[3] === undefined)) return NaN;
    let x = m[2] !== undefined ? Number(m[2]) : 1;
    if (m[3] !== undefined) x *= Math.sqrt(Number(m[3]));
    if (m[4] !== undefined) x /= Number(m[4]);
    return m[1] ? -x : x;
  }
  const byVal = x => o => { const y = val(o); return !Number.isNaN(y) && eq(y, x); };

  // 부등식 "좌변 op 우변" (각 변은 x 의 다항식) → 술어
  function ineq(str) {
    const s = norm(str);
    const m = s.match(/^(.+?)\s*(<|>|≤|≥)\s*(.+)$/);
    if (!m) throw new Error('ineq parse fail: ' + str);
    const L = poly(m[1]), R = poly(m[3]);
    const op = m[2];
    return x => { const d = at(L, x) - at(R, x); return op === '<' ? d < -1e-12 : op === '>' ? d > 1e-12 : op === '≤' ? d <= 1e-12 : d >= -1e-12; };
  }
  const countInt = pred => { let c = 0; for (let x = -1000; x <= 1000; x++) if (pred(x)) c++; return c; };

  // 직선 ax + by + c = 0 → [a, b, c]
  function line(str) {
    const s = stripSp(str);
    const m = s.match(/^(-?\d*)x([+-]\d*)y([+-]\d+)?=0$/);
    if (!m) throw new Error('line parse fail: ' + str);
    const c1 = t => (t === '' || t === '+' ? 1 : t === '-' ? -1 : Number(t));
    return [c1(m[1]), c1(m[2]), m[3] ? Number(m[3]) : 0];
  }
  // 원 → { p, q, R(=r²) }
  function circle(str) {
    const s = stripSp(str);
    let m = s.match(/^x²\+y²=(\d+)$/);
    if (m) return { p: 0, q: 0, R: Number(m[1]) };
    m = s.match(/^\(x([+-]\d+)\)²\+\(y([+-]\d+)\)²=(\d+)$/);
    if (!m) throw new Error('circle parse fail: ' + str);
    return { p: -Number(m[1]), q: -Number(m[2]), R: Number(m[3]) };
  }

  // 순열 전수 조사
  function perms(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const out = [];
    arr.forEach((x, i) => { for (const r of perms(arr.slice(0, i).concat(arr.slice(i + 1)))) out.push([x, ...r]); });
    return out;
  }

  // 2×2 행렬
  function mat(str) {
    const rows = norm(str).replace(/[()]/g, '').split(';').map(r => r.trim().split(/\s+/).map(Number));
    if (rows.length !== 2 || rows.some(r => r.length !== 2 || r.some(Number.isNaN))) throw new Error('matrix parse fail: ' + str);
    return rows;
  }
  const mMul = (X, Y) => [[X[0][0] * Y[0][0] + X[0][1] * Y[1][0], X[0][0] * Y[0][1] + X[0][1] * Y[1][1]], [X[1][0] * Y[0][0] + X[1][1] * Y[1][0], X[1][0] * Y[0][1] + X[1][1] * Y[1][1]]];
  const mAdd = (X, Y, k) => X.map((r, i) => r.map((x, j) => x + k * Y[i][j]));

  const fracVal = s => { const m = norm(s).trim().match(/^(-?\d+)(?:\/(\d+))?$/); if (!m) throw new Error('frac parse fail: ' + s); return Number(m[1]) / (m[2] ? Number(m[2]) : 1); };

  return {
    // ---------------------------------------------------------- HIG-15 다항식의 곱셈: 특정 항의 계수
    'HIG-15': v => {
      const A = poly(v.A), B = poly(v.B);
      const k = v.구하는항 === '상수항' ? 0 : v.구하는항 === 'x' ? 1 : Number(sup(v.구하는항).replace('x^', ''));
      return byNums([mul(A, B)[k] || 0]);
    },

    // ---------------------------------------------------------- HIG-16 인수분해: 보기의 곱을 전개해 원식과 비교
    'HIG-16': v => {
      const P = poly(v.다항식);
      return o => {
        let s = sup(stripSp(o));
        let prod = { 0: 1 };
        const lead = s.match(/^-?\d+/);
        if (lead) { prod = { 0: Number(lead[0]) }; s = s.slice(lead[0].length); }
        if (!s) return false;
        while (s) {
          let f, rest;
          if (s[0] === 'x') { f = { 1: 1 }; rest = s.slice(1); }
          else if (s[0] === '(') { const j = s.indexOf(')'); if (j < 0) return false; try { f = poly(s.slice(1, j)); } catch (e) { return false; } rest = s.slice(j + 1); }
          else return false;
          const pw = rest.match(/^\^(\d+)/);
          let times = 1;
          if (pw) { times = Number(pw[1]); rest = rest.slice(pw[0].length); }
          for (let i = 0; i < times; i++) prod = mul(prod, f);
          s = rest;
        }
        return polyEq(prod, P);
      };
    },

    // ---------------------------------------------------------- HIG-17 삼차·사차방정식: 모든 실근의 합/곱
    'HIG-17': v => {
      const P = poly(v.방정식.replace(/=\s*0\s*$/, ''));
      const rs = realRoots(P);
      const x = v.구하는값 === '곱' ? rs.reduce((a, b) => a * b, 1) : rs.reduce((a, b) => a + b, 0);
      return byNums([Math.round(x * 1e6) / 1e6]);
    },

    // ---------------------------------------------------------- HIG-18 연립일차부등식: 정수해 개수
    'HIG-18': v => {
      const ps = [v.부등식1, v.부등식2].filter(Boolean).map(ineq);
      return byNums([countInt(x => ps.every(f => f(x)))]);
    },

    // ---------------------------------------------------------- HIG-19 이차부등식(연립 포함): 정수해 개수
    'HIG-19': v => {
      const ps = [v.부등식1, v.부등식2].filter(Boolean).map(ineq);
      const n = countInt(x => ps.every(f => f(x)));
      if (n > 1500) return { unsupported: '해가 유계가 아님' };
      return byNums([n]);
    },

    // ---------------------------------------------------------- HIG-20 순열: 전수 조사
    'HIG-20': (v, q) => {
      const t = norm(q);
      let m = t.match(/서로 다른 (\d+)명의 학생 중에서 (.+?)(을|를) 뽑는 경우의 수/);
      if (m) {
        const n = Number(m[1]), r = (m[2].match(/1명/g) || []).length;
        // 자리마다 남은 사람 중 한 명씩: 전수 조사(n ≤ 9, r ≤ 3)
        let cnt = 0;
        const rec = (used, depth) => { if (depth === r) { cnt++; return; } for (let i = 0; i < n; i++) if (!used.has(i)) { used.add(i); rec(used, depth + 1); used.delete(i); } };
        rec(new Set(), 0);
        return byNums([cnt]);
      }
      m = t.match(/(\S+) (\d+)명과 (\S+) (\d+)명이 일렬로 설 때, (.+?) 경우의 수/);
      if (!m) return { unsupported: '지문 형식' };
      const g1 = m[1], a = Number(m[2]), g2 = m[3], b = Number(m[4]), cond = m[5];
      const items = [...Array(a).fill(g1).map((g, i) => g + i), ...Array(b).fill(g2).map((g, i) => g + i)];
      const isG2 = s => s.startsWith(g2) && /\d+$/.test(s) && s.slice(0, -String(s.match(/\d+$/)[0]).length) === g2;
      let test;
      if (cond.includes(`${g2}끼리 모두 이웃`)) test = p => { const idx = p.map((s, i) => (isG2(s) ? i : -1)).filter(i => i >= 0); return idx[idx.length - 1] - idx[0] === b - 1; };
      else if (cond.includes(`${g2}끼리는 서로 이웃하지 않`)) test = p => p.every((s, i) => i === 0 || !(isG2(s) && isG2(p[i - 1])));
      else if ((m = cond.match(/양 끝에 모두 (\S+?)(이|가) 서도록/))) { const end = m[1] === g2 ? isG2 : s => !isG2(s); test = p => end(p[0]) && end(p[p.length - 1]); }
      else return { unsupported: '조건 형식: ' + cond };
      return byNums([perms(items).filter(test).length]);
    },

    // ---------------------------------------------------------- HIG-21 행렬의 연산
    'HIG-21': (v, q) => {
      const M = { A: mat(v.A), B: mat(v.B) };
      const t = norm(q);
      const m = t.match(/에 대하여 행렬 (.+?)의 (모든 성분의 합|\((\d), (\d)\) 성분)/);
      if (!m) return { unsupported: '지문 형식' };
      const expr = stripSp(m[1]).replace(/²/g, '^');
      let total = [[0, 0], [0, 0]];
      const terms = expr.match(/[+-]?[^+-]+/g);
      for (const term of terms) {
        const tm = term.match(/^([+-]?)(\d*)([AB^]+)$/);
        if (!tm) return { unsupported: '식 형식: ' + term };
        const k = (tm[1] === '-' ? -1 : 1) * (tm[2] === '' ? 1 : Number(tm[2]));
        let prod = null, last = null;
        for (const ch of tm[3]) {
          let f;
          if (ch === '^') { f = M[last]; } else { f = M[ch]; last = ch; }
          prod = prod ? mMul(prod, f) : f;
        }
        total = mAdd(total, prod, k);
      }
      const ans = m[3] ? total[Number(m[3]) - 1][Number(m[4]) - 1] : total[0][0] + total[0][1] + total[1][0] + total[1][1];
      return byNums([ans]);
    },

    // ---------------------------------------------------------- HIG-22 점과 직선 사이의 거리
    'HIG-22': (v, q) => {
      if (v.직선2) {
        const [a1, b1, c1] = line(v.직선1), [a2, b2, c2] = line(v.직선2);
        const k = a2 / a1;
        if (!eq(b2 / b1, k)) return { unsupported: '평행 아님' };
        return byVal(Math.abs(c1 - c2 / k) / Math.hypot(a1, b1));
      }
      const [a, b, c] = line(v.직선);
      const pt = /원점/.test(q) ? [0, 0] : allNums(v.점);
      return byVal(Math.abs(a * pt[0] + b * pt[1] + c) / Math.hypot(a, b));
    },

    // ---------------------------------------------------------- HIG-23 원과 직선의 위치 관계
    'HIG-23': (v, q) => {
      const { p, q: cq, R } = circle(v.원);
      const m = stripSp(v.직선).match(/^(-?\d*)x([+-]\d*)y\+k=0$/);
      if (!m) return { unsupported: '직선 형식' };
      const c1 = t => (t === '' || t === '+' ? 1 : t === '-' ? -1 : Number(t));
      const a = c1(m[1]), b = c1(m[2]);
      const L = Math.hypot(a, b), r = Math.sqrt(R), s = a * p + b * cq;
      const dist = k => Math.abs(s + k) / L; // 중심과 직선 사이 거리
      if (/접할 때, 양수 k/.test(q)) {
        const ks = [-s + r * L, -s - r * L].filter(k => k > 0);
        if (ks.length !== 1) return { unsupported: '양수 k 가 하나가 아님' };
        return byVal(ks[0]);
      }
      if (/접하도록 하는 모든 상수 k의 값의 합/.test(q)) return byVal((-s + r * L) + (-s - r * L));
      if (/서로 다른 두 점에서 만나도록 하는 자연수 k의 개수/.test(q)) {
        let cnt = 0; for (let k = 1; k <= 5000; k++) if (dist(k) < r - 1e-12) cnt++;
        return byNums([cnt]);
      }
      return { unsupported: '지문 형식' };
    },

    // ---------------------------------------------------------- HIG-24 대칭이동
    'HIG-24': (v, q) => {
      const T = name => {
        const n = stripSp(name);
        if (n === 'x축') return ([x, y]) => [x, -y];
        if (n === 'y축') return ([x, y]) => [-x, y];
        if (n === '원점') return ([x, y]) => [-x, -y];
        if (n === '직선y=x') return ([x, y]) => [y, x];
        if (n === '직선y=-x') return ([x, y]) => [-y, -x];
        throw new Error('대칭 형식: ' + name);
      };
      const t = norm(q);
      let m = t.match(/점 A\((-?\d+), (-?\d+)\)(?:을|를) (.+?)에 대하여 대칭이동한 점을 B, (.+?)에 대하여 대칭이동한 점을 C라 할 때, 삼각형 ABC의 넓이/);
      if (m) {
        const A = [Number(m[1]), Number(m[2])], B = T(m[3])(A), C = T(m[4])(A);
        const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
        return byVal(area);
      }
      m = t.match(/점 \((-?\d+), (-?\d+)\)(?:을|를) (.+?)에 대하여 대칭이동한 후, 다시 (.+?)에 대하여 대칭이동한 점의 좌표/);
      if (m) return byNums(T(m[4])(T(m[3])([Number(m[1]), Number(m[2])])));
      m = t.match(/점 \((-?\d+), (-?\d+)\)(?:을|를) (.+?)에 대하여 대칭이동한 점의 좌표/);
      if (m) return byNums(T(m[3])([Number(m[1]), Number(m[2])]));
      return { unsupported: '지문 형식' };
    },

    // ---------------------------------------------------------- HIG-25 집합의 연산 (포함과 배제)
    'HIG-25': (v, q) => {
      const t = norm(q);
      let m = t.match(/학생 (\d+)명 중 (\S+?)(?:을|를) 좋아하는 학생은 (\d+)명, (\S+?)(?:을|를) 좋아하는 학생은 (\d+)명, 두 과목을 모두 좋아하는 학생은 (\d+)명이다\. (.+?) 학생 수는/);
      if (m) {
        const U = Number(m[1]), s1 = m[2], a = Number(m[3]), b = Number(m[5]), c = Number(m[6]), target = m[7];
        if (/어느 것도 좋아하지 않는/.test(target)) return byNums([U - (a + b - c)]);
        if (target === `${s1}만 좋아하는`) return byNums([a - c]);
        return { unsupported: '질문 형식: ' + target };
      }
      const n = {};
      for (const mm of stripSp(t).matchAll(/n\(([A-C∩∪]+)\)=(\d+)/g)) n[mm[1]] = Number(mm[2]);
      const tg = stripSp(t).match(/n\(([A-C∩∪]+)\)의값/);
      if (!tg) return { unsupported: '목표 형식' };
      const get = k => { const alt = k.split('∩').reverse().join('∩'); if (k in n) return n[k]; if (alt in n) return n[alt]; throw new Error('값 없음: ' + k); };
      if (tg[1] === 'A∪B') return byNums([get('A') + get('B') - get('A∩B')]);
      if (tg[1] === 'A∪B∪C') return byNums([get('A') + get('B') + get('C') - get('A∩B') - get('B∩C') - get('C∩A') + get('A∩B∩C')]);
      return { unsupported: '목표 형식: ' + tg[1] };
    },

    // ---------------------------------------------------------- HIG-26 합성함수
    'HIG-26': (v, q) => {
      const F = { f: poly(v.f), g: poly(v.g) };
      const t = stripSp(q);
      const m = t.match(/에대하여(.+?)의값은/);
      if (!m) return { unsupported: '지문 형식' };
      let total = 0;
      for (const tm of m[1].matchAll(/([+-]?)\(([fg∘]+)\)\((-?\d+)\)/g)) {
        const chain = tm[2].split('∘');
        let x = Number(tm[3]);
        for (let i = chain.length - 1; i >= 0; i--) x = at(F[chain[i]], x);
        total += (tm[1] === '-' ? -1 : 1) * x;
      }
      return byNums([total]);
    },

    // ---------------------------------------------------------- HIG-27 유리함수
    'HIG-27': (v, q) => {
      const s = stripSp(v.함수).replace(/^y=/, '');
      let p, cq, K;
      let m = s.match(/^(-?\d+)\/\(([^()]+)\)([+-]\d+)?$/);
      if (m) {
        const D = poly(m[2]);
        p = -(D[0] || 0) / D[1]; cq = m[3] ? Number(m[3]) : 0; K = Number(m[1]) / D[1];
      } else if ((m = s.match(/^\(([^()]+)\)\/\(([^()]+)\)$/))) {
        const Nn = poly(m[1]), D = poly(m[2]);
        p = -(D[0] || 0) / D[1]; cq = (Nn[1] || 0) / D[1]; K = ((Nn[0] || 0) - cq * (D[0] || 0)) / D[1];
      } else return { unsupported: '함수 형식' };
      if (/두 점근선의 방정식/.test(q)) return o => { const t = stripSp(o).match(/^x=(-?\d+),y=(-?\d+)$/); return !!t && eq(Number(t[1]), p) && eq(Number(t[2]), cq); };
      if (/교점을 \(p, q\)라 할 때, p \+ q의 값/.test(q)) return byVal(p + cq);
      if (/평행이동한 것이다\. 상수 k의 값/.test(q)) return byVal(K);
      return { unsupported: '지문 형식' };
    },

    // ---------------------------------------------------------- HIG-28 지수법칙: 식의 값을 직접 계산
    'HIG-28': v => {
      const js = norm(v.식).replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').replace(/\s+/g, '');
      if (!/^[\d*/()+\-.]+$/.test(js)) return { unsupported: '식 형식' };
      const x = Function(`"use strict"; return (${js});`)();
      return byVal(x);
    },

    // ---------------------------------------------------------- HIG-29 삼각함수의 최대·최소·주기 (수치 표본으로 확인)
    'HIG-29': (v, q) => {
      const s = stripSp(v.함수).replace(/^y=/, '');
      const m = s.match(/^(-?\d*)(\|?)(sin|cos)(\(?)(\d*)x((?:[+-])π\/\d+)?\)?\|?([+-]\d+)?$/);
      if (!m) return { unsupported: '함수 형식: ' + v.함수 };
      const A = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
      const abs = m[2] === '|', g = m[3] === 'sin' ? Math.sin : Math.cos;
      const Bc = m[5] === '' ? 1 : Number(m[5]);
      const ph = m[6] ? (m[6][0] === '-' ? -1 : 1) * Math.PI / Number(m[6].split('/')[1]) : 0;
      const Cc = m[7] ? Number(m[7]) : 0;
      const f = x => { const y = g(Bc * x + ph); return A * (abs ? Math.abs(y) : y) + Cc; };
      let mx = -Infinity, mn = Infinity;
      for (let i = 0; i <= 40000; i++) { const y = f((4 * Math.PI * i) / 40000); if (y > mx) mx = y; if (y < mn) mn = y; }
      mx = Math.round(mx * 1000) / 1000; mn = Math.round(mn * 1000) / 1000;
      let T = null;
      outer: for (let n = 1; n <= 12; n++) for (let k = 1; k <= 24; k++) {
        const cand = (k * Math.PI) / n;
        let ok = true;
        for (let i = 0; i < 300 && ok; i++) { const x = 0.137 + i * 0.0731; if (Math.abs(f(x + cand) - f(x)) > 1e-9) ok = false; }
        if (ok && (T === null || cand < T - 1e-12)) T = cand;
        if (ok) continue outer;
      }
      const askT = /주기/.test(q);
      return o => {
        const t = stripSp(o);
        const a = t.match(/최댓값(-?\d+)/), b = t.match(/최솟값(-?\d+)/), c = t.match(/주기(\d*)π(?:\/(\d+))?/);
        if (!a || !b || !eq(Number(a[1]), mx) || !eq(Number(b[1]), mn)) return false;
        if (!askT) return !c;
        if (!c) return false;
        const Tv = (c[1] === '' ? 1 : Number(c[1])) * Math.PI / (c[2] ? Number(c[2]) : 1);
        return eq(Tv, T);
      };
    },

    // ---------------------------------------------------------- HIG-30 사인법칙과 코사인법칙
    'HIG-30': (v, q) => {
      const t = norm(q);
      const rad = d => (d * Math.PI) / 180;
      let m = t.match(/sin A : sin B : sin C = (\d+) : (\d+) : (\d+)일 때, cos ([ABC])의 값/);
      if (m) {
        const sd = { A: Number(m[1]), B: Number(m[2]), C: Number(m[3]) };
        const X = m[4], [Y, Z] = ['A', 'B', 'C'].filter(c => c !== X);
        return byVal((sd[Y] ** 2 + sd[Z] ** 2 - sd[X] ** 2) / (2 * sd[Y] * sd[Z]));
      }
      const side = {}, ang = {};
      for (const mm of t.matchAll(/\b([abc]) = (\d+)/g)) side[mm[1]] = Number(mm[2]);
      for (const mm of t.matchAll(/\b([ABC]) = (\d+)°/g)) ang[mm[1]] = Number(mm[2]);
      const tg = t.match(/일 때, ([abc])의 값/);
      if (!tg) return { unsupported: '지문 형식' };
      const x = tg[1], X = x.toUpperCase();
      const others = ['a', 'b', 'c'].filter(c => c !== x);
      if (others.every(c => c in side) && X in ang) {
        // 코사인법칙
        const [y, z] = others;
        return byVal(Math.sqrt(side[y] ** 2 + side[z] ** 2 - 2 * side[y] * side[z] * Math.cos(rad(ang[X]))));
      }
      const known = Object.keys(side).find(c => c.toUpperCase() in ang);
      if (known && X in ang) return byVal((side[known] * Math.sin(rad(ang[X]))) / Math.sin(rad(ang[known.toUpperCase()])));
      if (known && Object.keys(ang).length === 2) {
        const third = ['A', 'B', 'C'].find(c => !(c in ang));
        if (third === X) { const angX = 180 - Object.values(ang).reduce((a, b) => a + b, 0); return byVal((side[known] * Math.sin(rad(angX))) / Math.sin(rad(ang[known.toUpperCase()]))); }
      }
      return { unsupported: '조건 부족' };
    },

    // ---------------------------------------------------------- HIG-31 합의 기호 Σ
    'HIG-31': (v, q) => {
      const t = norm(q);
      let m = t.match(/Σ\(k=1~(\d+)\) a_k = (-?\d+), Σ\(k=1~\1\) b_k = (-?\d+)일 때, Σ\(k=1~\1\) \((.+?)\)의 값/);
      if (m) {
        const n = Number(m[1]), SA = Number(m[2]), SB = Number(m[3]);
        const e = stripSp(m[4]);
        let total = 0, rest = e;
        for (const tm of e.matchAll(/([+-]?)(\d*)([ab])_k/g)) { const k = (tm[1] === '-' ? -1 : 1) * (tm[2] === '' ? 1 : Number(tm[2])); total += k * (tm[3] === 'a' ? SA : SB); rest = rest.replace(tm[0], ''); }
        const cst = rest === '' ? 0 : Number(rest);
        if (Number.isNaN(cst)) return { unsupported: '상수항 형식' };
        return byNums([total + cst * n]);
      }
      m = t.match(/Σ\(k=(\d+)~(\d+)\) \((.+?)\)의 값/);
      if (!m) return { unsupported: '지문 형식' };
      const P = poly(m[3], 'k');
      let s = 0; for (let k = Number(m[1]); k <= Number(m[2]); k++) s += at(P, k);
      return byNums([s]);
    },

    // ---------------------------------------------------------- HIG-32 함수의 극한
    'HIG-32': (v, q) => {
      const t = norm(q);
      const m = t.match(/lim\(x→(-?\d+|∞)\) \(([^()]+)\)\/\(([^()]+)\)/);
      if (!m) return { unsupported: '지문 형식' };
      if (/[ab]/.test(m[2].replace(/\s/g, '').replace(/^\d*x²/, ''))) {
        // 미정계수: N(x) = n2·x² + ax + b, D(x) 일차식, 극한값 L
        const L = t.match(/= (-?\d+)일 때/); const c = Number(m[1]);
        const nm = stripSp(m[2]).match(/^(\d*)x²\+ax\+b$/);
        if (!L || !nm) return { unsupported: '미정계수 형식' };
        const n2 = nm[1] === '' ? 1 : Number(nm[1]); const D = poly(m[3]);
        if (!eq(at(D, c), 0)) return { unsupported: '분모가 0 이 아님' };
        // N(c) = 0, N'(c) / D'(c) = L
        const a = Number(L[1]) * D[1] - 2 * n2 * c, b = -n2 * c * c - a * c;
        const tg = stripSp(t).match(/a,b에대하여(.+?)의값/);
        const e = tg ? tg[1] : '';
        if (e === 'a+b') return byVal(a + b);
        if (e === 'ab') return byVal(a * b);
        if (e === 'a-b') return byVal(a - b);
        return { unsupported: '목표 형식: ' + e };
      }
      let N = poly(m[2]), D = poly(m[3]);
      if (m[1] === '∞') {
        const dn = deg(N), dd = deg(D);
        if (dn > dd) return { unsupported: '발산' };
        return byVal(dn < dd ? 0 : N[dn] / D[dd]);
      }
      const c = Number(m[1]);
      for (let i = 0; i < 4 && Math.abs(at(D, c)) < 1e-12; i++) {
        if (Math.abs(at(N, c)) > 1e-12) return { unsupported: '발산' };
        N = divLinear(N, c); D = divLinear(D, c);
      }
      return byVal(at(N, c) / at(D, c));
    },

    // ---------------------------------------------------------- HIG-33 정적분
    'HIG-33': (v, q) => {
      const t = norm(q);
      const m = t.match(/∫\((-?\d+)~(-?\d+)\) (.+?) dx/);
      if (!m) return { unsupported: '지문 형식' };
      const lo = Number(m[1]), hi = Number(m[2]);
      const body = m[3].trim();
      const F = (p, x) => Object.entries(p).reduce((acc, [k, c]) => acc + (c * Math.pow(x, Number(k) + 1)) / (Number(k) + 1), 0);
      const intPoly = (p, a, b) => F(p, b) - F(p, a);
      const ab = body.match(/^\|(.+)\|$/);
      if (ab) {
        const P = poly(ab[1]);
        const pts = [lo, ...realRoots(P).filter(r => r > lo && r < hi), hi];
        let s = 0;
        for (let i = 0; i + 1 < pts.length; i++) s += Math.abs(intPoly(P, pts[i], pts[i + 1]));
        return byVal(s);
      }
      return byVal(intPoly(poly(body.replace(/^\(|\)$/g, '')), lo, hi));
    },

    // ---------------------------------------------------------- HIG-34 속도와 가속도
    'HIG-34': (v, q) => {
      const X = poly(v.위치, 't'), V = der(X), A = der(V);
      const t = norm(q);
      let m = t.match(/시각 t = (\d+)에서의 (속도|가속도)/);
      if (m) return byNums([at(m[2] === '속도' ? V : A, Number(m[1]))]);
      if (/처음으로 운동 방향을 바꾸는 시각에서의 가속도/.test(t)) {
        const ts = realRoots(V).filter(r => r > 1e-9 && Math.abs(at(A, r)) > 1e-9); // 부호가 바뀌는 근
        if (!ts.length) return { unsupported: '방향 전환 없음' };
        return byNums([Math.round(at(A, ts[0]) * 1e6) / 1e6]);
      }
      if (/처음으로 운동 방향을 바꾸는 시각에서의 위치/.test(t)) {
        const ts = realRoots(V).filter(r => r > 1e-9 && Math.abs(at(A, r)) > 1e-9);
        if (!ts.length) return { unsupported: '방향 전환 없음' };
        return byNums([Math.round(at(X, ts[0]) * 1e6) / 1e6]);
      }
      return { unsupported: '지문 형식' };
    },

    // ---------------------------------------------------------- HIG-35 조건부확률
    'HIG-35': (v, q) => {
      const t = norm(q);
      let m = t.match(/(\S+) (\d+)명 중 (\d+)명, (\S+) (\d+)명 중 (\d+)명이 (\S+)에 가입했다\..*?이 학생이 (\S+)일 확률/);
      if (m) {
        const join = { [m[1]]: Number(m[3]), [m[4]]: Number(m[6]) };
        if (!(m[8] in join)) return { unsupported: '집단 이름' };
        return byVal(join[m[8]] / (Number(m[3]) + Number(m[6])));
      }
      const P = {};
      for (const mm of stripSp(t).matchAll(/P\(([AB∩∪]+)\)=(-?\d+(?:\/\d+)?)/g)) P[mm[1]] = fracVal(mm[2]);
      const tg = stripSp(t).match(/P\(([AB])\|([AB])\)의값/);
      if (!tg) return { unsupported: '목표 형식' };
      const X = tg[1], Y = tg[2];
      let inter = P[`${X}∩${Y}`] ?? P[`${Y}∩${X}`];
      if (inter === undefined && P['A∪B'] !== undefined) inter = P.A + P.B - P['A∪B'];
      if (inter === undefined || P[Y] === undefined) return { unsupported: '조건 부족' };
      return byVal(inter / P[Y]);
    }
  };
};
