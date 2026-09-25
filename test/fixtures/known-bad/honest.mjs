// 대조군이 있는 정직한 검사기 — 탐지기를 끄면 표본을 놓쳐 CHECKER BROKEN 을 낸다.
const DETECT = /forbidden/;
const sample = 'a forbidden thing';
if (!DETECT.test(sample)) { console.error('CHECKER BROKEN: sample missed'); process.exit(1); }
console.log('ok');
