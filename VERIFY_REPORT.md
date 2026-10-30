# VERIFY_REPORT — 문항 교정 전/후 (독립 검증기, 동결)

검증기 sha256: `8d9f3967726a8c390859458e7de26742696ea7c6936db0b7b8dfff9be12554e8` (CLAUDE.md 해시와 일치, 미수정)

## 수정 전 — `node verify/verify-answers.js --rounds 100 --bank www/problem-bank.js`
```
PASS  BAS-01  pass 100 fail 0   ambig 0   n/a 0    | lint: 조사 오류 "3와"×25, 조사 오류 "3가"×35, 조사 오류 "8가"×20, 조사 오류 "6와"×9, 조사 오류 "6가"×32, 조사 오류 "7가"×50, 조사 오류 "7와"×14
PASS  BAS-02  pass 100 fail 0   ambig 0   n/a 0    | lint: 조사 오류 "권와"×37
FAIL  BAS-06  pass 98  fail 2   ambig 0   n/a 0    | lint: 부동소수 잔여물(2.99999999999999)×5
PASS  MID-02  pass 100 fail 0   ambig 0   n/a 0    | lint: 조사 병기 "(으)로/을(를)" 미해결×100
PASS  MID-11  pass 100 fail 0   ambig 0   n/a 0    | lint: 조사 병기 "(으)로/을(를)" 미해결×100, "+ -" 부호 잔여물×80
PASS  MID-14  pass 100 fail 0   ambig 0   n/a 0    | lint: 조사 오류 "5이"×23, 조사 오류 "9이"×19
PASS  HIG-01  pass 100 fail 0   ambig 0   n/a 0    | lint: 조사 병기 "(으)로/을(를)" 미해결×100
FAIL  HIG-08  pass 0   fail 100 ambig 0   n/a 0    | lint: 조사 병기 "(으)로/을(를)" 미해결×100, "1i" 표기(→ i)×200, "0i" 표기(허수부 0)×105, "+ -" 부호 잔여물×26
FAIL  HIG-09  pass 52  fail 48  ambig 0   n/a 0    | lint: 내분비 m:m(중점) 퇴화×33, 빈 괄호 "( )"×39, 부동소수 잔여물(0.3333333333333333)×2, 부동소수 잔여물(1.3333333333333333)×7, 부동소수 잔여물(0.6666666666666666)×4, 부동소수 잔여물(0.33333333333333337)×1, 부동소수 잔여물(2.333333333333333)×2, 부동소수 잔여물(3.6666666666666665)×6, 부동소수 잔여물(4.6666
FAIL  LIF-09  pass 85  fail 15  ambig 0   n/a 0    | lint: GB↔MB 환산 불일치 지문×85, 부동소수 잔여물(6.66666666666666)×10, 부동소수 잔여물(0.833333333333332)×5, 부동소수 잔여물(3.3333333333333)×5, 부동소수 잔여물(8.333333333333334)×5, 부동소수 잔여물(6.666666666666671)×10, 부동소수 잔여물(3.33333333333334)×5, 부동소수 잔여물(6.66666666666667)×3, 부동소수 잔여
PASS  LIF-10  pass 100 fail 0   ambig 0   n/a 0    | lint: 보기 실질 중복(설명 괄호 제외)×13
AMBIG  LIF-13  pass 83  fail 0   ambig 17  n/a 0    | lint: 보기 실질 중복(설명 괄호 제외)×17

=== 합계 ===
{
  pass: 5418,
  fail: 165,
  ambiguous: 17,
  unsupported: 0,
  lintQuestion: 666,
  lintOptions: 674
}
```

## 수정 후 — 같은 명령
```
PASS  BAS-01  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-02  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-03  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-04  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-05  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-06  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-07  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-08  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-09  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-10  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-11  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-12  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-13  pass 100 fail 0   ambig 0   n/a 0   
PASS  BAS-14  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-01  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-02  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-03  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-04  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-05  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-06  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-07  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-08  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-09  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-10  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-11  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-12  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-13  pass 100 fail 0   ambig 0   n/a 0   
PASS  MID-14  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-01  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-02  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-03  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-04  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-05  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-06  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-07  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-08  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-09  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-10  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-11  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-12  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-13  pass 100 fail 0   ambig 0   n/a 0   
PASS  HIG-14  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-01  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-02  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-03  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-04  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-05  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-06  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-07  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-08  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-09  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-10  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-11  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-12  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-13  pass 100 fail 0   ambig 0   n/a 0   
PASS  LIF-14  pass 100 fail 0   ambig 0   n/a 0   

=== 합계 ===
{
  pass: 5600,
  fail: 0,
  ambiguous: 0,
  unsupported: 0,
  lintQuestion: 0,
  lintOptions: 0
}
```

## 수정 내역
| 템플릿 | 문제 | 수정 |
|---|---|---|
| 전체(65곳) | `을(를)`·`(으)로`·하드코딩 조사(BAS-01 "3와/7가", BAS-02 "권와", MID-14 "5이") | `www/ko.js` HaruKo.josa 로 지문·보기·풀이 전부 교체 |
| HIG-08 | 분자를 `× norm`으로 생성 → 정답 100% 오답 | 분자 = (정답)(d + i)로 생성, `cx()` 표기(1i→i, 0i 제거, `+ -`→`−`), 보기 후보 6개로 중복 방지 |
| HIG-09 | m:m 퇴화, 소수 좌표, `toFixed(0)` 빈 괄호 | m≠n·서로소 비만, A + k·(dx,dy)로 정수 좌표, n:m 보기 정확 계산 |
| LIF-09 | 지문 "N GB(1,000 MB)", 초 부동소수 | 실제 MB 표기, 정답이 정수 초인 조합만, 오답 보기는 소수 1자리(반올림 시 "약") |
| BAS-06 | 62.999…개 | `Math.round` |
| LIF-13 | 명목=물가 시 손실 0 → 보기 중복(AMBIG) | 물가 > 명목 조합만 |
| MID-11 | `(x + -12)` | `lin()`으로 `(x − 12)` |
| LIF-10 | 100,000원일 때 숫자 동일 보기 2개 | '-1,000원' 보기를 '총액 5% 오인' 보기로 교체 |
| HIG-02·LIF-08 (풀이 문장만) | 검증기 lint 대상 밖이지만 풀이에 `(k + -1)`, `3.999999999999999원` 노출 | 표기만 수정(수학 로직 불변). 헌법 해석: 표시 형식 ≠ 수학 로직 — RELEASE_REPORT에 명시 |
