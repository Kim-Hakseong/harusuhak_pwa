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
      targetGrade: '초등 4~6학년 과정',
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
          unit: '초5-1 · 약분과 통분',
          standardCode: '[5수01-04]',
          standardName: '분모가 다른 분수의 크기를 비교할 수 있다.',
          sourceRef: '초등 수학 5-1 교과서 4단원 (약분과 통분)',
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

            const correct = `${bigger}가 ${diff}/${common}만큼 더 크다`;
            const smaller = na > nc ? f2 : f1;
            const distractors = [
              `${smaller}가 ${diff}/${common}만큼 더 크다`,
              `${bigger}가 ${Math.abs(a - c) || 1}/${b + d}만큼 더 크다`,
              `두 분수의 크기가 같다`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `두 분수 ${f1}와 ${f2}의 크기를 비교한 설명으로 옳은 것은?`,
              variablesInfo: { 분수1: f1, 분수2: f2, 공통분모: common },
              options,
              answerIndex,
              hint: `두 분모 ${b}와 ${d}의 최소공배수인 ${common}(으)로 통분해 보세요.`,
              steps: [
                `두 분모 ${b}와 ${d}의 최소공배수는 ${common}입니다.`,
                `${f1} = (${a}×${common / b})/(${b}×${common / b}) = ${na}/${common}이고, ${f2} = (${c}×${common / d})/(${d}×${common / d}) = ${nc}/${common}입니다.`,
                `분자를 비교하면 ${na} ${na > nc ? '>' : '<'} ${nc}이므로, ${bigger}가 ${diff}/${common}만큼 더 큽니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-02',
          dayIndex: 1,
          unit: '초5-1 · 약수와 배수',
          standardCode: '[5수01-02]',
          standardName: '최대공약수와 최소공배수의 의미를 알고 이를 구할 수 있다.',
          sourceRef: '초등 수학 5-1 교과서 2단원 (약수와 배수 실생활 활용)',
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
              question: `${items[0]} ${itemA}${items[2]}와 ${items[1]} ${itemB}${items[3]}를 남김없이 최대한 많은 학생에게 똑같이 나누어 주려고 합니다. 최대 몇 명에게 나누어 줄 수 있으며, 한 명이 받는 양은 얼마인가요?`,
              variablesInfo: { [items[0]]: itemA, [items[1]]: itemB, 최대공약수: g },
              options,
              answerIndex,
              hint: `${itemA}과 ${itemB}을 동시에 나누어떨어지게 하는 가장 큰 수(최대공약수)를 구해 보세요.`,
              steps: [
                `남김없이 최대한 많은 학생에게 똑같이 나누어 주어야 하므로 ${itemA}과 ${itemB}의 최대공약수를 구합니다.`,
                `${itemA} = ${g} × ${m1}, ${itemB} = ${g} × ${m2} (${m1}, ${m2}는 서로소)이므로 최대공약수는 ${g}입니다.`,
                `따라서 최대 ${g}명에게 나누어 줄 수 있고, 한 명당 ${items[0]} ${itemA}÷${g}=${m1}${items[2]}, ${items[1]} ${itemB}÷${g}=${m2}${items[3]}씩 받습니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-03',
          dayIndex: 2,
          unit: '초5-1 · 분수의 덧셈과 뺄셈',
          standardCode: '[5수01-05]',
          standardName: '분모가 다른 분수의 덧셈과 뺄셈의 계산 원리를 이해하고 그 계산을 할 수 있다.',
          sourceRef: '초등 수학 5-1 교과서 5단원 (분수의 덧셈과 뺄셈)',
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
                return rem === 0 ? `${whole}` : `${whole}과 ${rem}/${m} (${n}/${m})`;
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
              hint: `분모끼리 직접 더하면 안 돼요! 두 분모 ${b}와 ${d}의 최소공배수 ${den}(으)로 통분한 뒤 분자끼리 더해 보세요.`,
              steps: [
                `분모 ${b}와 ${d}의 최소공배수는 ${den}입니다.`,
                `${a}/${b} = ${a * (den / b)}/${den}, ${c}/${d} = ${c * (den / d)}/${den}로 통분합니다.`,
                `두 분수를 더하면 (${a * (den / b)} + ${c * (den / d)})/${den} = ${num}/${den}이며, 기약분수로 정리하면 ${correct}입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-04',
          dayIndex: 3,
          unit: '초6-1 · 비와 비율',
          standardCode: '[6수04-03]',
          standardName: '비율을 분수, 소수, 백분율로 나타낼 수 있다.',
          sourceRef: '초등 수학 6-1 교과서 4단원 (비와 비율)',
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
          unit: '초5-1 · 다각형의 둘레와 넓이',
          standardCode: '[5수03-06]',
          standardName: '평행사변형, 삼각형, 사다리꼴, 마름모의 넓이를 구할 수 있다.',
          sourceRef: '초등 수학 5-1 교과서 6단원 (다각형의 둘레와 넓이)',
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
          unit: '초6-2 · 비례식과 비례배분',
          standardCode: '[6수04-05]',
          standardName: '비례배분의 의미를 알고, 주어진 양을 비례배분할 수 있다.',
          sourceRef: '초등 수학 6-2 교과서 4단원 (비례식과 비례배분)',
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
            const ans = total * (targetRatio / sumR);

            const correct = `${ans}개`;
            const distractors = [
              `${total * (otherRatio / sumR)}개`,
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
                `${askLarger ? '더 많이' : '더 적게'} 가지는 쪽은 전체의 ${targetRatio}/${sumR}를 차지합니다.`,
                `따라서 ${total} × (${targetRatio}/${sumR}) = ${ans}개입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-07',
          dayIndex: 6,
          unit: '초5-2 · 평균과 가능성',
          standardCode: '[5수05-01]',
          standardName: '평균의 의미를 알고, 주어진 자료의 평균을 구할 수 있다.',
          sourceRef: '초등 수학 5-2 교과서 6단원 (평균과 가능성) 역산 유형',
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
          unit: '초6-1 · 분수의 나눗셈',
          standardCode: '[6수01-08]',
          standardName: '(자연수)÷(분수), (분수)÷(분수)의 계산 원리를 이해하고 그 계산을 할 수 있다.',
          sourceRef: '초등 수학 6-1 교과서 1단원 (분수의 나눗셈)',
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
          unit: '초6-2 · 소수의 나눗셈',
          standardCode: '[6수01-11]',
          standardName: '소수의 나눗셈의 계산 원리를 이해하고 몫과 남는 양을 구할 수 있다.',
          sourceRef: '초등 수학 6-2 교과서 2단원 (소수의 나눗셈 몫과 남는 양)',
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
                `${total} ÷ ${each}을 계산하면 몫은 자연수 ${people}이 됩니다.`,
                `${people}명에게 나누어준 리본의 총길이는 ${people} × ${each} = ${(people * each).toFixed(1)} m입니다.`,
                `남는 리본의 길이는 ${total} − ${(people * each).toFixed(1)} = ${rem} m입니다. (소수점 자리에 주의하세요!)`
              ]
            };
          }
        },
        {
          id: 'BAS-10',
          dayIndex: 9,
          unit: '초6-2 · 원의 넓이',
          standardCode: '[6수03-03]',
          standardName: '원주와 원의 넓이를 구하는 방법을 이해하고, 이를 구할 수 있다.',
          sourceRef: '초등 수학 6-2 교과서 5단원 (원의 넓이)',
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
          unit: '초6-1 · 직육면체의 부피와 겉넓이',
          standardCode: '[6수03-08]',
          standardName: '직육면체와 정육면체의 겉넓이와 부피를 구하는 방법을 이해하고 구할 수 있다.',
          sourceRef: '초등 수학 6-1 교과서 6단원 (직육면체의 부피와 겉넓이)',
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
          unit: '초5-1 · 다각형의 둘레와 넓이 (마름모)',
          standardCode: '[5수03-05]',
          standardName: '마름모의 넓이를 구하는 방법을 이해하고 이를 구할 수 있다.',
          sourceRef: '초등 수학 5-1 교과서 6단원 (마름모의 넓이)',
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
          unit: '초5-2 · 규칙과 대응',
          standardCode: '[5수02-02]',
          standardName: '두 양 사이의 대응 관계를 표와 식으로 나타낼 수 있다.',
          sourceRef: '초등 수학 5-2 교과서 3단원 (규칙과 대응)',
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
              question: `성냥개비로 ${type.shape}을 한 줄로 이어 붙여 만들고 있습니다. 1개 만들 때 성냥개비 ${type.add + type.base}개, 2개 만들 때 ${(type.add + type.base) + type.add}개, 3개 만들 때 ${(type.add + type.base) + type.add * 2}개가 필요합니다. ${type.shape} ${n}개를 이어 붙여 만들 때 필요한 성냥개비는 총 몇 개인가요?`,
              variablesInfo: { 도형: type.shape, 도형수: n, 총개수: total },
              options,
              answerIndex,
              hint: `${type.shape}이 1개 늘어날 때마다 성냥개비는 정확히 ${type.add}개씩 늘어납니다.`,
              steps: [
                `첫 번째 도형에 성냥개비 ${type.add + type.base}개가 필요하고, 그 이후 도형 1개를 추가할 때마다 ${type.add}개씩 더 필요합니다.`,
                `따라서 ${type.shape} n개와 성냥개비 수 y 사이의 대응 관계식은 y = ${type.add} × n + ${type.base} 입니다.`,
                `n = ${n}을 대입하면 y = ${type.add} × ${n} + ${type.base} = ${type.add * n} + ${type.base} = ${total}개입니다.`
              ]
            };
          }
        },
        {
          id: 'BAS-14',
          dayIndex: 13,
          unit: '초6-2 · 원그래프와 띠그래프',
          standardCode: '[6수05-02]',
          standardName: '띠그래프와 원그래프를 알고, 이를 해석할 수 있다.',
          sourceRef: '초등 수학 6-2 교과서 4단원 (비율그래프의 해석)',
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
          unit: '중1 · 문자와 식 (일차방정식)',
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
              hint: `좌변에 분배법칙을 적용할 때 ${a}를 x와 ${b} 모두에 곱해야 합니다!`,
              steps: [
                `분배법칙을 이용하여 좌변의 괄호를 풀면 ${a}x ${a * b >= 0 ? '+ ' + (a * b) : '− ' + Math.abs(a * b)} = ${cStr}${dStr} 입니다.`,
                `미지수 x가 있는 항을 좌변으로, 상수항을 우변으로 이항하면 (${a} − ${c})x = ${d} − (${a * b}) 입니다.`,
                `정리하면 ${a - c}x = ${d - a * b} 이므로 양변을 ${a - c}(으)로 나누면 x = ${x} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-02',
          dayIndex: 1,
          unit: '중1 · 수와 연산 (소인수분해)',
          standardCode: '[9수01-01]',
          standardName: '소인수분해의 뜻을 알고, 자연수를 소인수분해할 수 있다.',
          sourceRef: '중학교 수학 1 교과서 1단원 (소인수분해와 약수의 개수)',
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
              question: `자연수 ${comma(num)}을(를) 소인수분해하여 구한 양의 약수의 총개수는?`,
              variablesInfo: { 자연수: num, 소인수분해: `${p}^${a} × ${q}^${b}`, 약수개수: divCount },
              options,
              answerIndex,
              hint: `${comma(num)}을 소인수분해한 뒤 각 소인수의 지수에 1을 더하여 서로 곱해 보세요.`,
              steps: [
                `${comma(num)}을 소인수분해하면 ${comma(num)} = ${p}^${a} × ${q}^${b} 입니다.`,
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
          standardCode: '[9수02-05]',
          standardName: '다양한 실생활 문제를 일차방정식으로 나타내어 해결할 수 있다.',
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
                `양변에 분모의 최소공배수 ${L}을(를) 곱하면 ${L / v1}x + ${L / v2}x = ${totalTime * L} 입니다.`,
                `${L / v1 + L / v2}x = ${totalTime * L} 이므로 x = ${dist}(km)입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-04',
          dayIndex: 3,
          unit: '중2 · 일차함수와 그래프',
          standardCode: '[9수02-15]',
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
          standardCode: '[9수02-09]',
          standardName: '미지수가 2개인 연립일차방정식을 풀 수 있다.',
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
              hint: `y의 계수의 절댓값이 ${b}(으)로 같고 부호가 반대이므로 두 식을 변끼리 더해 보세요!`,
              steps: [
                `두 방정식을 변끼리 더하면 y항이 소거되어 (${a} + ${c})x = ${p} + (${q}) 가 됩니다.`,
                `${a + c}x = ${p + q} 이므로 x = ${x}입니다.`,
                `x = ${x}을 대입하면 ${bStr} = ${b * y}, 따라서 y = ${y}입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-06',
          dayIndex: 5,
          unit: '중2·3 · 피타고라스 정리',
          standardCode: '[9수03-11]',
          standardName: '피타고라스 정리를 이해하고 설명할 수 있다.',
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
                options,
                answerIndex,
                hint: `피타고라스 정리 a² + b² = c² 에 ${a}과 ${b}를 대입해 보세요.`,
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
          unit: '중3 · 이차방정식과 이차함수',
          standardCode: '[9수02-22]',
          standardName: '이차함수의 그래프의 성질을 이해하고 꼭짓점과 축의 방정식을 구할 수 있다.',
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
          unit: '중1 · 정수와 유리수의 혼합계산',
          standardCode: '[9수01-07]',
          standardName: '정수와 유리수의 사칙계산의 원리를 이해하고 그 계산을 할 수 있다.',
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
              hint: `(−${a})²은 괄호 전체의 제곱이므로 양수 ${a * a}가 됩니다. 뺄셈 기호와 음수 부호에 유의하세요!`,
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
          standardCode: '[9수02-06]',
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
                `양변을 음수 −${k}(으)로 나누면 부등호 방향이 반대로 바뀌어 x > ${ansBound} 가 됩니다.`
              ]
            };
          }
        },
        {
          id: 'MID-10',
          dayIndex: 9,
          unit: '중2 · 지수법칙과 단항식의 계산',
          standardCode: '[9수01-12]',
          standardName: '지수법칙을 이해하고, 다항식의 곱셈과 나눗셈을 할 수 있다.',
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
              hint: `괄호 밖의 거듭제곱 ${p}를 계수 2와 x^${m}, y^${n}에 각각 분배법칙처럼 곱해 주어야 합니다. 2^${p} = ${coef}입니다.`,
              steps: [
                `(2x^${m} y^${n})^${p} = 2^${p} × (x^${m})^${p} × (y^${n})^${p} = ${coef}x^${m * p} y^${n * p} 입니다.`,
                `여기에 (x^${k} y)를 곱하면 계수는 ${coef}, x의 지수는 ${m * p} + ${k} = ${xExp}, y의 지수는 ${n * p} + 1 = ${yExp}가 됩니다.`,
                `따라서 식은 ${coef}x^${xExp} y^${yExp} 이며, 지수의 합은 ${xExp} + ${yExp} = ${sumExp} 입니다.`
              ]
            };
          }
        },
        {
          id: 'MID-11',
          dayIndex: 10,
          unit: '중3 · 인수분해',
          standardCode: '[9수02-17]',
          standardName: '다항식의 인수분해를 할 수 있다.',
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

            const f1 = a >= 0 ? `x + ${a}` : `x − ${Math.abs(a)}`;
            const f2 = b >= 0 ? `x + ${b}` : `x − ${Math.abs(b)}`;

            const correct = `(${f1})(${f2})`;
            const distractors = [
              `(${a >= 0 ? 'x − ' + a : 'x + ' + Math.abs(a)})(${b >= 0 ? 'x − ' + b : 'x + ' + Math.abs(b)})`,
              `(${f1})(${b >= 0 ? 'x − ' + b : 'x + ' + Math.abs(b)})`,
              `(x + ${sum})(x + ${prod})`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `이차식 ${poly} 을(를) 바르게 인수분해한 것은?`,
              variablesInfo: { 일차항계수: sum, 상수항: prod, 두정수: `${a}, ${b}` },
              options,
              answerIndex,
              hint: `곱해서 ${prod}이 되고 더해서 ${sum}이 되는 두 정수를 찾아보세요.`,
              steps: [
                `상수항이 ${prod}이므로 두 정수의 곱은 ${prod}입니다.`,
                `일차항의 계수가 ${sum}이므로 두 정수의 합은 ${sum}이어야 합니다.`,
                `두 조건을 만족하는 두 정수는 ${a}와 ${b}이므로 인수분해하면 (${f1})(${f2})가 됩니다.`
              ]
            };
          }
        },
        {
          id: 'MID-12',
          dayIndex: 11,
          unit: '중3 · 실수와 그 연산 (무리수의 정수·소수 부분)',
          standardCode: '[9수01-14]',
          standardName: '제곱근의 뜻과 성질을 알고, 무리수의 대소 관계를 판단할 수 있다.',
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
              hint: `${n}² = ${n * n} 이고 ${n + 1}² = ${(n + 1) * (n + 1)} 임을 이용하여 √${N}이 어떤 두 정수 사이에 있는지 확인하세요.`,
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
          unit: '중3 · 삼각비의 뜻과 특수각',
          standardCode: '[9수03-12]',
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
          standardCode: '[9수05-05]',
          standardName: '확률의 개념을 이해하고, 간단한 확률을 구할 수 있다.',
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
              question: `서로 다른 주사위 2개를 동시에 던질 때, 나오는 두 눈의 수의 합이 ${targetSum}이 될 확률은?`,
              variablesInfo: { 목표합: targetSum, 경우의수: count, 확률: fracStr },
              options,
              answerIndex,
              hint: `주사위 2개를 던질 때 모든 경우의 수는 6 × 6 = 36입니다. 합이 ${targetSum}이 되는 순서쌍 (a, b)를 직접 세어 보세요.`,
              steps: [
                `모든 경우의 수는 6 × 6 = 36가지입니다.`,
                `두 눈의 합이 ${targetSum}이 되는 순서쌍은 ${pairsList.join(', ')}로 총 ${count}가지입니다.`,
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
          standardName: '항등식의 성질과 나머지정리의 의미를 이해하고, 이를 활용하여 문제를 해결할 수 있다.',
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
              question: `다항식 P(x) = ${poly} 을(를) 일차식 (${divStr})(으)로 나누었을 때의 나머지는?`,
              variablesInfo: { 다항식: `P(x) = ${poly}`, 나누는식: divStr, 대입값: alpha },
              options,
              answerIndex,
              hint: `나머지정리에 의해 다항식 P(x)를 (${divStr})로 나눈 나머지는 P(${alpha})의 값과 같습니다.`,
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
          standardName: '이차방정식의 실근과 허근의 뜻을 알고, 판별식을 이용하여 이차방정식의 근을 판별할 수 있다.',
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
              hint: `'서로 다른 두 실근'이므로 판별식 D > 0 (등호 제외!)이어야 합니다. 짝수 판별식 D/4 = (${halfB})² − (k + ${shift}) > 0을 풀어 보세요.`,
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
          standardCode: '[10공수1-02-02]',
          standardName: '이차방정식의 근과 계수의 관계를 이해하고 대칭식의 값을 구할 수 있다.',
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
              hint: `근과 계수의 관계로 α + β = ${sum}, αβ = ${prod}를 먼저 구한 뒤 곱셈 공식의 변형 α² + β² = (α + β)² − 2αβ에 대입하세요.`,
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
          standardCode: '[10공수1-02-04]',
          standardName: '이차함수의 최대, 최소를 이해하고, 제한된 범위에서 최댓값과 최솟값을 구할 수 있다.',
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
              options,
              answerIndex,
              hint: `완전제곱식 f(x) = (x − ${p})² ${signedTerm(q, '')} 으로 바꾸어 꼭짓점(${p})이 주어진 구간 안에 있는지 확인하세요.`,
              steps: [
                `이차함수를 표준형으로 변형하면 f(x) = (x − ${p})² ${signedTerm(q, '')} 이므로 꼭짓점은 (${p}, ${q})입니다.`,
                `x = ${p}가 주어진 범위 ${left} ≤ x ≤ ${right} 안에 포함되므로 최솟값 m = f(${p}) = ${minVal}입니다.`,
                `대칭축에서 가장 먼 x = ${right}에서 최댓값 M = f(${right}) = ${maxVal}을 갖습니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-05',
          dayIndex: 4,
          unit: '공통수학1 · 순열과 조합',
          standardCode: '[10공수1-03-02]',
          standardName: '순열과 조합의 의미를 이해하고, 순열의 수와 조합의 수를 구할 수 있다.',
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
          unit: '대수(수학Ⅰ) · 등차수열의 일반항',
          standardCode: '[12대수-03-01]',
          standardName: '등차수열의 뜻을 알고, 일반항, 첫째항부터 제n항까지의 합을 구할 수 있다.',
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
          unit: '미적분Ⅰ(수학Ⅱ) · 미분계수와 접선의 기울기',
          standardCode: '[12미적1-02-02]',
          standardName: '미분계수의 기하적 의미를 이해하고, 다항함수의 도함수를 구할 수 있다.',
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
              hint: `먼저 f(x)를 미분하여 도함수 f'(x)를 구한 뒤 x = ${x0}을 대입하세요.`,
              steps: [
                `f(x)를 미분하면 f'(x) = ${3 * c3}x² ${signedTerm(2 * c2, 'x')} ${signedTerm(c1, '')} 입니다.`,
                `곡선 위의 점 (${x0}, f(${x0}))에서의 접선의 기울기는 f'(${x0})입니다.`,
                `x = ${x0}을 대입하면 f'(${x0}) = ${3 * c3}×(${x0})² + (${2 * c2})×(${x0}) + (${c1}) = ${slope}입니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-08',
          dayIndex: 7,
          unit: '공통수학1 · 복소수의 사칙연산',
          standardCode: '[10공수1-02-01]',
          standardName: '복소수의 뜻과 성질을 알고 사칙연산을 할 수 있다.',
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
            const scaledReal = realPart * norm;
            const scaledImag = imagPart * norm;

            // ( (scaledReal + scaledImag*i) / (denReal + i) ) = norm * (realPart + imagPart*i) / norm = realPart + imagPart*i
            const correct = `${realPart} ${imagPart >= 0 ? '+ ' + imagPart : '− ' + Math.abs(imagPart)}i`;
            const distractors = [
              `${realPart} ${imagPart >= 0 ? '− ' + imagPart : '+ ' + Math.abs(imagPart)}i`,
              `${realPart - 2} ${imagPart >= 0 ? '+ ' + imagPart : '− ' + Math.abs(imagPart)}i`,
              `${realPart * 2} + ${imagPart}i`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `복소수 z = (${realPart * norm} ${imagPart * norm >= 0 ? '+ ' + (imagPart * norm) : '− ' + Math.abs(imagPart * norm)}i) ÷ (${denReal} + i) 을(를) a + bi 꼴로 바르게 나타낸 것은?`,
              variablesInfo: { 분자: `${realPart * norm} + ${imagPart * norm}i`, 분모: `${denReal} + i` },
              options,
              answerIndex,
              hint: `분모의 켤레복소수인 (${denReal} − i)를 분자와 분모에 각각 곱해 분모를 실수로 만드세요. i² = −1 입니다.`,
              steps: [
                `분모의 켤레복소수는 (${denReal} − i) 입니다.`,
                `분모에 켤레복소수를 곱하면 (${denReal} + i)(${denReal} − i) = ${denReal}² − i² = ${norm} 입니다.`,
                `분자에 곱해 전개한 후 ${norm}으로 약분하면 ${correct}가 됩니다.`
              ]
            };
          }
        },
        {
          id: 'HIG-09',
          dayIndex: 8,
          unit: '공통수학2 · 선분의 내분점',
          standardCode: '[10공수2-01-02]',
          standardName: '좌표평면 위의 선분의 내분점과 외분점의 좌표를 구할 수 있다.',
          sourceRef: '공통수학2 교과서 (선분의 m:n 내분점 공식)',
          difficulty: '★★☆ 표준',
          conceptSummary: '선분 AB를 m:n으로 내분하는 점 P의 좌표는 ((m·x₂ + n·x₁)/(m+n), (m·y₂ + n·y₁)/(m+n)) 입니다.',
          formula: 'P = ((m x₂ + n x₁)/(m + n),  (m y₂ + n y₁)/(m + n))',
          generate(rng) {
            const m = rng.pick([1, 2, 3]);
            const n = rng.pick([1, 2]);
            const px = rng.int(-3, 4);
            const py = rng.int(-2, 5);
            const x1 = px - m * rng.pick([1, 2]);
            const x2 = px + n * rng.pick([1, 2]);
            // 깔끔한 정수 내분점을 위해 역산:
            const realPx = (m * x2 + n * x1) / (m + n);
            const y1 = py - m * 2;
            const y2 = py + n * 2;
            const realPy = (m * y2 + n * y1) / (m + n);

            const correct = `(${realPx}, ${realPy})`;
            const distractors = [
              `(${realPy}, ${realPx})`,
              `(${((n * x2 + m * x1) / (m + n)).toFixed(0)}, ${realPy})`,
              `(${realPx + 1}, ${realPy - 1})`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `두 점 A(${x1}, ${y1}), B(${x2}, ${y2})를 ${m} : ${n} 으로 내분하는 점 P의 좌표는?`,
              variablesInfo: { 점A: `(${x1}, ${y1})`, 점B: `(${x2}, ${y2})`, 내분비: `${m}:${n}` },
              options,
              answerIndex,
              hint: `내분점 공식의 분모는 (${m} + ${n})이고 분자는 ${m}×(B의 좌표) + ${n}×(A의 좌표) 입니다.`,
              steps: [
                `선분 AB를 ${m}:${n}으로 내분하므로 분모는 ${m} + ${n} = ${m + n} 입니다.`,
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
          standardCode: '[10공수2-01-05]',
          standardName: '원의 방정식을 구할 수 있고, 원의 성질을 파악할 수 있다.',
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
          standardCode: '[10공수2-02-02]',
          standardName: '필요조건과 충분조건의 뜻을 이해하고 구별할 수 있다.',
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
              question: `실수 x에 대하여 조건 p: "${c.p}"는 조건 q: "${c.q}"이기 위한 어떤 조건인가요?`,
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
          unit: '대수(수학Ⅰ) · 로그의 성질',
          standardCode: '[12대수-01-03]',
          standardName: '로그의 뜻과 성질을 알고, 이를 활용하여 계산할 수 있다.',
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
          unit: '대수(수학Ⅰ) · 등비수열의 합',
          standardCode: '[12대수-03-02]',
          standardName: '등비수열의 뜻을 알고, 첫째항부터 제n항까지의 합을 구할 수 있다.',
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
          unit: '미적분Ⅰ(수학Ⅱ) · 삼차함수의 극대와 극소',
          standardCode: '[12미적1-02-04]',
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
      targetGrade: '실용수학 · 경제수학 · 성인 수리력',
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
          unit: '실용수학 · 중복 할인과 실구매가',
          standardCode: '[12실수-01-01]',
          standardName: '일상생활에서 비율과 백분율이 사용되는 다양한 사례를 이해하고 합리적으로 계산할 수 있다.',
          sourceRef: '고등학교 실용수학 교과서 (연속 할인율과 최종 결제 금액)',
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
          unit: '경제수학 · 단리와 복리 이자 계산',
          standardCode: '[12경수-02-01]',
          standardName: '단리와 복리의 뜻과 차이를 알고 원리합계를 계산할 수 있다.',
          sourceRef: '고등학교 경제수학 교과서 2단원 (단리법과 복리법의 원리합계 비교)',
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
          unit: '실용수학 · 단위 가격(가성비) 비교',
          standardCode: '[12실수-01-02]',
          standardName: '단위당 가격이나 용량비를 비교하여 합리적인 소비 의사결정을 할 수 있다.',
          sourceRef: '고등학교 실용수학 교과서 (단위 가격 비교와 합리적 소비)',
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
            const correct = `${cheaperName}이 100g당 ${comma(diffPer100)}원 더 저렴하다`;
            const otherName = aIsCheaper ? 'B 상품' : 'A 상품';
            const distractors = [
              `${otherName}이 100g당 ${comma(diffPer100)}원 더 저렴하다`,
              `두 상품의 100g당 단위 가격이 ${comma(upA)}원으로 같다`,
              `${cheaperName}이 100g당 ${comma(diffPer100 * 2)}원 더 저렴하다`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `마트에서 같은 품질의 견과류를 A 상품은 ${weightA}g에 ${comma(priceA)}원, B 상품은 ${weightB}g에 ${comma(priceB)}원에 판매하고 있습니다. 100g당 가격을 비교한 결과로 옳은 것은?`,
              variablesInfo: { A상품: `${weightA}g / ${comma(priceA)}원`, B상품: `${weightB}g / ${comma(priceB)}원` },
              options,
              answerIndex,
              hint: `A 상품의 가격을 ${weightA / 100}으로 나누고, B 상품의 가격을 ${weightB / 100}으로 나누어 100g당 가격을 각각 구해 보세요.`,
              steps: [
                `A 상품의 100g당 가격은 ${comma(priceA)} ÷ ${weightA / 100} = ${comma(upA)}원입니다.`,
                `B 상품의 100g당 가격은 ${comma(priceB)} ÷ ${weightB / 100} = ${comma(upB)}원입니다.`,
                `따라서 ${cheaperName}이 100g당 ${comma(Math.abs(upA - upB))}원 더 저렴합니다.`
              ]
            };
          }
        },
        {
          id: 'LIF-04',
          dayIndex: 3,
          unit: '실용수학 · 농도와 희석 비율',
          standardCode: '[9수02-05]',
          standardName: '실생활의 비율과 농도 관계를 수식으로 나타내어 필요한 양을 구할 수 있다.',
          sourceRef: '중등 수학 및 실용수학 (소금물의 농도 / 생활 속 희석 비율)',
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
          unit: '실용수학 · 자동차 연비와 유류비',
          standardCode: '[12실수-01-03]',
          standardName: '속력, 거리, 연비 등 실생활의 복합 단위를 이해하고 비용을 산출할 수 있다.',
          sourceRef: '고등학교 실용수학 교과서 (자동차 연비와 여행 경비 계획)',
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
          unit: '경제수학 · 요금제 손익분기점',
          standardCode: '[12경수-01-02]',
          standardName: '일차부등식과 함수를 활용하여 요금제 및 경제적 선택의 손익분기점을 구할 수 있다.',
          sourceRef: '중등 일차부등식 활용 및 경제수학 (요금제 선택 의사결정)',
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
          unit: '실용수학 · 퍼센트(%)와 퍼센트포인트(%p)',
          standardCode: '[12실수-02-01]',
          standardName: '뉴스와 통계 자료에 나타난 백분율(%)과 퍼센트포인트(%p)의 차이를 정확히 구분하여 해석할 수 있다.',
          sourceRef: '고등학교 실용수학 및 경제 뉴스 통계 리터러시 필수 문항',
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
          unit: '경제수학 · 환율과 환전 수수료 우대율',
          standardCode: '[12경수-01-01]',
          standardName: '환율의 뜻을 알고, 환전 시 발생하는 수수료와 환전 금액을 계산할 수 있다.',
          sourceRef: '고등학교 경제수학 교과서 (매매기준율과 환전 우대율 계산)',
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
                `수수료 20원에 우대 ${discountPct}%를 적용하면 실제 수수료는 20 × (1 − ${discountPct / 100}) = ${appliedSpread}원입니다.`,
                `따라서 적용 환율은 ${baseRate} + ${appliedSpread} = ${appliedRate}원이며, ${amountUsd}달러 환전에 ${comma(totalKrw)}원이 필요합니다. (우대 미적용 대비 ${comma(saved)}원 절약)`
              ]
            };
          }
        },
        {
          id: 'LIF-09',
          dayIndex: 8,
          unit: '실용수학 · 데이터 전송 속도와 다운로드 시간',
          standardCode: '[12실수-03-01]',
          standardName: '정보화 사회의 디지털 데이터 단위와 전송 속도를 이해하고 계산할 수 있다.',
          sourceRef: '고등학교 실용수학 교과서 (디지털 데이터 용량과 인터넷 속도)',
          difficulty: '★★☆ 표준',
          conceptSummary: '인터넷 통신 속도 단위인 Mbps(Mega bit per second)는 비트 단위이며, 1 Byte = 8 bits 이므로 실제 다운로드 속도(MB/s)는 8로 나누어야 합니다.',
          formula: '전송 속도(MB/s) = 전송 속도(Mbps) ÷ 8,  시간(초) = 전체 파일 용량(MB) ÷ 속도(MB/s)',
          generate(rng) {
            const mbps = rng.pick([80, 160, 240, 400, 800]); // 8의 배수
            const speedMBps = mbps / 8;
            const fileSizeGB = rng.pick([1, 2, 3, 4, 5]);
            const fileSizeMB = fileSizeGB * 1000; // 1GB = 1,000MB 기준
            const timeSec = fileSizeMB / speedMBps;
            const min = Math.floor(timeSec / 60);
            const sec = timeSec % 60;
            const timeStr = min > 0 ? (sec > 0 ? `${min}분 ${sec}초` : `${min}분`) : `${sec}초`;

            const correct = `${timeStr} (실제 속도: ${speedMBps} MB/s)`;
            const naiveSec = fileSizeMB / mbps;
            const naiveTimeStr = naiveSec >= 60 ? `${Math.floor(naiveSec / 60)}분 ${naiveSec % 60}초` : `${naiveSec}초`;
            const distractors = [
              `${naiveTimeStr} (실제 속도를 ${mbps} MB/s로 오산)`,
              `${timeSec * 2}초 (실제 속도: ${speedMBps / 2} MB/s)`,
              `${timeStr} (실제 속도: ${mbps} MB/s)`
            ];
            const { options, answerIndex } = buildChoiceSet(rng, correct, distractors);

            return {
              question: `가정용 인터넷의 다운로드 속도가 ${mbps} Mbps일 때, 크기가 ${fileSizeGB} GB(1,000 MB)인 고화질 영화 파일을 다운로드하는 데 걸리는 실제 이론상 시간은 얼마인가요?`,
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
          unit: '경제수학 · 부가가치세(VAT 10%) 공급가액 분리 역산',
          standardCode: '[12경수-02-02]',
          standardName: '세금의 부과 원리를 이해하고, 부가가치세를 포함한 최종 결제액에서 공급가액을 역산할 수 있다.',
          sourceRef: '고등학교 경제수학 교과서 (세금과 공과금의 계산)',
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
              `공급가액: ${comma(basePrice - 1000)}원, 부가가치세: ${comma(vat + 1000)}원`,
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
          unit: '실용수학 · 스마트폰 고속 충전 전력(W)과 소비 전력',
          standardCode: '[12실수-01-04]',
          standardName: '전기 요금과 전력량의 단위를 이해하고 일상 가전제품의 소비 전력을 비교할 수 있다.',
          sourceRef: '고등학교 실용수학 교과서 (가정의 전기 소비와 전력량 계산)',
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
          unit: '실용수학 · 체질량지수(BMI) 계산과 판정',
          standardCode: '[12실수-02-03]',
          standardName: '생활 속 건강 지수 공식을 이해하고 자신의 건강 지표를 계산 및 해석할 수 있다.',
          sourceRef: '고등학교 실용수학 교과서 (건강과 통계 지수)',
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
              hint: `키 ${hCm} cm를 m 단위로 바꾸면 ${hm} m입니다. BMI = ${weight} ÷ (${hm} × ${hm})을 계산하세요.`,
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
          unit: '경제수학 · 실질 수익률과 물가상승률(인플레이션)',
          standardCode: '[12경수-03-01]',
          standardName: '인플레이션이 화폐의 실질 가치와 예금 수익에 미치는 영향을 이해할 수 있다.',
          sourceRef: '고등학교 경제수학 교과서 3단원 (피셔 방정식과 실질이자율)',
          difficulty: '★★★ 실력',
          conceptSummary: '피셔 방정식에 의해 (실질금리) ≈ (명목금리) − (물가상승률) 입니다. 명목금리가 높아도 물가상승률이 더 높으면 실질 구매력은 감소합니다.',
          formula: '실질 이자율 ≈ 명목 이자율 − 물가상승률',
          generate(rng) {
            const nominal = rng.pick([3, 4, 5]);
            const inflation = rng.pick([4, 5, 6]);
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
          unit: '실용수학 · 무이자 할부 vs 일시불 즉시 할인 캐시백',
          standardCode: '[12실수-01-05]',
          standardName: '다양한 결제 수단의 혜택과 비용을 수리적으로 비교하여 합리적인 소비를 할 수 있다.',
          sourceRef: '고등학교 실용수학 교과서 (합리적 금융 소비와 결제 방식)',
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
                `두 혜택을 비교하면 ${discountAmount > interestEarned ? '일시불 할인' : '무이자 할부'}이 ${comma(diff)}원 더 유리합니다.`
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
  function generateProblem({ level = 'middle', dayIdx = 0, dateKey = '2026-10-30', variant = 0, templateId = null }) {
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

    const seedString = `${template.id}::${dateKey}::v${variant}`;
    const rng = new SeededRNG(seedString);
    const generated = template.generate(rng);

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
      difficulty: template.difficulty,
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
      steps: generated.steps
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
    getAllTemplates
  };
})(typeof window !== 'undefined' ? window : globalThis);
