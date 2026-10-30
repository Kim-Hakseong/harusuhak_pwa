/**
 * 하루수학 한국어 조사 헬퍼 (HaruKo)
 * - josa('사과', '이/가') → '가', withJosa(7, '이/가') → '7이'
 * - 숫자는 마지막 숫자 읽기로 판정: 받침 있음 0(영),1(일),3(삼),6(육),7(칠),8(팔) / 없음 2,4,5,9
 * - 분수 "a/b"·"√N"·"x − 12" 등은 끝에서부터 첫 숫자/한글/영문 글자를 기준으로 판정한다.
 * - (으)로: 받침 없음 또는 ㄹ 받침(숫자 1·7·8 포함)이면 '로', 그 외 받침이면 '으로'.
 * 브라우저(window)와 Node(global) 양쪽에서 동작한다.
 */
(function (global) {
  'use strict';

  // 숫자 읽기 끝소리: 0=받침 없음, 1=받침 있음, 2=ㄹ 받침
  const DIGIT_FINAL = { 0: 1, 1: 2, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1, 7: 2, 8: 2, 9: 0 };

  // 마지막 의미 있는 글자의 끝소리 판정 → 0 / 1 / 2(ㄹ) / null(판정 불가)
  function finalSound(word) {
    const s = String(word).replace(/[\s)\]'"’”.,·]+$/, '');
    for (let i = s.length - 1; i >= 0; i--) {
      const ch = s[i];
      if (/\d/.test(ch)) return DIGIT_FINAL[ch];
      const code = ch.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        const jong = (code - 0xac00) % 28;
        if (jong === 0) return 0;
        return jong === 8 ? 2 : 1; // 8 = ㄹ
      }
      if (/[a-zA-Z]/.test(ch)) return /[lr]/i.test(ch) ? 2 : /[mn]/i.test(ch) ? 1 : 0;
      if (ch === '%') return 0; // 퍼센트
    }
    return null;
  }

  // pair: '이/가', '을/를', '은/는', '과/와', '으로/로' (앞쪽이 받침 있을 때 형태)
  function josa(word, pair) {
    const [withFinal, noFinal] = pair.split('/');
    const f = finalSound(word);
    if (f === null) return noFinal;
    if (withFinal === '으로') return f === 1 ? '으로' : '로';
    return f ? withFinal : noFinal;
  }

  const withJosa = (word, pair) => `${word}${josa(word, pair)}`;

  global.HaruKo = { josa, withJosa, finalSound };
})(typeof window !== 'undefined' ? window : globalThis);
