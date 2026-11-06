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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
          generate(rng) {
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
