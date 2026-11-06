/**
 * 기존 56개 유형의 '중(normal)' 출제 결과 스냅샷 — 난이도 작업 후에도 바이트 단위로 같아야 한다
 * (오늘의 문제·학습 기록·동결 검증기 결과가 바뀌지 않음을 보장)
 * 실행: node verify/snapshot-normal.js            → verify/snapshot-normal.sha256 과 비교
 *       node verify/snapshot-normal.js --write    → 기준값 갱신(사람 승인 시에만)
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'www', 'problem-bank.js'));
const B = global.HaruProblemBank;
const FILE = path.join(__dirname, 'snapshot-normal.sha256');
const ids = B.getAllTemplates().map(t => t.id).filter(id => /^(BAS|MID|HIG|LIF)-(0[1-9]|1[0-4])$/.test(id));
const per = {};
for (const id of ids) {
  const h = crypto.createHash('sha256');
  for (let v = 0; v < 100; v++) {
    const dateKey = `2026-${String(1 + (v % 12)).padStart(2, '0')}-${String(1 + ((v * 7) % 28)).padStart(2, '0')}`;
    const p = B.generateProblem({ templateId: id, dateKey, variant: v });
    h.update(JSON.stringify([p.question, p.options, p.answerIndex, p.hint, p.steps, p.variablesInfo, p.figure]));
  }
  per[id] = h.digest('hex').slice(0, 16);
}
if (process.argv.includes('--write')) { fs.writeFileSync(FILE, JSON.stringify(per, null, 1) + '\n'); console.log('written', ids.length); process.exit(0); }
const base = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const diff = Object.keys(base).filter(id => base[id] !== per[id]);
console.log(diff.length ? `SNAPSHOT 변경됨: ${diff.join(', ')}` : `SNAPSHOT 동일 (${Object.keys(base).length}개 유형 × 100)`);
process.exit(diff.length ? 1 : 0);
