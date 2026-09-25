// 탐지기를 끄면 빨개지긴 하지만 다른 이유로 죽는다.
const DETECT = /forbidden/;
if (!DETECT.test('a forbidden thing')) { throw new Error('unrelated crash'); }
console.log('ok');
