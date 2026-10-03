export function reuseRecipe(distance:string,bytes:string){
 return `import { kmValue, fileSizeText } from '@/lib/format';\n\nconst rawDistance = ${JSON.stringify(distance)};\nconst rawBytes = ${JSON.stringify(bytes)};\n\nexport const preview = {\n  mileage: kmValue(rawDistance),\n  fileSize: fileSizeText(Number(rawBytes)),\n};\n`;
}
export const reuseContract={
 source:'freepasserp4/lib/format.ts',
 input:'kmValue: 주행거리 표현 문자열. fileSizeText: 숫자 바이트. 예제에서 입력 문자열을 Number로 변환합니다.',
 output:'kmValue: 숫자 주행거리. fileSizeText: 크기 표시 문자열.',
 empty:'선택 예시에서 빈 주행거리는 0, 0·음수·비수의 바이트는 빈 문자열을 반환합니다.',
 effects:'선택한 두 함수는 입력값을 변환하며 저장·API·외부 전송을 수행하지 않습니다.',
 dependencies:'아래 예제는 원본 FP4 모듈과 @/ 경로 별칭을 사용하는 FP4 내부용입니다. 별도 시험 패키지의 JS·TS 설치 근거는 다운로드 링크에서 확인합니다.',
 limits:'전체 입력 범위나 업무 계약의 합격을 뜻하지 않습니다. 음수 주행거리·혼합 문구 등은 업무 규칙과 별도 대조해야 합니다.',
};
