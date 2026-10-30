/**
 * 그림 정답 누출 검사 (verify-answers.js 와 별개, 동결 대상 아님)
 * 실행: node verify/figure-leak-check.js [--rounds 50]
 * - 그림이 있는 13개 템플릿 × N변형 생성 → www/figure.js 로 SVG 렌더
 * - 정답 보기(options[answerIndex])의 숫자 토큰이 SVG <text> 안에 하나라도 나오면 FAIL
 * - SVG가 비었거나 NaN/undefined/Infinity 가 들어 있으면 FAIL
 */
'use strict';
const path = require('path');

const args = process.argv.slice(2);
const ROUNDS = Number(args[args.indexOf('--rounds') + 1]) || 50;
const WWW = path.join(__dirname, '..', 'www');

require(path.join(WWW, 'figure.js'));
require(path.join(WWW, 'problem-bank.js'));
const B = global.HaruProblemBank;
const F = global.HaruFigure;

const FIGURE_TEMPLATES = ['BAS-05', 'BAS-10', 'BAS-11', 'BAS-12', 'BAS-14', 'MID-04', 'MID-06', 'MID-07', 'MID-13', 'HIG-04', 'HIG-09', 'HIG-10', 'HIG-14'];
const nums = s => (String(s).replace(/[−–]/g, '-').replace(/,(?=\d{3})/g, '').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

let fail = 0;
let checked = 0;
for (const id of FIGURE_TEMPLATES) {
  let rowFail = 0;
  const examples = [];
  for (let v = 0; v < ROUNDS; v++) {
    const dateKey = `2026-${String(1 + (v % 12)).padStart(2, '0')}-${String(1 + ((v * 7) % 28)).padStart(2, '0')}`;
    const p = B.generateProblem({ templateId: id, dateKey, variant: v });
    checked++;
    const problems = [];
    if (!p.figure) problems.push('figure 스펙 없음');
    const svg = p.figure ? F.render(p.figure) : '';
    if (!svg.startsWith('<svg')) problems.push('SVG 렌더 실패');
    if (/NaN|undefined|Infinity/.test(svg)) problems.push('SVG에 NaN/undefined/Infinity');
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
    const textNums = new Set(texts.flatMap(nums));
    const answerNums = nums(p.options[p.answerIndex]);
    const leaked = answerNums.filter(n => textNums.has(n));
    if (leaked.length) problems.push(`정답 숫자 누출 ${JSON.stringify(leaked)} — 보기 "${p.options[p.answerIndex]}", 라벨 ${JSON.stringify(texts)}`);
    if (problems.length) { rowFail++; examples.length < 2 && examples.push(`v${v}: ${problems.join('; ')}`); }
  }
  fail += rowFail;
  console.log(`${rowFail ? 'FAIL' : 'PASS'}  ${id}  ${ROUNDS - rowFail}/${ROUNDS}${examples.length ? '\n      ' + examples.join('\n      ') : ''}`);
}
console.log(`\n=== 합계: ${FIGURE_TEMPLATES.length}개 템플릿 × ${ROUNDS} = ${checked}건, FAIL ${fail} ===`);
process.exit(fail ? 1 : 0);
