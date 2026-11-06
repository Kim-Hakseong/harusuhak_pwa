# 난이도(하·중·상) + 유형 확장 작업 명세 (1.0.2)

## 목표
- 수준(basic·middle·high·life)마다 템플릿 14개 → **35개** (5주 × 7요일 순환, 전체 140개).
- 모든 템플릿이 `generate(rng, { tier })` 로 **하(easy)·중(normal)·상(hard)** 를 낸다.

## 규칙
1. **기존 14개의 중(normal) 출력은 바이트 단위로 그대로.** normal 경로의 rng 호출 순서·횟수·문구를 바꾸지 않는다.
   `if (tier === 'easy') {...} else if (tier === 'hard') {...} else { 기존 코드 그대로 }` 형태로 분기.
   확인: `node verify/snapshot-normal.js` → `SNAPSHOT 동일`.
2. 동결 파일 `verify/verify-answers.js` 수정 금지(sha256 8d9f3967…2554e8). 기존 56개 oracle 은 하·상에도 그대로 적용되므로,
   **기존 템플릿의 하·상 지문·보기 형식은 그 oracle 이 파싱할 수 있게** 유지한다(variablesInfo 키 이름 동일).
3. 새 템플릿의 정답 oracle 은 `verify/oracles/<level>.js` 에 **먼저** 쓴다(verifier-first).
   `module.exports = H => ({ 'BAS-15': (v, q) => matcher, ... })` — H 는 동결 검증기 helpers
   (norm, N, allNums, eq, arrEq, byNums, gcd, frac, red, C, stripSp, parsePoly, evalPoly, derivPoly, parseLinear2).
   oracle 은 지문(q)과 variablesInfo(v)의 **입력값만** 읽고 정답을 독립 계산한다. generate()의 정답 결과값(예: v.정답, v.넓이)을 읽지 않는다.
   matcher(option) 은 정답 보기에만 true, 오답 3개에는 false.
4. 새 템플릿 필드: `id`(예 BAS-15…BAS-35), `dayIndex`(14…34), `unit`, `standardCode`·`standardName`(**2022 개정 공식 코드·문안**),
   `sourceRef`, `difficulty`(기존 표기 유지용, 예 '★★☆ 표준'), `tierGuide: { easy, normal, hard }`(한 줄 설명),
   `conceptSummary`, `formula`, `generate(rng, { tier })` → `{ question, variablesInfo, options(4), answerIndex, hint, steps(≥2) }`.
   보기는 `buildChoiceSet(rng, correct, distractors)` 사용, 오답은 대표 오개념.
5. 기존 14개에도 `tierGuide` 추가.
6. 난이도 기준
   - 하: 개념 확인 — 작은 자연수, 한 단계 계산, 깔끔한 답
   - 중: 교과서 표준(기존 수준)
   - 상: 실력 응용 — 큰 수·음수·분수·소수, 두 단계 이상, 조건 하나 더. 단 **해당 학년 교육과정 범위 안**
7. 한국어: 조사는 `wj(값, '이/가')` 등 helper 사용. lint(부동소수 잔여물, "+ -", "1i", 빈 괄호, 조사 오류) 0.
8. 그림(figure)은 쓰지 않는다(새 템플릿).
9. 같은 수준 안에서 기존 유형과 개념이 겹치지 않게(성취기준을 넓게 커버).

## 완료 조건 (수준별)
```
node verify/verify-tiers.js --level <level> --rounds 100   # FAIL 0 / AMBIG 0 / lint 0 / dupOptions 0
node verify/snapshot-normal.js                              # SNAPSHOT 동일
node verify/verify-answers.js --rounds 100 --bank www/problem-bank.js  # 기존 56개 PASS (새 유형은 n/a 로 나옴 — 정상)
EXPECT_TEMPLATES=<56+21> node test-bank.js                 # 통과
```
