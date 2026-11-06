/**
 * 기초 수학 확장 유형(BAS-15 ~ BAS-35) 독립 정답 oracle — verifier-first
 * - verify/verify-tiers.js 가 동결 검증기의 helpers(H)를 넘겨 준다.
 * - 지문(q)과 variablesInfo(v)의 '입력값'만 읽어 정답을 다시 계산한다. generate()의 결과값은 읽지 않는다.
 * - 각 oracle(v, q) → matcher(option) → 정답 보기에만 true.
 */
'use strict';

module.exports = H => {
  const { norm, N, allNums, eq, byNums, gcd, stripSp } = H;

  // ---------------------------------------------------------------- 유리수 도구
  const red = (n, d) => { const g = gcd(n, d); const s = d < 0 ? -1 : 1; return [s * n / g, s * d / g]; };
  const mul = (a, b) => red(a[0] * b[0], a[1] * b[1]);
  const div = (a, b) => red(a[0] * b[1], a[1] * b[0]);
  const add = (a, b) => red(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
  const sub = (a, b) => add(a, [-b[0], b[1]]);
  const val = r => r[0] / r[1];
  const lcm = (a, b) => a * b / gcd(a, b);
  const unComma = s => norm(s).replace(/,(?=\d{3})/g, '');

  // "3/4", "0.75", "12", "1과 1/2" → [분자, 분모] (기약)
  function parseQ(tok) {
    const s = unComma(tok).trim();
    let m = s.match(/^(\d+)\s*[과와]\s*(\d+)\s*\/\s*(\d+)$/);
    if (m) return red(Number(m[1]) * Number(m[3]) + Number(m[2]), Number(m[3]));
    m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return red(Number(m[1]), Number(m[2]));
    m = s.match(/^(\d+)(?:\.(\d+))?$/);
    if (m) { const k = m[2] ? m[2].length : 0; return red(Number(m[1] + (m[2] || '')), Math.pow(10, k)); }
    throw new Error('수 해석 실패: ' + tok);
  }
  // 보기 끝의 단위(판, L, m² 등) 제거 후 수 해석 — 실패하면 null
  function optQ(o) {
    const s = unComma(o).trim().replace(/\s*[^\d\s/과와.]+$/, '').trim();
    try { return parseQ(s); } catch (e) { return null; }
  }
  // 분수 정식 표기 일치: 정수 → "k", 진분수 → "n/d", 가분수 → "w과 r/d" (모두 기약)
  function canonFrac(n, d) {
    const [p, q] = red(n, d);
    return o => {
      const s = stripSp(o).replace(/[^\d]+$/, '');
      if (q === 1) return s === String(p);
      if (p < q) return s === `${p}/${q}`;
      const m = s.match(/^(\d+)[과와](\d+)\/(\d+)$/);
      return !!m && Number(m[1]) === Math.floor(p / q) && Number(m[2]) === p % q && Number(m[3]) === q;
    };
  }
  const byVal = target => o => { const r = optQ(o); return !!r && eq(val(r), target); };
  const round2 = x => Math.round(x * 100) / 100;
  const listNums = s => String(s).split(',').map(x => Number(x.trim()));

  return {
    // [6수01-01] 자연수의 혼합 계산 — 지문의 식을 직접 계산
    'BAS-15': (v, q) => {
      const expr = norm(q).match(/\[\s*(.+?)\s*\]/)[1];
      const js = expr.replace(/×/g, '*').replace(/÷/g, '/');
      if (!/^[\d+\-*/() ]+$/.test(js)) throw new Error('식 형식: ' + expr);
      // eslint-disable-next-line no-new-func
      const value = Function(`return (${js});`)();
      return byNums([value]);
    },

    // [6수01-02] 이상·이하·초과·미만 — 자연수 개수 또는 자료 중 개수
    'BAS-16': (v, q) => {
      const m = norm(q).match(/(\d+(?:\.\d+)?)\s*(?:cm|kg|점|분)?\s*(이상|초과)\s*(\d+(?:\.\d+)?)\s*(?:cm|kg|점|분)?\s*(이하|미만)/);
      const A = Number(m[1]), B = Number(m[3]);
      const ok = x => (m[2] === '이상' ? x >= A : x > A) && (m[4] === '이하' ? x <= B : x < B);
      let cnt = 0;
      if (v.자료 != null) cnt = listNums(v.자료).filter(ok).length;
      else for (let x = 1; x <= B + 1; x++) if (ok(x)) cnt++;
      return byNums([cnt]);
    },

    // [6수01-03] 올림·버림·반올림 — 어림값 또는 어림하기 전 수의 범위
    'BAS-17': (v, q) => {
      const s = unComma(q);
      const U = { 십: 10, 백: 100, 천: 1000 };
      const back = s.match(/(올림|버림|반올림)하여 (십|백|천)의 자리까지 나타내었더니 (\d+)/);
      if (back) {
        const R = Number(back[3]), u = U[back[2]];
        let lo, hi; // 해당하는 자연수 전체 [lo, hi]
        if (back[1] === '반올림') { lo = R - u / 2; hi = R + u / 2 - 1; }
        else if (back[1] === '올림') { lo = R - u + 1; hi = R; }
        else { lo = R; hi = R + u - 1; }
        return o => {
          const m = unComma(o).trim().match(/^(\d+) (이상|초과) (\d+) (이하|미만)$/);
          if (!m) return false;
          const a = m[2] === '이상' ? Number(m[1]) : Number(m[1]) + 1;
          const b = m[4] === '이하' ? Number(m[3]) : Number(m[3]) - 1;
          return a === lo && b === hi;
        };
      }
      const f = s.match(/(\d+)[을를] (올림|버림|반올림)하여 (십|백|천)의 자리까지 나타내면/);
      const x = Number(f[1]), u = U[f[3]];
      const r = f[2] === '올림' ? Math.ceil(x / u) * u : f[2] === '버림' ? Math.floor(x / u) * u : Math.floor(x / u + 0.5) * u;
      return byNums([r]);
    },

    // [6수01-05] 최소공배수 — 수 / 동시 출발 시각 / 가장 작은 정사각형
    'BAS-18': (v, q) => {
      if (v.타일가로 != null) {
        const a = N(v.타일가로), b = N(v.타일세로), L = lcm(a, b);
        return byNums([L, (L / a) * (L / b)]);
      }
      if (v.배차1 != null) {
        const L = lcm(N(v.배차1), N(v.배차2));
        const h = Number(norm(q).match(/오전 (\d+)시에/)[1]);
        const H2 = h + Math.floor(L / 60), M = L % 60;
        return byNums(M === 0 ? [H2] : [H2, M]);
      }
      return byNums([lcm(N(v.수1), N(v.수2))]);
    },

    // [6수01-06] 약분 — 기약분수 / 크기가 같은 분수 중 분모·분자 합 조건
    'BAS-19': v => {
      const [p, r] = parseQ(v.분수);
      if (v.분모분자합 != null) {
        const S = N(v.분모분자합), k = S / (p + r);
        return o => { const m = norm(o).trim().match(/^(\d+)\/(\d+)$/); return !!m && Number(m[1]) === p * k && Number(m[2]) === r * k; };
      }
      return o => stripSp(o) === `${p}/${r}`;
    },

    // [6수01-09] 분수의 곱셈 — 지문의 곱셈식 / 밭 넓이 × 분수 × 분수
    'BAS-20': (v, q) => {
      if (v.밭넓이 != null) {
        const r = mul(mul([N(v.밭넓이), 1], parseQ(v.비율1)), parseQ(v.비율2));
        return byVal(val(r));
      }
      const expr = norm(q).match(/\[\s*(.+?)\s*\]/)[1];
      const r = expr.split('×').map(t => parseQ(t)).reduce(mul, [1, 1]);
      return canonFrac(r[0], r[1]);
    },

    // [6수01-10] (자연수)÷(자연수)의 몫을 분수로
    'BAS-21': v => {
      let r = [N(v.나누어지는수), N(v.나누는수)];
      if (v.나누는수2 != null) r = [r[0], r[1] * N(v.나누는수2)];
      return canonFrac(r[0], r[1]);
    },

    // [6수01-12] 분수와 소수의 관계 — 소수로 나타내기 / 크기 비교 / 최대-최소 차
    'BAS-22': (v, q) => {
      if (v.분수 != null) return byNums([val(parseQ(v.분수))]);
      const items = norm(q).match(/\[\s*(.+?)\s*\]/)[1].split(',').map(t => parseQ(t));
      const vals = items.map(val);
      const mx = items[vals.indexOf(Math.max(...vals))], mn = items[vals.indexOf(Math.min(...vals))];
      if (/차/.test(q)) return byNums([val(sub(mx, mn))]);
      const target = /가장 작은/.test(q) ? val(mn) : val(mx);
      return byVal(target);
    },

    // [6수01-13] 소수의 곱셈 — 지문 곱셈식 / 1 m 무게 × 길이
    'BAS-23': (v, q) => {
      if (v.한미터무게 != null) return byNums([val(mul(parseQ(String(N(v.한미터무게))), parseQ(String(N(v.길이)))))]);
      const expr = norm(q).match(/\[\s*(.+?)\s*\]/)[1];
      return byNums([val(expr.split('×').map(t => parseQ(t)).reduce(mul, [1, 1]))]);
    },

    // [6수02-02] 비 — "기준 수에 대한 비교하는 수의 비" → 비교하는 양 : 기준량
    'BAS-24': (v, q) => {
      const m = norm(q).match(/(\S+)(?: 학생)? 수에 대한 (\S+)(?: 학생)? 수의 비/);
      const value = name => {
        if (name === '전체') return Object.values(v).reduce((s, x) => s + N(x), 0);
        if (name === '늘어난') return N(v.올해) - N(v.작년);
        if (v[name] == null) throw new Error('항목 없음: ' + name);
        return N(v[name]);
      };
      return byNums([value(m[2]), value(m[1])]);
    },

    // [6수02-04] 비례식 — 외항의 곱 = 내항의 곱으로 □ 구하기
    'BAS-25': (v, q) => {
      const s = norm(q).match(/\[\s*(.+?)\s*\]/)[1];
      const [left, right] = s.split('=');
      const t = [...left.split(':'), ...right.split(':')].map(x => x.trim());
      const k = t.indexOf('□');
      const R = t.map(x => (x === '□' ? null : parseQ(x)));
      let ans;
      // a:b = c:d  →  a×d = b×c
      if (k === 0) ans = div(mul(R[1], R[2]), R[3]);
      else if (k === 3) ans = div(mul(R[1], R[2]), R[0]);
      else if (k === 1) ans = div(mul(R[0], R[3]), R[2]);
      else ans = div(mul(R[0], R[3]), R[1]);
      return byVal(val(ans));
    },

    // [6수03-01] 합동 — 대응점으로 대응변·대응각 찾기
    'BAS-26': (v, q) => {
      const s = norm(q);
      const map = {}; // 둘째 도형 점 → 첫째 도형 점
      for (const m of s.matchAll(/점 (\S)은 점 (\S)/g)) map[m[2]] = m[1];
      const nV = Object.keys(map).length;
      const side = s.match(/변 (\S)(\S)의 길이/);
      if (side) {
        const want = [map[side[1]], map[side[2]]].sort().join('');
        for (const m of s.matchAll(/변 (\S)(\S)이 (\d+(?:\.\d+)?) cm/g)) if ([m[1], m[2]].sort().join('') === want) return byNums([Number(m[3])]);
        throw new Error('대응변 없음');
      }
      const given = {};
      for (const m of s.matchAll(/각 (\S)이 (\d+)°/g)) given[m[1]] = Number(m[2]);
      const X = map[s.match(/각 (\S)의 크기/)[1]];
      if (given[X] != null) return byNums([given[X]]);
      return byNums([(nV - 2) * 180 - Object.values(given).reduce((a, b) => a + b, 0)]);
    },

    // [6수03-02] 선대칭·점대칭 — 대칭의 중심까지 거리 / 선대칭 둘레 / 점대칭 육각형 대응변
    'BAS-27': (v, q) => {
      const s = norm(q);
      if (/대칭의 중심/.test(s)) {
        const g1 = s.match(/선분 ㄱㅇ의 길이가 (\d+(?:\.\d+)?) cm/);
        if (g1) return byNums([2 * Number(g1[1])]);
        const g2 = s.match(/선분 ㄱㄹ의 길이가 (\d+(?:\.\d+)?) cm/);
        return byNums([Number(g2[1]) / 2]);
      }
      if (/대칭축의 한쪽/.test(s)) {
        const part = s.match(/각각 (.+?)입니다/)[1];
        return byNums([2 * allNums(part).reduce((a, b) => a + b, 0)]);
      }
      const a = Number(s.match(/변 ㄱㄴ이 (\d+) cm/)[1]);
      const b = Number(s.match(/변 ㄴㄷ이 (\d+) cm/)[1]);
      const P = Number(s.match(/둘레가 (\d+) cm/)[1]);
      return byNums([P / 2 - a - b]);
    },

    // [6수03-03] 직육면체·정육면체 — 모서리 12개(같은 길이 4개씩)
    'BAS-28': v => {
      if (v.한모서리 != null) return byNums([12 * N(v.한모서리)]);
      if (v.모서리합 != null) return byNums([N(v.모서리합) / 4 - N(v.가로) - N(v.세로)]);
      return byNums([4 * (N(v.가로) + N(v.세로) + N(v.높이))]);
    },

    // [6수03-05] 각기둥·각뿔의 구성 요소 수
    'BAS-29': (v, q) => {
      const s = norm(q);
      const KO = { 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9, 십: 10 };
      let n, kind;
      const byEdge = s.match(/모서리가 (\d+)개인 각(기둥|뿔)/);
      if (byEdge) { kind = byEdge[2]; n = Number(byEdge[1]) / (kind === '기둥' ? 3 : 2); }
      else { const m = s.match(/(삼|사|오|육|칠|팔|구|십)각(기둥|뿔)의/); n = KO[m[1]]; kind = m[2]; }
      const cnt = kind === '기둥' ? { 면: n + 2, 모서리: 3 * n, 꼭짓점: 2 * n } : { 면: n + 1, 모서리: 2 * n, 꼭짓점: n + 1 };
      const two = s.match(/(면|모서리|꼭짓점)의 수와 (면|모서리|꼭짓점)의 수의 합/);
      if (two) return byNums([cnt[two[1]] + cnt[two[2]]]);
      const one = s.match(/(면|모서리|꼭짓점)의 수는/);
      return byNums([cnt[one[1]]]);
    },

    // [6수03-08] 원기둥의 전개도 — 옆면 가로 = 밑면 둘레, 세로 = 높이
    'BAS-30': (v, q) => {
      const pi = N(v.원주율);
      if (v.옆면가로 != null) { const r = N(v.옆면가로) / (2 * pi); return byNums([round2(pi * r * r)]); }
      if (v.반지름 != null) return byNums([round2(2 * pi * N(v.반지름) * N(v.높이))]);
      return byNums([round2(pi * N(v.지름))]);
    },

    // [6수03-09] 쌓기나무 개수
    'BAS-31': v => {
      const sum = listNums(v.층별개수 != null ? v.층별개수 : v.칸별개수).reduce((a, b) => a + b, 0);
      if (v.정육면체한모서리 != null) return byNums([Math.pow(N(v.정육면체한모서리), 3) - sum]);
      return byNums([sum]);
    },

    // [6수03-15] 원주율 — (원주)÷(지름), 원주로 지름 구하기, 굴러간 거리로 회전 수 구하기
    'BAS-32': v => {
      if (v.굴러간거리 != null) return byNums([round2(N(v.굴러간거리) * 100 / (N(v.원주율) * N(v.지름)))]);
      if (v.원주율 != null) return byNums([round2(N(v.원주) / N(v.원주율))]);
      return byNums([round2(N(v.원주) / N(v.지름))]);
    },

    // [6수04-04] 가능성을 말로 — 불가능하다 / ~아닐 것 같다 / 반반이다 / ~일 것 같다 / 확실하다
    'BAS-33': (v, q) => {
      const word = (a, t) => (a === 0 ? '불가능하다' : a === t ? '확실하다' : 2 * a === t ? '반반이다' : 2 * a < t ? '~아닐 것 같다' : '~일 것 같다');
      if (v.가빨간공 != null) {
        const a1 = N(v.가빨간공), t1 = a1 + N(v.가파란공), a2 = N(v.나빨간공), t2 = a2 + N(v.나파란공);
        const bag = a1 * t2 > a2 * t1 ? ['가', a1, t1] : ['나', a2, t2];
        return o => stripSp(o) === stripSp(`${bag[0]} 주머니, ${word(bag[1], bag[2])}`);
      }
      const color = norm(q).match(/(빨간|파란|노란|흰) 공이 나올 가능성/)[1];
      const t = Object.values(v).reduce((s, x) => s + N(x), 0);
      const a = v[color + '공'] != null ? N(v[color + '공']) : 0;
      return o => stripSp(o) === stripSp(word(a, t));
    },

    // [6수04-05] 가능성을 수로 — 0, 1/2, 1
    'BAS-34': (v, q) => {
      const s = norm(q);
      let fav, tot;
      const ball = s.match(/(빨간|파란|흰) 공을 꺼낼/);
      if (ball) {
        tot = Object.values(v).reduce((a, x) => a + N(x), 0);
        fav = v[ball[1] + '공'] != null ? N(v[ball[1] + '공']) : 0;
      } else if (/동전/.test(s)) { fav = 1; tot = 2; }
      else {
        const top = /주사위/.test(s) ? 6 : Number(s.match(/1부터 (\d+)까지/)[1]);
        const out = Array.from({ length: top }, (_, i) => i + 1);
        let pred;
        const c = s.match(/(\d+) (이상|이하|초과|미만)/);
        if (/짝수/.test(s)) pred = x => x % 2 === 0;
        else if (/홀수/.test(s)) pred = x => x % 2 === 1;
        else { const k = Number(c[1]); pred = { 이상: x => x >= k, 이하: x => x <= k, 초과: x => x > k, 미만: x => x < k }[c[2]]; }
        fav = out.filter(pred).length; tot = top;
      }
      return byVal(fav / tot);
    },

    // [6수04-06] 실험 자료로 가능성 예상 — 가장 넓은 색 / 예상 횟수
    'BAS-35': (v, q) => {
      const s = norm(q);
      const colors = Object.keys(v).filter(k => k !== '예상횟수');
      const T = colors.reduce((a, k) => a + N(v[k]), 0);
      if (v.예상횟수 == null) {
        const pick = /가장 좁은/.test(s) ? Math.min(...colors.map(k => N(v[k]))) : Math.max(...colors.map(k => N(v[k])));
        const c = colors.filter(k => N(v[k]) === pick);
        if (c.length !== 1) throw new Error('최댓값/최솟값 색이 하나가 아님');
        return o => o.trim() === c[0];
      }
      const M = N(v.예상횟수);
      const or = s.match(/(\S+) 또는 (\S+?)[이가] 나오는 횟수/);
      if (or) return byNums([(N(v[or[1]]) + N(v[or[2]])) * M / T]);
      const not = s.match(/(\S+?)[이가] 나오지 않는 횟수/);
      if (not) return byNums([(T - N(v[not[1]])) * M / T]);
      const one = s.match(/(\S+?)[이가] 나오는 횟수/);
      return byNums([N(v[one[1]]) * M / T]);
    }
  };
};
