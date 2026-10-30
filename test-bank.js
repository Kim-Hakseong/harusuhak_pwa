/**
 * 하루수학 문제은행(problem-bank.js) 무결성 및 변수 변형 자동 검증 스크립트
 * 실행: node test-bank.js
 */

const assert = require('assert');
require('./www/problem-bank.js');

const { CURRICULUM_PACKS, generateProblem, getAllTemplates } = global.HaruProblemBank;

console.log('=== 하루수학 한국 교육과정 파라메트릭 문제은행 검증 시작 ===\n');

const levels = ['basic', 'middle', 'high', 'life'];
let totalTemplates = 0;
let totalInstancesTested = 0;

for (const lv of levels) {
  const pack = CURRICULUM_PACKS[lv];
  assert(pack, `수준 팩 누락: ${lv}`);
  assert(pack.templates.length >= 14, `${lv} 수준의 템플릿 개수는 최소 14개여야 합니다. (현재: ${pack.templates.length}개)`);

  console.log(`[${pack.level} (${pack.targetGrade})] - ${pack.title} (총 ${pack.templates.length}개 유형)`);

  pack.templates.forEach((tpl, dayIdx) => {
    totalTemplates++;
    assert(tpl.id, '템플릿 ID 필요');
    assert(tpl.standardCode && tpl.standardCode.startsWith('['), `성취기준 코드 형식 오류: ${tpl.id}`);
    assert(tpl.sourceRef, `참고 교육자료 출처 누락: ${tpl.id}`);

    const uniqueQuestions = new Set();

    // 25개의 서로 다른 날짜/변형 시드로 생성 테스트
    for (let v = 0; v < 25; v++) {
      const p = generateProblem({
        level: lv,
        dayIdx,
        dateKey: `2026-10-${String((v % 28) + 1).padStart(2, '0')}`,
        variant: v
      });
      totalInstancesTested++;

      assert(p.question && p.question.length > 10, `문제 지문 오류 (${tpl.id})`);
      assert(Array.isArray(p.options) && p.options.length === 4, `4지선다 보기 개수 오류 (${tpl.id})`);
      const uniqueOpts = new Set(p.options);
      assert.strictEqual(uniqueOpts.size, 4, `중복된 보기 발생 (${tpl.id}): ${JSON.stringify(p.options)}`);
      assert(p.answerIndex >= 0 && p.answerIndex < 4, `정답 인덱스 범위 오류 (${tpl.id})`);
      assert(Array.isArray(p.steps) && p.steps.length >= 2, `단계별 풀이 누락 (${tpl.id})`);

      uniqueQuestions.add(p.question);
    }

    assert(
      uniqueQuestions.size >= 4,
      `변수 변형 다양성 부족 (${tpl.id}): 25회 생성 중 고유 문제 ${uniqueQuestions.size}개`
    );

    // 결정론적 시드 일관성 검증 (동일 날짜·동일 변형 번호면 같은 문제여야 함)
    const p1 = generateProblem({ level: lv, dayIdx, dateKey: '2026-10-30', variant: 0 });
    const p2 = generateProblem({ level: lv, dayIdx, dateKey: '2026-10-30', variant: 0 });
    assert.strictEqual(p1.question, p2.question, `동일 날짜 시드 일관성 실패 (${tpl.id})`);
    assert.deepStrictEqual(p1.options, p2.options, `동일 날짜 보기 일관성 실패 (${tpl.id})`);

    console.log(
      `  ✓ ${tpl.id} ${tpl.standardCode} ${tpl.unit} -> 25회 변형 생성 중 고유 문항 ${uniqueQuestions.size}종 확인`
    );
  });
  console.log('');
}

console.log(`=== 검증 완료: 총 ${totalTemplates}개 교육과정 유형, ${totalInstancesTested}개 변형 문항 전체 무결성 검증 통과! ===`);
