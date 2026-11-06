/**
 * 중등 수학 새 유형(MID-15 ~ MID-35) 정답 oracle — verify-tiers.js 가 불러 쓴다.
 * 원칙: 지문(q)과 variablesInfo(v)의 '입력값'만 읽어 정답을 독립 계산한다.
 *       generate()가 계산한 정답 결과값은 읽지 않는다. matcher(보기) → 정답 보기만 true.
 * H: 동결 검증기 helpers (norm, N, allNums, eq, arrEq, byNums, gcd, stripSp, parsePoly ...)
 */
'use strict';

module.exports = H => {
  const { norm, N, allNums, eq, arrEq, byNums, gcd, stripSp, parsePoly } = H;
  const no = () => false; // 지문을 해석하지 못하면 어떤 보기도 정답으로 보지 않는다 → FAIL 로 드러남

  // 다항식 비교 {차수: 계수}
  const polyEq = (a, b) => {
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of ks) if (!eq(a[k] || 0, b[k] || 0)) return false;
    return true;
  };
  const tryPoly = s => { try { return parsePoly(s); } catch (e) { return null; } };
  const polyMatcher = expected => o => { const p = tryPoly(o); return !!p && polyEq(p, expected); };
  const scale = (p, c, shift = 0) => { const r = {}; for (const [k, v] of Object.entries(p)) r[Number(k) + shift] = (r[Number(k) + shift] || 0) + c * v; return r; };
  const add = (p, q) => { const r = { ...p }; for (const [k, v] of Object.entries(q)) r[k] = (r[k] || 0) + v; return r; };
  // 계수 문자열: '' → 1, '-' → -1
  const coef = s => (s === '' || s === '+' || s === undefined ? 1 : s === '-' ? -1 : Number(s));
  // 유리수 표기 "−7/3", "0.5", "4" → 값
  const ratVal = s => {
    const t = stripSp(s);
    const m = t.match(/^(-?\d+)\/(\d+)$/);
    if (m) return Number(m[1]) / Number(m[2]);
    return /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : NaN;
  };
  // 제곱인수가 없는 부분
  const squareFree = n => { let s = 1; for (let p = 2; p * p <= n; p++) { let c = 0; while (n % p === 0) { n /= p; c++; } if (c % 2) s *= p; } return s * n; };
  const bracket = q => { const m = norm(q).match(/\[([^\]]+)\]/); return m ? m[1] : ''; };

  return {
    // [9수01-02] 최대공약수와 최소공배수 — 주어진 수(입력)에서 직접 계산
    'MID-15': v => {
      const xs = allNums(v.수);
      if (xs.length < 2) return no;
      const g = xs.reduce((a, b) => gcd(a, b));
      const l = xs.reduce((a, b) => a * b / gcd(a, b));
      return byNums([g, l]);
    },

    // [9수02-02] 일차식의 덧셈과 뺄셈 — 지문의 k1(식1) ± k2(식2) 를 직접 전개
    'MID-16': (v, q) => {
      const m = stripSp(bracket(q)).match(/^(-?\d*)\(([^()]+)\)([+-])(\d*)\(([^()]+)\)$/);
      if (!m) return no;
      const p1 = parsePoly(m[2]), p2 = parsePoly(m[5]);
      const exp = add(scale(p1, coef(m[1])), scale(p2, (m[3] === '-' ? -1 : 1) * coef(m[4])));
      return polyMatcher(exp);
    },

    // [9수03-05] 다각형의 성질
    'MID-17': (v, q) => {
      const s = stripSp(q);
      let m;
      if ((m = s.match(/정(\d+)각형의한내각의크기/))) { const n = Number(m[1]); return byNums([180 * (n - 2) / n]); }
      if ((m = s.match(/대각선의개수가(\d+)개인다각형의내각의크기의합/))) {
        const D = Number(m[1]);
        for (let n = 4; n < 100; n++) if (n * (n - 3) / 2 === D) return byNums([180 * (n - 2)]);
        return no;
      }
      if ((m = s.match(/내각의크기의합이([\d,]+)°인다각형의대각선의개수/))) {
        const n = Number(m[1].replace(/,/g, '')) / 180 + 2;
        if (!Number.isInteger(n)) return no;
        return byNums([n * (n - 3) / 2]);
      }
      if ((m = s.match(/한(외|내)각의크기가(\d+)°인정다각형의대각선의개수/))) {
        const ext = m[1] === '외' ? Number(m[2]) : 180 - Number(m[2]);
        const n = 360 / ext;
        if (!Number.isInteger(n)) return no;
        return byNums([n * (n - 3) / 2]);
      }
      return no;
    },

    // [9수04-01] 대푯값(중앙값·최빈값)
    'MID-18': (v, q) => {
      const xs = allNums(v.자료).sort((a, b) => a - b);
      const n = xs.length;
      if (n < 3) return no;
      const med = n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2;
      if (!/최빈값/.test(q)) return byNums([med]);
      const cnt = {};
      xs.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
      const top = Math.max(...Object.values(cnt));
      const modes = Object.keys(cnt).filter(k => cnt[k] === top).map(Number);
      if (modes.length !== 1 || top < 2) return no; // 최빈값이 하나로 정해지지 않으면 문항 결함
      return byNums([med + modes[0]]);
    },

    // [9수01-06] 순환소수 → 기약분수 (지문의 점 찍힌 표기를 직접 해석)
    'MID-19': (v, q) => {
      const m = q.match(/순환소수\s+(\d+)\.((?:\ḋ?)+)/);
      if (!m) return no;
      const I = Number(m[1]);
      const digits = [...m[2].matchAll(/(\d)(̇?)/g)].map(x => ({ d: x[1], dot: !!x[2] }));
      const first = digits.findIndex(x => x.dot);
      let last = -1; digits.forEach((x, i) => { if (x.dot) last = i; });
      if (first < 0 || last !== digits.length - 1) return no;
      const A = digits.slice(0, first).map(x => x.d).join('');       // 순환하지 않는 부분
      const B = digits.slice(first).map(x => x.d).join('');          // 순환마디
      const num = Number(A + B) - Number(A || '0');
      const den = Number('9'.repeat(B.length) + '0'.repeat(A.length));
      const g = gcd(num + I * den, den);
      return o => arrEq(allNums(o), [(num + I * den) / g, den / g]);
    },

    // [9수02-14] 함숫값
    'MID-20': (v, q) => {
      const s = stripSp(q);
      let m;
      if ((m = s.match(/f\(x\)=ax([+-]\d+)?에서f\((-?\d+)\)=(-?\d+)일때,f\((-?\d+)\)의값/))) {
        const b = m[1] ? Number(m[1]) : 0;
        const a = (Number(m[3]) - b) / Number(m[2]);
        return byNums([a * Number(m[4]) + b]);
      }
      if ((m = s.match(/f\(x\)=(.+?)일때,f\((-?\d+)\)(?:([+-])f\((-?\d+)\))?의값/))) {
        const p = parsePoly(m[1]);
        let r = H.evalPoly(p, Number(m[2]));
        if (m[3]) r += (m[3] === '-' ? -1 : 1) * H.evalPoly(p, Number(m[4]));
        return byNums([r]);
      }
      return no;
    },

    // [9수03-12] 닮음비 — 주어진 길이(입력)로 계산
    'MID-21': v => {
      if (v.닮음비 !== undefined) { const [a, b] = allNums(v.닮음비); return byNums([N(v.작은변) * b / a]); }
      if (v.작은둘레 !== undefined) return byNums([N(v.작은둘레) * N(v.큰대응변) / N(v.작은대응변)]);
      if (v.AB !== undefined) {
        const AB = N(v.AB), BC = N(v.BC), DE = N(v.DE), DF = N(v.DF);
        return byNums([BC * DE / AB + DF * AB / DE]);
      }
      return no;
    },

    // [9수01-04] 정수와 유리수의 대소
    'MID-22': (v, q) => {
      if (/사이에 있는 정수/.test(q)) {
        const lo = ratVal(v.왼쪽), hi = ratVal(v.오른쪽);
        if (Number.isInteger(lo) || Number.isInteger(hi)) return no; // 끝점이 정수면 포함 여부가 모호
        let c = 0;
        for (let k = Math.ceil(lo); k <= Math.floor(hi); k++) c++;
        return byNums([c]);
      }
      const xs = String(v.수들).split(',').map(ratVal);
      if (xs.some(Number.isNaN)) return no;
      const target = /가장 큰/.test(q) ? Math.max(...xs) : /가장 작은/.test(q) ? Math.min(...xs) : NaN;
      return o => eq(ratVal(o), target);
    },

    // [9수02-07] 정비례와 반비례
    'MID-23': (v, q) => {
      const s = stripSp(q);
      let m;
      if ((m = s.match(/y=(-?\d+)x의그래프와반비례관계y=b\/x의그래프가x좌표가(-?\d+)인점/))) {
        const a = Number(m[1]), p = Number(m[2]);
        return byNums([p * (a * p)]);
      }
      if ((m = s.match(/x=(-?\d+)일때y=(-?\d+)이다\.x=(-?\d+)일때y의값/))) {
        const x1 = Number(m[1]), y1 = Number(m[2]), x2 = Number(m[3]);
        if (/정비례/.test(s)) return byNums([y1 / x1 * x2]);
        if (/반비례/.test(s)) return byNums([x1 * y1 / x2]);
      }
      return no;
    },

    // [9수03-06] 부채꼴의 호의 길이와 넓이 (π의 계수 비교)
    'MID-24': (v, q) => {
      const s = stripSp(q);
      const r = Number((s.match(/반지름의길이가(\d+)cm/) || [])[1]);
      const th = (s.match(/중심각의크기가(\d+)°/) || [])[1];
      const arc = (s.match(/호의길이가(\d+)πcm/) || [])[1];
      if (!r) return no;
      if (arc && /넓이는/.test(s)) return byNums([r * Number(arc) / 2]);
      if (th && /호의길이는/.test(s)) return byNums([2 * r * Number(th) / 360]);
      if (th && /넓이는/.test(s)) return byNums([r * r * Number(th) / 360]);
      return no;
    },

    // [9수04-05] 경우의 수
    'MID-25': (v, q) => {
      const s = stripSp(q);
      let m;
      if ((m = s.match(/0부터(\d+)까지의정수가하나씩적힌\d+장의카드중(\d)장을뽑아/))) {
        const k = Number(m[1]), d = Number(m[2]);
        let c = k; // 맨 앞자리: 0 제외 k가지
        for (let i = 0; i < d - 1; i++) c *= (k - i); // 나머지 자리: 0 포함 남은 카드
        return byNums([c]);
      }
      if ((m = s.match(/(\d+)명의[가-힣]+중에서회장1명,부회장1명을뽑는/))) { const n = Number(m[1]); return byNums([n * (n - 1)]); }
      if ((m = s.match(/(\d+)명의[가-힣]+중에서대표2명을뽑는/))) { const n = Number(m[1]); return byNums([n * (n - 1) / 2]); }
      if (/짝지어/.test(s)) { const xs = [...s.matchAll(/(\d+)종류/g)].map(x => Number(x[1])); return byNums([xs.reduce((a, b) => a * b, 1)]); }
      return no;
    },

    // [9수01-07] 제곱근의 뜻과 성질, 대소 관계
    'MID-26': (v, q) => {
      const s = stripSp(q);
      let m;
      if ((m = s.match(/(\d+)의제곱근을모두/))) {
        const r = Math.sqrt(Number(m[1]));
        if (!Number.isInteger(r)) return no;
        return o => stripSp(o) === `±${r}`;
      }
      if ((m = s.match(/(\d+)([<≤])√x([<≤])(\d+)/))) {
        const p = Number(m[1]), r = Number(m[4]);
        let c = 0;
        for (let x = 1; x <= r * r; x++) {
          const sx = Math.sqrt(x);
          if ((m[2] === '<' ? p < sx : p <= sx) && (m[3] === '<' ? sx < r : sx <= r)) c++;
        }
        return byNums([c]);
      }
      if ((m = s.match(/√\((\d+)n\)이자연수가되도록하는가장작은자연수n/))) return byNums([squareFree(Number(m[1]))]);
      return no;
    },

    // [9수02-10] (단항식)×(다항식), (다항식)÷(단항식) — 지문의 식을 직접 전개
    'MID-27': (v, q) => {
      const s = stripSp(bracket(q));
      let m;
      if ((m = s.match(/^\(([^()]+)\)÷(\d+)x([+-])(\d*)x\(([^()]+)\)$/))) {
        const div = scale(parsePoly(m[1]), 1 / Number(m[2]), -1);
        const mul = scale(parsePoly(m[5]), (m[3] === '-' ? -1 : 1) * coef(m[4]), 1);
        return polyMatcher(add(div, mul));
      }
      if ((m = s.match(/^\(([^()]+)\)÷(\d+)x$/))) return polyMatcher(scale(parsePoly(m[1]), 1 / Number(m[2]), -1));
      if ((m = s.match(/^(-?\d*)x\(([^()]+)\)$/))) return polyMatcher(scale(parsePoly(m[2]), coef(m[1]), 1));
      return no;
    },

    // [9수03-08] 입체도형의 겉넓이와 부피 (π의 계수 비교)
    'MID-28': (v, q) => {
      const s = stripSp(q);
      const r = Number((s.match(/반지름의길이가(\d+)cm/) || [])[1]);
      const h = Number((s.match(/높이가(\d+)cm/) || [])[1]);
      const l = Number((s.match(/모선의길이가(\d+)cm/) || [])[1]);
      if (!r) return no;
      if (/원기둥/.test(s) && /부피/.test(s) && h) return byNums([r * r * h]);
      if (/원뿔/.test(s) && /부피/.test(s) && h) return byNums([r * r * h / 3]);
      if (/원뿔/.test(s) && /겉넓이/.test(s) && l) return byNums([r * r + r * l]);
      return no;
    },

    // [9수04-03] 상대도수
    'MID-29': (v, q) => {
      const s = stripSp(q);
      let m;
      if ((m = s.match(/상대도수가각각([\d.]+),([\d.]+)인두계급의도수의합이(\d+)일때,전체도수/))) return byNums([Number(m[3]) / (Number(m[1]) + Number(m[2]))]);
      if ((m = s.match(/전체도수가(\d+)인.*?상대도수가([\d.]+)인계급의도수/))) return byNums([Number(m[1]) * Number(m[2])]);
      if ((m = s.match(/전체도수가(\d+)인.*?도수가(\d+)인계급의상대도수/))) return byNums([Number(m[2]) / Number(m[1])]);
      return no;
    },

    // [9수01-10] 근호를 포함한 식의 계산 — 지문 식의 값을 수치로 계산, 보기는 '정리된 c√s' 형태여야 정답
    'MID-30': (v, q) => {
      const s = stripSp(bracket(q));
      const terms = s.match(/[+-]?[^+-]+/g) || [];
      let val = 0;
      for (const t of terms) {
        let m;
        if ((m = t.match(/^([+-]?)(\d*)√(\d+)$/))) val += (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2])) * Math.sqrt(Number(m[3]));
        else if ((m = t.match(/^([+-]?)(\d+)\/√(\d+)$/))) val += (m[1] === '-' ? -1 : 1) * Number(m[2]) / Math.sqrt(Number(m[3]));
        else return no;
      }
      return o => {
        const m = stripSp(o).match(/^(-?\d+)√(\d+)$/);
        if (!m) return false;
        const c = Number(m[1]), r = Number(m[2]);
        return r > 1 && squareFree(r) === r && eq(c * Math.sqrt(r), val);
      };
    },

    // [9수02-18] 두 일차함수의 그래프와 연립일차방정식
    'MID-31': (v, q) => {
      const s = stripSp(q);
      let m;
      if ((m = s.match(/y=(-?\d*)x([+-]\d+)?,y=(-?\d*)x\+k의그래프의교점의x좌표가(-?\d+)일때/))) {
        const a = coef(m[1]), b = m[2] ? Number(m[2]) : 0, c = coef(m[3]), x0 = Number(m[4]);
        return byNums([(a - c) * x0 + b]);
      }
      const ls = [...s.matchAll(/y=(-?\d*)x([+-]\d+)?(?=[,의])/g)].map(x => [coef(x[1]), x[2] ? Number(x[2]) : 0]);
      if (ls.length !== 2 || ls[0][0] === ls[1][0]) return no;
      const [[a, b], [c, d]] = ls;
      const x = (d - b) / (a - c);
      return byNums([x, a * x + b]);
    },

    // [9수03-10] 삼각형의 외심과 내심
    'MID-32': (v, q) => {
      const s = stripSp(q);
      let m;
      if ((m = s.match(/∠BIC=(\d+)°일때,∠BOC의크기/))) return byNums([4 * (Number(m[1]) - 90)]);
      if ((m = s.match(/외심을O라하자\.∠A=(\d+)°일때,∠BOC의크기/))) return byNums([2 * Number(m[1])]);
      if ((m = s.match(/내심을I라하자\.∠A=(\d+)°일때,∠BIC의크기/))) return byNums([90 + Number(m[1]) / 2]);
      return no;
    },

    // [9수04-07] 분산
    'MID-33': (v, q) => {
      const s = stripSp(q);
      const raw = bracket(q);
      const xs = allNums(raw);
      const variance = arr => { const mu = arr.reduce((a, b) => a + b, 0) / arr.length; return arr.reduce((a, b) => a + (b - mu) ** 2, 0) / arr.length; };
      if (/편차가/.test(s)) return byNums([xs.reduce((a, b) => a + b * b, 0) / xs.length]);
      let m;
      if ((m = s.match(/평균이(\d+)일때/)) && /x/.test(raw)) {
        const n = raw.split(',').length;
        const x = n * Number(m[1]) - xs.reduce((a, b) => a + b, 0);
        return byNums([variance([...xs, x])]);
      }
      return byNums([variance(xs)]);
    },

    // [9수02-20] 이차방정식
    'MID-34': (v, q) => {
      const s = stripSp(q);
      let roots;
      let m;
      if ((m = s.match(/이차방정식\(x([+-]\d+)\)\(x([+-]\d+)\)=0/))) roots = [-Number(m[1]), -Number(m[2])];
      else if ((m = s.match(/이차방정식(.+?)=0/))) {
        const p = parsePoly(m[1]);
        const a = p[2] || 0, b = p[1] || 0, c = p[0] || 0;
        const D = b * b - 4 * a * c;
        if (!a || D <= 0) return no;
        const sd = Math.sqrt(D);
        if (!Number.isInteger(sd)) {
          // 무리수 근: x = p ± √r 꼴(r은 제곱인수 없음)만 정답
          return o => {
            const mm = stripSp(o).match(/^x=(-?\d+)±√(\d+)$/);
            return !!mm && a === 1 && eq(Number(mm[1]), -b / 2) && eq(Number(mm[2]), D / 4);
          };
        }
        roots = [(-b + sd) / (2 * a), (-b - sd) / (2 * a)];
      } else return no;
      const want = roots.slice().sort((x, y) => x - y);
      return o => { const ns = allNums(o).sort((x, y) => x - y); return /또는/.test(o) && arrEq(ns, want); };
    },

    // [9수03-19] 원주각의 성질
    'MID-35': (v, q) => {
      const s = stripSp(q);
      let m;
      if ((m = s.match(/∠AOB의크기가(\d+)°일때/))) return byNums([Number(m[1]) / 2]);
      if ((m = s.match(/지름이고.*∠CAB=(\d+)°이면∠ABC의크기/))) return byNums([90 - Number(m[1])]);
      if ((m = s.match(/∠OAB=(\d+)°이다\.점P가두호AB중짧은호위의점일때,∠APB의크기/))) return byNums([90 + Number(m[1])]);
      return no;
    }
  };
};
