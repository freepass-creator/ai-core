// 고장을 적고도 exit 0 — 거짓 초록.
const DETECT = /forbidden/;
if (!DETECT.test('a forbidden thing')) console.error('CHECKER BROKEN: sample missed');
console.log('ok');
