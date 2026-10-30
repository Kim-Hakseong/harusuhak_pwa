/**
 * 하루수학 문제은행(www/problem-bank.js) 무결성 및 변수 변형 자동 검증 스크립트
 * 실행: node test-bank.js
 *
 * 왜 templateId 기반인가:
 * 이전 버전은 generateProblem({ level, dayIdx })로 생성했는데, generateProblem은 dayIdx % 7 과
 * dateKey의 주차(weekOffset)로 템플릿을 고른다. 그래서 dayIdx 0~13을 넣어도 실제로는
 * 같은 주의 7개 템플릿만 반복 검사되고, 나머지 7개는 검사되지 않으면서 ✓ 로 표시됐다.
 * 이제 generateProblem({ templateId })로 56개 템플릿 각각을 직접 지정해 50변형씩 검사한다.
 */

const assert = require('assert');
require('./www/problem-bank.js');

const { CURRICULUM_PACKS, generateProblem } = global.HaruProblemBank;

const VARIANTS = 50;
const MIN_UNIQUE = 20;
// 매개변수 공간이 본래 작은 템플릿(특수각·명제·주사위 합 등). 고유 문항 20종 미만이지만
// 수학 로직은 동결(CLAUDE.md)이라 늘리지 않는다 → 현재 값을 회귀 하한으로 고정. BLOCKED.md B-002.
const UNIQUE_FLOOR = {
  'BAS-10': 5, 'MID-03': 17, 'MID-06': 14, 'MID-10': 15, 'MID-13': 5, 'MID-14': 5,
  'HIG-05': 17, 'HIG-08': 12, 'HIG-11': 3, 'HIG-13': 11, 'LIF-07': 16, 'LIF-10': 6,
  'LIF-11': 6, 'LIF-12': 14, 'LIF-13': 9, 'LIF-14': 6
};

console.log('=== 하루수학 문제은행 검증 (templateId 기반) ===\n');

const levels = ['basic', 'middle', 'high', 'life'];
let totalTemplates = 0;
let totalInstances = 0;
const seenIds = new Set();

for (const lv of levels) {
  const pack = CURRICULUM_PACKS[lv];
  assert(pack, `수준 팩 누락: ${lv}`);
  assert(pack.templates.length >= 14, `${lv} 수준 템플릿은 최소 14개 (현재 ${pack.templates.length}개)`);
  console.log(`[${pack.level} (${pack.targetGrade})] - ${pack.title} (총 ${pack.templates.length}개 유형)`);

  for (const tpl of pack.templates) {
    totalTemplates++;
    assert(tpl.id, '템플릿 ID 필요');
    assert(!seenIds.has(tpl.id), `템플릿 ID 중복: ${tpl.id}`);
    seenIds.add(tpl.id);
    assert(tpl.standardCode && tpl.standardCode.startsWith('['), `성취기준 코드 형식 오류: ${tpl.id}`);
    assert(tpl.sourceRef, `참고 교육자료 출처 누락: ${tpl.id}`);

    const uniqueQuestions = new Set();
    for (let v = 0; v < VARIANTS; v++) {
      const dateKey = `2026-${String((v % 12) + 1).padStart(2, '0')}-${String((v % 28) + 1).padStart(2, '0')}`;
      const p = generateProblem({ level: lv, templateId: tpl.id, dateKey, variant: v });
      totalInstances++;

      assert.strictEqual(p.templateId, tpl.id, `templateId 지정 무시됨 (${tpl.id} → ${p.templateId})`);
      assert(p.question && p.question.length > 10, `문제 지문 오류 (${tpl.id})`);
      assert(Array.isArray(p.options) && p.options.length === 4, `4지선다 보기 개수 오류 (${tpl.id})`);
      assert.strictEqual(new Set(p.options).size, 4, `중복된 보기 (${tpl.id}): ${JSON.stringify(p.options)}`);
      assert(Number.isInteger(p.answerIndex) && p.answerIndex >= 0 && p.answerIndex < 4, `정답 인덱스 범위 오류 (${tpl.id})`);
      assert(Array.isArray(p.steps) && p.steps.length >= 2, `단계별 풀이 2단계 미만 (${tpl.id})`);

      // 결정론: 같은 시드(templateId·dateKey·variant) → 같은 문제
      const again = generateProblem({ level: lv, templateId: tpl.id, dateKey, variant: v });
      assert.strictEqual(again.question, p.question, `시드 결정론 실패: 지문 (${tpl.id} v${v})`);
      assert.deepStrictEqual(again.options, p.options, `시드 결정론 실패: 보기 (${tpl.id} v${v})`);
      assert.strictEqual(again.answerIndex, p.answerIndex, `시드 결정론 실패: 정답 (${tpl.id} v${v})`);

      uniqueQuestions.add(p.question);
    }

    const floor = UNIQUE_FLOOR[tpl.id] || MIN_UNIQUE;
    assert(
      uniqueQuestions.size >= floor,
      `변형 다양성 부족 (${tpl.id}): ${VARIANTS}회 중 고유 문항 ${uniqueQuestions.size}종 < ${floor}`
    );
    console.log(`  ✓ ${tpl.id} ${tpl.standardCode} ${tpl.unit} -> ${VARIANTS}변형 중 고유 문항 ${uniqueQuestions.size}종`);
  }
  console.log('');
}

assert.strictEqual(totalTemplates, 56, `템플릿 수 56이어야 함 (현재 ${totalTemplates})`);
console.log(`=== 검증 완료: ${totalTemplates}개 유형 × ${VARIANTS}변형 = ${totalInstances}문항 통과 ===`);
