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
              `부피: ${vol + 20} cm³, 겉넓이: ${surf + 10} cm²`
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
          conceptSummary: '괄호가 있는 일차방정식은 분배법칙으로 괄호를 먼저 전개한 뒤, 일차항은 좌변으로, 상수항은 우변으로 이항하여 풉니다.',
          formula: 'a(x + b) = cx + d  →  (a − c)x = d − ab',
          generate(rng) {
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
          conceptSummary: '자연수 N이 N = a^m × b^n (a, b는 서로 다른 소수)으로 소인수분해될 때, N의 약수의 개수는 (m + 1) × (n + 1)개입니다.',
          formula: 'N = p^a × q^b 의 약수의 개수 = (a + 1)(b + 1)',
          generate(rng) {
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
          conceptSummary: '왕복하거나 속력이 바뀔 때 전체 걸린 시간은 (갈 때 걸린 시간) + (올 때 걸린 시간) = (거리/갈 때 속력) + (거리/올 때 속력)으로 식을 세웁니다.',
          formula: '시간 = 거리 ÷ 속력',
          generate(rng) {
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
          conceptSummary: '일차함수 y = ax + b에서 기울기 a는 (y 증가량)/(x 증가량)이고, x절편은 y=0일 때 x값(−b/a), y절편은 b입니다.',
          formula: 'y = ax + b 의 x절편: −b/a,  y절편: b',
          generate(rng) {
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
          conceptSummary: '두 일차방정식을 더하거나 빼서 한 미지수를 소거(가감법)하면 연립방정식의 해 (x, y)를 구할 수 있습니다.',
          formula: '{ ax + by = p,  cx − by = q } ⇒ (a + c)x = p + q',
          generate(rng) {
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
          conceptSummary: '직각삼각형에서 직각을 낀 두 변의 길이를 각각 a, b라 하고 빗변의 길이를 c라 하면 a² + b² = c²이 성립합니다.',
          formula: 'a² + b² = c²  (c는 빗변의 길이)',
          generate(rng) {
            const triples = [
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
          conceptSummary: '이차함수 y = a(x − p)² + q의 그래프의 꼭짓점의 좌표는 (p, q)이고, 대칭축의 방정식은 x = p입니다.',
          formula: 'y = a(x − p)² + q  ⇒  꼭짓점: (p, q), 축: x = p',
          generate(rng) {
            const a = rng.pick([-2, -1, 1, 2, 3]);
            const p = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5]);
            const q = rng.pick([-6, -4, -2, 1, 3, 5, 7]);
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
          conceptSummary: '거듭제곱을 가장 먼저 계산하고, (−a)² = a²이지만 −a² = −(a²)임을 명확히 구분해야 합니다.',
          formula: '(−a)² = a²,  −a² = −(a²)',
          generate(rng) {
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
          conceptSummary: '부등식의 양변에 같은 음수를 곱하거나 양변을 같은 음수로 나누면 부등호의 방향이 반대로 바뀝니다.',
          formula: '−kx < c  (k > 0)  ⇒  x > −c/k',
          generate(rng) {
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
          conceptSummary: '(a^m)^n = a^(mn) 이고, a^m × a^n = a^(m+n), a^m ÷ a^n = a^(m−n) 입니다.',
          formula: '(a^m)^n = a^(mn),  (ab)^n = a^n b^n',
          generate(rng) {
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
          conceptSummary: 'x² + (a+b)x + ab = (x + a)(x + b) 공식을 이용해 합과 곱이 맞는 두 정수를 찾습니다.',
          formula: 'x² + (a + b)x + ab = (x + a)(x + b)',
          generate(rng) {
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
          conceptSummary: 'n² < N < (n+1)² 이면 n < √N < n+1 이므로, √N의 정수 부분 a = n, 소수 부분 b = √N − n 입니다.',
          formula: '소수 부분 = 원래 수 − 정수 부분',
          generate(rng) {
            const n = rng.int(2, 5);
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
          conceptSummary: '직각삼각형에서 sin = 높이/빗변, cos = 밑변/빗변, tan = 높이/밑변이며 특수각(30°, 45°, 60°)의 값을 암기하여 활용합니다.',
          formula: 'sin 30° = 1/2,  cos 60° = 1/2,  tan 45° = 1',
          generate(rng) {
            const hypotenuse = rng.pick([6, 8, 10, 12, 16]);
            const angle = 30; // 30°일 때 마주 보는 대변 = hypotenuse / 2
            const opp = hypotenuse / 2;

            const correct = `${opp} cm`;
            const distractors = [
              `${hypotenuse} cm`,
              `${opp + 2} cm`,
              `${Math.round(hypotenuse * 0.8)} cm`
            ];
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
          conceptSummary: '서로 다른 두 개의 주사위를 던질 때 일어날 수 있는 모든 경우의 수는 6 × 6 = 36가지입니다.',
          formula: '확률 = (사건이 일어나는 경우의 수) ÷ (모든 경우의 수)',
          generate(rng) {
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
        }
      ]
    },

    // =========================================================================
    // [3] 고등 수학 (공통수학1·2, 대수, 미적분Ⅰ 14개 대표 유형)
    // =========================================================================
    high: {
      id: 'high',
      level: '고등 수학',
      targetGrade: '고등학교 공통수학·대수·미적분Ⅰ',
      title: '방정식·함수·도형의 방정식·수열과 미분',
      desc: '다항식의 연산과 나머지정리, 판별식과 근과 계수의 관계, 점과 원의 방정식, 지수·로그와 등차·등비수열, 도함수의 활용까지 수능·내신의 필수 14개 핵심 유형을 정복해 보자.',
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
              `최댓값 ${maxVal + 2}, 최솟값 ${minVal - 1} (합: ${maxVal + minVal + 1})`
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
        }
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
          generate(rng) {
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
          generate(rng) {
            const principalMan = rng.pick([100, 200, 300, 500, 1000]);
            const rate = rng.pick([4, 5, 6, 8, 10]);
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
          generate(rng) {
            const unitPriceA = rng.pick([1200, 1500, 1800, 2000, 2400]);
            const diffPer100 = rng.pick([150, 200, 250, 300]);
            const aIsCheaper = rng.next() > 0.5;
            const upA = aIsCheaper ? unitPriceA : unitPriceA + diffPer100;
            const upB = aIsCheaper ? unitPriceA + diffPer100 : unitPriceA;

            const weightA = rng.pick([200, 300, 400]);
            const weightB = rng.pick([500, 600, 800]);
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
          generate(rng) {
            const initWeight = rng.pick([200, 300, 400]);
            const initConc = rng.pick([12, 15, 16, 20]);
            const targetConc = rng.pick([6, 8, 10]);
            const solute = (initWeight * initConc) / 100;
            const finalWeight = (solute * 100) / targetConc;
            if (!Number.isInteger(finalWeight) || finalWeight <= initWeight) return this.generate(rng);
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
          generate(rng) {
            const eff = rng.pick([10, 12, 15, 16, 20]);
            const liters = rng.int(15, 35);
            const dist = eff * liters;
            const pricePerL = rng.pick([1600, 1650, 1700, 1750]);
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
          generate(rng) {
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
          generate(rng) {
            const r1 = rng.pick([10, 15, 20, 25]);
            const relIncrease = rng.pick([20, 40, 50, 60, 80, 100]);
            const diffP = (r1 * relIncrease) / 100;
            if (!Number.isInteger(diffP)) return this.generate(rng);
            const r2 = r1 + diffP;

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
          generate(rng) {
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
          generate(rng) {
            // 정답 시간이 정수 초가 되는 (속도, 용량) 조합만 사용 (240 Mbps = 30 MB/s 는 3 GB만)
            const combos = [];
            for (const sp of [80, 160, 240, 400, 800]) {
              for (const gb of [1, 2, 3, 4, 5]) if ((gb * 1000) % (sp / 8) === 0) combos.push([sp, gb]);
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
