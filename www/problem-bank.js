/**
 * 하루수학 (HaruSuhak) - 한국 교육과정 기반 파라메트릭 문제은행 엔진
 *
 * 특징:
 * 1. 2015/2022 개정 한국 수학과 교육과정 성취기준 전 영역 반영 (총 56개 대표 유형 템플릿)
 *    - 기초 수학 (초등 4~6학년 14개 성취기준)
 *    - 중등 수학 (중학교 1~3학년 14개 성취기준)
 *    - 고등 수학 (공통수학1·2, 대수, 미적분Ⅰ 14개 성취기준)
 *    - 생활 속 수학 (실용수학, 경제수학, 디지털 수리 14개 성취기준)
 * 2. 초·중·고 교과서, EBS, 전국연합학력평가 대표 기출 및 실생활 수리 문항 정밀 참고
 * 3. 시드 기반 난수 생성기(SeededRNG)를 통해:
 *    - 같은 날짜에는 일관된 '오늘의 문제' 출제
 *    - 2주 주기(14일) 요일별 자동 순환 스케줄러 지원
 *    - '숫자 바꿔 변형 문제 풀기' 선택 시 변수·수치·보기가 무제한 동적 변형 출제
 * 4. 학생들의 대표적 오개념(부호 실수, 역수 혼동, 단위 착오, 공식 혼동 등)을 반영한 매력적 오답 자동 생성
 */

(function (global) {
  'use strict';

  // 한국어 조사 헬퍼(www/ko.js). 브라우저는 index.html에서 먼저 로드, Node(검증기·테스트)는 여기서 require.
  if (!global.HaruKo && typeof require === 'function') require('./ko.js');
  const { withJosa: wj, josa: jo } = global.HaruKo;

  // ---------------------------------------------------------------------------
  // 1. 시드 기반 의사난수 생성기 (Mulberry32 알고리즘) & 수학 유틸리티
  // ---------------------------------------------------------------------------
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  class SeededRNG {
    constructor(seedInput) {
      this.state = typeof seedInput === 'number'
        ? (seedInput >>> 0)
        : hashString(String(seedInput || 'harusuhak'));
      if (this.state === 0) this.state = 123456789;
    }

    next() {
      let t = (this.state += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }

    pick(arr) {
      return arr[this.int(0, arr.length - 1)];
    }

    shuffle(arr) {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = this.int(0, i);
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    }
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  function lcm(a, b) {
    return Math.abs(a * b) / gcd(a, b);
  }

  function comma(n) {
    return Number(n).toLocaleString('ko-KR');
  }

  function signedTerm(coef, variable = '', isFirst = false) {
    if (coef === 0) return '';
    const abs = Math.abs(coef);
    const numStr = (abs === 1 && variable) ? '' : String(abs);
    if (isFirst) {
      return (coef < 0 ? '−' : '') + numStr + variable;
    }
    return (coef < 0 ? ' − ' : ' + ') + numStr + variable;
  }

  // 복소수 a + bi 표기: 허수부 0 → 실수만, ±1 → ±i, 음수 → "−"
  function cx(re, im) {
    if (im === 0) return `${re}`;
    const mag = Math.abs(im) === 1 ? '' : Math.abs(im);
    if (re === 0) return `${im < 0 ? '−' : ''}${mag}i`;
    return `${re} ${im > 0 ? '+' : '−'} ${mag}i`;
  }

  function buildChoiceSet(rng, correct, distractors, fallbackGenerator) {
    const correctStr = String(correct);
    const unique = [correctStr];

    for (const d of distractors) {
      const s = String(d);
      if (s && !unique.includes(s)) {
        unique.push(s);
      }
      if (unique.length === 4) break;
    }

    let attempt = 1;
    while (unique.length < 4) {
      let candidate;
      if (typeof fallbackGenerator === 'function') {
        candidate = String(fallbackGenerator(attempt));
      } else {
        const num = parseFloat(correctStr.replace(/[^0-9.-]/g, ''));
        if (!isNaN(num)) {
          const suffix = correctStr.replace(/[0-9.,-]/g, '');
          candidate = comma(num + attempt * (attempt % 2 === 0 ? 1 : -1)) + suffix;
        } else {
          candidate = correctStr + ' (' + attempt + ')';
        }
      }
      if (candidate && !unique.includes(candidate)) {
        unique.push(candidate);
      }
      attempt++;
      if (attempt > 30) break;
    }

    const shuffled = rng.shuffle(unique.slice(0, 4));
    const answerIndex = shuffled.indexOf(correctStr);
    return {
      options: shuffled,
      answerIndex: answerIndex >= 0 ? answerIndex : 0
    };
  }

  // ---------------------------------------------------------------------------
  // 2. 수준별 교육과정 메타데이터 및 56개 문제은행 템플릿 정의
  // ---------------------------------------------------------------------------
  const CURRICULUM_PACKS = {
    // =========================================================================
    // [1] 기초 수학 (초등 4~6학년 교육과정 14개 대표 유형)
    // =========================================================================
    basic: {
      id: 'basic',
      level: '기초 수학',
      targetGrade: '초등 5~6학년 과정',
      title: '수와 연산·도형·비율·측정의 기초',
      desc: '초등 수학 교과서의 핵심인 약분과 통분, 약수와 배수, 분수와 소수의 사칙연산, 비와 비율, 다각형과 원의 넓이, 입체도형의 부피를 탄탄하게 다져 보자.',
      miniTitle: '기준과 단위, 수학의 첫걸음',
      miniDesc: '기준량과 단위(분모, cm, L 등)가 서로 다르면 직접 더하거나 비교할 수 없어. 공통된 기준으로 맞추는 통분과 단위 환산은 중·고등학교 대수와 기하의 가장 중요한 밑거름이야.',
      formula: 'a/b = (a×k)/(b×k),  비율 = 비교하는 양 ÷ 기준량',
      example: '예: 2/3와 3/4을 비교할 때 최소공배수 12로 통분하면 8/12 < 9/12이므로 3/4이 더 커.',
      templates: [
        {
          id: 'BAS-01',
          dayIndex: 0,
          unit: '초5~6 · 약분과 통분',
          standardCode: '[6수01-07]',
          standardName: '분모가 다른 분수의 크기를 비교하고 그 방법을 설명할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 (약분과 통분, 분수의 크기 비교)',
          difficulty: '★☆☆ 기초',
          conceptSummary: '분모가 다른 두 분수는 두 분모의 최소공배수를 공통분모로 하여 통분한 뒤 분자의 크기를 비교합니다.',
          formula: 'a/b 와 c/d 비교 → (a×d)/(b×d) 와 (c×b)/(b×d)',
          tierGuide: {
            easy: '한 분모가 다른 분모의 배수 — 큰 분모로만 맞추면 되는 비교',
            normal: '서로소인 두 분모를 통분해 비교',
            hard: '공약수가 있는 두 분모 — 최소공배수로 통분(분모의 곱과 구별)'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              // 하: 배수 관계 분모 / 상: 공약수가 있는 분모(최소공배수 ≠ 분모의 곱)
              const pool = tier === 'easy'
                ? [[2, 4], [3, 6], [2, 6], [4, 8], [3, 9], [5, 10], [2, 8], [4, 12], [2, 10], [3, 12]]
                : [[4, 6], [6, 8], [6, 9], [8, 12], [9, 12], [10, 15], [4, 10], [6, 10], [12, 18], [10, 12], [8, 10], [6, 15]];
              const [b, d] = rng.pick(pool);
              let a = 1;
              let c = 1;
              for (let t = 0; t < 40; t++) {
                a = rng.int(1, b - 1);
                c = rng.int(1, d - 1);
                if (a * d !== c * b) break;
              }
              if (a * d === c * b) c = c === 1 ? 2 : c - 1;
              const common = lcm(b, d);
              const na = a * (common / b);
              const nc = c * (common / d);
              const f1 = `${a}/${b}`;
              const f2 = `${c}/${d}`;
              const bigger = na > nc ? f1 : f2;
              const smaller = na > nc ? f2 : f1;
              const diff = Math.abs(na - nc);
              const diffVal = diff / common;
              const correct = `${wj(bigger, '이/가')} ${diff}/${common}만큼 더 크다`;
              const cand = [`${wj(smaller, '이/가')} ${diff}/${common}만큼 더 크다`];
              const w1 = Math.abs(a - c) || 1;
              if (w1 / (b + d) !== diffVal) cand.push(`${wj(bigger, '이/가')} ${w1}/${b + d}만큼 더 크다`);
              const pd = Math.abs(a * d - c * b);
              if (diff / (b * d) !== diffVal) cand.push(`${wj(bigger, '이/가')} ${diff}/${b * d}만큼 더 크다`);
              else if (pd / common !== diffVal) cand.push(`${wj(bigger, '이/가')} ${pd}/${common}만큼 더 크다`);
              cand.push('두 분수의 크기가 같다');
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `두 분수 ${wj(f1, '과/와')} ${f2}의 크기를 비교한 설명으로 옳은 것은?`,
                variablesInfo: { 분수1: f1, 분수2: f2, 공통분모: common },
                options,
                answerIndex,
                hint: tier === 'easy'
                  ? `${wj(Math.max(b, d), '은/는')} ${Math.min(b, d)}의 배수예요. 큰 분모 ${wj(common, '으로/로')} 맞춰 보세요.`
                  : `분모의 곱 ${b * d}보다 작은 공통분모가 있어요. ${wj(b, '과/와')} ${d}의 최소공배수를 찾아보세요.`,
                steps: [
                  `두 분모 ${wj(b, '과/와')} ${d}의 최소공배수는 ${common}입니다.`,
                  `${f1} = ${na}/${common}, ${f2} = ${nc}/${common}입니다.`,
                  `분자를 비교하면 ${na} ${na > nc ? '>' : '<'} ${nc}이므로, ${wj(bigger, '이/가')} ${diff}/${common}만큼 더 큽니다.`
                ]
              };
            }
            const denoms = [[3, 4], [3, 5], [4, 5], [4, 7], [5, 6], [5, 8], [6, 7], [7, 9]];
            const [b, d] = rng.pick(denoms);
            const a = rng.int(1, b - 1);
            let c = rng.int(1, d - 1);
            if (a * d === c * b) {
              c = Math.min(d - 1, c + 1);
              if (a * d === c * b) c = Math.max(1, c - 2);
            }
            const common = lcm(b, d);
            const na = a * (common / b);
            const nc = c * (common / d);
            const f1 = `${a}/${b}`;
            const f2 = `${c}/${d}`;
            const bigger = na > nc ? f1 : f2;
            const diff = Math.abs(na - nc);

            const correct = `${wj(bigger, '이/가')} ${diff}/${common}만큼 더 크다`;
            const smaller = na > nc ? f2 : f1;
            const distractors = [
              `${wj(smaller, '이/가')} ${diff}/${common}만큼 더 크다`,
              `${wj(bigger, '이/가')} ${Math.abs(a - c) || 1}/${b + d}만큼 더 크다`,
              `두 분수의 크기가 같다`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `두 분수 ${wj(f1, '과/와')} ${f2}의 크기를 비교한 설명으로 옳은 것은?`,
              variablesInfo: { 분수1: f1, 분수2: f2, 공통분모: common },
              options,
              answerIndex,
              hint: `두 분모 ${wj(b, '과/와')} ${d}의 최소공배수인 ${wj(common, '으로/로')} 통분해 보세요.`,
              steps: [
                `두 분모 ${wj(b, '과/와')} ${d}의 최소공배수는 ${common}입니다.`,
                `${f1} = (${a}×${common / b})/(${b}×${common / b}) = ${na}/${common}이고, ${f2} = (${c}×${common / d})/(${d}×${common / d}) = ${nc}/${common}입니다.`,
                `분자를 비교하면 ${na} ${na > nc ? '>' : '<'} ${nc}이므로, ${wj(bigger, '이/가')} ${diff}/${common}만큼 더 큽니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-02',
          dayIndex: 1,
          unit: '초5~6 · 약수와 배수',
          standardCode: '[6수01-04]',
          standardName: '약수, 공약수, 최대공약수를 이해하고 구할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 (최대공약수의 실생활 활용)',
          difficulty: '★★☆ 표준',
          conceptSummary: '남김없이 똑같이 나누어 주는 최대 인원수를 구할 때는 최대공약수를 이용합니다.',
          formula: '(최대 인원수) = 두 수의 최대공약수(GCD)',
          tierGuide: {
            easy: '작은 수(최대공약수 2~6)로 최대공약수 구하기',
            normal: '두 자리 수의 최대공약수로 나누어 주기',
            hard: '큰 수 — 공약수와 최대공약수를 구별해야 하는 나누어 주기'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const g = easy ? rng.pick([2, 3, 4, 5, 6]) : rng.pick([12, 14, 15, 16, 18, 20, 24]);
              const [m1, m2] = rng.pick(easy ? [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5]] : [[3, 4], [4, 5], [5, 6], [4, 7], [5, 7], [3, 8], [5, 8]]);
              const itemA = g * m1;
              const itemB = g * m2;
              const items = rng.pick([
                ['공책', '연필', '권', '자루'],
                ['사과', '귤', '개', '개'],
                ['초콜릿', '사탕', '개', '개']
              ]);
              const share = (n, x, y) => `${n}명 (1명당 ${items[0]} ${x}${items[2]}, ${items[1]} ${y}${items[3]})`;
              const correct = share(g, m1, m2);
              // 공약수이지만 최대가 아닌 수(g의 약수)로 나눈 경우 — 대표 오개념
              const sub = [2, 3, 4, 5].find(k => g % k === 0 && g / k > 1) || 1;
              const cand = [
                share(g, m2, m1),
                sub > 1 ? share(g / sub, m1 * sub, m2 * sub) : share(m1 * m2, g, g),
                share(m1 * m2, g, g),
                share(g * 2, Math.max(1, m1 - 1), m2)
              ];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `${items[0]} ${itemA}${wj(items[2], '과/와')} ${items[1]} ${itemB}${wj(items[3], '을/를')} 남김없이 최대한 많은 학생에게 똑같이 나누어 주려고 합니다. 최대 몇 명에게 나누어 줄 수 있으며, 한 명이 받는 양은 얼마인가요?`,
                variablesInfo: { [items[0]]: itemA, [items[1]]: itemB, 최대공약수: g },
                options,
                answerIndex,
                hint: easy
                  ? `${wj(itemA, '과/와')} ${itemB}의 약수를 각각 써 보고, 공통인 약수 중 가장 큰 수를 찾아보세요.`
                  : `공약수는 여러 개예요. '최대한 많은 학생'이므로 공약수 중 가장 큰 수를 골라야 해요.`,
                steps: [
                  `남김없이 최대한 많은 학생에게 똑같이 나누어 주어야 하므로 ${wj(itemA, '과/와')} ${itemB}의 최대공약수를 구합니다.`,
                  `${itemA} = ${g} × ${m1}, ${itemB} = ${g} × ${m2} (${m1}, ${wj(m2, '은/는')} 서로소)이므로 최대공약수는 ${g}입니다.`,
                  `따라서 최대 ${g}명에게 나누어 줄 수 있고, 한 명당 ${items[0]} ${itemA}÷${g}=${m1}${items[2]}, ${items[1]} ${itemB}÷${g}=${m2}${items[3]}씩 받습니다.`
                ]
              };
            }
            const g = rng.pick([4, 5, 6, 7, 8, 9, 12]);
            const pairs = [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [3, 7]];
            const [m1, m2] = rng.pick(pairs);
            const itemA = g * m1;
            const itemB = g * m2;
            const items = rng.pick([
              ['공책', '연필', '권', '자루'],
              ['사과', '귤', '개', '개'],
              ['초콜릿', '사탕', '개', '개']
            ]);

            const correct = `${g}명 (1명당 ${items[0]} ${m1}${items[2]}, ${items[1]} ${m2}${items[3]})`;
            const distractors = [
              `${g}명 (1명당 ${items[0]} ${m2}${items[2]}, ${items[1]} ${m1}${items[3]})`,
              `${m1 * m2}명 (1명당 ${items[0]} ${g}${items[2]}, ${items[1]} ${g}${items[3]})`,
              `${g * 2}명 (1명당 ${items[0]} ${Math.max(1, m1 - 1)}${items[2]}, ${items[1]} ${m2}${items[3]})`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `${items[0]} ${itemA}${wj(items[2], '과/와')} ${items[1]} ${itemB}${wj(items[3], '을/를')} 남김없이 최대한 많은 학생에게 똑같이 나누어 주려고 합니다. 최대 몇 명에게 나누어 줄 수 있으며, 한 명이 받는 양은 얼마인가요?`,
              variablesInfo: { [items[0]]: itemA, [items[1]]: itemB, 최대공약수: g },
              options,
              answerIndex,
              hint: `${wj(itemA, '과/와')} ${wj(itemB, '을/를')} 동시에 나누어떨어지게 하는 가장 큰 수(최대공약수)를 구해 보세요.`,
              steps: [
                `남김없이 최대한 많은 학생에게 똑같이 나누어 주어야 하므로 ${wj(itemA, '과/와')} ${itemB}의 최대공약수를 구합니다.`,
                `${itemA} = ${g} × ${m1}, ${itemB} = ${g} × ${m2} (${m1}, ${wj(m2, '은/는')} 서로소)이므로 최대공약수는 ${g}입니다.`,
                `따라서 최대 ${g}명에게 나누어 줄 수 있고, 한 명당 ${items[0]} ${itemA}÷${g}=${m1}${items[2]}, ${items[1]} ${itemB}÷${g}=${m2}${items[3]}씩 받습니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-03',
          dayIndex: 2,
          unit: '초5~6 · 분수의 덧셈과 뺄셈',
          standardCode: '[6수01-08]',
          standardName: '분모가 다른 분수의 덧셈과 뺄셈의 계산 원리를 탐구하고 그 계산을 할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 (분모가 다른 분수의 덧셈)',
          difficulty: '★★☆ 표준',
          conceptSummary: '분모가 다른 분수의 덧셈은 통분하여 분모를 같게 만든 뒤 분자끼리 더하고, 기약분수로 나타냅니다.',
          formula: 'a/b + c/d = (ad + bc) / bd',
          tierGuide: {
            easy: '한 분모가 다른 분모의 배수인 덧셈',
            normal: '서로소인 분모의 덧셈과 기약분수',
            hard: '공약수가 있는 분모 — 최소공배수 통분 후 약분·대분수까지'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const pool = tier === 'easy'
                ? [[2, 4], [3, 6], [2, 6], [4, 8], [2, 8], [3, 9], [5, 10], [2, 10]]
                : [[4, 6], [6, 8], [6, 9], [8, 12], [9, 12], [10, 15], [6, 10], [4, 10], [12, 18], [10, 12]];
              const [b, d] = rng.pick(pool);
              const a = rng.int(1, b - 1);
              const c = rng.int(1, d - 1);
              const den = lcm(b, d);
              const num = a * (den / b) + c * (den / d);
              const g = gcd(num, den);
              const rNum = num / g;
              const rDen = den / g;
              const ff = (n, m) => {
                const k = gcd(n, m);
                n /= k; m /= k;
                if (n >= m) {
                  const whole = Math.floor(n / m);
                  const rem = n % m;
                  return rem === 0 ? `${whole}` : `${wj(whole, '과/와')} ${rem}/${m} (${n}/${m})`;
                }
                return `${n}/${m}`;
              };
              const correct = ff(rNum, rDen);
              const cand = [
                `${a + c}/${b + d}`,
                ff(Math.abs(a * (den / b) - c * (den / d)) || 1, den),
                ff(rNum + 1, rDen),
                ff(a * c, b * d),
                ff(a + c, den)
              ];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `다음 분수의 덧셈을 계산하여 기약분수로 나타낸 값은?  [ ${a}/${b} + ${c}/${d} ]`,
                variablesInfo: { 첫째분수: `${a}/${b}`, 둘째분수: `${c}/${d}` },
                options,
                answerIndex,
                hint: tier === 'easy'
                  ? `${wj(Math.max(b, d), '은/는')} ${Math.min(b, d)}의 배수예요. 분모를 ${wj(den, '으로/로')} 맞춘 뒤 분자끼리 더하세요.`
                  : `분모의 곱 ${b * d} 대신 최소공배수 ${wj(den, '으로/로')} 통분하면 계산이 간단해요. 마지막에 약분을 잊지 마세요.`,
                steps: [
                  `분모 ${wj(b, '과/와')} ${d}의 최소공배수는 ${den}입니다.`,
                  `${a}/${b} = ${a * (den / b)}/${den}, ${c}/${d} = ${c * (den / d)}/${wj(den, '으로/로')} 통분합니다.`,
                  `두 분수를 더하면 (${a * (den / b)} + ${c * (den / d)})/${den} = ${num}/${den}이며, 기약분수로 정리하면 ${correct}입니다.`
                ]
              };
            }
            const pairs = [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [3, 7], [5, 6]];
            const [b, d] = rng.pick(pairs);
            const a = rng.int(1, b - 1);
            const c = rng.int(1, d - 1);
            const den = lcm(b, d);
            const num = a * (den / b) + c * (den / d);
            const g = gcd(num, den);
            const rNum = num / g;
            const rDen = den / g;

            function formatFrac(n, m) {
              if (n >= m) {
                const whole = Math.floor(n / m);
                const rem = n % m;
                return rem === 0 ? `${whole}` : `${wj(whole, '과/와')} ${rem}/${m} (${n}/${m})`;
              }
              return `${n}/${m}`;
            }

            const correct = formatFrac(rNum, rDen);
            const wrong1 = `${a + c}/${b + d}`;
            const wrong2 = formatFrac(Math.abs(a * (den / b) - c * (den / d)) || 1, den);
            const wrong3 = formatFrac(rNum + 1, rDen);
            const { options, answerIndex } = buildChoiceSet(rng, correct, [wrong1, wrong2, wrong3]);

            return {
              question: `다음 분수의 덧셈을 계산하여 기약분수로 나타낸 값은?  [ ${a}/${b} + ${c}/${d} ]`,
              variablesInfo: { 첫째분수: `${a}/${b}`, 둘째분수: `${c}/${d}` },
              options,
              answerIndex,
              hint: `분모끼리 직접 더하면 안 돼요! 두 분모 ${wj(b, '과/와')} ${d}의 최소공배수 ${wj(den, '으로/로')} 통분한 뒤 분자끼리 더해 보세요.`,
              steps: [
                `분모 ${wj(b, '과/와')} ${d}의 최소공배수는 ${den}입니다.`,
                `${a}/${b} = ${a * (den / b)}/${den}, ${c}/${d} = ${c * (den / d)}/${wj(den, '으로/로')} 통분합니다.`,
                `두 분수를 더하면 (${a * (den / b)} + ${c * (den / d)})/${den} = ${num}/${den}이며, 기약분수로 정리하면 ${correct}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-04',
          dayIndex: 3,
          unit: '초5~6 · 비와 비율',
          standardCode: '[6수02-03]',
          standardName: '비율을 이해하고, 비율을 분수, 소수, 백분율로 나타낼 수 있다.',
          sourceRef: '초등 5~6학년군 변화와 관계 (비율과 백분율)',
          difficulty: '★★☆ 표준',
          conceptSummary: '백분율(%)은 기준량을 100으로 할 때의 비율입니다. (비율) = (비교하는 양) ÷ (기준량) × 100',
          formula: '백분율(%) = (비교하는 양 / 기준량) × 100',
          tierGuide: {
            easy: '기준량 10·20·50·100 — 10% 단위 백분율',
            normal: '교과서 수준 기준량의 백분율',
            hard: '기준량이 커지고 백분율이 소수(예: 32.5%)로 나오는 경우'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              let base;
              let part;
              if (tier === 'easy') {
                base = rng.pick([10, 20, 50, 100]);
                part = (base * rng.pick([10, 20, 30, 40, 60, 70, 80, 90])) / 100;
              } else {
                base = rng.pick([40, 80, 120, 160, 250, 400]);
                part = rng.int(1, base - 1);
                for (let t = 0; t < 60 && ((1000 * part) % base !== 0 || (100 * part) % base === 0); t++) part = rng.int(1, base - 1);
                if ((1000 * part) % base !== 0) part = base / 8 * 3; // 37.5%
              }
              const pct = Number(((part * 100) / base).toFixed(1));
              const context = rng.pick([
                { desc: `농구 연습에서 자유투를 ${base}번 던져 ${part}번 성공했습니다.` },
                { desc: `학생 ${base}명 중 수학을 좋아하는 학생이 ${part}명입니다.` },
                { desc: `전체 ${base}mL 음료수에 순수 과즙이 ${part}mL 들어 있습니다.` }
              ]);
              const correct = `${pct}%`;
              const cand = [
                `${part}%`,
                `${Number((100 - pct).toFixed(1))}%`,
                `${Number((part / base).toFixed(3))}%`,
                `${Math.round((base / part) * 10)}%`,
                `${pct * 10}%`
              ];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `${context.desc} 전체에 대한 비율을 백분율(%)로 나타내면 얼마인가요?`,
                variablesInfo: { 기준량: base, 비교하는양: part, 백분율: `${pct}%` },
                options,
                answerIndex,
                hint: tier === 'easy'
                  ? `기준량 ${base}에 대한 비교하는 양 ${part}의 비율에 100을 곱해 보세요.`
                  : `비율 ${wj(`${part}/${base}`, '을/를')} 소수로 바꾼 뒤 100을 곱하세요. 비율(소수)과 백분율(%)을 혼동하지 마세요.`,
                steps: [
                  `기준량은 ${base}, 비교하는 양은 ${part}이므로 비율은 ${part}/${base}입니다.`,
                  `${part}/${base} = ${Number((part / base).toFixed(4))}입니다.`,
                  `백분율은 비율에 100을 곱한 값이므로 ${Number((part / base).toFixed(4))} × 100 = ${pct}%입니다.`
                ]
              };
            }
            const base = rng.pick([20, 25, 40, 50, 80, 200]);
            const pct = rng.pick([15, 20, 25, 30, 35, 40, 60, 75, 80]);
            const part = (base * pct) / 100;
            if (!Number.isInteger(part)) return this.generate(rng);

            const context = rng.pick([
              { title: '자유투 성공률', unit: '개', desc: `농구 연습에서 자유투를 ${base}번 던져 ${part}번 성공했습니다.` },
              { title: '설문 응답률', unit: '명', desc: `학생 ${base}명 중 수학을 좋아하는 학생이 ${part}명입니다.` },
              { title: '과즙 함량 비율', unit: 'mL', desc: `전체 ${base}mL 음료수에 순수 과즙이 ${part}mL 들어 있습니다.` }
            ]);

            const correct = `${pct}%`;
            const distractors = [
              `${part}%`,
              `${100 - pct}%`,
              `${Math.round((base / part) * 10)}%`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `${context.desc} 전체에 대한 비율을 백분율(%)로 나타내면 얼마인가요?`,
              variablesInfo: { 기준량: base, 비교하는양: part, 백분율: `${pct}%` },
              options,
              answerIndex,
              hint: `기준량은 ${base}, 비교하는 양은 ${part}입니다. (${part} ÷ ${base}) × 100을 계산해 보세요.`,
              steps: [
                `전체 기준량은 ${base}, 비교하는 양은 ${part}입니다.`,
                `비율을 분수로 나타내면 ${part}/${base}입니다.`,
                `백분율은 비율에 100을 곱한 값이므로 (${part}/${base}) × 100 = ${pct}%입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-05',
          dayIndex: 4,
          unit: '초5~6 · 다각형의 넓이 (사다리꼴)',
          standardCode: '[6수03-14]',
          standardName: '평행사변형, 삼각형, 사다리꼴, 마름모의 넓이를 구하는 방법을 다양하게 추론하고, 이와 관련된 문제를 해결할 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (사다리꼴의 넓이)',
          difficulty: '★★☆ 표준',
          conceptSummary: '사다리꼴의 넓이는 합동인 사다리꼴 2개를 이어 붙여 만든 평행사변형의 넓이의 절반과 같습니다.',
          formula: '사다리꼴의 넓이 = (윗변 + 아랫변) × 높이 ÷ 2',
          tierGuide: {
            easy: '한 자리 수 변과 짝수 높이 — 공식 바로 적용',
            normal: '교과서 수준 사다리꼴의 넓이',
            hard: '아랫변을 조건(윗변보다 □cm 더 김)으로 구한 뒤, 홀수 높이로 소수 넓이까지'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const top = easy ? rng.int(2, 6) : rng.int(5, 15);
              const gap = easy ? rng.int(2, 5) : rng.int(3, 12);
              const bottom = top + gap;
              const height = easy ? rng.pick([2, 4, 6, 8]) : rng.pick([5, 7, 9, 11, 13]);
              const area = ((top + bottom) * height) / 2;
              const correct = `${area} cm²`;
              const cand = [`${(top + bottom) * height} cm²`, `${top * bottom} cm²`, `${area + height} cm²`, `${(top + top) * height / 2} cm²`];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: easy
                  ? `윗변의 길이가 ${top}cm, 아랫변의 길이가 ${bottom}cm, 높이가 ${height}cm인 사다리꼴의 넓이는 몇 cm²인가요?`
                  : `윗변의 길이가 ${top}cm이고, 아랫변은 윗변보다 ${gap}cm 더 길며, 높이가 ${height}cm인 사다리꼴의 넓이는 몇 cm²인가요?`,
                variablesInfo: { 윗변: `${top}cm`, 아랫변: `${bottom}cm`, 높이: `${height}cm` },
                figure: { type: 'trapezoid', top, bottom, height, unknown: 'area' },
                options,
                answerIndex,
                hint: easy
                  ? `(윗변 + 아랫변) × 높이 ÷ 2 에 그대로 넣어 보세요.`
                  : `먼저 아랫변을 구하세요: ${top} + ${gap}. 그다음 공식에 넣고, 2로 나누면 소수가 나올 수 있어요.`,
                steps: [
                  easy ? `윗변과 아랫변의 길이의 합은 ${top} + ${bottom} = ${top + bottom}(cm)입니다.` : `아랫변은 ${top} + ${gap} = ${bottom}(cm)이므로 윗변과 아랫변의 합은 ${top + bottom}(cm)입니다.`,
                  `여기에 높이 ${height}cm를 곱하면 ${top + bottom} × ${height} = ${(top + bottom) * height}입니다.`,
                  `마지막으로 2로 나누면 ${(top + bottom) * height} ÷ 2 = ${area}(cm²)가 됩니다.`
                ]
              };
            }
            const top = rng.int(4, 10);
            const bottom = top + rng.int(2, 8);
            const height = rng.pick([4, 6, 8, 10, 12]);
            const area = ((top + bottom) * height) / 2;

            const correct = `${area} cm²`;
            const distractors = [
              `${(top + bottom) * height} cm²`,
              `${top * bottom} cm²`,
              `${area + height} cm²`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `윗변의 길이가 ${top}cm, 아랫변의 길이가 ${bottom}cm, 높이가 ${height}cm인 사다리꼴의 넓이는 몇 cm²인가요?`,
              variablesInfo: { 윗변: `${top}cm`, 아랫변: `${bottom}cm`, 높이: `${height}cm` },
              figure: { type: 'trapezoid', top, bottom, height, unknown: 'area' },
              options,
              answerIndex,
              hint: `사다리꼴의 넓이 공식은 (윗변 + 아랫변) × 높이 ÷ 2 입니다. 마지막에 2로 나누는 것을 잊지 마세요!`,
              steps: [
                `윗변과 아랫변의 길이의 합을 구하면 ${top} + ${bottom} = ${top + bottom}(cm)입니다.`,
                `여기에 높이 ${height}cm를 곱하면 (${top + bottom}) × ${height} = ${(top + bottom) * height}입니다.`,
                `마지막으로 2로 나누면 ${(top + bottom) * height} ÷ 2 = ${area}(cm²)가 됩니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-06',
          dayIndex: 5,
          unit: '초5~6 · 비례식과 비례배분',
          standardCode: '[6수02-05]',
          standardName: '비례배분을 알고, 주어진 양을 비례배분 할 수 있다.',
          sourceRef: '초등 5~6학년군 변화와 관계 (비례배분)',
          difficulty: '★★☆ 표준',
          conceptSummary: '전체를 주어진 비로 나누는 것을 비례배분이라 하며, 전체의 양에 (각 항) ÷ (전항+후항)을 곱하여 구합니다.',
          formula: '비 a : b로 전체 T를 나눌 때 → T × a/(a+b), T × b/(a+b)',
          tierGuide: {
            easy: '1 : 2, 2 : 3처럼 간단한 비로 작은 수 나누기',
            normal: '교과서 수준의 비례배분',
            hard: '5 : 7, 7 : 11처럼 항이 큰 비로 세 자리 수 나누기'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const [r1, r2] = rng.pick(easy ? [[1, 2], [1, 3], [2, 3], [1, 4], [3, 2], [2, 1]] : [[5, 7], [4, 9], [7, 8], [5, 9], [7, 11], [8, 13], [9, 4]]);
              const sumR = r1 + r2;
              const unit = easy ? rng.int(2, 9) : rng.int(8, 25);
              const total = sumR * unit;
              const askLarger = rng.next() > 0.5;
              const targetRatio = askLarger ? Math.max(r1, r2) : Math.min(r1, r2);
              const otherRatio = askLarger ? Math.min(r1, r2) : Math.max(r1, r2);
              const ans = unit * targetRatio;
              const cand = [`${unit * otherRatio}개`, `${Math.round(total / targetRatio)}개`, `${ans + sumR}개`, `${unit}개`, `${total - unit}개`];
              const correct = `${ans}개`;
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand.filter(s => s !== correct));
              return {
                question: `구슬 ${total}개를 민수와 지영이가 ${r1} : ${r2}의 비로 나누어 가지려고 합니다. ${askLarger ? '더 많이' : '더 적게'} 가지는 사람의 구슬은 몇 개인가요?`,
                variablesInfo: { 전체구슬: total, 비: `${r1}:${r2}`, 구하는비율: `${targetRatio}/${sumR}` },
                options,
                answerIndex,
                hint: easy
                  ? `전체를 ${r1} + ${r2} = ${sumR}묶음으로 나누어 한 묶음이 몇 개인지 먼저 구해 보세요.`
                  : `전체의 ${targetRatio}/${sumR}만큼입니다. ${total} ÷ ${wj(sumR, '을/를')} 먼저 계산하면 쉬워요.`,
                steps: [
                  `전체를 나누는 비의 합은 ${r1} + ${r2} = ${sumR}이므로 한 묶음은 ${total} ÷ ${sumR} = ${unit}개입니다.`,
                  `${askLarger ? '더 많이' : '더 적게'} 가지는 쪽은 전체의 ${targetRatio}/${wj(sumR, '을/를')} 차지합니다.`,
                  `따라서 ${total} × (${targetRatio}/${sumR}) = ${unit} × ${targetRatio} = ${ans}개입니다.`
                ]
              };
            }
            const ratios = [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [3, 7]];
            const [r1, r2] = rng.pick(ratios);
            const sumR = r1 + r2;
            const unit = rng.int(4, 15);
            const total = sumR * unit;
            const askLarger = rng.next() > 0.5;
            const targetRatio = askLarger ? Math.max(r1, r2) : Math.min(r1, r2);
            const otherRatio = askLarger ? Math.min(r1, r2) : Math.max(r1, r2);
            // total = sumR × unit 이라 정확히 정수지만 부동소수(62.999…) 방지를 위해 반올림
            const ans = Math.round(total * targetRatio / sumR);

            const correct = `${ans}개`;
            const distractors = [
              `${Math.round(total * otherRatio / sumR)}개`,
              `${Math.round(total / targetRatio)}개`,
              `${ans + sumR}개`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `구슬 ${total}개를 민수와 지영이가 ${r1} : ${r2}의 비로 나누어 가지려고 합니다. ${askLarger ? '더 많이' : '더 적게'} 가지는 사람의 구슬은 몇 개인가요?`,
              variablesInfo: { 전체구슬: total, 비: `${r1}:${r2}`, 구하는비율: `${targetRatio}/${sumR}` },
              options,
              answerIndex,
              hint: `비의 전항과 후항의 합은 ${r1} + ${r2} = ${sumR}입니다. 전체 ${total}개 중 ${targetRatio}/${sumR}만큼을 계산해 보세요.`,
              steps: [
                `전체를 나누는 비의 합은 ${r1} + ${r2} = ${sumR}입니다.`,
                `${askLarger ? '더 많이' : '더 적게'} 가지는 쪽은 전체의 ${targetRatio}/${wj(sumR, '을/를')} 차지합니다.`,
                `따라서 ${total} × (${targetRatio}/${sumR}) = ${ans}개입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-07',
          dayIndex: 6,
          unit: '초5~6 · 평균',
          standardCode: '[6수04-01]',
          standardName: '평균의 의미를 알고, 자료를 수집하여 평균을 구하고 해석할 수 있다.',
          sourceRef: '초등 5~6학년군 자료와 가능성 (평균의 역산)',
          difficulty: '★★★ 실력',
          conceptSummary: '(평균) = (자료의 값의 합) ÷ (자료의 수)이므로, (자료의 값의 합) = (평균) × (자료의 수)를 이용해 빠진 값을 구할 수 있습니다.',
          formula: '자료의 총합 = 평균 × 자료의 개수',
          tierGuide: {
            easy: '두 번의 점수로 세 번째 점수 구하기',
            normal: '세 번의 점수로 네 번째 점수 구하기',
            hard: '네 번의 점수로 다섯 번째 점수 구하기(총합 계산이 길어짐)'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const k = easy ? 2 : 4; // 기존 시험 횟수
              const ORD = { 3: '세', 4: '네', 5: '다섯' };
              const KNUM = { 2: '두', 4: '네' };
              let targetAvg = 0;
              let scores = [];
              let last = 0;
              for (let t = 0; t < 60; t++) {
                targetAvg = easy ? rng.int(70, 90) : rng.int(82, 93);
                scores = Array.from({ length: k }, () => targetAvg + rng.int(-7, 6));
                last = targetAvg * (k + 1) - scores.reduce((a, b) => a + b, 0);
                if (last <= 100 && last >= 50 && last !== targetAvg && scores.every(s => s <= 100)) break;
              }
              const sum = scores.reduce((a, b) => a + b, 0);
              const correct = `${last}점`;
              const cand = [`${targetAvg}점`, `${Math.round(sum / k)}점`, `${last + k + 1}점`, `${Math.round((sum + targetAvg) / (k + 1))}점`, `${last - k - 1}점`];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand.filter(s => s !== correct));
              const list = scores.map(s => `${s}점`).join(', ');
              return {
                question: `${KNUM[k]} 번의 수학 단원평가에서 ${wj(list, '을/를')} 받았습니다. ${ORD[k + 1]} 번째 시험까지 합쳐 ${k + 1}회 평균이 정확히 ${targetAvg}점이 되려면 ${ORD[k + 1]} 번째 시험에서 몇 점을 받아야 하나요?`,
                variablesInfo: { 기존점수: scores.join(', '), 목표평균: targetAvg },
                options,
                answerIndex,
                hint: `${k + 1}번 시험의 평균이 ${targetAvg}점이려면 ${k + 1}번 점수의 총합이 ${targetAvg} × ${k + 1}점이어야 해요!`,
                steps: [
                  `${k + 1}회 시험의 평균이 ${targetAvg}점이 되려면 점수의 총합은 ${targetAvg} × ${k + 1} = ${targetAvg * (k + 1)}점이어야 합니다.`,
                  `지금까지 받은 점수의 합은 ${scores.join(' + ')} = ${sum}점입니다.`,
                  `따라서 ${ORD[k + 1]} 번째 시험에서 받아야 할 점수는 ${targetAvg * (k + 1)} − ${sum} = ${last}점입니다.`
                ]
              };
            }
            const targetAvg = rng.int(80, 94);
            const d1 = rng.int(-8, -2);
            const d2 = rng.int(-4, 4);
            const d3 = rng.int(1, 7);
            const s1 = targetAvg + d1;
            const s2 = targetAvg + d2;
            const s3 = targetAvg + d3;
            const s4 = 4 * targetAvg - (s1 + s2 + s3);

            const correct = `${s4}점`;
            const distractors = [
              `${targetAvg}점`,
              `${Math.round((s1 + s2 + s3) / 3)}점`,
              `${s4 + 4}점`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `세 번의 수학 단원평가에서 ${s1}점, ${s2}점, ${s3}점을 받았습니다. 네 번째 시험까지 합쳐 4회 평균이 정확히 ${targetAvg}점이 되려면 네 번째 시험에서 몇 점을 받아야 하나요?`,
              variablesInfo: { 기존점수: `${s1}, ${s2}, ${s3}`, 목표평균: targetAvg },
              options,
              answerIndex,
              hint: `4번 시험의 평균이 ${targetAvg}점이려면 4번 점수의 총합이 ${targetAvg} × 4점이어야 해요!`,
              steps: [
                `4회 시험의 평균이 ${targetAvg}점이 되려면 4회 점수의 총합은 ${targetAvg} × 4 = ${targetAvg * 4}점이어야 합니다.`,
                `지금까지 세 번 받은 점수의 합은 ${s1} + ${s2} + ${s3} = ${s1 + s2 + s3}점입니다.`,
                `따라서 네 번째 시험에서 받아야 할 점수는 ${targetAvg * 4} − ${s1 + s2 + s3} = ${s4}점입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-08',
          dayIndex: 7,
          unit: '초5~6 · 분수의 나눗셈',
          standardCode: '[6수01-11]',
          standardName: '분수의 나눗셈의 계산 원리를 탐구하고 그 계산을 할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 ((자연수)÷(분수))',
          difficulty: '★★☆ 표준',
          conceptSummary: '분수로 나누는 것은 그 분수의 분모와 분자를 바꾼 역수를 곱하는 것과 같습니다.',
          formula: 'A ÷ (b/c) = A × (c/b)',
          tierGuide: {
            easy: '단위분수(1/c)로 나누기 — 자연수 × c',
            normal: '(자연수) ÷ (진분수)',
            hard: '(소수) ÷ (분수) — 소수와 분수가 섞인 나눗셈'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              let A;
              let b;
              let c;
              let ans;
              if (easy) {
                b = 1;
                c = rng.pick([2, 3, 4, 5, 6, 8]);
                A = rng.int(2, 9);
                ans = A * c;
              } else {
                [b, c] = rng.pick([[3, 4], [3, 8], [5, 8], [5, 6], [7, 8], [1, 4], [3, 10], [7, 10], [1, 6]]);
                const k = rng.pick([3, 5, 7, 9, 11]);
                A = (b * k) / 2; // x.5 꼴의 소수
                ans = (k * c) / 2;
              }
              const correct = `${ans}병`;
              const cand = [`${Math.round((A * b) / c)}병`, `${ans + b}병`, `${A * c * 2}병`, `${Math.round(A)}병`, `${ans + c}병`];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand.filter(s => s !== correct && !/^0병/.test(s)));
              return {
                question: `보리차 ${A} L를 한 병에 ${b}/${c} L씩 남김없이 나누어 담으려고 합니다. 필요한 병은 모두 몇 개인가요?`,
                variablesInfo: { 전체양: `${A} L`, 한병용량: `${b}/${c} L`, 병수: ans },
                options,
                answerIndex,
                hint: easy
                  ? `1 L에 1/${c} L가 ${c}번 들어가요. ${A} L에는 몇 번 들어갈까요?`
                  : `소수 ${wj(A, '을/를')} 분수로 바꾸면(${A} = ${A * 2}/2) 분수의 나눗셈으로 계산할 수 있어요.`,
                steps: easy
                  ? [`식은 ${A} ÷ (1/${c})입니다.`, `역수를 곱하면 ${A} × ${c} = ${ans}이므로 총 ${ans}병이 필요합니다.`]
                  : [
                    `식은 ${A} ÷ (${b}/${c})이고, ${A} = ${A * 2}/2입니다.`,
                    `역수를 곱하면 (${A * 2}/2) × (${c}/${b}) = ${A * 2 * c}/${2 * b}입니다.`,
                    `${A * 2 * c}/${2 * b} = ${ans}이므로 총 ${ans}병이 필요합니다.`
                  ]
              };
            }
            const b = rng.pick([2, 3, 4, 5]);
            const c = rng.pick([3, 5, 7, 8]);
            if (b >= c) return this.generate(rng);
            const k = rng.int(2, 6);
            const A = b * k; // 나누어떨어지도록 설정: A ÷ (b/c) = k * c
            const ans = k * c;

            const correct = `${ans}병`;
            const distractors = [
              `${Math.round((A * b) / c)}병`,
              `${ans + b}병`,
              `${A * b}병`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `보리차 ${A} L를 한 병에 ${b}/${c} L씩 남김없이 나누어 담으려고 합니다. 필요한 병은 모두 몇 개인가요?`,
              variablesInfo: { 전체양: `${A} L`, 한병용량: `${b}/${c} L`, 병수: ans },
              options,
              answerIndex,
              hint: `(전체 양) ÷ (한 병의 양)으로 계산합니다. 분수의 나눗셈은 나누는 분수의 역수를 곱해 보세요.`,
              steps: [
                `식은 ${A} ÷ (${b}/${c}) 입니다.`,
                `분수로 나누는 것은 역수를 곱하는 것과 같으므로 ${A} × (${c}/${b}) = (${A} ÷ ${b}) × ${c} 입니다.`,
                `${k} × ${c} = ${ans} 이므로 총 ${ans}병이 필요합니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-09',
          dayIndex: 8,
          unit: '초5~6 · 소수의 나눗셈',
          standardCode: '[6수01-15]',
          standardName: '소수의 나눗셈의 계산 원리를 탐구하고 그 계산을 할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 (소수의 나눗셈 몫과 남는 양)',
          difficulty: '★★☆ 표준',
          conceptSummary: '소수의 나눗셈에서 몫을 자연수까지 구할 때, 남는 양의 소수점은 원래 나누어지는 수의 소수점 위치를 그대로 따릅니다.',
          formula: '(나누어지는 수) = (나누는 수) × (몫) + (남는 양)',
          tierGuide: {
            easy: '(소수) ÷ (자연수) — 자연수 m씩 나누고 남는 양',
            normal: '(소수) ÷ (소수 한 자리)의 몫과 남는 양',
            hard: '(소수) ÷ (소수 두 자리) — 남는 양의 소수점 위치에 주의'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const people = easy ? rng.int(3, 8) : rng.int(4, 12);
              const scale = easy ? 10 : 100;
              const eachS = easy ? rng.pick([2, 3, 4]) * 10 : rng.pick([125, 135, 145, 215, 225, 75, 85, 165]);
              const remS = easy ? rng.int(1, 9) : rng.int(1, eachS - 1);
              const dp = easy ? 1 : 2;
              const each = eachS / scale;
              const rem = Number((remS / scale).toFixed(dp));
              const total = Number(((people * eachS + remS) / scale).toFixed(dp));
              const used = Number(((people * eachS) / scale).toFixed(dp));
              const correct = `${people}명에게 나누어주고 ${rem} m 남는다`;
              const cand = [
                `${people}명에게 나누어주고 ${remS} m 남는다`,
                `${people + 1}명에게 나누어주고 ${Number(Math.abs(each - rem).toFixed(dp))} m 남는다`,
                `${people}명에게 나누어주고 0 m 남는다`,
                `${people - 1}명에게 나누어주고 ${Number((rem + each).toFixed(dp))} m 남는다`
              ];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `리본 ${total} m를 학생 한 명에게 ${each} m씩 나누어 주려고 합니다. 최대 몇 명에게 나누어 줄 수 있고, 남는 리본은 몇 m인가요?`,
                variablesInfo: { 전체리본: `${total}m`, 한명분: `${each}m`, 몫: people, 남는양: `${rem}m` },
                options,
                answerIndex,
                hint: easy
                  ? `${total}에서 ${wj(each, '을/를')} 몇 번 뺄 수 있는지 생각해 보세요. 남는 양은 ${each}보다 작아야 해요.`
                  : `두 수에 100을 곱해 자연수의 나눗셈으로 바꿔 몫을 구한 뒤, 남는 양은 원래 소수점 자리(소수 둘째 자리)로 돌려놓으세요.`,
                steps: [
                  `${total} ÷ ${wj(each, '을/를')} 계산하면 몫은 자연수 ${wj(people, '이/가')} 됩니다.`,
                  `${people}명에게 나누어준 리본의 총길이는 ${people} × ${each} = ${used} m입니다.`,
                  `남는 리본의 길이는 ${total} − ${used} = ${rem} m입니다. (소수점 자리에 주의하세요!)`
                ]
              };
            }
            const people = rng.int(5, 9);
            const each = rng.pick([1.2, 1.4, 1.5, 1.6, 1.8]);
            const remTenth = rng.int(2, 8);
            const rem = remTenth / 10;
            const total = Number((people * each + rem).toFixed(1));

            const correct = `${people}명에게 나누어주고 ${rem} m 남는다`;
            const distractors = [
              `${people}명에게 나누어주고 ${remTenth} m 남는다`,
              `${people + 1}명에게 나누어주고 ${Number(Math.abs(each - rem).toFixed(1))} m 남는다`,
              `${people}명에게 나누어주고 0 m 남는다`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `리본 ${total} m를 학생 한 명에게 ${each} m씩 나누어 주려고 합니다. 최대 몇 명에게 나누어 줄 수 있고, 남는 리본은 몇 m인가요?`,
              variablesInfo: { 전체리본: `${total}m`, 한명분: `${each}m`, 몫: people, 남는양: `${rem}m` },
              options,
              answerIndex,
              hint: `사람 수는 자연수(몫)이어야 해요. 남는 양의 소수점 위치는 원래 소수점 자리를 그대로 내려 찍어야 합니다!`,
              steps: [
                `${total} ÷ ${wj(each, '을/를')} 계산하면 몫은 자연수 ${wj(people, '이/가')} 됩니다.`,
                `${people}명에게 나누어준 리본의 총길이는 ${people} × ${each} = ${(people * each).toFixed(1)} m입니다.`,
                `남는 리본의 길이는 ${total} − ${(people * each).toFixed(1)} = ${rem} m입니다. (소수점 자리에 주의하세요!)`
              ]
            };
          }
        },
        {
          id: 'BAS-10',
          dayIndex: 9,
          unit: '초5~6 · 원의 넓이',
          standardCode: '[6수03-16]',
          standardName: '원주와 원의 넓이를 구하는 방법을 이해하고, 이를 구할 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (원의 넓이)',
          difficulty: '★★☆ 표준',
          conceptSummary: '원의 넓이는 반지름 × 반지름 × 원주율(3.14)로 계산합니다.',
          formula: '원의 넓이 = 반지름 × 반지름 × 원주율',
          tierGuide: {
            easy: '한 자리 반지름으로 원의 넓이',
            normal: '교과서 수준 반지름의 원의 넓이',
            hard: '지름이 주어짐 — 반지름을 먼저 구한 뒤 넓이(두 자리 반지름)'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const r = easy ? rng.pick([3, 5, 6, 7, 9]) : rng.pick([7, 9, 11, 12, 13, 15]);
              const pi = 3.14;
              const area = Number((r * r * pi).toFixed(2));
              const circumference = Number((2 * r * pi).toFixed(2));
              const correct = `${area} cm²`;
              const cand = easy
                ? [`${circumference} cm²`, `${Number((r * pi).toFixed(2))} cm²`, `${Number(((r + 2) * (r + 2) * pi).toFixed(2))} cm²`]
                : [`${Number((4 * r * r * pi).toFixed(2))} cm²`, `${circumference} cm²`, `${Number((r * pi).toFixed(2))} cm²`];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: easy
                  ? `반지름의 길이가 ${r} cm인 원의 넓이는 몇 cm²인가요? (원주율: 3.14)`
                  : `지름의 길이가 ${2 * r} cm인 원의 넓이는 몇 cm²인가요? (원주율: 3.14)`,
                variablesInfo: { 반지름: `${r} cm`, 원주율: pi, 넓이: area },
                figure: { type: 'circle', r, unknown: 'area' },
                options,
                answerIndex,
                hint: easy
                  ? `넓이는 반지름 × 반지름 × 3.14 입니다.`
                  : `지름을 그대로 곱하면 넓이가 4배가 돼요! 반지름 = 지름 ÷ 2 부터 구하세요.`,
                steps: [
                  easy ? `원의 넓이 공식은 (반지름) × (반지름) × (원주율) 입니다.` : `반지름은 ${2 * r} ÷ 2 = ${r} cm입니다.`,
                  `식은 ${r} × ${r} × 3.14 입니다.`,
                  `${r * r} × 3.14 = ${area} cm² 입니다.`
                ]
              };
            }
            const r = rng.pick([4, 5, 6, 8, 10]);
            const pi = 3.14;
            const area = Number((r * r * pi).toFixed(2));
            const circumference = Number((2 * r * pi).toFixed(2));

            const correct = `${area} cm²`;
            const distractors = [
              `${circumference} cm²`,
              `${Number((r * pi).toFixed(2))} cm²`,
              `${Number(((r + 2) * (r + 2) * pi).toFixed(2))} cm²`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `반지름의 길이가 ${r} cm인 원의 넓이는 몇 cm²인가요? (원주율: 3.14)`,
              variablesInfo: { 반지름: `${r} cm`, 원주율: pi, 넓이: area },
              figure: { type: 'circle', r, unknown: 'area' },
              options,
              answerIndex,
              hint: `원의 둘레(2 × 반지름 × 3.14)와 헷갈리지 마세요! 넓이는 반지름 × 반지름 × 3.14 입니다.`,
              steps: [
                `원의 넓이 공식은 (반지름) × (반지름) × (원주율) 입니다.`,
                `반지름이 ${r} cm이고 원주율이 3.14이므로 식은 ${r} × ${r} × 3.14 입니다.`,
                `${r * r} × 3.14 = ${area} cm² 입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-11',
          dayIndex: 10,
          unit: '초5~6 · 직육면체의 부피와 겉넓이',
          standardCode: '[6수03-19]',
          standardName: '직육면체와 정육면체의 부피를 구하는 방법을 이해하고, 이를 구할 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (직육면체의 부피 [6수03-19]·겉넓이 [6수03-17])',
          difficulty: '★★☆ 표준',
          conceptSummary: '직육면체의 부피 = 가로 × 세로 × 높이, 겉넓이 = 2 × (가로×세로 + 세로×높이 + 가로×높이) 입니다.',
          formula: '부피 = a × b × h,  겉넓이 = 2(ab + bh + ha)',
          tierGuide: {
            easy: '2~5 cm의 작은 직육면체',
            normal: '교과서 수준 직육면체의 부피와 겉넓이',
            hard: '세로·높이를 조건(가로보다 □cm 짧음, 가로의 2배)으로 구한 뒤 계산'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              let a = 0;
              let b = 0;
              let h = 0;
              let k = 0;
              for (let t = 0; t < 40; t++) {
                if (easy) {
                  a = rng.int(2, 5); b = rng.int(2, 5); h = rng.int(2, 5);
                } else {
                  a = rng.int(4, 9); k = rng.int(1, 3); b = a - k; h = 2 * a;
                }
                const v0 = a * b * h;
                const s0 = 2 * (a * b + b * h + a * h);
                if (!(a === b && b === h) && v0 !== s0 && v0 !== s0 / 2 && v0 + 20 !== s0) break;
              }
              const vol = a * b * h;
              const surf = 2 * (a * b + b * h + a * h);
              const correct = `부피: ${vol} cm³, 겉넓이: ${surf} cm²`;
              const cand = [
                `부피: ${vol} cm³, 겉넓이: ${surf / 2} cm²`,
                `부피: ${surf} cm³, 겉넓이: ${vol} cm²`,
                `부피: ${vol + 20} cm³, 겉넓이: ${surf + 10} cm²`
              ];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: easy
                  ? `가로 ${a} cm, 세로 ${b} cm, 높이 ${h} cm인 직육면체의 부피와 겉넓이를 바르게 짝지은 것은?`
                  : `가로가 ${a} cm이고, 세로는 가로보다 ${k} cm 짧으며, 높이는 가로의 2배인 직육면체의 부피와 겉넓이를 바르게 짝지은 것은?`,
                variablesInfo: { 가로: a, 세로: b, 높이: h, 부피: vol, 겉넓이: surf },
                figure: { type: 'cuboid', w: a, d: b, h },
                options,
                answerIndex,
                hint: easy
                  ? `부피는 세 길이를 모두 곱하고, 겉넓이는 세 면의 넓이 합에 2를 곱합니다.`
                  : `먼저 세로(${a} − ${k})와 높이(${a} × 2)를 구한 뒤 부피와 겉넓이 공식에 넣으세요.`,
                steps: [
                  easy ? `부피 = ${a} × ${b} × ${h} = ${vol} cm³ 입니다.` : `세로 = ${a} − ${k} = ${b} cm, 높이 = ${a} × 2 = ${h} cm이므로 부피 = ${a} × ${b} × ${h} = ${vol} cm³ 입니다.`,
                  `세 면의 넓이 합 = ${a * b} + ${b * h} + ${a * h} = ${a * b + b * h + a * h} cm² 입니다.`,
                  `겉넓이는 ${a * b + b * h + a * h} × 2 = ${surf} cm² 입니다.`
                ]
              };
            }
            const a = rng.int(3, 7);
            const b = rng.int(3, 6);
            const h = rng.int(4, 8);
            const vol = a * b * h;
            const surf = 2 * (a * b + b * h + a * h);

            const correct = `부피: ${vol} cm³, 겉넓이: ${surf} cm²`;
            const distractors = [
              `부피: ${vol} cm³, 겉넓이: ${surf / 2} cm²`,
              `부피: ${surf} cm³, 겉넓이: ${vol} cm²`,
              `부피: ${vol + 20} cm³, 겉넓이: ${surf + 10} cm²`,
              // 예비 오답(앞의 오답이 정답과 겹칠 때만 쓰임 — 기존 출제 결과는 그대로)
              `부피: ${vol} cm³, 겉넓이: ${surf + 12} cm²`,
              `부피: ${vol + 12} cm³, 겉넓이: ${surf} cm²`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `가로 ${a} cm, 세로 ${b} cm, 높이 ${h} cm인 직육면체의 부피와 겉넓이를 바르게 짝지은 것은?`,
              variablesInfo: { 가로: a, 세로: b, 높이: h, 부피: vol, 겉넓이: surf },
              figure: { type: 'cuboid', w: a, d: b, h },
              options,
              answerIndex,
              hint: `부피는 세 변의 길이를 모두 곱하고, 겉넓이는 마주 보는 세 쌍의 면의 넓이 합에 2를 곱합니다.`,
              steps: [
                `부피 = 가로 × 세로 × 높이 = ${a} × ${b} × ${h} = ${vol} cm³ 입니다.`,
                `세 면의 넓이 합 = (${a}×${b}) + (${b}×${h}) + (${a}×${h}) = ${a * b} + ${b * h} + ${a * h} = ${a * b + b * h + a * h} cm² 입니다.`,
                `겉넓이는 서로 마주 보는 면이 2개씩 있으므로 ${a * b + b * h + a * h} × 2 = ${surf} cm² 입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-12',
          dayIndex: 11,
          unit: '초5~6 · 다각형의 넓이 (마름모)',
          standardCode: '[6수03-14]',
          standardName: '평행사변형, 삼각형, 사다리꼴, 마름모의 넓이를 구하는 방법을 다양하게 추론하고, 이와 관련된 문제를 해결할 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (마름모의 넓이)',
          difficulty: '★☆☆ 기초',
          conceptSummary: '마름모의 넓이는 두 대각선에 접하는 직사각형 넓이의 절반과 같습니다.',
          formula: '마름모의 넓이 = (한 대각선 × 다른 대각선) ÷ 2',
          tierGuide: {
            easy: '한 자리 대각선으로 마름모의 넓이',
            normal: '교과서 수준 마름모의 넓이',
            hard: '다른 대각선을 조건(□cm 더 김)으로 구한 뒤 넓이 — 소수 넓이 포함'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const d1 = easy ? rng.pick([2, 4, 6, 8]) : rng.int(9, 20);
              const k = easy ? 0 : rng.int(2, 9);
              const d2 = easy ? rng.pick([3, 5, 7, 9]) : d1 + k;
              const area = (d1 * d2) / 2;
              const correct = `${area} cm²`;
              const cand = [`${d1 * d2} cm²`, `${(d1 + d2) * 2} cm²`, `${area + 4} cm²`, `${(d1 + d2) / 2} cm²`];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: easy
                  ? `두 대각선의 길이가 각각 ${d1} cm, ${d2} cm인 마름모의 넓이는 몇 cm²인가요?`
                  : `한 대각선의 길이가 ${d1} cm이고, 다른 대각선은 그보다 ${k} cm 더 긴 마름모의 넓이는 몇 cm²인가요?`,
                variablesInfo: { 대각선1: `${d1}cm`, 대각선2: `${d2}cm`, 넓이: area },
                figure: { type: 'rhombus', d1, d2 },
                options,
                answerIndex,
                hint: easy
                  ? `두 대각선을 곱한 뒤 2로 나누세요.`
                  : `다른 대각선은 ${d1} + ${k} = ? cm예요. 그다음 두 대각선의 곱을 2로 나누세요.`,
                steps: [
                  easy ? `마름모의 넓이 = (한 대각선) × (다른 대각선) ÷ 2 입니다.` : `다른 대각선의 길이는 ${d1} + ${k} = ${d2} cm입니다.`,
                  `${d1} × ${d2} = ${d1 * d2} 입니다.`,
                  `2로 나누면 ${d1 * d2} ÷ 2 = ${area} cm² 입니다.`
                ]
              };
            }
            const d1 = rng.pick([6, 8, 10, 12, 14]);
            const d2 = rng.pick([5, 7, 9, 11, 13]);
            const area = (d1 * d2) / 2;

            const correct = `${area} cm²`;
            const distractors = [
              `${d1 * d2} cm²`,
              `${(d1 + d2) * 2} cm²`,
              `${area + 4} cm²`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `두 대각선의 길이가 각각 ${d1} cm, ${d2} cm인 마름모의 넓이는 몇 cm²인가요?`,
              variablesInfo: { 대각선1: `${d1}cm`, 대각선2: `${d2}cm`, 넓이: area },
              figure: { type: 'rhombus', d1, d2 },
              options,
              answerIndex,
              hint: `마름모의 넓이는 직사각형 넓이(${d1} × ${d2})를 구한 후 반드시 2로 나누어 주어야 합니다.`,
              steps: [
                `마름모의 넓이 공식은 (한 대각선의 길이) × (다른 대각선의 길이) ÷ 2 입니다.`,
                `${d1} × ${d2} = ${d1 * d2} 입니다.`,
                `2로 나누면 ${d1 * d2} ÷ 2 = ${area} cm² 입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-13',
          dayIndex: 12,
          unit: '초5~6 · 규칙과 대응',
          standardCode: '[6수02-01]',
          standardName: '한 양이 변할 때 다른 양이 그에 종속하여 변하는 대응 관계를 나타낸 표에서 규칙을 찾아 설명하고, □, △ 등을 사용하여 식으로 나타낼 수 있다.',
          sourceRef: '초등 5~6학년군 변화와 관계 (규칙과 대응)',
          difficulty: '★★☆ 표준',
          conceptSummary: '도형을 연속하여 만들 때 필요한 부품 수는 (기본 고정 개수) + (추가 도형 수 × 도형당 추가 개수)의 일차식 대응 관계를 갖습니다.',
          formula: 'y = a × x + b (x: 도형의 개수, y: 필요한 성냥개비 수)',
          tierGuide: {
            easy: '정삼각형·정사각형을 10개 이하로 이어 붙이기',
            normal: '도형 12~25개 — 대응 관계식으로 구하기',
            hard: '정오각형·정팔각형 등 30~60개 — 늘어나는 수를 찾아 식 세우기'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const type = rng.pick(easy
                ? [{ shape: '정삼각형', add: 2, base: 1 }, { shape: '정사각형', add: 3, base: 1 }]
                : [{ shape: '정오각형', add: 4, base: 1 }, { shape: '정육각형', add: 5, base: 1 }, { shape: '정팔각형', add: 7, base: 1 }]);
              const n = easy ? rng.int(4, 10) : rng.int(30, 60);
              const total = type.add * n + type.base;
              const correct = `${total}개 (관계식: ${type.add} × n + ${type.base})`;
              const cand = [
                `${(type.add + 1) * n}개 (관계식: ${type.add + 1} × n)`,
                `${type.add * n}개 (관계식: ${type.add} × n)`,
                `${total + type.add}개 (관계식: ${type.add} × (n + 1))`
              ];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `성냥개비로 ${wj(type.shape, '을/를')} 한 줄로 이어 붙여 만들고 있습니다. 1개 만들 때 성냥개비 ${type.add + type.base}개, 2개 만들 때 ${(type.add + type.base) + type.add}개, 3개 만들 때 ${(type.add + type.base) + type.add * 2}개가 필요합니다. ${type.shape} ${n}개를 이어 붙여 만들 때 필요한 성냥개비는 총 몇 개인가요?`,
                variablesInfo: { 도형: type.shape, 도형수: n, 총개수: total },
                options,
                answerIndex,
                hint: easy
                  ? `${wj(type.shape, '이/가')} 1개 늘 때마다 성냥개비가 몇 개씩 늘어나는지 표로 정리해 보세요.`
                  : `한 변을 이웃 도형과 함께 쓰므로 도형 1개가 늘 때 ${type.add}개씩 늘어요. 처음 1개에 쓰인 수와 비교해 식을 세우세요.`,
                steps: [
                  `처음 도형에 성냥개비 ${type.add + type.base}개가 필요하고, 도형 1개를 더할 때마다 ${type.add}개씩 더 필요합니다.`,
                  `따라서 대응 관계식은 y = ${type.add} × n + ${type.base} 입니다.`,
                  `n = ${wj(n, '을/를')} 대입하면 y = ${type.add} × ${n} + ${type.base} = ${total}개입니다.`
                ]
              };
            }
            const type = rng.pick([
              { shape: '정사각형', add: 3, base: 1 },
              { shape: '정삼각형', add: 2, base: 1 },
              { shape: '정육각형', add: 5, base: 1 }
            ]);
            const n = rng.int(12, 25);
            const total = type.add * n + type.base;

            const correct = `${total}개 (관계식: ${type.add} × n + ${type.base})`;
            const distractors = [
              `${(type.add + 1) * n}개 (관계식: ${type.add + 1} × n)`,
              `${type.add * n}개 (관계식: ${type.add} × n)`,
              `${total + type.add}개 (관계식: ${type.add} × (n + 1))`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `성냥개비로 ${wj(type.shape, '을/를')} 한 줄로 이어 붙여 만들고 있습니다. 1개 만들 때 성냥개비 ${type.add + type.base}개, 2개 만들 때 ${(type.add + type.base) + type.add}개, 3개 만들 때 ${(type.add + type.base) + type.add * 2}개가 필요합니다. ${type.shape} ${n}개를 이어 붙여 만들 때 필요한 성냥개비는 총 몇 개인가요?`,
              variablesInfo: { 도형: type.shape, 도형수: n, 총개수: total },
              options,
              answerIndex,
              hint: `${wj(type.shape, '이/가')} 1개 늘어날 때마다 성냥개비는 정확히 ${type.add}개씩 늘어납니다.`,
              steps: [
                `첫 번째 도형에 성냥개비 ${type.add + type.base}개가 필요하고, 그 이후 도형 1개를 추가할 때마다 ${type.add}개씩 더 필요합니다.`,
                `따라서 ${type.shape} n개와 성냥개비 수 y 사이의 대응 관계식은 y = ${type.add} × n + ${type.base} 입니다.`,
                `n = ${wj(n, '을/를')} 대입하면 y = ${type.add} × ${n} + ${type.base} = ${type.add * n} + ${type.base} = ${total}개입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-14',
          dayIndex: 13,
          unit: '초5~6 · 띠그래프와 원그래프',
          standardCode: '[6수04-02]',
          standardName: '자료를 수집하여 띠그래프나 원그래프로 나타내고 해석할 수 있다.',
          sourceRef: '초등 5~6학년군 자료와 가능성 (원그래프의 해석)',
          difficulty: '★★☆ 표준',
          conceptSummary: '원그래프의 전체 각도는 360°이고 전체 백분율은 100%입니다. 특정 항목의 실제 수량은 (전체 수량) × (비율 / 100)으로 구합니다.',
          formula: '항목의 수량 = 전체 수량 × (백분율 / 100)',
          tierGuide: {
            easy: '10%·25%·50%처럼 쉬운 백분율의 학생 수와 중심각',
            normal: '교과서 수준 원그래프 해석',
            hard: '12%·18%처럼 중심각이 소수(43.2°)로 나오는 해석'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const total = easy ? rng.pick([200, 300, 400, 500]) : rng.pick([250, 400, 450, 650, 750, 850]);
              const pct = easy ? rng.pick([10, 20, 25, 50]) : rng.pick([12, 16, 18, 22, 24, 28, 32, 36]);
              const count = (total * pct) / 100;
              const deg = Number(((360 * pct) / 100).toFixed(1));
              const correct = `${count}명 (원그래프 중심각: ${deg}°)`;
              const cand = [
                `${pct}명 (원그래프 중심각: ${deg}°)`,
                `${count}명 (원그래프 중심각: ${pct * 2}°)`,
                `${Math.round(total / (pct / 10))}명 (원그래프 중심각: ${deg}°)`,
                `${count}명 (원그래프 중심각: ${pct}°)`
              ];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `전교생 ${total}명을 대상으로 가장 좋아하는 운동을 조사하여 원그래프로 나타냈더니, 축구를 선택한 학생의 비율이 ${pct}%였습니다. 축구를 좋아하는 학생 수와 이 부채꼴의 중심각의 크기는 얼마인가요?`,
                variablesInfo: { 전교생: total, 축구비율: `${pct}%`, 학생수: count, 중심각: `${deg}°` },
                figure: { type: 'pie', percent: pct, label: '축구' },
                options,
                answerIndex,
                hint: easy
                  ? `${pct}%는 전체의 ${pct / gcd(100, pct)}/${100 / gcd(100, pct)}이에요. 학생 수와 360°에 각각 곱해 보세요.`
                  : `중심각은 360° × ${pct}/100 = 3.6° × ${pct}로 계산하면 편해요.`,
                steps: [
                  `축구를 좋아하는 학생 수는 ${total} × (${pct} / 100) = ${count}명입니다.`,
                  `원 전체의 중심각은 360°이므로 부채꼴의 중심각은 360° × (${pct} / 100) = ${deg}°입니다.`,
                  `따라서 학생 수는 ${count}명, 중심각은 ${deg}°입니다.`
                ]
              };
            }
            const total = rng.pick([300, 400, 500, 600, 800]);
            const pct = rng.pick([15, 25, 30, 35, 40, 45]);
            const count = (total * pct) / 100;
            const deg = (360 * pct) / 100;

            const correct = `${count}명 (원그래프 중심각: ${deg}°)`;
            const distractors = [
              `${pct}명 (원그래프 중심각: ${deg}°)`,
              `${count}명 (원그래프 중심각: ${pct * 2}°)`,
              `${Math.round(total / (pct / 10))}명 (원그래프 중심각: ${deg}°)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `전교생 ${total}명을 대상으로 가장 좋아하는 운동을 조사하여 원그래프로 나타냈더니, 축구를 선택한 학생의 비율이 ${pct}%였습니다. 축구를 좋아하는 학생 수와 이 부채꼴의 중심각의 크기는 얼마인가요?`,
              variablesInfo: { 전교생: total, 축구비율: `${pct}%`, 학생수: count, 중심각: `${deg}°` },
              figure: { type: 'pie', percent: pct, label: '축구' },
              options,
              answerIndex,
              hint: `학생 수는 전체 ${total}명의 ${pct}%이고, 중심각은 원 전체 360°의 ${pct}%입니다.`,
              steps: [
                `축구를 좋아하는 학생 수는 ${total} × (${pct} / 100) = ${count}명입니다.`,
                `원 전체의 중심각은 360°이므로 부채꼴의 중심각은 360° × (${pct} / 100) = ${deg}°입니다.`,
                `따라서 학생 수는 ${count}명, 중심각은 ${deg}°입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-15',
          dayIndex: 14,
          unit: '초5~6 · 자연수의 혼합 계산',
          standardCode: '[6수01-01]',
          standardName: '덧셈, 뺄셈, 곱셈, 나눗셈의 혼합 계산에서 계산하는 순서를 알고, 혼합 계산을 할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 (자연수의 혼합 계산)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '덧셈과 곱셈이 섞인 식 — 곱셈 먼저',
            normal: '괄호·곱셈·나눗셈·뺄셈이 섞인 식',
            hard: '괄호 안의 계산 뒤 곱셈·나눗셈을 앞에서부터 — 연산 5개 혼합'
          },
          conceptSummary: '혼합 계산은 괄호 안 → 곱셈·나눗셈(앞에서부터) → 덧셈·뺄셈(앞에서부터) 순서로 계산합니다.',
          formula: '( ) → ×, ÷ → +, −  (같은 단계는 왼쪽부터)',
          generate(rng, { tier } = {}) {
            let expr;
            let value;
            let wrongs;
            let steps;
            let hint;
            if (tier === 'easy') {
              const a = rng.int(2, 30);
              const b = rng.int(2, 9);
              const c = rng.int(2, 9);
              expr = `${a} + ${b} × ${c}`;
              value = a + b * c;
              wrongs = [(a + b) * c, a + b + c, a * b + c];
              hint = '곱셈은 덧셈보다 먼저 계산해요.';
              steps = [`곱셈을 먼저 계산합니다: ${b} × ${c} = ${b * c}`, `덧셈을 계산합니다: ${a} + ${b * c} = ${value}`];
            } else if (tier === 'hard') {
              let a, b, c, d, e, f, m;
              for (let t = 0; t < 60; t++) {
                d = rng.pick([2, 3, 4, 5, 6]);
                m = rng.int(3, 9);
                b = rng.int(1, d * m - 1);
                c = d * m - b;
                a = rng.int(3, 9);
                e = rng.int(2, 6);
                f = rng.int(2, 5);
                if (a * m > e * f) break;
              }
              if (a * m <= e * f) { e = 2; f = 2; }
              expr = `${a} × (${b} + ${c}) ÷ ${d} − ${e} × ${f}`;
              value = a * m - e * f;
              wrongs = [(a * m - e) * f, a * (b + c) - e * f, a * m - e - f, a * m + e * f];
              hint = '괄호 안을 먼저 계산하고, 곱셈과 나눗셈은 앞에서부터 차례로, 뺄셈은 마지막에 하세요.';
              steps = [
                `괄호 안을 먼저 계산합니다: ${b} + ${c} = ${b + c}`,
                `곱셈과 나눗셈을 앞에서부터 계산합니다: ${a} × ${b + c} = ${a * (b + c)}, ${a * (b + c)} ÷ ${d} = ${a * m}, 그리고 ${e} × ${f} = ${e * f}`,
                `마지막으로 뺄셈을 합니다: ${a * m} − ${e * f} = ${value}`
              ];
            } else {
              let a, b, c, e, k;
              for (let t = 0; t < 60; t++) {
                a = rng.int(2, 15);
                b = rng.int(2, 15);
                c = rng.int(2, 6);
                e = rng.int(2, 9);
                k = rng.int(2, 9);
                if ((a + b) * c > k) break;
              }
              const d = e * k;
              expr = `(${a} + ${b}) × ${c} − ${d} ÷ ${e}`;
              value = (a + b) * c - k;
              const ltr = ((a + b) * c - d) / e;
              wrongs = [a + b * c - k, Number.isInteger(ltr) ? ltr : (a + b) * (c - k), (a + b) * c - d, (a + b) * c + k];
              hint = '괄호 안 → 곱셈·나눗셈 → 뺄셈 순서예요. 뺄셈을 나눗셈보다 먼저 하면 안 돼요.';
              steps = [
                `괄호 안을 먼저 계산합니다: ${a} + ${b} = ${a + b}`,
                `곱셈과 나눗셈을 계산합니다: ${a + b} × ${c} = ${(a + b) * c}, ${d} ÷ ${e} = ${k}`,
                `뺄셈을 계산합니다: ${(a + b) * c} − ${k} = ${value}`
              ];
            }
            const cand = wrongs.filter(w => Number.isInteger(w) && w > 0 && w !== value).map(String);
            const { options, answerIndex } = buildChoiceSet(rng, String(value), cand);
            return {
              question: `다음 식을 계산한 값은?  [ ${expr} ]`,
              variablesInfo: { 식: expr },
              options,
              answerIndex,
              hint,
              steps
            };
          }
        },
        {
          id: 'BAS-16',
          dayIndex: 15,
          unit: '초5~6 · 수의 범위',
          standardCode: '[6수01-02]',
          standardName: '실생활과 연결하여 이상, 이하, 초과, 미만의 의미와 쓰임을 알고, 이를 활용하여 수의 범위를 나타낼 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 (이상·이하·초과·미만)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '"□ 이상 △ 이하"인 자연수의 개수',
            normal: '이상·초과·이하·미만이 섞인 범위의 자연수 개수',
            hard: '실제 자료(키)에서 경계값 포함 여부를 따져 개수 세기'
          },
          conceptSummary: '이상·이하는 기준 수를 포함하고, 초과·미만은 기준 수를 포함하지 않습니다.',
          formula: 'A 이상 B 이하 → B − A + 1개,  A 초과 B 미만 → B − A − 1개',
          generate(rng, { tier } = {}) {
            if (tier === 'hard') {
              const A = rng.int(138, 146);
              const B = A + rng.int(6, 12);
              const lowOp = rng.pick(['이상', '초과']);
              const highOp = rng.pick(['이하', '미만']);
              const vals = new Set([A, B]);
              while (vals.size < 8) vals.add(rng.int(130, 165));
              const data = rng.shuffle([...vals]);
              const inR = (lo, hi) => data.filter(x => (lo === '이상' ? x >= A : x > A) && (hi === '이하' ? x <= B : x < B)).length;
              const cnt = inR(lowOp, highOp);
              const cand = [inR('이상', '이하'), inR('초과', '미만'), inR(lowOp === '이상' ? '초과' : '이상', highOp), inR(lowOp, highOp === '이하' ? '미만' : '이하'), data.length - cnt]
                .filter(x => x !== cnt).map(x => `${x}명`);
              const { options, answerIndex } = buildChoiceSet(rng, `${cnt}명`, cand);
              const inside = data.filter(x => (lowOp === '이상' ? x >= A : x > A) && (highOp === '이하' ? x <= B : x < B)).sort((x, y) => x - y);
              return {
                question: `학생 8명의 키를 조사하였습니다.  [ ${data.join(', ')} ] (단위: cm)  키가 ${A} cm ${lowOp} ${B} cm ${highOp}인 학생은 몇 명인가요?`,
                variablesInfo: { 자료: data.join(', '), 범위: `${A} ${lowOp} ${B} ${highOp}` },
                options,
                answerIndex,
                hint: `${A} cm인 학생과 ${B} cm인 학생이 범위에 들어가는지 먼저 따져 보세요. (${lowOp === '이상' ? '이상은 포함' : '초과는 미포함'}, ${highOp === '이하' ? '이하는 포함' : '미만은 미포함'})`,
                steps: [
                  `${A} cm ${lowOp}이므로 ${A} cm는 ${lowOp === '이상' ? '포함하고' : '포함하지 않고'}, ${B} cm ${highOp}이므로 ${B} cm는 ${highOp === '이하' ? '포함합니다' : '포함하지 않습니다'}.`,
                  `범위에 드는 키는 ${inside.length ? inside.join(', ') : '없음'}입니다.`,
                  `따라서 ${cnt}명입니다.`
                ]
              };
            }
            const easy = tier === 'easy';
            const A = easy ? rng.int(1, 20) : rng.int(10, 60);
            const B = A + (easy ? rng.int(3, 9) : rng.int(5, 25));
            const lowOp = easy ? '이상' : rng.pick(['이상', '초과']);
            const highOp = easy ? '이하' : rng.pick(['이하', '미만']);
            const lo = lowOp === '이상' ? A : A + 1;
            const hi = highOp === '이하' ? B : B - 1;
            const cnt = hi - lo + 1;
            const cand = [B - A + 1, B - A, B - A - 1, B - A + 2].filter(x => x !== cnt && x > 0).map(x => `${x}개`);
            const { options, answerIndex } = buildChoiceSet(rng, `${cnt}개`, cand);
            return {
              question: `${A} ${lowOp} ${B} ${highOp}인 자연수는 모두 몇 개인가요?`,
              variablesInfo: { 범위: `${A} ${lowOp} ${B} ${highOp}` },
              options,
              answerIndex,
              hint: '이상·이하는 그 수를 포함하고, 초과·미만은 포함하지 않아요.',
              steps: [
                `${A} ${lowOp}이므로 가장 작은 수는 ${lo}, ${B} ${highOp}이므로 가장 큰 수는 ${hi}입니다.`,
                `${lo}부터 ${hi}까지의 자연수는 ${hi} − ${lo} + 1 = ${cnt}개입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-17',
          dayIndex: 16,
          unit: '초5~6 · 올림, 버림, 반올림',
          standardCode: '[6수01-03]',
          standardName: '어림값을 구하기 위한 방법으로 올림, 버림, 반올림의 의미와 필요성을 알고, 이를 실생활에 활용함으로써 수학의 유용성을 인식할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 (올림·버림·반올림)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '세 자리 수를 십의 자리까지 어림',
            normal: '네 자리 수를 백·천의 자리까지 어림',
            hard: '어림한 결과로부터 처음 수의 범위(이상·미만 등) 찾기'
          },
          conceptSummary: '올림은 구하려는 자리 아래 수를 올리고, 버림은 버리며, 반올림은 바로 아래 자리 숫자가 5 이상이면 올리고 4 이하이면 버립니다.',
          formula: '반올림하여 백의 자리까지 R → R−50 이상 R+50 미만',
          generate(rng, { tier } = {}) {
            const U = { 십: 10, 백: 100, 천: 1000 };
            const fmt = n => comma(n);
            if (tier === 'hard') {
              const place = rng.pick(['십', '백']);
              const u = U[place];
              const R = place === '십' ? rng.int(12, 98) * 10 : rng.int(12, 98) * 100;
              const method = rng.pick(['반올림', '올림', '버림']);
              const rng2 = (a, op1, b, op2) => `${fmt(a)} ${op1} ${fmt(b)} ${op2}`;
              const forms = {
                반올림: rng2(R - u / 2, '이상', R + u / 2, '미만'),
                올림: rng2(R - u, '초과', R, '이하'),
                버림: rng2(R, '이상', R + u, '미만')
              };
              const correct = forms[method];
              const extra = {
                반올림: [rng2(R - u / 2, '이상', R + u / 2, '이하'), rng2(R - u / 2, '초과', R + u / 2, '미만')],
                올림: [rng2(R - u, '이상', R, '이하'), rng2(R - u, '이상', R, '미만')],
                버림: [rng2(R, '초과', R + u, '이하'), rng2(R, '이상', R + u, '이하')]
              }[method];
              const cand = [extra[0], ...Object.values(forms).filter(f => f !== correct), extra[1]];
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              const explain = {
                반올림: `${place}의 자리 아래 숫자가 5 이상이면 올리고 4 이하이면 버리므로, ${fmt(R - u / 2)}부터 ${fmt(R + u / 2 - 1)}까지가 ${wj(fmt(R), '이/가')} 됩니다.`,
                올림: `${place}의 자리 아래가 0이 아니면 올리므로 ${fmt(R - u + 1)}부터 ${fmt(R)}까지가 ${wj(fmt(R), '이/가')} 됩니다.`,
                버림: `${place}의 자리 아래를 모두 버리므로 ${fmt(R)}부터 ${fmt(R + u - 1)}까지가 ${wj(fmt(R), '이/가')} 됩니다.`
              }[method];
              return {
                question: `어떤 자연수를 ${method}하여 ${place}의 자리까지 나타내었더니 ${wj(fmt(R), '이/가')} 되었습니다. 어떤 자연수의 범위를 바르게 나타낸 것은?`,
                variablesInfo: { 어림방법: method, 자리: place, 어림값: R },
                options,
                answerIndex,
                hint: `${method}하여 ${wj(fmt(R), '이/가')} 되는 가장 작은 수와 가장 큰 수를 먼저 찾아보세요.`,
                steps: [explain, `이를 이상·이하·초과·미만으로 나타내면 ${correct}입니다.`]
              };
            }
            const easy = tier === 'easy';
            const place = easy ? '십' : rng.pick(['백', '천']);
            const u = U[place];
            let x = easy ? rng.int(101, 999) : rng.int(1001, 9999);
            if (x % 10 === 0) x += rng.int(1, 9);
            if (x % u === 0) x += 3;
            const method = rng.pick(['올림', '버림', '반올림']);
            const calc = (m, uu) => (m === '올림' ? Math.ceil(x / uu) * uu : m === '버림' ? Math.floor(x / uu) * uu : Math.floor(x / uu + 0.5) * uu);
            const ans = calc(method, u);
            const otherU = place === '십' ? 100 : place === '백' ? (rng.next() < 0.5 ? 10 : 1000) : 100;
            const cand = [...['올림', '버림', '반올림'].map(m => calc(m, u)), calc(method, otherU), ...['올림', '버림', '반올림'].map(m => calc(m, otherU))]
              .filter(n => n !== ans && n > 0).map(fmt);
            const { options, answerIndex } = buildChoiceSet(rng, fmt(ans), cand);
            const digit = Math.floor((x % u) / (u / 10));
            return {
              question: `${wj(fmt(x), '을/를')} ${method}하여 ${place}의 자리까지 나타내면 얼마인가요?`,
              variablesInfo: { 수: x, 어림방법: method, 자리: place },
              options,
              answerIndex,
              hint: method === '반올림'
                ? `${place}의 자리 바로 아래 숫자(${digit})를 보고 5 이상이면 올리고, 4 이하이면 버려요.`
                : `${method}은 ${place}의 자리 아래 수를 ${method === '올림' ? '올려서' : '버려서'} 0으로 만들어요.`,
              steps: [
                `${place}의 자리 아래 수는 ${fmt(x % u)}이고, 바로 아래 자리 숫자는 ${digit}입니다.`,
                method === '올림' ? `올림은 아래 수가 0이 아니면 ${place}의 자리를 1 크게 하므로 ${fmt(ans)}입니다.`
                  : method === '버림' ? `버림은 아래 수를 모두 0으로 만들므로 ${fmt(ans)}입니다.`
                    : `반올림은 ${digit >= 5 ? '5 이상이므로 올려서' : '4 이하이므로 버려서'} ${fmt(ans)}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-18',
          dayIndex: 17,
          unit: '초5~6 · 공배수와 최소공배수',
          standardCode: '[6수01-05]',
          standardName: '배수, 공배수, 최소공배수를 이해하고 구할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 (최소공배수의 실생활 활용)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '두 수의 최소공배수 구하기',
            normal: '동시에 출발하는 버스 — 다음 동시 출발 시각',
            hard: '직사각형 타일로 가장 작은 정사각형 만들기 — 한 변과 타일 수'
          },
          conceptSummary: '두 수의 공통인 배수를 공배수, 그중 가장 작은 수를 최소공배수라고 합니다. 일정한 간격으로 반복되는 일이 다시 함께 일어나는 때는 최소공배수로 구합니다.',
          formula: 'a, b의 배수를 나열 → 공통인 배수 중 가장 작은 수',
          generate(rng, { tier } = {}) {
            const pick2 = list => { const p = rng.pick(list); return rng.next() < 0.5 ? p : [p[1], p[0]]; };
            if (tier === 'hard') {
              const [a, b] = pick2([[4, 6], [6, 8], [6, 9], [8, 12], [9, 12], [10, 15], [12, 18], [6, 10], [4, 10], [12, 16], [8, 10], [10, 12], [15, 20], [6, 15], [8, 14], [9, 15], [12, 20], [14, 21]]);
              const g = gcd(a, b);
              const L = lcm(a, b);
              const cnt = (L / a) * (L / b);
              const fmtT = (s, n) => `한 변 ${s} cm, 타일 ${n}장`;
              const cand = [fmtT(a * b, a * b), fmtT(L, L / a + L / b), fmtT(2 * L, 4 * cnt), fmtT(L, cnt * 2)];
              const { options, answerIndex } = buildChoiceSet(rng, fmtT(L, cnt), cand);
              return {
                question: `가로 ${a} cm, 세로 ${b} cm인 직사각형 모양 타일을 같은 방향으로 빈틈없이 이어 붙여 가장 작은 정사각형을 만들려고 합니다. 정사각형의 한 변의 길이와 필요한 타일의 수를 바르게 짝지은 것은?`,
                variablesInfo: { 타일가로: `${a} cm`, 타일세로: `${b} cm` },
                options,
                answerIndex,
                hint: `정사각형의 한 변은 ${a}의 배수이면서 ${b}의 배수여야 해요. 그중 가장 작은 수를 찾아보세요.`,
                steps: [
                  `한 변의 길이는 ${wj(a, '과/와')} ${b}의 최소공배수입니다. 두 수의 최대공약수가 ${g}이므로 최소공배수는 ${a} × ${b} ÷ ${g} = ${L}입니다.`,
                  `가로로 ${L} ÷ ${a} = ${L / a}장, 세로로 ${L} ÷ ${b} = ${L / b}장이 놓입니다.`,
                  `필요한 타일은 ${L / a} × ${L / b} = ${cnt}장입니다.`
                ]
              };
            }
            if (tier === 'easy') {
              const [a, b] = pick2([[4, 6], [6, 8], [6, 9], [4, 10], [6, 10], [8, 12], [9, 12], [10, 15], [4, 14], [6, 14], [12, 18], [8, 10], [10, 12], [6, 15]]);
              const L = lcm(a, b);
              const cand = [a * b, gcd(a, b), a + b, 2 * L].filter(x => x !== L).map(String);
              const { options, answerIndex } = buildChoiceSet(rng, String(L), cand);
              const mult = (n, k) => Array.from({ length: k }, (_, i) => n * (i + 1)).join(', ');
              return {
                question: `${wj(a, '과/와')} ${b}의 최소공배수는 얼마인가요?`,
                variablesInfo: { 수1: a, 수2: b },
                options,
                answerIndex,
                hint: `${a}의 배수와 ${b}의 배수를 차례로 써 보고 처음으로 같아지는 수를 찾아보세요.`,
                steps: [
                  `${a}의 배수: ${mult(a, L / a + 1)}, …`,
                  `${b}의 배수: ${mult(b, L / b + 1)}, …`,
                  `공통인 배수 중 가장 작은 수는 ${L}입니다.`
                ]
              };
            }
            const [a, b] = pick2([[4, 6], [6, 8], [6, 9], [8, 12], [9, 12], [10, 15], [12, 18], [6, 10], [4, 10], [12, 16], [8, 10], [6, 15], [14, 21], [8, 14], [9, 15]]);
            const L = lcm(a, b);
            const h = rng.int(7, 10);
            const time = m => { const H = h + Math.floor(m / 60); const M = m % 60; return M === 0 ? `오전 ${H}시` : `오전 ${H}시 ${M}분`; };
            const cand = [a * b, gcd(a, b), 2 * L, a + b].filter(x => x !== L && h + Math.floor(x / 60) <= 11).map(time);
            const { options, answerIndex } = buildChoiceSet(rng, time(L), cand);
            return {
              question: `어느 정류장에서 가 버스는 ${a}분마다, 나 버스는 ${b}분마다 출발합니다. 두 버스가 오전 ${h}시에 동시에 출발했다면, 바로 다음에 두 버스가 동시에 출발하는 시각은 언제인가요?`,
              variablesInfo: { 배차1: `${a}분`, 배차2: `${b}분` },
              options,
              answerIndex,
              hint: `두 버스가 다시 함께 출발하는 때는 ${wj(a, '과/와')} ${b}의 공배수 분 후예요. '바로 다음'이므로 최소공배수를 구하세요.`,
              steps: [
                `${wj(a, '과/와')} ${b}의 최소공배수는 ${L}입니다.`,
                `따라서 두 버스는 ${L}분마다 동시에 출발하고, 오전 ${h}시의 ${L}분 후는 ${time(L)}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-19',
          dayIndex: 18,
          unit: '초5~6 · 크기가 같은 분수와 약분',
          standardCode: '[6수01-06]',
          standardName: '크기가 같은 분수를 만드는 방법을 이해하고, 분수를 약분, 통분할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 (약분과 기약분수)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '작은 분수를 기약분수로 약분',
            normal: '두 자리 분모·분자를 최대공약수로 한 번에 약분',
            hard: '크기가 같은 분수 중 분모와 분자의 합이 주어진 분수 찾기'
          },
          conceptSummary: '분모와 분자를 0이 아닌 같은 수로 곱하거나 나누면 크기가 같은 분수가 됩니다. 분모와 분자를 최대공약수로 나누면 기약분수가 됩니다.',
          formula: 'a/b = (a÷g)/(b÷g)  (g = a, b의 최대공약수)',
          generate(rng, { tier } = {}) {
            const coprimePair = (maxD) => {
              for (let t = 0; t < 60; t++) {
                const r = rng.int(2, maxD);
                const p = rng.int(1, r - 1);
                if (gcd(p, r) === 1) return [p, r];
              }
              return [2, 3];
            };
            if (tier === 'hard') {
              const [p, r] = coprimePair(9);
              const k = rng.int(2, 6);
              let t = rng.int(2, 9);
              if (t === k) t = k + 1;
              const n = p * k;
              const d = r * k;
              const S = (p + r) * t;
              const correct = `${p * t}/${r * t}`;
              const cand = [`${p * t + 1}/${r * t - 1}`, `${r * t}/${p * t}`, `${p}/${r}`, `${n}/${d}`].filter(s => s !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `${wj(`${n}/${d}`, '과/와')} 크기가 같은 분수 중에서 분모와 분자의 합이 ${S}인 분수는 무엇인가요?`,
                variablesInfo: { 분수: `${n}/${d}`, 분모분자합: S },
                options,
                answerIndex,
                hint: `먼저 ${n}/${wj(d, '을/를')} 기약분수로 나타내고, 분모와 분자의 합이 ${wj(S, '이/가')} 되도록 같은 수를 곱해 보세요.`,
                steps: [
                  `${n}/${d}의 분모와 분자를 최대공약수 ${wj(k, '으로/로')} 나누면 기약분수 ${p}/${r}입니다.`,
                  `${p}/${r}의 분모와 분자의 합은 ${p + r}이고, ${S} ÷ ${p + r} = ${t}입니다.`,
                  `분모와 분자에 ${wj(t, '을/를')} 곱하면 ${p * t}/${r * t}입니다.`
                ]
              };
            }
            const easy = tier === 'easy';
            const [p, r] = coprimePair(easy ? 7 : 15);
            const k = easy ? rng.pick([2, 3, 4, 5]) : rng.pick([4, 6, 8, 9, 10, 12]);
            const n = p * k;
            const d = r * k;
            const sp = [2, 3, 5].find(q => k % q === 0 && q < k);
            const correct = `${p}/${r}`;
            const cand = [sp ? `${n / sp}/${d / sp}` : `${2 * p}/${2 * r}`, `${p}/${d}`, `${n}/${r}`, p > 1 ? `${r}/${p}` : `${p + 1}/${r + 1}`].filter(s => s !== correct);
            const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
            return {
              question: `${wj(`${n}/${d}`, '을/를')} 기약분수로 나타내면 무엇인가요?`,
              variablesInfo: { 분수: `${n}/${d}` },
              options,
              answerIndex,
              hint: `분모 ${wj(d, '과/와')} 분자 ${n}의 최대공약수로 분모와 분자를 함께 나누세요.`,
              steps: [
                `${wj(n, '과/와')} ${d}의 최대공약수는 ${k}입니다.`,
                `분모와 분자를 ${wj(k, '으로/로')} 나누면 ${n}/${d} = (${n}÷${k})/(${d}÷${k}) = ${p}/${r}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-20',
          dayIndex: 19,
          unit: '초5~6 · 분수의 곱셈',
          standardCode: '[6수01-09]',
          standardName: '분수의 곱셈의 계산 원리를 탐구하고 그 계산을 할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 ((분수)×(자연수), (분수)×(분수))',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '(진분수) × (자연수)',
            normal: '(진분수) × (진분수) — 약분해서 기약분수로',
            hard: '전체의 몇 분의 몇의 몇 분의 몇 — 두 번 곱하는 실생활 문제'
          },
          conceptSummary: '분수의 곱셈은 분자는 분자끼리, 분모는 분모끼리 곱합니다. (분수)×(자연수)는 분자에 자연수를 곱합니다. 계산 중간에 약분하면 편리합니다.',
          formula: 'a/b × c/d = (a×c)/(b×d),  a/b × n = (a×n)/b',
          generate(rng, { tier } = {}) {
            // 기약분수 표기: 정수 / 진분수 / 대분수('1과 1/2')
            const ff = (n, d) => {
              const g = gcd(n, d);
              n /= g; d /= g;
              if (d === 1) return `${n}`;
              if (n < d) return `${n}/${d}`;
              return `${wj(Math.floor(n / d), '과/와')} ${n % d}/${d}`;
            };
            if (tier === 'hard') {
              const [p, q] = rng.pick([[1, 2], [2, 3], [3, 4], [3, 5], [2, 5], [4, 5], [5, 6], [1, 3], [1, 4]]);
              const [r, s] = rng.pick([[1, 2], [2, 3], [3, 4], [1, 3], [1, 4], [2, 5], [3, 5]]);
              const A = q * s * rng.int(2, 10);
              const ans = (A * p * r) / (q * s);
              const veg = (A * p) / q;
              const cand = [veg, veg - ans, (A * r) / s, ans * 2, A - ans]
                .filter(x => Number.isInteger(x) && x > 0 && x !== ans).map(x => `${x} m²`);
              const { options, answerIndex } = buildChoiceSet(rng, `${ans} m²`, cand);
              return {
                question: `넓이가 ${A} m²인 밭의 ${p}/${q}에 채소를 심고, 채소를 심은 부분의 ${r}/${s}에 상추를 심었습니다. 상추를 심은 부분의 넓이는 몇 m²인가요?`,
                variablesInfo: { 밭넓이: `${A} m²`, 비율1: `${p}/${q}`, 비율2: `${r}/${s}` },
                options,
                answerIndex,
                hint: `상추는 밭 전체의 ${p}/${q}의 ${r}/${s}이에요. ${A} × ${p}/${q} × ${r}/${wj(s, '을/를')} 계산하세요.`,
                steps: [
                  `채소를 심은 부분은 ${A} × ${p}/${q} = ${veg} m²입니다.`,
                  `상추를 심은 부분은 ${veg} × ${r}/${s} = ${ans} m²입니다.`,
                  `(한 번에 계산하면 ${A} × ${p}/${q} × ${r}/${s} = ${ans} m²)`
                ]
              };
            }
            if (tier === 'easy') {
              const b = rng.int(2, 9);
              const a = rng.int(1, b - 1);
              const c = rng.int(2, 12);
              const correct = ff(a * c, b);
              const cand = [ff(a, b * c), ff(a + c, b), ff(b * c, a), ff(a * c + b, b)].filter(x => x !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `다음 분수의 곱셈을 계산한 값은?  [ ${a}/${b} × ${c} ]`,
                variablesInfo: { 식: `${a}/${b} × ${c}` },
                options,
                answerIndex,
                hint: `(분수) × (자연수)는 분모는 그대로 두고 분자에만 자연수를 곱해요.`,
                steps: [
                  `${a}/${b} × ${c} = (${a} × ${c})/${b} = ${a * c}/${b}입니다.`,
                  `약분하거나 대분수로 나타내면 ${correct}입니다.`
                ]
              };
            }
            let a, b, c, d;
            for (let t = 0; t < 40; t++) {
              b = rng.int(2, 9); a = rng.int(1, b - 1);
              d = rng.int(2, 9); c = rng.int(1, d - 1);
              if (gcd(a * c, b * d) > 1 && gcd(a, b) === 1 && gcd(c, d) === 1) break;
            }
            const correct = ff(a * c, b * d);
            const cand = [ff(a * d, b * c), `${a + c}/${b + d}`, ff(a * c, b + d), ff(a * c + 1, b * d)].filter(x => x !== correct);
            const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
            return {
              question: `다음 분수의 곱셈을 계산하여 기약분수로 나타낸 값은?  [ ${a}/${b} × ${c}/${d} ]`,
              variablesInfo: { 식: `${a}/${b} × ${c}/${d}` },
              options,
              answerIndex,
              hint: `분자끼리, 분모끼리 곱한 뒤 약분하세요. 분모를 통분할 필요는 없어요.`,
              steps: [
                `${a}/${b} × ${c}/${d} = (${a} × ${c})/(${b} × ${d}) = ${a * c}/${b * d}입니다.`,
                `분모와 분자의 최대공약수 ${wj(gcd(a * c, b * d), '으로/로')} 약분하면 ${correct}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-21',
          dayIndex: 20,
          unit: '초5~6 · 나눗셈의 몫을 분수로',
          standardCode: '[6수01-10]',
          standardName: '‘(자연수)÷(자연수)’에서 나눗셈의 몫을 분수로 나타낼 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 ((자연수)÷(자연수)의 몫을 분수로)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '(작은 수) ÷ (큰 수) — 몫이 진분수',
            normal: '몫이 대분수가 될 수 있는 나눗셈',
            hard: '두 번 나누기 — 나누고 그중 하나를 또 나누기'
          },
          conceptSummary: '(자연수) ÷ (자연수)의 몫은 나누어지는 수를 분자, 나누는 수를 분모로 하는 분수로 나타낼 수 있습니다. ▲ ÷ ● = ▲/●',
          formula: 'a ÷ b = a/b',
          generate(rng, { tier } = {}) {
            const ff = (n, d) => {
              const g = gcd(n, d);
              n /= g; d /= g;
              if (d === 1) return `${n}`;
              if (n < d) return `${n}/${d}`;
              return `${wj(Math.floor(n / d), '과/와')} ${n % d}/${d}`;
            };
            if (tier === 'hard') {
              let a = rng.int(2, 9);
              const b = rng.int(2, 6);
              const c = rng.int(2, 5);
              if (a % b === 0) a += 1;
              const correct = `${ff(a, b * c)} L`;
              const cand = [ff(a, b + c), ff(a * c, b), ff(a, b), ff(b * c, a)].map(x => `${x} L`).filter(x => x !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `주스 ${a} L를 ${b}개의 병에 똑같이 나누어 담은 뒤, 그중 한 병을 ${c}명이 똑같이 나누어 마셨습니다. 한 명이 마신 주스는 몇 L인가요?`,
                variablesInfo: { 나누어지는수: a, 나누는수: b, 나누는수2: c },
                options,
                answerIndex,
                hint: `한 병에 담긴 양(${a} ÷ ${b})을 먼저 분수로 나타낸 뒤, 그것을 다시 ${c}로 나누세요.`,
                steps: [
                  `한 병에 담긴 주스는 ${a} ÷ ${b} = ${ff(a, b)} L입니다.`,
                  `이것을 ${c}명이 나누면 ${a} ÷ ${b} ÷ ${c} = ${a} ÷ ${b * c} = ${ff(a, b * c)} L입니다.`
                ]
              };
            }
            const easy = tier === 'easy';
            let b;
            let a;
            if (easy) { b = rng.int(3, 9); a = rng.int(1, b - 1); }
            else {
              b = rng.int(3, 9); a = rng.int(b + 1, 4 * b);
              if (a % b === 0) a += 1;
            }
            const u = easy ? '판' : 'L';
            const correct = `${ff(a, b)} ${u}`;
            const cand = [ff(b, a), ff(1, b), ff(a, a + b), ff(a + 1, b)].map(x => `${x} ${u}`).filter(x => x !== correct);
            const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
            return {
              question: easy
                ? `피자 ${a}판을 ${b}명이 똑같이 나누어 먹으려고 합니다. 한 명이 먹는 피자는 몇 판인가요?`
                : `주스 ${a} L를 ${b}개의 병에 똑같이 나누어 담으려고 합니다. 한 병에 담기는 주스는 몇 L인가요?`,
              variablesInfo: { 나누어지는수: a, 나누는수: b },
              options,
              answerIndex,
              hint: `나누어지는 수 ${wj(a, '을/를')} 분자, 나누는 수 ${wj(b, '을/를')} 분모로 써 보세요.`,
              steps: [
                `${a} ÷ ${b}의 몫은 ${a}/${b}입니다.`,
                a > b ? `가분수 ${a}/${wj(b, '을/를')} 대분수로 나타내면 ${ff(a, b)}이므로 ${correct}입니다.` : `따라서 ${easy ? '한 명이 먹는 피자' : '한 병에 담기는 주스'}는 ${correct}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-22',
          dayIndex: 21,
          unit: '초5~6 · 분수와 소수의 관계',
          standardCode: '[6수01-12]',
          standardName: '분수와 소수의 관계를 이해하고 크기를 비교하며 그 방법을 설명할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 (분수를 소수로 나타내기, 분수와 소수의 크기 비교)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '분모가 10·100의 약수인 분수를 소수로 나타내기',
            normal: '분수와 소수가 섞인 네 수 중 가장 큰(작은) 수',
            hard: '대분수·소수 셋째 자리까지 섞인 수의 최대·최소의 차'
          },
          conceptSummary: '분모를 10, 100, 1000으로 고치거나 분자를 분모로 나누면 분수를 소수로 나타낼 수 있습니다. 분수와 소수의 크기는 한 가지 형태로 통일하여 비교합니다.',
          formula: 'a/b = (a×k)/(b×k) = 0.□□ (b×k = 10, 100, 1000)',
          generate(rng, { tier } = {}) {
            // 천분의 몇(정수)로 다뤄 부동소수 잔여물을 막는다
            const dec = th => String(Number((th / 1000).toFixed(3)));
            const fracStr = (n, d) => (n >= d ? `${wj(Math.floor(n / d), '과/와')} ${n % d}/${d}` : `${n}/${d}`);
            if (tier === 'easy') {
              const b = rng.pick([2, 4, 5, 10, 20, 25]);
              const a = rng.int(1, b - 1);
              const th = (a * 1000) / b;
              const correct = dec(th);
              const cand = [`${a}.${b}`, a < 10 ? `0.${a}` : `${a / 10}`, dec(th * 10), `${b}.${a}`].filter(x => Number(x) !== Number(correct));
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              const k = [10, 100, 1000].map(x => x / b).find(Number.isInteger);
              return {
                question: `분수 ${wj(`${a}/${b}`, '을/를')} 소수로 나타내면 얼마인가요?`,
                variablesInfo: { 분수: `${a}/${b}` },
                options,
                answerIndex,
                hint: `분모가 10이나 100이 되도록 분모와 분자에 같은 수를 곱해 보세요.`,
                steps: k > 1
                  ? [`분모와 분자에 ${wj(k, '을/를')} 곱하면 ${a}/${b} = ${a * k}/${b * k}입니다.`, `분모가 ${b * k}인 분수는 소수로 바로 나타낼 수 있으므로 ${a * k}/${b * k} = ${correct}입니다.`]
                  : [`분모가 ${b}이므로 소수 첫째 자리까지의 소수로 바로 나타낼 수 있습니다.`, `${a}/${b} = ${correct}입니다.`]
              };
            }
            const hard = tier === 'hard';
            const dens = hard ? [4, 5, 8, 20, 25, 40] : [4, 5, 8, 20, 25];
            let items = [];
            for (let t = 0; t < 80; t++) {
              items = [];
              for (let i = 0; i < 2; i++) {
                const d = rng.pick(dens);
                let n = hard ? rng.int(Math.ceil(d * 0.2), Math.floor(d * 1.8)) : rng.int(Math.ceil(d * 0.3), Math.floor(d * 0.9));
                if (gcd(n, d) !== 1) n += 1;
                items.push({ s: fracStr(n, d), th: (n * 1000) / d, frac: true, n, d });
              }
              for (let i = 0; i < 2; i++) {
                const th = hard ? rng.int(200, 1800) : rng.int(30, 90) * 10;
                items.push({ s: dec(th), th, frac: false });
              }
              const ths = items.map(x => x.th);
              if (new Set(ths).size === 4 && items.every(x => x.th % 1 === 0 && x.th % 1000 !== 0 && (!x.frac || gcd(x.n, x.d) === 1))) break;
            }
            items = rng.shuffle(items);
            const sorted = items.slice().sort((x, y) => x.th - y.th);
            const mn = sorted[0];
            const mx = sorted[3];
            const list = items.map(x => x.s).join(', ');
            const conv = items.filter(x => x.frac).map(x => `${x.s} = ${dec(x.th)}`).join(', ');
            if (hard) {
              const diff = mx.th - mn.th;
              const correct = dec(diff);
              const cand = [mx.th + mn.th, mx.th - sorted[1].th, sorted[2].th - mn.th, sorted[3].th - sorted[2].th].filter(x => x !== diff && x > 0).map(dec);
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `다음 수 중에서 가장 큰 수와 가장 작은 수의 차를 소수로 나타내면 얼마인가요?  [ ${list} ]`,
                variablesInfo: { 수: list },
                options,
                answerIndex,
                hint: `분수를 모두 소수로 바꾸어 한 줄로 세워 보세요. 대분수는 자연수 부분을 잊지 마세요.`,
                steps: [
                  `분수를 소수로 바꾸면 ${conv}입니다.`,
                  `가장 큰 수는 ${dec(mx.th)}, 가장 작은 수는 ${dec(mn.th)}입니다.`,
                  `차는 ${dec(mx.th)} − ${dec(mn.th)} = ${correct}입니다.`
                ]
              };
            }
            const askMin = rng.next() < 0.5;
            const target = askMin ? mn : mx;
            const { options, answerIndex } = buildChoiceSet(rng, target.s, items.filter(x => x !== target).map(x => x.s));
            return {
              question: `다음 수 중에서 가장 ${askMin ? '작은' : '큰'} 수는 무엇인가요?  [ ${list} ]`,
              variablesInfo: { 수: list },
              options,
              answerIndex,
              hint: `분수를 소수로 바꾸면(분모를 100이나 1000으로) 한눈에 비교할 수 있어요.`,
              steps: [
                `분수를 소수로 바꾸면 ${conv}입니다.`,
                `크기 순서는 ${sorted.map(x => dec(x.th)).join(' < ')}입니다.`,
                `따라서 가장 ${askMin ? '작은' : '큰'} 수는 ${target.s}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-23',
          dayIndex: 22,
          unit: '초5~6 · 소수의 곱셈',
          standardCode: '[6수01-13]',
          standardName: '소수의 곱셈의 계산 원리를 탐구하고 그 계산을 할 수 있다.',
          sourceRef: '초등 5~6학년군 수와 연산 ((소수)×(자연수), (소수)×(소수))',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '(소수 한 자리) × (자연수)',
            normal: '(소수 한 자리) × (소수 한 자리)',
            hard: '1 m의 무게(소수 두 자리) × 길이(소수 한 자리) — 소수 셋째 자리 답'
          },
          conceptSummary: '소수의 곱셈은 자연수처럼 곱한 뒤, 곱하는 두 수의 소수점 아래 자리 수를 더한 만큼 소수점을 왼쪽으로 옮깁니다.',
          formula: '0.□ × 0.□ → 소수 둘째 자리,  0.□□ × 0.□ → 소수 셋째 자리',
          generate(rng, { tier } = {}) {
            const ds = (n, scale) => String(Number((n / scale).toFixed(String(scale).length - 1)));
            const notTen = (lo, hi) => { let x = rng.int(lo, hi); if (x % 10 === 0) x += 1; return x; };
            if (tier === 'hard') {
              const w = notTen(105, 495);
              const L = notTen(12, 39);
              const p = w * L;
              const correct = `${ds(p, 1000)} kg`;
              const cand = [ds(p, 100), ds(w + 10 * L, 100), ds(Math.round(p / 100), 10), ds(w * Math.floor(L / 10), 100)]
                .map(x => `${x} kg`).filter(x => x !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `1 m의 무게가 ${ds(w, 100)} kg인 철근이 있습니다. 이 철근 ${ds(L, 10)} m의 무게는 몇 kg인가요?`,
                variablesInfo: { 한미터무게: `${ds(w, 100)} kg`, 길이: `${ds(L, 10)} m` },
                options,
                answerIndex,
                hint: `(1 m의 무게) × (길이)를 계산해요. 소수점 아래 자리 수가 2 + 1 = 3자리가 돼요.`,
                steps: [
                  `식은 ${ds(w, 100)} × ${ds(L, 10)}입니다.`,
                  `자연수처럼 곱하면 ${w} × ${L} = ${p}입니다.`,
                  `소수점 아래 자리 수는 2 + 1 = 3이므로 ${ds(p, 1000)} kg입니다.`
                ]
              };
            }
            let a;
            let b;
            let sa;
            let sb;
            if (tier === 'easy') { a = notTen(2, 29); sa = 10; b = rng.int(2, 9); sb = 1; }
            else { a = notTen(12, 99); sa = 10; b = notTen(2, 35); sb = 10; }
            const p = a * b;
            const scale = sa * sb;
            const correct = ds(p, scale);
            const cand = [ds(p, scale / 10), ds(p, scale * 10), ds(a * sb + b * sa, scale), ds(p + scale, scale)].filter(x => x !== correct);
            const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
            const places = String(scale).length - 1;
            return {
              question: `다음 소수의 곱셈을 계산한 값은?  [ ${ds(a, sa)} × ${ds(b, sb)} ]`,
              variablesInfo: { 식: `${ds(a, sa)} × ${ds(b, sb)}` },
              options,
              answerIndex,
              hint: `소수점을 생각하지 말고 자연수처럼 곱한 뒤, 소수점 아래 자리 수만큼 소수점을 찍으세요.`,
              steps: [
                `자연수처럼 곱하면 ${a} × ${b} = ${p}입니다.`,
                `곱하는 두 수의 소수점 아래 자리 수의 합은 ${places}이므로 ${correct}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-24',
          dayIndex: 23,
          unit: '초5~6 · 비',
          standardCode: '[6수02-02]',
          standardName: '두 양의 크기를 비교하는 상황을 통해 비의 개념을 이해하고, 두 양의 관계를 비로 나타낼 수 있다.',
          sourceRef: '초등 5~6학년군 변화와 관계 (비로 나타내기, 기준량과 비교하는 양)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '두 양의 비 — "△ 수에 대한 ○ 수의 비"',
            normal: '전체와 부분의 비 — 전체를 먼저 구하기',
            hard: '늘어난 양의 비 — 차를 먼저 구한 뒤 비로 나타내기'
          },
          conceptSummary: '"△에 대한 ○의 비"는 ○ : △로 씁니다. 기호 :의 오른쪽이 기준량, 왼쪽이 비교하는 양입니다.',
          formula: '(비교하는 양) : (기준량)',
          generate(rng, { tier } = {}) {
            const r = (x, y) => `${x} : ${y}`;
            if (tier === 'hard') {
              let a = rng.int(20, 60);
              let inc = rng.int(3, 20);
              if (inc === a) inc += 1;
              const b = a + inc;
              const V = { 작년: a, 올해: b, 늘어난: inc };
              const [base, cmp] = rng.pick([['작년', '늘어난'], ['올해', '늘어난'], ['늘어난', '올해'], ['늘어난', '작년']]);
              const correct = r(V[cmp], V[base]);
              const cand = [r(V[base], V[cmp]), r(b, a), r(inc, base === '작년' ? b : a), r(a, b)].filter(x => x !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `어느 학교 수학 동아리 학생은 작년에 ${a}명이었고, 올해는 ${b}명입니다. ${base} 학생 수에 대한 ${cmp} 학생 수의 비를 바르게 나타낸 것은?`,
                variablesInfo: { 작년: a, 올해: b },
                options,
                answerIndex,
                hint: `늘어난 학생 수(${b} − ${a})를 먼저 구하고, '~에 대한'이 붙은 쪽을 기준량(오른쪽)에 쓰세요.`,
                steps: [
                  `늘어난 학생 수는 ${b} − ${a} = ${inc}명입니다.`,
                  `기준량은 ${base} 학생 수(${V[base]}), 비교하는 양은 ${cmp} 학생 수(${V[cmp]})입니다.`,
                  `따라서 비는 ${correct}입니다.`
                ]
              };
            }
            if (tier === 'easy') {
              const a = rng.int(2, 15);
              let b = rng.int(2, 15);
              if (b === a) b += 1;
              const V = { 사과: a, 귤: b };
              const [base, cmp] = rng.next() < 0.5 ? ['귤', '사과'] : ['사과', '귤'];
              const correct = r(V[cmp], V[base]);
              const cand = [r(V[base], V[cmp]), r(V[cmp], a + b), r(a + b, V[cmp]), r(V[base], a + b)].filter(x => x !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `바구니에 사과가 ${a}개, 귤이 ${b}개 있습니다. ${base} 수에 대한 ${cmp} 수의 비를 바르게 나타낸 것은?`,
                variablesInfo: { 사과: a, 귤: b },
                options,
                answerIndex,
                hint: `'~에 대한' 앞에 있는 ${base} 수가 기준량이에요. 기준량은 : 의 오른쪽에 써요.`,
                steps: [
                  `기준량은 ${base} 수 ${V[base]}, 비교하는 양은 ${cmp} 수 ${V[cmp]}입니다.`,
                  `(비교하는 양) : (기준량)이므로 ${correct}입니다.`
                ]
              };
            }
            const a = rng.int(8, 20);
            let b = rng.int(8, 20);
            if (b === a) b += 1;
            const V = { 남학생: a, 여학생: b, 전체: a + b };
            const [base, cmp] = rng.pick([['전체', '여학생'], ['전체', '남학생'], ['여학생', '전체'], ['남학생', '전체']]);
            const label = k => (k === '전체' ? '전체 학생' : k);
            const other = cmp === '여학생' ? '남학생' : cmp === '남학생' ? '여학생' : (base === '여학생' ? '남학생' : '여학생');
            const correct = r(V[cmp], V[base]);
            const cand = [r(V[base], V[cmp]), r(V[other], V[base] === V.전체 ? V.전체 : V[base]), r(a, b), r(b, a)].filter(x => x !== correct);
            const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
            return {
              question: `어느 반의 남학생은 ${a}명, 여학생은 ${b}명입니다. ${label(base)} 수에 대한 ${label(cmp)} 수의 비를 바르게 나타낸 것은?`,
              variablesInfo: { 남학생: a, 여학생: b },
              options,
              answerIndex,
              hint: `전체 학생 수(${a} + ${b})를 먼저 구하세요. '~에 대한' 쪽이 기준량(오른쪽)이에요.`,
              steps: [
                `전체 학생 수는 ${a} + ${b} = ${a + b}명입니다.`,
                `기준량은 ${label(base)} 수(${V[base]}), 비교하는 양은 ${label(cmp)} 수(${V[cmp]})입니다.`,
                `따라서 비는 ${correct}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-25',
          dayIndex: 24,
          unit: '초5~6 · 비례식',
          standardCode: '[6수02-04]',
          standardName: '비례식을 알고, 그 성질을 이해하며, 이를 활용하여 간단한 비례식을 풀 수 있다.',
          sourceRef: '초등 5~6학년군 변화와 관계 (비례식의 성질: 외항의 곱 = 내항의 곱)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '전항·후항에 같은 수를 곱한 비례식',
            normal: '외항의 곱 = 내항의 곱으로 □ 구하기(□ 위치 다양)',
            hard: '소수와 분수가 들어 있는 비례식'
          },
          conceptSummary: '비율이 같은 두 비를 등호로 나타낸 식을 비례식이라 합니다. 비례식에서 외항의 곱과 내항의 곱은 같습니다.',
          formula: 'a : b = c : d  →  a × d = b × c',
          generate(rng, { tier } = {}) {
            const clean = x => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 && x > 0;
            const show = x => String(Number(x.toFixed(2)));
            let T;
            let i;
            let ans;
            let cand;
            if (tier === 'easy') {
              const a = rng.int(1, 9);
              let b = rng.int(1, 9);
              if (b === a) b = a === 9 ? 8 : a + 1;
              const k = rng.int(2, 6);
              i = rng.next() < 0.5 ? 2 : 3;
              T = [a, b, a * k, b * k];
              ans = T[i];
              cand = i === 3 ? [a * k + (b - a), b + k, a * b * k, ans + k] : [b * k - (b - a), a + k, a * b * k, ans + k];
            } else if (tier === 'hard') {
              const u = rng.pick([2, 4, 5, 6, 8, 12, 15]);
              const [r, s] = rng.pick([[1, 2], [1, 4], [3, 4], [2, 5], [1, 5], [3, 5], [1, 3], [2, 3]]);
              i = rng.next() < 0.5 ? 2 : 3;
              let c = 0;
              let d = 0;
              for (let t = 0; t < 80; t++) {
                if (i === 2) { d = rng.int(2, 20); c = (u * d * s) / (10 * r); if (Number.isInteger(c) && c > 0) break; }
                else { c = rng.int(2, 20); d = (10 * r * c) / (s * u); if (Number.isInteger(d) && d > 0) break; }
              }
              if (!(Number.isInteger(c) && Number.isInteger(d))) { i = 3; c = u * s; d = 10 * r; }
              T = [`${u / 10}`, `${r}/${s}`, c, d];
              ans = T[i];
              const A = u / 10;
              const Bv = r / s;
              cand = i === 2 ? [ans * 10, ans / 10, (A * d * Bv), ans + 1] : [ans * 10, ans / 10, (Bv * c * A), ans + 1];
            } else {
              const [p, q] = rng.pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [3, 7], [5, 6], [4, 7], [5, 8]]);
              const m1 = rng.int(2, 9);
              let m2 = rng.int(2, 9);
              if (m2 === m1) m2 = m1 === 9 ? 2 : m1 + 1;
              T = [p * m1, q * m1, p * m2, q * m2];
              i = rng.int(0, 3);
              ans = T[i];
              const j = i ^ 1;
              const ii = (i + 2) % 4;
              const jj = ii ^ 1;
              cand = [T[j] + (T[ii] - T[jj]), (T[jj] * T[j]) / T[ii], (T[ii] * T[jj]) / T[j], ans + p];
            }
            const shown = T.map((x, k) => (k === i ? '□' : String(x)));
            const correct = show(Number(ans));
            const opts = cand.filter(x => clean(x) && show(x) !== correct).map(show);
            const { options, answerIndex } = buildChoiceSet(rng, correct, opts);
            const outer = i === 0 || i === 3;
            const kn = (k) => shown[k];
            return {
              question: `다음 비례식에서 □ 안에 알맞은 수는?  [ ${shown[0]} : ${shown[1]} = ${shown[2]} : ${shown[3]} ]`,
              variablesInfo: { 비례식: `${shown[0]} : ${shown[1]} = ${shown[2]} : ${shown[3]}` },
              options,
              answerIndex,
              hint: tier === 'hard'
                ? `외항의 곱과 내항의 곱이 같아요. 소수는 분수로(예: ${T[0]} = ${Number(T[0]) * 10}/10) 바꾸면 계산이 쉬워요.`
                : `비례식에서 외항(바깥쪽 두 수)의 곱과 내항(안쪽 두 수)의 곱은 같아요.`,
              steps: [
                `외항은 ${kn(0)}, ${kn(3)}이고 내항은 ${kn(1)}, ${kn(2)}입니다. □는 ${outer ? '외항' : '내항'}에 있습니다.`,
                outer
                  ? `외항의 곱 = 내항의 곱이므로 ${i === 0 ? `□ × ${kn(3)}` : `${kn(0)} × □`} = ${kn(1)} × ${kn(2)}입니다.`
                  : `내항의 곱 = 외항의 곱이므로 ${i === 1 ? `□ × ${kn(2)}` : `${kn(1)} × □`} = ${kn(0)} × ${kn(3)}입니다.`,
                `따라서 □ = ${correct}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-26',
          dayIndex: 25,
          unit: '초5~6 · 도형의 합동',
          standardCode: '[6수03-01]',
          standardName: '도형의 합동을 이해하고, 합동인 도형의 성질을 탐구하고 설명할 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (합동인 도형의 대응변·대응각)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '대응점을 보고 대응변의 길이 찾기',
            normal: '삼각형의 세 각의 합(180°)과 대응각으로 각 구하기',
            hard: '사각형의 네 각의 합(360°)과 대응각으로 각 구하기'
          },
          conceptSummary: '모양과 크기가 같아서 포개었을 때 완전히 겹치는 두 도형을 합동이라 합니다. 합동인 두 도형에서 대응변의 길이와 대응각의 크기는 각각 같습니다.',
          formula: '대응변의 길이 = 같음,  대응각의 크기 = 같음',
          generate(rng, { tier } = {}) {
            const quad = tier === 'hard';
            const S1 = quad ? ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] : ['ㄱ', 'ㄴ', 'ㄷ'];
            const S2 = quad ? ['ㅁ', 'ㅂ', 'ㅅ', 'ㅇ'] : ['ㄹ', 'ㅁ', 'ㅂ'];
            let corr;
            if (quad) {
              const rot = rng.int(0, 3);
              const rev = rng.next() < 0.5;
              corr = [0, 1, 2, 3].map(k => (rev ? (rot - k + 4) % 4 : (k + rot) % 4));
            } else corr = rng.shuffle([0, 1, 2]);
            const shape = quad ? '사각형' : '삼각형';
            const pairs = S1.map((v, k) => `점 ${v}은 점 ${S2[corr[k]]}`).join(', ');
            const head = `${shape} ${S1.join('')}과 ${shape} ${S2.join('')}은 서로 합동이고, ${pairs}과 각각 대응합니다.`;
            if (tier === 'easy') {
              let L = [];
              for (let t = 0; t < 60; t++) {
                L = [rng.int(3, 15), rng.int(3, 15), rng.int(3, 15)];
                const [x, y, z] = L.slice().sort((p, q) => p - q);
                if (new Set(L).size === 3 && x + y > z) break;
              }
              const sideName = k => `${S1[k]}${S1[(k + 1) % 3]}`;
              const sIdx = rng.int(0, 2);
              const P = S2[corr[sIdx]];
              const Q = S2[corr[(sIdx + 1) % 3]];
              const asked = rng.next() < 0.5 ? `${P}${Q}` : `${Q}${P}`;
              const ans = L[sIdx];
              const cand = [L[(sIdx + 1) % 3], L[(sIdx + 2) % 3], L[0] + L[1] + L[2]].map(x => `${x} cm`);
              const { options, answerIndex } = buildChoiceSet(rng, `${ans} cm`, cand);
              return {
                question: `${head} 변 ${sideName(0)}이 ${L[0]} cm, 변 ${sideName(1)}이 ${L[1]} cm, 변 ${sideName(2)}이 ${L[2]} cm일 때, 변 ${asked}의 길이는 몇 cm인가요?`,
                variablesInfo: { 도형: shape, 대응: pairs },
                options,
                answerIndex,
                hint: `변 ${asked}의 두 끝점 ${asked[0]}과 ${asked[1]}에 대응하는 점을 먼저 찾아보세요.`,
                steps: [
                  `점 ${P}은 점 ${S1[sIdx]}, 점 ${Q}은 점 ${S1[(sIdx + 1) % 3]}에 대응하므로 변 ${asked}의 대응변은 변 ${sideName(sIdx)}입니다.`,
                  `합동인 도형에서 대응변의 길이는 같으므로 ${ans} cm입니다.`
                ]
              };
            }
            const n = S1.length;
            const total = (n - 2) * 180;
            let ang = [];
            for (let t = 0; t < 80; t++) {
              if (quad) {
                ang = [rng.int(12, 26) * 5, rng.int(12, 26) * 5, rng.int(12, 26) * 5];
                ang.push(360 - ang[0] - ang[1] - ang[2]);
                if (ang[3] >= 50 && ang[3] <= 150 && new Set(ang).size === 4) break;
              } else {
                ang = [rng.int(7, 17) * 5, rng.int(7, 17) * 5];
                ang.push(180 - ang[0] - ang[1]);
                if (ang[2] >= 25 && new Set(ang).size === 3) break;
              }
            }
            const miss = rng.int(0, n - 1);
            const givenIdx = [...Array(n).keys()].filter(k => k !== miss);
            const askedV = S2[corr[miss]];
            const ans = ang[miss];
            const gv = givenIdx.map(k => ang[k]);
            const gsum = gv.reduce((x, y) => x + y, 0);
            const cand = [...gv, quad ? 540 - gsum : 360 - gsum, 180 - gv[0], quad ? 180 - gv[0] - gv[1] : 90 - gv[0]]
              .filter(x => x > 0 && x < 360 && x !== ans).map(x => `${x}°`);
            const { options, answerIndex } = buildChoiceSet(rng, `${ans}°`, cand);
            const gText = givenIdx.map(k => `각 ${S1[k]}이 ${ang[k]}°`).join(', ');
            return {
              question: `${head} ${gText}일 때, 각 ${askedV}의 크기는 몇 도인가요?`,
              variablesInfo: { 도형: shape, 대응: pairs },
              options,
              answerIndex,
              hint: `각 ${askedV}의 대응각을 먼저 찾고, ${shape}의 ${quad ? '네' : '세'} 각의 크기의 합이 ${total}°임을 이용하세요.`,
              steps: [
                `점 ${askedV}은 점 ${S1[miss]}에 대응하므로 각 ${askedV}의 크기는 각 ${S1[miss]}의 크기와 같습니다.`,
                `${shape}의 ${quad ? '네' : '세'} 각의 합은 ${total}°이므로 각 ${S1[miss]} = ${total}° − (${gv.join('° + ')}°) = ${ans}°입니다.`,
                `따라서 각 ${askedV}의 크기는 ${ans}°입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-27',
          dayIndex: 26,
          unit: '초5~6 · 선대칭도형과 점대칭도형',
          standardCode: '[6수03-02]',
          standardName: '실생활과 연결하여 선대칭도형과 점대칭도형을 이해하고 그릴 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (선대칭도형·점대칭도형의 성질)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '점대칭도형 — 대칭의 중심은 대응점을 이은 선분을 둘로 똑같이 나눔',
            normal: '선대칭도형 — 대칭축 한쪽 변으로 둘레 구하기',
            hard: '점대칭 육각형 — 둘레와 대응변으로 모르는 변 구하기'
          },
          conceptSummary: '선대칭도형은 대칭축으로 접으면 완전히 겹치고, 점대칭도형은 대칭의 중심을 기준으로 180° 돌리면 완전히 겹칩니다. 두 경우 모두 대응변의 길이가 같습니다.',
          formula: '점대칭: (대칭의 중심 ~ 점) = (대칭의 중심 ~ 대응점),  대응변의 길이는 같음',
          generate(rng, { tier } = {}) {
            if (tier === 'easy') {
              const a = rng.int(3, 24);
              const fwd = rng.next() < 0.5;
              const ans = fwd ? 2 * a : a;
              const cand = (fwd ? [a, 4 * a, a + 2] : [2 * a, 4 * a, a / 2]).filter(x => x !== ans).map(x => `${x} cm`);
              const { options, answerIndex } = buildChoiceSet(rng, `${ans} cm`, cand);
              return {
                question: fwd
                  ? `점대칭도형에서 점 ㄱ의 대응점은 점 ㄹ이고, 대칭의 중심은 점 ㅇ입니다. 선분 ㄱㅇ의 길이가 ${a} cm일 때, 선분 ㄱㄹ의 길이는 몇 cm인가요?`
                  : `점대칭도형에서 점 ㄱ의 대응점은 점 ㄹ이고, 대칭의 중심은 점 ㅇ입니다. 선분 ㄱㄹ의 길이가 ${2 * a} cm일 때, 선분 ㄱㅇ의 길이는 몇 cm인가요?`,
                variablesInfo: { 도형: '점대칭도형' },
                options,
                answerIndex,
                hint: `대칭의 중심은 대응점끼리 이은 선분을 둘로 똑같이 나눠요.`,
                steps: [
                  `대칭의 중심 ㅇ에서 점 ㄱ까지의 거리와 점 ㄹ까지의 거리는 같습니다.`,
                  fwd ? `따라서 선분 ㄱㄹ = ${a} × 2 = ${ans} cm입니다.` : `따라서 선분 ㄱㅇ = ${2 * a} ÷ 2 = ${ans} cm입니다.`
                ]
              };
            }
            if (tier === 'hard') {
              const a = rng.int(4, 15);
              const b = rng.int(4, 15);
              const c = rng.int(4, 15);
              const P = 2 * (a + b + c);
              const cand = [P - a - b, P / 2, P / 2 - a, c + a].filter(x => x > 0 && x !== c).map(x => `${x} cm`);
              const { options, answerIndex } = buildChoiceSet(rng, `${c} cm`, cand);
              return {
                question: `점대칭도형인 육각형 ㄱㄴㄷㄹㅁㅂ에서 점 ㄱ의 대응점은 점 ㄹ입니다. 변 ㄱㄴ이 ${a} cm, 변 ㄴㄷ이 ${b} cm이고 육각형의 둘레가 ${P} cm일 때, 변 ㄷㄹ의 길이는 몇 cm인가요?`,
                variablesInfo: { 도형: '점대칭 육각형' },
                options,
                answerIndex,
                hint: `점 ㄱ↔ㄹ, ㄴ↔ㅁ, ㄷ↔ㅂ이 대응하므로 변 ㄱㄴ↔ㄹㅁ, ㄴㄷ↔ㅁㅂ, ㄷㄹ↔ㅂㄱ이 대응변이에요.`,
                steps: [
                  `대응변의 길이가 같으므로 둘레 = 2 × (변 ㄱㄴ + 변 ㄴㄷ + 변 ㄷㄹ)입니다.`,
                  `변 ㄱㄴ + 변 ㄴㄷ + 변 ㄷㄹ = ${P} ÷ 2 = ${P / 2} cm입니다.`,
                  `변 ㄷㄹ = ${P / 2} − ${a} − ${b} = ${c} cm입니다.`
                ]
              };
            }
            const k = rng.int(3, 4);
            const L = Array.from({ length: k }, () => rng.int(2, 15));
            const s = L.reduce((x, y) => x + y, 0);
            const ans = 2 * s;
            const cand = [s, 2 * (s - L[k - 1]), 2 * s + L[0], 4 * s].filter(x => x !== ans).map(x => `${x} cm`);
            const { options, answerIndex } = buildChoiceSet(rng, `${ans} cm`, cand);
            return {
              question: `어떤 선대칭도형의 대칭축 위에는 변이 없고, 대칭축의 한쪽에 있는 변의 길이가 각각 ${L.map(x => `${x} cm`).join(', ')}입니다. 이 선대칭도형의 둘레는 몇 cm인가요?`,
              variablesInfo: { 도형: '선대칭도형', 변의수: k },
              options,
              answerIndex,
              hint: `대칭축으로 접으면 반대쪽 변과 완전히 겹쳐요. 한쪽 변의 합을 두 번 더하세요.`,
              steps: [
                `대칭축 한쪽에 있는 변의 길이의 합은 ${L.join(' + ')} = ${s} cm입니다.`,
                `반대쪽에도 길이가 같은 대응변이 있으므로 둘레는 ${s} × 2 = ${ans} cm입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-28',
          dayIndex: 27,
          unit: '초5~6 · 직육면체와 정육면체',
          standardCode: '[6수03-03]',
          standardName: '직육면체와 정육면체를 이해하고, 구성 요소와 성질을 탐구하고 설명할 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (직육면체의 모서리)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '정육면체의 모든 모서리 길이의 합(12개)',
            normal: '직육면체의 모든 모서리 길이의 합(같은 길이 4개씩)',
            hard: '모서리 길이의 합으로 모르는 높이 구하기'
          },
          conceptSummary: '직육면체는 면 6개, 모서리 12개, 꼭짓점 8개로 이루어지며, 길이가 같은 모서리가 4개씩 3쌍 있습니다. 정육면체는 12개 모서리의 길이가 모두 같습니다.',
          formula: '직육면체 모서리 합 = 4 × (가로 + 세로 + 높이),  정육면체 = 12 × 한 모서리',
          generate(rng, { tier } = {}) {
            if (tier === 'easy') {
              const a = rng.int(2, 20);
              const cand = [6 * a, 8 * a, 4 * a].map(x => `${x} cm`);
              const { options, answerIndex } = buildChoiceSet(rng, `${12 * a} cm`, cand);
              return {
                question: `한 모서리의 길이가 ${a} cm인 정육면체의 모든 모서리의 길이의 합은 몇 cm인가요?`,
                variablesInfo: { 한모서리: `${a} cm` },
                options,
                answerIndex,
                hint: `정육면체의 모서리는 모두 몇 개이고, 길이는 모두 같을까요?`,
                steps: [`정육면체의 모서리는 12개이고 길이가 모두 ${a} cm입니다.`, `${a} × 12 = ${12 * a} cm입니다.`]
              };
            }
            const a = rng.int(2, 15);
            const b = rng.int(2, 15);
            const h = rng.int(2, 15);
            const s = a + b + h;
            if (tier === 'hard') {
              const S = 4 * s;
              const cand = [S - a - b, S / 4, S / 2 - a - b, S / 4 - a].filter(x => Number.isInteger(x) && x > 0 && x !== h).map(x => `${x} cm`);
              const { options, answerIndex } = buildChoiceSet(rng, `${h} cm`, cand);
              return {
                question: `직육면체의 모든 모서리의 길이의 합이 ${S} cm입니다. 가로가 ${a} cm, 세로가 ${b} cm일 때, 높이는 몇 cm인가요?`,
                variablesInfo: { 모서리합: `${S} cm`, 가로: `${a} cm`, 세로: `${b} cm` },
                options,
                answerIndex,
                hint: `가로, 세로, 높이가 각각 4개씩 있어요. 합을 4로 나누면 (가로 + 세로 + 높이)가 돼요.`,
                steps: [
                  `모서리 길이의 합 = 4 × (가로 + 세로 + 높이)이므로 가로 + 세로 + 높이 = ${S} ÷ 4 = ${s} cm입니다.`,
                  `높이 = ${s} − ${a} − ${b} = ${h} cm입니다.`
                ]
              };
            }
            const cand = [s, 2 * s, 3 * s, 6 * s].map(x => `${x} cm`);
            const { options, answerIndex } = buildChoiceSet(rng, `${4 * s} cm`, cand);
            return {
              question: `가로 ${a} cm, 세로 ${b} cm, 높이 ${h} cm인 직육면체의 모든 모서리의 길이의 합은 몇 cm인가요?`,
              variablesInfo: { 가로: `${a} cm`, 세로: `${b} cm`, 높이: `${h} cm` },
              options,
              answerIndex,
              hint: `직육면체에는 가로, 세로, 높이와 길이가 같은 모서리가 각각 4개씩 있어요.`,
              steps: [`가로·세로·높이의 합은 ${a} + ${b} + ${h} = ${s} cm입니다.`, `각각 4개씩 있으므로 ${s} × 4 = ${4 * s} cm입니다.`]
            };
          }
        },
        {
          id: 'BAS-29',
          dayIndex: 28,
          unit: '초5~6 · 각기둥과 각뿔',
          standardCode: '[6수03-05]',
          standardName: '각기둥과 각뿔을 이해하고, 구성 요소와 성질을 탐구하고 설명할 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (각기둥·각뿔의 면, 모서리, 꼭짓점의 수)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '□각기둥의 면·모서리·꼭짓점 중 하나의 수',
            normal: '각기둥·각뿔의 구성 요소 수와 그 합',
            hard: '모서리의 수로 밑면의 모양을 알아낸 뒤 면·꼭짓점의 수 구하기'
          },
          conceptSummary: '밑면이 □각형인 각기둥은 면 (□+2)개, 모서리 (□×3)개, 꼭짓점 (□×2)개이고, 각뿔은 면 (□+1)개, 모서리 (□×2)개, 꼭짓점 (□+1)개입니다.',
          formula: '각기둥: 면 n+2, 모서리 3n, 꼭짓점 2n  /  각뿔: 면 n+1, 모서리 2n, 꼭짓점 n+1',
          generate(rng, { tier } = {}) {
            const KO = ['삼', '사', '오', '육', '칠', '팔', '구', '십'];
            const PARTS = ['면', '모서리', '꼭짓점'];
            const cnt = (kind, n) => (kind === '기둥' ? { 면: n + 2, 모서리: 3 * n, 꼭짓점: 2 * n } : { 면: n + 1, 모서리: 2 * n, 꼭짓점: n + 1 });
            const rule = kind => (kind === '기둥' ? '면 (n+2)개, 모서리 (n×3)개, 꼭짓점 (n×2)개' : '면 (n+1)개, 모서리 (n×2)개, 꼭짓점 (n+1)개');
            const ask = (c, parts) => parts.reduce((x, p) => x + c[p], 0);
            const askText = parts => (parts.length === 2 ? `${parts[0]}의 수와 ${parts[1]}의 수의 합은` : `${parts[0]}의 수는`);
            const n = rng.int(3, 10);
            if (tier === 'hard') {
              const kind = rng.pick(['기둥', '뿔']);
              const M = kind === '기둥' ? 3 * n : 2 * n;
              const parts = rng.pick([['면'], ['꼭짓점'], ['면', '꼭짓점']]);
              const c = cnt(kind, n);
              const ans = ask(c, parts);
              const otherKind = kind === '기둥' ? '뿔' : '기둥';
              const n2 = otherKind === '기둥' ? M / 3 : M / 2;
              const cand = [Number.isInteger(n2) ? ask(cnt(otherKind, n2), parts) : ans + 2, ask(cnt(kind, M), parts), ask(c, ['모서리']) + (parts.length === 2 ? 0 : 1), ans + 1]
                .filter(x => x !== ans && x > 0).map(x => `${x}개`);
              const { options, answerIndex } = buildChoiceSet(rng, `${ans}개`, cand);
              return {
                question: `모서리가 ${M}개인 각${kind}이 있습니다. 이 입체도형의 ${askText(parts)} 몇 개인가요?`,
                variablesInfo: { 입체도형: `각${kind}`, 모서리수: M },
                options,
                answerIndex,
                hint: `각${kind}의 모서리 수는 밑면의 변의 수의 ${kind === '기둥' ? 3 : 2}배예요. 먼저 밑면이 몇 각형인지 구하세요.`,
                steps: [
                  `각${kind}의 모서리 수 = 밑면의 변의 수 × ${kind === '기둥' ? 3 : 2}이므로 밑면의 변의 수는 ${M} ÷ ${kind === '기둥' ? 3 : 2} = ${n}, 즉 ${KO[n - 3]}각${kind}입니다.`,
                  `${KO[n - 3]}각${kind}의 ${parts.map(p => `${p} ${c[p]}개`).join(', ')}입니다.`,
                  `따라서 답은 ${ans}개입니다.`
                ]
              };
            }
            const kind = tier === 'easy' ? '기둥' : rng.pick(['기둥', '뿔']);
            const parts = tier === 'easy' || rng.next() < 0.5
              ? [rng.pick(PARTS)]
              : rng.pick([['면', '모서리'], ['면', '꼭짓점'], ['모서리', '꼭짓점']]);
            const c = cnt(kind, n);
            const ans = ask(c, parts);
            const other = cnt(kind === '기둥' ? '뿔' : '기둥', n);
            const cand = [ask(other, parts), ...PARTS.filter(p => !parts.includes(p)).map(p => c[p]), ask(c, PARTS), n]
              .filter(x => x !== ans).map(x => `${x}개`);
            const { options, answerIndex } = buildChoiceSet(rng, `${ans}개`, cand);
            const name = `${KO[n - 3]}각${kind}`;
            return {
              question: `${name}의 ${askText(parts)} 몇 개인가요?`,
              variablesInfo: { 입체도형: name },
              options,
              answerIndex,
              hint: `${name}의 밑면은 ${KO[n - 3]}각형(변 ${n}개)이에요. 각${kind}: ${rule(kind)}.`,
              steps: [
                `${name}의 밑면의 변의 수는 ${n}입니다.`,
                `${parts.map(p => `${p}의 수는 ${c[p]}개`).join(', ')}입니다.${parts.length === 2 ? ` 합은 ${c[parts[0]]} + ${c[parts[1]]} = ${ans}개입니다.` : ''}`
              ]
            };
          }
        },
        {
          id: 'BAS-30',
          dayIndex: 29,
          unit: '초5~6 · 원기둥의 전개도',
          standardCode: '[6수03-08]',
          standardName: '원기둥의 전개도를 그릴 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (원기둥의 전개도: 옆면의 가로 = 밑면의 둘레)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '전개도에서 옆면의 가로 = 밑면의 둘레(지름 × 3.14)',
            normal: '전개도에서 옆면의 넓이 = 밑면의 둘레 × 높이',
            hard: '옆면의 가로로 밑면의 반지름을 거꾸로 구해 한 밑면의 넓이 구하기'
          },
          conceptSummary: '원기둥의 전개도에서 옆면은 직사각형이며, 옆면의 가로는 밑면인 원의 둘레(원주), 세로는 원기둥의 높이와 같습니다.',
          formula: '옆면의 가로 = 지름 × 3.14 = 반지름 × 2 × 3.14,  옆면의 세로 = 높이',
          generate(rng, { tier } = {}) {
            const pi = 3.14;
            const f2 = x => Number(x.toFixed(2));
            if (tier === 'easy') {
              const d = rng.int(2, 20);
              const h = rng.int(3, 15);
              const ans = f2(pi * d);
              const cand = [f2(pi * d / 2), f2(pi * d * 2), h, 3 * d].filter(x => x !== ans).map(x => `${x} cm`);
              const { options, answerIndex } = buildChoiceSet(rng, `${ans} cm`, cand);
              return {
                question: `밑면의 지름이 ${d} cm, 높이가 ${h} cm인 원기둥의 전개도를 그렸습니다. 옆면인 직사각형의 가로의 길이는 몇 cm인가요? (원주율: 3.14)`,
                variablesInfo: { 지름: `${d} cm`, 높이: `${h} cm`, 원주율: pi },
                options,
                answerIndex,
                hint: `옆면을 말아 붙이면 가로가 밑면의 둘레와 딱 맞아요. 원주 = 지름 × 원주율.`,
                steps: [`옆면의 가로는 밑면의 둘레(원주)와 같습니다.`, `${d} × 3.14 = ${ans} cm입니다.`]
              };
            }
            if (tier === 'hard') {
              const r = rng.int(2, 10);
              const h = rng.int(3, 15);
              const L = f2(2 * pi * r);
              const ans = f2(pi * r * r);
              const cand = [f2(L * h), f2(pi * 4 * r * r), L, f2(pi * r)].filter(x => x !== ans).map(x => `${x} cm²`);
              const { options, answerIndex } = buildChoiceSet(rng, `${ans} cm²`, cand);
              return {
                question: `원기둥의 전개도에서 옆면인 직사각형의 가로가 ${L} cm, 세로가 ${h} cm입니다. 이 원기둥의 한 밑면의 넓이는 몇 cm²인가요? (원주율: 3.14)`,
                variablesInfo: { 옆면가로: `${L} cm`, 높이: `${h} cm`, 원주율: pi },
                options,
                answerIndex,
                hint: `옆면의 가로 = 반지름 × 2 × 3.14 예요. 먼저 반지름을 구한 뒤 원의 넓이를 구하세요.`,
                steps: [
                  `옆면의 가로는 밑면의 둘레이므로 반지름 × 2 × 3.14 = ${L}, 반지름 = ${L} ÷ 6.28 = ${r} cm입니다.`,
                  `한 밑면의 넓이는 ${r} × ${r} × 3.14 = ${ans} cm²입니다.`
                ]
              };
            }
            const r = rng.int(2, 10);
            const h = rng.int(3, 15);
            const ans = f2(2 * pi * r * h);
            const cand = [f2(pi * r * h), f2(pi * r * r), f2(2 * pi * r * h + 2 * pi * r * r), f2(pi * r * r * h)].filter(x => x !== ans).map(x => `${x} cm²`);
            const { options, answerIndex } = buildChoiceSet(rng, `${ans} cm²`, cand);
            return {
              question: `밑면의 반지름이 ${r} cm, 높이가 ${h} cm인 원기둥의 전개도에서 옆면의 넓이는 몇 cm²인가요? (원주율: 3.14)`,
              variablesInfo: { 반지름: `${r} cm`, 높이: `${h} cm`, 원주율: pi },
              options,
              answerIndex,
              hint: `옆면은 가로가 밑면의 둘레, 세로가 높이인 직사각형이에요.`,
              steps: [
                `옆면의 가로 = ${r} × 2 × 3.14 = ${f2(2 * pi * r)} cm, 세로 = ${h} cm입니다.`,
                `옆면의 넓이 = ${f2(2 * pi * r)} × ${h} = ${ans} cm²입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-31',
          dayIndex: 30,
          unit: '초5~6 · 쌓기나무',
          standardCode: '[6수03-09]',
          standardName: '쌓기나무로 만든 입체도형을 보고 사용된 쌓기나무의 개수를 구할 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (위에서 본 모양에 수를 써서 쌓기나무 개수 구하기)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '층별 개수를 더해 전체 개수 구하기',
            normal: '위에서 본 모양의 각 칸에 쓴 수로 전체 개수 구하기',
            hard: '3×3 위에서 본 모양 — 정육면체를 만들려면 더 필요한 개수'
          },
          conceptSummary: '쌓기나무의 개수는 층별로 세어 더하거나, 위에서 본 모양의 각 칸에 그 자리에 쌓인 개수를 써서 모두 더하여 구합니다.',
          formula: '전체 개수 = (각 칸에 쌓인 개수의 합) = (층별 개수의 합)',
          generate(rng, { tier } = {}) {
            if (tier === 'easy') {
              const a = rng.int(4, 9);
              const b = rng.int(2, a);
              const c = rng.int(1, b);
              const s = a + b + c;
              const cand = [a, a + b, 3 * a, s + 1].filter(x => x !== s).map(x => `${x}개`);
              const { options, answerIndex } = buildChoiceSet(rng, `${s}개`, cand);
              return {
                question: `쌓기나무로 만든 모양에서 1층에 ${a}개, 2층에 ${b}개, 3층에 ${c}개를 쌓았습니다. 사용한 쌓기나무는 모두 몇 개인가요?`,
                variablesInfo: { 층별개수: `${a}, ${b}, ${c}` },
                options,
                answerIndex,
                hint: `층마다 센 개수를 모두 더하세요.`,
                steps: [`층별 개수는 1층 ${a}개, 2층 ${b}개, 3층 ${c}개입니다.`, `${a} + ${b} + ${c} = ${s}개입니다.`]
              };
            }
            if (tier === 'hard') {
              let H = [];
              for (let t = 0; t < 40; t++) {
                H = Array.from({ length: 9 }, () => rng.int(1, 3));
                if (H.some(x => x < 3)) break;
              }
              const s = H.reduce((x, y) => x + y, 0);
              const ans = 27 - s;
              const lack = H.filter(x => x < 3).length;
              const cand = [s, 27, lack, 18 - s > 0 ? 18 - s : ans + 3].filter(x => x !== ans && x > 0).map(x => `${x}개`);
              const { options, answerIndex } = buildChoiceSet(rng, `${ans}개`, cand);
              return {
                question: `위에서 본 모양이 3×3 정사각형인 쌓기나무 모양이 있습니다. 각 칸에 쌓인 개수를 윗줄부터 차례로 쓰면 ${H.join(', ')}입니다. 쌓기나무를 더 쌓아서 한 모서리에 쌓기나무가 3개씩인 정육면체를 만들려면 쌓기나무는 적어도 몇 개 더 필요한가요?`,
                variablesInfo: { 칸별개수: H.join(', '), 정육면체한모서리: 3 },
                options,
                answerIndex,
                hint: `완성된 정육면체에는 3 × 3 × 3개가 필요해요. 지금 있는 개수를 빼세요.`,
                steps: [
                  `지금 쌓인 쌓기나무는 ${H.join(' + ')} = ${s}개입니다.`,
                  `한 모서리에 3개씩인 정육면체는 3 × 3 × 3 = 27개로 만듭니다.`,
                  `더 필요한 쌓기나무는 27 − ${s} = ${ans}개입니다.`
                ]
              };
            }
            const k = rng.int(4, 7);
            const H = Array.from({ length: k }, () => rng.int(1, 4));
            const s = H.reduce((x, y) => x + y, 0);
            const mx = Math.max(...H);
            const cand = [k, mx * k, s + k, s - 1].filter(x => x !== s && x > 0).map(x => `${x}개`);
            const { options, answerIndex } = buildChoiceSet(rng, `${s}개`, cand);
            return {
              question: `쌓기나무로 쌓은 모양을 위에서 본 모양의 각 칸에 그 자리에 쌓인 쌓기나무의 개수를 쓰면 ${H.join(', ')}입니다. 사용한 쌓기나무는 모두 몇 개인가요?`,
              variablesInfo: { 칸별개수: H.join(', ') },
              options,
              answerIndex,
              hint: `칸의 수(${k}칸)가 아니라 각 칸에 쓰인 수를 모두 더해야 해요.`,
              steps: [`각 칸의 수는 그 자리에 쌓인 개수입니다.`, `${H.join(' + ')} = ${s}개입니다.`]
            };
          }
        },
        {
          id: 'BAS-32',
          dayIndex: 31,
          unit: '초5~6 · 원주율',
          standardCode: '[6수03-15]',
          standardName: '여러 가지 원 모양 물체의 원주와 지름을 측정하는 활동을 통하여, 원주율이 일정한 값임을 알고 그 근삿값을 사용할 수 있다.',
          sourceRef: '초등 5~6학년군 도형과 측정 (원주율 = 원주 ÷ 지름, 근삿값 3.14)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '측정한 원주 ÷ 지름을 반올림해 원주율 어림하기',
            normal: '원주율 3.14로 원주에서 지름 구하기',
            hard: '굴러간 거리(m)와 바퀴 지름(cm)으로 회전 수 구하기'
          },
          conceptSummary: '원의 지름에 대한 원주의 비율(원주 ÷ 지름)을 원주율이라 하며, 원의 크기와 관계없이 일정합니다. 원주율의 근삿값으로 3.14를 씁니다.',
          formula: '원주율 = 원주 ÷ 지름 ≈ 3.14,  지름 = 원주 ÷ 3.14',
          generate(rng, { tier } = {}) {
            const pi = 3.14;
            const f2 = x => Number(x.toFixed(2));
            if (tier === 'easy') {
              let d = 10;
              let C10 = 314;
              for (let t = 0; t < 60; t++) {
                d = rng.int(5, 40);
                C10 = Math.round(pi * d * 10) + rng.int(-3, 3);
                const num = C10 * 10;
                if ((2 * num) % d !== 0 || num % d === 0) break; // 반올림 경계(…5) 피하기
              }
              const C = C10 / 10;
              const ans = Math.round((C10 * 10) / d) / 100;
              const cand = [f2(d / C), f2((2 * C) / d), f2(C - d), Number((C / d).toFixed(1)) === ans ? f2(ans + 0.01) : Number((C / d).toFixed(1))]
                .filter(x => x !== ans && x > 0).map(String);
              const { options, answerIndex } = buildChoiceSet(rng, String(ans), cand);
              return {
                question: `원 모양 접시의 지름을 재었더니 ${d} cm, 원주를 재었더니 ${C} cm였습니다. (원주)÷(지름)을 반올림하여 소수 둘째 자리까지 나타내면 얼마인가요?`,
                variablesInfo: { 원주: `${C} cm`, 지름: `${d} cm` },
                options,
                answerIndex,
                hint: `지름에 대한 원주의 비율이에요. 원주 ÷ 지름을 소수 셋째 자리까지 구한 뒤 반올림하세요.`,
                steps: [
                  `(원주) ÷ (지름) = ${C} ÷ ${d} = ${Number((C / d).toFixed(3))}…입니다.`,
                  `소수 셋째 자리에서 반올림하면 ${ans}이고, 원주율의 근삿값 3.14에 가깝습니다.`
                ]
              };
            }
            if (tier === 'hard') {
              const d = rng.pick([30, 40, 50, 60, 70, 80]);
              const k = rng.int(5, 40);
              const D = Number(((pi * d * k) / 100).toFixed(3));
              const cand = [2 * k, k % 2 === 0 ? k / 2 : k + 1, f2(pi * k), k * 10].filter(x => x !== k).map(x => `${x}바퀴`);
              const { options, answerIndex } = buildChoiceSet(rng, `${k}바퀴`, cand);
              return {
                question: `지름이 ${d} cm인 바퀴를 굴렸더니 ${D} m를 굴러갔습니다. 바퀴는 몇 바퀴 돌았나요? (원주율: 3.14)`,
                variablesInfo: { 지름: `${d} cm`, 굴러간거리: `${D} m`, 원주율: pi },
                options,
                answerIndex,
                hint: `바퀴가 한 바퀴 돌면 원주만큼 굴러가요. 단위를 cm로 맞춘 뒤 나누세요.`,
                steps: [
                  `바퀴의 원주는 ${d} × 3.14 = ${f2(pi * d)} cm입니다.`,
                  `굴러간 거리 ${D} m = ${f2(D * 100)} cm입니다.`,
                  `${f2(D * 100)} ÷ ${f2(pi * d)} = ${k}이므로 ${k}바퀴 돌았습니다.`
                ]
              };
            }
            const d = rng.int(3, 40);
            const C = f2(pi * d);
            const cand = [d % 2 === 0 ? d / 2 : f2(d / 2), 2 * d, f2(C * pi)].filter(x => x !== d).map(x => `${x} cm`);
            const { options, answerIndex } = buildChoiceSet(rng, `${d} cm`, cand);
            return {
              question: `원주가 ${C} cm인 원의 지름은 몇 cm인가요? (원주율: 3.14)`,
              variablesInfo: { 원주: `${C} cm`, 원주율: pi },
              options,
              answerIndex,
              hint: `원주 = 지름 × 원주율이므로 지름 = 원주 ÷ 원주율이에요.`,
              steps: [`지름 = (원주) ÷ (원주율)입니다.`, `${C} ÷ 3.14 = ${d} cm입니다.`]
            };
          }
        },
        {
          id: 'BAS-33',
          dayIndex: 32,
          unit: '초5~6 · 가능성을 말로 표현하기',
          standardCode: '[6수04-04]',
          standardName: '사건이 일어날 가능성을 말로 표현하고 비교할 수 있다.',
          sourceRef: '초등 5~6학년군 자료와 가능성 (불가능하다·반반이다·확실하다)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '한 가지 색만 있거나 반반인 주머니 — 확실/불가능/반반',
            normal: '여러 색이 섞인 주머니 — ~일 것 같다/~아닐 것 같다까지',
            hard: '두 주머니의 가능성을 비교하고 말로 표현하기'
          },
          conceptSummary: '일이 일어날 가능성은 \'불가능하다\', \'~아닐 것 같다\', \'반반이다\', \'~일 것 같다\', \'확실하다\'로 표현할 수 있습니다.',
          formula: '전체 중 절반보다 적음 → ~아닐 것 같다, 절반 → 반반이다, 절반보다 많음 → ~일 것 같다',
          generate(rng, { tier } = {}) {
            const W = ['불가능하다', '~아닐 것 같다', '반반이다', '~일 것 같다', '확실하다'];
            const wIdx = (a, t) => (a === 0 ? 0 : a === t ? 4 : 2 * a === t ? 2 : 2 * a < t ? 1 : 3);
            const near = i => [i + 1, i - 1, i + 2, i - 2, i + 3, i - 3].filter(k => k >= 0 && k < 5).map(k => W[k]);
            if (tier === 'hard') {
              let r1, b1, r2, b2;
              for (let t = 0; t < 60; t++) {
                r1 = rng.int(1, 9); b1 = rng.int(1, 9); r2 = rng.int(1, 9); b2 = rng.int(1, 9);
                if (r1 * (r2 + b2) !== r2 * (r1 + b1)) break;
              }
              if (r1 * (r2 + b2) === r2 * (r1 + b1)) r1 += 1;
              const p1 = [r1, r1 + b1];
              const p2 = [r2, r2 + b2];
              const firstBig = p1[0] * p2[1] > p2[0] * p1[1];
              const [bigBag, smallBag] = firstBig ? ['가', '나'] : ['나', '가'];
              const big = firstBig ? p1 : p2;
              const small = firstBig ? p2 : p1;
              const bw = W[wIdx(big[0], big[1])];
              const sw = W[wIdx(small[0], small[1])];
              const opt = (bag, w) => `${bag} 주머니, ${w}`;
              const correct = opt(bigBag, bw);
              const cand = [opt(smallBag, sw), opt(smallBag, bw), ...near(wIdx(big[0], big[1])).map(w => opt(bigBag, w))].filter(x => x !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, cand);
              return {
                question: `가 주머니에는 빨간 공 ${r1}개, 파란 공 ${b1}개가, 나 주머니에는 빨간 공 ${r2}개, 파란 공 ${b2}개가 들어 있습니다. 한 주머니에서 공 1개를 꺼낼 때 빨간 공이 나올 가능성이 더 높은 주머니와 그 가능성을 말로 바르게 나타낸 것은?`,
                variablesInfo: { 가빨간공: r1, 가파란공: b1, 나빨간공: r2, 나파란공: b2 },
                options,
                answerIndex,
                hint: `빨간 공의 개수만 비교하면 안 돼요. 각 주머니 전체 공 수에 대한 빨간 공 수를 비교하세요.`,
                steps: [
                  `가 주머니는 ${r1 + b1}개 중 ${r1}개, 나 주머니는 ${r2 + b2}개 중 ${r2}개가 빨간 공입니다.`,
                  `${wj(`${r1}/${r1 + b1}`, '과/와')} ${wj(`${r2}/${r2 + b2}`, '을/를')} 비교하면 ${bigBag} 주머니가 더 높습니다.`,
                  `${bigBag} 주머니는 ${big[1]}개 중 ${big[0]}개로 ${2 * big[0] === big[1] ? '절반' : 2 * big[0] > big[1] ? '절반보다 많으므로' : '절반보다 적으므로'} '${bw}'입니다.`
                ]
              };
            }
            let V;
            let color;
            if (tier === 'easy') {
              const mode = rng.int(0, 2);
              const n = rng.int(2, 10);
              if (mode === 0) { V = { 빨간공: n }; color = rng.pick(['빨간', '파란']); }
              else { V = { 빨간공: n, 파란공: n }; color = rng.pick(['빨간', '파란']); }
              if (mode === 2) { V = { 파란공: n }; color = rng.pick(['빨간', '파란']); }
            } else {
              V = { 빨간공: rng.int(1, 9), 파란공: rng.int(1, 9) };
              if (rng.next() < 0.5) V.노란공 = rng.int(1, 5);
              color = rng.pick(Object.keys(V)).replace('공', '');
            }
            const t = Object.values(V).reduce((x, y) => x + y, 0);
            const a = V[color + '공'] || 0;
            const i = wIdx(a, t);
            const correct = W[i];
            const { options, answerIndex } = buildChoiceSet(rng, correct, near(i));
            const desc = Object.entries(V).map(([k, x]) => `${k.replace('공', ' 공')} ${x}개`).join(', ');
            return {
              question: `주머니에 ${desc}가 들어 있습니다. 공 1개를 꺼낼 때 ${color} 공이 나올 가능성을 말로 바르게 표현한 것은?`,
              variablesInfo: V,
              options,
              answerIndex,
              hint: `전체 ${t}개 중 ${color} 공이 몇 개인지 보고, 전체의 절반과 비교해 보세요.`,
              steps: [
                `전체 공 ${t}개 중 ${color} 공은 ${a}개입니다.`,
                a === 0 ? `${color} 공이 없으므로 '불가능하다'입니다.` : a === t ? `모든 공이 ${color} 공이므로 '확실하다'입니다.`
                  : `${a}개는 전체의 절반(${t / 2}개)${2 * a === t ? '과 같으므로' : 2 * a < t ? '보다 적으므로' : '보다 많으므로'} '${correct}'입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-34',
          dayIndex: 33,
          unit: '초5~6 · 가능성을 수로 나타내기',
          standardCode: '[6수04-05]',
          standardName: '사건이 일어날 가능성을 수로 나타낼 수 있다.',
          sourceRef: '초등 5~6학년군 자료와 가능성 (가능성 0, 1/2, 1)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '동전·주머니 — 가능성 0, 1/2, 1',
            normal: '주사위 눈의 수(짝수, 이상·이하 등)의 가능성',
            hard: '1부터 N까지 수 카드 — 조건을 따져 0, 1/2, 1로 나타내기'
          },
          conceptSummary: '일이 일어날 가능성을 수로 나타낼 때, 불가능하다는 0, 반반이다는 1/2, 확실하다는 1로 나타냅니다.',
          formula: '불가능 = 0,  반반 = 1/2,  확실 = 1',
          generate(rng, { tier } = {}) {
            const P = { 0: '0', 1: '1/2', 2: '1' };
            const opts = (code, fourth) => {
              const correct = P[code];
              const { options, answerIndex } = buildChoiceSet(rng, correct, [...[0, 1, 2].filter(k => k !== code).map(k => P[k]), fourth]);
              return { correct, options, answerIndex };
            };
            const word = code => ['불가능하므로 0', '반반이므로 1/2', '확실하므로 1'][code];
            if (tier === 'easy') {
              if (rng.next() < 0.25) {
                const face = rng.pick(['그림 면', '숫자 면']);
                const o = opts(1, '1/4');
                return {
                  question: `동전 한 개를 던질 때 ${face}이 나올 가능성을 수로 나타내면?`,
                  variablesInfo: { 시행: '동전 던지기' },
                  options: o.options,
                  answerIndex: o.answerIndex,
                  hint: `동전에는 그림 면과 숫자 면 두 가지만 있어요.`,
                  steps: [`그림 면과 숫자 면이 나올 가능성은 같습니다.`, `따라서 ${face}이 나올 가능성은 반반이므로 1/2입니다.`]
                };
              }
              const n = rng.int(2, 9);
              const mode = rng.int(0, 2);
              const V = mode === 0 ? { 빨간공: n, 파란공: n } : { 빨간공: n };
              const color = mode === 0 ? rng.pick(['빨간', '파란']) : mode === 1 ? '빨간' : rng.pick(['파란', '흰']);
              const code = mode === 0 ? 1 : mode === 1 ? 2 : 0;
              const t = mode === 0 ? 2 * n : n;
              const o = opts(code, `1/${t > 2 ? t : 4}`);
              return {
                question: `${mode === 0 ? `주머니에 빨간 공 ${n}개와 파란 공 ${n}개가` : `주머니에 빨간 공만 ${n}개가`} 들어 있습니다. 이 주머니에서 공 1개를 꺼낼 때, ${color} 공을 꺼낼 가능성을 수로 나타내면?`,
                variablesInfo: V,
                options: o.options,
                answerIndex: o.answerIndex,
                hint: `꺼낼 수 있는 공 중 ${color} 공이 얼마나 되는지 생각해 보세요.`,
                steps: [
                  mode === 0 ? `빨간 공과 파란 공의 개수가 ${n}개로 같습니다.` : `주머니에는 빨간 공만 ${n}개 있습니다.`,
                  `${color} 공을 꺼낼 가능성은 ${word(code)}입니다.`
                ]
              };
            }
            const hard = tier === 'hard';
            const top = hard ? rng.int(5, 15) * 2 : 6;
            const evs = [];
            const prob = pred => Array.from({ length: top }, (_, i) => i + 1).filter(pred).length / top;
            evs.push({ t: '짝수', p: 0.5 }, { t: '홀수', p: 0.5 });
            const OPS = { 이상: (x, k) => x >= k, 이하: (x, k) => x <= k, 초과: (x, k) => x > k, 미만: (x, k) => x < k };
            for (let k = 1; k <= top + 6; k++) {
              for (const op of Object.keys(OPS)) {
                const p = prob(x => OPS[op](x, k));
                if (p === 0 || p === 0.5 || p === 1) {
                  if ((op === '이상' || op === '초과') && p === 1 && k > 1) continue;
                  if ((op === '미만' || op === '이하') && p === 0) continue;
                  evs.push({ t: `${k} ${op}`, p });
                }
              }
            }
            const halves = evs.filter(e => e.p === 0.5);
            const ev = hard && rng.next() < 0.5 ? rng.pick(halves) : rng.pick(evs);
            const code = ev.p === 0 ? 0 : ev.p === 1 ? 2 : 1;
            const o = opts(code, `1/${top}`);
            const evText = ev.t === '짝수' || ev.t === '홀수' ? ev.t : ev.t;
            const favCount = Math.round(ev.p * top);
            return {
              question: hard
                ? `1부터 ${top}까지의 수가 하나씩 적힌 카드 ${top}장 중에서 한 장을 뽑을 때, 뽑은 카드의 수가 ${evText}일 가능성을 수로 나타내면?`
                : `주사위 한 개를 굴릴 때, 나온 눈의 수가 ${evText}일 가능성을 수로 나타내면?`,
              variablesInfo: { 시행: hard ? `수 카드 1~${top}` : '주사위 굴리기' },
              options: o.options,
              answerIndex: o.answerIndex,
              hint: hard ? `카드 ${top}장 중 조건에 맞는 카드가 몇 장인지 세어, 전체의 몇 분의 몇인지 보세요.` : `주사위 눈은 1부터 6까지예요. 조건에 맞는 눈이 몇 개인지 세어 보세요.`,
              steps: [
                `나올 수 있는 수는 1부터 ${top}까지 ${top}가지이고, 그중 ${evText}인 수는 ${favCount}가지입니다.`,
                `${favCount === 0 ? '하나도 없으므로' : favCount === top ? '모두 해당하므로' : '정확히 절반이므로'} 가능성은 ${o.correct}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-35',
          dayIndex: 34,
          unit: '초5~6 · 자료로 가능성 예상하기',
          standardCode: '[6수04-06]',
          standardName: '자료를 이용하여 가능성을 예상하고, 가능성에 근거하여 적절한 판단을 내릴 수 있다.',
          sourceRef: '초등 5~6학년군 자료와 가능성 (회전판 실험 결과로 예상하기)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '실험 결과로 회전판에서 가장 넓은(좁은) 색 예상',
            normal: '실험 결과의 비율로 더 많이 돌릴 때의 횟수 예상',
            hard: '"또는", "나오지 않는" 조건의 횟수 예상'
          },
          conceptSummary: '실험을 여러 번 한 결과에서 각 결과가 나온 비율을 보면, 앞으로 그 결과가 나올 가능성을 예상할 수 있습니다. 많이 나온 색일수록 회전판에서 차지하는 부분이 넓을 것으로 예상합니다.',
          formula: '예상 횟수 = (실험에서 나온 횟수 ÷ 실험 횟수) × 새로 할 횟수',
          generate(rng, { tier } = {}) {
            const COLORS = ['빨강', '파랑', '노랑', '초록'];
            const easy = tier === 'easy';
            const k = easy ? 4 : rng.int(3, 4);
            const T = rng.pick([20, 25, 40, 50]);
            let cnt = [];
            for (let t = 0; t < 60; t++) {
              const cuts = Array.from({ length: k - 1 }, () => rng.int(1, T - 1)).sort((x, y) => x - y);
              cnt = [...cuts, T].map((c, i) => c - (i ? cuts[i - 1] : 0));
              const mx = Math.max(...cnt);
              const mn = Math.min(...cnt);
              if (cnt.every(c => c > 0) && cnt.filter(c => c === mx).length === 1 && cnt.filter(c => c === mn).length === 1) break;
            }
            const cols = COLORS.slice(0, k);
            const V = {};
            cols.forEach((c, i) => { V[c] = cnt[i]; });
            const list = cols.map((c, i) => `${c} ${cnt[i]}번`).join(', ');
            if (easy) {
              const askWide = rng.next() < 0.5;
              const target = askWide ? Math.max(...cnt) : Math.min(...cnt);
              const ans = cols[cnt.indexOf(target)];
              const { options, answerIndex } = buildChoiceSet(rng, ans, cols.filter(c => c !== ans));
              return {
                question: `회전판을 ${T}번 돌려서 나온 색을 조사했더니 결과가 [ ${list} ]였습니다. 회전판에서 가장 ${askWide ? '넓은' : '좁은'} 부분의 색은 무엇이라고 예상할 수 있나요?`,
                variablesInfo: V,
                options,
                answerIndex,
                hint: `넓은 부분일수록 바늘이 멈출 가능성이 커서 더 자주 나와요.`,
                steps: [
                  `가장 ${askWide ? '많이' : '적게'} 나온 색은 ${target}번 나온 ${ans}입니다.`,
                  `가장 ${askWide ? '많이' : '적게'} 나온 색이 회전판에서 가장 ${askWide ? '넓은' : '좁은'} 부분일 가능성이 크므로 ${ans}입니다.`
                ]
              };
            }
            const mult = rng.int(2, 10);
            const M = T * mult;
            const ci = rng.int(0, k - 1);
            const c = cols[ci];
            let q;
            let ans;
            let base;
            let how;
            if (tier === 'hard') {
              if (rng.next() < 0.5) {
                let cj = rng.int(0, k - 1);
                if (cj === ci) cj = (ci + 1) % k;
                base = cnt[ci] + cnt[cj];
                q = `${c} 또는 ${wj(cols[cj], '이/가')} 나오는 횟수`;
                how = `${c} 또는 ${wj(cols[cj], '이/가')} 나온 횟수는 ${cnt[ci]} + ${cnt[cj]} = ${base}번입니다.`;
              } else {
                base = T - cnt[ci];
                q = `${wj(c, '이/가')} 나오지 않는 횟수`;
                how = `${wj(c, '이/가')} 나오지 않은 횟수는 ${T} − ${cnt[ci]} = ${base}번입니다.`;
              }
            } else {
              base = cnt[ci];
              q = `${wj(c, '이/가')} 나오는 횟수`;
              how = `${wj(c, '이/가')} 나온 횟수는 ${base}번입니다.`;
            }
            ans = base * mult;
            const cand = [base, M - ans, base + M / 10, cnt[ci] * mult, ans + mult]
              .filter(x => Number.isInteger(x) && x > 0 && x !== ans).map(x => `${x}번`);
            const { options, answerIndex } = buildChoiceSet(rng, `${ans}번`, cand);
            return {
              question: `회전판을 ${T}번 돌려서 나온 색을 조사했더니 결과가 [ ${list} ]였습니다. 같은 회전판을 ${M}번 돌린다면 ${q}는 약 몇 번일지 예상해 보세요.`,
              variablesInfo: { ...V, 예상횟수: M },
              options,
              answerIndex,
              hint: `${M}번은 ${T}번의 ${mult}배예요. 실험에서 나온 횟수도 ${mult}배가 될 것으로 예상할 수 있어요.`,
              steps: [
                how,
                `${T}번 중 ${base}번 나왔으므로 ${M}번 돌리면 ${base} × (${M} ÷ ${T}) = ${base} × ${mult} = ${ans}번으로 예상합니다.`
              ]
            };
          }
        }
      ]
    },

    // =========================================================================
    // [2] 중등 수학 (중학교 1~3학년 교육과정 14개 대표 유형)
    // =========================================================================
    middle: {
      id: 'middle',
      level: '중등 수학',
      targetGrade: '중학교 1~3학년 과정',
      title: '수와 연산·문자와 식·함수·기하의 완성',
      desc: '소인수분해와 정수·유리수, 일차·연립방정식과 부등식, 일차·이차함수 그래프, 피타고라스 정리, 삼각비와 확률까지 중학교 3개년의 핵심 개념을 총망라해 학습해 보자.',
      miniTitle: '등식의 변형과 함수적 사고',
      miniDesc: '문자를 사용하여 수학적 관계를 일반화하고, 등식과 부등식의 성질로 해를 추론하며, 그래프로 두 변수의 상관관계를 시각화하는 능력이 중등 수학의 핵심이야.',
      formula: 'ax + b = cx + d  ⇒  (a − c)x = d − b',
      example: '예: 3(x − 2) = x + 4에서 괄호를 풀고 이항하면 2x = 10, 따라서 x = 5.',
      templates: [
        {
          id: 'MID-01',
          dayIndex: 0,
          unit: '중1 · 일차방정식',
          standardCode: '[9수02-04]',
          standardName: '일차방정식을 풀 수 있고, 이를 활용하여 문제를 해결할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (문자와 식 - 괄호가 있는 일차방정식)',
          difficulty: '★☆☆ 기초',
          tierGuide: { easy: '양수 해, 우변의 x 계수 1', normal: '교과서 표준 괄호 일차방정식', hard: '음수 계수·큰 수, 우변의 x 계수도 음수' },
          conceptSummary: '괄호가 있는 일차방정식은 분배법칙으로 괄호를 먼저 전개한 뒤, 일차항은 좌변으로, 상수항은 우변으로 이항하여 풉니다.',
          formula: 'a(x + b) = cx + d  →  (a − c)x = d − ab',
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              // 하: 양수 해·작은 계수·우변 x 계수 1 / 상: 음수 계수·큰 수·우변 x 계수 음수 가능
              const easy = tier === 'easy';
              const S = n => (n < 0 ? `−${-n}` : `${n}`);
              const x = easy ? rng.int(1, 6) : rng.int(3, 12) * (rng.next() < 0.5 ? -1 : 1);
              const a = easy ? rng.int(2, 4) : rng.pick([-5, -4, -3, -2, 5, 6, 7]);
              let c = easy ? 1 : rng.pick([-3, -2, -1, 2, 3, 4]);
              if (c === a) c = 1;
              const b = easy ? rng.int(1, 5) : rng.int(2, 9) * (rng.next() < 0.5 ? -1 : 1);
              const d = a * (x + b) - c * x;
              const k = a - c;
              const bStr = b > 0 ? `+ ${b}` : `− ${Math.abs(b)}`;
              const cStr = c === 1 ? 'x' : c === -1 ? '−x' : `${S(c)}x`;
              const dStr = d === 0 ? '' : (d > 0 ? ` + ${d}` : ` − ${Math.abs(d)}`);
              const correct = `x = ${S(x)}`;
              // 오개념: 부호 반대 / 분배 부호 실수 / 괄호 둘째 항에 곱하지 않음
              const distractors = [-x, (d + a * b) / k, (d - b) / k, x + 1, x - 1, x + 2]
                .filter(v => Number.isInteger(v) && v !== x).map(v => `x = ${S(v)}`);
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `일차방정식 ${S(a)}(x ${bStr}) = ${cStr}${dStr} 의 해를 구하면?`,
                variablesInfo: { 계수a: a, 상수b: b, 우변일차항계수: c, 해x: x },
                options,
                answerIndex,
                hint: `좌변에 분배법칙을 적용할 때 ${wj(S(a), '을/를')} x와 ${S(b)} 모두에 곱해야 합니다!`,
                steps: [
                  `분배법칙으로 좌변의 괄호를 풀면 ${S(a)}x ${a * b >= 0 ? '+ ' + (a * b) : '− ' + Math.abs(a * b)} = ${cStr}${dStr} 입니다.`,
                  `x항을 좌변으로, 상수항을 우변으로 이항하여 정리하면 ${S(k)}x = ${S(d - a * b)} 입니다.`,
                  `양변을 ${wj(S(k), '으로/로')} 나누면 x = ${S(x)} 입니다.`
                ]
              };
            }
            const x = rng.int(2, 11) * (rng.next() > 0.25 ? 1 : -1);
            const a = rng.int(3, 6);
            const c = rng.int(1, a - 1);
            const b = rng.int(-6, 6) || 2;
            const d = a * (x + b) - c * x;

            const bStr = b > 0 ? `+ ${b}` : `− ${Math.abs(b)}`;
            const dStr = d === 0 ? '' : (d > 0 ? ` + ${d}` : ` − ${Math.abs(d)}`);
            const cStr = c === 1 ? 'x' : `${c}x`;

            const correct = `x = ${x}`;
            const wrongDist = Math.round((d - b) / (a - c));
            const wrongSign = Math.round((d + a * b) / (a - c));
            const distractors = [
              `x = ${-x}`,
              `x = ${wrongSign !== x ? wrongSign : x + 2}`,
              `x = ${wrongDist !== x ? wrongDist : x - 3}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `일차방정식 ${a}(x ${bStr}) = ${cStr}${dStr} 의 해를 구하면?`,
              variablesInfo: { 계수a: a, 상수b: b, 우변일차항계수: c, 해x: x },
              options,
              answerIndex,
              hint: `좌변에 분배법칙을 적용할 때 ${wj(a, '을/를')} x와 ${b} 모두에 곱해야 합니다!`,
              steps: [
                `분배법칙을 이용하여 좌변의 괄호를 풀면 ${a}x ${a * b >= 0 ? '+ ' + (a * b) : '− ' + Math.abs(a * b)} = ${cStr}${dStr} 입니다.`,
                `미지수 x가 있는 항을 좌변으로, 상수항을 우변으로 이항하면 (${a} − ${c})x = ${d} − (${a * b}) 입니다.`,
                `정리하면 ${a - c}x = ${d - a * b} 이므로 양변을 ${wj(a - c, '으로/로')} 나누면 x = ${x} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-02',
          dayIndex: 1,
          unit: '중1 · 소인수분해',
          standardCode: '[9수01-01]',
          standardName: '소인수분해의 뜻을 알고, 자연수를 소인수분해할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (소인수분해와 약수의 개수)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '서로 다른 두 소인수, 작은 지수', normal: '두 소인수 p^a × q^b', hard: '세 소인수 2^a × 3^b × q^c' },
          conceptSummary: '자연수 N이 N = a^m × b^n (a, b는 서로 다른 소수)으로 소인수분해될 때, N의 약수의 개수는 (m + 1) × (n + 1)개입니다.',
          formula: 'N = p^a × q^b 의 약수의 개수 = (a + 1)(b + 1)',
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              // 하: 두 소인수·작은 지수 / 상: 세 소인수
              const fs = tier === 'easy'
                ? [[rng.pick([2, 3, 5]), rng.int(1, 3)], [rng.pick([7, 11, 13]), 1]]
                : [[2, rng.int(1, 3)], [3, rng.int(1, 2)], [rng.pick([5, 7]), rng.int(1, 2)]];
              const num = fs.reduce((acc, [p, e]) => acc * Math.pow(p, e), 1);
              const es = fs.map(f => f[1]);
              const divCount = es.reduce((acc, e) => acc * (e + 1), 1);
              const fStr = fs.map(([p, e]) => `${p}^${e}`).join(' × ');
              const sum = es.reduce((x, y) => x + y, 0);
              const correct = `${divCount}개`;
              const distractors = [es.reduce((x, y) => x * y, 1), sum, sum + es.length, (es[0] + 1) * (es[1] + 1), divCount + 1, divCount * 2]
                .filter(v => v !== divCount).map(v => `${v}개`);
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `자연수 ${wj(comma(num), '을/를')} 소인수분해하여 구한 양의 약수의 총개수는?`,
                variablesInfo: { 자연수: num, 소인수분해: fStr, 약수개수: divCount },
                options,
                answerIndex,
                hint: `${wj(comma(num), '을/를')} 소인수분해한 뒤 각 소인수의 지수에 1을 더하여 서로 곱해 보세요.`,
                steps: [
                  `${wj(comma(num), '을/를')} 소인수분해하면 ${comma(num)} = ${fStr} 입니다.`,
                  `각 소인수의 지수는 ${es.join(', ')}입니다.`,
                  `약수의 개수는 ${es.map(e => `(${e} + 1)`).join(' × ')} = ${divCount}개입니다.`
                ]
              };
            }
            const p = rng.pick([2, 3]);
            const q = rng.pick([5, 7]);
            const a = rng.int(2, 4);
            const b = rng.int(1, 3);
            const num = Math.pow(p, a) * Math.pow(q, b);
            const divCount = (a + 1) * (b + 1);

            const correct = `${divCount}개`;
            const distractors = [
              `${a * b}개`,
              `${a + b}개`,
              `${(a + 1) + (b + 1)}개`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `자연수 ${wj(comma(num), '을/를')} 소인수분해하여 구한 양의 약수의 총개수는?`,
              variablesInfo: { 자연수: num, 소인수분해: `${p}^${a} × ${q}^${b}`, 약수개수: divCount },
              options,
              answerIndex,
              hint: `${wj(comma(num), '을/를')} 소인수분해한 뒤 각 소인수의 지수에 1을 더하여 서로 곱해 보세요.`,
              steps: [
                `${wj(comma(num), '을/를')} 소인수분해하면 ${comma(num)} = ${p}^${a} × ${q}^${b} 입니다.`,
                `소인수 ${p}의 지수는 ${a}, 소인수 ${q}의 지수는 ${b}입니다.`,
                `약수의 개수는 각 지수에 1을 더하여 곱한 값이므로 (${a} + 1) × (${b} + 1) = ${a + 1} × ${b + 1} = ${divCount}개입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-03',
          dayIndex: 2,
          unit: '중1 · 일차방정식의 활용',
          standardCode: '[9수02-04]',
          standardName: '일차방정식을 풀 수 있고, 이를 활용하여 문제를 해결할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (거리·속력·시간 방정식 활용 대표 유형)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '작은 속력, 정수 시간', normal: '교과서 표준 왕복 문제', hard: '총 시간이 0.5시간 단위 소수' },
          conceptSummary: '왕복하거나 속력이 바뀔 때 전체 걸린 시간은 (갈 때 걸린 시간) + (올 때 걸린 시간) = (거리/갈 때 속력) + (거리/올 때 속력)으로 식을 세웁니다.',
          formula: '시간 = 거리 ÷ 속력',
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              // 하: 작은 속력·정수 시간 / 상: 총 시간이 0.5시간 단위
              const easy = tier === 'easy';
              const [v1, v2] = rng.pick(easy ? [[2, 3], [2, 4], [3, 6], [2, 6], [4, 12], [3, 9], [5, 10], [6, 12], [4, 8]] : [[4, 6], [6, 9], [6, 10], [4, 12], [10, 15], [8, 12]]);
              const L = lcm(v1, v2);
              const dist = easy ? L * rng.int(1, 2) : L * rng.pick([1, 3, 5]) / 2;
              const totalTime = dist / v1 + dist / v2;
              const correct = `${dist} km`;
              const distractors = [dist / 2, (v1 + v2) * totalTime, dist + L / 2, dist * 2, (v1 + v2) / 2 * totalTime]
                .filter(v => v !== dist && Math.abs(v * 100 - Math.round(v * 100)) < 1e-9).map(v => `${v} km`);
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `집에서 공원까지 왕복하는데 갈 때는 시속 ${v1}km로 걷고, 올 때는 같은 길을 시속 ${v2}km로 뛰어서 총 ${totalTime}시간이 걸렸습니다. 집에서 공원까지의 거리는 몇 km인가요?`,
                variablesInfo: { 갈때속력: `${v1}km/h`, 올때속력: `${v2}km/h`, 총시간: `${totalTime}시간` },
                options,
                answerIndex,
                hint: `집에서 공원까지의 거리를 x km라고 두면, 갈 때 걸린 시간은 x/${v1}, 올 때 걸린 시간은 x/${v2}입니다.`,
                steps: [
                  `집에서 공원까지의 거리를 x km라 하면 x/${v1} + x/${v2} = ${totalTime} 입니다.`,
                  `양변에 분모의 최소공배수 ${wj(L, '을/를')} 곱하면 ${L / v1}x + ${L / v2}x = ${totalTime * L} 입니다.`,
                  `${L / v1 + L / v2}x = ${totalTime * L} 이므로 x = ${dist}(km)입니다.`
                ]
              };
            }
            const pairs = [[3, 6], [4, 6], [4, 12], [6, 12], [5, 10], [6, 9]];
            const [v1, v2] = rng.pick(pairs);
            const L = lcm(v1, v2);
            const k = rng.int(1, 3);
            const dist = L * k;
            const totalTime = dist / v1 + dist / v2;

            const correct = `${dist} km`;
            const distractors = [
              `${dist / 2} km`,
              `${(v1 + v2) * totalTime} km`,
              `${dist + L} km`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `집에서 공원까지 왕복하는데 갈 때는 시속 ${v1}km로 걷고, 올 때는 같은 길을 시속 ${v2}km로 뛰어서 총 ${totalTime}시간이 걸렸습니다. 집에서 공원까지의 거리는 몇 km인가요?`,
              variablesInfo: { 갈때속력: `${v1}km/h`, 올때속력: `${v2}km/h`, 총시간: `${totalTime}시간` },
              options,
              answerIndex,
              hint: `집에서 공원까지의 거리를 x km라고 두면, 갈 때 걸린 시간은 x/${v1}, 올 때 걸린 시간은 x/${v2}입니다.`,
              steps: [
                `집에서 공원까지의 거리를 x km라 하면 x/${v1} + x/${v2} = ${totalTime} 입니다.`,
                `양변에 분모의 최소공배수 ${wj(L, '을/를')} 곱하면 ${L / v1}x + ${L / v2}x = ${totalTime * L} 입니다.`,
                `${L / v1 + L / v2}x = ${totalTime * L} 이므로 x = ${dist}(km)입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-04',
          dayIndex: 3,
          unit: '중2 · 일차함수와 그래프',
          standardCode: '[9수02-16]',
          standardName: '일차함수의 그래프의 성질을 이해하고, 이를 활용하여 문제를 해결할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (일차함수의 기울기와 절편)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '기울기 ±1·±2, 작은 절편', normal: '교과서 표준', hard: '기울기 ±4~±6, 큰 절편' },
          conceptSummary: '일차함수 y = ax + b에서 기울기 a는 (y 증가량)/(x 증가량)이고, x절편은 y=0일 때 x값(−b/a), y절편은 b입니다.',
          formula: 'y = ax + b 의 x절편: −b/a,  y절편: b',
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              // 하: 기울기 ±1·±2, 작은 절편 / 상: 기울기 ±4~±6, 큰 절편
              const S = n => (n < 0 ? `−${-n}` : `${n}`);
              const a = rng.pick(tier === 'easy' ? [-2, -1, 1, 2] : [-6, -5, -4, 4, 5, 6]);
              const xInt = rng.pick(tier === 'easy' ? [-4, -3, -2, -1, 1, 2, 3, 4] : [-8, -7, -6, -5, -4, -3, 3, 4, 5, 6, 7, 8]);
              const b = -a * xInt;
              const sum = xInt + b;
              const aStr = a === 1 ? '' : a === -1 ? '−' : S(a);
              const bStr = b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`;
              const distractors = [-xInt + b, a + b, xInt - b, b, xInt, sum + 1, sum - 1, sum + 2].filter(v => v !== sum).map(S);
              const { options, answerIndex } = buildChoiceSet(rng, S(sum), distractors);
              return {
                question: `일차함수 y = ${aStr}x ${bStr} 의 그래프의 x절편을 p, y절편을 q라 할 때, p + q의 값은?`,
                variablesInfo: { 기울기: a, x절편p: xInt, y절편q: b },
                figure: { type: 'line-graph', slope: a, intercept: b, xLabel: 'p', yLabel: 'q' },
                options,
                answerIndex,
                hint: `y절편 q는 x = 0일 때의 y값이고, x절편 p는 y = 0일 때의 방정식 ${aStr}x ${bStr} = 0의 해입니다.`,
                steps: [
                  `x = 0을 대입하면 y = ${S(b)}이므로 y절편 q = ${S(b)}입니다.`,
                  `y = 0을 대입하면 ${aStr}x ${bStr} = 0 → ${aStr}x = ${S(-b)} 이므로 x절편 p = ${S(xInt)}입니다.`,
                  `따라서 p + q = (${S(xInt)}) + (${S(b)}) = ${S(sum)}입니다.`
                ]
              };
            }
            const a = rng.pick([-4, -3, -2, 2, 3, 4]);
            const xInt = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5]);
            const b = -a * xInt;
            const yInt = b;
            const sum = xInt + yInt;

            const bStr = b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`;
            const correct = `${sum}`;
            const distractors = [
              `${-xInt + yInt}`,
              `${a + b}`,
              `${xInt - yInt}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `일차함수 y = ${a}x ${bStr} 의 그래프의 x절편을 p, y절편을 q라 할 때, p + q의 값은?`,
              variablesInfo: { 기울기: a, x절편p: xInt, y절편q: yInt },
              figure: { type: 'line-graph', slope: a, intercept: b, xLabel: 'p', yLabel: 'q' },
              options,
              answerIndex,
              hint: `y절편 q는 x=0일 때의 y값이고, x절편 p는 y=0일 때의 방정식 ${a}x ${bStr} = 0의 해입니다.`,
              steps: [
                `x = 0을 대입하면 y = ${b}이므로 y절편 q = ${yInt}입니다.`,
                `y = 0을 대입하면 ${a}x ${bStr} = 0 → ${a}x = ${-b} 이므로 x절편 p = ${xInt}입니다.`,
                `따라서 p + q = (${xInt}) + (${yInt}) = ${sum}입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-05',
          dayIndex: 4,
          unit: '중2 · 연립일차방정식',
          standardCode: '[9수02-13]',
          standardName: '미지수가 2개인 연립일차방정식을 풀 수 있고, 이를 활용하여 문제를 해결할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (가감법과 대입법을 이용한 연립방정식)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: 'y의 계수 1, 두 식을 더하면 바로 소거', normal: 'y의 계수가 같고 부호가 반대(가감법)', hard: '계수를 맞추려 양변에 수를 곱하는 가감법, 음수 해' },
          conceptSummary: '두 일차방정식을 더하거나 빼서 한 미지수를 소거(가감법)하면 연립방정식의 해 (x, y)를 구할 수 있습니다.',
          formula: '{ ax + by = p,  cx − by = q } ⇒ (a + c)x = p + q',
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              // 하: y 계수 1, 더하면 바로 소거 / 상: 양변에 수를 곱해 계수를 맞추는 가감법, 음수 해
              const S = n => (n < 0 ? `−${-n}` : `${n}`);
              const easy = tier === 'easy';
              const nz = (lo, hi) => rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
              const x = easy ? rng.int(1, 4) : nz(1, 6);
              const y = easy ? rng.int(1, 4) : nz(1, 6);
              const a = easy ? rng.int(1, 2) : rng.int(2, 5);
              const c = easy ? 1 : rng.int(2, 5);
              const b = easy ? 1 : rng.int(2, 4);
              let d = easy ? 1 : rng.int(2, 4);
              if (!easy && d === b) d = b === 4 ? 2 : b + 1;
              const p = a * x + b * y, q = c * x - d * y;
              const t = (k, v) => (k === 1 ? v : `${k}${v}`);
              const e1 = `${t(a, 'x')} + ${t(b, 'y')} = ${S(p)}`;
              const e2 = `${t(c, 'x')} − ${t(d, 'y')} = ${S(q)}`;
              const fmt = (u, w) => `x = ${S(u)}, y = ${S(w)} (합: ${S(u + w)})`;
              const correct = fmt(x, y);
              const distractors = [fmt(y, x), fmt(x, -y), fmt(x + 1, y + 1), fmt(x - 1, y), fmt(-x, y)].filter(o => o !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              const steps = easy
                ? [
                  `두 방정식을 변끼리 더하면 y항이 소거되어 (${a} + 1)x = ${S(p)} + (${S(q)}) 가 됩니다.`,
                  `${a + 1}x = ${S(p + q)} 이므로 x = ${x}입니다.`,
                  `x = ${wj(x, '을/를')} 둘째 식에 대입하면 ${x} − y = ${S(q)}, 따라서 y = ${y}입니다.`
                ]
                : [
                  `y의 계수를 맞추기 위해 첫째 식에 ${wj(d, '을/를')}, 둘째 식에 ${wj(b, '을/를')} 곱하면 ${a * d}x + ${b * d}y = ${S(p * d)}, ${b * c}x − ${b * d}y = ${S(q * b)} 입니다.`,
                  `두 식을 더하면 ${a * d + b * c}x = ${S(p * d + q * b)} 이므로 x = ${S(x)} 입니다.`,
                  `x = ${S(x)}을 첫째 식에 대입하면 ${t(b, 'y')} = ${S(p - a * x)}, 따라서 y = ${S(y)} 입니다.`
                ];
              return {
                question: `연립방정식 [ ${e1},  ${e2} ] 를 만족시키는 x, y의 값은?`,
                variablesInfo: { 식1: e1, 식2: e2 },
                options,
                answerIndex,
                hint: easy ? 'y의 계수가 1과 −1이므로 두 식을 변끼리 더해 보세요!' : `y의 계수의 절댓값이 ${wj(b, '과/와')} ${d}로 다르므로, 최소공배수가 되도록 각 식에 수를 곱한 뒤 더하세요.`,
                steps
              };
            }
            const x = rng.int(1, 6);
            const y = rng.int(1, 6);
            const a = rng.int(2, 4);
            const c = rng.int(1, 3);
            const b = rng.int(1, 3);
            const p = a * x + b * y;
            const q = c * x - b * y;
            const bStr = b === 1 ? 'y' : `${b}y`;
            const cStr = c === 1 ? 'x' : `${c}x`;

            const correct = `x = ${x}, y = ${y} (합: ${x + y})`;
            const distractors = [
              `x = ${y}, y = ${x} (합: ${x + y})`,
              `x = ${x}, y = ${-y} (합: ${x - y})`,
              `x = ${x + 1}, y = ${y + 1} (합: ${x + y + 2})`
            ];
            if (x === y) {
              distractors[0] = `x = ${x + 1}, y = ${y - 1} (합: ${x + y})`;
            }
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `연립방정식 [ ${a}x + ${bStr} = ${p},  ${cStr} − ${bStr} = ${q} ] 를 만족시키는 x, y의 값은?`,
              variablesInfo: { 식1: `${a}x + ${bStr} = ${p}`, 식2: `${cStr} − ${bStr} = ${q}` },
              options,
              answerIndex,
              hint: `y의 계수의 절댓값이 ${wj(b, '으로/로')} 같고 부호가 반대이므로 두 식을 변끼리 더해 보세요!`,
              steps: [
                `두 방정식을 변끼리 더하면 y항이 소거되어 (${a} + ${c})x = ${p} + (${q}) 가 됩니다.`,
                `${a + c}x = ${p + q} 이므로 x = ${x}입니다.`,
                `x = ${wj(x, '을/를')} 대입하면 ${bStr} = ${b * y}, 따라서 y = ${y}입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-06',
          dayIndex: 5,
          unit: '중2 · 피타고라스 정리',
          standardCode: '[9수03-15]',
          standardName: '피타고라스 정리를 이해하고 정당화할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (도형의 성질 - 피타고라스 정리)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '작은 피타고라스 수(3·4·5 계열)', normal: '교과서 표준 피타고라스 수', hard: '큰 피타고라스 수(9·40·41, 20·21·29 등)' },
          conceptSummary: '직각삼각형에서 직각을 낀 두 변의 길이를 각각 a, b라 하고 빗변의 길이를 c라 하면 a² + b² = c²이 성립합니다.',
          formula: 'a² + b² = c²  (c는 빗변의 길이)',
          generate(rng, { tier } = {}) {
            // 하: 작은 피타고라스 수 / 상: 큰 피타고라스 수 / 중: 기존 목록 그대로
            const triples = tier === 'easy'
              ? [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [9, 12, 15], [12, 9, 15]]
              : tier === 'hard'
                ? [[9, 40, 41], [12, 35, 37], [20, 21, 29], [11, 60, 61], [16, 30, 34], [10, 24, 26], [15, 36, 39], [18, 24, 30]]
                : [
                  [3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17],
                  [9, 12, 15], [7, 24, 25], [12, 16, 20]
                ];
            const [a, b, c] = rng.pick(triples);
            const askHypotenuse = rng.next() > 0.4;

            if (askHypotenuse) {
              const correct = `${c} cm`;
              const distractors = [
                `${a + b} cm`,
                `${c + 2} cm`,
                `${Math.abs(b - a) + 3} cm`
              ];
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `직각을 낀 두 변의 길이가 각각 ${a}cm, ${b}cm인 직각삼각형에서 빗변의 길이는 몇 cm인가요?`,
                variablesInfo: { 밑변: `${a}cm`, 높이: `${b}cm`, 빗변: `${c}cm` },
                figure: { type: 'right-triangle', sides: { a: b, b: a, c: '?' }, shape: [b, a] },
                options,
                answerIndex,
                hint: `피타고라스 정리 a² + b² = c² 에 ${wj(a, '과/와')} ${wj(b, '을/를')} 대입해 보세요.`,
                steps: [
                  `빗변의 길이를 c cm라 하면 c² = ${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c} 입니다.`,
                  `c > 0이므로 c = ${c}(cm)입니다.`
                ]
              };
            } else {
              const correct = `${b} cm`;
              const distractors = [
                `${c - a} cm`,
                `${b + 2} cm`,
                `${a + c} cm`
              ];
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `빗변의 길이가 ${c}cm이고 다른 한 변의 길이가 ${a}cm인 직각삼각형의 나머지 한 변의 길이는 몇 cm인가요?`,
                variablesInfo: { 빗변: `${c}cm`, 한변: `${a}cm`, 구하는변: `${b}cm` },
                figure: { type: 'right-triangle', sides: { a: '?', b: a, c }, shape: [b, a] },
                options,
                answerIndex,
                hint: `빗변이 가장 긴 변(${c}cm)이므로 ${a}² + x² = ${c}² 으로 식을 세워야 합니다.`,
                steps: [
                  `x² = ${c}² − ${a}² = ${c * c} − ${a * a} = ${b * b} 입니다.`,
                  `x > 0이므로 x = ${b}(cm)입니다.`
                ]
              };
            }
          }
        },
        {
          id: 'MID-07',
          dayIndex: 6,
          unit: '중3 · 이차함수의 그래프',
          standardCode: '[9수02-22]',
          standardName: '이차함수의 그래프를 그릴 수 있고, 그 성질을 설명할 수 있다.',
          sourceRef: '중학교 수학 3 교과서 (이차함수 y = a(x-p)² + q의 그래프)',
          difficulty: '★★★ 실력',
          tierGuide: { easy: '이차항 계수 ±1·2, 작은 꼭짓점', normal: '교과서 표준', hard: '꼭짓점 좌표가 크고 부호가 섞임' },
          conceptSummary: '이차함수 y = a(x − p)² + q의 그래프의 꼭짓점의 좌표는 (p, q)이고, 대칭축의 방정식은 x = p입니다.',
          formula: 'y = a(x − p)² + q  ⇒  꼭짓점: (p, q), 축: x = p',
          generate(rng, { tier } = {}) {
            // 하: 작은 꼭짓점 / 상: 큰 꼭짓점·부호 혼합 / 중: 기존 목록 그대로
            const a = rng.pick(tier === 'easy' ? [1, -1, 2] : tier === 'hard' ? [-3, -2, 2, 3, 4] : [-2, -1, 1, 2, 3]);
            const p = rng.pick(tier === 'easy' ? [-4, -3, -2, -1, 1, 2, 3, 4] : tier === 'hard' ? [-9, -8, -7, -6, 6, 7, 8, 9] : [-5, -4, -3, -2, 2, 3, 4, 5]);
            const q = rng.pick(tier === 'easy' ? [1, 2, 3, 4, 5] : tier === 'hard' ? [-12, -10, -9, -8, 8, 9, 11, 13] : [-6, -4, -2, 1, 3, 5, 7]);
            const aStr = a === 1 ? '' : (a === -1 ? '−' : String(a));
            const pInside = p > 0 ? `x − ${p}` : `x + ${Math.abs(p)}`;
            const qStr = q >= 0 ? `+ ${q}` : `− ${Math.abs(q)}`;

            const correct = `꼭짓점 (${p}, ${q}), 축 x = ${p}`;
            const distractors = [
              `꼭짓점 (${-p}, ${q}), 축 x = ${-p}`,
              `꼭짓점 (${p}, ${-q}), 축 x = ${p}`,
              `꼭짓점 (${-p}, ${-q}), 축 x = ${q}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `이차함수 y = ${aStr}(${pInside})² ${qStr} 의 그래프의 꼭짓점의 좌표와 축의 방정식을 바르게 짝지은 것은?`,
              variablesInfo: { 이차항계수: a, 꼭짓점x: p, 꼭짓점y: q },
              figure: { type: 'parabola', a, h: p, k: q },
              options,
              answerIndex,
              hint: `완전제곱식 (${pInside})² 이 0이 되게 하는 x의 값이 꼭짓점의 x좌표입니다! 부호에 주의하세요.`,
              steps: [
                `이차함수 표준형 y = a(x − p)² + q에서 (${pInside}) = 0이 되는 x의 값은 x = ${p}입니다.`,
                `x = ${p}일 때 y = ${q}이므로 꼭짓점의 좌표는 (${p}, ${q})입니다.`,
                `대칭축은 꼭짓점을 지나고 y축에 평행한 직선이므로 축의 방정식은 x = ${p}입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-08',
          dayIndex: 7,
          unit: '중1 · 정수와 유리수의 혼합 계산',
          standardCode: '[9수01-05]',
          standardName: '정수와 유리수의 사칙 계산의 원리를 이해하고, 그 계산을 할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (거듭제곱과 사칙 혼합계산)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '거듭제곱 1개 + 곱셈 1개', normal: '거듭제곱·곱셈·나눗셈 혼합', hard: '괄호 안 거듭제곱 → 음수 곱 → 나눗셈의 3단계' },
          conceptSummary: '거듭제곱을 가장 먼저 계산하고, (−a)² = a²이지만 −a² = −(a²)임을 명확히 구분해야 합니다.',
          formula: '(−a)² = a²,  −a² = −(a²)',
          generate(rng, { tier } = {}) {
            if (tier === 'easy') {
              // 하: 거듭제곱 1개 + 곱셈 1개
              const a = rng.int(2, 4), b = rng.int(1, 5), c = rng.int(2, 3);
              const ans = a * a - b * c;
              const S = n => (n < 0 ? `−${-n}` : `${n}`);
              const distractors = [-a * a - b * c, a * a + b * c, 2 * a - b * c, ans + 2].filter(v => v !== ans).map(S);
              const { options, answerIndex } = buildChoiceSet(rng, S(ans), distractors);
              return {
                question: `다음 식을 계산한 결과는?  [ (−${a})² + (−${b}) × ${c} ]`,
                variablesInfo: { 항1: `(−${a})²`, 항2: `(−${b}) × ${c}` },
                options,
                answerIndex,
                hint: `(−${a})²은 (−${a}) × (−${a})이므로 양수 ${wj(a * a, '이/가')} 됩니다.`,
                steps: [
                  `거듭제곱을 먼저 계산하면 (−${a})² = ${a * a} 입니다.`,
                  `곱셈을 계산하면 (−${b}) × ${c} = ${S(-b * c)} 입니다.`,
                  `따라서 ${a * a} + (${S(-b * c)}) = ${S(ans)} 입니다.`
                ]
              };
            }
            if (tier === 'hard') {
              // 상: 괄호 안 거듭제곱 → 음수 곱 → 나눗셈의 3단계
              const S = n => (n < 0 ? `−${-n}` : `${n}`);
              const a = rng.int(3, 5);
              let b = rng.int(2, 8);
              if (b === a * a) b += 1;
              const c = rng.int(2, 4), e = rng.pick([2, 3, 4]), m = rng.int(2, 6);
              const d = e * m;
              const inner = a * a - b;
              const ans = inner * (-c) + m;
              const distractors = [
                (-a * a - b) * (-c) + m, // (−a)²을 −a²로 계산
                inner * (-c) - m, // −(−d)의 부호 실수
                inner * c + m, // 음수 곱의 부호 실수
                a * a + b * c + m // 괄호를 무시하고 곱셈부터 계산
              ].filter(v => v !== ans).map(S);
              const { options, answerIndex } = buildChoiceSet(rng, S(ans), distractors.concat([S(ans + 4)]));
              return {
                question: `다음 식을 계산한 결과는?  [ ((−${a})² − ${b}) × (−${c}) − (−${d}) ÷ ${e} ]`,
                variablesInfo: { 항1: `((−${a})² − ${b}) × (−${c})`, 항2: `(−${d}) ÷ ${e}` },
                options,
                answerIndex,
                hint: '괄호 안 → 거듭제곱 → 곱셈·나눗셈 → 덧셈·뺄셈 순서로 계산하세요. 음수를 빼는 것은 양수를 더하는 것과 같습니다.',
                steps: [
                  `괄호 안을 먼저 계산하면 (−${a})² − ${b} = ${a * a} − ${b} = ${S(inner)} 입니다.`,
                  `곱셈과 나눗셈을 계산하면 ${inner < 0 ? `(${S(inner)})` : inner} × (−${c}) = ${S(inner * -c)}, (−${d}) ÷ ${e} = −${m} 입니다.`,
                  `따라서 ${S(inner * -c)} − (−${m}) = ${S(inner * -c)} + ${m} = ${S(ans)} 입니다.`
                ]
              };
            }
            const a = rng.pick([2, 3]);
            const b = rng.pick([3, 4, 5]);
            const c = rng.pick([2, 3]);
            const d = rng.pick([6, 8, 12]);
            // 식: (-a)^2 - (-b) * c + (-d) ÷ 2
            const term1 = a * a;
            const term2 = (-b) * c; // negative
            const term3 = (-d) / 2;
            const ans = term1 - term2 + term3;

            const correct = `${ans}`;
            const wrongSquare = -term1 - term2 + term3; // (-a)^2을 -a^2로 계산
            const wrongMinus = term1 + term2 + term3;
            const distractors = [
              `${wrongSquare}`,
              `${wrongMinus}`,
              `${ans + 4}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `다음 식을 계산한 결과는?  [ (−${a})² − (−${b}) × ${c} + (−${d}) ÷ 2 ]`,
              variablesInfo: { 항1: `(−${a})²`, 항2: `(−${b}) × ${c}`, 항3: `(−${d}) ÷ 2` },
              options,
              answerIndex,
              hint: `(−${a})²은 괄호 전체의 제곱이므로 양수 ${wj(a * a, '이/가')} 됩니다. 뺄셈 기호와 음수 부호에 유의하세요!`,
              steps: [
                `거듭제곱을 먼저 계산하면 (−${a})² = ${term1} 입니다.`,
                `곱셈과 나눗셈을 계산하면 (−${b}) × ${c} = ${term2} 이고, (−${d}) ÷ 2 = ${term3} 입니다.`,
                `차례로 계산하면 ${term1} − (${term2}) + (${term3}) = ${term1} + ${Math.abs(term2)} + (${term3}) = ${ans} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-09',
          dayIndex: 8,
          unit: '중2 · 일차부등식',
          standardCode: '[9수02-12]',
          standardName: '일차부등식을 풀 수 있고, 이를 활용하여 문제를 해결할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (음수로 나눌 때의 부등호 방향 전환)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '부등호 방향이 바뀌지 않는 경우', normal: '음수로 나누어 부등호 방향이 바뀜', hard: '≤·≥, 큰 수, 방향 바뀜' },
          conceptSummary: '부등식의 양변에 같은 음수를 곱하거나 양변을 같은 음수로 나누면 부등호의 방향이 반대로 바뀝니다.',
          formula: '−kx < c  (k > 0)  ⇒  x > −c/k',
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              // 하: x의 계수가 양수 → 방향 그대로 / 상: ≤·≥, 큰 수, 음수로 나눠 방향 바뀜
              const S = n => (n < 0 ? `−${-n}` : `${n}`);
              const easy = tier === 'easy';
              const flip = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
              const k = easy ? rng.int(2, 3) : rng.int(3, 6);
              let a, c;
              if (easy) { c = rng.int(1, 2); a = c + k; } else { a = rng.int(2, 7); c = a + k; }
              const bound = easy ? rng.pick([-3, -2, -1, 1, 2, 3, 4, 5]) : rng.int(1, 9) * (rng.next() < 0.5 ? -1 : 1);
              const b = easy ? rng.int(1, 6) : rng.int(-12, 12);
              const op = easy ? '<' : rng.pick(['≤', '≥']);
              const d = easy ? b + k * bound : b - k * bound;
              const op2 = easy ? op : flip[op];
              const cStr = c === 1 ? 'x' : `${c}x`;
              const correct = `x ${op2} ${S(bound)}`;
              const distractors = [`x ${flip[op2]} ${S(bound)}`, `x ${op2} ${S(-bound)}`, `x ${flip[op2]} ${S(-bound)}`];
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              const coef = a - c;
              return {
                question: `일차부등식 ${a}x${signedTerm(b, '')} ${op} ${cStr}${signedTerm(d, '')} 의 해를 구하면?`,
                variablesInfo: { 좌변계수: a, 우변계수: c, x경계값: bound },
                options,
                answerIndex,
                hint: easy ? 'x항을 좌변으로 모으면 x의 계수가 양수입니다. 양수로 나눌 때는 부등호 방향이 그대로입니다.' : `x항을 좌변으로 모으면 x의 계수가 음수(${S(coef)})가 됩니다. 양변을 음수로 나눌 때 부등호 방향을 꼭 바꾸세요!`,
                steps: [
                  `x를 포함하는 항을 좌변으로, 상수항을 우변으로 이항하면 (${a} − ${c})x ${op} ${S(d)} − (${S(b)}) 입니다.`,
                  `정리하면 ${S(coef)}x ${op} ${S(d - b)} 입니다.`,
                  easy ? `양변을 양수 ${wj(coef, '으로/로')} 나누면 부등호 방향은 그대로이므로 ${correct} 입니다.` : `양변을 음수 ${wj(S(coef), '으로/로')} 나누면 부등호 방향이 바뀌어 ${correct} 입니다.`
                ]
              };
            }
            const k = rng.pick([2, 3, 4]);
            const a = rng.int(2, 5);
            const c = a + k; // a - c = -k (음수 계수 유도)
            const ansBound = rng.int(-5, 6);
            // ax + b < cx + d  =>  (a - c)x < d - b  =>  -kx < -k * ansBound
            const constDiff = -k * ansBound;
            const b = rng.int(-6, 6);
            const d = b + constDiff;

            const bStr = signedTerm(b, '');
            const dStr = signedTerm(d, '');

            const correct = `x > ${ansBound}`;
            const distractors = [
              `x < ${ansBound}`, // 부등호 안 바꾼 오개념
              `x > ${-ansBound}`,
              `x < ${-ansBound}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `일차부등식 ${a}x ${bStr} < ${c}x ${dStr} 의 해를 구하면?`,
              variablesInfo: { 좌변계수: a, 우변계수: c, x경계값: ansBound },
              options,
              answerIndex,
              hint: `x항을 좌변으로 모으면 x의 계수가 음수(−${k})가 됩니다. 양변을 음수로 나눌 때 부등호 방향을 꼭 바꾸세요!`,
              steps: [
                `x를 포함하는 항을 좌변으로, 상수항을 우변으로 이항하면 (${a} − ${c})x < ${d} − (${b}) 입니다.`,
                `정리하면 −${k}x < ${constDiff} 입니다.`,
                `양변을 음수 −${wj(k, '으로/로')} 나누면 부등호 방향이 반대로 바뀌어 x > ${ansBound} 가 됩니다.`
              ]
            };
          }
        },
        {
          id: 'MID-10',
          dayIndex: 9,
          unit: '중2 · 지수법칙과 단항식의 계산',
          standardCode: '[9수02-08]',
          standardName: '지수법칙을 이해하고, 이를 이용하여 식을 간단히 할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (지수법칙 종합)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '제곱 한 번, 작은 지수', normal: '교과서 표준', hard: '세제곱, 계수 3까지, 큰 지수' },
          conceptSummary: '(a^m)^n = a^(mn) 이고, a^m × a^n = a^(m+n), a^m ÷ a^n = a^(m−n) 입니다.',
          formula: '(a^m)^n = a^(mn),  (ab)^n = a^n b^n',
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              // 하: 제곱 한 번·작은 지수 / 상: 세제곱·큰 지수
              const easy = tier === 'easy';
              const base = rng.pick([2, 3]);
              const p = easy ? 2 : 3;
              const m = rng.int(2, 4);
              const n = easy ? 1 : rng.int(2, 3);
              const k = easy ? rng.int(1, 3) : rng.int(2, 4);
              const coef = Math.pow(base, p);
              const xExp = m * p + k, yExp = n * p + 1, sumExp = xExp + yExp;
              const fmt = (co, ex, ey) => `${co}x^${ex} y^${ey} (지수의 합: ${ex + ey})`;
              const correct = fmt(coef, xExp, yExp);
              const distractors = [
                fmt(base * p, xExp, yExp), // 거듭제곱 대신 곱하기
                fmt(coef, m + p + k, n + p + 1), // 지수를 더함
                fmt(base, xExp, yExp), // 계수에 거듭제곱을 안 함
                fmt(coef, xExp, yExp - 1), // 뒤 y의 지수 1을 빠뜨림
                fmt(coef, m * p, n * p)
              ].filter(o => o !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `다음 식을 간단히 정리한 결과와 x, y의 지수의 합은?  [ (${base}x^${m} y^${n})^${p} × (x^${k} y) ]`,
                variablesInfo: { 거듭제곱: p, 계수: coef, x지수: xExp, y지수: yExp },
                options,
                answerIndex,
                hint: `괄호 밖의 거듭제곱 ${wj(p, '을/를')} 계수 ${base}와 x^${m}, y^${n}에 각각 적용하세요. ${base}^${p} = ${coef}입니다.`,
                steps: [
                  `(${base}x^${m} y^${n})^${p} = ${base}^${p} × (x^${m})^${p} × (y^${n})^${p} = ${coef}x^${m * p} y^${n * p} 입니다.`,
                  `여기에 (x^${k} y)를 곱하면 x의 지수는 ${m * p} + ${k} = ${xExp}, y의 지수는 ${n * p} + 1 = ${wj(yExp, '이/가')} 됩니다.`,
                  `따라서 식은 ${coef}x^${xExp} y^${yExp} 이며, 지수의 합은 ${xExp} + ${yExp} = ${sumExp} 입니다.`
                ]
              };
            }
            const p = rng.int(2, 3);
            const m = rng.int(2, 3);
            const n = rng.int(1, 2);
            const k = rng.int(1, 2);
            // 식: (2x^m y^n)^p × (x^k y) = 2^p * x^(m*p + k) * y^(n*p + 1)
            const coef = Math.pow(2, p);
            const xExp = m * p + k;
            const yExp = n * p + 1;
            const sumExp = xExp + yExp;

            const correct = `${coef}x^${xExp} y^${yExp} (지수의 합: ${sumExp})`;
            const wrongCoef = 2 * p; // 거듭제곱 대신 곱하기
            const distractors = [
              `${wrongCoef}x^${xExp} y^${yExp} (지수의 합: ${sumExp})`,
              `${coef}x^${m + p + k} y^${n + p + 1} (지수의 합: ${m + p + k + n + p + 1})`,
              `${coef}x^${xExp} y^${yExp - 1} (지수의 합: ${sumExp - 1})`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `다음 식을 간단히 정리한 결과와 x, y의 지수의 합은?  [ (2x^${m} y^${n})^${p} × (x^${k} y) ]`,
              variablesInfo: { 거듭제곱: p, 계수: coef, x지수: xExp, y지수: yExp },
              options,
              answerIndex,
              hint: `괄호 밖의 거듭제곱 ${wj(p, '을/를')} 계수 2와 x^${m}, y^${n}에 각각 분배법칙처럼 곱해 주어야 합니다. 2^${p} = ${coef}입니다.`,
              steps: [
                `(2x^${m} y^${n})^${p} = 2^${p} × (x^${m})^${p} × (y^${n})^${p} = ${coef}x^${m * p} y^${n * p} 입니다.`,
                `여기에 (x^${k} y)를 곱하면 계수는 ${coef}, x의 지수는 ${m * p} + ${k} = ${xExp}, y의 지수는 ${n * p} + 1 = ${wj(yExp, '이/가')} 됩니다.`,
                `따라서 식은 ${coef}x^${xExp} y^${yExp} 이며, 지수의 합은 ${xExp} + ${yExp} = ${sumExp} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-11',
          dayIndex: 10,
          unit: '중3 · 인수분해',
          standardCode: '[9수02-19]',
          standardName: '다항식의 곱셈과 인수분해를 할 수 있다.',
          sourceRef: '중학교 수학 3 교과서 (이차식의 인수분해)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '두 양수의 합·곱', normal: '부호가 섞인 두 정수', hard: '부호가 다른 큰 두 정수' },
          conceptSummary: 'x² + (a+b)x + ab = (x + a)(x + b) 공식을 이용해 합과 곱이 맞는 두 정수를 찾습니다.',
          formula: 'x² + (a + b)x + ab = (x + a)(x + b)',
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              // 하: 두 양수 / 상: 부호가 다른 큰 두 정수
              let a, b;
              if (tier === 'easy') {
                a = rng.int(1, 6); b = rng.int(1, 6);
                if (b === a) b = a === 6 ? 1 : a + 1;
              } else {
                const sg = rng.next() < 0.5 ? 1 : -1;
                a = rng.int(4, 12) * sg; b = rng.int(2, 9) * -sg;
                if (Math.abs(a) === Math.abs(b) || a + b === 0) a += sg;
              }
              const sum = a + b, prod = a * b;
              const poly = `x²${signedTerm(sum, 'x')}${signedTerm(prod, '')}`;
              const lin = k => (k >= 0 ? `x + ${k}` : `x − ${Math.abs(k)}`);
              const correct = `(${lin(a)})(${lin(b)})`;
              const distractors = [`(${lin(-a)})(${lin(-b)})`, `(${lin(a)})(${lin(-b)})`, `(${lin(-a)})(${lin(b)})`, `(${lin(sum)})(${lin(prod)})`];
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `이차식 ${wj(poly, '을/를')} 바르게 인수분해한 것은?`,
                variablesInfo: { 일차항계수: sum, 상수항: prod, 두정수: `${a}, ${b}` },
                options,
                answerIndex,
                hint: `곱해서 ${wj(prod, '이/가')} 되고 더해서 ${wj(sum, '이/가')} 되는 두 정수를 찾아보세요.`,
                steps: [
                  `상수항이 ${prod}이므로 두 정수의 곱은 ${prod}입니다.`,
                  `일차항의 계수가 ${sum}이므로 두 정수의 합은 ${sum}이어야 합니다.`,
                  `두 조건을 만족하는 두 정수는 ${wj(a, '과/와')} ${b}이므로 인수분해하면 ${wj(correct, '이/가')} 됩니다.`
                ]
              };
            }
            const a = rng.pick([-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]);
            let b = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5]);
            if (Math.abs(a) === Math.abs(b)) b = b > 0 ? b + 1 : b - 1;

            const sum = a + b;
            const prod = a * b;
            const poly = `x² ${signedTerm(sum, 'x')} ${signedTerm(prod, '')}`;

            const lin = k => (k >= 0 ? `x + ${k}` : `x − ${Math.abs(k)}`);
            const f1 = lin(a);
            const f2 = lin(b);

            const correct = `(${f1})(${f2})`;
            const distractors = [
              `(${a >= 0 ? 'x − ' + a : 'x + ' + Math.abs(a)})(${b >= 0 ? 'x − ' + b : 'x + ' + Math.abs(b)})`,
              `(${f1})(${b >= 0 ? 'x − ' + b : 'x + ' + Math.abs(b)})`,
              `(${lin(sum)})(${lin(prod)})`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `이차식 ${wj(poly, '을/를')} 바르게 인수분해한 것은?`,
              variablesInfo: { 일차항계수: sum, 상수항: prod, 두정수: `${a}, ${b}` },
              options,
              answerIndex,
              hint: `곱해서 ${wj(prod, '이/가')} 되고 더해서 ${wj(sum, '이/가')} 되는 두 정수를 찾아보세요.`,
              steps: [
                `상수항이 ${prod}이므로 두 정수의 곱은 ${prod}입니다.`,
                `일차항의 계수가 ${sum}이므로 두 정수의 합은 ${sum}이어야 합니다.`,
                `두 조건을 만족하는 두 정수는 ${wj(a, '과/와')} ${b}이므로 인수분해하면 ${wj(`(${f1})(${f2})`, '이/가')} 됩니다.`
              ]
            };
          }
        },
        {
          id: 'MID-12',
          dayIndex: 11,
          unit: '중3 · 실수와 그 계산 (무리수의 정수·소수 부분)',
          standardCode: '[9수01-09]',
          standardName: '실수의 대소 관계를 판단하고 설명할 수 있다.',
          sourceRef: '중학교 수학 3 교과서 (무리수의 정수 부분과 소수 부분)',
          difficulty: '★★★ 실력',
          tierGuide: { easy: '√2 ~ √24 범위', normal: '교과서 표준(√5 ~ √35)', hard: '√37 ~ √143 범위' },
          conceptSummary: 'n² < N < (n+1)² 이면 n < √N < n+1 이므로, √N의 정수 부분 a = n, 소수 부분 b = √N − n 입니다.',
          formula: '소수 부분 = 원래 수 − 정수 부분',
          generate(rng, { tier } = {}) {
            const n = tier === 'easy' ? rng.int(1, 4) : tier === 'hard' ? rng.int(6, 11) : rng.int(2, 5);
            const extra = rng.int(1, 2 * n);
            const N = n * n + extra; // n^2 < N < (n+1)^2
            // 정수 부분: n, 소수 부분: sqrt(N) - n
            // 문제: sqrt(N)의 정수 부분을 a, 소수 부분을 b라 할 때 a + 2b 또는 b + n의 식
            const correct = `정수 부분: ${n}, 소수 부분: √${N} − ${n}`;
            const distractors = [
              `정수 부분: ${n + 1}, 소수 부분: √${N} − ${n + 1}`,
              `정수 부분: ${n}, 소수 부분: √${N} − 0.${extra}`,
              `정수 부분: ${n - 1}, 소수 부분: √${N} − ${n - 1}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `무리수 √${N} 의 정수 부분을 a, 소수 부분을 b라 할 때, a와 b를 바르게 나타낸 것은?`,
              variablesInfo: { 무리수: `√${N}`, '제곱수 범위': `${n * n} < ${N} < ${(n + 1) * (n + 1)}`, 정수부분: n },
              options,
              answerIndex,
              hint: `${n}² = ${n * n} 이고 ${n + 1}² = ${(n + 1) * (n + 1)} 임을 이용하여 √${wj(N, '이/가')} 어떤 두 정수 사이에 있는지 확인하세요.`,
              steps: [
                `${n * n} < ${N} < ${(n + 1) * (n + 1)} 이므로 각 변에 제곱근을 취하면 ${n} < √${N} < ${n + 1} 입니다.`,
                `따라서 √${N}의 정수 부분 a = ${n} 입니다.`,
                `소수 부분 b는 (원래 수) − (정수 부분)이므로 b = √${N} − ${n} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-13',
          dayIndex: 12,
          unit: '중3 · 삼각비 (특수각)',
          standardCode: '[9수03-16]',
          standardName: '삼각비의 뜻을 알고, 간단한 삼각비의 값을 구할 수 있다.',
          sourceRef: '중학교 수학 3 교과서 (특수각 30°, 45°, 60°의 삼각비)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '작은 빗변', normal: '교과서 표준', hard: '홀수 빗변(답이 0.5 단위 소수)' },
          conceptSummary: '직각삼각형에서 sin = 높이/빗변, cos = 밑변/빗변, tan = 높이/밑변이며 특수각(30°, 45°, 60°)의 값을 암기하여 활용합니다.',
          formula: 'sin 30° = 1/2,  cos 60° = 1/2,  tan 45° = 1',
          generate(rng, { tier } = {}) {
            const hypotenuse = rng.pick(tier === 'easy' ? [4, 6, 8, 10, 14] : tier === 'hard' ? [9, 11, 13, 15, 17, 21, 25] : [6, 8, 10, 12, 16]);
            const angle = 30; // 30°일 때 마주 보는 대변 = hypotenuse / 2
            const opp = hypotenuse / 2;

            const correct = `${opp} cm`;
            const distractors = [
              `${hypotenuse} cm`,
              `${opp + 2} cm`,
              `${Math.round(hypotenuse * 0.8)} cm`
            ];
            if (tier === 'easy' || tier === 'hard') distractors.push(`${hypotenuse * 2} cm`, `${opp + 1} cm`); // 하·상만 후보 보강
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `빗변의 길이가 ${hypotenuse} cm이고 한 예각의 크기가 30°인 직각삼각형에서 30°의 대변(높이)의 길이는 몇 cm인가요?`,
              variablesInfo: { 빗변: `${hypotenuse}cm`, 예각: '30°', 높이: `${opp}cm` },
              figure: { type: 'right-triangle', sides: { a: '?', b: '', c: hypotenuse }, shape: [opp, opp * Math.sqrt(3)], angle: '30°' },
              options,
              answerIndex,
              hint: `sin 30° = (높이) / (빗변) = 1/2 임을 이용해 보세요.`,
              steps: [
                `직각삼각형에서 sin 30° = (높이) / (빗변의 길이) 입니다.`,
                `sin 30° = 1/2 이므로 (높이) / ${hypotenuse} = 1/2 입니다.`,
                `따라서 높이는 ${hypotenuse} × (1/2) = ${opp} cm입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-14',
          dayIndex: 13,
          unit: '중2 · 확률 (주사위 두 개의 합)',
          standardCode: '[9수04-06]',
          standardName: '확률의 개념과 그 기본 성질을 이해하고, 확률을 구할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (경우의 수와 확률)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '합 2·3·4·10·11·12 (경우가 적음)', normal: '합 5 ~ 9', hard: '순서 무시·여사건 오개념 보기가 섞인 합' },
          conceptSummary: '서로 다른 두 개의 주사위를 던질 때 일어날 수 있는 모든 경우의 수는 6 × 6 = 36가지입니다.',
          formula: '확률 = (사건이 일어나는 경우의 수) ÷ (모든 경우의 수)',
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              // 하: 경우가 적은 합 / 상: 순서 무시·여사건 오개념 보기
              const targetSum = rng.pick(tier === 'easy' ? [2, 3, 4, 10, 11, 12] : [4, 5, 6, 8, 9, 10]);
              let count = 0, unordered = 0;
              const pairsList = [];
              for (let i = 1; i <= 6; i++) {
                for (let j = 1; j <= 6; j++) {
                  if (i + j === targetSum) { count++; pairsList.push(`(${i},${j})`); if (i <= j) unordered++; }
                }
              }
              const g = gcd(count, 36);
              const fracStr = `${count / g}/${36 / g}`;
              const correct = `${fracStr} (${count}가지)`;
              const gc = gcd(36 - count, 36);
              const distractors = tier === 'easy'
                ? [`${count}/12 (${count}가지)`, `${count / g + 1}/${36 / g} (${count + 1}가지)`, '1/6 (6가지)']
                : [`${unordered}/21 (${unordered}가지)`, `${(36 - count) / gc}/${36 / gc} (${36 - count}가지)`, `${count}/18 (${count}가지)`, '1/6 (6가지)'];
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `서로 다른 주사위 2개를 동시에 던질 때, 나오는 두 눈의 수의 합이 ${wj(targetSum, '이/가')} 될 확률은?`,
                variablesInfo: { 목표합: targetSum, 경우의수: count, 확률: fracStr },
                options,
                answerIndex,
                hint: tier === 'hard' ? '두 주사위는 서로 다르므로 (1, 3)과 (3, 1)은 다른 경우입니다. 모든 경우는 21가지가 아니라 36가지입니다.' : `주사위 2개를 던질 때 모든 경우의 수는 6 × 6 = 36입니다. 합이 ${wj(targetSum, '이/가')} 되는 순서쌍을 직접 세어 보세요.`,
                steps: [
                  '모든 경우의 수는 6 × 6 = 36가지입니다.',
                  `두 눈의 합이 ${wj(targetSum, '이/가')} 되는 순서쌍은 ${wj(pairsList.join(', '), '으로/로')} 총 ${count}가지입니다.`,
                  `따라서 구하는 확률은 ${count}/36 이며, 기약분수로 나타내면 ${fracStr}입니다.`
                ]
              };
            }
            const targetSum = rng.pick([5, 6, 7, 8, 9]);
            // 합이 targetSum이 되는 순서쌍 개수 계산
            let count = 0;
            const pairsList = [];
            for (let i = 1; i <= 6; i++) {
              for (let j = 1; j <= 6; j++) {
                if (i + j === targetSum) {
                  count++;
                  pairsList.push(`(${i},${j})`);
                }
              }
            }
            const g = gcd(count, 36);
            const num = count / g;
            const den = 36 / g;
            const fracStr = `${num}/${den}`;

            const correct = `${fracStr} (${count}가지)`;
            const distractors = [
              `${count}/12 (${count}가지)`,
              `${num + 1}/${den} (${count + 1}가지)`,
              `1/6 (6가지)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `서로 다른 주사위 2개를 동시에 던질 때, 나오는 두 눈의 수의 합이 ${wj(targetSum, '이/가')} 될 확률은?`,
              variablesInfo: { 목표합: targetSum, 경우의수: count, 확률: fracStr },
              options,
              answerIndex,
              hint: `주사위 2개를 던질 때 모든 경우의 수는 6 × 6 = 36입니다. 합이 ${wj(targetSum, '이/가')} 되는 순서쌍 (a, b)를 직접 세어 보세요.`,
              steps: [
                `모든 경우의 수는 6 × 6 = 36가지입니다.`,
                `두 눈의 합이 ${wj(targetSum, '이/가')} 되는 순서쌍은 ${wj(pairsList.join(', '), '으로/로')} 총 ${count}가지입니다.`,
                `따라서 구하는 확률은 ${count}/36 이며, 기약분수로 나타내면 ${fracStr}입니다.`
              ]
            };
          }
        },
        // ---------------------------------------------------------------
        // 1.0.2 확장 유형 (MID-15 ~ MID-35) — 2022 개정 성취기준, 그림 없음, 하·중·상 3단계
        // ---------------------------------------------------------------
        {
          id: 'MID-15',
          dayIndex: 14,
          unit: '중1 · 최대공약수와 최소공배수',
          standardCode: '[9수01-02]',
          standardName: '소인수분해를 이용하여 최대공약수와 최소공배수를 구할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (소인수분해를 이용한 최대공약수·최소공배수)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '두 자리 수 두 개를 직접 소인수분해', normal: '소인수분해 꼴로 주어진 두 수', hard: '소인수분해 꼴로 주어진 세 수' },
          conceptSummary: '각 수를 소인수분해한 뒤, 공통인 소인수에서 지수가 작은 것을 곱하면 최대공약수, 모든 소인수에서 지수가 큰 것을 곱하면 최소공배수입니다.',
          formula: '최대공약수 = 공통 소인수의 (작은 지수) 거듭제곱의 곱,  최소공배수 = 모든 소인수의 (큰 지수) 거듭제곱의 곱',
          generate(rng, { tier } = {}) {
            const PR = [2, 3, 5, 7];
            const SUP = ['', '', '²', '³'];
            const cnt = tier === 'hard' ? 3 : 2;
            const maxE = tier === 'easy' ? [2, 2, 1, 1] : [3, 2, 2, 1];
            const val = e => e.reduce((acc, k, i) => acc * Math.pow(PR[i], k), 1);
            const fact = e => e.map((k, i) => (k ? `${PR[i]}${SUP[k]}` : '')).filter(Boolean).join(' × ') || '1';
            const minE = es => PR.map((_, i) => Math.min(...es.map(e => e[i])));
            const maxEs = es => PR.map((_, i) => Math.max(...es.map(e => e[i])));
            let es = null;
            // 조건: 최대공약수 ≥ 2, 서로 다른 수, 어느 수도 최대공약수·최소공배수와 같지 않음(나누어떨어지는 쌍 제외)
            for (let t = 0; t < 300 && !es; t++) {
              const cand = Array.from({ length: cnt }, () => PR.map((_, i) => rng.int(0, maxE[i])));
              const vs = cand.map(val);
              const G = val(minE(cand)), L = val(maxEs(cand));
              const okEasy = tier !== 'easy' || vs.every(x => x >= 10 && x <= 99);
              const okFact = tier === 'easy' || cand.every(e => e.filter(Boolean).length >= 2);
              if (G >= 2 && new Set(vs).size === cnt && vs.every(x => x !== G && x !== L) && okEasy && okFact) es = cand;
            }
            if (!es) es = cnt === 3 ? [[2, 1, 0, 0], [1, 2, 1, 0], [3, 1, 1, 0]] : [[2, 1, 0, 0], [1, 2, 0, 0]];
            const vs = es.map(val);
            const g = minE(es), l = maxEs(es);
            const G = val(g), L = val(l);
            const names = ['A', 'B', 'C'];
            const opt = (x, y) => `최대공약수 ${comma(x)}, 최소공배수 ${comma(y)}`;
            // 오개념: 최대·최소 뒤바꿈 / 수를 모두 곱해 최소공배수로 착각 / 공통 소인수의 큰 지수를 택함
            const common = PR.map((_, i) => (es.every(e => e[i] > 0) ? Math.max(...es.map(e => e[i])) : 0));
            const prod = vs.reduce((a, b) => a * b, 1);
            const correct = opt(G, L);
            const distractors = [opt(L, G), opt(G, prod), opt(val(common), L), opt(G, L * 2), opt(G * 2, L)];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
            const shown = tier === 'easy'
              ? `두 수 ${vs.join(', ')}의`
              : `${cnt === 3 ? '세' : '두'} 수 ${es.map((e, i) => `${names[i]} = ${fact(e)}`).join(', ')}의`;
            return {
              question: `${shown} 최대공약수와 최소공배수를 바르게 구한 것은?`,
              variablesInfo: { 수: vs.join(', '), 소인수분해: es.map(fact).join(' / ') },
              options,
              answerIndex,
              hint: '최대공약수는 공통인 소인수만 골라 지수가 작은 쪽을, 최소공배수는 모든 소인수를 골라 지수가 큰 쪽을 곱하세요.',
              steps: [
                `각 수를 소인수분해하면 ${vs.map((x, i) => `${comma(x)} = ${fact(es[i])}`).join(', ')} 입니다.`,
                `최대공약수는 공통인 소인수에서 지수가 작은 것을 곱한 ${fact(g)} = ${comma(G)} 입니다.`,
                `최소공배수는 모든 소인수에서 지수가 큰 것을 곱한 ${fact(l)} = ${comma(L)} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-16',
          dayIndex: 15,
          unit: '중1 · 일차식의 덧셈과 뺄셈',
          standardCode: '[9수02-02]',
          standardName: '일차식의 덧셈과 뺄셈의 원리를 이해하고, 그 계산을 할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (동류항 정리와 괄호 풀기)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '괄호 앞이 +인 두 일차식의 덧셈', normal: '괄호 앞이 −인 일차식의 뺄셈(부호 바뀜)', hard: '수가 곱해진 두 괄호의 뺄셈 k(ax + b) − m(cx + d)' },
          conceptSummary: '괄호 앞의 수를 괄호 안의 모든 항에 곱하고(분배법칙), 괄호 앞이 −이면 괄호 안 모든 항의 부호를 바꾼 뒤 동류항끼리 모아 계산합니다.',
          formula: 'k(ax + b) − m(cx + d) = (ka − mc)x + (kb − md)',
          generate(rng, { tier } = {}) {
            const S = n => (n < 0 ? `−${-n}` : `${n}`);
            const lin = (p, c) => (p === 0 ? S(c) : `${signedTerm(p, 'x', true)}${signedTerm(c, '')}`);
            const nz = (lo, hi) => rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
            let k1 = 1, k2 = 1, a, b, c, d;
            const op = tier === 'easy' ? '+' : '−';
            if (tier === 'easy') { a = rng.int(1, 6); b = rng.int(1, 9); c = rng.int(1, 6); d = rng.int(1, 9); }
            else if (tier === 'hard') { k1 = rng.int(2, 4); k2 = rng.int(2, 4); a = nz(1, 5); b = nz(1, 9); c = nz(1, 5); d = nz(1, 9); }
            else { a = rng.int(2, 9); b = nz(1, 9); c = rng.int(1, 8); d = nz(1, 9); }
            const sg = op === '+' ? 1 : -1;
            // x의 계수·상수항이 0이 되지 않게 조정
            while (a === 0 || k1 * a + sg * k2 * c === 0) a += 1;
            while (b === 0 || k1 * b + sg * k2 * d === 0) b += 1;
            const X = k1 * a + sg * k2 * c;
            const C = k1 * b + sg * k2 * d;
            const kStr = k => (k === 1 ? '' : `${k}`);
            const expr = `${kStr(k1)}(${lin(a, b)}) ${op} ${kStr(k2)}(${lin(c, d)})`;
            const correct = lin(X, C);
            const distractors = op === '+'
              ? [lin(X + C, 0), lin(a * c, C), lin(X, b * d), lin(X + 1, C), lin(X, C + 1)]
              : [
                lin(X, k1 * b + k2 * d), // 뒤 괄호의 상수항 부호를 안 바꿈
                lin(k1 * a + k2 * c, k1 * b + k2 * d), // 뒤 괄호의 부호를 전혀 안 바꿈
                lin(k1 * a - c, k1 * b - d), // 괄호 앞의 수를 첫 항에만 곱함
                lin(X, -C),
                lin(-X, C),
                lin(X + 1, C)
              ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
            const expanded = [[k1 * a, 'x'], [k1 * b, ''], [sg * k2 * c, 'x'], [sg * k2 * d, '']]
              .map(([co, v], i) => signedTerm(co, v, i === 0)).join('');
            return {
              question: `다음 식을 간단히 하면?  [ ${expr} ]`,
              variablesInfo: { 식1: lin(a, b), 식2: lin(c, d), 앞수1: k1, 앞수2: k2, 연산: op },
              options,
              answerIndex,
              hint: op === '+' ? 'x항은 x항끼리, 상수항은 상수항끼리 더하세요. 문자가 다른 항은 더할 수 없습니다.' : '괄호 앞이 −이면 괄호 안의 모든 항의 부호가 바뀝니다. 상수항의 부호까지 꼭 바꾸세요!',
              steps: [
                `분배법칙으로 괄호를 풀면 ${expanded} 입니다.`,
                `동류항끼리 모으면 x의 계수는 ${S(X)}, 상수항은 ${S(C)} 입니다.`,
                `따라서 간단히 하면 ${correct} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-17',
          dayIndex: 16,
          unit: '중1 · 다각형의 성질',
          standardCode: '[9수03-05]',
          standardName: '다각형의 성질을 이해하고 설명할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (다각형의 대각선의 개수, 내각과 외각)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '정n각형의 한 내각의 크기', normal: '대각선의 개수 ↔ 내각의 크기의 합', hard: '한 외각(내각)의 크기로 정다각형을 찾은 뒤 대각선의 개수' },
          conceptSummary: 'n각형의 내각의 크기의 합은 180° × (n − 2), 외각의 크기의 합은 360°, 대각선의 개수는 n(n − 3)/2입니다. 정n각형의 한 외각의 크기는 360°/n입니다.',
          formula: '내각의 합 = 180°(n − 2),  대각선 = n(n − 3)/2,  정n각형 한 외각 = 360°/n',
          generate(rng, { tier } = {}) {
            const R = [4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45];
            const dg = x => `${comma(x)}°`;
            const ge = x => `${comma(x)}개`;
            const diag = n => n * (n - 3) / 2;
            let question, correct, distractors, hint, steps, vars;
            if (tier === 'easy') {
              const n = rng.pick(R);
              const ans = 180 * (n - 2) / n;
              question = `정${n}각형의 한 내각의 크기는?`;
              correct = dg(ans);
              distractors = [dg(360 / n), dg(180 * (n - 2)), dg(ans + 10), dg(ans - 10)];
              hint = `정${n}각형의 내각의 크기의 합을 먼저 구한 뒤 꼭짓점의 개수 ${wj(n, '으로/로')} 나누세요.`;
              steps = [
                `${n}각형의 내각의 크기의 합은 180° × (${n} − 2) = ${dg(180 * (n - 2))} 입니다.`,
                `정다각형은 내각의 크기가 모두 같으므로 한 내각은 ${dg(180 * (n - 2))} ÷ ${n} = ${dg(ans)} 입니다.`
              ];
              vars = { 변의수: n };
            } else if (tier === 'hard') {
              const n = rng.pick(R.slice(1));
              const ext = 360 / n;
              const useInner = rng.next() < 0.5;
              question = useInner
                ? `한 내각의 크기가 ${180 - ext}°인 정다각형의 대각선의 개수는?`
                : `한 외각의 크기가 ${ext}°인 정다각형의 대각선의 개수는?`;
              correct = ge(diag(n));
              distractors = [ge(n * (n - 3)), ge(n * (n - 1) / 2), ge(n - 3), ge(diag(n + 1))];
              hint = '정다각형의 외각의 크기의 합은 360°이므로 (360° ÷ 한 외각)이 꼭짓점의 개수입니다.';
              steps = [
                useInner ? `한 외각의 크기는 180° − ${180 - ext}° = ${ext}° 입니다.` : `한 외각의 크기가 ${ext}°입니다.`,
                `외각의 크기의 합은 360°이므로 360° ÷ ${ext}° = ${n}, 즉 정${n}각형입니다.`,
                `대각선의 개수는 ${n} × (${n} − 3) ÷ 2 = ${diag(n)}개입니다.`
              ];
              vars = { 정다각형: useInner ? `한 내각 ${180 - ext}°` : `한 외각 ${ext}°` };
            } else {
              const n = rng.int(5, 20);
              if (rng.next() < 0.5) {
                question = `대각선의 개수가 ${diag(n)}개인 다각형의 내각의 크기의 합은?`;
                correct = dg(180 * (n - 2));
                distractors = [dg(180 * n), dg(180 * (n - 1)), dg(180 * (n - 3)), dg(360)];
                hint = 'n(n − 3)/2 = (대각선의 개수)를 만족하는 n을 먼저 찾으세요.';
                steps = [
                  `n각형의 대각선의 개수는 n(n − 3)/2이므로 n(n − 3) = ${2 * diag(n)} 입니다.`,
                  `${n} × ${n - 3} = ${2 * diag(n)} 이므로 n = ${n}, 즉 ${n}각형입니다.`,
                  `내각의 크기의 합은 180° × (${n} − 2) = ${dg(180 * (n - 2))} 입니다.`
                ];
              } else {
                question = `내각의 크기의 합이 ${dg(180 * (n - 2))}인 다각형의 대각선의 개수는?`;
                correct = ge(diag(n));
                distractors = [ge(n * (n - 3)), ge(n * (n - 1) / 2), ge(n - 3), ge(diag(n + 1))];
                hint = '180° × (n − 2) = (내각의 크기의 합)으로 n을 먼저 구하세요.';
                steps = [
                  `180° × (n − 2) = ${dg(180 * (n - 2))} 이므로 n − 2 = ${n - 2}, n = ${n} 입니다.`,
                  `${n}각형의 대각선의 개수는 ${n} × (${n} − 3) ÷ 2 = ${diag(n)}개입니다.`
                ];
              }
              vars = { 꼭짓점수: '지문 조건으로 구함' };
            }
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
            return { question, variablesInfo: vars, options, answerIndex, hint, steps };
          }
        },
        {
          id: 'MID-18',
          dayIndex: 17,
          unit: '중1 · 대푯값 (중앙값과 최빈값)',
          standardCode: '[9수04-01]',
          standardName: '중앙값, 최빈값의 뜻을 알고, 자료의 특성에 따라 적절한 대푯값을 선택하여 구할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (자료의 정리와 해석 - 대푯값)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '자료 개수가 홀수인 중앙값', normal: '자료 개수가 짝수인 중앙값(가운데 두 값의 평균)', hard: '짝수 개 자료의 중앙값 + 최빈값' },
          conceptSummary: '중앙값은 자료를 크기순으로 나열했을 때 한가운데 있는 값(짝수 개면 가운데 두 값의 평균)이고, 최빈값은 가장 많이 나타나는 값입니다.',
          formula: 'n이 홀수: (n+1)/2번째 값,  n이 짝수: n/2번째와 (n/2+1)번째 값의 평균',
          generate(rng, { tier } = {}) {
            const n = tier === 'easy' ? rng.pick([5, 7]) : tier === 'hard' ? rng.pick([8, 10]) : rng.pick([6, 8]);
            const pool = rng.shuffle(Array.from({ length: 31 }, (_, i) => 10 + i));
            let data;
            let mode = null;
            if (tier === 'hard') {
              const base = pool.slice(0, n - 1);
              mode = base[rng.int(0, n - 2)];
              data = rng.shuffle(base.concat([mode]));
            } else data = pool.slice(0, n);
            const sorted = data.slice().sort((x, y) => x - y);
            const mid = arr => (n % 2 ? arr[(n - 1) / 2] : (arr[n / 2 - 1] + arr[n / 2]) / 2);
            const med = mid(sorted);
            const raw = mid(data); // 정렬하지 않고 가운데를 고르는 오개념
            const mean = data.reduce((x, y) => x + y, 0) / n;
            const ans = tier === 'hard' ? med + mode : med;
            const cands = tier === 'hard'
              ? [med, raw + mode, sorted[n / 2] + mode, mean + mode, sorted[n / 2 - 1] + mode, ans + 1]
              : n % 2
                ? [raw, mean, sorted[(n - 1) / 2 - 1], sorted[(n - 1) / 2 + 1], ans + 1]
                : [raw, sorted[n / 2 - 1], sorted[n / 2], mean, ans + 1];
            const unit = tier === 'hard' ? '' : '회';
            const distractors = cands.filter(x => Number.isInteger(x * 2) && x !== ans).map(x => `${x}${unit}`);
            const correct = `${ans}${unit}`;
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
            const ask = tier === 'hard' ? '이 자료의 중앙값을 a회, 최빈값을 b회라 할 때, a + b의 값은?' : '이 자료의 중앙값은?';
            const medStep = n % 2
              ? `자료가 ${n}개(홀수)이므로 ${(n + 1) / 2}번째 값 ${med}회가 중앙값입니다.`
              : `자료가 ${n}개(짝수)이므로 ${n / 2}번째 값 ${sorted[n / 2 - 1]}회와 ${n / 2 + 1}번째 값 ${sorted[n / 2]}회의 평균 ${med}회가 중앙값입니다.`;
            const steps = [`작은 값부터 크기순으로 나열하면 ${sorted.join(', ')} 입니다.`, medStep];
            if (tier === 'hard') steps.push(`가장 많이 나타난 값은 ${mode}회(2번)이므로 최빈값은 ${mode}회이고, a + b = ${med} + ${mode} = ${ans} 입니다.`);
            return {
              question: `다음은 학생 ${n}명의 1분 동안 윗몸일으키기 기록(회)이다. ${ask}  [ ${data.join(', ')} ]`,
              variablesInfo: { 자료: data.join(', '), 자료수: n },
              options,
              answerIndex,
              hint: '중앙값은 반드시 자료를 크기순으로 나열한 다음에 찾아야 합니다.',
              steps
            };
          }
        },
        {
          id: 'MID-19',
          dayIndex: 18,
          unit: '중2 · 유리수와 순환소수',
          standardCode: '[9수01-06]',
          standardName: '순환소수의 뜻을 알고, 유리수와 순환소수의 관계를 설명할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (순환소수를 분수로 나타내기)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '순환마디가 한 자리(정수 부분 포함 가능)', normal: '순환마디 두 자리 또는 소수점 아래 첫째 자리부터 순환하지 않음', hard: '순환하지 않는 부분 + 두 자리 순환마디, 정수 부분, 세 자리 순환마디' },
          conceptSummary: '순환소수는 분모에 순환마디의 숫자 개수만큼 9를, 그 뒤에 소수점 아래 순환하지 않는 숫자 개수만큼 0을 쓰고, 분자에는 (전체의 수) − (순환하지 않는 부분의 수)를 써서 분수로 나타냅니다.',
          formula: '0.aḃċ = (abc − a) / 990',
          generate(rng, { tier } = {}) {
            const DOT = '̇';
            // 순환마디 B가 더 짧은 마디의 반복이 아니고, A의 끝자리 ≠ B의 끝자리(마디를 앞당길 수 있는 표기 제외)
            const minimal = (A, B) => {
              for (let p = 1; p < B.length; p++) if (B.length % p === 0 && B.slice(0, p).repeat(B.length / p) === B) return false;
              if (A && A.slice(-1) === B.slice(-1)) return false;
              return !/^9+$/.test(B) && !/^0+$/.test(B);
            };
            const digits = k => Array.from({ length: k }, () => String(rng.int(0, 9))).join('');
            let I = 0, A = '', B = '';
            for (let t = 0; t < 100; t++) {
              if (tier === 'easy') { I = rng.int(0, 2); A = ''; B = String(rng.int(1, 8)); }
              else if (tier === 'hard') {
                const form = rng.int(0, 2);
                if (form === 0) { I = 0; A = digits(1); B = digits(2); }
                else if (form === 1) { I = rng.int(1, 3); A = ''; B = digits(2); }
                else { I = 0; A = ''; B = digits(3); }
              } else if (rng.next() < 0.5) { I = 0; A = ''; B = digits(2); }
              else { I = 0; A = digits(1); B = String(rng.int(1, 8)); }
              if (minimal(A, B)) break;
              I = 0; A = '1'; B = '6';
            }
            const disp = `${I}.${A}${B.length === 1 ? B + DOT : B[0] + DOT + B.slice(1, -1) + B.slice(-1) + DOT}`;
            const den = Number('9'.repeat(B.length) + '0'.repeat(A.length));
            const whole = Number(`${I}${A}${B}`);
            const nonRep = Number(`${I}${A}`);
            const fr = (nu, de) => { const g = gcd(nu, de); return de / g === 1 ? `${nu / g}` : `${nu / g}/${de / g}`; };
            const correct = fr(whole - nonRep, den);
            const distractors = [
              fr(whole, den), // 분자에서 순환하지 않는 부분을 빼지 않음
              fr(whole, Math.pow(10, A.length + B.length)), // 유한소수처럼 10의 거듭제곱으로 나눔
              fr(whole - nonRep, Number('9'.repeat(A.length + B.length))), // 분모를 모두 9로 씀
              fr(Number(B), Number('9'.repeat(B.length))), // 정수 부분·순환하지 않는 부분을 무시
              fr(whole - nonRep, den * 10),
              fr(whole - nonRep + 1, den),
              fr(whole - nonRep - 1, den),
              fr(whole - nonRep, den + 1)
            ].filter(x => x.includes('/')); // 정수로 약분되는 보기는 제외
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
            const two = `${I}.${A}${B}${B}…`;
            return {
              question: `순환소수 ${wj(disp, '을/를')} 기약분수로 나타내면?`,
              variablesInfo: { 정수부분: I, 순환하지않는부분: A || '없음', 순환마디: B },
              options,
              answerIndex,
              hint: `분모에는 순환마디 숫자 개수(${B.length}개)만큼 9${A ? `, 순환하지 않는 숫자 개수(${A.length}개)만큼 0` : ''}을 씁니다.`,
              steps: [
                `${disp} = ${two} 이고, 순환마디는 ${B}입니다.`,
                `분자는 (전체의 수) − (순환하지 않는 부분의 수) = ${whole} − ${nonRep} = ${whole - nonRep}, 분모는 ${den}입니다.`,
                `${whole - nonRep}/${den}을 약분하면 ${correct} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-20',
          dayIndex: 19,
          unit: '중2 · 함수와 함숫값',
          standardCode: '[9수02-14]',
          standardName: '함수의 개념을 이해하고, 함숫값을 구할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (함수 f(x)의 함숫값)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '양수 하나를 대입한 함숫값', normal: '음수를 포함한 두 함숫값의 합·차', hard: '함숫값 조건으로 미정계수를 구한 뒤 다른 함숫값' },
          conceptSummary: '함수 y = f(x)에서 x = p일 때의 함숫값 f(p)는 식의 x 자리에 p를 대입한 값입니다. 음수를 대입할 때는 괄호를 씌워 계산합니다.',
          formula: 'f(x) = ax + b  ⇒  f(p) = ap + b',
          generate(rng, { tier } = {}) {
            const S = n => (n < 0 ? `−${-n}` : `${n}`);
            const lin = (p, c) => `${signedTerm(p, 'x', true)}${signedTerm(c, '')}`;
            const nz = (lo, hi) => rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
            const f = (a, b, x) => a * x + b;
            let question, ans, cands, hint, steps, vars;
            if (tier === 'hard') {
              const a = nz(2, 6), b = nz(1, 9), x0 = nz(1, 4);
              let t = nz(1, 6);
              if (t === x0) t = -t;
              const y0 = f(a, b, x0);
              ans = f(a, b, t);
              const aw = (y0 + b) / x0; // b의 부호를 잘못 옮긴 a
              question = `일차함수 f(x) = ax ${b < 0 ? '−' : '+'} ${Math.abs(b)} 에서 f(${S(x0)}) = ${S(y0)} 일 때, f(${S(t)})의 값은? (단, a는 상수)`;
              cands = [Number.isInteger(aw) ? aw * t + b : null, a * t - b, y0, a, -ans, ans + a];
              hint = `먼저 f(${S(x0)}) = ${S(y0)} 에 x = ${S(x0)}을 대입해 a를 구하세요.`;
              steps = [
                `f(${S(x0)}) = a × (${S(x0)}) ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${S(y0)} 이므로 ${S(x0)}a = ${S(y0 - b)}, a = ${S(a)} 입니다.`,
                `f(x) = ${lin(a, b)} 이므로 f(${S(t)}) = ${S(a)} × (${S(t)}) ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${S(ans)} 입니다.`
              ];
              vars = { 상수항: b, 조건x: x0, 조건값: y0, 구할x: t };
            } else {
              const a = nz(2, 5), b = tier === 'easy' ? rng.int(-6, 6) : nz(1, 9);
              if (tier === 'easy') {
                const p = rng.int(1, 5);
                ans = f(a, b, p);
                question = `일차함수 f(x) = ${lin(a, b)} 일 때, f(${p})의 값은?`;
                cands = [a * p - b, f(a, b, -p), a * p, a + p + b, ans + 1];
                steps = [`f(${p})는 x에 ${wj(p, '을/를')} 대입한 값입니다.`, `f(${p}) = ${S(a)} × ${p}${signedTerm(b, '')} = ${S(ans)} 입니다.`];
                vars = { 기울기: a, 상수항: b, 대입값: p };
              } else {
                const p = nz(1, 5);
                let q = nz(1, 5);
                if (q === p) q = -q;
                const plus = rng.next() < 0.5;
                const fp = f(a, b, p), fq = f(a, b, q);
                ans = plus ? fp + fq : fp - fq;
                question = `일차함수 f(x) = ${lin(a, b)} 일 때, f(${S(p)}) ${plus ? '+' : '−'} f(${S(q)})의 값은?`;
                cands = [plus ? fp - fq : fp + fq, plus ? fp + f(a, b, -q) : fp - f(a, b, -q), plus ? a * (p + q) + b : a * (p - q) + b, -ans, ans + 2];
                steps = [
                  `f(${S(p)}) = ${S(a)} × (${S(p)})${signedTerm(b, '')} = ${S(fp)} 입니다.`,
                  `f(${S(q)}) = ${S(a)} × (${S(q)})${signedTerm(b, '')} = ${S(fq)} 입니다.`,
                  `따라서 (${S(fp)}) ${plus ? '+' : '−'} (${S(fq)}) = ${S(ans)} 입니다.`
                ];
                vars = { 기울기: a, 상수항: b, 대입값: `${p}, ${q}` };
              }
              hint = '음수를 대입할 때는 괄호를 씌워 곱하세요. 예: 3 × (−2) = −6';
            }
            const distractors = [...new Set(cands.filter(x => x !== null && Number.isFinite(x) && x !== ans))].map(S);
            const { options, answerIndex } = buildChoiceSet(rng, S(ans), distractors.concat([S(ans + 3), S(ans - 3)]));
            return { question, variablesInfo: vars, options, answerIndex, hint, steps };
          }
        },
        {
          id: 'MID-21',
          dayIndex: 20,
          unit: '중2 · 도형의 닮음 (닮음비)',
          standardCode: '[9수03-12]',
          standardName: '도형의 닮음의 뜻과 닮은 도형의 성질을 이해하고, 닮음비를 구할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (닮은 도형의 성질과 닮음비)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '닮음비가 주어진 대응변의 길이', normal: '대응변으로 닮음비를 구한 뒤 둘레의 길이', hard: '△ABC ∽ △DEF에서 두 변의 길이를 각각 구해 합' },
          conceptSummary: '닮은 두 도형에서 대응하는 변의 길이의 비(닮음비)는 일정하며, 둘레의 길이의 비도 닮음비와 같습니다.',
          formula: '닮음비 m : n  ⇒  (대응변) = (작은 쪽) × n/m,  둘레의 비 = m : n',
          generate(rng, { tier } = {}) {
            const RATIOS = [[1, 2], [2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [1, 3], [5, 6], [3, 7], [4, 7]];
            const [m, n] = rng.pick(RATIOS);
            const cm = x => `${x} cm`;
            let question, ans, cands, steps, vars;
            if (tier === 'easy') {
              const k = rng.int(2, 6);
              const s = m * k;
              ans = n * k;
              question = `서로 닮은 두 삼각형의 닮음비가 ${m} : ${n}이다. 작은 삼각형의 한 변의 길이가 ${s} cm일 때, 이에 대응하는 큰 삼각형의 변의 길이는?`;
              cands = [s + n - m, s * n, (s * m) % n === 0 ? s * m / n : null, ans + m];
              steps = [`닮음비가 ${m} : ${n}이므로 ${s} : x = ${m} : ${n} 입니다.`, `${m}x = ${s * n} 이므로 x = ${ans}(cm)입니다.`];
              vars = { 닮음비: `${m} : ${n}`, 작은변: `${s}cm` };
            } else if (tier === 'hard') {
              let u, w, z;
              for (let t = 0; t < 50; t++) {
                u = rng.int(2, 7); w = rng.int(2, 7); z = rng.int(2, 7);
                const sd = [u, w, z].sort((x, y) => x - y);
                if (sd[2] < sd[0] + sd[1] && w !== z) break;
                u = 4; w = 5; z = 6;
              }
              const AB = m * u, DE = n * u, BC = m * w, EF = n * w, DF = n * z, AC = m * z;
              ans = AC + EF;
              question = `△ABC ∽ △DEF이고 AB = ${AB} cm, BC = ${BC} cm, DE = ${DE} cm, DF = ${DF} cm일 때, AC + EF의 길이는?`;
              cands = [DF + BC, EF + DF, AC + BC, ans + n];
              steps = [
                `대응변 AB와 DE에서 닮음비는 ${AB} : ${DE} = ${m} : ${n} 입니다.`,
                `EF = BC × ${n}/${m} = ${BC} × ${n}/${m} = ${EF}(cm), AC = DF × ${m}/${n} = ${DF} × ${m}/${n} = ${AC}(cm) 입니다.`,
                `따라서 AC + EF = ${AC} + ${EF} = ${ans}(cm)입니다.`
              ];
              vars = { AB: `${AB}cm`, BC: `${BC}cm`, DE: `${DE}cm`, DF: `${DF}cm` };
            } else {
              const u = rng.int(1, 3), w = rng.int(3 * u + 1, 3 * u + 6);
              const a1 = m * u, a2 = n * u, P = m * w;
              ans = n * w;
              question = `서로 닮은 두 사각형에서 대응하는 한 쌍의 변의 길이가 각각 ${a1} cm, ${a2} cm이다. 작은 사각형의 둘레의 길이가 ${P} cm일 때, 큰 사각형의 둘레의 길이는?`;
              cands = [P + a2 - a1, (P * a1) % a2 === 0 ? P * a1 / a2 : null, P + 4 * (a2 - a1) === ans ? null : P + 4 * (a2 - a1), 4 * a2, ans + n];
              steps = [
                `대응변의 길이의 비가 ${a1} : ${a2} = ${m} : ${n}이므로 닮음비는 ${m} : ${n} 입니다.`,
                `둘레의 길이의 비도 닮음비와 같으므로 ${P} : x = ${m} : ${n} 입니다.`,
                `${m}x = ${P * n} 이므로 x = ${ans}(cm)입니다.`
              ];
              vars = { 작은대응변: `${a1}cm`, 큰대응변: `${a2}cm`, 작은둘레: `${P}cm` };
            }
            const distractors = [...new Set(cands.filter(x => x !== null && x > 0 && x !== ans))].map(cm);
            const { options, answerIndex } = buildChoiceSet(rng, cm(ans), distractors.concat([cm(ans + 1), cm(ans + 2)]));
            return { question, variablesInfo: vars, options, answerIndex, hint: '닮음비는 대응하는 변끼리의 비입니다. 길이의 차이를 더하는 것이 아니라 비율을 곱해야 합니다.', steps };
          }
        },
        {
          id: 'MID-22',
          dayIndex: 21,
          unit: '중1 · 정수와 유리수의 대소 관계',
          standardCode: '[9수01-04]',
          standardName: '정수와 유리수의 대소 관계를 판단할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (수직선과 유리수의 대소 관계)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '음수를 포함한 정수 네 개의 대소', normal: '분수·소수가 섞인 유리수 네 개의 대소', hard: '두 유리수 사이에 있는 정수의 개수' },
          conceptSummary: '수직선에서 오른쪽에 있는 수가 더 큽니다. 음수끼리는 절댓값이 클수록 작습니다. 분수와 소수는 같은 형태로 바꾸어 비교합니다.',
          formula: '음수 < 0 < 양수,  음수끼리: 절댓값이 클수록 작다',
          generate(rng, { tier } = {}) {
            const S = n => (n < 0 ? `−${-n}` : `${n}`);
            // 유리수 하나를 표기 문자열과 값으로 만든다
            const mkRat = (allowDec, forceNeg) => {
              const d0 = rng.pick([2, 3, 4, 5, 6]);
              let n0 = rng.int(1, 3 * d0);
              if (n0 % d0 === 0) n0 += 1;
              const g = gcd(n0, d0), nn = n0 / g, dd = d0 / g;
              const neg = forceNeg === undefined ? rng.next() < 0.6 : forceNeg;
              const dec = allowDec && [2, 4, 5].includes(dd) && rng.next() < 0.4;
              const body = dec ? String(nn / dd) : `${nn}/${dd}`;
              return { v: (neg ? -1 : 1) * nn / dd, s: (neg ? '−' : '') + body };
            };
            if (tier === 'hard') {
              const lo = mkRat(true, true), hi = mkRat(true, false);
              const c = Math.floor(hi.v) - Math.ceil(lo.v) + 1;
              const cands = [c + 1, c - 1, c + 2, c - 2].filter(x => x >= 0);
              const { options, answerIndex } = buildChoiceSet(rng, `${c}개`, cands.map(x => `${x}개`));
              const ints = [];
              for (let k = Math.ceil(lo.v); k <= Math.floor(hi.v); k++) ints.push(S(k));
              return {
                question: `두 수 ${lo.s}, ${hi.s} 사이에 있는 정수의 개수는?`,
                variablesInfo: { 왼쪽: lo.s, 오른쪽: hi.s },
                options,
                answerIndex,
                hint: '각 수가 어느 두 정수 사이에 있는지 먼저 확인하세요. 0도 정수입니다.',
                steps: [
                  `${wj(lo.s, '은/는')} ${wj(S(Math.floor(lo.v)), '과/와')} ${S(Math.ceil(lo.v))} 사이, ${wj(hi.s, '은/는')} ${wj(S(Math.floor(hi.v)), '과/와')} ${S(Math.ceil(hi.v))} 사이의 수입니다.`,
                  `두 수 사이의 정수는 ${ints.join(', ') || '없음'} 으로 ${c}개입니다.`
                ]
              };
            }
            let items = [];
            for (let t = 0; t < 100 && items.length < 4; t++) {
              const it = tier === 'easy'
                ? (() => { const x = rng.int(-9, 9); return { v: x, s: S(x) }; })()
                : mkRat(true);
              if (items.every(o => Math.abs(o.v - it.v) > 1e-9 && o.s !== it.s)) items.push(it);
            }
            if (tier === 'easy' && items.filter(o => o.v < 0).length < 2) items = [{ v: -7, s: '−7' }, { v: -2, s: '−2' }, { v: 0, s: '0' }, { v: 3, s: '3' }];
            const big = rng.next() < 0.5;
            const target = items.reduce((acc, o) => ((big ? o.v > acc.v : o.v < acc.v) ? o : acc));
            const others = items.filter(o => o !== target).map(o => o.s);
            const { options, answerIndex } = buildChoiceSet(rng, target.s, others);
            const order = items.slice().sort((x, y) => x.v - y.v).map(o => o.s).join(' < ');
            return {
              question: `다음 수 중에서 가장 ${big ? '큰' : '작은'} 수는?  [ ${items.map(o => o.s).join(', ')} ]`,
              variablesInfo: { 수들: items.map(o => o.s).join(', ') },
              options,
              answerIndex,
              hint: '음수끼리는 절댓값이 큰 수가 더 작습니다. 분수는 소수로 바꾸어 비교해 보세요.',
              steps: [
                tier === 'easy' ? '수직선 위에 나타내면 오른쪽에 있는 수일수록 큽니다.' : `분수를 소수로 바꾸면 ${items.map(o => `${o.s} = ${S(Math.round(o.v * 100) / 100)}`).join(', ')} (반올림) 입니다.`,
                `크기순으로 나열하면 ${order} 이므로 가장 ${big ? '큰' : '작은'} 수는 ${target.s} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-23',
          dayIndex: 22,
          unit: '중1 · 정비례와 반비례',
          standardCode: '[9수02-07]',
          standardName: '정비례, 반비례 관계를 이해하고, 그 관계를 표, 식, 그래프로 나타낼 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (정비례 y = ax, 반비례 y = a/x)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '정비례 관계식 y = ax 세우기', normal: '반비례 관계식 y = a/x 세우기(음수 포함)', hard: 'y = ax와 y = b/x 그래프의 교점으로 b 구하기' },
          conceptSummary: 'y가 x에 정비례하면 y = ax (y/x 일정), 반비례하면 y = a/x (xy 일정)입니다. 두 그래프가 만나는 점은 두 식을 모두 만족합니다.',
          formula: '정비례: y = ax,  반비례: y = a/x (xy = a)',
          generate(rng, { tier } = {}) {
            const S = n => (n < 0 ? `−${-n}` : `${n}`);
            const nz = (lo, hi) => rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
            let question, ans, cands, steps, vars, hint;
            if (tier === 'hard') {
              const a = nz(2, 5), p = nz(1, 4);
              const qv = a * p;
              ans = p * qv;
              question = `정비례 관계 y = ${S(a)}x의 그래프와 반비례 관계 y = b/x의 그래프가 x좌표가 ${S(p)}인 점에서 만날 때, 상수 b의 값은?`;
              cands = [qv, -ans, a + p, a * p * 2, ans + a];
              hint = '교점은 두 그래프 위에 모두 있으므로, 먼저 y = ax에서 교점의 y좌표를 구하세요.';
              steps = [
                `교점의 x좌표가 ${S(p)}이므로 y = ${S(a)} × (${S(p)}) = ${S(qv)}, 교점은 (${S(p)}, ${S(qv)}) 입니다.`,
                `이 점이 y = b/x 위에 있으므로 b = xy = (${S(p)}) × (${S(qv)}) = ${S(ans)} 입니다.`
              ];
              vars = { 정비례계수: a, 교점x: p };
            } else if (tier === 'easy') {
              const k = nz(2, 6), x1 = rng.int(1, 5);
              let x2 = nz(1, 8);
              if (x2 === x1) x2 = -x2;
              const y1 = k * x1;
              ans = k * x2;
              question = `y가 x에 정비례하고, x = ${x1}일 때 y = ${S(y1)}이다. x = ${S(x2)}일 때 y의 값은?`;
              cands = [(x1 * y1) % x2 === 0 ? x1 * y1 / x2 : null, y1 + (x2 - x1), -ans, k];
              hint = 'y = ax에 주어진 x, y의 값을 대입해 a를 먼저 구하세요.';
              steps = [`y = ax에 x = ${x1}, y = ${S(y1)}을 대입하면 a = ${S(k)}, 즉 y = ${S(k)}x 입니다.`, `x = ${S(x2)}을 대입하면 y = ${S(k)} × (${S(x2)}) = ${S(ans)} 입니다.`];
              vars = { x1, y1, x2 };
            } else {
              const K = rng.pick([12, 18, 20, 24, 30, 36, 48, 60]) * (rng.next() < 0.5 ? -1 : 1);
              const divs = [];
              for (let d = 1; d <= Math.abs(K); d++) if (K % d === 0 && d !== Math.abs(K)) divs.push(d, -d);
              const x1 = rng.pick(divs);
              let x2 = rng.pick(divs);
              if (x2 === x1) x2 = -x1;
              const y1 = K / x1;
              ans = K / x2;
              question = `y가 x에 반비례하고, x = ${S(x1)}일 때 y = ${S(y1)}이다. x = ${S(x2)}일 때 y의 값은?`;
              cands = [(y1 * x2) % x1 === 0 ? y1 * x2 / x1 : null, -ans, K, y1 - (x2 - x1)];
              hint = '반비례 관계에서는 xy의 값이 항상 일정합니다.';
              steps = [`y = a/x에서 a = xy = (${S(x1)}) × (${S(y1)}) = ${S(K)}, 즉 y = ${S(K)}/x 입니다.`, `x = ${S(x2)}을 대입하면 y = ${S(K)} ÷ (${S(x2)}) = ${S(ans)} 입니다.`];
              vars = { x1, y1, x2 };
            }
            const distractors = [...new Set(cands.filter(x => x !== null && Number.isInteger(x) && x !== ans))].map(S);
            const { options, answerIndex } = buildChoiceSet(rng, S(ans), distractors.concat([S(ans + 1), S(ans - 1)]));
            return { question, variablesInfo: vars, options, answerIndex, hint, steps };
          }
        },
        {
          id: 'MID-24',
          dayIndex: 23,
          unit: '중1 · 부채꼴의 호의 길이와 넓이',
          standardCode: '[9수03-06]',
          standardName: '부채꼴의 중심각과 호의 관계를 이해하고, 이를 이용하여 부채꼴의 호의 길이와 넓이를 구할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (부채꼴의 호의 길이와 넓이)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '반지름·중심각으로 호의 길이', normal: '반지름·중심각으로 넓이', hard: '반지름·호의 길이로 넓이 (S = ½rl)' },
          conceptSummary: '부채꼴의 호의 길이와 넓이는 중심각의 크기에 정비례합니다. 반지름 r, 중심각 x°이면 호의 길이 l = 2πr × x/360, 넓이 S = πr² × x/360 = ½rl 입니다.',
          formula: 'l = 2πr × x/360,  S = πr² × x/360 = (1/2)rl',
          generate(rng, { tier } = {}) {
            const TH = [30, 40, 45, 60, 72, 80, 90, 100, 120, 135, 144, 150, 160, 200, 240, 270];
            let r = 6, th = 60;
            const ok = (rr, tt) => {
              if (tier === 'easy') return (rr * tt) % 180 === 0 && rr * tt / 180 >= 2;
              if (tier === 'hard') return (rr * tt) % 180 === 0 && rr * tt / 180 >= 2 && (rr * (rr * tt / 180)) % 2 === 0;
              return (rr * rr * tt) % 360 === 0 && rr * rr * tt / 360 >= 2;
            };
            for (let t = 0; t < 200; t++) {
              const rr = rng.int(3, 12), tt = rng.pick(TH);
              if (ok(rr, tt)) { r = rr; th = tt; break; }
            }
            const arc = r * th / 180; // π의 계수
            const area = r * r * th / 360;
            let question, ans, cands, unit, steps;
            if (tier === 'easy') {
              ans = arc; unit = 'cm';
              question = `반지름의 길이가 ${r} cm이고 중심각의 크기가 ${th}°인 부채꼴의 호의 길이는?`;
              cands = [area, r * th / 360, 2 * r, arc * 2];
              steps = [`호의 길이 = 2π × ${r} × ${th}/360 입니다.`, `계산하면 ${arc}π cm 입니다.`];
            } else if (tier === 'hard') {
              ans = r * arc / 2; unit = 'cm²';
              question = `반지름의 길이가 ${r} cm이고 호의 길이가 ${arc}π cm인 부채꼴의 넓이는?`;
              cands = [r * arc, r * r, (arc * arc) % 2 === 0 ? arc * arc / 2 : null, ans + r];
              steps = [`반지름 r과 호의 길이 l을 알면 넓이는 S = (1/2)rl 입니다.`, `S = (1/2) × ${r} × ${arc}π = ${ans}π cm² 입니다.`];
            } else {
              ans = area; unit = 'cm²';
              question = `반지름의 길이가 ${r} cm이고 중심각의 크기가 ${th}°인 부채꼴의 넓이는?`;
              cands = [Number.isInteger(arc) ? arc : null, r * r, area * 2, 2 * r];
              steps = [`부채꼴의 넓이 = π × ${r}² × ${th}/360 입니다.`, `계산하면 ${r * r} × ${th}/360 = ${area}이므로 ${area}π cm² 입니다.`];
            }
            const fmt = x => `${x}π ${unit}`;
            const distractors = [...new Set(cands.filter(x => x !== null && Number.isInteger(x) && x >= 2 && x !== ans))].map(fmt);
            const { options, answerIndex } = buildChoiceSet(rng, fmt(ans), distractors.concat([fmt(ans + 2), fmt(ans + 4)]));
            return {
              question,
              variablesInfo: { 반지름: `${r}cm`, 조건: tier === 'hard' ? `호 ${arc}π cm` : `중심각 ${th}°` },
              options,
              answerIndex,
              hint: tier === 'hard' ? '중심각을 몰라도 넓이 = (1/2) × 반지름 × 호의 길이로 구할 수 있습니다.' : '부채꼴은 원의 일부입니다. (원의 둘레 또는 넓이) × (중심각/360)으로 구하세요.',
              steps
            };
          }
        },
        {
          id: 'MID-25',
          dayIndex: 24,
          unit: '중2 · 경우의 수',
          standardCode: '[9수04-05]',
          standardName: '경우의 수를 구할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (합의 법칙과 곱의 법칙, 대표 뽑기)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '곱의 법칙(옷 짝짓기)', normal: '대표 뽑기(자격이 다른 2명 / 같은 2명)', hard: '0이 포함된 카드로 자연수 만들기' },
          conceptSummary: '두 사건이 동시에(잇달아) 일어나면 곱의 법칙을 씁니다. 자격이 다른 대표는 순서가 있으므로 n(n − 1), 자격이 같은 대표는 순서가 없으므로 n(n − 1)/2입니다. 0은 맨 앞자리에 올 수 없습니다.',
          formula: '곱의 법칙: m × n,  회장·부회장: n(n − 1),  대표 2명: n(n − 1)/2',
          generate(rng, { tier } = {}) {
            const ga = x => `${comma(x)}가지`;
            let question, ans, cands, steps;
            if (tier === 'easy') {
              const a = rng.int(2, 6), b = rng.int(2, 5);
              ans = a * b;
              question = `티셔츠 ${a}종류와 바지 ${b}종류가 있다. 티셔츠와 바지를 하나씩 짝지어 입는 방법의 수는?`;
              cands = [a + b, a * b * 2, a * a, b * b];
              steps = [`티셔츠를 고르는 방법은 ${a}가지, 그 각각에 대해 바지를 고르는 방법은 ${b}가지입니다.`, `곱의 법칙에 의해 ${a} × ${b} = ${ans}가지입니다.`];
            } else if (tier === 'hard') {
              const k = rng.int(3, 9), d = rng.pick([2, 3]);
              let perm = 1;
              for (let i = 0; i < d - 1; i++) perm *= (k - i);
              ans = k * perm;
              let pk1 = 1; for (let i = 0; i < d; i++) pk1 *= (k + 1 - i);
              let pk = 1; for (let i = 0; i < d; i++) pk *= (k - i);
              question = `0부터 ${k}까지의 정수가 하나씩 적힌 ${k + 1}장의 카드 중 ${d}장을 뽑아 만들 수 있는 ${d === 2 ? '두' : '세'} 자리 자연수의 개수는?`;
              cands = [pk1, pk, Math.pow(k, d), Math.pow(k + 1, d)];
              steps = [
                `맨 앞자리에는 0이 올 수 없으므로 1부터 ${k}까지 ${k}가지입니다.`,
                d === 2 ? `일의 자리에는 맨 앞에 쓴 카드를 뺀 나머지(0 포함) ${k}가지가 옵니다.` : `둘째 자리에는 맨 앞에 쓴 카드를 뺀 나머지(0 포함) ${k}가지, 셋째 자리에는 ${k - 1}가지가 옵니다.`,
                `따라서 ${d === 2 ? `${k} × ${k}` : `${k} × ${k} × ${k - 1}`} = ${ans}개입니다.`
              ];
            } else {
              const n = rng.int(4, 12);
              const who = rng.pick(['학생', '후보', '선수', '회원']);
              if (rng.next() < 0.5) {
                ans = n * (n - 1);
                question = `${n}명의 ${who} 중에서 회장 1명, 부회장 1명을 뽑는 경우의 수는?`;
                cands = [n * (n - 1) / 2, n * n, 2 * n - 1, n * (n - 1) * 2];
                steps = [`회장을 뽑는 경우는 ${n}가지, 회장을 뺀 나머지 중 부회장을 뽑는 경우는 ${n - 1}가지입니다.`, `자격이 다르므로 순서가 있어 ${n} × ${n - 1} = ${ans}가지입니다.`];
              } else {
                ans = n * (n - 1) / 2;
                question = `${n}명의 ${who} 중에서 대표 2명을 뽑는 경우의 수는?`;
                cands = [n * (n - 1), n * n, 2 * n - 1, ans + n];
                steps = [`순서를 생각하여 2명을 뽑으면 ${n} × ${n - 1} = ${n * (n - 1)}가지입니다.`, `대표 2명은 자격이 같아 (A, B)와 (B, A)가 같은 경우이므로 ${n * (n - 1)} ÷ 2 = ${ans}가지입니다.`];
              }
            }
            const unitFmt = tier === 'hard' ? (x => `${comma(x)}개`) : ga;
            const distractors = [...new Set(cands.filter(x => Number.isInteger(x) && x > 0 && x !== ans))].map(unitFmt);
            const { options, answerIndex } = buildChoiceSet(rng, unitFmt(ans), distractors.concat([unitFmt(ans + 1), unitFmt(ans + 2)]));
            return {
              question,
              variablesInfo: { 유형: tier === 'easy' ? '곱의 법칙' : tier === 'hard' ? '카드로 자연수 만들기' : '대표 뽑기' },
              options,
              answerIndex,
              hint: tier === 'hard' ? '맨 앞자리에 0이 올 수 없다는 점을 먼저 처리하세요.' : '순서(자격)가 있는지 없는지를 먼저 판단하세요.',
              steps
            };
          }
        },
        {
          id: 'MID-26',
          dayIndex: 25,
          unit: '중3 · 제곱근의 뜻과 대소 관계',
          standardCode: '[9수01-07]',
          standardName: '제곱근의 뜻과 성질을 알고, 제곱근의 대소 관계를 판단할 수 있다.',
          sourceRef: '중학교 수학 3 교과서 (제곱근의 뜻과 성질, 대소 관계)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '제곱수의 제곱근(± 두 개)', normal: 'p < √x < q를 만족하는 자연수 x의 개수', hard: '√(an)이 자연수가 되는 가장 작은 n' },
          conceptSummary: '양수 a의 제곱근은 ±√a 두 개입니다. a, b가 양수일 때 a < b ⇔ √a < √b 이고, √(자연수)가 자연수가 되려면 근호 안의 수가 제곱수여야 합니다.',
          formula: 'x² = a (a > 0) ⇒ x = ±√a,  0 < a < b ⇔ √a < √b',
          generate(rng, { tier } = {}) {
            let question, correct, distractors, steps, hint;
            if (tier === 'easy') {
              const n = rng.int(2, 20), N = n * n;
              question = `${N}의 제곱근을 모두 구하면?`;
              correct = `±${n}`;
              distractors = [`${n}`, `−${n}`, `±${N}`];
              hint = '제곱하여 a가 되는 수가 a의 제곱근입니다. 양수와 음수 두 개가 있습니다.';
              steps = [`${n}² = ${N}, (−${n})² = ${N} 입니다.`, `따라서 ${N}의 제곱근은 ±${n} 입니다.`];
            } else if (tier === 'hard') {
              const s = rng.pick([2, 3, 5, 6, 7, 10, 11, 14, 15]);
              const m = rng.int(2, 6);
              const a = s * m * m;
              question = `√(${a}n)이 자연수가 되도록 하는 가장 작은 자연수 n의 값은?`;
              correct = `${s}`;
              distractors = [`${m}`, `${m * m}`, `${a}`, `${2 * s}`].filter(x => x !== correct);
              hint = `${wj(a, '을/를')} 소인수분해하여 지수가 홀수인 소인수를 찾으세요.`;
              steps = [
                `${a} = ${m * m} × ${s} = ${m}² × ${s} 입니다.`,
                `근호 안이 제곱수가 되려면 ${wj(s, '을/를')} 한 번 더 곱해야 하므로 가장 작은 n = ${s} 입니다.`,
                `이때 √(${a} × ${s}) = √(${m * s}²) = ${m * s} 입니다.`
              ];
            } else {
              const p = rng.int(1, 9), q = p + rng.int(1, 3);
              const o1 = rng.next() < 0.5 ? '<' : '≤', o2 = rng.next() < 0.5 ? '<' : '≤';
              const lo = p * p + (o1 === '<' ? 1 : 0), hi = q * q - (o2 === '<' ? 1 : 0);
              const c = hi - lo + 1;
              question = `부등식 ${p} ${o1} √x ${o2} ${wj(q, '을/를')} 만족시키는 자연수 x의 개수는?`;
              correct = `${c}개`;
              distractors = [q - p - 1, q * q - p * p, q * q - p * p + 1, q * q - p * p - 1, c + 2]
                .filter(x => x >= 0 && x !== c).map(x => `${x}개`);
              hint = '각 변이 모두 양수이므로 각 변을 제곱해도 부등호 방향은 그대로입니다.';
              steps = [`각 변을 제곱하면 ${p * p} ${o1} x ${o2} ${q * q} 입니다.`, `이를 만족하는 자연수 x는 ${lo}부터 ${hi}까지이므로 ${hi} − ${lo} + 1 = ${c}개입니다.`];
            }
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
            return { question, variablesInfo: { 유형: tier || 'normal' }, options, answerIndex, hint, steps };
          }
        },
        {
          id: 'MID-27',
          dayIndex: 26,
          unit: '중2 · 단항식과 다항식의 곱셈과 나눗셈',
          standardCode: '[9수02-10]',
          standardName: '‘(단항식)×(다항식)’, ‘(다항식)÷(단항식)’과 같은 곱셈과 나눗셈의 원리를 이해하고, 그 계산을 할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (단항식과 다항식의 곱셈·나눗셈, 전개)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '(단항식) × (다항식) 전개', normal: '(다항식) ÷ (단항식)', hard: '나눗셈과 곱셈이 섞인 식의 동류항 정리' },
          conceptSummary: '(단항식) × (다항식)은 분배법칙으로 각 항에 곱하고, (다항식) ÷ (단항식)은 다항식의 각 항을 단항식으로 나눕니다. 같은 문자의 곱은 지수를 더하고, 나눗셈은 지수를 뺍니다.',
          formula: 'kx(ax + b) = kax² + kbx,  (Ax² + Bx) ÷ Cx = (A/C)x + B/C',
          generate(rng, { tier } = {}) {
            const S = n => (n < 0 ? `−${-n}` : `${n}`);
            const nz = (lo, hi) => rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
            const P = terms => { const t = terms.filter(([c]) => c !== 0); return t.length ? t.map(([c, v], i) => signedTerm(c, v, i === 0)).join('') : '0'; };
            const lin = (p, c) => P([[p, 'x'], [c, '']]);
            const mono = (k, v) => (k === 1 ? v : k === -1 ? `−${v}` : `${S(k)}${v}`);
            let expr, correct, distractors, steps, hint;
            if (tier === 'easy') {
              const k = nz(2, 5), a = rng.int(1, 5), b = nz(1, 7);
              expr = `${mono(k, 'x')}(${lin(a, b)})`;
              correct = P([[k * a, 'x²'], [k * b, 'x']]);
              distractors = [P([[k * a, 'x²'], [b, 'x']]), P([[k * a, 'x²'], [-k * b, 'x']]), P([[k * a, 'x'], [k * b, '']]), P([[k * a, 'x²'], [k * b, '']])];
              hint = `${mono(k, 'x')}를 괄호 안의 두 항에 모두 곱하세요. x × x = x² 입니다.`;
              steps = [`분배법칙으로 ${mono(k, 'x')} × ${mono(a, 'x')} + ${mono(k, 'x')} × (${S(b)}) 로 계산합니다.`, `${mono(k * a, 'x²')}, ${mono(k * b, 'x')} 이므로 ${correct} 입니다.`];
            } else if (tier === 'hard') {
              let C, p, q, k, a, b, X2, X1;
              for (let t = 0; t < 50; t++) {
                C = rng.int(2, 5); p = nz(1, 5); q = nz(1, 6); k = rng.int(1, 4); a = nz(1, 4); b = nz(1, 6);
                X2 = p - k * a; X1 = q - k * b;
                if (X2 !== 0 && X1 !== 0) break;
                C = 3; p = 3; q = -3; k = 2; a = 1; b = -4; X2 = 1; X1 = 5;
              }
              expr = `(${P([[C * p, 'x³'], [C * q, 'x²']])}) ÷ ${C}x − ${k === 1 ? '' : k}x(${lin(a, b)})`;
              correct = P([[X2, 'x²'], [X1, 'x']]);
              distractors = [
                P([[X2, 'x²'], [q + k * b, 'x']]), // 뒤 괄호의 둘째 항 부호를 안 바꿈
                P([[p + k * a, 'x²'], [q + k * b, 'x']]), // 빼기를 더하기로 계산
                P([[X2, 'x³'], [X1, 'x²']]), // 나눗셈에서 지수를 빼지 않음
                P([[X2, 'x²'], [C * q - k * b, 'x']]) // 첫 항만 나눔
              ];
              hint = '나눗셈 부분과 곱셈 부분을 각각 먼저 계산한 뒤, 빼기의 부호에 주의하여 동류항끼리 모으세요.';
              steps = [
                `(${P([[C * p, 'x³'], [C * q, 'x²']])}) ÷ ${C}x = ${P([[p, 'x²'], [q, 'x']])} 입니다.`,
                `${k === 1 ? '' : k}x(${lin(a, b)}) = ${P([[k * a, 'x²'], [k * b, 'x']])} 입니다.`,
                `(${P([[p, 'x²'], [q, 'x']])}) − (${P([[k * a, 'x²'], [k * b, 'x']])}) = ${correct} 입니다.`
              ];
            } else {
              const C = rng.int(2, 6), p = nz(1, 5), q = nz(1, 6);
              expr = `(${P([[C * p, 'x²'], [C * q, 'x']])}) ÷ ${C}x`;
              correct = lin(p, q);
              distractors = [lin(p, C * q), P([[p, 'x²'], [q, 'x']]), lin(p, -q), lin(-p, q)];
              hint = `다항식의 각 항을 ${C}x로 나누세요. 두 번째 항도 빠뜨리지 마세요.`;
              steps = [`(${P([[C * p, 'x²'], [C * q, 'x']])}) ÷ ${C}x = ${mono(C * p, 'x²')}/${C}x ${C * q < 0 ? '−' : '+'} ${mono(Math.abs(C * q), 'x')}/${C}x 입니다.`, `각각 계산하면 ${correct} 입니다.`];
            }
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
            return { question: `다음 식을 간단히 하면?  [ ${expr} ]`, variablesInfo: { 식: expr }, options, answerIndex, hint, steps };
          }
        },
        {
          id: 'MID-28',
          dayIndex: 27,
          unit: '중1 · 입체도형의 겉넓이와 부피',
          standardCode: '[9수03-08]',
          standardName: '입체도형의 겉넓이와 부피를 구할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (원기둥·원뿔의 겉넓이와 부피)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '원기둥의 부피', normal: '원뿔의 부피(1/3 곱하기)', hard: '원뿔의 겉넓이(밑넓이 + 옆넓이)' },
          conceptSummary: '원기둥의 부피는 (밑넓이) × (높이) = πr²h, 원뿔의 부피는 그 1/3인 (1/3)πr²h입니다. 원뿔의 겉넓이는 밑넓이 πr²와 옆넓이 πrl(l은 모선의 길이)의 합입니다.',
          formula: '원기둥 V = πr²h,  원뿔 V = (1/3)πr²h,  원뿔 겉넓이 = πr² + πrl',
          generate(rng, { tier } = {}) {
            const r = rng.int(2, 8);
            let question, ans, cands, unit, steps;
            if (tier === 'easy') {
              const h = rng.int(3, 10);
              ans = r * r * h; unit = 'cm³';
              question = `밑면의 반지름의 길이가 ${r} cm, 높이가 ${h} cm인 원기둥의 부피는?`;
              cands = [2 * r * h, r * h, (r * r * h) % 3 === 0 ? r * r * h / 3 : null, 4 * r * r * h];
              steps = [`밑넓이는 π × ${r}² = ${r * r}π cm² 입니다.`, `부피는 (밑넓이) × (높이) = ${r * r}π × ${h} = ${ans}π cm³ 입니다.`];
            } else if (tier === 'hard') {
              const l = r + rng.int(1, 8);
              ans = r * r + r * l; unit = 'cm²';
              question = `밑면의 반지름의 길이가 ${r} cm, 모선의 길이가 ${l} cm인 원뿔의 겉넓이는?`;
              cands = [r * l, r * r + 2 * r * l, r * r + l * l, 2 * r * r + r * l];
              steps = [`밑넓이는 π × ${r}² = ${r * r}π cm² 입니다.`, `옆넓이는 π × (반지름) × (모선) = π × ${r} × ${l} = ${r * l}π cm² 입니다.`, `겉넓이는 ${r * r}π + ${r * l}π = ${ans}π cm² 입니다.`];
            } else {
              let h = rng.int(2, 12);
              if ((r * r * h) % 3 !== 0) h = 3 * rng.int(1, 4);
              ans = r * r * h / 3; unit = 'cm³';
              question = `밑면의 반지름의 길이가 ${r} cm, 높이가 ${h} cm인 원뿔의 부피는?`;
              cands = [r * r * h, r * h, 2 * r * r * h / 3, 4 * r * r * h / 3];
              steps = [`원뿔의 부피는 같은 밑면·높이의 원기둥 부피의 1/3입니다.`, `(1/3) × π × ${r}² × ${h} = (1/3) × ${r * r * h}π = ${ans}π cm³ 입니다.`];
            }
            const fmt = x => `${comma(x)}π ${unit}`;
            const distractors = [...new Set(cands.filter(x => x !== null && Number.isInteger(x) && x !== ans))].map(fmt);
            const { options, answerIndex } = buildChoiceSet(rng, fmt(ans), distractors.concat([fmt(ans + r), fmt(ans + 2 * r)]));
            return {
              question,
              variablesInfo: { 반지름: `${r}cm`, 입체: tier === 'easy' ? '원기둥' : '원뿔' },
              options,
              answerIndex,
              hint: tier === 'hard' ? '원뿔의 전개도는 밑면(원)과 옆면(부채꼴)으로 이루어집니다. 옆넓이는 πrl 입니다.' : '부피 = (밑넓이) × (높이)이고, 뿔은 기둥의 1/3입니다.',
              steps
            };
          }
        },
        {
          id: 'MID-29',
          dayIndex: 28,
          unit: '중1 · 상대도수',
          standardCode: '[9수04-03]',
          standardName: '상대도수를 구하고, 상대도수의 분포를 표나 그래프로 나타내고 해석할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 (상대도수와 그 분포)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '도수 ÷ 전체 도수로 상대도수', normal: '상대도수 × 전체 도수로 도수', hard: '두 계급의 상대도수와 도수의 합으로 전체 도수' },
          conceptSummary: '(상대도수) = (그 계급의 도수) ÷ (전체 도수)이고, 상대도수의 총합은 1입니다. 따라서 (도수) = (상대도수) × (전체 도수)입니다.',
          formula: '상대도수 = 도수 / 전체 도수,  도수 = 상대도수 × 전체 도수',
          generate(rng, { tier } = {}) {
            const dec = x => String(Math.round(x * 100) / 100);
            let question, correct, cands, steps;
            if (tier === 'hard') {
              let r1 = 15, r2 = 25, T = 40;
              for (let t = 0; t < 100; t++) {
                const a = 5 * rng.int(1, 8), b = 5 * rng.int(1, 8), TT = 20 * rng.int(1, 10);
                if (a !== b && a + b <= 60 && (TT * a) % 100 === 0 && (TT * b) % 100 === 0) { r1 = a; r2 = b; T = TT; break; }
              }
              const F = T * (r1 + r2) / 100;
              question = `어떤 도수분포표에서 상대도수가 각각 ${dec(r1 / 100)}, ${dec(r2 / 100)}인 두 계급의 도수의 합이 ${F}일 때, 전체 도수는?`;
              correct = `${T}`;
              cands = [F * (r1 + r2) / 100, F * 100 / r1, F * 100 / r2, F + r1 + r2, T * 2];
              steps = [
                `두 계급의 상대도수의 합은 ${dec(r1 / 100)} + ${dec(r2 / 100)} = ${dec((r1 + r2) / 100)} 입니다.`,
                `(도수의 합) = (상대도수의 합) × (전체 도수)이므로 전체 도수 = ${F} ÷ ${dec((r1 + r2) / 100)} = ${T} 입니다.`
              ];
            } else {
              const T = rng.pick([20, 25, 40, 50, 80, 100]);
              let f = rng.int(2, Math.floor(T * 0.45));
              while ((f * 100) % T !== 0) f += 1;
              const rel = f / T;
              if (tier === 'easy') {
                question = `전체 도수가 ${T}인 도수분포표에서 도수가 ${f}인 계급의 상대도수는?`;
                correct = dec(rel);
                cands = [f / 100, 1 - rel, rel * 10 <= 1 ? rel * 10 : rel / 10, rel + 0.1];
                steps = [`(상대도수) = (그 계급의 도수) ÷ (전체 도수) 입니다.`, `${f} ÷ ${T} = ${dec(rel)} 입니다.`];
              } else {
                question = `전체 도수가 ${T}인 도수분포표에서 상대도수가 ${dec(rel)}인 계급의 도수는?`;
                correct = `${f}`;
                cands = [Math.round(rel * 100), T - f, Math.round(rel * 10), f + 2];
                steps = [`(도수) = (상대도수) × (전체 도수) 입니다.`, `${dec(rel)} × ${T} = ${f} 입니다.`];
              }
            }
            const two = x => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9; // 소수 둘째 자리까지 깔끔한 값만
            const distractors = [...new Set(cands.filter(x => Number.isFinite(x) && x > 0 && two(x)).map(dec))].filter(x => x !== correct);
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors.concat([dec(Number(correct) * 2), dec(Number(correct) + 1)]));
            return {
              question,
              variablesInfo: { 유형: tier === 'easy' ? '상대도수' : tier === 'hard' ? '전체 도수' : '도수' },
              options,
              answerIndex,
              hint: '상대도수 = (도수) ÷ (전체 도수) 관계식 하나로 세 값 중 어느 것이든 구할 수 있습니다.',
              steps
            };
          }
        },
        {
          id: 'MID-30',
          dayIndex: 29,
          unit: '중3 · 근호를 포함한 식의 계산',
          standardCode: '[9수01-10]',
          standardName: '근호를 포함한 식의 사칙 계산의 원리를 이해하고, 그 계산을 할 수 있다.',
          sourceRef: '중학교 수학 3 교과서 (제곱근의 덧셈과 뺄셈, 분모의 유리화)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '근호 안이 같은 수의 덧셈·뺄셈', normal: '√(a²b) = a√b로 바꾼 뒤 덧셈·뺄셈', hard: '분모의 유리화가 섞인 세 항의 계산' },
          conceptSummary: '근호 안의 수가 같은 것끼리만 더하고 뺄 수 있습니다(m√a + n√a = (m + n)√a). 근호 안의 제곱인수는 √(a²b) = a√b로 밖으로 꺼내고, 분모의 근호는 유리화합니다.',
          formula: 'm√a ± n√a = (m ± n)√a,  √(a²b) = a√b,  c/√a = c√a/a',
          generate(rng, { tier } = {}) {
            const S = n => (n < 0 ? `−${-n}` : `${n}`);
            const k = rng.pick([2, 3, 5, 6, 7]);
            const rt = (c, kk = k) => (c === 1 ? `√${kk}` : c === -1 ? `−√${kk}` : `${S(c)}√${kk}`);
            let expr, c, cands, steps;
            if (tier === 'easy') {
              const a = rng.int(2, 9);
              let b = rng.int(2, 9);
              const plus = rng.next() < 0.5;
              if (!plus && Math.abs(a - b) < 2) b = a + 2 + rng.int(0, 3);
              c = plus ? a + b : a - b;
              expr = `${a}√${k} ${plus ? '+' : '−'} ${b}√${k}`;
              cands = [plus ? a - b : a + b, a * b, -c];
              steps = [`근호 안의 수가 ${k}로 같으므로 계수끼리 계산합니다.`, `(${a} ${plus ? '+' : '−'} ${b})√${k} = ${rt(c)} 입니다.`];
            } else if (tier === 'hard') {
              let a, m, b, s1, s2;
              for (let t = 0; t < 50; t++) {
                a = rng.int(2, 5); m = rng.int(1, 4); b = rng.int(1, 6); s1 = rng.next() < 0.5 ? 1 : -1; s2 = rng.next() < 0.5 ? 1 : -1;
                c = a - s1 * m + s2 * b;
                if (Math.abs(c) >= 2) break;
                a = 4; m = 2; b = 3; s1 = 1; s2 = 1; c = 5;
              }
              expr = `√${a * a * k} ${s1 > 0 ? '−' : '+'} ${m * k}/√${k} ${s2 > 0 ? '+' : '−'} ${b === 1 ? '' : b}√${k}`;
              const wrong = a - s1 * m * k + s2 * b; // 분모를 유리화하지 않고 분자를 그대로 계수로
              cands = [wrong, a + s1 * m + s2 * b, a - s1 * m - s2 * b, -c];
              steps = [
                `√${a * a * k} = √(${a}² × ${k}) = ${a}√${k} 입니다.`,
                `${m * k}/√${k} = ${m * k}√${k}/${k} = ${rt(m)} 입니다.`,
                `따라서 ${a}√${k} ${s1 > 0 ? '−' : '+'} ${rt(m)} ${s2 > 0 ? '+' : '−'} ${rt(b)} = ${rt(c)} 입니다.`
              ];
            } else {
              const a = rng.int(2, 5);
              let b = rng.int(2, 5);
              const plus = rng.next() < 0.6;
              if (b === a) b = a === 5 ? 2 : a + 1;
              if (!plus && Math.abs(a - b) < 2) b = a >= 4 ? a - 2 : a + 2;
              c = plus ? a + b : a - b;
              expr = `√${a * a * k} ${plus ? '+' : '−'} √${b * b * k}`;
              cands = [plus ? a - b : a + b, a * b, -c];
              steps = [`√${a * a * k} = ${a}√${k}, √${b * b * k} = ${b}√${k} 입니다.`, `(${a} ${plus ? '+' : '−'} ${b})√${k} = ${rt(c)} 입니다.`];
            }
            const correct = rt(c);
            const distractors = [...new Set(cands.filter(x => Math.abs(x) >= 2 && x !== c))].map(x => rt(x))
              .concat([rt(c, k === 2 ? 3 : 2), rt(c + 1), rt(c + 2)]); // 근호 안 착오, 계수 착오
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
            return {
              question: `다음 식을 계산하면?  [ ${expr} ]`,
              variablesInfo: { 근호안: k, 식: expr },
              options,
              answerIndex,
              hint: '근호 안을 가장 작은 자연수로 만든 다음, 근호 안의 수가 같은 것끼리 계수를 계산하세요.',
              steps
            };
          }
        },
        {
          id: 'MID-31',
          dayIndex: 30,
          unit: '중2 · 일차함수와 연립일차방정식',
          standardCode: '[9수02-18]',
          standardName: '두 일차함수의 그래프와 연립일차방정식의 관계를 설명할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (두 그래프의 교점과 연립방정식의 해)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '기울기 1과 −1인 두 직선의 교점', normal: '일반적인 두 일차함수 그래프의 교점', hard: '교점의 x좌표로 미지의 y절편 k 구하기' },
          conceptSummary: '두 일차함수의 그래프의 교점의 좌표는 두 식을 연립한 연립일차방정식의 해와 같습니다.',
          formula: 'y = ax + b, y = cx + d의 교점: ax + b = cx + d를 푼 x와 그때의 y',
          generate(rng, { tier } = {}) {
            const S = n => (n < 0 ? `−${-n}` : `${n}`);
            const lin = (p, c) => `${signedTerm(p, 'x', true)}${signedTerm(c, '')}`;
            const nz = (lo, hi) => rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
            const pt = (x, y) => `(${S(x)}, ${S(y)})`;
            if (tier === 'hard') {
              const a = nz(1, 4);
              let c = nz(1, 4);
              if (c === a) c = -a;
              const b = nz(1, 8), x0 = nz(1, 5);
              const y0 = a * x0 + b, k = y0 - c * x0;
              const cands = [y0, y0 + c * x0, (a + c) * x0 + b, -k, k + 1].filter(x => x !== k);
              const { options, answerIndex } = buildChoiceSet(rng, S(k), [...new Set(cands)].map(S).concat([S(k + 2), S(k - 2)]));
              return {
                question: `두 일차함수 y = ${lin(a, b)}, y = ${signedTerm(c, 'x', true)} + k의 그래프의 교점의 x좌표가 ${S(x0)}일 때, 상수 k의 값은?`,
                variablesInfo: { 직선1: `y = ${lin(a, b)}`, 직선2기울기: c, 교점x: x0 },
                options,
                answerIndex,
                hint: '교점은 두 그래프 위에 모두 있습니다. 먼저 첫 번째 식에서 교점의 y좌표를 구하세요.',
                steps: [
                  `x = ${S(x0)}을 y = ${lin(a, b)}에 대입하면 y = ${S(y0)}, 교점은 ${pt(x0, y0)} 입니다.`,
                  `이 점이 y = ${signedTerm(c, 'x', true)} + k 위에 있으므로 ${S(y0)} = ${S(c)} × (${S(x0)}) + k 입니다.`,
                  `따라서 k = ${S(y0)} − (${S(c * x0)}) = ${S(k)} 입니다.`
                ]
              };
            }
            let a, c;
            const x0 = tier === 'easy' ? rng.int(1, 5) : nz(1, 5);
            const y0 = tier === 'easy' ? rng.int(1, 8) : nz(1, 9);
            if (tier === 'easy') { a = 1; c = -1; } else { a = nz(1, 4); c = nz(1, 4); if (c === a) c = -a; }
            const b = y0 - a * x0, d = y0 - c * x0;
            const correct = pt(x0, y0);
            const distractors = [pt(y0, x0), pt(-x0, y0), pt(x0, -y0), pt(x0 + 1, y0 + a), pt(x0, y0 + 1)];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
            return {
              question: `두 일차함수 y = ${lin(a, b)}, y = ${lin(c, d)}의 그래프의 교점의 좌표는?`,
              variablesInfo: { 직선1: `y = ${lin(a, b)}`, 직선2: `y = ${lin(c, d)}` },
              options,
              answerIndex,
              hint: '두 식의 y가 같아지는 x를 구하세요. 즉 연립방정식의 해가 교점입니다.',
              steps: [
                `${lin(a, b)} = ${lin(c, d)} 에서 ${S(a - c)}x = ${S(d - b)} 이므로 x = ${S(x0)} 입니다.`,
                `x = ${S(x0)}을 y = ${lin(a, b)}에 대입하면 y = ${S(y0)} 입니다.`,
                `따라서 교점의 좌표는 ${correct} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-32',
          dayIndex: 31,
          unit: '중2 · 삼각형의 외심과 내심',
          standardCode: '[9수03-10]',
          standardName: '삼각형의 외심과 내심의 성질을 이해하고 정당화할 수 있다.',
          sourceRef: '중학교 수학 2 교과서 (삼각형의 외심·내심과 각의 크기)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '외심: ∠BOC = 2∠A', normal: '내심: ∠BIC = 90° + ∠A/2', hard: '내심 조건으로 ∠A를 구한 뒤 외심의 ∠BOC' },
          conceptSummary: '외심 O는 세 꼭짓점에서 같은 거리에 있어 ∠BOC = 2∠A (∠A가 예각)이고, 내심 I는 세 내각의 이등분선의 교점이라 ∠BIC = 90° + (1/2)∠A 입니다.',
          formula: '외심: ∠BOC = 2∠A,  내심: ∠BIC = 90° + ∠A/2',
          generate(rng, { tier } = {}) {
            const dg = x => `${x}°`;
            let question, ans, cands, steps;
            if (tier === 'easy') {
              const A = 2 * rng.int(15, 44);
              ans = 2 * A;
              question = `삼각형 ABC의 외심을 O라 하자. ∠A = ${A}°일 때, ∠BOC의 크기는? (단, ∠A는 예각)`;
              cands = [A, 180 - A, A / 2, 90 + A / 2, 180 - 2 * A];
              steps = [`외심 O는 삼각형의 외접원의 중심이고, ∠BAC는 호 BC에 대한 원주각, ∠BOC는 중심각입니다.`, `따라서 ∠BOC = 2∠A = 2 × ${A}° = ${ans}° 입니다.`];
            } else if (tier === 'hard') {
              const t = rng.int(100, 134);
              const A = 2 * (t - 90);
              ans = 2 * A;
              question = `삼각형 ABC의 내심을 I, 외심을 O라 하자. ∠BIC = ${t}°일 때, ∠BOC의 크기는? (단, ∠A는 예각)`;
              cands = [A, t, 180 - A, 360 - 2 * t];
              steps = [
                `내심의 성질에서 ∠BIC = 90° + (1/2)∠A 이므로 ${t}° = 90° + (1/2)∠A, ∠A = ${A}° 입니다.`,
                `외심의 성질에서 ∠BOC = 2∠A = 2 × ${A}° = ${ans}° 입니다.`
              ];
            } else {
              const A = 2 * rng.int(15, 50);
              ans = 90 + A / 2;
              question = `삼각형 ABC의 내심을 I라 하자. ∠A = ${A}°일 때, ∠BIC의 크기는?`;
              cands = [2 * A, 90 - A / 2, 180 - A, 90 + A];
              steps = [
                `∠B + ∠C = 180° − ${A}° = ${180 - A}° 이고, 내심은 각의 이등분선의 교점이므로 ∠IBC + ∠ICB = ${(180 - A) / 2}° 입니다.`,
                `따라서 ∠BIC = 180° − ${(180 - A) / 2}° = ${ans}° 입니다.`
              ];
            }
            const distractors = [...new Set(cands.filter(x => Number.isInteger(x) && x > 0 && x < 360 && x !== ans))].map(dg);
            const { options, answerIndex } = buildChoiceSet(rng, dg(ans), distractors.concat([dg(ans + 10), dg(ans - 10)]));
            return {
              question,
              variablesInfo: { 중심: tier === 'easy' ? '외심' : tier === 'hard' ? '내심·외심' : '내심' },
              options,
              answerIndex,
              hint: '외심은 수직이등분선의 교점(꼭짓점까지 거리 같음), 내심은 각의 이등분선의 교점(변까지 거리 같음)입니다.',
              steps
            };
          }
        },
        {
          id: 'MID-33',
          dayIndex: 32,
          unit: '중3 · 분산과 표준편차',
          standardCode: '[9수04-07]',
          standardName: '분산과 표준편차를 구하고 자료의 분포를 설명할 수 있다.',
          sourceRef: '중학교 수학 3 교과서 (산포도 - 편차, 분산, 표준편차)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '편차가 주어졌을 때 분산', normal: '자료에서 평균·편차를 구한 뒤 분산', hard: '평균 조건으로 미지의 값 x를 구한 뒤 분산' },
          conceptSummary: '편차는 (자료) − (평균)이고, 편차의 합은 항상 0입니다. 분산은 편차의 제곱의 평균이고, 표준편차는 분산의 음이 아닌 제곱근입니다.',
          formula: '분산 = (편차)²의 합 ÷ (자료의 개수),  표준편차 = √분산',
          generate(rng, { tier } = {}) {
            const S = n => (n < 0 ? `−${-n}` : `${n}`);
            const dec = x => S(Math.round(x * 100) / 100);
            const n = tier === 'hard' ? rng.pick([4, 5]) : 5;
            let dev = [];
            for (let t = 0; t < 100; t++) {
              dev = Array.from({ length: n - 1 }, () => rng.int(-4, 4));
              const last = -dev.reduce((x, y) => x + y, 0);
              if (Math.abs(last) <= 5 && dev.concat([last]).some(x => x !== 0)) { dev.push(last); break; }
              dev = [-2, 0, 3, -1, 0].slice(0, n);
              if (n === 4) dev = [-2, 3, 1, -2];
            }
            const ss = dev.reduce((x, y) => x + y * y, 0);
            const ans = ss / n;
            const m = rng.int(5, 15);
            const data = dev.map(d => m + d);
            let question, cands, steps;
            if (tier === 'easy') {
              question = `어떤 자료의 편차가 다음과 같을 때, 분산은?  [ ${dev.map(S).join(', ')} ]`;
              cands = [ss, dev.reduce((x, y) => x + Math.abs(y), 0) / n, ss / (n - 1)];
              steps = [`편차의 제곱의 합은 ${dev.map(d => `(${S(d)})²`).join(' + ')} = ${ss} 입니다.`, `분산은 ${ss} ÷ ${n} = ${dec(ans)} 입니다.`];
            } else if (tier === 'hard') {
              const idx = rng.int(0, n - 1);
              const shown = data.map((x, i) => (i === idx ? 'x' : String(x)));
              const others = data.filter((_, i) => i !== idx);
              const mu2 = others.reduce((x, y) => x + y, 0) / others.length;
              const varOthers = others.reduce((x, y) => x + (y - mu2) * (y - mu2), 0) / others.length;
              question = `다음 자료의 평균이 ${m}일 때, 분산은?  [ ${shown.join(', ')} ]`;
              cands = [ss, varOthers, ss / (n - 1), data[idx]];
              steps = [
                `평균이 ${m}이므로 (자료의 합) = ${m} × ${n} = ${m * n}, x = ${m * n} − ${others.reduce((x, y) => x + y, 0)} = ${data[idx]} 입니다.`,
                `편차는 ${dev.map(S).join(', ')} 이고, 편차의 제곱의 합은 ${ss} 입니다.`,
                `분산은 ${ss} ÷ ${n} = ${dec(ans)} 입니다.`
              ];
            } else {
              question = `다음 자료의 분산은?  [ ${data.join(', ')} ]`;
              cands = [ss, m, ss / (n - 1), dev.reduce((x, y) => x + Math.abs(y), 0) / n];
              steps = [
                `평균은 (${data.join(' + ')}) ÷ ${n} = ${m} 입니다.`,
                `편차는 ${dev.map(S).join(', ')} 이고, 편차의 제곱의 합은 ${ss} 입니다.`,
                `분산은 ${ss} ÷ ${n} = ${dec(ans)} 입니다.`
              ];
            }
            const correct = dec(ans);
            const two = x => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9; // 소수 둘째 자리까지 깔끔한 값만
            const distractors = [...new Set(cands.filter(x => Number.isFinite(x) && x >= 0 && two(x)).map(dec))].filter(x => x !== correct);
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors.concat([dec(ans + 1), dec(ans + 2)]));
            return {
              question,
              variablesInfo: { 자료수: n, 자료: tier === 'easy' ? '편차로 주어짐' : '지문 참조' },
              options,
              answerIndex,
              hint: '분산은 편차를 제곱해서 평균을 낸 값입니다. 자료의 개수로 나누는 것을 잊지 마세요.',
              steps
            };
          }
        },
        {
          id: 'MID-34',
          dayIndex: 33,
          unit: '중3 · 이차방정식',
          standardCode: '[9수02-20]',
          standardName: '이차방정식을 풀 수 있고, 이를 활용하여 문제를 해결할 수 있다.',
          sourceRef: '중학교 수학 3 교과서 (인수분해와 근의 공식을 이용한 이차방정식의 풀이)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '(x − a)(x − b) = 0 꼴', normal: '인수분해해서 푸는 x² + px + q = 0', hard: '근의 공식(짝수 공식)으로 무리수 근' },
          conceptSummary: 'AB = 0이면 A = 0 또는 B = 0입니다. 인수분해가 되지 않으면 근의 공식 x = (−b ± √(b² − 4ac))/2a, 일차항 계수가 짝수(b = 2b′)이면 x = −b′ ± √(b′² − c) (a = 1)를 씁니다.',
          formula: '(x − α)(x − β) = 0 ⇒ x = α 또는 x = β,  x² + 2b′x + c = 0 ⇒ x = −b′ ± √(b′² − c)',
          generate(rng, { tier } = {}) {
            const S = n => (n < 0 ? `−${-n}` : `${n}`);
            const nz = (lo, hi) => rng.int(lo, hi) * (rng.next() < 0.5 ? -1 : 1);
            const fac = r => (r > 0 ? `(x − ${r})` : `(x + ${-r})`);
            if (tier === 'hard') {
              const p = nz(1, 6), r = rng.pick([2, 3, 5, 6, 7, 10, 11, 13]);
              const b = -2 * p, c = p * p - r;
              const poly = `x²${signedTerm(b, 'x')}${signedTerm(c, '')}`;
              const correct = `x = ${S(p)} ± √${r}`;
              const distractors = [`x = ${S(-p)} ± √${r}`, `x = ${S(p)} ± √${4 * r}`, `x = ${S(p)} ± ${r}`, `x = ${S(2 * p)} ± √${r}`];
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `이차방정식 ${poly} = 0 의 해는?`,
                variablesInfo: { 일차항계수: b, 상수항: c },
                options,
                answerIndex,
                hint: '일차항의 계수가 짝수이면 짝수 공식 x = −b′ ± √(b′² − ac)를 쓰면 계산이 간단합니다.',
                steps: [
                  `x² ${b < 0 ? '−' : '+'} 2 × ${Math.abs(p)}x ${c < 0 ? '−' : '+'} ${Math.abs(c)} = 0 에서 b′ = ${S(-p)} 입니다.`,
                  `x = −(${S(-p)}) ± √((${S(-p)})² − (${S(c)})) = ${S(p)} ± √${r} 입니다.`
                ]
              };
            }
            let r1, r2;
            for (let t = 0; t < 50; t++) {
              r1 = nz(1, tier === 'easy' ? 7 : 9); r2 = nz(1, tier === 'easy' ? 7 : 9);
              if (Math.abs(r1) !== Math.abs(r2) && (tier === 'easy' || r1 + r2 !== 0)) break;
              r1 = 3; r2 = -5;
            }
            const sol = (x, y) => `x = ${S(x)} 또는 x = ${S(y)}`;
            const lhs = tier === 'easy' ? `${fac(r1)}${fac(r2)}` : `x²${signedTerm(-(r1 + r2), 'x')}${signedTerm(r1 * r2, '')}`;
            const correct = sol(r1, r2);
            const distractors = [sol(-r1, -r2), sol(r1, -r2), sol(-r1, r2)];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
            const steps = tier === 'easy'
              ? [`AB = 0이면 A = 0 또는 B = 0 입니다.`, `${fac(r1).slice(1, -1)} = 0 또는 ${fac(r2).slice(1, -1)} = 0 이므로 ${correct} 입니다.`]
              : [`곱이 ${S(r1 * r2)}, 합이 ${S(-(r1 + r2))}인 두 정수는 ${S(-r1)}, ${S(-r2)} 입니다.`, `인수분해하면 ${fac(r1)}${fac(r2)} = 0 입니다.`, `따라서 ${correct} 입니다.`];
            return {
              question: `이차방정식 ${lhs} = 0 의 해는?`,
              variablesInfo: { 식: `${lhs} = 0` },
              options,
              answerIndex,
              hint: '(x − a) = 0 이면 x = a 입니다. 괄호 안의 부호와 해의 부호가 반대라는 점에 주의하세요.',
              steps
            };
          }
        },
        {
          id: 'MID-35',
          dayIndex: 34,
          unit: '중3 · 원주각의 성질',
          standardCode: '[9수03-19]',
          standardName: '원주각의 성질을 이해하고 정당화할 수 있다.',
          sourceRef: '중학교 수학 3 교과서 (원주각과 중심각의 관계)',
          difficulty: '★★☆ 표준',
          tierGuide: { easy: '중심각으로 원주각 구하기', normal: '지름에 대한 원주각(90°) 활용', hard: '이등변삼각형 OAB와 짧은 호 위의 원주각' },
          conceptSummary: '한 호에 대한 원주각의 크기는 그 호에 대한 중심각의 크기의 1/2입니다. 반원(지름)에 대한 원주각은 90°입니다.',
          formula: '(원주각) = (1/2) × (중심각),  지름에 대한 원주각 = 90°',
          generate(rng, { tier } = {}) {
            const dg = x => `${x}°`;
            let question, ans, cands, steps;
            if (tier === 'easy') {
              const th = 2 * rng.int(20, 85);
              ans = th / 2;
              question = `원 O에서 호 AB에 대한 중심각 ∠AOB의 크기가 ${th}°일 때, 호 AB에 대한 원주각 ∠APB의 크기는?`;
              cands = [th, 2 * th, 180 - th / 2, 180 - th];
              steps = [`원주각의 크기는 같은 호에 대한 중심각의 크기의 1/2입니다.`, `∠APB = (1/2) × ${th}° = ${ans}° 입니다.`];
            } else if (tier === 'hard') {
              const x = rng.int(15, 70);
              ans = 90 + x;
              question = `원 O 위의 두 점 A, B에 대하여 ∠OAB = ${x}°이다. 점 P가 두 호 AB 중 짧은 호 위의 점일 때, ∠APB의 크기는?`;
              cands = [90 - x, 180 - 2 * x, 2 * x, 180 - x];
              steps = [
                `OA = OB(반지름)이므로 △OAB는 이등변삼각형이고 ∠AOB = 180° − 2 × ${x}° = ${180 - 2 * x}° 입니다.`,
                `점 P가 짧은 호 위에 있으므로 ∠APB는 긴 호 AB에 대한 원주각이고, 그 중심각은 360° − ${180 - 2 * x}° = ${180 + 2 * x}° 입니다.`,
                `따라서 ∠APB = (1/2) × ${180 + 2 * x}° = ${ans}° 입니다.`
              ];
            } else {
              const x = rng.int(20, 70);
              ans = 90 - x;
              question = `선분 AB가 원 O의 지름이고 점 C는 원 위의 점이다. ∠CAB = ${x}°이면 ∠ABC의 크기는?`;
              cands = [x, 180 - 2 * x, 90 + x, 2 * x, 180 - x];
              steps = [`지름 AB에 대한 원주각이므로 ∠ACB = 90° 입니다.`, `삼각형 ABC에서 ∠ABC = 180° − 90° − ${x}° = ${ans}° 입니다.`];
            }
            const distractors = [...new Set(cands.filter(x => Number.isInteger(x) && x > 0 && x < 360 && x !== ans))].map(dg);
            const { options, answerIndex } = buildChoiceSet(rng, dg(ans), distractors.concat([dg(ans + 10), dg(ans + 20)]));
            return {
              question,
              variablesInfo: { 유형: tier === 'easy' ? '중심각' : tier === 'hard' ? '이등변삼각형' : '지름' },
              options,
              answerIndex,
              hint: '원주각은 같은 호에 대한 중심각의 절반입니다. 지름에 대한 원주각은 항상 90°입니다.',
              steps
            };
          }
        }
      ]
    },

    // =========================================================================
    // [3] 고등 수학 (공통수학1·2, 대수, 미적분Ⅰ, 확률과 통계 35개 대표 유형)
    // =========================================================================
    high: {
      id: 'high',
      level: '고등 수학',
      targetGrade: '공통수학·대수·미적분Ⅰ·확률과 통계',
      title: '방정식·함수·도형의 방정식·수열·미적분·확률',
      desc: '다항식의 연산과 인수분해, 방정식과 부등식, 순열과 행렬, 도형의 방정식과 함수, 지수·로그·삼각함수와 수열, 극한·미분·적분, 조건부확률까지 수능·내신의 필수 35개 핵심 유형을 정복해 보자.',
      miniTitle: '구조적 해석과 논리적 추론',
      miniDesc: '식을 일일이 계산하지 않고도 대칭성, 계수의 관계, 그래프의 개형, 미분계수의 기하학적 성질을 통해 조건의 필요충분성을 추론하는 것이 고등 수학의 진수야.',
      formula: 'D = b² − 4ac,  (x − a)² + (y − b)² = r²,  f\'(a) = lim [f(x)−f(a)]/(x−a)',
      example: '예: x² − 4x + k = 0이 서로 다른 두 실근을 가질 조건은 D/4 = 4 − k > 0, 즉 k < 4.',
      templates: [
        {
          id: 'HIG-01',
          dayIndex: 0,
          unit: '공통수학1 · 나머지정리',
          standardCode: '[10공수1-01-02]',
          standardName: '항등식의 성질과 나머지정리를 이해하고, 이를 활용하여 문제를 해결할 수 있다.',
          sourceRef: '고1 전국연합학력평가 3점 대표 유형 (나머지정리)',
          difficulty: '★★☆ 표준',
          conceptSummary: '다항식 P(x)를 일차식 (x − α)로 나누었을 때의 나머지 R은 R = P(α)와 같습니다.',
          formula: 'P(x) = (x − α)Q(x) + R  ⇒  R = P(α)',
          tierGuide: { easy: '이차식을 일차식으로 나눈 나머지', normal: '삼차식을 일차식으로 나눈 나머지', hard: '최고차항 계수가 1이 아닌 삼차식, 큰 음수 대입(조립제법 권장)' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const alpha = easy ? rng.pick([-2, -1, 1, 2, 3]) : rng.pick([-3, -2, 2, 3]);
              // easy: P(x) = x² + bx + c,  hard: P(x) = a x³ + b x² + d x + c
              const a3 = easy ? 0 : rng.pick([2, 3, -1, -2]);
              const b = easy ? (rng.int(-5, 5) || 2) : (rng.int(-5, 5) || -3);
              const d = easy ? 0 : (rng.int(-6, 6) || 4);
              const c = rng.int(-9, 9) || -5;
              const P = x => a3 * x * x * x + (easy ? x * x : b * x * x) + (easy ? b * x : d * x) + c;
              const lead = easy ? 'x²' : `${a3 === 1 ? '' : a3 === -1 ? '−' : a3 < 0 ? '−' + Math.abs(a3) : a3}x³`;
              const poly = easy ? `${lead} ${signedTerm(b, 'x')} ${signedTerm(c, '')}` : `${lead} ${signedTerm(b, 'x²')} ${signedTerm(d, 'x')} ${signedTerm(c, '')}`;
              const divStr = alpha > 0 ? `x − ${alpha}` : `x + ${Math.abs(alpha)}`;
              const val = P(alpha);
              const distractors = [`${P(-alpha)}`, `${P(1)}`, `${c}`, `${val + (easy ? 2 * alpha : 2 * a3 * alpha * alpha * alpha)}`, `${val - 2 * c}`];
              const { options, answerIndex } = buildChoiceSet(rng, `${val}`, distractors);
              const pa = alpha < 0 ? `(${alpha})` : `${alpha}`;
              return {
                question: `다항식 P(x) = ${wj(poly, '을/를')} 일차식 (${divStr})${jo(divStr, '으로/로')} 나누었을 때의 나머지는?`,
                variablesInfo: { 다항식: `P(x) = ${poly}`, 나누는식: divStr, 대입값: alpha },
                options,
                answerIndex,
                hint: `나머지정리: (${divStr})${jo(divStr, '으로/로')} 나눈 나머지는 P(${alpha < 0 ? '−' + Math.abs(alpha) : alpha})입니다.${easy ? '' : ' 대입이 번거로우면 조립제법으로 계산하세요.'}`,
                steps: [
                  `${divStr} = 0이 되는 x의 값은 x = ${alpha < 0 ? '−' + Math.abs(alpha) : alpha}이므로 나머지는 P(${alpha < 0 ? '−' + Math.abs(alpha) : alpha})입니다.`,
                  easy
                    ? `P(${alpha < 0 ? '−' + Math.abs(alpha) : alpha}) = ${pa}² + (${b})×${pa} + (${c}) = ${val}입니다.`
                    : `P(${alpha < 0 ? '−' + Math.abs(alpha) : alpha}) = (${a3})×${pa}³ + (${b})×${pa}² + (${d})×${pa} + (${c}) = ${val}입니다.`
                ]
              };
            }
            const alpha = rng.pick([-2, -1, 1, 2, 3]);
            const a = rng.pick([1, 2]);
            const b = rng.int(-4, 4) || 1;
            const c = rng.int(-5, 5);
            const val = a * Math.pow(alpha, 3) + b * Math.pow(alpha, 2) + c;

            const poly = `${a === 1 ? '' : a}x³ ${signedTerm(b, 'x²')} ${signedTerm(c, '')}`;
            const divStr = alpha > 0 ? `x − ${alpha}` : `x + ${Math.abs(alpha)}`;

            const correct = `${val}`;
            const valWrongSign = a * Math.pow(-alpha, 3) + b * Math.pow(-alpha, 2) + c;
            const distractors = [
              `${valWrongSign !== val ? valWrongSign : val + 4}`,
              `${val - 2 * c || val - 3}`,
              `${a + b + c}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `다항식 P(x) = ${wj(poly, '을/를')} 일차식 (${divStr})${jo(divStr, '으로/로')} 나누었을 때의 나머지는?`,
              variablesInfo: { 다항식: `P(x) = ${poly}`, 나누는식: divStr, 대입값: alpha },
              options,
              answerIndex,
              hint: `나머지정리에 의해 다항식 P(x)를 (${divStr})${jo(divStr, '으로/로')} 나눈 나머지는 P(${alpha})의 값과 같습니다.`,
              steps: [
                `나누는 일차식 ${divStr} = 0이 되는 x의 값은 x = ${alpha}입니다.`,
                `나머지정리에 의해 구하는 나머지는 P(${alpha})입니다.`,
                `P(${alpha}) = ${a}×(${alpha})³ + (${b})×(${alpha})² + (${c}) = ${val}입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-02',
          dayIndex: 1,
          unit: '공통수학1 · 이차방정식의 판별식',
          standardCode: '[10공수1-02-02]',
          standardName: '이차방정식의 실근과 허근을 이해하고, 판별식을 이용하여 이차방정식의 근을 판별할 수 있다.',
          sourceRef: '공통수학1 교과서 및 학력평가 빈출 유형 (판별식과 정수 k의 최댓값)',
          difficulty: '★★☆ 표준',
          conceptSummary: '이차방정식 x² + 2b\'x + c = 0이 서로 다른 두 실근을 가지려면 짝수 판별식 D/4 = (b\')² − ac > 0이어야 합니다.',
          formula: '서로 다른 두 실근 조건: D/4 = (b\')² − ac > 0',
          tierGuide: { easy: 'x의 계수가 작은 짝수, 짝수 판별식 D/4', normal: 'x의 계수가 짝수, 상수항에 k와 다른 수가 섞임', hard: 'x의 계수가 홀수라 D = b² − 4ac를 그대로 써야 하고 경계가 정수가 아님' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const b = easy ? 2 * rng.pick([-4, -3, -2, -1, 1, 2, 3, 4]) : rng.pick([-7, -5, -3, -1, 1, 3, 5, 7]);
              const shift = easy ? rng.pick([0, 1, -1]) : rng.int(-5, 5);
              const bound = (b * b) / 4 - shift; // k < bound
              const maxIntK = Number.isInteger(bound) ? bound - 1 : Math.floor(bound);
              const bStr = signedTerm(b, 'x');
              const constStr = shift === 0 ? '+ k' : (shift > 0 ? `+ k + ${shift}` : `+ k − ${Math.abs(shift)}`);
              const kq = shift === 0 ? 'k' : `k ${shift > 0 ? '+ ' + shift : '− ' + Math.abs(shift)}`;
              const correct = `${maxIntK} (조건: k < ${bound})`;
              const distractors = easy
                ? [`${bound} (조건: k ≤ ${bound})`, `${bound + 1} (조건: k > ${bound})`, `${b * b - shift - 1} (조건: k < ${b * b - shift})`]
                : [`${Math.ceil(bound)} (조건: k ≤ ${bound})`, `${b * b - shift - 1} (조건: k < ${b * b - shift})`, `${maxIntK + 1} (조건: k > ${bound})`, `${Math.floor((b * b) / 2 - shift)} (조건: k < ${(b * b) / 2 - shift})`];
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `x에 대한 이차방정식 x² ${bStr} ${constStr} = 0 이 서로 다른 두 실근을 갖도록 하는 실수 k의 값의 범위와, 이를 만족시키는 가장 큰 정수 k의 값은?`,
                variablesInfo: { 일차항계수: b, 상수항: `k + (${shift})`, 경계값: bound },
                options,
                answerIndex,
                hint: easy
                  ? `x의 계수가 짝수이므로 짝수 판별식 D/4 = (${b / 2})² − (${kq}) > 0을 풀어 보세요. 등호는 제외!`
                  : `x의 계수 ${b}${jo(String(b), '이/가')} 홀수라 짝수 판별식을 쓸 수 없어요. D = (${b})² − 4(${kq}) > 0을 풀고, 경계가 정수가 아님에 주의하세요.`,
                steps: easy
                  ? [
                    `서로 다른 두 실근 ⇔ D > 0이고, x의 계수가 짝수이므로 D/4 = (${b / 2})² − (${kq}) > 0입니다.`,
                    `${(b * b) / 4} − k${shift === 0 ? '' : shift > 0 ? ' − ' + shift : ' + ' + Math.abs(shift)} > 0을 정리하면 k < ${bound}이므로, 가장 큰 정수 k는 ${maxIntK}입니다.`
                  ]
                  : [
                    `서로 다른 두 실근 ⇔ D = (${b})² − 4(${kq}) > 0입니다.`,
                    `${b * b} − 4k${shift === 0 ? '' : shift > 0 ? ' − ' + 4 * shift : ' + ' + 4 * Math.abs(shift)} > 0이므로 k < ${b * b}/4${shift === 0 ? '' : shift > 0 ? ' − ' + shift : ' + ' + Math.abs(shift)} = ${bound}입니다.`,
                    `${bound}보다 작은 가장 큰 정수 k는 ${maxIntK}입니다.`
                  ]
              };
            }
            const halfB = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5]);
            const b = 2 * halfB;
            const shift = rng.int(-3, 5);
            const bound = halfB * halfB - shift;
            const maxIntK = bound - 1;

            const bStr = signedTerm(b, 'x');
            const constStr = shift === 0 ? '+ k' : (shift > 0 ? `+ k + ${shift}` : `+ k − ${Math.abs(shift)}`);

            const correct = `${maxIntK} (조건: k < ${bound})`;
            const distractors = [
              `${bound} (조건: k ≤ ${bound})`,
              `${bound + 1} (조건: k > ${bound})`,
              `${4 * halfB * halfB - shift - 1} (조건: k < ${4 * halfB * halfB - shift})`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `x에 대한 이차방정식 x² ${bStr} ${constStr} = 0 이 서로 다른 두 실근을 갖도록 하는 실수 k의 값의 범위와, 이를 만족시키는 가장 큰 정수 k의 값은?`,
              variablesInfo: { 일차항계수: b, 상수항: `k + (${shift})`, 경계값: bound },
              options,
              answerIndex,
              hint: `'서로 다른 두 실근'이므로 판별식 D > 0 (등호 제외!)이어야 합니다. 짝수 판별식 D/4 = (${halfB})² − (k ${shift >= 0 ? '+ ' + shift : '− ' + Math.abs(shift)}) > 0을 풀어 보세요.`,
              steps: [
                `이차방정식이 서로 다른 두 실근을 가지려면 판별식 D > 0이어야 합니다.`,
                `짝수 판별식을 적용하면 D/4 = (${halfB})² − 1×(k ${shift >= 0 ? '+ ' + shift : '− ' + Math.abs(shift)}) > 0 입니다.`,
                `${halfB * halfB} − k ${shift >= 0 ? '− ' + shift : '+ ' + Math.abs(shift)} > 0 에서 k < ${bound} 이므로, 가장 큰 정수 k의 값은 ${maxIntK}입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-03',
          dayIndex: 2,
          unit: '공통수학1 · 근과 계수의 관계',
          standardCode: '[10공수1-02-03]',
          standardName: '이차방정식의 근과 계수의 관계를 설명할 수 있다.',
          sourceRef: '공통수학1 교과서 (근과 계수의 관계와 곱셈 공식의 변형)',
          difficulty: '★★☆ 표준',
          conceptSummary: '이차방정식 ax² + bx + c = 0의 두 근을 α, β라 하면 α + β = −b/a, αβ = c/a이며, α² + β² = (α + β)² − 2αβ로 구합니다.',
          formula: 'α + β = −b/a,  αβ = c/a  ⇒  α² + β² = (α + β)² − 2αβ',
          tierGuide: { easy: '작은 정수 계수에서 α² + β²', normal: '교과서 수준 계수에서 α² + β²', hard: '큰 수·음수 곱에서 α² + β² (부호 실수 주의)' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const sum = easy ? rng.pick([-4, -3, -2, -1, 1, 2, 3, 4]) : rng.pick([-9, -8, -7, -6, -5, 5, 6, 7, 8, 9]);
              const prod = easy ? rng.pick([-3, -2, -1, 1, 2, 3]) : rng.pick([-12, -10, -8, -6, -4, 4, 6, 8, 10, 12]);
              const sqSum = sum * sum - 2 * prod;
              const eqStr = `x² ${signedTerm(-sum, 'x')} ${signedTerm(prod, '')} = 0`;
              const distractors = [`${sum * sum + 2 * prod}`, `${sum * sum - prod}`, `${-sum + prod}`, `${sum * sum}`];
              const { options, answerIndex } = buildChoiceSet(rng, `${sqSum}`, distractors);
              return {
                question: `이차방정식 ${eqStr} 의 두 근을 α, β라 할 때, α² + β² 의 값은?`,
                variablesInfo: { 두근의합: sum, 두근의곱: prod, 제곱합: sqSum },
                options,
                answerIndex,
                hint: `α + β = −(x의 계수), αβ = (상수항)입니다. 그다음 α² + β² = (α + β)² − 2αβ를 쓰세요.${easy ? '' : ' 음수의 제곱과 −2×(음수)의 부호에 주의!'}`,
                steps: [
                  `근과 계수의 관계에 의해 α + β = ${sum < 0 ? '−' + Math.abs(sum) : sum}, αβ = ${prod < 0 ? '−' + Math.abs(prod) : prod}입니다.`,
                  `α² + β² = (α + β)² − 2αβ = (${sum})² − 2×(${prod}) = ${sqSum}입니다.`
                ]
              };
            }
            const sum = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5, 6]);
            const prod = rng.pick([-6, -4, -3, -2, -1, 2, 3, 5]);
            const b = -sum;
            const c = prod;
            const sqSum = sum * sum - 2 * prod;

            const eqStr = `x² ${signedTerm(b, 'x')} ${signedTerm(c, '')} = 0`;
            const correct = `${sqSum}`;
            const distractors = [
              `${sum * sum + 2 * prod}`,
              `${sum * sum - prod}`,
              `${-sum + prod}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `이차방정식 ${eqStr} 의 두 근을 α, β라 할 때, α² + β² 의 값은?`,
              variablesInfo: { 두근의합: sum, 두근의곱: prod, 제곱합: sqSum },
              options,
              answerIndex,
              hint: `근과 계수의 관계로 α + β = ${sum}, αβ = ${wj(prod, '을/를')} 먼저 구한 뒤 곱셈 공식의 변형 α² + β² = (α + β)² − 2αβ에 대입하세요.`,
              steps: [
                `이차방정식의 근과 계수의 관계에 의해 두 근의 합 α + β = ${sum}이고, 두 근의 곱 αβ = ${c}입니다.`,
                `곱셈 공식의 변형에 의해 α² + β² = (α + β)² − 2αβ 입니다.`,
                `대입하여 계산하면 (${sum})² − 2×(${prod}) = ${sqSum}입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-04',
          dayIndex: 3,
          unit: '공통수학1 · 이차함수의 최대·최소',
          standardCode: '[10공수1-02-06]',
          standardName: '이차함수의 최대, 최소를 탐구하고, 이를 실생활과 연결하여 유용성을 인식할 수 있다.',
          sourceRef: '공통수학1 교과서 및 고1 학력평가 3점 유형',
          difficulty: '★★★ 실력',
          conceptSummary: '제한된 구간 [m, n]에서 이차함수의 최대·최소는 꼭짓점이 구간 내에 있는지 확인한 후 꼭짓점과 양 끝점의 함숫값을 비교합니다.',
          formula: 'f(x) = (x − p)² + q (구간 [m, n]에서 대칭축 x = p와의 거리 비교)',
          tierGuide: { easy: '꼭짓점이 구간 안, 최고차항 계수 1', normal: '꼭짓점이 구간 안, 구간 끝이 비대칭', hard: '위로 볼록(계수 −1)이거나 꼭짓점이 구간 밖(계수 2)' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              let a, p, q, left, right;
              if (tier === 'easy') {
                a = 1; p = rng.int(1, 3); q = rng.int(-3, 3); left = p - 2; right = p + 1;
              } else if (rng.next() < 0.5) {
                a = -1; p = rng.int(1, 3); q = rng.int(-3, 5); left = p - 1; right = p + 3;
              } else {
                a = 2; p = rng.int(0, 2); q = rng.int(-5, 4); left = p + 1; right = p + 3;
              }
              const f = x => a * (x - p) * (x - p) + q;
              const b = -2 * a * p, c = a * p * p + q;
              const inside = p > left && p < right;
              const vals = [f(left), f(right)].concat(inside ? [q] : []);
              const maxVal = Math.max(...vals), minVal = Math.min(...vals);
              const lead = a === 1 ? 'x²' : a === -1 ? '−x²' : `${a}x²`;
              const fStr = `f(x) = ${lead} ${signedTerm(b, 'x')} ${signedTerm(c, '')}`;
              const opt = (M, m) => `최댓값 ${M}, 최솟값 ${m} (합: ${M + m})`;
              const correct = opt(maxVal, minVal);
              // 최댓값 > 최솟값인 오답만(꼭짓점을 최솟값으로 착각, 반대쪽 끝을 최댓값으로 착각 등)
              const distractors = [[maxVal, q], [f(left), f(right)], [f(right), f(left)], [c, minVal], [maxVal, Math.min(f(left), f(right))], [maxVal + 1, minVal - 1], [maxVal + 2, minVal]]
                .filter(([M, m]) => M > m && !(M === maxVal && m === minVal)).map(([M, m]) => opt(M, m));
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              const form = `${a === 1 ? '' : a === -1 ? '−' : a}(x − ${p})² ${signedTerm(q, '')}`.replace('(x − 0)²', 'x²');
              const steps = [`f(x) = ${form}이므로 꼭짓점은 (${p}, ${q})이고 그래프는 ${a > 0 ? '아래로' : '위로'} 볼록입니다.`];
              if (inside) {
                steps.push(`꼭짓점의 x좌표 ${p}${jo(String(p), '이/가')} 구간 [${left}, ${right}] 안에 있으므로 ${a > 0 ? '최솟값' : '최댓값'}은 f(${p}) = ${q}입니다.`);
                steps.push(`대칭축 x = ${p}에서 더 먼 끝 x = ${Math.abs(left - p) > Math.abs(right - p) ? left : right}에서 ${a > 0 ? '최댓값' : '최솟값'} ${a > 0 ? maxVal : minVal}입니다.`);
              } else {
                steps.push(`꼭짓점의 x좌표 ${p}${jo(String(p), '이/가')} 구간 [${left}, ${right}] 밖(왼쪽)에 있으므로 구간에서 f(x)는 증가합니다.`);
                steps.push(`최솟값 f(${left}) = ${minVal}, 최댓값 f(${right}) = ${maxVal}입니다. (꼭짓점의 y좌표 ${q}${jo(String(q), '은/는')} 답이 아님)`);
              }
              return {
                question: `${left} ≤ x ≤ ${right} 에서 이차함수 ${fStr} 의 최댓값을 M, 최솟값을 m이라 할 때, M과 m의 값은?`,
                variablesInfo: { 구간: `[${left}, ${right}]`, 대칭축: `x = ${p}`, 최댓값M: maxVal, 최솟값m: minVal },
                figure: { type: 'parabola-interval', poly: { a, b, c }, lo: left, hi: right },
                options,
                answerIndex,
                hint: `완전제곱식으로 바꿔 꼭짓점이 구간 안에 있는지 먼저 확인하고, ${a > 0 ? '아래로' : '위로'} 볼록인지도 보세요.`,
                steps
              };
            }
            const p = rng.int(1, 4);
            const q = rng.int(-5, 4);
            const left = p - 1;
            const right = p + rng.int(2, 3);
            const b = -2 * p;
            const c = p * p + q;
            const minVal = q;
            const maxVal = Math.pow(right - p, 2) + q;

            const fStr = `f(x) = x² ${signedTerm(b, 'x')} ${signedTerm(c, '')}`;
            const correct = `최댓값 ${maxVal}, 최솟값 ${minVal} (합: ${maxVal + minVal})`;
            const fLeft = Math.pow(left - p, 2) + q;
            const distractors = [
              `최댓값 ${maxVal}, 최솟값 ${fLeft} (합: ${maxVal + fLeft})`,
              `최댓값 ${c}, 최솟값 ${minVal} (합: ${c + minVal})`,
              `최댓값 ${maxVal + 2}, 최솟값 ${minVal - 1} (합: ${maxVal + minVal + 1})`,
              // 예비 오답(앞의 오답이 겹칠 때만 쓰임 — 기존 출제 결과는 그대로)
              `최댓값 ${maxVal + 1}, 최솟값 ${minVal} (합: ${maxVal + 1 + minVal})`,
              `최댓값 ${maxVal}, 최솟값 ${minVal - 2} (합: ${maxVal + minVal - 2})`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `${left} ≤ x ≤ ${right} 에서 이차함수 ${fStr} 의 최댓값을 M, 최솟값을 m이라 할 때, M과 m의 값은?`,
              variablesInfo: { 구간: `[${left}, ${right}]`, 대칭축: `x = ${p}`, 최댓값M: maxVal, 최솟값m: minVal },
              figure: { type: 'parabola-interval', poly: { a: 1, b, c }, lo: left, hi: right },
              options,
              answerIndex,
              hint: `완전제곱식 f(x) = ${wj(`(x − ${p})² ${signedTerm(q, '')}`, '으로/로')} 바꾸어 꼭짓점(${p})이 주어진 구간 안에 있는지 확인하세요.`,
              steps: [
                `이차함수를 표준형으로 변형하면 f(x) = (x − ${p})² ${signedTerm(q, '')} 이므로 꼭짓점은 (${p}, ${q})입니다.`,
                `x = ${wj(p, '이/가')} 주어진 범위 ${left} ≤ x ≤ ${right} 안에 포함되므로 최솟값 m = f(${p}) = ${minVal}입니다.`,
                `대칭축에서 가장 먼 x = ${right}에서 최댓값 M = f(${right}) = ${wj(maxVal, '을/를')} 갖습니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-05',
          dayIndex: 4,
          unit: '공통수학1 · 조합',
          standardCode: '[10공수1-03-03]',
          standardName: '조합의 개념을 이해하고, 조합의 수를 구하는 방법을 설명할 수 있다.',
          sourceRef: '공통수학1 교과서 (특정한 조건이 있는 조합 nCr 활용)',
          difficulty: '★★☆ 표준',
          conceptSummary: '서로 다른 n명 중에서 순서에 상관없이 r명을 뽑는 경우의 수는 조합 nCr = n! / (r!(n−r)!) 로 계산합니다.',
          formula: 'nCr = n × (n−1) × … × (n−r+1) / r!',
          tierGuide: { easy: '두 학년에서 대표를 1명씩(곱의 법칙)', normal: '한 학년에서 2명, 다른 학년에서 2~3명', hard: '인원이 많고 두 학년 모두 2~3명씩 뽑기' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const C = (n, r) => { let v = 1; for (let i = 0; i < r; i++) v = (v * (n - i)) / (i + 1); return v; };
              const Pm = (n, r) => { let v = 1; for (let i = 0; i < r; i++) v *= n - i; return v; };
              const g1 = easy ? rng.int(3, 6) : rng.int(5, 8);
              const g2 = easy ? rng.int(3, 6) : rng.int(5, 8);
              const pick1 = easy ? 1 : rng.pick([2, 3]);
              const pick2 = easy ? 1 : (pick1 === 2 ? 3 : rng.pick([2, 3]));
              const ways1 = C(g1, pick1), ways2 = C(g2, pick2), totalWays = ways1 * ways2;
              const distractors = easy
                ? [`${g1 + g2}가지`, `${totalWays * 2}가지`, `${C(g1 + g2, 2)}가지`]
                : [`${ways1 + ways2}가지`, `${Pm(g1, pick1) * Pm(g2, pick2)}가지`, `${C(g1 + g2, pick1 + pick2)}가지`, `${totalWays * 2}가지`];
              const { options, answerIndex } = buildChoiceSet(rng, `${totalWays}가지`, distractors);
              return {
                question: `수학 동아리에서 1학년 학생 ${g1}명과 2학년 학생 ${g2}명 중에서 대회에 참가할 1학년 대표 ${pick1}명과 2학년 대표 ${pick2}명을 동시에 뽑는 모든 경우의 수는?`,
                variablesInfo: { '1학년': `${g1}명 중 ${pick1}명`, '2학년': `${g2}명 중 ${pick2}명`, 경우의수: totalWays },
                options,
                answerIndex,
                hint: easy ? '1학년에서 1명, 2학년에서 1명을 동시에 뽑으므로 곱의 법칙을 씁니다.' : '대표는 순서가 없으므로 조합 nCr, 두 학년을 동시에 뽑으므로 곱합니다. 순열과 헷갈리지 마세요.',
                steps: [
                  `1학년 대표: ${g1}C${pick1} = ${ways1}가지, 2학년 대표: ${g2}C${pick2} = ${ways2}가지입니다.`,
                  `곱의 법칙에 의해 ${ways1} × ${ways2} = ${totalWays}가지입니다.`
                ]
              };
            }
            const g1 = rng.int(4, 6);
            const g2 = rng.int(4, 6);
            const pick1 = 2;
            const pick2 = rng.pick([2, 3]);

            function nCr(n, r) {
              if (r === 2) return (n * (n - 1)) / 2;
              if (r === 3) return (n * (n - 1) * (n - 2)) / 6;
              return n;
            }

            const ways1 = nCr(g1, pick1);
            const ways2 = nCr(g2, pick2);
            const totalWays = ways1 * ways2;

            const correct = `${totalWays}가지`;
            const distractors = [
              `${ways1 + ways2}가지`,
              `${totalWays * 2}가지`,
              `${nCr(g1 + g2, pick1 + pick2)}가지`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `수학 동아리에서 1학년 학생 ${g1}명과 2학년 학생 ${g2}명 중에서 대회에 참가할 1학년 대표 ${pick1}명과 2학년 대표 ${pick2}명을 동시에 뽑는 모든 경우의 수는?`,
              variablesInfo: { '1학년': `${g1}명 중 ${pick1}명`, '2학년': `${g2}명 중 ${pick2}명`, 경우의수: totalWays },
              options,
              answerIndex,
              hint: `대표를 뽑을 때는 순서가 없으므로 조합(C)을 사용하고, 1학년과 2학년을 동시에 뽑으므로 두 경우의 수를 곱합니다.`,
              steps: [
                `1학년 대표를 뽑는 경우의 수는 ${g1}C${pick1} = ${ways1}가지입니다.`,
                `2학년 대표를 뽑는 경우의 수는 ${g2}C${pick2} = ${ways2}가지입니다.`,
                `곱의 법칙에 의해 구하는 경우의 수는 ${ways1} × ${ways2} = ${totalWays}가지입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-06',
          dayIndex: 5,
          unit: '대수 · 등차수열의 일반항',
          standardCode: '[12대수03-02]',
          standardName: '등차수열의 뜻을 알고, 일반항, 첫째 항부터 제n항까지의 합을 구할 수 있다.',
          sourceRef: '고2 전국연합학력평가 3점 대표 유형 (등차수열의 일반항)',
          difficulty: '★★☆ 표준',
          conceptSummary: '첫째항이 a, 공차가 d인 등차수열의 일반항은 a_n = a + (n − 1)d 이며, 두 항 a_p, a_q의 차는 (p − q)d 입니다.',
          formula: 'a_n = a₁ + (n − 1)d,   a_q − a_p = (q − p)d',
          tierGuide: { easy: '첫째항 근처의 두 항, 양의 공차', normal: '떨어진 두 항에서 공차를 구해 뒤의 항', hard: '음의 큰 공차, 멀리 있는 항 또는 앞쪽 항 거꾸로 구하기' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              let a1, d, p, q, targetN;
              if (easy) {
                a1 = rng.int(1, 6); d = rng.int(1, 4); p = rng.int(1, 2); q = p + rng.int(2, 3); targetN = q + rng.int(1, 5);
              } else {
                a1 = rng.int(-20, 20); d = rng.pick([-7, -6, -5, -4, 4, 5, 6, 7]); p = rng.int(3, 6); q = p + rng.int(4, 7);
                targetN = rng.next() < 0.3 ? rng.int(1, p - 1) : q + rng.int(8, 15);
              }
              const ap = a1 + (p - 1) * d, aq = a1 + (q - 1) * d, ans = a1 + (targetN - 1) * d;
              const distractors = [`${a1 + targetN * d}`, `${ans - d}`, `${ap + aq}`, `${ans + d}`];
              const { options, answerIndex } = buildChoiceSet(rng, `${ans}`, distractors);
              return {
                question: `등차수열 {a_n}에 대하여 제${p}항 a_${p} = ${ap}, 제${q}항 a_${q} = ${aq} 일 때, 제${targetN}항 a_${targetN} 의 값은?`,
                variablesInfo: { [`a_${p}`]: ap, [`a_${q}`]: aq, 공차d: d, 첫째항: a1 },
                options,
                answerIndex,
                hint: `a_${q} − a_${p} = (${q} − ${p})d로 공차를 먼저 구하세요.${targetN < p ? ' 구하는 항이 앞쪽이면 공차를 빼면서 거꾸로 갑니다.' : ''}`,
                steps: [
                  `a_${q} − a_${p} = ${q - p}d이므로 ${aq} − (${ap}) = ${aq - ap}, 즉 공차 d = ${d}입니다.`,
                  `a_${targetN} = a_${q} + (${targetN} − ${q})d = ${aq} + (${targetN - q})×(${d}) = ${ans}입니다.`
                ]
              };
            }
            const a1 = rng.int(-5, 6);
            const d = rng.pick([2, 3, 4, 5, -2, -3]);
            const p = rng.int(2, 4);
            const q = p + rng.int(3, 5);
            const targetN = q + rng.int(2, 4);

            const ap = a1 + (p - 1) * d;
            const aq = a1 + (q - 1) * d;
            const ans = a1 + (targetN - 1) * d;

            const correct = `${ans}`;
            const distractors = [
              `${a1 + targetN * d}`,
              `${ans - d}`,
              `${ap + aq}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `등차수열 {a_n}에 대하여 제${p}항 a_${p} = ${ap}, 제${q}항 a_${q} = ${aq} 일 때, 제${targetN}항 a_${targetN} 의 값은?`,
              variablesInfo: { [`a_${p}`]: ap, [`a_${q}`]: aq, 공차d: d, 첫째항: a1 },
              options,
              answerIndex,
              hint: `a_${q} − a_${p} = (${q} − ${p})d 관계를 이용하면 공차 d를 바로 구할 수 있습니다!`,
              steps: [
                `등차수열의 공차 d에 대해 a_${q} − a_${p} = (${q} − ${p})d = ${q - p}d 입니다.`,
                `${aq} − (${ap}) = ${aq - ap} 이므로 ${q - p}d = ${aq - ap}, 즉 공차 d = ${d}입니다.`,
                `제${targetN}항은 a_${targetN} = ${aq} + (${targetN} − ${q})×(${d}) = ${ans}입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-07',
          dayIndex: 6,
          unit: '미적분Ⅰ · 미분계수와 접선의 기울기',
          standardCode: '[12미적Ⅰ-02-05]',
          standardName: '미분계수와 접선의 기울기의 관계를 이해하고, 접선의 방정식을 구할 수 있다.',
          sourceRef: '고2·고3 전국연합학력평가 3점 필수 유형 (다항함수의 미분계수)',
          difficulty: '★★★ 실력',
          conceptSummary: '곡선 y = f(x) 위의 점 (a, f(a))에서의 접선의 기울기는 x = a에서의 미분계수 f\'(a)와 같습니다.',
          formula: '(x^n)\' = n·x^(n−1),  접선의 기울기 = f\'(a)',
          tierGuide: { easy: '이차함수의 미분계수', normal: '삼차함수의 미분계수', hard: '최고차항 계수가 음수·2 이상인 삼차함수, x = ±3에서' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const x0 = easy ? rng.pick([-2, -1, 1, 2, 3]) : rng.pick([-3, -2, 2, 3]);
              const lead = n => (n === 1 ? '' : n === -1 ? '−' : n < 0 ? '−' + Math.abs(n) : String(n));
              let fExpr, slope, fx0, wrong, dStr;
              if (easy) {
                const c2 = rng.pick([1, 2, 3]), c1 = rng.int(-6, 6), c0 = rng.int(-5, 5);
                fExpr = `${lead(c2)}x² ${signedTerm(c1, 'x')} ${signedTerm(c0, '')}`;
                slope = 2 * c2 * x0 + c1; fx0 = c2 * x0 * x0 + c1 * x0 + c0;
                wrong = [c2 * x0 + c1, 2 * c2 * x0, slope + c0];
                dStr = `${2 * c2}x ${signedTerm(c1, '')}`;
              } else {
                const c3 = rng.pick([-2, -1, 2, 3]), c2 = rng.int(-5, 5) || 3, c1 = rng.int(-9, 9), c0 = rng.int(-6, 6);
                fExpr = `${lead(c3)}x³ ${signedTerm(c2, 'x²')} ${signedTerm(c1, 'x')} ${signedTerm(c0, '')}`;
                slope = 3 * c3 * x0 * x0 + 2 * c2 * x0 + c1; fx0 = c3 * x0 ** 3 + c2 * x0 * x0 + c1 * x0 + c0;
                wrong = [3 * c3 * x0 * x0 + c2 * x0 + c1, -3 * c3 * x0 * x0 + 2 * c2 * x0 + c1, slope - c1 || slope + 5];
                dStr = `${lead(3 * c3) || '1'}x² ${signedTerm(2 * c2, 'x')} ${signedTerm(c1, '')}`;
              }
              const distractors = [`${fx0}`, ...wrong.map(String)];
              const { options, answerIndex } = buildChoiceSet(rng, `${slope}`, distractors);
              return {
                question: `다항함수 f(x) = ${fExpr} 에 대하여 곡선 y = f(x) 위의 점 (${x0}, f(${x0}))에서의 접선의 기울기 f'(${x0})의 값은?`,
                variablesInfo: { 함수: `f(x) = ${fExpr}`, 접점x좌표: x0, 미분계수: slope },
                options,
                answerIndex,
                hint: `f'(x)를 먼저 구하고 x = ${wj(x0, '을/를')} 대입하세요.${easy ? '' : ' 음수의 제곱·세제곱 부호에 주의!'}`,
                steps: [
                  `f(x)를 미분하면 f'(x) = ${dStr}입니다.`,
                  `접선의 기울기는 f'(${x0}) = ${slope}입니다.`
                ]
              };
            }
            const c3 = rng.pick([1, 2]);
            const c2 = rng.int(-4, 4) || 2;
            const c1 = rng.int(-6, 6);
            const c0 = rng.int(-5, 5);
            const x0 = rng.pick([-2, -1, 1, 2, 3]);

            const slope = 3 * c3 * x0 * x0 + 2 * c2 * x0 + c1;
            const fx0 = c3 * Math.pow(x0, 3) + c2 * x0 * x0 + c1 * x0 + c0;

            const fExpr = `${c3 === 1 ? '' : c3}x³ ${signedTerm(c2, 'x²')} ${signedTerm(c1, 'x')} ${signedTerm(c0, '')}`;
            const correct = `${slope}`;
            const distractors = [
              `${fx0 !== slope ? fx0 : slope + 3}`,
              `${3 * c3 * x0 * x0 + c2 * x0 + c1}`,
              `${slope - c1 || slope - 2}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `다항함수 f(x) = ${fExpr} 에 대하여 곡선 y = f(x) 위의 점 (${x0}, f(${x0}))에서의 접선의 기울기 f'(${x0})의 값은?`,
              variablesInfo: { 함수: `f(x) = ${fExpr}`, 접점x좌표: x0, 미분계수: slope },
              options,
              answerIndex,
              hint: `먼저 f(x)를 미분하여 도함수 f'(x)를 구한 뒤 x = ${wj(x0, '을/를')} 대입하세요.`,
              steps: [
                `f(x)를 미분하면 f'(x) = ${3 * c3}x² ${signedTerm(2 * c2, 'x')} ${signedTerm(c1, '')} 입니다.`,
                `곡선 위의 점 (${x0}, f(${x0}))에서의 접선의 기울기는 f'(${x0})입니다.`,
                `x = ${wj(x0, '을/를')} 대입하면 f'(${x0}) = ${3 * c3}×(${x0})² + (${2 * c2})×(${x0}) + (${c1}) = ${slope}입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-08',
          dayIndex: 7,
          unit: '공통수학1 · 복소수의 사칙연산',
          standardCode: '[10공수1-02-01]',
          standardName: '복소수의 뜻과 성질을 설명하고, 사칙연산을 수행할 수 있다.',
          sourceRef: '공통수학1 교과서 및 학력평가 2~3점 (분모의 실수화)',
          difficulty: '★★☆ 표준',
          conceptSummary: '분모에 허수 단위 i가 있을 때는 분모의 켤레복소수를 분자와 분모에 곱하여 실수화하며, i² = −1 임을 이용합니다.',
          formula: '(a + bi)(a − bi) = a² + b²',
          tierGuide: { easy: '분모가 1 ± i, 깔끔한 답', normal: '분모가 1 + i 또는 2 + i', hard: '분모가 c ± 2i, c ± 3i이고 답에 음수 포함' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              let c, d, r, t, numReal, numImag;
              for (;;) {
                c = easy ? 1 : rng.pick([1, 2, 3]);
                d = easy ? rng.pick([1, -1]) : rng.pick([-3, -2, 2, 3]);
                r = easy ? rng.int(1, 4) : (rng.int(-4, 4) || 2);
                t = easy ? rng.int(1, 4) : (rng.int(-4, 4) || -1);
                // 분자 = (r + ti)(c + di)
                numReal = r * c - t * d; numImag = r * d + t * c;
                if (numReal !== 0 && numImag !== 0) break;
              }
              const norm = c * c + d * d;
              const numStr = cx(numReal, numImag);
              const denStr = cx(c, d);
              const conjStr = cx(c, -d);
              const correct = cx(r, t);
              const distractors = [cx(r, -t), cx(t, r), cx(r * norm, t * norm), cx(-r, t), cx(r + 1, t - 1), cx(r, t + 2)];
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `복소수 z = ${wj(`(${numStr}) ÷ (${denStr})`, '을/를')} a + bi 꼴로 바르게 나타낸 것은?`,
                variablesInfo: { 분자: numStr, 분모: denStr },
                options,
                answerIndex,
                hint: `분모의 켤레복소수 (${conjStr})를 분자와 분모에 곱해 분모를 실수로 만드세요. i² = −1 입니다.`,
                steps: [
                  `분모의 켤레복소수 (${conjStr})를 분자·분모에 곱합니다. 분모는 (${denStr})(${conjStr}) = ${c}² + ${Math.abs(d)}² = ${norm}입니다.`,
                  `분자는 (${numStr})(${conjStr}) = ${cx(r * norm, t * norm)}입니다.`,
                  `${wj(norm, '으로/로')} 나누면 z = ${correct}입니다.`
                ]
              };
            }
            const a = rng.pick([1, 2, 3]);
            const b = rng.pick([1, 2]);
            const denReal = rng.pick([1, 2]);
            const denImag = 1; // den = denReal + i, conjugate = denReal - i, norm = denReal^2 + 1
            const norm = denReal * denReal + 1;
            // numerator = a + bi, want (a+bi)(denReal - i) = (a*denReal + b) + (b*denReal - a)i
            // 깔끔한 정수가 되도록 분자 설정
            const realPart = a * denReal + b;
            const imagPart = b * denReal - a;
            // 분자 = (정답)(분모) = (realPart + imagPart·i)(denReal + i)
            //      = (realPart·denReal − imagPart) + (realPart + imagPart·denReal)i
            const numReal = realPart * denReal - imagPart;
            const numImag = realPart + imagPart * denReal;
            const numStr = cx(numReal, numImag);

            const correct = cx(realPart, imagPart);
            const distractors = [
              cx(realPart, -imagPart),          // 켤레 부호 착오
              cx(realPart - 2, imagPart),       // i² = +1 로 착각
              cx(realPart * 2, imagPart),       // 분모 실수화 후 약분 누락
              cx(imagPart, realPart),           // 실수부·허수부 뒤바뀜
              cx(realPart, imagPart + 2),
              cx(realPart + 1, imagPart - 1)
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `복소수 z = ${wj(`(${numStr}) ÷ (${denReal} + i)`, '을/를')} a + bi 꼴로 바르게 나타낸 것은?`,
              variablesInfo: { 분자: numStr, 분모: `${denReal} + i` },
              options,
              answerIndex,
              hint: `분모의 켤레복소수인 (${denReal} − i)를 분자와 분모에 각각 곱해 분모를 실수로 만드세요. i² = −1 입니다.`,
              steps: [
                `분모의 켤레복소수는 (${denReal} − i) 입니다.`,
                `분모에 켤레복소수를 곱하면 (${denReal} + i)(${denReal} − i) = ${denReal}² − i² = ${norm} 입니다.`,
                `분자에도 곱하면 (${numStr})(${denReal} − i) = ${cx(realPart * norm, imagPart * norm)} 입니다.`,
                `${wj(norm, '으로/로')} 나누면 z = ${correct} 입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-09',
          dayIndex: 8,
          unit: '공통수학2 · 선분의 내분점',
          standardCode: '[10공수2-01-01]',
          standardName: '선분의 내분을 이해하고, 내분점의 좌표를 계산할 수 있다.',
          sourceRef: '공통수학2 교과서 (선분의 m:n 내분점 공식)',
          difficulty: '★★☆ 표준',
          conceptSummary: '선분 AB를 m:n으로 내분하는 점 P의 좌표는 ((m·x₂ + n·x₁)/(m+n), (m·y₂ + n·y₁)/(m+n)) 입니다.',
          formula: 'P = ((m x₂ + n x₁)/(m + n),  (m y₂ + n y₁)/(m + n))',
          tierGuide: { easy: '1 : 2, 1 : 3 내분, 양의 좌표', normal: '1 : 2 ~ 3 : 2 내분', hard: '3 : 4, 2 : 5 등 큰 비, 음수 좌표' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const [m, n] = easy ? rng.pick([[1, 2], [2, 1], [1, 3], [3, 1]]) : rng.pick([[2, 3], [3, 2], [3, 4], [4, 3], [2, 5], [5, 2], [3, 5]]);
              const k = m + n;
              const x1 = easy ? rng.int(0, 4) : rng.int(-6, 4);
              const y1 = easy ? rng.int(0, 4) : rng.int(-6, 4);
              const dx = easy ? rng.pick([1, 2]) : rng.pick([-2, -1, 1, 2]);
              const dy = easy ? rng.pick([1, 2]) : rng.pick([-2, -1, 1, 2]);
              const x2 = x1 + k * dx, y2 = y1 + k * dy;
              const realPx = x1 + m * dx, realPy = y1 + m * dy;
              const correct = `(${realPx}, ${realPy})`;
              const distractors = [`(${x1 + n * dx}, ${y1 + n * dy})`, `(${realPy}, ${realPx})`, `(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`, `(${realPx + 1}, ${realPy - 1})`, `(${realPx - 1}, ${realPy + 1})`, `(${realPx + 1}, ${realPy + 1})`]
                .filter(o => !/\.\d/.test(o));
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `두 점 A(${x1}, ${y1}), B(${x2}, ${y2})를 ${m} : ${wj(n, '으로/로')} 내분하는 점 P의 좌표는?`,
                variablesInfo: { 점A: `(${x1}, ${y1})`, 점B: `(${x2}, ${y2})`, 내분비: `${m}:${n}` },
                figure: { type: 'segment-division', A: [x1, y1], B: [x2, y2], m, n },
                options,
                answerIndex,
                hint: `분모는 ${m} + ${n}, 분자는 ${m}×(B의 좌표) + ${n}×(A의 좌표)입니다. m은 B 쪽에 곱해요!`,
                steps: [
                  `x좌표: (${m}×${x2 < 0 ? `(${x2})` : x2} + ${n}×${x1 < 0 ? `(${x1})` : x1}) / ${k} = ${realPx}입니다.`,
                  `y좌표: (${m}×${y2 < 0 ? `(${y2})` : y2} + ${n}×${y1 < 0 ? `(${y1})` : y1}) / ${k} = ${realPy}입니다. 따라서 P(${realPx}, ${realPy})입니다.`
                ]
              };
            }
            // m ≠ n, gcd(m, n) = 1 인 비만 사용(m:m 은 중점이라 퇴화)
            const [m, n] = rng.pick([[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2]]);
            const k = m + n;
            // A에서 방향 (dx, dy)로 k칸 간 점을 B로 두면 내분점 P = A + m·(dx, dy) 가 항상 정수
            const x1 = rng.int(-4, 3);
            const y1 = rng.int(-3, 4);
            const dx = rng.pick([-2, -1, 1, 2]);
            const dy = rng.pick([-2, -1, 1, 2]);
            const x2 = x1 + k * dx;
            const y2 = y1 + k * dy;
            const realPx = x1 + m * dx;
            const realPy = y1 + m * dy;

            const correct = `(${realPx}, ${realPy})`;
            const distractors = [
              `(${x1 + n * dx}, ${y1 + n * dy})`, // m:n 을 n:m 으로 뒤바꿈
              `(${realPy}, ${realPx})`,          // x·y 좌표 뒤바뀜
              `(${realPx + 1}, ${realPy - 1})`,
              `(${realPx - 1}, ${realPy + 1})`,
              `(${realPx + 1}, ${realPy + 1})`,
              `(${realPx - 1}, ${realPy - 1})`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `두 점 A(${x1}, ${y1}), B(${x2}, ${y2})를 ${m} : ${wj(n, '으로/로')} 내분하는 점 P의 좌표는?`,
              variablesInfo: { 점A: `(${x1}, ${y1})`, 점B: `(${x2}, ${y2})`, 내분비: `${m}:${n}` },
              figure: { type: 'segment-division', A: [x1, y1], B: [x2, y2], m, n },
              options,
              answerIndex,
              hint: `내분점 공식의 분모는 (${m} + ${n})이고 분자는 ${m}×(B의 좌표) + ${n}×(A의 좌표) 입니다.`,
              steps: [
                `선분 AB를 ${m}:${wj(n, '으로/로')} 내분하므로 분모는 ${m} + ${n} = ${m + n} 입니다.`,
                `x좌표: (${m}×${x2} + ${n}×${x1}) / ${m + n} = ${realPx} 입니다.`,
                `y좌표: (${m}×${y2} + ${n}×${y1}) / ${m + n} = ${realPy} 입니다. 따라서 점 P의 좌표는 (${realPx}, ${realPy})입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-10',
          dayIndex: 9,
          unit: '공통수학2 · 원의 방정식',
          standardCode: '[10공수2-01-04]',
          standardName: '원의 방정식을 구하고, 그래프를 그릴 수 있다.',
          sourceRef: '공통수학2 교과서 및 학력평가 (원의 중심과 반지름)',
          difficulty: '★★☆ 표준',
          conceptSummary: '원 (x − a)² + (y − b)² = r²의 중심의 좌표는 (a, b)이고 반지름의 길이는 r입니다.',
          formula: '(x − a)² + (y − b)² = r²',
          tierGuide: { easy: '중심 좌표·반지름이 작은 원', normal: '교과서 수준의 원', hard: '좌표·반지름이 큰 원(제곱근·부호 착오 주의)' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const a = easy ? rng.pick([-2, -1, 1, 2]) : rng.pick([-7, -6, -5, 5, 6, 7]);
              const b = easy ? rng.pick([-2, -1, 1, 2]) : rng.pick([-8, -6, -4, 4, 6, 8]);
              const r = easy ? rng.int(2, 4) : rng.int(7, 12);
              const rSq = r * r;
              const aSign = a >= 0 ? `− ${a}` : `+ ${Math.abs(a)}`;
              const bSign = b >= 0 ? `− ${b}` : `+ ${Math.abs(b)}`;
              const correct = `중심 (${a}, ${b}), 반지름 ${r}`;
              const distractors = [`중심 (${-a}, ${-b}), 반지름 ${r}`, `중심 (${a}, ${b}), 반지름 ${rSq}`, `중심 (${-a}, ${-b}), 반지름 ${rSq}`, `중심 (${b}, ${a}), 반지름 ${r}`, `중심 (${a}, ${-b}), 반지름 ${r}`, `중심 (${-a}, ${b}), 반지름 ${r}`]
                .filter(o => o !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `원의 방정식 (x ${aSign})² + (y ${bSign})² = ${rSq} 의 중심의 좌표와 반지름의 길이를 바르게 짝지은 것은?`,
                variablesInfo: { 방정식: `(x ${aSign})² + (y ${bSign})² = ${rSq}`, 중심: `(${a}, ${b})`, 반지름: r },
                figure: { type: 'coord-circle', center: [a, b], r },
                options,
                answerIndex,
                hint: `괄호 안 수의 부호를 바꾼 것이 중심 좌표, 우변의 양의 제곱근이 반지름입니다.${easy ? '' : ` ${rSq} = ${r}²인지 확인해 보세요.`}`,
                steps: [
                  `(x ${aSign})² + (y ${bSign})²에서 중심은 (${a}, ${b})입니다.`,
                  `r² = ${rSq}이므로 반지름은 √${rSq} = ${r}입니다.`
                ]
              };
            }
            const a = rng.pick([-4, -3, -2, 2, 3, 4]);
            const b = rng.pick([-5, -3, 1, 3, 5]);
            const r = rng.pick([3, 4, 5, 6]);
            const rSq = r * r;

            const aSign = a >= 0 ? `− ${a}` : `+ ${Math.abs(a)}`;
            const bSign = b >= 0 ? `− ${b}` : `+ ${Math.abs(b)}`;

            const correct = `중심 (${a}, ${b}), 반지름 ${r}`;
            const distractors = [
              `중심 (${-a}, ${-b}), 반지름 ${r}`,
              `중심 (${a}, ${b}), 반지름 ${rSq}`,
              `중심 (${-a}, ${-b}), 반지름 ${rSq}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `원의 방정식 (x ${aSign})² + (y ${bSign})² = ${rSq} 의 중심의 좌표와 반지름의 길이를 바르게 짝지은 것은?`,
              variablesInfo: { 방정식: `(x ${aSign})² + (y ${bSign})² = ${rSq}`, 중심: `(${a}, ${b})`, 반지름: r },
              figure: { type: 'coord-circle', center: [a, b], r },
              options,
              answerIndex,
              hint: `표준형 (x − a)² + (y − b)² = r² 에서 괄호 안의 부호 반대가 중심 좌표이며, 우변의 제곱근이 반지름입니다.`,
              steps: [
                `(x ${aSign})² = 0 이 되는 x = ${a}, (y ${bSign})² = 0 이 되는 y = ${b} 이므로 중심의 좌표는 (${a}, ${b})입니다.`,
                `우변의 값은 r² = ${rSq} 이므로 반지름의 길이는 r = √${rSq} = ${r} 입니다.`,
                `따라서 중심은 (${a}, ${b}), 반지름은 ${r}입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-11',
          dayIndex: 10,
          unit: '공통수학2 · 명제와 필요·충분조건',
          standardCode: '[10공수2-02-06]',
          standardName: '충분조건과 필요조건을 이해하고 판단할 수 있다.',
          sourceRef: '공통수학2 교과서 (명제의 조건 판별)',
          difficulty: '★★☆ 표준',
          conceptSummary: 'p ⇒ q 가 참이면 p는 q이기 위한 충분조건이고, q는 p이기 위한 필요조건입니다.',
          formula: 'p ⇒ q (참) : p는 충분조건, q는 필요조건',
          tierGuide: { easy: '부등식·등식 한 변수 조건의 포함 관계', normal: '교과서 대표 3가지 조건', hard: '절댓값·두 변수(xy = 0, x² + y² = 0) 조건, 필요충분조건 포함' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const S = '충분조건이지만 필요조건은 아니다', Nn = '필요조건이지만 충분조건은 아니다', B = '필요충분조건이다', X = '필요조건도 충분조건도 아니다';
              const m = n => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
              let c;
              if (tier === 'easy') {
                const kind = rng.pick(['gt', 'lt', 'eq']);
                let a = rng.int(-4, 4), b = rng.int(-4, 4);
                if (a === b) b = a === 4 ? 1 : a + 1;
                if (kind === 'gt') c = { p: `x > ${m(a)}`, q: `x > ${m(b)}`, ans: a > b ? S : Nn, reason: a > b ? `${m(a)}보다 큰 수는 모두 ${m(b)}보다 크지만 그 역은 아니므로 p ⇒ q만 참입니다.` : `${m(b)}보다 큰 수는 모두 ${m(a)}보다 크므로 q ⇒ p만 참입니다.` };
                else if (kind === 'lt') c = { p: `x < ${m(a)}`, q: `x < ${m(b)}`, ans: a < b ? S : Nn, reason: a < b ? `${m(a)}보다 작은 수는 모두 ${m(b)}보다 작으므로 p ⇒ q만 참입니다.` : `${m(b)}보다 작은 수는 모두 ${m(a)}보다 작으므로 q ⇒ p만 참입니다.` };
                else c = { p: `x = ${m(a)}`, q: `x > ${m(b)}`, ans: a > b ? S : X, reason: a > b ? `x = ${m(a)}이면 x > ${m(b)}이지만, x > ${m(b)}라고 x = ${m(a)}인 것은 아니므로 p ⇒ q만 참입니다.` : `x = ${m(a)}${jo(m(a), '은/는')} ${m(b)}보다 크지 않으므로 p ⇒ q도, q ⇒ p도 거짓입니다.` };
              } else {
                const a = rng.int(1, 5), b = rng.int(-5, 3);
                const cases = [
                  { p: `|x| = ${a}`, q: `x² − ${a * a} = 0`, ans: B, reason: `|x| = ${a} ⇔ x = ±${a} ⇔ x² = ${a * a}이므로 p ⇒ q, q ⇒ p 모두 참입니다.` },
                  { p: `x² − ${a * a} = 0`, q: `x = ${a}`, ans: Nn, reason: `x = ${a}이면 x² = ${a * a}이지만, x² = ${a * a}이면 x = −${a}일 수도 있으므로 q ⇒ p만 참입니다.` },
                  { p: `x² − ${a * a} = 0`, q: `x = −${a}`, ans: Nn, reason: `x = −${a}이면 x² = ${a * a}이지만, x² = ${a * a}이면 x = ${a}일 수도 있으므로 q ⇒ p만 참입니다.` },
                  { p: `x = ${a}`, q: `|x| = ${a}`, ans: S, reason: `x = ${a}이면 |x| = ${a}이지만, |x| = ${a}이면 x = −${a}일 수도 있으므로 p ⇒ q만 참입니다.` },
                  { p: `x² − ${a * a} = 0`, q: `x > ${m(b)}`, ans: b < -a ? S : X, reason: b < -a ? `${wj(`x = ±${a}`, '은/는')} 모두 ${m(b)}보다 크므로 p ⇒ q는 참, x > ${m(b)}인 수가 모두 ±${a}인 것은 아니므로 q ⇒ p는 거짓입니다.` : `x = −${a}${jo(`−${a}`, '은/는')} ${m(b)}보다 크지 않으므로 p ⇒ q가 거짓이고, q ⇒ p도 거짓입니다.` },
                  { vars: 'x, y', p: 'x² + y² = 0', q: 'x = 0이고 y = 0', ans: B, reason: '실수의 제곱은 0 이상이므로 x² + y² = 0 ⇔ x = 0이고 y = 0입니다.' },
                  { vars: 'x, y', p: 'xy = 0', q: 'x² + y² = 0', ans: Nn, reason: 'x² + y² = 0이면 x = y = 0이라 xy = 0이지만, xy = 0이어도(x = 0, y = 1) x² + y² ≠ 0이므로 q ⇒ p만 참입니다.' },
                  { vars: 'x, y', p: 'x = 0이고 y = 0', q: 'xy = 0', ans: S, reason: 'x = 0이고 y = 0이면 xy = 0이지만, xy = 0이어도 x = 0, y = 2처럼 둘 다 0은 아닐 수 있으므로 p ⇒ q만 참입니다.' }
                ];
                c = rng.pick(cases);
              }
              const distractors = [S, Nn, B, X].filter(o => o !== c.ans);
              const { options, answerIndex } = buildChoiceSet(rng, c.ans, distractors);
              return {
                question: `실수 ${c.vars || 'x'}에 대하여 조건 p: "${c.p}"는 조건 q: "${c.q}"이기 위한 어떤 조건인가요?`,
                variablesInfo: { 조건p: c.p, 조건q: c.q },
                options,
                answerIndex,
                hint: tier === 'easy' ? '수직선에 두 조건의 범위를 그려 어느 쪽이 다른 쪽에 포함되는지 보세요.' : 'p ⇒ q, q ⇒ p를 각각 판별하세요. 거짓인 쪽은 반례 하나만 찾으면 됩니다.',
                steps: [c.reason, `따라서 p는 q이기 위한 ${c.ans}입니다.`]
              };
            }
            const cases = [
              {
                p: 'x = 2',
                q: 'x² − 4 = 0',
                ans: '충분조건이지만 필요조건은 아니다',
                reason: 'x = 2이면 x² = 4가 성립하지만, x² = 4이면 x = −2일 수도 있으므로 p ⇒ q는 참이고 q ⇒ p는 거짓입니다.'
              },
              {
                p: 'x > 3',
                q: 'x > 1',
                ans: '충분조건이지만 필요조건은 아니다',
                reason: '3보다 큰 모든 수는 1보다 크지만, 2는 1보다 커도 3보다 크지 않으므로 p ⇒ q는 참이고 q ⇒ p는 거짓입니다.'
              },
              {
                vars: 'x, y', // 조건에 y가 나오므로 변수 범위에 y 포함
                p: 'xy = 0',
                q: 'x = 0',
                ans: '필요조건이지만 충분조건은 아니다',
                reason: 'x = 0이면 xy = 0이 참이지만, xy = 0이라고 해서 반드시 x = 0인 것은 아닙니다(y = 0일 수 있음).'
              }
            ];
            const c = rng.pick(cases);
            const correct = c.ans;
            const distractors = [
              c.ans.startsWith('충분') ? '필요조건이지만 충분조건은 아니다' : '충분조건이지만 필요조건은 아니다',
              '필요충분조건이다',
              '필요조건도 충분조건도 아니다'
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `실수 ${c.vars || 'x'}에 대하여 조건 p: "${c.p}"는 조건 q: "${c.q}"이기 위한 어떤 조건인가요?`,
              variablesInfo: { 조건p: c.p, 조건q: c.q },
              options,
              answerIndex,
              hint: `p ⇒ q가 성립하는지, 그리고 역인 q ⇒ p가 성립하는지 각각 참·거짓을 판별해 보세요.`,
              steps: [
                c.reason,
                `화살표를 주는 쪽(p)은 충분조건, 화살표를 받는 쪽(q)은 필요조건입니다.`,
                `따라서 p는 q이기 위한 ${correct}입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-12',
          dayIndex: 11,
          unit: '대수 · 로그의 성질',
          standardCode: '[12대수01-04]',
          standardName: '로그의 뜻을 알고, 그 성질을 이용하여 계산할 수 있다.',
          sourceRef: '대수(수학Ⅰ) 교과서 및 학력평가 3점 (로그의 기본 계산)',
          difficulty: '★★☆ 표준',
          conceptSummary: '밑이 같은 로그의 덧셈은 진수의 곱셈이 되고, 뺄셈은 진수의 나눗셈이 됩니다.',
          formula: 'log_a x + log_a y = log_a(xy),  log_a x − log_a y = log_a(x/y)',
          tierGuide: { easy: '밑 2·3, 결과가 1~3', normal: '밑 2·3, 결과가 2~4', hard: '진수1 < 진수2라 결과가 음수, 밑 5 포함' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const base = easy ? rng.pick([2, 3]) : rng.pick([2, 3, 5]);
              const k = easy ? rng.int(1, 3) : (base === 5 ? rng.int(2, 3) : rng.int(2, 4));
              const target = Math.pow(base, k);
              const d = easy ? rng.pick([2, 3, 5, 7]) : rng.pick([2, 3, 4, 6, 7]);
              const ans = easy ? k : -k;
              const arg1 = easy ? target * d : d;
              const arg2 = easy ? d : target * d;
              const neg = v => (v < 0 ? `−${Math.abs(v)}` : `${v}`);
              const distractors = easy ? [`${k + 1}`, `${k + 2}`, `${target}`] : [`${k}`, neg(-k - 1), neg(1 - k), `1/${target}`];
              const { options, answerIndex } = buildChoiceSet(rng, neg(ans), distractors);
              return {
                question: `다음 로그 식의 값을 계산하면?  [ log_${base} (${arg1}) − log_${base} (${arg2}) ]`,
                variablesInfo: { 밑: base, 진수1: arg1, 진수2: arg2, 계산결과: ans },
                options,
                answerIndex,
                hint: easy ? 'log_a X − log_a Y = log_a(X / Y)입니다.' : 'log_a X − log_a Y = log_a(X / Y)이고, 진수가 1보다 작으면 로그값은 음수입니다.',
                steps: [
                  `log_${base}(${arg1}) − log_${base}(${arg2}) = log_${base}(${arg1}/${arg2})입니다.`,
                  easy ? `${arg1}/${arg2} = ${target} = ${base}^${k}이므로 값은 ${k}입니다.` : `${arg1}/${arg2} = 1/${target} = ${base}^(−${k})이므로 값은 −${k}입니다.`
                ]
              };
            }
            const base = rng.pick([2, 3]);
            const k = rng.int(2, 4);
            const target = Math.pow(base, k); // log_base(target) = k
            const d = rng.pick([2, 3, 4, 6]);
            const arg1 = target * d;
            const arg2 = d;

            const correct = `${k}`;
            const distractors = [
              `${k + 1}`,
              `${k - 1 || k + 2}`,
              `${target}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `다음 로그 식의 값을 계산하면?  [ log_${base} (${arg1}) − log_${base} (${arg2}) ]`,
              variablesInfo: { 밑: base, 진수1: arg1, 진수2: arg2, 계산결과: k },
              options,
              answerIndex,
              hint: `밑이 같을 때 log_a X − log_a Y = log_a(X / Y) 공식을 적용하세요.`,
              steps: [
                `로그의 뺄셈 성질에 의해 log_${base}(${arg1}) − log_${base}(${arg2}) = log_${base}(${arg1} ÷ ${arg2}) 입니다.`,
                `${arg1} ÷ ${arg2} = ${target} = ${base}^${k} 입니다.`,
                `따라서 log_${base}(${base}^${k}) = ${k} 입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-13',
          dayIndex: 12,
          unit: '대수 · 등비수열의 합',
          standardCode: '[12대수03-03]',
          standardName: '등비수열의 뜻을 알고, 일반항, 첫째 항부터 제n항까지의 합을 구할 수 있다.',
          sourceRef: '대수(수학Ⅰ) 교과서 및 학력평가 3점 (등비수열의 합 공식)',
          difficulty: '★★☆ 표준',
          conceptSummary: '첫째항이 a, 공비가 r (r ≠ 1)인 등비수열의 제n항까지의 합은 S_n = a(r^n − 1) / (r − 1) 입니다.',
          formula: 'S_n = a(r^n − 1) / (r − 1)',
          tierGuide: { easy: '항 수 3~4개, 공비 2·3', normal: '항 수 4~5개, 공비 2·3', hard: '공비가 음수(−2, −3)이거나 4, 항 수 5~6개' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const easy = tier === 'easy';
              const a = easy ? rng.int(1, 4) : rng.int(1, 4);
              const r = easy ? rng.pick([2, 3]) : rng.pick([-2, -3, 4]);
              const n = easy ? rng.pick([3, 4]) : rng.pick([5, 6]);
              const rn = Math.pow(r, n);
              const sn = (a * (rn - 1)) / (r - 1);
              const ar = Math.abs(r);
              const neg = v => (v < 0 ? `−${Math.abs(v)}` : `${v}`);
              const distractors = [neg((a * (Math.pow(r, n - 1) - 1)) / (r - 1)), neg(a * rn), neg(sn + a), neg((a * (Math.pow(ar, n) - 1)) / (ar - 1)), neg(-sn)];
              const { options, answerIndex } = buildChoiceSet(rng, neg(sn), distractors);
              const rs = neg(r);
              return {
                question: `첫째항이 ${a}이고 공비가 ${rs}인 등비수열의 첫째항부터 제${n}항까지의 합 S_${n}의 값은?`,
                variablesInfo: { 첫째항a: a, 공비r: r, 항수n: n, 등비수열합: sn },
                options,
                answerIndex,
                hint: `S_n = a(r^n − 1)/(r − 1)에 대입하세요.${r < 0 ? ` 공비가 음수이면 r^${n}의 부호와 분모 r − 1 = ${neg(r - 1)}에 주의!` : ''}`,
                steps: [
                  `S_${n} = ${a} × ((${rs})^${n} − 1) / (${rs} − 1)입니다.`,
                  `(${rs})^${n} = ${neg(rn)}이므로 S_${n} = ${a} × (${neg(rn - 1)}) / (${neg(r - 1)}) = ${neg(sn)}입니다.`
                ]
              };
            }
            const a = rng.pick([1, 2, 3]);
            const r = rng.pick([2, 3]);
            const n = rng.pick([4, 5]);
            const rn = Math.pow(r, n);
            const sn = (a * (rn - 1)) / (r - 1);

            const correct = `${sn}`;
            const distractors = [
              `${(a * (Math.pow(r, n - 1) - 1)) / (r - 1)}`,
              `${a * rn}`,
              `${sn + a}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `첫째항이 ${a}이고 공비가 ${r}인 등비수열의 첫째항부터 제${n}항까지의 합 S_${n}의 값은?`,
              variablesInfo: { 첫째항a: a, 공비r: r, 항수n: n, 등비수열합: sn },
              options,
              answerIndex,
              hint: `등비수열의 합 공식 S_n = a(r^n − 1) / (r − 1) 에 대입하세요. r^${n} = ${rn} 입니다.`,
              steps: [
                `등비수열의 합 공식 S_${n} = ${a} × (${r}^${n} − 1) / (${r} − 1) 입니다.`,
                `${r}^${n} = ${rn} 이므로 분자는 ${a} × (${rn} − 1) = ${a * (rn - 1)} 입니다.`,
                `분모는 ${r} − 1 = ${r - 1} 이므로 S_${n} = ${sn} 입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-14',
          dayIndex: 13,
          unit: '미적분Ⅰ · 삼차함수의 극대와 극소',
          standardCode: '[12미적Ⅰ-02-07]',
          standardName: '함수의 증가와 감소, 극대와 극소를 판정하고 설명할 수 있다.',
          sourceRef: '미적분Ⅰ(수학Ⅱ) 교과서 및 수능 모의평가 3점',
          difficulty: '★★★ 실력',
          conceptSummary: 'f\'(x) = 0인 x에서 f\'(x)의 부호가 양에서 음으로 바뀌면 극대, 음에서 양으로 바뀌면 극소가 됩니다.',
          formula: 'f\'(x) = 0 의 실근에서 증감표로 극값 판정',
          tierGuide: { easy: 'x³ − 3x, x³ − 12x 꼴', normal: 'x³ − 3a²x 꼴(a = 1, 2, 3)', hard: '최고차항 계수가 −1(극대·극소 위치 반전) 또는 2인 삼차함수' },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              let k, a, c, xM, xm;
              if (tier === 'easy') { k = 1; a = rng.pick([1, 2]); c = rng.int(-5, 5); }
              else { k = rng.pick([-1, 2]); a = rng.pick([1, 2, 3]); c = rng.int(-6, 6); }
              // f(x) = k(x³ − 3a²x) + c,  f'(x) = 3k(x − a)(x + a)
              const f = x => k * (x * x * x - 3 * a * a * x) + c;
              if (k > 0) { xM = -a; xm = a; } else { xM = a; xm = -a; }
              const maxVal = f(xM), minVal = f(xm);
              const lead = k === 1 ? 'x³' : k === -1 ? '−x³' : `${k}x³`;
              const fStr = `f(x) = ${lead} ${signedTerm(-3 * k * a * a, 'x')} ${signedTerm(c, '')}`;
              const correct = `극댓값 ${maxVal} (x = ${xM}), 극솟값 ${minVal} (x = ${xm})`;
              const distractors = [
                `극댓값 ${minVal} (x = ${xm}), 극솟값 ${maxVal} (x = ${xM})`,
                `극댓값 ${maxVal} (x = ${xm}), 극솟값 ${minVal} (x = ${xM})`,
                `극댓값 ${f(-xM)} (x = ${xM}), 극솟값 ${f(-xm)} (x = ${xm})`,
                `극댓값 ${maxVal + 2}, 극솟값 ${minVal - 2}`
              ].filter(o => o !== correct);
              const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);
              return {
                question: `삼차함수 ${fStr} 의 극댓값과 극솟값을 바르게 구한 것은?`,
                variablesInfo: { 함수: fStr, 극대점: xM, 극소점: xm, 극댓값: maxVal, 극솟값: minVal },
                figure: { type: 'cubic', poly: { a3: k, a1: -3 * k * a * a, a0: c }, crit: [xM, xm] },
                options,
                answerIndex,
                hint: k < 0 ? `최고차항 계수가 음수이면 f'(x)의 부호가 반대로 바뀌어 극대·극소의 위치가 뒤바뀝니다.` : `f'(x) = 0의 두 근에서 f'(x)의 부호 변화를 확인하세요.`,
                steps: [
                  `f'(x) = ${3 * k < 0 ? '−' + Math.abs(3 * k) : 3 * k}x²${signedTerm(-3 * k * a * a, '')} = ${3 * k < 0 ? '−' + Math.abs(3 * k) : 3 * k}(x + ${a})(x − ${a}) = 0에서 x = −${a} 또는 x = ${a}입니다.`,
                  `x = ${xM} 좌우에서 f'(x)가 양 → 음이므로 극댓값 f(${xM}) = ${maxVal}입니다.`,
                  `x = ${xm} 좌우에서 f'(x)가 음 → 양이므로 극솟값 f(${xm}) = ${minVal}입니다.`
                ]
              };
            }
            const a = rng.pick([1, 2, 3]);
            const c = rng.int(-4, 4);
            // f(x) = x^3 - 3*a^2*x + c
            // f'(x) = 3x^2 - 3*a^2 = 3(x-a)(x+a)
            // x = -a에서 극댓값, x = a에서 극솟값
            const maxVal = Math.pow(-a, 3) - 3 * a * a * (-a) + c; // -a^3 + 3a^3 + c = 2a^3 + c
            const minVal = Math.pow(a, 3) - 3 * a * a * a + c; // -2a^3 + c

            const fStr = `f(x) = x³ − ${3 * a * a}x ${signedTerm(c, '')}`;
            const correct = `극댓값 ${maxVal} (x = ${-a}), 극솟값 ${minVal} (x = ${a})`;
            const distractors = [
              `극댓값 ${minVal} (x = ${a}), 극솟값 ${maxVal} (x = ${-a})`,
              `극댓값 ${maxVal} (x = ${a}), 극솟값 ${minVal} (x = ${-a})`,
              `극댓값 ${maxVal + 2}, 극솟값 ${minVal - 2}`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `삼차함수 ${fStr} 의 극댓값과 극솟값을 바르게 구한 것은?`,
              variablesInfo: { 함수: fStr, 극대점: -a, 극소점: a, 극댓값: maxVal, 극솟값: minVal },
              figure: { type: 'cubic', poly: { a3: 1, a1: -3 * a * a, a0: c }, crit: [-a, a] },
              options,
              answerIndex,
              hint: `도함수 f'(x) = 3x² − ${3 * a * a} = 3(x + ${a})(x − ${a}) = 0 의 두 근 x = ±${a}에서 극값을 갖습니다.`,
              steps: [
                `f'(x) = 3x² − ${3 * a * a} = 0 에서 x = −${a} 또는 x = ${a} 입니다.`,
                `x = −${a} 좌우에서 f'(x)가 양에서 음으로 바뀌므로 극댓값 f(−${a}) = (${-a})³ − ${3 * a * a}(${-a}) + (${c}) = ${maxVal} 입니다.`,
                `x = ${a} 좌우에서 f'(x)가 음에서 양으로 바뀌므로 극솟값 f(${a}) = (${a})³ − ${3 * a * a}(${a}) + (${c}) = ${minVal} 입니다.`
              ]
            };
          }
        },
        // ---------------------------------------------------------------------
        // HIG-15 ~ HIG-35 (1.0.2 확장): 2022 개정 공통수학1·2, 대수, 미적분Ⅰ, 확률과 통계
        // 새 유형 공용 도구는 이 즉시 실행 함수 안에만 둔다(다른 수준과 섞이지 않게).
        // ---------------------------------------------------------------------
        ...(function () {
          const SUPS = ['', '', '²', '³', '⁴', '⁵'];
          // 음수는 수학 기호 '−'로 표기
          const num = n => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
          // 괄호가 필요한 음수: (−3)
          const pn = n => (n < 0 ? `(${num(n)})` : `${n}`);
          // 0이 아닌 정수
          const nz = (rng, lo, hi) => { let v = 0; while (v === 0) v = rng.int(lo, hi); return v; };
          // 서로 다른 정수 k개 (조건 통과분만)
          function distinctInts(rng, k, lo, hi, ok = () => true) {
            for (let tries = 0; tries < 500; tries++) {
              const out = [];
              while (out.length < k) { const v = rng.int(lo, hi); if (!out.includes(v)) out.push(v); }
              if (ok(out)) return out;
            }
            throw new Error('distinctInts 실패');
          }
          // 다항식: 낮은 차수부터의 계수 배열 → "2x³ − x + 5"
          function polyStr(c, v = 'x') {
            let out = '';
            for (let d = c.length - 1; d >= 0; d--) {
              const k = c[d] || 0;
              if (k === 0) continue;
              const name = d === 0 ? '' : d === 1 ? v : v + SUPS[d];
              out += signedTerm(k, name, out === '');
            }
            return out || '0';
          }
          const termStr = (k, d, v = 'x') => signedTerm(k, d === 0 ? '' : d === 1 ? v : v + SUPS[d], true);
          const pmul = (a, b) => { const r = Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return r; };
          const fromRoots = rs => rs.reduce((acc, r) => pmul(acc, [-r, 1]), [1]);
          const pval = (c, x) => c.reduce((s, k, i) => s + k * Math.pow(x, i), 0);
          const sameArr = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if ((a[i] || 0) !== (b[i] || 0)) return false; return true; };
          // 일차 인수 (x − r)
          const lin = (r, v = 'x') => (r === 0 ? v : r > 0 ? `(${v} − ${r})` : `(${v} + ${-r})`);
          // 두 일차 인수의 곱: 근이 0이면 x를 앞에 (x(x − 3))
          const lin2 = (a, b) => (a === 0 ? 'x' + lin(b) : b === 0 ? 'x' + lin(a) : lin(a) + lin(b));
          // 유리수 [분자, 분모] (분모 > 0, 기약)
          const rr = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
          const fr = ([n, d]) => (d === 1 ? num(n) : `${n < 0 ? '−' : ''}${Math.abs(n)}/${d}`);
          // k√m (m 은 제곱 인수 없음) 꼴로 √n 정리
          function surdOf(n) {
            let k = 1, m = n;
            for (let f = 2; f * f <= m; f++) while (m % (f * f) === 0) { m /= f * f; k *= f; }
            return [k, m];
          }
          const sr = ([k, m]) => (m === 1 ? num(k) : `${k === 1 ? '' : k}√${m}`);
          // π 의 유리수배 표기: 2π/3, π, π/2, 4π
          const piStr = ([n, d]) => `${n === 1 ? '' : n}π${d === 1 ? '' : '/' + d}`;

          // 보기 구성: 값이 정답과 같거나 서로 같은 후보는 버리고, 부족하면 정답 근처 값으로 채운다
          function choices(rng, ans, cands, opt = {}) {
            const key = opt.key || (x => x), fmt = opt.fmt || num, shift = opt.shift || ((x, k) => x + k);
            const same = (a, b) => Math.abs(key(a) - key(b)) < 1e-9;
            const list = [];
            const push = c => {
              if (c === undefined || c === null || !Number.isFinite(key(c))) return;
              if (same(c, ans) || list.some(x => same(x, c))) return;
              if (opt.ok && !opt.ok(c)) return;
              list.push(c);
            };
            cands.forEach(push);
            for (let k = 1; list.length < 3 && k < 60; k++) { push(shift(ans, k)); if (list.length < 3) push(shift(ans, -k)); }
            return buildChoiceSet(rng, fmt(ans), list.slice(0, 3).map(fmt));
          }
          const RAT = { key: r => r[0] / r[1], fmt: fr, shift: (r, k) => rr(r[0] + k * r[1], r[1]) };
          const SURD = { key: s => s[0] * Math.sqrt(s[1]), fmt: sr, shift: (s, k) => [s[0] + k, s[1]], ok: s => s[0] > 0 };
          // 문자열 보기(좌표·인수분해 등): 정답과 다른 후보만 앞에서부터 3개
          function strChoices(rng, correct, cands, isWrong) {
            const list = [];
            for (const c of cands) if (c !== correct && !list.includes(c) && isWrong(c)) list.push(c);
            return buildChoiceSet(rng, correct, list.slice(0, 3));
          }

          return [
            {
              id: 'HIG-15',
              dayIndex: 14,
              unit: '공통수학1 · 다항식의 곱셈',
              standardCode: '[10공수1-01-01]',
              standardName: '다항식의 사칙연산의 원리를 설명하고, 그 계산을 할 수 있다.',
              sourceRef: '공통수학1 교과서 (다항식의 곱셈과 특정한 항의 계수)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '일차식 × 이차식에서 한 항의 계수 구하기',
                normal: '이차식 × 이차식에서 한 항의 계수 구하기',
                hard: '최고차항의 계수가 1이 아닌 이차식 × 빠진 항이 있는 삼차식'
              },
              conceptSummary: '두 다항식의 곱에서 xⁿ의 계수는 차수의 합이 n인 두 항끼리의 곱을 모두 더한 값입니다. 식 전체를 전개하지 않아도 됩니다.',
              formula: '(a₀ + a₁x + …)(b₀ + b₁x + …)에서 xⁿ의 계수 = Σ aᵢ·bⱼ (i + j = n)',
              generate(rng, { tier } = {}) {
                let A, B, k;
                if (tier === 'easy') {
                  A = [nz(rng, -6, 6), 1];
                  B = [nz(rng, -6, 6), nz(rng, -5, 5), 1];
                  k = rng.pick([1, 2]);
                } else if (tier === 'hard') {
                  A = [nz(rng, -5, 5), nz(rng, -5, 5), rng.pick([2, 3, -2])];
                  B = [nz(rng, -6, 6), nz(rng, -4, 4), nz(rng, -4, 4), rng.pick([1, 2, -1])];
                  B[rng.int(1, 2)] = 0; // 빠진 항
                  k = rng.pick([2, 3]);
                } else {
                  A = [nz(rng, -5, 5), nz(rng, -4, 4), 1];
                  B = [nz(rng, -5, 5), nz(rng, -4, 4), 1];
                  k = rng.pick([1, 2, 2, 3]);
                }
                const P = pmul(A, B);
                const parts = [];
                for (let i = 0; i < A.length; i++) {
                  const j = k - i;
                  if (j >= 0 && j < B.length && A[i] * B[j] !== 0) parts.push({ i, j, v: A[i] * B[j] });
                }
                const ans = parts.reduce((s, p) => s + p.v, 0);
                const As = polyStr(A), Bs = polyStr(B);
                const term = k === 1 ? 'x' : 'x' + SUPS[k];
                const cands = [
                  ...parts.map(p => ans - p.v),          // 곱 하나를 빠뜨림
                  ...parts.map(p => ans - 2 * p.v),      // 곱 하나의 부호 착오
                  (A[k] || 0) + (B[k] || 0),             // 같은 차수끼리 더함
                  P[k - 1], P[k + 1]                     // 이웃한 차수의 계수
                ];
                const { options, answerIndex } = choices(rng, ans, cands);
                return {
                  question: `두 다항식 A = ${As}, B = ${Bs}에 대하여 곱 AB를 전개한 식에서 ${term}의 계수는?`,
                  variablesInfo: { A: As, B: Bs, 구하는항: term },
                  options,
                  answerIndex,
                  hint: `전체를 전개하지 말고, 차수의 합이 ${k}인 (A의 항)×(B의 항)만 골라 계수를 더해 보세요.`,
                  steps: [
                    `${term}항은 A의 i차항과 B의 j차항을 곱할 때 i + j = ${k}인 경우에만 생깁니다.`,
                    `해당하는 곱은 ${parts.map(p => `(${termStr(A[p.i], p.i)})×(${termStr(B[p.j], p.j)})`).join(', ')}입니다.`,
                    `계수만 더하면 ${parts.map(p => pn(p.v)).join(' + ')} = ${num(ans)}이므로 ${term}의 계수는 ${num(ans)}입니다.`
                  ]
                };
              }
            },
            {
              id: 'HIG-16',
              dayIndex: 15,
              unit: '공통수학1 · 인수분해',
              standardCode: '[10공수1-01-03]',
              standardName: '다항식의 인수분해를 할 수 있다.',
              sourceRef: '공통수학1 교과서 (인수정리와 조립제법을 이용한 고차식의 인수분해)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '공통인수 x로 묶은 뒤 이차식 인수분해',
                normal: '인수정리 + 조립제법으로 삼차식 인수분해',
                hard: '인수정리를 두 번 써서 사차식을 인수분해(남는 이차식은 더 안 됨)'
              },
              conceptSummary: '다항식 P(x)에서 P(a) = 0이면 x − a는 P(x)의 인수입니다(인수정리). 조립제법으로 나눈 몫을 다시 인수분해합니다.',
              formula: 'P(a) = 0  ⇔  P(x) = (x − a)Q(x)',
              generate(rng, { tier } = {}) {
                let roots, quad = null, xf = false;
                if (tier === 'easy') {
                  xf = true;
                  roots = distinctInts(rng, 2, -5, 5, r => !r.includes(0) && r[0] + r[1] !== 0);
                } else if (tier === 'hard') {
                  roots = distinctInts(rng, 2, -4, 4, r => !r.includes(0) && r[0] + r[1] !== 0);
                  const p = rng.int(-3, 3);
                  const q = Math.floor((p * p) / 4) + rng.int(1, 4); // p² − 4q < 0
                  quad = [p, q];
                } else {
                  roots = distinctInts(rng, 3, -4, 4, r => !r.includes(0) && r.some(x => Math.abs(x) <= 2) && r[0] + r[1] + r[2] !== 0);
                }
                const build = (rs, qd, x) => {
                  let c = x ? [0, 1] : [1];
                  rs.forEach(r => { c = pmul(c, [-r, 1]); });
                  if (qd) c = pmul(c, [qd[1], qd[0], 1]);
                  return c;
                };
                // 같은 인수가 겹치면 (x − a)² 로 묶어 적는다
                const str = (rs, qd, x) => {
                  const srt = rs.slice().sort((a, b) => b - a);
                  const uniq = [...new Set(srt)];
                  return (x ? 'x' : '') + uniq.map(r => { const k = srt.filter(t => t === r).length; return lin(r) + (k > 1 ? SUPS[k] : ''); }).join('') + (qd ? `(${polyStr([qd[1], qd[0], 1])})` : '');
                };
                const P = build(roots, quad, xf);
                const Ps = polyStr(P);
                const correct = str(roots, quad, xf);
                const cands = [];
                roots.forEach((r, i) => cands.push([roots.map((x, j) => (j === i ? -x : x)), quad]));
                cands.push([roots.map(x => -x), quad]);
                if (quad && quad[0] !== 0) cands.push([roots, [-quad[0], quad[1]]], [roots.map(x => -x), [-quad[0], quad[1]]]);
                if (quad) cands.push([roots, [quad[0], -quad[1]]]);
                const order = rng.shuffle(cands);
                const { options, answerIndex } = strChoices(rng, correct, order.map(([rs, qd]) => str(rs, qd, xf)), s => {
                  const hit = order.find(([rs, qd]) => str(rs, qd, xf) === s);
                  return !sameArr(build(hit[0], hit[1], xf), P);
                });
                const sorted = roots.slice().sort((a, b) => b - a);
                let steps;
                if (tier === 'easy') {
                  steps = [
                    `모든 항에 x가 있으므로 공통인수 x로 묶으면 x(${polyStr([P[1], P[2], 1])})입니다.`,
                    `곱이 ${num(roots[0] * roots[1])}, 합이 ${num(roots[0] + roots[1])}인 두 수는 ${num(sorted[0])}, ${num(sorted[1])}입니다.`,
                    `따라서 ${Ps} = ${correct}입니다.`
                  ];
                } else if (tier === 'hard') {
                  const Q = build([sorted[1]], quad, false);
                  steps = [
                    `P(${num(sorted[0])}) = 0이므로 인수정리에 의해 ${lin(sorted[0])}${jo(lin(sorted[0]), '이/가')} 인수입니다. 조립제법으로 나누면 몫은 ${polyStr(Q)}입니다.`,
                    `몫에 x = ${wj(num(sorted[1]), '을/를')} 대입하면 0이므로 다시 ${lin(sorted[1])}${jo(lin(sorted[1]), '으로/로')} 나누면 몫은 ${polyStr([quad[1], quad[0], 1])}입니다.`,
                    `${polyStr([quad[1], quad[0], 1])}의 판별식은 ${num(quad[0] * quad[0] - 4 * quad[1])} < 0이라 더 이상 (계수가 실수인 범위에서) 인수분해되지 않습니다.`,
                    `따라서 ${Ps} = ${correct}입니다.`
                  ];
                } else {
                  const r0 = roots.find(x => Math.abs(x) <= 2);
                  const rest = roots.filter(x => x !== r0);
                  steps = [
                    `P(${num(r0)}) = 0이므로 인수정리에 의해 ${lin(r0)}${jo(lin(r0), '은/는')} P(x)의 인수입니다.`,
                    `조립제법으로 P(x)를 ${lin(r0)}${jo(lin(r0), '으로/로')} 나누면 몫은 ${polyStr(fromRoots(rest))}입니다.`,
                    `몫을 인수분해하면 ${rest.slice().sort((a, b) => b - a).map(r => lin(r)).join('')}이므로 ${Ps} = ${correct}입니다.`
                  ];
                }
                return {
                  question: `다항식 ${Ps}${jo(Ps, '을/를')} 인수분해한 것으로 옳은 것은?`,
                  variablesInfo: { 다항식: Ps },
                  options,
                  answerIndex,
                  hint: tier === 'easy' ? '먼저 공통인수 x로 묶어 보세요.' : '상수항의 약수 ±1, ±2, … 를 대입해 P(a) = 0이 되는 a를 찾고 조립제법으로 나누세요.',
                  steps
                };
              }
            },
            {
              id: 'HIG-17',
              dayIndex: 16,
              unit: '공통수학1 · 삼차방정식과 사차방정식',
              standardCode: '[10공수1-02-07]',
              standardName: '간단한 삼차방정식과 사차방정식을 풀 수 있다.',
              sourceRef: '공통수학1 교과서 및 고1 학력평가 (인수분해·치환을 이용한 고차방정식)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '세 실근이 모두 정수인 삼차방정식의 실근의 합',
                normal: '허근을 가진 삼차방정식에서 실근만의 합(계수만 보면 함정)',
                hard: 'x² = X로 치환하는 사차방정식에서 실근의 곱'
              },
              conceptSummary: '고차방정식은 인수정리·조립제법이나 치환(x² = X)으로 일차식·이차식의 곱으로 바꾼 뒤 각각 풉니다. 실근만 묻는다면 허근은 빼야 합니다.',
              formula: 'P(a) = 0 ⇒ P(x) = (x − a)Q(x),  x⁴ + px² + q = 0 은 X = x² 로 치환',
              generate(rng, { tier } = {}) {
                let P, what, ans, cands, steps;
                if (tier === 'easy') {
                  const rs = distinctInts(rng, 3, -5, 5, r => !r.includes(0) && r.some(x => Math.abs(x) === 1) && r[0] + r[1] + r[2] !== 0);
                  P = fromRoots(rs); what = '합';
                  ans = rs[0] + rs[1] + rs[2];
                  const s = rs.slice().sort((a, b) => a - b);
                  const r1 = rs.find(x => Math.abs(x) === 1);
                  cands = [-ans, ans - s[0], ans - s[2], rs[0] * rs[1] * rs[2]];
                  steps = [
                    `x = ${wj(num(r1), '을/를')} 대입하면 0이므로 ${lin(r1)}${jo(lin(r1), '은/는')} 인수입니다.`,
                    `조립제법으로 인수분해하면 ${s.map(r => lin(r)).join('')} = 0이므로 실근은 x = ${s.map(num).join(', ')}입니다.`,
                    `모든 실근의 합은 ${s.map(pn).join(' + ')} = ${num(ans)}입니다.`
                  ];
                } else if (tier === 'hard') {
                  const m = rng.pick([2, 3, 4, 5, 6, 7, 9]);
                  const n = rng.int(1, 6);
                  P = pmul([-m, 0, 1], [n, 0, 1]); what = '곱';
                  ans = -m;
                  cands = [-m * n, m, m * n, n - m];
                  const rt = sr(surdOf(m));
                  steps = [
                    `x² = X로 치환하면 X²${signedTerm(n - m, 'X')}${signedTerm(-m * n, '')} = 0, 즉 (X − ${m})(X + ${n}) = 0입니다.`,
                    `x² = ${m}에서 x = ±${rt}(실근), x² = −${n}에서 x = ±${n === 1 ? '' : sr(surdOf(n))}i(허근)입니다.`,
                    `실근만 곱하면 ${rt} × (−${rt}) = ${num(ans)}입니다. (네 근 전체의 곱 ${wj(num(-m * n), '과/와')} 헷갈리지 않기!)`
                  ];
                } else {
                  const r = nz(rng, -3, 3);
                  const p = nz(rng, -4, 4);
                  const q = Math.floor((p * p) / 4) + rng.int(1, 4);
                  P = pmul([-r, 1], [q, p, 1]); what = '합';
                  ans = r;
                  cands = [r - p, -(r - p), r + p, -r];
                  steps = [
                    `x = ${wj(num(r), '을/를')} 대입하면 0이므로 조립제법으로 나누면 (${lin(r).replace(/[()]/g, '')})(${polyStr([q, p, 1])}) = 0입니다.`,
                    `${polyStr([q, p, 1])} = 0의 판별식은 ${num(p * p - 4 * q)} < 0이므로 두 근은 허근입니다.`,
                    `따라서 실근은 x = ${num(r)} 하나뿐이고, 실근의 합은 ${num(ans)}입니다. (x²의 계수로 구한 세 근의 합 ${wj(num(r - p), '은/는')} 허근까지 더한 값)`
                  ];
                }
                const Ps = polyStr(P);
                const { options, answerIndex } = choices(rng, ans, cands);
                return {
                  question: `방정식 ${Ps} = 0의 모든 실근의 ${what}은?`,
                  variablesInfo: { 방정식: `${Ps} = 0`, 구하는값: what },
                  options,
                  answerIndex,
                  hint: tier === 'hard' ? 'x² = X로 놓으면 X에 대한 이차방정식이 됩니다. x² = (음수)에서는 실근이 나오지 않아요.' : '인수정리로 근 하나를 찾아 조립제법으로 나눈 뒤, 남은 이차식의 판별식을 확인하세요.',
                  steps
                };
              }
            },
            {
              id: 'HIG-18',
              dayIndex: 17,
              unit: '공통수학1 · 연립일차부등식',
              standardCode: '[10공수1-02-09]',
              standardName: '미지수가 1개인 연립일차부등식을 풀 수 있다.',
              sourceRef: '공통수학1 교과서 (연립일차부등식과 A < B < C 꼴 부등식)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '한쪽 변에만 x가 있는 연립부등식, 정수 경계',
                normal: '양변에 x가 있는 연립부등식, 음수로 나눌 때 부등호 방향 주의',
                hard: 'A < B ≤ C 꼴 부등식, 분수 경계'
              },
              conceptSummary: '연립부등식은 각 부등식의 해를 구해 수직선에서 공통부분을 찾습니다. 음수로 양변을 나누면 부등호 방향이 바뀝니다.',
              formula: 'A < B < C  ⇔  A < B 그리고 B < C',
              generate(rng, { tier } = {}) {
                const SYM = { '>': ['>', '≥'], '<': ['<', '≤'] };
                const flip = d => (d === '>' ? '<' : '>');
                // kx (dir) n 이 되는 부등식 a x + b ? (a − k) x + (b + n)
                const mk = (dir, strict, k, n, a, b) => {
                  const d2 = k > 0 ? dir : flip(dir);
                  return `${polyStr([b, a])} ${SYM[d2][strict ? 0 : 1]} ${polyStr([b + n, a - k])}`;
                };
                // 글자 그대로 kx (op) n
                const lit = (dir, strict, k, n) => x => { const lhs = k * x; return dir === '>' ? (strict ? lhs > n : lhs >= n) : (strict ? lhs < n : lhs <= n); };
                // mk()로 쓴 부등식의 실제 참·거짓(k < 0 이면 쓸 때 부등호를 뒤집었으므로 해는 x (dir) n/k)
                const sat = (dir, strict, k, n) => lit(k > 0 ? dir : flip(dir), strict, k, n);
                const bStr = (dir, strict, k, n) => `x ${SYM[dir][strict ? 0 : 1]} ${fr(rr(n, k))}`;
                let s1, s2, f1, f2, b1, b2, chain = null;
                for (let tries = 0; tries < 300; tries++) {
                  let L, U, kL, kU, sL, sU;
                  if (tier === 'easy') {
                    kL = rng.int(1, 3); kU = rng.int(1, 3);
                    L = rng.int(-5, 3); U = L + rng.int(2, 7);
                    sL = rng.next() < 0.5; sU = rng.next() < 0.5;
                    s1 = mk('>', sL, kL, kL * L, kL, nz(rng, -6, 6));
                    s2 = mk('<', sU, kU, kU * U, kU, nz(rng, -6, 6));
                    f1 = sat('>', sL, kL, kL * L); f2 = sat('<', sU, kU, kU * U);
                    b1 = bStr('>', sL, kL, kL * L); b2 = bStr('<', sU, kU, kU * U);
                  } else if (tier === 'hard') {
                    // 가운데 식 M = m x + e, 왼쪽 A = p x + f, 오른쪽 C = r x + g
                    const m = nz(rng, -3, 4), e = rng.int(-6, 6);
                    const k1 = rng.pick([-4, -3, -2, 2, 3, 4]), k2 = rng.pick([-4, -3, -2, 2, 3, 4]);
                    const p = m - k1, r = m - k2;
                    if (p === 0 || r === 0) continue;
                    const f = rng.int(-9, 9), g = rng.int(-9, 9);
                    // A < M ⇔ k1·x > f − e,  M ≤ C ⇔ k2·x ≤ g − e
                    const n1 = f - e, n2 = g - e;
                    const A = polyStr([f, p]), M = polyStr([e, m]), C = polyStr([g, r]);
                    s1 = `${A} < ${M}`; s2 = `${M} ≤ ${C}`;
                    f1 = lit('>', true, k1, n1); f2 = lit('<', false, k2, n2);
                    // 나눈 뒤의 꼴(음수로 나누면 방향 반전)
                    b1 = k1 > 0 ? bStr('>', true, k1, n1) : bStr('<', true, -k1, -n1);
                    b2 = k2 > 0 ? bStr('<', false, k2, n2) : bStr('>', false, -k2, -n2);
                    chain = `${A} < ${M} ≤ ${C}`;
                    if (Number.isInteger(n1 / k1) && Number.isInteger(n2 / k2)) continue; // 분수 경계가 하나는 있게
                  } else {
                    kL = rng.pick([-3, -2, -1, 1, 2, 3]); kU = rng.pick([-3, -2, -1, 1, 2, 3]);
                    L = rng.int(-5, 3); U = L + rng.int(2, 7);
                    sL = rng.next() < 0.5; sU = rng.next() < 0.5;
                    const aL = nz(rng, -4, 5), aU = nz(rng, -4, 5);
                    if (aL === kL || aU === kU) continue; // 양변 모두 x 가 있게
                    s1 = mk('>', sL, kL, kL * L, aL, rng.int(-6, 6));
                    s2 = mk('<', sU, kU, kU * U, aU, rng.int(-6, 6));
                    f1 = sat('>', sL, kL, kL * L); f2 = sat('<', sU, kU, kU * U);
                    b1 = bStr('>', sL, 1, L); b2 = bStr('<', sU, 1, U);
                  }
                  const xs = [];
                  let unbounded = false;
                  for (let x = -60; x <= 60; x++) if (f1(x) && f2(x)) { xs.push(x); if (Math.abs(x) === 60) unbounded = true; }
                  if (unbounded || xs.length < 2 || xs.length > 10) continue;
                  const cnt = xs.length;
                  const { options, answerIndex } = choices(rng, cnt, [cnt + 1, cnt - 1, cnt + 2, cnt - 2], { fmt: n => `${n}개`, ok: n => n > 0 });
                  return {
                    question: chain
                      ? `다음 부등식을 만족시키는 정수 x의 개수는?  [ ${chain} ]`
                      : `다음 연립부등식을 만족시키는 정수 x의 개수는?  { ${s1} ,  ${s2} }`,
                    variablesInfo: { 부등식1: s1, 부등식2: s2 },
                    options,
                    answerIndex,
                    hint: chain ? `A < B ≤ C는 'A < B'와 'B ≤ C'를 동시에 만족하는 연립부등식입니다. x의 계수가 음수면 나눌 때 부등호를 뒤집으세요.` : `각 부등식을 x에 대해 정리하고 수직선에서 공통부분을 찾으세요. 등호 포함 여부를 꼭 확인!`,
                    steps: [
                      `첫째 부등식 ${s1}${jo(s1, '을/를')} 정리하면 ${b1}입니다.`,
                      `둘째 부등식 ${s2}${jo(s2, '을/를')} 정리하면 ${b2}입니다.`,
                      `공통부분에 속하는 정수는 ${xs.map(num).join(', ')}이므로 모두 ${cnt}개입니다.`
                    ]
                  };
                }
                throw new Error('HIG-18 생성 실패');
              }
            },
            {
              id: 'HIG-19',
              dayIndex: 18,
              unit: '공통수학1 · 이차부등식',
              standardCode: '[10공수1-02-11]',
              standardName: '이차부등식과 이차함수를 연결하여 그 관계를 설명하고, 이차부등식과 연립이차부등식을 풀 수 있다.',
              sourceRef: '공통수학1 교과서 및 고1 학력평가 (이차부등식·연립이차부등식의 정수해)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '최고차항 계수 1, 두 정수 근 사이의 정수 세기',
                normal: '최고차항 계수가 음수이거나 2인 이차부등식(분수 근 포함)',
                hard: '연립이차부등식의 공통부분에서 정수 세기'
              },
              conceptSummary: '이차부등식의 해는 이차함수 y = f(x)의 그래프가 x축보다 위(> 0) 또는 아래(< 0)에 있는 x의 범위입니다. 최고차항 계수가 음수이면 양변에 −1을 곱해 부등호를 뒤집습니다.',
              formula: 'α < β일 때 (x − α)(x − β) < 0 ⇔ α < x < β,  (x − α)(x − β) > 0 ⇔ x < α 또는 x > β',
              generate(rng, { tier } = {}) {
                const holds = (c, op, x) => { const v = pval(c, x); return op === '<' ? v < 0 : op === '≤' ? v <= 0 : op === '>' ? v > 0 : v >= 0; };
                const count = list => { const xs = []; for (let x = -80; x <= 80; x++) if (list.every(([c, op]) => holds(c, op, x))) xs.push(x); return xs; };
                for (let tries = 0; tries < 300; tries++) {
                  let ineqs, steps, extra = [];
                  if (tier === 'easy') {
                    const a = rng.int(-6, 3), b = a + rng.int(2, 7);
                    const op = rng.pick(['≤', '<']);
                    const c = fromRoots([a, b]);
                    ineqs = [[c, op]];
                    steps = [
                      `${polyStr(c)} = ${lin2(a, b)}이므로 y = ${polyStr(c)}의 그래프는 x = ${num(a)}, ${num(b)}에서 x축과 만납니다.`,
                      `${op === '≤' ? '0 이하' : '0보다 작은'} 부분은 두 근 사이이므로 해는 ${num(a)} ${op} x ${op} ${num(b)}입니다.`
                    ];
                  } else if (tier === 'hard') {
                    const a1 = rng.int(-6, 0), b1 = a1 + rng.int(5, 9);
                    const a2 = rng.int(a1 - 1, b1 - 2), b2 = a2 + rng.int(1, 4);
                    const op2 = rng.pick(['>', '≥']);
                    const c1 = fromRoots([a1, b1]), c2 = fromRoots([a2, b2]);
                    ineqs = [[c1, '≤'], [c2, op2]];
                    extra = [b1 - a1 + 1];
                    steps = [
                      `${polyStr(c1)} ≤ 0 ⇔ ${lin2(a1, b1)} ≤ 0 ⇔ ${num(a1)} ≤ x ≤ ${num(b1)}입니다.`,
                      `${polyStr(c2)} ${op2} 0 ⇔ ${lin2(a2, b2)} ${op2} 0 ⇔ x ${op2 === '>' ? '<' : '≤'} ${num(a2)} 또는 x ${op2} ${num(b2)}입니다.`
                    ];
                  } else {
                    if (rng.next() < 0.5) {
                      // −(x − a)(x − b) ≥ 0  ⇔ a ≤ x ≤ b
                      const a = rng.int(-5, 2), b = a + rng.int(2, 7);
                      const op = rng.pick(['≥', '>']);
                      const c = fromRoots([a, b]).map(v => -v);
                      ineqs = [[c, op]];
                      steps = [
                        `양변에 −1을 곱하면 부등호 방향이 바뀌어 ${polyStr(c.map(v => -v))} ${op === '≥' ? '≤' : '<'} 0입니다.`,
                        `${lin2(a, b)} ${op === '≥' ? '≤' : '<'} 0이므로 해는 ${num(a)} ${op === '≥' ? '≤' : '<'} x ${op === '≥' ? '≤' : '<'} ${num(b)}입니다.`
                      ];
                    } else {
                      // (2x − s)(x − r) ≤ 0, s 홀수 → 근 s/2
                      const s = rng.pick([-7, -5, -3, -1, 1, 3, 5, 7]), r = rng.int(-4, 5);
                      if (Math.abs(s / 2 - r) < 1.5) continue;
                      const op = rng.pick(['≤', '<']);
                      const c = pmul([-s, 2], [-r, 1]);
                      const lo = Math.min(s / 2, r), hi = Math.max(s / 2, r);
                      const show = v => (Number.isInteger(v) ? num(v) : fr(rr(v * 2, 2)));
                      ineqs = [[c, op]];
                      steps = [
                        `${polyStr(c)} = (${polyStr([-s, 2])})${lin(r)}이므로 두 근은 x = ${fr(rr(s, 2))}, ${num(r)}입니다.`,
                        `최고차항 계수가 양수이므로 ${op === '≤' ? '0 이하' : '음수'}인 부분은 두 근 사이: ${show(lo)} ${op} x ${op} ${show(hi)}입니다.`
                      ];
                    }
                  }
                  const xs = count(ineqs);
                  if (xs.length < 2 || xs.length > 14 || xs.includes(80) || xs.includes(-80)) continue;
                  if (tier === 'hard' && xs.length === extra[0]) continue; // 둘째 부등식이 실제로 범위를 줄이게
                  const cnt = xs.length;
                  const strs = ineqs.map(([c, op]) => `${polyStr(c)} ${op} 0`);
                  const { options, answerIndex } = choices(rng, cnt, [cnt + 1, cnt - 1, cnt + 2, ...extra], { fmt: n => `${n}개`, ok: n => n > 0 });
                  return {
                    question: tier === 'hard'
                      ? `다음 연립부등식을 만족시키는 정수 x의 개수는?  { ${strs[0]} ,  ${strs[1]} }`
                      : `이차부등식 ${strs[0]}${jo('0', '을/를')} 만족시키는 정수 x의 개수는?`,
                    variablesInfo: tier === 'hard' ? { 부등식1: strs[0], 부등식2: strs[1] } : { 부등식1: strs[0] },
                    options,
                    answerIndex,
                    hint: '좌변을 인수분해해 두 근을 구하고, 그래프가 x축 아래(또는 위)에 있는 범위를 찾으세요. 등호가 있으면 근도 포함!',
                    steps: [...steps, `조건을 만족시키는 정수는 ${xs.map(num).join(', ')}이므로 모두 ${cnt}개입니다.`]
                  };
                }
                throw new Error('HIG-19 생성 실패');
              }
            },
            {
              id: 'HIG-20',
              dayIndex: 19,
              unit: '공통수학1 · 순열',
              standardCode: '[10공수1-03-02]',
              standardName: '순열의 개념을 이해하고, 순열의 수를 구하는 방법을 설명할 수 있다.',
              sourceRef: '공통수학1 교과서 (이웃하는·이웃하지 않는 순열)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '서로 다른 n명 중 역할이 다른 대표 뽑기(nPr)',
                normal: '특정한 사람끼리 이웃하도록 일렬로 세우기(묶어서 세기)',
                hard: '이웃하지 않게 세우기(사이사이 끼우기) 또는 양 끝 조건'
              },
              conceptSummary: '서로 다른 n개에서 r개를 택해 순서 있게 나열하는 경우의 수는 nPr = n!/(n − r)!입니다. 이웃하면 한 묶음으로, 이웃하지 않으면 나머지를 먼저 세운 뒤 사이사이에 끼웁니다.',
              formula: 'nPr = n(n − 1)⋯(n − r + 1),  이웃: (묶음 포함 개수)! × (묶음 안)!',
              generate(rng, { tier } = {}) {
                const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
                const P = (n, r) => fact(n) / fact(n - r);
                const Cc = (n, r) => P(n, r) / fact(r);
                if (tier === 'easy') {
                  const roles = rng.pick([['회장', '부회장'], ['회장', '부회장', '총무'], ['반장', '부반장'], ['대표', '부대표'], ['주장', '부주장', '기록원']]);
                  const n = rng.int(4, 9), r = roles.length;
                  const ans = P(n, r);
                  const { options, answerIndex } = choices(rng, ans, [Cc(n, r), Math.pow(n, r), n * r, P(n, r - 1)], { fmt: v => `${v}가지` });
                  return {
                    question: `서로 다른 ${n}명의 학생 중에서 ${roles.map(x => `${x} 1명`).join(', ')}${jo('1명', '을/를')} 뽑는 경우의 수는?`,
                    variablesInfo: { 전체: `${n}명`, 뽑는역할: roles.join(', ') },
                    options,
                    answerIndex,
                    hint: '역할이 서로 다르므로 뽑는 순서가 의미가 있어요. 순열 nPr을 쓰세요.',
                    steps: [
                      `${roles.map((x, i) => `${x}${jo(x, '은/는')} ${n - i}명 중 1명`).join(', ')}을 차례로 뽑습니다.`,
                      `${n}P${r} = ${Array.from({ length: r }, (_, i) => n - i).join(' × ')} = ${ans}가지입니다.`
                    ]
                  };
                }
                const [g1, g2] = rng.pick([['남학생', '여학생'], ['어른', '어린이'], ['선생님', '학생'], ['1학년', '2학년'], ['남자', '여자']]);
                let a, b, cond, ans, cands, steps;
                if (tier === 'hard') {
                  if (rng.next() < 0.5) {
                    a = rng.int(2, 4); b = rng.int(2, Math.min(3, a + 1));
                    cond = `${g2}끼리는 서로 이웃하지 않도록 서는`;
                    ans = fact(a) * P(a + 1, b);
                    cands = [fact(a + b) - fact(a + 1) * fact(b), fact(a) * fact(b), fact(a) * Cc(a + 1, b), fact(a + b)];
                    steps = [
                      `먼저 ${g1} ${a}명을 일렬로 세우는 경우의 수는 ${a}! = ${fact(a)}가지입니다.`,
                      `${g1} 사이사이와 양 끝, 모두 ${a + 1}곳 중 ${b}곳을 골라 ${g2}${jo(g2, '을/를')} 순서대로 세우면 ${a + 1}P${b} = ${P(a + 1, b)}가지입니다.`,
                      `곱의 법칙에 의해 ${fact(a)} × ${P(a + 1, b)} = ${ans}가지입니다.`
                    ];
                  } else {
                    a = rng.int(2, 4); b = rng.int(1, 3);
                    cond = `양 끝에 모두 ${wj(g1, '이/가')} 서도록 하는`;
                    ans = P(a, 2) * fact(a + b - 2);
                    cands = [Cc(a, 2) * fact(a + b - 2), P(a, 2) * fact(a + b - 2) * 2, fact(a + b) - P(a, 2) * fact(a + b - 2), P(a, 2) + fact(a + b - 2)];
                    steps = [
                      `양 끝 두 자리에 ${g1} ${a}명 중 2명을 순서 있게 세우면 ${a}P2 = ${P(a, 2)}가지입니다.`,
                      `가운데 ${a + b - 2}자리에 나머지 ${a + b - 2}명을 세우면 ${a + b - 2}! = ${fact(a + b - 2)}가지입니다.`,
                      `곱의 법칙에 의해 ${P(a, 2)} × ${fact(a + b - 2)} = ${ans}가지입니다.`
                    ];
                  }
                } else {
                  [a, b] = rng.pick([[2, 2], [2, 3], [3, 2], [3, 3], [4, 2], [4, 3], [5, 2]]);
                  cond = `${g2}끼리 모두 이웃하도록 서는`;
                  ans = fact(a + 1) * fact(b);
                  cands = [fact(a + 1), fact(a + b), fact(a) * fact(b), fact(a + 1) * fact(b) * 2];
                  steps = [
                    `이웃하는 ${g2} ${b}명을 한 묶음으로 보면 ${g1} ${a}명과 묶음 1개, 모두 ${a + 1}개를 일렬로 세우는 경우의 수는 ${a + 1}! = ${fact(a + 1)}가지입니다.`,
                    `묶음 안에서 ${g2} ${b}명이 자리를 바꾸는 경우의 수는 ${b}! = ${fact(b)}가지입니다.`,
                    `곱의 법칙에 의해 ${fact(a + 1)} × ${fact(b)} = ${ans}가지입니다.`
                  ];
                }
                const { options, answerIndex } = choices(rng, ans, cands, { fmt: v => `${v}가지`, ok: v => v > 0 });
                return {
                  question: `${g1} ${a}명과 ${g2} ${b}명이 일렬로 설 때, ${cond} 경우의 수는?`,
                  variablesInfo: { [g1]: `${a}명`, [g2]: `${b}명`, 조건: cond },
                  options,
                  answerIndex,
                  hint: tier === 'hard' ? '조건이 걸린 사람(자리)부터 먼저 정하고, 나머지를 세우는 경우를 곱하세요.' : '이웃하는 사람들을 한 묶음으로 생각해 세운 뒤, 묶음 안의 순서도 곱하세요.',
                  steps
                };
              }
            },
            {
              id: 'HIG-21',
              dayIndex: 20,
              unit: '공통수학1 · 행렬의 연산',
              standardCode: '[10공수1-04-02]',
              standardName: '행렬의 연산을 수행하고, 관련된 문제를 해결할 수 있다.',
              sourceRef: '공통수학1 교과서 (행렬의 덧셈·뺄셈·실수배·곱셈)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '행렬의 실수배와 덧셈·뺄셈',
                normal: '행렬의 곱셈 AB 또는 BA',
                hard: 'A² − AB, AB − BA 처럼 곱셈이 섞인 식의 한 성분'
              },
              conceptSummary: '행렬의 곱 AB의 (i, j) 성분은 A의 i행과 B의 j열의 성분을 차례로 곱해 더한 값입니다. 일반적으로 AB ≠ BA입니다.',
              formula: '(a b ; c d)(p q ; r s) = (ap + br  aq + bs ; cp + dr  cq + ds)',
              generate(rng, { tier } = {}) {
                const ent = (lo, hi) => [[rng.int(lo, hi), rng.int(lo, hi)], [rng.int(lo, hi), rng.int(lo, hi)]];
                const mm = (X, Y) => [[X[0][0] * Y[0][0] + X[0][1] * Y[1][0], X[0][0] * Y[0][1] + X[0][1] * Y[1][1]], [X[1][0] * Y[0][0] + X[1][1] * Y[1][0], X[1][0] * Y[0][1] + X[1][1] * Y[1][1]]];
                const lc = (X, p, Y, q) => X.map((r, i) => r.map((x, j) => p * x + q * Y[i][j]));
                const sum = X => X[0][0] + X[0][1] + X[1][0] + X[1][1];
                const ms = X => `(${X[0].map(num).join(' ')} ; ${X[1].map(num).join(' ')})`;
                const A = tier === 'hard' ? ent(-2, 3) : ent(-3, 4);
                const B = tier === 'hard' ? ent(-2, 3) : ent(-3, 4);
                let expr, target, ans, cands, steps, R;
                if (tier === 'easy') {
                  const p = rng.int(1, 3), q = rng.pick([1, 2]) * rng.pick([1, -1]);
                  expr = `${p === 1 ? '' : p}A ${q > 0 ? '+' : '−'} ${Math.abs(q) === 1 ? '' : Math.abs(q)}B`;
                  R = lc(A, p, B, q);
                  target = '모든 성분의 합';
                  ans = sum(R);
                  cands = [sum(lc(A, p, B, -q)), sum(A) + q / Math.abs(q) * sum(B), p * sum(A) + sum(B), sum(A) + sum(B)];
                  steps = [
                    `실수배는 모든 성분에, 덧셈·뺄셈은 같은 위치의 성분끼리 계산합니다.`,
                    `${expr} = ${ms(R)}입니다.`,
                    `모든 성분의 합은 ${R.flat().map(pn).join(' + ')} = ${num(ans)}입니다.`
                  ];
                } else if (tier === 'hard') {
                  const kind = rng.pick(['A² − AB', 'AB − BA', 'A² − 2A', 'B² + AB']);
                  const AA = mm(A, A), AB = mm(A, B), BA = mm(B, A), BB = mm(B, B);
                  R = kind === 'A² − AB' ? lc(AA, 1, AB, -1) : kind === 'AB − BA' ? lc(AB, 1, BA, -1) : kind === 'A² − 2A' ? lc(AA, 1, A, -2) : lc(BB, 1, AB, 1);
                  const i = rng.int(0, 1), j = rng.int(0, 1);
                  expr = kind; target = `(${i + 1}, ${j + 1}) 성분`;
                  ans = R[i][j];
                  const sq = X => X.map(r => r.map(x => x * x));
                  const wrong = kind === 'A² − AB' ? [lc(AA, 1, BA, -1), lc(sq(A), 1, AB, -1), lc(AA, 1, AB, 1)]
                    : kind === 'AB − BA' ? [lc(BA, 1, AB, -1), lc(AB, 1, BA, 1), AB]
                      : kind === 'A² − 2A' ? [lc(sq(A), 1, A, -2), AA, lc(AA, 1, A, 2)]
                        : [lc(BB, 1, BA, 1), lc(sq(B), 1, AB, 1), lc(BB, 1, AB, -1)];
                  cands = [...wrong.map(W => W[i][j]), R[j][i], R[1 - i][1 - j]];
                  const parts = kind === 'A² − AB' ? [['A²', AA], ['AB', AB]] : kind === 'AB − BA' ? [['AB', AB], ['BA', BA]] : kind === 'A² − 2A' ? [['A²', AA], ['2A', lc(A, 2, A, 0)]] : [['B²', BB], ['AB', AB]];
                  steps = [
                    `${parts[0][0]} = ${ms(parts[0][1])}, ${parts[1][0]} = ${ms(parts[1][1])}입니다.`,
                    `${kind} = ${ms(R)}입니다.`,
                    `따라서 (${i + 1}, ${j + 1}) 성분은 ${num(ans)}입니다.`
                  ];
                } else {
                  const ab = rng.next() < 0.6;
                  expr = ab ? 'AB' : 'BA';
                  const [X, Y] = ab ? [A, B] : [B, A];
                  R = mm(X, Y);
                  const bySum = rng.next() < 0.5;
                  const i = rng.int(0, 1), j = rng.int(0, 1);
                  target = bySum ? '모든 성분의 합' : `(${i + 1}, ${j + 1}) 성분`;
                  const pick = M => (bySum ? sum(M) : M[i][j]);
                  ans = pick(R);
                  const elem = X.map((r, a) => r.map((x, b) => x * Y[a][b]));
                  const rowrow = [[X[0][0] * Y[0][0] + X[0][1] * Y[0][1], X[0][0] * Y[1][0] + X[0][1] * Y[1][1]], [X[1][0] * Y[0][0] + X[1][1] * Y[0][1], X[1][0] * Y[1][0] + X[1][1] * Y[1][1]]];
                  cands = [pick(mm(Y, X)), pick(elem), pick(rowrow), bySum ? sum(X) * sum(Y) : R[j][i]];
                  steps = [
                    `${expr}의 (i, j) 성분은 ${ab ? 'A' : 'B'}의 i행과 ${ab ? 'B' : 'A'}의 j열을 차례로 곱해 더한 값입니다.`,
                    `${expr} = ${ms(R)}입니다.`,
                    bySum ? `모든 성분의 합은 ${R.flat().map(pn).join(' + ')} = ${num(ans)}입니다.` : `따라서 ${target}${jo(target, '은/는')} ${num(ans)}입니다.`
                  ];
                }
                const { options, answerIndex } = choices(rng, ans, cands);
                return {
                  question: `두 행렬 A = ${ms(A)}, B = ${ms(B)}에 대하여 행렬 ${expr}의 ${target}${jo(target, '은/는')}? (; 앞은 1행, 뒤는 2행)`,
                  variablesInfo: { A: ms(A), B: ms(B) },
                  options,
                  answerIndex,
                  hint: tier === 'easy' ? '같은 위치의 성분끼리 계산하세요.' : '곱셈은 (앞 행렬의 행) · (뒤 행렬의 열) 순서로 곱해 더합니다. AB와 BA는 다를 수 있어요.',
                  steps
                };
              }
            },
            {
              id: 'HIG-22',
              dayIndex: 21,
              unit: '공통수학2 · 점과 직선 사이의 거리',
              standardCode: '[10공수2-01-03]',
              standardName: '점과 직선 사이의 거리를 구하고, 관련된 문제를 해결할 수 있다.',
              sourceRef: '공통수학2 교과서 (점과 직선 사이의 거리 공식, 평행한 두 직선 사이의 거리)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '원점과 직선 사이의 거리',
                normal: '좌표가 주어진 점과 직선 사이의 거리',
                hard: '계수가 배수로 다른 평행한 두 직선 사이의 거리(분수 답 포함)'
              },
              conceptSummary: '점 (x₁, y₁)과 직선 ax + by + c = 0 사이의 거리는 |ax₁ + by₁ + c| / √(a² + b²)입니다. 평행한 두 직선 사이의 거리는 한 직선 위의 점에서 다른 직선까지의 거리입니다.',
              formula: 'd = |ax₁ + by₁ + c| / √(a² + b²)',
              generate(rng, { tier } = {}) {
                const [a, b, L] = rng.pick([[3, 4, 5], [4, 3, 5], [3, -4, 5], [4, -3, 5], [5, 12, 13], [12, 5, 13], [5, -12, 13], [6, 8, 10], [8, -6, 10]]);
                const lineStr = (p, q, c) => `${signedTerm(p, 'x', true)}${signedTerm(q, 'y')}${signedTerm(c, '')} = 0`;
                if (tier === 'hard') {
                  const k = rng.pick([2, 3]);
                  let c1, c2;
                  do { c1 = nz(rng, -9, 9); c2 = nz(rng, -15, 15); } while (k * c1 === c2);
                  const ans = rr(Math.abs(k * c1 - c2), k * L);
                  const l1 = lineStr(a, b, c1), l2 = lineStr(k * a, k * b, c2);
                  const { options, answerIndex } = choices(rng, ans, [rr(Math.abs(c1 - c2), L), rr(Math.abs(k * c1 - c2), L), rr(Math.abs(c1 - c2), k * L), rr(Math.abs(k * c1 + c2), k * L)], { ...RAT, ok: r => r[0] > 0 });
                  return {
                    question: `평행한 두 직선 ${l1}, ${l2} 사이의 거리는?`,
                    variablesInfo: { 직선1: l1, 직선2: l2 },
                    options,
                    answerIndex,
                    hint: `두 직선의 x, y 계수를 똑같이 맞춘 뒤(첫 직선에 ${wj(k, '을/를')} 곱하기) 상수항의 차를 이용하세요.`,
                    steps: [
                      `첫째 직선의 양변에 ${wj(k, '을/를')} 곱하면 ${lineStr(k * a, k * b, k * c1)}이므로 두 직선의 x, y 계수가 같아집니다.`,
                      `평행한 두 직선 ax + by + c = 0, ax + by + c' = 0 사이의 거리는 |c − c'| / √(a² + b²)입니다.`,
                      `|${num(k * c1)} − ${pn(c2)}| / √(${pn(k * a)}² + ${pn(k * b)}²) = ${Math.abs(k * c1 - c2)} / ${k * L} = ${fr(ans)}입니다.`
                    ]
                  };
                }
                const d = tier === 'easy' ? rng.int(1, 4) : rng.int(1, 5);
                const [x0, y0] = tier === 'easy' ? [0, 0] : [rng.int(-4, 5), rng.int(-4, 5)];
                const sgn = rng.pick([1, -1]);
                const c = sgn * d * L - a * x0 - b * y0;
                if (c === 0) return this.generate(rng, { tier });
                const ls = lineStr(a, b, c);
                const ans = rr(d, 1);
                const cands = [rr(d * L, 1), rr(Math.abs(c), L), rr(Math.abs(a * x0 + b * y0 - c), L), rr(Math.abs(c), L * L), rr(Math.abs(a * x0 + b * y0 + c), Math.abs(a) + Math.abs(b))];
                const { options, answerIndex } = choices(rng, ans, cands, { ...RAT, ok: r => r[0] > 0 });
                const ptName = tier === 'easy' ? '원점' : `점 (${num(x0)}, ${num(y0)})`;
                return {
                  question: `${wj(ptName, '과/와')} 직선 ${ls} 사이의 거리는?`,
                  variablesInfo: { 점: `(${x0}, ${y0})`, 직선: ls },
                  options,
                  answerIndex,
                  hint: `점과 직선 사이의 거리 공식 |ax₁ + by₁ + c| / √(a² + b²)에 대입하세요. √(${a}² + ${pn(b)}²) = ${L}입니다.`,
                  steps: [
                    `분모: √(${a}² + ${pn(b)}²) = √${L * L} = ${L}입니다.`,
                    `분자: |${a}×${pn(x0)} + ${pn(b)}×${pn(y0)} + ${pn(c)}| = ${d * L}입니다.`,
                    `따라서 거리는 ${d * L} / ${L} = ${d}입니다.`
                  ]
                };
              }
            },
            {
              id: 'HIG-23',
              dayIndex: 22,
              unit: '공통수학2 · 원과 직선의 위치 관계',
              standardCode: '[10공수2-01-05]',
              standardName: '좌표평면에서 원과 직선의 위치 관계를 판단하고, 이를 활용하여 문제를 해결할 수 있다.',
              sourceRef: '공통수학2 교과서 및 고1 학력평가 (중심과 직선 사이의 거리로 위치 관계 판단)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '중심이 원점인 원에 접하는 직선의 양수 k',
                normal: '중심이 (a, b)인 원에 접하는 모든 k의 합',
                hard: '서로 다른 두 점에서 만나도록 하는 자연수 k의 개수'
              },
              conceptSummary: '원의 중심과 직선 사이의 거리를 d, 반지름을 r이라 하면 d < r이면 두 점에서 만나고, d = r이면 접하고, d > r이면 만나지 않습니다.',
              formula: 'd = |ap + bq + k| / √(a² + b²)  vs  r',
              generate(rng, { tier } = {}) {
                const [a, b, L] = rng.pick([[3, 4, 5], [4, 3, 5], [3, -4, 5], [4, -3, 5], [5, 12, 13], [12, -5, 13], [6, 8, 10]]);
                const lineK = `${signedTerm(a, 'x', true)}${signedTerm(b, 'y')} + k = 0`;
                const sh = (v, n) => `(${v} ${n > 0 ? '−' : '+'} ${Math.abs(n)})²`;
                const kx = s => (s === 0 ? 'k' : `k ${s > 0 ? '+' : '−'} ${Math.abs(s)}`);
                if (tier === 'easy') {
                  const r = rng.int(1, 4);
                  const C = `x² + y² = ${r * r}`;
                  const ans = r * L;
                  const { options, answerIndex } = choices(rng, ans, [r, r * r * L, L, r * L * L], { ok: v => v > 0 });
                  return {
                    question: `원 ${wj(C, '과/와')} 직선 ${wj(lineK, '이/가')} 접할 때, 양수 k의 값은?`,
                    variablesInfo: { 원: C, 직선: lineK },
                    options,
                    answerIndex,
                    hint: '원의 중심 (0, 0)과 직선 사이의 거리가 반지름과 같아야 접합니다.',
                    steps: [
                      `중심 (0, 0)과 직선 사이의 거리는 |k| / √(${a}² + ${pn(b)}²) = |k| / ${L}입니다.`,
                      `반지름이 ${r}이므로 |k| / ${L} = ${r}, 즉 |k| = ${ans}입니다.`,
                      `k > 0이므로 k = ${ans}입니다.`
                    ]
                  };
                }
                const p = nz(rng, -3, 3), q = nz(rng, -3, 3), r = rng.int(1, 3);
                const C = `${sh('x', p)} + ${sh('y', q)} = ${r * r}`;
                const s = a * p + b * q;
                if (tier === 'hard') {
                  const ks = [];
                  for (let k = 1; k <= 200; k++) if (Math.abs(s + k) < r * L) ks.push(k);
                  if (ks.length < 1 || ks.length === 2 * r * L - 1) return this.generate(rng, { tier });
                  const ans = ks.length;
                  const { options, answerIndex } = choices(rng, ans, [2 * r * L - 1, ans + 1, ans + 2, 2 * r * L + 1], { fmt: v => `${v}개`, ok: v => v > 0 });
                  return {
                    question: `원 ${wj(C, '과/와')} 직선 ${wj(lineK, '이/가')} 서로 다른 두 점에서 만나도록 하는 자연수 k의 개수는?`,
                    variablesInfo: { 원: C, 직선: lineK },
                    options,
                    answerIndex,
                    hint: '중심과 직선 사이의 거리 < 반지름이 조건입니다. 절댓값 부등식을 풀고 k가 자연수인 것만 세세요.',
                    steps: [
                      `${wj(`중심 (${num(p)}, ${num(q)})`, '과/와')} 직선 사이의 거리는 |${a}×${pn(p)} + ${pn(b)}×${pn(q)} + k| / ${L} = |${kx(s)}| / ${L}입니다.`,
                      `서로 다른 두 점에서 만나려면 |${kx(s)}| < ${r * L}, 즉 ${num(-s - r * L)} < k < ${num(-s + r * L)}입니다.`,
                      `이 중 자연수 k는 ${ks[0]}부터 ${ks[ks.length - 1]}까지 ${ans}개입니다.`
                    ]
                  };
                }
                const ans = -2 * s;
                const { options, answerIndex } = choices(rng, ans, [2 * s, -s, 2 * r * L, -2 * s + 2 * r * L]);
                return {
                  question: `원 ${wj(C, '과/와')} 직선 ${wj(lineK, '이/가')} 접하도록 하는 모든 상수 k의 값의 합은?`,
                  variablesInfo: { 원: C, 직선: lineK },
                  options,
                  answerIndex,
                  hint: '중심과 직선 사이의 거리가 반지름과 같다는 식을 세우면 절댓값 방정식이 됩니다.',
                  steps: [
                    `${wj(`중심 (${num(p)}, ${num(q)})`, '과/와')} 직선 사이의 거리는 |${a}×${pn(p)} + ${pn(b)}×${pn(q)} + k| / ${L} = |${kx(s)}| / ${L}입니다.`,
                    `접하려면 이 값이 반지름 ${wj(r, '과/와')} 같아야 하므로 ${kx(s)} = ±${r * L}, 즉 k = ${num(-s + r * L)} 또는 k = ${num(-s - r * L)}입니다.`,
                    `두 값의 합은 ${num(ans)}입니다.`
                  ]
                };
              }
            },
            {
              id: 'HIG-24',
              dayIndex: 23,
              unit: '공통수학2 · 대칭이동',
              standardCode: '[10공수2-01-07]',
              standardName: '원점, x축, y축, 직선 y = x에 대한 대칭이동을 탐구하고, 실생활과 연결하여 문제를 해결할 수 있다.',
              sourceRef: '공통수학2 교과서 (점의 대칭이동과 넓이)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '점을 한 번 대칭이동',
                normal: '점을 두 번 연달아 대칭이동',
                hard: '대칭이동한 두 점과 처음 점이 만드는 삼각형의 넓이'
              },
              conceptSummary: 'x축 대칭: (x, y) → (x, −y), y축 대칭: (x, y) → (−x, y), 원점 대칭: (x, y) → (−x, −y), 직선 y = x 대칭: (x, y) → (y, x)',
              formula: '(a, b) → x축 (a, −b) · y축 (−a, b) · 원점 (−a, −b) · y = x (b, a)',
              generate(rng, { tier } = {}) {
                const T = {
                  'x축': ([x, y]) => [x, -y],
                  'y축': ([x, y]) => [-x, y],
                  '원점': ([x, y]) => [-x, -y],
                  '직선 y = x': ([x, y]) => [y, x]
                };
                const names = Object.keys(T);
                const pt = ([x, y]) => `(${num(x)}, ${num(y)})`;
                const [a, b] = distinctInts(rng, 2, -6, 6, r => r[0] !== 0 && r[1] !== 0 && Math.abs(r[0]) !== Math.abs(r[1]));
                const A = [a, b];
                const rule = n => (n === 'x축' ? 'y좌표의 부호' : n === 'y축' ? 'x좌표의 부호' : n === '원점' ? 'x, y좌표의 부호' : 'x, y좌표의 자리');
                if (tier === 'hard') {
                  const [n1, n2] = rng.shuffle(names).slice(0, 2);
                  const B = T[n1](A), C = T[n2](A);
                  const cross = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
                  if (cross === 0) return this.generate(rng, { tier });
                  const ans = rr(Math.abs(cross), 2);
                  const { options, answerIndex } = choices(rng, ans, [rr(Math.abs(cross), 1), rr(Math.abs(cross), 4), rr(Math.abs(a * b), 1), rr(Math.abs(cross) + 2, 2)], { ...RAT, ok: r => r[0] > 0 });
                  const ptA = `A(${num(a)}, ${num(b)})`;
                  return {
                    question: `점 ${wj(ptA, '을/를')} ${n1}에 대하여 대칭이동한 점을 B, ${n2}에 대하여 대칭이동한 점을 C라 할 때, 삼각형 ABC의 넓이는?`,
                    variablesInfo: { 점A: pt(A), 대칭1: n1, 대칭2: n2 },
                    options,
                    answerIndex,
                    hint: '두 점 B, C의 좌표를 먼저 구한 뒤 좌표평면에 세 점을 찍어 넓이를 구하세요(신발끈 공식도 가능).',
                    steps: [
                      `${n1}에 대한 대칭이동은 ${rule(n1)}${jo(rule(n1), '을/를')} 바꾸므로 B${pt(B)}, ${n2}에 대한 대칭이동으로 C${pt(C)}입니다.`,
                      `신발끈 공식: 넓이 = ½|(x_B − x_A)(y_C − y_A) − (x_C − x_A)(y_B − y_A)| = ½ × ${Math.abs(cross)}입니다.`,
                      `따라서 삼각형 ABC의 넓이는 ${fr(ans)}입니다.`
                    ]
                  };
                }
                let ans, question, steps, alts;
                if (tier === 'easy') {
                  const n1 = rng.pick(names);
                  ans = T[n1](A);
                  alts = names.filter(n => n !== n1).map(n => T[n](A));
                  question = `점 ${wj(pt(A), '을/를')} ${n1}에 대하여 대칭이동한 점의 좌표는?`;
                  steps = [`${n1}에 대하여 대칭이동하면 ${rule(n1)}${jo(rule(n1), '이/가')} 바뀝니다.`, `따라서 ${pt(A)} → ${pt(ans)}입니다.`];
                } else {
                  const [n1, n2] = rng.shuffle(names).slice(0, 2);
                  const mid = T[n1](A);
                  ans = T[n2](mid);
                  alts = [T[n1](T[n2](A)), mid, T[n2](A), [-ans[0], -ans[1]], [ans[1], ans[0]]];
                  question = `점 ${wj(pt(A), '을/를')} ${n1}에 대하여 대칭이동한 후, 다시 ${n2}에 대하여 대칭이동한 점의 좌표는?`;
                  steps = [
                    `${n1}에 대하여 대칭이동하면 ${pt(A)} → ${pt(mid)}입니다.`,
                    `다시 ${n2}에 대하여 대칭이동하면 ${pt(mid)} → ${pt(ans)}입니다.`
                  ];
                }
                const fill = [[ans[0], -ans[1]], [-ans[0], ans[1]], [-ans[0], -ans[1]], [ans[1], ans[0]], [-ans[1], -ans[0]]];
                const same = (u, w) => u[0] === w[0] && u[1] === w[1];
                const { options, answerIndex } = strChoices(rng, pt(ans), [...alts, ...fill].filter(u => !same(u, ans)).map(pt), () => true);
                return {
                  question,
                  variablesInfo: { 점: pt(A) },
                  options,
                  answerIndex,
                  hint: 'x축 대칭은 y부호, y축 대칭은 x부호, 원점 대칭은 둘 다 부호, y = x 대칭은 x와 y를 맞바꿉니다.',
                  steps
                };
              }
            },
            {
              id: 'HIG-25',
              dayIndex: 24,
              unit: '공통수학2 · 집합의 연산',
              standardCode: '[10공수2-02-03]',
              standardName: '집합의 연산을 수행하고, 벤 다이어그램을 이용하여 나타낼 수 있다.',
              sourceRef: '공통수학2 교과서 (합집합의 원소의 개수, 포함과 배제)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: 'n(A ∪ B) = n(A) + n(B) − n(A ∩ B) 바로 적용',
                normal: '실생활 조사에서 어느 쪽도 아닌 / 한쪽만 해당하는 인원',
                hard: '세 집합의 합집합 원소의 개수'
              },
              conceptSummary: '두 집합의 합집합의 원소의 개수는 각 원소의 개수를 더한 뒤 두 번 센 교집합을 한 번 뺍니다. 세 집합은 둘씩의 교집합을 빼고 셋의 교집합을 다시 더합니다.',
              formula: 'n(A ∪ B) = n(A) + n(B) − n(A ∩ B)',
              generate(rng, { tier } = {}) {
                if (tier === 'hard') {
                  // 벤 다이어그램 7개 영역부터 정해 모순 없는 값 만들기
                  const r = Array.from({ length: 7 }, () => rng.int(1, 9));
                  const [oA, oB, oC, AB, BC, CA, ABC] = r;
                  const nA = oA + AB + CA + ABC, nB = oB + AB + BC + ABC, nC = oC + BC + CA + ABC;
                  const nAB = AB + ABC, nBC = BC + ABC, nCA = CA + ABC;
                  const ans = r.reduce((s, x) => s + x, 0);
                  const singles = nA + nB + nC, pairs = nAB + nBC + nCA;
                  const { options, answerIndex } = choices(rng, ans, [singles - pairs, singles - pairs - ABC, singles, singles - pairs + 2 * ABC], { ok: v => v > 0 });
                  return {
                    question: `세 집합 A, B, C에 대하여 n(A) = ${nA}, n(B) = ${nB}, n(C) = ${nC}, n(A ∩ B) = ${nAB}, n(B ∩ C) = ${nBC}, n(C ∩ A) = ${nCA}, n(A ∩ B ∩ C) = ${ABC}일 때, n(A ∪ B ∪ C)의 값은?`,
                    variablesInfo: { 'n(A)': nA, 'n(B)': nB, 'n(C)': nC, 'n(A∩B)': nAB, 'n(B∩C)': nBC, 'n(C∩A)': nCA, 'n(A∩B∩C)': ABC },
                    options,
                    answerIndex,
                    hint: '세 집합의 포함과 배제: 하나씩 더하고, 둘씩 겹친 것을 빼고, 셋 다 겹친 것을 다시 더합니다.',
                    steps: [
                      `n(A ∪ B ∪ C) = n(A) + n(B) + n(C) − n(A ∩ B) − n(B ∩ C) − n(C ∩ A) + n(A ∩ B ∩ C)입니다.`,
                      `${nA} + ${nB} + ${nC} − ${nAB} − ${nBC} − ${nCA} + ${ABC} = ${ans}입니다.`,
                      `셋의 교집합은 더할 때 3번, 뺄 때 3번 세어져 사라지므로 마지막에 다시 더해야 합니다.`
                    ]
                  };
                }
                if (tier === 'easy') {
                  const c = rng.int(1, 8), a = c + rng.int(2, 12), b = c + rng.int(2, 12);
                  const ans = a + b - c;
                  const { options, answerIndex } = choices(rng, ans, [a + b, a + b + c, a + b - 2 * c], { ok: v => v > 0 });
                  return {
                    question: `두 집합 A, B에 대하여 n(A) = ${a}, n(B) = ${b}, n(A ∩ B) = ${c}일 때, n(A ∪ B)의 값은?`,
                    variablesInfo: { 'n(A)': a, 'n(B)': b, 'n(A∩B)': c },
                    options,
                    answerIndex,
                    hint: 'A와 B를 더하면 겹친 부분(A ∩ B)이 두 번 세어집니다.',
                    steps: [`n(A ∪ B) = n(A) + n(B) − n(A ∩ B)입니다.`, `${a} + ${b} − ${c} = ${ans}입니다.`]
                  };
                }
                const [s1, s2] = rng.pick([['수학', '과학'], ['국어', '영어'], ['음악', '미술'], ['체육', '수학'], ['영어', '과학']]);
                const U = rng.int(25, 40);
                const c = rng.int(2, 9), a = c + rng.int(3, 12), b = c + rng.int(3, 12);
                if (a + b - c >= U) return this.generate(rng, { tier });
                const only = rng.next() < 0.4;
                const target = only ? `${s1}만 좋아하는` : '두 과목 중 어느 것도 좋아하지 않는';
                const ans = only ? a - c : U - (a + b - c);
                const cands = only ? [a, a + b - c, b - c, a - 2 * c] : [U - a - b, U - (a + b + c), a + b - c, U - a - b + 2 * c];
                const { options, answerIndex } = choices(rng, ans, cands, { fmt: v => `${v}명`, ok: v => v >= 0 });
                return {
                  question: `어느 반 학생 ${U}명 중 ${wj(s1, '을/를')} 좋아하는 학생은 ${a}명, ${wj(s2, '을/를')} 좋아하는 학생은 ${b}명, 두 과목을 모두 좋아하는 학생은 ${c}명이다. ${target} 학생 수는?`,
                  variablesInfo: { 전체: U, [s1]: a, [s2]: b, 둘다: c },
                  options,
                  answerIndex,
                  hint: `${s1}${jo(s1, '을/를')} 좋아하는 학생의 집합을 A, ${s2}${jo(s2, '을/를')} 좋아하는 학생의 집합을 B로 놓고 벤 다이어그램을 그려 보세요.`,
                  steps: only
                    ? [`${s1}만 좋아하는 학생은 n(A − B) = n(A) − n(A ∩ B)입니다.`, `${a} − ${c} = ${ans}명입니다.`]
                    : [
                      `적어도 한 과목을 좋아하는 학생은 n(A ∪ B) = ${a} + ${b} − ${c} = ${a + b - c}명입니다.`,
                      `어느 것도 좋아하지 않는 학생은 전체에서 빼서 ${U} − ${a + b - c} = ${ans}명입니다.`
                    ]
                };
              }
            },
            {
              id: 'HIG-26',
              dayIndex: 25,
              unit: '공통수학2 · 합성함수',
              standardCode: '[10공수2-03-02]',
              standardName: '함수의 합성을 설명하고, 합성함수를 구할 수 있다.',
              sourceRef: '공통수학2 교과서 (합성함수의 함숫값)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '두 일차함수의 합성함수의 함숫값',
                normal: '일차함수와 이차함수의 합성함수의 함숫값(순서 주의)',
                hard: '두 합성함수 값의 합·차 또는 세 번 합성'
              },
              conceptSummary: '(f∘g)(x) = f(g(x))는 g를 먼저 계산하고 그 결과를 f에 넣습니다. 일반적으로 f∘g ≠ g∘f입니다.',
              formula: '(f∘g)(a) = f(g(a))',
              generate(rng, { tier } = {}) {
                const F = { f: [nz(rng, -5, 5), nz(rng, -3, 3)] };
                F.g = tier === 'easy' ? [nz(rng, -5, 5), nz(rng, -3, 3)] : (tier === 'hard' ? [rng.int(-4, 4), nz(rng, -3, 3), 1] : [nz(rng, -5, 5), rng.int(-3, 3), 1]);
                const fs = `f(x) = ${polyStr(F.f)}`, gs = `g(x) = ${polyStr(F.g)}`;
                const run = (chain, x) => chain.slice().reverse().reduce((v, n) => pval(F[n], v), x);
                let terms; // [부호, 합성 순서 배열, 값]
                if (tier === 'hard') {
                  if (rng.next() < 0.5) terms = [[1, ['f', 'g'], rng.int(-2, 3)], [rng.pick([1, -1]), ['g', 'f'], rng.int(-2, 3)]];
                  else terms = [[1, rng.pick([['f', 'f', 'g'], ['g', 'f', 'f'], ['f', 'g', 'f']]), rng.int(-2, 2)]];
                } else {
                  terms = [[1, rng.pick([['f', 'g'], ['g', 'f']]), rng.int(-3, 3)]];
                }
                const ans = terms.reduce((s, [sg, ch, x]) => s + sg * run(ch, x), 0);
                const label = ch => `(${ch.join('∘')})`;
                const expr = terms.map(([sg, ch, x], i) => `${i === 0 ? '' : sg > 0 ? ' + ' : ' − '}${label(ch)}(${num(x)})`).join('');
                const rev = terms.reduce((s, [sg, ch, x]) => s + sg * run(ch.slice().reverse(), x), 0);
                const prod = terms.reduce((s, [sg, ch, x]) => s + sg * ch.reduce((p, n) => p * pval(F[n], x), 1), 0);
                const add = terms.reduce((s, [sg, ch, x]) => s + sg * ch.reduce((p, n) => p + pval(F[n], x), 0), 0);
                const { options, answerIndex } = choices(rng, ans, [rev, prod, add, -ans]);
                const steps = terms.map(([sg, ch, x]) => {
                  let v = x; const seq = [];
                  for (let i = ch.length - 1; i >= 0; i--) { const nv = pval(F[ch[i]], v); seq.push(`${ch[i]}(${num(v)}) = ${num(nv)}`); v = nv; }
                  return `${label(ch)}(${num(x)})${jo(`(${num(x)})`, '은/는')} 안쪽부터 계산: ${seq.join(', ')}이므로 ${num(v)}입니다.`;
                });
                if (terms.length > 1) steps.push(`따라서 구하는 값은 ${terms.map(([sg, ch, x]) => pn(sg * run(ch, x))).join(' + ')} = ${num(ans)}입니다.`);
                else steps.push(`따라서 ${expr} = ${num(ans)}입니다.`);
                return {
                  question: `두 함수 ${fs}, ${gs}에 대하여 ${expr}의 값은?`,
                  variablesInfo: { f: fs, g: gs },
                  options,
                  answerIndex,
                  hint: '(f∘g)(a)는 g(a)를 먼저 구하고 그 값을 f에 넣습니다. 오른쪽 함수부터!',
                  steps
                };
              }
            },
            {
              id: 'HIG-27',
              dayIndex: 26,
              unit: '공통수학2 · 유리함수',
              standardCode: '[10공수2-03-04]',
              standardName: '유리함수 y = (ax + b)/(cx + d)의 그래프를 그릴 수 있고, 그 그래프의 성질을 탐구할 수 있다.',
              sourceRef: '공통수학2 교과서 (유리함수의 점근선과 평행이동)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: 'y = k/(x − p) + q 꼴의 두 점근선',
                normal: 'y = (ax + b)/(x + c)를 변형해 점근선의 교점',
                hard: 'y = (ax + b)/(cx + d)가 y = k/x를 평행이동한 것일 때 k'
              },
              conceptSummary: 'y = k/(x − p) + q의 그래프는 y = k/x의 그래프를 x축 방향으로 p, y축 방향으로 q만큼 평행이동한 것이며 점근선은 x = p, y = q입니다.',
              formula: 'y = (ax + b)/(cx + d) = a/c + (bc − ad)/c² · 1/(x + d/c)',
              generate(rng, { tier } = {}) {
                const den = (c, d) => `${polyStr([d, c])}`;
                if (tier === 'easy') {
                  const k = nz(rng, -6, 6);
                  const [p, q] = distinctInts(rng, 2, -5, 5, r => r[0] !== 0 && r[1] !== 0 && r[0] !== -r[1]);
                  const f = `y = ${num(k)}/${lin(p)} ${q > 0 ? '+' : '−'} ${Math.abs(q)}`;
                  const asy = (x, y) => `x = ${num(x)}, y = ${num(y)}`;
                  const { options, answerIndex } = strChoices(rng, asy(p, q), [asy(-p, q), asy(q, p), asy(p, -q), asy(-p, -q), asy(p, k)], () => true);
                  return {
                    question: `유리함수 ${f}의 그래프의 두 점근선의 방정식은?`,
                    variablesInfo: { 함수: f },
                    options,
                    answerIndex,
                    hint: 'y = k/(x − p) + q는 y = k/x를 x축 방향으로 p, y축 방향으로 q만큼 평행이동한 것입니다.',
                    steps: [
                      `${wj(f, '은/는')} y = ${num(k)}/x의 그래프를 x축 방향으로 ${num(p)}, y축 방향으로 ${num(q)}만큼 평행이동한 것입니다.`,
                      `y = ${num(k)}/x의 점근선 x = 0, y = 0도 똑같이 옮겨지므로 점근선은 x = ${num(p)}, y = ${num(q)}입니다.`
                    ]
                  };
                }
                if (tier === 'hard') {
                  for (let tries = 0; tries < 300; tries++) {
                    const c = rng.pick([1, 2]), a = nz(rng, -4, 4), d = nz(rng, -5, 5), b = rng.int(-7, 7);
                    const num2 = b * c - a * d;
                    if (num2 === 0 || num2 % (c * c) !== 0 || a % c !== 0) continue;
                    const K = num2 / (c * c);
                    const f = `y = (${polyStr([b, a])})/(${den(c, d)})`;
                    const { options, answerIndex } = choices(rng, rr(K, 1), [rr(num2, 1), rr(-K, 1), rr(num2, c), rr(b - a * d, 1), rr(a * d - b * c, c * c)], RAT);
                    return {
                      question: `유리함수 ${f}의 그래프는 곡선 y = k/x를 평행이동한 것이다. 상수 k의 값은?`,
                      variablesInfo: { 함수: f },
                      options,
                      answerIndex,
                      hint: '분자를 분모로 나누어 y = (상수) + K/(x − p) 꼴로 바꾸세요. 분모의 x 계수도 밖으로 빼야 합니다.',
                      steps: [
                        `분자를 분모로 나누면 ${polyStr([b, a])} = ${pn(a / c)}(${den(c, d)}) ${signedTerm(b - (a / c) * d, '').trim() || '+ 0'}입니다.`,
                        `따라서 y = ${num(a / c)} + ${pn(b - (a / c) * d)}/(${den(c, d)})${c === 1 ? '' : ` = ${num(a / c)} + ${pn(K)}/(x ${d > 0 ? '+' : '−'} ${fr(rr(Math.abs(d), c))})`}입니다.`,
                        `이는 y = ${num(K)}/x를 평행이동한 것이므로 k = ${num(K)}입니다.`
                      ]
                    };
                  }
                  throw new Error('HIG-27 생성 실패');
                }
                const a = nz(rng, -4, 4), cc = nz(rng, -5, 5);
                let b = rng.int(-7, 7);
                if (b === a * cc) b += 1;
                const f = `y = (${polyStr([b, a])})/(${polyStr([cc, 1])})`;
                const ans = a - cc;
                const { options, answerIndex } = choices(rng, ans, [a + cc, -a - cc, cc - a, b - cc, a + b]);
                return {
                  question: `유리함수 ${f}의 그래프의 두 점근선의 교점을 (p, q)라 할 때, p + q의 값은?`,
                  variablesInfo: { 함수: f },
                  options,
                  answerIndex,
                  hint: '분모가 0이 되는 x가 세로 점근선, 분자·분모의 x의 계수의 비가 가로 점근선입니다.',
                  steps: [
                    `분모 ${polyStr([cc, 1])} = 0에서 세로 점근선은 x = ${num(-cc)}입니다.`,
                    `y = ${num(a)} + ${pn(b - a * cc)}/(${polyStr([cc, 1])})로 변형되므로 가로 점근선은 y = ${num(a)}입니다.`,
                    `교점은 (${num(-cc)}, ${num(a)})이므로 p + q = ${num(ans)}입니다.`
                  ]
                };
              }
            },
            {
              id: 'HIG-28',
              dayIndex: 27,
              unit: '대수 · 지수법칙',
              standardCode: '[12대수01-03]',
              standardName: '지수법칙을 이해하고, 이를 이용하여 식을 간단히 나타낼 수 있다.',
              sourceRef: '대수 교과서 및 고2 학력평가 2~3점 (유리수 지수의 계산)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '정수 지수의 곱·나눗셈',
                normal: '밑을 같은 소수의 거듭제곱으로 바꾸는 유리수 지수 두 개',
                hard: '음의 유리수 지수가 섞인 세 개의 곱·나눗셈'
              },
              conceptSummary: 'a > 0일 때 a^m × a^n = a^(m+n), a^m ÷ a^n = a^(m−n), (a^m)^n = a^(mn)이 유리수 지수에서도 성립합니다. 밑을 같은 수의 거듭제곱으로 맞추는 것이 핵심입니다.',
              formula: 'a^m × a^n = a^(m+n),  (a^m)^n = a^(mn),  a^(−n) = 1/aⁿ',
              generate(rng, { tier } = {}) {
                const c = rng.pick([2, 3]);
                const val = E => (E >= 0 ? rr(Math.pow(c, E), 1) : rr(1, Math.pow(c, -E)));
                if (tier === 'easy') {
                  for (;;) {
                    const m = rng.int(2, 7), n = rng.int(1, 6), k = rng.int(2, 8);
                    const E = m + n - k;
                    if (E < 0 || Math.pow(c, E) > 81) continue;
                    const expr = `${c}^${m} × ${c}^${n} ÷ ${c}^${k}`;
                    const { options, answerIndex } = choices(rng, val(E), [val(-E), rr(c * E, 1), rr(E, 1), val(E + 1), val(m * n - k)].filter(r => r[0] < 10000), RAT);
                    return {
                      question: `다음 식의 값은?  [ ${expr} ]`,
                      variablesInfo: { 식: expr },
                      options,
                      answerIndex,
                      hint: '밑이 같으면 곱할 때 지수를 더하고, 나눌 때 지수를 뺍니다.',
                      steps: [`지수법칙에 의해 ${c}^(${m} + ${n} − ${k}) = ${c}^${E}입니다.`, `${c}^${E} = ${fr(val(E))}입니다.`]
                    };
                  }
                }
                const nFac = tier === 'hard' ? 3 : 2;
                for (let tries = 0; tries < 500; tries++) {
                  const facs = [];
                  let E = 0;
                  for (let i = 0; i < nFac; i++) {
                    const q = rng.pick([2, 3]);
                    const e = rng.pick([q, 2 * q].filter(x => Math.pow(c, x) <= 81));
                    let p = tier === 'hard' ? nz(rng, -3, 3) : rng.int(1, 3) * (i === 0 ? 1 : rng.pick([1, -1]));
                    if (p % q === 0) p += p > 0 ? 1 : -1;
                    const op = i === 0 ? '' : rng.pick(['×', '÷']);
                    const pe = (e * p) / q; // 이 인수의 c 지수
                    E += op === '÷' ? -pe : pe;
                    facs.push({ op, base: Math.pow(c, e), e, p, q, pe });
                  }
                  if (!Number.isInteger(E) || E < -3 || E > 5 || Math.pow(c, Math.abs(E)) > 81) continue;
                  const expr = facs.map(f => `${f.op ? ` ${f.op} ` : ''}${f.base}^(${num(f.p)}/${f.q})`).join('');
                  const wrongE = facs.reduce((s, f) => s + f.pe, 0); // ÷ 를 × 로 착각
                  const cands = [val(-E), Number.isInteger(wrongE) && Math.abs(wrongE) <= 6 ? val(wrongE) : null, val(E + 1), val(E - 1), rr(E, 1)].filter(Boolean);
                  const { options, answerIndex } = choices(rng, val(E), cands, RAT);
                  return {
                    question: `다음 식의 값은?  [ ${expr} ]`,
                    variablesInfo: { 식: expr },
                    options,
                    answerIndex,
                    hint: `모든 밑을 ${c}의 거듭제곱으로 바꾼 뒤 (a^m)^n = a^(mn)으로 지수를 정리하세요.`,
                    steps: [
                      `밑을 ${c}의 거듭제곱으로 바꾸면 ${facs.map(f => `${f.base}^(${num(f.p)}/${f.q}) = (${c}^${f.e})^(${num(f.p)}/${f.q}) = ${c}^${pn(f.pe)}`).join(', ')}입니다.`,
                      `지수끼리 계산하면 ${facs.map((f, i) => (i === 0 ? pn(f.pe) : `${f.op === '÷' ? '−' : '+'} ${pn(f.pe)}`)).join(' ')} = ${num(E)}입니다.`,
                      `따라서 식의 값은 ${c}^${pn(E)} = ${fr(val(E))}입니다.`
                    ]
                  };
                }
                throw new Error('HIG-28 생성 실패');
              }
            },
            {
              id: 'HIG-29',
              dayIndex: 28,
              unit: '대수 · 삼각함수의 그래프',
              standardCode: '[12대수02-02]',
              standardName: '삼각함수의 개념을 이해하여 사인함수, 코사인함수, 탄젠트함수의 그래프를 그리고, 그 성질을 설명할 수 있다.',
              sourceRef: '대수 교과서 및 고2 학력평가 3점 (삼각함수의 최댓값·최솟값·주기)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: 'y = a sin x + d, y = a cos x + d의 최댓값·최솟값',
                normal: 'y = a sin bx + d의 최댓값·최솟값·주기',
                hard: '절댓값이 붙은 y = a|sin bx| + d 또는 평행이동된 y = a cos(bx − π/k) + d'
              },
              conceptSummary: 'y = a sin bx + d, y = a cos bx + d의 최댓값은 |a| + d, 최솟값은 −|a| + d, 주기는 2π/|b|입니다. 절댓값을 씌우면 아래쪽이 위로 접혀 주기가 절반이 됩니다.',
              formula: '최댓값 |a| + d,  최솟값 −|a| + d,  주기 2π/|b|  (|sin bx|의 주기 π/|b|)',
              generate(rng, { tier } = {}) {
                const fn = rng.pick(['sin', 'cos']);
                const A = rng.pick(tier === 'easy' ? [2, 3, 4, -2, -3] : [2, 3, 4, -2, -3, 5]);
                const d = rng.int(-3, 3);
                const Bc = tier === 'easy' ? 1 : rng.int(2, 4);
                const coef = A === 1 ? '' : A === -1 ? '−' : num(A);
                const tail = d === 0 ? '' : ` ${d > 0 ? '+' : '−'} ${Math.abs(d)}`;
                let f, M, m, T = null, kind = 'plain';
                if (tier === 'hard') {
                  kind = rng.pick(['abs', 'phase']);
                  if (kind === 'abs') {
                    f = `y = ${coef}|${fn} ${Bc}x|${tail}`;
                    M = A > 0 ? A + d : d; m = A > 0 ? d : A + d;
                    T = rr(1, Bc);
                  } else {
                    const k = rng.pick([2, 3, 4, 6]);
                    f = `y = ${coef}${fn}(${Bc}x − π/${k})${tail}`;
                    M = Math.abs(A) + d; m = -Math.abs(A) + d;
                    T = rr(2, Bc);
                  }
                } else {
                  f = `y = ${coef}${fn} ${Bc === 1 ? '' : Bc}x${tail}`;
                  M = Math.abs(A) + d; m = -Math.abs(A) + d;
                  if (tier !== 'easy') T = rr(2, Bc);
                }
                const opt = (mx, mn, t) => `최댓값 ${num(mx)}, 최솟값 ${num(mn)}${t ? `, 주기 ${piStr(t)}` : ''}`;
                const correct = opt(M, m, T);
                const cands = [];
                if (T) {
                  cands.push(opt(M, m, kind === 'abs' ? rr(2, Bc) : rr(1, Bc)));
                  cands.push(opt(M, m, rr(2 * Bc, 1)));
                  cands.push(opt(Math.abs(A) + d, -Math.abs(A) + d, T));
                  cands.push(opt(Math.abs(A), -Math.abs(A), T));
                  cands.push(opt(M + 1, m - 1, T));
                } else {
                  cands.push(opt(Math.abs(A), -Math.abs(A)), opt(d + 1, d - 1), opt(Math.abs(A) + d, d), opt(A + d, -A + d), opt(M + 1, m + 1));
                }
                const { options, answerIndex } = strChoices(rng, correct, cands, () => true);
                const steps = [];
                if (kind === 'abs') {
                  steps.push(`|${fn} ${Bc}x|의 값의 범위는 0 이상 1 이하입니다.`);
                  steps.push(`${coef || '1'}|${fn} ${Bc}x|의 범위는 ${A > 0 ? `0 ~ ${A}` : `${num(A)} ~ 0`}이므로 ${d ? `${wj(num(d), '을/를')} 더하면 ` : ''}최댓값 ${num(M)}, 최솟값 ${num(m)}입니다.`);
                  steps.push(`${fn} ${Bc}x의 주기는 2π/${Bc}이고, 절댓값을 씌우면 음수 부분이 접혀 올라가 주기가 절반인 ${piStr(T)}입니다.`);
                } else {
                  steps.push(`${fn}의 값은 −1 이상 1 이하이므로 ${coef || '1'}×(${fn} 값)의 범위는 −${Math.abs(A)} 이상 ${Math.abs(A)} 이하입니다.`);
                  steps.push(`${d === 0 ? '상수항이 없으므로' : `${wj(num(d), '을/를')} 더하면`} 최댓값 ${num(M)}, 최솟값 ${num(m)}입니다.`);
                  if (T) steps.push(`주기는 2π/${Bc} = ${piStr(T)}입니다.${kind === 'phase' ? ' (괄호 안 − π/k는 평행이동이라 주기·최대·최소에 영향 없음)' : ''}`);
                }
                return {
                  question: `함수 ${f}의 ${T ? '최댓값, 최솟값, 주기를' : '최댓값과 최솟값을'} 바르게 구한 것은?`,
                  variablesInfo: { 함수: f },
                  options,
                  answerIndex,
                  hint: T ? '최댓값·최솟값은 sin, cos의 범위 −1 ~ 1에서, 주기는 x의 계수에서 구합니다.' : 'sin x, cos x의 값은 항상 −1 이상 1 이하입니다.',
                  steps
                };
              }
            },
            {
              id: 'HIG-30',
              dayIndex: 29,
              unit: '대수 · 사인법칙과 코사인법칙',
              standardCode: '[12대수02-03]',
              standardName: '사인법칙과 코사인법칙을 이해하고, 실생활 문제를 해결할 수 있다.',
              sourceRef: '대수 교과서 및 고2 학력평가 3~4점 (사인법칙·코사인법칙)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '두 변과 끼인각(60°·120°)으로 나머지 한 변 — 코사인법칙',
                normal: '한 변과 두 각으로 다른 변 — 사인법칙',
                hard: 'sin A : sin B : sin C로 변의 비를 구한 뒤 코사인법칙'
              },
              conceptSummary: '사인법칙 a/sin A = b/sin B = c/sin C = 2R, 코사인법칙 a² = b² + c² − 2bc·cos A. 사인의 비는 변의 길이의 비와 같습니다.',
              formula: 'a/sin A = b/sin B,  a² = b² + c² − 2bc cos A,  sin A : sin B : sin C = a : b : c',
              generate(rng, { tier } = {}) {
                if (tier === 'hard') {
                  const [p, q, r] = distinctInts(rng, 3, 2, 9, s => s[0] + s[1] > s[2] && s[1] + s[2] > s[0] && s[0] + s[2] > s[1]);
                  const sides = { A: p, B: q, C: r };
                  const X = rng.pick(['A', 'B', 'C']);
                  const [Y, Z] = ['A', 'B', 'C'].filter(k => k !== X);
                  const x = sides[X], y = sides[Y], z = sides[Z];
                  const ans = rr(y * y + z * z - x * x, 2 * y * z);
                  const cands = [rr(-(y * y + z * z - x * x), 2 * y * z), rr(y * y + z * z - x * x, y * z), rr(y * y + z * z + x * x, 2 * y * z), rr(x * x + y * y - z * z, 2 * x * y), rr(x * x + z * z - y * y, 2 * x * z)];
                  const { options, answerIndex } = choices(rng, ans, cands, RAT);
                  const low = { A: 'a', B: 'b', C: 'c' };
                  return {
                    question: `삼각형 ABC에서 sin A : sin B : sin C = ${p} : ${q} : ${r}일 때, cos ${X}의 값은?`,
                    variablesInfo: { 사인비: `${p} : ${q} : ${r}`, 구하는각: X },
                    options,
                    answerIndex,
                    hint: '사인법칙에 의해 sin A : sin B : sin C = a : b : c 입니다. 변의 길이를 k배로 놓고 코사인법칙을 쓰세요.',
                    steps: [
                      `사인법칙에 의해 a : b : c = ${p} : ${q} : ${r}이므로 a = ${p}k, b = ${q}k, c = ${r}k (k > 0)로 놓습니다.`,
                      `코사인법칙: cos ${X} = (${low[Y]}² + ${low[Z]}² − ${low[X]}²) / (2·${low[Y]}·${low[Z]}) = (${y * y} + ${z * z} − ${x * x})k² / (${2 * y * z}k²)입니다.`,
                      `따라서 cos ${X} = ${fr(ans)}입니다.`
                    ]
                  };
                }
                if (tier === 'easy') {
                  const ang = rng.pick([60, 120]);
                  const [b, c] = distinctInts(rng, 2, 2, 8);
                  const a2 = b * b + c * c + (ang === 60 ? -1 : 1) * b * c;
                  const ans = surdOf(a2);
                  const cands = [surdOf(b * b + c * c), surdOf(b * b + c * c + (ang === 60 ? 1 : -1) * b * c), surdOf(b * b + c * c - 2 * b * c > 0 ? b * b + c * c - 2 * b * c : b * b + c * c + 2 * b * c), [b + c, 1]];
                  const { options, answerIndex } = choices(rng, ans, cands, SURD);
                  return {
                    question: `삼각형 ABC에서 b = ${b}, c = ${c}, A = ${ang}°일 때, a의 값은?`,
                    variablesInfo: { b, c, A: `${ang}°` },
                    options,
                    answerIndex,
                    hint: `두 변과 그 끼인각을 알면 코사인법칙 a² = b² + c² − 2bc cos A를 씁니다. cos ${ang}° = ${ang === 60 ? '1/2' : '−1/2'}`,
                    steps: [
                      `코사인법칙에 의해 a² = ${b}² + ${c}² − 2×${b}×${c}×cos ${ang}°입니다.`,
                      `cos ${ang}° = ${ang === 60 ? '1/2' : '−1/2'}이므로 a² = ${b * b} + ${c * c} ${ang === 60 ? '−' : '+'} ${b * c} = ${a2}입니다.`,
                      `a > 0이므로 a = ${sr(ans)}입니다.`
                    ]
                  };
                }
                // 사인법칙: sin² 값(분자/4)
                const S2 = { 30: 1, 45: 2, 60: 3, 90: 4, 120: 3, 135: 2 };
                const SN = { 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1', 120: '√3/2', 135: '√2/2' };
                for (let tries = 0; tries < 300; tries++) {
                  const [A, B] = rng.shuffle([30, 45, 60, 90, 120, 135]).slice(0, 2);
                  if (A + B >= 180) continue;
                  const a = rng.pick([2, 3, 4, 6, 8, 9, 12]);
                  // b² = a² · sin²B / sin²A
                  if ((a * a * S2[B]) % S2[A] !== 0) continue;
                  const b2 = (a * a * S2[B]) / S2[A];
                  const ans = surdOf(b2);
                  const cands = [S2[B] * a * a % S2[A] === 0 && (a * a * S2[A]) % S2[B] === 0 ? surdOf((a * a * S2[A]) / S2[B]) : null, (a * a * S2[B]) % 4 === 0 ? surdOf((a * a * S2[B]) / 4) : null, [a, 1], surdOf(2 * b2)].filter(Boolean);
                  const { options, answerIndex } = choices(rng, ans, cands, SURD);
                  return {
                    question: `삼각형 ABC에서 a = ${a}, A = ${A}°, B = ${B}°일 때, b의 값은?`,
                    variablesInfo: { a, A: `${A}°`, B: `${B}°` },
                    options,
                    answerIndex,
                    hint: '한 변과 그 대각, 다른 각을 알면 사인법칙 a/sin A = b/sin B를 씁니다.',
                    steps: [
                      `사인법칙에 의해 ${a}/sin ${A}° = b/sin ${B}°이므로 b = ${a} × sin ${B}° / sin ${A}°입니다.`,
                      `sin ${A}° = ${SN[A]}, sin ${B}° = ${SN[B]}이므로 b = ${a} × (${SN[B]}) ÷ (${SN[A]})입니다.`,
                      `계산하면 b = ${sr(ans)}입니다.`
                    ]
                  };
                }
                throw new Error('HIG-30 생성 실패');
              }
            },
            {
              id: 'HIG-31',
              dayIndex: 30,
              unit: '대수 · 합의 기호 Σ',
              standardCode: '[12대수03-04]',
              standardName: 'Σ의 뜻과 성질을 이해하고, 이를 활용하여 문제를 해결할 수 있다.',
              sourceRef: '대수 교과서 및 고2 학력평가 3점 (Σ의 성질과 자연수의 거듭제곱의 합)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: 'Σ(ak + b) — 일차식의 합',
                normal: 'Σ(k² + ak + b) — 자연수의 거듭제곱의 합 공식',
                hard: 'Σ의 성질(상수항 × n 주의) 또는 k = m부터 시작하는 합'
              },
              conceptSummary: 'Σ(a_k + b_k) = Σa_k + Σb_k, Σ c·a_k = cΣa_k, Σ c = cn (상수의 합은 n배). Σk = n(n+1)/2, Σk² = n(n+1)(2n+1)/6.',
              formula: 'Σk = n(n+1)/2,  Σk² = n(n+1)(2n+1)/6,  Σc = cn',
              generate(rng, { tier } = {}) {
                const S1 = n => (n * (n + 1)) / 2, S2 = n => (n * (n + 1) * (2 * n + 1)) / 6;
                const sig = (m, n) => `Σ(k=${m}~${n})`;
                if (tier === 'hard' && rng.next() < 0.5) {
                  const n = rng.pick([5, 8, 10, 12, 15, 20]);
                  const SA = rng.int(-20, 40), SB = rng.int(-20, 40);
                  const p = nz(rng, -4, 4), q = nz(rng, -4, 4), r = nz(rng, -5, 5);
                  const co = (k, name, first) => `${first ? (k < 0 ? '−' : '') : (k < 0 ? ' − ' : ' + ')}${Math.abs(k) === 1 ? '' : Math.abs(k)}${name}`;
                  const body = `${co(p, 'a_k', true)}${co(q, 'b_k', false)} ${r > 0 ? '+' : '−'} ${Math.abs(r)}`;
                  const ans = p * SA + q * SB + r * n;
                  const { options, answerIndex } = choices(rng, ans, [p * SA + q * SB + r, p * SA - q * SB + r * n, p * SA + q * SB, ans + r * n]);
                  return {
                    question: `${sig(1, n)} a_k = ${num(SA)}, ${sig(1, n)} b_k = ${num(SB)}일 때, ${sig(1, n)} (${body})의 값은?`,
                    variablesInfo: { Σa_k: SA, Σb_k: SB, n },
                    options,
                    answerIndex,
                    hint: `Σ는 항별로 나눌 수 있고 상수배는 밖으로 뺄 수 있어요. 상수 ${num(r)}의 합은 ${num(r)} × ${n}입니다!`,
                    steps: [
                      `${sig(1, n)} (${body}) = ${pn(p)}${sig(1, n)} a_k + ${pn(q)}${sig(1, n)} b_k + ${sig(1, n)} ${pn(r)}입니다.`,
                      `= ${pn(p)}×${pn(SA)} + ${pn(q)}×${pn(SB)} + ${pn(r)}×${n} = ${num(ans)}입니다.`
                    ]
                  };
                }
                let m = 1, n, c;
                if (tier === 'easy') { n = rng.int(5, 12); c = [rng.int(-3, 5), rng.int(1, 4)]; }
                else if (tier === 'hard') { m = rng.int(3, 6); n = m + rng.int(3, 7); c = [rng.int(-4, 4), rng.int(-3, 3), 1]; }
                else { n = rng.int(4, 10); c = [rng.int(-4, 4), nz(rng, -4, 4), 1]; }
                const sumTo = t => (c[2] || 0) * S2(t) + c[1] * S1(t) + c[0] * t;
                const ans = sumTo(n) - sumTo(m - 1);
                const body = polyStr(c, 'k');
                const cands = tier === 'hard'
                  ? [sumTo(n), sumTo(n) - sumTo(m), (c[2] || 0) * (S2(n) - S2(m - 1)) + c[1] * (S1(n) - S1(m - 1)) + c[0] * n]
                  : [ans - c[0] * n + c[0], (c[2] || 0) * S2(n) + c[1] * S1(n - 1) + c[0] * n, (c[2] || 0) * S1(n) * S1(n) + c[1] * S1(n) + c[0] * n];
                const { options, answerIndex } = choices(rng, ans, cands);
                const parts = [];
                if (c[2]) parts.push(`${sig(m, n)} k²`);
                if (c[1]) parts.push(`${c[1] === 1 ? '' : `${pn(c[1])}×`}${sig(m, n)} k`);
                if (c[0]) parts.push(`${pn(c[0])}×${tier === 'hard' ? n - m + 1 : n}`);
                const steps = [`Σ의 성질로 나누면 ${sig(m, n)} (${body}) = ${parts.join(' + ')}입니다.`];
                if (tier === 'hard') {
                  steps.push(`k = ${m}부터의 합은 (k = 1부터 ${n}까지의 합) − (k = 1부터 ${m - 1}까지의 합)으로 구합니다.`);
                  steps.push(`${sig(1, n)} (${body}) = ${num(sumTo(n))}, ${sig(1, m - 1)} (${body}) = ${num(sumTo(m - 1))}이므로 답은 ${num(sumTo(n))} − ${pn(sumTo(m - 1))} = ${num(ans)}입니다.`);
                } else {
                  steps.push(`Σk = ${n}×${n + 1}/2 = ${S1(n)}${c[2] ? `, Σk² = ${n}×${n + 1}×${2 * n + 1}/6 = ${S2(n)}` : ''}, 상수 ${num(c[0])}의 합은 ${num(c[0] * n)}입니다.`);
                  steps.push(`모두 더하면 ${num(ans)}입니다.`);
                }
                return {
                  question: `${sig(m, n)} (${body})의 값은?`,
                  variablesInfo: { 시작: m, 끝: n, 일반항: body },
                  options,
                  answerIndex,
                  hint: tier === 'hard' ? 'k = 1부터 시작하지 않으면 공식을 그대로 쓸 수 없어요. 1부터의 합에서 앞부분을 빼세요.' : 'Σk = n(n+1)/2, Σk² = n(n+1)(2n+1)/6, 상수 c의 합은 cn입니다.',
                  steps
                };
              }
            },
            {
              id: 'HIG-32',
              dayIndex: 31,
              unit: '미적분Ⅰ · 함수의 극한',
              standardCode: '[12미적Ⅰ-01-02]',
              standardName: '함수의 극한에 대한 성질을 이해하고, 함수의 극한값을 구할 수 있다.',
              sourceRef: '미적분Ⅰ 교과서 및 고2 학력평가 3~4점 (0/0 꼴 극한, 미정계수의 결정)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '분자를 인수분해해 약분하는 0/0 꼴',
                normal: '분자·분모 모두 인수분해하는 0/0 꼴 또는 ∞/∞ 꼴',
                hard: '극한값이 주어질 때 미정계수 a, b 결정'
              },
              conceptSummary: 'x → a일 때 0/0 꼴이면 분자·분모를 인수분해해 (x − a)를 약분합니다. ∞/∞ 꼴은 분모의 최고차항으로 나눕니다. 분모 → 0이고 극한값이 있으면 분자 → 0이어야 합니다.',
              formula: 'lim(x→a) (x − a)g(x) / (x − a)h(x) = g(a)/h(a),  분모 → 0 이고 극한 존재 ⇒ 분자 → 0',
              generate(rng, { tier } = {}) {
                const c = nz(rng, -3, 4);
                if (tier === 'hard') {
                  const n2 = rng.pick([1, 1, 2]);
                  const L = nz(rng, -6, 8);
                  const a = L - 2 * n2 * c, b = -n2 * c * c - a * c;
                  const tg = rng.pick(['a + b', 'ab', 'a − b']);
                  const calc = (x, y) => (tg === 'a + b' ? x + y : tg === 'ab' ? x * y : x - y);
                  const ans = calc(a, b);
                  const a2 = L + 2 * n2 * c, b2 = -n2 * c * c - a2 * c; // 부호 착오
                  const a3 = L - n2 * c, b3 = -n2 * c * c - a3 * c;      // 미분 계수 2 누락
                  const { options, answerIndex } = choices(rng, ans, [calc(a2, b2), calc(a3, b3), calc(L, -n2 * c * c - L * c), calc(a, -b)]);
                  const Ns = `${n2 === 1 ? '' : n2}x² + ax + b`;
                  return {
                    question: `lim(x→${num(c)}) (${Ns})/(${polyStr([-c, 1])}) = ${num(L)}일 때, 상수 a, b에 대하여 ${tg}의 값은?`,
                    variablesInfo: { 극한점: c, 극한값: L },
                    options,
                    answerIndex,
                    hint: 'x → c일 때 분모 → 0인데 극한값이 있으므로 분자도 0이어야 합니다. 분자 = (x − c)(일차식)으로 놓으세요.',
                    steps: [
                      `분모 → 0이고 극한값이 존재하므로 분자도 0: ${n2 * c * c} + ${pn(c)}a + b = 0, 즉 b = ${num(-n2 * c * c)} ${c > 0 ? '−' : '+'} ${Math.abs(c) === 1 ? '' : Math.abs(c)}a입니다.`,
                      `분자 = (${polyStr([-c, 1])})(${n2 === 1 ? '' : n2}x ${c > 0 ? '+' : '−'} ${Math.abs(n2 * c)} + a)로 인수분해되어 극한값은 ${num(2 * n2 * c)} + a = ${num(L)}입니다.`,
                      `a = ${num(a)}, b = ${num(b)}이므로 ${tg} = ${num(ans)}입니다.`
                    ]
                  };
                }
                if (tier === 'normal' && rng.next() < 0.4) {
                  // ∞/∞ 꼴
                  const p = nz(rng, -6, 6), q = rng.pick([1, 2, 3, 4, -2]);
                  const N = [rng.int(-5, 5), rng.int(-6, 6), p], D = [nz(rng, -5, 5), rng.int(-4, 4), q];
                  const ans = rr(p, q);
                  const cands = [rr(N[0], D[0]), D[1] !== 0 ? rr(N[1], D[1]) : null, rr(q, p), rr(0, 1)].filter(Boolean);
                  const { options, answerIndex } = choices(rng, ans, cands, RAT);
                  return {
                    question: `lim(x→∞) (${polyStr(N)})/(${polyStr(D)})의 값은?`,
                    variablesInfo: { 분자: polyStr(N), 분모: polyStr(D) },
                    options,
                    answerIndex,
                    hint: '분자·분모를 분모의 최고차항 x²으로 나누면 나머지 항은 0으로 갑니다.',
                    steps: [
                      `분자·분모를 x²으로 나누면 (${num(p)} + ${pn(N[1])}/x + ${pn(N[0])}/x²) / (${num(q)} + ${pn(D[1])}/x + ${pn(D[0])}/x²)입니다.`,
                      `x → ∞일 때 1/x, 1/x² → 0이므로 극한값은 ${num(p)}/${pn(q)}${q === 1 || (ans[1] === q && ans[0] === p) ? '' : ` = ${fr(ans)}`}입니다.`
                    ]
                  };
                }
                const r = rng.int(-5, 5);
                if (r === c) return this.generate(rng, { tier });
                let N = fromRoots([c, r]), D, ans, cands, steps;
                if (tier === 'easy') {
                  D = [-c, 1];
                  ans = rr(c - r, 1);
                  cands = [rr(r - c, 1), rr(c + r, 1), rr(0, 1), rr(2 * c, 1), rr(-r, 1)];
                  steps = [
                    `x = ${wj(num(c), '을/를')} 대입하면 0/0 꼴이므로 분자를 인수분해합니다: ${polyStr(N)} = ${lin2(c, r)}.`,
                    `${lin(c)}${jo(lin(c), '을/를')} 약분하면 lim(x→${num(c)}) ${lin(r)} = ${num(c)} − ${pn(r)} = ${num(c - r)}입니다.`
                  ];
                } else {
                  let s = rng.int(-5, 5);
                  if (s === c || s === r) s = s === 5 ? -5 : s + 1;
                  if (s === c || s === r) return this.generate(rng, { tier });
                  const k = rng.pick([1, 2]);
                  D = fromRoots([c, s]).map(v => v * k);
                  ans = rr(c - r, k * (c - s));
                  cands = [rr(k * (c - s), c - r), rr(r, k * s), rr(c - r, c - s), rr(1, k), rr(c + r, k * (c + s))];
                  steps = [
                    `x = ${num(c)}에서 분자·분모가 모두 0이므로 0/0 꼴입니다.`,
                    `분자 = ${lin2(c, r)}, 분모 = ${k === 1 ? '' : k}${lin2(c, s)}로 인수분해해 ${lin(c)}${jo(lin(c), '을/를')} 약분합니다.`,
                    `극한값은 (${num(c)} − ${pn(r)}) / (${k === 1 ? '' : `${k}×`}(${num(c)} − ${pn(s)})) = ${fr(ans)}입니다.`
                  ];
                }
                const { options, answerIndex } = choices(rng, ans, cands, RAT);
                return {
                  question: `lim(x→${num(c)}) (${polyStr(N)})/(${polyStr(D)})의 값은?`,
                  variablesInfo: { 분자: polyStr(N), 분모: polyStr(D), 극한점: c },
                  options,
                  answerIndex,
                  hint: 'x = a를 대입해 0/0 꼴이 나오면 인수분해해 (x − a)를 약분한 뒤 대입하세요.',
                  steps
                };
              }
            },
            {
              id: 'HIG-33',
              dayIndex: 32,
              unit: '미적분Ⅰ · 정적분의 계산',
              standardCode: '[12미적Ⅰ-03-04]',
              standardName: '부정적분과 정적분의 관계를 이해하고, 다항함수의 정적분을 구할 수 있다.',
              sourceRef: '미적분Ⅰ 교과서 및 고2·고3 학력평가 3점 (다항함수의 정적분)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '0부터 시작하는 일차함수의 정적분',
                normal: '이차함수의 정적분 F(b) − F(a)',
                hard: '대칭 구간의 우함수·기함수 성질 또는 절댓값 함수의 정적분'
              },
              conceptSummary: 'F′(x) = f(x)이면 ∫(a~b) f(x) dx = F(b) − F(a)입니다. 구간 [−a, a]에서 홀수 차수 항의 적분은 0, 짝수 차수 항은 [0, a] 적분의 2배입니다.',
              formula: '∫(a~b) xⁿ dx = (bⁿ⁺¹ − aⁿ⁺¹)/(n + 1),  ∫(−a~a) x^(홀수) dx = 0',
              generate(rng, { tier } = {}) {
                // 정확한 유리수 계산: 분모 12 로 통분
                const integ = (cf, a, b) => rr(cf.reduce((s, k, i) => s + (k * 12 * (Math.pow(b, i + 1) - Math.pow(a, i + 1))) / (i + 1), 0), 12);
                const F = cf => polyStr([0, ...cf.map((k, i) => k / (i + 1))]);
                if (tier === 'hard') {
                  if (rng.next() < 0.5) {
                    const a = rng.int(1, 3);
                    const cf = [rng.int(-4, 4), nz(rng, -4, 4), rng.pick([-3, 3, 6]), rng.pick([1, 2, -1, 4])];
                    const ans = integ(cf, -a, a);
                    const all = rr(2 * (cf[0] * a + cf[1] * a * a / 2 + cf[2] * a * a * a / 3 + cf[3] * Math.pow(a, 4) / 4) * 12, 12);
                    const { options, answerIndex } = choices(rng, ans, [rr(0, 1), rr(ans[0], ans[1] * 2), all, integ(cf, 0, a)], RAT);
                    return {
                      question: `∫(${num(-a)}~${a}) (${polyStr(cf)}) dx의 값은?`,
                      variablesInfo: { 아래끝: -a, 위끝: a, 피적분함수: polyStr(cf) },
                      options,
                      answerIndex,
                      hint: '적분 구간이 [−a, a]이면 홀수 차수 항(x³, x)은 0이 되고, 짝수 차수 항만 [0, a] 적분의 2배로 계산합니다.',
                      steps: [
                        `구간이 [${num(-a)}, ${a}]이므로 홀수 차수 항 ${polyStr([0, cf[1], 0, cf[3]])}의 정적분은 0입니다.`,
                        `남은 항: 2∫(0~${a}) (${polyStr([cf[0], 0, cf[2]])}) dx = 2 × [${F([cf[0], 0, cf[2]])}](0~${a})입니다.`,
                        `계산하면 ${fr(ans)}입니다.`
                      ]
                    };
                  }
                  const lo = rng.int(-3, 1), k = lo + rng.int(1, 3), hi = k + rng.int(1, 4);
                  const xk = k === 0 ? 'x' : `x ${k > 0 ? '−' : '+'} ${Math.abs(k)}`;
                  const ans = rr((k - lo) * (k - lo) + (hi - k) * (hi - k), 2);
                  const { options, answerIndex } = choices(rng, ans, [rr(Math.abs((hi - k) * (hi - k) - (k - lo) * (k - lo)), 2), rr((hi - lo) * (hi - lo), 2), rr((k - lo) * (k - lo) + (hi - k) * (hi - k), 1), rr(hi - lo, 1)], { ...RAT, ok: r => r[0] > 0 });
                  return {
                    question: `∫(${num(lo)}~${num(hi)}) |${xk}| dx의 값은?`,
                    variablesInfo: { 아래끝: lo, 위끝: hi, 꺾이는점: k },
                    options,
                    answerIndex,
                    hint: `x = ${wj(num(k), '을/를')} 기준으로 구간을 나누어 절댓값을 벗기세요. 그래프로 보면 두 삼각형의 넓이의 합입니다.`,
                    steps: [
                      `x < ${num(k)}에서 |${xk}| = −(${xk}), x ≥ ${num(k)}에서 |${xk}| = ${xk}입니다.`,
                      `∫(${num(lo)}~${num(k)}) (${num(k)} − x) dx = ${fr(rr((k - lo) * (k - lo), 2))}, ∫(${num(k)}~${num(hi)}) (${xk}) dx = ${fr(rr((hi - k) * (hi - k), 2))}입니다.`,
                      `두 값을 더하면 ${fr(ans)}입니다.`
                    ]
                  };
                }
                let lo, hi, cf;
                if (tier === 'easy') { lo = 0; hi = rng.int(1, 4); cf = [rng.int(-3, 5), rng.pick([2, 4, 6, -2])]; }
                else { lo = rng.int(-2, 1); hi = lo + rng.int(1, 3); cf = [rng.int(-4, 4), rng.pick([-4, -2, 2, 4, 6]), rng.pick([3, 6, -3])]; }
                const ans = integ(cf, lo, hi);
                const atF = x => integ(cf, 0, x);
                const fPrime = cf.slice(1).map((k, i) => k * (i + 1));
                const cands = [atF(hi), rr(atF(hi)[0] * atF(lo)[1] + atF(lo)[0] * atF(hi)[1], atF(hi)[1] * atF(lo)[1]), rr(pval(cf, hi) - pval(cf, lo), 1), rr(pval(fPrime, hi) - pval(fPrime, lo), 1), rr(-ans[0], ans[1])];
                const { options, answerIndex } = choices(rng, ans, cands, RAT);
                return {
                  question: `∫(${num(lo)}~${num(hi)}) (${polyStr(cf)}) dx의 값은?`,
                  variablesInfo: { 아래끝: lo, 위끝: hi, 피적분함수: polyStr(cf) },
                  options,
                  answerIndex,
                  hint: '부정적분 F(x)를 구한 뒤 F(위끝) − F(아래끝)을 계산하세요.',
                  steps: [
                    `부정적분 중 하나는 F(x) = ${F(cf)}입니다.`,
                    `∫(${num(lo)}~${num(hi)}) (${polyStr(cf)}) dx = F(${num(hi)}) − F(${num(lo)}) = ${fr(atF(hi))} − ${atF(lo)[0] < 0 ? `(${fr(atF(lo))})` : fr(atF(lo))}입니다.`,
                    `따라서 값은 ${fr(ans)}입니다.`
                  ]
                };
              }
            },
            {
              id: 'HIG-34',
              dayIndex: 33,
              unit: '미적분Ⅰ · 속도와 가속도',
              standardCode: '[12미적Ⅰ-02-10]',
              standardName: '미분을 속도와 가속도에 대한 문제에 활용하고, 그 유용성을 인식할 수 있다.',
              sourceRef: '미적분Ⅰ 교과서 및 고3 학력평가 3~4점 (수직선 위를 움직이는 점)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: '위치를 한 번 미분해 특정 시각의 속도',
                normal: '두 번 미분해 특정 시각의 가속도',
                hard: '운동 방향이 처음 바뀌는 시각(속도 = 0)을 찾은 뒤 그때의 가속도·위치'
              },
              conceptSummary: '수직선 위를 움직이는 점의 위치가 x = f(t)이면 속도 v = f′(t), 가속도 a = v′(t)입니다. 속도의 부호가 바뀌는 순간 운동 방향이 바뀝니다.',
              formula: 'v = dx/dt,  a = dv/dt,  운동 방향 전환: v = 0 이고 부호 변화',
              generate(rng, { tier } = {}) {
                const d = c => c.slice(1).map((k, i) => k * (i + 1));
                let X, question, ans, cands, steps;
                const lead = '수직선 위를 움직이는 점 P의 시각 t (t ≥ 0)에서의 위치 x가';
                if (tier === 'hard') {
                  let t1, t2;
                  do { t1 = rng.int(1, 4); t2 = t1 + rng.pick([2, 4, 6]); } while (t2 > 9);
                  const k = rng.pick([1, 2]);
                  X = [rng.int(-5, 5), 3 * k * t1 * t2, (-3 * k * (t1 + t2)) / 2, k];
                  const V = d(X), A = d(V);
                  const askPos = rng.next() < 0.4;
                  ans = askPos ? pval(X, t1) : pval(A, t1);
                  cands = askPos ? [pval(X, t2), pval(V, t1 + 1), pval(X, t1) - X[0], pval(X, 0)] : [pval(A, t2), 0, pval(V, t1 + 1), -ans, pval(A, 0)];
                  question = `${lead} x = ${polyStr(X, 't')}일 때, 점 P가 출발한 후 처음으로 운동 방향을 바꾸는 시각에서의 ${askPos ? '위치' : '가속도'}는?`;
                  steps = [
                    `속도 v = ${polyStr(V, 't')} = ${3 * k === 1 ? '' : 3 * k}${lin(t1, 't')}${lin(t2, 't')}입니다.`,
                    `v의 부호가 처음 바뀌는 시각은 t = ${t1}(양 → 음)입니다.`,
                    askPos ? `그때의 위치는 x(${t1}) = ${num(ans)}입니다.` : `가속도 a = ${polyStr(A, 't')}이므로 a(${t1}) = ${num(ans)}입니다.`
                  ];
                } else {
                  X = [rng.int(-4, 4), rng.int(-6, 9), rng.int(-6, 3), rng.pick([1, 1, 2])];
                  const V = d(X), A = d(V);
                  const t0 = rng.int(1, 4);
                  if (tier === 'easy') {
                    ans = pval(V, t0);
                    cands = [pval(X, t0), pval(A, t0), X[3] * t0 * t0 + X[2] * t0 + X[1], pval(V, t0 + 1)];
                    question = `${lead} x = ${polyStr(X, 't')}일 때, 시각 t = ${t0}에서의 속도는?`;
                    steps = [`속도는 위치를 t에 대해 미분한 것이므로 v = ${polyStr(V, 't')}입니다.`, `t = ${t0}${jo(String(t0), '을/를')} 대입하면 v(${t0}) = ${num(ans)}입니다.`];
                  } else {
                    ans = pval(A, t0);
                    cands = [pval(V, t0), A[0] * t0, 3 * X[3] * t0 + 2 * X[2], pval(A, t0 + 1), pval(X, t0)];
                    question = `${lead} x = ${polyStr(X, 't')}일 때, 시각 t = ${t0}에서의 가속도는?`;
                    steps = [
                      `속도 v = dx/dt = ${polyStr(V, 't')}입니다.`,
                      `가속도 a = dv/dt = ${polyStr(A, 't')}입니다.`,
                      `t = ${t0}${jo(String(t0), '을/를')} 대입하면 a(${t0}) = ${num(ans)}입니다.`
                    ];
                  }
                }
                const { options, answerIndex } = choices(rng, ans, cands);
                return {
                  question,
                  variablesInfo: { 위치: `x = ${polyStr(X, 't')}` },
                  options,
                  answerIndex,
                  hint: tier === 'hard' ? '속도 v = 0이 되는 시각 중 v의 부호가 바뀌는 첫 시각을 찾으세요.' : '위치를 미분하면 속도, 속도를 미분하면 가속도입니다.',
                  steps
                };
              }
            },
            {
              id: 'HIG-35',
              dayIndex: 34,
              unit: '확률과 통계 · 조건부확률',
              standardCode: '[12확통02-04]',
              standardName: '조건부확률을 이해하고, 이를 실생활과 연결하여 문제를 해결할 수 있다.',
              sourceRef: '확률과 통계 교과서 및 고3 학력평가 3점 (조건부확률과 분할표)',
              difficulty: '★★☆ 표준',
              tierGuide: {
                easy: 'P(B|A) = P(A ∩ B)/P(A) 바로 적용',
                normal: '조사 결과(분할표)에서 조건부확률',
                hard: 'P(A ∪ B)로 P(A ∩ B)를 먼저 구한 뒤 조건부확률'
              },
              conceptSummary: '사건 A가 일어났을 때 사건 B가 일어날 확률은 P(B|A) = P(A ∩ B)/P(A)입니다. 분모가 전체가 아니라 조건 A라는 점이 핵심입니다.',
              formula: 'P(B|A) = P(A ∩ B) / P(A)',
              generate(rng, { tier } = {}) {
                const mul = (x, y) => rr(x[0] * y[0], x[1] * y[1]);
                const div = (x, y) => rr(x[0] * y[1], x[1] * y[0]);
                if (tier === 'easy') {
                  const pA = rng.pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [4, 5]]);
                  const pBA = rng.pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5]]);
                  const pAB = mul(pA, pBA);
                  const ans = rr(pBA[0], pBA[1]);
                  const { options, answerIndex } = choices(rng, ans, [pAB, mul(pAB, pA), div(pA, pAB), rr(pBA[1] - pBA[0], pBA[1])], RAT);
                  return {
                    question: `두 사건 A, B에 대하여 P(A) = ${fr(pA)}, P(A ∩ B) = ${fr(pAB)}일 때, P(B|A)의 값은?`,
                    variablesInfo: { 'P(A)': fr(pA), 'P(A∩B)': fr(pAB) },
                    options,
                    answerIndex,
                    hint: 'P(B|A)는 A가 일어났다는 조건에서 B의 확률이므로 P(A ∩ B)를 P(A)로 나눕니다.',
                    steps: [`P(B|A) = P(A ∩ B) / P(A)입니다.`, `${fr(pAB)} ÷ ${fr(pA)} = ${fr(ans)}입니다.`]
                  };
                }
                if (tier === 'hard') {
                  for (let tries = 0; tries < 300; tries++) {
                    const N = rng.pick([10, 12, 15, 20, 24]);
                    const nI = rng.int(1, Math.floor(N / 3)), nA = nI + rng.int(1, Math.floor(N / 3)), nB = nI + rng.int(1, Math.floor(N / 3));
                    if (nA + nB - nI > N) continue;
                    const given = rng.pick(['A', 'B']); // 조건 사건
                    const other = given === 'A' ? 'B' : 'A';
                    const nG = given === 'A' ? nA : nB, nO = given === 'A' ? nB : nA;
                    const ans = rr(nI, nG);
                    const cands = [rr(nI, N), rr(nI, nO), rr(nA + nB - nI, nG), rr(nG - nI, nG), rr(nI, nA + nB - nI)];
                    const { options, answerIndex } = choices(rng, ans, cands, RAT);
                    const P = n => fr(rr(n, N));
                    return {
                      question: `두 사건 A, B에 대하여 P(A) = ${P(nA)}, P(B) = ${P(nB)}, P(A ∪ B) = ${P(nA + nB - nI)}일 때, P(${other}|${given})의 값은?`,
                      variablesInfo: { 'P(A)': P(nA), 'P(B)': P(nB), 'P(A∪B)': P(nA + nB - nI) },
                      options,
                      answerIndex,
                      hint: '먼저 P(A ∩ B) = P(A) + P(B) − P(A ∪ B)를 구한 뒤 조건이 되는 사건의 확률로 나누세요.',
                      steps: [
                        `확률의 덧셈정리에서 P(A ∩ B) = P(A) + P(B) − P(A ∪ B) = ${P(nA)} + ${P(nB)} − ${P(nA + nB - nI)} = ${P(nI)}입니다.`,
                        `P(${other}|${given}) = P(A ∩ B) / P(${given}) = ${P(nI)} ÷ ${P(nG)} = ${fr(ans)}입니다.`
                      ]
                    };
                  }
                  throw new Error('HIG-35 생성 실패');
                }
                const [g1, g2] = rng.pick([['남학생', '여학생'], ['1학년', '2학년'], ['A반', 'B반']]);
                const club = rng.pick(['수학동아리', '과학동아리', '방송부', '독서부']);
                const n1 = rng.int(12, 30), n2 = rng.int(12, 30);
                const k1 = rng.int(3, n1 - 3), k2 = rng.int(3, n2 - 3);
                const tg = rng.pick([g1, g2]);
                const kt = tg === g1 ? k1 : k2, nt = tg === g1 ? n1 : n2;
                const ans = rr(kt, k1 + k2);
                const cands = [rr(kt, nt), rr(kt, n1 + n2), rr(nt, n1 + n2), rr(k1 + k2 - kt, k1 + k2), rr(k1 + k2, n1 + n2)];
                const { options, answerIndex } = choices(rng, ans, cands, RAT);
                return {
                  question: `어느 학교의 동아리 가입 조사에서 ${g1} ${n1}명 중 ${k1}명, ${g2} ${n2}명 중 ${k2}명이 ${club}에 가입했다. 조사한 학생 중 임의로 한 명을 뽑았더니 ${club}에 가입한 학생이었을 때, 이 학생이 ${tg}일 확률은?`,
                  variablesInfo: { [g1]: `${n1}명 중 ${k1}명`, [g2]: `${n2}명 중 ${k2}명`, 동아리: club },
                  options,
                  answerIndex,
                  hint: `'가입한 학생'이 조건이므로 분모는 전체 학생이 아니라 가입한 학생 수입니다.`,
                  steps: [
                    `${club}에 가입한 학생은 ${k1} + ${k2} = ${k1 + k2}명입니다.`,
                    `그중 ${tg}${jo(tg, '은/는')} ${kt}명이므로 구하는 확률은 ${kt}/${k1 + k2}${ans[1] === k1 + k2 ? '' : ` = ${fr(ans)}`}입니다.`
                  ]
                };
              }
            }
          ];
        })()
      ]
    },

    // =========================================================================
    // [4] 생활 속 수학 (실용수학·경제수학·성인 수리력 14개 대표 유형)
    // =========================================================================
    life: {
      id: 'life',
      level: '생활 속 수학',
      targetGrade: '경제 수학 · 직무 수학 · 생활 수리력',
      title: '쇼핑·금융·환율·데이터·생활 통계의 합리적 선택',
      desc: '중복 할인, 복리와 단리, 환율 우대 스프레드, 데이터 다운로드 시간, 부가세 역산, 배터리 충전 전력, BMI 건강 지수까지 일상생활에 매일 쓰이는 실용 수학을 완벽히 정복해 보자.',
      miniTitle: '숫자에 숨겨진 진실을 읽는 힘',
      miniDesc: '퍼센트(%)의 기준 금액 착시, 디지털 데이터의 비트(b)와 바이트(B) 차이, 부가세 10%의 정확한 역산 원리를 알면 일상 속에서 가장 똑똑하고 합리적인 결정을 내릴 수 있어.',
      formula: '실구매가 = 정가 × (1 − r₁) × (1 − r₂),  1 Byte = 8 bits',
      example: '예: 50,000원 상품을 20% 할인 후 10% 추가 할인하면 50,000 × 0.8 × 0.9 = 36,000원.',
      templates: [
        {
          id: 'LIF-01',
          dayIndex: 0,
          unit: '생활 수학 · 중복 할인과 실구매가',
          standardCode: '[12직수02-02]',
          standardName: '비율을 백분율로 표현할 수 있고 직무 상황에 연결하여 적용할 수 있다.',
          sourceRef: '생활 속 백분율 활용 (직무 수학 · 초등 비율과 백분율 연계)',
          difficulty: '★★☆ 표준',
          conceptSummary: '기본 할인 후 쿠폰으로 추가 할인을 받을 때는 1차 할인된 금액에 대해 2차 할인율을 적용합니다.',
          formula: '최종 결제 금액 = 정가 × (1 − 1차 할인율) × (1 − 2차 할인율)',
          tierGuide: {
            easy: '1만 원 단위 정가에 10%·20% 할인 두 번',
            normal: '정가에 10~30% 할인 후 10~20% 추가 할인',
            hard: '정가가 딱 떨어지지 않고 12~45% 할인이 겹쳐 총 할인율 계산이 까다로움'
          },
          generate(rng, { tier } = {}) {
            // 하·상: 수의 범위만 바꾸고 지문·보기 형식은 중과 같다(동결 oracle 호환)
            if (tier === 'easy' || tier === 'hard') {
              const E = tier === 'easy';
              const item = E ? '운동화' : rng.pick(['운동화', '겨울 외투', '블루투스 이어폰', '여행용 캐리어']);
              const basePrice = E ? rng.pick([10000, 20000, 30000, 40000, 50000, 60000]) : rng.pick([36000, 45000, 58000, 64000, 72000, 88000, 96000, 128000]);
              // (100 − d1)(100 − d2)가 100의 배수인 조합만 → 총 할인율이 정수 %
              const [d1, d2] = E ? [rng.pick([10, 20]), rng.pick([10, 20])] : rng.pick([[15, 20], [25, 20], [35, 20], [12, 25], [25, 40], [40, 15], [45, 20], [20, 15]]);
              const afterFirst = basePrice * (100 - d1) / 100;
              const finalPrice = afterFirst * (100 - d2) / 100;
              const naivePrice = basePrice * (100 - d1 - d2) / 100;
              const realRate = 100 - (100 - d1) * (100 - d2) / 100;
              const { options, answerIndex } = buildChoiceSet(rng, `${comma(finalPrice)}원 (실제 총 할인율 ${realRate}%)`, [
                `${comma(naivePrice)}원 (단순 합산 ${d1 + d2}% 할인 오산)`,
                `${comma(afterFirst)}원 (1차 할인만 적용)`,
                `${comma(finalPrice - 1000)}원 (실제 총 할인율 ${realRate + 2}%)`
              ]);
              return {
                question: `정가가 ${comma(basePrice)}원인 ${item}${jo(item, '이/가')} 시즌 오프로 ${d1}% 할인 중입니다. 여기에 할인된 금액에서 ${d2}%를 추가로 할인해 주는 쿠폰을 적용할 때, 최종 결제 금액은 얼마인가요?`,
                variablesInfo: { 정가: `${comma(basePrice)}원`, '1차할인': `${d1}%`, '2차추가할인': `${d2}%` },
                options,
                answerIndex,
                hint: `${d1}% 할인과 ${d2}% 추가 할인은 단순 합산(${d1 + d2}%)이 아닙니다! 정가에 (1 − ${d1 / 100})${jo(d1 / 100, '과/와')} (1 − ${d2 / 100})${jo(d2 / 100, '을/를')} 차례로 곱하세요.`,
                steps: [
                  `1차로 ${d1}% 할인된 가격은 ${comma(basePrice)} × ${(100 - d1) / 100} = ${comma(afterFirst)}원입니다.`,
                  `쿠폰 ${d2}%는 할인된 금액 기준이므로 ${comma(afterFirst)} × ${(100 - d2) / 100} = ${comma(finalPrice)}원입니다.`,
                  `정가 대비 남은 비율은 ${(100 - d1) / 100} × ${(100 - d2) / 100} = ${(100 - realRate) / 100}이므로 실제 총 할인율은 ${d1 + d2}%가 아니라 ${realRate}%입니다.`
                ]
              };
            }
            const basePrice = rng.pick([20000, 30000, 40000, 50000, 60000, 80000]);
            const d1 = rng.pick([10, 20, 30]);
            const d2 = rng.pick([10, 20]);
            const afterFirst = basePrice * (1 - d1 / 100);
            const finalPrice = Math.round(afterFirst * (1 - d2 / 100));
            const naivePrice = Math.round(basePrice * (1 - (d1 + d2) / 100));
            const realRate = 100 - Math.round(((100 - d1) * (100 - d2)) / 100);

            const correct = `${comma(finalPrice)}원 (실제 총 할인율 ${realRate}%)`;
            const distractors = [
              `${comma(naivePrice)}원 (단순 합산 ${d1 + d2}% 할인 오산)`,
              `${comma(afterFirst)}원 (1차 할인만 적용)`,
              `${comma(finalPrice - 1000)}원 (실제 총 할인율 ${realRate + 2}%)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `정가가 ${comma(basePrice)}원인 운동화가 시즌 오프로 ${d1}% 할인 중입니다. 여기에 할인된 금액에서 ${d2}%를 추가로 할인해 주는 쿠폰을 적용할 때, 최종 결제 금액은 얼마인가요?`,
              variablesInfo: { 정가: `${comma(basePrice)}원`, '1차할인': `${d1}%`, '2차추가할인': `${d2}%` },
              options,
              answerIndex,
              hint: `${d1}% 할인과 ${d2}% 추가 할인은 단순 합산(${d1 + d2}%)이 아닙니다! 먼저 1차 할인을 적용한 뒤 다시 2차 할인을 곱하세요.`,
              steps: [
                `1차로 ${d1}% 할인된 가격은 ${comma(basePrice)} × (1 − ${d1 / 100}) = ${comma(afterFirst)}원입니다.`,
                `여기에 ${d2}% 추가 할인 쿠폰을 적용하면 ${comma(afterFirst)} × (1 − ${d2 / 100}) = ${comma(finalPrice)}원입니다.`,
                `정가 대비 실제 총 할인율은 ${d1 + d2}%가 아니라 ${realRate}%입니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-02',
          dayIndex: 1,
          unit: '경제 수학 · 단리와 복리',
          standardCode: '[12경수01-04]',
          standardName: '단리와 복리를 이용하여 이자와 원리 합계를 구하고, 미래에 받을 금액의 현재 가치를 구할 수 있다.',
          sourceRef: '고등학교 경제 수학 (단리와 복리의 원리 합계 비교)',
          difficulty: '★★☆ 표준',
          conceptSummary: '단리는 원금에만 이자가 붙고, 복리는 (원금 + 이자)에 다시 이자가 붙습니다.',
          formula: '단리 원리합계 = P(1 + r·n),   복리 원리합계 = P(1 + r)^n',
          tierGuide: {
            easy: '연이율 5%·10%로 2년 복리 이자 계산',
            normal: '연이율 4~10%로 2년 복리 이자와 단리 차이',
            hard: '1,000만 원대 원금, 소수 연이율(2.5~6.5%)로 2년 복리와 단리 차이'
          },
          generate(rng, { tier } = {}) {
            // 하·상은 원금·이율 범위만 다르고 계산 구조(2년 복리 vs 단리)는 같다
            const principalMan = rng.pick(tier === 'easy' ? [100, 200, 300, 400, 500, 600, 800, 1000] : tier === 'hard' ? [1200, 1500, 2500, 3000, 4000, 5000] : [100, 200, 300, 500, 1000]);
            const rate = rng.pick(tier === 'easy' ? [5, 10] : tier === 'hard' ? [2.5, 3.5, 4.5, 5.5, 6.5] : [4, 5, 6, 8, 10]);
            const r = rate / 100;
            const P = principalMan * 10000;
            const simpleInterest = Math.round(P * r * 2);
            const compoundInterest = Math.round(P * (Math.pow(1 + r, 2) - 1));
            const diff = compoundInterest - simpleInterest;

            const correct = `복리 이자 총 ${comma(compoundInterest)}원 (단리보다 ${comma(diff)}원 더 많음)`;
            const distractors = [
              `복리 이자 총 ${comma(simpleInterest)}원 (단리와 동일함)`,
              `복리 이자 총 ${comma(Math.round(P * r))}원 (1년치 이자만 계산)`,
              `복리 이자 총 ${comma(compoundInterest + diff)}원 (단리보다 ${comma(diff * 2)}원 더 많음)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `${comma(principalMan)}만 원을 연이율 ${rate}%의 연 복리 정기예금에 2년 동안 예치했을 때 받는 총 이자(세전)는 얼마이며, 같은 조건의 단리 예금보다 얼마나 더 많은가요?`,
              variablesInfo: { 원금: `${principalMan}만 원`, 연이율: `${rate}%`, 기간: '2년 (연 복리)' },
              options,
              answerIndex,
              hint: `1년 차 이자는 원금의 ${rate}%이고, 2년 차에는 (원금 + 1년 차 이자)에 대해 ${rate}%의 이자가 붙습니다!`,
              steps: [
                `1년 차에 발생하는 이자는 ${comma(P)} × ${r} = ${comma(P * r)}원입니다.`,
                `2년 차에는 원금과 1년 차 이자를 합친 금액에 대해 이자가 붙으므로 2년 차 이자는 ${comma(P * r * (1 + r))}원입니다.`,
                `따라서 2년간 복리 총 이자는 ${comma(compoundInterest)}원이며, 단리 총 이자(${comma(simpleInterest)}원)보다 ${comma(diff)}원 더 많습니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-03',
          dayIndex: 2,
          unit: '생활 수학 · 단위 가격(가성비) 비교',
          standardCode: '[12직수02-01]',
          standardName: '비의 개념을 직무 상황에 연결하여 적용할 수 있다.',
          sourceRef: '생활 속 비와 비율 (단위 가격 비교와 합리적 소비)',
          difficulty: '★☆☆ 기초',
          conceptSummary: '용량과 가격이 서로 다른 상품을 비교할 때는 100g(또는 100mL)당 가격인 단위 가격으로 환산하여 비교합니다.',
          formula: '100g당 단위 가격 = (전체 가격 ÷ 전체 용량(g)) × 100',
          tierGuide: {
            easy: '100g·200g 대 300g·500g, 100g당 가격이 딱 떨어지는 비교',
            normal: '200~400g 대 500~800g 상품의 100g당 가격 비교',
            hard: '250g·350g 같은 용량과 1,000원대 단위 가격, 나눗셈이 소수로 걸림'
          },
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            // 하·상은 수의 범위만 바꾼다(rng 호출 순서는 중과 동일)
            const unitPriceA = rng.pick(E ? [1000, 1500, 2000] : Hd ? [1240, 1380, 1560, 1720, 1960] : [1200, 1500, 1800, 2000, 2400]);
            const diffPer100 = rng.pick(E ? [100, 200, 500] : Hd ? [120, 160, 240, 280] : [150, 200, 250, 300]);
            const aIsCheaper = rng.next() > 0.5;
            const upA = aIsCheaper ? unitPriceA : unitPriceA + diffPer100;
            const upB = aIsCheaper ? unitPriceA + diffPer100 : unitPriceA;

            const weightA = rng.pick(E ? [100, 200] : Hd ? [250, 350, 450] : [200, 300, 400]);
            const weightB = rng.pick(E ? [300, 500] : Hd ? [750, 900, 1200] : [500, 600, 800]);
            const priceA = (upA * weightA) / 100;
            const priceB = (upB * weightB) / 100;

            const cheaperName = aIsCheaper ? 'A 상품' : 'B 상품';
            const correct = `${wj(cheaperName, '이/가')} 100g당 ${comma(diffPer100)}원 더 저렴하다`;
            const otherName = aIsCheaper ? 'B 상품' : 'A 상품';
            const distractors = [
              `${wj(otherName, '이/가')} 100g당 ${comma(diffPer100)}원 더 저렴하다`,
              `두 상품의 100g당 단위 가격이 ${comma(upA)}원으로 같다`,
              `${wj(cheaperName, '이/가')} 100g당 ${comma(diffPer100 * 2)}원 더 저렴하다`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `마트에서 같은 품질의 견과류를 A 상품은 ${weightA}g에 ${comma(priceA)}원, B 상품은 ${weightB}g에 ${comma(priceB)}원에 판매하고 있습니다. 100g당 가격을 비교한 결과로 옳은 것은?`,
              variablesInfo: { A상품: `${weightA}g / ${comma(priceA)}원`, B상품: `${weightB}g / ${comma(priceB)}원` },
              options,
              answerIndex,
              hint: `A 상품의 가격을 ${wj(weightA / 100, '으로/로')} 나누고, B 상품의 가격을 ${wj(weightB / 100, '으로/로')} 나누어 100g당 가격을 각각 구해 보세요.`,
              steps: [
                `A 상품의 100g당 가격은 ${comma(priceA)} ÷ ${weightA / 100} = ${comma(upA)}원입니다.`,
                `B 상품의 100g당 가격은 ${comma(priceB)} ÷ ${weightB / 100} = ${comma(upB)}원입니다.`,
                `따라서 ${wj(cheaperName, '이/가')} 100g당 ${comma(Math.abs(upA - upB))}원 더 저렴합니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-04',
          dayIndex: 3,
          unit: '생활 수학 · 농도와 희석',
          standardCode: '[9수02-04]',
          standardName: '일차방정식을 풀 수 있고, 이를 활용하여 문제를 해결할 수 있다.',
          sourceRef: '중학교 일차방정식의 활용 (소금물의 농도 / 생활 속 희석 비율)',
          difficulty: '★★☆ 표준',
          conceptSummary: '용액의 농도(%) = (용질의 양 ÷ 전체 용액의 양) × 100 이며, 물을 더 넣어도 녹아 있는 용질의 양은 변하지 않습니다.',
          formula: '용질의 양 = 전체 용액의 양 × (농도 / 100)',
          tierGuide: {
            easy: '10%·20% 소금물을 4%·5%로 묽히기(물의 양이 원래의 몇 배)',
            normal: '12~20% 소금물 200~400g을 6~10%로 묽히기',
            hard: '소금 양이 소수(예 67.5g)로 나오는 240~750g, 4~10% 목표 농도'
          },
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const initWeight = rng.pick(E ? [100, 200, 300, 400, 500] : Hd ? [240, 360, 450, 480, 600, 750] : [200, 300, 400]);
            const initConc = rng.pick(E ? [10, 20] : Hd ? [12, 15, 18, 24, 25] : [12, 15, 16, 20]);
            const targetConc = rng.pick(E ? [4, 5] : Hd ? [4, 6, 8, 9, 10] : [6, 8, 10]);
            const solute = (initWeight * initConc) / 100;
            const finalWeight = (solute * 100) / targetConc;
            if (!Number.isInteger(finalWeight) || finalWeight <= initWeight) return this.generate(rng, { tier });
            const addedWater = finalWeight - initWeight;

            const correct = `${addedWater} g`;
            const distractors = [
              `${finalWeight} g`,
              `${Math.round(initWeight * ((initConc - targetConc) / 100))} g`,
              `${addedWater + 50} g`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `농도가 ${initConc}%인 소금물 ${initWeight}g에 깨끗한 물을 더 넣어 농도가 ${targetConc}%인 소금물을 만들려고 합니다. 더 넣어야 하는 물의 양은 몇 g인가요?`,
              variablesInfo: { 처음소금물: `${initWeight}g (${initConc}%)`, 목표농도: `${targetConc}%`, 소금양: `${solute}g` },
              options,
              answerIndex,
              hint: `물을 더 넣어도 들어 있는 소금의 양(${solute}g)은 변하지 않아요! (소금의 양) ÷ (새 소금물 전체 양) = ${targetConc}/100 임을 이용해 보세요.`,
              steps: [
                `처음 소금물에 들어 있는 소금의 양은 ${initWeight} × (${initConc}/100) = ${solute}g입니다.`,
                `농도가 ${targetConc}%가 되어야 하므로 전체 소금물의 양은 ${solute} ÷ (${targetConc}/100) = ${finalWeight}g이 되어야 합니다.`,
                `따라서 더 넣어야 하는 물의 양은 ${finalWeight} − ${initWeight} = ${addedWater}g입니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-05',
          dayIndex: 4,
          unit: '생활 수학 · 자동차 연비와 유류비',
          standardCode: '[12직수01-01]',
          standardName: '직무 상황에서 수 개념과 사칙연산의 문제를 해결하고 그 유용성을 인식할 수 있다.',
          sourceRef: '생활 속 사칙연산 (연비와 여행 경비 계획)',
          difficulty: '★★☆ 표준',
          conceptSummary: '연비(km/L)는 연료 1L로 주행할 수 있는 거리입니다. (필요한 연료량) = (총 주행 거리) ÷ (연비)로 구합니다.',
          formula: '총 유류비 = (총 주행 거리 ÷ 연비) × 1L당 유가',
          tierGuide: {
            easy: '연비 12~20km/L, 10~20L, 1L당 100원 단위 가격',
            normal: '연비 10~20km/L, 15~35L, 1L당 1,600~1,750원',
            hard: '연비가 소수(11.5km/L 등)이고 1L당 가격이 1,685원처럼 딱 떨어지지 않음'
          },
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const eff = rng.pick(E ? [12, 15, 20] : Hd ? [11.5, 12.5, 13.5, 14.5, 16.5] : [10, 12, 15, 16, 20]);
            // 상: 연비가 x.5 이므로 연료량을 짝수로 해 주행 거리를 정수로
            const liters = E ? rng.int(10, 20) : Hd ? 2 * rng.int(9, 20) : rng.int(15, 35);
            const dist = eff * liters;
            const pricePerL = rng.pick(E ? [1500, 1600, 1700, 1800] : Hd ? [1685, 1720, 1795, 1830, 1865] : [1600, 1650, 1700, 1750]);
            const totalCost = liters * pricePerL;

            const correct = `${comma(totalCost)}원 (소모 연료 ${liters}L)`;
            const distractors = [
              `${comma(totalCost * 2)}원 (소모 연료 ${liters * 2}L)`,
              `${comma((dist / 10) * pricePerL)}원 (연비를 10km/L로 착오)`,
              `${comma(totalCost - pricePerL * 3)}원 (소모 연료 ${liters - 3}L)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `평균 연비가 ${eff}km/L인 자동차로 총 ${comma(dist)}km를 주행하려고 합니다. 휘발유 가격이 1L당 ${comma(pricePerL)}원일 때, 이 주행에 필요한 휘발유 양과 총 유류비는 얼마인가요?`,
              variablesInfo: { 총주행거리: `${dist}km`, 연비: `${eff}km/L`, 리터당가격: `${comma(pricePerL)}원` },
              options,
              answerIndex,
              hint: `먼저 총 주행 거리(${dist}km)를 연비(${eff}km/L)로 나누어 필요한 휘발유가 몇 L인지 구해 보세요.`,
              steps: [
                `필요한 휘발유 양은 ${dist} ÷ ${eff} = ${liters} L입니다.`,
                `1L당 가격이 ${comma(pricePerL)}원이므로 총 유류비는 ${liters} × ${comma(pricePerL)} = ${comma(totalCost)}원입니다.`,
                `따라서 필요한 연료는 ${liters}L이고, 총 유류비는 ${comma(totalCost)}원입니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-06',
          dayIndex: 5,
          unit: '생활 수학 · 요금제 손익분기점',
          standardCode: '[9수02-12]',
          standardName: '일차부등식을 풀 수 있고, 이를 활용하여 문제를 해결할 수 있다.',
          sourceRef: '중학교 일차부등식의 활용 (요금제 선택 의사결정)',
          difficulty: '★★☆ 표준',
          conceptSummary: '기본요금이 낮고 건당 요금이 있는 A안과 무제한 정액제 B안을 비교할 때는 (A안 총요금) > (B안 정액 요금)이 되는 횟수를 구합니다.',
          formula: '(기본료 + 1회당 요금 × n) > 무제한 정액 요금',
          tierGuide: {
            easy: '1회 1,000원, 경계 횟수가 정확히 나누어떨어짐',
            normal: '1회 1,500~2,500원, 경계 횟수에서 같아지고 그다음부터 정기권이 저렴',
            hard: '나누어떨어지지 않아 n > (소수)에서 가장 작은 자연수를 골라야 함'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const Hd = tier === 'hard';
              const baseFee = Hd ? rng.pick([3300, 4900, 7700, 8800]) : rng.pick([3000, 4000, 5000]);
              const perUse = Hd ? rng.pick([1200, 1800, 2200]) : 1000;
              const k = Hd ? rng.int(12, 24) : rng.int(5, 12);
              // 상: 정기권 요금에 1회 요금보다 작은 자투리를 더해 경계가 소수가 되게 함
              const extra = Hd ? rng.pick([300, 500, 700]) : 0;
              const flatFee = baseFee + perUse * k + extra;
              const minCount = k + 1;
              const bound = (flatFee - baseFee) / perUse;
              const { options, answerIndex } = buildChoiceSet(rng, `월 ${minCount}회 이상 이용할 때`, [
                `월 ${k}회 이상 이용할 때`,
                `월 ${Math.ceil(flatFee / perUse)}회 이상 이용할 때`,
                `월 ${k - 1}회 이상 이용할 때`,
                `월 ${k + 2}회 이상 이용할 때`
              ]);
              return {
                question: `공유 자전거 서비스의 일반 요금제는 월 기본료 ${comma(baseFee)}원에 1회 이용 시마다 ${comma(perUse)}원이 추가되고, 정기권 요금제는 월 ${comma(flatFee)}원에 횟수 제한 없이 무제한 이용할 수 있습니다. 한 달에 최소 몇 회 이상 이용해야 정기권 요금제가 일반 요금제보다 더 저렴한가요?`,
                variablesInfo: { 일반기본료: `${comma(baseFee)}원`, 회당요금: `${comma(perUse)}원`, 정기권: `${comma(flatFee)}원` },
                options,
                answerIndex,
                hint: `한 달 이용 횟수를 n회라 할 때, ${comma(baseFee)} + ${comma(perUse)}n > ${comma(flatFee)} 를 만족하는 가장 작은 자연수 n을 구해 보세요.`,
                steps: [
                  `한 달 이용 횟수를 n회라 하면 일반 요금제의 총요금은 (${comma(baseFee)} + ${comma(perUse)}n)원입니다.`,
                  `정기권이 더 저렴하려면 ${comma(baseFee)} + ${comma(perUse)}n > ${comma(flatFee)}, 즉 ${comma(perUse)}n > ${comma(flatFee - baseFee)} 이어야 합니다.`,
                  Hd
                    ? `n > ${comma(flatFee - baseFee)} ÷ ${comma(perUse)} = ${k}.${String(Math.round((bound - k) * 100)).padStart(2, '0')}… 이므로 이를 만족하는 가장 작은 자연수는 ${minCount}입니다. 최소 ${minCount}회 이상 이용할 때 정기권이 더 저렴합니다.`
                    : `n > ${bound} 이므로(n = ${k}이면 두 요금이 같음), 최소 ${minCount}회 이상 이용할 때 정기권이 더 저렴합니다.`
                ]
              };
            }
            const baseFee = rng.pick([5000, 6000, 8000, 10000]);
            const perUse = rng.pick([1500, 2000, 2500]);
            const k = rng.int(10, 18);
            const flatFee = baseFee + perUse * k;
            const minCount = k + 1;

            const correct = `월 ${minCount}회 이상 이용할 때`;
            const distractors = [
              `월 ${k}회 이상 이용할 때`,
              `월 ${Math.ceil(flatFee / perUse)}회 이상 이용할 때`,
              `월 ${k - 1}회 이상 이용할 때`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `공유 자전거 서비스의 일반 요금제는 월 기본료 ${comma(baseFee)}원에 1회 이용 시마다 ${comma(perUse)}원이 추가되고, 정기권 요금제는 월 ${comma(flatFee)}원에 횟수 제한 없이 무제한 이용할 수 있습니다. 한 달에 최소 몇 회 이상 이용해야 정기권 요금제가 일반 요금제보다 더 저렴한가요?`,
              variablesInfo: { 일반기본료: `${comma(baseFee)}원`, 회당요금: `${comma(perUse)}원`, 정기권: `${comma(flatFee)}원` },
              options,
              answerIndex,
              hint: `한 달 이용 횟수를 n회라 할 때, ${comma(baseFee)} + ${comma(perUse)}n > ${comma(flatFee)} 를 만족하는 가장 작은 자연수 n을 구해 보세요.`,
              steps: [
                `한 달 이용 횟수를 n회라 하면 일반 요금제의 총요금은 (${comma(baseFee)} + ${comma(perUse)}n)원입니다.`,
                `정기권이 더 저렴하려면 ${comma(baseFee)} + ${comma(perUse)}n > ${comma(flatFee)} 이어야 합니다.`,
                `${comma(perUse)}n > ${comma(flatFee - baseFee)} 에서 n > ${k} 이므로, 최소 ${minCount}회 이상 이용할 때 정기권이 더 저렴합니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-07',
          dayIndex: 6,
          unit: '생활 수학 · 퍼센트(%)와 퍼센트포인트(%p)',
          standardCode: '[12직수02-02]',
          standardName: '비율을 백분율로 표현할 수 있고 직무 상황에 연결하여 적용할 수 있다.',
          sourceRef: '생활 속 통계 리터러시 (퍼센트와 퍼센트포인트)',
          difficulty: '★★★ 실력',
          conceptSummary: '두 백분율 수치 자체의 단순 차이는 퍼센트포인트(%p)로 나타내고, 기존 백분율 대비 상대적인 변화 비율은 퍼센트(%)로 나타냅니다.',
          formula: '변화폭(%p) = r₂ − r₁,   상대 증가율(%) = ((r₂ − r₁) / r₁) × 100',
          tierGuide: {
            easy: '10~50% 기준값에서 10·20·50·100% 상대 증가',
            normal: '10~25% 기준값에서 20~100% 상대 증가',
            hard: '12.5%·37.5% 같은 상대 증가율로 %p 차이가 소수(예 1.5%p)'
          },
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const r1 = rng.pick(E ? [10, 20, 30, 40, 50] : Hd ? [12, 16, 24, 32, 36, 48] : [10, 15, 20, 25]);
            const relIncrease = rng.pick(E ? [10, 20, 50, 100] : Hd ? [12.5, 25, 37.5, 62.5, 75] : [20, 40, 50, 60, 80, 100]);
            const diffP = (r1 * relIncrease) / 100;
            // 상: %p 차이는 소수 첫째 자리까지 허용(r1 × 상대증가율이 10의 배수), 중·하: 정수만
            if (Hd ? (r1 * relIncrease) % 10 !== 0 : !Number.isInteger(diffP)) return this.generate(rng, { tier });
            const r2 = Hd ? Math.round((r1 + diffP) * 10) / 10 : r1 + diffP;

            const correct = `${diffP}%p 상승 (상대 증가율은 ${relIncrease}% 증가)`;
            const distractors = [
              `${relIncrease}%p 상승 (상대 증가율은 ${diffP}% 증가)`,
              `${diffP}%p 상승 (상대 증가율도 ${diffP}% 증가)`,
              `${r2}%p 상승 (상대 증가율은 ${relIncrease}% 증가)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `어느 지역의 재활용 분리배출 참여율이 작년에는 ${r1}%였고, 올해는 ${r2}%로 높아졌습니다. 이 변화를 '퍼센트포인트(%p)'와 '상대 증가율(%)'로 올바르게 설명한 것은?`,
              variablesInfo: { 작년비율: `${r1}%`, 올해비율: `${r2}%`, 차이: `${diffP}%p`, 상대증가율: `${relIncrease}%` },
              options,
              answerIndex,
              hint: `백분율 수치의 단순 차이(${r2} − ${r1})는 '%p' 단위를 쓰고, 작년 수치(${r1}%)를 기준으로 몇 % 늘어났는지는 ((${diffP} ÷ ${r1}) × 100)%로 계산합니다.`,
              steps: [
                `백분율 자체의 산술적 차이는 ${r2}% − ${r1}% = ${diffP}%p(퍼센트포인트) 상승입니다.`,
                `작년 참여율(${r1}%) 대비 상대적인 증가 비율은 (${diffP} ÷ ${r1}) × 100 = ${relIncrease}% 증가입니다.`,
                `따라서 '${diffP}%p 상승했으며, 작년 대비 ${relIncrease}% 증가했다'가 정확한 표현입니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-08',
          dayIndex: 7,
          unit: '경제 수학 · 환율과 환전 우대율',
          standardCode: '[12경수01-02]',
          standardName: '환율과 관련된 실생활 문제를 해결할 수 있다.',
          sourceRef: '고등학교 경제 수학 (매매기준율과 환전 우대율 계산)',
          difficulty: '★★☆ 표준',
          conceptSummary: '환율 우대율(스프레드 할인율)은 매매기준율 전체를 깎아주는 것이 아니라, 은행의 환전 수수료(스프레드)를 할인해 주는 비율입니다.',
          formula: '적용 환율 = 매매기준율 + 환전수수료 × (1 − 우대율/100)',
          tierGuide: {
            easy: '수수료 20원에 우대 50%, 100~500달러 환전',
            normal: '수수료 20원에 우대 50~90%, 500·1,000달러 환전',
            hard: '수수료 25~40원, 우대 60~85%로 1달러당 수수료가 소수(예 5.25원)'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const Hd = tier === 'hard';
              const baseRate = Hd ? rng.pick([1294, 1318, 1346, 1372, 1405]) : rng.pick([1300, 1310, 1320, 1330, 1340, 1350, 1360]);
              const spread = Hd ? rng.pick([25, 30, 35, 40]) : 20;
              const discountPct = Hd ? rng.pick([60, 70, 75, 85]) : 50;
              const amountUsd = Hd ? rng.pick([300, 700, 1200, 1500]) : rng.pick([100, 200, 300, 500]);
              // 1달러당 실제 수수료: spread × (100 − 우대율)/100 → 0.25 단위라 이진 소수로 정확
              const appliedSpread = spread * (100 - discountPct) / 100;
              const appliedRate = baseRate + appliedSpread;
              const totalKrw = amountUsd * appliedRate;
              const noDiscountKrw = amountUsd * (baseRate + spread);
              const saved = noDiscountKrw - totalKrw;
              const { options, answerIndex } = buildChoiceSet(rng, `${comma(totalKrw)}원 (${comma(saved)}원 절약)`, [
                `${comma(noDiscountKrw)}원 (우대 미적용 금액)`,
                `${comma(Math.round(amountUsd * baseRate * (100 - discountPct) / 100))}원 (기준율 전체 할인 오산)`,
                `${comma(totalKrw - 10000)}원 (${comma(saved + 10000)}원 절약)`
              ]);
              return {
                question: `미국 달러의 매매기준율이 1달러당 ${comma(baseRate)}원이고 은행의 현찰 살 때 기본 수수료(스프레드)가 ${spread}원입니다. 주거래 은행에서 환율 우대 ${discountPct}%를 적용받아 ${amountUsd}달러를 환전할 때, 필요한 원화 금액과 우대받아 절약한 금액은?`,
                variablesInfo: { 기준율: `${baseRate}원`, 우대율: `${discountPct}%`, 환전달러: `${amountUsd}$` },
                options,
                answerIndex,
                hint: `우대율 ${discountPct}%는 ${spread}원 수수료 중 ${discountPct}%를 깎아준다는 뜻입니다. 실제 내는 1달러당 수수료는 ${spread} × (1 − ${discountPct / 100})원입니다.`,
                steps: [
                  `우대 전 1달러당 현찰 살 때 환율은 ${comma(baseRate)} + ${spread} = ${comma(baseRate + spread)}원입니다.`,
                  `수수료 ${spread}원에 우대 ${discountPct}%를 적용하면 실제 수수료는 ${spread} × ${(100 - discountPct) / 100} = ${appliedSpread}원입니다.`,
                  `적용 환율은 ${comma(baseRate)} + ${appliedSpread} = ${comma(appliedRate)}원이므로 ${amountUsd}달러 환전에 ${comma(amountUsd)} × ${comma(appliedRate)} = ${comma(totalKrw)}원이 필요합니다.`,
                  `절약액은 1달러당 깎인 수수료 ${spread * discountPct / 100}원 × ${amountUsd}달러 = ${comma(saved)}원입니다.`
                ]
              };
            }
            const baseRate = rng.pick([1300, 1320, 1350, 1380]);
            const spread = 20; // 기본 스프레드: 20원
            const discountPct = rng.pick([50, 80, 90]); // 우대율
            const appliedSpread = spread * (1 - discountPct / 100);
            const appliedRate = baseRate + appliedSpread;
            const amountUsd = rng.pick([500, 1000]);
            const totalKrw = Math.round(amountUsd * appliedRate);
            const noDiscountKrw = Math.round(amountUsd * (baseRate + spread));
            const saved = noDiscountKrw - totalKrw;

            const correct = `${comma(totalKrw)}원 (${comma(saved)}원 절약)`;
            const distractors = [
              `${comma(noDiscountKrw)}원 (우대 미적용 금액)`,
              `${comma(Math.round(amountUsd * (baseRate * (1 - discountPct / 100))))}원 (기준율 전체 할인 오산)`,
              `${comma(totalKrw - 10000)}원 (${comma(saved + 10000)}원 절약)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `미국 달러의 매매기준율이 1달러당 ${comma(baseRate)}원이고 은행의 현찰 살 때 기본 수수료(스프레드)가 20원입니다. 주거래 은행에서 환율 우대 ${discountPct}%를 적용받아 ${amountUsd}달러를 환전할 때, 필요한 원화 금액과 우대받아 절약한 금액은?`,
              variablesInfo: { 기준율: `${baseRate}원`, 우대율: `${discountPct}%`, 환전달러: `${amountUsd}$` },
              options,
              answerIndex,
              hint: `우대율 ${discountPct}%는 20원 수수료 중 ${discountPct}%를 깎아준다는 뜻입니다. 실제 내는 1달러당 수수료는 20 × (1 − ${discountPct / 100})원입니다.`,
              steps: [
                `우대 전 1달러당 현찰 살 때 환율은 ${baseRate} + 20 = ${baseRate + 20}원입니다.`,
                `수수료 20원에 우대 ${discountPct}%를 적용하면 실제 수수료는 20 × (1 − ${discountPct / 100}) = ${Math.round(appliedSpread * 100) / 100}원입니다.`,
                `따라서 적용 환율은 ${baseRate} + ${appliedSpread} = ${appliedRate}원이며, ${amountUsd}달러 환전에 ${comma(totalKrw)}원이 필요합니다. (우대 미적용 대비 ${comma(saved)}원 절약)`
              ]
            };
          }
        },
        {
          id: 'LIF-09',
          dayIndex: 8,
          unit: '생활 수학 · 데이터 전송 속도와 다운로드 시간',
          standardCode: '[12직수01-03]',
          standardName: '시간, 길이, 무게, 들이의 표준 단위를 알고, 단위를 환산할 수 있다.',
          sourceRef: '생활 속 단위 환산 (디지털 데이터 용량과 인터넷 속도)',
          difficulty: '★★☆ 표준',
          conceptSummary: '인터넷 통신 속도 단위인 Mbps(Mega bit per second)는 비트 단위이며, 1 Byte = 8 bits 이므로 실제 다운로드 속도(MB/s)는 8로 나누어야 합니다.',
          formula: '전송 속도(MB/s) = 전송 속도(Mbps) ÷ 8,  시간(초) = 전체 파일 용량(MB) ÷ 속도(MB/s)',
          tierGuide: {
            easy: '400~1,600Mbps로 1~5GB, 대부분 1분 안쪽의 초 단위 답',
            normal: '80~800Mbps로 1~5GB, 분·초로 환산',
            hard: '100·300·500Mbps처럼 8로 나누면 소수(12.5MB/s 등)가 되는 속도, 2~9GB'
          },
          generate(rng, { tier } = {}) {
            // 정답 시간이 정수 초가 되는 (속도, 용량) 조합만 사용 (240 Mbps = 30 MB/s 는 3 GB만)
            // 하·상은 속도·용량 후보만 바뀌고 나머지 흐름은 같다
            const speeds = tier === 'easy' ? [400, 800, 1000, 1600] : tier === 'hard' ? [100, 200, 300, 500, 600] : [80, 160, 240, 400, 800];
            const sizes = tier === 'hard' ? [2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5];
            const combos = [];
            for (const sp of speeds) {
              for (const gb of sizes) if ((gb * 1000) % (sp / 8) === 0) combos.push([sp, gb]);
            }
            const [mbps, fileSizeGB] = rng.pick(combos); // 속도는 8의 배수
            const speedMBps = mbps / 8;
            const fileSizeMB = fileSizeGB * 1000; // 1GB = 1,000MB 기준
            const timeSec = fileSizeMB / speedMBps;
            // 초 → "m분 s초" (소수 1자리로 반올림, 반올림이 일어났을 때만 "약")
            const fmtTime = t => {
              const mm = Math.floor(t / 60);
              const exact = t - mm * 60;
              const ss = Math.round(exact * 10) / 10;
              const approx = Math.abs(ss - exact) > 1e-9;
              const body = mm > 0 ? (ss > 0 ? `${mm}분 ${ss}초` : `${mm}분`) : `${ss}초`;
              return approx ? `약 ${body}` : body;
            };
            const timeStr = fmtTime(timeSec);

            const correct = `${timeStr} (실제 속도: ${speedMBps} MB/s)`;
            const naiveSec = fileSizeMB / mbps;
            const distractors = [
              `${fmtTime(naiveSec)} (실제 속도를 ${mbps} MB/s로 오산)`,
              `${timeSec * 2}초 (실제 속도: ${speedMBps / 2} MB/s)`,
              `${timeStr} (실제 속도: ${mbps} MB/s)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `가정용 인터넷의 다운로드 속도가 ${mbps} Mbps일 때, 크기가 ${fileSizeGB} GB(${comma(fileSizeMB)} MB)인 고화질 영화 파일을 다운로드하는 데 걸리는 실제 이론상 시간은 얼마인가요?`,
              variablesInfo: { 통신속도: `${mbps} Mbps`, 파일용량: `${fileSizeGB} GB (${fileSizeMB} MB)` },
              options,
              answerIndex,
              hint: `1 Byte = 8 bits 입니다! ${mbps} Mbps(메가비트)를 8로 나누어 초당 몇 MB(메가바이트)가 다운로드되는지 먼저 구하세요.`,
              steps: [
                `1 바이트(Byte) = 8 비트(bit)이므로 ${mbps} Mbps = ${mbps} ÷ 8 = ${speedMBps} MB/s 입니다.`,
                `${fileSizeGB} GB = ${fileSizeMB} MB이므로 걸리는 시간은 ${fileSizeMB} ÷ ${speedMBps} = ${timeSec}초입니다.`,
                `따라서 소요 시간은 ${timeStr} 입니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-10',
          dayIndex: 9,
          unit: '경제 수학 · 부가가치세(VAT 10%) 역산',
          standardCode: '[12경수01-03]',
          standardName: '세금과 관련된 실생활 문제를 해결할 수 있다.',
          sourceRef: '고등학교 경제 수학 (세금의 계산)',
          difficulty: '★★☆ 표준',
          conceptSummary: '부가가치세 10%가 포함된 총 결제 금액은 공급가액의 1.1배입니다. 따라서 공급가액 = (총 결제액) ÷ 1.1 입니다.',
          formula: '공급가액 = 총 결제 금액 ÷ 1.1,  부가가치세 = 총 결제 금액 − 공급가액',
          tierGuide: {
            easy: '공급가액이 1,000원 단위인 작은 결제 금액 역산',
            normal: '공급가액 1만~10만 원 단위 결제 금액 역산',
            hard: '공급가액이 10원 단위(예 46,870원)라 결제 금액이 딱 떨어지지 않는 역산'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const Hd = tier === 'hard';
              const basePrice = Hd ? rng.int(1100, 9900) * 10 : rng.pick([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 12000, 15000, 18000]);
              const vat = basePrice / 10;
              const total = basePrice + vat;
              const naiveVat = Math.round(total / 10);
              const fiveVat = Math.round(total * 5 / 100);
              const { options, answerIndex } = buildChoiceSet(rng, `공급가액: ${comma(basePrice)}원, 부가가치세: ${comma(vat)}원`, [
                `공급가액: ${comma(total - naiveVat)}원, 부가가치세: ${comma(naiveVat)}원 (총액의 10%로 오인)`,
                `공급가액: ${comma(total - fiveVat)}원, 부가가치세: ${comma(fiveVat)}원`,
                `공급가액: ${comma(total)}원, 부가가치세: 0원`
              ]);
              return {
                question: `${Hd ? '거래처 납품 대금으로' : '식당에서'} 부가가치세(10%)가 포함된 금액으로 총 ${comma(total)}원을 결제했습니다. 영수증에 표기될 ${Hd ? '물품 가격' : '순수 음식 가격'}(공급가액)과 부가가치세(VAT)는 각각 얼마인가요?`,
                variablesInfo: { 결제총액: `${comma(total)}원`, 부가세율: '10%' },
                options,
                answerIndex,
                hint: `총 결제액은 (공급가액) × 1.1 입니다. ${comma(total)}원의 10%를 빼는 것이 아니라 1.1로 나누어야 합니다!`,
                steps: [
                  `(총 결제 금액) = (공급가액) + (공급가액의 10%) = (공급가액) × 1.1 입니다.`,
                  `따라서 공급가액 = ${comma(total)} ÷ 1.1 = ${comma(basePrice)}원입니다.`,
                  `부가가치세는 ${comma(total)} − ${comma(basePrice)} = ${comma(vat)}원입니다. (확인: ${comma(basePrice)}의 10%)`
                ]
              };
            }
            const basePrice = rng.pick([10000, 20000, 30000, 50000, 70000, 100000]);
            const vat = basePrice * 0.1;
            const total = basePrice + vat;

            const correct = `공급가액: ${comma(basePrice)}원, 부가가치세: ${comma(vat)}원`;
            const naiveVat = total * 0.1;
            const naiveBase = total - naiveVat;
            const distractors = [
              `공급가액: ${comma(naiveBase)}원, 부가가치세: ${comma(naiveVat)}원 (총액의 10%로 오인)`,
              // 세율을 총액의 5%로 오인 (이전 '공급가액 −1,000원' 보기는 100,000원일 때 총액 10% 오인 보기와 숫자가 같았음)
              `공급가액: ${comma(total - Math.round(total * 0.05))}원, 부가가치세: ${comma(Math.round(total * 0.05))}원`,
              `공급가액: ${comma(total)}원, 부가가치세: 0원`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `식당에서 부가가치세(10%)가 포함된 금액으로 총 ${comma(total)}원을 결제했습니다. 영수증에 표기될 순수 음식 가격(공급가액)과 부가가치세(VAT)는 각각 얼마인가요?`,
              variablesInfo: { 결제총액: `${comma(total)}원`, 부가세율: '10%' },
              options,
              answerIndex,
              hint: `총 결제액은 (공급가액) × 1.1 입니다. ${comma(total)}원의 10%를 빼는 것이 아니라 1.1로 나누어야 합니다!`,
              steps: [
                `(총 결제 금액) = (공급가액) + (공급가액의 10%) = (공급가액) × 1.1 입니다.`,
                `따라서 공급가액 = ${comma(total)} ÷ 1.1 = ${comma(basePrice)}원입니다.`,
                `부가가치세는 ${comma(total)} − ${comma(basePrice)} = ${comma(vat)}원입니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-11',
          dayIndex: 10,
          unit: '생활 수학 · 충전 전력(W) 비교',
          standardCode: '[12직수01-01]',
          standardName: '직무 상황에서 수 개념과 사칙연산의 문제를 해결하고 그 유용성을 인식할 수 있다.',
          sourceRef: '생활 속 사칙연산 (전력 = 전압 × 전류)',
          difficulty: '★☆☆ 기초',
          conceptSummary: '전력(W, 와트)은 전압(V, 볼트)과 전류(A, 암페어)의 곱입니다. 전력이 높을수록 단위 시간당 충전 속도가 빠릅니다.',
          formula: '전력(W) = 전압(V) × 전류(A)',
          tierGuide: {
            easy: '5V-1A(5W) 충전기와 비교, 배수가 정수 또는 소수 한 자리',
            normal: '5V-2A(10W) 충전기와 9~20V 고속 충전기 비교',
            hard: '15W·18W 충전기끼리 비교, 배수가 나누어떨어지지 않아 반올림(예 3.3배)'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const Hd = tier === 'hard';
              const [v1, a1] = Hd ? rng.pick([[5, 3], [9, 2]]) : [5, 1];
              const [v2, a2] = Hd ? rng.pick([[15, 3], [20, 3], [20, 5], [12, 3], [9, 3]]) : rng.pick([[5, 2], [5, 3], [9, 2], [15, 2], [20, 2], [15, 3], [20, 3]]);
              const p1 = v1 * a1, p2 = v2 * a2;
              const times = Math.round((p2 / p1) * 10) / 10;
              const exact = Number.isInteger((p2 * 10) / p1);
              const { options, answerIndex } = buildChoiceSet(rng, `충전기 B (${p2}W)가 충전기 A (${p1}W)보다 ${times}배 더 빠름`, [
                `충전기 B (${v2 + a2}W)가 충전기 A (${v1 + a1}W)보다 빠름`,
                `두 충전기의 전력이 ${p1}W로 동일함`,
                `충전기 A가 충전기 B보다 ${times}배 더 빠름`
              ]);
              return {
                question: `스마트폰 충전기 A는 ${v1}V-${a1}A 규격이고, 초고속 충전기 B는 ${v2}V-${a2}A 규격입니다. 두 충전기의 전력(W)과 충전 속도를 바르게 비교한 것은?${exact ? '' : ' (배수는 소수 첫째 자리까지 반올림)'}`,
                variablesInfo: { 충전기A: `${v1}V-${a1}A (${p1}W)`, 충전기B: `${v2}V-${a2}A (${p2}W)`, 배수: `${times}배` },
                options,
                answerIndex,
                hint: `전력 공식은 전력(W) = 전압(V) × 전류(A) 입니다. 각각 곱해서 와트(W)를 구한 뒤 나누어 비교하세요.`,
                steps: [
                  `충전기 A의 전력 = ${v1}V × ${a1}A = ${p1}W 입니다.`,
                  `충전기 B의 전력 = ${v2}V × ${a2}A = ${p2}W 입니다.`,
                  `${p2} ÷ ${p1} ${exact ? '=' : '≈'} ${times} 이므로 충전기 B가 충전기 A보다 약 ${times}배 더 높은 전력으로 빠르게 충전됩니다.`
                ]
              };
            }
            const v1 = 5, a1 = 2; // 10W 일반
            const v2 = rng.pick([9, 15, 20]);
            const a2 = rng.pick([2, 3]);
            const p1 = v1 * a1;
            const p2 = v2 * a2;
            const times = Number((p2 / p1).toFixed(1));

            const correct = `충전기 B (${p2}W)가 충전기 A (${p1}W)보다 ${times}배 더 빠름`;
            const distractors = [
              `충전기 B (${v2 + a2}W)가 충전기 A (${v1 + a1}W)보다 빠름`,
              `두 충전기의 전력이 ${p1}W로 동일함`,
              `충전기 A가 충전기 B보다 ${times}배 더 빠름`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `스마트폰 충전기 A는 ${v1}V-${a1}A 규격이고, 초고속 충전기 B는 ${v2}V-${a2}A 규격입니다. 두 충전기의 전력(W)과 충전 속도를 바르게 비교한 것은?`,
              variablesInfo: { 충전기A: `${v1}V-${a1}A (${p1}W)`, 충전기B: `${v2}V-${a2}A (${p2}W)`, 배수: `${times}배` },
              options,
              answerIndex,
              hint: `전력 공식은 전력(W) = 전압(V) × 전류(A) 입니다. 각각 곱해서 와트(W)를 구하세요.`,
              steps: [
                `충전기 A의 전력 = ${v1}V × ${a1}A = ${p1}W 입니다.`,
                `충전기 B의 전력 = ${v2}V × ${a2}A = ${p2}W 입니다.`,
                `${p2} ÷ ${p1} = ${times} 이므로 충전기 B가 충전기 A보다 약 ${times}배 더 높은 전력으로 빠르게 충전됩니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-12',
          dayIndex: 11,
          unit: '생활 수학 · 체질량지수(BMI)',
          standardCode: '[12직수01-01]',
          standardName: '직무 상황에서 수 개념과 사칙연산의 문제를 해결하고 그 유용성을 인식할 수 있다.',
          sourceRef: '생활 속 사칙연산 (체질량지수 계산과 판정)',
          difficulty: '★★☆ 표준',
          conceptSummary: '체질량지수(BMI) = 체중(kg) ÷ (키(m))² 입니다. 키를 cm가 아닌 m 단위로 환산하여 제곱해야 합니다.',
          formula: 'BMI = 체중(kg) ÷ (신장(m))²',
          tierGuide: {
            easy: '판정 경계(23·25)에서 멀리 떨어진 BMI, 정수 체중',
            normal: '키 160~180cm, BMI 20~26 부근 판정',
            hard: '키 158·163cm 등, 소수 체중으로 BMI가 판정 경계(23·25) 바로 근처'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const Hd = tier === 'hard';
              const hCm = Hd ? rng.pick([158, 163, 167, 172, 177, 183]) : rng.pick([150, 155, 160, 165, 170, 175, 180, 185]);
              const hm = hCm / 100;
              const hmSqRaw = hm * hm;
              const hmSq = Number(hmSqRaw.toFixed(4));
              const targetBmi = Hd ? rng.pick([22.7, 23.3, 24.6, 25.4]) : rng.pick([20, 21, 27, 29]);
              // 상: 체중을 0.1kg 단위로
              const weight = Hd ? Math.round(targetBmi * hmSqRaw * 10) / 10 : Math.round(targetBmi * hmSqRaw);
              const actualBmi = Math.round((weight / hmSqRaw) * 10) / 10;
              const status = actualBmi >= 25 ? '비만' : (actualBmi >= 23 ? '과체중' : '정상 체중');
              // 오답 판정: 바로 옆 구간으로 잘못 판정
              const wrong = actualBmi < 23 ? '과체중' : actualBmi < 25 ? (actualBmi < 24 ? '정상 체중' : '비만') : '과체중';
              const { options, answerIndex } = buildChoiceSet(rng, `BMI 약 ${actualBmi} (${status})`, [
                `BMI 약 ${actualBmi} (${wrong})`,
                `BMI 약 ${(weight / hm).toFixed(1)} (키를 제곱하지 않은 오산)`,
                `BMI 약 ${(actualBmi + 3).toFixed(1)} (${status === '비만' ? '과체중' : '비만'})`
              ]);
              return {
                question: `신장 ${hCm} cm, 체중 ${weight} kg인 사람의 체질량지수(BMI)와 건강 판정(대한비만학회 기준: 18.5~22.9 정상, 23~24.9 과체중, 25 이상 비만)으로 옳은 것은? (BMI는 소수 첫째 자리까지 반올림)`,
                variablesInfo: { 키: `${hCm}cm (${hm}m)`, 체중: `${weight}kg`, BMI: actualBmi },
                options,
                answerIndex,
                hint: `키 ${hCm} cm를 m 단위로 바꾸면 ${hm} m입니다. BMI = ${weight} ÷ (${hm} × ${hm})${jo(hm, '을/를')} 계산하세요.`,
                steps: [
                  `신장을 m 단위로 환산하면 ${hCm} cm = ${hm} m 입니다.`,
                  `키의 제곱은 ${hm} × ${hm} = ${hmSq} 입니다.`,
                  `BMI = ${weight} ÷ ${hmSq} ≈ ${actualBmi} 입니다. 기준에 따라 ${status}에 해당합니다.`
                ]
              };
            }
            const hCm = rng.pick([160, 170, 175, 180]);
            const hm = hCm / 100;
            const hmSq = Number((hm * hm).toFixed(4));
            const targetBmi = rng.pick([20, 22, 24, 26]);
            const weight = Math.round(targetBmi * hmSq);
            const actualBmi = Number((weight / hmSq).toFixed(1));
            const status = actualBmi >= 25 ? '비만' : (actualBmi >= 23 ? '과체중' : '정상 체중');

            const correct = `BMI 약 ${actualBmi} (${status})`;
            const distractors = [
              `BMI 약 ${actualBmi} (${actualBmi >= 25 ? '정상 체중' : '비만'})`,
              `BMI 약 ${(weight / hm).toFixed(1)} (키를 제곱하지 않은 오산)`,
              `BMI 약 ${(actualBmi + 3).toFixed(1)} (과체중)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `신장 ${hCm} cm, 체중 ${weight} kg인 사람의 체질량지수(BMI)와 건강 판정(대한비만학회 기준: 18.5~22.9 정상, 23~24.9 과체중, 25 이상 비만)으로 옳은 것은?`,
              variablesInfo: { 키: `${hCm}cm (${hm}m)`, 체중: `${weight}kg`, BMI: actualBmi },
              options,
              answerIndex,
              hint: `키 ${hCm} cm를 m 단위로 바꾸면 ${hm} m입니다. BMI = ${weight} ÷ (${hm} × ${hm})${jo(hm, '을/를')} 계산하세요.`,
              steps: [
                `신장을 m 단위로 환산하면 ${hCm} cm = ${hm} m 입니다.`,
                `키의 제곱은 ${hm} × ${hm} = ${hmSq} 입니다.`,
                `BMI = ${weight} ÷ ${hmSq} ≈ ${actualBmi} 입니다. 기준에 따라 ${status}에 해당합니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-13',
          dayIndex: 12,
          unit: '경제 수학 · 실질 수익률과 물가상승률',
          standardCode: '[12경수01-01]',
          standardName: '통계 자료를 활용하여 경제지표의 의미를 이해하고, 경제지표의 변화를 설명할 수 있다.',
          sourceRef: '고등학교 경제 수학 (물가 지표와 실질 이자율)',
          difficulty: '★★★ 실력',
          conceptSummary: '피셔 방정식에 의해 (실질금리) ≈ (명목금리) − (물가상승률) 입니다. 명목금리가 높아도 물가상승률이 더 높으면 실질 구매력은 감소합니다.',
          formula: '실질 이자율 ≈ 명목 이자율 − 물가상승률',
          tierGuide: {
            easy: '물가상승률이 명목금리보다 1~2%p 높은 경우, 1,000만~3,000만 원',
            normal: '1,000만 원, 명목금리 3~5%와 물가상승률 4~6%',
            hard: '2,500만~8,000만 원, 금리와 물가 차이가 3~5%p로 큰 경우의 구매력 손실'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const Hd = tier === 'hard';
              const principal = Hd ? rng.pick([2500, 4000, 6000, 8000]) : rng.pick([1000, 2000, 3000]); // 만 원
              const [nominal, inflation] = Hd ? rng.pick([[2, 5], [3, 7], [4, 8], [1, 6], [2, 6]]) : rng.pick([[2, 3], [2, 4], [3, 4], [1, 3], [3, 5]]);
              const real = nominal - inflation;
              const nominalAmount = principal * (100 + nominal) / 100;
              const realPurchasing = nominalAmount / (1 + inflation / 100);
              const loss = Math.round(principal - realPurchasing);
              const { options, answerIndex } = buildChoiceSet(rng, `실질 수익률: 약 ${real}% (구매력 기준 약 ${loss}만 원 실질 손실)`, [
                `실질 수익률: ${nominal + inflation}% (구매력 증가)`,
                `실질 수익률: ${nominal}% (물가 무관 이득)`,
                `실질 수익률: 약 ${real}% (구매력 기준 ${loss * 2}만 원 실질 손실)`
              ]);
              return {
                question: `연이율 ${nominal}%인 1년 만기 정기예금에 ${comma(principal)}만 원을 가입했는데, 1년 동안 소비자물가상승률이 ${inflation}%를 기록했습니다. 이 예금의 '실질 수익률'과 실제 구매력 변화에 대한 설명으로 옳은 것은? (손실액은 만 원 단위로 반올림)`,
                variablesInfo: { 명목금리: `${nominal}%`, 물가상승률: `${inflation}%`, 실질수익률: `${real}%` },
                options,
                answerIndex,
                hint: `실질 수익률은 통장에 찍히는 명목 이율(${nominal}%)에서 물가상승률(${inflation}%)을 뺀 값입니다!`,
                steps: [
                  `피셔 방정식에 의해 (실질 수익률) ≈ (명목 이자율) − (물가상승률) = ${nominal}% − ${inflation}% = ${real}% 입니다.`,
                  `1년 후 통장 잔고는 ${comma(principal)} × ${(100 + nominal) / 100} = ${comma(nominalAmount)}만 원이지만, 물가가 ${inflation}% 올랐으므로 구매력 가치는 ${comma(nominalAmount)} ÷ ${(100 + inflation) / 100} ≈ ${comma(Math.round(realPurchasing * 10) / 10)}만 원입니다.`,
                  `즉, 돈의 액수는 늘었으나 실질 구매력은 ${comma(principal)} − ${comma(Math.round(realPurchasing * 10) / 10)} ≈ ${loss}만 원 감소했습니다.`
                ]
              };
            }
            // 물가상승률 > 명목금리 조합만 (같으면 손실 0 → '손실×2' 보기와 동일해져 정답 중복)
            const [nominal, inflation] = rng.pick([[3, 4], [3, 5], [3, 6], [4, 5], [4, 6], [5, 6]]);
            const real = nominal - inflation; // 음수 실질 금리 상황 연출
            const principal = 1000; // 1,000만 원
            const nominalAmount = Math.round(principal * (1 + nominal / 100));
            const realPurchasing = Math.round((nominalAmount / (1 + inflation / 100)));
            const loss = principal - realPurchasing;

            const correct = `실질 수익률: 약 ${real}% (구매력 기준 약 ${loss}만 원 실질 손실)`;
            const distractors = [
              `실질 수익률: ${nominal + inflation}% (구매력 증가)`,
              `실질 수익률: ${nominal}% (물가 무관 이득)`,
              `실질 수익률: 약 ${real}% (구매력 기준 ${loss * 2}만 원 실질 손실)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `연이율 ${nominal}%인 1년 만기 정기예금에 1,000만 원을 가입했는데, 1년 동안 소비자물가상승률이 ${inflation}%를 기록했습니다. 이 예금의 '실질 수익률'과 실제 구매력 변화에 대한 설명으로 옳은 것은?`,
              variablesInfo: { 명목금리: `${nominal}%`, 물가상승률: `${inflation}%`, 실질수익률: `${real}%` },
              options,
              answerIndex,
              hint: `실질 수익률은 통장에 찍히는 명목 이율(${nominal}%)에서 물가상승률(${inflation}%)을 뺀 값입니다!`,
              steps: [
                `피셔 방정식에 의해 (실질 수익률) ≈ (명목 이자율) − (물가상승률) = ${nominal}% − ${inflation}% = ${real}% 입니다.`,
                `1년 후 통장 잔고는 ${nominalAmount}만 원으로 늘어나지만, 물가가 ${inflation}% 올랐기 때문에 실질 구매력 가치는 ${nominalAmount} ÷ (1 + ${inflation / 100}) ≈ ${realPurchasing}만 원에 불과합니다.`,
                `즉, 돈의 액수는 늘었으나 실질 구매력은 약 ${loss}만 원 감소했습니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-14',
          dayIndex: 13,
          unit: '경제 수학 · 할부 vs 일시불 할인',
          standardCode: '[12경수01-04]',
          standardName: '단리와 복리를 이용하여 이자와 원리 합계를 구하고, 미래에 받을 금액의 현재 가치를 구할 수 있다.',
          sourceRef: '고등학교 경제 수학 (이자와 결제 방식 비교)',
          difficulty: '★★☆ 표준',
          conceptSummary: '일시불 할인 금액과 무이자 할부로 남은 돈을 예치했을 때의 이자 수익을 비교하여 더 이득인 결제 방식을 선택합니다.',
          formula: '순혜택 비교 = 일시불 할인 금액 vs 파킹통장 이자 수익',
          tierGuide: {
            easy: '50만~300만 원, 6개월 할부 이자와 일시불 2~5% 할인 비교',
            normal: '60만~240만 원, 6개월 할부(연 3.6%)와 일시불 3·5% 할인 비교',
            hard: '10·12개월 할부, 연 4.8·6% 예치 이자와 1~3% 할인 — 할부가 이길 수도 있음'
          },
          generate(rng, { tier } = {}) {
            if (tier === 'easy' || tier === 'hard') {
              const Hd = tier === 'hard';
              const price = Hd ? rng.pick([1200000, 1800000, 2400000, 3600000]) : rng.pick([500000, 1000000, 2000000, 3000000]);
              const discountRate = Hd ? rng.pick([1, 2, 3]) : rng.pick([2, 3, 5]);
              const months = Hd ? rng.pick([10, 12]) : 6;
              const annualInterest = Hd ? rng.pick([4.8, 6]) : 3.6;
              const discountAmount = price * discountRate / 100;
              // m개월 무이자 할부: 평균 잔액 = 가격 × (m + 1) / (2m), 그 돈을 m개월 예치
              const interestEarned = Math.round(price * (months + 1) / 2 * annualInterest / 1200);
              if (discountAmount === interestEarned) return this.generate(rng, { tier });
              const isDiscountBetter = discountAmount > interestEarned;
              const diff = Math.abs(discountAmount - interestEarned);
              const correct = isDiscountBetter
                ? `일시불 할인 (${comma(discountAmount)}원 절약으로 할부 이자 ${comma(interestEarned)}원보다 ${comma(diff)}원 더 유리)`
                : `무이자 할부 (예치 이자 ${comma(interestEarned)}원으로 일시불 할인보다 ${comma(diff)}원 더 유리)`;
              const otherOption = isDiscountBetter
                ? `무이자 할부 (예치 이자 ${comma(interestEarned)}원이 더 유리)`
                : `일시불 할인 (${comma(discountAmount)}원 절약이 더 유리)`;
              const { options, answerIndex } = buildChoiceSet(rng, correct, [otherOption, `두 결제 방식의 혜택이 정확히 동일함`, `어떤 방식이든 결제 금액 차이가 없음`]);
              return {
                question: `${comma(price)}원짜리 가전을 구매할 때, [선택 A] 일시불 즉시 ${discountRate}% 할인 결제와 [선택 B] ${months}개월 무이자 할부(남은 잔액을 연 ${annualInterest}% 파킹통장에 예치하여 약 ${comma(interestEarned)}원 이자 수령) 중 수리적으로 더 이득인 선택은?`,
                variablesInfo: { 상품가격: `${comma(price)}원`, 일시불할인: `${comma(discountAmount)}원`, 할부예치이자: `${comma(interestEarned)}원` },
                options,
                answerIndex,
                hint: `일시불로 즉시 할인받는 금액과 할부로 매달 갚으며 통장에 남은 돈으로 얻는 총 이자(${comma(interestEarned)}원)의 크기를 직접 비교하세요.`,
                steps: [
                  `일시불 결제 시 즉시 아낄 수 있는 금액은 ${comma(price)} × ${discountRate}% = ${comma(discountAmount)}원입니다.`,
                  `${months}개월 무이자 할부 후 잔액을 연 ${annualInterest}% 파킹통장에 넣어 얻는 총 이자 수익은 약 ${comma(interestEarned)}원입니다.`,
                  `두 혜택을 비교하면 ${wj(isDiscountBetter ? '일시불 할인' : '무이자 할부', '이/가')} ${comma(diff)}원 더 유리합니다.`
                ]
              };
            }
            const price = rng.pick([600000, 1200000, 2400000]);
            const discountRate = rng.pick([3, 5]); // 일시불 즉시할인 %
            const discountAmount = (price * discountRate) / 100;
            // 6개월 무이자 할부 시 평균 잔액 예치 이자 (연 3.6% 파킹통장 기준)
            const annualInterest = 3.6;
            // 6개월 평균 잔액 = 약 price * 3.5 / 6
            const avgBalance = (price * (6 + 1)) / (2 * 6);
            const interestEarned = Math.round((avgBalance * (annualInterest / 100) * 6) / 12);
            const isDiscountBetter = discountAmount > interestEarned;
            const diff = Math.abs(discountAmount - interestEarned);

            const bestOption = isDiscountBetter
              ? `일시불 할인 (${comma(discountAmount)}원 절약으로 할부 이자 ${comma(interestEarned)}원보다 ${comma(diff)}원 더 유리)`
              : `무이자 할부 (예치 이자 ${comma(interestEarned)}원으로 일시불 할인보다 ${comma(diff)}원 더 유리)`;

            const correct = bestOption;
            const otherOption = !isDiscountBetter
              ? `일시불 할인 (${comma(discountAmount)}원 절약이 더 유리)`
              : `무이자 할부 (예치 이자 ${comma(interestEarned)}원이 더 유리)`;

            const distractors = [
              otherOption,
              `두 결제 방식의 혜택이 정확히 동일함`,
              `어떤 방식이든 결제 금액 차이가 없음`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `${comma(price)}원짜리 가전을 구매할 때, [선택 A] 일시불 즉시 ${discountRate}% 할인 결제와 [선택 B] 6개월 무이자 할부(남은 잔액을 연 ${annualInterest}% 파킹통장에 예치하여 약 ${comma(interestEarned)}원 이자 수령) 중 수리적으로 더 이득인 선택은?`,
              variablesInfo: { 상품가격: `${comma(price)}원`, 일시불할인: `${comma(discountAmount)}원`, 할부예치이자: `${comma(interestEarned)}원` },
              options,
              answerIndex,
              hint: `일시불로 즉시 할인받는 금액(${comma(discountAmount)}원)과 할부로 매달 갚으며 통장에 남은 돈으로 얻는 총 이자(${comma(interestEarned)}원)의 크기를 직접 비교하세요.`,
              steps: [
                `일시불 결제 시 즉시 아낄 수 있는 금액은 ${comma(price)} × ${discountRate}% = ${comma(discountAmount)}원입니다.`,
                `6개월 무이자 할부 후 잔액을 파킹통장에 넣어 얻는 총 이자 수익은 약 ${comma(interestEarned)}원입니다.`,
                `두 혜택을 비교하면 ${wj(discountAmount > interestEarned ? '일시불 할인' : '무이자 할부', '이/가')} ${comma(diff)}원 더 유리합니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-15',
          dayIndex: 14,
          unit: '경제 수학 · 급여와 실수령액',
          standardCode: '[12경수01-03]',
          standardName: '세금과 관련된 실생활 문제를 해결할 수 있다.',
          sourceRef: '고등학교 경제 수학 (세금 — 급여에서 공제되는 보험료·소득세와 실수령액)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '공제율 두 가지를 더해 세전 월급에 한 번 적용',
            normal: '공제율 세 가지 합 + 소득세(금액)를 빼서 실수령액',
            hard: '비과세 수당을 뺀 금액에만 공제율을 적용하고 소득세까지 빼기'
          },
          conceptSummary: '세전 월급에서 비율로 정해진 보험료 공제액과 소득세를 빼면 실제로 받는 돈(실수령액)이 됩니다. 비과세 수당은 공제율 계산 기준에서 빠집니다.',
          formula: '실수령액 = 세전 월급 − (과세 대상 급여 × 공제율 합) − 소득세',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const S = rng.int(22, 48) * 100000; // 세전 월급
            const a = rng.pick([4.5, 5]); // 국민연금(가정)
            const b = rng.pick([3.5, 4]); // 건강보험(가정)
            const items = E ? [['국민연금', a], ['건강보험', b]] : [['국민연금', a], ['건강보험', b], ['고용보험', 1]];
            const R = items.reduce((s, it) => s + it[1], 0); // 공제율 합(%)
            const tax = E ? 0 : rng.int(20, 150) * 1000;
            const free = Hd ? rng.pick([100000, 200000]) : 0; // 비과세 식대(가정)
            const baseAmt = S - free;
            const ded = baseAmt * R / 100;
            const net = S - ded - tax;
            const rateText = items.map(it => `${it[0]} ${it[1]}%`).join(', ');
            const cands = E
              ? [ded, S - S * a / 100, Math.round(S * (100 - a) * (100 - b) / 10000), S - S * b / 100]
              : Hd
                ? [S - S * R / 100 - tax, net + tax, net - free, ded + tax, S - tax]
                : [net + tax, ded + tax, S - tax, net - tax, S - S * a / 100 - tax];
            const ds = cands.filter((x, i) => x > 0 && x !== net && cands.indexOf(x) === i).slice(0, 3).map(x => `${comma(x)}원`);
            const { options, answerIndex } = buildChoiceSet(rng, `${comma(net)}원`, ds);
            const cond = '(공제율과 세금은 이 문제에서 정한 가정입니다.)';
            const question = E
              ? `세전 월급이 ${comma(S)}원인 직장인의 급여에서 ${rateText}가 세전 월급을 기준으로 공제됩니다. 이 직장인이 실제로 받는 월급(실수령액)은 얼마인가요? ${cond}`
              : Hd
                ? `세전 월급 ${comma(S)}원 중 식대 ${comma(free)}원은 비과세 수당입니다. ${rateText}는 비과세 수당을 뺀 금액을 기준으로 공제되고, 소득세 등 세금으로 ${comma(tax)}원이 추가로 공제됩니다. 실수령액은 얼마인가요? ${cond}`
                : `세전 월급이 ${comma(S)}원인 직장인의 급여에서 ${rateText}가 세전 월급을 기준으로 공제되고, 소득세 등 세금으로 ${comma(tax)}원이 추가로 공제됩니다. 실수령액은 얼마인가요? ${cond}`;
            const variablesInfo = { 세전월급: `${comma(S)}원`, 공제율: rateText };
            if (!E) variablesInfo.소득세 = `${comma(tax)}원`;
            if (Hd) variablesInfo.비과세 = `${comma(free)}원`;
            const steps = [
              `공제율을 모두 더하면 ${items.map(it => it[1]).join(' + ')} = ${R}%입니다. (항목마다 따로 빼도 기준 금액이 같으므로 합쳐서 계산할 수 있습니다.)`,
              Hd
                ? `공제율을 적용할 기준 금액은 ${comma(S)} − ${comma(free)} = ${comma(baseAmt)}원이고, 보험료 공제액은 ${comma(baseAmt)} × ${R / 100} = ${comma(ded)}원입니다.`
                : `보험료 공제액은 ${comma(S)} × ${R / 100} = ${comma(ded)}원입니다.`,
              E
                ? `실수령액은 ${comma(S)} − ${comma(ded)} = ${comma(net)}원입니다.`
                : `실수령액은 ${comma(S)} − ${comma(ded)} − ${comma(tax)} = ${comma(net)}원입니다.`
            ];
            return { question, variablesInfo, options, answerIndex, hint: Hd ? '비과세 수당은 공제율을 곱하는 기준 금액에서 먼저 빼고, 실수령액을 구할 때는 세전 월급 전체에서 공제액을 뺍니다.' : '공제율을 모두 더한 뒤 세전 월급에 곱하면 보험료 공제액이 됩니다.', steps };
          }
        },
        {
          id: 'LIF-16',
          dayIndex: 15,
          unit: '경제 수학 · 대출 원금균등분할상환',
          standardCode: '[12경수01-04]',
          standardName: '단리와 복리를 이용하여 이자와 원리 합계를 구하고, 미래에 받을 금액의 현재 가치를 구할 수 있다.',
          sourceRef: '고등학교 경제 수학 (단리 — 남은 원금에 붙는 이자와 대출 상환)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '첫 달 이자 = 원금 × 연이율 ÷ 12',
            normal: '첫 달 상환액 = 원금 ÷ 개월 수 + 첫 달 이자',
            hard: '남은 원금이 매달 줄어드는 것을 반영한 대출 기간 총 이자'
          },
          conceptSummary: '원금균등분할상환은 매달 원금을 똑같이 나누어 갚고, 이자는 그달 남아 있는 원금에 월 이율(연이율 ÷ 12)을 곱해 냅니다. 남은 원금이 줄어들수록 이자도 줄어듭니다.',
          formula: '월 원금 = P ÷ n,  k번째 달 이자 = (P − (k − 1)·P/n) × r/12,  총 이자 = P × r/12 × (n + 1)/2',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const combos = [];
            for (const pm of [1200, 2400, 3600, 4800, 6000]) for (const n of [12, 24, 36, 48, 60]) if ((pm * 10000) % n === 0) combos.push([pm, n]);
            const [pm, n] = rng.pick(combos);
            const P = pm * 10000;
            const r = rng.pick(E ? [3, 6] : [3, 3.6, 4.2, 4.8, 5.4, 6]);
            const I1 = P / 12000 * Math.round(r * 10); // 첫 달 이자 (P가 1,200만의 배수라 정수, 부동소수 피하려고 r×10 사용)
            const monthP = P / n;
            let ans, cands, ask;
            if (E) {
              ans = I1; ask = '첫 달에 내는 이자는 얼마인가요?';
              cands = [I1 * 12, monthP, I1 * 2, I1 / 2];
            } else if (!Hd) {
              ans = monthP + I1; ask = '첫 달 상환액(원금 + 이자)은 얼마인가요?';
              cands = [monthP, I1, monthP + I1 * 12, monthP + I1 * 2];
            } else {
              ans = I1 * (n + 1) / 2; ask = '대출 기간 동안 내는 총 이자는 얼마인가요?';
              cands = [I1 * n, I1 * n / 2, I1 * (n - 1) / 2, I1 * (n + 1)];
            }
            const ds = cands.filter((x, i) => Number.isInteger(x) && x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${comma(x)}원`);
            const { options, answerIndex } = buildChoiceSet(rng, `${comma(ans)}원`, ds);
            const steps = [
              `월 이율은 ${r}% ÷ 12이므로 첫 달 이자는 ${comma(P)} × ${r}/100 ÷ 12 = ${comma(I1)}원입니다.`
            ];
            if (E) steps.push(`연이율을 그대로 곱하면 1년 치 이자(${comma(I1 * 12)}원)가 되므로 반드시 12로 나누어야 합니다. 첫 달 이자는 ${comma(I1)}원입니다.`);
            else if (!Hd) steps.push(`매달 갚는 원금은 ${comma(P)} ÷ ${n} = ${comma(monthP)}원입니다.`, `첫 달 상환액은 ${comma(monthP)} + ${comma(I1)} = ${comma(ans)}원입니다.`);
            else steps.push(
              `매달 원금 ${comma(monthP)}원씩 줄어드므로 이자도 매달 ${comma(I1 / n)}원씩 줄어 마지막 달 이자는 ${comma(I1 / n)}원입니다.`,
              `이자는 ${comma(I1)}원부터 ${comma(I1 / n)}원까지 ${n}개월의 등차수열이므로 총 이자 = (${comma(I1)} + ${comma(I1 / n)}) × ${n} ÷ 2 = ${comma(ans)}원입니다.`
            );
            return {
              question: `${comma(pm)}만 원을 연이율 ${r}%, ${n}개월 원금균등분할상환 조건으로 빌렸습니다. 매달 원금을 똑같이 나누어 갚고, 이자는 그달 남아 있는 원금에 월 이율(연이율 ÷ 12)을 곱해 냅니다. ${ask}`,
              variablesInfo: { 대출원금: `${comma(P)}원`, 연이율: `${r}%`, 상환기간: `${n}개월` },
              options,
              answerIndex,
              hint: Hd ? '남은 원금이 매달 일정하게 줄어드니 이자도 등차수열로 줄어듭니다. (첫 달 이자 + 마지막 달 이자) × 개월 수 ÷ 2' : '이자는 연이율이 아니라 월 이율(연이율 ÷ 12)로 계산합니다.',
              steps
            };
          }
        },
        {
          id: 'LIF-17',
          dayIndex: 16,
          unit: '경제 수학 · 정기적금 만기 수령액',
          standardCode: '[12경수01-04]',
          standardName: '단리와 복리를 이용하여 이자와 원리 합계를 구하고, 미래에 받을 금액의 현재 가치를 구할 수 있다.',
          sourceRef: '고등학교 경제 수학 (단리 적금의 원리 합계)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '12개월 단리 적금의 세전 이자',
            normal: '12·24개월 단리 적금의 세전 만기 수령액(원금 + 이자)',
            hard: '12~36개월 적금에 이자소득세 15.4%를 뗀 세후 만기 수령액'
          },
          conceptSummary: '매달 같은 금액을 넣는 정기적금은 먼저 넣은 돈일수록 이자가 붙는 기간이 깁니다. 단리 적금에서 n개월 동안 넣으면 이자가 붙는 개월 수의 합은 n + (n − 1) + … + 1 = n(n + 1)/2 입니다.',
          formula: '이자(세전) = 월 납입액 × (연이율/12) × n(n + 1)/2,  만기 수령액 = 월 납입액 × n + 이자',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const M = rng.pick(Hd ? [100000, 200000, 300000, 400000, 500000, 1000000] : [100000, 150000, 200000, 300000, 500000]);
            const r = rng.pick(E ? [2, 4, 6] : Hd ? [3, 4, 5, 6] : [3, 3.5, 4, 4.5, 5]);
            const n = E ? 12 : rng.pick(Hd ? [12, 24, 36] : [12, 24]);
            const r10 = Math.round(r * 10);
            const tri = n * (n + 1) / 2;
            // 이자가 원 단위 정수가 되고(상: 세금 15.4%도 정수) 아니면 다시 뽑기
            if ((M * r10 * tri) % 12000 !== 0) return this.generate(rng, { tier });
            const interest = M * r10 * tri / 12000;
            if (Hd && (interest * 154) % 1000 !== 0) return this.generate(rng, { tier });
            const tax = Hd ? interest * 154 / 1000 : 0;
            const principalSum = M * n;
            const wrongFull = Math.round(principalSum * r / 100 * n / 12); // 전액을 n개월 예치한 것으로 착각
            const wrongYear = Math.round(principalSum * r / 100); // 기간 무시 연이율
            const wrongLess = M * r10 * (n * (n - 1) / 2) / 12000; // 마지막 달 이자 누락
            let ans, cands, ask;
            if (E) { ans = interest; cands = [wrongFull, wrongYear, wrongLess, interest * 2, Math.round(interest / 2)]; ask = '만기까지 받는 이자(세전)는 얼마인가요?'; }
            else if (!Hd) { ans = principalSum + interest; cands = [principalSum + wrongFull, principalSum + wrongYear, principalSum + wrongLess, interest, principalSum + interest * 2]; ask = '만기 수령액(원금 + 이자, 세전)은 얼마인가요?'; }
            else { ans = principalSum + interest - tax; cands = [principalSum + interest, principalSum + wrongFull - Math.round(wrongFull * 0.154), Math.round((principalSum + interest) * 0.846), principalSum - tax]; ask = '이자에 대해서만 이자소득세 15.4%를 뗀다고 할 때, 세후 만기 수령액은 얼마인가요?'; }
            const ds = cands.filter((x, i) => Number.isInteger(x) && x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${comma(x)}원`);
            const { options, answerIndex } = buildChoiceSet(rng, `${comma(ans)}원`, ds);
            const steps = [
              `첫 달에 넣은 돈은 ${n}개월, 둘째 달은 ${n - 1}개월, …, 마지막 달은 1개월 이자가 붙으므로 개월 수의 합은 ${n} × ${n + 1} ÷ 2 = ${tri}입니다.`,
              `이자 = ${comma(M)} × (${r}/100 ÷ 12) × ${tri} = ${comma(interest)}원입니다.`
            ];
            if (!E) steps.push(`넣은 원금은 ${comma(M)} × ${n} = ${comma(principalSum)}원입니다.`);
            if (Hd) steps.push(`이자소득세는 ${comma(interest)} × 0.154 = ${comma(tax)}원이므로 세후 수령액은 ${comma(principalSum)} + ${comma(interest)} − ${comma(tax)} = ${comma(ans)}원입니다.`);
            else if (!E) steps.push(`만기 수령액은 ${comma(principalSum)} + ${comma(interest)} = ${comma(ans)}원입니다.`);
            const variablesInfo = { 월납입액: `${comma(M)}원`, 연이율: `${r}%`, 기간: `${n}개월` };
            if (Hd) variablesInfo.이자소득세율 = '15.4%';
            return {
              question: `매달 초 ${comma(M)}원씩 ${n}개월 동안 넣는 연이율 ${r}%(단리)의 정기적금에 가입했습니다. 이자는 넣은 돈마다 만기까지 남은 개월 수만큼 월 이율(연이율 ÷ 12)로 붙습니다. ${ask}`,
              variablesInfo,
              options,
              answerIndex,
              hint: '마지막 달에 넣은 돈은 1개월 치 이자만 받습니다. 넣은 전체 금액이 처음부터 예치된 것이 아니에요!',
              steps
            };
          }
        },
        {
          id: 'LIF-18',
          dayIndex: 17,
          unit: '경제 수학 · 연금의 현재 가치',
          standardCode: '[12경수01-05]',
          standardName: '연금의 뜻을 알고, 연금의 현재 가치를 구할 수 있다.',
          sourceRef: '고등학교 경제 수학 (연금 — 매년 말 받는 연금의 현재 가치)',
          difficulty: '★★★ 실력',
          tierGuide: {
            easy: '연이율 10%, 2회 받는 연금의 현재 가치',
            normal: '연이율 10%, 3회 받는 연금의 현재 가치',
            hard: '연이율 10%, 4회 받는 연금의 현재 가치(네 항을 각각 할인)'
          },
          conceptSummary: '연금의 현재 가치는 앞으로 받을 각 금액을 지금 가치로 바꾸어(1 + r)^k로 나눈 뒤 모두 더한 값입니다. 늦게 받는 돈일수록 현재 가치가 작습니다.',
          formula: '현재 가치 = A/(1 + r) + A/(1 + r)² + … + A/(1 + r)ⁿ',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const n = E ? 2 : Hd ? 4 : 3;
            const k = rng.int(1, E ? 20 : Hd ? 25 : 30);
            // A = 11ⁿ × 10^(6−n) × k 로 잡으면 A/1.1^j 가 모두 정수
            const A = Math.pow(11, n) * Math.pow(10, 6 - n) * k;
            const terms = [];
            for (let j = 1; j <= n; j++) terms.push(Math.pow(11, n - j) * Math.pow(10, 6 - n + j) * k);
            const pv = terms.reduce((s, x) => s + x, 0);
            const cands = [A * n, 1000000 * k * n, terms[0] * n, pv * 11 / 10];
            const ds = cands.filter((x, i) => x !== pv && cands.indexOf(x) === i).slice(0, 3).map(x => `${comma(x)}원`);
            const { options, answerIndex } = buildChoiceSet(rng, `${comma(pv)}원`, ds);
            const pw = ['', '', '²', '³', '⁴'];
            return {
              question: `지금부터 매년 말에 ${comma(A)}원씩 ${n}번 받는 연금이 있습니다. 연이율 10%의 복리로 계산할 때, 이 연금의 현재 가치(지금 시점의 가치)는 얼마인가요?`,
              variablesInfo: { 연금액: `${comma(A)}원`, 연이율: '10%', 지급횟수: `${n}회` },
              options,
              answerIndex,
              hint: `k년 말에 받는 ${comma(A)}원의 현재 가치는 ${comma(A)} ÷ 1.1^k 입니다. 받는 횟수만큼 따로 할인해서 더하세요.`,
              steps: [
                ...terms.map((t, i) => `${i + 1}년 말에 받는 돈의 현재 가치: ${comma(A)} ÷ 1.1${pw[i + 1]} = ${comma(t)}원`),
                `모두 더하면 현재 가치는 ${terms.map(t => comma(t)).join(' + ')} = ${comma(pv)}원입니다. (그냥 더한 ${comma(A * n)}원보다 작습니다.)`
              ]
            };
          }
        },
        {
          id: 'LIF-19',
          dayIndex: 18,
          unit: '생활 수학 · 레시피 인분 환산',
          standardCode: '[12직수02-01]',
          standardName: '비의 개념을 직무 상황에 연결하여 적용할 수 있다.',
          sourceRef: '직무 수학 (비 — 조리 분량의 비례 환산)',
          difficulty: '★☆☆ 기초',
          tierGuide: {
            easy: '2인분 레시피를 4·6·8인분으로(정수 배)',
            normal: '2~4인분 레시피를 3~10인분으로(1인분 양을 거쳐 환산)',
            hard: '재료가 모자랄 때 레시피 비율로 만들 수 있는 최대 인분(버림)'
          },
          conceptSummary: '레시피의 맛을 유지하려면 모든 재료를 같은 비율로 늘리거나 줄여야 합니다. 인분 수의 비와 재료 양의 비가 같습니다.',
          formula: '필요한 양 = 레시피 양 × (만들 인분 ÷ 레시피 인분)',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const [ing, u] = rng.pick([['밀가루', 'g'], ['설탕', 'g'], ['버터', 'g'], ['우유', 'mL']]);
            const dish = rng.pick(['팬케이크', '쿠키', '머핀', '카스텔라']);
            const base = E ? 2 : rng.pick(Hd ? [3, 4, 6] : [2, 3, 4]);
            const per = rng.int(Hd ? 4 : 3, Hd ? 15 : 12) * 10; // 1인분 양
            const amt = per * base;
            if (Hd) {
              const s = rng.int(5, 15);
              const hold = per * s + rng.int(1, per - 1);
              const ans = s;
              const cands = [s + 1, Math.floor(hold / amt), Math.floor(hold / amt) * base + base, s - 1, s + 2];
              const ds = cands.filter((x, i) => x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${x}인분`);
              const { options, answerIndex } = buildChoiceSet(rng, `${ans}인분`, ds);
              return {
                question: `${base}인분 ${dish} 레시피에는 ${wj(ing, '이/가')} ${amt}${u} 들어갑니다. 집에 있는 ${ing}의 양은 ${hold}${u}뿐이고 다른 재료는 충분할 때, 레시피 비율대로 최대 몇 인분까지 만들 수 있나요? (1인분 단위로 만듭니다.)`,
                variablesInfo: { 기준인분: `${base}인분`, 재료량: `${amt}${u}`, 보유량: `${hold}${u}` },
                options,
                answerIndex,
                hint: `먼저 1인분에 필요한 ${ing}의 양(${amt} ÷ ${base})을 구한 뒤, 가진 양을 그것으로 나누어 보세요. 모자라면 그 인분은 만들 수 없으니 버림합니다.`,
                steps: [
                  `1인분에 필요한 ${ing}의 양은 ${amt} ÷ ${base} = ${per}${u}입니다.`,
                  `${hold} ÷ ${per} = ${s}…${hold - per * s}이므로 ${s}인분을 만들 수 있고, 남는 양은 ${hold - per * s}${u}입니다.`,
                  `${s + 1}인분을 만들려면 ${per * (s + 1)}${u} 필요해 모자라므로 최대 ${s}인분입니다.`
                ]
              };
            }
            const target = E ? rng.pick([4, 6, 8]) : rng.pick([3, 5, 6, 7, 9, 10].filter(t => t !== base));
            const ans = per * target;
            const cands = [amt + (target - base), amt * target, Math.round(amt * base / target), amt + per, ans + per];
            const ds = cands.filter((x, i) => x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${x}${u}`);
            const { options, answerIndex } = buildChoiceSet(rng, `${ans}${u}`, ds);
            return {
              question: `${base}인분 ${dish} 레시피에는 ${wj(ing, '이/가')} ${amt}${u} 들어갑니다. 같은 맛을 유지하면서 ${target}인분을 만들려면 ${wj(ing, '은/는')} 몇 ${u} 필요한가요?`,
              variablesInfo: { 기준인분: `${base}인분`, 재료량: `${amt}${u}`, 만들인분: `${target}인분` },
              options,
              answerIndex,
              hint: `인분 수가 ${base} → ${target}${jo(target, '으로/로')} 바뀌면 재료도 같은 비율(${target}/${base}배)로 바뀝니다. 인분 차이만큼 더하는 것이 아니에요!`,
              steps: [
                `1인분에 필요한 ${ing}의 양은 ${amt} ÷ ${base} = ${per}${u}입니다.`,
                `${target}인분을 만들려면 ${per} × ${target} = ${ans}${u} 필요합니다. (${amt} × ${target}/${base} = ${ans})`
              ]
            };
          }
        },
        {
          id: 'LIF-20',
          dayIndex: 19,
          unit: '생활 수학 · 이동 시간과 도착 시각',
          standardCode: '[12직수01-03]',
          standardName: '시간, 길이, 무게, 들이의 표준 단위를 알고, 단위를 환산할 수 있다.',
          sourceRef: '직무 수학 (시간 단위 환산 — 거리·속력·시간과 일정 계획)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '거리 ÷ 속력으로 걸리는 시간을 시간·분으로',
            normal: '출발 시각에 이동 시간을 더해 도착 시각 구하기',
            hard: '속력이 다른 두 구간 + 휴게소 휴식까지 더한 도착 시각'
          },
          conceptSummary: '걸린 시간(시간) = 거리 ÷ 속력이고, 1시간 = 60분입니다. 1.5시간은 1시간 50분이 아니라 1시간 30분입니다.',
          formula: '시간 = 거리 ÷ 속력,  분 = 시간 × 60',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const fmtDur = t => (t >= 60 ? (t % 60 ? `${Math.floor(t / 60)}시간 ${t % 60}분` : `${t / 60}시간`) : `${t}분`);
            const fmtClock = t => (t % 60 ? `${Math.floor(t / 60)}시 ${t % 60}분` : `${t / 60}시`);
            // 소수 시간을 '시간.분'으로 잘못 읽는 오개념: 1.5시간 → 1시간 50분
            const misread = t => { const h = Math.floor(t / 60), f = (t % 60) * 100 / 60; return Number.isInteger(f) && f > 0 ? h * 60 + f : null; };
            const leg = (lo, hi) => {
              const s = rng.pick([40, 50, 60, 80, 90, 100]);
              let t = rng.int(lo, hi);
              while ((s * t) % 60 !== 0) t++;
              return [s * t / 60, s, t];
            };
            if (E) {
              const [d, s, t] = leg(30, 180);
              const cands = [misread(t), t + 10, t - 10, Math.round(d / s * 100), t + 30];
              const ds = cands.filter((x, i) => x && x > 0 && x !== t && cands.indexOf(x) === i).slice(0, 3).map(fmtDur);
              const { options, answerIndex } = buildChoiceSet(rng, fmtDur(t), ds);
              return {
                question: `자동차가 시속 ${s}km로 ${d}km를 쉬지 않고 달릴 때 걸리는 시간은 얼마인가요?`,
                variablesInfo: { 거리: `${d}km`, 속력: `시속 ${s}km` },
                options,
                answerIndex,
                hint: `시간 = 거리 ÷ 속력 입니다. 소수로 나온 시간은 60을 곱해 분으로 바꾸세요.`,
                steps: [
                  `걸리는 시간은 ${d} ÷ ${s} = ${Math.round(d / s * 10000) / 10000}시간입니다.`,
                  `${Math.round(d / s * 10000) / 10000}시간 × 60 = ${t}분 = ${fmtDur(t)}입니다.`
                ]
              };
            }
            const dep = rng.int(6, 11) * 60 + rng.pick([0, 10, 15, 20, 30, 40, 45, 50]);
            let t, legs;
            if (!Hd) { const [d, s, tt] = leg(40, 200); t = tt; legs = { d, s }; }
            else {
              const [d1, s1, t1] = leg(40, 120), [d2, s2, t2] = leg(30, 100);
              const rest = rng.pick([10, 15, 20, 25, 30]);
              t = t1 + rest + t2; legs = { d1, s1, t1, d2, s2, t2, rest };
            }
            const arr = dep + t;
            const cands = Hd
              ? [arr - legs.rest, dep + Math.round(60 * (legs.d1 + legs.d2) / ((legs.s1 + legs.s2) / 2)), misread(legs.t1) && dep + misread(legs.t1) + legs.rest + legs.t2, arr + 10, arr - 10]
              : [misread(t) && dep + misread(t), arr + 60, arr - 10, arr + 10];
            const ds = cands.filter((x, i) => x && x !== arr && x < 1440 && cands.indexOf(x) === i).slice(0, 3).map(fmtClock);
            const { options, answerIndex } = buildChoiceSet(rng, fmtClock(arr), ds);
            const question = Hd
              ? `${fmtClock(dep)}에 출발해 고속도로 ${legs.d1}km를 시속 ${legs.s1}km로 달린 뒤 휴게소에서 ${legs.rest}분 쉬고, 다시 국도 ${legs.d2}km를 시속 ${legs.s2}km로 달려 도착했습니다. 도착 시각은? (24시간제)`
              : `${fmtClock(dep)}에 출발해 ${legs.d}km 떨어진 거래처까지 시속 ${legs.s}km로 쉬지 않고 이동합니다. 도착 시각은? (24시간제)`;
            const variablesInfo = Hd
              ? { 출발시각: fmtClock(dep), '1구간': `${legs.d1}km, 시속 ${legs.s1}km`, 휴식: `${legs.rest}분`, '2구간': `${legs.d2}km, 시속 ${legs.s2}km` }
              : { 출발시각: fmtClock(dep), 거리: `${legs.d}km`, 속력: `시속 ${legs.s}km` };
            const steps = Hd
              ? [
                `고속도로 구간: ${legs.d1} ÷ ${legs.s1}시간 = ${legs.t1}분, 국도 구간: ${legs.d2} ÷ ${legs.s2}시간 = ${legs.t2}분입니다.`,
                `휴식까지 더한 총 소요 시간은 ${legs.t1} + ${legs.rest} + ${legs.t2} = ${t}분 = ${fmtDur(t)}입니다.`,
                `${fmtClock(dep)} + ${fmtDur(t)} = ${fmtClock(arr)}에 도착합니다. (두 속력의 평균으로 계산하면 틀립니다.)`
              ]
              : [
                `걸리는 시간은 ${legs.d} ÷ ${legs.s} = ${Math.round(legs.d / legs.s * 10000) / 10000}시간 = ${t}분 = ${fmtDur(t)}입니다.`,
                `${fmtClock(dep)} + ${fmtDur(t)} = ${fmtClock(arr)}에 도착합니다.`
              ];
            return { question, variablesInfo, options, answerIndex, hint: '각 구간의 시간을 분으로 바꾼 뒤 출발 시각에 더하세요. 60분이 넘으면 1시간으로 올립니다.', steps };
          }
        },
        {
          id: 'LIF-21',
          dayIndex: 20,
          unit: '실용 통계 · 평균과 중앙값',
          standardCode: '[12실통02-04]',
          standardName: '대푯값과 산포도의 종류를 알고 자료의 특성을 나타내는 값으로 요약할 수 있다.',
          sourceRef: '실용 통계 (대푯값 — 극단값이 있을 때 평균과 중앙값)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '섞여 있는 자료 5개의 중앙값(크기순 정렬)',
            normal: '극단값이 있는 자료 7개의 평균과 중앙값',
            hard: '자료 6개(짝수 개)의 평균과 중앙값 — 가운데 두 값의 평균'
          },
          conceptSummary: '중앙값은 자료를 크기순으로 늘어놓았을 때 한가운데 값이고, 자료가 짝수 개이면 가운데 두 값의 평균입니다. 극단값이 있으면 평균이 크게 흔들리므로 중앙값이 대푯값으로 더 적절할 수 있습니다.',
          formula: '평균 = 자료의 합 ÷ 개수,  중앙값 = 크기순 가운데 값 (짝수 개: 가운데 두 값의 평균)',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const cnt = E ? 5 : Hd ? 6 : 7;
            const ctx = E ? ['학생 5명의 한 달 용돈', '만 원', 3, 15] : Hd ? ['이웃 6가구의 한 달 전기 사용량', 'kWh', 180, 420] : ['어느 작은 회사 7명(대표 포함)의 월급', '만 원', 210, 390];
            const [label, unitTxt, lo, hi] = ctx;
            const data = [];
            for (let i = 0; i < cnt - (E ? 0 : 1); i++) data.push(rng.int(lo, hi));
            if (!E) {
              // 극단값 하나: 합이 개수의 배수(상: 3의 배수 → 평균이 소수 첫째 자리까지)가 되도록 조정
              let out = Hd ? rng.int(900, 1500) : rng.int(1200, 2000);
              const s0 = data.reduce((s, x) => s + x, 0);
              const m = Hd ? 3 : 7;
              while ((s0 + out) % m !== 0) out++;
              data.push(out);
            }
            const shown = rng.shuffle(data);
            const sorted = data.slice().sort((x, y) => x - y);
            const med = cnt % 2 ? sorted[(cnt - 1) / 2] : (sorted[cnt / 2 - 1] + sorted[cnt / 2]) / 2;
            const total = data.reduce((s, x) => s + x, 0);
            const mean = Math.round(total / cnt * 10) / 10;
            const sp = '';
            const fmtPair = (a, b) => `평균 ${a}${sp}${unitTxt}, 중앙값 ${b}${sp}${unitTxt}`;
            let correct, ds;
            if (E) {
              const cands = [shown[2], mean, sorted[1], sorted[3], med + 1, med - 1];
              ds = cands.filter((x, i) => x !== med && cands.indexOf(x) === i).map(x => `${x}${sp}${unitTxt}`);
              correct = `${med}${sp}${unitTxt}`;
            } else {
              const noOut = Math.round((total - sorted[cnt - 1]) / (cnt - 1) * 10) / 10;
              const pairs = [[med, mean], [mean, shown[Math.floor(cnt / 2)]], [noOut, med], [mean, sorted[Math.floor(cnt / 2)]], [mean, sorted[Math.floor(cnt / 2) - 1]], [mean, med + 10], [mean - 10, med]];
              ds = pairs.filter(([a, b]) => !(a === mean && b === med)).map(([a, b]) => fmtPair(a, b));
              correct = fmtPair(mean, med);
            }
            ds = ds.filter((x, i) => x !== correct && ds.indexOf(x) === i).slice(0, 3);
            const { options, answerIndex } = buildChoiceSet(rng, correct, ds);
            const cop = jo(String(shown[cnt - 1]), '이/가') === '이' ? '이었' : '였'; // 마지막 수 받침에 따라 '이었/였'
            const steps = [`자료를 크기순으로 늘어놓으면 ${sorted.join(', ')}입니다.`];
            if (E) steps.push(`자료가 5개이므로 3번째 값 ${med}${unitTxt}${jo(unitTxt, '이/가')} 중앙값입니다. (늘어놓기 전 가운데 값을 고르면 안 됩니다.)`);
            else {
              steps.push(cnt % 2
                ? `자료가 ${cnt}개이므로 ${(cnt + 1) / 2}번째 값 ${med}${jo(String(med), '이/가')} 중앙값입니다.`
                : `자료가 ${cnt}개(짝수)이므로 가운데 두 값 ${sorted[cnt / 2 - 1]}, ${sorted[cnt / 2]}의 평균 ${med}${jo(String(med), '이/가')} 중앙값입니다.`);
              steps.push(`평균은 ${total} ÷ ${cnt} = ${mean}입니다. 극단값 ${sorted[cnt - 1]} 때문에 평균이 중앙값보다 크게 나오므로, 이 자료의 대표값으로는 중앙값이 더 적절합니다.`);
            }
            return {
              question: E
                ? `${label}(단위: ${unitTxt})을 조사했더니 ${shown.join(', ')}${cop}습니다. 이 자료의 중앙값은?`
                : `${label}(단위: ${unitTxt})을 조사했더니 ${shown.join(', ')}${cop}습니다. 이 자료의 평균과 중앙값으로 옳은 것은? (평균은 소수 첫째 자리까지)`,
              variablesInfo: { 자료: shown.join(', ') },
              options,
              answerIndex,
              hint: '중앙값은 먼저 크기순으로 늘어놓은 뒤 한가운데를 찾습니다. 짝수 개면 가운데 두 값의 평균이에요.',
              steps
            };
          }
        },
        {
          id: 'LIF-22',
          dayIndex: 21,
          unit: '직무 수학 · 경우의 수(세트 메뉴 구성)',
          standardCode: '[12직수04-01]',
          standardName: '직무 상황에서 경우의 수를 구할 수 있다.',
          sourceRef: '직무 수학 (경우의 수 — 곱의 법칙과 조합으로 세트 구성)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '메인 × 음료 두 단계 곱의 법칙',
            normal: '메인 × 사이드 × 음료 세 단계 곱의 법칙',
            hard: '사이드에서 서로 다른 2가지를 순서 없이 고르는 조합까지'
          },
          conceptSummary: '여러 단계를 차례로 고를 때 전체 경우의 수는 각 단계 경우의 수의 곱입니다(곱의 법칙). 순서 없이 b개 중 서로 다른 2개를 고르는 경우의 수는 b(b − 1)/2입니다.',
          formula: '곱의 법칙: m × n × …,   서로 다른 b개 중 2개 고르기 = b(b − 1) ÷ 2',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const shop = rng.pick(['분식집', '카페', '샌드위치 가게', '도시락 가게']);
            const a = rng.int(2, 6), c = rng.int(2, 6);
            const b = E ? 0 : rng.int(Hd ? 4 : 2, Hd ? 7 : 5);
            const pick2 = b * (b - 1) / 2;
            const ans = E ? a * c : Hd ? a * pick2 * c : a * b * c;
            const cands = E
              ? [a + c, a * c * 2, a * (c - 1), (a - 1) * c]
              : Hd
                ? [a * b * (b - 1) * c, a * b * c, a * b * b * c, a * pick2 + c]
                : [a + b + c, a * b + c, (a + b) * c, a * b * c * 2];
            const ds = cands.filter((x, i) => x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${x}가지`);
            const { options, answerIndex } = buildChoiceSet(rng, `${ans}가지`, ds);
            const question = E
              ? `${shop}의 세트 메뉴는 메인 메뉴 ${a}가지 중 1가지, 음료 ${c}가지 중 1가지를 골라 구성합니다. 만들 수 있는 세트는 모두 몇 가지인가요?`
              : Hd
                ? `${shop}의 세트 메뉴는 메인 메뉴 ${a}가지 중 1가지, 사이드 메뉴 ${b}가지 중 서로 다른 2가지, 음료 ${c}가지 중 1가지를 골라 구성합니다. 사이드 2가지는 고르는 순서와 관계없이 같은 세트로 볼 때, 만들 수 있는 세트는 모두 몇 가지인가요?`
                : `${shop}의 세트 메뉴는 메인 메뉴 ${a}가지 중 1가지, 사이드 메뉴 ${b}가지 중 1가지, 음료 ${c}가지 중 1가지를 골라 구성합니다. 만들 수 있는 세트는 모두 몇 가지인가요?`;
            const variablesInfo = { 메인: `${a}가지`, 음료: `${c}가지` };
            if (!E) variablesInfo.사이드 = `${b}가지`;
            const steps = E
              ? [`메인 메뉴를 고르는 방법 ${a}가지 각각에 대해 음료를 고르는 방법이 ${c}가지씩 있습니다.`, `곱의 법칙으로 ${a} × ${c} = ${ans}가지입니다. (더하면 안 됩니다.)`]
              : Hd
                ? [`사이드 ${b}가지 중 서로 다른 2가지를 순서 없이 고르는 방법은 ${b} × ${b - 1} ÷ 2 = ${pick2}가지입니다. (순서를 따지면 ${b * (b - 1)}가지지만 같은 묶음이 2번씩 세어집니다.)`, `곱의 법칙으로 ${a} × ${pick2} × ${c} = ${ans}가지입니다.`]
                : [`메인, 사이드, 음료를 차례로 고르는 세 단계이므로 곱의 법칙을 씁니다.`, `${a} × ${b} × ${c} = ${ans}가지입니다.`];
            return { question, variablesInfo, options, answerIndex, hint: '단계를 이어서 고르면 곱하고, 둘 중 하나만 고르면 더합니다.', steps };
          }
        },
        {
          id: 'LIF-23',
          dayIndex: 22,
          unit: '직무 수학 · 경품 추첨 확률',
          standardCode: '[12직수04-02]',
          standardName: '어떤 현상이 나타날 가능성을 수치화하여 설명할 수 있다.',
          sourceRef: '직무 수학 (가능성의 수치화 — 경품 추첨 확률)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '쿠폰 1장을 뽑을 때 당첨 확률',
            normal: '되돌려 놓지 않고 연속으로 2장을 뽑을 때 모두 당첨될 확률',
            hard: '연속으로 2장을 뽑을 때 적어도 1장 당첨될 확률(여사건)'
          },
          conceptSummary: '모든 쿠폰이 뽑힐 가능성이 같으면 확률 = (원하는 경우의 수) ÷ (전체 경우의 수)입니다. 뽑은 쿠폰을 되돌려 놓지 않으면 두 번째에는 전체 장수가 하나 줄어듭니다. "적어도 하나"는 1 − (하나도 아닐 확률)로 구하면 편합니다.',
          formula: 'P = 당첨 수 ÷ 전체 수,  비복원 2회 모두 당첨 = w/n × (w − 1)/(n − 1),  적어도 1장 = 1 − l/n × (l − 1)/(n − 1)',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const w = rng.int(E ? 1 : 2, E ? 6 : 5), l = rng.int(E ? 4 : 5, E ? 15 : 12), n = w + l;
            const g = (x, y) => { x = Math.abs(x); y = Math.abs(y); while (y) { [x, y] = [y, x % y]; } return x; };
            const fr = (p, q) => { const d = g(p, q); return [p / d, q / d]; };
            let ans;
            if (E) ans = fr(w, n);
            else if (!Hd) ans = fr(w * (w - 1), n * (n - 1));
            else ans = fr(n * (n - 1) - l * (l - 1), n * (n - 1));
            const cands = E
              ? [fr(w, l), fr(l, n), fr(1, n), fr(w, n + 1), fr(w + 1, n), fr(w, 2 * n)]
              : Hd
                ? [fr(n * n - l * l, n * n), fr(w * (w - 1), n * (n - 1)), fr(n - l, n), fr(2 * w * l, n * (n - 1)), fr(2 * w, n), fr(l * (l - 1), n * (n - 1))]
                : [fr(w * w, n * n), fr(w * (w - 1), n * n), fr(w, n), fr(2 * w, n), fr(w - 1, n - 1), fr(1, n * (n - 1))];
            const same = (x, y) => x[0] * y[1] === x[1] * y[0];
            const ds = [];
            for (const c of cands) if (c[0] > 0 && c[0] < c[1] && !same(c, ans) && !ds.some(d => same(d, c))) ds.push(c);
            const fmt = x => `${x[0]}/${x[1]}`;
            const { options, answerIndex } = buildChoiceSet(rng, fmt(ans), ds.slice(0, 3).map(fmt));
            const intro = `경품 추첨함에 당첨 쿠폰 ${w}장과 꽝 쿠폰 ${l}장이 들어 있습니다.`;
            const question = E
              ? `${intro} 쿠폰 1장을 임의로 뽑을 때 당첨 쿠폰일 확률은? (기약분수로)`
              : Hd
                ? `${intro} 뽑은 쿠폰을 되돌려 놓지 않고 연속으로 2장을 뽑을 때, 적어도 1장은 당첨 쿠폰일 확률은? (기약분수로)`
                : `${intro} 뽑은 쿠폰을 되돌려 놓지 않고 연속으로 2장을 뽑을 때, 2장 모두 당첨 쿠폰일 확률은? (기약분수로)`;
            const steps = E
              ? [`전체 쿠폰은 ${w} + ${l} = ${n}장이고 당첨 쿠폰은 ${w}장입니다.`, `확률은 ${w}/${n}${g(w, n) > 1 ? ` = ${fmt(ans)}` : ''}입니다. (당첨 : 꽝 = ${w} : ${l}의 비와 헷갈리지 마세요.)`]
              : Hd
                ? [`2장 모두 꽝일 확률은 ${l}/${n} × ${l - 1}/${n - 1} = ${fmt(fr(l * (l - 1), n * (n - 1)))}입니다.`, `적어도 1장 당첨 = 1 − ${fmt(fr(l * (l - 1), n * (n - 1)))} = ${fmt(ans)}입니다.`]
                : [`첫 번째에 당첨일 확률은 ${w}/${n}, 쿠폰을 되돌려 놓지 않으므로 두 번째에도 당첨일 확률은 ${w - 1}/${n - 1}입니다.`, `${w}/${n} × ${w - 1}/${n - 1} = ${fmt(ans)}입니다.`];
            return {
              question,
              variablesInfo: { 당첨: `${w}장`, 꽝: `${l}장` },
              options,
              answerIndex,
              hint: Hd ? '"적어도 1장"은 전체(1)에서 "2장 모두 꽝"인 확률을 빼세요.' : '확률은 (원하는 경우) ÷ (전체 경우)입니다. 되돌려 놓지 않으면 두 번째 분모가 1 줄어요.',
              steps
            };
          }
        },
        {
          id: 'LIF-24',
          dayIndex: 23,
          unit: '직무 수학 · 비율 그래프 해석',
          standardCode: '[12직수04-04]',
          standardName: '직무 상황의 다양한 표와 그래프를 해석할 수 있다.',
          sourceRef: '직무 수학 (띠그래프·원그래프의 백분율 해석)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '띠그래프 한 항목의 비율로 금액 구하기',
            normal: '두 항목의 금액 차이 구하기',
            hard: '총액과 비율이 함께 바뀐 두 해의 금액 비교(비율이 줄어도 금액은 늘 수 있음)'
          },
          conceptSummary: '비율 그래프의 백분율은 전체에 대한 비율이므로, 항목의 실제 양 = 전체 양 × 백분율입니다. 전체가 달라지면 비율만 비교해서는 실제 양의 증감을 알 수 없습니다.',
          formula: '항목의 양 = 전체 × (백분율 ÷ 100)',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            if (Hd) {
              const T1 = rng.int(12, 25) * 20, T2 = T1 + rng.int(2, 10) * 20;
              const p1 = rng.pick([30, 35, 40, 45]);
              const p2 = p1 - rng.pick([5, 10]);
              const a1 = T1 * p1 / 100, a2 = T2 * p2 / 100, d = a2 - a1;
              if (d === 0) return this.generate(rng, { tier });
              const dir = x => (x > 0 ? '증가' : '감소');
              const correct = `${Math.abs(d)}만 원 ${dir(d)}`;
              const cands = [`${Math.abs(d)}만 원 ${dir(-d)}`, `${T1 * (p1 - p2) / 100}만 원 감소`, `${T2 * (p1 - p2) / 100}만 원 감소`, `${p1 - p2}만 원 감소`, `${Math.abs(d) + 10}만 원 ${dir(d)}`];
              const ds = cands.filter((x, i) => x !== correct && cands.indexOf(x) === i).slice(0, 3);
              const { options, answerIndex } = buildChoiceSet(rng, correct, ds);
              return {
                question: `어느 동아리의 지출을 띠그래프로 나타냈더니, 작년에는 총지출 ${T1}만 원 중 행사비가 ${p1}%였고 올해는 총지출 ${T2}만 원 중 행사비가 ${p2}%였습니다. 작년과 비교한 올해 행사비 금액의 변화로 옳은 것은?`,
                variablesInfo: { 작년총액: `${T1}만 원`, 작년비율: `${p1}%`, 올해총액: `${T2}만 원`, 올해비율: `${p2}%` },
                options,
                answerIndex,
                hint: '비율이 줄었다고 금액이 줄었다고 단정하면 안 됩니다. 두 해의 금액을 각각 구해서 비교하세요.',
                steps: [
                  `작년 행사비 = ${T1} × ${p1 / 100} = ${a1}만 원, 올해 행사비 = ${T2} × ${p2 / 100} = ${a2}만 원입니다.`,
                  `${a2} − ${a1} = ${d}이므로 행사비는 ${Math.abs(d)}만 원 ${dir(d)}했습니다. (비율은 ${p1 - p2}%p 줄었지만 총지출이 늘었습니다.)`
                ]
              };
            }
            const T = rng.int(10, 30) * 20;
            const pA = rng.pick([25, 30, 35, 40, 45]);
            const pB = rng.pick([10, 15, 20].filter(x => x < pA));
            const pC = rng.pick([10, 15]);
            const pD = 100 - pA - pB - pC;
            const legend = `식비 ${pA}%, 교통비 ${pB}%, 통신비 ${pC}%, 기타 ${pD}%`;
            const ans = E ? T * pA / 100 : T * (pA - pB) / 100;
            const cands = E
              ? [pA, T * pA / 10, T - T * pA / 100, T * pB / 100]
              : [pA - pB, T * pA / 100, T * (pA + pB) / 100, T * (pA - pB) / 10];
            const ds = cands.filter((x, i) => x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${x}만 원`);
            const { options, answerIndex } = buildChoiceSet(rng, `${ans}만 원`, ds);
            const variablesInfo = { 총액: `${T}만 원`, 항목A: `식비 ${pA}%` };
            if (!E) variablesInfo.항목B = `교통비 ${pB}%`;
            return {
              question: `한 가구의 한 달 생활비 ${T}만 원을 띠그래프로 나타냈더니 ${legend}였습니다. ${E ? '식비는 얼마인가요?' : '식비는 교통비보다 얼마나 더 많은가요?'}`,
              variablesInfo,
              options,
              answerIndex,
              hint: '백분율은 전체에 대한 비율입니다. 전체 금액에 (백분율 ÷ 100)을 곱하세요.',
              steps: E
                ? [`식비의 비율은 ${pA}%이므로 ${T} × ${pA / 100}${jo(pA / 100, '을/를')} 계산합니다.`, `${T} × ${pA / 100} = ${ans}만 원입니다.`]
                : [`식비 = ${T} × ${pA / 100} = ${T * pA / 100}만 원, 교통비 = ${T} × ${pB / 100} = ${T * pB / 100}만 원입니다.`, `차이는 ${T * pA / 100} − ${T * pB / 100} = ${ans}만 원입니다. (= ${T} × ${pA - pB}%)`]
            };
          }
        },
        {
          id: 'LIF-25',
          dayIndex: 24,
          unit: '경제 수학 · 수요와 공급의 균형 가격',
          standardCode: '[12경수02-04]',
          standardName: '수요와 공급의 상호 작용에 의해 균형 가격이 결정되는 경제 현상을 설명할 수 있다.',
          sourceRef: '고등학교 경제 수학 (일차함수로 나타낸 수요·공급과 균형 가격)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '기울기가 1인 수요·공급 함수에서 균형 가격',
            normal: '일반적인 일차 수요·공급 함수에서 균형 가격과 균형 거래량',
            hard: '수요가 모든 가격에서 일정량 늘어난 뒤의 새 균형 가격과 거래량'
          },
          conceptSummary: '가격이 오르면 수요량은 줄고 공급량은 늘어납니다. 수요량과 공급량이 같아지는 가격이 균형 가격이고, 그때의 양이 균형 거래량입니다.',
          formula: '수요 Qd = a − bP, 공급 Qs = dP − c 에서 a − bP = dP − c → P = (a + c) ÷ (b + d)',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const b = E ? 1 : rng.pick([1, 2, 3, 4]), d = E ? 1 : rng.pick([1, 2, 3, 4]);
            const P0 = rng.int(10, 30) * 100, Q0 = rng.int(4, 30) * 50;
            const a = Q0 + b * P0, c = d * P0 - Q0;
            if (c <= 0) return this.generate(rng, { tier });
            const item = rng.pick(['빵', '음료', '김밥', '쿠키']);
            const k = Hd ? (b + d) * rng.pick([100, 200, 300]) : 0;
            const dP = k / (b + d);
            const P1 = P0 + dP, Q1 = Q0 + d * dP;
            const co = x => (x === 1 ? '' : x);
            const fD = `Qd = ${comma(a)} − ${co(b)}P`, fS = `Qs = ${co(d)}P − ${comma(c)}`;
            const pair = (p, q) => `균형 가격 ${comma(p)}원, 균형 거래량 ${comma(q)}개`;
            let correct, cands;
            if (E) {
              correct = `${comma(P0)}원`;
              cands = [a / b, c / d, P0 + 100, P0 - 100, (a - c) / (b + d)].filter(x => Number.isInteger(x) && x > 0).map(x => `${comma(x)}원`);
            } else if (!Hd) {
              correct = pair(P0, Q0);
              cands = [[P0, a], [Q0, P0], [P0 + 100, Q0 - 100 * b], [P0, Q0 * 2], [P0 - 100, Q0 - 100 * d]].filter(([p, q]) => p > 0 && q > 0).map(([p, q]) => pair(p, q));
            } else {
              correct = pair(P1, Q1);
              cands = [[P0, Q0], [P0, Q0 + k], [P1, Q0], [P1, Q0 + k], [P0 + k, Q1]].map(([p, q]) => pair(p, q));
            }
            const ds = cands.filter((x, i) => x !== correct && cands.indexOf(x) === i).slice(0, 3);
            const { options, answerIndex } = buildChoiceSet(rng, correct, ds);
            const intro = `${item} 1개의 가격을 P원이라 할 때, 어느 시장의 하루 수요량은 ${fD}, 공급량은 ${fS}(단위: 개)입니다.`;
            const question = E
              ? `${intro} 수요량과 공급량이 같아지는 균형 가격은?`
              : Hd
                ? `${intro} 축제 기간에 모든 가격에서 하루 수요량이 ${comma(k)}개씩 늘어난다면, 새로운 균형 가격과 균형 거래량은?`
                : `${intro} 균형 가격과 균형 거래량은?`;
            const variablesInfo = { 수요: fD, 공급: fS };
            if (Hd) variablesInfo.수요증가 = `${comma(k)}개`;
            const aa = a + k;
            const steps = [
              `균형에서는 수요량 = 공급량이므로 ${comma(aa)} − ${co(b)}P = ${co(d)}P − ${comma(c)} 입니다.${Hd ? ` (늘어난 수요: Qd = ${comma(aa)} − ${co(b)}P)` : ''}`,
              `${b + d}P = ${comma(aa)} + ${comma(c)} = ${comma(aa + c)} 이므로 P = ${comma(Hd ? P1 : P0)}원입니다.`
            ];
            if (!E) steps.push(`균형 거래량은 ${co(d)}P − ${comma(c)}에 대입해 ${comma(Hd ? Q1 : Q0)}개입니다.${Hd ? ` (수요 증가로 가격은 ${comma(dP)}원 오르고 거래량은 ${comma(Q1 - Q0)}개 늘었습니다.)` : ''}`);
            return { question, variablesInfo, options, answerIndex, hint: '수요 함수와 공급 함수를 같다고 놓고 P에 대한 일차방정식을 푸세요.', steps };
          }
        },
        {
          id: 'LIF-26',
          dayIndex: 25,
          unit: '경제 수학 · 세금과 균형 가격',
          standardCode: '[12경수02-05]',
          standardName: '세금과 소득의 변화가 균형 가격에 미치는 영향을 탐구하고 이해한다.',
          sourceRef: '고등학교 경제 수학 (물품세 부과에 따른 공급 함수 이동과 균형 가격 변화)',
          difficulty: '★★★ 실력',
          tierGuide: {
            easy: '기울기 1인 함수에서 세금 부과 후 새 균형 가격',
            normal: '새 균형 가격과 1개당 소비자 부담(가격 상승분)',
            hard: '새 균형 가격·거래량과 정부의 세수(세금 × 거래량)'
          },
          conceptSummary: '판매자에게 1개당 t원의 세금을 매기면 판매자가 실제로 받는 돈은 (P − t)원이 되어 공급 함수가 Qs = d(P − t) − c로 바뀝니다. 균형 가격은 오르지만 보통 세금 전부만큼 오르지는 않아, 세금은 소비자와 판매자가 나누어 부담합니다.',
          formula: 'a − bP = d(P − t) − c → P₁ = (a + c + dt) ÷ (b + d),  세수 = t × 새 거래량',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const b = E ? 1 : rng.pick([1, 2, 3]), d = E ? 1 : rng.pick([1, 2, 3]);
            const P0 = rng.int(10, 30) * 100, Q0 = rng.int(8, 30) * 50;
            const a = Q0 + b * P0, c = d * P0 - Q0;
            const t = rng.pick([100, 200, 300, 400, 500, 600]);
            if (c <= 0 || (d * t) % (b + d) !== 0) return this.generate(rng, { tier });
            const dP = d * t / (b + d);
            const P1 = P0 + dP, Q1 = Q0 - b * dP;
            if (Q1 <= 0) return this.generate(rng, { tier });
            const item = rng.pick(['음료', '과자', '생수', '아이스크림']);
            const co = x => (x === 1 ? '' : x);
            const fD = `Qd = ${comma(a)} − ${co(b)}P`, fS = `Qs = ${co(d)}P − ${comma(c)}`;
            let correct, cands;
            if (E) {
              correct = `${comma(P1)}원`;
              cands = [P0 + t, P0, P1 - t, P0 + t * 2].map(x => `${comma(x)}원`);
            } else if (!Hd) {
              const f = (p, s) => `균형 가격 ${comma(p)}원, 소비자 부담 ${comma(s)}원`;
              correct = f(P1, dP);
              cands = [f(P0 + t, t), f(P1, t - dP), f(P0, 0), f(P1 - t, dP), f(P1, t)];
            } else {
              const f = (p, q, g) => `균형 가격 ${comma(p)}원, 거래량 ${comma(q)}개, 세수 ${comma(g)}원`;
              correct = f(P1, Q1, t * Q1);
              const qn = Q0 - b * t;
              cands = [f(P1, Q1, t * Q0), f(P1, Q0, t * Q0), f(P1, Q1, dP * Q1), ...(qn > 0 ? [f(P0 + t, qn, t * qn)] : [])];
            }
            const ds = cands.filter((x, i) => x !== correct && cands.indexOf(x) === i).slice(0, 3);
            const { options, answerIndex } = buildChoiceSet(rng, correct, ds);
            const intro = `${item} 1개의 가격을 P원이라 할 때, 어느 시장의 수요량은 ${fD}, 공급량은 ${fS}(단위: 개)입니다. 정부가 판매자에게 1개당 ${comma(t)}원의 세금을 부과하면 판매자가 실제로 받는 돈은 (P − ${comma(t)})원이 됩니다.`;
            const question = E
              ? `${intro} 세금 부과 후의 새로운 균형 가격은?`
              : Hd
                ? `${intro} 세금 부과 후의 새로운 균형 가격, 균형 거래량과 정부가 걷는 세수(세금 × 거래량)는?`
                : `${intro} 세금 부과 후의 새로운 균형 가격과, 세금 중 소비자가 1개당 부담하는 금액(가격 상승분)은?`;
            return {
              question,
              variablesInfo: { 수요: fD, 공급: fS, 세금: `${comma(t)}원` },
              options,
              answerIndex,
              hint: `공급 함수의 P 자리에 (P − ${comma(t)})을 넣은 새 공급 함수와 수요 함수를 같다고 놓으세요.`,
              steps: [
                `세금 부과 전 균형: ${comma(a)} − ${co(b)}P = ${co(d)}P − ${comma(c)} 에서 P = ${comma(P0)}원, 거래량 ${comma(Q0)}개입니다.`,
                `세금 부과 후 공급: Qs = ${co(d)}(P − ${comma(t)}) − ${comma(c)}. 수요와 같다고 놓으면 ${b + d}P = ${comma(a + c + d * t)} 이므로 P = ${comma(P1)}원입니다.`,
                Hd
                  ? `새 거래량은 ${comma(a)} − ${b === 1 ? '' : `${b} × `}${comma(P1)} = ${comma(Q1)}개, 세수는 ${comma(t)} × ${comma(Q1)} = ${comma(t * Q1)}원입니다. (세금 전의 거래량 ${comma(Q0)}개를 쓰면 틀립니다.)`
                  : `가격은 ${comma(P1)} − ${comma(P0)} = ${comma(dP)}원 올랐습니다. 세금 ${comma(t)}원 중 소비자가 ${comma(dP)}원, 판매자가 ${comma(t - dP)}원을 부담하는 셈입니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-27',
          dayIndex: 26,
          unit: '직무 수학 · 큰 수의 어림',
          standardCode: '[12직수01-02]',
          standardName: '큰 수를 어림하여 문제를 해결하고, 어림값을 이용하여 수의 크기를 비교할 수 있다.',
          sourceRef: '직무 수학 (큰 수의 반올림과 어림 계산)',
          difficulty: '★☆☆ 기초',
          tierGuide: {
            easy: '일곱 자리 수를 반올림하여 만의 자리까지',
            normal: '1인당 금액 × 인원을 계산한 뒤 십만의 자리까지 반올림',
            hard: '세 품목 금액의 합을 계산한 뒤 백만의 자리까지 반올림'
          },
          conceptSummary: '반올림하여 ○의 자리까지 나타낼 때는 그 바로 아래 자리의 숫자가 5 이상이면 올리고, 4 이하이면 버립니다. 큰 금액은 먼저 정확히 계산한 뒤 어림해야 오차가 작습니다.',
          formula: '반올림하여 만의 자리까지 → 천의 자리 숫자를 보고 올림/버림',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            let x, U, unitName, question, variablesInfo, calc, suffix;
            if (E) {
              x = rng.int(1000000, 9999999); U = 10000; unitName = '만'; suffix = '명';
              question = `어느 도시의 인구가 ${comma(x)}명입니다. 이 인구를 반올림하여 만의 자리까지 나타낸 어림값은?`;
              variablesInfo = { 수: `${comma(x)}명`, 어림: '만의 자리' };
              calc = `인구는 ${comma(x)}명입니다.`;
            } else if (!Hd) {
              const a = rng.int(120, 399) * 100, n = rng.int(120, 480);
              x = a * n; U = 100000; unitName = '십만'; suffix = '원';
              question = `회사 워크숍 참가자 ${n}명에게 1인당 ${comma(a)}원짜리 도시락을 준비하려고 합니다. 총비용을 반올림하여 십만의 자리까지 나타낸 어림값은?`;
              variablesInfo = { '1인당': `${comma(a)}원`, 인원: `${n}명`, 어림: '십만의 자리' };
              calc = `총비용은 ${comma(a)} × ${n} = ${comma(x)}원입니다.`;
            } else {
              const items = [0, 1, 2].map(() => [rng.int(80, 990) * 10, rng.int(1200, 6000)]);
              x = items.reduce((s, [p, q]) => s + p * q, 0); U = 1000000; unitName = '백만'; suffix = '원';
              const names = ['기념품', '음료', '간식'];
              question = `행사 준비물로 ${items.map(([p, q], i) => `${names[i]} ${comma(p)}원짜리 ${comma(q)}개`).join(', ')}를 주문했습니다. 총 주문 금액을 반올림하여 백만의 자리까지 나타낸 어림값은?`;
              variablesInfo = { 품목: items.map(([p, q]) => `${comma(p)}원×${q}개`).join(', '), 어림: '백만의 자리' };
              calc = `총 주문 금액은 ${items.map(([p, q]) => `${comma(p)} × ${comma(q)}`).join(' + ')} = ${items.map(([p, q]) => comma(p * q)).join(' + ')} = ${comma(x)}원입니다.`;
            }
            const r = Math.round(x / U) * U;
            if (x % U === 0 || Math.round(x / (U * 10)) * U * 10 === r) return this.generate(rng, { tier });
            const other = r > x ? Math.floor(x / U) * U : Math.ceil(x / U) * U;
            const cands = [other, Math.round(x / (U / 10)) * (U / 10), Math.round(x / (U * 10)) * U * 10, r * 10, r / 10];
            const ds = cands.filter((v, i) => v > 0 && v !== r && cands.indexOf(v) === i).slice(0, 3).map(v => `약 ${comma(v)}${suffix}`);
            const { options, answerIndex } = buildChoiceSet(rng, `약 ${comma(r)}${suffix}`, ds);
            const lowerDigit = Math.floor((x % U) / (U / 10));
            return {
              question,
              variablesInfo,
              options,
              answerIndex,
              hint: `${unitName}의 자리까지 나타내려면 그 바로 아래 자리 숫자를 보고 반올림합니다.`,
              steps: [
                calc,
                `${unitName}의 자리 바로 아래 자리 숫자는 ${lowerDigit}이므로 ${lowerDigit >= 5 ? '올립니다' : '버립니다'}.`,
                `따라서 어림값은 약 ${comma(r)}${suffix}입니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-28',
          dayIndex: 27,
          unit: '직무 수학 · 함께 일하는 시간(일차방정식)',
          standardCode: '[12직수02-05]',
          standardName: '일차방정식 또는 일차부등식을 활용하여 직무 상황의 문제를 해결할 수 있다.',
          sourceRef: '직무 수학 (일차방정식 활용 — 작업량과 작업 시간)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '함께 일한 시간이 정수 시간으로 떨어지는 경우',
            normal: '함께 일한 시간이 2.4시간처럼 소수 → 시간·분 환산',
            hard: 'A가 먼저 혼자 일한 뒤 남은 일을 함께 끝내는 시간'
          },
          conceptSummary: '전체 일의 양을 1로 두면, 혼자 a시간 걸리는 사람은 1시간에 1/a만큼 일합니다. 함께 일하면 1시간에 (1/a + 1/b)만큼 하므로 x시간 동안 하는 일의 양으로 방정식을 세웁니다.',
          formula: '(1/a + 1/b) × x = 1 → x = ab ÷ (a + b)',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const fmtDur = t => (t >= 60 ? (t % 60 ? `${Math.floor(t / 60)}시간 ${t % 60}분` : `${t / 60}시간`) : `${t}분`);
            const misread = t => { const h = Math.floor(t / 60), f = (t % 60) * 100 / 60; return Number.isInteger(f) && f > 0 ? h * 60 + f : null; };
            let a, b, t1 = 0;
            if (E) {
              [a, b] = rng.pick([[3, 6], [4, 12], [5, 20], [6, 12], [6, 30], [8, 24], [9, 18], [10, 15], [12, 24], [20, 30], [15, 30]]);
              if (rng.next() < 0.5) [a, b] = [b, a];
            } else {
              a = rng.int(Hd ? 3 : 2, 12); b = rng.int(2, 12);
              if (Hd) t1 = rng.int(1, a - 1);
              if (a === b) return this.generate(rng, { tier });
            }
            const num = 60 * (a - t1) * b, den = a + b;
            if (num % den !== 0) return this.generate(rng, { tier });
            const ans = num / den;
            if (!E && !Hd && (a * b) % (a + b) === 0) return this.generate(rng, { tier });
            const together = 60 * a * b / (a + b);
            const cands = E
              ? [30 * (a + b), 60 * (a + b), 60 * Math.abs(a - b), 30 * Math.min(a, b), ans + 60]
              : Hd
                ? [Number.isInteger(together) ? together : Math.round(together), ans + 60 * t1, 60 * (a - t1) / a * b, misread(ans), ans + 30]
                : [misread(ans), 30 * (a + b), 30 * Math.min(a, b), ans + 30, ans - 30];
            const ds = cands.filter((x, i) => x && x > 0 && Number.isInteger(x) && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(fmtDur);
            const { options, answerIndex } = buildChoiceSet(rng, fmtDur(ans), ds);
            const job = rng.pick(['창고 재고 정리', '고객 설문 자료 입력', '매장 진열대 정리', '택배 상자 분류']);
            const intro = `${job} 작업을 직원 A가 혼자 하면 ${a}시간, 직원 B가 혼자 하면 ${b}시간이 걸립니다. (두 사람의 작업 속도는 각각 일정합니다.)`;
            const variablesInfo = { A단독: `${a}시간`, B단독: `${b}시간` };
            if (Hd) variablesInfo.A먼저 = `${t1}시간`;
            // 분수는 기약분수로 보여 준다
            const fr = (x, y) => { const g = gcd(x, y); return y / g === 1 ? `${x / g}` : `${x / g}/${y / g}`; };
            const rate = fr(a + b, a * b), left = fr(a - t1, a);
            const durTxt = ans >= 60 ? `${ans}분 = ${fmtDur(ans)}` : `${ans}분`;
            const mr = misread(ans);
            const steps = [`전체 일의 양을 1이라 하면 A는 1시간에 1/${a}, B는 1/${b}만큼 일하므로 함께 하면 1시간에 1/${a} + 1/${b} = ${rate}만큼 합니다.`];
            if (Hd) steps.push(`A가 먼저 ${t1}시간 동안 ${fr(t1, a)}만큼 했으므로 남은 일은 1 − ${fr(t1, a)} = ${left}입니다.`, `함께 일한 시간을 x시간이라 하면 ${rate} × x = ${left} 에서 x = ${fr((a - t1) * b, a + b)}시간 = ${durTxt}입니다.`);
            else steps.push(`함께 일한 시간을 x시간이라 하면 ${rate} × x = 1 에서 x = ${fr(a * b, a + b)}시간입니다.`, `${fr(a * b, a + b)}시간 × 60 = ${durTxt}입니다.${!E && mr ? ` (${ans / 60}시간을 ${fmtDur(mr)}${jo(fmtDur(mr), '으로/로')} 읽으면 안 됩니다. 소수 시간은 60을 곱해 분으로 바꿉니다.)` : ''}`);
            return {
              question: Hd
                ? `${intro} A가 먼저 혼자 ${t1}시간 일한 뒤, 남은 일을 A와 B가 함께 하여 끝냈습니다. A와 B가 함께 일한 시간은?`
                : `${intro} 두 사람이 처음부터 함께 일하면 작업을 끝내는 데 걸리는 시간은?`,
              variablesInfo,
              options,
              answerIndex,
              hint: '두 사람의 걸린 시간을 평균 내는 것이 아니라, 1시간 동안 하는 일의 양(1/a, 1/b)을 더해야 합니다.',
              steps
            };
          }
        },
        {
          id: 'LIF-29',
          dayIndex: 28,
          unit: '직무 수학 · 칠할 넓이와 페인트 수량',
          standardCode: '[12직수03-04]',
          standardName: '직무 상황에서 나타나는 평면도형의 둘레와 넓이를 구할 수 있다.',
          sourceRef: '직무 수학 (직사각형 넓이와 자재 수량 산정)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '직사각형 바닥 넓이 ÷ 1통 면적이 나누어떨어짐',
            normal: '소수 길이 바닥을 2번 칠할 때 필요한 통 수(올림)',
            hard: '네 벽면 넓이에서 문·창문을 빼고 2번 칠할 때 통 수(올림)'
          },
          conceptSummary: '칠할 넓이 × 칠하는 횟수를 1통으로 칠할 수 있는 넓이로 나눈 뒤, 모자라면 안 되므로 소수점 아래가 있으면 올림합니다. 방의 네 벽 넓이는 (바닥 둘레) × (높이)입니다.',
          formula: '필요한 통 수 = ⌈(칠할 넓이 × 횟수) ÷ 1통 면적⌉,  네 벽 넓이 = 2(가로 + 세로) × 높이',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const ceilDiv = (p, q) => Math.floor((p + q - 1) / q);
            if (E) {
              const L = rng.int(3, 9), W = rng.int(3, 8), C = rng.pick([2, 3, 4, 5, 6]);
              if ((L * W) % C !== 0) return this.generate(rng, { tier });
              const ans = L * W / C;
              const cands = [L * W, ceilDiv(2 * (L + W), C), ans + 1, ans * 2];
              const ds = cands.filter((x, i) => x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${x}통`);
              const { options, answerIndex } = buildChoiceSet(rng, `${ans}통`, ds);
              return {
                question: `가로 ${L}m, 세로 ${W}m인 직사각형 바닥에 방수 페인트를 한 번 칠하려고 합니다. 페인트 1통으로 ${C}m²를 칠할 수 있을 때, 필요한 페인트는 몇 통인가요?`,
                variablesInfo: { 가로: `${L}m`, 세로: `${W}m`, 한통면적: `${C}m²` },
                options,
                answerIndex,
                hint: '바닥 넓이(가로 × 세로)를 1통으로 칠할 수 있는 넓이로 나누세요. 둘레가 아니라 넓이입니다.',
                steps: [`바닥 넓이는 ${L} × ${W} = ${L * W}m²입니다.`, `${L * W} ÷ ${C} = ${ans}이므로 ${ans}통이 필요합니다.`]
              };
            }
            const L10 = rng.int(30, Hd ? 60 : 80), W10 = rng.int(25, Hd ? 50 : 60);
            const H10 = Hd ? rng.int(23, 27) : 0;
            const O10 = Hd ? rng.int(30, 60) : 0; // 문·창문 넓이 × 10
            const C = rng.pick(Hd ? [10, 12, 15] : [5, 6, 8, 10]);
            const floor100 = L10 * W10;
            const wall100 = 2 * (L10 + W10) * H10;
            const area100 = Hd ? wall100 - O10 * 10 : floor100;
            const need = area100 * 2;
            if (need % (C * 100) === 0) return this.generate(rng, { tier });
            const ans = ceilDiv(need, C * 100);
            const f = v => v / 100; // 0.01m² 단위 → m²
            const cands = Hd
              ? [ceilDiv(wall100 * 2, C * 100), ceilDiv(area100, C * 100), Math.floor(need / (C * 100)), ans + 1, ceilDiv(floor100 * 2, C * 100)]
              : [Math.floor(need / (C * 100)), ceilDiv(area100, C * 100), ans + 1, ceilDiv(2 * (L10 + W10) * 10 * 2, C * 100)];
            const ds = cands.filter((x, i) => x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${x}통`);
            const { options, answerIndex } = buildChoiceSet(rng, `${ans}통`, ds);
            const L = L10 / 10, W = W10 / 10, Hh = H10 / 10, O = O10 / 10;
            const variablesInfo = { 가로: `${L}m`, 세로: `${W}m`, 한통면적: `${C}m²`, 칠횟수: '2회' };
            if (Hd) { variablesInfo.높이 = `${Hh}m`; variablesInfo.제외넓이 = `${O}m²`; }
            return {
              question: Hd
                ? `가로 ${L}m, 세로 ${W}m, 높이 ${Hh}m인 방의 네 벽면에 페인트를 2번 칠하려고 합니다. 문과 창문 넓이의 합 ${O}m²는 칠하지 않고, 페인트 1통으로 ${C}m²를 칠할 수 있습니다. 필요한 페인트는 최소 몇 통인가요?`
                : `가로 ${L}m, 세로 ${W}m인 직사각형 바닥에 방수 페인트를 2번 칠하려고 합니다. 페인트 1통으로 ${C}m²를 칠할 수 있을 때, 필요한 페인트는 최소 몇 통인가요?`,
              variablesInfo,
              options,
              answerIndex,
              hint: '칠할 넓이 × 2(두 번 칠함)를 1통 면적으로 나누고, 나머지가 있으면 1통을 더 사야 합니다(올림).',
              steps: Hd
                ? [
                  `네 벽의 넓이는 2 × (${L} + ${W}) × ${Hh} = ${f(wall100)}m²이고, 문·창문을 빼면 ${f(wall100)} − ${O} = ${f(area100)}m²입니다.`,
                  `2번 칠하므로 ${f(area100)} × 2 = ${f(need)}m²를 칠해야 합니다.`,
                  `${f(need)} ÷ ${C} = ${Math.floor(need / (C * 100))}…이므로 올림하여 ${ans}통이 필요합니다.`
                ]
                : [
                  `바닥 넓이는 ${L} × ${W} = ${f(area100)}m²이고, 2번 칠하므로 ${f(need)}m²입니다.`,
                  `${f(need)} ÷ ${C} = ${Math.floor(need / (C * 100))}…이므로 올림하여 ${ans}통이 필요합니다. (버림하면 페인트가 모자랍니다.)`
                ]
            };
          }
        },
        {
          id: 'LIF-30',
          dayIndex: 29,
          unit: '직무 수학 · 수조의 부피와 물 채우는 시간',
          standardCode: '[12직수03-05]',
          standardName: '직무 상황에서 나타나는 입체도형의 겉넓이와 부피를 구할 수 있다.',
          sourceRef: '직무 수학 (직육면체의 부피와 들이 단위 환산 1L = 1,000cm³)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '직육면체 수조의 부피(cm³)를 들이(L)로 환산',
            normal: '빈 수조를 분당 일정량으로 가득 채우는 시간',
            hard: '물이 일부 차 있는 수조를 목표 높이까지 채우는 시간'
          },
          conceptSummary: '직육면체의 부피는 가로 × 세로 × 높이이고, 1L = 1,000cm³입니다. 물을 채우는 시간 = 채울 물의 양(L) ÷ 1분에 나오는 양(L)입니다.',
          formula: '부피 = 가로 × 세로 × 높이,  1L = 1,000cm³,  시간(분) = 물의 양(L) ÷ 분당 급수량(L)',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const L = rng.pick(Hd ? [60, 80, 100, 120] : [30, 40, 50, 60, 80, 100]);
            const W = rng.pick(Hd ? [30, 40, 50] : [20, 30, 40, 50]);
            const H = rng.pick(Hd ? [40, 50, 60] : [20, 30, 40, 50, 60]);
            const V = L * W * H / 1000;
            const tank = `가로 ${L}cm, 세로 ${W}cm, 높이 ${H}cm`;
            if (E) {
              const cands = [V * 10, V * 100, L * W * H / 10000, L + W + H];
              const ds = cands.filter((x, i) => Number.isInteger(x) && x > 0 && x !== V && cands.indexOf(x) === i).slice(0, 3).map(x => `${x}L`);
              const { options, answerIndex } = buildChoiceSet(rng, `${V}L`, ds);
              return {
                question: `${tank}인 직육면체 모양 수조에 물을 가득 채우면 물은 몇 L인가요? (1L = 1,000cm³)`,
                variablesInfo: { 수조: tank },
                options,
                answerIndex,
                hint: '부피(cm³)를 먼저 구한 뒤 1,000으로 나누어 L로 바꾸세요.',
                steps: [`부피는 ${L} × ${W} × ${H} = ${comma(L * W * H)}cm³입니다.`, `1L = 1,000cm³이므로 ${comma(L * W * H)} ÷ 1,000 = ${V}L입니다.`]
              };
            }
            const r = rng.pick([2, 3, 4, 5, 6, 8, 10, 12]);
            const h0 = Hd ? rng.pick([5, 10, 15]) : 0;
            const h1 = Hd ? rng.pick([20, 25, 30, 35].filter(x => x < H)) : H;
            const fillV = L * W * (h1 - h0) / 1000;
            if (!Number.isInteger(fillV) || fillV % r !== 0) return this.generate(rng, { tier });
            const ans = fillV / r;
            const cands = Hd
              ? [Math.round(L * W * h1 / 1000 / r), Math.round(V / r), ans * 10, Math.round(L * W * h0 / 1000 / r), ans * 2]
              : [ans * 10, ans * 60, V, ans * 2];
            const ds = cands.filter((x, i) => Number.isInteger(x) && x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${comma(x)}분`);
            const { options, answerIndex } = buildChoiceSet(rng, `${comma(ans)}분`, ds);
            const variablesInfo = { 수조: tank, 급수량: `${r}L` };
            if (Hd) { variablesInfo.현재수위 = `${h0}cm`; variablesInfo.목표수위 = `${h1}cm`; }
            return {
              question: Hd
                ? `${tank}인 직육면체 모양 수조에 물이 ${h0}cm 높이까지 차 있습니다. 1분에 ${r}L씩 물이 나오는 수도로 물을 더 넣어 물의 높이를 ${h1}cm로 만들려면 몇 분이 걸리나요? (1L = 1,000cm³)`
                : `${tank}인 직육면체 모양의 빈 수조에 1분에 ${r}L씩 물이 나오는 수도로 물을 가득 채우려고 합니다. 몇 분이 걸리나요? (1L = 1,000cm³)`,
              variablesInfo,
              options,
              answerIndex,
              hint: Hd ? '더 채워야 하는 높이(목표 높이 − 현재 높이)만큼의 부피만 구하면 됩니다.' : '수조의 들이(L)를 1분에 나오는 물의 양으로 나누세요.',
              steps: Hd
                ? [`더 채울 높이는 ${h1} − ${h0} = ${h1 - h0}cm이므로 부피는 ${L} × ${W} × ${h1 - h0} = ${comma(L * W * (h1 - h0))}cm³ = ${fillV}L입니다.`, `${fillV} ÷ ${r} = ${ans}분이 걸립니다.`]
                : [`수조의 부피는 ${L} × ${W} × ${H} = ${comma(L * W * H)}cm³ = ${V}L입니다.`, `${V} ÷ ${r} = ${ans}분이 걸립니다.`]
            };
          }
        },
        {
          id: 'LIF-31',
          dayIndex: 30,
          unit: '직무 수학 · 요금표에서 규칙 찾기',
          standardCode: '[12직수02-03]',
          standardName: '두 양 사이의 대응 관계를 나타낸 표에서 규칙을 찾아 설명할 수 있다.',
          sourceRef: '직무 수학 (대응 관계 표 — 이용 시간과 요금의 일차 규칙)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '정비례 요금표에서 표 밖의 시간 요금 구하기',
            normal: '기본요금이 있는 요금표에서 규칙을 찾아 표 밖의 요금 구하기',
            hard: '규칙을 거꾸로 써서 주어진 요금이 되는 이용 시간 구하기'
          },
          conceptSummary: '표에서 한 양이 일정하게 늘 때 다른 양이 얼마씩 느는지 찾으면 규칙(대응 관계)을 식으로 나타낼 수 있습니다. 첫 칸의 값이 늘어나는 양과 다르면 기본요금이 있는 것입니다.',
          formula: '요금 = 기본요금 + (단위 시간당 요금) × (단위 시간의 개수)',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const [place, tName] = rng.pick([['주차장', '주차 시간'], ['전동 킥보드', '이용 시간'], ['스터디 카페', '이용 시간'], ['보트 대여소', '대여 시간']]);
            const step = rng.pick([10, 15, 30]);
            const f = rng.pick(step === 10 ? [200, 300, 500] : [500, 1000, 1500]);
            const base0 = E ? 0 : rng.pick([500, 1000, 1500, 2000, 3000]);
            const xs = [1, 2, 3, 4].map(i => step * i);
            const ys = [1, 2, 3, 4].map(i => base0 + f * i);
            const k = rng.int(Hd ? 7 : 6, Hd ? 15 : 12);
            const table = `${tName}(분): ${xs.join(', ')} / 요금(원): ${ys.map(comma).join(', ')}`;
            const variablesInfo = { 시간: xs.join(', '), 요금: ys.map(comma).join(', ') };
            let ans, cands, unitS, question;
            if (Hd) {
              const Y = base0 + f * k;
              ans = step * k; unitS = '분';
              cands = [step * (k - 1), Number.isInteger(Y / f) ? (Y / f) * step : null, Number.isInteger(Y / ys[0]) ? (Y / ys[0]) * step : null, step * (k + 1)];
              variablesInfo.목표요금 = `${comma(Y)}원`;
              question = `${place}의 ${tName}에 따른 요금이 다음 표와 같이 일정한 규칙으로 늘어납니다. [${table}] 요금이 ${comma(Y)}원이 되는 ${tName}은 몇 분인가요?`;
            } else {
              ans = base0 + f * k; unitS = '원';
              cands = E ? [f * k + f, f * (k - 1), f * k * 2, ys[3] + f] : [ys[0] * k, f * k, ys[3] + f, base0 + f * (k - 1)];
              variablesInfo.구할시간 = `${step * k}분`;
              question = `${place}의 ${tName}에 따른 요금이 다음 표와 같이 일정한 규칙으로 늘어납니다. [${table}] 같은 규칙으로 ${step * k}분 동안 이용하면 요금은 얼마인가요?`;
            }
            const ds = cands.filter((x, i) => x && x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${comma(x)}${unitS}`);
            const { options, answerIndex } = buildChoiceSet(rng, `${comma(ans)}${unitS}`, ds);
            const rule = base0 ? `요금 = ${comma(base0)} + ${comma(f)} × (${step}분 단위의 개수)` : `요금 = ${comma(f)} × (${step}분 단위의 개수)`;
            const steps = [
              `${tName}이 ${step}분 늘 때마다 요금은 ${comma(f)}원씩 늘어납니다.${base0 ? ` ${step}분일 때 ${comma(ys[0])}원이므로 기본요금은 ${comma(ys[0])} − ${comma(f)} = ${comma(base0)}원입니다.` : ' 0분일 때 0원인 정비례 관계입니다.'}`,
              `규칙: ${rule}`,
              Hd
                ? `${comma(base0)} + ${comma(f)} × n = ${comma(base0 + f * k)} 에서 n = ${k}이므로 ${tName}은 ${step} × ${k} = ${ans}분입니다.`
                : `${step * k}분은 ${step}분 단위 ${k}개이므로 요금은 ${base0 ? `${comma(base0)} + ` : ''}${comma(f)} × ${k} = ${comma(ans)}원입니다.`
            ];
            return { question, variablesInfo, options, answerIndex, hint: '표에서 이웃한 두 칸의 차이(늘어나는 양)와 첫 칸의 값을 비교해 기본요금이 있는지 확인하세요.', steps };
          }
        },
        {
          id: 'LIF-32',
          dayIndex: 31,
          unit: '경제 수학 · 비용 함수와 평균 비용',
          standardCode: '[12경수02-01]',
          standardName: '여러 가지 경제 현상을 함수로 나타낼 수 있다.',
          sourceRef: '고등학교 경제 수학 (총비용 함수와 평균 비용)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '총비용 함수 C(x) = 고정비 + 변동비 × x 에 대입',
            normal: '생산량이 x일 때 1개당 평균 비용 C(x) ÷ x',
            hard: '평균 비용이 목표 이하가 되는 최소 생산량(부등식, 올림)'
          },
          conceptSummary: '생산량과 관계없이 드는 고정비와 1개마다 드는 변동비로 총비용을 일차함수 C(x) = F + vx로 나타냅니다. 1개당 평균 비용 C(x)/x = F/x + v는 많이 만들수록 줄어듭니다.',
          formula: 'C(x) = F + vx,   평균 비용 = C(x) ÷ x = F/x + v',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const F = rng.int(10, 60) * 100000, v = rng.int(5, 40) * 100;
            const shop = rng.pick(['수제 비누 공방', '도자기 공방', '빵 공장', '티셔츠 인쇄소']);
            const intro = `${shop}의 한 달 고정비(임대료 등)는 ${comma(F)}원이고, 제품을 하나 만들 때마다 재료비 등 ${comma(v)}원이 추가로 듭니다. 한 달 생산량이 x개일 때 총비용(원)을 C(x) = ${comma(F)} + ${comma(v)}x 라 합니다.`;
            const variablesInfo = { 고정비: `${comma(F)}원`, 단위변동비: `${comma(v)}원` };
            let ans, cands, unitS, question, steps;
            if (Hd) {
              const g = rng.int(5, 40) * 100 + rng.pick([30, 70]);
              const T = v + g;
              ans = Math.ceil(F / g);
              cands = [Math.floor(F / g), Math.ceil(F / T), ans + 1, Math.ceil(F / g / 10)];
              unitS = '개';
              variablesInfo.목표평균비용 = `${comma(T)}원`;
              question = `${intro} 제품 1개당 평균 비용이 ${comma(T)}원 이하가 되려면 한 달에 최소 몇 개를 만들어야 하나요?`;
              steps = [
                `평균 비용은 C(x) ÷ x = ${comma(F)}/x + ${comma(v)} 입니다.`,
                `${comma(F)}/x + ${comma(v)} ≤ ${comma(T)} 에서 ${comma(F)}/x ≤ ${comma(g)}, 즉 x ≥ ${comma(F)} ÷ ${comma(g)} = ${Math.floor(F / g)}.…`,
                `x는 자연수이므로 최소 ${comma(ans)}개를 만들어야 합니다. (${comma(ans - 1)}개면 평균 비용이 ${comma(T)}원을 넘습니다.)`
              ];
            } else if (E) {
              const x = rng.int(100, 900);
              ans = F + v * x; unitS = '원';
              cands = [v * x, F + v, (F + v) * x, F - v * x];
              variablesInfo.생산량 = `${x}개`;
              question = `${intro} ${x}개를 만들 때 총비용은 얼마인가요?`;
              steps = [`C(${x}) = ${comma(F)} + ${comma(v)} × ${x} 입니다.`, `= ${comma(F)} + ${comma(v * x)} = ${comma(ans)}원입니다.`];
            } else {
              const x = rng.pick([100, 200, 250, 400, 500, 1000]);
              ans = F / x + v; unitS = '원';
              cands = [F / x, F + v * x, v, Math.round((F + v) / x), F / x + v * 2];
              variablesInfo.생산량 = `${x}개`;
              question = `${intro} ${x}개를 만들 때 제품 1개당 평균 비용은 얼마인가요?`;
              steps = [`총비용은 C(${x}) = ${comma(F)} + ${comma(v)} × ${x} = ${comma(F + v * x)}원입니다.`, `1개당 평균 비용은 ${comma(F + v * x)} ÷ ${x} = ${comma(ans)}원입니다. (= ${comma(F)}/${x} + ${comma(v)})`];
            }
            const ds = cands.filter((x, i) => Number.isInteger(x) && x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${comma(x)}${unitS}`);
            const { options, answerIndex } = buildChoiceSet(rng, `${comma(ans)}${unitS}`, ds);
            return { question, variablesInfo, options, answerIndex, hint: Hd ? '평균 비용 F/x + v ≤ 목표를 x에 대한 부등식으로 풀고, 자연수이므로 올림하세요.' : '고정비는 생산량과 관계없이 한 번, 변동비는 생산량만큼 곱해서 더합니다.', steps };
          }
        },
        {
          id: 'LIF-33',
          dayIndex: 32,
          unit: '경제 수학 · 행렬로 나타낸 판매와 매출',
          standardCode: '[12경수03-01]',
          standardName: '여러 가지 경제 현상을 행렬로 나타내고, 연산할 수 있다.',
          sourceRef: '고등학교 경제 수학 (판매량 행렬과 가격 행렬의 곱)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: '판매량 행렬의 1행과 가격의 곱으로 한 매장 매출',
            normal: '행렬의 곱으로 두 매장의 매출을 한꺼번에',
            hard: '두 달 판매량 행렬을 더한 뒤 가격을 곱해 두 매장의 매출'
          },
          conceptSummary: '판매량을 행렬(행: 매장, 열: 상품)로, 가격을 열 행렬로 나타내면 두 행렬의 곱의 각 성분이 매장별 매출입니다. 행렬의 곱은 (행) × (열)로 대응하는 성분끼리 곱해 더합니다.',
          formula: '(a b / c d) × (p / q) = (ap + bq / cp + dq)',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const [n1, n2] = rng.pick([['빵', '우유'], ['아메리카노', '케이크'], ['김밥', '라면'], ['샌드위치', '주스']]);
            const prices = [1500, 2000, 2500, 3000, 3500, 4000, 4500];
            const p = rng.pick(prices), q = rng.pick(prices.filter(x => x !== p));
            const m = [0, 1, 2, 3].map(() => rng.int(10, 60));
            const m2 = Hd ? [0, 1, 2, 3].map(() => rng.int(10, 60)) : [0, 0, 0, 0];
            const s = m.map((x, i) => x + m2[i]);
            const rev = M => [M[0] * p + M[1] * q, M[2] * p + M[3] * q];
            const [r1, r2] = rev(s);
            const mat = M => `(${M[0]}, ${M[1]} / ${M[2]}, ${M[3]})`;
            const pair = (x, y) => `갑 매장 ${comma(x)}원, 을 매장 ${comma(y)}원`;
            let correct, cands;
            if (E) {
              correct = `${comma(r1)}원`;
              cands = [s[0] * q + s[1] * p, s[0] * p + s[2] * q, (s[0] + s[1]) * p, (s[0] + s[1]) * q].filter(x => x !== r1).map(x => `${comma(x)}원`);
            } else {
              cands = [pair(s[0] * p + s[2] * q, s[1] * p + s[3] * q), pair(s[0] * q + s[1] * p, s[2] * q + s[3] * p), pair(r2, r1), pair((s[0] + s[1]) * p, (s[2] + s[3]) * q)];
              if (Hd) cands.unshift(pair(...rev(m)), pair(...rev(m2)));
              // 대칭 행렬 등으로 오답이 겹칠 때 쓰는 예비 오답
              cands.push(pair(r1 + p, r2), pair(r1, r2 + q), pair(r1 - q, r2 - p));
              correct = pair(r1, r2);
            }
            const ds = cands.filter((x, i) => x !== correct && cands.indexOf(x) === i).slice(0, 3);
            const { options, answerIndex } = buildChoiceSet(rng, correct, ds);
            const legend = `(1행은 갑 매장, 2행은 을 매장 / 1열은 ${n1}, 2열은 ${n2}의 판매량)`;
            const priceTxt = `${n1} 1개는 ${comma(p)}원, ${n2} 1개는 ${comma(q)}원`;
            const question = Hd
              ? `갑, 을 두 매장의 1월 판매량을 행렬 A = ${mat(m)}, 2월 판매량을 행렬 B = ${mat(m2)}로 나타냈습니다. ${legend} ${priceTxt}일 때, (A + B) × (가격)으로 구한 두 매장의 2개월 매출은?`
              : E
                ? `갑, 을 매장의 하루 판매량을 행렬 A = ${mat(m)}로 나타냈습니다. ${legend} ${priceTxt}일 때, 행렬의 곱으로 구한 갑 매장의 하루 매출은?`
                : `갑, 을 매장의 하루 판매량을 행렬 A = ${mat(m)}로 나타냈습니다. ${legend} ${priceTxt}일 때, 행렬의 곱 A × (가격)으로 구한 두 매장의 하루 매출은?`;
            const variablesInfo = { 판매량: mat(m), 가격: `(${comma(p)}원, ${comma(q)}원)` };
            if (Hd) variablesInfo.판매량2 = mat(m2);
            const steps = [];
            if (Hd) steps.push(`두 달 판매량의 합은 A + B = ${mat(s)}입니다. (같은 위치의 성분끼리 더합니다.)`);
            steps.push(`갑 매장(1행): ${s[0]} × ${comma(p)} + ${s[1]} × ${comma(q)} = ${comma(r1)}원`);
            steps.push(E ? `행렬의 곱은 (행) × (열)이므로 1행의 각 판매량에 해당 상품 가격을 곱해 더합니다. 갑 매장의 매출은 ${comma(r1)}원입니다.` : `을 매장(2행): ${s[2]} × ${comma(p)} + ${s[3]} × ${comma(q)} = ${comma(r2)}원`);
            return { question, variablesInfo, options, answerIndex, hint: '행렬의 곱은 왼쪽 행렬의 행과 오른쪽(가격)의 열을 짝지어 곱한 뒤 더합니다.', steps };
          }
        },
        {
          id: 'LIF-34',
          dayIndex: 33,
          unit: '경제 수학 · 미분과 수익 최대화',
          standardCode: '[12경수04-04]',
          standardName: '미분을 활용하여 경제 현상의 최적화 문제를 해결할 수 있다.',
          sourceRef: '고등학교 경제 수학 (판매 수익·이윤 함수의 미분과 최댓값)',
          difficulty: '★★★ 실력',
          tierGuide: {
            easy: '수익 R(P) = P(a − bP)가 최대인 가격(R′ = 0)',
            normal: '수익이 최대인 가격과 그때의 최대 수익',
            hard: '원가를 뺀 이윤 (P − c)(a − bP)가 최대인 가격과 최대 이윤'
          },
          conceptSummary: '판매량이 Q = a − bP일 때 수익은 R(P) = P(a − bP) = aP − bP²입니다. R′(P) = a − 2bP = 0인 가격에서 수익이 최대입니다. 원가 c가 있으면 이윤 (P − c)(a − bP)를 미분합니다.',
          formula: 'R(P) = aP − bP²,  R′(P) = a − 2bP = 0 → P = a ÷ 2b,  이윤 최대: P = (a + bc) ÷ 2b',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const b = rng.pick([1, 2, 4, 5]);
            const P0 = rng.int(10, 40) * 100;
            const c = Hd ? rng.int(3, 15) * 100 : 0;
            if (c >= P0 - 100) return this.generate(rng, { tier });
            const a = b * (2 * P0 - c);
            const Q0 = a - b * P0;
            const best = (P0 - c) * Q0;
            const co = x => (x === 1 ? '' : x);
            const fD = `Q = ${comma(a)} − ${co(b)}P`;
            const val = P => (P - c) * (a - b * P);
            const item = rng.pick(['수제 쿠키', '텀블러', '휴대폰 케이스', '화분']);
            const lbl = Hd ? '최대 이윤' : '최대 수익';
            const pair = (x, y) => `가격 ${comma(x)}원, ${lbl} ${comma(y)}원`;
            let correct, cands;
            if (E) {
              correct = `${comma(P0)}원`;
              cands = [2 * P0, P0 / 2, b !== 1 ? a / 2 : P0 + 500, P0 + 200].map(x => `${comma(x)}원`);
            } else if (!Hd) {
              correct = pair(P0, best);
              cands = [pair(P0, a * P0), pair(P0 / 2, val(P0 / 2)), pair(P0, best * 2), pair(P0 + 100, val(P0 + 100))];
            } else {
              const Pr = a / (2 * b);
              correct = pair(P0, best);
              cands = [pair(Pr, val(Pr)), pair(P0, P0 * Q0), pair(Pr, Pr * (a - b * Pr)), pair(P0, best * 2)];
            }
            const ds = cands.filter((x, i) => x !== correct && cands.indexOf(x) === i).slice(0, 3);
            const { options, answerIndex } = buildChoiceSet(rng, correct, ds);
            const intro = `${item} 1개의 가격을 P원으로 정하면 하루 판매량이 ${fD}(개)입니다.`;
            const question = E
              ? `${intro} 하루 판매 수익 R(P) = P × Q가 최대가 되는 가격 P는? (미분을 이용)`
              : Hd
                ? `${intro} ${item} 1개의 원가가 ${comma(c)}원일 때, 하루 이윤 (P − ${comma(c)}) × Q가 최대가 되는 가격과 그때의 최대 이윤은? (미분을 이용)`
                : `${intro} 하루 판매 수익 R(P) = P × Q가 최대가 되는 가격과 그때의 최대 수익은? (미분을 이용)`;
            const variablesInfo = { 수요: fD };
            if (Hd) variablesInfo.단위원가 = `${comma(c)}원`;
            const steps = Hd
              ? [
                `이윤 f(P) = (P − ${comma(c)})(${comma(a)} − ${co(b)}P) = −${co(b)}P² + ${comma(a + b * c)}P − ${comma(a * c)} 입니다.`,
                `f′(P) = −${2 * b}P + ${comma(a + b * c)} = 0 에서 P = ${comma(P0)}원이고, 이 앞뒤로 f′의 부호가 양에서 음으로 바뀌므로 최대입니다.`,
                `최대 이윤 = (${comma(P0)} − ${comma(c)}) × ${comma(Q0)} = ${comma(best)}원입니다. (원가를 무시하면 가격을 ${comma(a / (2 * b))}원으로 잘못 정하게 됩니다.)`
              ]
              : [
                `R(P) = P(${comma(a)} − ${co(b)}P) = ${comma(a)}P − ${co(b)}P² 입니다.`,
                `R′(P) = ${comma(a)} − ${2 * b}P = 0 에서 P = ${comma(P0)}원이고, 이 앞뒤로 R′의 부호가 양에서 음으로 바뀌므로 최대입니다.`,
                ...(E ? [] : [`그때 판매량은 ${comma(Q0)}개이므로 최대 수익은 ${comma(P0)} × ${comma(Q0)} = ${comma(best)}원입니다.`])
              ];
            return { question, variablesInfo, options, answerIndex, hint: '수익(이윤) 함수를 P에 대한 이차함수로 전개한 뒤 미분해서 0이 되는 P를 찾으세요.', steps };
          }
        },
        {
          id: 'LIF-35',
          dayIndex: 34,
          unit: '경제 수학 · 예산 제약과 부등식의 영역',
          standardCode: '[12경수02-06]',
          standardName: '부등식의 영역의 개념을 이해하고, 이를 활용하여 경제 현상의 문제를 해결할 수 있다.',
          sourceRef: '고등학교 경제 수학 (예산 제약 px + qy ≤ M 과 부등식의 영역)',
          difficulty: '★★☆ 표준',
          tierGuide: {
            easy: 'A를 정한 개수만큼 사고 남은 예산으로 B를 최대 몇 개(버림)',
            normal: '예산 부등식 영역 안의 자연수 순서쌍 (x, y)의 개수',
            hard: '예산 안에서 만족도 합이 최대가 되는 구매 조합 찾기'
          },
          conceptSummary: 'A를 x개, B를 y개 살 때 예산 제약은 px + qy ≤ M입니다. 이 부등식의 영역 안에 있는 점 (x, y) 중 개수가 자연수(또는 0 이상 정수)인 점이 실제로 살 수 있는 조합입니다.',
          formula: '예산 제약: px + qy ≤ M (x, y는 0 이상의 정수)',
          generate(rng, { tier } = {}) {
            const E = tier === 'easy', Hd = tier === 'hard';
            const [A, B] = rng.pick([['공책', '볼펜'], ['과자', '음료수'], ['붕어빵', '어묵'], ['사과', '귤']]);
            let M, p, q, ans, cands, unitS, question, bestXY = [0, 0];
            const variablesInfo = {};
            if (E) {
              M = rng.pick([10000, 15000, 20000, 25000, 30000]);
              p = rng.pick([1200, 1500, 2000, 2500]); q = rng.pick([700, 800, 900, 1300]);
              const x = rng.int(1, Math.floor(M / p) - 1);
              const rem = M - p * x;
              ans = Math.floor(rem / q);
              if (ans < 1 || rem % q === 0) return this.generate(rng, { tier });
              cands = [ans + 1, Math.floor(M / q), Math.floor(M / (p + q)), ans - 1];
              unitS = '개';
              variablesInfo.A구매 = `${x}개`;
              question = `예산 ${comma(M)}원으로 ${A}(1개 ${comma(p)}원)${jo(A, '을/를')} ${x}개 사고, 남은 돈으로 ${B}(1개 ${comma(q)}원)${jo(B, '을/를')} 최대한 많이 사려고 합니다. ${wj(B, '은/는')} 최대 몇 개 살 수 있나요?`;
            } else if (!Hd) {
              M = rng.pick([6000, 7000, 8000, 9000, 10000, 11000, 12000]);
              p = rng.pick([1000, 1500, 2000, 2500, 3000]); q = rng.pick([500, 1000, 1500].filter(x => x !== p));
              let cnt = 0, cnt0 = 0, exact = 0;
              for (let x = 0; p * x <= M; x++) for (let y = 0; p * x + q * y <= M; y++) {
                if (x >= 1 && y >= 1) cnt++;
                if (x + y > 0) cnt0++;
                if (x >= 1 && y >= 1 && p * x + q * y === M) exact++;
              }
              ans = cnt;
              if (ans < 2) return this.generate(rng, { tier });
              cands = [cnt0, exact, ans + 1, ans - 1];
              unitS = '가지';
              question = `예산 ${comma(M)}원으로 ${A}(1개 ${comma(p)}원)${jo(A, '과/와')} ${B}(1개 ${comma(q)}원)${jo(B, '을/를')} 각각 1개 이상 사려고 합니다. 예산을 넘지 않게 살 수 있는 (${A}의 개수, ${B}의 개수)의 경우는 모두 몇 가지인가요? (예산을 다 쓰지 않아도 됩니다.)`;
            } else {
              M = rng.pick([10000, 12000, 15000, 18000, 20000]);
              p = rng.pick([1500, 2000, 2500, 3000]); q = rng.pick([800, 1000, 1200, 1500].filter(x => x !== p));
              const ua = rng.pick([4, 5, 6, 7, 8]), ub = rng.pick([2, 3, 4, 5]);
              let best = 0, best11 = 0;
              for (let x = 0; p * x <= M; x++) for (let y = 0; p * x + q * y <= M; y++) {
                if (ua * x + ub * y > best) { best = ua * x + ub * y; bestXY = [x, y]; }
                if (x >= 1 && y >= 1) best11 = Math.max(best11, ua * x + ub * y);
              }
              ans = best;
              cands = [ua * Math.floor(M / p), ub * Math.floor(M / q), best11, ans - 1, ans + ua];
              unitS = '점';
              variablesInfo.만족도 = `A ${ua}점, B ${ub}점`;
              question = `예산 ${comma(M)}원으로 A(${A}, 1개 ${comma(p)}원, 1개당 만족도 ${ua}점)와 B(${B}, 1개 ${comma(q)}원, 1개당 만족도 ${ub}점)를 사려고 합니다. 한쪽만 사도 될 때, 예산 안에서 만족도의 합이 최대가 되도록 사면 최대 만족도는 몇 점인가요?`;
            }
            Object.assign(variablesInfo, { 예산: `${comma(M)}원`, A가격: `${comma(p)}원`, B가격: `${comma(q)}원` });
            const ds = cands.filter((x, i) => x > 0 && x !== ans && cands.indexOf(x) === i).slice(0, 3).map(x => `${x}${unitS}`);
            const { options, answerIndex } = buildChoiceSet(rng, `${ans}${unitS}`, ds);
            const steps = [`${A}를 x개, ${B}를 y개 산다고 하면 예산 제약은 ${comma(p)}x + ${comma(q)}y ≤ ${comma(M)} 입니다.`.replace(`${A}를`, wj(A, '을/를')).replace(`${B}를`, wj(B, '을/를'))];
            if (E) {
              const x = Number(variablesInfo.A구매.replace(/\D/g, ''));
              steps.push(`x = ${x}이면 ${comma(q)}y ≤ ${comma(M)} − ${comma(p * x)} = ${comma(M - p * x)}, y ≤ ${Math.floor((M - p * x) / q)}.…`, `y는 자연수이므로 버림하여 최대 ${ans}개입니다.`);
            } else if (!Hd) {
              const rows = [];
              for (let x = 1; p * x + q <= M; x++) rows.push(`x = ${x}일 때 y는 1~${Math.floor((M - p * x) / q)} (${Math.floor((M - p * x) / q)}가지)`);
              steps.push(`x를 1부터 늘려 가며 가능한 y를 세면: ${rows.join(', ')}`, `모두 더하면 ${ans}가지입니다.`);
            } else {
              steps.push(`x를 0부터 ${Math.floor(M / p)}까지 바꾸며, 각 x에서 남은 예산으로 y를 최대로 살 때의 만족도를 비교합니다(영역의 경계 근처 점만 보면 됩니다).`, `x = ${bestXY[0]}, y = ${bestXY[1]}일 때 비용 ${comma(p * bestXY[0] + q * bestXY[1])}원으로 만족도 합이 최대 ${ans}점입니다. (A만 사면 ${cands[0]}점, B만 사면 ${cands[1]}점)`);
            }
            return { question, variablesInfo, options, answerIndex, hint: '예산 제약 px + qy ≤ M을 세운 뒤, x를 하나씩 정하고 가능한 y를 따져 보세요.', steps };
          }
        }
      ]
    }
  };

  // ---------------------------------------------------------------------------
  // 3. 문제 생성 및 조회 API
  // ---------------------------------------------------------------------------
  /**
   * 특정 수준(level), 요일/템플릿 인덱스(dayIdx), 날짜 키(dateKey), 변형 번호(variant), 주차 오프셋 등을 받아
   * 동적으로 생성된 문제를 반환합니다.
   */
  // 난이도 단계: easy(하) · normal(중, 기본) · hard(상)
  // 템플릿은 generate(rng, { tier })로 받아 수의 범위·풀이 단계 수를 조절한다.
  // normal 은 기존 시드를 그대로 써서 '오늘의 문제'와 검증 결과가 바뀌지 않는다.
  const TIERS = ['easy', 'normal', 'hard'];
  const TIER_LABEL = { easy: '★☆☆ 하', normal: '★★☆ 중', hard: '★★★ 상' };

  function generateProblem({ level = 'middle', dayIdx = 0, dateKey = '2026-10-30', variant = 0, templateId = null, tier = 'normal' }) {
    if (!TIERS.includes(tier)) tier = 'normal';
    const pack = CURRICULUM_PACKS[level] || CURRICULUM_PACKS.middle;
    let template = null;

    if (templateId) {
      for (const lv of Object.keys(CURRICULUM_PACKS)) {
        const found = CURRICULUM_PACKS[lv].templates.find(t => t.id === templateId);
        if (found) {
          template = found;
          break;
        }
      }
    }
    if (!template) {
      // 14개 이상의 템플릿 지원: dateKey 기준 주차(weekOfYear)를 계산하여 주마다 7개씩 순환
      let weekOffset = 0;
      if (pack.templates.length > 7 && dateKey) {
        const parts = dateKey.split('-').map(Number);
        if (parts.length === 3) {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          const startOfYear = new Date(parts[0], 0, 1);
          const pastDays = Math.floor((d - startOfYear) / 86400000);
          const weekNum = Math.floor((pastDays + startOfYear.getDay()) / 7);
          const cycleWeeks = Math.ceil(pack.templates.length / 7);
          weekOffset = (weekNum % cycleWeeks) * 7;
        }
      }
      const rawIdx = (weekOffset + (dayIdx % 7)) % pack.templates.length;
      template = pack.templates[rawIdx] || pack.templates[dayIdx % pack.templates.length];
    }

    const seedString = `${template.id}::${dateKey}::v${variant}` + (tier === 'normal' ? '' : `::${tier}`);
    const rng = new SeededRNG(seedString);
    const generated = template.generate(rng, { tier });

    return {
      templateId: template.id,
      level,
      levelName: pack.level,
      targetGrade: pack.targetGrade,
      dayIndex: template.dayIndex,
      unit: template.unit,
      standardCode: template.standardCode,
      standardName: template.standardName,
      sourceRef: template.sourceRef,
      difficulty: TIER_LABEL[tier],
      tier,
      conceptSummary: template.conceptSummary,
      formula: template.formula,
      seedString,
      variant,
      dateKey,
      question: generated.question,
      variablesInfo: generated.variablesInfo || {},
      options: generated.options,
      answerIndex: generated.answerIndex,
      hint: generated.hint,
      steps: generated.steps,
      // 그림 스펙(www/figure.js). mask = 정답 보기에 나오는 숫자 → 그림 라벨에서 '?'로 가림
      figure: generated.figure
        ? { ...generated.figure, mask: (String(generated.options[generated.answerIndex]).replace(/−/g, '-').match(/-?\d+(?:\.\d+)?/g) || []).map(Number) }
        : null
    };
  }

  function getAllTemplates(level) {
    if (level && CURRICULUM_PACKS[level]) {
      return CURRICULUM_PACKS[level].templates;
    }
    const all = [];
    for (const lv of Object.keys(CURRICULUM_PACKS)) {
      CURRICULUM_PACKS[lv].templates.forEach(t => {
        all.push({ ...t, level: lv, levelName: CURRICULUM_PACKS[lv].level });
      });
    }
    return all;
  }

  global.HaruProblemBank = {
    CURRICULUM_PACKS,
    SeededRNG,
    generateProblem,
    getAllTemplates,
    TIERS,
    TIER_LABEL
  };
})(typeof window !== 'undefined' ? window : globalThis);
