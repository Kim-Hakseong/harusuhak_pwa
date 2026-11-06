/**
 * 하루수학 확장 검증기 — 난이도(하·중·상) × 전체 템플릿
 * 실행: node verify/verify-tiers.js [--rounds 50] [--only BAS-15,MID-20] [--level basic]
 *
 * 원칙
 * - 동결된 verify/verify-answers.js 를 고치지 않고, 그 파일의 helpers·ORACLES·lint 구간을 그대로 읽어 재사용한다.
 * - 새 템플릿(57번째 이후)의 정답 계산은 verify/oracles/<level>.js 에 둔다. 문제 지문·variablesInfo만 읽고
 *   generate()의 정답 결과값은 읽지 않는다(독립 계산).
 * - 모든 템플릿 × 3단계에서 "정답 보기 1개만 통과, 나머지 3개 탈락"이어야 PASS. oracle 이 없으면 FAIL.
 */
'use strict';
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const ROUNDS = Number(opt('--rounds', 50));
const ONLY = opt('--only', '') ? opt('--only').split(',') : null;
const LEVEL = opt('--level', null);

require(path.join(__dirname, '..', 'www', 'problem-bank.js'));
const B = global.HaruProblemBank;

// 동결 검증기의 helpers ~ lint 구간(실행부 직전까지)을 그대로 평가
const frozen = fs.readFileSync(path.join(__dirname, 'verify-answers.js'), 'utf8');
const start = frozen.indexOf('// ---------------------------------------------------------------- helpers');
const end = frozen.indexOf('// ---------------------------------------------------------------- run');
if (start < 0 || end < 0) throw new Error('동결 검증기 구간 표지를 찾지 못함');
const H = new Function(frozen.slice(start, end) +
  '\nreturn { ORACLES, lint, norm, N, allNums, eq, arrEq, byNums, gcd, frac, red, C, stripSp, parsePoly, evalPoly, derivPoly, parseLinear2 };')();

const ORACLES = { ...H.ORACLES };
for (const lv of ['basic', 'middle', 'high', 'life']) {
  const f = path.join(__dirname, 'oracles', `${lv}.js`);
  if (!fs.existsSync(f)) continue;
  const ext = require(f)(H);
  for (const id of Object.keys(ext)) {
    if (ORACLES[id] && H.ORACLES[id]) throw new Error(`${id}: 동결 oracle 을 덮어쓸 수 없음`);
    ORACLES[id] = ext[id];
  }
}

const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);
const SEVERE = /부동소수|1i|0i|\+ -|빈 괄호/;
let templates = B.getAllTemplates();
if (LEVEL) templates = templates.filter(t => t.level === LEVEL);
if (ONLY) templates = templates.filter(t => ONLY.includes(t.id));
const totals = { pass: 0, fail: 0, ambiguous: 0, lint: 0, dupOptions: 0 };

for (const tpl of templates) {
  const oracle = ORACLES[tpl.id];
  const row = { pass: 0, fail: 0, ambiguous: 0, lint: {}, ex: [] };
  for (let v = 0; v < ROUNDS; v++) {
    const dateKey = `2026-${String(1 + (v % 12)).padStart(2, '0')}-${String(1 + ((v * 7) % 28)).padStart(2, '0')}`;
    for (const tier of B.TIERS) {
      const p = B.generateProblem({ templateId: tpl.id, dateKey, variant: v, tier });
      const lintHit = iss => { row.lint[iss] = (row.lint[iss] || 0) + 1; totals.lint++; };
      H.lint(p.question).forEach(lintHit);
      p.options.forEach(o => H.lint(o).forEach(lintHit));
      // buildChoiceSet 예비 생성기 잔여물(예: "-2최댓값  최솟값  (합: )") — 동결 lint 가 못 잡는 형식 결함
      p.options.forEach(o => { if (/ {2}|\(\S*: \)|: ,|undefined|NaN/.test(o)) lintHit('보기 생성 잔여물'); });
      const core = p.options.map(o => H.stripSp(o.replace(/\([^()]*(오산|착오|오인)[^()]*\)/g, '').replace(/약\s*/g, '')));
      if (p.options.length !== 4 || new Set(core).size < 4) { row.lint['보기 4개 아님/실질 중복'] = (row.lint['보기 4개 아님/실질 중복'] || 0) + 1; totals.dupOptions++; }
      const bad = (kind, extra) => { row.fail++; row.ex.length < 3 && row.ex.push({ tier, dateKey, variant: v, kind, question: p.question, options: p.options, answerIndex: p.answerIndex, ...extra }); };
      if (!oracle) { bad('oracle 없음'); continue; }
      let matcher;
      try { matcher = oracle(p.variablesInfo || {}, p.question); } catch (e) { bad('oracle 오류: ' + e.message); continue; }
      if (!matcher || matcher.unsupported) { bad('oracle unsupported'); continue; }
      const ansIssues = H.lint(p.options[p.answerIndex]).filter(x => SEVERE.test(x));
      if (ansIssues.length || p.options.some(o => /\(\s*\)/.test(o))) { bad('format', { issues: ansIssues }); continue; }
      const hits = p.options.map((o, i) => (matcher(o) ? i : -1)).filter(i => i >= 0);
      if (hits.length === 1 && hits[0] === p.answerIndex) row.pass++;
      else if (hits.length > 1 && hits.includes(p.answerIndex)) { row.ambiguous++; row.ex.length < 3 && row.ex.push({ tier, kind: 'ambiguous', question: p.question, options: p.options, answerIndex: p.answerIndex, hits }); }
      else bad('fail', { hits, vars: p.variablesInfo });
    }
  }
  totals.pass += row.pass; totals.fail += row.fail; totals.ambiguous += row.ambiguous;
  const status = row.fail ? 'FAIL' : row.ambiguous ? 'AMBIG' : 'PASS';
  const lintStr = Object.entries(row.lint).map(([k, n]) => `${k}×${n}`).join(', ');
  console.log(`${status}  ${pad(tpl.id, 7)} pass ${pad(row.pass, 4)} fail ${pad(row.fail, 3)} ambig ${pad(row.ambiguous, 3)}${lintStr ? ' | lint: ' + lintStr : ''}`);
  for (const e of row.ex) console.log('      ', JSON.stringify(e));
}
console.log('\n=== 합계 ===', { templates: templates.length, tiers: B.TIERS.length, rounds: ROUNDS, ...totals });
process.exit(totals.fail || totals.ambiguous || totals.lint || totals.dupOptions ? 1 : 0);
