/**
 * 생활 수학(life) 새 유형 LIF-15 ~ LIF-35 정답 oracle (verifier-first)
 * - 문제 지문(q)과 variablesInfo(v)의 입력값만 읽고 정답을 독립 계산한다.
 * - generate()가 만든 정답 결과값은 읽지 않는다. 공식 대신 가능한 곳은 직접 합산·전수 조사로 계산한다.
 * - 반환: matcher(option) → 정답 보기에만 true.
 */
'use strict';

module.exports = H => {
  const { norm, N, allNums, eq, arrEq, byNums, C } = H;
  const sum = a => a.reduce((s, x) => s + x, 0);
  // "2시간 24분" / "3시간" / "40분" → 분
  const durMin = o => {
    const s = norm(o).replace(/,(?=\d{3})/g, '');
    const h = s.match(/(\d+)시간/), m = s.match(/(\d+)분/);
    if (!h && !m) return NaN;
    return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  };
  // "14시 25분" / "9시" → 하루 중 분 (시간 표기는 제외)
  const clockMin = o => {
    const s = norm(o);
    if (/시간/.test(s)) return NaN;
    const h = s.match(/(\d+)시/), m = s.match(/(\d+)분/);
    if (!h) return NaN;
    return Number(h[1]) * 60 + (m ? Number(m[1]) : 0);
  };
  // "Qd = 5,000 − 2P" → [a, b]
  const demand = s => {
    const m = norm(s).replace(/,(?=\d{3})/g, '').match(/=\s*(\d+)\s*-\s*(\d*)P/);
    return [Number(m[1]), m[2] === '' ? 1 : Number(m[2])];
  };
  // "Qs = 3P − 5,000" → [d, c]
  const supply = s => {
    const m = norm(s).replace(/,(?=\d{3})/g, '').match(/=\s*(\d*)P\s*-\s*(\d+)/);
    return [m[1] === '' ? 1 : Number(m[1]), Number(m[2])];
  };

  return {
    // 급여 실수령액: 세전 − (과세 대상 × 공제율 합) − 소득세
    'LIF-15': v => {
      const S = N(v.세전월급), rate = sum(allNums(v.공제율));
      const tax = v.소득세 ? N(v.소득세) : 0, free = v.비과세 ? N(v.비과세) : 0;
      return byNums([S - (S - free) * rate / 100 - tax]);
    },
    // 원금균등 상환: 달마다 남은 원금에 월이자
    'LIF-16': (v, q) => {
      const P = N(v.대출원금), r = N(v.연이율) / 100 / 12, n = N(v.상환기간);
      if (/총 이자/.test(q)) {
        let tot = 0;
        for (let k = 0; k < n; k++) tot += (P - k * P / n) * r;
        return byNums([tot]);
      }
      if (/첫 달 상환액/.test(q)) return byNums([P / n + P * r]);
      return byNums([P * r]);
    },
    // 정기적금(단리): k번째 달에 넣은 돈은 (n − k + 1)개월 이자
    'LIF-17': (v, q) => {
      const M = N(v.월납입액), r = N(v.연이율) / 100, n = N(v.기간);
      let interest = 0;
      for (let k = 1; k <= n; k++) interest += M * r * (n - k + 1) / 12;
      if (/세후/.test(q)) return byNums([M * n + interest * (1 - N(v.이자소득세율) / 100)]);
      if (/만기 수령액/.test(q)) return byNums([M * n + interest]);
      return byNums([interest]);
    },
    // 연금의 현재 가치: 매년 말 A원씩 n회
    'LIF-18': v => {
      const A = N(v.연금액), r = N(v.연이율) / 100, n = N(v.지급횟수);
      let pv = 0;
      for (let k = 1; k <= n; k++) pv += A / Math.pow(1 + r, k);
      return byNums([pv]);
    },
    // 레시피 인분 환산
    'LIF-19': v => {
      const base = N(v.기준인분), amt = N(v.재료량);
      if (v.보유량) return byNums([Math.floor(N(v.보유량) * base / amt + 1e-9)]);
      return byNums([amt * N(v.만들인분) / base]);
    },
    // 이동 시간·도착 시각
    'LIF-20': v => {
      let t;
      if (v.거리) t = 60 * N(v.거리) / N(v.속력);
      else {
        const [d1, s1] = allNums(v['1구간']), [d2, s2] = allNums(v['2구간']);
        t = 60 * d1 / s1 + N(v.휴식) + 60 * d2 / s2;
      }
      if (v.출발시각) {
        const dep = clockMin(v.출발시각), arr = (dep + t) % 1440;
        return o => eq(clockMin(o), arr);
      }
      return o => eq(durMin(o), t);
    },
    // 평균과 중앙값
    'LIF-21': (v, q) => {
      const d = allNums(v.자료).sort((a, b) => a - b), n = d.length;
      const med = n % 2 ? d[(n - 1) / 2] : (d[n / 2 - 1] + d[n / 2]) / 2;
      const mean = sum(d) / n;
      if (/평균과 중앙값/.test(q)) return byNums([mean, med]);
      return byNums([med]);
    },
    // 세트 구성 경우의 수
    'LIF-22': (v, q) => {
      const a = N(v.메인), c = N(v.음료);
      if (!v.사이드) return byNums([a * c]);
      const b = N(v.사이드);
      return byNums([a * (/서로 다른 2가지/.test(q) ? C(b, 2) : b) * c]);
    },
    // 추첨 확률 (분수, 값 비교)
    'LIF-23': (v, q) => {
      const w = N(v.당첨), l = N(v.꽝), n = w + l;
      let num, den;
      if (/적어도/.test(q)) { num = n * (n - 1) - l * (l - 1); den = n * (n - 1); }
      else if (/연속으로 2장/.test(q)) { num = w * (w - 1); den = n * (n - 1); }
      else { num = w; den = n; }
      return o => { const m = norm(o).match(/^(\d+)\/(\d+)$/); return !!m && Number(m[1]) * den === num * Number(m[2]); };
    },
    // 비율 그래프 해석
    'LIF-24': v => {
      if (v.작년총액) {
        const d = N(v.올해총액) * N(v.올해비율) / 100 - N(v.작년총액) * N(v.작년비율) / 100;
        if (eq(d, 0)) return o => /변화 없음/.test(o);
        return o => arrEq(allNums(o), [Math.abs(d)]) && (d > 0 ? /증가/.test(o) && !/감소/.test(o) : /감소/.test(o) && !/증가/.test(o));
      }
      const T = N(v.총액), a = N(v.항목A);
      if (v.항목B) return byNums([T * (a - N(v.항목B)) / 100]);
      return byNums([T * a / 100]);
    },
    // 균형 가격 (수요 = 공급)
    'LIF-25': (v, q) => {
      const [a, b] = demand(v.수요), [d, c] = supply(v.공급), k = v.수요증가 ? N(v.수요증가) : 0;
      const P = (a + k + c) / (b + d), Q = a + k - b * P;
      return byNums(/거래량/.test(q) ? [P, Q] : [P]);
    },
    // 물품세 부과 후 균형 (공급자에게 1개당 t원)
    'LIF-26': (v, q) => {
      const [a, b] = demand(v.수요), [d, c] = supply(v.공급), t = N(v.세금);
      const P0 = (a + c) / (b + d), P1 = (a + c + d * t) / (b + d), Q1 = a - b * P1;
      if (/세수/.test(q)) return byNums([P1, Q1, t * Q1]);
      if (/소비자/.test(q)) return byNums([P1, P1 - P0]);
      return byNums([P1]);
    },
    // 큰 수의 어림(반올림)
    'LIF-27': v => {
      const U = { 천만: 1e7, 백만: 1e6, 십만: 1e5, 만: 1e4, 천: 1e3 }[v.어림.match(/^(천만|백만|십만|만|천)의 자리/)[1]];
      let x;
      if (v.수) x = N(v.수);
      else if (v.품목) { const a = allNums(v.품목); x = 0; for (let i = 0; i < a.length; i += 2) x += a[i] * a[i + 1]; }
      else x = N(v['1인당']) * N(v.인원);
      return byNums([Math.round(x / U) * U]);
    },
    // 함께 일하는 시간
    'LIF-28': v => {
      const a = N(v.A단독), b = N(v.B단독), t1 = v.A먼저 ? N(v.A먼저) : 0;
      const minutes = (1 - t1 / a) / (1 / a + 1 / b) * 60;
      return o => eq(durMin(o), minutes);
    },
    // 칠할 넓이와 페인트 통 수
    'LIF-29': v => {
      const L = N(v.가로), W = N(v.세로), cov = N(v.한통면적);
      let area = v.높이 ? 2 * (L + W) * N(v.높이) : L * W;
      if (v.제외넓이) area -= N(v.제외넓이);
      const coats = v.칠횟수 ? N(v.칠횟수) : 1;
      return byNums([Math.ceil(area * coats / cov - 1e-9)]);
    },
    // 수조 부피·들이와 채우는 시간
    'LIF-30': v => {
      const [L, W, Hh] = allNums(v.수조);
      if (!v.급수량) return byNums([L * W * Hh / 1000]);
      const h = v.목표수위 ? N(v.목표수위) - N(v.현재수위) : Hh;
      return byNums([L * W * h / 1000 / N(v.급수량)]);
    },
    // 표에서 규칙 찾기(일차 대응)
    'LIF-31': v => {
      const xs = allNums(v.시간), ys = allNums(v.요금);
      const k = (ys[1] - ys[0]) / (xs[1] - xs[0]);
      if (v.목표요금) return byNums([xs[0] + (N(v.목표요금) - ys[0]) / k]);
      return byNums([ys[0] + k * (N(v.구할시간) - xs[0])]);
    },
    // 비용 함수와 평균 비용
    'LIF-32': (v, q) => {
      const F = N(v.고정비), c = N(v.단위변동비);
      if (v.목표평균비용) {
        const T = N(v.목표평균비용);
        let x = 1; while (F / x + c > T + 1e-9) x++;
        return byNums([x]);
      }
      const x = N(v.생산량);
      return byNums([/1개당 평균 비용/.test(q) ? (F + c * x) / x : F + c * x]);
    },
    // 판매량 행렬 × 가격
    'LIF-33': (v, q) => {
      let m = allNums(v.판매량);
      if (v.판매량2) { const m2 = allNums(v.판매량2); m = m.map((x, i) => x + m2[i]); }
      const [p, r] = allNums(v.가격);
      const r1 = m[0] * p + m[1] * r, r2 = m[2] * p + m[3] * r;
      return byNums(/두 매장의 \S+ 매출/.test(q) ? [r1, r2] : [r1]);
    },
    // 수익(이윤) 최대화 가격 — 정수 가격 전수 조사
    'LIF-34': (v, q) => {
      const [a, b] = demand(v.수요), c = v.단위원가 ? N(v.단위원가) : 0;
      let best = -Infinity, bestP = 0;
      for (let P = 0; P <= a / b; P++) { const val = (P - c) * (a - b * P); if (val > best) { best = val; bestP = P; } }
      return byNums(/그때의/.test(q) ? [bestP, best] : [bestP]);
    },
    // 예산 제약 — 전수 조사
    'LIF-35': v => {
      const M = N(v.예산), p = N(v.A가격), r = N(v.B가격);
      if (v.A구매) return byNums([Math.floor((M - p * N(v.A구매)) / r)]);
      if (v.만족도) {
        const [ua, ub] = allNums(v.만족도);
        let best = 0;
        for (let x = 0; p * x <= M; x++) for (let y = 0; p * x + r * y <= M; y++) best = Math.max(best, ua * x + ub * y);
        return byNums([best]);
      }
      let cnt = 0;
      for (let x = 1; p * x <= M; x++) for (let y = 1; p * x + r * y <= M; y++) cnt++;
      return byNums([cnt]);
    }
  };
};
